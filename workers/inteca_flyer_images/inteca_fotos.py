"""INTECA's local flyer renderer. Python 3.10+, stdlib only."""
import argparse
import datetime as dt
import getpass
import hashlib
import json
import os
from pathlib import Path
import platform
import re
import shutil
import subprocess
import tempfile
import time
import uuid
import urllib.error
import urllib.request
import zipfile

ORIGIN = "https://sales.ia.crm.inteca.com.do/api/local-flyer/worker"
ROOT = Path(os.getenv("LOCALAPPDATA") or Path.home()) / "INTECA-Fotos"
CHECKPOINT = "sd_xl_base_1.0.safetensors"
MODEL_URL = ("https://huggingface.co/stabilityai/stable-diffusion-xl-base-1.0/resolve/"
             f"462165984030d82259a11f4367a4eed129e94a7b/{CHECKPOINT}")
MODEL_HASH = "31e35c80fc4829d14f90153f4c74cd59c90b779f6afe05a74cd6120b893f7e5b"
RUNTIME_URL = ("https://github.com/leejet/stable-diffusion.cpp/releases/download/"
               "master-1141-e637c7b/sd-master-e637c7b-bin-win-cpu-x64.zip")
RUNTIME_HASH = "dae8a190227736d987486ab7d7697616ad1dea872f758e5ca550ad7e6692311c"
TOKEN_PATTERN = re.compile(r"[A-Za-z0-9_-]{43}")
PNG = b"\x89PNG\r\n\x1a\n"


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


def api(token, path, body=b"", headers=None):
    """Outbound HTTPS only. Never redirect a request with the private token."""
    if isinstance(body, dict):
        body = json.dumps(body).encode()
        headers = {"Content-Type": "application/json"}
    request = urllib.request.Request(ORIGIN + path, data=body, method="POST",
                                     headers={"Authorization": "Bearer " + token, **(headers or {})})
    with urllib.request.build_opener(NoRedirect()).open(request, timeout=55) as response:
        return json.loads(response.read(32_768))


def digest(file):
    hasher = hashlib.sha256()
    with open(file, "rb") as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b""):
            hasher.update(block)
    return hasher.hexdigest()


def download(url, path, sha):
    if path.is_file() and digest(path) == sha:
        return
    part = path.with_suffix(path.suffix + ".download")
    offset = part.stat().st_size if part.exists() else 0
    print(f"Descargando {path.name}. Esto solo se hace una vez.", flush=True)
    request = urllib.request.Request(url, headers={"Range": f"bytes={offset}-"} if offset else {})
    try:
        with urllib.request.urlopen(request, timeout=90) as upstream:
            expected = upstream.headers.get("Content-Range", "")
            append = offset and upstream.status == 206 and expected.startswith(f"bytes {offset}-")
            if upstream.status == 206 and not append:
                raise ValueError("El servidor devolvió un tramo de descarga inesperado.")
            with open(part, "ab" if append else "wb") as stream:
                shutil.copyfileobj(upstream, stream, 1024 * 1024)
    except urllib.error.HTTPError as exc:
        if exc.code != 416 or not offset:
            raise
    if digest(part) != sha:
        part.unlink()
        raise ValueError("La descarga no coincide con la firma SHA-256 esperada.")
    part.replace(path)


def install_windows():
    if os.name != "nt" or platform.machine().lower() not in {"amd64", "x86_64"}:
        raise ValueError("El instalador automático es para Windows 64 bits x86. En otro sistema usa --bin y --model.")
    ROOT.mkdir(parents=True, exist_ok=True)
    engine = ROOT / "runtime"
    binary = next(engine.rglob("sd-cli.exe"), None)
    if binary is None:
        archive = ROOT / "motor.zip"
        download(RUNTIME_URL, archive, RUNTIME_HASH)
        # This package is verified against the upstream release SHA-256 prior to extraction.
        with zipfile.ZipFile(archive) as artifact:
            for name in artifact.namelist():
                if not (engine / name).resolve().is_relative_to(engine.resolve()):
                    raise ValueError("Ruta inválida en el instalador del motor.")
            artifact.extractall(engine)
        binary = next(engine.rglob("sd-cli.exe"), None)
        if binary is None:
            raise ValueError("No se encontró sd-cli.exe en el paquete.")
        archive.unlink()
    model = ROOT / CHECKPOINT
    partial = model.with_suffix(model.suffix + ".download")
    existing = partial.stat().st_size if partial.exists() else 0
    if not model.exists() and shutil.disk_usage(ROOT).free + existing < 8 * 1024**3:
        raise ValueError("Se requieren 8 GB libres para descargar el modelo.")
    download(MODEL_URL, model, MODEL_HASH)
    return binary, model


def load_token():
    ROOT.mkdir(parents=True, exist_ok=True)
    path = ROOT / "worker.key"
    try:
        token = path.read_text(encoding="ascii").strip()
        if TOKEN_PATTERN.fullmatch(token):
            return token
    except FileNotFoundError:
        pass
    return None


def save_token():
    ROOT.mkdir(parents=True, exist_ok=True)
    token = getpass.getpass("Pega el código privado de la sección Fotos del CRM: ").strip()
    if not TOKEN_PATTERN.fullmatch(token):
        raise ValueError("Código de enlace inválido.")
    file = ROOT / "worker.key"
    # The file is in the current user's private app-data folder on Windows.
    if file.exists():
        file.unlink()
    fd = os.open(file, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    with os.fdopen(fd, "w", encoding="ascii") as stream:
        stream.write(token)
    return token


def photo_command(binary, model, prompt, people, seed, output, threads):
    negative = ("illustration, vector, render, watermark, readable text, text overlay, logo, "
                "collage, medical records, blurry, distorted, deformed hands")
    if not people:
        negative += ", people, person, face, silhouette, human figure"
    return [str(binary), "-m", str(model), "-p", prompt, "-n", negative, "-W", "896", "-H", "512",
            "--steps", "20", "--sampling-method", "euler", "--cfg-scale", "6",
            "-s", str(seed), "-t", str(threads), "-o", str(output)]


def generate(binary, model, prompt, people, seed, output, threads, deadline):
    seconds = min(28 * 60, deadline - time.time() - 35)
    if seconds < 10:
        raise subprocess.TimeoutExpired("sd-cli", seconds)
    subprocess.run(photo_command(binary, model, prompt, people, seed, output, threads),
                   check=True, timeout=seconds, stdin=subprocess.DEVNULL, shell=False)
    if not output.is_file() or not 32 <= output.stat().st_size <= 4 * 1024**2:
        raise ValueError("La salida no es una imagen PNG utilizable.")
    with output.open("rb") as stream:
        if stream.read(8) != PNG:
            raise ValueError("El motor no creó un PNG válido.")


def handle(job, token, binary, model, threads):
    asset, lease, prompt = job["asset"], job["lease"], job["prompt"]
    if not re.fullmatch(r"[0-9a-f]{32}", asset) or str(uuid.UUID(lease)) != lease or not 1 <= len(prompt) <= 1800:
        raise ValueError("El CRM devolvió una tarea inválida.")
    deadline = dt.datetime.fromisoformat(job["expiresAt"].replace("Z", "+00:00")).timestamp()
    error = None
    with tempfile.TemporaryDirectory(prefix="inteca-foto-") as folder:
        output = Path(folder) / "escena.png"
        try:
            generate(binary, model, prompt, job["people"], int(job["seed"]), output, threads, deadline)
        except subprocess.TimeoutExpired:
            error = "RENDER_TIMEOUT"
        except (OSError, subprocess.CalledProcessError):
            error = "RENDER_FAILED"
        except ValueError:
            error = "OUTPUT_INVALID"
        if error:
            api(token, "/failure", {"asset": asset, "lease": lease, "error": error})
            print("El CRM registró:", error, flush=True)
        else:
            api(token, "/upload", output.read_bytes(),
                {"Content-Type": "image/png", "X-INTECA-Asset": asset, "X-INTECA-Lease": lease})
            print("Foto recibida y flyer listo en el CRM.", flush=True)


def main():
    cli = argparse.ArgumentParser(description="Genera fotografías de INTECA sin servicios de imagen de pago.")
    cli.add_argument("--install", action="store_true", help="Instalar modelo y motor fijados para Windows x64.")
    cli.add_argument("--pair", action="store_true", help="Guardar un nuevo código del CRM.")
    cli.add_argument("--bin", type=Path, help="Usar una compilación local de sd-cli (Linux/macOS/Windows).")
    cli.add_argument("--model", type=Path, help="Ruta local al modelo SDXL en formato safetensors.")
    cli.add_argument("--threads", type=int, default=max(1, (os.cpu_count() or 2) // 2))
    cli.add_argument("--preview", type=Path, help="Generar una muestra local sin conectar al CRM.")
    args = cli.parse_args()
    if args.install:
        install_windows()
    binary = args.bin or next((ROOT / "runtime").rglob("sd-cli.exe"), None)
    model = args.model or ROOT / CHECKPOINT
    if not binary or not binary.is_file() or not model.is_file():
        cli.error("Primero usa --install en Windows, o indica --bin y --model.")
    binary, model = binary.resolve(), model.resolve()
    if args.preview:
        generate(binary, model, "Photorealistic architectural photograph of an empty Dominican office "
                 "with rows of call center headsets and daylight, no people", False, 4242,
                 args.preview, args.threads, time.time()+1800)
        print(f"Muestra generada: {args.preview}")
        return
    token = save_token() if args.pair else load_token() or save_token()
    print("Motor local listo. Déjalo abierto; el CRM programa las publicaciones.", flush=True)
    while True:
        try:
            job = api(token, "/claim").get("job")
            if job:
                handle(job, token, binary, model, args.threads)
                continue
        except urllib.error.HTTPError as exc:
            if exc.code == 401:
                # A rotated or revoked key must be manually replaced.
                raise SystemExit("Código rechazado. Consigue otro en el CRM y ejecuta con --pair.") from None
            print(f"El CRM respondió HTTP {exc.code}; consultando de nuevo más tarde.", flush=True)
        except (OSError, ValueError, KeyError, TypeError) as exc:
            print(f"No se completó la tarea ({type(exc).__name__}); consultando de nuevo más tarde.", flush=True)
        time.sleep(60)


if __name__ == "__main__":
    main()
