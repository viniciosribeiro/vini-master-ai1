# VINI MASTER AI — Orquestração Real 0.7.0

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
