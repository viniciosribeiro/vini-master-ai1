/* VINI 0.8: audit-first live monitor, read-only, sourced entirely from authenticated D1 activity. */
(()=>{
'use strict';
const AGENTS={supervisor:'VINI',programador:'Programador',designer:'Designer',qa:'QA',infra:'Infra',pesquisa:'Pesquisa'};
const COLOR={supervisor:'vini',programador:'dev',designer:'design',qa:'qa',infra:'infra',pesquisa:'research'};
let events=[],cursor=0,lastRead=0,lastFailure='',loading=false,selected='all',popupSelected='all',initial=true;
const $=id=>document.getElementById(id);
const el=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=String(text);return n;};
const activeWork=()=>typeof state!=='undefined'&&(
 (state.missions||[]).some(x=>['running','queued'].includes(x.status))||
 (state.codeJobs||[]).some(x=>['working','queued'].includes(x.status))
);
const currentTask=()=>{
 if(typeof state==='undefined')return null;
 const m=(state.missions||[]).find(x=>x.status==='running')||(state.missions||[]).find(x=>x.status==='queued');
 const j=(state.codeJobs||[]).find(x=>x.status==='working')||(state.codeJobs||[]).find(x=>x.status==='queued');
 return j&&(!m||j.status==='working'&&m.status!=='running')?{id:j.id,title:j.request,status:j.status,kind:'code'}:m?{id:m.id,title:m.title,status:m.status,kind:'mission'}:null;
};
const recentLabel=iso=>{const x=new Date(String(iso).includes('T')?iso:String(iso).replace(' ','T')+'Z');return Number.isFinite(x.getTime())?x.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit',second:'2-digit'}):'—';};
const describe=event=>{
 const desc=String(event.description||'');
 const code=/\b(?:falha|erro|bloque|negad|interromp|indispon[ií]vel)\b/i.test(desc)?'error':
 /(?:conclu|aprovad|pr pronto|verificado|finalizad|entreg)/i.test(desc)?'success':
 /(?:aguardando|na fila|pendente)/i.test(desc)?'waiting':'progress';
 return code;
};
function boxStatus(){
 const cur=currentTask(),signal=$('vini-live-status'),sub=$('vini-live-subtitle');
 if(signal){signal.textContent=lastFailure?'Conexão interrompida':cur?.status==='running'||cur?.status==='working'?'● Executando':cur?'◌ Na fila':'● Monitor conectado';signal.dataset.connection=lastFailure?'error':cur?'active':'idle';}
 if(sub)sub.textContent=lastFailure?'Não foi possível atualizar o diário: '+lastFailure:cur?'Tarefa '+cur.id.slice(0,8)+' · '+String(cur.title||'').slice(0,120):'Nenhuma missão em andamento. Os eventos anteriores continuam disponíveis.';
 const count=$('vini-live-count');if(count)count.textContent=events.length+' registro(s)';
}
function item(event){
 const wrapper=el('div','vini-live-event');wrapper.dataset.agent=event.agent_id||'';wrapper.dataset.kind=describe(event);
 wrapper.dataset.id=String(event.id);
 const head=el('div','vini-live-head');
 const agent=el('strong','vini-live-agent '+(COLOR[event.agent_id]||''),AGENTS[event.agent_id]||event.agent_id||'Sistema');
 const time=el('time','',recentLabel(event.created_at));time.dateTime=event.created_at||'';
 head.append(agent,time);
 const text=el('p','vini-live-description',event.description||'Evento registrado');
 const trail=el('small','vini-live-trail',event.mission_id?'Missão / trabalho '+String(event.mission_id).slice(0,12):'Registro do sistema');
 wrapper.append(head,text,trail);return wrapper;
}
function renderTo(container,kind='all',max=65){
 if(!container)return;
 const filtered=events.filter(e=>kind==='all'||e.agent_id===kind).slice(-max).reverse();
 const oldScroll=container.scrollTop;
 const holder=document.createDocumentFragment();
 if(!filtered.length){holder.append(el('p','vini-live-empty',lastFailure?'Sem conexão com o diário. O sistema não está confirmando novas ações.':'Nenhuma ação real registrada para este filtro.'));}
 for(const e of filtered)holder.append(item(e));
 container.replaceChildren(holder);
 if(oldScroll<25)container.scrollTop=0;
}
function renderFilters(parent,selectedValue,handler){
 if(!parent)return;
 const fragment=document.createDocumentFragment();
 for(const [id,label] of [['all','Todos'],...Object.entries(AGENTS)]){
  const btn=el('button',id===selectedValue?'vini-filter active':'vini-filter',label);
  btn.type='button';btn.setAttribute('aria-pressed',String(id===selectedValue));
  btn.addEventListener('click',()=>handler(id));fragment.append(btn);
 }
 parent.replaceChildren(fragment);
}
function display(){
 boxStatus();
 renderFilters($('vini-live-filters'),selected,x=>{selected=x;display();});
 renderTo($('vini-live-events'),selected,80);
 renderFilters($('vini-live-modal-filters'),popupSelected,x=>{popupSelected=x;display();});
 renderTo($('vini-live-modal-events'),popupSelected,180);
 const latest=events[events.length-1];
 if(latest&&typeof window!=='undefined'){window.jarvisLatestEvents=[...events].reverse();}
}
function open(agent='all'){
 popupSelected=AGENTS[agent]?agent:'all';display();
 const dialog=$('vini-live-modal');if(dialog&&!dialog.open)dialog.showModal();
}
window.jarvisOpenLive=open;
$('vini-live-modal-close')?.addEventListener('click',()=>$('vini-live-modal').close());
$('vini-live-modal')?.addEventListener('click',e=>{if(e.target===$('vini-live-modal'))e.target.close();});
$('vini-live-open')?.addEventListener('click',()=>open());
$('vini-live-chat-open')?.addEventListener('click',()=>open());
$('vini-live-refresh')?.addEventListener('click',()=>{lastRead=0;void poll(true);});
async function poll(force=false){
 if(loading||document.hidden||!navigator.onLine)return;
 if(typeof authValidated==='undefined'||!authValidated)return;
 const interval=activeWork()?1700:9000;
 if(!force&&Date.now()-lastRead<interval)return;
 loading=true;lastRead=Date.now();
 try{
  const query='/live?after='+encodeURIComponent(cursor)+'&limit=110';
  const data=await api(query);
  lastFailure='';
  const batch=(Array.isArray(data.events)?data.events:[]).filter(x=>Number.isFinite(Number(x.id)));
  for(const e of batch){
   if(!events.some(old=>Number(old.id)===Number(e.id)))events.push(e);
   cursor=Math.max(cursor,Number(e.id));
  }
  events.sort((a,b)=>Number(a.id)-Number(b.id));
  if(events.length>280)events=events.slice(-280);
  display();
  // Store only the latest real events for the office bubbles; no generated/fictional activity.
  if(batch.length&&!initial){
   const event=batch[batch.length-1];
   if(typeof officeNotice==='function'&&batch.length<8&&activeWork())officeNotice(event);
  }
  initial=false;
  if(data.hasMore&&cursor<Number(data.latestId))lastRead=0;
 }catch(e){lastFailure=String(e.message||e).slice(0,150);boxStatus();}
 finally{loading=false;}
}
const monitor=setInterval(()=>{void poll()},900); // throttled inside poll; no busy network loop
window.addEventListener('online',()=>{lastRead=0;void poll(true);});
document.addEventListener('visibilitychange',()=>{if(!document.hidden){lastRead=0;void poll(true);}});
document.querySelectorAll('.nav[data-section=office]').forEach(b=>b.addEventListener('click',()=>{lastRead=0;void poll(true);}));
document.addEventListener('vini:delegated',()=>{lastRead=0;void poll(true);});
window.addEventListener('pagehide',()=>clearInterval(monitor));
})();
