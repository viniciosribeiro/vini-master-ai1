import test from 'node:test';
import assert from 'node:assert/strict';
import {safeFile,parseCode,codeReview,validRepo} from '../src/github-engine.js';
test('repository and code path restrictions are enforced',()=>{
 assert.equal(validRepo('viniciosribeiro/sereia360'),true);
 assert.equal(validRepo('bad/../repo'),false);
 assert.equal(safeFile('public/new.html'),true);
 assert.equal(safeFile('src/auth.js'),false);
 assert.equal(safeFile('.github/workflows/deploy.yml'),false);
 assert.equal(safeFile('public/../index.html'),false);
});
test('AI code output is bounded and reviewed',()=>{
 const valid=parseCode(JSON.stringify({summary:'Adicionar página',files:[{path:'public/hello.html',content:'<main>Olá</main>'}]}));
 assert.equal(valid.files.length,1);
 assert.equal(codeReview(valid).passed,true);
 const bad={summary:'unsafe',files:[{path:'public/hello.js',content:'eval("test")'}]};
 assert.equal(codeReview(bad).passed,false);
 assert.throws(()=>parseCode(JSON.stringify({summary:'bad',files:[{path:'src/auth.js',content:'x'}]})),/Arquivo/);
});
