// A conversational LLM is not a deployment executor. Only checked, persisted URLs are publish evidence.
const PROVIDER_HOSTS=/(?:^|\.)(?:workers\.dev|pages\.dev|vercel\.app|netlify\.app|onrender\.com|fly\.dev|firebaseapp\.com|web\.app)$/i;
export function isPlatformHost(hostname){return typeof hostname==='string'&&PROVIDER_HOSTS.test(hostname);}
export function normalizedPublicUrl(raw){
 let url;try{url=new URL(String(raw||''));}catch{return null;}
 if(url.protocol!=='https:'||url.username||url.password||url.port||url.hostname.length>230)return null;
 if(!isPlatformHost(url.hostname))return null;
 url.hash='';return url.href;
}
// No open redirect following, no arbitrary DNS host, no reading body from unrelated domains.
export async function verifyPublicDeployment(raw,fetcher=fetch){
 const url=normalizedPublicUrl(raw);
 if(!url)return {status:'unverified',reason:'Use um endereço HTTPS de plataforma reconhecida; domínio personalizado requer confirmação externa.',checkedAt:new Date().toISOString()};
 const checkedAt=new Date().toISOString();
 const controller=new AbortController();
 const timer=setTimeout(()=>controller.abort(),7500);
 try{
  const res=await fetcher(url,{method:'GET',redirect:'manual',signal:controller.signal,headers:{Accept:'text/html,application/json;q=0.5','User-Agent':'Vini-Master-Deploy-Check/1.0'},cf:{cacheTtl:0,cacheEverything:false}});
  const failure=res.headers.get('x-vercel-error')||'';
  // 3xx redirects, 401, 403 and 404 are never confirmed as published.
  const ok=res.status>=200&&res.status<300&&!/DEPLOYMENT_NOT_FOUND/i.test(failure);
  try{await res.body?.cancel();}catch{}
  return {status:ok?'online':'unavailable',httpStatus:res.status,checkedAt,reason:ok?'Resposta HTTP de sucesso observada':'O servidor retornou HTTP '+res.status+(failure?' ('+failure.slice(0,50)+')':'')};
 }catch(e){return {status:'unavailable',checkedAt,reason:'Não foi possível confirmar a página: '+(e.name==='AbortError'?'tempo limite':'falha de conexão')};}
 finally{clearTimeout(timer);}
}
const DEPLOY_HOST_LINK=/https?:\/\/[^\s<>()[\]"'{}]+/gi;
const DEPLOY_CLAIM=/\b(?:acabei de (?:fazer|subir)|fiz o deploy|publiquei (?:o|a|esse|essa)|deploy (?:feito|conclu[ií]do)|j[aá] (?:est[aá] )?publicad[oa]|(?:site|projeto|app) (?:est[aá] |ficou )(?:no ar|online|publicad[oa]))\b/iu;
export function cleanChatHtml(value){
 let str=String(value||'');
 // Turn copy-pasted HTML anchors into readable text with no HTML markup.
 str=str.replace(/<a\s+[^>]*href\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi,(_,href,text)=>String(text).replace(/<[^>]+>/g,'')+' ('+href+')');
 str=str.replace(/<br\s*\/?>/gi,'\n').replace(/<\/?(?:p|div|strong|em|span)[^>]*>/gi,'');
 return str;
}
export function deploymentContext(verifiedProjects){
 const projects=Array.isArray(verifiedProjects)?verifiedProjects:[];
 return projects.map(p=>p.name+': '+p.deploy_url+' (HTTP verificado em '+p.deploy_verified_at+')').join('\n').slice(0,3500);
}
export function guardChatDeployment(raw,verifiedProjects=[]){
 let text=cleanChatHtml(raw);
 const verified=new Set(verifiedProjects.flatMap(p=>[p.deploy_url,p.preview_url]).filter(Boolean).map(x=>String(x).replace(/\/$/,'')));
 let removed=0;
 text=text.replace(DEPLOY_HOST_LINK,(token)=>{
  const suffix=token.match(/[.,;!?]+$/)?.[0]||'';
  const candidate=token.slice(0,token.length-suffix.length);
  let u;try{u=new URL(candidate);}catch{return token;}
  if(!isPlatformHost(u.hostname))return token; // do not silently censor regular outside references
  if(verified.has(candidate.replace(/\/$/,'')))return token;
  removed++;
  return '[endereço de publicação não confirmado]'+suffix;
 });
 const claim=DEPLOY_CLAIM.test(text);
 if(claim){
  const published=Array.isArray(verifiedProjects)&&verifiedProjects.length>0;
  if(!published||removed)return 'Ainda não tenho confirmação de que esse projeto foi publicado. A conversa por si só não executa deploy. Não vou te passar um endereço sem verificar. Consulte Projetos → Sites publicados para ver links validados e o status de publicação.';
  text=text.replace(/acabei de (?:fazer|subir)|fiz o deploy|publiquei/giu,'há uma publicação cadastrada e verificada para');
 }
 if(removed)text+='\n\nAtenção: removi '+removed+' link(s) de publicação que não constam como verificados. Isso não significa que o projeto esteja no ar.';
 return text.trim();
}
