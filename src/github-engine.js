import {callAI} from './ai.js';
const enc=new TextEncoder(), b64=a=>btoa(Array.from(a,x=>String.fromCharCode(x)).join('')), bytes=s=>Uint8Array.from(atob(s),x=>x.charCodeAt(0));
async function derive(master,salt){const k=await crypto.subtle.importKey('raw',enc.encode(master),'HKDF',false,['deriveKey']);return crypto.subtle.deriveKey({name:'HKDF',hash:'SHA-256',salt,info:enc.encode('vini-github-v1')},k,{name:'AES-GCM',length:256},false,['encrypt','decrypt']);}
export async function saveGitHub(env,value){const salt=crypto.getRandomValues(new Uint8Array(16)),iv=crypto.getRandomValues(new Uint8Array(12));const raw=await crypto.subtle.encrypt({name:'AES-GCM',iv},await derive(env.MASTER_TOKEN,salt),enc.encode(value));await env.DB.prepare("INSERT INTO provider_credentials(name,salt,iv,ciphertext) VALUES('github',?,?,?) ON CONFLICT(name) DO UPDATE SET salt=excluded.salt,iv=excluded.iv,ciphertext=excluded.ciphertext").bind(b64(salt),b64(iv),b64(new Uint8Array(raw))).run();}
export async function readGitHub(env){const row=await env.DB.prepare("SELECT salt,iv,ciphertext FROM provider_credentials WHERE name='github'").first();if(!row)return null;try{const raw=await crypto.subtle.decrypt({name:'AES-GCM',iv:bytes(row.iv)},await derive(env.MASTER_TOKEN,bytes(row.salt)),bytes(row.ciphertext));return new TextDecoder().decode(raw);}catch{throw Error('Reconecte a chave do GitHub após alterar a senha Master.');}}
export async function hasGitHub(db){return !!(await db.prepare("SELECT name FROM provider_credentials WHERE name='github'").first());}
export function validRepo(x){return /^[\w.-]{1,80}\/[\w.-]{1,100}$/.test(x||'')&&!x.includes('..');}
export async function gh(token,repo,method,path,data){if(!validRepo(repo))throw Error('Nome de repositório inválido.');const r=await fetch('https://api.github.com/repos/'+repo+path,{method,headers:{Authorization:'Bearer '+token,Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28','User-Agent':'Vini-Master-AI','Content-Type':'application/json'},body:data===undefined?undefined:JSON.stringify(data)});let v={};try{v=await r.json();}catch{}if(!r.ok)throw Error('GitHub '+r.status+': '+String(v.message||'Falha de acesso').slice(0,120));return v;}
export async function verifyGitHub(token,repo){const info=await gh(token,repo,'GET','');if(!info.permissions?.push||info.archived)throw Error('Sem permissão de escrita ou repositório arquivado.');return {repo:info.full_name,branch:info.default_branch};}
export function safeFile(x){return typeof x==='string'&&x.length<155&&!x.includes('..')&&!x.includes('//')&&/^(?:public|src|app|pages|components|styles|tests|assets)\/[\w./-]+\.(?:html|css|js|jsx|ts|tsx|json|md|svg)$/.test(x)&&!/(?:^|\/)(?:auth|secrets?|credentials|config|wrangler|package(?:-lock)?|migrations?|worker|middleware|\.)/i.test(x);}
export function parseCode(text){let obj;try{obj=JSON.parse(String(text).trim());}catch{const m=String(text).match(/\{[\s\S]*\}/);if(!m)throw Error('Resposta da IA não contém arquivos em JSON.');try{obj=JSON.parse(m[0]);}catch{throw Error('JSON de código inválido.');}}if(!Array.isArray(obj.files)||obj.files.length<1||obj.files.length>3)throw Error('Máximo 3 arquivos por missão.');let size=0;const paths=new Set();const files=obj.files.map(f=>{if(!safeFile(f.path)||typeof f.content!=='string'||!f.content||f.content.length>9000||paths.has(f.path))throw Error('Arquivo fora do escopo permitido.');if(/-----BEGIN .*PRIVATE KEY-----|github_pat_|ghp_[A-Za-z0-9]{20,}/.test(f.content))throw Error('Credencial identificada no código.');paths.add(f.path);size+=f.content.length;return {path:f.path,content:f.content};});if(size>20000)throw Error('Código muito extenso.');return {summary:String(obj.summary||'Melhoria proposta').slice(0,130),files};}
export function codeReview(obj){const errors=[];for(const f of obj.files){if(f.path.endsWith('.json'))try{JSON.parse(f.content);}catch{errors.push('JSON inválido: '+f.path);}if(/\beval\s*\(|new Function\s*\(/.test(f.content))errors.push('Código dinâmico: '+f.path);}return {passed:!errors.length,errors};}
export async function createDraftPR(token,repo,id,request,code){const info=await verifyGitHub(token,repo),base=await gh(token,repo,'GET','/branches/'+encodeURIComponent(info.branch)),sha=base.commit.sha,commit=await gh(token,repo,'GET','/git/commits/'+sha),branch='vini/task-'+id.replace(/-/g,'').slice(0,14);
 await gh(token,repo,'POST','/git/refs',{ref:'refs/heads/'+branch,sha});
 const tree=await gh(token,repo,'POST','/git/trees',{base_tree:commit.tree.sha,tree:code.files.map(f=>({path:f.path,mode:'100644',type:'blob',content:f.content}))});
 const output=await gh(token,repo,'POST','/git/commits',{message:'feat(vini): '+code.summary,tree:tree.sha,parents:[sha]});
 await gh(token,repo,'PATCH','/git/refs/heads/'+branch,{sha:output.sha,force:false});
 const desc='## Pedido\n'+request.slice(0,1700)+'\n\n## Arquivos\n'+code.files.map(f=>f.path).join(', ')+'\n\nApenas checagem estática. Build, testes de execução e deploy ainda NÃO realizados. Revisão necessária.';
 const pr=await gh(token,repo,'POST','/pulls',{title:'VINI: '+code.summary,head:branch,base:info.branch,body:desc,draft:true});
 return {url:pr.html_url,number:pr.number,branch,files:code.files.map(f=>f.path)};
}
export async function codeMission(env,jobId,step){
 const job=await env.DB.prepare('SELECT j.*,p.repo,p.name FROM code_jobs j JOIN projects p ON p.id=j.project_id WHERE j.id=?').bind(jobId).first();
 if(!job)return {status:'failed',reason:'Job inexistente'};
 const visual=/\b(?:interface|layout|visual|ui|ux|tela|css|mobile|responsiv|anima[cç][aã]o|avatar)\b/iu.test(job.request);
 const team=visual?['supervisor','programador','designer','qa']:['supervisor','programador','qa'];
 const update=async(status,detail,result='')=>{
  await env.DB.prepare('UPDATE code_jobs SET status=?,detail=?,result=?,updated_at=CURRENT_TIMESTAMP WHERE id=?').bind(status,detail,typeof result==='string'?result:JSON.stringify(result),jobId).run();
  await env.DB.prepare('INSERT INTO activity(agent_id,mission_id,description) VALUES(?,?,?)').bind(status==='done'?'supervisor':'programador',null,(status==='working'?'Trabalhando: ':status==='done'?'Concluído: ':'Falha: ')+detail.slice(0,250)).run();
 };
 const progress=async(agent,status,detail,output='')=>{
  await env.DB.prepare("UPDATE code_agent_runs SET status=?,detail=?,output=?,started_at=CASE WHEN ?='working' AND started_at IS NULL THEN CURRENT_TIMESTAMP ELSE started_at END,finished_at=CASE WHEN ? IN ('done','failed') THEN CURRENT_TIMESTAMP ELSE finished_at END WHERE code_job_id=? AND agent_id=?")
   .bind(status,detail.slice(0,400),String(output||'').slice(0,6000),status,status,jobId,agent).run();
  await env.DB.prepare('INSERT INTO activity(agent_id,description) VALUES(?,?)').bind(agent,detail.slice(0,200)).run();
 };
 try{
  await step.do('Preparar equipe de código',async()=>{
   for(const agent of team)await env.DB.prepare("INSERT OR IGNORE INTO code_agent_runs(id,code_job_id,agent_id,status) VALUES(?,?,?,'queued')").bind(crypto.randomUUID(),jobId,agent).run();
   await progress('supervisor','working','Organizando implementação do projeto '+job.name);
   await update('working','Equipe de código atribuída. Conferindo repositório GitHub.');
  });
  const info=await step.do('Verificar GitHub',async()=>{
   const key=await readGitHub(env);
   if(!key)throw Error('GitHub não conectado.');
   return verifyGitHub(key,job.repo);
  });
  await step.do('Delegar ao Programador',async()=>{
   await progress('supervisor','done','Escopo autorizado e repositório identificado: '+info.repo);
   await progress('programador','working','Gerando arquivos para '+job.name);
   await update('working','Programador produzindo arquivos reais');
  });
  const generated=await step.do('Gerar arquivos',async()=>{
   return callAI(env,[
    {role:'system',content:'Você é programador sênior. Responda SOMENTE JSON válido: {"summary":"resumo","files":[{"path":"public/pagina.html","content":"código integral"}]}. Até 3 arquivos, até 20 mil caracteres. Somente pastas src,public,app,pages,components,styles,tests,assets. Nunca alterar auth, secrets, infraestrutura, dependências ou configurações. Construa UI mobile responsiva, não diga que executou testes.'},
    {role:'user',content:'Projeto '+job.name+'. Pedido: '+job.request.slice(0,3600)+'. Repositório '+info.repo}
   ],job.provider||'auto');
  });
  const code=parseCode(generated.text);
  await step.do('Preparar revisão QA',async()=>{
   await progress('programador','done','Arquivos gerados: '+code.files.map(f=>f.path).join(', '));
   await progress('qa','working','Realizando análise estática de segurança e formato dos arquivos');
  });
  const qa=await step.do('QA revisão estática',async()=>{
   const review=codeReview(code);
   await progress('qa',review.passed?'done':'failed',review.passed?'Análise estática aprovada (testes de execução não realizados)':'Problemas encontrados: '+review.errors.join('; '),JSON.stringify(review));
   return review;
  });
  if(!qa.passed)throw Error('QA bloqueou PR: '+qa.errors.join(', '));
  if(visual){
   await step.do('Designer verifica interface',async()=>{await progress('designer','working','Revisando responsividade e experiência visual dos arquivos gerados');});
   await step.do('Designer revisão visual',async()=>{
    try{
     const answer=await callAI(env,[
      {role:'system',content:'Você é designer de produto. Analise os arquivos textuais disponibilizados. Aponte no máximo três melhorias concretas de responsividade e UX, mas não alegue screenshots, execução em navegador ou aprovação visual automatizada.'},
      {role:'user',content:'Pedido: '+job.request.slice(0,1800)+'\nArquivos (trechos):\n'+code.files.map(f=>f.path+'\n'+f.content.slice(0,2200)).join('\n').slice(0,6500)}
     ],job.provider||'auto');
     await progress('designer','done','Parecer textual de interface concluído (sem renderização real)',answer.text);
    }catch(e){await progress('designer','failed','Não foi possível realizar revisão textual de interface: '+String(e.message||e).slice(0,140));}
   });
  }
  await step.do('Programador prepara pull request',async()=>{
   await progress('programador','working','Preparando branch e PR rascunho com arquivos gerados');
   await update('working','Abrindo PR rascunho para revisão humana');
  });
  const pr=await step.do('Criar PR rascunho',async()=>{
   const key=await readGitHub(env);return createDraftPR(key,job.repo,jobId,job.request,code);
  });
  await step.do('Registrar entrega e status final',async()=>{
   await progress('programador','done','PR rascunho aberto: #'+pr.number,pr.url);
   await progress('supervisor','done','Equipe concluiu PR rascunho. Ainda sem merge, testes de execução ou deploy.',pr.url);
   await update('done','PR pronto para revisão (sem deploy)',pr);
   await env.DB.prepare('INSERT INTO project_events(project_id,action,description) VALUES(?,?,?)').bind(job.project_id,'draft-pr',pr.url).run();
  });
  return {status:'done',pr};
 }catch(e){
  const reason=String(e.message||e).slice(0,550);
  try{
   await env.DB.prepare("UPDATE code_agent_runs SET status='failed',detail=?,finished_at=CURRENT_TIMESTAMP WHERE code_job_id=? AND status IN ('working','queued')").bind('Execução interrompida: '+reason,jobId).run();
   await update('failed',reason);
  }catch{}
  return {status:'failed',reason};
 }
}

export async function listGitHubRepos(token){
 const response=await fetch('https://api.github.com/user/repos?affiliation=owner&per_page=100&sort=updated',{headers:{Authorization:'Bearer '+token,Accept:'application/vnd.github+json','User-Agent':'Vini-Master-AI','X-GitHub-Api-Version':'2022-11-28'}});
 let data;try{data=await response.json();}catch{data={};}
 if(!response.ok||!Array.isArray(data))throw Error('GitHub não autorizou listar os repositórios: '+response.status);
 return data.filter(x=>validRepo(x.full_name)&&x.owner?.login).slice(0,100).map(x=>({name:String(x.name).slice(0,90),repo:x.full_name,description:String(x.description||'').slice(0,4000),archived:!!x.archived,private:!!x.private}));
}
