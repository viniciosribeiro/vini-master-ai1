/* VINI Master AI Voice Studio — R1: real browser-based continuous turns.
   Messages go through the existing authenticated D1 chat and current project.
   This is NOT the planned Cloudflare WebSocket streaming voice engine. */
(()=>{
'use strict';
const $=id=>document.getElementById(id);
const Rec=()=>window.SpeechRecognition||window.webkitSpeechRecognition;
const el=(tag,cls,text)=>{const v=document.createElement(tag);if(cls)v.className=cls;if(text!==undefined)v.textContent=String(text);return v;};
let settings={mode:'orb',voice:'',rate:1,pitch:1};
try{settings={...settings,...JSON.parse(localStorage.getItem('vini-voice-config')||'{}')};}catch{}
const save=()=>{try{localStorage.setItem('vini-voice-config',JSON.stringify(settings));}catch{}};
const s={active:false,paused:false,listening:false,thinking:false,speaking:false,rec:null,timer:null,timeout:null,voices:[],oldSpeak:null,pending:'',errors:0};
function status(msg,kind='idle'){$('vs-status').textContent=msg;$('vini-voice-studio').dataset.status=kind;}
function badge(){const v=$('vs-visual');v.dataset.mode=settings.mode;$('vs-mode-label').textContent={orb:'Esfera neural',robot:'Robô VINI',network:'Rede neural viva'}[settings.mode];document.querySelectorAll('[data-vs-mode]').forEach(x=>x.setAttribute('aria-pressed',String(x.dataset.vsMode===settings.mode)));}
function log(text,who){const root=$('vs-log'),v=el('p','vs-line vs-'+who,text);root.append(v);while(root.children.length>12)root.firstElementChild.remove();root.scrollTop=root.scrollHeight;}
function clearTimers(){clearTimeout(s.timer);clearTimeout(s.timeout);s.timer=null;s.timeout=null;}
function stopRec(){if(!s.rec)return;const r=s.rec;s.rec=null;s.listening=false;r.onresult=null;r.onend=null;r.onerror=null;try{r.abort();}catch{}}
function stopSpeak(){try{speechSynthesis.cancel();}catch{}s.speaking=false;window.jarvisVoiceSpeaking=false;}
function pause(){s.paused=true;s.thinking=false;clearTimers();stopRec();stopSpeak();status('Pausado. Toque em Retomar.','paused');sync();}
function close(){s.active=false;s.paused=false;s.thinking=false;clearTimers();stopRec();stopSpeak();if($('vini-voice-studio').open)$('vini-voice-studio').close();window.jarvisSetMood?.('idle');}
function sync(){$('vs-toggle').textContent=s.paused?'Retomar':'Pausar';$('vs-interrupt').disabled=!s.speaking;badge();}
function later(ms=400){clearTimeout(s.timer);if(s.active&&!s.paused&&!s.thinking&&!s.speaking)s.timer=setTimeout(listen,ms);}
function send(phrase){
 if(!s.active||s.paused)return;
 const form=$('chat-form'),field=$('chat-message');
 if(!form||!field){status('Não encontrei o chat atual.','error');return;}
 s.thinking=true;log(phrase,'user');$('vs-heard').textContent='';status('VINI está preparando a resposta…','thinking');
 const nav=document.querySelector('.sidebar .nav[data-section="chat"]');nav?.click();
 try{field.value=phrase;form.requestSubmit();}
 catch(e){s.thinking=false;status('Falha no envio: '+e.message,'error');later(900);return;}
 clearTimeout(s.timeout);s.timeout=setTimeout(()=>{if(!s.active||!s.thinking)return;s.thinking=false;status('Resposta de voz não recebida; verifique o chat.','error');later(600);},60000);
}
function listen(){
 if(!s.active||s.paused||s.thinking||s.speaking||s.listening)return;
 if(!Rec()){status('Reconhecimento não disponível neste navegador.','error');return;}
 const rec=new (Rec())();s.rec=rec;s.pending='';
 rec.lang='pt-BR';rec.interimResults=true;rec.continuous=false;
 rec.onresult=e=>{
  let done='',live='';
  for(let i=e.resultIndex;i<e.results.length;i++){const t=String(e.results[i][0]?.transcript||'').trim();if(e.results[i].isFinal)done+=' '+t;else live+=' '+t;}
  if(live)$('vs-heard').textContent=live.trim();
  if(done.trim()){s.pending=done.trim();s.thinking=true;status('Entendi. Enviando ao VINI…','thinking');try{rec.stop();}catch{}}
 };
 rec.onerror=e=>{
  if(['not-allowed','service-not-allowed','audio-capture'].includes(e.error)){s.paused=true;status('Permissão de microfone negada ou dispositivo indisponível.','error');sync();}
  else if(e.error!=='no-speech'&&e.error!=='aborted'){s.errors++;status('Reconhecimento: '+e.error,'error');}
 };
 rec.onend=()=>{
  if(s.rec!==rec)return;s.rec=null;s.listening=false;
  if(!s.active||s.paused)return;
  if(s.pending){const text=s.pending;s.pending='';send(text);return;}
  if(!s.thinking)later(Math.min(2500,400+s.errors*300));
 };
 try{rec.start();s.listening=true;s.errors=0;status('Ouvindo… pode falar','listening');window.jarvisSetMood?.('listening');}
 catch{ s.rec=null;s.listening=false;s.errors++;if(s.errors<4)later(900);else status('Não foi possível iniciar o microfone.','error');}
}
function pickVoice(){return s.voices.find(x=>x.voiceURI===settings.voice)||s.voices.find(x=>x.lang?.toLowerCase()==='pt-br')||null;}
function speak(message,preview=false){
 const clean=String(message||'').replace(/https?:\/\/\S+/g,'').replace(/[*#_]/g,'').trim().slice(0,1800);
 if(!preview){clearTimeout(s.timeout);s.thinking=false;if(clean)log(clean,'vini');}
 if(!clean){later(250);return;}
 if(!window.speechSynthesis||!window.SpeechSynthesisUtterance){status('Síntese de voz indisponível; texto salvo no chat.','error');later();return;}
 stopRec();stopSpeak();
 const u=new SpeechSynthesisUtterance(clean),v=pickVoice();u.lang='pt-BR';if(v)u.voice=v;u.rate=Number(settings.rate)||1;u.pitch=Number(settings.pitch)||1;
 s.speaking=true;window.jarvisVoiceSpeaking=true;status(preview?'Reproduzindo amostra…':'VINI falando. Toque em Interromper para voltar a falar.','speaking');window.jarvisSetMood?.('speaking');
 u.onend=u.onerror=()=>{if(!s.speaking)return;s.speaking=false;window.jarvisVoiceSpeaking=false;if(s.active&&!s.paused){status('Pode falar novamente…','listening');later(250);}sync();};
 try{speechSynthesis.speak(u);}catch{s.speaking=false;later();}
 sync();
}
function populate(){
 const sel=$('vs-voices');s.voices=Array.from(speechSynthesis?.getVoices?.()||[]).filter(v=>v.lang?.toLowerCase().startsWith('pt'));
 sel.replaceChildren();
 if(!s.voices.length){const opt=el('option','','Voz padrão do dispositivo');opt.value='';sel.append(opt);}
 for(const v of s.voices){const opt=el('option','',v.name+' ('+v.lang+')');opt.value=v.voiceURI;sel.append(opt);}
 if(s.voices.some(v=>v.voiceURI===settings.voice))sel.value=settings.voice;
 else{settings.voice=s.voices[0]?.voiceURI||'';sel.value=settings.voice;save();}
 $('vs-voice-info').textContent=s.voices.length+' voz(es) em português disponíveis neste dispositivo';
}
function open(){
 if(!Rec()){alert('Seu navegador não oferece reconhecimento de fala. Use Chrome Android atualizado.');return;}
 const dialog=$('vini-voice-studio');if(!dialog.open)dialog.showModal();
 s.active=true;s.paused=false;s.thinking=false;
 $('vs-project').textContent='Histórico: '+(window.viniThreads?.selected?.()?'conversa selecionada':'conversa atual')+' · '+($('vc-top-project')?.selectedOptions?.[0]?.textContent||'Projeto atual');
 sync();status('Preparando microfone…');listen();
}
function make(){
 if($('vini-voice-studio'))return;
 const dlg=el('dialog','vs-dialog');dlg.id='vini-voice-studio';dlg.setAttribute('aria-label','Modo Voz ao Vivo');
 const wrap=el('div','vs-shell'),header=el('header','vs-head'),brand=el('div');
 brand.append(el('small','','VINI MASTER AI · VOZ'),el('h2','','Conversa ao vivo'));
 const x=el('button','vs-x','✕');x.type='button';x.setAttribute('aria-label','Encerrar voz');header.append(brand,x);wrap.append(header);
 const project=el('p','vs-project','Histórico conectado ao chat');project.id='vs-project';wrap.append(project);
 const art=el('div','vs-visual');art.id='vs-visual';
 art.append(el('div','vs-orbit'),el('div','vs-pulse'),el('div','vs-core'));
 const name=el('p','vs-mode-label','Esfera neural');name.id='vs-mode-label';art.append(name);wrap.append(art);
 const stateLine=el('p','vs-status','Pronto');stateLine.id='vs-status';stateLine.setAttribute('role','status');stateLine.setAttribute('aria-live','polite');wrap.append(stateLine);
 const heard=el('p','vs-heard','');heard.id='vs-heard';heard.setAttribute('aria-live','polite');wrap.append(heard);
 const modes=el('div','vs-modes');for(const [id,label] of [['orb','Esfera'],['robot','Robô'],['network','Rede neural']]){
  const b=el('button','vs-mode',label);b.type='button';b.dataset.vsMode=id;b.addEventListener('click',()=>{settings.mode=id;save();badge();});modes.append(b);
 }wrap.append(modes);
 const logPanel=el('div','vs-log');logPanel.id='vs-log';logPanel.setAttribute('aria-label','Transcrição desta sessão');logPanel.append(el('p','vs-placeholder','Fale com o VINI sobre suas ideias. As mensagens ficam na conversa atual.'));wrap.append(logPanel);
 const controls=el('div','vs-controls');
 for(const [id,label] of [['vs-toggle','Pausar'],['vs-interrupt','Interromper'],['vs-end','Encerrar']]){const b=el('button','vs-btn',label);b.type='button';b.id=id;controls.append(b);}wrap.append(controls);
 const details=el('details','vs-settings');details.append(el('summary','','Escolher voz e personalidade'));
 const row=el('div','vs-row'),lbl=el('label','','Voz em português brasileiro'),sel=el('select');sel.id='vs-voices';lbl.htmlFor='vs-voices';
 row.append(lbl,sel);const preview=el('button','vs-sample','▶ Ouvir amostra');preview.type='button';preview.id='vs-sample';row.append(preview);
 const info=el('small','','');info.id='vs-voice-info';row.append(info);details.append(row);
 for(const [id,title,min,max] of [['rate','Velocidade',.7,1.4],['pitch','Tom',.7,1.3]]){
  const line=el('div','vs-row'),titleEl=el('label','',title),range=el('input');range.type='range';range.id='vs-'+id;range.min=String(min);range.max=String(max);range.step='.05';range.value=String(settings[id]);titleEl.htmlFor=range.id;
  const current=el('output','',String(settings[id]));range.addEventListener('input',()=>{settings[id]=Number(range.value);current.textContent=range.value;save();});line.append(titleEl,range,current);details.append(line);
 }wrap.append(details);
 wrap.append(el('p','vs-disclaimer','Nesta primeira versão, o áudio usa reconhecimento e síntese do navegador. A integração WebSocket da Cloudflare ainda não está ativada.'));
 dlg.append(wrap);document.body.append(dlg);
 x.addEventListener('click',close);
 dlg.addEventListener('cancel',e=>{e.preventDefault();close();});
 $('vs-toggle').addEventListener('click',()=>{if(s.paused){s.paused=false;s.thinking=false;sync();later(150);}else pause();});
 $('vs-interrupt').addEventListener('click',()=>{stopSpeak();s.thinking=false;status('Pode falar.','listening');sync();later(150);});
 $('vs-end').addEventListener('click',close);
 sel.addEventListener('change',()=>{settings.voice=sel.value;save();});
 preview.addEventListener('click',()=>speak('Olá! Eu sou o VINI. Qual ideia vamos transformar em projeto hoje?',true));
 populate();if(speechSynthesis)speechSynthesis.onvoiceschanged=populate;sync();
}
function init(){
 make();
 const old=window.jarvisSpeakReply;s.oldSpeak=old;
 window.jarvisSpeakReply=(message)=>{if(!s.active){if(typeof s.oldSpeak==='function')s.oldSpeak(message);return;}if(!s.paused)speak(message);};
 for(const id of ['jarvis-chat-mic','jarvis-dock-mic']){
  const b=$(id);if(!b)continue;b.setAttribute('aria-label','Abrir estúdio de voz do VINI');
  b.addEventListener('click',event=>{event.preventDefault();event.stopImmediatePropagation();s.active?close():open();},true);
 }
 const button=el('button','vs-open','◉ Voz ao vivo');button.type='button';button.addEventListener('click',open);
 const section=$('section-chat');const actions=section?.querySelector('.vini-chat-actions');
 if(actions)actions.append(button);
 else section?.querySelector('.chat-main-panel')?.append(button);
 window.viniVoice={open,close,pause,status:()=>({active:s.active,paused:s.paused,listening:s.listening,thinking:s.thinking,speaking:s.speaking,engine:'browser-turns'})};
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();