/* VINI Reference Fidelity R2 — approved mockup art, real live data.
   Decorative crops are from user's own reference images, not live-operation evidence. */
(()=>{
 'use strict';
 const $=id=>document.getElementById(id);
 const E=(tag,cls,text)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(text!==undefined)e.textContent=String(text);return e;};
 let mounted=false;
 const getState=()=>typeof state!=='undefined'&&state&&typeof state==='object'?state:null;
 const nowTime=(s)=>{const raw=String(s||'').replace(' ','T');const d=new Date(/[zZ]$|[+-]\d\d:\d\d$/.test(raw)?raw:raw+'Z');return Number.isFinite(+d)?d.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'}):'—';};
 const makeArt=(className,src,alt='')=>{const img=E('img',className);img.src=src;img.alt=alt;img.loading='eager';img.decoding='async';return img;};
 function headerArtwork(node){
  if(!node||node.querySelector('.vc-header-art'))return;
  const art=E('div','vc-header-art');
  art.append(makeArt('vr-neural','/ref-neural.webp'),makeArt('vr-robot','/ref-robot.webp'));
  node.append(art);
 }
 function panel(cls){
  const outer=E('div','vr-office-floating '+cls);
  const title=E('strong','',cls==='left'?'▤ Operação atual':'◉ Fluxo em tempo real');
  outer.append(title);
  if(cls==='left'){
    const name=E('div','vr-float-main','Aguardando projeto');name.id='vr-current-project';
    const description=E('small','','Dados reais de missões e projetos');description.id='vr-current-description';
    const row1=E('div','vr-float-row'),k1=E('span','','Na fila'),v1=E('b','','0');v1.id='vr-queued-jobs';row1.append(k1,v1);
    const row2=E('div','vr-float-row'),k2=E('span','','Em execução'),v2=E('b','','0');v2.id='vr-running-jobs';row2.append(k2,v2);
    const row3=E('div','vr-float-row'),k3=E('span','','Concluídas'),v3=E('b','','0');v3.id='vr-done-jobs';row3.append(k3,v3);
    outer.append(name,description,row1,row2,row3);
  }else{
    const events=E('div');events.id='vr-scene-activity';
    events.append(E('small','','Aguardando eventos do D1'));
    outer.append(events);
  }
  return outer;
 }
 function mount(){
  if(mounted)return;
  const office=$('vc-office'),grid=$('vc-office')?.querySelector('.vc-office-grid');
  if(!office||!grid)return;
  mounted=true;document.body.classList.add('vini-reference-r2');
  const scene=E('div','vr-office-scene');
  scene.setAttribute('aria-label','Ilustração do escritório virtual enviada como referência de design');
  scene.append(makeArt('vr-office-image','/ref-office.webp',''));
  scene.append(panel('left'),panel('right'));
  const label=E('div','vr-office-visual-note');label.append(E('span','','Cenário ilustrativo · atividade atual exibida nos painéis'));
  scene.append(label);
  office.insertBefore(scene,grid);
  for(const id of ['vc-projects-head','vc-mission-heading','vc-network-panel']){
   const root=$(id);if(root)headerArtwork(root.querySelector('.vc-header'));
  }
  const chatHero=$('jarvis-chat-hero');
  if(chatHero){chatHero.dataset.visualReference='user-approved';}
  const officeTitle=office.querySelector('.vc-office-top h2');
  if(officeTitle)officeTitle.textContent='Escritório Virtual';
  const program=document.querySelector('.nav[data-section="agents"] span');
  if(program)program.textContent='Rede Neural';
  const bottom=document.querySelector('.sidebar nav');
  if(bottom)bottom.setAttribute('aria-label','Chat, Escritório, Projetos, Missões, Rede Neural e Memória');
  const note=$('vc-office-current');
  if(note)note.textContent='Dados vinculados às missões do Cloudflare D1';
  update();
 }
 function update(){
  if(!mounted||typeof authValidated==='undefined'||!authValidated)return;
  const s=getState();if(!s)return;
  const missions=Array.isArray(s.missions)?s.missions:[];
  const code=Array.isArray(s.codeJobs)?s.codeJobs:[];
  const focus=$('vc-top-project')?.value||'';
  const projects=(typeof portfolio!=='undefined'&&Array.isArray(portfolio))?portfolio:[];
  const named=projects.find(p=>p.id===focus);
  const relevant=focus?missions.filter(m=>m.project_id===focus):missions;
  const relevantCode=focus?code.filter(j=>j.project_id===focus):code;
  const queued=relevant.filter(m=>m.status==='queued').length+relevantCode.filter(j=>j.status==='queued').length;
  const working=relevant.filter(m=>m.status==='running').length+relevantCode.filter(j=>j.status==='working').length;
  const done=relevant.filter(m=>m.status==='done').length+relevantCode.filter(j=>j.status==='done').length;
  const current=relevant.find(m=>m.status==='running')||relevant.find(m=>m.status==='queued')||relevant[0];
  const byid=(id,value)=>{const el=$(id);if(el)el.textContent=String(value);};
  byid('vr-current-project',named?.name||'Todas as operações');
  byid('vr-current-description',current?String(current.title).slice(0,70):'Sem missão ativa neste escopo');
  byid('vr-queued-jobs',queued);byid('vr-running-jobs',working);byid('vr-done-jobs',done);
  const log=$('vr-scene-activity');
  if(log){
   log.replaceChildren();
   const feed=Array.isArray(s.activity)?s.activity.slice(0,4):[];
   if(!feed.length)log.append(E('small','','Nenhuma ação auditada registrada'));
   for(const item of feed){
    const text=String(item.description||'').trim();
    if(!text)continue;
    const row=E('div','vr-mini-feed',nowTime(item.created_at)+' · '+String(item.agent_id||'VINI')+' '+text);
    row.title=text;log.append(row);
   }
  }
  const scene=$('vc-office')?.querySelector('.vr-office-scene');
  if(scene)scene.dataset.live=working>0?'true':'false';
 }
 const start=()=>{mount();setInterval(()=>{if(!mounted)mount();if(mounted&&!document.hidden)update();},3100);document.addEventListener('visibilitychange',()=>{if(!document.hidden)update();});document.querySelectorAll('.nav').forEach(b=>b.addEventListener('click',()=>requestAnimationFrame(update)));document.addEventListener('vini:delegated',()=>setTimeout(update,450));};
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();