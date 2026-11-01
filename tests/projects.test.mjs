import test from 'node:test';
import assert from 'node:assert/strict';
import {validRepo,safeProjectInput,parseIdeas,projectStatus} from '../src/project-manager.js';
test('repo paths are narrow and project details validated',()=>{
 assert.equal(validRepo('viniciosribeiro/sereia360'),true);
 assert.equal(validRepo('../sereia360'),false);
 assert.equal(safeProjectInput({name:'VINI Master'}).platform,'cloudflare');
 assert.throws(()=>safeProjectInput({name:'A'}),/Nome/);
 assert.throws(()=>safeProjectInput({name:'Teste',repo:'../bad'}),/Repositório/);
});
test('ideas accept only concrete structured suggestions',()=>{
 const ideas=parseIdeas('[{"title":"Modo offline","description":"Adicionar persistência para uso sem internet em áreas remotas.","reason":"Resiliência"}]');
 assert.equal(ideas.length,1);
 assert.equal(parseIdeas('texto inválido').length,0);
});
test('trash requires exact project name',async()=>{
 const row={id:'1',name:'Meu Projeto',status:'active'};
 const db={prepare(sql){
  return {bind(...args){return {
   first:async()=>row,
   run:async()=>{if(sql.startsWith('UPDATE projects'))row.status=args[0];return {success:true};}
  }}};
 }};
 await assert.rejects(projectStatus(db,'1','trashed','errado'),/digite exatamente/);
 await projectStatus(db,'1','trashed','Meu Projeto');
 assert.equal(row.status,'trashed');
 await projectStatus(db,'1','active','');
 assert.equal(row.status,'active');
});
