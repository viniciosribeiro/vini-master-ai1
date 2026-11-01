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
  if(path==='/api/state'&&method==='GET'){
   const [a,b,c,d,e,f]=await Promise.all([
    env.DB.prepare('SELECT * FROM missions ORDER BY created_at DESC LIMIT 30').all(),
    env.DB.prepare('SELECT agent_id,status,provider,mission_id,output FROM agent_runs WHERE mission_id=(SELECT id FROM missions ORDER BY created_at DESC LIMIT 1)').all(),
    env.DB.prepare('SELECT * FROM activity ORDER BY id DESC LIMIT 40').all(),
    env.DB.prepare('SELECT * FROM memories ORDER BY created_at DESC LIMIT 100').all(),
    env.DB.prepare("SELECT value FROM settings WHERE key='provider'").first(),
    env.DB.prepare('SELECT (SELECT COUNT(*) FROM messages) messages,(SELECT COUNT(*) FROM missions) missions,(SELECT COUNT(*) FROM memories) memories').first()
   ]);
   return respond({missions:a.results||[],runs:b.results||[],activity:c.results||[],memories:d.results||[],provider:e?.value||'auto',counts:f,hasNvidia:!!env.NVIDIA_API_KEY||await hasStoredNvidia(env.DB),hasCloudflare:!!env.AI?.run,agents:AGENTS});
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
   const match=message.match(/^(?:por favor[,:]?\s*)?(?:lembre(?:-se)?|guarde|memorize|não esqueça)(?:\s+de)?(?:\s+que)?[,\s:]+(.+)/iu);
   const saved=match?.[1]?.trim();
   if(saved&&saved.length>=3){
    await env.DB.prepare('INSERT INTO memories(id,content) VALUES(?,?)').bind(crypto.randomUUID(),saved.slice(0,1200)).run();
    await log(env,'supervisor','Memória permanente solicitada e registrada');
   }
   const [past,pinned,relevant]=await Promise.all([
    env.DB.prepare('SELECT role,content FROM messages ORDER BY id DESC LIMIT 18').all(),
    env.DB.prepare('SELECT content FROM memories ORDER BY created_at DESC LIMIT 60').all(),
    recall(env,message)
   ]);
   const context=(pinned.results||[]).map(x=>'- '+x.content.slice(0,600)).join('\n').slice(0,8000);
   const old=relevant.filter(x=>x.content!==message).map(x=>'- '+x.content.slice(0,500)).join('\n').slice(0,5000);
   const system='Você é o VINI MASTER AI. Responda em português com clareza. Você não pode editar GitHub ou fazer deploy neste estágio. Nunca invente execuções. Para delegar uma análise à equipe, indique Nova missão. Memórias importantes:\n'+context+'\nHistórico relevante:\n'+old;
   const history=(past.results||[]).reverse().map(x=>({role:x.role,content:x.content.slice(0,MAX_MESSAGE)}));
   try{
    const answer=await callAI(env,[{role:'system',content:system},...history],provider);
    await env.DB.prepare("INSERT INTO messages(role,content,provider) VALUES('assistant',?,?)").bind(answer.text,answer.provider).run();
    await log(env,'supervisor','Respondeu à conversa via '+answer.provider);
    return respond({reply:answer.text,provider:answer.provider,model:answer.model,memorySaved:!!saved});
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
