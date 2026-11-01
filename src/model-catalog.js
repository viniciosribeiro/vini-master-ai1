// Curated convenience list; custom model IDs may also be selected after a real test.
// Some hosted Workers AI models require a paid plan/AI Gateway credits.
export const DEFAULT_CF='@cf/zai-org/glm-4.7-flash';
export const DEFAULT_NVIDIA='nvidia/nemotron-3-ultra-550b-a55b';
export const CF_MODELS=[
 {id:DEFAULT_CF,name:'GLM 4.7 Flash',use:'Conversas rápidas · padrão',category:'chat'},
 {id:'@cf/qwen/qwen3-30b-a3b-fp8',name:'Qwen3 30B A3B',use:'Português, programação e agentes',category:'code'},
 {id:'@cf/openai/gpt-oss-20b',name:'GPT-OSS 20B',use:'Raciocínio e conversas',category:'reasoning'},
 {id:'@cf/openai/gpt-oss-120b',name:'GPT-OSS 120B',use:'Raciocínio mais complexo',category:'reasoning'},
 {id:'@cf/meta/llama-3.3-70b-instruct-fp8-fast',name:'Llama 3.3 70B',use:'Conversação e instruções',category:'chat'},
 {id:'@cf/meta/llama-4-scout-17b-16e-instruct',name:'Llama 4 Scout',use:'Agentes e conteúdo multimodal',category:'chat'},
 {id:'@cf/google/gemma-4-26b-a4b-it',name:'Gemma 4 26B',use:'Eficiência e programação',category:'code'},
 {id:'@cf/nvidia/nemotron-3-120b-a12b',name:'Nemotron 3 Super 120B',use:'Equipe de agentes e tarefas',category:'agents'},
 {id:'@cf/deepseek-ai/deepseek-r1-distill-qwen-32b',name:'DeepSeek R1 Distill Qwen 32B',use:'Raciocínio',category:'reasoning'},
 {id:'@cf/zai-org/glm-5.3-flash',name:'GLM 5.3 Flash',use:'Agentes avançados · requer faturamento',category:'advanced',paidOnly:true},
 {id:'@cf/zai-org/glm-5.3',name:'GLM 5.3',use:'Programação avançada · requer faturamento',category:'advanced',paidOnly:true},
 {id:'@cf/deepseek-ai/deepseek-v4-flash-0731',name:'DeepSeek V4 Flash',use:'Agentes avançados · requer faturamento',category:'advanced',paidOnly:true},
 {id:'@cf/moonshotai/kimi-k2.6',name:'Kimi K2.6',use:'Agentes complexos · requer faturamento',category:'advanced',paidOnly:true}
];
const PAID_IDS=new Set([
 '@cf/zai-org/glm-5.2','@cf/zai-org/glm-5.3','@cf/zai-org/glm-5.3-flash',
 '@cf/moonshotai/kimi-k2.6','@cf/moonshotai/kimi-k2.7-code',
 '@cf/deepseek-ai/deepseek-v4-flash-0731','@cf/deepseek-ai/deepseek-v4-pro-0813'
]);
export function paidModel(id){return PAID_IDS.has(String(id||''));}
export function validateModel(provider,id){
 const model=String(id||'').trim();
 if(provider==='cloudflare'){
  if(!/^@cf\/[A-Za-z0-9._-]{2,60}\/[A-Za-z0-9._-]{2,120}$/.test(model))throw Error('Informe um ID de modelo Workers AI no formato @cf/fabricante/modelo.');
  return model;
 }
 if(provider==='nvidia'){
  if(!/^[A-Za-z0-9._-]{2,80}\/[A-Za-z0-9._-]{2,120}$/.test(model))throw Error('Informe um ID NVIDIA no formato fabricante/modelo.');
  return model;
 }
 throw Error('Provedor de modelos inválido.');
}
export async function configuredModel(env,provider){
 const fallback=provider==='cloudflare'?(env.CF_AI_MODEL||DEFAULT_CF):(env.NVIDIA_MODEL||DEFAULT_NVIDIA);
 const override=provider==='cloudflare'?env.CF_AI_MODEL_OVERRIDE:env.NVIDIA_MODEL_OVERRIDE;
 if(override)return validateModel(provider,override);
 if(!env.DB?.prepare)return fallback;
 try{
  const key=provider==='cloudflare'?'cf_model':'nvidia_model';
  const row=await env.DB.prepare('SELECT value FROM settings WHERE key=?').bind(key).first();
  return row?.value?validateModel(provider,row.value):fallback;
 }catch{return fallback;}
}
export async function selectModel(db,provider,model){
 const value=validateModel(provider,model);
 const key=provider==='cloudflare'?'cf_model':'nvidia_model';
 await db.prepare('INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').bind(key,value).run();
 return value;
}
