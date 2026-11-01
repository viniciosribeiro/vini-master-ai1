/**
 * VINI Cloudflare native WebSocket voice (preview-only until tested on Workers).
 * Each Durable Object instance corresponds to ONE existing D1 chat thread.
 * This class has no tools that can deploy, purchase, delete or edit production.
 * Worker entrypoint MUST authorize the incoming WebSocket before forwarding it.
 *
 * Voice STT: Cloudflare-hosted Nova-3 (supports Brazilian Portuguese).
 * Voice TTS: Workers AI Aura baseline -- Brazilian pronunciation is not guaranteed.
 * Higher-quality selectable PT-BR TTS requires separately reviewed provider adapter.
 */
import { Agent } from 'agents';
import { withVoice, WorkersAINova3STT, WorkersAITTS } from 'agents/voice';
import { ElevenLabsTTS } from '@cloudflare/voice-elevenlabs';
import {chooseThread,getThreadMessages,saveThreadMessage} from './chat-threads.js';
import {callAI} from './ai.js';

// ElevenLabs is always opt-in; never charge a third-party account on a default call.
// The voice ID is selected explicitly in Cloudflare Worker settings/secrets.
function createVoiceTTS(env){
 if(env.VINI_VOICE_PROVIDER==='elevenlabs'){
  const voiceId=String(env.VINI_ELEVENLABS_VOICE_ID||'');
  if(!env.ELEVENLABS_API_KEY||!/^[A-Za-z0-9]{20}$/.test(voiceId)){
   throw Error('ElevenLabs solicitado, mas não autorizado/configurado. Nenhum serviço de voz externo será acionado.');
  }
  return new ElevenLabsTTS({
   apiKey:env.ELEVENLABS_API_KEY,
   voiceId,
   modelId:'eleven_flash_v2_5',
   outputFormat:'mp3_44100_128'
  });
 }
 if(env.VINI_VOICE_PROVIDER&&env.VINI_VOICE_PROVIDER!=='cloudflare'){
  throw Error('Provedor TTS não autorizado. Nenhum custo externo será gerado.');
 }
 return new WorkersAITTS(env.AI);
}

const BaseVoiceAgent=withVoice(Agent,{historyLimit:20,maxMessageCount:500});
const VOICE_SYSTEM=[
  'Você é o VINI Master AI, conversando ao vivo com o proprietário em português brasileiro.',
  'Responda com naturalidade, de preferência com até quatro frases por turno.',
  'Ajude a raciocinar sobre requisitos e arquitetura de desenvolvimento de software.',
  'Trate ideias em discussão como propostas; só considere decisões aprovadas quando o usuário confirmar.',
  'Você está no canal de conversa. Não possui ferramentas de deploy nem de execução neste modo.',
  'Não diga que criou arquivos, alterou projetos ou publicou código se isso não aconteceu.',
  'Nunca recite URLs, segredos, tokens ou grandes blocos de código na fala.',
].join(' ');

export class ViniVoiceAgent extends BaseVoiceAgent {
 transcriber=new WorkersAINova3STT(this.env.AI);
 tts=createVoiceTTS(this.env);
 async onTurn(transcript,context) {
  const spoken=String(transcript||'').trim().slice(0,3500);
  if(!spoken||context?.signal?.aborted)return '';
  if(!this.env.DB)return 'O banco de conversas não está disponível. Não vou registrar uma conversa incompleta.';
  const threadId=String(this.name||'');
  try{
   const thread=await chooseThread(this.env.DB,threadId);
   if(!thread.project_id&&!thread.is_draft)return 'Selecione um projeto antes de conversar por voz.';
   await saveThreadMessage(this.env.DB,threadId,'user',spoken,'cloudflare-voice');
   const result=await getThreadMessages(this.env.DB,threadId,{limit:18});
   if(context?.signal?.aborted)return '';
   const messages=[
    {role:'system',content:VOICE_SYSTEM+' Projeto selecionado: '+String(thread.project_name||'rascunho')+'.'},
    ...result.messages.filter(m=>['user','assistant'].includes(m.role)).map(m=>({role:m.role,content:String(m.content||'').slice(0,3000)}))
   ];
   const answer=await callAI(this.env,messages,'auto');
   if(context?.signal?.aborted)return '';
   const reply=String(answer.text||'').replace(/https?:\/\/\S+/g,'').slice(0,1100).trim();
   if(!reply)throw Error('A resposta da IA veio vazia.');
   await saveThreadMessage(this.env.DB,threadId,'assistant',reply,answer.provider||'cloudflare-voice');
   return reply;
  }catch(error){
   console.warn('VINI voice turn failed:',String(error?.message||error).slice(0,100));
   return 'Não consegui completar essa resposta agora. A conversa permanece disponível no histórico do projeto.';
  }
 }
}
