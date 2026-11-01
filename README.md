# VINI MASTER AI — Alpha 0.2.1

Central visual de agentes de IA para a Cloudflare, desenvolvida com Workers, Workers AI, Workflows e banco D1.

**[Implantar com Cloudflare](https://deploy.workers.cloudflare.com/?url=https://github.com/viniciosribeiro/vini-master-ai)** · [Passos e segurança](DEPLOY-CLOUDFLARE.md)

## Funcionalidades

- Painel responsivo com escritório virtual isométrico, seis estações selecionáveis e indicadores baseados em registros reais.
- Chat do supervisor com **Cloudflare Workers AI** e opção de **NVIDIA NIM**.
- Missões duráveis via Workflows: supervisor planeja, cinco especialistas analisam sequencialmente e supervisor consolida.
- Histórico de mensagens no D1, índice FTS5 de busca por termos, memórias fixadas e comando **lembre que...**.
- Pesquisa de conversas, exportação JSON de dados principais e exclusão de mensagens/memórias selecionadas.
- Proteção de API pelo segredo **MASTER_TOKEN**; sem segredo válido, chat e memória ficam bloqueados.
- Limite inicial de três novas missões por dia para reduzir consumo de cotas.

## Começar

1. Clique em [Implantar com Cloudflare](https://deploy.workers.cloudflare.com/?url=https://github.com/viniciosribeiro/vini-master-ai).
2. Configure o segredo obrigatório **MASTER_TOKEN** com uma chave longa e exclusiva (40+ caracteres).
3. Aguarde a Cloudflare concluir e abra o endereço workers.dev que ela apresentar.
4. Clique no cadeado 🔐 na interface, informe o mesmo segredo e use o chat.
5. Para conectar a NVIDIA, abra Configurações → Inteligências artificiais, informe a sua chave no formulário e clique em Validar e conectar. A chave é verificada por uma chamada real e armazenada cifrada no D1. NVIDIA_API_KEY como secret Cloudflare continua sendo alternativa opcional.

**Atenção:** não há confirmação de deploy real até a Cloudflare gerar e testar o endereço. O código não permite alterar repositórios, executar software externo ou publicar aplicações: os agentes geram análises e relatórios. O histórico começa com as conversas feitas neste aplicativo; não importa automaticamente chats anteriores do ChatGPT.

## Estrutura

`public/`: interface responsiva; `src/`: API, modelos, memória e Workflows; `wrangler.jsonc`: recursos Cloudflare; `tests/`: verificações de lógica e segurança; `DEPLOY-CLOUDFLARE.md`: guia.

## Privacidade

O repositório de origem é **público**, mas não contém chaves nem conversas. Históricos são armazenados no D1 da conta que fizer o deploy, não no GitHub. Quando NVIDIA é selecionada, o contexto das mensagens necessário à resposta é enviado à NVIDIA. Não cole credenciais no chat.

Os provedores possuem cotas e regras próprias; a disponibilidade gratuita não é ilimitada.


## Diagnóstico de IA (atualização de 1º novembro de 2026)
- Endpoint de saúde sem dados privados: `GET /api/health`, mostra se o binding `AI`, D1 e `MASTER_TOKEN` estão presentes.
- Cloudflare Workers AI funciona sem chave externa: `ai.binding=AI` no `wrangler.jsonc`.
- NVIDIA pode ser conectada via Configurações; antes de armazenar a chave o backend executa um teste real. Nunca envie chave no chat ou no GitHub.
- O segredo é cifrado (AES-GCM com chave derivada via HKDF de `MASTER_TOKEN`) no D1. Se o MASTER_TOKEN mudar, reconecte a NVIDIA.
- Diagnóstico atual do ambiente público: `cloudflareAI=true`, `d1=true`, `accessConfigured=false`. Enquanto o secret MASTER_TOKEN não tiver pelo menos 24 caracteres, a API de chat e memória retorna 401; a IA não poderá ser testada autenticada.
- No Cloudflare Dashboard > Workers & Pages > `vini-master-ai1` > Settings > Variables and Secrets, cadastre `MASTER_TOKEN` como Secret com pelo menos 40 caracteres; depois abra o cadeado na aplicação.
