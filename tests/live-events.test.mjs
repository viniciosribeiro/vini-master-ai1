import test from 'node:test';
import assert from 'node:assert/strict';
import {liveCursor,liveLimit,readLiveEvents} from '../src/live-events.js';
test('cursor and page size are validated and bounded',()=>{
 assert.equal(liveCursor('10'),10);
 assert.equal(liveCursor('-1'),0);
 assert.equal(liveCursor('not-a-number'),0);
 assert.equal(liveCursor('1.5'),0);
 assert.equal(liveLimit('100000'),120);
 assert.equal(liveLimit('1'),5);
 assert.equal(liveLimit('abc'),80);
});
const fixture=[
 {id:1,mission_id:'task-1',agent_id:'supervisor',description:'Delegou tarefa',created_at:'2026-11-01 13:00:00'},
 {id:2,mission_id:'task-1',agent_id:'programador',description:'Criando arquivos',created_at:'2026-11-01 13:00:01'},
 {id:3,mission_id:'task-1',agent_id:'qa',description:'Iniciou análise',created_at:'2026-11-01 13:00:02'},
 {id:4,mission_id:'task-1',agent_id:'supervisor',description:'Relatório final',created_at:'2026-11-01 13:00:03'},
 {id:5,mission_id:'task-2',agent_id:'designer',description:'Concluiu interface',created_at:'2026-11-01 13:00:04'},
 {id:6,mission_id:'task-2',agent_id:'infra',description:'Erro de deploy',created_at:'2026-11-01 13:00:05'},
];
const db={prepare(sql){
 let args=[];
 return {bind(...values){args=values;return this;},
 async all(){
  if(sql.includes('WHERE id>?'))return {results:fixture.filter(e=>e.id>args[0]).slice(0,args[1])};
  return {results:fixture.slice(-args[0])};
 },
 async first(){return {latest:fixture[fixture.length-1].id}}
 };
}};
test('initial read returns recent durable events in ascending ID order',async()=>{
 const result=await readLiveEvents(db,{after:'0',limit:5});
 assert.deepEqual(result.events.map(e=>e.id),[2,3,4,5,6]);
 assert.equal(result.lastId,6);
 assert.equal(result.latestId,6);
 assert.equal(result.hasMore,false);
});
test('incremental cursor does not lose fast completed agent events',async()=>{
 const first=await readLiveEvents(db,{after:1,limit:5});
 assert.deepEqual(first.events.map(e=>e.agent_id),['programador','qa','supervisor','designer','infra']);
 assert.equal(first.lastId,6);
 assert.equal(first.hasMore,false);
 const second=await readLiveEvents(db,{after:first.lastId,limit:5});
 assert.deepEqual(second.events,[]);
 assert.equal(second.lastId,6);
});
test('old events can be filtered per agent in UI without changing persisted IDs',()=>{
 const qa=fixture.filter(x=>x.agent_id==='qa');
 assert.deepEqual(qa.map(e=>e.id),[3]);
 assert.equal(fixture[2].mission_id,'task-1');
});
