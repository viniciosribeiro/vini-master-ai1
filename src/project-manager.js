const PLATFORM=new Set(['cloudflare','vercel','other']);
const STATUS=new Set(['active','archived','trashed']);
export function validRepo(value){return value===''||/^[a-zA-Z0-9_.-]{1,80}\/[a-zA-Z0-9_.-]{1,100}$/.test(value)&&!value.includes('..');}
export function safeProjectInput(body){
 const name=String(body.name||'').trim(),description=String(body.description||'').trim();
 const platform=String(body.platform||'cloudflare').toLowerCase();
 const repo=String(body.repo||'').trim();
 if(name.length<2||name.length>90)throw Error('Nome do projeto deve ter entre 2 e 90 caracteres.');
 if(description.length>4000)throw Error('Descrição muito longa.');
 if(!PLATFORM.has(platform))throw Error('Escolha Cloudflare, Vercel ou Outro.');
 if(!validRepo(repo))throw Error('Repositório deve ser dono/nome.');
 return {name,description,platform,repo};
}
export async function initializeProjects(db){
 const statements=[
  "CREATE TABLE IF NOT EXISTS projects (id TEXT PRIMARY KEY,name TEXT NOT NULL,description TEXT NOT NULL DEFAULT '',platform TEXT NOT NULL DEFAULT 'cloudflare',repo TEXT NOT NULL DEFAULT '',status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','archived','trashed')),created_at TEXT DEFAULT CURRENT_TIMESTAMP,updated_at TEXT DEFAULT CURRENT_TIMESTAMP)",
  "CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status,updated_at)",
  "CREATE TABLE IF NOT EXISTS project_events (id INTEGER PRIMARY KEY AUTOINCREMENT,project_id TEXT NOT NULL,action TEXT NOT NULL,description TEXT NOT NULL,created_at TEXT DEFAULT CURRENT_TIMESTAMP)",
  "CREATE TABLE IF NOT EXISTS project_ideas (id TEXT PRIMARY KEY,project_id TEXT NOT NULL,title TEXT NOT NULL,description TEXT NOT NULL,reason TEXT NOT NULL DEFAULT '',status TEXT NOT NULL DEFAULT 'new' CHECK(status IN ('new','dismissed','accepted')),created_at TEXT DEFAULT CURRENT_TIMESTAMP)"
 ];
 for(const sql of statements)await db.prepare(sql).run();
}
export async function auditProject(db,id,action,description){
 await db.prepare('INSERT INTO project_events(project_id,action,description) VALUES(?,?,?)').bind(id,action,String(description||'').slice(0,360)).run();
}
export async function createProject(db,data){
 const a=safeProjectInput(data);const id=crypto.randomUUID();
 await db.prepare('INSERT INTO projects(id,name,description,platform,repo) VALUES(?,?,?,?,?)').bind(id,a.name,a.description,a.platform,a.repo).run();
 await auditProject(db,id,'created',a.name);
 return {id,...a,status:'active'};
}
export async function getProject(db,id){
 return db.prepare('SELECT * FROM projects WHERE id=?').bind(id).first();
}
export async function listProjects(db){
 const rows=await db.prepare("SELECT * FROM projects ORDER BY CASE status WHEN 'active' THEN 0 WHEN 'archived' THEN 1 ELSE 2 END,updated_at DESC LIMIT 250").all();
 return rows.results||[];
}
export async function modifyProject(db,id,body){
 const row=await getProject(db,id);if(!row)throw Error('Projeto não encontrado.');
 const name=body.name===undefined?row.name:String(body.name).trim();
 const description=body.description===undefined?row.description:String(body.description).trim();
 const platform=body.platform===undefined?row.platform:String(body.platform);
 const repo=body.repo===undefined?row.repo:String(body.repo).trim();
 const changed=safeProjectInput({name,description,platform,repo});
 // Renomear aqui altera o nome exibido no painel; nao altera o repositorio remoto.
 if(row.status==='trashed')throw Error('Restaure o projeto antes de editá-lo.');
 await db.prepare("UPDATE projects SET name=?,description=?,platform=?,repo=?,updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(changed.name,changed.description,changed.platform,changed.repo,id).run();
 await auditProject(db,id,'updated',row.name===changed.name?'Detalhes alterados':'Renomeado: '+row.name+' → '+changed.name);
 return getProject(db,id);
}
export async function projectStatus(db,id,status,confirmation){
 if(!STATUS.has(status))throw Error('Status inválido.');
 const row=await getProject(db,id);if(!row)throw Error('Projeto não encontrado.');
 if(status==='trashed'&&confirmation!==row.name)throw Error('Para excluir, digite exatamente o nome do projeto.');
 if(status==='active'&&row.status==='active')return row;
 await db.prepare("UPDATE projects SET status=?,updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(status,id).run();
 await auditProject(db,id,status,status==='trashed'?'Enviado à lixeira (recuperável).':status==='archived'?'Arquivado.':'Restaurado.');
 return getProject(db,id);
}
export async function permanentlyDeleteProject(db,id,confirmation){
 const row=await getProject(db,id);
 if(!row)throw Error('Projeto não encontrado.');
 if(row.status!=='trashed')throw Error('Primeiro envie o projeto para a lixeira.');
 if(confirmation!=='EXCLUIR '+row.name)throw Error('A confirmação deve ser EXCLUIR seguida do nome do projeto.');
 await db.prepare('DELETE FROM project_ideas WHERE project_id=?').bind(id).run();
 await auditProject(db,id,'permanent-delete','Registro excluído definitivamente do painel');
 await db.prepare('DELETE FROM projects WHERE id=?').bind(id).run();
 return {ok:true,remoteGitHubUnchanged:true};
}
export async function listIdeas(db){
 const r=await db.prepare("SELECT i.*,p.name project_name FROM project_ideas i JOIN projects p ON p.id=i.project_id WHERE p.status<>'trashed' ORDER BY i.created_at DESC LIMIT 120").all();
 return r.results||[];
}
export async function updateIdea(db,id,status){
 if(!['new','dismissed','accepted'].includes(status))throw Error('Status da ideia inválido.');
 await db.prepare('UPDATE project_ideas SET status=? WHERE id=?').bind(status,id).run();
 return {ok:true,status};
}
export function parseIdeas(text){
 let data;try{
  const m=String(text||'').match(/\[[\s\S]*\]/);data=JSON.parse(m?m[0]:'[]');
 }catch{return [];}
 if(!Array.isArray(data))return [];
 return data.slice(0,3).map(x=>({
  title:String(x.title||'').trim().slice(0,110),
  description:String(x.description||'').trim().slice(0,700),
  reason:String(x.reason||'').trim().slice(0,350)
 })).filter(x=>x.title.length>4&&x.description.length>15);
}
export async function saveIdeas(db,projectId,ideas){
 let count=0;
 const old=await db.prepare('SELECT title FROM project_ideas WHERE project_id=?').bind(projectId).all();
 const seen=new Set((old.results||[]).map(x=>x.title.toLocaleLowerCase('pt-BR')));
 for(const idea of ideas){
  if(seen.has(idea.title.toLocaleLowerCase('pt-BR')))continue;
  await db.prepare('INSERT INTO project_ideas(id,project_id,title,description,reason) VALUES(?,?,?,?,?)').bind(crypto.randomUUID(),projectId,idea.title,idea.description,idea.reason).run();
  seen.add(idea.title.toLocaleLowerCase('pt-BR'));count++;
 }
 return count;
}
