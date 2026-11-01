/**
 * Native Cloudflare VoiceClient — compile for the public directory before preview:
 * npx esbuild src/vini-native-voice-client.js --bundle --format=iife --platform=browser --outfile=public/vini-native-voice-client.js
 * Preview-only; do not replace browser-voice before passing Cloudflare runtime QA.
 */
import {VoiceClient} from 'agents/voice/client';

const $=id=>document.getElementById(id);
let client=null,sessionId=null;
const status=(message)=>{
 const node=$('vini-native-voice-status');
 if(node)node.textContent=String(message||'');
};
function shutDown(){
 try{client?.endCall();}catch{}
 try{client?.disconnect();}catch{}
 client=null;sessionId=null;
 const button=$('vini-native-voice-start');
 if(button)button.textContent='Iniciar voz WebSocket';
 status('Desconectado.');
}
async function begin(){
 if(client){shutDown();return;}
 const id=window.viniThreads?.selected?.();
 if(typeof id!=='string'||!/^[a-f0-9-]{36}$/i.test(id)){
  status('Escolha primeiro uma conversa de projeto para registrar a voz.');return;
 }
 if(!navigator.mediaDevices?.getUserMedia){status('Microfone indisponível neste navegador.');return;}
 status('Conectando áudio à Cloudflare…');
 sessionId=id;
 try{
  const c=new VoiceClient({agent:'ViniVoiceAgent',name:id,host:location.host});
  client=c;
  c.addEventListener('statuschange',value=>{if(client===c)status('Áudio: '+String(value));});
  c.addEventListener('error',value=>{if(client===c)status('Erro de voz: '+String(value||'desconhecido'));});
  c.addEventListener('connectionchange',connected=>{if(client===c&&!connected)status('Conexão perdida. Encerre e inicie novamente.');});
  c.addEventListener('transcriptchange',items=>{
   if(client!==c)return;
   const area=$('vini-native-voice-transcript');if(!area)return;
   area.replaceChildren();
   for(const entry of items.slice(-14)){
    const p=document.createElement('p');
    p.textContent=(entry.role==='user'?'Você':'VINI')+': '+String(entry.text||'');
    area.append(p);
   }
  });
  c.connect();
  await c.startCall();
  if(client!==c){try{c.endCall();c.disconnect();}catch{}return;}
  $('vini-native-voice-start').textContent='Encerrar voz WebSocket';
  status('Conversa ao vivo ativa. O histórico está vinculado ao projeto.');
 }catch(e){
  status('A Cloudflare não iniciou a chamada: '+String(e?.message||e));
  shutDown();
 }
}
function mount(){
 const host=$('section-chat');if(!host||$('vini-native-voice-start'))return;
 const root=document.createElement('details');root.className='vini-native-voice-flag';
 const summary=document.createElement('summary');summary.textContent='Voz nativa Cloudflare — testes de prévia';root.append(summary);
 const desc=document.createElement('p');desc.textContent='Streaming WebSocket via Durable Object. Disponível somente depois da configuração e dos testes do backend cloud.';root.append(desc);
 const b=document.createElement('button');b.type='button';b.id='vini-native-voice-start';b.textContent='Iniciar voz WebSocket';b.addEventListener('click',begin);root.append(b);
 const state=document.createElement('p');state.id='vini-native-voice-status';state.setAttribute('role','status');state.textContent='Aguardando início';root.append(state);
 const transcript=document.createElement('div');transcript.id='vini-native-voice-transcript';transcript.setAttribute('aria-live','polite');root.append(transcript);
 host.append(root);
 window.addEventListener('beforeunload',shutDown);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});else mount();
