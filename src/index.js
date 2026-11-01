import {proactiveReview} from './proactive.js';
import {generateProfile} from './learning.js';
import {ensureSchema} from './bootstrap.js';
import {handleAPI} from './api.js';
export {MissionWorkflow} from './workflow.js';
export default {
 async scheduled(controller,env,ctx){
  if(controller.cron==='0 11 * * 1')ctx.waitUntil((async()=>{await ensureSchema(env.DB);try{await generateProfile(env);}catch(e){console.log('profile refresh skipped:',String(e.message||e).slice(0,90));}})());
  else ctx.waitUntil(proactiveReview(env));
 },
 async fetch(request,env){
  const path=new URL(request.url).pathname;
  if(path==='/api/health'&&request.method==='GET')return Response.json({status:env.AI?.run&&env.DB&&env.MASTER_TOKEN?.length>=24?'ready':'configuration_required',version:'0.5.0',capabilities:{projects:true,workProfile:true,ideas:true,githubDraftPR:true,projectInterview:true,deployLinks:true,officeActivity:true,pwa:true,jarvisRobotUI:true,browserVoice:true},bindings:{cloudflareAI:!!env.AI?.run,d1:!!env.DB,workflows:!!env.MISSIONS},accessConfigured:!!(env.MASTER_TOKEN&&env.MASTER_TOKEN.length>=24)}, {headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
  if(path.startsWith('/api/'))return handleAPI(request,env);
  if(!['GET','HEAD'].includes(request.method))return Response.json({error:'Método não permitido'},{status:405});
  const asset=await env.ASSETS.fetch(request);
  const headers=new Headers(asset.headers);
  headers.set('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'");
  headers.set('X-Content-Type-Options','nosniff');
  headers.set('X-Frame-Options','DENY');
  headers.set('Referrer-Policy','no-referrer');
  headers.set('Permissions-Policy','camera=(), microphone=(), geolocation=()');
  return new Response(asset.body,{status:asset.status,headers});
 }
};
