// Real office telemetry. Never animate a working state without a running D1 job.
let lastEventSeen=null;
function realRecent(value,minutes=20){
 if(!value)return false;
 const iso=String(value).includes('T')?String(value):String(value).replace(' ','T')+'Z';
 const age=Date.now()-Date.parse(iso);
 return Number.isFinite(age)&&age>=-120000&&age<minutes*60000;
}
function officeNotice(event){
 const existing=document.getElementById('office-action-toast');
 if(existing)existing.remove();
 const toast=document.createElement('div');toast.id='office-action-toast';toast.className='office-action-toast';toast.setAttribute('role','status');
 const name=(typeof AGENT_NAMES==='object'?AGENT_NAMES[event.agent_id]:null)||event.agent_id;
 const head=document.createElement('strong');head.textContent=name+' · atividade registrada';
 const p=document.createElement('span');p.textContent=String(event.description||'').slice(0,150);
 toast.append(head,p);document.body.append(toast);
 window.setTimeout(()=>{if(toast.isConnected)toast.remove();},5400);
}
function renderOfficeLive(){
 const events=Array.isArray(state.activity)?state.activity:[];
 const jobs=Array.isArray(state.codeJobs)?state.codeJobs:[];
 const runningJob=jobs.find(j=>j.status==='working'&&realRecent(j.updated_at));
 const mission=state.missions?.find(m=>m.status==='running')||state.missions?.[0];
 const runningMission=mission&&mission.status==='running';
 const counts=new Set();
 if(runningMission){
  for(const a of state.runs||[])if(a.status==='working')counts.add(a.agent_id);
 }
 if(runningJob)counts.add('programador');
 const counter=document.getElementById('metric-working');if(counter)counter.textContent=String(counts.size);
 for(const station of document.querySelectorAll('.station[data-agent]')){
  const id=station.dataset.agent;
  const active=counts.has(id);
  station.dataset.status=active?'working':(runningMission&&state.runs?.find(r=>r.agent_id===id)?.status==='failed'?'failed':'idle');
  const label=station.querySelector('.state');
  if(label)label.textContent=active?'● Trabalhando agora':station.dataset.status==='failed'?'● Erro registrado':'● Disponível';
  let bubble=station.querySelector('.agent-popup');
  if(!bubble){bubble=document.createElement('span');bubble.className='agent-popup';station.append(bubble);}
  let latest=events.find(e=>e.agent_id===id);
  let detail=active?(id==='programador'&&runningJob?runningJob.detail:latest?.description||'Executando tarefa registrada'):latest?.description||'Sem tarefas em execução';
  bubble.textContent=(active?'⚡ ':'')+String(detail).slice(0,92);
  bubble.dataset.active=active?'true':'false';
  bubble.title=active?'Atividade em execução no banco D1':'Última atividade registrada, sem execução atual';
 }
 if(events.length){
  const newest=Number(events[0].id)||0;
  if(lastEventSeen!==null&&newest>lastEventSeen){
   const arrived=events.filter(x=>Number(x.id)>lastEventSeen).reverse().slice(-2);
   if(arrived.length)officeNotice(arrived[arrived.length-1]);
  }
  lastEventSeen=Math.max(lastEventSeen||0,newest);
 }
 const summary=document.getElementById('office-work-summary');
 if(summary)summary.textContent=counts.size?counts.size+' agente(s) executando tarefas reais agora':'Equipe disponível · nenhum trabalho em execução neste momento';
}
