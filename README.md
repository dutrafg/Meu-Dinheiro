# Meu Dinheiro

Aplicativo financeiro pessoal simples, responsivo e instalável como PWA (Progressive Web App), preparado para publicar na Vercel e no GitHub Pages.

## Áreas do aplicativo

- **Resumo:** visão financeira, últimas transações, dois gráficos de gastos por categoria e o painel de Saúde Financeira.
- **Renda:** salário base, Personal e demais entradas; lembretes de aporte configuráveis (padrão de 10% sobre Salário, Salário base e Personal).
- **Despesas:** lançamentos e categorias de gastos.
- **Metas:** reserva, objetivos de economia e estimativa ilustrativa de CDB a 100% do CDI a partir de dados do Banco Central.
- **Sonho:** acompanhamento de objetivos pessoais.

O aplicativo também oferece importação e exportação CSV, backup/restauração JSON, **backup automático em pasta escolhida no computador** e confirmação obrigatória de Reserva, Meta ou Sonho para aplicações identificadas no extrato bancário.

## Ajustes e aparência (Etapa 2)

Nos três pontos (`⋯`) do cabeçalho, selecione **Abrir Ajustes e diagnósticos**. Escolha tema **claro, escuro ou automático**, seis cores de destaque, percentual de aporte (0%–100%), categorias de renda consideradas e qual meta é a reserva principal. A cor de destaque não altera as cores financeiras de entradas ou saídas.

Tema e cor mudam **assim que você seleciona**. Use **Salvar** no cabeçalho dos Ajustes para manter a aparência. Fechar ou Cancelar antes de salvar restaura a escolha anterior. O Diagnóstico agora compara a configuração salva com o fundo, os botões e as cores realmente aplicados pela folha CSS.

As preferências ficam em uma chave própria do navegador, sem regravar lançamentos. O planejamento em **Metas** e o sino usam as regras selecionadas; nenhum aporte é transferido automaticamente. Backups JSON e em pasta incluem preferências e são compatíveis com os arquivos antigos.

CSV, backups, atualização e diagnóstico ficam centralizados em seções expansíveis de Ajustes. Também há metadados para adicionar à tela inicial no iOS.

## Saúde Financeira (Etapa 3)

O painel **Saúde financeira** do Resumo apresenta três indicadores informativos:

- **Taxa de poupança:** saldo do mês dividido pela renda do mês (em percentual). Sem renda, exibe `—`.
- **Fôlego da reserva:** reserva principal dividida pela média diária das despesas dos últimos três meses até a data atual. Sem despesas, exibe `—`, evitando uma falsa cobertura infinita.
- **Situação:** 🌱 Crescendo (poupança ≥ 15%), 😌 Estável (saldo não negativo), ⚠️ Apertado (déficit com cobertura ≥ 30 dias) ou 🔥 Atenção (déficit com cobertura menor). Sem movimentações, informa que faltam dados.

São estimativas baseadas no que foi registrado no aparelho. Não movimentam dinheiro nem prometem rendimento futuro.

## Notificações e relatório PDF (Etapa 4)

Toque no **sino** e em **Limpar notificações** para dispensar os lembretes pendentes. Uma confirmação evita limpezas acidentais. Isso **não marca aportes como realizados e não exclui lançamentos**. O botão **Restaurar avisos ocultos** permite recuperar a lista; novas rendas continuam produzindo lembretes. As dispensas são salvas em uma chave separada dos dados financeiros.

Em **Ajustes → Arquivos, importação e backup → Imprimir / salvar PDF da tela**, o navegador abre a impressão da área financeira atual, sem botões nem menus. Selecione **Salvar como PDF** no diálogo nativo. Não há envio de dados para servidores do aplicativo.

## Diagnóstico e integridade (Etapas 1–2)

Em **Ajustes → Atualizações e integridade → Executar diagnóstico completo**, o aplicativo verifica, sem modificar registros, dezenas de itens independentes: datas, valores, IDs, categorias, vínculos, lembretes, notificações dispensadas, estilo efetivo do tema e das cores, Saúde Financeira, PDF, limites de backup, bibliotecas, interface, cada módulo, preferências, armazenamento, cache PWA, atualização e pasta de backup.

Cada módulo em `dist/modules/` deve constar no catálogo com uma autoverificação funcional. Testes de arquitetura impedem que arquivos novos fiquem sem registro. Não há limite fixo para a quantidade de verificações. A **animação** da barra segue 5 segundos iniciais e mais 0,5 segundo por verificação acima das 9 primeiras, limitada a **25 segundos**. O relógio não interrompe testes: todos são executados, mesmo quando a análise demorar mais do que a animação. O relatório JSON só é liberado após concluir.

O Diagnóstico também **audita código não utilizado**: analisa as folhas CSS e os módulos JavaScript publicados, conta classes e funções verificadas e exibe alertas para seletores e funções sem referência detectável. Esses achados são apenas candidatos a remoção, pois o código pode ser chamado indiretamente. Nada é excluído automaticamente. Essa verificação funciona na versão web/PWA modular, inclusive com os arquivos em cache offline; no HTML único independente, a inspeção dos arquivos separados não está disponível.

O relatório é gerado **apenas no dispositivo**, sem envio automático. Contém contagens, estado técnico, datas de registros, versão do navegador e códigos de erros; **não contém nomes, descrições, valores financeiros, saldos nem nomes/caminhos de pastas**. Se precisar reproduzir uma falha, marque **Registrar eventos técnicos detalhados nesta sessão**. Esta opção começa desligada, registra somente códigos de ação permitidos e não captura conteúdo de formulários. Os últimos 50 eventos técnicos ficam em `sessionStorage`, com fallback para memória caso esse armazenamento falhe.

Exclusões e restauração de backup agora usam confirmações visuais do aplicativo. Edições de lançamentos recorrentes avisam que a mudança afeta a série inteira. Falhas de sincronização da pasta exibem um aviso além do indicador no menu.

## Atualizações do aplicativo

O aplicativo instalado no navegador verifica automaticamente se há novas versões **ao abrir, ao voltar para a aba e periodicamente enquanto estiver em uso**. Um ponto azul nos três pontos (`⋯`) do cabeçalho e um aviso informam quando existe uma versão pronta. Abra o menu e toque em **Atualizar agora** para ativá-la. A página **só é recarregada após sua confirmação**, para não interromper formulários em andamento; salve lançamentos ainda não enviados antes de atualizar.

Em **Ajustes → Atualizações e integridade** há também **Verificar atualizações** para consultar manualmente. O atualizador usa o Service Worker do PWA: requer HTTPS ou `localhost`, e funciona após uma primeira instalação online. Ele atualiza arquivos da interface **sem apagar os registros do navegador**. Na prévia HTML única, aberta como arquivo local, esse recurso não funciona. Uma versão nova só será detectada se sua publicação atualizar `dist/sw.js` e sua versão de cache.

Nessa mesma seção, **Versão em execução** mostra permanentemente o número do código que está aberto (por exemplo, `v19`). Durante o download de uma atualização, continua exibindo a versão anterior até que a atualização seja instalada e a página recarregue. O Diagnóstico registra e valida esse número.

## Estrutura modular do código

O aplicativo continua sendo um PWA estático, sem etapa de compilação. A página `dist/index.html` contém a estrutura HTML e os diálogos; `dist/app.js` inicializa os serviços, o estado local e os controladores. As telas, o backup e o CSV agora ficam em arquivos independentes em `dist/modules/`.

| Área | Arquivo principal |
| --- | --- |
| Resumo e gráficos | `dist/modules/resumo.js` |
| Saúde Financeira | `dist/modules/saude.js` + `dist/css/saude.css` |
| Limpeza e restauração de notificações | `dist/modules/notificacoes.js` |
| Impressão e PDF | `dist/modules/relatorio-pdf.js` + `dist/css/impressao.css` |
| Renda e Despesas | `dist/modules/lancamentos.js` |
| Metas, Reserva e Sonho | `dist/modules/objetivos.js` |
| Backup JSON e pasta do PC | `dist/modules/backup.js` |
| Importação/exportação CSV | `dist/modules/csv-interface.js` |
| Validação e recuperação de dados | `dist/modules/validacao.js` |
| Verificação de versões e aviso de atualização | `dist/modules/atualizador.js` + `dist/sw.js` |
| Registro técnico sanitizado e privacidade | `dist/modules/log.js` |
| Regras puras de integridade | `dist/modules/integridade.js` |
| Painel e relatório de diagnóstico | `dist/modules/diagnostico.js` |
| Auditoria de CSS e funções possivelmente sem uso | `dist/modules/auditoria-codigo.js` |
| Diálogos de confirmação e avisos | `dist/modules/dialogos.js` |
| Aparência e painel de Ajustes | `dist/modules/ajustes.js` + `dist/css/ajustes.css` |
| Preferências persistidas e validadas | `dist/modules/preferencias.js` |
| Regras puras de aporte | `dist/modules/regras-financeiras.js` |
| Inventário e testes obrigatórios por módulo | `dist/modules/catalogo-diagnostico.js` + `dist/modules/registro-modulos.js` |
| Aparência, layout e responsividade | `dist/css/` (carregado por `dist/prototype.css`) |
| Estado, persistência e navegação | `dist/app.js` |

Consulte [ARQUITETURA.md](ARQUITETURA.md) antes de alterar um módulo. Mantenha o formato de dados e o fluxo de gravação sem mudanças silenciosas: usuários existentes precisam continuar acessando seus lançamentos e seus arquivos de backup.

**Regra de manutenção:** novas funcionalidades, componentes, verificações e serviços devem permanecer em módulos separados. `app.js` apenas inicializa e conecta os módulos. Evite concentrar lógica de diferentes áreas no arquivo principal.

## Salvar automaticamente em uma pasta do PC

1. Abra o aplicativo no **Chrome ou Edge no computador** (HTTPS ou `localhost`).
2. Clique nos três pontos (`⋯`) e abra **Ajustes → Arquivos, importação e backup → Escolher pasta de dados**.
3. Escolha uma pasta que será usada pelo aplicativo e autorize a gravação.
4. A partir de então, cada alteração bem-sucedida nos dados é salva automaticamente no arquivo `meu-dinheiro-dados.json`, após uma pequena pausa de 350 ms. Uma cópia do dia também fica em `historico/`.

O acesso à pasta é lembrado no navegador, mas a permissão de escrita pode expirar: nesse caso, um indicador aparece no botão de backup e o menu oferece **Reautorizar / salvar agora**. Se a pasta já contiver um backup com dados diferentes, o aplicativo **pede confirmação** e preserva uma cópia do arquivo anterior antes de substituí-lo. Se alguém editar o arquivo fora do app enquanto ele estiver aberto, a gravação é interrompida para evitar perda de dados.

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
