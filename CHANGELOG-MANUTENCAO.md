# Mudanças propostas — roadmap de manutenção

## v68 — Diagnóstico em um toque nos Ajustes (branch de homologação)

- O único botão **Executar diagnóstico completo** foi movido de Atualizações (seção normalmente fechada) para uma faixa compacta e visível no topo de Ajustes. A seção de versões agora se chama **Atualizações do aplicativo**.
- Resolvida a proposta `PROPOSTA_AJUSTES_DIAGNOSTICO_DIRETO` indicada no JSON v67; teste de regressão garante que voltar a esconder o botão em um painel fechado será detectado. E2E offline abrirá o diagnóstico sem expandir Atualizações.
- Versão e cache PWA passam a v68; CSS responsivo com alvo de 44 px; **375/375 testes Node e Chromium desktop/móvel/offline aprovados no CI** (runs 45175055623 e 45175055621). Navegador local permaneceu bloqueado pelo ambiente, mas o CI executou os fluxos reais.
- Sem alterações em dados financeiros, preferências, IndexedDB, backup, categorias, CSV/OFX ou regras de cálculo. **v67 permanece em `main`**; P4.2/P0.5/P2.6 ainda exigem ensaio físico.

## 23/11/2026 — Auditoria v67 e publicação em main (P4.1)

- Diagnóstico do HTML independente enviado pelo Samsung: **228 verificações, zero erros, um aviso preventivo de limpeza do armazenamento, nove verificações não avaliadas e uma proposta de atalho de Diagnóstico ainda pendente**. Fonte primária IndexedDB sincronizada; backup externo desligado no aparelho.
- **374/374 testes Node locais e CI verde**, além de QA Chromium móvel, desktop e offline nos runs 45141406828 e 45141406838. Nenhuma alteração de lógica financeira se mostrou necessária.
- Publicação autorizada e realizada pelo PR #1 em `main` (`ad231274d15493205f0e2b57557569f2a2b504db`). **A homologação física do PWA/backup (P0.5/P2.6/P4.2) ainda está pendente.**

## v67 — Minhas categorias sem voltar ao topo ao ocultar/exibir

- Ao clicar em **Tirar/Mostrar**, atualiza somente a categoria clicada após salvar com sucesso, preservando o botão, o foco e a posição na lista. Não desmonta e recria todas as categorias.
- Criar, renomear e alternar a lista entre entradas/despesas continuam atualizando a estrutura quando necessário. Falhas ao salvar mantêm o estado visual anterior.
- **374/374 testes Node e QA Chromium desktop/móvel/offline aprovados no CI** (runs 45141050370 e 45141050207), incluindo ocultar/mostrar categorias na parte de baixo da tela sem saltar para o topo. Versão/cache v67, sem alteração nos contratos de dados nem publicação na `main`.

## v66 — Teclado numérico somente do celular

- Removidos visor de valor, teclado de centavos em grade, texto de instruções e botão para alternar teclados do formulário de renda/despesa. Campo `Valor (R$)` fica visível e editável com teclado numérico nativo.
- Categorias por ícones preservadas em módulo pequeno `categorias-rapidas.js`; removido `teclado-monetario.js` para não manter código sem uso. O menu `+`, os dados e o visual do restante do aplicativo continuam iguais.
- Diagnóstico passou a alertar se o valor for bloqueado ou se alguma tecla personalizada reaparecer. Testes Node/Chromium verificam preenchimento nativo, categorias e ausência de duplicação.
- Cache/versão sincronizados em v66. **372/372 testes Node e QA Chromium móvel/desktop/offline aprovados no CI** (runs 45139318897 e 45139318864). Branch de homologação, sem alteração na `main` ou nos contratos de dados; teste físico no Android continua pendente.

## v65 — Botão + único, navegação sem colisão e teclado monetário opcional

- Removida a barra fixa móvel com `− Gastei` e `+ Recebi`; o botão `+` abre renda, despesa, metas, sonhos e investimentos. Atalhos do Resumo no PC continuam, sem mudança no visual geral aprovado.
- Navegação inferior em seis colunas, ícones acima dos textos e rótulos responsivos; validação visual automatizada de 320 a 768 px e teste da ausência da barra duplicada.
- Teclado interno de centavos vira padrão no smartphone sem abrir simultaneamente o teclado do sistema. O usuário pode alternar explicitamente para o teclado nativo; foco inicial não aciona Gboard inesperadamente.
- Diagnóstico acrescenta checagens preventivas de colisão visual, acesso rápido único e alternância de teclado. JSON v64 recebido: 225 verificações, zero erros, um aviso real de armazenamento e sete não avaliadas por abrir arquivo local.
- Versão do aplicativo e cache PWA passam a v65, mantendo todos os dados e sem alterações na `main`. **372/372 testes Node e QA Chromium desktop/móvel + offline aprovados no CI** (runs 45137750414 e 45137750327). A validação física no Samsung/PWA permanece pendente.

## v64 — Correção dos falsos alarmes apontados pelo diagnóstico de 23/11

- `MOD_ORCAMENTO`: corrigida a expectativa da autoverificação sintética, de R$ 10,00 para R$ 9,65. A lógica financeira existente estava correta. O teste passa a verificar também o saldo de R$ 280,00 e rejeitar calculadoras adulteradas.
- `AJUSTES_RELATORIOS_DESCOBERTA`: removido teste de posição obsoleta. Agora verifica PDF, CSV, importação e backup em Relatórios e ausência de controles duplicados em Ajustes, com regressões negativa/positiva.
- Chromium afirma que os dois novos checks estão verdes no HTML local desconectado. Versão e cache PWA sincronizados em v64; **371/371 testes Node e Chromium aprovados no CI** (runs 45094976803 e 45094976827).
- Aviso preventivo de possível limpeza de dados pelo navegador preservado. Sem alterações financeiras, exclusões ou migração de dados.

## v63 — Diagnóstico offline completo e HTML portátil

- No PWA, o diagnóstico lê do cache a assinatura real de HTML, JavaScript, CSS, manifesto e PNG, informa arquivos ausentes/inválidos e versões divergentes, sem fazer requisições de rede nem expor valores pessoais.
- Na prévia HTML independente, confirma CSS/JavaScript embutidos, bibliotecas carregadas e ausência de recursos externos obrigatórios; identifica Service Worker e Cache Storage como não aplicáveis à abertura `file://`.
- Testes sintéticos cobrem ausência/corrupção de arquivos offline e geração do HTML; 370/370 testes Node aprovados no CI v63 (run 45093963590).
- E2E Chromium aprovado no CI v63 (run 45093963618): rede realmente desligada, recarga por Service Worker, conferência IndexedDB e HTML local `file://` sem rede.
- Pacote v63 e gerador com botão direto para executar diagnóstico; sem migração destrutiva e sem alteração da `main`.

## v62 — P2: contas, parcelas, categorias e alertas preventivos

- Cadastro de contas fixas e cartão parcelado com baixa confirmada, sem lançamento automático ou duplicidade na projeção.
- Categorias personalizadas com ícone, renomeação e ocultação, preservando o histórico e backups antigos.
- Avisos locais para pagamentos, limites, backup e bloqueios; diagnóstico distingue falhas detectadas de riscos futuros sem expor nomes/valores.
- v62 está na branch de revisão: 366 testes Node e Chromium em CI aprovados (runs 45092725146 e 45092725158); ainda falta inspeção física do PWA.

## P0.1 — Branch de homologação

- Criada camada isolada de replicação financeira para IndexedDB, com transações ordenadas.
- Inclusão de autoverificação no catálogo e estado de sincronização no diagnóstico JSON.
- Exclusão de dados aguarda a remoção do espelho; falhas impedem confirmação enganosa.
- Adicionados testes automatizados do espelho, concorrência de operações, falha de exclusão e privacidade.
- Nova orientação de manutenção AGENTS.md e documentação de migração DATABASE.md.
- Cache/versão PWA sincronizados para v40 apenas na branch; main continua estável até aprovação.

## Pendente

- IndexedDB como armazenamento primário (P0.2–P0.5).
- Backups restauráveis testados ponta a ponta com o novo repositório.
- Desacoplamento adicional das regras financeiras de dist/app.js.
- Execução end-to-end em browsers reais e homologação no smartphone.
- Próximas prioridades P1–P4 do roadmap.

## P0.2 — Proteção contra conflito na abertura

- A inicialização preserva uma cópia IndexedDB divergente.
- Divergências produzem código de diagnóstico; testes comprovam a preservação.
- Versão v41 de homologação, main inalterada.

## P1.1 — Cálculos modularizados

- Movimentações mensais, recorrências e reserva principal centralizadas num motor puro.
- Soma de receitas/despesas em centavos inteiros, com teste de 10 mil lançamentos.
- Testes de regressão do motor e atualização do catálogo diagnóstico.
- Prévia de homologação passa para v42 na branch, sem alterar main.

## P2.1 — Teste real de navegador no CI

- Novo workflow independente executa Chromium headless e simula fluxo desktop/mobile com dados fictícios.
- Dependência Playwright fixada para reprodutibilidade, sem alterar a distribuição estática.

## P2.2 — Correção encontrada pelo teste em navegador

- Removida capitalização automática do mês no calendário; preserva o padrão em português, como dezembro de 2026.
- Teste de interface real detectou divergência entre texto renderizado e esperado.
- Versão de homologação v43 sincronizada com o cache PWA.

## P2.3 — Alternância entre objetivos corrigida

- Botões acessíveis para alternar entre Metas/Reserva e Sonhos, que antes não eram exibidos apesar do suporte no controlador.
- Teste real de desktop e smartphone agora utiliza a rota Objetivos e seleciona Sonhos explicitamente.
- Versão de homologação v44, sem publicação na main.

## P3.1 — Log técnico automático da sessão

- Eventos técnicos detalhados são habilitados desde o início de cada abertura do aplicativo.
- Evento `SESSAO_INICIADA` retido apenas na sessão, em estrutura restrita (horário, nível, código, módulo); máximo de 50 entradas, sem valores pessoais.
- Navegador e teste estático verificam a ativação e o formato; versão de homologação v45.

## P2.4 — Verificação do calendário fechado no celular

- O teste do navegador agora confere o estado real do diálogo; o calendário mantém os dias no DOM após fechar, mas não é exibido ao usuário.

## P2.5 — Sincronização do teste de fechamento móvel

- O teste aguarda o evento nativo `close` do diálogo após Esc antes de validar `aria-expanded`, evitando uma corrida entre o browser e o teste.

## P2.6 — Teste alinhado à estrutura atual de Ajustes

- O teste de smartphone confere a seção de exportação/importação, os cinco comandos e o painel de atualizações/diagnóstico pelos rótulos reais.

## P0.3a — Migração transacional incremental (v46)

- Leitura, comparação e escrita passam a ocorrer em uma mesma transação IndexedDB, com confirmação somente em `oncomplete`.
- Marcador de esquema do snapshot e trava de versão conhecida impedem sobrescrita por abas ou clientes defasados.
- Eliminada a corrida entre inicialização e gravação enfileirada; falhas iniciais não são confundidas com conflito confirmado.
- Cinco cenários novos de teste cobrem duas abas, conflito tardio, versão futura e falha de leitura; Chromium verifica a integridade do espelho no começo e após operações.

## P0.3b — Proteção da exclusão entre abas (v47)

- Tombstone persistente e transacional no IndexedDB após a dupla confirmação, sem conteúdo financeiro.
- Inicialização segura mesmo quando localStorage está vazio; cadastro novo permitido após exclusão confirmada.
- Bloqueio de gravações e exclusões obsoletas de abas antigas; revisão da origem antes de excluir.
- Diagnóstico inclui apenas sinalização técnica da proteção; testes abrangem falha e retomada da exclusão.
- Fluxo de exclusão e criação posterior coberto também no teste real de Chromium.


## P0.3c1 — Leitura e backups independentes de conflitos (v48)

- Nova seção de recuperação em Ajustes, acessível por inspeção manual, com estados/contagens sanitizados de localStorage e IndexedDB.
- Exportação separada das duas origens em JSON v1 validado, sem modificar nenhuma delas. Conflitos, tombstone, dados inválidos e alterações concorrentes impedem operações inseguras.
- Leitura IndexedDB transacional somente leitura, após a fila já existente, isolada dos diagnósticos automáticos.
- Testes unitários de privacidade, exportação, concorrência e ausência de escrita; Chromium testa divergência com dois downloads e preservação das origens.
- Cache e versão de homologação sincronizados na **v48**. A escolha transacional (P0.3c2) continua pendente; `main` não alterada.
- Falhas de transação de leitura agora são tratadas explicitamente e nunca deixam inspeções pendentes.

## P0.3c2 — Escolha explícita e recuperação transacional (v49)

- A tela de Ajustes passou a oferecer seleção da origem após os dois arquivos JSON e duas confirmações.
- Recuperação de conflitos só altera o IndexedDB após comparar o snapshot na transação e depois sincroniza localStorage; falhas impedem anunciar conclusão.
- Proteção contra abas concorrentes, tombstone e dados inválidos; testes de cancelamento, substituição e falha de escrita, inclusive no Chromium.

## P0.4 e P0.5 — Repositório primário e importação OFX (v50, em homologação)

- Repositório financeiro assíncrono passa a exigir o commit IndexedDB antes de aceitar lançamentos, investimentos, metas, CSV ou backup JSON. localStorage torna-se compatibilidade secundária.
- Novo parser OFX local acoplado à conferência prévia do CSV, com FITID para detecção de duplicatas e classificação manual das aplicações.
- Recuperação de JSON passa a exigir dupla confirmação; conflitos de origem permanecem bloqueados sem escolha explícita.
- Snapshot primário marcado de modo persistente; reabertura sem chave local é permitida somente com marcador válido. Tombstone e versões futuras continuam protegidas.
- Corrigida corrida entre dois diálogos de confirmação sucessivos encontrada no Chromium durante P0.3c2.
- Diagnóstico indica fonte primária e estado do espelho legado sem registrar conteúdo financeiro; testes de 1.000 e 10.000 registros e de falhas de persistência.
- **Homologação manual em PWA instalado e backup real ainda necessária antes de declarar P0 finalizada ou publicar na main.**

## P0.5 — Correção de inicialização e QA assíncrono (v51)

- Backup automático em pasta aguarda o carregamento do snapshot primário e fica suspenso durante divergências, evitando escrever estado vazio provisório.
- Após recuperar ou excluir dados, o backup em pasta pode ser reinicializado com o estado correto.
- QA do Chromium aguarda o fechamento dos formulários depois do commit assíncrono antes de comparar valores, eliminando leituras prematuras.

## P0.5 — Conflito durante commit assíncrono (v52)

- Se uma aba legada alterar localStorage enquanto o IndexedDB conclui uma gravação, a nova versão **não sobrescreve** essa origem. Ambos os estados são preservados para recuperação assistida; novas escritas são bloqueadas.
- Teste unitário específico reproduz a alteração concorrente no intervalo entre commit indexado e atualização da cópia de compatibilidade.

## P1.2 — Regras de lembretes e CDI isoladas (v53)

- `motor-financeiro.js` concentra agora a busca por aportes pendentes, com janela de seis meses, recorrências, conclusões e data de referência injetada.
- A estimativa bruta de CDI em dias úteis foi isolada da geração de HTML, sem criar rendimento, aporte ou alteração de saldo.
- `app.js` passou a adaptar as funções do motor à interface e reutilizar a regra de percentual de `regras-financeiras.js`; autoverificação e testes de 10 mil rendas sintéticas ampliados.
- Cache PWA e versão visível avançam juntos para **v53**. P0.5 permanece aguardando instalação/offline e backup real em dispositivo antes da conclusão; `main` permanece intacta.

## P1.3–P1.5 — Modularização financeira completa (v55)

- Criados `dominio-objetivos.js` e `dominio-investimentos.js`: fórmulas de metas, totalizações sem dupla contagem, candidatos a vínculo, origem salarial e edição imutável saíram dos controladores de tela.
- Saldo histórico disponível foi centralizado em `motor-financeiro.js` e reutilizado pelo Resumo. Os exports históricos do Resumo e dos Investimentos permanecem compatíveis.
- Catálogo, autoverificações, cache PWA e gerador de HTML receberam os novos domínios, sem mudanças no banco, backups ou direitos de publicação.
- Testes de contratos puros e de 10 mil aplicações sintéticas adicionados; após falha sintática detectada no CI da v54, a importação duplicada foi removida e adicionada checagem de sintaxe de **todos os módulos**. **333 testes Node locais aprovados**; o CI de Chromium é a verificação seguinte na branch.
- **P1 concluída tecnicamente.** P0.5 segue pendente apenas da homologação real no PWA e de um backup real; a `main` não foi modificada.

## P2.1 — Lançamento rápido celular/PC e histórico diário (v56)

- Adicionados dois atalhos de cadastro de renda/despesa no celular e ações diretas no Resumo do PC, preservando o botão + e todas as opções originais.
- Novo teclado monetário móvel, com valores em centavos, visor em reais, operação de apagar e limite de valor. Categorias rápidas reutilizam o catálogo oficial; formulário nativo continua disponível.
- Listas de Renda/Despesas agora incluem agrupamento por dia, sem alterar saldos ou recorrências.
- Incluídos testes de teclado, acessibilidade estrutural, catálogo único e agrupamento; **337 testes Node locais e CI Node/Chromium aprovados**.
- As demais ideias das referências foram organizadas em P2.2–P2.7. `main` permanece intacta; P0.5 continua pendente de validação física.

## P2.2 — Limite mensal e orçamento por dia (v57)

- Em Ajustes, configurações opcionais de teto mensal e valor desejado de economia, sem preenchimento fictício ou automático. Ambos persistem na chave de preferências já existente e são validados antes de salvar.
- No Resumo do mês atual, cartão “Hoje você pode gastar” calcula cota do dia sobre o saldo do orçamento após os gastos anteriores, desconta os gastos de hoje, mostra progresso e avisa ao atingir 80% do teto. Recorrências são consideradas somente após o vencimento.
- O cálculo isolado `orcamento.js` opera em centavos, é somente leitura e não confunde projeção com saldo bancário. A meta de economia não produz lançamentos nem aportes.
- Testes de orçamento, datas, limite ultrapassado, preferências e validação de formulário adicionados; **342 testes Node locais aprovados**, com CI Node/Chromium a validar na branch. `main` e a homologação física de P0.5 permanecem intocados.

## P2.3a — Agenda prevista e projeção de 12 meses (v58)

- Em Relatórios, nova agenda de despesas esperadas nos próximos 30 dias e projeção de 12 meses com receitas, despesas e diferença, considerando apenas ocorrências válidas de lançamentos únicos ou recorrentes já existentes.
- A tela distingue explicitamente *projeção* de cobrança paga, vencimento confirmado ou saldo bancário. Não oferece baixa fictícia, não duplica transações e não introduz esquemas de dados sem proteção transacional.
- Módulo puro `previsoes.js`, tabela responsiva com rolagem horizontal, conteúdo acessível e texto escapado; catálogo, diagnóstico, cache offline e HTML independente atualizados.
- Adicionados quatro testes de projeção, recorrência, dias 31 e integridade; **346 testes Node locais aprovados**. Corrigido no E2E um padrão de comparação do espaço não quebrável da moeda retornada pelo navegador.
- **P2.3 continua parcialmente pendente:** cadastro real de contas e status de pagamento, recorrências com número limitado de vezes e cartão de crédito ainda requerem modelo de dados e validação de backup. Nenhum dado real foi utilizado.

## P2.5a — Resumo anual e compartilhamento explícito (v59)

- O painel de Relatórios passa a mostrar os meses do ano escolhido com barras de receitas e despesas, quatro totais (entradas, saídas, aportes registrados separadamente e diferença) e identificação do mês com maior saldo de lançamentos.
- O cálculo considera apenas ocorrências vencidas até a data atual; projeções não são tratadas como fatos. Aportes não são descontados de novo das despesas.
- Botão de compartilhamento exige ação explícita; usa API nativa quando disponível ou copia texto para envio manual, sem transmissão automática nem dados financeiros nos logs.
- `relatorio-anual.js` é testado isoladamente, registrado em diagnóstico/cache/HTML; **350 testes Node locais aprovados**, com Chromium a revalidar. O desafio das 52 semanas permanece na P2.5b, sem simular depósitos reais.

## P2.5b — Desafio das 52 semanas sem armazenamento paralelo (v60)

- Em Objetivos, cartão do desafio cria uma meta convencional de R$ 2.756 sob confirmação do usuário. A grade de 52 semanas calcula R$ 2, R$ 4, ..., R$ 104 e indica semanas com aportes correspondentes já salvos.
- Ao tocar numa semana, o formulário de investimento abre preenchido, mas **a origem do dinheiro permanece sem seleção**, exigindo escolha e confirmação. O registro utiliza o mesmo IndexedDB transacional, backup JSON, validações e histórico editável dos outros investimentos.
- A grade detecta semanas duplicadas e mostra aviso; não soma duas vezes à contagem de semanas concluídas. Exclusões/correções seguem o histórico de investimentos existente, preservando integridade e proteção contra dupla contagem.
- Novo módulo `desafio-52.js` registrado em autodiagnóstico, PWA e HTML único; E2E móvel testa criação e um aporte com dados fictícios. **354 testes Node e CI Chromium desktop/mobile aprovados** na v60 (runs 45090707674 e 45090707644).

## P2.6a e P2.7a — Hierarquia móvel e regressão responsiva (v61)

- Em smartphone, o card “Hoje você pode gastar” tem prioridade visual sobre os gráficos completos; a tela desktop preserva a disposição anterior. Foco de teclado da navegação inferior foi explicitado.
- QA E2E passa a conferir overflow da página em larguras de 320, 390 e 768 pixels, além do fluxo de meta/desafio. A navegação de seis módulos continua acessível.
- Dois testes estruturais complementares; **356 testes Node e CI Chromium v61 aprovados** (runs 45091040107 e 45091040083). P2.6/P2.7 continuam parciais até inspeção final em dispositivos reais e encerramento de P2.3/P2.4.
