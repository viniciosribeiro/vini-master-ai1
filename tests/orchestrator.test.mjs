import test from 'node:test';
import assert from 'node:assert/strict';
import {routeWorkIntent,findTargetProject,delegateChatWork} from '../src/orchestrator.js';

test('greetings, questions and negative orders never wake costly agents',()=>{
 for(const input of ['Oi Vini','Como corrigir o bug desse sistema?','Não faça alteração no projeto','Só me explique como publicar o site','Quais os custos da Cloudflare?'])
  assert.equal(routeWorkIntent(input),null,input);
});
test('correct expert teams chosen for concrete project work',()=>{
 const code=routeWorkIntent('Corrija o código do aplicativo de reservas');
 assert.deepEqual(code.agents,['supervisor','programador','qa']);
 const design=routeWorkIntent('Melhore o layout e a interface mobile do site');
 assert.ok(design.agents.includes('designer'));
 assert.equal(routeWorkIntent('Faça uma análise do sistema')?.codeRequested,false);
 assert.equal(routeWorkIntent('Implemente uma função no aplicativo')?.codeRequested,true);
});
test('never pick wrong private repository for coding',()=>{
 const projects=[{id:'a',name:'Marimar',repo:'viniciosribeiro/marimar-site',status:'active'},{id:'b',name:'Sereia360',repo:'viniciosribeiro/sereia360',status:'active'}];
 assert.equal(findTargetProject('Corrija o sistema de hospedagem',projects),null);
 assert.equal(findTargetProject('Corrija o código do Marimar',projects)?.id,'a');
 assert.equal(findTargetProject('Implemente no viniciosribeiro/sereia360',projects)?.id,'b');
});
function fakeEnv({count=0,fail=false}={}){
 const records={missions:[],runs:[],activity:[],updates:[],created:[]};
 const db={
  prepare(sql){
   let params=[];
   return {bind(...args){params=args;return this;},
    async first(){return {n:count};},
    async run(){
     if(sql.startsWith('INSERT INTO missions'))records.missions.push(params);
     if(sql.startsWith('INSERT INTO agent_runs'))records.runs.push(params);
     if(sql.startsWith('INSERT INTO activity'))records.activity.push(params);
     if(sql.startsWith('UPDATE missions'))records.updates.push(params);
     return {success:true};
    }
   };
  },
  async batch(items){for(const item of items)await item.run();}
 };
 return {env:{DB:db,MAX_DAILY_MISSIONS:'3',MISSIONS:{async create(arg){if(fail)throw Error('provider unavailable');records.created.push(arg);}}},records};
}
test('actionable message creates genuine Workflow and six? only required D1 agent runs',async()=>{
 const {env,records}=fakeEnv();
 const answer=await delegateChatWork(env,'Corrija o código desse aplicativo de reservas','cloudflare',[]);
 assert.equal(answer.delegation.kind,'mission');
 assert.equal(answer.delegation.status,'queued');
 assert.equal(records.missions.length,1);
 assert.deepEqual(records.runs.map(x=>x[2]).sort(),['programador','qa','supervisor'].sort());
 assert.equal(records.created[0].params.missionId,answer.delegation.missionId);
 assert.match(answer.reply,/missão real/);
});
test('Workflow failure recorded as failure rather than fabricated work',async()=>{
 const {env,records}=fakeEnv({fail:true});
 const answer=await delegateChatWork(env,'Analise o problema de interface do sistema','auto',[]);
 assert.equal(answer.delegation.status,'failed');
 assert.equal(records.updates.length,1);
 assert.equal(records.created.length,0);
});
test('daily limit blocks Workflows and does not insert fake missions',async()=>{
 const {env,records}=fakeEnv({count:3});
 const answer=await delegateChatWork(env,'Revise os erros do sistema','auto',[]);
 assert.equal(answer.delegation.status,'blocked');
 assert.equal(records.missions.length,0);
 assert.equal(records.created.length,0);
});
