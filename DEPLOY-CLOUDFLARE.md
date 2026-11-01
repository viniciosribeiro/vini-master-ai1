# Publicar VINI MASTER AI na Cloudflare

## Opção A — botão oficial (mais simples)
[**Implantar com Cloudflare**](https://deploy.workers.cloudflare.com/?url=https://github.com/viniciosribeiro/vini-master-ai)

1. Abra o link, entre na Cloudflare e autorize o GitHub, se solicitado.
2. Confirme o nome do Worker **vini-master-ai** e o repositório de destino. O fluxo oficial pode criar uma **cópia** do repositório durante a implantação.
3. Informe um segredo **MASTER_TOKEN** com 40 ou mais caracteres aleatórios no formulário. **Não compartilhe esse segredo em chats, issues ou commits.**
4. Deixe NVIDIA_API_KEY em branco na primeira implantação. Cloudflare Workers AI é o provedor inicial.
5. Escolha Deploy e abra o endereço **workers.dev** fornecido no final. Clique no cadeado e insira sua chave MASTER_TOKEN.
6. Teste uma conversa, a memória e uma missão. O D1 deve ser provisionado no deployment e as tabelas criadas na primeira chamada autenticada.

Documentação oficial: https://developers.cloudflare.com/workers/platform/deploy-buttons/

## Opção B — conectar o repositório atual, sem cópia

No painel https://dash.cloudflare.com/ → Workers & Pages → Create application → GitHub, selecione **viniciosribeiro/vini-master-ai**, branch **main**, Worker name **vini-master-ai**, deploy command **npx wrangler deploy**. Confirme o Deploy e configure o segredo MASTER_TOKEN no Worker → Settings → Variables & Secrets. Se o build automático falhar por falta de permissão D1, crie a conexão e confira as permissões da API de build e os logs; a opção A tende a ser mais simples para provisionar recursos automaticamente.

Documentação oficial: https://developers.cloudflare.com/workers/ci-cd/builds/

## Segurança

- O repositório de origem está **público**. Não há nenhuma chave de API no código.
- MASTER_TOKEN e NVIDIA_API_KEY são segredos de runtime; nunca devem entrar em wrangler.jsonc.
- Sem MASTER_TOKEN com pelo menos 24 caracteres a API responde 401 e bloqueia acesso ao chat e à memória.
- Antes de conversar, garanta que D1/Workers AI e Workflows estejam provisionados e vinculados.
- A versão atual oferece coordenação de análises textuais, **não** execução automática de commits/deploys.
- O usuário consegue exportar mensagens, memórias e missões e apagar mensagens pelo painel. Memórias fixadas são gerenciadas separadamente.
- O painel exibe a atividade real armazenada no banco, não estatísticas artificiais.

## Diagnóstico

- Interface abre, mas chat 401: configurar MASTER_TOKEN e preencher a mesma chave no cadeado.
- Chat 503: conferir binding DB e AI / cotas no Cloudflare Dashboard.
- Missão falha: verificar binding MISSIONS e logs de Workflows.
- NVIDIA não disponível: opcionalmente configurar secret NVIDIA_API_KEY e conferir cotas.
- Uma implantação somente poderá ser considerada concluída depois de verificar um link workers.dev gerado pela Cloudflare e executar testes remotos.
