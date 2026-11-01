/* Real proof panel; shows persisted D1 code job/analysis facts only. */
(()=>{
 'use strict';
 const $=id=>document.getElementById(id);
 let last=0,busy=false;
 const label={queued:'Na fila',working:'Executando',running:'Executando',done:'Concluído',failed:'Falhou'};
 function create(tag,cls,text){const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=String(text);return n;}
 function render(items){
  const node=$('vini-proof-list'),counts=$('vini-proof-counts');if(!node)return;
  const completePR=items.filter(x=>x.proof?.type==='github_pr');
  const analysis=items.filter(x=>x.kind==='analysis'&&x.status==='done');
  const pending=items.filter(x=>['queued','running','working'].includes(x.status));
  counts.textContent=completePR.length+' PR(s) registrado(s) • '+analysis.length+' análise(s) concluída(s) • '+pending.length+' em andamento/na fila';
  const fragment=document.createDocumentFragment();
  if(!items.length)fragment.append(create('p','vini-proof-empty','Ainda não existe trabalho registrado. Uma conversa isolada não gera entregas.'));
  for(const row of items.slice(0,12)){
   const article=create('article','vini-proof-card');
   article.dataset.proof=row.proof?.type==='github_pr'?'verified':row.kind==='analysis'?'analysis':'pending';
   const top=create('div','vini-proof-top');
   top.append(create('strong','',row.kind==='analysis'?'Relatório de IA':row.proof?.type==='github_pr'?'Alteração no GitHub':'Tarefa de código'));
   top.append(create('span','vini-proof-status',label[row.status]||row.status));
   article.append(top);
   article.append(create('p','vini-proof-task',row.title||row.project||'Tarefa'));
   article.append(create('p','vini-proof-explanation',row.explanation));
   if(row.proof?.type==='github_pr'&&typeof row.proof.url==='string'){
    const a=create('a','vini-proof-pr','Abrir PR no GitHub ↗');
    a.href=row.proof.url;a.target='_blank';a.rel='noopener noreferrer';article.append(a);
   }
   article.append(create('small','vini-proof-id','ID '+String(row.id).slice(0,16)+' · '+(row.updatedAt||'sem horário')));
   fragment.append(article);
  }
  node.replaceChildren(fragment);
 }
 async function load(force=false){
  if(busy||typeof authValidated==='undefined'||!authValidated||!navigator.onLine||document.hidden)return;
  if(!force&&Date.now()-last<14000)return;
  busy=true;last=Date.now();
  try{const data=await api('/evidence');render(data.items||[]);}
  catch(e){const n=$('vini-proof-counts');if(n)n.textContent='Não foi possível conferir as entregas: '+String(e.message||e).slice(0,100);}
  finally{busy=false;}
 }
 const jump=()=>{
  document.querySelector('.nav[data-section="office"]')?.click();
  $('vini-proof-list')?.scrollIntoView({behavior:'smooth',block:'start'});
  load(true);
 };
 $('vini-chat-proofs')?.addEventListener('click',jump);
 $('vini-proof-refresh')?.addEventListener('click',()=>load(true));
 document.querySelector('.nav[data-section="office"]')?.addEventListener('click',()=>load(true));
 document.addEventListener('vini:delegated',()=>{last=0;load(true)});
 document.addEventListener('visibilitychange',()=>{if(!document.hidden){last=0;load(true)}});
 setInterval(()=>{if(typeof state!=='undefined'&&((state.missions||[]).some(x=>['queued','running'].includes(x.status))||(state.codeJobs||[]).some(x=>['queued','working'].includes(x.status))))load()},5500);
})();
