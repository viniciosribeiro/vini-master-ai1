import test from 'node:test';
import assert from 'node:assert/strict';
import {isPlatformHost,normalizedPublicUrl,verifyPublicDeployment,guardChatDeployment,cleanChatHtml} from '../src/deploy-verification.js';
test('only public HTTPS platform hosts can be probed',()=>{
 assert.equal(isPlatformHost('vini-master-ai.vercel.app'),true);
 assert.equal(isPlatformHost('vini-master-ai.vercel.app.attacker.com'),false);
 assert.equal(normalizedPublicUrl('https://abc.pages.dev/'), 'https://abc.pages.dev/');
 for(const url of ['http://x.vercel.app','https://localhost','https://192.168.1.10','https://user:pass@x.vercel.app','https://my.internal'])assert.equal(normalizedPublicUrl(url),null);
});
test('200 success is online; Vercel deployment not found and redirects are never online',async()=>{
 const run=async(status,headers={})=>verifyPublicDeployment('https://mock.vercel.app',async()=>new Response(null,{status,headers}));
 assert.equal((await run(200)).status,'online');
 assert.equal((await run(404,{'x-vercel-error':'DEPLOYMENT_NOT_FOUND'})).status,'unavailable');
 assert.equal((await run(302,{location:'https://example.com'})).status,'unavailable');
 assert.equal((await run(401)).status,'unavailable');
});
test('conversational model cannot invent deployments or raw html links',()=>{
 const old='Acabei de fazer o deploy: <a href="https://vini-master-ai.vercel.app">Abrir site</a>';
 assert.match(guardChatDeployment(old,[]),/não tenho confirmação/);
 assert.doesNotMatch(guardChatDeployment(old,[]),/<a /);
 assert.match(guardChatDeployment('Veja https://x.vercel.app',[]),/não confirmad/);
 const published=[{name:'Projeto',deploy_url:'https://x.vercel.app/',deploy_status:'online',deploy_verified_at:'2026-11-01T12:00:00Z'}];
 assert.match(guardChatDeployment('Site: https://x.vercel.app',published),/https:\/\/x\.vercel\.app/);
 assert.equal(cleanChatHtml('<p>Olá <strong>humano</strong></p>'),'Olá humano');
 assert.match(guardChatDeployment('https://bad.vercel.app',published),/não confirmad/);
 assert.match(guardChatDeployment('Acabei de fazer o deploy',published),/não tenho confirmação/);
});
