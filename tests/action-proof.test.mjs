import test from 'node:test';
import assert from 'node:assert/strict';
import {isUnsupportedDeploymentRequest,guardUnsupportedActionClaims,executionReceipt} from '../src/action-proof.js';
import {validateGitHubPR,classifyCodeEvidence,classifyMissionEvidence} from '../src/execution-ledger.js';
test('direct build/deploy requests are blocked when there is no Vercel executor',()=>{
 for(const text of ['Force o build remoto na Vercel','Faça deploy do site na Vercel','Dispare o build na Cloudflare','Rode o redeploy'])assert.equal(isUnsupportedDeploymentRequest(text),true,text);
 for(const text of ['Como funciona o deploy?','Não faça deploy','O que é um build?','Meu site ficou lento'])assert.equal(isUnsupportedDeploymentRequest(text),false,text);
});
test('unverified model claims are rewritten and not presented as action',()=>{
 for(const text of ['Agora vou entrar de fato no Vercel e forçar o build remoto para liberar o acesso.','Agora vou forçar o build remoto para liberar o acesso.','Já fiz deploy na Cloudflare.']){
  const result=guardUnsupportedActionClaims(text);
  assert.equal(result.intercepted,true,text);
  assert.match(result.text,/Não executei ações externas/);
 }
 assert.equal(guardUnsupportedActionClaims('Posso explicar como fazer deploy na Vercel.').intercepted,false);
});
test('every assistant response has an honest action receipt',()=>{
 assert.equal(executionReceipt().kind,'conversation');
 assert.equal(executionReceipt().externalWorkConfirmed,false);
 assert.equal(executionReceipt({delegation:{kind:'mission',status:'queued',missionId:'m1'}}).id,'m1');
 assert.equal(executionReceipt({delegation:{status:'blocked'}}).kind,'blocked');
});
test('proof ledger only links actual completed PR in matching repo',()=>{
 assert.equal(validateGitHubPR('https://github.com/owner/repo/pull/12','owner/repo'),'https://github.com/owner/repo/pull/12');
 assert.equal(validateGitHubPR('https://github.com/other/repo/pull/12','owner/repo'),null);
 assert.equal(validateGitHubPR('https://example.com/owner/repo/pull/12','owner/repo'),null);
 const base={id:'j1',status:'done',repo:'owner/repo',result:JSON.stringify({url:'https://github.com/owner/repo/pull/12',number:12})};
 assert.equal(classifyCodeEvidence(base).proof?.type,'github_pr');
 assert.equal(classifyCodeEvidence({...base,status:'working'}).proof,null);
 assert.equal(classifyCodeEvidence({...base,result:'not a PR'}).proof,null);
 assert.equal(classifyMissionEvidence({id:'m1',status:'done',title:'Analisar site',result:'Parecer'}).proof.type,'report');
 assert.equal(classifyMissionEvidence({id:'m1',status:'done',title:'Analisar site',result:'Parecer'}).explanation.includes('não modifica código'),true);
});
