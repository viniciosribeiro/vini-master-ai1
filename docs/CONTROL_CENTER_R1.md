# VINI MASTER AI — Control Center R1 (0.15.0)

Referência visual aprovada em 01/11/2026: tema escuro neon ciano/violeta, cartões de agentes, rede neural, dashboards mobile e desktop. O código continua executando via Cloudflare Workers e D1; sem infraestrutura local do proprietário.

## Áreas implementadas
- Chat: histórico D1 por projeto, gerenciamento de threads, acesso rápido a rede e vínculo do histórico legado.
- Escritório: cinco especialistas e supervisor, atividade real do D1, cronologia de eventos, diário e comprovantes.
- Projetos: busca, filtro, favoritos locais, arquivados, GitHub, criação manual, criação guiada por IA e templates de preenchimento.
- Missões: criação geral ou ligada a projeto, estado, agente, histórico, busca, reuso e acompanhamento.
- Rede Neural: topologia e estado dinâmicos do D1; sem progresso inventado.
- Memória: indicadores persistidos, preferências, pesquisa e exclusão.
- Configurações: diagnóstico autenticado do ciclo completo de uma conversa temporária com limpeza final.

O progresso de missão significa agentes com análise concluída / agentes atribuídos, e não desenvolvimento ou deploy. Mensagens de chat e projetos permanecem isoladas. Tarefas de análise não são commits nem sites publicados.

## Banco de dados e proteção de contexto
- A tabela adicional mission_project_links vincula missão e projeto sem alterar a tabela de missões antiga.
- O servidor só aceita IDs de projeto ativos na criação de missões.
- O chat herda seu projeto quando delega um trabalho, salvo se o usuário pedir explicitamente outro projeto.
- O Workflow usa somente o histórico de conversas do projeto escolhido; ignora a lixeira.
- Ideias por projeto também usam apenas o histórico daquele projeto.
- Mensagens legadas não são apagadas nem atribuídas arbitrariamente.

## Diagnóstico D1
Configurações > Executar diagnóstico autenticado. Com a sessão HttpOnly, o painel cria e lê uma conversa temporária, testa renomeação, arquivo, restauração, lixeira e exclusão. Testa mover entre projetos se houver pelo menos dois ativos. Se ocorrer falha, tenta limpar os dados da conversa temporária, informando seu ID quando não conseguir. Não registra segredos no GitHub nem os solicita pelo chat.

## Validação e deploy
1. Executar npm test (Node 22+).
2. Testar navegação 360px / 768px / desktop, com autenticação real no Worker.
3. Confirmar /api/health versão 0.15.0 e bindings AI/D1/Workflows prontos; GET anônimo /api/threads deve retornar 401.
4. Executar diagnóstico autenticado da conversa temporária.
5. Verificar fontes reais dos estados de agente e de publicações, inclusive com banco vazio.
6. Publicar pela Cloudflare apenas após revisão; abrir PR não publica automaticamente.

**Bloqueios conhecidos em 01/11/2026:** GitHub Actions não iniciou por bloqueio de faturamento (run 41319078714). Sem sessão Cloudflare autorizada nesta conversa, deploy e smoke D1 autenticado em produção continuam sem verificação.

## Rollback
Reverter os arquivos da nova UI, a versão do Worker e o cache de PWA para a versão anterior. A tabela adicional mission_project_links pode permanecer, pois não apaga registros antigos.

## Aceite
- [x] Nova camada visual e operações existentes conectadas.
- [x] Métricas da camada visual obtidas do estado de backend, sem números fictícios.
- [x] Vínculo de projeto e restrição de contexto de missões.
- [x] Diagnóstico D1 autenticado disponível no código da UI.
- [x] Testes automáticos de contrato incluídos.
- [ ] Execução dos testes completos no GitHub Actions (faturamento bloqueado).
- [ ] Diagnóstico autenticado no D1 real.
- [ ] Deploy e testes visuais no Worker publicado.
