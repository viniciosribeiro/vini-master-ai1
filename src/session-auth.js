// Opt-in remembered login. Browser stores only an HttpOnly cookie; never the MASTER_TOKEN.
const COOKIE='__Host-vini_session';
const ENCODER=new TextEncoder();
const MAX_AGE=30*24*60*60;
const TEMP_AGE=12*60*60;
function to64(bytes){let s='';for(const b of bytes)s+=String.fromCharCode(b);return btoa(s).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');}
function from64(raw){const normal=raw.replace(/-/g,'+').replace(/_/g,'/');return Uint8Array.from(atob(normal.padEnd(Math.ceil(normal.length/4)*4,'=')),c=>c.charCodeAt(0));}
function headerBearer(req,master){
 if(typeof master!=='string'||master.length<24)return false;
 const got=req.headers.get('Authorization')||'',good='Bearer '+master;
 if(got.length!==good.length)return false;
 let diff=0;for(let i=0;i<good.length;i++)diff|=got.charCodeAt(i)^good.charCodeAt(i);
 return diff===0;
}
export function verifyMasterHeader(req,env){return headerBearer(req,env.MASTER_TOKEN);}
function keyBytes(secret){return ENCODER.encode('VINI-SESSION-HMAC-v1|'+secret);}
async function signingKey(secret){
 return crypto.subtle.importKey('raw',keyBytes(secret),{name:'HMAC',hash:'SHA-256'},false,['sign','verify']);
}
export async function issueCookie(env,{remember=false}={}){
 if(typeof env.MASTER_TOKEN!=='string'||env.MASTER_TOKEN.length<24)throw Error('MASTER_TOKEN ausente');
 const duration=remember?MAX_AGE:TEMP_AGE;
 const expires=Math.floor(Date.now()/1000)+duration;
 const nonce=to64(crypto.getRandomValues(new Uint8Array(16)));
 const body='v1.'+expires+'.'+nonce;
 const signature=to64(new Uint8Array(await crypto.subtle.sign('HMAC',await signingKey(env.MASTER_TOKEN),ENCODER.encode(body))));
 const cookie=COOKIE+'='+body+'.'+signature+'; Path=/; Secure; HttpOnly; SameSite=Strict'+(remember?'; Max-Age='+duration:'');
 return {cookie,expiresAt:new Date(expires*1000).toISOString(),remembered:!!remember};
}
export function expireCookie(){return COOKIE+'=; Path=/; Secure; HttpOnly; SameSite=Strict; Max-Age=0';}
function getCookie(req){
 const raw=req.headers.get('Cookie')||'';
 const match=raw.split(';').map(x=>x.trim()).find(x=>x.startsWith(COOKIE+'='));
 return match?match.slice(COOKIE.length+1):'';
}
export async function verifyCookie(req,env){
 const value=getCookie(req);
 if(!value||typeof env.MASTER_TOKEN!=='string'||env.MASTER_TOKEN.length<24)return false;
 const match=/^(v1)\.(\d{10})\.([A-Za-z0-9_-]{22})\.([A-Za-z0-9_-]{43})$/.exec(value);
 if(!match)return false;
 const now=Math.floor(Date.now()/1000),expiry=Number(match[2]);
 if(expiry<=now||expiry>now+MAX_AGE+60)return false;
 const body=match.slice(1,4).join('.');
 try{return await crypto.subtle.verify('HMAC',await signingKey(env.MASTER_TOKEN),from64(match[4]),ENCODER.encode(body));}
 catch{return false;}
}
export function sameOriginMutation(req){
 const url=new URL(req.url),method=req.method.toUpperCase();
 if(['GET','HEAD','OPTIONS'].includes(method))return true;
 if(req.headers.get('Sec-Fetch-Site')==='cross-site')return false;
 return req.headers.get('Origin')===url.origin;
}
export async function authorizeSession(req,env){
 if(verifyMasterHeader(req,env))return true; // backward compatible for one-time migration.
 if(!sameOriginMutation(req))return false;
 return verifyCookie(req,env);
}
