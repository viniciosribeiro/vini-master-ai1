/**
 * OpenAI natural speech through Cloudflare AI Gateway.
 * Every inference is explicitly user-authorized and budget limited in D1.
 * The browser's built-in TTS is never substituted silently.
 */
export const VOICE_NAMES=['alloy','echo','fable','onyx','nova','shimmer'];
const MAX_DAILY_CHARS=2000;
const MAX_REQUEST_CHARS=480;
const UNIT_PRICE_USD=0.000015;
const response=(json,code=200)=>Response.json(json,{status:code,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
const safeAudioUrl=value=>{
 if(typeof value!=='string'||value.length>2000)return null;
 try{
  const u=new URL(value);
  if(u.protocol!=='https:'||!u.hostname.endsWith('.r2.dev'))return null;
  return u.href;
 }catch{return null;}
};
export async function handleNaturalVoice(req,env,db){
 if(req.method==='GET'){
  if(!db)return response({available:false,reason:'Banco de dados não configurado.'},503);
  const day=new Date().toISOString().slice(0,10);
  try{
   await db.prepare('CREATE TABLE IF NOT EXISTS voice_tts_usage (day TEXT PRIMARY KEY, characters INTEGER NOT NULL DEFAULT 0, requests INTEGER NOT NULL DEFAULT 0)').run();
   const row=await db.prepare('SELECT characters,requests FROM voice_tts_usage WHERE day=?').bind(day).first();
   return response({provider:'OpenAI TTS-1 via Cloudflare AI Gateway',model:'openai/tts-1',available:!!env.AI?.run,
     billingConfigured:'not_verified',approvalRequired:true,deviceVoice:false,streaming:false,
     voices:VOICE_NAMES,usedCharacters:row?.characters||0,limitCharacters:MAX_DAILY_CHARS,
     maximumCostUsd:Number((MAX_DAILY_CHARS*UNIT_PRICE_USD).toFixed(3)),
     note:'Cloudflare Unified Billing requer créditos pré-pagos ou chave OpenAI configurada. Não existe ativação automática.'});
  }catch{return response({available:false,reason:'Não foi possível consultar a cota de voz.'},503);}
 }
 if(req.method!=='POST')return response({error:'Método não permitido'},405);
 if(!env.AI?.run||!db)return response({error:'Voz IA não configurada no Worker.'},503);
 if(Number(req.headers.get('content-length')||0)>3200)return response({error:'Solicitação muito grande.'},413);
 let body;try{const raw=await req.text();if(raw.length>3200)throw Error();body=JSON.parse(raw);}catch{return response({error:'JSON inválido.'},400);}
 if(body?.confirm!=='ACEITO_CUSTO_VOZ_OPENAI')return response({error:'A autorização de cobrança de voz é necessária.'},403);
 const text=String(body.text||'').replace(/https?:\/\/\S+/g,'').replace(/[*#_]/g,'').trim();
 if(text.length<1||text.length>MAX_REQUEST_CHARS)return response({error:'Texto deve conter de 1 a 480 caracteres.'},400);
 const voice=String(body.voice||'nova');
 if(!VOICE_NAMES.includes(voice))return response({error:'Voz indisponível.'},400);
 const speed=Number(body.speed||1);
 if(!Number.isFinite(speed)||speed<0.8||speed>1.25)return response({error:'Velocidade fora do intervalo permitido.'},400);
 const day=new Date().toISOString().slice(0,10);
 try{
  await db.prepare('CREATE TABLE IF NOT EXISTS voice_tts_usage (day TEXT PRIMARY KEY, characters INTEGER NOT NULL DEFAULT 0, requests INTEGER NOT NULL DEFAULT 0)').run();
  await db.prepare('INSERT OR IGNORE INTO voice_tts_usage(day,characters,requests) VALUES(?,0,0)').bind(day).run();
  const used=await db.prepare('UPDATE voice_tts_usage SET characters=characters+?, requests=requests+1 WHERE day=? AND characters+?<=?')
   .bind(text.length,day,text.length,MAX_DAILY_CHARS).run();
  if(Number(used?.meta?.changes||0)!==1)return response({error:'Limite diário de voz alcançado. Nenhuma cobrança adicional solicitada.'},429);
  const result=await env.AI.run('openai/tts-1',{text,voice,speed,response_format:'mp3'});
  const url=safeAudioUrl(result?.audio||result?.result?.audio);
  if(!url)return response({error:'O provedor não devolveu um arquivo de áudio válido. Confira os créditos do AI Gateway.'},503);
  return response({audioUrl:url,provider:'OpenAI TTS-1',voice,streaming:false,estimatedCostUsd:Number((text.length*UNIT_PRICE_USD).toFixed(6))});
 }catch(e){
  const reason=String(e?.message||'').slice(0,140).replace(/(?:sk-|Bearer\s+)\S+/gi,'[redacted]');
  return response({error:'A geração de voz OpenAI não funcionou nesta conta. Verifique os créditos do Cloudflare AI Gateway.',detail:/credits|payment|billing|quota/i.test(reason)?'Créditos ou limite indisponíveis.':'Provedor não respondeu.'},503);
 }
}
