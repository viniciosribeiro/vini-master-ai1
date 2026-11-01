/* VINI Control Center R1. UI never invents agent activity, mission progress or deployments.
   Reuses authenticated functions from app.js and D1-backed APIs. */
(()=>{
'use strict';
const by=id=>document.getElementById(id);
const make=(tag,cls,txt)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(txt!==undefined)e.textContent=String(txt);return e;};
const AGENTS=[
 {id:'programador',name:'gptdev',role:'Desenvolvimento',symbol:'⌘',color:'#2ce0ff'},
 {id:'designer',name:'gptdesign',role:'Design & UX',symbol:'✎',color:'#fc6dff'},
 {id:'qa',name:'gptqa',role:'Qualidade & Testes',symbol:'✓',color:'#35eab0'},
 {id:'infra',name:'gptinfra',role:'Infra & Segurança',symbol:'▤',color:'#a97eff'},
 {id:'pesquisa',name:'gptmap',role:'Pesquisa & Dados',symbol:'⌖',color:'#ffbc56'},
 {id:'supervisor',name:'VINI',role:'Supervisor',symbol:'V',color:'#24eff7'}
];
const escId=id=>String(id||'').replace(/[^a-zA-Z0-9_-]/g,'');
const recent=(date,minutes=30)=>{const t=Date.parse(String(date||'').replace(' ','T')+'Z');return Number.isFinite(t)&&Math.abs(Date.now()-t)<=minutes*60000;};
const live=()=>typeof state!=='undefined'&&state&&typeof state==='object'?state:{missions:[],runs:[],activity:[],agents:[],codeJobs:[],codeRuns:[]};
const authenticated=()=>typeof authValidated!=='undefined'&&authValidated;
const shell=(id,markup)=>{const root=make('div','vc-control-root');root.id=id;root.innerHTML=markup;return root;};
const num=n=>String(Number(n)||0);
const normalizeStatus=s=>s==='done'||s==='completed'?'done':s==='working'||s==='running'?'working':s==='failed'?'failed':s==='queued'?'queued':'idle';
function agentStatus(data,id){
 const currentMission=(data.missions||[]).find(x=>x.status==='running');
 const currentJob=(data.codeJobs||[]).find(x=>x.status==='working');
 const run=currentMission?(data.runs||[]).find(x=>x.agent_id===id&&x.mission_id===currentMission.id):null;
 const jobRun=currentJob?(data.codeRuns||[]).find(x=>x.agent_id===id&&x.code_job_id===currentJob.id):null;
 return normalizeStatus(jobRun?.status||run?.status||(currentJob&&id==='programador'&&!(data.codeRuns||[]).length?'working':'idle'));
}
const setText=(id,value)=>{const el=by(id);if(el)el.textContent=String(value);};
const setProgress=(id,pct)=>{const el=by(id);if(el)el.style.width=Math.max(0,Math.min(100,Number(pct)||0))+'%';};
const statusLabel=s=>({done:'Concluído',working:'Executando',queued:'Na fila',failed:'Falhou',idle:'Disponível'})[s]||'Disponível';
const time=s=>{const date=new Date(String(s||'').replace(' ','T')+'Z');return Number.isFinite(date.getTime())?date.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'}):'—'};
function stat(icon,label,id,detail){
 return '<div class="vc-stat"><div class="vc-stat-top"><span class="vc-stat-icon">'+icon+'</span>'+label+'</div><strong id="'+id+'">—</strong><small>'+detail+'</small></div>';
}
function header(icon,title,description){
 return '<div class="vc-header"><div><h1><span class="vc-heading-icon">'+icon+'</span>'+title+'</h1><p>'+description+'</p></div></div>';
}
function agentCard(a){
 const btn=make('button','vc-agent-card');btn.type='button';btn.dataset.agent=a.id;btn.style.setProperty('--agent-color',a.color);
 const face=make('span','vc-agent-face',a.symbol),text=make('span');
 text.append(make('strong','',a.name),make('small','vc-agent-caption','● Disponível · '+a.role));
 btn.append(face,text);
 btn.addEventListener('click',()=>openAgent(a.id));
 return btn;
}
function openAgent(id){
 if(typeof show==='function')show('agents');
 if(typeof detailAgent==='function')detailAgent(id);
 const panel=by('agent-detail');panel?.scrollIntoView({behavior:'smooth',block:'nearest'});
}
function decorateNavigation(){
 document.body.classList.add('vini-control-r1');
 const nav=document.querySelector('.sidebar .nav[data-section="agents"]');
 if(nav){const label=nav.querySelector('span');if(label)label.textContent='Rede Neural';nav.setAttribute('aria-label','Rede Neural e especialistas');}
 const logo=document.querySelector('.sidebar .logo');if(logo)logo.textContent='V';
 const top=document.querySelector('.top .subhead');if(top)top.textContent='Orquestração de agentes · Dados reais';
 const gear=make('button','icon-btn','⚙');gear.id='vc-settings-button';gear.type='button';gear.setAttribute('aria-label','Abrir configurações');
 gear.addEventListener('click',()=>show('settings'));
 by('open-access')?.insertAdjacentElement('afterend',gear);
 const sidefoot=document.querySelector('.side-foot small');if(sidefoot)sidefoot.textContent='Cloudflare · Execução auditável';
 document.querySelectorAll('.sidebar .nav').forEach(b=>b.addEventListener('click',()=>{document.body.dataset.vcSection=b.dataset.section||'';}));
}
function buildOffice(){
 const section=by('section-office');if(!section)return;
 section.insertAdjacentElement('afterbegin',shell('vc-office-heading',header('⌘','Escritório Virtual','Agentes coordenados pelo VINI. A atividade exibida vem das missões, tarefas e registros reais no Cloudflare D1.')));
 const office=shell('vc-office', '<div class="vc-office-top"><div><h2>Central de Orquestração</h2><p class="vc-note">Equipe conectada ao histórico de execução</p></div><span class="vc-pill" id="vc-office-state" data-state="idle">Sem tarefas ativas</span></div>'+
 '<div class="vc-office-grid"><div id="vc-office-left" class="vc-agent-col"></div><div class="vc-office-center"><div class="vc-orbit"><span class="vc-office-logo">V</span></div><strong>VINI · Supervisor</strong><small id="vc-office-current" class="vc-note">Nenhuma missão em execução</small></div><div id="vc-office-right" class="vc-agent-col"></div></div>'+
 '<div class="vc-flowbar"><div class="vc-flowstep" id="vc-flow-0">Entrada</div><div class="vc-flowstep" id="vc-flow-1">Planejamento</div><div class="vc-flowstep" id="vc-flow-2">Agentes</div><div class="vc-flowstep" id="vc-flow-3">Revisão</div><div class="vc-flowstep" id="vc-flow-4">Resultado</div></div>'+
 '<div class="vc-office-bottom"><small id="vc-office-counter">0 agentes executando agora</small><button type="button" class="vc-btn" id="vc-office-diario">Ver diário real</button></div><div class="vc-feed-heading">Últimas ações auditadas</div><div class="vc-office-feed" id="vc-office-feed"><div class="vc-event">Nenhum evento carregado</div></div>');
 AGENTS.filter(x=>x.id!=='supervisor').forEach((a,i)=>by(i%2?'vc-office-right':'vc-office-left').append(agentCard(a)));
 const metrics=section.querySelector('.metrics');metrics?.insertAdjacentElement('afterend',office);
 by('vc-office-diario')?.addEventListener('click',()=>{by('vini-live-open')?.click();});
}
function buildProjects(){
 const section=by('section-projects');const panel=section?.querySelector('.projects-panel');if(!panel)return;
 panel.insertAdjacentElement('afterbegin',shell('vc-projects-head',header('▱','Meus Projetos','Organize sistemas, ideias e repositórios. Somente publicações verificadas são consideradas online.')+
 '<div class="vc-stats">'+stat('▱','Projetos ativos','vc-p-active','Catálogo Cloudflare D1')+
 stat('⌘','Tarefas de código','vc-p-jobs','Histórico de tarefas recentes')+
 stat('✦','Sites verificados','vc-p-live','Validação por HTTP')+
 stat('◉','Integração GitHub','vc-p-github','Status consultado na conta')+'</div>'));
 const list=by('projects-list'),form=by('project-add-form');if(!list||!form)return;
 const layout=shell('vc-project-layout','<div class="vc-project-list-pane"><div class="vc-project-toolbar"><button class="vc-btn" data-project-view="all" data-selected="true">Meus Projetos</button><button class="vc-btn" data-project-view="favorites">☆ Favoritos</button><button class="vc-btn" data-project-view="archived">Arquivados</button><button class="vc-btn" data-project-view="integrations">Integrações</button><input id="vc-project-search" type="search" placeholder="Buscar projetos..." aria-label="Buscar projetos"></div><div id="vc-project-list-slot"></div><p class="vc-note">☆ Favoritos são salvos somente neste dispositivo.</p></div><div class="vc-project-new-pane"><div class="vc-action-line" style="margin-bottom:10px"><button class="vc-btn" id="vc-create-ai">✦ Criar com IA</button><button class="vc-btn" id="vc-create-manual" data-selected="true">+ Manual</button></div><div id="vc-project-form-slot"></div><div class="vc-template-row" id="vc-project-templates"><button class="vc-btn" data-template="turismo">✈ Turismo</button><button class="vc-btn" data-template="pousada">▣ Pousada</button><button class="vc-btn" data-template="restaurante">♨ Restaurante</button><button class="vc-btn" data-template="hotspot">◎ Hotspot</button></div></div>');
 panel.querySelector('.project-create')?.insertAdjacentElement('beforebegin',layout);
 by('vc-project-list-slot').append(list);by('vc-project-form-slot').append(form);
 const title=[...panel.querySelectorAll('h2')].find(h=>h.textContent.trim()==='Portfólio');if(title)title.hidden=true;
 on('vc-create-ai','click',()=>{if(typeof show==='function')show('chat');void window.viniThreads?.createNewProject().catch(err=>alert(err.message));});
 on('vc-create-manual','click',()=>by('project-new-name')?.focus());
 const examples={turismo:['Operadora de turismo','Portal de passeios, reservas e parceiros.','cloudflare'],pousada:['Nova pousada','Gestão de hospedagens, calendário e reservas.','cloudflare'],restaurante:['Restaurante e delivery','PDV, cardápio, estoque e pedidos.','cloudflare'],hotspot:['Hotspot comunitário','Acesso Wi-Fi com gerenciamento de clientes.','cloudflare']};
 by('vc-project-templates')?.querySelectorAll('button').forEach(b=>b.addEventListener('click',()=>{
  const x=examples[b.dataset.template];if(!x)return;by('project-new-name').value=x[0];by('project-new-description').value=x[1];by('project-new-platform').value=x[2];by('project-new-name').focus();
 }));
 const search=by('vc-project-search');search?.addEventListener('input',applyProjectFilter);
 layout.querySelectorAll('[data-project-view]').forEach(b=>b.addEventListener('click',()=>{
  layout.querySelectorAll('[data-project-view]').forEach(x=>x.dataset.selected=String(x===b));applyProjectFilter();
 }));
 const observer=new MutationObserver(()=>applyProjectFilter());
 observer.observe(list,{childList:true});
}
function favs(){try{return new Set(JSON.parse(localStorage.getItem('vini_control_favorites')||'[]'));}catch{return new Set();}}
function applyProjectFilter(){
 const list=by('projects-list');if(!list||typeof portfolio==='undefined')return;
 const tab=document.querySelector('#vc-project-layout [data-project-view][data-selected="true"]')?.dataset.projectView||'all';
 const term=(by('vc-project-search')?.value||'').trim().toLocaleLowerCase('pt-BR'),favorites=favs();
 [...list.querySelectorAll('.portfolio-card')].forEach((card,i)=>{
  const project=portfolio[i];if(!project)return;
  const id=project.id;
  let star=card.querySelector('.vc-favorite');
  if(!star){star=make('button','vc-favorite','☆');star.type='button';star.setAttribute('aria-label','Marcar projeto como favorito');card.append(star);
   star.addEventListener('click',()=>{const s=favs();if(s.has(id))s.delete(id);else s.add(id);localStorage.setItem('vini_control_favorites',JSON.stringify([...s]));applyProjectFilter();});
  }
  star.textContent=favorites.has(id)?'★':'☆';star.setAttribute('aria-pressed',String(favorites.has(id)));
  const found=(project.name+' '+(project.description||'')+' '+(project.repo||'')).toLocaleLowerCase('pt-BR').includes(term);
  card.hidden=!found||!(tab==='all'&&project.status==='active'||tab==='favorites'&&favorites.has(id)||tab==='archived'&&project.status!=='active'||tab==='integrations'&&!!project.repo);
 });
}
function buildMissions(){
 const section=by('section-missions');const panel=section?.querySelector('.panel');if(!panel)return;
 const first=panel.querySelector('h1');if(first)first.hidden=true;
 const intro=panel.querySelector('p');if(intro)intro.hidden=true;
 panel.insertAdjacentElement('afterbegin',shell('vc-mission-heading',header('◉','Missões da Equipe','Planeje tarefas, acompanhe os agentes e confira resultados registrados. Uma missão de análise não representa publicação de código.')+
 '<div class="vc-stats">'+stat('▷','Em execução','vc-m-active','Workflows registrados')+
 stat('✓','Concluídas','vc-m-done','Missões no histórico')+
 stat('☷','Na fila','vc-m-queued','Aguardando processamento')+
 stat('⚠','Com falha','vc-m-failed','Precisam de atenção')+'</div><div class="vc-header"><h2>Equipe em ação <small>(6 agentes cadastrados)</small></h2><span id="vc-m-team-state" class="vc-pill" data-state="idle">Sem agentes ativos</span></div><div class="vc-agent-strip" id="vc-mission-team"></div>'));
 for(const a of AGENTS){const tile=make('button','vc-agent-tile');tile.type='button';tile.dataset.agent=a.id;tile.append(make('span','vc-agent-face',a.symbol),make('strong','',a.name),make('small','vc-agent-caption','Disponível'));tile.style.setProperty('--agent-color',a.color);tile.addEventListener('click',()=>openAgent(a.id));by('vc-mission-team').append(tile);}
 const form=by('mission-form');if(form){
  const formtop=shell('vc-mission-top','<div class="vc-mission-form-head"><h2>✧ Nova missão</h2><span class="vc-note">A execução depende do Workflow e da cota configurada.</span></div><div class="vc-action-line" style="margin-bottom:11px"><button type="button" class="vc-btn" id="vc-mission-guided" data-selected="true">✦ Equipe IA</button><button type="button" class="vc-btn" id="vc-mission-blank">✎ Descrição livre</button></div>');
  form.insertAdjacentElement('afterbegin',formtop);
  const picker=make('label','vc-mission-project-label','Projeto relacionado (opcional para missões gerais)');
  const select=make('select');select.id='vc-mission-project';select.append(make('option','','Missão geral · sem projeto'));select.firstChild.value='';
  picker.append(select);form.querySelector('button[type=submit]')?.insertAdjacentElement('beforebegin',picker);
  on('vc-mission-guided','click',()=>{by('vc-mission-guided').dataset.selected='true';by('vc-mission-blank').dataset.selected='false';by('mission-description').placeholder='Descreva objetivo, resultado esperado, requisitos e critérios de aceite. A equipe fará a análise especializada.';by('mission-description').focus();});
  on('vc-mission-blank','click',()=>{by('vc-mission-guided').dataset.selected='false';by('vc-mission-blank').dataset.selected='true';by('mission-description').placeholder='Digite sua solicitação diretamente...';by('mission-description').focus();});
 }
 form?.insertAdjacentElement('afterend',shell('vc-mission-active','<h2>Missão acompanhada</h2><p id="vc-current-mission-title">Nenhuma missão em execução</p><div class="vc-meter"><span id="vc-current-progress" style="width:0%"></span></div><p class="vc-note" id="vc-current-phase">Aguardando tarefa registrada no D1.</p>'));
 const list=by('mission-list');if(list)list.insertAdjacentElement('beforebegin',shell('vc-mission-controls','<div class="vc-search-line"><input id="vc-mission-search" type="search" placeholder="Buscar no histórico de missões..." aria-label="Pesquisar missões"><select id="vc-mission-filter" aria-label="Filtrar missões"><option value="all">Todas</option><option value="active">Em andamento</option><option value="done">Concluídas</option><option value="failed">Falhas</option></select></div>'));
 on('vc-mission-search','input',applyMissionFilter);on('vc-mission-filter','change',applyMissionFilter);
 if(list)new MutationObserver(applyMissionFilter).observe(list,{childList:true});
}
function applyMissionFilter(){
 const list=by('mission-list');if(!list)return;
 const query=(by('vc-mission-search')?.value||'').toLocaleLowerCase('pt-BR'),filter=by('vc-mission-filter')?.value||'all';
 (list.querySelectorAll('.mission-card')||[]).forEach((card,i)=>{
  const m=(live().missions||[])[i];if(!m)return;
  const match=filter==='all'||filter==='active'&&['queued','running'].includes(m.status)||filter===m.status;
  card.hidden=!match||!card.textContent.toLocaleLowerCase('pt-BR').includes(query);
 });
}
function buildNetwork(){
 const section=by('section-agents');if(!section)return;
 const root=shell('vc-network-panel',header('◈','Rede Neural ao Vivo','Topologia animada da equipe. Pontos acesos indicam apenas tarefas comprovadamente ativas; animação decorativa não comprova execução.')+
 '<div class="vc-stats">'+stat('⚡','Agentes executando','vc-n-working','Estado do D1')+
 stat('☷','Tarefas em processamento','vc-n-jobs','Missões e tarefas reais')+
 stat('◉','Eventos recentes','vc-n-events','Janela de 5 minutos')+
 stat('✓','Missões concluídas','vc-n-finished','Histórico de execução')+'</div>'+
 '<div class="vc-network-shell"><div class="vc-office-top"><strong>Orquestração neural</strong><span class="vc-pill" data-state="idle" id="vc-network-pill">Aguardando execução</span></div><div class="vc-network-frame"><svg class="vc-network-svg" id="vc-network-svg" viewBox="0 0 940 460" role="img" aria-label="Rede de seis agentes conectados ao supervisor"></svg></div><div class="vc-network-status" id="vc-network-status" role="status">Clique em um agente para consultar seu último registro real.</div></div>');
 section.insertAdjacentElement('afterbegin',root);
 const svg=by('vc-network-svg'),NS='http://www.w3.org/2000/svg';
 const makeSvg=(tag,attrs,parent=svg)=>{const n=document.createElementNS(NS,tag);for(const [k,v] of Object.entries(attrs||{}))n.setAttribute(k,String(v));parent.append(n);return n;};
 for(let i=0;i<6;i++){
  const a=AGENTS[i];const x=i<3?168:772,y=(i%3)*139+90;
  const path=makeSvg('path',{d:'M470 230 Q'+(i<3?'300':'640')+' '+y+' '+x+' '+y,class:'vc-network-link','data-link':a.id});
  const g=makeSvg('g',{'data-agent':a.id,role:'button',tabindex:'0','aria-label':'Abrir registro '+a.name});
  makeSvg('circle',{cx:x,cy:y,r:47,fill:'#081e3d',stroke:a.color,'stroke-width':2},g);
  makeSvg('circle',{cx:x,cy:y,r:32,class:'vc-network-dot','data-dot':a.id},g);
  const label=makeSvg('text',{x,y:y+6,'text-anchor':'middle',class:'vc-network-label'},g);label.textContent=a.name;
  const action=()=>{const data=live(),st=agentStatus(data,a.id),event=(data.activity||[]).find(e=>e.agent_id===a.id);
   setText('vc-network-status',a.name+' · '+statusLabel(st)+' · '+(event?time(event.created_at)+' '+event.description:'Nenhum registro recente. Clique para abrir detalhes.'));
   if(typeof detailAgent==='function')detailAgent(a.id);
  };
  g.addEventListener('click',action);g.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();action();}});
 }
 makeSvg('circle',{cx:470,cy:230,r:86,fill:'#071931',stroke:'#37dfff','stroke-width':3});
 makeSvg('circle',{cx:470,cy:230,r:69,fill:'#0d3371',stroke:'#a06bff','stroke-width':2});
 const label=makeSvg('text',{x:470,y:249,'text-anchor':'middle',fill:'#c8fcff','font-size':70,'font-weight':900});label.textContent='V';
}
function buildChat(){
 const panel=by('section-chat')?.querySelector('.chat-main-panel');if(!panel)return;
 const node=shell('vc-chat-network','<div class="vc-chat-network-head"><div><strong>◈ Rede neural ao vivo</strong><small style="display:block">Orquestração baseada em registros reais</small></div><span class="vc-pill" data-state="idle" id="vc-chat-network-pill">Sem execução</span></div><div class="vc-neural-mini"><div class="vc-orbit"><span class="vc-office-logo">V</span></div></div><div class="vc-chat-actions-bottom"><button class="vc-btn" id="vc-chat-network-open">Abrir Rede Neural</button><button class="vc-btn" id="vc-chat-history">Organizar histórico antigo</button></div>');
 const messages=by('messages');messages?.insertAdjacentElement('beforebegin',node);
 on('vc-chat-network-open','click',()=>show('agents'));
 on('vc-chat-history','click',async()=>{try{const list=await window.viniThreads.reload();const old=list.find(x=>x.id==='legacy-history');if(!old){notify('Não existe histórico antigo não vinculado.');return;}window.viniThreads.openProjectPicker('move',old);}catch(e){notify(e.message);}});
 by('vc-chat-history').hidden=true;
}
function buildMemory(){
 const section=by('section-memory'),panel=section?.querySelector('.panel');if(!panel)return;
 panel.insertAdjacentElement('afterbegin',shell('vc-memory-head',header('▤','Memória Permanente','Preferências explícitas e histórico preservados no Cloudflare D1. Os dados podem ser revisados e removidos pelo proprietário.')+
 '<div class="vc-stats">'+stat('▤','Memórias fixadas','vc-memory-pins','Registros persistidos')+
 stat('☷','Mensagens','vc-memory-messages','Histórico do sistema')+
 stat('◇','Conversas por projeto','vc-memory-threads','Ativas, arquivadas e lixeira')+
 stat('◎','Projetos','vc-memory-projects','Catálogo atual')+'</div>'));
}
function buildSettings(){
 const panel=by('section-settings')?.querySelector('.panel');if(!panel)return;
 const diagnostic=shell('vc-diagnostic','<h2>✓ Diagnóstico real de conversas e Cloudflare D1</h2><p>Execute o teste quando estiver conectado. Ele cria uma conversa temporária identificada, testa criação, leitura, renomeação, arquivo, restauração e lixeira, excluindo a conversa de teste ao terminar. Não toca no histórico existente.</p><div class="vc-action-line"><button type="button" class="vc-btn" id="vc-run-diagnostic">Executar diagnóstico autenticado</button><span id="vc-diagnostic-state" class="vc-note">Nenhum diagnóstico executado nesta sessão</span></div><pre class="vc-diagnostic-results" id="vc-diagnostic-results" role="status" aria-live="polite" hidden></pre>');
 panel.insertAdjacentElement('afterbegin',diagnostic);
 on('vc-run-diagnostic','click',runDiagnostic);
}
const on=(id,event,callback)=>by(id)?.addEventListener(event,callback);
async function runDiagnostic(){
 const button=by('vc-run-diagnostic'),report=by('vc-diagnostic-results');
 if(!authenticated()){notify('Entre no VINI pelo cadeado para testar o D1.');by('open-access')?.click();return;}
 button.disabled=true;report.hidden=false;report.textContent='';
 let id='',deleted=false,log=[];
 const mark=t=>{log.push(t);report.textContent=log.join('\n');};
 try{
  mark('Iniciando teste real com sessão autenticada…');
  const projects=(await api('/projects')).projects||[];
  const active=projects.filter(x=>x.status==='active');
  const title='DIAGNÓSTICO TEMPORÁRIO '+Date.now();
  const made=(await api('/threads',{method:'POST',body:active.length?{projectId:active[0].id,title}:{draft:true,title}})).thread;
  id=made.id;mark('PASS criar conversa temporária '+id.slice(0,8));
  const read=(await api('/threads/'+id)).thread;
  if(read?.id!==id)throw Error('Falha de leitura por ID');
  const messages=(await api('/threads/'+id+'/messages')).messages;
  if(!Array.isArray(messages)||messages.length)throw Error('Conversa temporária retornou mensagens inesperadas');
  mark('PASS leitura e isolamento de mensagens');
  const renamed=(await api('/threads/'+id,{method:'PATCH',body:{title:title+' OK'}})).thread;
  if(renamed.title!==title+' OK')throw Error('Falha ao renomear');
  mark('PASS renomear');
  if(active.length>1){const moved=(await api('/threads/'+id,{method:'PATCH',body:{projectId:active[1].id}})).thread;if(moved.project_id!==active[1].id)throw Error('Falha ao mover entre projetos');mark('PASS mover entre projetos');}
  else mark('IGNORADO mover entre projetos: menos de dois projetos ativos');
  const archived=(await api('/threads/'+id,{method:'PATCH',body:{status:'archived'}})).thread;
  if(archived.status!=='archived')throw Error('Falha ao arquivar');
  mark('PASS arquivar');
  const restored=(await api('/threads/'+id,{method:'PATCH',body:{status:'active'}})).thread;
  if(restored.status!=='active')throw Error('Falha ao restaurar');
  mark('PASS restaurar');
  await api('/threads/'+id,{method:'DELETE'});
  const trashed=(await api('/threads/'+id)).thread;
  if(trashed.status!=='trashed')throw Error('Falha ao enviar à lixeira');
  mark('PASS lixeira');
  const final=await api('/threads/'+id+'?permanent=true',{method:'DELETE'});
  if(final.deleted!==true)throw Error('Falha ao remover a conversa de teste');
  deleted=true;mark('PASS exclusão da conversa temporária');
  mark('RESULTADO: PASS · CRUD autenticado no D1 validado nesta sessão.');
  setText('vc-diagnostic-state','Último diagnóstico: PASS');
 }catch(err){mark('FALHOU: '+String(err.message||err));setText('vc-diagnostic-state','Último diagnóstico: FALHOU');}
 finally{
  if(id&&!deleted){try{
    const t=(await api('/threads/'+id)).thread;
    if(t&&t.status!=='trashed')await api('/threads/'+id,{method:'DELETE'});
    const r=await api('/threads/'+id+'?permanent=true',{method:'DELETE'});
    if(r.deleted)mark('LIMPEZA: conversa temporária excluída.');
  }catch(e){mark('ATENÇÃO: limpeza da conversa '+id+' falhou: '+e.message);}}
  button.disabled=false;
  window.viniThreads?.reload().catch(()=>{});
 }
}
function updateProjectsSelect(){
 const sel=by('vc-mission-project');if(!sel||!authenticated())return;
 const all=typeof portfolio!=='undefined'&&Array.isArray(portfolio)?portfolio:[];
 const current=sel.value,keys=new Set([...sel.options].map(x=>x.value));
 const active=all.filter(x=>x.status==='active');
 if(keys.size===active.length+1&&active.every(x=>keys.has(x.id)))return;
 sel.replaceChildren();const head=make('option','','Missão geral · sem projeto');head.value='';sel.append(head);
 for(const p of active){const op=make('option','',p.name);op.value=p.id;sel.append(op);}
 if([...sel.options].some(x=>x.value===current))sel.value=current;
}
function paint(){
 if(!authenticated()||document.hidden)return;
 const data=live(),missions=data.missions||[],runs=data.runs||[],jobs=data.codeJobs||[],events=data.activity||[];
 const activeM=missions.filter(x=>x.status==='running').length;
 const activeJ=jobs.filter(x=>x.status==='working').length;
 const working=AGENTS.filter(x=>agentStatus(data,x.id)==='working');
 const current=missions.find(x=>x.status==='running')||missions.find(x=>x.status==='queued')||missions[0];
 const missionRuns=current?runs.filter(x=>x.mission_id===current.id):[];
 setText('vc-office-current',current?current.title+' · '+statusLabel(normalizeStatus(current.status)):'Nenhuma missão registrada');
 setText('vc-office-counter',working.length+' agente(s) executando agora · '+(activeM+activeJ)+' tarefa(s) em andamento');
 for(const id of ['vc-office-state','vc-chat-network-pill','vc-network-pill','vc-m-team-state']){
  const n=by(id);if(n){n.dataset.state=working.length?'working':'idle';n.textContent=working.length?working.length+' agente(s) trabalhando':'Sem execução em andamento';}
 }
 for(const card of document.querySelectorAll('.vc-agent-card,.vc-agent-tile')){
  const s=agentStatus(data,card.dataset.agent);card.dataset.active=String(s==='working');
  const cap=card.querySelector('.vc-agent-caption');if(cap)cap.textContent=statusLabel(s)+' · '+(AGENTS.find(x=>x.id===card.dataset.agent)?.role||'');
 }
 const flow=['idle','idle','idle','idle','idle'];
 if(current){
  flow[0]='done';
  if(current.status==='queued')flow[1]='working';
  else if(current.status==='running'){
   flow[1]='done';flow[2]=missionRuns.some(x=>['working','queued'].includes(x.status))?'working':'done';
   if(missionRuns.length&&missionRuns.every(x=>x.status==='done'))flow[3]='working';
  }else if(current.status==='done')flow.fill('done');
  else if(current.status==='failed')flow[1]='done';
 }
 flow.forEach((s,i)=>{const n=by('vc-flow-'+i);if(n)n.dataset.state=s;});
 const feed=by('vc-office-feed');
 if(feed){feed.replaceChildren();if(!events.length)feed.append(make('div','vc-event','Sem eventos registrados no D1.'));else for(const e of events.slice(0,4)){const row=make('div','vc-event');row.append(make('b','',time(e.created_at)+' '+(e.agent_id||'VINI')),document.createTextNode(String(e.description||'')));feed.append(row);}}
 for(const n of document.querySelectorAll('.vc-network-link'))n.classList.toggle('active',agentStatus(data,n.dataset.link)==='working');
 for(const n of document.querySelectorAll('.vc-network-dot'))n.classList.toggle('active',agentStatus(data,n.dataset.dot)==='working');
 setText('vc-m-active',activeM);setText('vc-m-done',missions.filter(x=>x.status==='done').length);
 setText('vc-m-queued',missions.filter(x=>x.status==='queued').length);setText('vc-m-failed',missions.filter(x=>x.status==='failed').length);
 setText('vc-current-mission-title',current?current.title:'Nenhuma missão registrada');
 const done=missionRuns.filter(x=>x.status==='done').length,percent=missionRuns.length?Math.round(done/missionRuns.length*100):0;
 setProgress('vc-current-progress',percent);
 setText('vc-current-phase',current?'Estado: '+statusLabel(normalizeStatus(current.status))+' · '+done+'/'+missionRuns.length+' agentes com análise concluída (não é progresso de publicação)':'Aguardando tarefa registrada no D1.');
 setText('vc-n-working',working.length);setText('vc-n-jobs',activeM+activeJ);setText('vc-n-events',events.filter(x=>recent(x.created_at,5)).length);setText('vc-n-finished',missions.filter(x=>x.status==='done').length);
 setText('vc-memory-pins',(data.memories||[]).length);setText('vc-memory-messages',num(data.counts?.messages));
 setText('vc-memory-projects',typeof portfolio!=='undefined'?portfolio.length:'—');
 if(typeof portfolio!=='undefined'){
  const active=portfolio.filter(x=>x.status==='active');
  setText('vc-p-active',active.length);
  setText('vc-p-jobs',jobs.length);
  setText('vc-p-live',portfolio.filter(x=>x.deploy_status==='online'&&!!x.deploy_verified_at).length);
  setText('vc-p-github',typeof githubReady!=='undefined'?(githubReady?'Conectado':'Desconectado'):'—');
 }
 const btn=by('vc-chat-history');if(btn&&window.viniThreads){
  const allThreads=by('chat-thread-list')?.querySelector('[data-id="legacy-history"]');
  btn.hidden=!allThreads;
 }
 updateProjectsSelect();
}
function syncCounts(){
 if(!authenticated())return;
 api('/threads?status=all').then(x=>setText('vc-memory-threads',(x.threads||[]).length)).catch(()=>{});
}
function boot(){
 decorateNavigation();buildOffice();buildProjects();buildMissions();buildNetwork();buildChat();buildMemory();buildSettings();
 setInterval(()=>{if(authenticated())paint();},2700);
 setInterval(()=>{if(authenticated()&&!document.hidden)syncCounts();},60000);
 document.addEventListener('visibilitychange',()=>{if(!document.hidden){paint();syncCounts();}});
 document.querySelectorAll('.nav').forEach(x=>x.addEventListener('click',()=>{requestAnimationFrame(paint);if(x.dataset.section==='memory')syncCounts();}));
 document.addEventListener('vini:delegated',()=>setTimeout(paint,350));
 setTimeout(()=>{paint();syncCounts();},850);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();