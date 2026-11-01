import {callAI} from './ai.js';
import {parseIdeas,saveIdeas,auditProject} from './project-manager.js';
import {ensureSchema} from './bootstrap.js';
export async function proactiveReview(env){
 if(!env.DB||!env.AI?.run)return {status:'skipped',reason:'missing bindings'};
 await ensureSchema(env.DB);
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
