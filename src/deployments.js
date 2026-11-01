export function cleanDeployUrl(value){
 const v=String(value||'').trim();
 if(!v)return '';
 if(v.length>700)throw Error('Endereço muito longo.');
 const url=new URL(v);
 if(url.protocol!=='https:'||url.username||url.password||url.port||!url.hostname.includes('.')||/^(localhost|[\d.]+)$/i.test(url.hostname)||/\.(?:local|internal|localhost)$/i.test(url.hostname))throw Error('Use uma URL pública HTTPS, sem senha nem porta.');
 url.hash='';return url.toString();
}
export async function setupDeployments(db){
 const info=await db.prepare('PRAGMA table_info(projects)').all();
 const columns=new Set((info.results||[]).map(r=>r.name));
 for(const field of ['deploy_url','deploy_source','deploy_updated_at','preview_url','preview_source','preview_updated_at']){
  if(!columns.has(field)){
   try{await db.prepare('ALTER TABLE projects ADD COLUMN '+field+' TEXT').run();}
   catch(e){if(!/duplicate column/i.test(String(e.message||e)))throw e;}
  }
 }
}
export async function saveDeploymentLinks(db,id,body){
 const deploy=cleanDeployUrl(body.deployUrl),preview=cleanDeployUrl(body.previewUrl);
 await db.prepare("UPDATE projects SET deploy_url=?,deploy_source=?,deploy_updated_at=CURRENT_TIMESTAMP,preview_url=?,preview_source=?,preview_updated_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE id=?")
  .bind(deploy,deploy?'manual':null,preview,preview?'manual':null,id).run();
 return {deployUrl:deploy,previewUrl:preview,source:'manual',reachabilityTested:false};
}
async function ghList(token,repo,path){
 const res=await fetch('https://api.github.com/repos/'+repo+path,{headers:{Authorization:'Bearer '+token,Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28','User-Agent':'Vini-Master-AI'}});
 if(!res.ok){if([401,403].includes(res.status))throw Error('Autorize Deployments: Read-only no token fine-grained do GitHub para descobrir os links automaticamente.');throw Error('GitHub deployments HTTP '+res.status);}
 const data=await res.json();return Array.isArray(data)?data:[];
}
export async function discoverDeployments(token,repo){
 if(!/^[\w.-]{1,80}\/[\w.-]{1,100}$/.test(repo)||repo.includes('..'))throw Error('Repositório inválido.');
 const records=await ghList(token,repo,'/deployments?per_page=12');
 const result={production:'',preview:'',checkedAt:new Date().toISOString()};
 for(const item of records){
  if(!Number.isInteger(item.id))continue;
  const statuses=await ghList(token,repo,'/deployments/'+item.id+'/statuses?per_page=8');
  const success=statuses.find(s=>s.state==='success');
  if(!success)continue;
  let url;try{url=cleanDeployUrl(success.environment_url||'');}catch{continue;}
  if(!url)continue;
  const preview=/preview|staging|test|development|pr-/i.test(String(item.environment||''));
  if(preview&&!result.preview)result.preview=url;
  if(!preview&&!result.production)result.production=url;
  if(result.production&&result.preview)break;
 }
 return result;
}
export async function syncProjectDeployments(db,token,project){
 const remote=await discoverDeployments(token,project.repo);
 if(remote.production&&(!project.deploy_url||project.deploy_source==='github')){
  await db.prepare("UPDATE projects SET deploy_url=?,deploy_source='github',deploy_updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(remote.production,project.id).run();
 }
 if(remote.preview&&(!project.preview_url||project.preview_source==='github')){
  await db.prepare("UPDATE projects SET preview_url=?,preview_source='github',preview_updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(remote.preview,project.id).run();
 }
 return {found:!!(remote.production||remote.preview),production:remote.production||null,preview:remote.preview||null,checkedAt:remote.checkedAt,reachabilityTested:false};
}
