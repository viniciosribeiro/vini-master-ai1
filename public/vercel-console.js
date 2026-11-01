/* Vercel connector UI — genuine Vercel API requests, no fake "deploy done" statuses. */
(()=>{
 'use strict';
 const $=id=>document.getElementById(id);
 let connected=false,team='',currentProject='',currentName='',builds=[],ready=false,busy=false;
 const notify=t=>{const el=$('vini-vercel-feedback');if(el)el.textContent=t;};
 const create=(tag,text,cls)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=String(text);if(cls)e.className=cls;return e;};
 const safeUrl=raw=>{
  if(!raw)return null;
  try{const url=new URL(/^https:\/\//.test(raw)?raw:'https://'+raw);if(url.protocol!=='https:'||!url.hostname.endsWith('.vercel.app'))return null;return url.href;}catch{return null;}
 };
 function statusText(text,connectedValue){
  const el=$('vini-vercel-status');if(el){el.textContent=text;el.dataset.connected=connectedValue?'true':'false';}
 }
 function setOptions(element,items,placeholder){
  const select=$(element);if(!select)return;
  select.replaceChildren();const blank=create('option',placeholder);blank.value='';select.append(blank);
  for(const item of items){const opt=create('option',item.label);opt.value=item.value;select.append(opt);}
 }
 function renderBuilds(){
  const el=$('vini-vercel-builds');if(!el)return;el.replaceChildren();
  if(!builds.length){el.append(create('p','Nenhum rebuild iniciado pelo VINI.','muted'));return;}
  for(const b of builds.slice(0,10)){
   const row=create('div',undefined,'vercel-build-card');
   const title=create('strong',b.project_name||b.name||'Projeto');row.append(title);
   const status=create('span',String(b.status||'QUEUED').toUpperCase(),'vercel-build-state');status.dataset.state=String(b.status||'QUEUED').toUpperCase();row.append(status);
   row.append(create('small','ID '+String(b.id).slice(0,25),'vercel-build-id'));
   const url=String(b.preview_url||b.url||''),href=safeUrl(url);
   if(href&&String(b.status).toUpperCase()==='READY'){
    const link=create('a','Abrir prévia da Vercel ↗','vercel-build-url');link.href=href;link.target='_blank';link.rel='noopener noreferrer';row.append(link);
   }else if(href){row.append(create('small','Endereço recebido; aguardando confirmação de build READY.','muted'));}
   el.append(row);
  }
 }
 async function refreshBuilds(){
  const data=await api('/vercel/builds');builds=data.builds||[];
  const pending=builds.filter(x=>!['READY','ERROR','CANCELED','CANCELLED'].includes(String(x.status).toUpperCase())).slice(0,2);
  for(const b of pending){
   try{
    const response=await api('/vercel/builds/'+encodeURIComponent(b.id));
    b.status=response.deployment.status;b.preview_url=response.deployment.url;
   }catch{}
  }
  renderBuilds();
 }
 async function checkStatus(){
  if(typeof authValidated==='undefined'||!authValidated)return;
  const response=await api('/vercel/status');
  connected=!!response.connected;team=response.teamId||'';
  statusText(connected?'● Vercel conectada · operações de prévia disponíveis':'◌ Vercel não conectada',connected);
  $('vini-vercel-team').value=team;
  $('vini-vercel-connect-form').hidden=connected;
  $('vini-vercel-disconnect').hidden=!connected;
  $('vini-vercel-load').disabled=!connected;
  $('vini-vercel-project-picker').hidden=!connected;
  await refreshBuilds();
 }
 async function loadProjects(){
  if(!connected)throw Error('Conecte sua Vercel primeiro.');
  const data=await api('/vercel/projects'),list=data.projects||[];
  setOptions('vini-vercel-project',list.map(x=>({value:x.id,label:x.name+(x.repo?' · '+x.repo:'')})),'Selecione um projeto...');
  setOptions('vini-vercel-source',[],'Selecione primeiro o projeto...');
  $('vini-vercel-preview').disabled=true;
  notify(list.length?list.length+' projeto(s) confirmado(s) na Vercel. Escolha um para consultar os deployments.':'Nenhum projeto encontrado neste escopo da Vercel. Confira a conta e o Team ID.');
 }
 async function loadDeployments(){
  const id=$('vini-vercel-project').value;
  currentProject=id;currentName=$('vini-vercel-project').selectedOptions?.[0]?.textContent||'';
  $('vini-vercel-preview').disabled=true;
  if(!id){setOptions('vini-vercel-source',[],'Selecione primeiro o projeto...');return;}
  const data=await api('/vercel/deployments?projectId='+encodeURIComponent(id));
  const list=data.deployments||[];
  setOptions('vini-vercel-source',list.map(d=>({value:d.id,label:(d.target==='production'?'Produção':'Prévia')+' · '+(d.readyState||'SEM STATUS')+' · '+String(d.id).slice(0,14)})),'Selecione o deployment de origem...');
  notify(list.length?'Deployments localizados. Você poderá reconstruir uma prévia sem alterar produção.':'Ainda não existe deployment para reconstruir neste projeto.');
 }
 async function triggerPreview(){
  const projectId=$('vini-vercel-project').value,deploymentId=$('vini-vercel-source').value;
  if(!projectId||!deploymentId)return;
  if(!confirm('Confirmar rebuild de PRÉVIA na Vercel para '+currentName+'? Isso dispara uma operação real e pode consumir recursos. Produção não será alterada.'))return;
  const button=$('vini-vercel-preview');button.disabled=true;notify('Enviando solicitação real à Vercel…');
  try{
   const r=await api('/vercel/preview-redeploy',{method:'POST',body:{projectId,deploymentId,confirm:'REIMPLANTAR PREVIA'}});
   notify('A Vercel aceitou a operação. Deployment ID: '+r.deployment.id+' · status: '+r.deployment.status+'. Acompanhe abaixo.');
   document.dispatchEvent(new Event('vini:delegated'));
   await refreshBuilds();
  }catch(e){notify('Rebuild não iniciado: '+e.message);}
  finally{button.disabled=false;}
 }
 $('vini-vercel-connect-form')?.addEventListener('submit',async e=>{
  e.preventDefault();if(busy)return;busy=true;const button=e.currentTarget.querySelector('[type=submit]');button.disabled=true;
  const key=$('vini-vercel-token').value,teamId=$('vini-vercel-team').value.trim();
  notify('Validando token diretamente com a API Vercel…');
  try{
   const d=await api('/vercel/connect',{method:'POST',body:{token:key,teamId}});
   $('vini-vercel-token').value='';notify('Conectada à conta '+d.account+'. '+d.projectsFound+' projeto(s) encontrado(s).');await checkStatus();await loadProjects();
  }catch(e){notify('Conexão não autorizada: '+e.message);}
  finally{busy=false;button.disabled=false;}
 });
 $('vini-vercel-disconnect')?.addEventListener('click',async()=>{
  if(!confirm('Desconectar Vercel e apagar a chave protegida deste aplicativo?'))return;
  try{await api('/vercel/disconnect',{method:'POST',body:{}});await checkStatus();notify('Vercel desconectada.');}catch(e){notify(e.message);}
 });
 $('vini-vercel-load')?.addEventListener('click',async()=>{try{await loadProjects()}catch(e){notify(e.message)}});
 $('vini-vercel-project')?.addEventListener('change',async()=>{try{await loadDeployments()}catch(e){notify(e.message)}});
 $('vini-vercel-source')?.addEventListener('change',()=>{$('vini-vercel-preview').disabled=!$('vini-vercel-source').value;});
 $('vini-vercel-preview')?.addEventListener('click',triggerPreview);
 window.openVercelSetup=async()=>{
  document.querySelector('.nav[data-section=settings]')?.click();
  $('vini-vercel-console')?.scrollIntoView({behavior:'smooth',block:'start'});
  try{await checkStatus();if(connected)await loadProjects();}catch(e){notify(e.message);}
 };
 let refreshed=false;
 const interval=setInterval(async()=>{
  if(document.hidden||typeof authValidated==='undefined'||!authValidated)return;
  if(!refreshed){refreshed=true;try{await checkStatus()}catch(e){refreshed=false;notify(e.message);}return;}
  if(builds.some(x=>!['READY','ERROR','CANCELED','CANCELLED'].includes(String(x.status).toUpperCase()))){try{await refreshBuilds()}catch(e){notify(e.message)}}
 },7000);
 window.addEventListener('pagehide',()=>clearInterval(interval));
})();
