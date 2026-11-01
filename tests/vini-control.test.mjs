import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Script} from 'node:vm';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const html=read('public/index.html');
const script=read('public/vini-control.js');
const style=read('public/vini-control.css');
const api=read('src/api.js');
const setup=read('src/bootstrap.js');
const workflow=read('src/workflow.js');
const orchestration=read('src/orchestrator.js');
const app=read('public/app.js');

test('control center is loaded as static self-hosted assets after base scripts',()=>{
 assert.ok(html.includes('/vini-control.css?v=15'));
 assert.ok(html.includes('/vini-control.js?v=15'));
 assert.ok(html.indexOf('/vini-control.js')>html.indexOf('/projects.js'));
 assert.match(read('public/sw.js'),/vini-master-shell-v15/);
 assert.ok(read('public/sw.js').includes('/vini-control.js'));
 assert.ok(read('public/sw.js').includes('/vini-control.css'));
 assert.doesNotThrow(()=>new Script(script,{filename:'vini-control.js'}));
 assert.doesNotMatch(style,/@import|https?:\/\//);
});
test('all six reference areas render from real status, never hardcoded fake execution',()=>{
 for(const area of ['buildChat','buildOffice','buildProjects','buildMissions','buildNetwork','buildMemory','buildSettings'])assert.ok(script.includes('function '+area+'('),area);
 assert.match(script,/const live=\(\)=>typeof state/);
 assert.match(script,/agentStatus\(data,/);
 assert.match(script,/function paint\(/);
 assert.match(script,/state==='working'|s==='working'/);
 assert.doesNotMatch(script,/(98%|1,8k|49 \/ 5|min.*ops\/min|28 concluídas hoje)/);
 assert.match(script,/role:'button',tabindex:'0'/);
});
test('legacy conversation can be assigned to an existing project from chat',()=>{
 assert.match(script,/legacy-history/);
 assert.match(script,/openProjectPicker\('move',old\)/);
 assert.match(read('src/chat-threads.js'),/thread_id IS NULL/);
 assert.match(read('src/chat-threads.js'),/UPDATE messages SET thread_id=/);
});
test('mission scope is persisted to D1 and chat inheritance cannot silently mix projects',()=>{
 assert.match(setup,/CREATE TABLE IF NOT EXISTS mission_project_links/);
 assert.match(setup,/await setupMissionProjects\(db\)/);
 assert.match(api,/mission_project_links\(mission_id,project_id\)/);
 assert.match(api,/data\.projectId/);
 assert.match(app,/vc-mission-project/);
 assert.match(api,/LEFT JOIN mission_project_links/);
 assert.match(workflow,/mission\.project_id\?/);
 assert.match(workflow,/t\.project_id=\?/);
 assert.match(workflow,/t\.status<>'trashed'/);
 assert.match(orchestration,/contextProjectId=null/);
 assert.match(orchestration,/target=findTargetProject\(request,projects\)/);
 assert.match(api,/delegateChatWork\(env,taskInput,provider,available,thread\.project_id\|\|null\)/);
});
test('project ideas context is scoped and excludes trashed threads',()=>{
 assert.match(api,/SELECT m\.role,m\.content FROM messages m JOIN chat_threads t ON t\.id=m\.thread_id WHERE t\.project_id=\?/);
 assert.match(api,/t\.status<>'trashed'/);
});
test('settings contain opt-in authenticated D1 CRUD smoke and cleanup',()=>{
 assert.match(script,/async function runDiagnostic\(/);
 assert.match(script,/api\('\/threads',\{method:'POST'/);
 assert.match(script,/\/messages'\)/);
 assert.match(script,/status:'archived'/);
 assert.match(script,/status:'active'/);
 assert.match(script,/permanent=true/);
 assert.match(script,/finally\{/);
 assert.match(script,/button\.disabled=false/);
 assert.doesNotMatch(script,/MASTER_TOKEN|Authorization:.*Bearer|fetch\('https:\/\/api\.github/);
});
