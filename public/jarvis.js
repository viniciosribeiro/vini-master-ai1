/* JARVIS — mobile-first robotic interface. All work statuses originate in the D1 API. */
(() => {
"use strict";
const $=id=>document.getElementById(id);
const labels={supervisor:"VINI",programador:"Dev",designer:"Design",qa:"QA",infra:"Infra",pesquisa:"Pesquisa"};
const specialties={supervisor:"Supervisor",programador:"Programação",designer:"Interface",qa:"Testes",infra:"Deploy",pesquisa:"Pesquisa"};
const icons={chat:"M20 11a7.5 7.5 0 0 1-7.5 7.5H8l-4 3v-5A7.5 7.5 0 1 1 20 11Z",office:"M3 18V7l9-4 9 4v11l-9 4-9-4ZM3 7l9 5 9-5M12 12v10",projects:"M3 7h7l2 2h9v11H3z",missions:"M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01",memory:"M12 3a5 5 0 0 0-5 7.5A5 5 0 0 0 8 20h8a5 5 0 0 0 1-9.5A5 5 0 0 0 12 3Z",settings:"M12 3v3m0 12v3m9-9h-3M6 12H3m15-6-2 2M8 16l-2 2m12 0-2-2M8 8 6 6M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6"};
function robot(){return '<span class="rb-aura"></span><span class="rb-figure"><span class="rb-antenna"></span><span class="rb-left-ear"></span><span class="rb-right-ear"></span><span class="rb-head"><span class="rb-face"><i class="rb-eye"></i><i class="rb-smile"></i><i class="rb-eye"></i></span></span><span class="rb-body"><i class="rb-logo">V</i></span><span class="rb-feet"></span></span>';}
document.querySelectorAll('.station[data-agent]').forEach(station=>{
 const id=station.dataset.agent,unit=document.createElement('span');
 unit.className='jarvis-unit';unit.innerHTML=robot()+'<span class="rb-console" aria-hidden="true"><span class="rb-screen"><i></i><i></i><i></i></span></span>';
 station.insertBefore(unit,station.querySelector('.station-label'));
 station.querySelector('.station-label b').textContent=labels[id]||id;
 station.setAttribute('aria-label','Abrir estação de '+(specialties[id]||id));
});
const hero=$('jarvis-chat-hero');
if(hero){const ring=document.createElement('div');ring.className='jarvis-core-ring';const figure=document.createElement('div');figure.className='jarvis-hero-unit';figure.innerHTML=robot();ring.append(figure);hero.querySelector('.jarvis-core')?.append(ring);}
document.querySelectorAll('.sidebar .nav').forEach(b=>{
 const section=b.dataset.section,label=b.querySelector('span');
 if(label)label.textContent=({chat:'Chat',office:'Escritório',projects:'Projetos',missions:'Missões',memory:'Memória',settings:'Ajustes',agents:'Agentes'})[section]||label.textContent;
 const svg=document.createElement('span');svg.innerHTML='<svg class="nav-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="'+(icons[section]||icons.office)+'" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';
 b.prepend(svg.firstChild);
 for(const child of Array.from(b.childNodes)){if(child.nodeType===3&&child.textContent.trim())child.textContent='';}
 b.addEventListener('click',()=>document.body.dataset.jarvisScreen=section);
});
function switchTo(section){const nav=document.querySelector('.sidebar .nav[data-section="'+section+'"]');if(nav)nav.click();document.body.dataset.jarvisScreen=section;}
function sendFromAnywhere(text){
 if(!String(text||'').trim())return;
 switchTo('chat');
 $('chat-message').value=String(text).trim();
 $('chat-form').requestSubmit();
}
const dock=document.createElement('div');dock.className='jarvis-dock';dock.id='jarvis-dock';
dock.innerHTML='<button type="button" id="jarvis-open-chat" class="jarvis-dock-open" aria-label="Abrir conversa"><b>V</b></button><form id="jarvis-dock-form"><label class="sr-only" for="jarvis-dock-message">Mensagem ao VINI</label><input id="jarvis-dock-message" placeholder="Converse com o VINI..." maxlength="8000" autocomplete="off"><button class="dock-send" type="submit" aria-label="Enviar mensagem">➤</button></form><button type="button" id="jarvis-dock-mic" class="jarvis-voice-btn" aria-label="Conversar por voz" aria-pressed="false">🎙</button>';
document.body.append(dock);
$('jarvis-open-chat').addEventListener('click',()=>switchTo('chat'));
$('jarvis-dock-form').addEventListener('submit',e=>{e.preventDefault();const field=$('jarvis-dock-message'),value=field.value;field.value='';sendFromAnywhere(value);});
const requested=new URLSearchParams(location.search).get('tab');
switchTo(['office','projects','missions','memory','settings'].includes(requested)?requested:'chat');
const tagline=document.querySelector('.subhead');if(tagline)tagline.textContent='JARVIS · Central Inteligente';
const sheet=document.createElement('dialog');sheet.id='jarvis-agent-sheet';sheet.className='jarvis-agent-sheet';
sheet.innerHTML='<div class="sheet-top"><strong id="jarvis-sheet-title">Agente</strong><button id="jarvis-sheet-close" aria-label="Fechar" type="button">×</button></div><div class="jarvis-sheet-bot"></div><p id="jarvis-sheet-status"></p><div id="jarvis-sheet-content"></div><button class="jarvis-sheet-chat" type="button">Conversar com o supervisor</button><button class="jarvis-sheet-log" type="button">◉ Ver ações reais e histórico deste agente</button>';
document.body.append(sheet);
$('jarvis-sheet-close').addEventListener('click',()=>sheet.close());
sheet.addEventListener('click',e=>{if(e.target===sheet)sheet.close();});
sheet.querySelector('.jarvis-sheet-chat').addEventListener('click',()=>{sheet.close();switchTo('chat');});
sheet.querySelector('.jarvis-sheet-log').addEventListener('click',()=>{
 const agent=sheet.dataset.agent||'all';sheet.close();window.jarvisOpenLive?.(agent);
});
document.querySelectorAll('.station[data-agent]').forEach(station=>{
 station.addEventListener('click',e=>{
  e.stopImmediatePropagation();e.preventDefault();
  sheet.dataset.agent=station.dataset.agent;
  const id=station.dataset.agent,a=typeof state!=='undefined'?state.agents.find(x=>x.id===id):null,r=typeof state!=='undefined'?state.runs.find(x=>x.agent_id===id):null;
  $('jarvis-sheet-title').textContent=(a?.name||labels[id]||id)+' · '+specialties[id];
  sheet.querySelector('.jarvis-sheet-bot').innerHTML=robot();
  const expression=station.dataset.expression;
  $('jarvis-sheet-status').textContent=expression==='working'?'● Trabalhando de verdade':expression==='waiting'?'◌ Aguardando Workflow':expression==='success'?'● Etapa concluída':expression==='error'?'● Falha registrada':'● Sem trabalho ativo';
  $('jarvis-sheet-content').textContent=r?.output||station.querySelector('.agent-popup')?.textContent||'Sem resultados recentes registrados.';
  sheet.showModal();
 },true);
});
$('jarvis-chat-office')?.addEventListener('click',()=>switchTo('office'));
$('jarvis-chat-activities')?.addEventListener('click',()=>switchTo('office'));
const gear=document.createElement('button');
gear.type='button';gear.className='mobile-settings';gear.setAttribute('aria-label','Abrir configurações');gear.textContent='⚙';
document.querySelector('.top-actions')?.append(gear);
gear.addEventListener('click',()=>switchTo('settings'));
const engines=document.querySelector('.engines'),settings=document.querySelector('#section-settings .padded'),officeBottom=document.querySelector('#section-office .bottom');
function placeEngines(){
 if(window.innerWidth<=780&&engines&&settings&&!settings.contains(engines))settings.append(engines);
 if(window.innerWidth>780&&engines&&officeBottom&&!officeBottom.contains(engines))officeBottom.append(engines);
}
placeEngines();window.addEventListener('resize',placeEngines);

$('jarvis-chat-new')?.addEventListener('click',()=>$('begin-project-chat')?.click());
function setRobotMood(mood){
 const el=document.querySelector('#jarvis-chat-hero .jarvis-hero-unit');
 if(el)el.dataset.expression=mood;
 const active=document.getElementById('jarvis-voice-status');
 if(active&&mood==='thinking')active.textContent='VINI está pensando…';
 if(active&&mood==='idle'&&!window.jarvisVoiceSpeaking)active.textContent='Fale comigo ou digite sua mensagem';
}
window.jarvisSetMood=setRobotMood;
window.jarvisVoiceSpeaking=false;
const Rec=window.SpeechRecognition||window.webkitSpeechRecognition;let rec=null,listening=false,voiceEnabled=false;
const mics=()=>[$('jarvis-chat-mic'),$('jarvis-dock-mic')].filter(Boolean);
function voiceStatus(text){const status=$('jarvis-voice-status');if(status)status.textContent=text;}
function setListening(value){listening=value;mics().forEach(b=>{b.classList.toggle('listening',value);b.setAttribute('aria-pressed',String(value));});setRobotMood(value?'listening':window.jarvisVoiceSpeaking?'speaking':'idle');voiceStatus(value?'Estou ouvindo…':'Fale comigo ou digite sua mensagem');}
function startVoice(){
 if(typeof window.viniVoice?.open==='function')window.viniVoice.open();
 else voiceStatus('Estúdio de Voz IA indisponível. Atualize o aplicativo.');
}
mics().forEach(b=>b.addEventListener('click',startVoice));
function disableVoiceOnTyping(){voiceEnabled=false;window.jarvisVoiceSpeaking=false;setRobotMood('idle');}
$('chat-message')?.addEventListener('input',disableVoiceOnTyping);
$('jarvis-dock-message')?.addEventListener('input',disableVoiceOnTyping);

// Old browser TTS intentionally disabled. The natural-voice module replaces this handler.
window.jarvisSpeakReply=()=>{};
const history=$('messages');
if(history&&window.MutationObserver){
 const observer=new MutationObserver(()=>document.body.classList.toggle('jarvis-has-history',history.children.length>=3));
 observer.observe(history,{childList:true});
}
window.renderJarvisMonitor=()=>{
 if(typeof state==='undefined')return;
 const running=(state.codeJobs||[]).filter(j=>j.status==='working');
 const subtitle=$('jarvis-team-subtitle');
 if(subtitle)subtitle.textContent=running.length?running.length+' tarefa(s) de programação em andamento':'Atividades registradas no D1, sem progresso inventado';
 document.querySelectorAll('.station').forEach(s=>s.querySelector('.jarvis-unit')?.classList.toggle('robot-working',s.dataset.status==='working'));
};
})();
