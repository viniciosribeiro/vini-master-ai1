import {codeMission} from './github-engine.js';
import {WorkflowEntrypoint} from 'cloudflare:workers';
import {AGENTS,callAI,agentPrompt} from './ai.js';
async function record(db,mission,agent,description){
 await db.prepare('INSERT INTO activity(mission_id,agent_id,description) VALUES(?,?,?)').bind(mission,agent,description.slice(0,300)).run();
}
async function agentState(db,mission,agent,status,text='',provider=null){
 await db.prepare("UPDATE agent_runs SET status=?,output=?,provider=COALESCE(?,provider),started_at=CASE WHEN ?='working' AND started_at IS NULL THEN CURRENT_TIMESTAMP ELSE started_at END,finished_at=CASE WHEN ? IN ('done','failed') THEN CURRENT_TIMESTAMP ELSE finished_at END WHERE mission_id=? AND agent_id=?").bind(status,text,provider,status,status,mission,agent).run();
}
export class MissionWorkflow extends WorkflowEntrypoint {
 async run(event,step){
  if(event.payload?.codeJobId)return codeMission(this.env,event.payload.codeJobId,step);
  const id=event.payload.missionId;
  const mission=await step.do('Carregar missão',async()=>this.env.DB.prepare('SELECT m.*,l.project_id FROM missions m LEFT JOIN mission_project_links l ON l.mission_id=m.id WHERE m.id=?').bind(id).first());
  if(!mission)return {error:'Missão inexistente'};
  try{
   const ctx=await step.do('Recuperar histórico',async()=>{
    await record(this.env.DB,id,'supervisor','Consultando memória e histórico para definir escopo da missão');
    const [pins,past]=await Promise.all([this.env.DB.prepare('SELECT content FROM memories ORDER BY created_at DESC LIMIT 40').all(),mission.project_id?this.env.DB.prepare("SELECT m.role,m.content FROM messages m JOIN chat_threads t ON t.id=m.thread_id WHERE t.project_id=? AND t.status<>'trashed' ORDER BY m.id DESC LIMIT 16").bind(mission.project_id).all():Promise.resolve({results:[]})]);
    return {pins:(pins.results||[]).map(x=>x.content.slice(0,350)).join('\n').slice(0,5500),past:(past.results||[]).reverse().map(x=>x.role+': '+x.content.slice(0,400)).join('\n').slice(0,5500)};
   });
   const plan=await step.do('Supervisor planeja',{retries:{limit:1,delay:'5 seconds'}},async()=>{
    await this.env.DB.prepare("UPDATE missions SET status='running',updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(id).run();
    await agentState(this.env.DB,id,'supervisor','working');
    await record(this.env.DB,id,'supervisor','Planejando missão');
    const answer=await callAI(this.env,[{role:'system',content:'Você é o supervisor VINI MASTER AI. Planeje um trabalho coordenado para Programador, Designer, QA, Infra e Pesquisa. Não invente entregas ou testes.'},{role:'user',content:'MISSÃO:\n'+mission.description+'\nMEMÓRIAS:\n'+ctx.pins+'\nHISTÓRICO:\n'+ctx.past}],mission.provider);
    await agentState(this.env.DB,id,'supervisor','done',answer.text,answer.provider);
    await record(this.env.DB,id,'supervisor','Plano de execução gerado via '+answer.provider+' ('+answer.text.length+' caracteres)');
    return answer.text;
   });
   const members=await step.do('Consultar especialistas atribuídos',async()=>{
    const rows=await this.env.DB.prepare('SELECT agent_id FROM agent_runs WHERE mission_id=?').bind(id).all();
    const assigned=new Set((rows.results||[]).map(x=>x.agent_id));
    return AGENTS.filter(a=>a.id!=='supervisor'&&assigned.has(a.id));
   });
   // Independent durable steps: specialists work concurrently, and each step is replay-safe.
   await record(this.env.DB,id,'supervisor','Delegando trabalho para '+members.map(x=>x.name).join(', ').slice(0,180));
   const contributions=await Promise.all(members.map(agent=>
    step.do(agent.name+' analisa a missão',{retries:{limit:1,delay:'5 seconds'}},async()=>{
     await agentState(this.env.DB,id,agent.id,'working');
     await record(this.env.DB,id,agent.id,'Iniciou análise especializada: '+mission.title.slice(0,130));
     try{
      const answer=await callAI(this.env,[{role:'system',content:agentPrompt(agent)},{role:'user',content:'Missão: '+mission.description+'\nPlano do supervisor:\n'+plan.slice(0,4000)+'\nProduza apenas a sua contribuição real, verificável e útil. Informe limites de execução claramente.'}],mission.provider);
      await agentState(this.env.DB,id,agent.id,'done',answer.text,answer.provider);
      await record(this.env.DB,id,agent.id,'Entregou parecer via '+answer.provider+' ('+answer.text.length+' caracteres) para revisão do VINI');
      return {name:agent.name,text:answer.text};
     }catch(err){
      const reason=String(err.message||err);
      await agentState(this.env.DB,id,agent.id,'failed',reason);
      await record(this.env.DB,id,agent.id,'Falha: '+reason.slice(0,160));
      return {name:agent.name,text:'Falhou: '+reason};
     }
    })
   ));
   const result=await step.do('Supervisor entrega relatório',{retries:{limit:1,delay:'5 seconds'}},async()=>{
    await agentState(this.env.DB,id,'supervisor','working',plan);
    await record(this.env.DB,id,'supervisor','Revisando '+contributions.length+' contribuições da equipe');
    const summary=contributions.map(x=>'### '+x.name+'\n'+x.text.slice(0,1800)).join('\n\n');
    const answer=await callAI(this.env,[{role:'system',content:'Você é o supervisor da equipe. Consolide resultados reais em um relatório útil e inclua limitações. Não alegue que editou código ou executou deploy.'},{role:'user',content:'MISSÃO:\n'+mission.description+'\nPLANO:\n'+plan.slice(0,2500)+'\nEQUIPE:\n'+summary}],mission.provider);
    await agentState(this.env.DB,id,'supervisor','done',answer.text,answer.provider);
    await this.env.DB.prepare("UPDATE missions SET status='done',result=?,error=NULL,updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(answer.text,id).run();
    await record(this.env.DB,id,'supervisor','Relatório final consolidado via '+answer.provider+' ('+answer.text.length+' caracteres); missão concluída');
    return answer.text;
   });
   return {missionId:id,status:'done',preview:result.slice(0,200)};
  }catch(err){
   await this.env.DB.prepare("UPDATE missions SET status='failed',error=?,updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(String(err.message||err).slice(0,400),id).run();
   await this.env.DB.prepare("UPDATE agent_runs SET status='failed',output=CASE WHEN output='' THEN 'Workflow interrompido' ELSE output END,finished_at=CURRENT_TIMESTAMP WHERE mission_id=? AND status IN ('queued','working')").bind(id).run();
   await record(this.env.DB,id,'supervisor','Execução interrompida por erro');
   return {missionId:id,status:'failed'};
  }
 }
}
