// VINI MASTER AI - mobile-first portfolio. All data is read from the authenticated D1 API.
let portfolio=[],portfolioIdeas=[],selectedProject=null,githubReady=false;
const pj=id=>document.getElementById(id);
function projectNotice(message){const area=pj('projects-feedback');area.textContent=String(message||'');if(message)notify(message);}
function projectStatusLabel(status){return {active:'Ativo',archived:'Arquivado',trashed:'Lixeira'}[status]||status;}
function projectButton(text,onClick,className='secondary'){
 const button=document.createElement('button');button.type='button';button.className=className;button.textContent=text;button.addEventListener('click',onClick);return button;
}
function projectText(tag,value,cls=''){
 const node=document.createElement(tag);node.textContent=String(value??'');if(cls)node.className=cls;return node;
}
async function loadProjects(){
 if(!token||!authValidated)return;
 try{
  const [projects,ideas,github]=await Promise.all([api('/projects'),api('/ideas'),api('/github/status')]);
  portfolio=projects.projects||[];portfolioIdeas=ideas.ideas||[];githubReady=!!github.connected;
  pj('github-connection-status').textContent=githubReady?'GitHub conectado. PRs habilitados para projetos vinculados.':'GitHub não conectado. Conecte uma vez para habilitar PRs.';
  const pending=portfolioIdeas.filter(x=>x.status==='new').length;
  const badge=pj('idea-count');badge.hidden=!pending;badge.textContent=pending>99?'99+':String(pending);
  renderPortfolio();
  if(selectedProject){
   selectedProject=portfolio.find(x=>x.id===selectedProject.id)||null;
   if(selectedProject){renderSelectedProject();await loadProjectJobs();}
   else pj('project-workspace').hidden=true;
  }
 }catch(e){projectNotice('Não foi possível carregar projetos: '+e.message);}
}
function renderPortfolio(){
 const parent=pj('projects-list');parent.replaceChildren();
 if(!portfolio.length){parent.append(projectText('p','Nenhum projeto cadastrado. Crie o primeiro no formulário acima.','muted'));return;}
 for(const item of portfolio){
  const card=document.createElement('article');card.className='portfolio-card';card.dataset.status=item.status;
  card.append(projectText('strong',item.name));
  card.append(projectText('small',projectStatusLabel(item.status)+' · '+item.platform+' · '+(item.repo||'Sem GitHub')));
  if(item.description)card.append(projectText('p',item.description.slice(0,240)));
  card.append(projectButton('Gerenciar projeto',()=>selectProject(item.id),'secondary'));
  parent.append(card);
 }
}
async function selectProject(id){
 selectedProject=portfolio.find(x=>x.id===id)||null;
 if(!selectedProject)return;
 renderSelectedProject();await loadProjectJobs();
 pj('project-workspace').scrollIntoView({behavior:'smooth',block:'start'});
}
function renderSelectedProject(){
 const row=selectedProject,container=pj('project-workspace');
 if(!row){container.hidden=true;return;}
 container.hidden=false;
 pj('selected-project-title').textContent=row.name+' · '+projectStatusLabel(row.status);
 pj('project-edit-name').value=row.name;
 pj('project-edit-description').value=row.description||'';
 pj('project-edit-platform').value=row.platform;
 pj('project-edit-repo').value=row.repo||'';
 pj('project-archive').disabled=row.status!=='active';
 pj('project-trash').disabled=row.status==='trashed';
 pj('project-restore').disabled=row.status==='active';
 pj('project-permanent').hidden=row.status!=='trashed';
 pj('project-edit-form').querySelector('button[type="submit"]').disabled=row.status==='trashed';
 pj('code-job-form').querySelector('button[type="submit"]').disabled=row.status!=='active'||!row.repo||!githubReady;
 pj('project-generate-ideas').disabled=row.status!=='active';
 renderProjectIdeas();
}
function renderProjectIdeas(){
 const wrap=pj('project-ideas');wrap.replaceChildren();
 if(!selectedProject)return;
 const ideas=portfolioIdeas.filter(x=>x.project_id===selectedProject.id);
 if(!ideas.length){wrap.append(projectText('p','Nenhuma sugestão ainda. Use Analisar melhorias ou aguarde a revisão automática.','muted'));return;}
 for(const idea of ideas){
  const card=document.createElement('article');card.className='idea-card';
  card.append(projectText('strong',idea.title),projectText('p',idea.description),projectText('small',idea.reason||''));
  const buttons=document.createElement('div');buttons.className='idea-actions';
  if(idea.status==='new'){
   buttons.append(projectButton('Guardar ideia',()=>ideaAction(idea,'accepted')));
   buttons.append(projectButton('Dispensar',()=>ideaAction(idea,'dismissed')));
  }
  if(idea.status==='accepted'&&selectedProject.repo&&githubReady&&selectedProject.status==='active'){
   buttons.append(projectButton('Pedir implementação',()=>startCodeJob('Implemente esta melhoria: '+idea.title+'. '+idea.description),'primary'));
  }
  card.append(buttons);wrap.append(card);
 }
}
async function ideaAction(idea,status){
 try{await api('/ideas/'+idea.id,{method:'PATCH',body:{status}});await loadProjects();}
 catch(e){projectNotice(e.message);}
}
async function loadProjectJobs(){
 const wrap=pj('code-job-list');wrap.replaceChildren();
 if(!selectedProject)return;
 try{
  const data=await api('/projects/'+selectedProject.id+'/jobs');
  const jobs=data.jobs||[];
  if(!jobs.length){wrap.append(projectText('p','Nenhuma tarefa de programação iniciada.','muted'));return;}
  for(const job of jobs){
   const card=document.createElement('article');card.className='code-job-card';
   card.append(projectText('strong',job.request.slice(0,170)),projectText('small',job.status+' · '+(job.detail||'Aguardando')));
   if(job.result){
    try{
     const result=JSON.parse(job.result);
     if(typeof result.url==='string'&&/^https:\/\/github\.com\/[\w.-]+\/[\w.-]+\/pull\/\d+$/.test(result.url)){
      const a=document.createElement('a');a.href=result.url;a.target='_blank';a.rel='noopener noreferrer';a.textContent='Abrir PR #'+result.number+' no GitHub';card.append(a);
     }
    }catch{}
   }
   wrap.append(card);
  }
 }catch(e){wrap.append(projectText('p',e.message,'muted'));}
}
async function startCodeJob(request){
 if(!selectedProject)return;
 try{
  const result=await api('/projects/'+selectedProject.id+'/code',{method:'POST',body:{request,provider:state.provider||'auto'}});
  projectNotice('Programador recebeu o trabalho. Acompanhe a tarefa e o PR nesta tela.');
  pj('code-job-request').value='';
  await loadProjectJobs();
  return result;
 }catch(e){projectNotice('A tarefa não começou: '+e.message);}
}
pj('projects-refresh').addEventListener('click',loadProjects);
pj('projects-import').addEventListener('click',async e=>{
 const button=e.currentTarget;button.disabled=true;
 try{
  const result=await api('/github/import',{method:'POST',body:{}});
  await loadProjects();
  projectNotice(result.imported+' projeto(s) importado(s) do GitHub. Os repositórios remotos não foram alterados.');
 }catch(err){projectNotice(err.message);}finally{button.disabled=false;}
});

pj('project-add-form').addEventListener('submit',async e=>{
 e.preventDefault();
 try{
  const data={name:pj('project-new-name').value,description:pj('project-new-description').value,platform:pj('project-new-platform').value,repo:pj('project-new-repo').value};
  const result=await api('/projects',{method:'POST',body:data});
  e.target.reset();await loadProjects();await selectProject(result.project.id);projectNotice('Projeto adicionado ao painel.');
 }catch(err){projectNotice(err.message);}
});
pj('project-edit-form').addEventListener('submit',async e=>{
 e.preventDefault();if(!selectedProject)return;
 try{
  await api('/projects/'+selectedProject.id,{method:'PATCH',body:{name:pj('project-edit-name').value,description:pj('project-edit-description').value,platform:pj('project-edit-platform').value,repo:pj('project-edit-repo').value}});
  await loadProjects();projectNotice('Informações do projeto salvas no D1. O repositório remoto não foi renomeado.');
 }catch(err){projectNotice(err.message);}
});
pj('project-back').addEventListener('click',()=>{selectedProject=null;pj('project-workspace').hidden=true;pj('projects-list').scrollIntoView({behavior:'smooth',block:'start'});});
async function changeStatus(status,confirmText){
 if(!selectedProject)return;
 try{
  await api('/projects/'+selectedProject.id+'/status',{method:'POST',body:{status,confirm:confirmText||''}});
  await loadProjects();projectNotice(status==='trashed'?'Projeto enviado à lixeira, podendo ser recuperado.':status==='archived'?'Projeto arquivado.':'Projeto restaurado.');
 }catch(e){projectNotice(e.message);}
}
pj('project-archive').addEventListener('click',()=>changeStatus('archived'));
pj('project-restore').addEventListener('click',()=>changeStatus('active'));
pj('project-trash').addEventListener('click',()=>{
 if(!selectedProject)return;
 const typed=prompt('Para enviar à lixeira, digite exatamente o nome do projeto:\n'+selectedProject.name);
 if(typed!==null)changeStatus('trashed',typed);
});
pj('project-permanent').addEventListener('click',async()=>{
 if(!selectedProject)return;
 const typed=prompt('Isso apaga definitivamente o REGISTRO do painel, NÃO o GitHub ou o site.\nDigite: EXCLUIR '+selectedProject.name);
 if(typed===null)return;
 try{
  await api('/projects/'+selectedProject.id+'/permanent',{method:'DELETE',body:{confirm:typed}});
  selectedProject=null;await loadProjects();pj('project-workspace').hidden=true;projectNotice('Registro removido definitivamente do painel.');
 }catch(e){projectNotice(e.message);}
});
pj('project-generate-ideas').addEventListener('click',async e=>{
 if(!selectedProject)return;const button=e.currentTarget;button.disabled=true;projectNotice('Analisando seu projeto, suas memórias e conversas...');
 try{const result=await api('/projects/'+selectedProject.id+'/ideas',{method:'POST',body:{}});await loadProjects();projectNotice(result.created+' sugestão(ões) nova(s) criada(s).');}
 catch(err){projectNotice(err.message);}finally{button.disabled=false;}
});
pj('code-job-form').addEventListener('submit',e=>{e.preventDefault();const value=pj('code-job-request').value.trim();if(value.length>=15)startCodeJob(value);else projectNotice('Descreva melhor o que deve ser construído.');});
pj('github-connect-form').addEventListener('submit',async e=>{
 e.preventDefault();const input=pj('github-access-key'),btn=e.target.querySelector('button[type="submit"]');btn.disabled=true;
 try{
  const result=await api('/github/connect',{method:'POST',body:{token:input.value.trim(),repo:pj('github-check-repo').value.trim()}});
  input.value='';githubReady=true;let imported=0;
  try{const batch=await api('/github/import',{method:'POST',body:{}});imported=batch.imported||0;}catch{}
  await loadProjects();projectNotice('GitHub conectado! '+imported+' projeto(s) importado(s) automaticamente.');
 }catch(err){projectNotice(err.message);}finally{btn.disabled=false;}
});
pj('github-disconnect').addEventListener('click',async()=>{
 if(!confirm('Desconectar o GitHub? As tarefas futuras precisarão de uma nova conexão.'))return;
 try{await api('/github/disconnect',{method:'POST',body:{}});githubReady=false;await loadProjects();projectNotice('GitHub desconectado.');}
 catch(e){projectNotice(e.message);}
});
setInterval(()=>{if(token&&authValidated&&!pj('section-projects').hidden&&selectedProject)loadProjectJobs();},12000);

async function loadWorkProfile(){
 if(!token||!authValidated)return;
 try{const data=await api('/profile');pj('work-profile-text').value=data.profile?.content||'';}
 catch(e){pj('work-profile-feedback').textContent=e.message;}
}
pj('work-profile-form').addEventListener('submit',async e=>{
 e.preventDefault();
 try{await api('/profile',{method:'PUT',body:{content:pj('work-profile-text').value}});pj('work-profile-feedback').textContent='Perfil salvo. O supervisor considerará suas preferências nas próximas conversas.';}
 catch(err){pj('work-profile-feedback').textContent=err.message;}
});
pj('profile-analyze').addEventListener('click',async e=>{
 const button=e.currentTarget;button.disabled=true;pj('work-profile-feedback').textContent='Analisando suas conversas e decisões reais...';
 try{
  const result=await api('/profile/analyze',{method:'POST',body:{}});
  await loadWorkProfile();pj('work-profile-feedback').textContent=result.updated?'Seu perfil de trabalho foi atualizado. Revise o texto para conferir as conclusões.':result.reason;
 }catch(err){pj('work-profile-feedback').textContent=err.message;}
 finally{button.disabled=false;}
});
pj('profile-delete').addEventListener('click',async()=>{
 if(!confirm('Apagar o perfil resumido de trabalho? Mensagens e memórias explícitas serão mantidas.'))return;
 try{await api('/profile',{method:'DELETE',body:{confirm:'APAGAR PERFIL'}});pj('work-profile-text').value='';pj('work-profile-feedback').textContent='Perfil resumido apagado.';}
 catch(err){pj('work-profile-feedback').textContent=err.message;}
});
