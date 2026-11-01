const LEGACY_ID='legacy-history';
export const validThreadId=x=>typeof x==='string'&&/^[a-zA-Z0-9-]{8,80}$/.test(x);
export function chatTitle(x){return String(x||'').replace(/\s+/g,' ').trim().slice(0,85)||'Nova conversa';}
export async function setupThreads(db){
 await db.prepare("CREATE TABLE IF NOT EXISTS chat_threads (id TEXT PRIMARY KEY,project_id TEXT,title TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','archived','trashed')),is_draft INTEGER NOT NULL DEFAULT 0,created_at TEXT DEFAULT CURRENT_TIMESTAMP,updated_at TEXT DEFAULT CURRENT_TIMESTAMP)").run();
 await db.prepare("CREATE INDEX IF NOT EXISTS idx_chat_threads_project ON chat_threads(project_id,status,updated_at)").run();
 const cols=await db.prepare('PRAGMA table_info(messages)').all();
 if(!(cols.results||[]).some(x=>x.name==='thread_id'))await db.prepare('ALTER TABLE messages ADD COLUMN thread_id TEXT').run();
 await db.prepare('CREATE INDEX IF NOT EXISTS idx_messages_thread_id ON messages(thread_id,id)').run();
 const legacy=await db.prepare('SELECT COUNT(*) AS n FROM messages WHERE thread_id IS NULL').first();
 if(Number(legacy?.n||0)>0){
  await db.prepare("INSERT OR IGNORE INTO chat_threads(id,project_id,title,status,is_draft) VALUES(?,NULL,'Histórico anterior (organize por projeto)','active',0)").bind(LEGACY_ID).run();
  await db.prepare('UPDATE messages SET thread_id=? WHERE thread_id IS NULL').bind(LEGACY_ID).run();
 }
}
export async function listThreads(db,{search='',status='active',projectId=''}={}){
 if(!['active','archived','trashed','all'].includes(status))throw Error('Filtro inválido.');
 const term=String(search||'').trim().slice(0,100),proj=String(projectId||'').trim(),q='%'+term+'%';
 const sql='SELECT t.id,t.project_id,t.title,t.status,t.is_draft,t.created_at,t.updated_at,p.name AS project_name,'
 +' (SELECT m.content FROM messages m WHERE m.thread_id=t.id ORDER BY m.id DESC LIMIT 1) AS preview,'
 +' (SELECT COUNT(*) FROM messages m WHERE m.thread_id=t.id) AS message_count'
 +' FROM chat_threads t LEFT JOIN projects p ON p.id=t.project_id'
 +' WHERE (? = \'all\' OR t.status=?) AND (?=\'\' OR t.project_id=?)'
 +' AND (?=\'\' OR t.title LIKE ? OR p.name LIKE ? OR EXISTS(SELECT 1 FROM messages m WHERE m.thread_id=t.id AND m.content LIKE ?))'
 +' ORDER BY t.updated_at DESC,t.created_at DESC LIMIT 250';
 const result=await db.prepare(sql).bind(status,status,proj,proj,term,q,q,q).all();
 return result.results||[];
}
export async function getThread(db,id){
 if(!validThreadId(id))return null;
 return db.prepare('SELECT t.*,p.name AS project_name FROM chat_threads t LEFT JOIN projects p ON p.id=t.project_id WHERE t.id=?').bind(id).first();
}
export async function createThread(db,{projectId=null,title='',draft=false}={}){
 if(!draft&&!projectId)throw Error('Selecione um projeto para a conversa.');
 if(projectId){
  const p=await db.prepare("SELECT id FROM projects WHERE id=? AND status='active'").bind(projectId).first();
  if(!p)throw Error('Projeto inexistente ou arquivado.');
 }
 const id=crypto.randomUUID();
 await db.prepare('INSERT INTO chat_threads(id,project_id,title,is_draft) VALUES(?,?,?,?)').bind(id,projectId||null,chatTitle(title),draft?1:0).run();
 return getThread(db,id);
}
export async function updateThread(db,id,patch){
 const t=await getThread(db,id);if(!t||t.status==='trashed')throw Error('Conversa não encontrada.');
 if(patch.title!==undefined){
  if(!String(patch.title||'').trim())throw Error('Digite um título.');
  await db.prepare('UPDATE chat_threads SET title=?,updated_at=CURRENT_TIMESTAMP WHERE id=?').bind(chatTitle(patch.title),id).run();
 }
 if(patch.projectId!==undefined){
  if(!patch.projectId&&!t.is_draft)throw Error('Escolha um projeto de destino.');
  if(patch.projectId){
   const p=await db.prepare("SELECT id FROM projects WHERE id=? AND status='active'").bind(patch.projectId).first();
   if(!p)throw Error('Projeto de destino não encontrado ou arquivado.');
  }
  await db.prepare('UPDATE chat_threads SET project_id=?,is_draft=?,updated_at=CURRENT_TIMESTAMP WHERE id=?').bind(patch.projectId||null,patch.projectId?0:1,id).run();
 }
 if(patch.status!==undefined){
  if(!['active','archived','trashed'].includes(patch.status))throw Error('Status inválido.');
  await db.prepare('UPDATE chat_threads SET status=?,updated_at=CURRENT_TIMESTAMP WHERE id=?').bind(patch.status,id).run();
 }
 return getThread(db,id);
}
export async function removeThread(db,id,{permanent=false}={}){
 const t=await getThread(db,id);if(!t)throw Error('Conversa não encontrada.');
 if(!permanent){await db.prepare("UPDATE chat_threads SET status='trashed',updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(id).run();return {trashed:true};}
 if(t.status!=='trashed')throw Error('Primeiro envie para a lixeira.');
 await db.prepare('DELETE FROM messages WHERE thread_id=?').bind(id).run();
 await db.prepare('DELETE FROM chat_threads WHERE id=?').bind(id).run();
 return {deleted:true};
}
export async function getThreadMessages(db,id,{before=0,limit=80}={}){
 const t=await getThread(db,id);if(!t||t.status==='trashed')throw Error('Conversa não encontrada.');
 const n=Math.min(100,Math.max(1,Number(limit)||80)),cursor=Math.max(0,Number(before)||0);
 const rows=await db.prepare(cursor?'SELECT id,role,content,provider,created_at FROM messages WHERE thread_id=? AND id<? ORDER BY id DESC LIMIT ?':'SELECT id,role,content,provider,created_at FROM messages WHERE thread_id=? ORDER BY id DESC LIMIT ?').bind(...(cursor?[id,cursor,n]:[id,n])).all();
 const messages=rows.results||[];
 return {thread:t,messages:messages.reverse(),olderCursor:messages.length===n?messages[0]?.id:null};
}
export async function saveThreadMessage(db,threadId,role,content,provider=null){
 if(!['user','assistant'].includes(role))throw Error('Papel inválido.');
 await db.prepare('INSERT INTO messages(thread_id,role,content,provider) VALUES(?,?,?,?)').bind(threadId,role,String(content),provider).run();
 await db.prepare('UPDATE chat_threads SET updated_at=CURRENT_TIMESTAMP WHERE id=?').bind(threadId).run();
}
export async function chooseThread(db,id){
 const t=await getThread(db,id);
 if(!t||t.status!=='active')throw Error('Conversa arquivada ou inexistente. Restaure antes de conversar.');
 return t;
}
