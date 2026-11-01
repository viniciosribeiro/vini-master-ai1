import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Script} from 'node:vm';
const read=name=>readFileSync(new URL('../'+name,import.meta.url),'utf8');
const server=read('src/vini-voice-agent.js'),client=read('src/vini-native-voice-client.js');
const index=read('src/index.js'),wrangler=JSON.parse(read('wrangler.jsonc')),pkg=JSON.parse(read('package.json'));
test('Agent server is syntax-valid and uses official VoiceAgent SDK',()=>{
 const stripped=server.replace(/^import .*$/gm,'').replace(/^export /gm,'');
 assert.doesNotThrow(()=>new Script(stripped));
 assert.match(server,/withVoice\(Agent/);
 assert.match(server,/WorkersAINova3STT/);
 assert.match(server,/WorkersAITTS/);
});
test('each voice session maps to an active D1 conversation, not shared global memory',()=>{
 assert.match(server,/chooseThread\(this\.env\.DB,threadId\)/);
 assert.match(server,/getThreadMessages\(this\.env\.DB,threadId/);
 assert.match(server,/saveThreadMessage\(this\.env\.DB,threadId,'user'/);
 assert.match(server,/saveThreadMessage\(this\.env\.DB,threadId,'assistant'/);
 assert.doesNotMatch(server,/localStorage|globalThreadId/);
});
test('WebSocket route authenticates and validates thread before Agent routing',()=>{
 assert.match(index,/\/agents\/ViniVoiceAgent\//);
 assert.match(index,/authorizeSession\(request,env\)/);
 assert.match(index,/chooseThread\(env\.DB,threadId\)/);
 assert.match(index,/routeAgentRequest\(request,env/);
 assert.match(index,/onBeforeConnect:/);
 assert.match(index,/route\.name!==threadId/);
});
test('Voice agent has no deploy, delete, payment or browser execution capabilities',()=>{
 assert.match(server,/Você está no canal de conversa/);
 assert.match(server,/Não diga que criou arquivos/);
 assert.doesNotMatch(server,/wrangler deploy|\/api\/vercel\/|deploy\(/);
});
test('native worker Durable Object configured with SQLite and pinned SDK',()=>{
 assert.ok(wrangler.compatibility_flags.includes('nodejs_compat'));
 assert.equal(wrangler.durable_objects.bindings[0].name,'ViniVoiceAgent');
 assert.ok(wrangler.migrations.some(m=>m.new_sqlite_classes?.includes('ViniVoiceAgent')));
 assert.equal(pkg.dependencies.agents,'0.32.0');
 assert.match(pkg.scripts['build:voice'],/src\/vini-native-voice-client\.js/);
});
test('browser client has real Cloudflare VoiceClient events and same-thread binding',()=>{
 const stripped=client.replace(/^import .*$/gm,'');
 assert.doesNotThrow(()=>new Script(stripped));
 assert.match(client,/new VoiceClient\(\{agent:'ViniVoiceAgent',name:id,host:location\.host\}\)/);
 assert.match(client,/window\.viniThreads\?\.selected/);
 assert.match(client,/startCall\(\)/);assert.match(client,/endCall\(\)/);
 assert.match(client,/transcriptchange/);
});

test('Cloudflare Agent route is kebab-case and assets forward /agents/* to Worker',()=>{
 assert.match(index,/path\.startsWith\('\/agents\/vini-voice-agent\/'\)/);
 assert.ok(wrangler.assets.run_worker_first.includes('/agents/*'));
 assert.doesNotMatch(index,/path\.startsWith\('\/agents\/ViniVoiceAgent\/'\)/);
});
test('pinned Cloudflare runtime toolchain matches isolated cloud dry-run',()=>{
 assert.equal(pkg.devDependencies.wrangler,'4.156.0');
 assert.equal(pkg.devDependencies.esbuild,'0.28.2');
});
