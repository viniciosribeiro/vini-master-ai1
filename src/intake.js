import {createProject} from './project-manager.js';
import {AGENTS} from './ai.js';
export const QUESTIONS=[
 'Primeiro: onde você quer publicar este projeto — Cloudflare, Vercel ou outra plataforma?',
 'Como vamos chamar esse projeto e qual problema ele vai resolver?',
 'Quem vai usar o sistema e quais dispositivos são prioritários?',
 'Quais são as funcionalidades indispensáveis para a primeira versão?',
 'Qual estilo visual você deseja? Há algum repositório GitHub existente que devemos usar?'
];
export const canStart=s=>/^\s*(?:pode iniciar|pode começar|iniciar agora|começar agora)\s*[.!]?\s*$/iu.test(String(s||''));
export const wantsNewProject=s=>/(?:quero|vamos|preciso|desejo|gostaria|come[cç]a(?:r|mos)|crie|criar|desenvolva|construa|monte|novo)\s+(?:(?:um|uma|o|a)\s+)?(?:novo\s+|nova\s+)?(?:projeto|site|aplicativo|app|sistema|plataforma|software|pwa|loja virtual|portal)\b/iu.test(String(s||''))||
 /(?:novo|nova)\s+(?:projeto|site|aplicativo|app|sistema|plataforma)\b/iu.test(String(s||''));
export function projectBlueprint(initial,answers){
 const deployment=String(answers[0]||'').toLowerCase();
 const platform=/vercel/.test(deployment)?'vercel':/cloudflare|workers|pages/.test(deployment)?'cloudflare':'other';
 const goal=String(answers[1]||initial||'').trim().slice(0,1200);
 const match=goal.match(/(?:chamado|chamada|nome(?:ado)?|vai se chamar)\s*[:\-]?\s*["“]?([^,.!?\n"”]{2,70})/iu);
 const candidate=match?.[1]?.trim()||goal.replace(/^(?:quero|vamos|criar|faça|um projeto|uma plataforma|um app|desenvolver|sistema)\s+/iu,'').split(/[.!?\n]/)[0].trim();
 const name=(candidate||'Novo projeto').slice(0,86);
 const all=[initial,...answers].join('\n');
 const m=all.match(/(?:https?:\/\/github\.com\/)?([a-zA-Z0-9_.-]{1,80}\/[a-zA-Z0-9_.-]{1,100})(?:\.git)?/);
 const repo=m?m[1].replace(/\.git$/,''):'';
 const description=[
  'Ideia inicial: '+initial,
  'Publicação: '+(answers[0]||'a definir'),
  'Nome/objetivo: '+(answers[1]||'a definir'),
  'Público e dispositivos: '+(answers[2]||'a definir'),
  'Funções principais: '+(answers[3]||'a definir'),
  'Estilo e integrações: '+(answers[4]||'a definir')
 ].join('\n').slice(0,3900);
 return {name,platform,repo,description};
}
export async function setupIntakes(db){
 await db.prepare("CREATE TABLE IF NOT EXISTS project_intakes (id TEXT PRIMARY KEY,status TEXT NOT NULL DEFAULT 'collecting',initial_goal TEXT NOT NULL,answers_json TEXT NOT NULL DEFAULT '[]',step INTEGER NOT NULL DEFAULT 0,project_id TEXT,created_at TEXT DEFAULT CURRENT_TIMESTAMP,updated_at TEXT DEFAULT CURRENT_TIMESTAMP)").run();
}
export async function handleIntake(env,message,provider='auto'){
 const db=env.DB;
 const running=await db.prepare("SELECT * FROM project_intakes WHERE status='collecting' ORDER BY created_at DESC LIMIT 1").first();
 if(!running&&!wantsNewProject(message))return null;
 if(!running){
  const id=crypto.randomUUID();
  await db.prepare('INSERT INTO project_intakes(id,initial_goal) VALUES(?,?)').bind(id,message.slice(0,1200)).run();
  return {reply:'Vamos criar seu projeto! Vou fazer até cinco perguntas rápidas. Você pode responder **PODE INICIAR** a qualquer momento e eu começo com o que já souber.\n\n**Pergunta 1 de 5:** '+QUESTIONS[0],intake:{id,step:1,total:5,status:'collecting'}};
 }
 if(!canStart(message)&&/^\s*(?:cancelar|desistir|parar entrevista)\s*[.!]?\s*$/iu.test(message)){
  await db.prepare("UPDATE project_intakes SET status='cancelled',updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(running.id).run();
  return {reply:'Entrevista cancelada. Não criei nem alterei nenhum projeto. Podemos começar novamente quando quiser.',intake:{id:running.id,status:'cancelled'}};
 }
 const answers=JSON.parse(running.answers_json||'[]');
 if(!canStart(message))answers.push(message.slice(0,1300));
 if(!canStart(message)&&answers.length<QUESTIONS.length){
  await db.prepare("UPDATE project_intakes SET answers_json=?,step=?,updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(JSON.stringify(answers),answers.length,running.id).run();
  return {reply:'**Pergunta '+(answers.length+1)+' de 5:** '+QUESTIONS[answers.length]+'\n\nVocê também pode escrever **PODE INICIAR** para começar agora.',intake:{id:running.id,step:answers.length+1,total:5,status:'collecting'}};
 }
 const data=projectBlueprint(running.initial_goal,answers);
 let project;
 try{project=await createProject(db,data);}
 catch(e){return {reply:'Não consegui criar o projeto: '+String(e.message||e)+'. Podemos corrigir as informações e tentar novamente.',intake:{id:running.id,status:'collecting'}};}
 await db.prepare("UPDATE project_intakes SET status='started',answers_json=?,step=?,project_id=?,updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(JSON.stringify(answers),answers.length,project.id,running.id).run();
 let launched=false,jobId='',note='';
 if(env.MISSIONS){
  try{
   const count=await db.prepare("SELECT COUNT(*) n FROM missions WHERE date(created_at)=date('now')").first();
   const limit=Math.min(20,Math.max(1,Number(env.MAX_DAILY_MISSIONS)||3));
   if((count?.n||0)<limit){
    jobId=crypto.randomUUID();
    const task='Planeje a primeira versão do projeto '+project.name+'. '+data.description+'\nEntregue etapas de implementação verificáveis, design mobile, testes e estratégia de deploy '+project.platform+'. Não afirme que publicou nem criou código sem ter executado.';
    await db.prepare('INSERT INTO missions(id,title,description,provider) VALUES(?,?,?,?)').bind(jobId,'Planejamento: '+project.name,task,provider).run();
    await db.batch(AGENTS.map(a=>db.prepare('INSERT INTO agent_runs(id,mission_id,agent_id) VALUES(?,?,?)').bind(crypto.randomUUID(),jobId,a.id)));
    await env.MISSIONS.create({id:jobId,params:{missionId:jobId}});
    launched=true;
   }else note=' O limite de missões de hoje foi atingido; o projeto foi salvo, mas o planejamento ficará pendente.';
  }catch(e){note=' O projeto foi salvo, mas não foi possível iniciar a missão automática; veja o painel de Missões.';}
 }
 return {reply:'Criei **'+project.name+'** no seu portfólio, com destino **'+(data.platform==='other'?'a definir':data.platform==='cloudflare'?'Cloudflare':'Vercel')+'**. Salvei nossas respostas para manter o contexto.\n\n'+(launched?'A equipe recebeu uma missão real de planejamento; acompanhe o andamento em **Missões**.':'O projeto está registrado e pronto para as próximas etapas.')+(project.repo?'\n\nRepositório vinculado: '+project.repo+'.':'\n\nAinda não há repositório GitHub vinculado. A geração de código e o deploy precisam dessa integração; não vou anunciar um site publicado sem URL confirmada.')+note,intake:{id:running.id,status:'started',projectId:project.id,missionId:jobId||null}};
}
