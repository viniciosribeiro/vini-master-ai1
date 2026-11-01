/* VINI project chat library. Metadata only in browser; all history stored per-thread in D1. */
(()=>{
'use strict';
const $=id=>document.getElementById(id);
const esc=s=>String(s??'');
let threads=[],projects=[],selectedId='',loaded=false,loading=null,filter='active',query='',projectFilter='',drawer=false,dialogMode='new',dialogTarget=null;
const idKey='vini_selected_chat_thread';
const mk=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=esc(text);return n;};
const report=e=>typeof notify==='function'?notify(esc(e.message||e)):console.warn(e);
const current=()=>threads.find(t=>t.id===selectedId)||null;
function fillSelect(id,selected='',draftOption=false){
 const sel=$(id);if(!sel)return;
 sel.replaceChildren();
 if(draftOption){const d=mk('option','','＋ Novo projeto (entrevista)');d.value='__new_project__';sel.append(d);}
 else {const empty=mk('option','','Selecione um projeto');empty.value='';sel.append(empty);}
 for(const p of projects.filter(x=>x.status==='active')){
  const option=mk('option','',p.name);option.value=p.id;sel.append(option);
 }
 if(selected)sel.value=selected;
}
function renderHeader(){
 const t=current();
 $('chat-current-title').textContent=t?t.title:'Nenhuma conversa selecionada';
 const project=t?.project_id?projects.find(p=>p.id===t.project_id):null;
 const locked=!!t?.project_id&&(!project||project.status!=='active');
 $('chat-current-project').textContent=t?(locked?'Projeto arquivado/excluído — restaure ou mova a conversa':t.project_name||'Histórico não vinculado — escolha um projeto'):'Crie uma conversa e selecione o projeto';
 $('chat-thread-menu').disabled=!t;
 $('chat-form')?.querySelectorAll('button,input').forEach(el=>{if(el.id!=='jarvis-chat-mic')el.disabled=!t||t.status!=='active'||locked||(!t.project_id&&!t.is_draft);});
 const noThread=!t;
 const input=$('chat-message');if(input)input.placeholder=noThread?'Crie uma conversa para começar':t.is_draft?'Descreva o novo projeto…':'Converse sobre '+(t.project_name||'seu projeto')+'…';
}
function projectLabel(t){return t.project_name||'Sem projeto · histórico anterior';}
function groupRows(list){
 const groups=new Map();
 for(const t of list){const label=projectLabel(t);if(!groups.has(label))groups.set(label,[]);groups.get(label).push(t);}
 return groups;
}
function rowActions(t,menu){
 const add=(label,fn)=>{const button=mk('button','chat-thread-action',label);button.type='button';button.addEventListener('click',async e=>{e.stopPropagation();menu.hidden=true;try{await fn()}catch(err){report(err);}});menu.append(button);};
 if(t.status==='active'){
  add('Renomear',async()=>{const next=prompt('Novo título da conversa:',t.title);if(next===null)return;await api('/threads/'+encodeURIComponent(t.id),{method:'PATCH',body:{title:next}});await reload();});
  add('Mover para projeto',async()=>openProjectPicker('move',t));
  add('Arquivar',async()=>{await api('/threads/'+t.id,{method:'PATCH',body:{status:'archived'}});if(selectedId===t.id)selectedId='';await reload();await loadChat();});
  add('Enviar à lixeira',async()=>{if(!confirm('Mover esta conversa para a lixeira? O histórico poderá ser restaurado.'))return;await api('/threads/'+t.id,{method:'DELETE'});if(selectedId===t.id)selectedId='';await reload();await loadChat();});
 }else if(t.status==='archived'){
  add('Restaurar conversa',async()=>{await api('/threads/'+t.id,{method:'PATCH',body:{status:'active'}});filter='active';await reload();await select(t.id);});
  add('Enviar à lixeira',async()=>{if(!confirm('Enviar conversa arquivada à lixeira?'))return;await api('/threads/'+t.id,{method:'DELETE'});if(selectedId===t.id)selectedId='';await reload();await loadChat();});
 }else{
  add('Restaurar da lixeira',async()=>{await api('/threads/'+t.id,{method:'PATCH',body:{status:'active'}});filter='active';await reload();await select(t.id);});
  add('Excluir definitivamente',async()=>{if(!confirm('Excluir definitivamente esta conversa e todas as mensagens? Não será possível recuperar.'))return;await api('/threads/'+t.id+'?permanent=true',{method:'DELETE'});if(selectedId===t.id)selectedId='';await reload();await loadChat();});
 }
}
function render(){
 const box=$('chat-thread-list');if(!box)return;box.replaceChildren();
 const rows=threads.filter(t=>(filter==='all'||t.status===filter)&&(!projectFilter||t.project_id===projectFilter));
 const result=query.trim().toLocaleLowerCase('pt-BR');
 const filtered=rows.filter(t=>!result||(t.title+' '+(t.project_name||'')+' '+(t.preview||'')).toLocaleLowerCase('pt-BR').includes(result));
 if(!filtered.length){box.append(mk('p','chat-thread-empty',result?'Nenhuma conversa encontrada.':filter==='archived'?'Nenhuma conversa arquivada.':filter==='trashed'?'Lixeira vazia.':'Crie uma conversa para começar.'));renderHeader();return;}
 for(const [group,list] of groupRows(filtered)){
  const label=mk('div','chat-thread-group',group);box.append(label);
  for(const t of list){
   const row=mk('div','chat-thread-item');row.dataset.id=t.id;row.setAttribute('role','listitem');if(t.id===selectedId)row.classList.add('selected');
   const open=mk('button','chat-thread-open');open.type='button';
   const title=mk('strong','',t.title),info=mk('small','',((t.message_count||0)+' mensagens')+' · '+esc(t.preview||'Conversa vazia').slice(0,60));
   open.append(title,info);open.addEventListener('click',()=>{void select(t.id)});
   const toggle=mk('button','chat-thread-more','⋯');toggle.type='button';toggle.setAttribute('aria-label','Opções da conversa '+t.title);toggle.setAttribute('aria-expanded','false');
   const menu=mk('div','chat-thread-item-menu');menu.hidden=true;rowActions(t,menu);
   toggle.addEventListener('click',e=>{e.stopPropagation();box.querySelectorAll('.chat-thread-item-menu').forEach(x=>{if(x!==menu)x.hidden=true});menu.hidden=!menu.hidden;toggle.setAttribute('aria-expanded',String(!menu.hidden));});
   row.append(open,toggle,menu);box.append(row);
  }
 }
 renderHeader();
}
async function reload(){
 if(typeof authValidated!=='undefined'&&!authValidated)return;
 const [a,b]=await Promise.all([api('/threads?status=all'),api('/projects')]);
 threads=a.threads||[];projects=b.projects||[];loaded=true;
 const filterSelect=$('chat-thread-project-filter');
 const prev=filterSelect?.value||projectFilter;
 if(filterSelect){
  filterSelect.replaceChildren(mk('option','','Todos os projetos'));filterSelect.firstChild.value='';
  for(const p of projects){const o=mk('option','',p.name);o.value=p.id;filterSelect.append(o);}
  filterSelect.value=prev;projectFilter=filterSelect.value;
 }
 if(selectedId&&!threads.some(t=>t.id===selectedId&&t.status==='active'))selectedId='';
 render();return threads;
}
async function ensureSelected(){
 if(!loaded){
  if(!loading)loading=reload().finally(()=>{loading=null});
  await loading;
 }
 if(!selectedId){
  const cached=sessionStorage.getItem(idKey);
  const chosen=threads.find(t=>t.id===cached&&t.status==='active')||threads.find(t=>t.status==='active'&&t.project_id)||threads.find(t=>t.status==='active');
  selectedId=chosen?.id||'';
 }
 renderHeader();return selectedId;
}
async function select(id){
 if(typeof chatSending!=='undefined'&&chatSending){report(new Error('A resposta está sendo recebida. Abra outra conversa quando ela terminar.'));return;}
 const t=threads.find(t=>t.id===id);if(!t)return;
 selectedId=id;sessionStorage.setItem(idKey,id);
 render();closeDrawer();
 if(typeof show==='function')show('chat');else if(typeof loadChat==='function')await loadChat();
}
function openDrawer(){drawer=true;document.body.classList.add('chat-threads-drawer-open');$('chat-thread-backdrop').hidden=false;$('chat-thread-toggle')?.setAttribute('aria-expanded','true');$('chat-thread-search')?.focus();if(!loaded)void reload().catch(report);}
function closeDrawer(){drawer=false;document.body.classList.remove('chat-threads-drawer-open');$('chat-thread-backdrop').hidden=true;$('chat-thread-toggle')?.setAttribute('aria-expanded','false');}
function openProjectPicker(mode='new',thread=null){
 dialogMode=mode;dialogTarget=thread;$('chat-thread-dialog-title').textContent=mode==='move'?'Mover conversa para outro projeto':'Nova conversa';
 $('chat-thread-dialog-hint').textContent=mode==='move'?'Selecione o projeto que receberá esta conversa e seu contexto.':'Selecione o projeto para manter o histórico organizado, ou crie um novo projeto.';
 fillSelect('chat-thread-project-picker',mode==='move'?thread.project_id||'':current()?.project_id||projects.find(p=>p.status==='active')?.id||'__new_project__',mode==='new');
 $('chat-thread-dialog-confirm').textContent=mode==='move'?'Mover conversa':'Criar conversa';
 $('chat-thread-dialog').showModal();
}
async function createNew({projectId=null,draft=false,title='Nova conversa'}={}){
 if(typeof chatSending!=='undefined'&&chatSending)throw Error('Termine o envio atual antes de abrir outra conversa.');
 const data=await api('/threads',{method:'POST',body:{projectId,draft,title}});
 filter='active';query='';projectFilter='';$('chat-thread-search').value='';
 document.querySelectorAll('[data-chat-filter]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.chatFilter==='active')));
 await reload();await select(data.thread.id);
 return data.thread;
}
async function createNewProject(){
 const t=await createNew({draft:true,title:'Novo projeto · entrevista'});
 const inp=$('chat-message');if(inp)inp.value='Quero criar um novo projeto';
 $('chat-form')?.requestSubmit();
 return t;
}
$('chat-thread-toggle')?.addEventListener('click',()=>drawer?closeDrawer():openDrawer());
$('chat-thread-close')?.addEventListener('click',closeDrawer);
$('chat-thread-backdrop')?.addEventListener('click',closeDrawer);
$('chat-thread-create')?.addEventListener('click',()=>openProjectPicker());
$('chat-thread-new-project')?.addEventListener('click',()=>void createNewProject().catch(report));
$('chat-thread-menu')?.addEventListener('click',()=>{openDrawer();const t=current();if(t){const menu=$('chat-thread-list')?.querySelector('[data-id="'+t.id+'"] .chat-thread-item-menu');if(menu){menu.hidden=false;menu.scrollIntoView({block:'nearest'});}}});
$('chat-thread-search')?.addEventListener('input',e=>{query=e.target.value;render()});
$('chat-thread-project-filter')?.addEventListener('change',e=>{projectFilter=e.target.value;render()});
document.querySelectorAll('[data-chat-filter]').forEach(b=>b.addEventListener('click',()=>{filter=b.dataset.chatFilter;document.querySelectorAll('[data-chat-filter]').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));render();}));
$('chat-thread-dialog-close')?.addEventListener('click',()=>$('chat-thread-dialog').close());
$('chat-thread-dialog-cancel')?.addEventListener('click',()=>$('chat-thread-dialog').close());
$('chat-thread-dialog-confirm')?.addEventListener('click',async()=>{
 const value=$('chat-thread-project-picker').value;
 if(!value){report(new Error('Escolha um projeto.'));return;}
 if(dialogMode==='move'&&value==='__new_project__'){report(new Error('Selecione um projeto existente.'));return;}
 $('chat-thread-dialog').close();
 try{
  if(dialogMode==='move'&&dialogTarget){
   await api('/threads/'+dialogTarget.id,{method:'PATCH',body:{projectId:value}});
   await reload();await select(dialogTarget.id);
  }else if(value==='__new_project__')await createNewProject();
  else await createNew({projectId:value});
 }catch(e){report(e);}
});
window.viniThreads={ensureSelected,selected:()=>selectedId,current,createNew,createNewProject,reload,openDrawer,closeDrawer,openProjectPicker,renderHeader};
})();
