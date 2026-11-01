import {handleAPI} from './api.js';
export {MissionWorkflow} from './workflow.js';
export default {
 async fetch(request,env){
  const path=new URL(request.url).pathname;
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
