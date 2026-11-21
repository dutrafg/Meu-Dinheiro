/* Camada visual e de navegação da homologação v32. Depende somente do HTML v31 e de domain.js. */
(function () {
  'use strict';
  const domain = window.MeuDinheiroDesignV32Domain;
  const storeKey = 'meu-dinheiro-essencial:v1';
  const content = document.getElementById('view-content');
  const desktopNav = document.getElementById('desktop-nav');
  const mobileNav = document.getElementById('mobile-nav');
  if (!domain || !content || !desktopNav || !mobileNav) return;

  const money = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
  const longDate = new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', timeZone: 'UTC' });
  const monthNames = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
  const glyph = (name) => `<svg aria-hidden="true"><use href="#i-${name}"></use></svg>`;
  const esc = (value) => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
  const fmt = (value) => money.format(Math.round((Number(value) || 0) * 100) / 100);
  const state = { filter: 'all', search: '', month: null, category: '', recurring: 'all' };

  function readData() {
    try {
      const data = JSON.parse(localStorage.getItem(storeKey) || '{}');
      return data && typeof data === 'object' ? data : {};
    } catch (_) {
      return {};
    }
  }

  function monthFromPage() {
    const label = content.querySelector('[data-calendar-open]')?.textContent?.trim().toLocaleLowerCase('pt-BR') || '';
    const found = monthNames.findIndex(name => label.includes(name));
    const year = label.match(/\b(20\d{2})\b/);
    if (found >= 0 && year) return `${year[1]}-${String(found + 1).padStart(2, '0')}`;
    return state.month || `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
  }

  function activeView() {
    return desktopNav.querySelector('.nav-button.active')?.dataset.view || 'resumo';
  }

  function setFriendlyLabels() {
    for (const nav of [desktopNav, mobileNav]) {
      const item = nav.querySelector('[data-view="renda"] span');
      if (item && item.textContent !== 'Movimentos') item.textContent = 'Movimentos';
      const objetivos = nav.querySelector('[data-view="metas"] span');
      if (objetivos && objetivos.textContent !== 'Objetivos') objetivos.textContent = 'Objetivos';
    }
    const label = document.getElementById('header-label');
    const view = activeView();
    const desired = view === 'renda' || view === 'despesas' ? 'Movimentos' : view === 'metas' ? 'Objetivos' : view === 'resumo' ? 'Visão geral' : null;
    if (desired && label && label.textContent !== desired) label.textContent = desired;
    const activeGoal = view === 'metas';
    for(const navigation of [mobileNav,desktopNav]){
      const goalButton = navigation.querySelector('[data-view="metas"]');
      if(goalButton){goalButton.classList.toggle('active',activeGoal);goalButton.setAttribute('aria-current',activeGoal?'page':'false');}
    }
    const mobileMove = mobileNav.querySelector('[data-view="renda"]');
    if (mobileMove) mobileMove.classList.toggle('active', view === 'renda' || view === 'despesas');
    const mobileMore = document.getElementById('design-more-trigger');
    if (mobileMore) mobileMore.classList.toggle('active', view === 'ajustes');
  }

  function setupNav() {
    document.getElementById('desktop-toolbar').classList.add('design-sidebar');
    const brand = document.createElement('div');
    brand.className = 'design-brand';
    brand.innerHTML = '<span class="design-brand-symbol">M</span><span><strong>Meu Dinheiro</strong><small>Essencial · prévia de design</small></span>';
    desktopNav.before(brand);
    const more = document.createElement('button');
    more.id = 'design-more-trigger';
    more.className = 'nav-button design-more-button';
    more.type = 'button';
    more.setAttribute('aria-label', 'Abrir mais opções');
    more.setAttribute('aria-haspopup', 'dialog');
    more.innerHTML = `${glyph('ellipsis')}<span>Mais</span>`;
    mobileNav.appendChild(more);

    const dialog = document.createElement('dialog');
    dialog.id = 'design-more-dialog';
    dialog.className = 'form-dialog design-more-dialog';
    dialog.setAttribute('aria-labelledby', 'design-more-title');
    dialog.innerHTML = `<div class="dialog-heading"><div><span class="eyebrow">PREFERÊNCIAS E FERRAMENTAS</span><h2 id="design-more-title">Mais opções</h2></div><button type="button" class="icon-button" data-design-close aria-label="Fechar">${glyph('close')}</button></div>
      <div class="design-more-list"><button type="button" data-design-open="settings">${glyph('settings')} Ajustes</button></div>`;
    document.body.appendChild(dialog);
    document.getElementById('design-more-trigger').addEventListener('click', () => dialog.showModal());
    dialog.addEventListener('click', event => { if (event.target === dialog) dialog.close(); });
  }

  function routeTo(view) {
    const button = desktopNav.querySelector(`[data-view="${view}"]`);
    if (button) button.click();
  }

  function handleAccess(action) {
    document.getElementById('design-more-dialog')?.close();
    if (action === 'settings') return routeTo('ajustes');
    if (action === 'calendar') {
      if (!content.querySelector('[data-calendar-open]')) routeTo('resumo');
      content.querySelector('[data-calendar-open]')?.click();
      return;
    }
    if (action === 'reports' || action === 'diagnostics') {
      routeTo('ajustes');
      if (action === 'reports') {
        const tools = document.querySelector('#settings-page details.settings-tools');
        if (tools) {
          tools.open = true;
          tools.scrollIntoView({ block: 'start', behavior: 'smooth' });
        }
      } else document.getElementById('open-diagnostics')?.click();
    }
  }

  function entryRow(item) {
    const income = item.type === 'income';
    const symbol = income ? 'wallet' : 'receipt';
    const sign = income ? '+' : '−';
    return `<article class="design-entry">
      <span class="design-entry-icon ${income ? 'is-income' : 'is-expense'}">${glyph(symbol)}</span>
      <div class="design-entry-text"><strong>${esc(item.description || 'Sem descrição')}</strong><small>${esc(item.category || 'Outros')}${item.recurring ? ' · Recorrente' : ''}</small></div>
      <strong class="design-entry-amount ${income ? 'is-income' : 'is-expense'}">${sign}${fmt(item.amount)}</strong>
      <button type="button" class="design-icon-action" data-action="edit" data-id="${esc(item.id)}" aria-label="Editar ${esc(item.description)}">${glyph('edit')}</button>
      <button type="button" class="design-icon-action" data-action="delete" data-id="${esc(item.id)}" aria-label="Excluir ${esc(item.description)}">${glyph('trash')}</button>
    </article>`;
  }

  function renderGroups(entries) {
    const chosen = entries.filter(item=>(!state.category||item.category===state.category)&&
      (state.recurring==='all'||(state.recurring==='yes'?!!item.recurring:!item.recurring)));
    const groups = domain.groupedEntries(chosen, state.filter, state.search);
    if (!groups.length) return '<div class="design-empty">Nenhum lançamento encontrado. Toque em <strong>+</strong> para adicionar ou ajuste os filtros.</div>';
    return groups.map(group => `<section class="design-day-group"><div class="design-day-heading"><h3>${esc(longDate.format(new Date(`${group.date}T12:00:00Z`)))}</h3><span>${group.income ? `<b class="is-income">+${fmt(group.income)}</b>` : ''}${group.expense ? `<b class="is-expense">−${fmt(group.expense)}</b>` : ''}</span></div>${group.entries.map(entryRow).join('')}</section>`).join('');
  }

  function decorateMovements() {
    if (content.querySelector('[data-v32-view="movements"]')) return;
    const originalMonth = content.querySelector('.proto-page-meta')?.outerHTML || '';
    const month = monthFromPage();
    state.month = month;
    const entries = domain.monthlyEntries(readData().transactions, month);
    const categories = [...new Set(entries.map(item=>item.category).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'pt-BR'));
    const sums = domain.summary(entries, `${month}-31`);
    content.innerHTML = `<div class="design-movements" data-v32-view="movements">
      <div class="design-section-top"><div><span class="design-kicker">SEU EXTRATO</span><h2>Movimentos</h2><p>Receitas e despesas reunidas, por dia</p></div>${originalMonth}</div>
      <div class="design-movement-totals"><div class="design-metric is-income"><small>Entradas do mês</small><strong>${fmt(sums.income)}</strong></div><div class="design-metric is-expense"><small>Saídas do mês</small><strong>${fmt(sums.expense)}</strong></div><div class="design-metric"><small>Resultado do mês</small><strong>${fmt(sums.income - sums.expense)}</strong></div></div>
      <div class="design-filters"><label class="design-search"><span class="design-visually-hidden">Buscar lançamento</span><input id="design-movement-search" type="search" placeholder="Buscar lançamentos" value="${esc(state.search)}" autocomplete="off"></label><div class="design-segments" role="group" aria-label="Filtrar movimentos"><button type="button" data-design-filter="all">Todos</button><button type="button" data-design-filter="income">Renda</button><button type="button" data-design-filter="expense">Despesas</button></div><div class="design-secondary-filters"><label><span class="design-visually-hidden">Filtrar categoria</span><select id="design-movement-category" aria-label="Categoria"><option value="">Todas as categorias</option>${categories.map(category=>`<option value="${esc(category)}" ${category===state.category?'selected':''}>${esc(category)}</option>`).join('')}</select></label><label><span class="design-visually-hidden">Filtrar recorrência</span><select id="design-movement-recurring" aria-label="Recorrência"><option value="all" ${state.recurring==='all'?'selected':''}>Recorrentes e avulsos</option><option value="yes" ${state.recurring==='yes'?'selected':''}>Só recorrentes</option><option value="no" ${state.recurring==='no'?'selected':''}>Só avulsos</option></select></label></div></div>
      <div id="design-movement-list" class="design-movement-list"></div>
      <p class="design-disclaimer">Lançamentos recorrentes seguem a regra mensal já cadastrada. Totais correspondem ao mês selecionado.</p>
    </div>`;
    refreshMovementList(entries);
  }

  function refreshMovementList(providedEntries) {
    const entries = providedEntries || domain.monthlyEntries(readData().transactions, state.month || monthFromPage());
    const list = document.getElementById('design-movement-list');
    if (list) list.innerHTML = renderGroups(entries);
    content.querySelectorAll('[data-design-filter]').forEach(button => {
      const selected = button.dataset.designFilter === state.filter;
      button.classList.toggle('selected', selected);
      button.setAttribute('aria-pressed', String(selected));
    });
  }

  function decorateGoals() {
    if (content.querySelector('[data-v32-goal-tabs]')) return;
    const kind = document.body.dataset.objectiveKind === 'dream' ? 'dream' : 'goal';
    const tabs = document.createElement('div');
    tabs.className = 'design-goal-tabs';
    tabs.dataset.v32GoalTabs = '';
    tabs.innerHTML = `<div><span class="design-kicker">PLANOS E OBJETIVOS</span><h2>Meus objetivos</h2></div><div class="design-segments" role="group" aria-label="Selecionar tipo de objetivo"><button type="button" data-objective-tab="goal" class="${kind === 'goal' ? 'selected' : ''}" aria-pressed="${kind === 'goal'}">Metas</button><button type="button" data-objective-tab="dream" class="${kind === 'dream' ? 'selected' : ''}" aria-pressed="${kind === 'dream'}">Sonhos</button></div>`;
    content.prepend(tabs);
  }

  function decorateSummary() {
    if (content.querySelector('[data-v32-summary]')) return;
    const month = monthFromPage();
    state.month = month;
    const entries = domain.monthlyEntries(readData().transactions, month);
    const localToday = new Date();
    const today = `${localToday.getFullYear()}-${String(localToday.getMonth() + 1).padStart(2, '0')}-${String(localToday.getDate()).padStart(2, '0')}`;
    const stats = domain.summary(entries, today);
    const future = entries.filter(item => item.occurrence > today).sort((a, b) => a.occurrence.localeCompare(b.occurrence));
    const category = stats.categories[0];
    const intro = document.createElement('section');
    intro.className = 'design-summary-hero';
    intro.dataset.v32Summary = '';
    intro.innerHTML = `<div><span class="design-kicker">PANORAMA FINANCEIRO</span><h2>Seu dinheiro, com clareza.</h2><p>O essencial do mês, sem perder os detalhes.</p></div><span class="design-preview-pill">Prévia de design</span>`;
    const cards = document.createElement('section');
    cards.className = 'design-insights';
    cards.innerHTML = `<article class="card design-insight-card"><div class="design-insight-heading">${glyph('calendar')}<span>Próximos lançamentos cadastrados</span></div>
      ${future.length ? `<strong>${future.length} ${future.length === 1 ? 'lançamento' : 'lançamentos'} a vencer</strong><p>Entradas futuras: <b class="is-income">${fmt(stats.futureIncome)}</b> · Saídas futuras: <b class="is-expense">${fmt(stats.futureExpense)}</b></p><small>Valores já registrados, sem previsão automática de receitas.</small>` : '<strong>Sem lançamentos futuros neste mês</strong><p>Adicione datas futuras para acompanhar seus compromissos.</p>'}</article>
      <article class="card design-insight-card"><div class="design-insight-heading">${glyph('chart')}<span>Categoria de maior gasto</span></div>
      ${category ? `<strong>${esc(category.name)}</strong><p>${fmt(category.amount)} · ${stats.expense ? Math.round(category.amount / stats.expense * 100) : 0}% das despesas registradas</p><div class="design-progress"><span style="width:${stats.expense ? Math.min(100, category.amount / stats.expense * 100) : 0}%"></span></div>` : '<strong>Nenhuma despesa no mês</strong><p>As categorias aparecem assim que houver registros.</p>'}</article>`;
    content.prepend(intro);
    const overview = content.querySelector('.proto-overview');
    if (overview) overview.after(cards); else intro.after(cards);
  }

  let scheduled = false;
  function decorate() {
    setFriendlyLabels();
    const view = activeView();
    if (view === 'renda' || view === 'despesas') decorateMovements();
    else if (view === 'metas') decorateGoals();
    else if (view === 'resumo') decorateSummary();
  }
  function scheduleDecorate() {
    if (scheduled) return;
    scheduled = true;
    queueMicrotask(() => { scheduled = false; decorate(); });
  }

  setupNav();
  document.addEventListener('click', event => {
    if (event.target.closest('[data-design-close]')) document.getElementById('design-more-dialog')?.close();
    const access = event.target.closest('[data-design-open]');
    if (access) handleAccess(access.dataset.designOpen);
    const filter = event.target.closest('[data-design-filter]');
    if (filter) {
      state.filter = filter.dataset.designFilter;
      refreshMovementList();
    }
  });
  document.addEventListener('input', event => {
    if (event.target.id === 'design-movement-search') {
      state.search = event.target.value;
      refreshMovementList();
    }
  });
  document.addEventListener('change', event => {
    if (event.target.id === 'design-movement-category') {
      state.category = event.target.value;
      refreshMovementList();
    }
    if (event.target.id === 'design-movement-recurring') {
      state.recurring = event.target.value;
      refreshMovementList();
    }
  });
  content.addEventListener('click', event => {
    if (event.target.closest('[data-month]')) {
      state.search = '';
      state.filter = 'all';
      state.category = '';
      state.recurring = 'all';
      state.month = null;
    }
  }, true);
  new MutationObserver(scheduleDecorate).observe(content, { childList: true });
  new MutationObserver(scheduleDecorate).observe(document.getElementById('header-label'), { childList: true });
  decorate();
})();
