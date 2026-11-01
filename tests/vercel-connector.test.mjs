import test from 'node:test';
import assert from 'node:assert/strict';
import {vercelRequest,testVercelToken} from '../src/vercel-connector.js';
import {guardUnsupportedActionClaims,isUnsupportedDeploymentRequest} from '../src/action-proof.js';
const response=(status,json)=>({ok:status>=200&&status<300,status,async json(){return json}});
test('Vercel API is fixed to its trusted host and endpoints',async()=>{
 let url,authorization;
 const fetcher=async(target,options)=>{url=new URL(target);authorization=options.headers.Authorization;return response(200,{user:{username:'demo'}})};
 const payload=await vercelRequest('example_secret','/v2/user',{fetcher});
 assert.equal(payload.user.username,'demo');
 assert.equal(url.hostname,'api.vercel.com');
 assert.equal(authorization,'Bearer example_secret');
 await assert.rejects(()=>vercelRequest('token','https://evil.example/?secret=1',{fetcher}),/Endpoint/);
 await assert.rejects(()=>vercelRequest('token','/v1/projects',{teamId:'not-a-team',fetcher}),/Endpoint|Team ID/);
});
test('Vercel token verified by actual user and projects calls before storage',async()=>{
 const paths=[];
 const fetcher=async(target)=>{
  const path=new URL(target).pathname;paths.push(path);
  if(path==='/v2/user')return response(200,{user:{username:'demo'}});
  if(path==='/v9/projects')return response(200,{projects:[{id:'prj_1234567890',name:'x'}]});
  throw Error('Unexpected path '+path);
 };
 const info=await testVercelToken('not-real-token','',fetcher);
 assert.equal(info.projects,1);
 assert.deepEqual(paths,['/v2/user','/v9/projects']);
});
test('Vercel authentication errors never silently become valid',async()=>{
 await assert.rejects(()=>vercelRequest('nope','/v2/user',{fetcher:async()=>response(401,{error:{message:'Unauthorized'}})}),/Vercel HTTP 401/);
});
test('VINI does not claim to rebuild before Vercel confirms execution',()=>{
 const old='Agora vou entrar na Vercel e forçar o build remoto.';
 const guarded=guardUnsupportedActionClaims(old);
 assert.equal(guarded.intercepted,true);
 assert.match(guarded.text,/Não executei ações externas nesta resposta/);
 assert.equal(isUnsupportedDeploymentRequest('Force o build na Vercel'),true);
});

test('Workers-compatible manual redirect never follows bearer token to another host',async()=>{
 let redirectMode='';
 const fetcher=async (_url,init)=>{
  redirectMode=init.redirect;
  return response(302,{error:{message:'Unexpected redirect'}});
 };
 await assert.rejects(()=>vercelRequest('test-token','/v2/user',{fetcher}),/Redirecionamento inesperado/);
 assert.equal(redirectMode,'manual');
});
