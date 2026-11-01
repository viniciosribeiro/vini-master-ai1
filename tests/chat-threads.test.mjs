import test from 'node:test';
import assert from 'node:assert/strict';
import {setupThreads,createThread,updateThread,removeThread,getThreadMessages,saveThreadMessage,chatTitle,validThreadId} from '../src/chat-threads.js';

function fakeDB({legacy=0,hasColumn=true,projectStatus='active'}={}){
 const queries=[],state={thread:{id:'f9a9b0e2-1111-4cce-bcbb-99aabbbccddd',project_id:'project-1',title:'Thread',status:'active',is_draft:0},created:null};
 return {queries,state,prepare(sql){
  let args=[];return {bind(...values){args=values;return this;},
   async all(){queries.push({sql,args,type:'all'});
    if(sql.startsWith('PRAGMA'))return {results:hasColumn?[{name:'id'},{name:'thread_id'}]:[{name:'id'}]};
    if(sql.includes('SELECT id,role,content,provider,created_at FROM messages'))return {results:[{id:6,role:'assistant',content:'Oi',provider:'cloudflare'},{id:4,role:'user',content:'Teste'}]};
    return {results:[]};},
   async first(){queries.push({sql,args,type:'first'});
    if(sql.includes('COUNT(*) AS n FROM messages'))return {n:legacy};
    if(sql.includes('FROM projects WHERE id=?'))return projectStatus==='active'?{id:'project-1'}:null;
    if(sql.includes('SELECT status FROM projects'))return {status:projectStatus};
    if(sql.includes('SELECT t.*,p.name'))return state.thread;
    return null;},
   async run(){queries.push({sql,args,type:'run'});
    if(sql.startsWith('INSERT INTO chat_threads'))state.created=args;
    if(sql.startsWith("UPDATE chat_threads SET status='trashed'"))state.thread.status='trashed';
    else if(sql.startsWith('UPDATE chat_threads SET status'))state.thread.status=args[0];
    if(sql.startsWith('UPDATE chat_threads SET title'))state.thread.title=args[0];
    return {success:true};}
  };
 }};
}

test('pre-existing messages stay untouched except assignment to one legacy thread',async()=>{
 const db=fakeDB({legacy:12,hasColumn:false});
 await setupThreads(db);
 assert.ok(db.queries.some(q=>q.sql==='ALTER TABLE messages ADD COLUMN thread_id TEXT'));
 const migrate=db.queries.find(q=>q.sql==='UPDATE messages SET thread_id=? WHERE thread_id IS NULL');
 assert.deepEqual(migrate.args,['legacy-history']);
 assert.equal(db.queries.some(q=>q.sql.startsWith('DELETE FROM messages')),false);
});
test('no unnecessary historical migration when all rows already have thread IDs',async()=>{
 const db=fakeDB();
 await setupThreads(db);
 assert.equal(db.queries.some(q=>q.sql.includes('UPDATE messages SET thread_id')),false);
});
test('new conversation requires a valid active project, or explicit draft interview',async()=>{
 const db=fakeDB();
 await assert.rejects(createThread(db,{}),/Selecione um projeto/);
 await createThread(db,{projectId:'project-1',title:'Novo chat'});
 assert.equal(db.state.created[1],'project-1');
 assert.equal(db.state.created[3],0);
 await createThread(db,{draft:true,title:'Entrevista'});
 assert.equal(db.state.created[3],1);
 await assert.rejects(createThread(fakeDB({projectStatus:'archived'}),{projectId:'project-1'}),/arquivado/);
});
test('conversation content fetch is bound by thread ID; pagination cannot cross project',async()=>{
 const db=fakeDB(),id='f9a9b0e2-1111-4cce-bcbb-99aabbbccddd';
 const r=await getThreadMessages(db,id,{limit:20,before:9});
 assert.deepEqual(r.messages.map(m=>m.id),[4,6]);
 const q=db.queries.find(x=>x.sql.includes('FROM messages WHERE thread_id=? AND id<?'));
 assert.deepEqual(q.args,[id,9,20]);
 await saveThreadMessage(db,id,'user','Mensagem do projeto');
 const write=db.queries.find(x=>x.sql.startsWith('INSERT INTO messages(thread_id'));
 assert.equal(write.args[0],id);
});
test('rename, archive, trash, restore and permanent delete use explicit thread ID',async()=>{
 const db=fakeDB(),id=db.state.thread.id;
 await updateThread(db,id,{title:'Melhoria do app'});
 assert.equal(db.state.thread.title,'Melhoria do app');
 await updateThread(db,id,{status:'archived'});
 assert.equal(db.state.thread.status,'archived');
 await removeThread(db,id);
 assert.equal(db.state.thread.status,'trashed');
 await updateThread(db,id,{status:'active'});
 assert.equal(db.state.thread.status,'active');
 await assert.rejects(removeThread(db,id,{permanent:true}),/Primeiro envie/);
 await removeThread(db,id);
 const done=await removeThread(db,id,{permanent:true});
 assert.equal(done.deleted,true);
 const deletion=db.queries.find(x=>x.sql==='DELETE FROM messages WHERE thread_id=?');
 assert.deepEqual(deletion.args,[id]);
});
test('safe titles and IDs',()=>{
 assert.equal(chatTitle('  Reservas  \n  2026 '),'Reservas 2026');
 assert.equal(validThreadId('legacy-history'),true);
 assert.equal(validThreadId("' OR 1=1--"),false);
});
