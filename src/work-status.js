/* Read-only work-status answers: evidence comes from D1, not the language model. */
const WORK_TERMS=/\b(?:agentes?|subagentes?|equipe|escrit[oó]rio|rob[oô]s?|vini)\b/iu;
const ISSUE_TERMS=/\b(?:parad[oa]s?|trabalh(?:ando|am|ando|ar)|faz(?:endo|em)|execut(?:ando|am|ar)|progresso|resultados?|a[cç][oõ]es?|nada|s[oó]\s+fala|conversa|n[aã]o\s+acontece)\b/iu;
const SKEPTIC=/\b(?:n[aã]o\s+(?:acredito|entendo|vejo|estou\s+entendendo)|sem\s+(?:resultado|a[cç][aã]o)|nada\s+(?:acontece|funciona|faz))\b/iu;
export function isWorkStatusConcern(message){
 const text=String(message||'').trim();
 if(text.length<16)return false;
 if(!WORK_TERMS.test(text)||!(ISSUE_TERMS.test(text)||SKEPTIC.test(text)))return false;
 // Explicit engineering requests belong to the task dispatcher, not this status reader.
 if(/^\s*(?:implemente|corrija|conserte|crie|programe|desenvolva|modifique|altere|refa[cç]a)\b/iu.test(text))return false;
 return true;
}
export async function readWorkStatus(db){
 const [missions,jobs,activeRuns,activeCode,completedPR]=await Promise.all([
  db.prepare('SELECT id,title,status,created_at,updated_at,error FROM missions ORDER BY created_at DESC LIMIT 3').all(),
  db.prepare('SELECT id,request,status,detail,updated_at FROM code_jobs ORDER BY created_at DESC LIMIT 3').all(),
  db.prepare("SELECT agent_id,mission_id,status FROM agent_runs WHERE status='working' LIMIT 15").all(),
  db.prepare("SELECT agent_id,code_job_id,status FROM code_agent_runs WHERE status='working' LIMIT 15").all(),
  db.prepare("SELECT COUNT(*) AS total FROM code_jobs WHERE status='done' AND result LIKE '%github.com%'").first()
 ]);
 const recentMissions=missions.results||[],recentJobs=jobs.results||[];
 const people=[...(activeRuns.results||[]),...(activeCode.results||[])];
 const working=people.length;
 const latest=recentJobs.concat(recentMissions).sort((a,b)=>String(b.created_at||b.updated_at||'').localeCompare(String(a.created_at||a.updated_at||'')))[0]||null;
 return {working,activeAgents:[...new Set(people.map(x=>x.agent_id))],missionCount:recentMissions.length,codeJobsCount:recentJobs.length,latest:{
  id:latest?.id||null,title:String(latest?.title||latest?.request||'').slice(0,90),
  status:latest?.status||null,detail:String(latest?.detail||latest?.error||'').slice(0,180)
 },prJobCount:Number(completedPR?.total||0)};
}
export function workStatusReply(facts){
 const working=Number(facts?.working||0),agents=facts?.activeAgents||[];
 const label={queued:'na fila',running:'em execução',working:'em execução',done:'concluída',failed:'com falha'};
 let response=working?
  'Conferi os registros agora: **'+working+' agente(s) marcados como trabalhando**'+(agents.length?' ('+agents.join(', ')+')':'')+'.':
  'Conferi os registros agora: **nenhum agente está marcado como trabalhando**.';
 const latest=facts?.latest;
 if(latest?.id){
  response+='\n\nÚltima tarefa registrada: **'+latest.title+'** — '+(label[latest.status]||latest.status||'sem status')+'.';
  if(latest.detail&&latest.status==='failed')response+=' Motivo: '+latest.detail+'.';
 }else response+='\n\nNão encontrei tarefas registradas.';
 if(!working){
  response+='\n\nConversar comigo não significa que os especialistas começaram a executar. Relatórios de IA também não são código publicado. Use **Diário da equipe** para ver as etapas e **Comprovantes** para verificar entregas reais.';
 }else response+='\n\nVocê pode abrir **Escritório → Diário da equipe** para acompanhar os registros reais de cada agente.';
 return response;
}
