/* Keep natural-language chat separate from verified external execution. */
const ACTION_VERB=/\b(?:vou|iremos|vamos|acabei de|j[aá]|estou|consegui|fiz|feito|forcei|iniciando|executando)\b/iu;
const EXECUTION_VERB=/\b(?:entrar|acessar|conectar|abrir|for[cç]ar|disparar|rodar|executar|publicar|implantar|criar|subir|fazer|iniciar|testar|atualizar|corrigir|reparar|verificar|alterar|aplicar|implementar|configurar|enviar|gerar|deploy|build|commit|push|pr)\b/iu;
const EXTERNAL_SUBJECT=/\b(?:vercel|cloudflare|deploy|build|github|reposit[oó]rio|servidor|worker|workflow|produ[cç][aã]o|site|app|c[oó]digo|pull request|branch)\b/iu;
const EXPLICIT_DEPLOY_REQUEST=/\b(?:for[cç](?:ar|a|e)|dispar(?:ar|e)|rod(?:ar|e)|execut(?:ar|e)|refazer|reiniciar|publicar|deploy|implantar|build|redeploy|criar)\b/iu;
const REPAIR_INTENT=/\b(?:fix|consert|corrig|erro|bug|falha)\w*/iu;
export function isUnsupportedDeploymentRequest(message){
 const input=String(message||'').trim();
 if(input.length<9)return false;
 // Do not convert questions, quoted examples or complaints about failed work into deploy requests.
 if(/^\s*(?:como|por\s+que|qual|quais|quando|onde|o\s+que|voc[eê]\s+(?:disse|falou|prometeu)|ele\s+(?:disse|falou|prometeu))\b/iu.test(input))return false;
 if(/\b(?:n[aã]o\s+(?:executou|publicou|fez|disparou|funcionou|aconteceu)|s[oó]\s+(?:fala|promete)|sem\s+resultado|sem\s+fazer)\b/iu.test(input))return false;
 if(!/\b(?:vercel|deploy|build|redeploy|publica[cç][aã]o)\b/iu.test(input))return false;
 if(/^\s*n[aã]o\s+(?:fa[cç]a|execute|publique|rode|force)\b/iu.test(input))return false;
 // Only an explicit current instruction may trigger the deployment integration gate.
 const request=/^\s*(?:(?:por\s+favor[,:]?\s*)?(?:fa[cç]a|force|for[cç]ar|dispare|disparar|rode|rodar|execute|executar|refa[cç]a|refazer|reinicie|reiniciar|publique|publicar|implante|implantar|crie|criar|inicie|iniciar)|(?:quero|preciso|pode|consegue|gostaria)\s+(?:(?:que\s+)?(?:voc[eê]\s+)?)?(?:fa[cç]a|fazer|force|for[cç]ar|dispare|disparar|rode|rodar|execute|executar|refa[cç]a|refazer|reinicie|reiniciar|publique|publicar|implante|implantar|crie|criar|inicie|iniciar))\b/iu;
 return request.test(input);
}
export function guardUnsupportedActionClaims(raw){
 const input=String(raw||'');
 // Strip only unsupported first-person claims; never substitute an unrelated Vercel script.
 const fragments=input.split(/(?<=[.!?\n])\s+/u);
 const unsupported=fragments.filter(part=>{
  const sentence=part.trim();
  if(/^\s*(?:n[aã]o|nem|nunca|sem)\b/iu.test(sentence)||/\b(?:n[aã]o\s+(?:vou|fiz|executei|publiquei|consigo)|sem\s+(?:executar|publicar))\b/iu.test(sentence))return false;
  return ACTION_VERB.test(sentence)&&EXECUTION_VERB.test(sentence)&&EXTERNAL_SUBJECT.test(sentence);
 });
 if(!unsupported.length)return {text:input,intercepted:false};
 const safe=fragments.filter(s=>!unsupported.includes(s)).join(' ').trim();
 const notice='Não executei ações externas nesta resposta. Removi uma afirmação de execução sem comprovante.';
 return {text:safe?notice+'\n\n'+safe:notice+' Consulte o Diário da equipe e os Comprovantes para verificar o que realmente aconteceu.',intercepted:true,reason:'unverified_execution_claim'};
}
export function executionReceipt(result){
 if(result?.delegation){
  const d=result.delegation;
  const id=d.codeJobId||d.missionId||null;
  return {kind:d.kind==='code'?'code_job':d.kind==='mission'?'mission':'blocked',status:d.status||'unknown',id,externalWorkConfirmed:false,proofUrl:null};
 }
 return {kind:'conversation',status:'answered',id:null,externalWorkConfirmed:false,proofUrl:null};
}
