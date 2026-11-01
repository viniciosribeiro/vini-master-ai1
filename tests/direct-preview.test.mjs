import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Script} from 'node:vm';
import {initiateDirectStaticPreview} from '../src/vercel-connector.js';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const connector=read('src/vercel-connector.js'),api=read('src/api.js');
const frontend=read('public/vini-direct-preview.js'),css=read('public/vini-direct-preview.css');
const html=read('public/index.html'),sw=read('public/sw.js'),worker=read('src/index.js');

test('Direct Vercel preview frontend loads as independent module after voice studio',()=>{
 assert.doesNotThrow(()=>new Script(frontend));
 assert.ok(html.indexOf('vini-direct-preview.js?v=20')>html.indexOf('vini-voice-live.js?v=18'));
 assert.match(sw,/vini-direct-preview\.js/);
 assert.match(sw,/vini-master-shell-v20/);
 assert.match(worker,/version:'0\.17\.2'/);
 assert.ok(css.includes('.vini-direct-lab'));
});
test('API requires original session, same-origin and explicit preview confirmation',()=>{
 assert.match(api,/if\(path==='\/api\/vercel\/direct-preview'&&method==='POST'\)/);
 assert.match(api,/sameOriginMutation\(req\)/);
 assert.match(api,/body\.confirm!=='CRIAR PREVIA'/);
 assert.match(api,/body\.target&&body\.target!=='preview'/);
 assert.match(api,/COUNT\(\*\) AS n FROM vercel_builds/);
});
test('No GitHub or production in direct upload payload; source audited in D1',()=>{
 assert.match(connector,/source:'direct_upload'/);
 assert.match(api,/gitHubRequired:false,production:false,ready:false/);
 assert.match(api,/INSERT INTO vercel_builds/);
 assert.doesNotMatch(connector,/target:'production'|gitSource:/);
});
test('Require index.html, safe paths, no duplicate files or oversized payloads',async()=>{
 const req=async(files)=>initiateDirectStaticPreview({},files);
 await assert.rejects(req([{file:'main.js',data:'x'}]),/index.html/);
 await assert.rejects(req([{file:'../index.html',data:'x'}]),/inválido/);
 await assert.rejects(req([{file:'index.html',data:'a'},{file:'index.html',data:'b'}]),/repetido/);
 await assert.rejects(req([{file:'index.html',data:'x'.repeat(19000)}]),/muito grande/);
 await assert.rejects(req([{file:'vercel.json',data:'{}'},{file:'index.html',data:'x'}]),/inválido/);
 await assert.rejects(req(Array.from({length:7},(_,i)=>({file:'a'+i+'.html',data:'x'}))),/1 a 6/);
});
test('Preview deployment is explicitly not GitHub-backed',()=>{
 assert.match(connector,/files:validated/);
 assert.match(connector,/const existingProjects=await getVercelProjects/);
 assert.match(connector,/history\.some\(d=>d\.target==='production'\)/);
 assert.match(connector,/project:lab\.id,files:validated/);
 assert.doesNotMatch(connector,/projectSettings:\{framework:null\}/);
 assert.match(connector,/name='vini-agent-preview-lab'/);
 assert.doesNotMatch(frontend,/\/api\/github/);
 assert.match(frontend,/\/vercel\/direct-preview/);
});

test('NEW preview lab is blocked before deployment to protect against Vercel first production deploy',()=>{
 assert.match(connector,/if\(!lab\)throw Error\('Laboratório de prévias não existe/);
 assert.match(connector,/não foi possível provar que este projeto já passou/);
});
