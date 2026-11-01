const $=id=>document.getElementById(id);
const AGENT_NAMES={supervisor:'Supervisor',programador:'Programador',designer:'Designer',qa:'QA / Testes',infra:'Infraestrutura',pesquisa:'Pesquisa'};
const storageKey='vini_master_token';
let token='';
const legacyToken=sessionStorage.getItem(storageKey)||'';
let authValidated=false;
let state={missions:[],runs:[],activity:[],memories:[],agents:[],provider:'auto',counts:{}};
let missionSelection='';
const escapeTime=x=>{try{return new Date(x).toLocaleString('pt-BR')}catch{return String(x||'')}};
function notify(msg){const el=$('notification');el.textContent=msg;el.hidden=!msg;clearTimeout(window.noticeTimeout);if(msg)window.noticeTimeout=setTimeout(()=>el.hidden=true,9000);}
async function api(path,options={}){
 if(!authValidated)throw Error('Acesse o painel pelo cadeado 🔐.');
 const headers={...options.headers};
 if(options.body&&typeof options.body!=='string')options.body=JSON.stringify(options.body);
 if(options.body)headers['Content-Type']='application/json';
 const res=await fetch('/api'+path,{...options,headers,credentials:'same-origin',cache:'no-store'});
 let data={};try{data=await res.json()}catch{}
 if(!res.ok){if(res.status===401){clearInvalidSession();openAccess(data.error||'A sessão expirou ou a chave do painel mudou.');}throw Error(data.error||'Falha HTTP '+res.status);}
 return data;
}
function show(section){
 document.querySelectorAll('.view').forEach(el=>el.hidden=el.id!=='section-'+section);
 document.querySelectorAll('.nav').forEach(b=>b.classList.toggle('active',b.dataset.section===section));
 if(section==='chat')loadChat();
 if(section==='projects'&&typeof loadProjects==='function')loadProjects();
 if(section==='memory'&&typeof loadWorkProfile==='function')loadWorkProfile();
}
document.querySelectorAll('.nav').forEach(b=>b.addEventListener('click',()=>show(b.dataset.section)));
function el(tag,className,text){const node=document.createElement(tag);if(className)node.className=className;if(text!==undefined)node.textContent=String(text);return node;}
const UNVERIFIED_HOSTS=/(?:^|\.)((?:vercel\.app|workers\.dev|pages\.dev|netlify\.app|onrender\.com|fly\.dev|firebaseapp\.com|web\.app))$/i;
const PUBLICATION_CLAIM=/(?:acabei de (?:fazer|subir)|fiz o deploy|publiquei|deploy (?:feito|conclu[ií]do)|(?:site|projeto|app) (?:est[aá]|ficou) (?:no ar|online|publicad[oa]))/iu;
let verifiedDeploymentLinks=new Map(),lastVerifiedLinksRead=0;
async function refreshVerifiedDeploymentLinks(){
 if(Date.now()-lastVerifiedLinksRead<60000||!authValidated)return;
 lastVerifiedLinksRead=Date.now();
 try{
  const result=await api('/projects');
  const map=new Map();
  for(const project of result.projects||[]){
   for(const prefix of ['deploy','preview']){
    const url=project[prefix+'_url'],status=project[prefix+'_status'],checked=project[prefix+'_verified_at'];
    if(status==='online'&&checked&&typeof url==='string'){
     try{map.set(new URL(url).href.replace(/\/$/,''),{name:project.name,kind:prefix});}catch{}
    }
   }
  }
  verifiedDeploymentLinks=map;
 }catch{lastVerifiedLinksRead=0;}
}
function cleanOldHtml(content){
 return String(content||'').replace(/<a\s+[^>]*href\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi,(_,link,label)=>String(label).replace(/<[^>]+>/g,'')+' ('+link+')').replace(/<br\s*\/?>/gi,'\n').replace(/<\/?(?:p|div|strong|em|span)[^>]*>/gi,'');
}
function appendExecutionReceipt(container,data){
 const proof=el('div','chat-execution-receipt');
 const kind=data?.kind||'conversation';proof.dataset.kind=kind;
 const id=data?.id?' · ID '+String(data.id).slice(0,14):'';
 proof.textContent=kind==='code_job'?'Trabalho de código registrado'+id+' — resultado real disponível em Comprovantes.':
 kind==='mission'?'Missão de análise registrada'+id+' — isso ainda não significa que o projeto foi alterado.':
 kind==='blocked'?'Não executado: ação externa indisponível. Nenhum build ou deploy foi disparado.':
 'Somente conversa por IA · nenhuma execução externa confirmada.';
 container.append(proof);
}
const HISTORICAL_ACTION_CLAIM=/(?:\b(?:vou|vamos|acabei de|j[aá]|estou)\b[\s\S]{0,130}\b(?:for[cç]ar|disparar|executar|publicar|criar|implantar|rodar|fazer|entrar|acessar|subir)\b[\s\S]{0,100}\b(?:vercel|cloudflare|deploy|build|github|produ[cç][aã]o)\b)/iu;
function addVercelAction(container,label='Conectar / escolher projeto Vercel'){
 const btn=el('button','secondary vini-action-button',label);btn.type='button';
 btn.addEventListener('click',()=>{if(typeof window.openVercelSetup==='function')window.openVercelSetup();else show('settings');});
 container.append(btn);
}
function renderAssistant(container,content,provider){
 container.replaceChildren();
 let value=cleanOldHtml(content).replace(/\r\n/g,'\n').trim();
 const priorUnsupported=value.includes('Não executei nenhuma ação externa nesta conversa')||value.includes('A resposta anterior do modelo prometia operações sem comprovante');
 if(priorUnsupported)value='Ainda não executei o build. A resposta anterior prometia algo sem comprovação. Agora você pode conectar a Vercel e escolher um projeto para solicitar um rebuild real de prévia.';

 if((provider==='nvidia'||provider==='cloudflare')&&HISTORICAL_ACTION_CLAIM.test(value)){
  value='Esta resposta de IA prometia uma ação externa, mas não traz comprovante de execução. Consulte a área Comprovantes para conferir se algum trabalho real foi concluído.';
 }
 const hits=Array.from(value.matchAll(/https?:\/\/[^\s<>"'()[\]{}]+/gi));
 const verifiedUrls=[],unconfirmedUrls=[];
 for(const match of hits){
  const raw=match[0].replace(/[.,;!?]+$/,'');
  let parsed;try{parsed=new URL(raw);}catch{continue;}
  if(!UNVERIFIED_HOSTS.test(parsed.hostname))continue;
  const info=verifiedDeploymentLinks.get(parsed.href.replace(/\/$/,''));
  if(info)verifiedUrls.push({url:parsed.href,...info});
  else unconfirmedUrls.push(raw);
 }
 const oldClaim=PUBLICATION_CLAIM.test(value);
 if(unconfirmedUrls.length){
  for(const link of new Set(unconfirmedUrls))value=value.replaceAll(link,'[link de publicação ainda não verificado]');
 }
 if(oldClaim&&unconfirmedUrls.length){
  value='Esta resposta antiga anunciou um deploy sem comprovação. O endereço mencionado não foi validado. Veja Projetos → Sites publicados para conferir se existe uma publicação real.';
 }
 const body=el('div','reply-body');
 const chunks=value.split(/\n{2,}/).filter(Boolean);
 for(const chunk of chunks){
  const clean=chunk.trim().replace(/^#{1,4}\s+/gm,'').replace(/\*\*(.*?)\*\*/g,'$1').replace(/^\s*[-*]\s+/gm,'• ');
  if(clean)body.append(el('p','reply-paragraph',clean));
 }
 if(!body.childNodes.length)body.append(el('p','reply-paragraph','Sem resposta.'));
 container.append(body);
 if(unconfirmedUrls.length)container.append(el('p','deploy-chat-warning','Link de deploy não confirmado. A equipe só deve anunciar publicação após a verificação HTTP.'));
 for(const entry of verifiedUrls){
  const link=document.createElement('a');link.href=entry.url;link.target='_blank';link.rel='noopener noreferrer';
  link.className='deploy-chat-verified';link.textContent='✓ Abrir '+entry.name+' (HTTP verificado) ↗';
  container.append(link);
 }
 if(priorUnsupported||(/Vercel/.test(value)&&/(?:conectar|conecte|escolha|selecione)/i.test(value)&&/(?:build|rebuild|deploy|prévia)/i.test(value)))addVercelAction(container,'Configurar Vercel e executar prévia');
 if(provider==='nvidia'||provider==='cloudflare')appendExecutionReceipt(container,{kind:'conversation'});
 if(provider==='system')container.append(el('span','reply-provider','Registro do sistema · confira o status em Comprovantes'));
 if(provider){
  const names={nvidia:'NVIDIA',cloudflare:'Cloudflare AI'};
  container.append(el('span','reply-provider','Respondido por '+(names[provider]||provider)));
 }
}

function updateStatus(){
 const live=authValidated;
 $('system-status').textContent=live?'● Conectado':'● Sem conexão';
 $('system-status').classList.toggle('connected',live);
 $('metric-agents').textContent=state.agents.length||6;
 $('metric-missions').textContent=state.counts?.missions??0;
 const working=(state.runs||[]).filter(r=>r.status==='working').length;
 $('metric-working').textContent=working;
 $('metric-provider').textContent=state.provider==='auto'?'Automático':state.provider==='nvidia'?'NVIDIA':'Cloudflare AI';
 $('provider-select').value=state.provider||'auto';
 if($('cf-provider-state'))$('cf-provider-state').textContent=state.hasCloudflare?'Binding automático configurado · pronto para testar':'Binding AI ausente no Worker';
 if($('nv-provider-state'))$('nv-provider-state').textContent=state.hasNvidia?'Chave cadastrada · teste disponível':'Chave ainda não cadastrada';
 document.querySelectorAll('.station').forEach(node=>{
  const run=state.runs.find(r=>r.agent_id===node.dataset.agent);
  const status=run?.status||'idle';
  node.dataset.status=status;
  const label=node.querySelector('.state');
  label.textContent=status==='working'?'● Trabalhando':status==='done'?'● Concluído':status==='failed'?'● Falhou':'● Disponível';
 });
}
function renderTimeline(){
 const box=$('timeline');box.replaceChildren();
 if(!state.activity.length){box.append(el('p','empty','Nenhuma atividade registrada. Inicie uma missão.'));return;}
 for(const a of state.activity.slice(0,35)){
  const item=el('div','event');const time=el('time','',escapeTime(a.created_at));const name=el('b','',AGENT_NAMES[a.agent_id]||a.agent_id);
  item.append(time,name,el('small','',a.description));box.append(item);
 }
}
function renderAgents(){
 const box=$('agent-list');box.replaceChildren();
 for(const a of state.agents||[]){
  const run=state.runs.find(r=>r.agent_id===a.id);
  const b=el('button','agent-card');b.type='button';
  b.append(el('b','',a.name),el('small','',a.role+' · '+(run?.status||'disponível')));
  b.addEventListener('click',()=>detailAgent(a.id));box.append(b);
 }
}
function detailAgent(id){
 show('agents');const a=state.agents.find(x=>x.id===id);
 const run=state.runs.find(x=>x.agent_id===id);
 $('agent-detail').textContent=(a?.name||id)+'\n'+(a?.role||'')+'\n\nStatus: '+(run?.status||'disponível')+'\nModelo: '+(run?.provider||'—')+'\n\n'+(run?.output||'Nenhuma atividade desta estação registrada.');
}
document.querySelectorAll('.station').forEach(x=>x.addEventListener('click',()=>detailAgent(x.dataset.agent)));
const missionStates={queued:'Na fila',running:'Trabalhando',done:'Concluída',failed:'Falhou'};
function renderMissions(){
 const box=$('mission-list');box.replaceChildren();
 if(!state.missions.length){box.append(el('p','empty','Nenhuma missão registrada.'));return;}
 for(const m of state.missions){
  const b=el('button','mission-card');b.type='button';
  b.append(el('b','',m.title),el('small','',((missionStates[m.status]||m.status)+' · '+escapeTime(m.created_at))));
  b.addEventListener('click',()=>loadMission(m.id));box.append(b);
 }
}
async function loadMission(id){
 missionSelection=id;const box=$('mission-detail');box.textContent='Carregando missão...';
 try{
  const data=await api('/missions/'+encodeURIComponent(id));
  let out=data.mission.title+'\nStatus: '+data.mission.status+'\n';
  for(const r of data.runs||[])out+='\n'+(AGENT_NAMES[r.agent_id]||r.agent_id)+' — '+r.status+'\n'+(r.output||'')+'\n';
  out+='\nRELATÓRIO FINAL\n'+(data.mission.result||data.mission.error||'Em andamento');
  box.textContent=out;
 }catch(e){notify(e.message);}
}
function renderMemories(){
 const box=$('memory-list');box.replaceChildren();
 if(!state.memories.length){box.append(el('p','empty','Nenhuma memória fixada ainda.'));return;}
 for(const m of state.memories){
  const div=el('div','memory-card'),text=el('p','',m.content),btn=el('button','danger','Apagar');
  btn.addEventListener('click',async()=>{
   if(!confirm('Apagar esta memória?'))return;
   try{await api('/memory/'+encodeURIComponent(m.id),{method:'DELETE'});await refresh();}catch(e){notify(e.message);}
  });div.append(text,btn);box.append(div);
 }
}
function renderDelegationStatus(){
 const banner=$('jarvis-task-banner'),text=$('jarvis-task-text');
 if(!banner||!text)return;
 const m=state.missions?.find(x=>x.status==='running')||state.missions?.find(x=>x.status==='queued');
 const job=state.codeJobs?.find(x=>x.status==='working')||state.codeJobs?.find(x=>x.status==='queued');
 banner.hidden=!m&&!job;
 if(m){
  const runs=(state.runs||[]).filter(x=>x.mission_id===m.id);
  const active=runs.filter(x=>x.status==='working').length,done=runs.filter(x=>x.status==='done').length;
  text.textContent=m.status==='queued'?'Missão na fila: '+m.title:'Equipe trabalhando em "'+m.title+'": '+active+' ativo(s), '+done+' concluído(s)';
 }else if(job){
  const specialists=(state.codeRuns||[]),working=specialists.filter(r=>r.status==='working').length,done=specialists.filter(r=>r.status==='done').length;
  text.textContent=job.status==='queued'?'Equipe de código na fila: '+job.request.slice(0,75):'Equipe de código: '+working+' trabalhando, '+done+' concluído(s) · '+job.detail.slice(0,85);
 }
}
$('jarvis-task-open')?.addEventListener('click',()=>show('office'));
async function refresh(){
 if(!authValidated)return;
 try{
  state=await api('/state');
  updateStatus();renderTimeline();renderAgents();renderMissions();renderMemories();
  renderDelegationStatus();
  if(typeof renderOfficeLive==='function')renderOfficeLive();
  if(typeof window.renderJarvisMonitor==='function')window.renderJarvisMonitor();
  if(missionSelection&&state.missions.some(m=>m.id===missionSelection&&['queued','running'].includes(m.status)))loadMission(missionSelection);
 }catch(e){notify(e.message);}
}
async function loadChat(){
 if(!authValidated)return;
 try{
  await refreshVerifiedDeploymentLinks();
  const chosen=await window.viniThreads?.ensureSelected();
  const box=$('messages');
  if(!chosen){
   box.replaceChildren(el('div','chat-thread-empty-main','Escolha um projeto e toque em “Nova conversa” para começar. Suas conversas serão organizadas por projeto.'));
   $('intake-start-now').hidden=true;
   window.viniThreads?.renderHeader();
   return;
  }
  const data=await api('/conversation?threadId='+encodeURIComponent(chosen)+'&limit=80');
  if(window.viniThreads?.selected()!==chosen)return;
  box.replaceChildren();
  for(const m of data.messages||[]){
   const bubble=el('div','message '+m.role);
   if(m.role==='assistant')renderAssistant(bubble,m.content,m.provider);
   else bubble.textContent=m.content;
   box.append(bubble);
  }
  box.scrollTop=box.scrollHeight;
  const intake=await api('/intake?threadId='+encodeURIComponent(chosen));
  $('intake-start-now').hidden=!intake.active;
  window.viniThreads?.renderHeader();
 }catch(e){notify(e.message);}
}
let chatSending=false;
async function sendChat(content,origin){
 if(!content.trim()||chatSending)return;
 const chosen=await window.viniThreads?.ensureSelected();
 if(!chosen){notify('Crie uma conversa e escolha o projeto antes de enviar.');window.viniThreads?.openDrawer();return;}
 chatSending=true;
 if(typeof window.jarvisSetMood==='function')window.jarvisSetMood('thinking');
 origin.replaceChildren(el('span','reply-loading','Estou pensando na melhor resposta...'));
 try{
  const result=await api('/chat',{method:'POST',body:{message:content,provider:state.provider,threadId:chosen}});
  renderAssistant(origin,result.reply,result.provider);
  if(result.execution&&result.execution.kind!=='conversation')appendExecutionReceipt(origin,result.execution);
  if(result.actionRequired&&/^vercel_/.test(result.actionRequired)&&!origin.querySelector('.vini-action-button'))addVercelAction(origin,result.actionRequired==='vercel_setup'?'Conectar Vercel agora':'Escolher projeto Vercel');
  if(result.actionRequired==='work_status'){
   const actions=el('div','delegation-actions');
   const office=el('button','secondary','Ver diário real');
   office.type='button';office.addEventListener('click',()=>show('office'));
   const proof=el('button','secondary','Ver comprovantes');
   proof.type='button';proof.addEventListener('click',()=>{
    show('office');document.getElementById('vini-proof-list')?.scrollIntoView({behavior:'smooth',block:'start'});
   });
   actions.append(office,proof);origin.append(actions);
  }


  if(result.execution?.kind==='blocked'||result.delegation?.status==='queued')document.dispatchEvent(new Event('vini:delegated'));

  if(result.delegation?.status==='queued'){
   const actions=el('div','delegation-actions');
   const office=el('button','secondary delegation-office','Ver equipe no escritório');
   office.type='button';office.addEventListener('click',()=>show('office'));
   actions.append(office);
   if(result.delegation.missionId){
    const mission=el('button','secondary delegation-mission','Acompanhar missão');
    mission.type='button';
    mission.addEventListener('click',async()=>{show('missions');await loadMission(result.delegation.missionId);});
    actions.append(mission);
   }
   if(result.delegation.codeJobId){
    const jobs=el('button','secondary delegation-mission','Ver programação no projeto');
    jobs.type='button';jobs.addEventListener('click',()=>show('projects'));actions.append(jobs);
   }
   origin.append(actions);
  }

  if(typeof window.jarvisSetMood==='function')window.jarvisSetMood('idle');
  if(typeof window.jarvisSpeakReply==='function')window.jarvisSpeakReply(result.reply);
  if(result.intake){const startBtn=document.getElementById('intake-start-now');if(startBtn)startBtn.hidden=result.intake.status!=='collecting';}
  if(result.intake?.status==='started'){notify('Novo projeto criado. Veja Projetos e Missões.');if(typeof loadProjects==='function')loadProjects();}

  await refresh();
  await window.viniThreads?.reload();
  if(!$('section-chat').hidden&&window.viniThreads?.selected()===chosen&&!result.delegation?.status?.includes('queued'))await loadChat();
 }catch(e){
  if(typeof window.jarvisSetMood==='function')window.jarvisSetMood('idle');
  origin.replaceChildren(el('p','reply-error','Não consegui responder agora: '+e.message));
  notify(e.message);
 }finally{
  chatSending=false;
  if(typeof window.jarvisSetMood==='function'&&!window.jarvisVoiceSpeaking)window.jarvisSetMood('idle');
  const label=document.getElementById('jarvis-voice-status');
  if(label&&!window.jarvisVoiceSpeaking&&label.textContent.includes('pensando'))label.textContent='Pronto para conversar';
 }
}
async function startNewProjectInterview(){
 show('chat');
 try{await window.viniThreads?.createNewProject()}catch(e){notify(e.message);}
}
$('begin-project-chat').addEventListener('click',()=>{void startNewProjectInterview()});
$('intake-start-now').addEventListener('click',()=>{
 show('chat');$('chat-message').value='PODE INICIAR';$('chat-form').requestSubmit();
});
$('quick-chat').addEventListener('submit',e=>{e.preventDefault();const input=$('quick-message');const value=input.value.trim();if(!value)return;input.value='';sendChat(value,$('quick-response'));});
$('chat-form').addEventListener('submit',e=>{e.preventDefault();const input=$('chat-message'),value=input.value.trim();if(!value)return;input.value='';const box=$('messages');box.append(el('div','message user',value));const target=el('div','message assistant','');box.append(target);void sendChat(value,target);box.scrollTop=box.scrollHeight;});
$('mission-form').addEventListener('submit',async e=>{
 e.preventDefault();const input=$('mission-description');const description=input.value.trim();if(description.length<8)return;
 const btn=e.target.querySelector('button[type=submit]');btn.disabled=true;
 try{const result=await api('/missions',{method:'POST',body:{description,provider:state.provider}});input.value='';notify('Missão iniciada: '+result.id);await refresh();await loadMission(result.id);}catch(err){notify(err.message)}finally{btn.disabled=false;}
});
$('memory-form').addEventListener('submit',async e=>{e.preventDefault();const input=$('memory-text');try{await api('/memory',{method:'POST',body:{content:input.value}});input.value='';await refresh();notify('Memória salva no banco D1.');}catch(err){notify(err.message)}});
$('search-form').addEventListener('submit',async e=>{e.preventDefault();const box=$('search-results');box.replaceChildren();try{const data=await api('/search?q='+encodeURIComponent($('search-query').value));if(!data.results?.length)box.append(el('p','empty','Nenhum trecho encontrado.'));for(const m of data.results||[])box.append(el('div','search-card',m.content));}catch(err){notify(err.message);}});
$('provider-select').addEventListener('change',async e=>{const provider=e.target.value;try{await api('/settings',{method:'POST',body:{provider}});state.provider=provider;updateStatus();notify('Modelo ajustado.');}catch(err){notify(err.message);}});
function openAccess(reason=''){$('access-token').value='';const error=$('access-error');error.textContent=reason;error.hidden=!reason;if(!$('access-dialog').open)$('access-dialog').showModal();}
function clearInvalidSession(){token='';authValidated=false;sessionStorage.removeItem(storageKey);updateStatus();}
async function verifyAccess(candidate,remember=true){
 const response=await fetch('/api/auth/login',{method:'POST',headers:{Authorization:'Bearer '+candidate,'Content-Type':'application/json'},body:JSON.stringify({remember}),credentials:'same-origin',cache:'no-store'});
 let result={};try{result=await response.json();}catch{}
 if(!response.ok||!result.authenticated)throw Error(result.error||'Acesso não autorizado. Confira o MASTER_TOKEN da Cloudflare.');
 return result;
}
async function verifyRememberedSession(){
 const response=await fetch('/api/auth/session',{credentials:'same-origin',cache:'no-store'});
 if(!response.ok)return false;
 const result=await response.json();return result.authenticated===true;
}

$('open-access').addEventListener('click',()=>openAccess());$('settings-access').addEventListener('click',()=>openAccess());
$('access-cancel').addEventListener('click',()=>$('access-dialog').close());
$('logout-device')?.addEventListener('click',async()=>{
 if(!confirm('Sair deste dispositivo e solicitar a senha no próximo acesso?'))return;
 try{await api('/auth/logout',{method:'POST',body:{}});}catch{}
 clearInvalidSession();openAccess('Sessão encerrada neste dispositivo.');
});
$('access-form').addEventListener('submit',async e=>{
 e.preventDefault();
 const value=$('access-token').value.trim(),button=$('access-submit'),error=$('access-error');
 button.disabled=true;button.textContent='Conferindo...';error.hidden=true;
 try{
  await verifyAccess(value,$('remember-device')?.checked===true);
  token='';authValidated=true;
  sessionStorage.removeItem(storageKey);
  $('access-token').value='';
  $('access-dialog').close();
  updateStatus();notify('Acesso validado. Painel conectado com segurança.');
  await refresh();await loadChat();if(typeof checkIdeaAlerts==='function')checkIdeaAlerts();
 }catch(err){
  clearInvalidSession();
  error.textContent=err.message+' Se você acabou de alterar o segredo, confirme que foi salvo em Produção e use exatamente o mesmo valor aqui.';
  error.hidden=false;
  $('access-token').focus();
 }finally{button.disabled=false;button.textContent='Verificar e entrar';}
});
$('export-data').addEventListener('click',async()=>{try{const data=await api('/export');const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='vini-master-memoria.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),3000);}catch(e){notify(e.message);}});
$('erase-chat').addEventListener('click',async()=>{if(!confirm('Apagar TODAS as mensagens? Memórias fixadas permanecem.'))return;try{await api('/conversation',{method:'DELETE',body:{confirm:'APAGAR'}});await loadChat();await refresh();notify('Histórico apagado.');}catch(e){notify(e.message);}});
function providerFeedback(message){const node=$('provider-feedback');if(node)node.textContent=message;notify(message);}
async function probe(provider,button){
 if(!authValidated){show('settings');openAccess();return;}
 button.disabled=true;providerFeedback('Testando '+(provider==='cloudflare'?'Cloudflare AI':'NVIDIA')+' com uma chamada real...');
 try{const result=await api('/providers/test',{method:'POST',body:{provider}});
  providerFeedback('Conexão confirmada: '+result.provider+' · '+result.model+' · Resposta: '+result.reply);
 }catch(err){providerFeedback('Falha no teste de '+provider+': '+err.message);}
 finally{button.disabled=false;}
}
$('open-provider-connect').addEventListener('click',()=>{show('settings');$('nvidia-api-key').focus({preventScroll:true});});
$('test-cf').addEventListener('click',e=>probe('cloudflare',e.currentTarget));
$('test-nvidia').addEventListener('click',e=>probe('nvidia',e.currentTarget));
$('nvidia-connect-form').addEventListener('submit',async e=>{
 e.preventDefault();if(!authValidated){openAccess();return;}
 const input=$('nvidia-api-key'),button=$('connect-nvidia'),key=input.value.trim();
 if(!key)return;
 button.disabled=true;providerFeedback('Conferindo a chave com a NVIDIA...');
 try{
  const result=await api('/integrations/nvidia',{method:'POST',body:{key}});
  input.value='';providerFeedback('NVIDIA conectada! Modelo: '+result.model+'. A chave foi cifrada no D1.');
  await refresh();
 }catch(err){providerFeedback('NVIDIA não conectada: '+err.message);}
 finally{button.disabled=false;}
});
$('disconnect-nvidia').addEventListener('click',async e=>{
 if(!confirm('Desconectar a NVIDIA e apagar a chave cadastrada?'))return;
 const button=e.currentTarget;button.disabled=true;
 try{const result=await api('/integrations/nvidia',{method:'DELETE'});
  await refresh();providerFeedback(result.externalSecret?'Chave do painel removida; ainda existe NVIDIA_API_KEY nos secrets do Worker.':'NVIDIA desconectada.');
 }catch(err){providerFeedback(err.message);}finally{button.disabled=false;}
});
updateStatus();
async function initializeAccess(){
 try{
  const res=await fetch('/api/health',{cache:'no-store'});const health=await res.json();
  if(!health.accessConfigured){clearInvalidSession();notify('Configure MASTER_TOKEN nos Secrets de Produção do Worker vini-master-ai1.');return;}
 }catch{notify('Não foi possível consultar o diagnóstico do Worker.');}
 try{
  if(await verifyRememberedSession()){
   sessionStorage.removeItem(storageKey);
   authValidated=true;updateStatus();
   await refresh();await loadChat();if(typeof checkIdeaAlerts==='function')checkIdeaAlerts();
   return;
  }
  if(legacyToken){
   await verifyAccess(legacyToken,true); // Migrate an already authenticated tab, no new password required.
   sessionStorage.removeItem(storageKey);
   authValidated=true;updateStatus();
   await refresh();await loadChat();if(typeof checkIdeaAlerts==='function')checkIdeaAlerts();
   return;
  }
  openAccess();
 }catch(err){
  clearInvalidSession();
  openAccess('Sua sessão não foi aceita. Entre novamente para ativar acesso persistente. '+err.message);
 }
}
initializeAccess();
// Adaptive polling: lively during actual work; economical when idle and offline.
let refreshHeartbeat=0;
setInterval(()=>{
 if(!token||!authValidated||document.hidden||navigator.onLine===false)return;
 refreshHeartbeat++;
 const active=(state.missions||[]).some(m=>m.status==='running'||m.status==='queued')||(state.codeJobs||[]).some(j=>j.status==='working'||j.status==='queued');
 if(active||refreshHeartbeat%5===0)refresh();
},3000);
