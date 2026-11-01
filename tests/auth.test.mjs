import test from 'node:test';
import assert from 'node:assert/strict';
import {handleAPI} from '../src/api.js';
const secret='A'.repeat(40)+'-private-login-token';
const req=token=>new Request('https://example.com/api/auth/session',{headers:token?{Authorization:'Bearer '+token}:{}});
test('auth: accepts exact MASTER_TOKEN without touching D1',async()=>{
 const r=await handleAPI(req(secret),{MASTER_TOKEN:secret,AI:{run(){}}});
 assert.equal(r.status,200);
 const data=await r.json();
 assert.equal(data.authenticated,true);
 assert.equal(data.cloudflareAI,true);
});
test('auth: wrong token returns 401 even if correctly sized',async()=>{
 const r=await handleAPI(req('B'.repeat(40)),{MASTER_TOKEN:secret});
 assert.equal(r.status,401);
 const data=await r.json();
 assert.match(data.error,/MASTER_TOKEN/);
});
test('auth: no token or missing server secret fail closed',async()=>{
 assert.equal((await handleAPI(req(),{MASTER_TOKEN:secret})).status,401);
 assert.equal((await handleAPI(req(secret),{})).status,401);
});
