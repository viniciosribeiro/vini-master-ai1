/* VINI Voice Studio R4.
   Mic STT is browser turn recognition. Speech output is real OpenAI TTS-1 through
   authenticated Cloudflare Gateway; no robotic speechSynthesis fallback.
   Paid generation only after explicit informed consent, capped in Worker D1.
 */
(()=>{
'use strict';
const $=id=>document.getElementById(id);
const make=(tag,cls,value)=>{const x=document.createElement(tag);if(cls)x.className=cls;if(value!==undefined)x.textContent=String(value);return x;};
const Rec=()=>window.SpeechRecognition||window.webkitSpeechRecognition;
const VOICES=[['nova','Nova · voz feminina'],['shimmer','Shimmer · voz feminina'],['alloy','Alloy · neutra'],['echo','Echo · voz masculina'],['onyx','Onyx · voz masculina grave'],['fable','Fable · expressiva']];
const LIMIT=2000, MAX_COST='US$ 0,03/dia';
let settings={mode:'orb',voice:'nova',rate:1,approved:false};
try{settings={...settings,...JSON.parse(localStorage.getItem('vini-voice-r4')||'{}')};}catch{}
const save=()=>{try{localStorage.setItem('vini-voice-r4',JSON.stringify(settings));}catch{}};
const state={active:false,paused:false,listening:false,thinking:false,speaking:false,rec:null,audio:null,controller:null,retry:null,watchdog:null,pending:'',lastFinal:'',lastFinalAt:0,err:0,requestSeq:0,info:null};
const status=(str,kind='idle')=>{const n=$('vs-status');if(n)n.textContent=str;const dlg=$('vini-voice-studio');if(dlg)dlg.dataset.status=kind;};
function render(){
 const dlg=$('vini-voice-studio');if(!dlg)return;
 $('vs-toggle').textContent=state.paused?'Retomar':'Pausar';
 $('vs-interrupt').disabled=!state.speaking;
 $('vs-visual').dataset.mode=settings.mode;
 $('vs-mode-label').textContent=({orb:'Esfera neural',robot:'VINI interativo',network:'Rede neural viva'})[settings.mode]||'Esfera neural';
 for(const node of dlg.querySelectorAll('[data-vs-mode]'))node.setAttribute('aria-pressed',String(node.dataset.vsMode===settings.mode));
 const msg=$('vs-voice-info');if(msg)msg.textContent='OpenAI TTS-1 via Cloudflare · Português disponível · streaming ainda não ativado · até '+MAX_COST;
}
function append(text,role){
 const list=$('vs-log');if(!list)return;
 const node=make('p','vs-line vs-'+role,text);list.append(node);while(list.children.length>16)list.firstElementChild.remove();list.scrollTop=list.scrollHeight;
}
function clearTimers(){clearTimeout(state.retry);clearTimeout(state.watchdog);state.retry=null;state.watchdog=null;}
function stopMic(){
 const rec=state.rec;state.rec=null;state.listening=false;
 if(rec){rec.onresult=null;rec.onend=null;rec.onerror=null;try{rec.abort();}catch{}}
}
function stopAudio(){
 state.requestSeq++;
 try{state.controller?.abort();}catch{}
 state.controller=null;
 const audio=state.audio;state.audio=null;if(audio){audio.onended=audio.onerror=null;try{audio.pause();audio.removeAttribute('src');audio.load();}catch{}}
 state.speaking=false;window.jarvisVoiceSpeaking=false;
}
function pause(){state.paused=true;state.thinking=false;clearTimers();stopMic();stopAudio();status('Pausado. Toque em Retomar.','paused');render();}
function close(){
 state.active=false;state.paused=false;state.thinking=false;clearTimers();stopMic();stopAudio();
 const dlg=$('vini-voice-studio');if(dlg?.open)dlg.close();
 window.jarvisSetMood?.('idle');
}
function schedule(ms=300){
 clearTimeout(state.retry);
 if(!state.active||state.paused||state.thinking||state.speaking||state.listening)return;
 state.retry=setTimeout(listen,ms);
}
function listen(){
 if(!state.active||state.paused||state.thinking||state.speaking||state.listening)return;
 const Ctor=Rec();if(!Ctor){status('Este navegador não permite reconhecer fala. Use Chrome atualizado.','error');return;}
 const rec=new Ctor();state.rec=rec;state.pending='';
 rec.lang='pt-BR';rec.continuous=false;rec.interimResults=true;
 rec.onresult=e=>{
  let done='',interim='';
  for(let i=e.resultIndex;i<e.results.length;i++){
   const v=String(e.results[i][0]?.transcript||'').trim();
   if(e.results[i].isFinal)done+=' '+v;else interim+=' '+v;
  }
  if(interim)$('vs-heard').textContent=interim.trim();
  if(done.trim()){state.pending=done.trim();state.thinking=true;status('Preparando resposta…','thinking');try{rec.stop();}catch{}}
 };
 rec.onerror=e=>{
  if(['not-allowed','service-not-allowed','audio-capture'].includes(e.error)){
   state.paused=true;status('Microfone bloqueado. Confira as permissões.','error');render();
  }else if(e.error!=='no-speech'&&e.error!=='aborted'){
   state.err++;status('Reconhecimento interrompido: '+e.error,'error');
  }
 };
 rec.onend=()=>{
  if(state.rec!==rec)return;state.rec=null;state.listening=false;
  if(!state.active||state.paused)return;
  const phrase=state.pending.trim();state.pending='';
  if(phrase){submit(phrase);return;}
  if(!state.thinking)schedule(Math.min(2000,450+state.err*300));
 };
 try{rec.start();state.listening=true;state.err=0;status('Ouvindo em português brasileiro…','listening');window.jarvisSetMood?.('listening');}
 catch{state.rec=null;state.listening=false;state.err++;if(state.err<4)schedule(950);else status('Microfone indisponível. Retome a sessão.','error');}
}
function submit(text){
 if(!state.active||state.paused)return;
 const form=$('chat-form'),field=$('chat-message');
 if(!form||!field){status('Abra uma conversa de projeto antes de iniciar.','error');state.thinking=false;return;}
 const now=Date.now();if(text===state.lastFinal&&now-state.lastFinalAt<1600){state.thinking=false;schedule();return;}
 state.lastFinal=text;state.lastFinalAt=now;append(text,'user');$('vs-heard').textContent='';
 state.thinking=true;status('VINI está respondendo…','thinking');
 try{field.value=text;form.requestSubmit();}
 catch{state.thinking=false;status('Falha ao enviar mensagem.','error');schedule(1000);return;}
 clearTimeout(state.watchdog);state.watchdog=setTimeout(()=>{if(!state.active||!state.thinking)return;state.thinking=false;status('Sem resposta do VINI. Consulte o chat.','error');schedule(800);},60000);
}
function audioReady(url,seq,preview=false){
 if(!state.active||state.paused||seq!==state.requestSeq)return;
 const audio=new Audio(url);state.audio=audio;
 audio.onended=audio.onerror=()=>{
  if(seq!==state.requestSeq)return;
  state.audio=null;state.speaking=false;window.jarvisVoiceSpeaking=false;
  if(state.active&&!state.paused){status('Pode falar novamente.','listening');schedule(300);}
  render();
 };
 audio.play().catch(()=>{if(seq!==state.requestSeq)return;state.audio=null;state.speaking=false;status('O Android bloqueou o áudio. Toque em Ouvir amostra novamente.','error');render();schedule(500);});
 status(preview?'Reproduzindo amostra da OpenAI…':'VINI falando com voz da OpenAI.','speaking');render();
}
async function speak(text,preview=false){
 const clean=String(text||'').replace(/https?:\/\/\S+/g,'').replace(/[*#_]/g,'').trim().slice(0,480);
 if(!preview){clearTimeout(state.watchdog);state.thinking=false;if(clean)append(clean,'vini');}
 if(!clean){schedule();return;}
 if(!settings.approved){
  status('Voz OpenAI desativada até autorizar o custo no Estúdio de Voz. Sem voz robotizada.','error');
  schedule(600);return;
 }
 stopMic();stopAudio();
 state.speaking=true;window.jarvisVoiceSpeaking=true;render();
 const seq=state.requestSeq;
 status('Gerando áudio natural na Cloudflare…','thinking');
 const ctrl=new AbortController();state.controller=ctrl;
 try{
  const data=await api('/voice/tts',{method:'POST',body:{
    confirm:'ACEITO_CUSTO_VOZ_OPENAI',text:clean,voice:settings.voice,speed:Number(settings.rate)
  },signal:ctrl.signal});
  if(seq!==state.requestSeq||!state.active||state.paused)return;
  if(typeof data.audioUrl!=='string'||!/^https:\/\/[a-z0-9.-]+\.r2\.dev\//i.test(data.audioUrl))throw Error('URL de áudio inválida.');
  audioReady(data.audioUrl,seq,preview);
 }catch(e){
  if(seq!==state.requestSeq)return;
  state.speaking=false;window.jarvisVoiceSpeaking=false;
  status('Voz OpenAI indisponível: '+String(e.message||e).slice(0,180),'error');
  render();schedule(800);
 }
}
async function open(){
 if(!Rec()){alert('Reconhecimento de fala indisponível no navegador. Use Chrome Android.');return;}
 const dlg=$('vini-voice-studio');if(!dlg.open)dlg.showModal();
 state.active=true;state.paused=false;state.thinking=false;
 $('vs-project').textContent='Projeto: '+($('vc-top-project')?.selectedOptions?.[0]?.textContent||'conversa atual');
 render();
 try{
  const info=await api('/voice/tts');state.info=info;
  $('vs-voice-info').textContent='OpenAI TTS-1 · Cota '+(info.usedCharacters||0)+'/'+(info.limitCharacters||LIMIT)+' caracteres/dia. Configuração financeira na Cloudflare necessária.';
 }catch{status('Entre com sua chave de acesso para consultar a voz na Cloudflare.','error');}
 if(!settings.approved)status('Autorize a voz OpenAI no painel abaixo; o microfone ainda não foi ativado.','paused');
 else{status('Preparando escuta…');listen();}
}
function populate(){
 const s=$('vs-voices');s.replaceChildren();
 for(const [id,name] of VOICES){const o=make('option','',name);o.value=id;s.append(o);}
 if(VOICES.some(v=>v[0]===settings.voice))s.value=settings.voice;else{settings.voice='nova';s.value='nova';}
 const speed=$('vs-rate');speed.value=String(settings.rate);
 render();
}
function mount(){
 if($('vini-voice-studio'))return;
 const dlg=make('dialog','vs-dialog');dlg.id='vini-voice-studio';dlg.setAttribute('aria-label','Estúdio de Voz IA OpenAI');
 const root=make('div','vs-shell'),head=make('header','vs-head'),brand=make('div');
 brand.append(make('small','','VINI MASTER AI · OPENAI VOICE'),make('h2','','Conversa natural'));
 const closeBtn=make('button','vs-x','✕');closeBtn.type='button';closeBtn.setAttribute('aria-label','Fechar voz');head.append(brand,closeBtn);root.append(head);
 const p=make('p','vs-project','Conversa atual');p.id='vs-project';root.append(p);
 const visual=make('div','vs-visual');visual.id='vs-visual';visual.append(make('div','vs-orbit'),make('div','vs-pulse'),make('div','vs-core'));
 const label=make('p','vs-mode-label','Esfera neural');label.id='vs-mode-label';visual.append(label);root.append(visual);
 const st=make('p','vs-status','Pronto');st.id='vs-status';st.setAttribute('role','status');st.setAttribute('aria-live','polite');root.append(st);
 const heard=make('p','vs-heard','');heard.id='vs-heard';heard.setAttribute('aria-live','polite');root.append(heard);
 const modes=make('div','vs-modes');
 for(const [id,txt] of [['orb','Esfera'],['robot','Robô VINI'],['network','Rede neural']]){
  const b=make('button','vs-mode',txt);b.type='button';b.dataset.vsMode=id;b.addEventListener('click',()=>{settings.mode=id;save();render();});modes.append(b);
 }root.append(modes);
 const out=make('div','vs-log');out.id='vs-log';out.setAttribute('aria-label','Transcrição da sessão');out.append(make('p','vs-placeholder','Selecione uma voz e autorize o custo para ouvir respostas naturais de IA.'));root.append(out);
 const controls=make('div','vs-controls');
 for(const [id,title] of [['vs-toggle','Pausar'],['vs-interrupt','Interromper'],['vs-end','Encerrar']]){
  const b=make('button','vs-btn',title);b.id=id;b.type='button';controls.append(b);
 }root.append(controls);
 const settingsBox=make('details','vs-settings');settingsBox.open=true;settingsBox.append(make('summary','','Voz OpenAI · selecionar e testar'));
 const row=make('div','vs-row'),lbl=make('label','','Voz natural');lbl.htmlFor='vs-voices';
 const sel=make('select');sel.id='vs-voices';row.append(lbl,sel);
 const preview=make('button','vs-sample','Ouvir amostra OpenAI');preview.id='vs-sample';preview.type='button';row.append(preview);settingsBox.append(row);
 const line=make('div','vs-row'),rlabel=make('label','','Velocidade');rlabel.htmlFor='vs-rate';
 const rate=make('input');rate.type='range';rate.min='.8';rate.max='1.25';rate.step='.05';rate.id='vs-rate';line.append(rlabel,rate);settingsBox.append(line);
 const cons=make('button','vs-consent','Autorizar voz OpenAI (até US$ 0,03 por dia)');cons.type='button';cons.id='vs-consent';
 settingsBox.append(cons);
 const inf=make('p','vs-disclaimer','Modelo: openai/tts-1 via Cloudflare AI Gateway. Voz gerada por IA; não é a voz do celular. Requer créditos de AI Gateway. Sem streaming WebSocket ou segundo plano nesta versão.');inf.id='vs-voice-info';
 settingsBox.append(inf);root.append(settingsBox);dlg.append(root);document.body.append(dlg);
 closeBtn.addEventListener('click',close);dlg.addEventListener('cancel',e=>{e.preventDefault();close();});
 $('vs-toggle').addEventListener('click',()=>{if(state.paused){if(!settings.approved){status('Autorize a voz OpenAI antes de retomar.','error');return;}state.paused=false;state.thinking=false;render();schedule(100);}else pause();});
 $('vs-interrupt').addEventListener('click',()=>{stopAudio();state.thinking=false;render();status('Pode falar novamente.','listening');schedule(100);});
 $('vs-end').addEventListener('click',close);
 sel.addEventListener('change',()=>{settings.voice=sel.value;save();});
 rate.addEventListener('input',()=>{settings.rate=Number(rate.value);save();});
 cons.addEventListener('click',()=>{
  if(settings.approved){settings.approved=false;save();pause();cons.textContent='Autorizar voz OpenAI (até US$ 0,03 por dia)';return;}
  if(!confirm('Autorizar geração de voz OpenAI via Cloudflare AI Gateway? Custa US$ 0,000015 por caractere, limitado a 2.000 caracteres (aproximadamente US$ 0,03 de inferência) por dia UTC. Créditos na Cloudflare são necessários.'))return;
  settings.approved=true;save();cons.textContent='Desativar voz OpenAI';state.paused=false;status('Autorizado. Pode falar.','listening');schedule(150);
 });
 preview.addEventListener('click',()=>{
  if(!settings.approved){status('Primeiro autorize o custo da voz OpenAI abaixo.','error');return;}
  speak('Olá! Sou o VINI. Agora você pode escolher minha voz natural em português brasileiro.',true);
 });
 populate();cons.textContent=settings.approved?'Desativar voz OpenAI':'Autorizar voz OpenAI (até US$ 0,03 por dia)';render();
}
function init(){
 mount();
 // Never call the previous browser speechSynthesis implementation automatically.
 window.jarvisSpeakReply=(text)=>{if(state.active&&!state.paused)speak(text);};
 for(const id of ['jarvis-chat-mic','jarvis-dock-mic']){
  const b=$(id);if(!b)continue;
  b.setAttribute('aria-label','Abrir Estúdio de Voz IA');
  b.addEventListener('click',event=>{event.preventDefault();event.stopImmediatePropagation();state.active?close():open();},true);
 }
 const button=make('button','vs-open','◉ Voz de IA');button.type='button';button.addEventListener('click',open);
 const host=$('section-chat')?.querySelector('.vini-chat-actions');if(host)host.append(button);
 window.viniVoice={open,close,pause,status:()=>({active:state.active,paused:state.paused,provider:'OpenAI via Cloudflare',deviceSpeech:false,streaming:false})};
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();