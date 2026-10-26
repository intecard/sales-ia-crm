// Only observed provider values count. Missing data is never treated as zero.
export function growthSummary(jobs:Array<{id:string;channel:string;payload?:{title?:string;kind?:string}}>, observations:Array<{job_id:string;checked_at:string;metrics:Record<string,unknown>}>){
 return ['facebook','instagram','youtube'].map(channel=>{
  const ids=new Set(jobs.filter(j=>j.channel===channel).map(j=>j.id));
  const samples=observations.filter(o=>ids.has(o.job_id)).sort((a,b)=>b.checked_at.localeCompare(a.checked_at));
  const latest=new Map<string,typeof samples[number]>();for(const o of samples)if(!latest.has(o.job_id))latest.set(o.job_id,o);
  const valid=(v:unknown):v is number=>typeof v==='number'&&Number.isFinite(v)&&v>=0;
  const sum=(keys:string[])=>{const values=[...latest.values()].map(o=>keys.map(k=>o.metrics[k]).find(valid)).filter(valid);return values.length?values.reduce((a,b)=>a+b,0):null;};
  const followers=samples.filter(o=>valid(o.metrics.followers)),last=followers[0],first=followers.at(-1);
  const views=sum(['views']),likes=sum(['likes','reactions']),comments=sum(['comments']),shares=sum(['shares']);
  const leaders=[...latest.values()].map(o=>{
   const values=[o.metrics.likes??o.metrics.reactions,o.metrics.comments,o.metrics.shares].filter(valid);
   const job=jobs.find(j=>j.id===o.job_id);
   return {jobId:o.job_id,title:job?.payload?.title||o.job_id,format:job?.payload?.kind||'sin formato',interactions:values.length?values.reduce((a,b)=>a+b,0):null,checkedAt:o.checked_at};
  }).filter(o=>o.interactions!==null).sort((a,b)=>Number(b.interactions)-Number(a.interactions)).slice(0,3);
  return {channel,leaders,observedPosts:latest.size,views,likes,comments,shares,followers:last?.metrics.followers??null,followersChange:last&&first&&last.checked_at!==first.checked_at?Number(last.metrics.followers)-Number(first.metrics.followers):null,baselineAt:first?.checked_at??null,checkedAt:samples[0]?.checked_at??null,websiteVisits:null,
   recommendation:latest.size<3?'Reunir métricas de al menos tres publicaciones antes de comparar formatos.':views===null?'Comparar comentarios, guardados y compartidos cuando estén disponibles; faltan vistas para calcular tasas.':'Comparar vistas e interacciones por formato y tiempo publicado antes de repetir el enfoque. No aumentar pauta automáticamente.'};
 });
}
