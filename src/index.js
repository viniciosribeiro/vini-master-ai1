import {proactiveReview} from './proactive.js';
import {generateProfile} from './learning.js';
import {ensureSchema} from './bootstrap.js';
import {handleAPI} from './api.js';
import {routeAgentRequest} from 'agents';
import {authorizeSession} from './session-auth.js';
import {chooseThread} from './chat-threads.js';
export {MissionWorkflow} from './workflow.js';
export {ViniVoiceAgent} from './vini-voice-agent.js';
export default {
 async scheduled(controller,env,ctx){
  if(controller.cron==='0 11 * * 1')ctx.waitUntil((async()=>{await ensureSchema(env.DB);try{await generateProfile(env);}catch(e){console.log('profile refresh skipped:',String(e.message||e).slice(0,90));}})());
  else ctx.waitUntil(proactiveReview(env));
 },
 async fetch(request,env){
  const path=new URL(request.url).pathname;
  // Native voice is intentionally disabled in production until this branch passes
  // Cloudflare SDK build, D1 auth, Portuguese ASR and audio output smoke tests.
  // This route is gated and cannot bypass the regular VINI session cookie.
  if(path.startsWith('/agents/vini-voice-agent/')){
   if(request.method!=='GET'||request.headers.get('Upgrade')?.toLowerCase()!=='websocket')return new Response('WebSocket required',{status:426});
   const threadId=path.split('/')[3]||'';
   if(!/^[a-f0-9-]{36}$/i.test(threadId))return new Response('Invalid chat thread',{status:400});
   if(!await authorizeSession(request,env))return new Response('Unauthorized',{status:401});
   if(!env.DB||!env.AI?.run||!env.ViniVoiceAgent)return new Response('Voice engine unconfigured',{status:503});
   try{await ensureSchema(env.DB);await chooseThread(env.DB,threadId);}
   catch{return new Response('Chat unavailable',{status:404});}
   return (await routeAgentRequest(request,env,{
    onBeforeConnect:(_req,route)=>{
     if(route.className!=='ViniVoiceAgent'||route.name!==threadId)return new Response('Forbidden',{status:403});
    }
   }))||new Response('Voice routing unavailable',{status:404});
  }
  if(path==='/api/health'&&request.method==='GET')return Response.json({status:env.AI?.run&&env.DB&&env.MASTER_TOKEN?.length>=24?'ready':'configuration_required',version:'0.17.2',capabilities:{projects:true,workProfile:true,ideas:true,githubDraftPR:true,projectInterview:true,deployLinks:true,officeActivity:true,pwa:true,jarvisRobotUI:true,browserVoice:true,voiceStudio:true,voiceSource:'browser',voiceBrowserTurns:true,voiceStreaming:false,gitIndependentStaticPreview:true,verifiedDeployLinks:true,robotExpressions:true,chatOrchestration:true,parallelAgentWorkflows:true,liveMissionStatus:true,codeTeamTelemetry:true,incrementalLiveLog:true,perAgentAudit:true,supervisorActionLog:true,verifiedExecutionReceipts:true,unsupportedActionGuard:true,realProofPanel:true,vercelPreviewExecutor:true,vercelEncryptedConnector:true,vercelRedirectFix:true,rememberDeviceCookie:true,d1WorkStatusAnswers:true,contextualActionGuard:true,chatMoodReset:true,projectChatThreads:true,threadArchiveTrash:true,legacyHistoryMigration:true,modelSelector:true,savedModelsD1:true,customWorkersAIModel:true},bindings:{cloudflareAI:!!env.AI?.run,d1:!!env.DB,workflows:!!env.MISSIONS},accessConfigured:!!(env.MASTER_TOKEN&&env.MASTER_TOKEN.length>=24)}, {headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
  if(path.startsWith('/api/'))return handleAPI(request,env);
  if(!['GET','HEAD'].includes(request.method))return Response.json({error:'Método não permitido'},{status:405});
  const asset=await env.ASSETS.fetch(request);
  const headers=new Headers(asset.headers);
  headers.set('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'");
  headers.set('X-Content-Type-Options','nosniff');
  headers.set('X-Frame-Options','DENY');
  headers.set('Referrer-Policy','no-referrer');
  headers.set('Permissions-Policy','camera=(), geolocation=()');
  return new Response(asset.body,{status:asset.status,headers});
 }
};
