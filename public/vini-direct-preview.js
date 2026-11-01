/* VINI Preview Lab: GitHub-independent static file deployment to Vercel Preview only.
 * Uses the authenticated VINI API; never receives provider tokens in browser. */
(()=>{
'use strict';
const $=id=>document.getElementById(id);
const make=(tag,cls,text)=>{const node=document.createElement(tag);if(cls)node.className=cls;if(text!==undefined)node.textContent=String(text);return node;};
let running=false;
const defaultHtml='<!doctype html>\n<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Prévia VINI</title><style>body{font-family:system-ui;background:#0c1530;color:#eaf8ff;padding:3rem}h1{color:#51e2fa}</style></head><body><h1>Prévia criada pelo VINI</h1><p>Este arquivo foi enviado à Vercel sem GitHub.</p></body></html>';
function report(text,url){
 const msg=$('vini-direct-report');if(!msg)return;
 msg.replaceChildren(make('span','',text));
 if(url&&/^https:\/\/[a-z0-9.-]+\.vercel\.app\/?$/i.test(url)){
  const link=make('a','vini-direct-link','Abrir prévia verificada');
  link.href=url;link.target='_blank';link.rel='noopener noreferrer';msg.append(link);
 }
}
async function poll(id,initial){
 for(let i=0;i<10;i++){
  await new Promise(resolve=>setTimeout(resolve,3300));
  let data;try{data=await api('/vercel/builds/'+encodeURIComponent(id));}catch(e){report('A consulta de status falhou: '+e.message);return;}
  const d=data?.deployment||{};const status=String(d.status||'').toUpperCase();
  if(status==='READY'){report('Prévia pronta. ID '+id,typeof d.url==='string'?(d.url.startsWith('https://')?d.url:'https://'+d.url):initial);return;}
  if(['ERROR','CANCELED'].includes(status)){report('A Vercel não conseguiu finalizar: '+status+'. Consulte os logs do deployment '+id);return;}
  report('Build real na Vercel: '+status+' · '+id+'. Consultando…');
 }
 report('A Vercel aceitou o build '+id+'. Acompanhe em Publicações; ainda não foi confirmado como READY.');
}
async function deploy(){
 if(running)return;
 const html=$('vini-direct-html')?.value||'';
 if(html.trim().length<20||html.length>15000){report('Insira um HTML válido entre 20 e 15.000 caracteres.');return;}
 if(!confirm('Criar uma PRÉVIA pública na Vercel, sem GitHub? Isto pode consumir créditos da sua conta. Não altera a produção.'))return;
 const button=$('vini-direct-send');running=true;button.disabled=true;
 report('Enviando os arquivos diretamente para a API da Vercel…');
 try{
  const projectId=$('vc-top-project')?.value||'';
  const payload={files:[{file:'index.html',data:html}],confirm:'CRIAR PREVIA',target:'preview'};
  if(/^[a-zA-Z0-9_-]{1,80}$/.test(projectId)&&projectId!=='all')payload.projectId=projectId;
  const result=await api('/vercel/direct-preview',{method:'POST',body:payload});
  const d=result?.deployment||{};
  if(!/^dpl_[A-Za-z0-9]{8,80}$/.test(d.id||''))throw Error('Não houve confirmação de ID pela Vercel.');
  report('Vercel aceitou os arquivos sem passar pelo GitHub. Deployment '+d.id+'. Ainda não está pronto.');
  await poll(d.id,d.url||'');
 }catch(e){report('A prévia não foi confirmada: '+e.message);}
 finally{running=false;button.disabled=false;}
}
function init(){
 const host=$('section-missions')||$('section-projects');if(!host||$('vini-direct-lab'))return;
 const section=make('details','vini-direct-lab');section.id='vini-direct-lab';
 section.append(make('summary','','◈ Publicar prévia diretamente na nuvem · GitHub opcional'));
 const body=make('div','vini-direct-body');
 body.append(make('p','','Envie um protótipo HTML direto para a Vercel. O VINI usa o token já conectado, registra o deployment no D1 e só cria PRÉVIA. Produção é proibida nesta ferramenta.'));
 const label=make('label','','HTML da prévia');label.htmlFor='vini-direct-html';
 const input=make('textarea');input.id='vini-direct-html';input.value=defaultHtml;input.maxLength=15000;input.rows=7;input.spellcheck=false;
 body.append(label,input);
 const button=make('button','vini-direct-button','Criar prévia sem GitHub');button.id='vini-direct-send';button.type='button';
 button.addEventListener('click',deploy);body.append(button);
 const out=make('div','vini-direct-report','Nenhuma publicação solicitada.');out.id='vini-direct-report';out.setAttribute('role','status');out.setAttribute('aria-live','polite');body.append(out);
 section.append(body);host.append(section);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();