import test from 'node:test';
import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';
import {issueCookie,verifyCookie,authorizeSession,verifyMasterHeader,expireCookie,sameOriginMutation} from '../src/session-auth.js';
if(!globalThis.crypto)globalThis.crypto=webcrypto;
const env={MASTER_TOKEN:'this-is-the-test-MASTER_TOKEN-of-the-worker-with-64-characters'};
const origin='https://vini-master-ai1.example.workers.dev';
const mock=(method='GET',cookie='',from=origin)=>new Request(origin+'/api/state',{method,headers:{
 ...(cookie?{Cookie:cookie}:{}),
 ...(method!=='GET'?{Origin:from}:{}),
 'Sec-Fetch-Site':'same-origin'
}});
test('remembered session is HttpOnly Secure SameSite Strict and uses no raw MASTER_TOKEN',async()=>{
 const r=await issueCookie(env,{remember:true});
 assert.match(r.cookie,/^__Host-vini_session=v1\./);
 assert.match(r.cookie,/Max-Age=2592000/);
 assert.match(r.cookie,/Secure; HttpOnly; SameSite=Strict/);
 assert.equal(r.cookie.includes(env.MASTER_TOKEN),false);
 assert.equal(await verifyCookie(mock('GET',r.cookie.split(';')[0]),env),true);
 assert.equal(r.remembered,true);
});
test('cookie authenticated POST requires a matching Origin',async()=>{
 const token=await issueCookie(env,{remember:false});
 const value=token.cookie.split(';')[0];
 assert.equal(await authorizeSession(mock('POST',value),env),true);
 assert.equal(await authorizeSession(mock('POST',value,'https://evil.example'),env),false);
 assert.equal(sameOriginMutation(mock('POST',value,'https://evil.example')),false);
 assert.equal(token.cookie.includes('Max-Age'),false);
});
test('cookie cannot be forged or reused after rotating the master secret',async()=>{
 const issued=await issueCookie(env,{remember:true});
 const value=issued.cookie.split(';')[0];
 const pos=value.lastIndexOf('.')+1;
 const modified=value.slice(0,pos)+(value[pos]==='A'?'B':'A')+value.slice(pos+1);
 assert.equal(await verifyCookie(mock('GET',modified),env),false);
 assert.equal(await verifyCookie(mock('GET',value),{MASTER_TOKEN:env.MASTER_TOKEN+'rotated'}),false);
 assert.match(expireCookie(),/Max-Age=0/);
});
test('legacy Bearer accepted only with correct secret for one-time migration',async()=>{
 const req=new Request(origin+'/api/auth/login',{method:'POST',headers:{Origin:origin,Authorization:'Bearer '+env.MASTER_TOKEN}});
 assert.equal(verifyMasterHeader(req,env),true);
 assert.equal(await authorizeSession(req,env),true);
 assert.equal(verifyMasterHeader(new Request(origin,{headers:{Authorization:'Bearer wrong'}}),env),false);
});
