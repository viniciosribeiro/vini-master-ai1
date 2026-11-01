# VINI MASTER AI 0.13.0 — Conversas organizadas como ChatGPT por projeto

- Cada conversa nova tem um identificador D1 e pertence a um projeto ativo. O chat carrega apenas mensagens da conversa escolhida e trechos relevantes de outras conversas **do mesmo projeto**; não mistura mensagens de projetos diferentes em contexto da IA.
- Nova sidebar de conversas, com busca por título ou conteúdo, agrupamento por projeto e filtro de projeto, estados Ativas / Arquivadas / Lixeira. Celular usa gaveta lateral; desktop usa painel permanente ao lado do chat.
- Criar conversa no projeto, renomear título, mover conversa completa entre projetos, arquivar, restaurar, enviar à lixeira e exclusão definitiva em duas etapas. Projetos possuem atalho de nova conversa.
- Histórico antigo preservado em "Histórico anterior (organize por projeto)" e sem atribuição arbitrária; pode ser movido para o projeto correto. Nenhum histórico foi apagado no upgrade.
- Entrevistas para criar um novo projeto usam uma conversa isolada e, ao finalizar, vinculam a conversa ao projeto recém-criado. Pedidos de novo projeto dentro de outro chat solicitam conversa separada.
- Rota autenticada GET/POST /api/threads; GET/PATCH/DELETE /api/threads/:id; GET /api/threads/:id/messages. As mensagens são vinculadas por thread_id, migração é idempotente e a busca de contexto por FTS é limitada ao projeto.
- Exclusão pela lixeira apaga definitivamente apenas quando confirmada; renomear ou mover conversa não altera repositórios ou plataformas externas.
- Testes em tests/chat-threads.test.mjs validam migração, separação das mensagens, edição, arquivo e lixeira.

Limite: as conversas antigas não tinham metadados de projeto. Elas são preservadas em uma área não classificada até o usuário decidir onde colocá-las. Ainda é necessário testar o caminho de autenticação e escrita no D1 de produção com o proprietário para comprovar o fluxo end-to-end.

# VINI MASTER AI 0.12.0 — Conversa contextual e estado real dos agentes

- Corrigida a regressão em que o filtro de promessas substituía indiscriminadamente mensagens pela resposta "Não executei esse build / Conecte Vercel", mesmo quando o usuário reclamava dos agentes parados. O filtro agora bloqueia somente alegações de execução externa sem comprovante e preserva as partes úteis da resposta, sem citar plataformas não solicitadas.
- Pedidos explícitos de build/deploy continuam sujeitos à validação de projeto e integração, mas conversas sobre falhas anteriores e perguntas não são confundidas com comandos de deployment.
- Mensagens como "você só fala, os agentes estão parados" recebem uma resposta determinística e atualizada a partir do Cloudflare D1, informando quantidade de agentes marcados trabalhando, última missão e status. Nenhuma IA inventa execução.
- O Chat exibe ações "Ver diário real" e "Ver comprovantes" associadas à resposta operacional. O status "VINI está pensando" é resetado assim que a resposta chega, antes de consultas secundárias de atualização.
- Novos testes em tests/work-status.test.mjs e alterações nos testes de guardas para prevenir a regressão, incluindo a mesma frase da captura enviada pelo usuário.
- Limite: estados provêm dos registros persistidos; missões de análise não são commits, PRs nem publicações. Teste autenticado de execução contínua na conta do usuário ainda é necessário para comprovar trabalho externo.

# VINI MASTER AI 0.11.0 — Correções Vercel e login persistente

- Corrigido erro concreto da Cloudflare Workers: fetch de Vercel com redirect: 'error' falhava antes da requisição. Agora usa 'manual' e rejeita HTTP 3xx, sem encaminhar Bearer token a outro host.
- Login via POST /api/auth/login; MASTER_TOKEN enviado apenas para validar a senha; o servidor retorna cookie "__Host-vini_session" assinado com HMAC-SHA256, Secure, HttpOnly, SameSite=Strict e Path=/.
- "Manter conectado neste dispositivo" é opt-in na tela (pré-selecionado) e cria sessão por até 30 dias; sem a opção, expiração criptográfica em até 12 h e cookie de sessão. Nenhum MASTER_TOKEN fica salvo em localStorage/sessionStorage. Sessões antigas em sessionStorage são migradas automaticamente uma única vez após validação.
- Requisições de escrita com cookie exigem Origin idêntico ao site; cabeçalhos Bearer legados continuam temporariamente aceitos para automações e migração. Trocar MASTER_TOKEN revoga todas as sessões.
- A nova opção "Sair deste dispositivo" apaga o cookie. Projetos, Chat, Histórico, Memória e integrações passam a usar a sessão autenticada sem senha em cada visita.
- Testes unitários adicionais em tests/session-auth.test.mjs e testes de redirecionamento em tests/vercel-connector.test.mjs.
- A conexão Vercel anterior falhou antes de validar a API, portanto o usuário precisará colar o token uma vez após esta correção e tocar em "Validar e conectar Vercel". O token então será armazenado cifrado no banco D1.
- Ainda não se deve anunciar que a Vercel foi conectada ou rebuild executado sem uma chamada autenticada e resposta real da plataforma.


# VINI MASTER AI 0.10.0 — Conectar Vercel e executar builds de prévia reais

Nesta versão, falas como "vou forçar um build" não são aceitas como execução. O VINI redireciona à opção executável, sem texto longo: conectar Vercel na página Configurações, identificar o projeto/deployment real, confirmar e acompanhar o ID.

**Vercel REST API no próprio Cloudflare Worker:** GET /api/vercel/status, POST /api/vercel/connect, POST /api/vercel/disconnect, GET /api/vercel/projects, GET /api/vercel/deployments?projectId=..., GET /api/vercel/builds, POST /api/vercel/preview-redeploy, GET /api/vercel/builds/<id>. Todos exigem MASTER_TOKEN. A chave Vercel fica cifrada via AES-GCM e HKDF usando a chave Master e nunca é devolvida ao navegador.

A conexão é feita na interface, com token gerado diretamente na Vercel; não compartilhe tokens nas conversas. A opção de Team ID é opcional. Contas conectadas ao ChatGPT não concedem automaticamente acesso ao Worker.

**Limites de segurança:** apenas PRÉVIA é aceita neste fluxo; nenhuma ação publica/atualiza produção. Rebuild só depois de confirmação explícita na interface e validação do projeto e deployment pelo token. Até 3 rebuilds/dia. D1 registra ID, status, origem, projeto e alterações de estado, sem expor tokens. O frontend só mostra link clicável depois de a Vercel declarar READY; READY não prova que o app passou por testes funcionais. A API Vercel é a autoridade sobre o build, não o texto do modelo.

Testes de lógica em tests/vercel-connector.test.mjs. Os testes simulados validam host, autenticação, tratamento de falha e separação de responsabilidade. **A conexão/implantação real exige que o usuário conecte seu token Vercel a este aplicativo**; não foi alegado teste autenticado na conta antes disso.


# VINI MASTER AI — Evidências e Execuções 0.9.0

# VINI MASTER AI — Monitor de Ações 0.8.0

## Versão 0.8.0 — Diário de execução em tempo quase real

- Endpoint autenticado `GET /api/live?after=N&limit=110` consulta eventos D1 reais em ordem crescente por ID, devolve cursor e evita cache. Limite de 5 a 120 eventos por chamada, sem websockets ou polling permanente de GPU.
- A interface mobile acompanha eventos por atualização incremental de cerca de 1,7 segundo enquanto uma missão está na fila/em execução, e reduz consultas quando ociosa ou com aba oculta. Os estados dos agentes vêm de `agent_runs` / `code_agent_runs` — o histórico não gera estados falsos.
- Diário acessível no Escritório e no Chat, com filtro por Supervisor/VINI, Programador, Designer, QA, Infra e Pesquisa, horário, etapa, status e vínculo à missão; diálogo móvel independente da rolagem do chat.
- Cada robô abre seus registros reais pelo botão "Ver ações reais e histórico deste agente". As últimas ações permanecem mesmo após a missão terminar; não existe inventar progresso para entretê-lo.
- Pipeline de código vincula registros de atividade ao ID real do trabalho; Workflow registra recuperação de contexto, planejamento, delegação, chamadas de IA, pareceres e consolidação, mas não expõe pensamento privado de modelos.
- Quando limites diários ou Workflows bloquearem a execução, VINI registra um evento de bloqueio. Publicação/deploy continua sujeita a verificação real e nunca é assumida a partir de uma frase do modelo.
- Eventos antigos continuam persistidos no D1; o monitor carrega inicialmente os 110 mais recentes e mantém até 280 no cliente. Dados sensíveis nunca são colocados em interfaces públicas sem autenticação.
- A implementação e os testes de cursor/fluxo podem ser verificados no repositório; testes end-to-end com uma missão autenticada precisam ser feitos com a chave privada do proprietário, não acessível aqui.

# VINI MASTER AI — Orquestração 0.7.1

# VINI MASTER AI — JARVIS Robot Edition 0.6.1

Interface chat-first, seis robôs minimalistas não humanos em um escritório responsivo, dados reais de tarefas, voz progressiva por APIs do navegador e PWA Android. Publicação via Cloudflare Workers Builds no repositório `viniciosribeiro/vini-master-ai1`.

# VINI MASTER AI — Alpha 0.4 | Projetos, escritório vivo e PWA Android

**Aplicação publicada:** https://vini-master-ai1.viniciosribeiro.workers.dev/

## O que funciona no código atual

- Interface mobile de escritório virtual e equipe de seis agentes.
- Conversa pelo Cloudflare Workers AI (NVIDIA opcional via conexão própria).
- Histórico pesquisável e memórias explícitas no Cloudflare D1.
- **Projetos:** criar, editar informações, renomear no painel, arquivar, enviar para lixeira, restaurar e apagar definitivamente o registro do painel.
- **GitHub:** conexão autorizada via token restrito, cifrado em repouso no D1; importar os repositórios acessíveis e sincronizar novos automaticamente.
- **Programação:** missão de código gera até três arquivos dentro de um escopo permitido e abre uma branch + **PR em rascunho** no repositório GitHub vinculado. O resultado e os erros aparecem no painel. Não executa merge.
- **Ideias:** análise sob demanda e revisão periódica de projetos com sugestões e alertas no painel.
- **Perfil de trabalho:** síntese semanal das conversas do usuário e dos projetos, editável ou apagável. Não treina pesos dos modelos.
- Cron diário às 12h UTC: importa novos repositórios (quando autorizado) e analisa um projeto ativo, evitando reanalisar o mesmo projeto em menos de sete dias.
- Cron semanal segunda-feira às 11h UTC: atualiza o perfil de trabalho.

## Novidades da 0.4

### Entrevista ao criar um projeto
Quando o usuário escreve **"Quero criar um site/sistema/app..."** ou toca em **Novo projeto com entrevista** no chat, o supervisor inicia até **cinco perguntas**, uma de cada vez:
1. Onde publicar? Cloudflare, Vercel ou outra hospedagem (sempre a primeira pergunta).
2. Nome e objetivo.
3. Público-alvo e dispositivos.
4. Funcionalidades indispensáveis.
5. Estilo visual e repositório GitHub já existente, se houver.

O usuário pode escrever **PODE INICIAR** em qualquer momento; após a quinta resposta o fluxo inicia automaticamente. O projeto e as respostas ficam no D1. Se houver GitHub autorizado e repositório informado, é agendada uma tarefa de código para PR rascunho; caso contrário, é agendada uma missão de planejamento, quando houver cota de Workflows. **Não existe publicação imediata de código gerado em produção.**

### Links de deploy
Em **Projetos**, cada cartão exibe links cadastrados de **produção** e **prévia**. Na página do projeto é possível informar URLs HTTPS ou clicar **Procurar deploys no GitHub**. Ao abrir o projeto, o sistema consulta automaticamente deployments bem-sucedidos, com limite de frequência. A revisão diária também busca links dos projetos ativos. Links obtidos do GitHub são baseados em registros de status **success** e não equivalem a uma verificação de disponibilidade HTTP em tempo real; URLs informadas manualmente não são verificadas.

Para consultar deployments **privados**, o token fine-grained necessita **Deployments → Read-only**, além de Contents → Read/Write e Pull requests → Read/Write para os PRs. Não é necessário Deployments Write. Repositórios com build que não publica uma URL de ambiente precisam do cadastro manual ou de futura integração específica do provedor.

### Escritório vivo
O escritório apresenta status de tarefas registradas no D1, atualizadas periodicamente: animação mais visível quando o Workflow está trabalhando, pequena movimentação neutra quando o agente está disponível, mini balões com as últimas ações **reais** e uma notificação temporária quando surgem novos eventos. Não inventa progresso, nem mostra toda a equipe trabalhando se ela estiver parada. A equipe de programação alimenta o registro de eventos ao ler GitHub, gerar arquivos e abrir PR.

### Instalação Android
O mesmo endereço HTTPS possui web app manifest, ícones PNG 192/512, service worker e modo **standalone**. No Chrome Android, abra o site e toque em **Instalar app**, ou no menu ⋮ → **Instalar aplicativo / Adicionar à tela inicial**. O PWA cria um ícone no celular e pode abrir sem barra de navegador. Não é APK na Play Store; conexão é necessária para IA, projetos, login e memória. O service worker armazena somente arquivos públicos da interface (nunca APIs ou mensagens privadas).


## Como usar pelo celular

1. Acesse o aplicativo e entre com **MASTER_TOKEN** no cadeado. Nunca envie esse segredo pelo chat.
2. Abra **Projetos** para criar e administrar seu portfólio.
3. Em **Configurações**, conecte o GitHub uma vez com um token fine-grained limitado aos repositórios desejados, com permissão **Contents: Read/Write** e **Pull requests: Read/Write**.
4. A conexão valida acesso de escrita e importa os repositórios acessíveis. O token fica cifrado no banco D1.
5. Abra o projeto importado, descreva o código que deseja e clique em **Delegar código ao Programador**.
6. O resultado é uma URL de PR no GitHub, não uma publicação em produção. A integração GitHub ↔ Cloudflare/Vercel de cada projeto pode produzir builds/previews se já estiver configurada.
7. Revise ideias em **Projetos** e ajuste seu perfil em **Memórias**.

## Limites e segurança

- Ao renomear, arquivar ou excluir um projeto **no painel**, isso altera apenas seu cadastro no D1. Não deleta nem renomeia o GitHub, os Workers ou as aplicações Vercel.
- A exclusão no painel passa pela lixeira; exclusão definitiva exige confirmação textual explícita.
- Os agentes **não executam código gerado em ambiente isolado**, não verificam testes E2E e não fazem merge/deploy automático do PR. As verificações são estáticas e limitadas.
- Use o PR como proposta de alteração e habilite testes/builds e prévias isoladas antes de qualquer merge. **Nunca vincule os segredos de produção a builds de código não confiável.**
- A integração direta GitHub ↔ Cloudflare Workers Builds publica alterações na branch configurada; não depende de GitHub Actions.
- O sistema lembra conversas feitas **dentro do VINI MASTER AI**. Não importa automaticamente as conversas anteriores do aplicativo ChatGPT.
- Sugestões periódicas são produzidas a partir dos dados e modelos disponíveis, não de pesquisa atualizada na internet.
- Alertas são **dentro do aplicativo**; notificações push, email e WhatsApp ainda não foram implementadas.
- Todas as funcionalidades estão sujeitas às cotas gratuitas e limites de NVIDIA, Workers AI, D1, Workflows e GitHub.

## Validação adicional da 0.4

- A publicação do Worker foi confirmada com versão `0.4.0`, bindings AI, DB e MISSIONS ativos.
- Manifest e service worker são servidos pelo endereço online, com ícones PNG 192px e 512px presentes no repositório publicado.
- Funções novas foram verificadas sintaticamente e a sequência de cinco perguntas foi simulada com banco de testes; a entrevista iniciou na hospedagem e encerrou com projeto registrado.
- A ligação autenticada com GitHub e um deploy externo ainda exige teste end-to-end após configuração do token com escopo adequado. A instalação PWA precisa ser confirmada em Chrome Android real.

## Validação

- Sintaxe dos módulos novos e 13 verificações funcionais locais de validação de projeto, escopo de arquivos e lixeira passaram.
- A página e os novos recursos de interface foram verificados como publicados no endereço Cloudflare.
- /api/health reportou bindings de Workers AI e D1 presentes e autenticação configurada.
- /api/projects e /api/profile retornaram 401 quando consultados sem MASTER_TOKEN, como esperado.
- **Ainda falta um teste autenticado ponta a ponta** do banco D1, dos modelos, do GitHub autorizado e de uma missão criando PR. Sem o token privado do painel e autorização GitHub interna do aplicativo, não é correto afirmar que essas etapas passaram.

## Referências

- Cloudflare Cron: https://developers.cloudflare.com/workers/configuration/cron-triggers/
- Cloudflare Workers Builds: https://developers.cloudflare.com/workers/ci-cd/builds/
- Cloudflare Workflows: https://developers.cloudflare.com/workflows/
- GitHub tokens fine-grained: https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens

## Mudanças 0.5 (Robot Edition)
- O chat virou a tela inicial. A aba Escritório contém seis robôs de CSS/HTML (VINI, Programador, Designer, QA, Infra, Pesquisa), sem rostos humanos.
- Os estados de trabalho e avisos vêm exclusivamente das tarefas/atividades reais do banco D1. Não inventar progresso ou agentes ocupados.
- Barra de chat persistente fora da página de Chat, abertura de agente com detalhes, avatar JARVIS com animação leve e adaptatividade para telas de 320px em diante.
- Voz opcional via reconhecimento Web Speech e síntese de voz do navegador em pt-BR, onde houver suporte e permissão; não é conversa de voz streaming nem garantia de compatibilidade em qualquer navegador. Mensagens só são enviadas ao servidor quando o reconhecimento termina; frases faladas podem usar serviços do próprio navegador.
- O chat reduz o holograma quando o histórico cresce. Mantidos autenticação, GitHub, D1, Workflows, NVIDIA, Cloudflare AI, catálogo de projetos e PWA.
- Testar autenticado: conversa, voz no Chrome Android, criação de missão e atualização real de estado ainda requerem sessão do usuário e permissões de microfone.

## Correções 0.6.1 — status real e robôs expressivos
- Chat não executa deploy; o prompt proíbe afirmar publicação e o servidor neutraliza falsas afirmações e URLs de plataforma que não constam como verificadas.
- HTML cru de links antigos fica legível, e o cliente sinaliza links antigos não confirmados. Links realmente verificados podem aparecer como cards clicáveis.
- Projetos possuem status de produção/prévia distinto do endereço: `online`, `unavailable`, `unverified`. No cadastro só são links online quando verificados por GET HTTP 2xx, sem seguir redirecionamentos; erros 404 e 401 não passam.
- Verificação automática restrita aos hosts HTTPS conhecidos de plataformas (workers.dev, pages.dev, vercel.app etc.). Domínios personalizados não são sondados automaticamente sem autorização/validação de domínio; permanecem não verificados. Um HTTP 2xx é confirmação da resposta HTTP naquela data, não garantia de funcionalidade completa do site.
- Histórico de atividade da Infra registra mudanças reais na disponibilidade. O escritório mostra movimentos ambientados sem alegar trabalho, e expressões específicas para missão ativa, concluída, falha ou em espera.
- Robôs simples não humanos: piscam, mexem antenas, braços e boca; VINI reage quando escuta/processa/fala (mediante suporte de voz no navegador). CSS respeita preferência de acessibilidade por redução de movimento.
- Retirado o `microphone=()` da política de permissões que bloqueava a autorização do usuário. Chrome Android pode solicitar permissão para o microfone; reconhecimento de voz depende do navegador e do serviço configurado no próprio sistema, não de um backend de streaming dedicado.
- PWA possui manifest standalone, ícones, cache somente dos assets públicos, aviso offline e botão de instalação com maior contraste. Backend da IA, memória e GitHub continuam exigindo internet.
- Testes adicionados para o bloqueio de links falsos. Builds são publicados pelo GitHub → Cloudflare. Um teste autenticado de ponta a ponta, a usabilidade real em Chrome Android e um deploy externo real ainda precisam ser verificados na sessão da aplicação.

## Versão 0.7.0: conversar com o supervisor ativa agentes reais

- O chat detecta ordens concretas para corrigir, implementar, revisar, testar, pesquisar e planejar. Perguntas comuns, saudações e comandos negativos continuam como conversa, sem gastar tokens de uma missão.
- O roteador escolhe só os especialistas necessários e registra em D1 uma missão vinculada a um Workflow real, com ID, status, agentes e trilha de eventos. As respostas informam se a tarefa está na fila, em execução, concluiu ou falhou; nunca anunciam execução se a fila ou a cota bloquearem.
- O supervisor prepara o plano, especialistas independentes trabalham em etapas duráveis paralelas do Cloudflare Workflows e o supervisor consolida as entregas; a atividade exibida no Escritório é o estado real do banco, não uma simulação. As tarefas analíticas não editam código.
- Para uma solicitação explícita de programação com um repositório identificado sem ambiguidades e GitHub conectado, um job separado pode gerar arquivos e abrir um PR rascunho via GitHub. Esse caminho não faz merge nem deploy em produção por conta própria. Sem alvo autorizado, a equipe prepara análise e explica o que falta.
- Entrevistas de novos projetos e o comando PODE INICIAR continuam com o fluxo próprio. Confirmações curtas como Faça tudo podem retomar uma solicitação recente suficientemente identificável sem duplicar uma missão já atribuída.
- O Chat exibe aviso de missão ativa e atalhos para o Escritório. As estações mostram Aguardando, Trabalhando, Concluído e Falha com base nos registros. Polling é de cerca de 3 s durante missões abertas e mais espaçado quando ocioso, pausado com aba oculta ou sem internet.
- Mantida política de uso consciente: MAX_DAILY_MISSIONS (padrão 3), limite de jobs de programação (3/dia), necessidade de conexões e permissões GitHub, sem alegar publicação ou testes não realizados.

**Validação:** classificação e delegação verificadas com testes simulados. A confirmação final de uma missão com credenciais do usuário depende de executar um pedido autenticado no aplicativo, não pode ser inferida apenas da presença do Workflow configurado.

### Complemento 0.7.1: equipe de programação de verdade
O pipeline de PR registra Supervisor, Programador, QA (revisão estática) e Designer (revisão textual quando houver interface) em `code_agent_runs` (D1). O Escritório observa `codeRuns` e apresenta progresso real por agente. Animação de trabalhando exige `status=working` registrado. Nenhuma chamada de modelo é alegada como teste de navegador ou deploy. Teste simulado do pipeline gerou PR mock e registrou as quatro especialidades; isso não equivale à execução autenticada do GitHub.

## Correção de confiança 0.9.0
- O chat de IA **não possui ferramentas para executar build Vercel**, mesmo que a resposta natural diga o contrário. O backend agora bloqueia pedidos diretos de build/deploy não suportados e deixa isso explícito no recibo de execução, sem gastar tokens com missão fictícia.
- Respostas livres da IA são filtradas contra promessas de ações externas sem prova. Uma resposta normal recebe badge "Somente conversa, nenhuma execução externa confirmada". Missões recebem ID com status próprio. Mensagens históricas suspeitas são rotuladas como não comprovadas.
- `/api/evidence` autenticado agrega registros D1 de jobs de programação e missões de análise. Apenas code_jobs concluídos com PR de `github.com/<owner>/<repo>/pull/<n>` correspondente ao repositório são apresentados como trabalho externo verificável. Relatórios são marcados "Análise de IA; não altera código nem faz deploy". Nenhum PR significa nenhum código comprovado.
- Chat e Escritório têm atalho para os Comprovantes; o painel mostra fila, falha, relatório e PR com URL originada do executor. A UI não simula execução ou deploy.
- Respostas de conversa não acionam popups que confundam conversa com trabalho de equipe; robô volta ao estado pronto após responder. Quando Workflow está encerrado, 0 agentes trabalhando é honesto e registros persistem no diário.
- Testes de lógica e de rejeição de falsas promessas em `tests/action-proof.test.mjs`. **Ainda não há integração com a API de deploy da Vercel; não anunciar build como executado.** Uma integração operacional exige credenciais/permissões e um executor real de publicação. Não enviar segredos pelo chat.
- Testes de regressão de lógica não substituem verificar um PR real sob credenciais de produção nem comprovar uma implantação externa.
