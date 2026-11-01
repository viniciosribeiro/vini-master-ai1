#!/usr/bin/env node
// Safe, self-cleaning smoke test for the deployed Cloudflare Worker.
// Never commits secrets or touches existing conversations/projects.
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';

const base=(process.env.VINI_SMOKE_URL||'https://vini-master-ai1.viniciosribeiro.workers.dev').replace(/\/$/,'');
const master=process.env.VINI_MASTER_TOKEN||'';
const requireAuth=process.env.VINI_REQUIRE_AUTH==='true';
let cookie='',threadId='',permanentlyRemoved=false;

async function request(path,{method='GET',body,authenticated=false}={}){
 const headers={'Accept':'application/json'};
 if(body!==undefined)headers['Content-Type']='application/json';
 if(method!=='GET'&&method!=='HEAD')headers.Origin=base;
 if(authenticated&&cookie)headers.Cookie=cookie;
 const res=await fetch(base+path,{method,headers,body:body===undefined?undefined:JSON.stringify(body),redirect:'manual',signal:AbortSignal.timeout(15000)});
 let data={};try{data=await res.json()}catch{}
 return {res,data};
}
function ok(x,code=200){assert.equal(x.res.status,code,JSON.stringify(x.data));return x.data;}
async function cleanup(){
 if(!threadId||permanentlyRemoved||!cookie)return;
 try{
  const status=await request('/api/threads/'+encodeURIComponent(threadId),{authenticated:true});
  if(status.res.status===404)return;
  if(status.data.thread?.status!=='trashed')await request('/api/threads/'+encodeURIComponent(threadId),{method:'DELETE',authenticated:true});
  const deleted=await request('/api/threads/'+encodeURIComponent(threadId)+'?permanent=true',{method:'DELETE',authenticated:true});
  if(deleted.res.ok)permanentlyRemoved=true;
 }catch(e){console.error('CLEANUP FAILED for isolated test thread ID:',threadId,String(e.message||e));}
}
async function main(){
 const health=ok(await request('/api/health'));
 assert.equal(health.status,'ready','Worker health is not ready');
 assert.equal(health.bindings?.d1,true);
 assert.equal(health.accessConfigured,true);
 console.log('PASS public health',health.version,'D1+access configured');
 const locked=await request('/api/threads');
 assert.equal(locked.res.status,401,'Private conversations must reject anonymous GET');
 console.log('PASS anonymous thread access denied (401)');
 if(!master){
  if(requireAuth)throw Error('Authenticated smoke required, but VINI_MASTER_TOKEN is not configured');
  console.log('SKIPPED authenticated D1 CRUD: no VINI_MASTER_TOKEN in execution environment');
  return;
 }
 const login=await fetch(base+'/api/auth/login',{method:'POST',headers:{Authorization:'Bearer '+master,Origin:base,'Content-Type':'application/json'},body:JSON.stringify({remember:false}),redirect:'manual',signal:AbortSignal.timeout(15000)});
 assert.equal(login.status,200,'Login failed; check test credential');
 const raw=login.headers.get('set-cookie')||'';
 assert.match(raw,/^__Host-vini_session=/);
 assert.match(raw,/HttpOnly/);
 cookie=raw.split(';')[0];
 ok(await request('/api/auth/session',{authenticated:true}));
 console.log('PASS authenticated HttpOnly session');
 const projects=ok(await request('/api/projects',{authenticated:true})).projects||[];
 const active=projects.filter(p=>p.status==='active');
 const title='TESTE AUTOMÁTICO — remover: '+randomUUID().slice(0,8);
 const created=ok(await request('/api/threads',{method:'POST',authenticated:true,body:active.length?{projectId:active[0].id,title}:{draft:true,title}}),201).thread;
 threadId=created.id;
 assert.equal(created.title,title);
 assert.equal(created.project_id,active[0]?.id||null);
 console.log('PASS create isolated D1 thread',threadId);
 const read=ok(await request('/api/threads/'+threadId,{authenticated:true})).thread;
 assert.equal(read.id,threadId);
 const msgs=ok(await request('/api/threads/'+threadId+'/messages',{authenticated:true})).messages;
 assert.deepEqual(msgs,[],'New test conversation must have no messages');
 const renamed=ok(await request('/api/threads/'+threadId,{method:'PATCH',authenticated:true,body:{title:'TESTE DE CONVERSA — RENOMEADA'}})).thread;
 assert.equal(renamed.title,'TESTE DE CONVERSA — RENOMEADA');
 if(active.length>1){
  const moved=ok(await request('/api/threads/'+threadId,{method:'PATCH',authenticated:true,body:{projectId:active[1].id}})).thread;
  assert.equal(moved.project_id,active[1].id);
  console.log('PASS conversation moved between existing projects');
 }else console.log('SKIPPED move between projects: fewer than 2 active projects');
 assert.equal(ok(await request('/api/threads/'+threadId,{method:'PATCH',authenticated:true,body:{status:'archived'}})).thread.status,'archived');
 assert.equal(ok(await request('/api/threads/'+threadId,{method:'PATCH',authenticated:true,body:{status:'active'}})).thread.status,'active');
 ok(await request('/api/threads/'+threadId,{method:'DELETE',authenticated:true}));
 assert.equal(ok(await request('/api/threads/'+threadId,{authenticated:true})).thread.status,'trashed');
 assert.equal(ok(await request('/api/threads/'+threadId,{method:'PATCH',authenticated:true,body:{status:'active'}})).thread.status,'active');
 ok(await request('/api/threads/'+threadId,{method:'DELETE',authenticated:true}));
 assert.equal(ok(await request('/api/threads/'+threadId+'?permanent=true',{method:'DELETE',authenticated:true})).deleted,true);
 permanentlyRemoved=true;
 assert.equal((await request('/api/threads/'+threadId,{authenticated:true})).res.status,404);
 console.log('PASS rename/archive/restore/trash/permanent delete D1');
 console.log('PASS authenticated conversation CRUD; test data cleaned');
}
try{await main();}catch(e){console.error('FAIL smoke:',String(e.message||e));process.exitCode=1;}finally{await cleanup();}
