import {routeWorkIntent,delegateChatWork} from './orchestrator.js';
import {saveDeploymentLinks,syncProjectDeployments,verifyProjectLinks} from './deployments.js';
import {guardChatDeployment,deploymentContext} from './deploy-verification.js';
import {setupIntakes,handleIntake} from './intake.js';
import {readProfile,saveProfile,generateProfile} from './learning.js';
import {createProject,listProjects,getProject,modifyProject,projectStatus,permanentlyDeleteProject,listIdeas,updateIdea,parseIdeas,saveIdeas,auditProject} from './project-manager.js';
import {saveGitHub,readGitHub,hasGitHub,verifyGitHub,listGitHubRepos} from './github-engine.js';
import {hasStoredNvidia,storeNvidia,removeNvidia} from './provider-secrets.js';
import {AGENTS,MAX_MESSAGE,MAX_MISSION,normalizeProvider,callAI,searchTerms,verifyProvider} from './ai.js';
import {ensureSchema} from './bootstrap.js';
const respond=(data,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
const fail=(message,status=400)=>respond({error:message},status);
const safeId=x=>/^[a-zA-Z0-9_-]{1,80}$/.test(x||'');
export function authorized(req,env){
 if(!env.MASTER_TOKEN||env.MASTER_TOKEN.length<24)return false;
 const got=req.headers.get('Authorization')||'';
 const good='Bearer '+env.MASTER_TOKEN;
 if(got.length!==good.length)return false;
 let diff=0;for(let i=0;i<got.length;i++)diff|=got.charCodeAt(i)^good.charCodeAt(i);
 return diff===0;
}
async function parse(req){
 if(Number(req.headers.get('content-length')||0)>25000)throw Error('Mensagem muito longa.');
 const raw=await req.text();
 if(raw.length>25000)throw Error('Mensagem muito longa.');
 return JSON.parse(raw||'{}');
}
async function log(env,agent,description,mission=null){
 await env.DB.prepare('INSERT INTO activity(agent_id,mission_id,description) VALUES(?,?,?)').bind(agent,mission,String(description).slice(0,350)).run();
}
async function recall(env,content){
 const query=searchTerms(content);if(!query)return [];
 try{
  const r=await env.DB.prepare('SELECT m.id,m.role,m.content,m.created_at FROM messages_fts JOIN messages m ON messages_fts.rowid=m.id WHERE messages_fts MATCH ? ORDER BY m.id DESC LIMIT 10').bind(query).all();
  return r.results||[];
 }catch{return [];}
}
export async function handleAPI(req,env){
 if(!authorized(req,env))return fail(env.MASTER_TOKEN?.length>=24?'A chave de acesso não corresponde ao MASTER_TOKEN configurado na Cloudflare. A chave NVIDIA é diferente da senha deste painel.':'Acesso ainda não configurado: adicione MASTER_TOKEN de pelo menos 24 caracteres nos Secrets do Worker Cloudflare.',401);
 const sessionPath=new URL(req.url).pathname;
 if(sessionPath==='/api/auth/session'&&req.method==='GET')return respond({authenticated:true,cloudflareAI:!!env.AI?.run,storage:!!env.DB});
 if(!env.DB)return fail('Binding do banco DB ausente.',503);
 const url=new URL(req.url),path=url.pathname,method=req.method;
 try{
  await ensureSchema(env.DB);
  if(path==='/api/intake'&&method==='GET'){
   await setupIntakes(env.DB);
   const item=await env.DB.prepare("SELECT id,step FROM project_intakes WHERE status='collecting' ORDER BY created_at DESC LIMIT 1").first();
   return respond({active:!!item,step:item?item.step+1:null,total:5});
  }
  if(path==='/api/state'&&method==='GET'){
   const [a,b,c,d,e,f,g]=await Promise.all([
    env.DB.prepare('SELECT * FROM missions ORDER BY created_at DESC LIMIT 30').all(),
    env.DB.prepare("SELECT agent_id,status,provider,mission_id,output FROM agent_runs WHERE mission_id=(SELECT id FROM missions ORDER BY CASE WHEN status='running' THEN 0 WHEN status='queued' THEN 1 ELSE 2 END,created_at DESC LIMIT 1)").all(),
    env.DB.prepare('SELECT * FROM activity ORDER BY id DESC LIMIT 40').all(),
    env.DB.prepare('SELECT * FROM memories ORDER BY created_at DESC LIMIT 100').all(),
    env.DB.prepare("SELECT value FROM settings WHERE key='provider'").first(),
    env.DB.prepare('SELECT (SELECT COUNT(*) FROM messages) messages,(SELECT COUNT(*) FROM missions) missions,(SELECT COUNT(*) FROM memories) memories').first(),
    env.DB.prepare('SELECT id,project_id,request,status,detail,updated_at FROM code_jobs ORDER BY updated_at DESC LIMIT 12').all()
   ]);
   return respond({missions:a.results||[],runs:b.results||[],activity:c.results||[],memories:d.results||[],provider:e?.value||'auto',counts:f,codeJobs:g.results||[],hasNvidia:!!env.NVIDIA_API_KEY||await hasStoredNvidia(env.DB),hasCloudflare:!!env.AI?.run,agents:AGENTS});
  }
  if(path==='/api/providers'&&method==='GET')return respond({cloudflare:{configured:!!env.AI?.run,model:env.CF_AI_MODEL||'@cf/zai-org/glm-4.7-flash'},nvidia:{configured:!!env.NVIDIA_API_KEY||await hasStoredNvidia(env.DB),model:env.NVIDIA_MODEL||'nvidia/nemotron-3-ultra-550b-a55b'}});
  if(path==='/api/providers/test'&&method==='POST'){
   const data=await parse(req);
   if(!['cloudflare','nvidia'].includes(data.provider))return fail('Escolha Cloudflare ou NVIDIA.');
   try{return respond(await verifyProvider(env,data.provider));}
   catch(e){return fail(String(e.message||e).slice(0,300),503);}
  }
  if(path==='/api/integrations/nvidia'&&method==='POST'){
   const data=await parse(req),key=String(data.key||'').trim();
   if(key.length<20||key.length>512||/[\\s]/.test(key))return fail('A chave NVIDIA deve ter entre 20 e 512 caracteres e não pode conter espaços.');
   try{
    const test=await verifyProvider({...env,DB:null,NVIDIA_API_KEY:key},'nvidia',key);
    await storeNvidia(env,key);
    return respond({connected:true,provider:'nvidia',model:test.model,message:'Chave validada com chamada real e salva de forma cifrada.'});
   }catch(e){return fail('Não foi possível validar a NVIDIA: '+String(e.message||e).slice(0,240),503);}
  }
  if(path==='/api/integrations/nvidia'&&method==='DELETE'){
   await removeNvidia(env);
   return respond({connected:!!env.NVIDIA_API_KEY,externalSecret:!!env.NVIDIA_API_KEY});
  }
  if(path==='/api/profile'&&method==='GET')return respond({profile:await readProfile(env.DB)});
  if(path==='/api/profile'&&method==='PUT'){
   const data=await parse(req);
   return respond({profile:await saveProfile(env.DB,String(data.content||''))});
  }
  if(path==='/api/profile'&&method==='DELETE'){
   const data=await parse(req);
   if(data.confirm!=='APAGAR PERFIL')return fail('Confirme APAGAR PERFIL.');
   await env.DB.prepare('DELETE FROM work_profile WHERE id=1').run();return respond({ok:true});
  }
  if(path==='/api/profile/analyze'&&method==='POST'){
   const previous=await readProfile(env.DB);
   if(previous.updated_at&&previous.updated_at.slice(0,10)===new Date().toISOString().slice(0,10))return fail('Perfil já atualizado hoje. Você pode editar manualmente.',429);
   try{return respond(await generateProfile(env));}
   catch(e){return fail('Não foi possível atualizar perfil: '+String(e.message||e).slice(0,200),503);}
  }
  if(path==='/api/projects'&&method==='GET')return respond({projects:await listProjects(env.DB)});
  if(path==='/api/projects'&&method==='POST'){
   const data=await parse(req);
   try{return respond({project:await createProject(env.DB,data)},201);}
   catch(e){return fail(String(e.message||e),400);}
  }
  if(path==='/api/github/status'&&method==='GET')return respond({connected:await hasGitHub(env.DB)});
  if(path==='/api/github/connect'&&method==='POST'){
   const data=await parse(req),key=String(data.token||'').trim(),repo=String(data.repo||'').trim();
   if(key.length<25||key.length>550)return fail('Token GitHub inválido.');
   try{const check=await verifyGitHub(key,repo);await saveGitHub(env,key);return respond({connected:true,repository:check.repo,branch:check.branch});}
   catch(e){return fail('Falha na conexão GitHub: '+String(e.message||e).slice(0,210),403);}
  }
  if(path==='/api/github/import'&&method==='POST'){
   const key=await readGitHub(env);
   if(!key)return fail('Conecte o GitHub primeiro.',409);
   try{
    const remote=await listGitHubRepos(key),local=await listProjects(env.DB),known=new Set(local.map(x=>x.repo.toLowerCase()));
    let imported=0;
    for(const repo of remote){
     if(known.has(repo.repo.toLowerCase()))continue;
     const project=await createProject(env.DB,{name:repo.name,description:repo.description||'Importado do GitHub.',platform:'other',repo:repo.repo});
     if(repo.archived)await projectStatus(env.DB,project.id,'archived','');
     known.add(repo.repo.toLowerCase());imported++;
     if(imported>=60)break;
    }
    return respond({imported,available:remote.length,projects:await listProjects(env.DB)});
   }catch(e){return fail('Importação GitHub falhou: '+String(e.message||e).slice(0,160),503);}
  }
  if(path==='/api/github/disconnect'&&method==='POST'){
   await env.DB.prepare("DELETE FROM provider_credentials WHERE name='github'").run();
   return respond({connected:false});
  }
  if(path==='/api/ideas'&&method==='GET')return respond({ideas:await listIdeas(env.DB)});
  if(path.startsWith('/api/ideas/')&&method==='PATCH'){
   const id=path.slice('/api/ideas/'.length);if(!safeId(id))return fail('ID inválido');
   const data=await parse(req);
   try{return respond(await updateIdea(env.DB,id,String(data.status||'')));}
   catch(e){return fail(String(e.message||e));}
  }
  const projectRoute=path.match(/^\/api\/projects\/([a-zA-Z0-9_-]+)(?:\/([a-z-]+))?$/);
  if(projectRoute){
   const id=projectRoute[1],action=projectRoute[2]||'',row=await getProject(env.DB,id);
   if(!row)return fail('Projeto não encontrado.',404);
   if(!action&&method==='GET')return respond({project:row});
   if(!action&&method==='PATCH'){
    try{return respond({project:await modifyProject(env.DB,id,await parse(req))});}
    catch(e){return fail(String(e.message||e));}
   }
   if(!action&&method==='DELETE'){
    const data=await parse(req);
    try{return respond({project:await projectStatus(env.DB,id,'trashed',String(data.confirm||'')),remoteUnchanged:true});}
    catch(e){return fail(String(e.message||e));}
   }
   if(action==='status'&&method==='POST'){
    const data=await parse(req);
    try{return respond({project:await projectStatus(env.DB,id,String(data.status||''),String(data.confirm||''))});}
    catch(e){return fail(String(e.message||e));}
   }
   if(action==='permanent'&&method==='DELETE'){
    const data=await parse(req);
    try{return respond(await permanentlyDeleteProject(env.DB,id,String(data.confirm||'')));}
    catch(e){return fail(String(e.message||e));}
   }
   if(action==='deploy'&&method==='PUT'){
    if(row.status==='trashed')return fail('Restaure o projeto antes de editar seus links.',409);
    try{return respond(await saveDeploymentLinks(env.DB,id,await parse(req)));}
    catch(e){return fail(String(e.message||e),400);}
   }
   if(action==='deployments'&&method==='POST'){
    if(!row.repo)return fail('Vincule o GitHub ao projeto antes de sincronizar deployments.',409);
    const token=await readGitHub(env);if(!token)return fail('Conecte o GitHub em Configurações.',409);
    try{
     const result=await syncProjectDeployments(env.DB,token,row);
     return respond({result,project:await getProject(env.DB,id)});
    }catch(e){return fail(String(e.message||e).slice(0,170),503);}
   }
   if(action==='verify'&&method==='POST'){
    if(row.status==='trashed')return fail('Restaure o projeto antes de verificar.',409);
    const body=await parse(req),kind=['production','preview','both'].includes(body.kind)?body.kind:'both';
    const result=await verifyProjectLinks(env.DB,row,kind);
    return respond({result,project:await getProject(env.DB,id)});
   }
   if(action==='ideas'&&method==='POST'){
    if(row.status!=='active')return fail('Ative o projeto antes de gerar ideias.',409);
    const today=await env.DB.prepare("SELECT COUNT(*) n FROM project_events WHERE project_id=? AND action='ideas-generated' AND date(created_at)=date('now')").bind(id).first();
    if(today?.n>=2)return fail('Limite de duas análises por projeto por dia.',429);
    const [prefs,history]=await Promise.all([env.DB.prepare('SELECT content FROM memories ORDER BY created_at DESC LIMIT 40').all(),env.DB.prepare('SELECT role,content FROM messages ORDER BY id DESC LIMIT 30').all()]);
    try{
     const ans=await callAI(env,[{role:'system',content:'Você é um consultor de produto sênior. Proponha no máximo 3 melhorias específicas e viáveis, sem alegar pesquisa ao vivo. Responda SOMENTE um JSON array com objetos {"title":"...","description":"...","reason":"..."}. Considere o estilo de trabalho do usuário, necessidades reais, riscos e custos; não invente funcionalidades já existentes.'},{role:'user',content:'Projeto: '+row.name+'\nDescrição: '+row.description+'\nPlataforma: '+row.platform+'\nMemórias explícitas: '+(prefs.results||[]).map(x=>x.content.slice(0,350)).join(' | ').slice(0,4300)+'\nHistórico: '+(history.results||[]).map(x=>x.role+': '+x.content.slice(0,240)).join('\n').slice(0,5000)}],'auto');
     const ideas=parseIdeas(ans.text),inserted=await saveIdeas(env.DB,id,ideas);
     await auditProject(env.DB,id,'ideas-generated','Sugestões avaliadas: '+inserted);
     return respond({created:inserted,ideas:await listIdeas(env.DB)});
    }catch(e){return fail('Não foi possível analisar o projeto: '+String(e.message||e).slice(0,180),503);}
   }
   if(action==='code'&&method==='POST'){
    if(row.status!=='active'||!row.repo)return fail('Ative o projeto e configure o repositório GitHub.',409);
    if(!(await hasGitHub(env.DB)))return fail('Conecte o GitHub em Configurações.',409);
    if(!env.MISSIONS)return fail('Cloudflare Workflows não configurado.',503);
    const data=await parse(req),request=String(data.request||'').trim().slice(0,4000);
    if(request.length<15)return fail('Descreva a implementação com mais detalhes.');
    const limit=await env.DB.prepare("SELECT COUNT(*) n FROM code_jobs WHERE date(created_at)=date('now')").first();
    if(limit?.n>=3)return fail('Limite de 3 tarefas de código por dia.',429);
    const id=crypto.randomUUID();
    await env.DB.prepare('INSERT INTO code_jobs(id,project_id,request,provider) VALUES(?,?,?,?)').bind(id,row.id,request,normalizeProvider(data.provider||'auto')).run();
    try{await env.MISSIONS.create({id,params:{codeJobId:id}});}
    catch(e){await env.DB.prepare("UPDATE code_jobs SET status='failed',detail=? WHERE id=?").bind(String(e.message||e).slice(0,200),id).run();return fail('Falha ao iniciar Workflow.',503);}
    await auditProject(env.DB,row.id,'code-job','Solicitação de código enviada ao Programador: '+id);
    return respond({id,status:'queued'},201);
   }
   if(action==='jobs'&&method==='GET'){
    const result=await env.DB.prepare('SELECT * FROM code_jobs WHERE project_id=? ORDER BY created_at DESC LIMIT 30').bind(id).all();
    return respond({jobs:result.results||[]});
   }
  }
  if(path==='/api/conversation'&&method==='GET'){
   const limit=Math.min(100,Math.max(1,Number(url.searchParams.get('limit'))||60));
   const before=Math.max(0,Number(url.searchParams.get('before'))||0);
   const statement=before?'SELECT * FROM messages WHERE id<? ORDER BY id DESC LIMIT ?':'SELECT * FROM messages ORDER BY id DESC LIMIT ?';
   const s=env.DB.prepare(statement);
   const r=await (before?s.bind(before,limit):s.bind(limit)).all();
   const records=r.results||[];
   return respond({messages:records.reverse(),olderCursor:records.length===limit?records[0]?.id:null});
  }
  if(path==='/api/search'&&method==='GET')return respond({results:await recall(env,(url.searchParams.get('q')||'').slice(0,120))});
  if(path==='/api/chat'&&method==='POST'){
   const data=await parse(req);const message=String(data.message||'').trim().slice(0,MAX_MESSAGE);
   if(!message)return fail('Escreva sua mensagem.');
   const current=await env.DB.prepare("SELECT value FROM settings WHERE key='provider'").first();
   const provider=normalizeProvider(data.provider||current?.value||'auto');
   await env.DB.prepare("INSERT INTO messages(role,content) VALUES('user',?)").bind(message).run();
   await setupIntakes(env.DB);
   const interview=await handleIntake(env,message,provider);
   if(interview){
    await env.DB.prepare("INSERT INTO messages(role,content,provider) VALUES('assistant',?,'system')").bind(interview.reply).run();
    await log(env,'supervisor',interview.intake?.status==='started'?'Projeto criado após entrevista':'Entrevista de projeto: pergunta em andamento');
    return respond({...interview,provider:null,model:null});
   }
   const match=message.match(/^(?:por favor[,:]?\s*)?(?:lembre(?:-se)?|guarde|memorize|não esqueça)(?:\s+de)?(?:\s+que)?[,\s:]+(.+)/iu);
   const saved=match?.[1]?.trim();
   if(saved&&saved.length>=3){
    await env.DB.prepare('INSERT INTO memories(id,content) VALUES(?,?)').bind(crypto.randomUUID(),saved.slice(0,1200)).run();
    await log(env,'supervisor','Memória permanente solicitada e registrada');
   }
   // Launch real agents for actionable project instructions, not for ordinary conversation.
   if(!saved&&routeWorkIntent(message)){
    const available=await listProjects(env.DB);
    const delegation=await delegateChatWork(env,message,provider,available);
    if(delegation){
     await env.DB.prepare("INSERT INTO messages(role,content,provider) VALUES('assistant',?,'system')").bind(delegation.reply).run();
     return respond({...delegation,provider:null,model:null});
    }
   }
   const [past,pinned,relevant,projects,decisions,profile,verifiedDeployments]=await Promise.all([
    env.DB.prepare('SELECT role,content FROM messages ORDER BY id DESC LIMIT 18').all(),
    env.DB.prepare('SELECT content FROM memories ORDER BY created_at DESC LIMIT 60').all(),
    recall(env,message),
    env.DB.prepare("SELECT name,description,platform,repo FROM projects WHERE status='active' ORDER BY updated_at DESC LIMIT 20").all(),
    env.DB.prepare("SELECT action,description FROM project_events ORDER BY id DESC LIMIT 25").all(),
    readProfile(env.DB),
    env.DB.prepare("SELECT name,deploy_url,deploy_status,deploy_verified_at,preview_url,preview_status,preview_verified_at FROM projects WHERE status='active' AND (deploy_status='online' OR preview_status='online') ORDER BY updated_at DESC LIMIT 15").all()
   ]);
   const context=(pinned.results||[]).map(x=>'- '+x.content.slice(0,600)).join('\n').slice(0,8000);
   const old=relevant.filter(x=>x.content!==message).map(x=>'- '+x.content.slice(0,500)).join('\n').slice(0,5000);

   const portfolio=(projects.results||[]).map(p=>p.name+' ['+p.platform+'] '+p.description.slice(0,320)+' '+p.repo).join('\n').slice(0,5600);
   const activity=(decisions.results||[]).map(d=>d.action+': '+d.description.slice(0,180)).join('\n').slice(0,2700);
   const system='Você é o VINI MASTER, um assistente pessoal amigável, direto e muito inteligente, conversando em português brasileiro natural. Fale como uma pessoa prestativa: frases simples, tom humano, sem linguagem corporativa, sem relatórios automáticos, sem introduções protocolares, sem repetir o pedido e sem blocos de títulos desnecessários. Em conversas normais, priorize uma resposta curta e útil (geralmente 2 a 5 parágrafos breves). Se a pessoa pedir detalhes, código ou uma análise complexa, ofereça a profundidade necessária. Não gere listas de etapas, recomendações ou riscos por padrão, nem rótulos como Resposta:, Conclusão:, Análise:. Evite Markdown excessivo e nunca exponha seu raciocínio interno. Não afirme que alterou GitHub, fez deploy ou executou ferramentas: isso não está habilitado neste estágio. O sistema pode delegar trabalho de verdade aos especialistas por Workflow; nunca diga que não existe delegação automática. Se houver limitações de cota, escopo ou GitHub, explique concretamente. Leve em conta estas memórias (não as repita sem motivo):\n'+context+'\nTrechos úteis de conversas anteriores (use apenas se forem relevantes):\n'+old+'\nProjetos ativos do usuário:\n'+portfolio+'\nDecisões e alterações recentes de projetos:\n'+activity+'\nPerfil de trabalho registrado e editável:\n'+profile.content.slice(0,3400);
   const verifiedSites=verifiedDeployments.results||[];
   const deployRules='\nREGRA OBRIGATÓRIA: Mensagens de chat NÃO criam arquivos, deploys nem sites. Nunca afirme ter feito deploy, publicado, executado código, testado URL, gerado imagens ou criado arquivos nesta conversa. Só informe publicação confirmada se houver evidência na lista abaixo. Não invente domínios ou links, não mostre HTML como <a href>, prefira português simples. Se o usuário pedir um projeto publicado, explique que é necessário um workflow com PR e deployment verificado. Publicações verificadas:\n'+(deploymentContext(verifiedSites)||'Nenhum deploy online validado no cadastro.')+'\nLinks cadastrados porém não verificados NÃO são links online. Não copie claims de outputs anteriores como fatos.';
   const history=(past.results||[]).reverse().map(x=>({role:x.role,content:x.content.slice(0,MAX_MESSAGE)}));
   try{
    const answer=await callAI(env,[{role:'system',content:system+deployRules},...history],provider);
    const safeReply=guardChatDeployment(answer.text,verifiedSites);
    await env.DB.prepare("INSERT INTO messages(role,content,provider) VALUES('assistant',?,?)").bind(safeReply,answer.provider).run();
    await log(env,'supervisor','Respondeu à conversa via '+answer.provider);
    return respond({reply:safeReply,provider:answer.provider,model:answer.model,memorySaved:!!saved});
   }catch(e){return fail(String(e.message||e),503);}
  }
  if(path==='/api/missions'&&method==='POST'){
   const data=await parse(req),description=String(data.description||'').trim().slice(0,MAX_MISSION);
   if(description.length<8)return fail('Descreva melhor a missão.');
   if(!env.MISSIONS)return fail('Workflow não configurado.',503);
   const today=await env.DB.prepare("SELECT COUNT(*) n FROM missions WHERE date(created_at)=date('now')").first();
   const lim=Math.min(20,Math.max(1,Number(env.MAX_DAILY_MISSIONS)||3));
   if(today?.n>=lim)return fail('Limite diário de missões atingido ('+lim+').',429);
   const current=await env.DB.prepare("SELECT value FROM settings WHERE key='provider'").first();
   const provider=normalizeProvider(data.provider||current?.value||'auto');
   const id=crypto.randomUUID(),title=description.split('\n')[0].slice(0,74);
   await env.DB.prepare('INSERT INTO missions(id,title,description,provider) VALUES(?,?,?,?)').bind(id,title,description,provider).run();
   await env.DB.batch(AGENTS.map(a=>env.DB.prepare('INSERT INTO agent_runs(id,mission_id,agent_id) VALUES(?,?,?)').bind(crypto.randomUUID(),id,a.id)));
   try{await env.MISSIONS.create({id,params:{missionId:id}});}
   catch(e){await env.DB.prepare("UPDATE missions SET status='failed',error=? WHERE id=?").bind(String(e.message||e).slice(0,300),id).run();return fail('Não foi possível iniciar o Workflow.',503);}
   await log(env,'supervisor','Nova missão: '+title,id);
   return respond({id,status:'queued'},201);
  }
  if(path.startsWith('/api/missions/')&&method==='GET'){
   const id=path.slice('/api/missions/'.length);if(!safeId(id))return fail('ID inválido');
   const mission=await env.DB.prepare('SELECT * FROM missions WHERE id=?').bind(id).first();
   if(!mission)return fail('Missão não encontrada.',404);
   const r=await env.DB.prepare('SELECT * FROM agent_runs WHERE mission_id=? ORDER BY rowid').bind(id).all();
   return respond({mission,runs:r.results||[]});
  }
  if(path==='/api/settings'&&method==='POST'){
   const data=await parse(req);if(!['auto','cloudflare','nvidia'].includes(data.provider))return fail('Provedor inválido.');
   if(data.provider==='nvidia'&&!env.NVIDIA_API_KEY&&!(await hasStoredNvidia(env.DB)))return fail('Conecte sua chave NVIDIA em Configurações antes de selecionar este modo.',409);
   await env.DB.prepare("INSERT INTO settings(key,value) VALUES('provider',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").bind(data.provider).run();
   return respond({provider:data.provider});
  }
  if(path==='/api/memory'&&method==='POST'){
   const data=await parse(req),value=String(data.content||'').trim().slice(0,1200);
   if(!value)return fail('A memória está vazia.');
   const id=crypto.randomUUID();await env.DB.prepare('INSERT INTO memories(id,content) VALUES(?,?)').bind(id,value).run();
   await log(env,'supervisor','Memória importante adicionada');
   return respond({id,content:value},201);
  }
  if(path.startsWith('/api/memory/')&&method==='DELETE'){
   const id=path.slice('/api/memory/'.length);if(!safeId(id))return fail('ID inválido');
   await env.DB.prepare('DELETE FROM memories WHERE id=?').bind(id).run();return respond({ok:true});
  }
  if(path==='/api/export'&&method==='GET'){
   const [a,b,c]=await Promise.all([env.DB.prepare('SELECT * FROM messages ORDER BY id').all(),env.DB.prepare('SELECT * FROM memories').all(),env.DB.prepare('SELECT * FROM missions').all()]);
   return respond({exportedAt:new Date().toISOString(),messages:a.results,memories:b.results,missions:c.results});
  }
  if(path==='/api/conversation'&&method==='DELETE'){
   const d=await parse(req);if(d.confirm!=='APAGAR')return fail('Confirmação incorreta.');
   await env.DB.prepare('DELETE FROM messages').run();return respond({ok:true});
  }
  return fail('Rota não encontrada.',404);
 }catch(err){console.error('api '+path+': '+String(err.message||err).slice(0,150));return fail('Operação falhou. Verifique as configurações.',500);}
}
