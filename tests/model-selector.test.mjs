import test from 'node:test';
import assert from 'node:assert/strict';
import {CF_MODELS,DEFAULT_CF,validateModel,paidModel,configuredModel,selectModel} from '../src/model-catalog.js';
import {callAI,verifySelectedModel} from '../src/ai.js';

const values={cf_model:'@cf/qwen/qwen3-30b-a3b-fp8',nvidia_model:'nvidia/nemotron-3-ultra-550b-a55b'};
const sql=[];
const db={prepare(q){let args=[];return{
 bind(...v){args=v;return this},
 async first(){return {value:values[args[0]]}},
 async run(){sql.push({q,args});values[args[0]]=args[1];return {success:true}}
};}};
test('Workers AI is not limited to GLM; curated model IDs are distinct',()=>{
 assert.ok(CF_MODELS.length>=10);
 assert.ok(CF_MODELS.some(x=>x.id==='@cf/openai/gpt-oss-120b'));
 assert.ok(CF_MODELS.some(x=>x.id==='@cf/google/gemma-4-26b-a4b-it'));
 assert.equal(new Set(CF_MODELS.map(x=>x.id)).size,CF_MODELS.length);
 assert.equal(DEFAULT_CF,'@cf/zai-org/glm-4.7-flash');
});
test('validate any correctly formatted custom Workers AI ID, never arbitrary URL',()=>{
 assert.equal(validateModel('cloudflare','@cf/example/recent-model'),'@cf/example/recent-model');
 assert.equal(validateModel('nvidia','vendor/some-model'),'vendor/some-model');
 for(const bad of ['https://evil.example/ai','@cf/../../bad','not-a-model','@cf/provider/model?x=1']){
  assert.throws(()=>validateModel('cloudflare',bad));
 }
 assert.throws(()=>validateModel('nvidia','https://evil.example'));
});
test('known paid models are explicitly flagged and selected default is not',()=>{
 assert.equal(paidModel('@cf/zai-org/glm-5.3'),true);
 assert.equal(paidModel(DEFAULT_CF),false);
});
test('saved Cloudflare model overrides wrangler default in actual AI.run invocation',async()=>{
 let used=null,params=null;
 const env={CF_AI_MODEL:DEFAULT_CF,DB:db,AI:{async run(id,body){used=id;params=body;return {response:'Olá'};}}};
 const answer=await callAI(env,[{role:'user',content:'Oi'}],'cloudflare');
 assert.equal(used,'@cf/qwen/qwen3-30b-a3b-fp8');
 assert.equal(answer.model,used);
 assert.equal(params.max_tokens,1400);
});
test('real probe uses requested custom model rather than persisted model',async()=>{
 let called=null;
 const env={AI:{async run(id){called=id;return {response:'OK'};}},DB:db};
 const result=await verifySelectedModel(env,'cloudflare','@cf/meta/llama-3.3-70b-instruct-fp8-fast');
 assert.equal(called,result.model);
 assert.equal(called,'@cf/meta/llama-3.3-70b-instruct-fp8-fast');
});
test('saving chosen model is durable in D1 settings, not a temporary UI option',async()=>{
 await selectModel(db,'cloudflare','@cf/openai/gpt-oss-20b');
 assert.deepEqual(sql.at(-1).args,['cf_model','@cf/openai/gpt-oss-20b']);
 assert.equal(await configuredModel({DB:db,CF_AI_MODEL:DEFAULT_CF},'cloudflare'),'@cf/openai/gpt-oss-20b');
});
