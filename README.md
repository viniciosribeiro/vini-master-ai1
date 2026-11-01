# VINI MASTER AI — Alpha 0.3 | Projetos e automações

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
