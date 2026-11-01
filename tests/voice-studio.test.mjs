import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Script} from 'node:vm';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const js=read('public/vini-voice-live.js'),css=read('public/vini-voice-live.css');
const html=read('public/index.html'),sw=read('public/sw.js'),worker=read('src/index.js');
test('voice frontend parses without local npm dependencies',()=>assert.doesNotThrow(()=>new Script(js)));
test('voice studio loads after existing authenticated chat integration',()=>{
 assert.ok(html.indexOf('vini-voice-live.js?v=25')>html.indexOf('jarvis.js?v=25'));
 assert.ok(html.indexOf('vini-voice-live.css?v=24')>html.indexOf('vini-reference.css?v=21'));
 assert.match(worker,/version:'0\.17\.6'/);
});
test('PWA refresh contains natural voice and office recovery assets',()=>{
 assert.match(sw,/vini-master-shell-v25/);
 for(const s of ['vini-voice-live.js','vini-voice-live.css','vini-office-recovery.css'])assert.ok(sw.includes(s));
});
test('Portuguese microphone with natural OpenAI TTS replaces robotic device voice',()=>{
 for(const word of ['SpeechRecognition','pt-BR','new Audio(url)','voice/tts','vini-voice-r4'])assert.ok(js.includes(word),word);
 assert.doesNotMatch(js,/\bwindow\.speechSynthesis\b|new SpeechSynthesisUtterance/);
 assert.match(js,/localStorage\.setItem/);
});
test('voice turns feed the existing authenticated chat, not a separate memory',()=>{
 for(const s of ['chat-form','chat-message','requestSubmit','window.jarvisSpeakReply='])assert.ok(js.includes(s),s);
 assert.doesNotMatch(js,/fetch\(['"]\/api\/chat/);
});
test('3 visual modes, keyboard and reduced motion are retained',()=>{
 for(const part of ['orb','robot','network','vs-toggle','vs-end'])assert.ok(js.includes(part),part);
 assert.match(css,/ref-robot\.webp/);assert.match(css,/ref-neural\.webp/);
 assert.match(css,/prefers-reduced-motion/);assert.match(js,/aria-live/);
});
test('disclosure says no native audio streaming and enforces explicit paid consent',()=>{
 assert.match(js,/ACEITO_CUSTO_VOZ_OPENAI/);
 assert.match(js,/Sem voz robotizada/);
 assert.match(js,/Sem streaming WebSocket/);
 assert.match(worker,/voiceStreaming:false/);
 assert.doesNotMatch(js,/new WebSocket/);
});
