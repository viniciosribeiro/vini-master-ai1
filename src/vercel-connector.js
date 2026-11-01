// Vercel real execution connector. Token is kept encrypted in D1, never rendered to the client.
const enc=new TextEncoder();
const b64=v=>btoa(Array.from(v,x=>String.fromCharCode(x)).join(''));
const un64=x=>Uint8Array.from(atob(x),c=>c.charCodeAt(0));
async function derive(master,salt){
 const root=await crypto.subtle.importKey('raw',enc.encode(master),'HKDF',false,['deriveKey']);
 return crypto.subtle.deriveKey({name:'HKDF',hash:'SHA-256',salt,info:enc.encode('vini-vercel-connector-v1')},root,{name:'AES-GCM',length:256},false,['encrypt','decrypt']);
}
export async function saveVercelToken(env,token){
 const salt=crypto.getRandomValues(new Uint8Array(16)),iv=crypto.getRandomValues(new Uint8Array(12));
 const raw=await crypto.subtle.encrypt({name:'AES-GCM',iv},await derive(env.MASTER_TOKEN,salt),enc.encode(token));
 await env.DB.prepare("INSERT INTO provider_credentials(name,salt,iv,ciphertext) VALUES('vercel',?,?,?) ON CONFLICT(name) DO UPDATE SET salt=excluded.salt,iv=excluded.iv,ciphertext=excluded.ciphertext,created_at=CURRENT_TIMESTAMP")
 .bind(b64(salt),b64(iv),b64(new Uint8Array(raw))).run();
}
export async function readVercelToken(env){
 const row=await env.DB.prepare("SELECT salt,iv,ciphertext FROM provider_credentials WHERE name='vercel'").first();
 if(!row)return null;
 try{const raw=await crypto.subtle.decrypt({name:'AES-GCM',iv:un64(row.iv)},await derive(env.MASTER_TOKEN,un64(row.salt)),un64(row.ciphertext));return new TextDecoder().decode(raw);}
 catch{throw Error('Reconecte a Vercel nas Configurações (o segredo Master pode ter mudado).');}
}
export async function disconnectVercel(env){await env.DB.prepare("DELETE FROM provider_credentials WHERE name='vercel'").run();}
export async function vercelRequest(token,endpoint,{method='GET',body,teamId,fetcher=fetch}={}){
 if(!/^\/(?:v\d+\/(?:user|projects|deployments)(?:\/[a-zA-Z0-9_-]+)?|v\d+\/deployments)(?:\?.*)?$/.test(endpoint))throw Error('Endpoint Vercel não permitido');
 const url=new URL('https://api.vercel.com'+endpoint);
 if(teamId){if(!/^team_[A-Za-z0-9]{8,80}$/.test(teamId))throw Error('Team ID Vercel inválido');url.searchParams.set('teamId',teamId);}
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),12000);
 try{
  const response=await fetcher(url.href,{method,signal:controller.signal,redirect:'error',headers:{Authorization:'Bearer '+token,Accept:'application/json',...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined});
  let data={};try{data=await response.json();}catch{}
  if(!response.ok)throw Error('Vercel HTTP '+response.status+': '+String(data.error?.message||data.message||'Não autorizado').slice(0,150));
  return data;
 }catch(e){if(e.name==='AbortError')throw Error('Vercel não respondeu em 12 segundos');throw e;}finally{clearTimeout(timer);}
}
export async function testVercelToken(token,teamId,fetcher=fetch){
 const info=await vercelRequest(token,'/v2/user',{fetcher});
 const projects=await vercelRequest(token,'/v9/projects?limit=20',{teamId,fetcher});
 return {account:info.user?.username||info.user?.email||'Vercel',projects:Array.isArray(projects.projects)?projects.projects.length:0};
}
export async function getVercelProjects(env,teamId,fetcher=fetch){
 const token=await readVercelToken(env);if(!token)throw Error('Conecte a Vercel nas Configurações');
 const data=await vercelRequest(token,'/v9/projects?limit=100',{teamId,fetcher});
 return (data.projects||[]).map(p=>({id:p.id,name:p.name,framework:p.framework||'',repo:p.link?.repo||null})).filter(p=>/^prj_[A-Za-z0-9]{8,80}$/.test(p.id));
}
export async function getVercelDeployments(env,projectId,teamId,fetcher=fetch){
 if(!/^prj_[A-Za-z0-9]{8,80}$/.test(projectId||''))throw Error('Projeto Vercel inválido');
 const token=await readVercelToken(env);if(!token)throw Error('Vercel não conectada');
 const data=await vercelRequest(token,'/v6/deployments?projectId='+encodeURIComponent(projectId)+'&limit=12',{teamId,fetcher});
 return (data.deployments||[]).map(d=>({id:d.uid||d.id,projectId:d.projectId||projectId,name:d.name||'',url:d.url||'',readyState:d.readyState||d.state||'',target:d.target||'preview',created:d.created||0})).filter(d=>/^dpl_[A-Za-z0-9]{8,80}$/.test(d.id));
}
export async function initiatePreviewRedeploy(env,projectId,deploymentId,teamId,fetcher=fetch){
 const projects=await getVercelProjects(env,teamId,fetcher);
 const project=projects.find(p=>p.id===projectId);if(!project)throw Error('Projeto não pertence à conta Vercel conectada');
 const deployments=await getVercelDeployments(env,projectId,teamId,fetcher);
 const source=deployments.find(d=>d.id===deploymentId&&d.projectId===projectId);
 if(!source)throw Error('Deployment de origem não encontrado neste projeto');
 const token=await readVercelToken(env);
 // Vercel deployment API: omit target to request a preview; NEVER pass production here.
 const data=await vercelRequest(token,'/v13/deployments',{method:'POST',teamId,fetcher,body:{name:project.name,project:projectId,deploymentId:source.id}});
 if(!/^dpl_[A-Za-z0-9]{8,80}$/.test(data.id||''))throw Error('A Vercel não devolveu um identificador de deployment válido; confira o painel.');
 if(data.target==='production')throw Error('A Vercel retornou destino produção inesperadamente: confira o deployment no painel antes de continuar.');
 return {id:data.id,projectId,name:project.name,url:data.url||'',status:data.readyState||data.status||'QUEUED',target:'preview',sourceDeploymentId:source.id};
}
export async function vercelDeploymentStatus(env,id,teamId,fetcher=fetch){
 if(!/^dpl_[A-Za-z0-9]{8,80}$/.test(id||''))throw Error('ID de deployment inválido');
 const token=await readVercelToken(env);if(!token)throw Error('Vercel não conectada');
 const data=await vercelRequest(token,'/v13/deployments/'+id,{teamId,fetcher});
 return {id:data.id||id,status:data.readyState||data.status||'UNKNOWN',url:data.url||'',target:data.target||'preview',createdAt:data.createdAt||null,readyAt:data.ready||null};
}
