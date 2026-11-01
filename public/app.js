const $=id=>document.getElementById(id);
const AGENT_NAMES={supervisor:'Supervisor',programador:'Programador',designer:'Designer',qa:'QA / Testes',infra:'Infraestrutura',pesquisa:'Pesquisa'};
const storageKey='vini_master_token';
let token=sessionStorage.getItem(storageKey)||'';
let state={missions:[],runs:[],activity:[],memories:[],agents:[],provider:'auto',counts:{}};
let missionSelection='';
const escapeTime=x=>{try{return new Date(x).toLocaleString('pt-BR')}catch{return String(x||'')}};
function notify(msg){const el=$('notification');el.textContent=msg;el.hidden=!msg;clearTimeout(window.noticeTimeout);if(msg)window.noticeTimeout=setTimeout(()=>el.hidden=true,9000);}
async function api(path,options={}){
 if(!token)throw Error('Configure sua chave de acesso no ícone 🔐.');
 const headers={Authorization:'Bearer '+token,...options.headers};
 if(options.body&&typeof options.body!=='string')options.body=JSON.stringify(options.body);
 if(options.body)headers['Content-Type']='application/json';
 const res=await fetch('/api'+path,{...options,headers,cache:'no-store'});
 let data={};try{data=await res.json()}catch{}
 if(!res.ok){if(res.status===401){$('system-status').textContent='● Acesso negado';$('system-status').classList.remove('connected');}throw Error(data.error||'Falha HTTP '+res.status);}
 return data;
}
function show(section){
 document.querySelectorAll('.view').forEach(el=>el.hidden=el.id!=='section-'+section);
 document.querySelectorAll('.nav').forEach(b=>b.classList.toggle('active',b.dataset.section===section));
 if(section==='chat')loadChat();
}
document.querySelectorAll('.nav').forEach(b=>b.addEventListener('click',()=>show(b.dataset.section)));
function el(tag,className,text){const node=document.createElement(tag);if(className)node.className=className;if(text!==undefined)node.textContent=String(text);return node;}
function updateStatus(){
 const live=!!token;
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
function renderMissions(){
 const box=$('mission-list');box.replaceChildren();
 if(!state.missions.length){box.append(el('p','empty','Nenhuma missão registrada.'));return;}
 for(const m of state.missions){
  const b=el('button','mission-card');b.type='button';
  b.append(el('b','',m.title),el('small','',m.status+' · '+escapeTime(m.created_at)));
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
async function refresh(){
 if(!token)return;
 try{
  state=await api('/state');
  updateStatus();renderTimeline();renderAgents();renderMissions();renderMemories();
  if(missionSelection&&state.missions.some(m=>m.id===missionSelection&&m.status==='running'))loadMission(missionSelection);
 }catch(e){notify(e.message);}
}
async function loadChat(){
 if(!token)return;
 try{
  const data=await api('/conversation?limit=80');
  const box=$('messages');box.replaceChildren();
  for(const m of data.messages||[])box.append(el('div','message '+m.role,m.content));
  box.scrollTop=box.scrollHeight;
 }catch(e){notify(e.message);}
}
async function sendChat(content,origin){
 if(!content.trim())return;
 const busy=el('span','','Consultando a inteligência artificial...');
 origin.textContent='';origin.append(busy);
 try{
  const result=await api('/chat',{method:'POST',body:{message:content,provider:state.provider}});
  origin.textContent=result.reply+'\n\nModelo: '+result.provider+(result.memorySaved?' · Memória fixada':'');
  await refresh();if(!$('section-chat').hidden)await loadChat();
 }catch(e){origin.textContent='Erro: '+e.message;notify(e.message);}
}
$('quick-chat').addEventListener('submit',e=>{e.preventDefault();const input=$('quick-message');const value=input.value.trim();if(!value)return;input.value='';sendChat(value,$('quick-response'));});
$('chat-form').addEventListener('submit',e=>{e.preventDefault();const input=$('chat-message'),value=input.value.trim();if(!value)return;input.value='';const box=$('messages');box.append(el('div','message user',value));const target=el('div','message assistant','');box.append(target);sendChat(value,target);box.scrollTop=box.scrollHeight;});
$('mission-form').addEventListener('submit',async e=>{
 e.preventDefault();const input=$('mission-description');const description=input.value.trim();if(description.length<8)return;
 const btn=e.target.querySelector('button[type=submit]');btn.disabled=true;
 try{const result=await api('/missions',{method:'POST',body:{description,provider:state.provider}});input.value='';notify('Missão iniciada: '+result.id);await refresh();await loadMission(result.id);}catch(err){notify(err.message)}finally{btn.disabled=false;}
});
$('memory-form').addEventListener('submit',async e=>{e.preventDefault();const input=$('memory-text');try{await api('/memory',{method:'POST',body:{content:input.value}});input.value='';await refresh();notify('Memória salva no banco D1.');}catch(err){notify(err.message)}});
$('search-form').addEventListener('submit',async e=>{e.preventDefault();const box=$('search-results');box.replaceChildren();try{const data=await api('/search?q='+encodeURIComponent($('search-query').value));if(!data.results?.length)box.append(el('p','empty','Nenhum trecho encontrado.'));for(const m of data.results||[])box.append(el('div','search-card',m.content));}catch(err){notify(err.message);}});
$('provider-select').addEventListener('change',async e=>{const provider=e.target.value;try{await api('/settings',{method:'POST',body:{provider}});state.provider=provider;updateStatus();notify('Modelo ajustado.');}catch(err){notify(err.message);}});
function openAccess(){$('access-token').value='';$('access-dialog').showModal();}
$('open-access').addEventListener('click',openAccess);$('settings-access').addEventListener('click',openAccess);
$('access-cancel').addEventListener('click',()=>$('access-dialog').close());
$('access-form').addEventListener('submit',async e=>{e.preventDefault();token=$('access-token').value.trim();sessionStorage.setItem(storageKey,token);$('access-dialog').close();updateStatus();await refresh();await loadChat();});
$('export-data').addEventListener('click',async()=>{try{const data=await api('/export');const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='vini-master-memoria.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),3000);}catch(e){notify(e.message);}});
$('erase-chat').addEventListener('click',async()=>{if(!confirm('Apagar TODAS as mensagens? Memórias fixadas permanecem.'))return;try{await api('/conversation',{method:'DELETE',body:{confirm:'APAGAR'}});await loadChat();await refresh();notify('Histórico apagado.');}catch(e){notify(e.message);}});
function providerFeedback(message){const node=$('provider-feedback');if(node)node.textContent=message;notify(message);}
async function probe(provider,button){
 if(!token){show('settings');openAccess();return;}
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
 e.preventDefault();if(!token){openAccess();return;}
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
updateStatus();if(token){refresh();loadChat()}else{notify('Clique no cadeado para entrar. Se for a primeira vez, configure MASTER_TOKEN nos Secrets do Worker na Cloudflare.');}
fetch('/api/health',{cache:'no-store'}).then(r=>r.json()).then(h=>{if(!h.accessConfigured){notify('Falta configurar MASTER_TOKEN no Worker Cloudflare. A IA já está vinculada, mas o chat precisa dessa chave privada.');}}).catch(()=>{});
setInterval(()=>{if(token)refresh()},10000);
