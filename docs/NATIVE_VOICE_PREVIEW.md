# VINI — Cloudflare Native Voice preview (NOT deployed)

## Implementation status
This branch contains **source code only** for the native Cloudflare real-time voice backend and its browser client. The deployed VINI remains on 0.17.2 with browser-based turn voice. Do not merge/deploy this branch without the required checks.

## Scope
- Authenticated same-origin WebSocket `/agents/ViniVoiceAgent/:threadId`.
- Existing cookie/session verification + D1 thread validation before upgrade.
- One Durable Object per chat thread.
- Workers AI Nova-3 STT (pt-BR candidate), Workers AI TTS, same current project context loaded from D1.
- Conversation replies via current `callAI` router and saved to existing D1 thread.
- Browser `VoiceClient` using official Agents SDK.
- **No** voice-triggered production deployment or spending changes.

## Cloudflare configuration
- `wrangler.jsonc` adds SQLite Durable Object `ViniVoiceAgent`, migration `vini_voice_v1`, and `nodejs_compat`.
- `package.json` pins `agents@0.32.0` and `esbuild@0.28.2`.
- Build frontend client using `npm ci` (once lockfile generated) and `npm run build:voice` in a cloud build environment.
- Verify bundle is served and CSP `connect-src` permits **only the same-origin WSS endpoint**. Browser must send the existing session cookie.
- Add a visible but **feature-gated** button for this native voice client only in a preview environment.
- Use the current VINI deployment as a baseline; obtain explicit production authorization before promoting.

## Known blockers/required tests
1. The VINI Cloudflare account is not connected to a deployment tool in this conversation. Cannot configure DO/migrations or issue Wrangler deployment from this chat.
2. The SDK and esbuild were installed and executed in Vercel Sandbox; the native WebSocket runtime test passed on workerd locally. GitHub Actions remained blocked by billing. Cloudflare-hosted audio STT/TTS remains untested.
3. The current Workers AI Flux model is English-only; Nova-3 is the PT-BR candidate. Confirm Nova-3's continuous STT behavior with `withVoice` against SDK 0.32.0. If unsupported, implement a reviewed Deepgram multilingual adapter.
4. Workers AI Aura TTS may not supply native Brazilian pronunciation or the approved list of selectable voices. Do not market this as PT-BR voice selection before integrating and testing a compatible TTS provider.
5. Validate audio, cancellation, reconnection, 30-minute call, interruption, and D1 project isolation on the actual Android device.
6. Harden against duplicated turns, declined mic access, broken networks, speech echo and D1 unavailability.
7. Preserve existing PWA and browser-voice path as stable fallback; no production changes to main from this branch until acceptance.
8. Subscription and Workers AI/DO costs must be authorized and capped; no paid provider signup or added payment keys.

## Acceptance gate
PASS requires a real Cloudflare **preview** Worker, WebSocket upgrade 101 only when authenticated and thread active, transcript from pt-BR mic, actual spoken PT-BR audio by selectable voice, live interruption, project-scoped D1 messages, error-free logs, independent E2E checks, and rollback. Otherwise HOLD. Production promotion remains a separate approval.


## Evidência de compilação e smoke no Sandbox — 01/11/2026
O teste foi executado em Vercel Sandbox temporário com Node 24.22.1, agents 0.32.0, esbuild 0.28.2 e Wrangler 4.156.0. Foram copiados os **24 arquivos `src/*.js` reais do repositório**, sem credenciais de produção. A conta GitHub Actions não participou.

| Verificação | Resultado |
| --- | --- |
| `esbuild src/vini-native-voice-client.js` | PASS, bundle 85,4 KB |
| `wrangler deploy --dry-run` do Worker completo | PASS, 2,5 MB (gzip ~482 KB) |
| Bindings reconhecidos | ViniVoiceAgent Durable Object, D1, AI, MISSIONS e ASSETS |
| `node --test tests/native-voice-contract.test.mjs` | PASS 8/8 |
| HTTP `GET /api/health` no workerd | 200 |
| HTTP `GET /api/threads` anônimo | 401 |
| WebSocket anônimo `/agents/vini-voice-agent/:threadId` | 401 |
| Login via sessão de QA, sem credenciais reais | 200 |
| `GET /api/threads` autenticado | 200 |
| WebSocket autenticado com conversa inexistente | 404 |
| Criação de conversa de teste D1 local | 201 |
| Upgrade WebSocket autenticado da conversa real | **101 Switching Protocols**; eventos `welcome`, `status` e `cf_agent_identity` recebidos |

**Limitações do teste**:
- O runtime workerd publicado com Wrangler 4.156.0 ainda suporta até a data **2026-10-30**, enquanto a configuração real usa **2026-10-31**. Somente a cópia temporária do QA recebeu override para 2026-10-30; não foi alterada a compatibilidade da produção.
- A chamada de voz com microfone, o STT Nova-3 real, TTS de português e interrupção **NÃO** foram executados. O binding Workers AI local fica indisponível. O 101 prova roteamento/autenticação e vínculo à conversa, não áudio funcional.
- Nenhuma migração/Worker foi publicada na conta Cloudflare real. Não houve instalação de APK.
- Dados e segredo utilizados no teste são sintéticos e confinados ao ambiente efêmero. Não divulgar nem reutilizar como credenciais.
- O caminho `/agents/vini-voice-agent/:threadId` deve permanecer protegido por autenticação no Worker antes do upgrade. O `run_worker_first` inclui `/agents/*`.

**Próximo gate obrigatório**: executar uma implantação em Workers **preview** com binding D1 de QA, testar STT em pt-BR, TTS audível e interrupção no Android. Só depois pedir aprovação explícita para produção.
