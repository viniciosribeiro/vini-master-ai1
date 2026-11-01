import test from 'node:test';
import assert from 'node:assert/strict';
import {QUESTIONS,canStart,wantsNewProject,projectBlueprint} from '../src/intake.js';
import {cleanDeployUrl} from '../src/deployments.js';
test('first question chooses deploy and stops after five answers',()=>{
 assert.equal(QUESTIONS.length,5);
 assert.match(QUESTIONS[0],/publicar/);
 assert.match(QUESTIONS[0],/Cloudflare/);
 assert.equal(canStart('PODE INICIAR'),true);
 assert.equal(canStart('pode iniciar!'),true);
 assert.equal(canStart('pode iniciar outra coisa'),false);
});
test('project intent and early blueprint retain destination and requirements',()=>{
 assert.equal(wantsNewProject('Quero criar um sistema para pousadas'),true);
 assert.equal(wantsNewProject('Quanto custa hospedagem?'),false);
 const project=projectBlueprint('Quero criar um sistema chamado Marimar',['Cloudflare','Chamado Marimar Reservas; centralizar reservas','Turistas e donos','Calendário e pagamentos','Mobile clean, GitHub viniciosribeiro/marimar-site']);
 assert.equal(project.platform,'cloudflare');
 assert.equal(project.repo,'viniciosribeiro/marimar-site');
 assert.match(project.description,/Calendário/);
});
test('deployment URL validation prevents insecure or local destinations',()=>{
 assert.equal(cleanDeployUrl('https://vini.example.com').startsWith('https://'),true);
 assert.equal(cleanDeployUrl(''), '');
 for(const bad of ['http://example.org','http://localhost:8787','https://192.168.1.1','https://user:pass@example.com'])assert.throws(()=>cleanDeployUrl(bad));
});
