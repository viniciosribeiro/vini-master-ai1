import {callAI} from './ai.js';
export async function readProfile(db){
 const row=await db.prepare("SELECT content,updated_at FROM work_profile WHERE id=1").first();
 return row||{content:'',updated_at:null};
}
export async function saveProfile(db,value){
 const text=String(value||'').trim().slice(0,4500);
 await db.prepare("INSERT INTO work_profile(id,content,updated_at) VALUES(1,?,CURRENT_TIMESTAMP) ON CONFLICT(id) DO UPDATE SET content=excluded.content,updated_at=CURRENT_TIMESTAMP").bind(text).run();
 return {content:text};
}
export async function generateProfile(env){
 const [messages,projects,memories,prior]=await Promise.all([
  env.DB.prepare("SELECT role,content FROM messages ORDER BY id DESC LIMIT 100").all(),
  env.DB.prepare("SELECT name,description,platform FROM projects WHERE status='active' ORDER BY updated_at DESC LIMIT 25").all(),
  env.DB.prepare("SELECT content FROM memories ORDER BY created_at DESC LIMIT 45").all(),
  readProfile(env.DB)
 ]);
 const user=(messages.results||[]).filter(x=>x.role==='user');
 if(user.length<3&&!(projects.results||[]).length)return {updated:false,reason:'Ainda não há contexto suficiente.'};
 const answer=await callAI(env,[
  {role:'system',content:'Você organiza um perfil editável de forma de trabalho e preferências de desenvolvimento, não modifica pesos do modelo. Use SOMENTE evidências explícitas do usuário. Escreva em português brasileiro, até 1700 caracteres, com seções curtas: Preferências de interação; Como desenvolve projetos; Tecnologias e hospedagem; Regras e decisões recorrentes. Não inclua senhas, chaves, dados íntimos, inferências pessoais sensíveis ou suposições. Prefira preservar decisões anteriores válidas e assinale o que está incerto. Não confunda texto do assistente com preferências do usuário.'},
  {role:'user',content:'Perfil anterior:\n'+prior.content.slice(0,2000)+'\nMemórias explícitas:\n'+(memories.results||[]).map(x=>x.content.slice(0,260)).join('\n').slice(0,4500)+'\nProjetos:\n'+(projects.results||[]).map(x=>x.name+': '+x.description.slice(0,240)+' ['+x.platform+']').join('\n').slice(0,3300)+'\nMensagens do usuário:\n'+user.reverse().map(x=>x.content.slice(0,420)).join('\n').slice(0,8000)}
 ],'cloudflare');
 const next=answer.text.trim().slice(0,4500);
 if(next.length<50)throw Error('Perfil gerado insuficiente. O anterior foi mantido.');
 await saveProfile(env.DB,next);
 return {updated:true,content:next};
}
