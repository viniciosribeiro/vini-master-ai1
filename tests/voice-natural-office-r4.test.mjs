import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Script} from 'node:vm';
import {handleNaturalVoice} from '../src/voice-tts.js';
const load=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const api=load('src/api.js'),script=load('public/vini-voice-live.js'),
 css=load('public/vini-office-recovery.css'),html=load('public/index.html'),
 sw=load('public/sw.js'),worker=load('src/index.js');
function fakeDb(){
 const state={characters:0,requests:0};
 return {state,prepare(sql){
  let args=[];
  return {bind(...params){args=params;return this;},
   async first(){return {characters:state.characters,requests:state.requests};},
   async run(){
    if(sql.startsWith('UPDATE voice_tts_usage')){
     const n=Number(args[0]);if(state.characters+n>2000)return {meta:{changes:0}};
     state.characters+=n;state.requests++;return {meta:{changes:1}};
    }
    return {meta:{changes:1}};
   }};
 }};
}
function speechReq(obj={}){return new Request('https://test.local/api/voice/tts',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(obj)});}
test('voice studio no longer synthesizes robotic Android device voices',()=>{
 assert.doesNotThrow(()=>new Script(script));
 assert.doesNotMatch(script,/\bwindow\.speechSynthesis\b|new SpeechSynthesisUtterance|\.getVoices\(/);
 assert.match(script,/new Audio\(url\)/);
 assert.match(script,/api\('\/voice\/tts'/);
 assert.match(script,/OpenAI TTS-1/);
 assert.match(script,/Não/);
});
test('natural speech is behind authenticated API and same-origin guard',()=>{
 assert.match(api,/handleNaturalVoice\(req,env,env\.DB\)/);
 assert.match(api,/sameOriginMutation\(req\)/);
 assert.ok(api.indexOf("if(!await authorized(req,env))") < api.indexOf("handleNaturalVoice(req,env,env.DB)"));
});
test('unauthorized spending request is blocked even with bound Workers AI',async()=>{
 let calls=0;const env={AI:{run:async()=>{calls++;return {audio:'https://pub-demo.r2.dev/test.mp3'};}}},db=fakeDb();
 const response=await handleNaturalVoice(speechReq({text:'Olá VINI',voice:'nova'}),env,db);
 assert.equal(response.status,403);assert.equal(calls,0);assert.equal(db.state.characters,0);
});
test('valid authorized 6-voice OpenAI TTS uses real model and bounded char debit',async()=>{
 const db=fakeDb();const calls=[];
 const env={AI:{run:async(...args)=>{calls.push(args);return {audio:'https://pub-demo.r2.dev/example.mp3'};}}};
 const response=await handleNaturalVoice(speechReq({confirm:'ACEITO_CUSTO_VOZ_OPENAI',text:'Olá, o projeto está pronto.',voice:'onyx',speed:1}),env,db);
 assert.equal(response.status,200);const body=await response.json();
 assert.match(body.audioUrl,/^https:\/\/pub-demo\.r2\.dev/);
 assert.equal(calls[0][0],'openai/tts-1');
 assert.equal(calls[0][1].voice,'onyx');
 assert.ok(db.state.characters>0);
});
test('input errors and non-R2 URLs fail closed',async()=>{
 const db=fakeDb();const env={AI:{run:async()=>({audio:'https://attacker.invalid/audio.mp3'})}};
 for(const sample of [{text:'Hello',voice:'evil'}, {text:'a'.repeat(481),voice:'nova'}]){
  const res=await handleNaturalVoice(speechReq({...sample,confirm:'ACEITO_CUSTO_VOZ_OPENAI'}),env,db);assert.equal(res.status,400);
 }
 const fake=await handleNaturalVoice(speechReq({confirm:'ACEITO_CUSTO_VOZ_OPENAI',text:'Olá',voice:'nova'}),env,db);
 assert.equal(fake.status,503);
});
test('daily 2000-character hard cap blocks billing before model invocation',async()=>{
 const db=fakeDb();db.state.characters=1995;let called=0;
 const env={AI:{run:async()=>{called++;return {audio:'https://pub-demo.r2.dev/test.mp3'};}}};
 const res=await handleNaturalVoice(speechReq({confirm:'ACEITO_CUSTO_VOZ_OPENAI',text:'Olá VINI',voice:'nova'}),env,db);
 assert.equal(res.status,429);assert.equal(called,0);
});
test('status exposes cost disclosure but does not generate audio',async()=>{
 let calls=0;const env={AI:{run:async()=>{calls++;}}};const db=fakeDb();
 const res=await handleNaturalVoice(new Request('https://test.local/api/voice/tts'),env,db);
 const j=await res.json();assert.equal(j.deviceVoice,false);assert.equal(j.approvalRequired,true);
 assert.equal(j.maximumCostUsd,0.03);assert.equal(calls,0);
});
test('visible office cards, central supervisor and latest assets do not hide agents',()=>{
 assert.match(css,/#section-office #vc-office \.vc-office-grid/);
 assert.match(css,/#section-office #vc-office \.vc-office-center/);
 assert.match(css,/\.vc-agent-card/);assert.match(css,/grid-template-areas:"supervisor supervisor"/);
 assert.match(html,/vini-office-recovery\.css\?v=24/);
 assert.match(html,/vini-voice-live\.js\?v=24/);
 assert.match(sw,/vini-master-shell-v24/);
 assert.match(worker,/version:'0\.17\.5'/);
});
