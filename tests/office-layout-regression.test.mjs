import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Script} from 'node:vm';
const load=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const css=load('public/vini-reference.css');
const js=load('public/vini-reference.js');
const html=load('public/index.html');
const sw=load('public/sw.js');
const worker=load('src/index.js');

test('Original interactive office and timeline are visible (regression fix)',()=>{
 assert.match(css,/#section-office>\.workspace>\.office\{display:block!important/);
 assert.doesNotMatch(css,/#section-office>\.workspace>\.office\{display:none!important/);
 assert.match(css,/#section-office>\.workspace\{display:grid!important/);
 assert.match(css,/#section-office>\.workspace>\.activity\{min-width:0;width:auto/);
 assert.match(html,/<section id="section-office"/);
 assert.match(html,/class="office panel"/);
 assert.match(html,/class="activity panel(?: |")/);
});
test('Supervisor and specialist office cards remain visible and responsive',()=>{
 assert.match(css,/\.vc-office-center\{display:grid!important/);
 assert.doesNotMatch(css,/\.vc-office-center\{display:none!important/);
 assert.match(css,/#section-office \.vc-office-grid\{display:flex!important;flex-direction:column!important/);
 assert.match(css,/#section-office \#vc-office-left\{order:1!important/);
 assert.match(css,/#section-office \#vc-office-right\{order:2!important/);
 assert.match(html,/(?:class="station|data-agent=)/);
});
test('The static illustration is optional and cannot conceal the real agents',()=>{
 assert.doesNotThrow(()=>new Script(js));
 assert.match(js,/E\('details','vr-scene-details'\)/);
 assert.match(js,/grid\.insertAdjacentElement\('afterend',sceneDetails\)/);
 assert.doesNotMatch(js,/office\.insertBefore\(scene,grid\)/);
 assert.match(css,/\.vr-scene-details>summary/);
});
test('Navigation still exposes agents and office on mobile',()=>{
 assert.match(html,/data-section="agents"/);
 assert.match(html,/data-section="office"/);
 assert.match(css,/\.sidebar \.nav\[data-section="agents"\]\{display:flex!important\}/);
});
test('Old PWA cache cannot keep previous broken reference styles',()=>{
 assert.match(sw,/vini-master-shell-v26/);
 assert.match(html,/vini-reference\.js\?v=22/);
 assert.match(html,/vini-reference\.css\?v=21/);
 assert.match(html,/Control Center R4 0\.17\.7/);
 assert.match(worker,/version:'0\.17\.7'/);
});
test('No destructive data or secret change in visual rollback',()=>{
 assert.match(worker,/officeAgentsRestored:true/);
 assert.ok(!/localStorage\.clear|indexedDB\.deleteDatabase|deleteAllCaches/.test(js));
});

test('Agents navigation label stays explicitly visible after all scripts run',()=>{
 const base=load('public/vini-control.js');
 assert.match(base,/label\.textContent='Agentes'/);
 assert.match(js,/program\.textContent='Agentes'/);
 assert.match(html,/data-section="agents"><span>Agentes<\/span>/);
 assert.doesNotMatch(base,/label\.textContent='Rede Neural'/);
 assert.doesNotMatch(js,/program\.textContent='Rede Neural'/);
});
test('Voice launcher stays in chat actions instead of shifting the entire conversation panel',()=>{
 const voice=load('public/vini-voice-live.js');
 const voiceCss=load('public/vini-voice-live.css');
 assert.match(voice,/querySelector\('\.vini-chat-actions'\)/);
 assert.match(voice,/host\.append\(button\)/);
 assert.doesNotMatch(voice,/section\.prepend\(button\)/);
 assert.match(voiceCss,/\.vini-chat-actions\{display:flex;flex-wrap:wrap;/);
 assert.match(html,/vini-voice-live\.js\?v=26/);
 assert.match(html,/vini-voice-live\.css\?v=25/);
});

test('Agent cards are attached inside the detached office before insertion',()=>{
 const code=load('public/vini-control.js');
 assert.match(code,/office\.querySelector\('#vc-office-left'\)/);
 assert.doesNotMatch(code,/by\(i%2\?'vc-office-right':'vc-office-left'\)\.append/);
});
