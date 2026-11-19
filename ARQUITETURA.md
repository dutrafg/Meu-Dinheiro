# Arquitetura — Meu Dinheiro

## Objetivo

Manter HTML, estilos, módulos de tela, importação/exportação e backup separados para corrigir cada área sem alterar componentes não relacionados. Continua sendo um aplicativo **estático e instalável**, publicado a partir de `dist/` na Vercel e no GitHub Pages, sem bundler.

## Estrutura

```text
dist/
  index.html               # Estrutura da página e formulários (<dialog>)
  styles.css               # Estilos base compartilhados (sem regras antigas inativas)
  prototype.css            # Entrada dos arquivos CSS temáticos
  css/
    estrutura.css           # Cores, cabeçalho, navegação e layout geral
    resumo.css             # Painéis, gráficos e cartões
    saude.css              # Indicadores de saúde financeira, desktop e celular
    objetivos.css          # Metas, sonho e componentes de progresso
    dialogos.css           # Formulários, CSV, reserva e lembretes
    responsivo.css         # Smartphone, tablet e tema do sistema
    ajustes.css            # Tema, cores e janela de Ajustes
    impressao.css          # Saída A4 sem controles, incluindo tema claro
  app.js                   # Orquestração, persistência e eventos legados
  modules/
    resumo.js              # Tela Resumo e gráficos por categoria
    saude.js               # Poupança, fôlego e temperatura: regras puras e card
    notificacoes.js        # Dispensar/restaurar lembretes sem concluir aportes
    relatorio-pdf.js       # Imprimir tela atual e salvar PDF via navegador
    lancamentos.js         # Renda/Despesas, linhas e formulário
    objetivos.js           # Metas/Sonho, progresso, reserva e formulário
    backup.js              # Backup completo JSON e cópias na pasta
    csv-interface.js       # Visualização, classificação e importação CSV
    validacao.js           # Datas, integridade e restauração segura
    atualizador.js         # Detecção de versões e confirmação do usuário
    log.js                 # Eventos técnicos sanitizados e limite de 50 registros
    integridade.js         # Regras puras de verificação dos dados
    diagnostico.js         # Painel e relatório JSON sem valores pessoais
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
4. Os controladores alteram os registros por `persist(next)`, que atualiza `localStorage` e agenda o backup automático em pasta, quando habilitado.
5. `render()` atualiza a tela corrente. Os módulos recebem o estado atualizado via `getData()` e `getMonth()`, evitando referências obsoletas após restauração.
6. `preferencias.js` usa a chave separada `meu-dinheiro-essencial:preferencias:v1`; ajustes de aparência e aporte não regravam lançamentos. Backups novos incluem preferências, com compatibilidade para JSON v1 antigo.
7. `notificacoes.js` utiliza `meu-dinheiro-essencial:avisos-ocultos:v1`, isolada dos dados de aportes realizados. Dispensar um aviso não altera `completedAportes`; restaurar reexibe apenas o que ainda não foi concluído.

## Regras de manutenção

- **Não altere** a chave `meu-dinheiro-essencial:v1` nem o formato JSON v1 sem criar uma migração compatível.
- **Regra permanente:** cada funcionalidade, verificador, serviço e controle de interface deve ocupar seu próprio módulo em `dist/modules/`, com dependências explícitas e testes próprios. `app.js` permanece como orquestrador, sem concentrar lógica nova.
- Logs aceitam apenas códigos técnicos predefinidos e indicação de módulo. Nunca registre valores, nomes, descrições, objetos completos de erro, stacks, conteúdo CSV/JSON ou caminhos de pasta.
- Diagnósticos são operações somente leitura sobre os dados financeiros. O log usa somente a sessão, limitado a 50 códigos técnicos. Preferências são armazenadas separadamente dos registros financeiros.
- A prévia de tema/cor nunca grava dados antes de Salvar e deve ser revertida em qualquer fechamento do diálogo. O Diagnóstico valida atributos e estilos CSS calculados, não apenas preferências JSON.
- **Registro obrigatório do Diagnóstico:** ao criar/renomear módulo em `dist/modules/`, adicione seu nome em `MODULOS_OBRIGATORIOS` (`catalogo-diagnostico.js`) e uma autoverificação executável em `registro-modulos.js`. Inclua verificações específicas do comportamento e possíveis falhas. `tests/arquitetura.test.cjs` falha quando falta registro.
- **Auditoria contínua:** `auditoria-codigo.js` lê somente os arquivos públicos locais (`index.html`, bibliotecas, todos os módulos registrados e CSS importado por `prototype.css`). Sinaliza classes CSS e funções privadas sem referência estática como **avisos**, inclusive após novas versões publicadas; reconhece classes produzidas dinamicamente. Não remove nada automaticamente, porque usos indiretos podem não aparecer nessa análise. O teste `tests/auditoria-codigo.test.cjs` valida a cobertura e exige revisão de código obsoleto antes de publicar. Na prévia HTML independente, a consulta de arquivos modulares é indisponível e o diagnóstico mostra o motivo.
- A barra do Diagnóstico segue **5 s para até 9 verificações +0,5 s por verificação adicional, com teto de 25 s somente para a animação**. O catálogo não tem limite de verificações e a execução real nunca é interrompida pelo relógio visual. Todos os resultados são coletados antes da animação; se os testes demorarem mais, a interface continua aguardando. O JSON só fica disponível ao final.
- Mantenha `completedAportes`, `allocations`, `transactions` e `goals` ao importar/exportar.
- Para modificar somente a interface, altere o arquivo da área em `dist/modules/` e/ou `dist/css/` correspondente.
- Ao criar, renomear ou remover qualquer script/CSS/ícone, atualize `ASSETS` em `dist/sw.js` e incremente a versão de `CACHE`.
- **Versão visível e sincronizada:** `VERSAO_EM_EXECUCAO` em `dist/modules/atualizador.js` representa o código atualmente aberto e deve ser atualizado junto com `CACHE` em `dist/sw.js` a cada publicação. O teste `tests/atualizador.test.cjs` impede a publicação caso os números não coincidam. O Diagnóstico confere se a versão aparece corretamente em Ajustes.
- A cada publicação que modificar o app, altere o identificador `CACHE` no Service Worker para que uma nova versão seja detectada. O SW instala em espera; apenas o clique em **Atualizar agora** envia `SKIP_WAITING`, que aciona `controllerchange` e recarrega a página. Não force a atualização durante a edição de dados.
- Não carregue módulos por URLs absolutas: os caminhos relativos funcionam tanto na raiz da Vercel quanto na raiz publicada no GitHub Pages.
- Não invoque `localStorage.clear()` ou apague registros como parte de atualização, teste ou recuperação.
- Faça os testes em uma branch separada e preserve a `main` até homologação.

## Testar

```bash
node --test tests/*.test.cjs
python -m http.server 4173 --directory dist
```

Abrir `http://localhost:4173` em um navegador moderno. Testar as cinco áreas, formulários, gráficos, importação/exportação CSV, backup JSON e modo offline. O acesso direto à pasta requer Chrome/Edge em contexto seguro (`localhost` ou HTTPS).

O teste `tests/modulos.test.cjs` exercita os renderizadores separadamente e verifica os arquivos CSS; `tests/pwa.test.cjs` garante que todos os módulos estejam no cache offline.
O teste `tests/atualizador.test.cjs` simula atualização, ausência de conexão, instalação inicial e a exigência de confirmação antes do recarregamento. `tests/validacao.test.cjs` cobre dados antigos, backups e recuperação de falhas. `tests/standalone.test.cjs` verifica a prévia HTML independente.
`tests/diagnostico.test.cjs` valida integridade, privacidade e duração; `tests/registro-diagnostico.test.cjs` exige autoverificações; `tests/preferencias.test.cjs` cobre validação e isolamento; `tests/dialogos.test.cjs` comprova cancelamento seguro; `tests/recorrencia-formulario.test.cjs` verifica aviso sobre séries mensais. Toda mudança de interface deve ser conferida também em desktop e smartphone antes da publicação.
`tests/saude.test.cjs` verifica limites, ausência de dados e datas futuras; `tests/notificacoes.test.cjs` cobre limpar, cancelar, restaurar, dados adulterados e falhas de armazenamento; `tests/relatorio-pdf.test.cjs` garante impressão local. `tests/ajustes.test.cjs` simula prévia, cancelamento e gravação.
`tests/auditoria-codigo.test.cjs` verifica detecção de CSS/funções sem uso, preservação de classes dinâmicas, leitura dos módulos e catálogo e mantém a revisão estática ativa na integração contínua.
