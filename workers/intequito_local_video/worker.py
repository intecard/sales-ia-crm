#!/usr/bin/env python3
"""INTECA local GPU worker: Wan 2.2 via local ComfyUI + Piper voice + FFmpeg.

Runs on a PC/workstation owned by INTECA; polls protected CRM endpoints over HTTPS.
It never calls any paid video platform and never chooses a replacement for INTEQUITO.
A real ComfyUI API-format image-to-video workflow with Wan 2.2 checkpoints
must be installed separately. No model weights are bundled in this repository.
"""
from __future__ import annotations
import copy
import json
import math
import os
from pathlib import Path
import re
import socket
import subprocess
import sys
import tempfile
import time
from urllib import parse, request
from urllib.error import HTTPError, URLError

PNG_SIGNATURE=b"\x89PNG\r\n\x1a\n"
ID_RE=re.compile(r"^[0-9a-f-]{36}$",re.I)
ERROR_RE=re.compile(r"^LOCAL_[A-Z0-9_]{2,70}$")
MAX_VIDEO_BYTES=70*1024*1024
MAX_CLIPS=16


class WorkerError(RuntimeError):
    def __init__(self, code:str, message:str=""):
        if not ERROR_RE.fullmatch(code):
            raise ValueError("invalid internal error code")
        super().__init__(message or code)
        self.code=code


def env_config():
    crm=os.getenv("INTECA_CRM_URL","").rstrip("/")
    secret=os.getenv("INTECA_LOCAL_VIDEO_WORKER_TOKEN","")
    comfy=os.getenv("INTECA_COMFYUI_URL","http://127.0.0.1:8188").rstrip("/")
    parsed=parse.urlparse(comfy)
    if not crm.startswith("https://") or len(secret)<32:
        raise WorkerError("LOCAL_CONFIG_INVALID","CRM must be HTTPS and token >=32 characters")
    if parsed.scheme!="http" or parsed.hostname not in ("localhost","127.0.0.1","::1"):
        raise WorkerError("LOCAL_COMFY_BIND","ComfyUI must run on this computer, not a public endpoint")
    workflow=Path(os.getenv("INTECA_COMFY_WORKFLOW","")).expanduser()
    voice=Path(os.getenv("INTECA_PIPER_VOICE_MODEL","")).expanduser()
    if not workflow.is_file() or not voice.is_file() or not Path(str(voice)+".json").is_file():
        raise WorkerError("LOCAL_MODEL_MISSING","Missing ComfyUI API workflow or Piper .onnx/.onnx.json voice")
    worker_id=re.sub(r"[^A-Za-z0-9_-]","-",os.getenv("INTECA_GPU_WORKER_ID",socket.gethostname()))[:64] or "gpu-1"
    return {"crm":crm,"token":secret,"comfy":comfy,"workflow":workflow,"voice":voice,"worker_id":worker_id,
            "poll":max(10,min(120,int(os.getenv("INTECA_WORKER_POLL_SECONDS","20"))))}


def http_bytes(url:str,method:str="GET",body:bytes|None=None,headers:dict|None=None,limit:int=MAX_VIDEO_BYTES)->bytes:
    req=request.Request(url,data=body,method=method,headers=headers or {})
    try:
        with request.urlopen(req,timeout=120) as response:
            if int(response.status)>=300:
                raise WorkerError("LOCAL_HTTP_ERROR")
            data=response.read(limit+1)
            if len(data)>limit:
                raise WorkerError("LOCAL_DOWNLOAD_TOO_LARGE")
            return data
    except HTTPError as exc:
        raise WorkerError("LOCAL_HTTP_ERROR",f"HTTP {exc.code} for {parse.urlparse(url).path}") from exc
    except (URLError,TimeoutError,OSError) as exc:
        raise WorkerError("LOCAL_HTTP_UNAVAILABLE",parse.urlparse(url).path) from exc


def request_json(url:str,token:str|None=None,method:str="GET",payload:dict|None=None)->dict:
    raw=None if payload is None else json.dumps(payload,ensure_ascii=False).encode("utf-8")
    headers={"Content-Type":"application/json","Accept":"application/json"}
    if token:headers["Authorization"]=f"Bearer {token}"
    data=http_bytes(url,method,raw,headers,limit=512*1024)
    try:return json.loads(data)
    except (ValueError,UnicodeDecodeError) as exc:raise WorkerError("LOCAL_JSON_INVALID") from exc


def workflow_replace(workflow:dict, replacements:dict)->dict:
    """Replace exact string sentinel values, not arbitrary node code from the CRM."""
    found={k:0 for k in replacements}
    def visit(x):
        if isinstance(x,str) and x in replacements:
            found[x]+=1
            return replacements[x]
        if isinstance(x,dict):return {k:visit(v) for k,v in x.items()}
        if isinstance(x,list):return [visit(v) for v in x]
        return x
    out=visit(copy.deepcopy(workflow))
    for token in ("__INTEQUITO_IMAGE__","__INTEQUITO_PROMPT__","__INTEQUITO_PREFIX__"):
        if found.get(token,0)<1:
            raise WorkerError("LOCAL_WORKFLOW_PLACEHOLDER",f"Required workflow placeholder missing: {token}")
    return out


def multipart_upload_image(base:str, png:bytes)->str:
    import uuid
    boundary=f"----INTECA{uuid.uuid4().hex}"
    body=(f"--{boundary}\r\nContent-Disposition: form-data; name=\"image\"; filename=\"intequito-oficial.png\"\r\nContent-Type: image/png\r\n\r\n").encode()+png
    body+=f"\r\n--{boundary}--\r\n".encode()
    result=request_json_multipart(base+"/upload/image",body,boundary)
    name=result.get("name")
    if not isinstance(name,str) or not re.fullmatch(r"[A-Za-z0-9_.-]{1,130}",name):
        raise WorkerError("LOCAL_IMAGE_UPLOAD")
    return name


def request_json_multipart(url:str,body:bytes,boundary:str)->dict:
    raw=http_bytes(url,"POST",body,{"Content-Type":f"multipart/form-data; boundary={boundary}"},limit=1024*1024)
    try:return json.loads(raw)
    except ValueError as exc:raise WorkerError("LOCAL_IMAGE_UPLOAD") from exc


def generate_clip(comfy:str,workflow:dict,image_name:str,prompt:str,prefix:str,destination:Path,timeout:int=1200)->None:
    graph=workflow_replace(workflow,{
        "__INTEQUITO_IMAGE__":image_name,
        "__INTEQUITO_PROMPT__":prompt[:1600],
        "__INTEQUITO_PREFIX__":prefix,
    })
    start=request_json(comfy+"/prompt",method="POST",payload={"prompt":graph,"client_id":"inteca-local-worker"})
    job_id=start.get("prompt_id")
    if not isinstance(job_id,str) or not ID_RE.fullmatch(job_id):
        raise WorkerError("LOCAL_COMFY_QUEUE")
    deadline=time.monotonic()+timeout
    history=None
    while time.monotonic()<deadline:
        result=request_json(comfy+"/history/"+parse.quote(job_id,safe=""))
        history=result.get(job_id)
        if history:
            state=history.get("status",{})
            if state.get("status_str") in ("error","failed"):
                raise WorkerError("LOCAL_COMFY_FAILED")
            if state.get("completed") is True:
                break
        time.sleep(5)
    else:raise WorkerError("LOCAL_COMFY_TIMEOUT")
    if not history:raise WorkerError("LOCAL_COMFY_OUTPUT_MISSING")
    media=[]
    for output in history.get("outputs",{}).values():
        for k in ("videos","gifs","files"):
            for item in output.get(k,[]):
                if isinstance(item,dict) and str(item.get("filename","")).lower().endswith((".mp4",".webm")):
                    media.append(item)
    if not media:raise WorkerError("LOCAL_COMFY_OUTPUT_MISSING","Use an API workflow with a SaveVideo MP4 node")
    item=media[0]
    filename=str(item.get("filename",""))
    subfolder=str(item.get("subfolder",""))
    if "/" in filename or "\\" in filename or ".." in filename or ".." in subfolder:
        raise WorkerError("LOCAL_COMFY_OUTPUT_INVALID")
    query=parse.urlencode({"filename":filename,"subfolder":subfolder,"type":"output"})
    output=http_bytes(comfy+"/view?"+query,limit=80*1024*1024)
    if len(output)<1024:raise WorkerError("LOCAL_COMFY_OUTPUT_INVALID")
    destination.write_bytes(output)


def command(args:list[str],stdin:str|None=None,timeout:int=240):
    try:
        return subprocess.run(args,input=stdin,text=stdin is not None,capture_output=True,timeout=timeout,check=True)
    except (FileNotFoundError,subprocess.CalledProcessError,subprocess.TimeoutExpired) as exc:
        raise WorkerError("LOCAL_PROCESSING_FAILED",f"Failed executable {args[0]}") from exc


def video_seconds(media:Path)->float:
    r=command(["ffprobe","-v","error","-show_entries","format=duration","-of","default=noprint_wrappers=1:nokey=1",str(media)],timeout=30)
    try:return float(r.stdout.strip())
    except ValueError as exc:raise WorkerError("LOCAL_MEDIA_INVALID") from exc


def hms(seconds:float)->str:
    millis=int(round(max(0,seconds)*1000))
    return f"{millis//3600000:02}:{(millis//60000)%60:02}:{(millis//1000)%60:02},{millis%1000:03}"


def subtitle_text(scenes:list[dict])->str:
    entries=[]
    for idx,scene in enumerate(scenes,1):
        text=str(scene.get("dialogue","")).strip()
        if not text:continue
        start=float(scene["from"]);stop=float(scene["to"])
        if stop<=start:raise WorkerError("LOCAL_SCRIPT_INVALID")
        entries.append(f"{idx}\n{hms(start)} --> {hms(stop)}\n{text}\n")
    return "\n".join(entries)


def concatenate(clips:list[tuple[Path,float]],workdir:Path)->Path:
    normalized=[]
    for idx,(clip,duration) in enumerate(clips):
        fixed=workdir/f"normalized_{idx:03}.mp4"
        # Loop locally only if a model output is shorter than the planned scene.
        command(["ffmpeg","-hide_banner","-loglevel","error","-y","-stream_loop","-1","-i",str(clip),"-t",f"{duration:.2f}",
                 "-vf","scale=720:1280:force_original_aspect_ratio=increase,crop=720:1280,fps=24",
                 "-c:v","libx264","-preset","veryfast","-crf","25","-pix_fmt","yuv420p","-an",str(fixed)],timeout=240)
        normalized.append(fixed)
    playlist=workdir/"concat.txt"
    playlist.write_text("".join(f"file '{p.as_posix()}'\n" for p in normalized),encoding="utf-8")
    merged=workdir/"merged.mp4"
    command(["ffmpeg","-hide_banner","-loglevel","error","-y","-f","concat","-safe","0","-i",str(playlist),
             "-c","copy",str(merged)],timeout=180)
    return merged


def render_video(script:dict,reference:bytes,cfg:dict,workdir:Path,progress)->Path:
    scenes=script.get("scenes")
    if not isinstance(scenes,list) or not 1<=len(scenes)<=8 or script.get("actor")!="INTEQUITO":
        raise WorkerError("LOCAL_SCRIPT_INVALID")
    expected=int(script.get("duration",0))
    if expected not in (45,60):raise WorkerError("LOCAL_SCRIPT_INVALID")
    try:workflow=json.loads(cfg["workflow"].read_text("utf-8"))
    except (OSError,ValueError) as exc:raise WorkerError("LOCAL_WORKFLOW_INVALID") from exc
    image_name=multipart_upload_image(cfg["comfy"],reference)
    total_span=sum(float(s["to"])-float(s["from"]) for s in scenes)
    if abs(total_span-expected)>1.5:raise WorkerError("LOCAL_SCRIPT_INVALID")
    clips=[]
    estimated_clips=sum(math.ceil((float(s["to"])-float(s["from"]))/5) for s in scenes)
    if estimated_clips>MAX_CLIPS:raise WorkerError("LOCAL_TOO_MANY_CLIPS")
    completed=0
    for idx,scene in enumerate(scenes):
        desired=float(scene["to"])-float(scene["from"])
        for part in range(math.ceil(desired/5)):
            segment=min(5,desired-part*5)
            if segment<=0:continue
            prompt=("Animated 3D INTEQUITO, the same original character from supplied image, consistent "
                    "hair, eyes, navy/turquoise headset, INTECA polo and badge. "
                    f"Environment: {str(scene.get('location',''))[:160]}. "
                    f"Action: {str(scene.get('action',''))[:220]}. Camera: {str(scene.get('camera',''))[:130]}. "
                    "Dynamic physical motion, not a slideshow. No subtitles added inside AI frames.")
            raw=workdir/f"clip_{idx}_{part}.mp4"
            generate_clip(cfg["comfy"],workflow,image_name,prompt,f"inteca_{idx}_{part}",raw)
            clips.append((raw,segment))
            completed+=1
            progress(15+int(65*completed/estimated_clips))
    montage=concatenate(clips,workdir)
    progress(85)
    voice=workdir/"voice.wav"
    narration=" ".join(str(s.get("dialogue","")).strip() for s in scenes)
    if not narration:raise WorkerError("LOCAL_SCRIPT_INVALID")
    command(["piper","--model",str(cfg["voice"]),"--output_file",str(voice)],stdin=narration,timeout=180)
    if video_seconds(voice)>expected-0.25:
        raise WorkerError("LOCAL_AUDIO_TOO_LONG","Reduce the dialogue; never truncate a medical/price claim")
    captions=workdir/"captions.srt"
    captions.write_text(subtitle_text(scenes),encoding="utf-8")
    # Paths in this generated temp folder are controlled by this worker only.
    safe_srt=str(captions).replace("\\","\\\\").replace(":","\\:").replace("'","\\'")
    overlay=("subtitles=filename='"+safe_srt+"':force_style='FontSize=17,Alignment=2,MarginV=160',"
             "drawtext=text='INTECA  |  WhatsApp 809-643-5502':fontcolor=white:fontsize=33:"
             "box=1:boxcolor=0x072e48@0.88:boxborderw=12:x=(w-text_w)/2:y=h-85")
    output=workdir/"intequito_final.mp4"
    command(["ffmpeg","-hide_banner","-loglevel","error","-y","-i",str(montage),"-i",str(voice),
             "-filter_complex",f"[0:v]{overlay}[v]",
             "-map","[v]","-map","1:a:0","-c:v","libx264","-preset","fast","-crf","24",
             "-pix_fmt","yuv420p","-c:a","aac","-b:a","160k","-af","apad",
             "-t",str(expected),"-movflags","+faststart",str(output)],timeout=360)
    if abs(video_seconds(output)-expected)>1.0 or output.stat().st_size>MAX_VIDEO_BYTES:
        raise WorkerError("LOCAL_OUTPUT_QA")
    progress(97)
    return output


def process_job(job:dict,cfg:dict)->None:
    jid=job.get("id","")
    claim=job.get("claimToken","")
    if not ID_RE.fullmatch(jid) or not ID_RE.fullmatch(str(claim)):
        raise WorkerError("LOCAL_CLAIM_INVALID")
    base=cfg["crm"]+"/api/local-video/worker"
    headers={"Authorization":"Bearer "+cfg["token"]}
    def progress(percentage:int):
        request_json(base+"/jobs/"+jid+"/progress",cfg["token"],"POST",{"claimToken":claim,"progress":percentage})
    try:
        image=http_bytes(base+"/reference",headers=headers,limit=8*1024*1024)
        if not image.startswith(PNG_SIGNATURE):raise WorkerError("LOCAL_REFERENCE_INVALID")
        with tempfile.TemporaryDirectory(prefix="inteca-gpu-") as root:
            output=render_video(job.get("script") or {},image,cfg,Path(root),progress)
            media=output.read_bytes()
            result=request_json_upload(base+"/jobs/"+jid+"/upload",cfg["token"],claim,media)
            if result.get("state")!="ready_for_review":raise WorkerError("LOCAL_OUTPUT_UNCONFIRMED")
            print("Completed (needs review):",jid,flush=True)
    except Exception as exc:
        # Avoid a crash leaving a job forever 'rendering' when ComfyUI or FFmpeg returns an unexpected error.
        code=exc.code if isinstance(exc,WorkerError) else "LOCAL_UNEXPECTED_ERROR"
        print("Worker error:",code,str(exc)[:150],file=sys.stderr,flush=True)
        # A possible upload-result ambiguity must never trigger another video generation automatically.
        try:request_json(base+"/jobs/"+jid+"/progress",cfg["token"],"POST",{"claimToken":claim,"progress":98,"errorCode":code})
        except Exception:pass


def request_json_upload(url:str,token:str,claim_token:str,media:bytes)->dict:
    raw=http_bytes(url,"POST",media,{"Authorization":f"Bearer {token}","X-INTECA-Claim-Token":claim_token,"Content-Type":"video/mp4"},limit=1024*1024)
    try:return json.loads(raw)
    except ValueError as exc:raise WorkerError("LOCAL_OUTPUT_UNCONFIRMED") from exc


def main():
    cfg=env_config()
    once="--once" in sys.argv
    print("INTECA own GPU worker; no HeyGen or Runway API. ID:",cfg["worker_id"],flush=True)
    while True:
        try:
            response=request_json(cfg["crm"]+"/api/local-video/worker/claim",cfg["token"],"POST",{"workerId":cfg["worker_id"]})
            job=response.get("job")
            if job:process_job(job,cfg)
        except Exception as exc:
            code=exc.code if isinstance(exc,WorkerError) else "LOCAL_UNEXPECTED_ERROR"
            print("Polling error:",code,file=sys.stderr,flush=True)
        if once:break
        time.sleep(cfg["poll"])


if __name__=="__main__":
    main()
