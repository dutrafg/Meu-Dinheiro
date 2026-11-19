# Arquitetura — Meu Dinheiro

## Objetivo

Manter HTML, estilos, módulos de tela, importação/exportação e backup separados para corrigir cada área sem alterar componentes não relacionados. Continua sendo um aplicativo **estático e instalável**, publicado a partir de `dist/` na Vercel e no GitHub Pages, sem bundler.

## Estrutura

```text
dist/
  index.html               # Estrutura da página e formulários (<dialog>)
  styles.css               # Estilos base originais
  prototype.css            # Entrada dos arquivos CSS temáticos
  css/
    estrutura.css           # Cores, cabeçalho, navegação e layout geral
    resumo.css             # Painéis, gráficos e cartões
    objetivos.css          # Metas, sonho e componentes de progresso
    dialogos.css           # Formulários, CSV, reserva e lembretes
    responsivo.css         # Smartphone, tablet e tema escuro
  app.js                   # Inicialização, estado, finanças e eventos globais
  modules/
    resumo.js              # Tela Resumo e gráficos por categoria
    lancamentos.js         # Renda/Despesas, linhas e formulário
    objetivos.js           # Metas/Sonho, progresso, reserva e formulário
    backup.js              # Backup completo JSON e cópias na pasta
    csv-interface.js       # Visualização, classificação e importação CSV
    validacao.js           # Datas, integridade e restauração segura
    atualizador.js         # Detecção de versões e confirmação do usuário
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

## Regras de manutenção

- **Não altere** a chave `meu-dinheiro-essencial:v1` nem o formato JSON v1 sem criar uma migração compatível.
- Mantenha `completedAportes`, `allocations`, `transactions` e `goals` ao importar/exportar.
- Para modificar somente a interface, altere o arquivo da área em `dist/modules/` e/ou `dist/css/` correspondente.
- Ao criar, renomear ou remover qualquer script/CSS/ícone, atualize `ASSETS` em `dist/sw.js` e incremente a versão de `CACHE`.
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
