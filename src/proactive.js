import {syncProjectDeployments,verifyProjectLinks} from './deployments.js';
import {callAI} from './ai.js';
import {parseIdeas,saveIdeas,auditProject,createProject,listProjects,projectStatus} from './project-manager.js';
import {readGitHub,listGitHubRepos} from './github-engine.js';
import {ensureSchema} from './bootstrap.js';
async function syncNewRepos(env){
 try{
  const key=await readGitHub(env);if(!key)return {added:0};
  const remote=await listGitHubRepos(key);
  const existing=new Set((await listProjects(env.DB)).map(x=>x.repo.toLowerCase()));
  let added=0;
  for(const repo of remote){
   if(existing.has(repo.repo.toLowerCase()))continue;
   const project=await createProject(env.DB,{name:repo.name,description:repo.description||'Importado automaticamente do GitHub.',platform:'other',repo:repo.repo});
   if(repo.archived)await projectStatus(env.DB,project.id,'archived','');
   existing.add(repo.repo.toLowerCase());added++;if(added>=30)break;
  }
  return {added};
 }catch{return {added:0,reason:'GitHub indisponível para sincronização'};}
}
async function syncReleasedSites(env){
 try{
  const token=await readGitHub(env);if(!token)return {checked:0};
  const projects=await listProjects(env.DB);
  let checked=0;
  for(const p of projects.filter(x=>x.status==='active'&&x.repo).slice(0,4)){
   try{await syncProjectDeployments(env.DB,token,p);const current=await env.DB.prepare('SELECT * FROM projects WHERE id=?').bind(p.id).first();if(current)await verifyProjectLinks(env.DB,current);}catch{}
   checked++;
  }
  return {checked};
 }catch{return {checked:0};}
}
export async function proactiveReview(env){
 if(!env.DB||!env.AI?.run)return {status:'skipped',reason:'missing bindings'};
 await ensureSchema(env.DB);
 await syncNewRepos(env);
 await syncReleasedSites(env);
 const project=await env.DB.prepare("SELECT p.* FROM projects p WHERE p.status='active' AND NOT EXISTS(SELECT 1 FROM project_events e WHERE e.project_id=p.id AND e.action='auto-review' AND e.created_at>=datetime('now','-7 days')) ORDER BY p.updated_at ASC LIMIT 1").first();
 if(!project)return {status:'skipped',reason:'no project due'};
 const [memories,messages]=await Promise.all([
  env.DB.prepare('SELECT content FROM memories ORDER BY created_at DESC LIMIT 45').all(),
  env.DB.prepare('SELECT role,content FROM messages ORDER BY id DESC LIMIT 45').all()
 ]);
 try{
  const response=await callAI(env,[
   {role:'system',content:'Você é analista de produto e inovação. Em português brasileiro natural proponha 1 a 3 melhorias que antecipem necessidades ou aumentem segurança, qualidade, UX e oportunidades do projeto. Compare com objetivos e preferências pessoais registrados. Nada de alegar pesquisa online ou implantação. Responda SOMENTE JSON: [{"title":"...","description":"...","reason":"..."}]. Não proponha serviços pagos sem necessidade. Se não tiver evidência suficiente, proponha verificações úteis.'},
   {role:'user',content:'Projeto: '+project.name+'\nDescrição: '+project.description+'\nHospedagem: '+project.platform+'\nPreferências lembradas: '+(memories.results||[]).map(x=>x.content.slice(0,350)).join(' | ').slice(0,5200)+'\nConversas recentes: '+(messages.results||[]).reverse().map(x=>x.role+': '+x.content.slice(0,280)).join('\n').slice(0,6500)}
  ],'cloudflare');
  const added=await saveIdeas(env.DB,project.id,parseIdeas(response.text));
  await auditProject(env.DB,project.id,'auto-review','Revisão automática: '+added+' novas sugestões');
  if(added)await env.DB.prepare('INSERT INTO activity(agent_id,description) VALUES(?,?)').bind('pesquisa','Novas sugestões para '+project.name+': '+added).run();
  return {status:'done',projectId:project.id,added};
 }catch(e){
  await auditProject(env.DB,project.id,'auto-review','Revisão não concluída: '+String(e.message||e).slice(0,150));
  return {status:'failed'};
 }
}
