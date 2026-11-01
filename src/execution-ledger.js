// Audit facts, not model-generated claims: an analysis report != code delivery != deployment.
export function validateGitHubPR(value,repo){
 let url;try{url=new URL(String(value||''));}catch{return null;}
 const parts=url.pathname.split('/').filter(Boolean);
 if(url.protocol!=='https:'||url.hostname.toLowerCase()!=='github.com'||parts.length!==4||parts[2]!=='pull'||!/^[1-9]\d*$/.test(parts[3]))return null;
 if(repo&&parts.slice(0,2).join('/').toLowerCase()!==String(repo).toLowerCase())return null;
 return url.origin+'/'+parts.join('/');
}
export function classifyCodeEvidence(job){
 let parsed=null;try{parsed=JSON.parse(job.result||'');}catch{}
 const pr=job.status==='done'?validateGitHubPR(parsed?.url,job.repo):null;
 return {id:job.id,kind:'code',project:job.name||'',title:String(job.request||'').slice(0,160),status:job.status,
  detail:String(job.detail||'').slice(0,300),proof:pr?{type:'github_pr',url:pr,number:parsed?.number||null}:null,
  explanation:pr?'PR rascunho registrado pelo executor do GitHub; não equivale a deploy.':
  job.status==='done'?'Etapa marcada como concluída, mas sem URL verificável de PR.':'Nenhuma alteração externa comprovada.',
  updatedAt:job.updated_at};
}
export function classifyMissionEvidence(m){
 return {id:m.id,kind:'analysis',title:String(m.title||'').slice(0,160),status:m.status,
  detail:m.status==='done'?'Relatório de análise concluído':m.status==='failed'?String(m.error||'Falha').slice(0,200):'Análise em processamento',
  proof:m.status==='done'&&m.result?{type:'report',available:true}:null,
  explanation:'Missão de análise; não modifica código nem executa deploy.',
  updatedAt:m.updated_at};
}
export async function readExecutionLedger(db){
 const [jobs,missions]=await Promise.all([
  db.prepare('SELECT j.id,j.request,j.status,j.detail,j.result,j.updated_at,p.name,p.repo FROM code_jobs j LEFT JOIN projects p ON p.id=j.project_id ORDER BY j.updated_at DESC LIMIT 12').all(),
  db.prepare('SELECT id,title,status,error,result,updated_at FROM missions ORDER BY updated_at DESC LIMIT 12').all()
 ]);
 return [...(jobs.results||[]).map(classifyCodeEvidence),...(missions.results||[]).map(classifyMissionEvidence)]
 .sort((a,b)=>String(b.updatedAt||'').localeCompare(String(a.updatedAt||''))).slice(0,16);
}
