import test from 'node:test';
import assert from 'node:assert/strict';
import {isWorkStatusConcern,readWorkStatus,workStatusReply} from '../src/work-status.js';
import {isUnsupportedDeploymentRequest,guardUnsupportedActionClaims} from '../src/action-proof.js';
import {routeWorkIntent} from '../src/orchestrator.js';

const complaint='Olha você não tá falando nada com nada, não estou entendendo se você está ou não trabalhando pois os agentes estão todos parados e você não está falando nada com nada';
test('screenshot complaint is recognized as status inquiry, never a Vercel deployment or code command',()=>{
 assert.equal(isWorkStatusConcern(complaint),true);
 assert.equal(isUnsupportedDeploymentRequest(complaint),false);
 assert.equal(routeWorkIntent(complaint),null);
});
test('questions about idle team return status; coding commands still route normally',()=>{
 assert.equal(isWorkStatusConcern('Por que os agentes estão todos parados e não vejo trabalho?'),true);
 assert.equal(isWorkStatusConcern('O que a equipe está executando agora?'),true);
 assert.equal(isWorkStatusConcern('Corrija a interface para os agentes parados'),false);
 assert.equal(isWorkStatusConcern('Oi'),false);
});
const db={
 prepare(sql){return {
  async all(){
   if(sql.includes('FROM missions'))return {results:[{id:'m123',title:'Revisar projeto',status:'done',created_at:'2026-11-01 12:00:00'}]};
   if(sql.includes('FROM code_jobs')&&!sql.includes('COUNT'))return {results:[]};
   if(sql.includes('FROM agent_runs')||sql.includes('FROM code_agent_runs'))return {results:[]};
   throw Error('Unknown query '+sql);
  },
  async first(){return {total:0}}
 };}
};
test('work status is based on actual D1 states and does not advertise unrelated builds',async()=>{
 const facts=await readWorkStatus(db);
 assert.equal(facts.working,0);
 assert.equal(facts.latest.status,'done');
 const reply=workStatusReply(facts);
 assert.match(reply,/nenhum agente está marcado como trabalhando/);
 assert.match(reply,/Revisar projeto/);
 assert.doesNotMatch(reply,/\bVercel\b|forçar um build/);
});
test('false model promises are sanitized without replacing unrelated helpful text',()=>{
 const original='Vou acessar o GitHub e modificar o código. Seu problema é que os agentes não receberam uma missão operacional.';
 const guarded=guardUnsupportedActionClaims(original);
 assert.equal(guarded.intercepted,true);
 assert.match(guarded.text,/agentes não receberam/);
 assert.doesNotMatch(guarded.text,/abrir a conexão Vercel|reconstruir uma prévia/);
 assert.equal(isUnsupportedDeploymentRequest('Você disse que ia fazer deploy, mas não fez nada'),false);
 assert.equal(isUnsupportedDeploymentRequest('Ele prometeu publicar o site, só fala e não executa'),false);
 assert.equal(isUnsupportedDeploymentRequest('Force o build remoto na Vercel'),true);
});
