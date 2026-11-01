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
  const id=event.payload.missionId;
  const mission=await step.do('Carregar missão',async()=>this.env.DB.prepare('SELECT * FROM missions WHERE id=?').bind(id).first());
  if(!mission)return {error:'Missão inexistente'};
  try{
   const ctx=await step.do('Recuperar histórico',async()=>{
    const [pins,past]=await Promise.all([this.env.DB.prepare('SELECT content FROM memories ORDER BY created_at DESC LIMIT 40').all(),this.env.DB.prepare('SELECT role,content FROM messages ORDER BY id DESC LIMIT 16').all()]);
    return {pins:(pins.results||[]).map(x=>x.content.slice(0,350)).join('\n').slice(0,5500),past:(past.results||[]).reverse().map(x=>x.role+': '+x.content.slice(0,400)).join('\n').slice(0,5500)};
   });
   const plan=await step.do('Supervisor planeja',{retries:{limit:1,delay:'5 seconds'}},async()=>{
    await this.env.DB.prepare("UPDATE missions SET status='running',updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(id).run();
    await agentState(this.env.DB,id,'supervisor','working');
    await record(this.env.DB,id,'supervisor','Planejando missão');
    const answer=await callAI(this.env,[{role:'system',content:'Você é o supervisor VINI MASTER AI. Planeje um trabalho coordenado para Programador, Designer, QA, Infra e Pesquisa. Não invente entregas ou testes.'},{role:'user',content:'MISSÃO:\n'+mission.description+'\nMEMÓRIAS:\n'+ctx.pins+'\nHISTÓRICO:\n'+ctx.past}],mission.provider);
    await agentState(this.env.DB,id,'supervisor','done',answer.text,answer.provider);
    await record(this.env.DB,id,'supervisor','Plano concluído e distribuído');
    return answer.text;
   });
   const contributions=[];
   for(const agent of AGENTS.filter(x=>x.id!=='supervisor')){
    const result=await step.do(agent.name+' analisa a missão',{retries:{limit:1,delay:'5 seconds'}},async()=>{
     await agentState(this.env.DB,id,agent.id,'working');
     await record(this.env.DB,id,agent.id,'Analisando: '+mission.title);
     try{
      const answer=await callAI(this.env,[{role:'system',content:agentPrompt(agent)},{role:'user',content:'Missão: '+mission.description+'\nPlano:\n'+plan.slice(0,4000)+'\nEntregue contribuição concreta.'}],mission.provider);
      await agentState(this.env.DB,id,agent.id,'done',answer.text,answer.provider);
      await record(this.env.DB,id,agent.id,'Análise concluída');
      return {name:agent.name,text:answer.text};
     }catch(err){
      const reason=String(err.message||err);
      await agentState(this.env.DB,id,agent.id,'failed',reason);
      await record(this.env.DB,id,agent.id,'Falha de execução');
      return {name:agent.name,text:'Falhou: '+reason};
     }
    });
    contributions.push(result);
   }
   const result=await step.do('Supervisor entrega relatório',{retries:{limit:1,delay:'5 seconds'}},async()=>{
    await agentState(this.env.DB,id,'supervisor','working',plan);
    const summary=contributions.map(x=>'### '+x.name+'\n'+x.text.slice(0,1800)).join('\n\n');
    const answer=await callAI(this.env,[{role:'system',content:'Você é o supervisor da equipe. Consolide resultados reais em um relatório útil e inclua limitações. Não alegue que editou código ou executou deploy.'},{role:'user',content:'MISSÃO:\n'+mission.description+'\nPLANO:\n'+plan.slice(0,2500)+'\nEQUIPE:\n'+summary}],mission.provider);
    await agentState(this.env.DB,id,'supervisor','done',answer.text,answer.provider);
    await this.env.DB.prepare("UPDATE missions SET status='done',result=?,error=NULL,updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(answer.text,id).run();
    await record(this.env.DB,id,'supervisor','Relatório final concluído');
    return answer.text;
   });
   return {missionId:id,status:'done',preview:result.slice(0,200)};
  }catch(err){
   await this.env.DB.prepare("UPDATE missions SET status='failed',error=?,updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(String(err.message||err).slice(0,400),id).run();
   await record(this.env.DB,id,'supervisor','Execução interrompida por erro');
   return {missionId:id,status:'failed'};
  }
 }
}
