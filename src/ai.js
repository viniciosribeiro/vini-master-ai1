import {configuredModel} from './model-catalog.js';
import {loadNvidia} from './provider-secrets.js';
export const AGENTS = [
 {id:'supervisor',name:'Supervisor',role:'coordenação'},
 {id:'programador',name:'Programador',role:'programação'},
 {id:'designer',name:'Designer',role:'design e UX'},
 {id:'qa',name:'QA / Testes',role:'testes e segurança'},
 {id:'infra',name:'Infraestrutura',role:'Cloudflare e operação'},
 {id:'pesquisa',name:'Pesquisa',role:'documentação'}
];
export const MAX_MESSAGE=8000;
export const MAX_MISSION=12000;
export const normalizeProvider=x=>['auto','cloudflare','nvidia'].includes(x)?x:'auto';
export function searchTerms(input){
 const a=[...new Set((String(input||'').toLowerCase().match(/[\p{L}\p{N}]{3,}/gu)||[]).filter(x=>x.length<36))];
 return a.slice(0,7).map(x=>String.fromCharCode(34)+x+String.fromCharCode(34)).join(' OR ');
}
export function cleanAnswer(input){
 const result=String(input||'');
 // Blocos de pensamento do modelo nao sao mensagens para o usuario.
 return result.replace(/<think>[\s\S]*?<\/think>/gi,'').replace(/<analysis>[\s\S]*?<\/analysis>/gi,'').trim();
}
export function asText(result){
 if(typeof result?.response==='string')return cleanAnswer(result.response);
 if(typeof result?.result==='string')return cleanAnswer(result.result);
 const content=result?.choices?.[0]?.message?.content;
 return cleanAnswer(typeof content==='string'?content:Array.isArray(content)?content.map(x=>x.text||'').join('\n'):'');
}
export async function callAI(env,messages,choice='auto'){
 const engines=normalizeProvider(choice)==='auto'?['cloudflare','nvidia']:[normalizeProvider(choice)];
 const failures=[];
 for(const engine of engines){
  try{
   let text='',model='';
   if(engine==='cloudflare'){
    if(!env.AI?.run)throw Error('Workers AI indisponível');
    model=await configuredModel(env,'cloudflare');
    text=asText(await env.AI.run(model,{messages,max_tokens:1400,chat_template_kwargs:{enable_thinking:false}}));
   }else{
    const nvidiaSecret=await loadNvidia(env);
    if(!nvidiaSecret)throw Error('Conecte sua chave NVIDIA nas Configurações');
    model=await configuredModel(env,'nvidia');
    const ctl=new AbortController();
    const t=setTimeout(()=>ctl.abort(),70000);
    try {
     const res=await fetch('https://integrate.api.nvidia.com/v1/chat/completions',{method:'POST',signal:ctl.signal,headers:{Authorization:'Bearer '+nvidiaSecret,'Content-Type':'application/json'},body:JSON.stringify({model,messages,temperature:0.6,max_tokens:1400,stream:false})});
     if(!res.ok)throw Error('NVIDIA HTTP '+res.status);
     text=asText(await res.json());
    }finally{clearTimeout(t);}
   }
   if(!text)throw Error('Resposta vazia');
   return {text:text.slice(0,18000),provider:engine,model};
  }catch(e){failures.push(engine+': '+String(e.message||e).slice(0,120));}
 }
 throw Error('Nenhum modelo disponível. '+failures.join(' | '));
}
export function agentPrompt(a){
 return 'Você é '+a.name+', especialista em '+a.role+' no VINI MASTER AI. Escreva em português brasileiro natural, de forma clara e humana. Seja objetivo: descreva o que importa, as decisões concretas e o resultado desta análise. Use listas só se ajudarem. Não produza linguagem burocrática nem relatórios repetitivos. Você não possui ferramentas para editar repositórios nem publicar sistemas; nunca invente ações ou testes.';
}

export async function verifySelectedModel(env,provider,model){
 const field=provider==='cloudflare'?'CF_AI_MODEL_OVERRIDE':'NVIDIA_MODEL_OVERRIDE';
 const probe={...env,[field]:model};
 const result=await callAI(probe,[{role:'user',content:'Responda somente OK em português.'}],provider);
 return {ok:true,provider:result.provider,model:result.model,reply:result.text.slice(0,120)};
}
export async function verifyProvider(env,provider,key){
 const selection=normalizeProvider(provider);
 if(selection==='auto')throw Error('Selecione um provedor para testar.');
 const probe={...env};
 if(selection==='nvidia'&&key)probe.NVIDIA_API_KEY=key;
 const response=await callAI(probe,[{role:'user',content:'Responda somente OK.'}],selection);
 return {ok:true,provider:response.provider,model:response.model,reply:response.text.slice(0,120)};
}
