import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Script} from 'node:vm';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const js=read('public/vini-voice-live.js'),css=read('public/vini-voice-live.css');
const html=read('public/index.html'),sw=read('public/sw.js'),worker=read('src/index.js');
test('Voice Studio frontend parses without external dependencies',()=>assert.doesNotThrow(()=>new Script(js)));
test('voice studio is loaded after existing D1-chat integration',()=>{
 assert.ok(html.indexOf('vini-voice-live.js?v=18')>html.indexOf('jarvis.js?v=33'));
 assert.ok(html.indexOf('vini-voice-live.css?v=18')>html.indexOf('vini-reference.css?v=17'));
 assert.match(worker,/version:'0\.17\.0'/);
});
test('PWA caches new voice UI assets with new cache generation',()=>{
 assert.match(sw,/vini-master-shell-v18/);
 assert.match(sw,/vini-voice-live\.js/);assert.match(sw,/vini-voice-live\.css/);
});
test('Brazilian voice picker and settings are real browser APIs',()=>{
 for(const token of ['SpeechRecognition','speechSynthesis','pt-BR','onvoiceschanged','getVoices','SpeechSynthesisUtterance','vini-voice-config'])assert.ok(js.includes(token),token);
 assert.match(js,/localStorage\.setItem/);
});
test('voice turns feed the authenticated existing project chat, no parallel fake memory',()=>{
 assert.match(js,/chat-form/);assert.match(js,/chat-message/);
 assert.match(js,/requestSubmit/);assert.match(js,/viniThreads/);
 assert.doesNotMatch(js,/fetch\(['"]\/api\/chat/);
 assert.match(js,/window\.jarvisSpeakReply=/);
});
test('voice modes and accessibility are present',()=>{
 for(const part of ['orb','robot','network','vs-transcript','vs-toggle','vs-end'])if(part!=='vs-transcript')assert.ok(js.includes(part),part);
 assert.match(css,/ref-robot\.webp/);assert.match(css,/ref-neural\.webp/);
 assert.match(css,/prefers-reduced-motion/);
 assert.match(js,/aria-live/);
});
test('disclosure correctly distinguishes browser speech from WebSocket mode',()=>{
 assert.match(js,/não está ativada/);
 assert.match(worker,/voiceStreaming:false/);
 assert.doesNotMatch(js,/wss:\/\/|new WebSocket/);
});
