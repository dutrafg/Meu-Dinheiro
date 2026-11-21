/* Interface progressiva da prévia v33. O motor de lançamentos da v31 permanece intacto. */
(function () {
  'use strict';
  const money = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
  const domain = window.MeuDinheiroDesignV32Domain;
  const budgets = window.MeuDinheiroV33Orcamento;
  const projection = window.MeuDinheiroV33Previsao;
  const content = document.getElementById('view-content');
  if (!domain || !budgets || !projection || !content) return;

  const BUDGET_KEY = 'meu-dinheiro-essencial:orcamentos:preview-v33';
  const DATA_KEY = 'meu-dinheiro-essencial:v1';
  const CATEGORIES = window.MeuDinheiroCategoriasBrasileiras?.expense || ['Moradia','Alimentação','Contas','Internet','Telefone','Cartão de crédito','Faculdade','Farmácia','Cursos','Transporte','Saúde','Educação','Lazer','Compras','Outros'];
  const budgetStore = budgets.createStore(localStorage, BUDGET_KEY);
  let budgetDirty = false;
  const fmt = cents => money.format(cents / 100);
  const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]);
  const todayISO = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; };
  const selectedMonth = () => {
    const label = document.querySelector('#view-content [data-calendar-open]')?.textContent?.toLocaleLowerCase('pt-BR') || '';
    const names = ['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];
    const index = names.findIndex(name => label.includes(name));
    const year = label.match(/\b(20\d{2})\b/);
    return index >= 0 && year ? `${year[1]}-${String(index+1).padStart(2,'0')}` : todayISO().slice(0,7);
  };
  function loadEntries(month) {
    try {
      const financial = JSON.parse(localStorage.getItem(DATA_KEY) || '{}');
      return domain.monthlyEntries(financial.transactions, month);
    } catch (_) { return []; }
  }
  function categories() {
    const names = new Set(CATEGORIES);
    try {
      const data = JSON.parse(localStorage.getItem(DATA_KEY) || '{}');
      for (const entry of data.transactions || []) {
        if (entry.type === 'expense' && typeof entry.category === 'string' && entry.category.length <= 80) names.add(entry.category);
      }
    } catch (_) { /* A ausência de dados não impede editar limites. */ }
    for (const item of budgetStore.current().budgets) names.add(item.category);
    return [...names].sort((a,b) => a.localeCompare(b,'pt-BR'));
  }

  function categoryGroups() {
    const remaining = new Set(categories());
    const registry = window.MeuDinheiroCategoriasBrasileiras?.groups || [{titulo:'Categorias',categorias:[...remaining]}];
    const grouped = registry.map(group => {
      const items = group.categorias.filter(name => remaining.delete(name));
      return { title: group.titulo, items };
    }).filter(group=>group.items.length);
    if (remaining.size) grouped.push({ title:'Categorias importadas ou antigas', items:[...remaining] });
    return grouped;
  }

  function budgetPanel() {
    const selected = new Map(budgetStore.current().budgets.map(item => [item.category, item.limitCent]));
    const section = document.createElement('section');
    section.id = 'design-v33-budget-settings';
    section.className = 'settings-section design-v33-budget-settings';
    section.innerHTML = `<div class="design-v33-section-heading"><div><span class="design-kicker">PLANEJAMENTO MENSAL · V33</span><h3>Orçamento por categoria</h3></div><span class="design-v33-count">${selected.size} limite(s)</span></div>
      <p>Defina até quanto pretende gastar em cada categoria. Campos vazios significam <strong>sem limite</strong>. Os dados ficam separados dos lançamentos e não são debitados do saldo.</p>
      <p class="design-v33-note">As alterações válidas são salvas automaticamente. O orçamento fica separado do backup financeiro; exporte também os limites quando fizer uma cópia.</p>
      <form id="design-v33-budget-form"><label class="design-v33-category-search"><span>Buscar conta ou categoria</span><input id="design-v33-category-search" type="search" placeholder="Ex.: água, luz, aluguel, combustível" autocomplete="off" aria-label="Buscar categoria de orçamento"></label><div class="design-v33-category-groups">${categoryGroups().map((group,index)=>`<details class="design-v33-category-group" ${index===0||group.items.some(name=>selected.has(name))?'open':''}><summary>${esc(group.title)} <small>${group.items.filter(name=>selected.has(name)).length} com limite</small></summary><div class="design-v33-category-grid">${group.items.map(category=>{
        const value = selected.get(category);
        const formatted = value == null ? '' : `${Math.floor(value/100)},${String(value%100).padStart(2,'0')}`;
        return `<label class="design-v33-category-row"><span>${esc(category)}</span><span class="design-v33-money-input"><small>R$</small><input type="text" inputmode="decimal" autocomplete="off" maxlength="16" data-v33-category="${esc(category)}" value="${esc(formatted)}" placeholder="Sem limite" aria-label="Limite mensal para ${esc(category)}"></span></label>`;
      }).join('')}</div></details>`).join('')}</div><div class="design-v33-actions"><button type="button" id="design-v33-budget-export" class="button button-secondary">Exportar orçamento JSON</button><button type="button" id="design-v33-budget-import" class="button button-secondary">Importar orçamento JSON</button><input type="file" id="design-v33-budget-file" accept=".json,application/json" hidden></div>
      <p id="design-v33-budget-status" role="status" aria-live="polite">Alterações salvas automaticamente.</p></form>`;
    if (budgetStore.locked()) {
      section.querySelectorAll('input,button').forEach(item => { item.disabled = true; });
      section.querySelector('#design-v33-budget-status').textContent = 'A leitura do orçamento salvo falhou. Gravação bloqueada para proteger os dados existentes.';
    }
    return section;
  }

  function installSettings() {
    const form = document.getElementById('settings-form');
    if (!form) return;
    const existing = document.getElementById('design-v33-budget-settings');
    const replacement = budgetPanel();
    if (existing) existing.replaceWith(replacement);
    else form.after(replacement);
  }

  function status(message, error = false) {
    const line = document.getElementById('design-v33-budget-status');
    if (line) { line.textContent = message; line.dataset.state = error ? 'error' : 'ok'; }
  }

  function saveBudgetForm(event,automatic=false) {
    event.preventDefault();
    const inputs = [...event.target.querySelectorAll('[data-v33-category]')];
    const next = [];
    for (const input of inputs) {
      const value = input.value.trim();
      if (!value) continue;
      const cents = budgets.toCent(value);
      if (cents === null || cents < 100) {
        status(`O valor de ${input.dataset.v33Category} deve ser pelo menos R$ 1,00, com até duas casas decimais.`, true);
        input.focus();
        return;
      }
      next.push({ category: input.dataset.v33Category, limitCent: cents });
    }
    const previous = budgetStore.current().budgets;
    if(JSON.stringify(previous)===JSON.stringify(next)){
      budgetDirty=false;status('Tudo salvo automaticamente.');return;
    }
    const removed = previous.filter(item => !next.some(entry => entry.category === item.category));
    if (removed.length && !window.confirm(`Remover ${removed.length} limite(s) de orçamento? Os lançamentos serão preservados.`)){
      status('Remoção cancelada. Restaure o valor para manter o limite atual.',true);return;
    }
    const result = budgetStore.save(next);
    if (!result.ok) {
      status(result.reason === 'conflito' ? 'Outra aba alterou os limites. Recarregue o aplicativo antes de salvar.' : 'Não foi possível salvar. Nenhum lançamento financeiro foi alterado.', true);
      return;
    }
    if(!automatic)installSettings();
    else {
      const panel=document.getElementById('design-v33-budget-settings');
      const count=panel?.querySelector('.design-v33-count');
      if(count)count.textContent=`${next.length} limite(s)`;
    }
    budgetDirty = false;
    status(`${next.length} limite(s) mensal(is) salvo(s) automaticamente.`);
  }

  function exportBudget() {
    const blob = new Blob([JSON.stringify({ app: 'meu-dinheiro-essencial', kind: 'orcamentos-v33', ...budgetStore.current() }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'meu-dinheiro-orcamentos-preview-v33.json';
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
    status('Orçamento exportado. Guarde este arquivo junto com seu backup financeiro.');
  }

  async function importBudget(file) {
    if (!file) return;
    if (file.size > 100 * 1024) { status('O arquivo de orçamento excede 100 KB.', true); return; }
    try {
      const raw = JSON.parse(await file.text());
      if (raw.app !== 'meu-dinheiro-essencial' || raw.kind !== 'orcamentos-v33') throw Error('Formato incorreto');
      const incoming = budgets.normalize(raw);
      if (!window.confirm(`Substituir os ${budgetStore.current().budgets.length} limites atuais por ${incoming.budgets.length} do arquivo? Os lançamentos serão preservados.`)) return;
      const result = budgetStore.save(incoming.budgets);
      if (!result.ok) { status('Importação bloqueada por conflito ou falha na gravação. Nenhum dado foi substituído.', true); return; }
      installSettings();
      budgetDirty = false;
      status(`${incoming.budgets.length} limite(s) restaurado(s) do orçamento JSON.`);
    } catch (_) { status('Arquivo de orçamento inválido. Os limites existentes foram preservados.', true); }
  }

  function renderExtras() {
    if (!content.querySelector('[data-v32-summary]') || content.querySelector('[data-v33-summary]')) return;
    const month = selectedMonth();
    const entries = loadEntries(month);
    const day = todayISO();
    const trend = projection.forecast(entries, month, day);
    const limits = budgetStore.current().budgets;
    const evaluation = budgets.evaluate(entries, limits, day);
    const isFuture = month > day.slice(0,7);
    const isPast = month < day.slice(0,7);
    const section = document.createElement('section');
    section.className = 'design-v33-insights';
    section.dataset.v33Summary = '';
    section.innerHTML = `<article class="card design-v33-forecast"><div class="design-v33-card-head"><span class="design-kicker">RESULTADO DO MÊS</span><span class="design-v33-status-pill">${isPast ? 'Realizado' : isFuture ? 'Programado' : 'Estimativa'}</span></div>
      <h3>${isPast ? 'Resultado registrado' : 'Fechamento com lançamentos cadastrados'}</h3>
      <strong class="design-v33-big-number ${trend.closingResultCent < 0 ? 'is-expense' : 'is-income'}">${fmt(trend.closingResultCent)}</strong>
      <div class="design-v33-forecast-breakdown"><div><span>Entradas futuras</span><b class="is-income">${fmt(trend.futureIncomeCent)}</b></div><div><span>Saídas futuras</span><b class="is-expense">${fmt(trend.futureExpenseCent)}</b></div></div>
      <p>Projeção de receitas menos despesas <strong>já cadastradas</strong>. Não inclui movimentações não previstas, aportes nem saldo bancário.</p>
      ${trend.negativeDays ? `<p>Em ${trend.negativeDays} dia(s), o resultado acumulado deste mês fica negativo, sem considerar saldos anteriores.</p>` : ''}</article>
      <article class="card design-v33-budget-card"><div class="design-v33-card-head"><span class="design-kicker">ORÇAMENTO MENSAL</span><span class="design-v33-status-pill">${limits.length} limite(s)</span></div><h3>Gastos por categoria</h3>
      ${evaluation.length ? `<div class="design-v33-budget-bars">${evaluation.slice(0,4).map(row => `<div class="design-v33-budget-line"><div><strong>${esc(row.category)}</strong><span>${fmt(row.spentCent)} / ${fmt(row.limitCent)}</span></div><div class="design-v33-track" role="progressbar" aria-label="Orçamento de ${esc(row.category)}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.min(100,Math.round(row.pct))}"><span class="status-${row.status}" style="width:${Math.min(100,row.pct)}%"></span></div><small>${row.pct.toLocaleString('pt-BR')}% usado até hoje${row.scheduledCent ? ` · ${fmt(row.scheduledCent)} agendado` : ''}</small></div>`).join('')}</div>` : '<p>Defina limites para acompanhar o quanto já gastou em cada categoria.</p>'}
      <button class="design-v33-inline-action" type="button" data-v33-open="budget">${limits.length ? 'Editar limites' : 'Configurar orçamento'} →</button></article>`;
    (content.querySelector('.design-insights') || content.querySelector('.proto-overview'))?.after(section);
  }

  function openBudget() {
    const dialog = document.getElementById('design-more-dialog');
    if (dialog?.open) dialog.close();
    document.querySelector('#desktop-nav [data-view="ajustes"]')?.click();
    const panel = document.getElementById('design-v33-budget-settings');
    const wrapper=panel?.closest('.v35-budget-wrapper');
    if(wrapper)wrapper.open=true;
    panel?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    panel?.querySelector('input:not(:disabled)')?.focus({ preventScroll: true });
  }

  installSettings();
  document.addEventListener('submit', event => {
    if (event.target.id === 'design-v33-budget-form') saveBudgetForm(event);
  });
  document.addEventListener('click', event => {
    if (event.target.closest('[data-v33-open="budget"]')) openBudget();
    if (event.target.closest('#design-v33-budget-export')) exportBudget();
    if (event.target.closest('#design-v33-budget-import')) document.getElementById('design-v33-budget-file')?.click();
  });
  document.addEventListener('change', event => {
    if(event.target.matches('#design-v33-budget-form [data-v33-category]')){
      saveBudgetForm({preventDefault(){},target:event.target.closest('form')},true);
      return;
    }
    if (event.target.id !== 'design-v33-budget-file') return;
    const file = event.target.files?.[0];
    event.target.value = '';
    void importBudget(file);
  });
  document.addEventListener('input', event => {
    if (event.target.matches('#design-v33-budget-form [data-v33-category]')) budgetDirty = true;
    if (event.target.id === 'design-v33-category-search') {
      const needle = event.target.value.trim().toLocaleLowerCase('pt-BR');
      for (const group of document.querySelectorAll('.design-v33-category-group')) {
        let visible = 0;
        for (const row of group.querySelectorAll('.design-v33-category-row')) {
          const matched = row.textContent.toLocaleLowerCase('pt-BR').includes(needle);
          row.hidden = !matched;
          if (matched) visible++;
        }
        group.hidden = visible === 0;
        if (needle && visible) group.open = true;
      }
    }
  });
  window.addEventListener('storage', event => {
    if (event.key !== BUDGET_KEY) return;
    if (budgetDirty) {
      status('Outra aba alterou o orçamento. Descarte seu rascunho e recarregue a página antes de salvar.', true);
      return;
    }
    if (budgetStore.refresh()) {
      installSettings();
      content.querySelector('[data-v33-summary]')?.remove();
      renderExtras();
      status('Limites sincronizados de outra aba.');
    } else status('Arquivo de orçamento externo inválido. Gravação bloqueada.', true);
  });
  let queued = false;
  new MutationObserver(() => {
    if (queued) return;
    queued = true;
    queueMicrotask(() => { queued = false; renderExtras(); });
  }).observe(content, { childList: true });
  renderExtras();
  window.MeuDinheiroV33Interface = Object.freeze({ hasBudgetEditor: () => !!document.getElementById('design-v33-budget-form') });
})();
