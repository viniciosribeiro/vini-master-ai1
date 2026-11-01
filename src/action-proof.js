/* Keep natural-language chat separate from verified external execution. */
const ACTION_VERB=/\b(?:vou|iremos|vamos|acabei de|j[aá]|estou|consegui|fiz|feito|forcei|iniciando|executando)\b/iu;
const EXECUTION_VERB=/\b(?:entrar|acessar|conectar|abrir|for[cç]ar|disparar|rodar|executar|publicar|implantar|criar|subir|fazer|iniciar|testar|atualizar|corrigir|reparar|verificar|alterar|aplicar|implementar|configurar|enviar|gerar|deploy|build|commit|push|pr)\b/iu;
const EXTERNAL_SUBJECT=/\b(?:vercel|cloudflare|deploy|build|github|reposit[oó]rio|servidor|worker|workflow|produ[cç][aã]o|site|app|c[oó]digo|pull request|branch)\b/iu;
const EXPLICIT_DEPLOY_REQUEST=/\b(?:for[cç](?:ar|a|e)|dispar(?:ar|e)|rod(?:ar|e)|execut(?:ar|e)|refazer|reiniciar|publicar|deploy|implantar|build|redeploy|criar)\b/iu;
const REPAIR_INTENT=/\b(?:fix|consert|corrig|erro|bug|falha)\w*/iu;
export function isUnsupportedDeploymentRequest(message){
 const input=String(message||'').trim();
 if(input.length<9||/^\s*(?:como|por\s+que|qual|quais|quando|onde|o\s+que)\b/iu.test(input))return false;
 if(!/\b(?:vercel|deploy|build|redeploy|publica[cç][aã]o)\b/iu.test(input))return false;
 return EXPLICIT_DEPLOY_REQUEST.test(input) && !/^\s*n[aã]o\s+(?:fa[cç]a|execute|publique|rode|force)\b/iu.test(input);
}
export function guardUnsupportedActionClaims(raw){
 const input=String(raw||'');
 // This function only runs on unconstrained LLM conversational text, not on proof-bearing API results.
 const sentences=input.split(/(?<=[.!?\n])\s+/u);
 const promises=sentences.filter(s=>ACTION_VERB.test(s)&&EXECUTION_VERB.test(s)&&EXTERNAL_SUBJECT.test(s));
 if(!promises.length)return {text:input,intercepted:false};
 return {
  text:'Não executei nenhuma ação externa nesta conversa. A resposta anterior do modelo prometia operações sem comprovante de execução, por isso foi bloqueada. O VINI consegue registrar missões de análise e, quando houver um repositório identificado e GitHub autorizado, abrir um trabalho de código que pode gerar um pull request rascunho. Ele ainda não possui integração operacional para entrar na Vercel e forçar builds. Se o pedido exigir publicação, mostrarei isso como bloqueado até existir uma integração e um resultado verificável.',
  intercepted:true,reason:'unverified_execution_claim'
 };
}
export function executionReceipt(result){
 if(result?.delegation){
  const d=result.delegation;
  const id=d.codeJobId||d.missionId||null;
  return {kind:d.kind==='code'?'code_job':d.kind==='mission'?'mission':'blocked',status:d.status||'unknown',id,externalWorkConfirmed:false,proofUrl:null};
 }
 return {kind:'conversation',status:'answered',id:null,externalWorkConfirmed:false,proofUrl:null};
}
