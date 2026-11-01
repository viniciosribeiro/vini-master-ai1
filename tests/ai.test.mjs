import test from 'node:test';
import assert from 'node:assert/strict';
import {AGENTS,searchTerms,normalizeProvider,asText,callAI} from '../src/ai.js';
import {handleAPI} from '../src/api.js';
test('equipe possui seis agentes',()=>{assert.equal(AGENTS.length,6);assert.equal(new Set(AGENTS.map(a=>a.id)).size,6)});
test('busca Unicode inclui palavras portuguesas',()=>{assert.match(searchTerms('memória do projeto'),/memória/);assert.match(searchTerms('Pousada Marimar'),/marimar/)});
test('seleção desconhecida volta ao automático',()=>assert.equal(normalizeProvider('estranho'),'auto'));
test('formato Workers AI produz texto',()=>assert.equal(asText({response:'olá'}),'olá'));
test('Cloudflare é o provedor inicial',async()=>{
 const env={AI:{run:async()=>({response:'resposta real simulada'})},CF_AI_MODEL:'mock'};
 const result=await callAI(env,[{role:'user',content:'oi'}]);
 assert.equal(result.provider,'cloudflare');assert.equal(result.text,'resposta real simulada');
});
test('fallback não inventa resposta quando os dois falham',async()=>{
 const env={AI:{run:async()=>{throw Error('quota')}}};
 await assert.rejects(callAI(env,[{role:'user',content:'oi'}]),/Nenhum modelo disponível/);
});
test('API recusa acesso sem segredo',async()=>{
 const r=await handleAPI(new Request('https://exemplo.test/api/state'),{});
 assert.equal(r.status,401);
});
test('API recusa token incorreto',async()=>{
 const r=await handleAPI(new Request('https://exemplo.test/api/state',{headers:{Authorization:'Bearer incorreto'}}),{MASTER_TOKEN:'chave-que-tem-mais-de-vinte-e-quatro-caracteres'});
 assert.equal(r.status,401);
});
test('API recusa banco ausente mesmo com token correto',async()=>{
 const key='chave-bastante-longa-de-teste-e-segura';
 const r=await handleAPI(new Request('https://exemplo.test/api/state',{headers:{Authorization:'Bearer '+key}}),{MASTER_TOKEN:key});
 assert.equal(r.status,503);
});
