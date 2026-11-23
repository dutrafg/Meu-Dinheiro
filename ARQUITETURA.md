# Arquitetura — Meu Dinheiro

## Objetivo

Manter HTML, estilos, módulos de tela, importação/exportação e backup separados para corrigir cada área sem alterar componentes não relacionados. Continua sendo um aplicativo **estático e instalável**, publicado a partir de `dist/` na Vercel e no GitHub Pages, sem bundler.

## Estrutura

```text
dist/
  index.html               # Áreas fixas (inclui Ajustes) e formulários modais
  styles.css               # Estilos base compartilhados (sem regras antigas inativas)
  prototype.css            # Entrada dos arquivos CSS temáticos
  css/
    estrutura.css           # Cores, cabeçalho, navegação e layout geral
    calendario.css          # Calendário financeiro responsivo e cinco níveis de fluxo
    resumo.css             # Painéis, gráficos e cartões
    saude.css              # Indicadores de saúde financeira, desktop e celular
    objetivos.css          # Metas, sonho e componentes de progresso
    progresso.css          # Barras reutilizáveis, animação e movimento reduzido
    dialogos.css           # Formulários, CSV, reserva e lembretes
    responsivo.css         # Smartphone, tablet e tema do sistema
    ajustes.css            # Tema, cores e página fixa de Ajustes
    impressao.css          # Saída A4 sem controles, incluindo tema claro
  app.js                   # Orquestração, persistência e eventos legados
  modules/
    resumo.js              # Tela Resumo e gráficos por categoria; consulta o motor financeiro
    calendario-financeiro.js # Cálculo diário, intensidade, renderização e detalhes
    saude.js               # Poupança, fôlego e temperatura: regras puras e card
    notificacoes.js        # Dispensar/restaurar lembretes sem concluir aportes
    relatorio-pdf.js       # Controle da impressão local e limpeza temporária
    relatorio-pdf-conteudo.js # Modelo puro com valores, categorias e objetivos
    lancamentos.js         # Renda/Despesas, linhas e formulário
    teclado-monetario.js   # P2.1: teclado de centavos e categorias rápidas móveis sem mudar o campo nativo
    objetivos.js           # Interface de metas e sonhos, sem fórmulas duplicadas
    dominio-objetivos.js   # P1.3: progresso, restante, totalização e vínculo de objetivos
    investimentos.js       # Interface de cadastro e edição; preserva exports históricos
    dominio-investimentos.js # P1.4: regras puras de aportes e vínculos salariais
    concorrencia-dados.js   # Conflitos entre abas e proteção opcional do armazenamento
    ciclo-periodo.js        # Dia/mês atual após retomar o PWA ou virar a data
    backup.js              # Backup completo JSON e cópias na pasta
    espelho-indexeddb.js   # Espelho transacional e leitura de recuperação somente leitura
    recuperacao-conflitos.js # Inspeção manual e duas exportações sem substituir origens
    repositorio-financeiro.js # Fonte financeira primária assíncrona IndexedDB
    ofx.js                  # Conversão local de extrato OFX para importação revisada
    csv-interface.js       # Visualização, classificação e importação CSV
    validacao.js           # Datas, integridade e restauração segura
    atualizador.js         # Detecção de versões e confirmação do usuário
    log.js                 # Eventos técnicos sanitizados e limite de 50 registros
    integridade.js         # Regras puras de verificação dos dados
    diagnostico.js         # Painel e relatório JSON sem valores pessoais
    diagnostico-proposta.js # Checklist da proposta de UI e contraste
    auditoria-codigo.js    # Inspeção não destrutiva de CSS e funções sem uso
    dialogos.js            # Confirmações visuais acessíveis
    preferencias.js        # Validação e armazenamento isolado de preferências
    regras-financeiras.js  # Percentuais e plano de aporte configuráveis
    ajustes.js             # Controlador da interface de configurações
    catalogo-diagnostico.js # Inventário e execução de autoverificações
    registro-modulos.js    # Registro de cada módulo do aplicativo
  analytics.js             # Cálculo dos gráficos (independente do DOM)
  csv.js                   # Parser e exportador CSV
  folder-backup.js         # Gerenciador de arquivos/pasta
  sw.js                    # Cache offline e ativação confirmada de atualização
```

## Fluxo de dados

1. `index.html` importa `app.js` como módulo JavaScript nativo (`type="module"`).
2. `app.js` carrega os utilitários existentes e inicia os módulos com dependências explícitas (funções e getters).
3. Cada tela devolve HTML, mas **não grava dados por conta própria**.
4. Os controladores alteram os registros por `await persist(next)`: o repositório aguarda a confirmação do IndexedDB primário, espelha no `localStorage` compatível e só então atualiza a UI e agenda o backup em pasta.
5. `render()` atualiza somente `#view-content`, preservando os formulários fixos em `#settings-page` para que controladores de backup, CSV e atualização não percam referências/eventos. Ajustes é a sexta view e fica oculta quando outra área está ativa.
6. `preferencias.js` usa a chave separada `meu-dinheiro-essencial:preferencias:v1`; ajustes de aparência e aporte não regravam lançamentos. Backups novos incluem preferências, com compatibilidade para JSON v1 antigo.
7. `notificacoes.js` utiliza `meu-dinheiro-essencial:avisos-ocultos:v1`, isolada dos dados de aportes realizados. Dispensar um aviso não altera `completedAportes`; restaurar reexibe apenas o que ainda não foi concluído.
8. `concorrencia-dados.js` compara a versão local do JSON antes de cada gravação. Alterações de outra aba são sincronizadas se não houver edição em diálogo; caso contrário, a gravação antiga é bloqueada até o usuário resolver o conflito. Não cria chaves novas nem muda o formato financeiro.
9. `ciclo-periodo.js` atualiza o mês corrente e a data atual após retorno à aba, `pageshow` ou passagem do tempo, mantendo a navegação histórica intocada.

## Regras de manutenção

- **Não altere** a chave `meu-dinheiro-essencial:v1` nem o formato JSON v1 sem criar uma migração compatível.
- **Regra permanente:** cada funcionalidade, verificador, serviço e controle de interface deve ocupar seu próprio módulo em `dist/modules/`, com dependências explícitas e testes próprios. `app.js` permanece como orquestrador, sem concentrar lógica nova.
- Logs aceitam apenas códigos técnicos predefinidos e indicação de módulo. Nunca registre valores, nomes, descrições, objetos completos de erro, stacks, conteúdo CSV/JSON ou caminhos de pasta.
- Diagnósticos são operações somente leitura sobre os dados financeiros. O log usa somente a sessão, limitado a 50 códigos técnicos. Preferências são armazenadas separadamente dos registros financeiros.
- A prévia de tema/cor nunca grava dados antes de Salvar e é revertida ao tocar Descartar ou mudar de aba. O Diagnóstico valida atributos e estilos CSS calculados, não apenas preferências JSON. O padrão azul vale somente para novos usuários; valores persistidos continuam válidos.
- **Checklist da proposta:** `diagnostico-proposta.js` cobre os 22 requisitos de navegação, barra de progresso, ícones, tema e interface. Estados `pendente` e `nao_avaliado` têm contagens próprias no JSON e não elevam `integridade.erros` nem `integridade.avisos`; apenas `ok`, `aviso` e `erro` representam integridade técnica. Os resultados são agrupados por módulo em `<details>`, sem expor dados financeiros.
- **Registro obrigatório do Diagnóstico:** ao criar/renomear módulo em `dist/modules/`, adicione seu nome em `MODULOS_OBRIGATORIOS` (`catalogo-diagnostico.js`) e uma autoverificação executável em `registro-modulos.js`. Inclua verificações específicas do comportamento e possíveis falhas. `tests/arquitetura.test.cjs` falha quando falta registro.
- **Auditoria contínua:** `auditoria-codigo.js` lê somente os arquivos públicos locais (`index.html`, bibliotecas, todos os módulos registrados e CSS importado por `prototype.css`). Sinaliza classes CSS e funções privadas sem referência estática como **avisos**, inclusive após novas versões publicadas; reconhece classes produzidas dinamicamente. Não remove nada automaticamente, porque usos indiretos podem não aparecer nessa análise. O teste `tests/auditoria-codigo.test.cjs` valida a cobertura e exige revisão de código obsoleto antes de publicar. Na prévia HTML independente, a consulta de arquivos modulares é indisponível e o diagnóstico mostra o motivo.
- A barra do Diagnóstico segue **5 s para até 9 verificações +0,5 s por verificação adicional, com teto de 25 s somente para a animação**. O catálogo não tem limite de verificações e a execução real nunca é interrompida pelo relógio visual. Todos os resultados são coletados antes da animação; se os testes demorarem mais, a interface continua aguardando. O JSON só fica disponível ao final.
- Mantenha `completedAportes`, `allocations`, `transactions` e `goals` ao importar/exportar.
- Para modificar somente a interface, altere o arquivo da área em `dist/modules/` e/ou `dist/css/` correspondente.
- Ao criar, renomear ou remover qualquer script/CSS/ícone, atualize `ASSETS` em `dist/sw.js` e incremente a versão de `CACHE`.
- **Versão visível e sincronizada:** `VERSAO_EM_EXECUCAO` em `dist/modules/atualizador.js` representa o código atualmente aberto e deve ser atualizado junto com `CACHE` em `dist/sw.js` a cada publicação. O teste `tests/atualizador.test.cjs` impede a publicação caso os números não coincidam. O Diagnóstico confere se a versão aparece corretamente em Ajustes.
- **Recuperação segura (P0.3c1):** `recuperacao-conflitos.js` só lê as duas origens quando o usuário solicita inspeção, exibe contagens sem registros financeiros e gera arquivos JSON independentes após revalidar que ambas não mudaram. Essa fase de inspeção não escreve e não contorna tombstones; a seleção só é liberada depois dos dois backups.
- **P0.3c2/P0.4/P0.5:** recuperação agora exige as duas exportações, escolha e dupla confirmação. `repositorio-financeiro.js` confirma o commit indexado antes da gravação do espelho local. Operações CSV, OFX, backup, investimentos e formulários devem aguardar a Promise de `persist`. Um snapshot sem marcação primária nunca é restaurado automaticamente se a chave local sumir.
- **Exclusão local protegida:** `modules/limpeza-dados.js` orquestra confirmação visual, frase `APAGAR` e exclusão somente da chave financeira; `folder-backup.js` pausa antes de apagar, aguarda gravações ativas e protege backups externos. `tests/limpeza-dados.test.cjs` e `tests/folder-backup.test.cjs` cobrem cancelamento, erros e recuperação.
- **Relatório PDF explícito:** `modules/relatorio-pdf.js` consulta `#pdf-report-type` em Ajustes e não depende de uma aba visitada anteriormente; o modelo puro `modules/relatorio-pdf-conteudo.js` inclui movimentações do mês e, no resumo completo, aplicações e objetivos. O Diagnóstico confirma a presença e a validade do seletor; testes verificam os dados de exemplo.
- **Largura responsiva:** `css/estrutura.css` libera a largura de desktop, `css/responsivo.css` organiza tablet/smartphone e `css/ajustes.css` mantém a página de configurações fluida. O CSS de impressão não herda as dimensões da interface.
- **Navegação desktop fixa e paridade móvel:** `#desktop-toolbar` usa `position:sticky` no topo e se estende por toda a largura útil da janela; possui menu de criação acessível com cinco opções. `modules/acao-rapida.js` coordena esse menu e o diálogo nativo `#mobile-create-dialog` acionado pelo `+`, com os mesmos cinco tipos (renda, despesa, meta, sonho e investimento). `css/acao-rapida-mobile.css` isola o painel inferior, com tema adaptativo e áreas de toque grandes; adicione-o também a `prototype.css`, `sw.js` e `scripts/gerar-html-teste.cjs` sempre que modificar. O Diagnóstico valida a paridade, rótulos, ARIA, navegação de seis abas e área de toque. `tests/acao-rapida.test.cjs` cobre cliques, foco contextual, fechamento sem salvar e bloqueio em Ajustes; `tests/diagnostico.test.cjs` verifica que divergências são detectadas.
- **Investimentos manuais:** `modules/investimentos.js` valida data, descrição, valor, categoria livre e origem (`salary` ou `previous`), vincula o aporte ao objetivo e atualiza `goal.saved` uma vez. A origem `salary` exige transação de salário até 45 dias antes da data, incluindo recorrências; armazena o identificador e a data de referência. `modules/resumo.js` retira apenas esses aportes vinculados do dinheiro disponível hoje, nunca dos indicadores de despesas. O histórico é preservado em `allocations` e JSON de backup, inclusive quando a meta é removida. Os cards de Reserva/Sonhos são independentes, e o Diagnóstico inspeciona o vínculo, a categoria e o saldo com dados sintéticos.
- **Edição sem duplicação:** `editarInvestimentoVinculado` retira em centavos o valor anterior do objetivo, revalida os novos campos e a origem salarial e incorpora o aporte revisto. Preserva o ID e a posição no histórico, rejeita edição que tornaria o valor guardado negativo e não cria transação nova. A operação só é persistida depois de concluída com sucesso.
- **Validação de salário:** a origem nunca é escolhida automaticamente; `validarVinculosSalariais` impede que o total de investimentos da mesma ocorrência ultrapasse a renda ou fique ligado a salário excluído, reduzido ou com data/categoria inválida. A remoção de salário com aporte exige corrigir os vínculos antes.
- **Contraste AA:** `diagnostico.js` mede no tema ativo a razão entre texto semântico/segundo plano, incluindo os cartões verdes e vermelhos. O limiar é 4,5:1. Cores de gráficos continuam independentes das cores de texto.
- **Backups antigos:** `validacao.js` migra campos opcionais ausentes e preserva categorias históricas seguras. Em `folder-backup.js`, a comparação de arquivos sem `preferences` utiliza a preferência implícita histórica (verde); o padrão de novos usuários continua azul. Assim, ausência da chave não provoca perda silenciosa de dados ou falso conflito para configurações históricas idênticas.
- **Calendário de fluxo diário:** `modules/calendario-financeiro.js` calcula dias, recorrências materializadas, totais em centavos e cinco níveis relativos à maior movimentação diária do mês. `css/calendario.css` apresenta verde para renda, vermelho para despesas e mistura proporcional para ambos, inclusive no tema escuro e no celular. O calendário não é injetado no Resumo: o botão do nome do mês, gerado por `renderBotaoCalendario`, abre `#finance-calendar-dialog` sob demanda; as setas internas usam `navegarMesCalendario` e atualizam o mês principal, sem duplicar registros. O módulo possui autoverificação no Diagnóstico e testes próprios de seleção, abertura, navegação, datas, valores e detalhes.
- A cada publicação que modificar o app, altere o identificador `CACHE` no Service Worker para que uma nova versão seja detectada. O SW instala em espera; apenas o clique em **Atualizar agora** envia `SKIP_WAITING`, que aciona `controllerchange` e recarrega a página. Não force a atualização durante a edição de dados.
- Não carregue módulos por URLs absolutas: os caminhos relativos funcionam tanto na raiz da Vercel quanto na raiz publicada no GitHub Pages.
- Não invoque `localStorage.clear()` ou apague registros como parte de atualização, teste ou recuperação.
- Faça os testes em uma branch separada e preserve a `main` até homologação.

## Testar

```bash
node --test tests/*.test.cjs
python -m http.server 4173 --directory dist
```

Abrir `http://localhost:4173` em um navegador moderno. Testar as seis áreas, formulários, gráficos, importação/exportação CSV, backup JSON e modo offline. O acesso direto à pasta requer Chrome/Edge em contexto seguro (`localhost` ou HTTPS).

O teste `tests/modulos.test.cjs` exercita os renderizadores separadamente e verifica os arquivos CSS; `tests/pwa.test.cjs` garante que todos os módulos estejam no cache offline.
O teste `tests/atualizador.test.cjs` simula atualização, ausência de conexão, instalação inicial e a exigência de confirmação antes do recarregamento. `tests/validacao.test.cjs` cobre dados antigos, backups e recuperação de falhas. `tests/standalone.test.cjs` verifica a prévia HTML independente.
`tests/diagnostico.test.cjs` valida integridade, privacidade e duração; `tests/registro-diagnostico.test.cjs` exige autoverificações; `tests/preferencias.test.cjs` cobre validação e isolamento; `tests/dialogos.test.cjs` comprova cancelamento seguro; `tests/recorrencia-formulario.test.cjs` verifica aviso sobre séries mensais. Toda mudança de interface deve ser conferida também em desktop e smartphone antes da publicação.
`tests/saude.test.cjs` verifica limites, ausência de dados e datas futuras; `tests/notificacoes.test.cjs` cobre limpar, cancelar, restaurar, dados adulterados e falhas de armazenamento; `tests/relatorio-pdf.test.cjs` garante impressão local. `tests/ajustes.test.cjs` simula prévia, cancelamento e gravação.
`tests/auditoria-codigo.test.cjs` verifica detecção de CSS/funções sem uso, preservação de classes dinâmicas, leitura dos módulos e catálogo e mantém a revisão estática ativa na integração contínua.
`tests/estabilidade-v31.test.cjs` exercita colisão entre abas, armazenamento persistente opcional, mudança de dia/mês, restauração legada, limite salarial, CSV e contraste de temas. `scripts/verificar-interface.cjs` também confere a escolha explícita da origem em ambiente de navegador, quando disponível.
`tests/diagnostico-proposta.test.cjs` valida os requisitos da proposta e sua integração sem falsear erros; `tests/navegacao.test.cjs` simula as seis abas, o descarte de prévias e os alertas de atualização/backup.

## P1.1 e P1.2 — Motor financeiro único

As regras puras para ocorrências de recorrências, listagem por mês, totais monetários e reserva principal passam a residir em dist/modules/motor-financeiro.js. O app.js oferece somente adaptadores finos para as telas; os testes do motor não dependem do DOM ou banco de dados.

Na P1.2, o cálculo dos lembretes de aportes pendentes e da estimativa de CDI bruto de 21 dias úteis também mora no motor. A data de referência é um argumento explícito; a função de percentual configurável é injetada a partir de `regras-financeiras.js`, preservando uma única origem para essa regra. O `app.js` apenas fornece estado e formata o texto. Simulações não alteram saldos, investimentos, conclusão de aportes nem armazenamento.

## P1.3–P1.5 — Domínios puros e contratos de compatibilidade (v55)

- `dominio-objetivos.js` contém o progresso, restante, soma de metas/sonhos sem contar aplicações vinculadas duas vezes, seleção de candidatos e cartões de destaque. `objetivos.js` controla apenas UI, formulários e formatação.
- `dominio-investimentos.js` contém localização de salários, validação dos vínculos, inserção e edição imutável de investimentos. `investimentos.js` controla os diálogos e reexporta as APIs antigas para preservar consumidores existentes.
- `motor-financeiro.js` também calcula o saldo disponível histórico até a data de referência. `resumo.js` faz a renderização e mantém o export antigo como encaminhamento.
- Nenhum domínio puro lê DOM, IndexedDB, localStorage, rede ou relógio implicitamente (datas são argumentos). A interface continua usando `persist()` para submeter alterações; nenhum cálculo grava dados.
- Dois novos módulos integram catálogo, registro de autoverificações, cache PWA e prévia HTML; testes validam dados imutáveis, sintaxe JS, valores em centavos e carga com 10 mil aplicações sintéticas.

## P2.1 — Entrada rápida e histórico responsivo (v56)

- A interface móvel tem dois atalhos de lançamento de renda/despesa acima da navegação, conservando o botão `+` com as cinco opções de cadastro. Eles são ocultados fora das telas financeiras correspondentes.
- O diálogo de lançamento mantém o `input type=number` original para teclado físico, leitor de tela e validação existente. O teclado visual opcional edita esse mesmo campo em centavos; os botões de categoria usam a lista já existente, sem criar catálogo paralelo.
- Os lançamentos em Renda/Despesas recebem cabeçalhos por dia, sem alterar a ordem ou os dados persistidos. No PC, o Resumo ganhou ações diretas de renda e despesa.
- As fotos são referência de fluxo e composição, não componentes copiados. Nenhum esquema de dados, regra de saldo ou comportamento de backup foi modificado.

## P2.1 — Homologação no navegador

Além dos testes Node, o workflow browser-qa.yml instala Playwright/Chromium e executa scripts/verificar-interface.cjs em um servidor efêmero com lançamentos fictícios. Nenhum dado real é carregado, e a distribuição PWA não inclui a dependência de teste.

## P2.2 — Orçamento diário e preferência mensal (v57)

- `orcamento.js` expõe cálculo puro que recebe data de referência e teto em reais e processa despesas vencidas do mês em centavos. A cota de hoje usa despesas anteriores e distribui o restante pelos dias até fechar o mês; gastos de hoje reduzem essa cota, sem criar valores negativos.
- `resumo.js` apenas apresenta a leitura no mês atual; `ajustes.js` valida campos opcionais e grava exclusivamente as preferências locais. Não há escrita no repositório de lançamentos, migração nem alteração nos backups financeiros.
- O catálogo, registro obrigatório, SW e gerador de HTML incluem o novo módulo e testes cobrem recorrências, fim de mês, orçamento excedido e compatibilidade com preferências anteriores.

## P2.3a — Agenda de compromissos e previsões (v58)

- `previsoes.js` é um módulo de leitura: recebe a lista de transações e datas de referência para listar as próximas despesas registradas ou recorrentes e totalizar os 12 meses seguintes via `motor-financeiro.js`.
- `Relatórios` recebe a tabela responsiva de 12 meses e agenda próxima sem formulário nem ação de baixa. Conteúdo de lançamentos é escapado. O modelo atual não possui obrigação distinta de transação: por isso não apresenta etiquetas “paga” ou “atrasada”.
- Contratos de backup, IndexedDB, importação e exclusão permanecem inalterados. O módulo foi registrado em catálogo/autodiagnóstico, SW, import do app e HTML único, com testes puros e inspeção de navegador.

## P2.5a — Resumo anual sem dupla contagem (v59)

- `relatorio-anual.js` calcula somente valores vencidos em 12 meses com data de referência explícita, aproveitando `motor-financeiro.js`. Aportes são somados separadamente e **não** subtraídos novamente do saldo dos lançamentos.
- Interface com barras para entradas/saídas, navegação de anos, melhor mês e compartilhamento iniciado por toque. Nomes de meses e valores são renderizados sem strings financeiras em logs. Se a API de compartilhar não estiver disponível, oferece cópia pelo navegador.
- Regras puras, autodiagnóstico, cache PWA, HTML independente e Chromium integram a regressão. Não introduz transações ou campos persistentes.

## P2.5b — Desafio de 52 semanas por aportes vinculados (v60)

- `desafio-52.js` define os 52 valores, gera a grade e deriva o andamento somente da coleção financeira `allocations` ligada à meta nominal dedicada. Exige correspondência de semana, valor e categoria; duplicatas são sinalizadas.
- `objetivos.js` renderiza o desafio com as outras metas. `app.js` apenas abre o diálogo de meta ou de investimento existente e preenche valores; a escolha da origem e o commit ficam nas validações e no repositório já testados. Sem novos formatos de backup ou migrações.
- Testes de fórmulas e situações inconsistentes, E2E mobile, autodiagnóstico, HTML independente e SW fazem parte da revisão.

## P2.6a/P2.7a — Ordem visual e cobertura de larguras (v61)

- CSS responsivo reorganiza apenas a exibição móvel do Resumo, colocando o orçamento antes da visão gráfica. Nenhum elemento financeiro é duplicado, removido ou gravado; desktop e DOM fonte mantêm a ordem estrutural anterior.
- Foco da navegação inferior destacado, com seis módulos preservados. E2E confere ausência de overflow nas larguras 320, 390 e 768 px, além das rotas já cobertas em desktop e mobile.
