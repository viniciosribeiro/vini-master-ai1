import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Script} from 'node:vm';

const read=p=>readFileSync(new URL('../'+p,import.meta.url));
const text=p=>read(p).toString('utf8');
const html=text('public/index.html');
const css=text('public/vini-reference.css');
const js=text('public/vini-reference.js');
const sw=text('public/sw.js');
const assets=['ref-office.webp','ref-neural.webp','ref-robot.webp','ref-lighthouse.webp','ref-thumb-tour.webp','ref-thumb-stay.webp','ref-thumb-food.webp','ref-thumb-wifi.webp'];

test('all 4 cropped assets from approved reference exist and are genuine WebP',()=>{
 for(const name of assets){
  const bytes=read('public/'+name);
  assert.equal(bytes.toString('ascii',0,4),'RIFF',name);
  assert.equal(bytes.toString('ascii',8,12),'WEBP',name);
  assert.ok(bytes.length>1000,name);
  assert.match(css,new RegExp(name.replace('.','\\.')));
  assert.ok(sw.includes('/'+name));
 }
});
test('R2 CSS loads after legacy and R1 styling and works offline in PWA',()=>{
 assert.ok(html.indexOf('/vini-reference.css')>html.indexOf('/vini-control.css'));
 assert.ok(html.indexOf('/vini-reference.js')>html.indexOf('/vini-control.js'));
 assert.match(sw,/vini-master-shell-v25/);
 assert.match(html,/Control Center R4 0\.17\.6/);
 assert.match(text('src/index.js'),/version:'0\.17\.6'/);
});
test('mobile has all 6 requested navigation tabs (including Neural)',()=>{
 assert.match(css,/grid-template-columns:repeat\(6,minmax\(0,1fr\)\)!important/);
 assert.match(css,/\.sidebar \.nav\[data-section="agents"\]\{display:flex!important\}/);
 assert.match(js,/program\.textContent='Agentes'/);
});
test('office art is an illustration, while live status comes from D1-backed state',()=>{
 assert.match(js,/getState\(\)/);
 assert.match(js,/s\.missions/);
 assert.match(js,/s\.activity/);
 assert.match(js,/relevant\.filter\(m=>m\.status==='running'\)/);
 assert.match(js,/relevantCode\.filter\(j=>j\.status==='working'\)/);
 assert.match(js,/Cenário ilustrativo/);
 assert.doesNotMatch(js,/(?:98%|12 agentes trabalhando|76%|1,8k ops)/);
 assert.doesNotThrow(()=>new Script(js));
});
test('images are decorative with no secret API data leakage',()=>{
 assert.match(js,/makeArt\('vr-neural'/);
 assert.match(js,/makeArt\('vr-robot'/);
 assert.match(js,/makeArt\('vr-office-image'/);
 assert.doesNotMatch(js,/MASTER_TOKEN|Bearer\s|api\.vercel\.com/);
 assert.doesNotMatch(css,/@import/);
});

test('project thumbnail selection uses project names and recomputes after D1 render',()=>{assert.match(js,/function decoratePortfolio\(/);assert.match(js,/MutationObserver\(apply\)/);assert.match(js,/card\.dataset\.vrKind/);});
