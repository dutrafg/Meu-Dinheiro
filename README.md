# Meu Dinheiro

Aplicativo financeiro pessoal simples, responsivo e instalável como PWA (Progressive Web App), preparado para publicar na Vercel e no GitHub Pages.

## Homologação visual v38 e diagnóstico unificado

A versão visual **v38** está disponível em `dist/homologacao-v38.html`, também acessível no servidor como `/homologacao-v38.html` (Vercel) ou `/Meu-Dinheiro/dist/homologacao-v38.html` (GitHub Pages). A prévia reúne todas as verificações v33–v38 em **um diagnóstico**, com **um arquivo JSON** e animação de até 25 segundos. Foram corrigidos os falsos erros de contraste (`#fff`), reconhecimento do tema das prévias e rótulo de versão visual/motor. Em HTML independente, Service Worker e auditoria de arquivos externos aparecem como **não avaliados**, pois exigem hospedagem HTTP(S).

Esta página é uma **prévia de homologação**, não substitui automaticamente o `dist/index.html` do PWA estável. O código-fonte permanece modular, em `dist/modules/`, `dist/css/` e `preview-v32/` a `preview-v38/`. Para reconstruir: `node scripts/gerar-html-design-v38.cjs dist/homologacao-v38.html`.

## Áreas do aplicativo

- **Resumo:** visão financeira, últimas transações, dois gráficos de gastos por categoria e o painel de Saúde Financeira.
- **Renda:** salário base, Personal e demais entradas; lembretes de aporte configuráveis (padrão de 10% sobre Salário, Salário base e Personal).
- **Despesas:** lançamentos e categorias de gastos.
- **Metas:** reserva, objetivos de economia e estimativa ilustrativa de CDB a 100% do CDI a partir de dados do Banco Central.
- **Sonho:** acompanhamento de objetivos pessoais.
- **Ajustes:** sexta aba da navegação, com aparência, planejamento, backup, atualizações e diagnóstico.

No Resumo Geral, **Saldo disponível hoje** mostra o acumulado de receitas menos despesas até a data atual, independentemente do mês selecionado. Lançamentos futuros não entram nesse valor; recorrências são contadas somente após a data mensal correspondente. Trata-se de uma estimativa baseada nos lançamentos cadastrados, não de uma consulta ao saldo bancário. As reservas continuam acompanhadas separadamente, sem desconto duplo.

O aplicativo também oferece importação e exportação CSV, backup/restauração JSON, **backup automático em pasta escolhida no computador** e confirmação obrigatória de Reserva, Meta ou Sonho para aplicações identificadas no extrato bancário.

## Ajustes e aparência (v21)

Na sexta aba **Ajustes** da barra principal (desktop e celular), escolha tema **claro, escuro ou automático**, seis cores de destaque, percentual de aporte (0%–100%), categorias de renda consideradas e qual meta é a reserva principal. A cor de destaque não altera as cores financeiras de entradas ou saídas. O padrão para novas instalações é **automático + azul**; as escolhas já salvas não são alteradas.

Tema e cor mudam **assim que você seleciona**, como prévia. Use **Salvar alterações** para manter a aparência. **Descartar** ou sair da aba antes de salvar restaura a escolha anterior. O salvamento explícito foi preservado para evitar mudanças acidentais; dados financeiros não são tocados.

As preferências ficam em uma chave própria do navegador, sem regravar lançamentos. O planejamento em **Metas** e o sino usam as regras selecionadas; nenhum aporte é transferido automaticamente. Backups JSON e em pasta incluem preferências e são compatíveis com os arquivos antigos.

CSV e backup ficam numa seção expansível. Atualização e diagnóstico ficam visíveis diretamente na página Ajustes, com aviso de atualização/backup na própria aba. As barras de progresso compartilham duas espessuras e animação suave (desativada para usuários que preferem movimento reduzido).

## Saúde Financeira (Etapa 3)

O painel **Saúde financeira** do Resumo apresenta três indicadores informativos:

- **Taxa de poupança:** saldo do mês dividido pela renda do mês (em percentual). Sem renda, exibe `—`.
- **Fôlego da reserva:** reserva principal dividida pela média diária das despesas dos últimos três meses até a data atual. Sem despesas, exibe `—`, evitando uma falsa cobertura infinita.
- **Situação:** 🌱 Crescendo (poupança ≥ 15%), 😌 Estável (saldo não negativo), ⚠️ Apertado (déficit com cobertura ≥ 30 dias) ou 🔥 Atenção (déficit com cobertura menor). Sem movimentações, informa que faltam dados.

São estimativas baseadas no que foi registrado no aparelho. Não movimentam dinheiro nem prometem rendimento futuro.

## Notificações e relatório PDF (Etapa 4)

Toque no **sino** e em **Limpar notificações** para dispensar os lembretes pendentes. Uma confirmação evita limpezas acidentais. Isso **não marca aportes como realizados e não exclui lançamentos**. O botão **Restaurar avisos ocultos** permite recuperar a lista; novas rendas continuam produzindo lembretes. As dispensas são salvas em uma chave separada dos dados financeiros.

Em **Ajustes → Arquivos, importação e backup → Conteúdo do relatório PDF**, escolha o tipo e toque em **Gerar PDF financeiro**. O padrão é **Resumo completo do mês**, independentemente da última tela visitada. Inclui receitas e despesas do mês selecionado, categorias, todas as movimentações do período, metas, sonhos e histórico de aplicações e resgates. As opções Receitas, Despesas, Metas e Sonhos geram recortes específicos. Selecione **Salvar como PDF** no diálogo nativo. Não há envio de dados para servidores do aplicativo.

No desktop e tablet, o aplicativo ocupa a largura disponível, com margens proporcionais e cartões responsivos. A visualização de smartphones permanece compacta; a impressão A4 conserva formatação independente da largura da tela.

No **desktop**, a navegação ocupa toda a largura útil da janela e fica presa ao topo ao rolar a página; o cabeçalho de saldo sai de cena para liberar espaço e os cartões passam por trás da barra. A criação de registros fica no botão **Novo** à direita da navegação, com ações para **renda, despesa, meta, sonho e investimento**. O menu pode ser fechado com Escape ou clique fora. No tablet e smartphone, a navegação inferior continua compacta: tocar no botão **+** abre um painel com **as mesmas cinco opções**, em qualquer tela financeira. A opção mais ligada à tela fica destacada, mas as outras continuam acessíveis; o painel fecha pelo **X**, Escape, toque fora ou troca de módulo. Toques no espaço interno dos diálogos não fecham formulários acidentalmente.

No **Resumo**, toque **no nome do mês entre as setas** para abrir o **Calendário financeiro**. Ele permanece fechado por padrão, sem ocupar espaço entre os cards. As setas do seletor continuam mudando o mês do Resumo; dentro do calendário há setas próprias para navegar entre os meses, mantendo o período selecionado sincronizado. O diálogo mostra os dias de cada mês, com as rendas e despesas registradas em cada data. Os cinco níveis de intensidade são calculados relativamente à maior movimentação diária do próprio mês, seguindo a ideia do calendário do Reserva Simples. Verde representa renda, vermelho representa despesas e o degradê verde/vermelho representa dias com os dois tipos de lançamento, proporcionalmente aos valores. Toque em um dia para conferir as transações; no celular, os valores são abreviados para caber na grade. Feche com o botão superior ou Escape.

O teste de navegador, quando houver Playwright e Chromium no computador, pode ser executado com `node scripts/verificar-interface.cjs`. Ele cria apenas dados fictícios em um servidor local efêmero e verifica navegação, formulários, saldo, metas e layout móvel. Não faz parte da suíte Node padrão porque depende de um navegador instalado e permissões para executá-lo.

Em **Metas** e **Sonhos**, cada objetivo possui o botão **Investir**. Informe a descrição, o valor, a data, a categoria (pode digitar uma nova) e a origem do dinheiro. O aplicativo procura uma renda identificada como salário nos **45 dias anteriores** à data do investimento, inclusive salários recorrentes, e informa quando encontra uma, mas **a origem é sempre uma escolha explícita**: **Do salário registrado** ou **Investimento antigo / já guardado**. A origem salarial exige salário previamente cadastrado, sem adivinhação. O total de investimentos associados à mesma ocorrência salarial não pode superar o salário registrado; alterações ou exclusões de salário que invalidariam esses vínculos são bloqueadas até a correção dos aportes. Cada aporte aumenta o valor guardado da meta ou sonho exatamente uma vez e entra no histórico e no PDF, sem gerar uma despesa. Somente os aportes confirmados como oriundos do salário reduzem o **saldo disponível hoje**; investimentos antigos não alteram esse saldo. No **Resumo**, Reserva e Sonhos têm cards independentes.

O **histórico de aplicações** agora inclui **Editar investimento** para corrigir descrição, valor, data, categoria, origem ou objetivo vinculado. A alteração mantém o identificador do registro, desconta o aporte anterior da meta/sonho e aplica o valor revisado uma única vez. A associação ao salário é recalculada pela nova data e origem; os dados originais do histórico não são duplicados.

**Atualização v30 — paridade móvel:** o botão **+** no smartphone abre o painel completo de cadastro, incluindo investimento, meta e sonho, sem criar lançamentos por engano. A edição de aportes pode ser encontrada em **Metas/Sonho → Histórico de investimentos → Editar investimento**; o título indica que a lista pode ser aberta. Em **Ajustes**, a seção recolhível identifica explicitamente **Relatórios PDF, CSV, importação e backup**. O Diagnóstico inspeciona os cinco atalhos e a paridade desktop/celular, atributos acessíveis, navegação de seis abas, tamanho do botão no celular e a identificação dos relatórios. Essas verificações usam a interface e dados sintéticos; não modificam lançamentos.

**Atualização v31 — estabilidade e diagnóstico:** proteção contra sobrescrita por outra aba, sincronização segura de leitura, preservação opcional de armazenamento quando o navegador permite, atualização de dia e mês sem recarregar, compatibilidade com categorias históricas em backups, revisão da classificação de CSV e proteção de fórmulas. Os textos de renda/despesa agora usam cores próprias para contraste mínimo no tema claro e escuro, sem mudar as cores dos gráficos. A suíte Node e os testes internos verificam esses comportamentos com dados fictícios.

## Diagnóstico e integridade (Etapas 1–2)

**Atualização v29:** além das verificações existentes de cores semânticas, metas, sonhos, saldo e lançamentos, o Diagnóstico inclui novos testes sintéticos do calendário (seletor acessível, mês fechado, navegação, ano bissexto, cores, centavos, mês vazio) e da edição de investimentos (diferença de valor, origem salarial, transferência entre meta e sonho, proteção contra saldo negativo). Nenhum dado real é alterado.

Em **Ajustes → Executar diagnóstico completo**, o aplicativo verifica, sem modificar registros, dezenas de itens independentes: datas, valores, IDs, categorias, vínculos, lembretes, notificações dispensadas, estilo efetivo do tema e das cores, Saúde Financeira, PDF, limites de backup, bibliotecas, interface, cada módulo, preferências, armazenamento, cache PWA, atualização e pasta de backup.

Na v31, o painel inclui testes funcionais de **10 mil lançamentos sintéticos de backup**, migração de backups antigos, categoria insegura, proteção de salário e investimentos, edição de origem, virada de ano, prevenção de fechamento acidental de diálogos, sobrescrita entre abas, regressões na importação/exportação CSV e contraste calculado **WCAG AA (4,5:1)** da paleta ativa. Nenhuma dessas simulações altera ou remove dados financeiros. A interface não anuncia o limite de tempo; mostra o progresso e o número de verificações.

O checklist adicional da proposta de navegação e aparência acompanha **22 requisitos**: presença de Ajustes na navegação desktop/mobile, botão flutuante e seletor de mês, acesso ao Diagnóstico, ícones SVG, componentes de progresso, cores semânticas, contraste no modo escuro, tema padrão e apresentação dos controles. Os itens ficam agrupados em cartões expansíveis por módulo. **Pendente** é uma sugestão de evolução e **não** conta como erro ou aviso de integridade; **não avaliado** aparece quando a página ou o navegador não permite a inspeção.

Cada módulo em `dist/modules/` deve constar no catálogo com uma autoverificação funcional. Testes de arquitetura impedem que arquivos novos fiquem sem registro. Não há limite fixo para a quantidade de verificações. A **animação** da barra segue 5 segundos iniciais e mais 0,5 segundo por verificação acima das 9 primeiras, limitada a **25 segundos**. O relógio não interrompe testes: todos são executados, mesmo quando a análise demorar mais do que a animação. O relatório JSON só é liberado após concluir.

O Diagnóstico também **audita código não utilizado**: analisa as folhas CSS e os módulos JavaScript publicados, conta classes e funções verificadas e exibe alertas para seletores e funções sem referência detectável. Esses achados são apenas candidatos a remoção, pois o código pode ser chamado indiretamente. Nada é excluído automaticamente. Essa verificação funciona na versão web/PWA modular, inclusive com os arquivos em cache offline; no HTML único independente, a inspeção dos arquivos separados não está disponível.

O relatório é gerado **apenas no dispositivo**, sem envio automático. Contém contagens, estado técnico, datas de registros, versão do navegador e códigos de erros; **não contém nomes, descrições, valores financeiros, saldos nem nomes/caminhos de pastas**. Se precisar reproduzir uma falha, marque **Registrar eventos técnicos detalhados nesta sessão**. Esta opção começa desligada, registra somente códigos de ação permitidos e não captura conteúdo de formulários. Os últimos 50 eventos técnicos ficam em `sessionStorage`, com fallback para memória caso esse armazenamento falhe.

Exclusões e restauração de backup agora usam confirmações visuais do aplicativo. Edições de lançamentos recorrentes avisam que a mudança afeta a série inteira. Falhas de sincronização da pasta exibem um aviso além do indicador na aba Ajustes.

## Atualizações do aplicativo

O aplicativo instalado no navegador verifica automaticamente se há novas versões **ao abrir, ao voltar para a aba e periodicamente enquanto estiver em uso**. Um ponto azul na aba **Ajustes** e um aviso informam quando existe uma versão pronta. Em **Ajustes → Atualizações e integridade**, toque em **Atualizar agora** para ativá-la. A página **só é recarregada após sua confirmação**, para não interromper formulários em andamento; salve lançamentos ainda não enviados antes de atualizar.

Em **Ajustes → Atualizações e integridade** há também **Verificar atualizações** para consultar manualmente. O atualizador usa o Service Worker do PWA: requer HTTPS ou `localhost`, e funciona após uma primeira instalação online. Ele atualiza arquivos da interface **sem apagar os registros do navegador**. Na prévia HTML única, aberta como arquivo local, esse recurso não funciona. Uma versão nova só será detectada se sua publicação atualizar `dist/sw.js` e sua versão de cache.

Nessa mesma seção, **Versão em execução** mostra permanentemente o número do código que está aberto (nesta atualização, `v38`). Durante o download de uma atualização, continua exibindo a versão anterior até que a atualização seja instalada e a página recarregue. O Diagnóstico registra e valida esse número.

## Estrutura modular do código

O aplicativo continua sendo um PWA estático, sem etapa de compilação. A página `dist/index.html` contém a estrutura HTML e os diálogos; `dist/app.js` inicializa os serviços, o estado local e os controladores. As telas, o backup e o CSV agora ficam em arquivos independentes em `dist/modules/`.

| Área | Arquivo principal |
| --- | --- |
| Resumo e gráficos | `dist/modules/resumo.js` |
| Calendário financeiro diário e cinco intensidades | `dist/modules/calendario-financeiro.js` + `dist/css/calendario.css` |
| Cadastro e edição de investimentos | `dist/modules/investimentos.js` + `dist/css/investimentos.css` |
| Saúde Financeira | `dist/modules/saude.js` + `dist/css/saude.css` |
| Limpeza e restauração de notificações | `dist/modules/notificacoes.js` |
| Ação rápida no desktop e no celular | `dist/modules/acao-rapida.js` + `dist/css/estrutura.css` |
| Impressão e PDF | `dist/modules/relatorio-pdf.js` (controle) + `dist/modules/relatorio-pdf-conteudo.js` (conteúdo) + `dist/css/impressao.css` (A4) |
| Renda e Despesas | `dist/modules/lancamentos.js` |
| Metas, Reserva e Sonho | `dist/modules/objetivos.js` |
| Backup JSON e pasta do PC | `dist/modules/backup.js` |
| Importação/exportação CSV | `dist/modules/csv-interface.js` |
| Validação e recuperação de dados | `dist/modules/validacao.js` |
| Proteção contra conflito entre abas e persistência opcional | `dist/modules/concorrencia-dados.js` |
| Virada automática de dia e mês | `dist/modules/ciclo-periodo.js` |
| Verificação de versões e aviso de atualização | `dist/modules/atualizador.js` + `dist/sw.js` |
| Registro técnico sanitizado e privacidade | `dist/modules/log.js` |
| Regras puras de integridade | `dist/modules/integridade.js` |
| Painel e relatório de diagnóstico | `dist/modules/diagnostico.js` |
| Requisitos da proposta visual e navegação | `dist/modules/diagnostico-proposta.js` |
| Auditoria de CSS e funções possivelmente sem uso | `dist/modules/auditoria-codigo.js` |
| Diálogos de confirmação e avisos | `dist/modules/dialogos.js` |
| Aparência e painel de Ajustes | `dist/modules/ajustes.js` + `dist/css/ajustes.css` |
| Exclusão de dados financeiros com dupla confirmação | `dist/modules/limpeza-dados.js` + `dist/css/dialogos.css` |
| Preferências persistidas e validadas | `dist/modules/preferencias.js` |
| Regras puras de aporte | `dist/modules/regras-financeiras.js` |
| Inventário e testes obrigatórios por módulo | `dist/modules/catalogo-diagnostico.js` + `dist/modules/registro-modulos.js` |

### Apagar dados em Ajustes

Em **Ajustes → Apagar dados financeiros**, a exclusão local exige **duas confirmações**: aceitar o aviso e digitar exatamente `APAGAR` no diálogo final. A função remove somente o armazenamento de lançamentos, metas, sonhos, aplicações e lembretes concluídos deste navegador. Mantém tema, cores e demais preferências (exceto o vínculo com a reserva removida), avisos dispensados e arquivos de backup exportados.

O backup automático em pasta é pausado **antes** de remover os registros, aguarda gravações pendentes e não substitui silenciosamente o arquivo externo por um backup vazio. A reconexão é manual; se houver diferenças, exige confirmação e preserva uma cópia histórica antes de substituir. Não é possível desfazer a exclusão sem restaurar um backup existente. O Diagnóstico inclui o módulo, a interface e o estado de backup pausado; testes Node cobrem cancelamento, frase, falhas de armazenamento e preservação dos backups.
| Barras de progresso reutilizáveis | `dist/css/progresso.css` |
| Aparência, layout e responsividade | `dist/css/` (carregado por `dist/prototype.css`) |
| Estado, persistência e navegação | `dist/app.js` |

Consulte [ARQUITETURA.md](ARQUITETURA.md) antes de alterar um módulo. Mantenha o formato de dados e o fluxo de gravação sem mudanças silenciosas: usuários existentes precisam continuar acessando seus lançamentos e seus arquivos de backup.

**Regra de manutenção:** novas funcionalidades, componentes, verificações e serviços devem permanecer em módulos separados. `app.js` apenas inicializa e conecta os módulos. Evite concentrar lógica de diferentes áreas no arquivo principal.

## Salvar automaticamente em uma pasta do PC

1. Abra o aplicativo no **Chrome ou Edge no computador** (HTTPS ou `localhost`).
2. Abra **Ajustes → Arquivos, importação e backup → Escolher pasta de dados**.
3. Escolha uma pasta que será usada pelo aplicativo e autorize a gravação.
4. A partir de então, cada alteração bem-sucedida nos dados é salva automaticamente no arquivo `meu-dinheiro-dados.json`, após uma pequena pausa de 350 ms. Uma cópia do dia também fica em `historico/`.

O acesso à pasta é lembrado no navegador, mas a permissão de escrita pode expirar: nesse caso, um indicador aparece na aba Ajustes e a seção de backup oferece **Reautorizar / salvar agora**. Se a pasta já contiver um backup com dados diferentes, o aplicativo **pede confirmação** e preserva uma cópia do arquivo anterior antes de substituí-lo. Se alguém editar o arquivo fora do app enquanto ele estiver aberto, a gravação é interrompida para evitar perda de dados.

O backup contém receitas, despesas, metas, reservas, sonhos, aplicações, lembretes de aportes e preferências. Ele usa o **mesmo formato JSON** da opção **Restaurar backup (JSON)**. Os arquivos não são criptografados: mantenha a pasta em local seguro. A sincronização por pasta é específica de cada navegador e origem; as versões Vercel e GitHub Pages mantêm dados locais e permissões separados. Em navegadores sem acesso direto a pastas, o backup manual JSON continua disponível.

## Privacidade

Os lançamentos e lembretes ficam no armazenamento local do navegador. Quando o backup em pasta está ativado, uma cópia é gravada no diretório escolhido; o aplicativo não envia esses arquivos a um servidor próprio. O código público **não contém extratos, saldos ou dados financeiros pessoais**. Os arquivos CSV e JSON são processados no dispositivo. Ao trocar de aparelho ou de domínio, use o backup JSON para transportar os dados.

## Executar e testar localmente

Requer Node.js para os testes e qualquer servidor de arquivos estáticos para abrir a PWA:

```bash
node --test tests/*.test.cjs
python -m http.server 4173 --directory dist
```

Acesse `http://localhost:4173`. O modo offline depende da instalação inicial do service worker, servido em `localhost` ou HTTPS.

## Publicação na Vercel

Conecte este repositório a um projeto Vercel com a branch de produção `main`. O arquivo `vercel.json` seleciona o conteúdo estático de `dist/`, sem etapa de compilação. Após a publicação HTTPS, o app pode ser instalado pelo navegador como PWA.

## Publicação no GitHub Pages

O fluxo `.github/workflows/pages.yml` publica os arquivos de `dist/` diretamente na raiz do GitHub Pages, ao atualizar a branch `main`. Para habilitar o fluxo, em **Settings → Pages → Build and deployment → Source**, selecione **GitHub Actions**.

Enquanto o Pages estiver configurado para publicar a raiz da branch, o `index.html` da raiz encaminha automaticamente para o aplicativo em `dist/`, sem mostrar o README.

## Testes automáticos

Os testes são executados com `node --test tests/*.test.cjs`. O workflow do GitHub verifica o código em atualizações da branch `main` e em pull requests.

Para gerar uma cópia HTML única de homologação, sem dependências de servidor:

```bash
node scripts/gerar-html-teste.cjs meu-dinheiro-teste.html
```

Essa cópia abre offline como arquivo HTML, mas **não instala o PWA nem recebe atualizações por Service Worker**. Para usar os recursos instaláveis e o atualizador, sirva a pasta `dist/` em HTTPS ou `localhost`.


## Roadmap de manutenção — P0.1 (branch de homologação)

Esta etapa adiciona espelho de dados financeiros em IndexedDB e monitoramento técnico no diagnóstico. O armazenamento primário ainda é localStorage para manter compatibilidade; consulte DATABASE.md para a migração completa e AGENTS.md para regras de manutenção. O HTML de homologação é gerado como artefato do GitHub Actions, sem publicação automática na main.
