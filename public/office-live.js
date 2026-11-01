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
 const queuedJob=jobs.find(j=>j.status==='queued');
 const codeRuns=Array.isArray(state.codeRuns)?state.codeRuns:[];
 const currentCodeJob=runningJob||queuedJob||jobs.find(j=>j.status==='done'&&realRecent(j.updated_at,3));
 const mission=state.missions?.find(m=>m.status==='running')||state.missions?.find(m=>m.status==='queued')||state.missions?.[0];
 const runningMission=mission&&mission.status==='running';
 const queuedMission=mission&&mission.status==='queued';
 const counts=new Set();
 if(runningMission){
  for(const a of state.runs||[])if(a.status==='working')counts.add(a.agent_id);
 }
 if(runningJob){
  for(const r of codeRuns)if(r.status==='working')counts.add(r.agent_id);
  // Older code jobs lack detailed runs; fall back to the real job status only.
  if(!codeRuns.length)counts.add('programador');
 }
 const counter=document.getElementById('metric-working');if(counter)counter.textContent=String(counts.size);
 for(const station of document.querySelectorAll('.station[data-agent]')){
  const id=station.dataset.agent;
  const active=counts.has(id);
  station.dataset.status=active?'working':(runningMission&&state.runs?.find(r=>r.agent_id===id)?.status==='failed'?'failed':'idle');
  const run=(state.runs||[]).find(r=>r.agent_id===id);
  const codeRun=currentCodeJob?codeRuns.find(r=>r.agent_id===id):null;
  let expression='idle';
  if(active)expression='working';
  else if(run?.status==='failed'&&realRecent(mission?.updated_at||mission?.created_at,5))expression='error';
  else if(run?.status==='done'&&realRecent(mission?.updated_at||mission?.created_at,3))expression='success';
  else if(run?.status==='queued'&&(queuedMission||runningMission))expression='waiting';
  else if(codeRun?.status==='queued'&&(runningJob||queuedJob))expression='waiting';
  else if(codeRun?.status==='failed'&&realRecent(currentCodeJob?.updated_at,5))expression='error';
  else if(codeRun?.status==='done'&&realRecent(currentCodeJob?.updated_at,3))expression='success';
  else if(id==='programador'&&queuedJob&&!codeRuns.length)expression='waiting';
  else{
   const event=events.find(e=>e.agent_id===id&&realRecent(e.created_at,2));
   if(event&&/deploy/i.test(event.description||'')){
    if(/indispon[ií]vel|falha|erro|404/i.test(event.description))expression='error';
    else if(/http verificado|respondeu/i.test(event.description))expression='success';
   }
  }
  station.dataset.expression=expression;
  const label=station.querySelector('.state');
  if(label)label.textContent=active?'● Trabalhando agora':expression==='success'?'● Concluiu uma etapa':expression==='error'?'● Erro registrado':expression==='waiting'?'● Na fila':'● Disponível';
  let bubble=station.querySelector('.agent-popup');
  if(!bubble){bubble=document.createElement('span');bubble.className='agent-popup';station.append(bubble);}
  let latest=events.find(e=>e.agent_id===id);
  let detail=active?(codeRun?.status==='working'?codeRun.detail:latest?.description||'Executando tarefa registrada'):expression==='waiting'?(codeRun?.detail||mission?.title||'Aguardando Workflow'):codeRun?.detail&&expression!=='idle'?codeRun.detail:latest?.description||'Sem tarefas em execução';
  bubble.textContent=(active?'⚡ ':'')+String(detail).slice(0,92);
  bubble.dataset.active=active?'true':'false';
  bubble.title=active?'Atividade em execução no banco D1':'Última atividade registrada, sem execução atual';
  const unit=station.querySelector('.jarvis-unit');
  if(unit)unit.dataset.expression=expression;

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
 if(summary)summary.textContent=counts.size?counts.size+' agente(s) executando tarefas reais agora'+(runningJob?' · '+runningJob.request.slice(0,65):mission?.title?' · '+mission.title.slice(0,65):''):queuedMission||queuedJob?'Missão registrada e aguardando execução · os robôs iniciarão quando o Workflow estiver ativo':'Equipe disponível · nenhum trabalho em execução neste momento';
}
