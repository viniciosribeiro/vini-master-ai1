import {AGENTS} from './ai.js';
import {hasGitHub} from './github-engine.js';

// Deterministic router: conversation remains a conversation; actionable work launches real Workflow instances.
const SALUTATION=/^\s*(?:oi|ol[aá]|bom dia|boa tarde|boa noite|ok|certo|valeu|obrigad[oa]|entendi|sim|n[aã]o|beleza|legal|tudo bem|e a[ií])[\s!?.]*$/iu;
const NEGATION=/^\s*(?:n[aã]o|nem|nunca)\s+(?:fa[cç]a|implemente|execute|altere|publique|crie|corrija|inicie|delegue|arrume|mexa|trabalhe)\b/iu;
const INQUIRY=/^\s*(?:como|qual|quais|o que|por que|porque|quando|onde|quanto|ser[aá] que|voc[eê] sabe|me explique|explique|o que acha|pode me explicar)\b/iu;
const COMMAND=/\b(?:fa[cç]a|faz(?:a)?|execute|delegue|orquestre|implemente|corrija|arrume|conserte|refa[cç]a|melhore|desenvolva|programe|construa|crie|atualize|otimize|analise|pesquise|planeje|revise|teste|valide|prepare|investigue|integre|adapte|configure|publique|implante|verifique)\b/iu;
const TASK_NOUN=/\b(?:projeto|site|aplicativo|app|sistema|plataforma|interface|layout|tela|bug|erro|problema|c[oó]digo|fun[cç][aã]o|m[oó]dulo|api|agente|equipe|rob[oô]|mem[oó]ria|deploy|publica[cç][aã]o|teste|seguran[cç]a|acessibilidade|documenta[cç][aã]o|p[aá]gina|formul[aá]rio|fluxo|experi[eê]ncia|integra[cç][aã]o|reposit[oó]rio|github|cloudflare|vercel|performance|desempenho|infraestrutura|banco|dados|reservas|usu[aá]rios|clientes)\b/iu;
const PURE_INFO=/\b(?:me explique|s[oó] me diga|n[aã]o fa[cç]a|apenas responda|somente responda|sem implementar|sem executar|n[aã]o altere|s[oó] uma d[uú]vida)\b/iu;
const CODE_ACTION=/\b(?:implemente|corrija|arrume|conserte|programe|desenvolva|adicione|aplique|integre|refa[cç]a|codifique|construa|atualize)\b/iu;
export function routeWorkIntent(input){
 const text=String(input||'').trim();
 if(text.length<14||SALUTATION.test(text)||NEGATION.test(text)||PURE_INFO.test(text))return null;
 if(INQUIRY.test(text)&&!/\b(?:implemente|fa[cç]a|execute|delegue|corrija|crie)\b/iu.test(text))return null;
 const verbs=/\b(?:criar|fazer|executar|delegar|orquestrar|implementar|corrigir|arrumar|consertar|refazer|melhorar|desenvolver|programar|construir|atualizar|otimizar|analisar|pesquisar|planejar|revisar|testar|validar|preparar|investigar|integrar|adaptar|configurar|publicar|implantar|verificar|trabalhe|resolva|organize|adicione|gere|ajuste)\b/iu;
 if(!(COMMAND.test(text)||verbs.test(text))||!TASK_NOUN.test(text))return null;
 const broad=/\b(?:equipe|completo|tudo|orquestre|delegue|mult[ií]plos especialistas)\b/iu.test(text)||/\b(?:crie|construa|desenvolva)\s+(?:(?:um|o|uma|a)\s+)?(?:projeto|sistema|site|app|aplicativo)\b/iu.test(text);
 const code=/\b(?:c[oó]digo|programa[cç][aã]o|api|backend|frontend|bug|erro|refator|implemente|corrija|fun[cç][aã]o|integra[cç][aã]o)\b/iu.test(text);
 const visual=/\b(?:visual|interface|tela|layout|design|ux|ui|responsiv|avatar|rob[oô]|anima[cç][aã]o|estilo)\b/iu.test(text);
 const qa=/\b(?:teste|valide|verifique|audite|seguran[cç]a|erro|bug|falha|corrija)\b/iu.test(text);
 const infra=/\b(?:deploy|publica[cç][aã]o|hospedagem|cloudflare|vercel|infraestrutura|worker|dom[ií]nio|servidor|performance)\b/iu.test(text);
 const research=/\b(?:pesquise|analise|planeje|investigue|documenta[cç][aã]o|compara[cç][aã]o|refer[eê]ncias|novas possibilidades)\b/iu.test(text);
 const selected=new Set();
 if(broad||(!code&&!visual&&!qa&&!infra&&!research))for(const a of ['programador','designer','qa','infra','pesquisa'])selected.add(a);
 if(code)selected.add('programador');
 if(visual)selected.add('designer');
 if(qa)selected.add('qa');
 if(infra)selected.add('infra');
 if(research)selected.add('pesquisa');
 if(code)selected.add('qa');
 if(selected.size===1&&selected.has('programador'))selected.add('qa');
 return {agents:['supervisor',...selected],codeRequested:CODE_ACTION.test(text)&&(code||visual),title:text.replace(/\s+/g,' ').slice(0,85)};
}
export function resolvedFollowUp(current,priorUser,priorAssistant){
 const short=/^\s*(?:fa[cç]a tudo|pode fazer|faz isso|pode executar|execute agora|pode iniciar|inicie agora|pode come[cç]ar|continue com isso)\s*[.!]?\s*$/iu;
 if(!short.test(String(current||'')))return null;
 const previous=String(priorUser||'').trim(),reply=String(priorAssistant||'');
 if(previous.length<24||previous.length>1400||!/\\b(?:site|app|sistema|projeto|interface|tela|c[oó]digo|bug|teste|deploy|agentes|equipe|rob[oô]s|funcionalidade)\\b/iu.test(previous))return null;
 if(/(?:abri uma \\*\\*miss[aã]o real|deleguei a implementa[cç][aã]o|miss[aã]o real|pull request rascunho)/iu.test(reply))return null;
 const full='Execute a tarefa no sistema: '+previous;
 return routeWorkIntent(full)?full:null;
}
export function findTargetProject(message,projects){
 const input=String(message||'').toLowerCase(),candidates=(projects||[]).filter(p=>p.status==='active'&&p.repo);
 const found=candidates.filter(p=>(p.name?.length>3&&input.includes(p.name.toLowerCase()))||(p.repo?.length>3&&input.includes(p.repo.toLowerCase())));
 if(found.length===1)return found[0];
 if(found.length!==0)return null;
 // Do not modify an arbitrary repo when the instruction is ambiguous.
 return candidates.length===1&&/\b(?:nesse|neste|no meu|deste)\s+(?:projeto|sistema|site|app)\b/iu.test(message)?candidates[0]:null;
}
export async function delegateChatWork(env,request,provider='auto',projects=[]){
 const intent=routeWorkIntent(request);
 if(!intent)return null;
 if(!env.MISSIONS)return {reply:'Entendi sua tarefa, mas o serviço de execução de agentes não está configurado. Não vou fingir que a equipe começou a trabalhar.',delegation:{status:'blocked',reason:'Workflow indisponível'}};
 const db=env.DB;
 const target=findTargetProject(request,projects);
 const writeIntent=!!target&&intent.codeRequested;
 if(writeIntent){
  const authorized=await hasGitHub(db);
  if(authorized){
   const count=await db.prepare("SELECT COUNT(*) AS n FROM code_jobs WHERE date(created_at)=date('now')").first();
   if(Number(count?.n||0)>=3)return {reply:'A equipe de programação atingiu o limite de três trabalhos de código hoje. Não criei um job fictício. Podemos continuar com planejamento ou retomar a programação após a renovação do limite.',delegation:{status:'blocked',reason:'Limite de programação'}};
   const id=crypto.randomUUID();
   const description=request.slice(0,3300);
   await db.prepare('INSERT INTO code_jobs(id,project_id,request,provider) VALUES(?,?,?,?)').bind(id,target.id,description,provider).run();
   try{
    await env.MISSIONS.create({id,params:{codeJobId:id}});
    await db.prepare('INSERT INTO activity(agent_id,description) VALUES(?,?)').bind('supervisor','Delegou ao Programador: '+intent.title.slice(0,160)).run();
    return {reply:'Entendi. Deleguei a implementação de **'+target.name+'** ao Programador. Você poderá acompanhar o código e a revisão no escritório. A entrega será um **pull request rascunho no GitHub**; não vou anunciar deploy em produção sem verificação.',delegation:{status:'queued',kind:'code',codeJobId:id,projectId:target.id,agents:['supervisor','programador'],title:intent.title}};
   }catch(e){
    await db.prepare("UPDATE code_jobs SET status='failed',detail=?,updated_at=CURRENT_TIMESTAMP WHERE id=?").bind('Workflow não iniciou: '+String(e.message||e).slice(0,180),id).run();
    return {reply:'O trabalho foi registrado, mas o Workflow não iniciou. O painel mostrará o erro real; nenhum código foi publicado.',delegation:{status:'failed',codeJobId:id}};
   }
  }
 }
 const daily=await db.prepare("SELECT COUNT(*) AS n FROM missions WHERE date(created_at)=date('now')").first();
 const max=Math.min(20,Math.max(1,Number(env.MAX_DAILY_MISSIONS)||3));
 if(Number(daily?.n||0)>=max)return {reply:'Sua solicitação exige trabalho da equipe, mas o limite diário de '+max+' missões já foi atingido. Nenhum agente foi acionado artificialmente. A solicitação pode ser retomada quando houver cota.',delegation:{status:'blocked',reason:'Limite diário de missões'}};
 const id=crypto.randomUUID();
 const description=request.slice(0,10000);
 await db.prepare("INSERT INTO missions(id,title,description,provider,status) VALUES(?,?,?,?,'queued')").bind(id,intent.title,description,provider).run();
 await db.batch(intent.agents.map(agent=>db.prepare('INSERT INTO agent_runs(id,mission_id,agent_id) VALUES(?,?,?)').bind(crypto.randomUUID(),id,agent)));
 try{
  await env.MISSIONS.create({id,params:{missionId:id}});
  await db.prepare('INSERT INTO activity(mission_id,agent_id,description) VALUES(?,?,?)').bind(id,'supervisor','Recebeu e distribuiu tarefa: '+intent.title.slice(0,160)).run();
  const list=intent.agents.filter(a=>a!=='supervisor').map(a=>AGENTS.find(x=>x.id===a)?.name||a).join(', ');
  const note=writeIntent&&!await hasGitHub(db)?' O GitHub ainda não está conectado, portanto esta execução será uma análise; não haverá alteração de arquivos.':intent.codeRequested&&!target?' Não identifiquei um repositório único com segurança; a equipe fará a análise e preparação, sem alterar código.':'';
  return {reply:'Recebi a tarefa e abri uma **missão real**. Vou coordenar **'+list+'** e registrar cada etapa no Escritório e em Missões. Você pode continuar conversando comigo enquanto a equipe trabalha. As ações e os resultados aparecerão assim que forem registrados.'+note,delegation:{status:'queued',kind:'mission',missionId:id,agents:intent.agents,title:intent.title}};
 }catch(e){
  await db.prepare("UPDATE missions SET status='failed',error=?,updated_at=CURRENT_TIMESTAMP WHERE id=?").bind('Workflow não iniciou: '+String(e.message||e).slice(0,180),id).run();
  await db.prepare("UPDATE agent_runs SET status='failed',output='Workflow não iniciou',finished_at=CURRENT_TIMESTAMP WHERE mission_id=?").bind(id).run();
  return {reply:'Registrei sua solicitação, mas a equipe não conseguiu iniciar: houve uma falha no Workflow. O erro real ficou salvo na missão; nenhum trabalho foi simulado.',delegation:{status:'failed',kind:'mission',missionId:id}};
 }
}
