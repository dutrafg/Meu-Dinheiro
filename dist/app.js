(() => {
  'use strict';
  const KEY = 'meu-dinheiro-essencial:v1';
  const CDI_KEY = 'meu-dinheiro-essencial:cdi-oficial';
  const CATEGORIES = {
    income: ['Salário base', 'Personal', 'Salário', 'Renda extra', 'Vendas', 'Benefícios', 'Outros'],
    expense: ['Moradia', 'Alimentação', 'Contas', 'Internet', 'Telefone', 'Cartão de crédito', 'Faculdade', 'Farmácia', 'Cursos', 'Transporte', 'Saúde', 'Educação', 'Lazer', 'Compras', 'Outros']
  };
  const NAV = [
    ['resumo', 'Resumo', 'chart-pie'], ['renda', 'Renda', 'wallet'], ['despesas', 'Despesas', 'receipt'],
    ['metas', 'Metas', 'target'], ['sonho', 'Sonho', 'sparkles']
  ];
  // Ícones e categorias adaptados do protótipo Finanças-2.html.
  const CATEGORY_ICONS = {
    'Salário':'💼', 'Salário base':'💼', 'Personal':'🏋️', 'Renda extra':'💻', 'Vendas':'🛍️', 'Benefícios':'🎁',
    'Moradia':'🏠', 'Alimentação':'🍔', 'Contas':'🧾', 'Internet':'🌐', 'Telefone':'📱', 'Cartão de crédito':'💳',
    'Faculdade':'🎓', 'Farmácia':'💊', 'Cursos':'📚', 'Transporte':'🚗',
    'Saúde':'🩺', 'Educação':'📖', 'Lazer':'🎉', 'Compras':'🛍️', 'Outros':'📦'
  };
  const EXPENSE_COLORS = {
    'Outros':'#8998a9', 'Moradia':'#6b86a9', 'Alimentação':'#e5a270', 'Contas':'#7b9eac',
    'Internet':'#61a9d1', 'Telefone':'#77bfd7', 'Cartão de crédito':'#91a5c0',
    'Faculdade':'#568fbe', 'Farmácia':'#77b89f', 'Cursos':'#9a8cc8',
    'Transporte':'#e5ba78', 'Saúde':'#ca8eaa', 'Educação':'#9bb66d',
    'Lazer':'#ab92c9', 'Compras':'#cf9a80'
  };
  const fmt = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
  const fmtMonth = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric', timeZone: 'UTC' });
  const fmtShort = new Intl.DateTimeFormat('pt-BR', { month: 'short', timeZone: 'UTC' });
  const fmtDate = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' });
  const today = new Date();
  const currentMonth = [today.getFullYear(), String(today.getMonth() + 1).padStart(2, '0')].join('-');
  let data = readData();
  let view = 'resumo';
  let month = currentMonth;
  let search = '';
  let filterCategory = '';
  let pendingCsv = null;
  let pendingAllocations = null;
  let csvSelections = new Map();
  let csvAnalysis = null;
  let toastTimer;
  let folderBackup = null;
  let cdiQuote = readCdiCache();
  const main = document.getElementById('main-content');
  const transactionDialog = document.getElementById('transaction-dialog');
  const transactionForm = document.getElementById('transaction-form');
  const goalDialog = document.getElementById('goal-dialog');
  const goalForm = document.getElementById('goal-form');
  const reminderDialog = document.getElementById('reminder-dialog');

  function readData() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return { transactions: [], goals: [], allocations: [], completedAportes: [] };
      const saved = JSON.parse(raw);
      if (!saved || !Array.isArray(saved.transactions) || !Array.isArray(saved.goals)) throw new Error('Formato inválido');
      if(!Array.isArray(saved.allocations))saved.allocations=[];
      if(!Array.isArray(saved.completedAportes))saved.completedAportes=[];
      return saved;
    } catch (error) {
      console.error('Não foi possível ler os dados locais:', error);
      alert('Não foi possível ler os dados salvos neste navegador. Nenhum dado antigo será apagado automaticamente.');
      return { transactions: [], goals: [], allocations: [], completedAportes: [] };
    }
  }
  function persist(next) {
    try {
      localStorage.setItem(KEY, JSON.stringify(next));
      data = next;
      folderBackup?.schedule();
      return true;
    } catch (error) {
      console.error('Falha ao salvar:', error);
      alert('Não foi possível salvar. Verifique o espaço disponível e as permissões do navegador.');
      return false;
    }
  }
  function icon(name) { return `<svg aria-hidden="true"><use href="#i-${name}"></use></svg>`; }
  function esc(value) { return String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]); }
  function money(n) { return fmt.format(Math.round((Number(n) || 0) * 100) / 100); }
  function n2(n) { return Math.round((Number(n) + Number.EPSILON) * 100) / 100; }
  function readCdiCache() {
    try {
      const quote=JSON.parse(localStorage.getItem(CDI_KEY));
      if(quote&&Number.isFinite(quote.dailyPercent)&&quote.dailyPercent>0&&quote.dailyPercent<1&&/^\d{4}-\d{2}-\d{2}$/.test(quote.date)&&Number.isFinite(quote.checkedAt))return quote;
    } catch (_) { /* Consulta opcional: não interfere nos lançamentos. */ }
    return null;
  }
  function validCdiQuote() {
    if(!cdiQuote)return null;
    const observed=new Date(`${cdiQuote.date}T12:00:00Z`).getTime();
    return Number.isFinite(observed)&&Date.now()-observed<14*86400000&&observed<Date.now()+86400000?cdiQuote:null;
  }
  async function refreshCdiSilently() {
    if(cdiQuote&&Date.now()-cdiQuote.checkedAt<24*3600000)return;
    const controller=new AbortController();
    const timeout=setTimeout(()=>controller.abort(),8000);
    try {
      // Série SGS 12: CDI diário em percentual, divulgado pelo Banco Central.
      const response=await fetch('https://api.bcb.gov.br/dados/serie/bcdata.sgs.12/dados/ultimos/10?formato=json',{signal:controller.signal,cache:'no-store'});
      if(!response.ok)throw Error('CDI indisponível');
      const quotes=await response.json();
      if(!Array.isArray(quotes)||!quotes.length)throw Error('Resposta CDI inválida');
      const latest=quotes[quotes.length-1];
      const match=/^(\d{2})\/(\d{2})\/(\d{4})$/.exec(latest.data);
      const dailyPercent=Number(String(latest.valor).replace(',','.'));
      if(!match||!Number.isFinite(dailyPercent)||dailyPercent<=0||dailyPercent>=1)throw Error('Taxa CDI inválida');
      const date=`${match[3]}-${match[2]}-${match[1]}`;
      const quote={dailyPercent,date,checkedAt:Date.now()};
      cdiQuote=quote;
      try{localStorage.setItem(CDI_KEY,JSON.stringify(quote));}catch(_){/* Sem cache. */}
      if(view==='metas')render();
    } catch (_) { /* Estimativa fica oculta se o dado oficial não chegar. */ }
    finally {clearTimeout(timeout);}
  }
  function isoDate(d) { return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; }
  function parseDate(s) { return new Date(`${s}T12:00:00Z`); }
  function shiftMonth(ym, diff) { const [y,m] = ym.split('-').map(Number); const d = new Date(Date.UTC(y,m-1+diff,1)); return `${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,'0')}`; }
  function monthLabel(ym) { return fmtMonth.format(parseDate(`${ym}-01`)); }
  function shortMonth(ym) { return fmtShort.format(parseDate(`${ym}-01`)).replace('.', ''); }
  function categorySet(type) { return CATEGORIES[type] || []; }
  function uniqueId() { return (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`; }
  function notify(message) { const toast = document.getElementById('toast'); toast.textContent = message; toast.classList.add('show'); clearTimeout(toastTimer); toastTimer = setTimeout(() => toast.classList.remove('show'), 2700); }
  function occurrenceDate(t, ym) {
    if (!t.recurring) return t.date.slice(0, 7) === ym ? t.date : null;
    if (t.date.slice(0, 7) > ym) return null;
    const day = Number(t.date.slice(8, 10));
    const [y,m] = ym.split('-').map(Number);
    const lastDay = new Date(Date.UTC(y,m,0)).getUTCDate();
    return `${ym}-${String(Math.min(day,lastDay)).padStart(2,'0')}`;
  }
  function transactionsInMonth(ym, type) {
    return data.transactions.filter(t => (!type || t.type === type) && occurrenceDate(t,ym))
      .map(t => ({ ...t, occurrence: occurrenceDate(t,ym) }))
      .sort((a,b) => b.occurrence.localeCompare(a.occurrence) || b.createdAt.localeCompare(a.createdAt));
  }
  function sums(ym) {
    const list = transactionsInMonth(ym);
    const income = n2(list.filter(t=>t.type==='income').reduce((sum,t)=>sum+t.amount,0));
    const expense = n2(list.filter(t=>t.type==='expense').reduce((sum,t)=>sum+t.amount,0));
    return { income, expense, balance:n2(income-expense), count:list.length };
  }
  function savingPlan(ym) {
    const income=transactionsInMonth(ym,'income');
    const base=n2(income.filter(t=>['Salário base','Salário'].includes(t.category)).reduce((s,t)=>s+t.amount,0));
    const personal=n2(income.filter(t=>t.category==='Personal').reduce((s,t)=>s+t.amount,0));
    const baseTen=n2(base*0.1),personalTen=n2(personal*0.1);
    return {base,personal,baseTen,personalTen,total:n2(baseTen+personalTen)};
  }
  function reservePrincipal() {
    const fromGoals=data.goals.filter(g=>g.kind==='goal'&&/reserva|emerg[eê]ncia/i.test(g.name)).reduce((sum,g)=>sum+g.saved,0);
    const unlinked=(data.allocations||[]).filter(a=>a.kind==='reserve'&&!data.goals.some(g=>g.id===a.goalId)).reduce((sum,a)=>sum+a.amount,0);
    return Math.max(0,n2(fromGoals+unlinked));
  }
  function reserveYieldEstimate() {
    const quote=validCdiQuote(),principal=reservePrincipal();
    if(!quote||!principal)return '';
    // Projeção ilustrativa de 21 dias úteis a 100% do CDI, antes de IR/IOF e taxas.
    const estimated=n2(principal*(Math.pow(1+quote.dailyPercent/100,21)-1));
    return `<p class="proto-cdi-estimate">CDB a 100% do CDI · rendimento bruto estimado em 21 dias úteis: <strong>${money(estimated)}</strong><small>Simulação sobre ${money(principal)}. Não é rendimento confirmado; sem impostos ou taxas.</small></p>`;
  }
  function dueAportes() {
    const todayText=isoDate(new Date());
    const threshold=shiftMonth(todayText.slice(0,7),-5)+'-01';
    const done=new Set(data.completedAportes||[]);
    const items=[];
    for(const t of data.transactions){
      if(t.type!=='income')continue;
      const months=t.recurring?Array.from({length:6},(_,i)=>shiftMonth(todayText.slice(0,7),i-5)):[t.date.slice(0,7)];
      for(const ym of months){
        const date=occurrenceDate(t,ym);
        if(!date||date>todayText||date<threshold)continue;
        const key=`${t.id}@${date}`;
        if(done.has(key))continue;
        const tenPercent=['Salário base','Salário','Personal'].includes(t.category)?n2(t.amount*.1):null;
        items.push({key,date,description:t.description,category:t.category,tenPercent});
      }
    }
    return items.sort((a,b)=>b.date.localeCompare(a.date)).slice(0,100);
  }
  function renderReminderCount() {
    const count=dueAportes().length;
    const badge=document.getElementById('reminder-count');
    badge.classList.toggle('hidden',count===0);
    badge.textContent=count>99?'99+':String(count);
    document.getElementById('reminder-button').setAttribute('aria-label',count?`${count} ${count===1?'lembrete de aporte pendente':'lembretes de aporte pendentes'}`:'Lembretes de aporte, nenhum pendente');
  }
  function renderReminderDialog() {
    const reminders=dueAportes();
    document.getElementById('reminder-list').innerHTML=reminders.length?reminders.map(a=>`<div class="proto-reminder-item"><div><strong>${esc(a.description)}</strong><small>${esc(a.category)} · ${fmtDate.format(parseDate(a.date))}</small><p>${a.tenPercent===null?'Lembre-se de verificar se fará um aporte com esta entrada.':`Separe <b>${money(a.tenPercent)}</b> (10% desta renda) para sua reserva.`}</p></div><button type="button" class="button button-secondary" data-action="mark-aporte" data-id="${esc(a.key)}">Já fiz</button></div>`).join(''):`<div class="proto-empty">Tudo em dia! Seus novos recebimentos aparecerão aqui. ✓</div>`;
  }
  function changeView(next) {
    view = next; search=''; filterCategory='';
    document.querySelectorAll('.nav-button').forEach(el => { const active = el.dataset.view === view; el.classList.toggle('active',active); el.setAttribute('aria-current',active?'page':'false'); });
    render(); window.scrollTo({top:0,behavior:'instant'});
  }
  function renderNav() {
    for (const id of ['desktop-nav','mobile-nav']) {
      document.getElementById(id).innerHTML = NAV.map(([key,title,symbol]) => `<button class="nav-button ${key===view?'active':''}" type="button" data-view="${key}" aria-current="${key===view?'page':'false'}">${icon(symbol)}<span>${title}</span></button>`).join('');
    }
  }
  function header(title, subtitle, button, monthPicker=false) {
    return `<div class="proto-page-meta">${monthPicker?monthControl():`<p>${esc(subtitle)}</p>`}</div>`;
  }
  function monthControl() { return `<div class="month-control" aria-label="Mês selecionado"><button type="button" data-month="-1" aria-label="Mês anterior">${icon('chevron-left')}</button><span style="text-transform:none">${esc(monthLabel(month))}</span><button type="button" data-month="1" aria-label="Próximo mês">${icon('chevron-right')}</button></div>`; }
  function actionButton(title, action, type) { return `<button type="button" class="button button-primary" data-action="${action}"${type?` data-type="${type}"`:''}>${icon('plus')}${title}</button>`; }
  function empty(text, symbol='wallet') { return `<div class="empty-state">${icon(symbol)}<p>${esc(text)}</p></div>`; }
  function stat(title, val, symbol, extra, color='') { return `<div class="stat-card"><div class="stat-top"><span class="stat-icon ${color}">${icon(symbol)}</span>${title}</div><div class="stat-value">${money(val)}</div><div class="stat-sub">${extra}</div></div>`; }
  function render() {
    renderReminderCount();
    document.getElementById('header-label').textContent=NAV.find(v=>v[0]===view)?.[1]||'Resumo';
    document.getElementById('header-balance').textContent=money(sums(month).balance);
    document.getElementById('quick-add').setAttribute('aria-label',view==='metas'?'Criar meta':view==='sonho'?'Criar sonho':'Adicionar lançamento');
    if (view === 'resumo') main.innerHTML = renderSummary();
    else if (view === 'renda' || view === 'despesas') main.innerHTML = renderTransactions(view==='renda'?'income':'expense');
    else main.innerHTML = renderGoals(view==='metas'?'goal':'dream');
  }
  function renderChart() {
    const months = Array.from({length:6}, (_,i)=>shiftMonth(month,i-5));
    const values = months.map(ym=>sums(ym));
    const max = Math.max(...values.flatMap(v=>[v.income,v.expense]),1);
    return `<div class="chart-legend"><span><i class="legend-dot" style="background:#4385f0"></i>Renda</span><span><i class="legend-dot" style="background:#eaa2a8"></i>Despesas</span></div>
      <div class="bar-chart" role="img" aria-label="Comparação dos últimos seis meses: ${months.map((ym,i)=>`${monthLabel(ym)}, renda ${money(values[i].income)}, despesas ${money(values[i].expense)}`).join('; ')}">
      ${values.map((v,i)=>`<div class="chart-group" title="${esc(monthLabel(months[i]))}: renda ${money(v.income)} / despesas ${money(v.expense)}"><div class="bar income" style="height:${v.income>0?Math.max(3,(v.income/max)*100):0}%"></div><div class="bar expense" style="height:${v.expense>0?Math.max(3,(v.expense/max)*100):0}%"></div></div>`).join('')}</div>
      <div class="chart-labels">${months.map(ym=>`<span>${esc(shortMonth(ym))}</span>`).join('')}</div>`;
  }
  function renderExpenseCharts() {
    const months=Array.from({length:7},(_,i)=>shiftMonth(currentMonth,i-6));
    const todayText=isoDate(new Date());
    const input=months.map(ym=>({
      month:ym,
      entries:transactionsInMonth(ym,'expense')
        .filter(t=>ym!==currentMonth||t.occurrence<=todayText)
        .map(t=>({category:t.category,amount:t.amount}))
    }));
    const stats=window.MeuDinheiroAnalytics.expenseCategoryStats(input);
    const color=category=>EXPENSE_COLORS[category]||'#a6aeb9';
    const circumference=2*Math.PI*42;
    let covered=0;
    const slices=stats.current.map(item=>{
      const part=item.amount/stats.currentTotal;
      const length=circumference*part;
      const markup=`<circle cx="60" cy="60" r="42" fill="none" stroke="${color(item.category)}" stroke-width="15" stroke-dasharray="${length} ${Math.max(0,circumference-length)}" stroke-dashoffset="${-covered}" transform="rotate(-90 60 60)"/>`;
      covered+=length;
      return markup;
    }).join('');
    const maxAverage=stats.averages[0]?.average||1;
    return `<div class="card proto-expense-charts" role="group" aria-label="Análise de despesas por categoria">
      <section class="proto-expense-chart-panel" aria-label="Gráfico de gastos do mês por categoria">
        <h3>Gastos por categoria</h3><p class="proto-chart-subtitle">${esc(monthLabel(currentMonth))} · mês em andamento</p>
        ${stats.current.length?`<svg class="proto-expense-donut" viewBox="0 0 120 120" role="img" aria-label="Total ${money(stats.currentTotal)}. ${stats.current.map(t=>`${t.category}: ${money(t.amount)}`).join('; ')}">
          <circle cx="60" cy="60" r="42" fill="none" stroke="var(--border)" stroke-width="15"/>${slices}
          <text x="60" y="54" text-anchor="middle" font-size="8.1" fill="var(--sub)">Total de gastos</text>
          <text x="60" y="68" text-anchor="middle" font-size="${money(stats.currentTotal).length>15?7:money(stats.currentTotal).length>12?8.4:10}" font-weight="760" fill="var(--text)">${money(stats.currentTotal)}</text>
        </svg><div class="proto-category-legend">${stats.current.map(item=>`<div class="proto-category-legend-item"><span class="proto-category-color" style="background:${color(item.category)}"></span><span>${esc(item.category)}</span><strong>${money(item.amount)}</strong></div>`).join('')}</div>`:
        `<div class="proto-empty">Nenhuma despesa registrada até agora neste mês.</div>`}
      </section>
      <div class="proto-expense-divider" aria-hidden="true"></div>
      <section class="proto-expense-chart-panel" aria-label="Gráfico de média por categoria nos últimos sete meses">
        <h3>Média por categoria</h3><p class="proto-chart-subtitle">Mês atual (parcial) e até 6 anteriores. Média apenas dos meses com gastos.</p>
        ${stats.averages.length?`<div class="proto-average-list">${stats.averages.map(item=>`<div class="proto-average-item"><div class="proto-average-top"><span><i class="proto-category-color" style="background:${color(item.category)}"></i>${esc(item.category)}</span><strong>${money(item.average)}</strong></div><div class="proto-average-track" role="img" aria-label="Média de ${esc(item.category)}: ${money(item.average)} em ${item.recordedMonths} ${item.recordedMonths===1?'mês':'meses'} com registro"><div style="width:${Math.max(2,(item.average/maxAverage)*100)}%;background:${color(item.category)}"></div></div><small>${item.recordedMonths} ${item.recordedMonths===1?'mês com registro':'meses com registros'}</small></div>`).join('')}</div>`:
        `<div class="proto-empty">Ainda não há despesas nesse período para calcular as médias.</div>`}
      </section>
    </div>`;
  }
  function categoryTotals() {
    const cat = new Map();
    for (const t of transactionsInMonth(month,'expense')) cat.set(t.category,n2((cat.get(t.category)||0)+t.amount));
    return [...cat.entries()].sort((a,b)=>b[1]-a[1]);
  }
  // Gráfico SVG adaptado da função donut() do protótipo fornecido.
  function donut(income,expense) {
    const total=income+expense||1;
    const incomeShare=income/total;
    const circ=2*Math.PI*45;
    return `<svg viewBox="0 0 120 120" class="proto-donut-svg" role="img" aria-label="Renda ${money(income)}, despesas ${money(expense)}, saldo ${money(income-expense)}">
      <circle cx="60" cy="60" r="45" fill="none" stroke="${income+expense>0?'var(--red)':'var(--border)'}" stroke-width="14"/>
      <circle cx="60" cy="60" r="45" fill="none" stroke="var(--green)" stroke-width="14" stroke-dasharray="${circ*incomeShare} ${circ}" transform="rotate(-90 60 60)"/>
      <text x="60" y="56" text-anchor="middle" font-size="10.5" fill="var(--sub)">Saldo do mês</text>
      <text x="60" y="73" text-anchor="middle" font-size="12.5" font-weight="750" fill="var(--text)">${money(income-expense)}</text>
    </svg>`;
  }
  function entryList(items,emptyText) {
    return items.length?items.map(renderEntry).join(''):`<div class="proto-empty">${esc(emptyText)}</div>`;
  }
  function goalProgressPercent(goal) {
    const target=Number(goal.target),saved=Number(goal.saved);
    return target>0&&Number.isFinite(target)&&Number.isFinite(saved)?Math.min(100,Math.max(0,Math.round(saved/target*100))):0;
  }
  function progressLine(goal) {
    const pct=goalProgressPercent(goal);
    const isDream=goal.kind==='dream';
    return `<div class="proto-progress"><div class="proto-progress-top"><span>${isDream?'✨':'🛡️'} ${esc(goal.name)}</span><strong>${pct}%</strong></div><div class="bar"><div style="width:${pct}%;background:${isDream?'var(--purple)':'var(--blue)'}"></div></div><small>${money(goal.saved)} de ${money(goal.target)}</small></div>`;
  }
  function renderSummary() {
    const s=sums(month);
    const goals=[data.goals.find(g=>g.kind==='goal'&&/reserva/i.test(g.name)),data.goals.find(g=>g.kind==='dream')].filter(Boolean);
    if(!goals.some(g=>g.kind==='goal')) {const another=data.goals.find(g=>g.kind==='goal');if(another)goals.unshift(another);}
    const recent=transactionsInMonth(month).slice(0,5);
    const hasHistory=Array.from({length:6},(_,i)=>sums(shiftMonth(month,i-5)).count).some(Boolean);
    return `${header('Resumo','Seu dinheiro em um só lugar.','',true)}
      <div class="proto-overview">
        <section class="card proto-donut-card"><h3>Visão financeira</h3>${donut(s.income,s.expense)}<div class="proto-donut-legend"><span><i style="background:var(--green)"></i>Renda</span><span><i style="background:var(--red)"></i>Despesas</span></div></section>
        <div class="proto-overview-secondary">
          <div class="grid2"><div class="minicard bg-green"><div class="lbl">Renda</div><div class="val">${money(s.income)}</div></div><div class="minicard bg-red"><div class="lbl">Despesas</div><div class="val">${money(s.expense)}</div></div></div>
          <section class="card proto-progress-card"><h3>Reserva e sonho</h3>${goals.length?goals.map(progressLine).join(''):`<div class="proto-empty">Suas metas e sonhos aparecerão aqui.</div>`}</section>
        </div>
      </div>
      <section class="card proto-list-card"><h3>Últimas transações</h3>${entryList(recent,'Nenhuma transação neste mês.')}</section>
      ${renderExpenseCharts()}
      ${hasHistory?`<details class="card proto-history"><summary>Comparar os últimos 6 meses</summary>${renderChart()}</details>`:''}
      <p class="proto-note">Valores guardados são acompanhados separadamente e não são descontados novamente do saldo.</p>`;
  }
  function renderTransactions(type) {
    const isIncome=type==='income';
    const title=isIncome?'Renda':'Despesas';
    const all=transactionsInMonth(month,type);
    const normalized=search.toLocaleLowerCase('pt-BR');
    const list=all.filter(t=>(!filterCategory||t.category===filterCategory)&&(!normalized||`${t.description} ${t.category}`.toLocaleLowerCase('pt-BR').includes(normalized)));
    const total=n2(all.reduce((sum,t)=>sum+t.amount,0));
    const categories=categorySet(type);
    return `${header(title,'',null,true)}
      <section class="card proto-total-card"><div class="proto-total-heading">${isIncome?'💵':'🧾'} ${isIncome?'Renda do mês':'Despesas do mês'}</div><div class="proto-big-total" style="color:${isIncome?'var(--green)':'var(--red)'}">${money(total)}</div></section>
      ${all.length?`<div class="filter-panel"><input class="search-field" id="transaction-search" type="search" value="${esc(search)}" placeholder="Buscar lançamento" aria-label="Buscar lançamento"/><select id="transaction-category" aria-label="Filtrar categoria"><option value="">Todas as categorias</option>${categories.map(c=>`<option value="${esc(c)}" ${filterCategory===c?'selected':''}>${esc(c)}</option>`).join('')}</select></div>`:''}
      <section class="card proto-list-card"><h3>${isIncome?'Fontes de renda':'Transações recentes'}</h3>${entryList(list,all.length?'Nenhum resultado para esse filtro.':isIncome?'Adicione sua primeira renda pelo botão +.':'Adicione sua primeira despesa pelo botão +.')}</section>
      ${all.some(t=>t.recurring)?'<p class="section-note">↻ Itens recorrentes aparecem automaticamente nos meses seguintes.</p>':''}`;
  }
  function renderEntry(t) {
    const isIncome=t.type==='income';
    return `<div class="proto-item"><span class="proto-category-icon" aria-hidden="true">${CATEGORY_ICONS[t.category]||'💰'}</span><div class="proto-item-label"><strong>${esc(t.description)}</strong><small>${esc(t.category)} · ${fmtDate.format(parseDate(t.occurrence))}${t.recurring?' · Mensal':''}</small></div><span class="proto-item-value" style="color:${isIncome?'var(--green)':'var(--red)'}">${isIncome?'+':'−'}${money(t.amount)}</span><button class="proto-edit" type="button" data-action="edit" data-id="${esc(t.id)}" aria-label="Editar ${esc(t.description)}">${icon('edit')}</button><button class="proto-delete" type="button" data-action="delete" data-id="${esc(t.id)}" aria-label="Excluir ${esc(t.description)}">${icon('trash')}</button></div>`;
  }
  function renderGoals(kind) {
    const isDream=kind==='dream';
    const goals=data.goals.filter(g=>g.kind===kind);
    const looseAllocations=(data.allocations||[]).filter(a=>!(data.goals||[]).some(g=>g.id===a.goalId)&&(isDream?a.kind==='dream':['reserve','goal'].includes(a.kind)));
    const sumSaved=Math.max(0,n2(goals.reduce((s,g)=>s+g.saved,0)+looseAllocations.reduce((s,a)=>s+a.amount,0)));
    const sumTarget=n2(goals.reduce((s,g)=>s+g.target,0));
    return `${header(isDream?'Sonho':'Metas','',null)}
      <section class="card proto-total-card"><h3>${isDream?'✨ Seu sonho':'🎯 Reserva e metas'}</h3><div class="proto-goal-total">${money(sumSaved)} <span>${sumTarget>0?`de ${money(sumTarget)}`:'registrados'}</span></div></section>
      ${!isDream?renderMonthlyReserve():''}
      ${goals.length?`<div class="proto-goals-grid${goals.length===1?' single':''}">${goals.map(g=>renderGoal(g)).join('')}</div>`:
      `<div class="card proto-empty-card">${empty(isDream?'Qual sonho você quer realizar? Toque em + para criar.':'Crie sua reserva ou uma meta de economia pelo botão +.',isDream?'sparkles':'target')}</div>`}
      ${renderAllocations(kind)}
      <p class="proto-note">Os valores guardados são informados por você e não alteram o saldo automaticamente.</p>`;
  }
  function renderMonthlyReserve() {
    const plan=savingPlan(currentMonth);
    return `<section class="card proto-saving-card"><div class="proto-saving-heading"><h3>🛡️ Aporte planejado · 10%</h3><small>${esc(monthLabel(currentMonth))}</small></div>
      <div class="proto-saving-row"><span>Salário base <small>(10% de ${money(plan.base)})</small></span><strong>${money(plan.baseTen)}</strong></div>
      <div class="proto-saving-row"><span>Personal <small>(10% de ${money(plan.personal)})</small></span><strong>${money(plan.personalTen)}</strong></div>
      <div class="proto-saving-total"><span>Total a separar</span><strong>${money(plan.total)}</strong></div>
      <p class="proto-note">Planejamento, não transferência automática. Para calcular, classifique suas entradas em Renda como Salário base ou Personal.</p>
      ${reserveYieldEstimate()}
    </section>`;
  }
  function renderAllocations(kind){
    const items=(data.allocations||[]).filter(a=>kind==='dream'?a.kind==='dream':a.kind==='goal'||a.kind==='reserve');
    if(!items.length)return '';
    const unlinked=items.filter(a=>!data.goals.some(g=>g.id===a.goalId));
    const label=a=>a.kind==='reserve'?'Reserva':a.kind==='dream'?'Sonho':'Meta';
    return `<details class="card proto-history" ${unlinked.length?'open':''}><summary>Aplicações importadas (${items.length})${unlinked.length?` · ${unlinked.length} sem vínculo`:''}</summary>
      ${items.slice().sort((a,b)=>b.date.localeCompare(a.date)).map(a=>{
        const linked=data.goals.find(g=>g.id===a.goalId);
        const candidates=goalCandidates(a.kind);
        return `<div class="proto-allocation-row"><div class="proto-allocation-top"><div><strong>${esc(label(a))} · ${esc(a.description)}</strong><small>${fmtDate.format(parseDate(a.date))} · ${linked?`Vinculado a ${esc(linked.name)}`:'Sem objetivo vinculado'}</small></div><b style="color:${a.amount>=0?'var(--green)':'var(--red)'}">${a.amount>=0?'+':'−'}${money(Math.abs(a.amount))}</b></div>
          ${!linked?(candidates.length?`<div class="proto-link-box"><select data-allocation-goal="${esc(a.id)}" aria-label="Escolher objetivo para ${esc(a.description)}">${candidates.map(g=>`<option value="${esc(g.id)}">${esc(g.name)}</option>`).join('')}</select><button type="button" class="button button-secondary" data-action="link-allocation" data-id="${esc(a.id)}">Vincular</button></div>`:`<p class="proto-note">Crie primeiro um objetivo correspondente para vincular este aporte.</p>`):''}
        </div>`;
      }).join('')}</details>`;
  }
  function renderGoal(g) {
    const pct=goalProgressPercent(g);
    const left=Math.max(0,n2(g.target-g.saved));
    const deadline=g.deadline?fmtDate.format(parseDate(g.deadline)):'Sem prazo definido';
    const isDream=g.kind==='dream';
    return `<article class="card proto-goal-card ${isDream?'dream':''}">
      <div class="proto-goal-header"><span class="proto-goal-icon" aria-hidden="true">${isDream?'✨':'🎯'}</span><div class="proto-goal-heading"><span class="proto-goal-type">${isDream?'SONHO':'META / RESERVA'}</span><h2>${esc(g.name)}</h2></div></div>
      <div class="proto-goal-progress"><div class="proto-goal-progress-label"><span>Progresso</span><strong>${pct}%</strong></div>
        <div class="proto-goal-track" role="progressbar" aria-label="Progresso de ${esc(g.name)}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pct}"><span class="proto-goal-fill" style="width:${pct}%"></span></div>
        <div class="proto-goal-info"><strong>${money(g.saved)}</strong><span>de ${money(g.target)}</span></div>
      </div>
      <div class="proto-goal-foot"><span>${left===0?'Objetivo alcançado!':`Faltam ${money(left)}`}</span><span>${esc(deadline)}</span></div>
      <div class="proto-goal-actions"><button type="button" class="button button-secondary" data-action="edit-goal" data-id="${esc(g.id)}">Atualizar valor</button><button type="button" class="button button-danger" data-action="delete-goal" data-id="${esc(g.id)}" aria-label="Excluir ${esc(g.name)}">${icon('trash')}</button></div>
    </article>`;
  }
  function openTransaction(type,id='') {
    const existing=id?data.transactions.find(t=>t.id===id):null;
    const form=transactionForm.elements;
    const effectiveType=existing?.type||type;
    form.namedItem('id').value=existing?.id||'';
    form.namedItem('description').value=existing?.description||'';
    form.namedItem('amount').value=existing?.amount??'';
    form.namedItem('date').value=existing?.date||(month===currentMonth?isoDate(new Date()):`${month}-01`);
    form.namedItem('recurring').checked=!!existing?.recurring;
    setTransactionType(effectiveType,existing?.category);
    document.getElementById('transaction-type-toggle').classList.toggle('hidden',!!existing);
    document.getElementById('transaction-title').textContent=`${existing?'Editar':'Adicionar'} ${effectiveType==='income'?'renda':'despesa'}`;
    transactionDialog.showModal();
    form.namedItem('description').focus();
  }
  function setTransactionType(type,selectedCategory) {
    const form=transactionForm.elements;
    form.namedItem('type').value=type;
    const cat=form.namedItem('category');
    const choice=selectedCategory||cat.value;
    cat.innerHTML=categorySet(type).map(c=>`<option value="${esc(c)}">${esc(c)}</option>`).join('');
    cat.value=categorySet(type).includes(choice)?choice:categorySet(type)[0];
    document.querySelectorAll('[data-trans-type]').forEach(button=>button.classList.toggle('on',button.dataset.transType===type));
    document.getElementById('transaction-title').textContent=`Adicionar ${type==='income'?'renda':'despesa'}`;
  }
  function openGoal(kind,id='') {
    const existing=id?data.goals.find(g=>g.id===id):null;
    const form=goalForm.elements;
    const effectiveKind=existing?.kind||kind;
    form.namedItem('id').value=existing?.id||'';
    form.namedItem('kind').value=effectiveKind;
    form.namedItem('name').value=existing?.name||'';
    form.namedItem('target').value=existing?.target??'';
    form.namedItem('saved').value=existing?.saved??'0';
    form.namedItem('deadline').value=existing?.deadline||'';
    const noun=effectiveKind==='dream'?'sonho':'meta';
    document.getElementById('goal-title').textContent=existing?`Editar ${noun}`:`${effectiveKind==='dream'?'Novo':'Nova'} ${noun}`;
    document.getElementById('goal-eyebrow').textContent=noun.toUpperCase();
    goalDialog.showModal();
    form.namedItem('name').focus();
  }
  document.addEventListener('click',event=>{
    const nav=event.target.closest('[data-view]');
    if(nav){changeView(nav.dataset.view);return;}
    const typeButton=event.target.closest('[data-trans-type]');
    if(typeButton){setTransactionType(typeButton.dataset.transType);return;}
    const monthButton=event.target.closest('[data-month]');
    if(monthButton){month=shiftMonth(month,Number(monthButton.dataset.month));render();return;}
    const button=event.target.closest('[data-action]');
    if(!button)return;
    const id=button.dataset.id;
    if(button.dataset.action==='add')openTransaction(button.dataset.type);
    else if(button.dataset.action==='edit')openTransaction(null,id);
    else if(button.dataset.action==='add-goal')openGoal(button.dataset.type);
    else if(button.dataset.action==='edit-goal')openGoal(null,id);
    else if(button.dataset.action==='mark-aporte'){
      if(!dueAportes().some(a=>a.key===id))return;
      const completedAportes=[...(data.completedAportes||[]),id];
      if(persist({...data,completedAportes})){renderReminderCount();renderReminderDialog();notify('Lembrete concluído.');}
    }
    else if(button.dataset.action==='link-allocation'){
      const allocation=(data.allocations||[]).find(a=>a.id===id);
      const goalId=document.querySelector(`[data-allocation-goal="${CSS.escape(id)}"]`)?.value;
      const goal=data.goals.find(g=>g.id===goalId);
      if(!allocation||allocation.goalId||!goal||!goalCandidates(allocation.kind).some(g=>g.id===goalId)){notify('Selecione um objetivo compatível.');return;}
      const goals=data.goals.map(g=>g.id===goalId?{...g,saved:Math.max(0,n2(g.saved+allocation.amount))}:g);
      const allocations=data.allocations.map(a=>a.id===id?{...a,goalId}:a);
      if(persist({...data,goals,allocations})){render();notify('Aplicação vinculada ao objetivo.');}
    }
    else if(button.dataset.action==='delete'){
      const t=data.transactions.find(v=>v.id===id);
      if(t&&confirm(`Excluir "${t.description}"${t.recurring?' de todos os meses':''}?`)){
        if(persist({...data,transactions:data.transactions.filter(v=>v.id!==id)})){render();notify('Lançamento excluído.');}
      }
    } else if(button.dataset.action==='delete-goal'){
      const g=data.goals.find(v=>v.id===id);
      if(g&&confirm(`Excluir "${g.name}"? O valor registrado como guardado também será removido desta meta.`)){
        const allocations=(data.allocations||[]).map(a=>a.goalId===id?{...a,goalId:''}:a);
        if(persist({...data,goals:data.goals.filter(v=>v.id!==id),allocations})){render();notify('Meta excluída. Aplicações preservadas sem vínculo.');}
      }
    }
  });
  document.getElementById('quick-add').addEventListener('click',()=>{
    if(view==='metas')openGoal('goal');
    else if(view==='sonho')openGoal('dream');
    else openTransaction(view==='despesas'?'expense':'income');
  });
  document.getElementById('reminder-button').addEventListener('click',()=>{
    renderReminderDialog();reminderDialog.showModal();
  });
  document.addEventListener('input',event=>{
    if(event.target.id==='transaction-search'){
      search=event.target.value;
      const selection=event.target.selectionStart;
      render();const input=document.getElementById('transaction-search');if(input){input.focus();input.setSelectionRange(selection,selection);}
    }
  });
  document.addEventListener('change',event=>{
    if(event.target.id==='transaction-category'){filterCategory=event.target.value;render();}
  });
  document.querySelectorAll('.close-dialog').forEach(b=>b.addEventListener('click',()=>b.closest('dialog').close()));
  for(const dialog of [transactionDialog,goalDialog,reminderDialog])dialog.addEventListener('click',event=>{if(event.target===dialog)dialog.close();});
  transactionForm.addEventListener('submit',event=>{
    event.preventDefault();
    const f=transactionForm.elements;
    const type=f.namedItem('type').value;
    const amount=n2(Number(f.namedItem('amount').value));
    const description=f.namedItem('description').value.trim();
    const date=f.namedItem('date').value;
    const category=f.namedItem('category').value;
    if(!description||!(amount>0&&amount<=999999999)||!/^\d{4}-\d{2}-\d{2}$/.test(date)||!categorySet(type).includes(category)){notify('Confira os dados do lançamento.');return;}
    const id=f.namedItem('id').value;
    const previous=data.transactions.find(t=>t.id===id);
    const entry={id:id||uniqueId(),type,description,amount,date,category,recurring:f.namedItem('recurring').checked,createdAt:previous?.createdAt||new Date().toISOString()};
    const next={...data,transactions:id?data.transactions.map(t=>t.id===id?entry:t):[...data.transactions,entry]};
    if(persist(next)){transactionDialog.close();month=date.slice(0,7);render();notify(id?'Lançamento atualizado.':type==='income'?'Renda salva. 🔔 Confira o aporte no sininho.':'Lançamento salvo.');}
  });
  goalForm.addEventListener('submit',event=>{
    event.preventDefault();
    const f=goalForm.elements;
    const name=f.namedItem('name').value.trim();
    const target=n2(Number(f.namedItem('target').value));
    const saved=n2(Number(f.namedItem('saved').value));
    const kind=f.namedItem('kind').value;
    const deadline=f.namedItem('deadline').value;
    if(!name||!(target>0&&target<=999999999)||!(saved>=0&&saved<=999999999)||!['dream','goal'].includes(kind)||deadline&&!/^\d{4}-\d{2}-\d{2}$/.test(deadline)){notify('Confira os dados da meta.');return;}
    const id=f.namedItem('id').value;
    const entry={id:id||uniqueId(),kind,name,target,saved,deadline};
    const next={...data,goals:id?data.goals.map(g=>g.id===id?entry:g):[...data.goals,entry]};
    if(persist(next)){goalDialog.close();render();notify(id?'Valor atualizado.':'Objetivo salvo.');}
  });
  const backupButton=document.getElementById('backup-menu-button');
  const backupMenu=document.getElementById('backup-menu');
  const folderConnectButton=document.getElementById('folder-backup-connect');
  const folderReconnectButton=document.getElementById('folder-backup-reconnect');
  const folderStatus=document.getElementById('folder-backup-status');
  const folderAlert=document.getElementById('folder-backup-alert');
  folderBackup=window.MeuDinheiroFolderBackup.createBrowserManager({
    getSnapshot:()=>({app:'meu-dinheiro-essencial',version:1,transactions:data.transactions,goals:data.goals,allocations:data.allocations||[],completedAportes:data.completedAportes||[]}),
    confirmReplace:message=>window.confirm(message),
    onStatus:({code,message,folder})=>{
      folderStatus.dataset.state=code;
      folderStatus.textContent=folder?`${folder} · ${message}`:message;
      folderConnectButton.innerHTML=`${icon('folder')}${folder?' Trocar pasta':' Escolher pasta de dados'}`;
      folderReconnectButton.classList.toggle('hidden',!['permission','conflict','error'].includes(code)||!folder);
      folderAlert.classList.toggle('hidden',!['permission','conflict','error'].includes(code));
    }
  });
  void folderBackup.initialize();
  folderConnectButton.addEventListener('click',async()=>{
    hideBackupMenu();
    const result=await folderBackup.connect();
    if(result)notify('Pasta conectada. Backup automático ativado.');
    else if(folderBackup.getState().state==='error')notify('Erro ao conectar a pasta. Confira o menu de backup.');
  });
  folderReconnectButton.addEventListener('click',async()=>{
    hideBackupMenu();
    const result=await folderBackup.reauthorize();
    notify(result?'Backup na pasta atualizado.':'Não foi possível salvar na pasta. Confira as permissões.');
  });
  backupButton.addEventListener('click',()=>{const show=backupMenu.classList.toggle('hidden')===false;backupButton.setAttribute('aria-expanded',show?'true':'false');});
  document.addEventListener('click',event=>{if(!event.target.closest('#backup-menu')&&!event.target.closest('#backup-menu-button')){backupMenu.classList.add('hidden');backupButton.setAttribute('aria-expanded','false');}});
  document.getElementById('export-data').addEventListener('click',()=>{
    const contents=JSON.stringify({app:'meu-dinheiro-essencial',version:1,exportedAt:new Date().toISOString(),...data},null,2);
    const url=URL.createObjectURL(new Blob([contents],{type:'application/json'}));
    const a=document.createElement('a');a.href=url;a.download=`meu-dinheiro-backup-${isoDate(new Date())}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),30000);
    backupMenu.classList.add('hidden');backupButton.setAttribute('aria-expanded','false');notify('Backup gerado. Guarde o arquivo em local seguro.');
  });
  document.getElementById('import-data').addEventListener('click',()=>{document.getElementById('import-file').click();backupMenu.classList.add('hidden');backupButton.setAttribute('aria-expanded','false');});
  document.getElementById('import-file').addEventListener('change',async event=>{
    const file=event.target.files?.[0];event.target.value='';if(!file)return;
    if(file.size>5*1024*1024){notify('Arquivo muito grande (limite: 5 MB).');return;}
    try{
      const incoming=JSON.parse(await file.text());
      if(incoming.app!=='meu-dinheiro-essencial'||incoming.version!==1||!Array.isArray(incoming.transactions)||!Array.isArray(incoming.goals))throw Error('Formato de backup incompatível.');
      if(incoming.transactions.length>20000||incoming.goals.length>2000)throw Error('Arquivo acima do limite de registros.');
      const incomingAllocations=incoming.allocations||[];
      if(!Array.isArray(incomingAllocations)||incomingAllocations.length>20000)throw Error('A lista de aplicações é inválida.');
      const completedAportes=incoming.completedAportes||[];
      if(!Array.isArray(completedAportes)||completedAportes.length>30000||completedAportes.some(v=>typeof v!=='string'||v.length>200))throw Error('Há lembretes inválidos no backup.');
      for(const a of incomingAllocations){if(!a||typeof a.id!=='string'||typeof a.description!=='string'||!['goal','reserve','dream'].includes(a.kind)||!Number.isFinite(a.amount)||Math.abs(a.amount)>999999999||!/^\d{4}-\d{2}-\d{2}$/.test(a.date)||typeof a.goalId!=='string')throw Error('Há aplicações inválidas no backup.');}
      for(const t of incoming.transactions){if(!t||typeof t.id!=='string'||typeof t.description!=='string'||t.description.length>80||!['income','expense'].includes(t.type)||!Number.isFinite(t.amount)||t.amount<=0||t.amount>999999999||typeof t.date!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(t.date)||!categorySet(t.type).includes(t.category)||typeof t.createdAt!=='string'||typeof t.recurring!=='boolean')throw Error('Há lançamentos inválidos.');}
      for(const g of incoming.goals){if(!g||typeof g.id!=='string'||typeof g.name!=='string'||g.name.length>80||!['goal','dream'].includes(g.kind)||!Number.isFinite(g.target)||g.target<=0||g.target>999999999||!Number.isFinite(g.saved)||g.saved<0||g.saved>999999999||typeof g.deadline!=='string'||(g.deadline&&!/^\d{4}-\d{2}-\d{2}$/.test(g.deadline)))throw Error('Há metas inválidas.');}
      if(!confirm(`Este backup contém ${incoming.transactions.length} lançamentos e ${incoming.goals.length} objetivos. Substituir TODOS os dados atuais pelos dados do arquivo?`))return;
      if(persist({transactions:incoming.transactions,goals:incoming.goals,allocations:incomingAllocations,completedAportes})){view='resumo';month=currentMonth;renderNav();render();notify('Backup restaurado com sucesso.');}
    }catch(error){notify(error.message||'Não foi possível importar o backup.');}
  });
  const csvDialog=document.getElementById('csv-preview-dialog');
  const csvFile=document.getElementById('csv-import-file');
  function hideBackupMenu(){backupMenu.classList.add('hidden');backupButton.setAttribute('aria-expanded','false');}
  document.getElementById('export-csv').addEventListener('click',()=>{
    const contents=window.MeuDinheiroCSV.exportCSV(data.transactions,data.allocations||[]);
    const url=URL.createObjectURL(new Blob([contents],{type:'text/csv;charset=utf-8'}));
    const a=document.createElement('a');a.href=url;a.download=`meu-dinheiro-lancamentos-${isoDate(new Date())}.csv`;a.click();
    setTimeout(()=>URL.revokeObjectURL(url),30000);hideBackupMenu();notify('CSV exportado com todos os lançamentos.');
  });
  document.getElementById('import-csv').addEventListener('click',()=>{hideBackupMenu();csvFile.click();});
  function goalCandidates(kind){
    return data.goals.filter(g=>kind==='dream'?g.kind==='dream':g.kind==='goal'&&(kind==='reserve'?/reserva|emerg[eê]ncia/i.test(g.name):!/reserva|emerg[eê]ncia/i.test(g.name)));
  }
  function refreshCSVPreview(){
    const csv=csvAnalysis;if(!csv)return;
    const already=[...data.transactions,...(data.allocations||[])];
    const existingIds=new Set(already.map(t=>t.id));
    const existingKeys=new Set(already.map(t=>t.importKey).filter(Boolean));
    const accepted=[],investments=[];let duplicates=0;
    const batchIds=new Set(),batchKeys=new Set();
    for(const item of csv.items){
      if((item.id&&(existingIds.has(item.id)||batchIds.has(item.id)))||existingKeys.has(item.importKey)||batchKeys.has(item.importKey)){duplicates++;continue;}
      if(item.investmentTransfer)investments.push(item);else accepted.push(item);
      if(item.id)batchIds.add(item.id);batchKeys.add(item.importKey);
    }
    pendingCsv=accepted;
    pendingAllocations=investments.map(item=>({...item,...(csvSelections.get(item.importKey)||{kind:'',goalId:''})}));
    const income=accepted.filter(t=>t.type==='income').length,expense=accepted.length-income;
    const unclassified=pendingAllocations.filter(a=>!a.kind).length;
    document.getElementById('csv-import-summary').textContent=`${csv.items.length} movimentações reconhecidas. ${accepted.length} lançamentos comuns: ${income} entradas e ${expense} saídas. ${investments.length} aplicações/resgates para classificar. ${duplicates} já importadas.`;
    document.getElementById('csv-investment-list').innerHTML=investments.length?`<div class="csv-investment-heading">Classificação obrigatória de cada aplicação</div>${pendingAllocations.map(item=>{
      const choices=goalCandidates(item.kind);
      return `<div class="csv-investment-row"><div class="csv-investment-info"><strong>${esc(item.description)}</strong><small>${fmtDate.format(parseDate(item.date))} · ${item.allocationDelta>=0?'+':'−'}${money(Math.abs(item.allocationDelta))}</small></div><div class="csv-investment-fields"><label>Destino<select data-csv-kind="${esc(item.importKey)}" aria-label="Destino de ${esc(item.description)}"><option value="">Escolher...</option><option value="reserve" ${item.kind==='reserve'?'selected':''}>Reserva</option><option value="goal" ${item.kind==='goal'?'selected':''}>Meta</option><option value="dream" ${item.kind==='dream'?'selected':''}>Sonho</option></select></label><label>Vincular a objetivo (opcional)<select data-csv-goal="${esc(item.importKey)}" aria-label="Vincular ${esc(item.description)}" ${!item.kind?'disabled':''}><option value="">Sem vínculo por enquanto</option>${choices.map(g=>`<option value="${esc(g.id)}" ${g.id===item.goalId?'selected':''}>${esc(g.name)}</option>`).join('')}</select></label></div></div>`;
    }).join('')}`:'';
    document.getElementById('csv-preview-table').innerHTML=`<table><thead><tr><th>Data</th><th>Descrição</th><th>Valor</th></tr></thead><tbody>${accepted.slice(0,6).map(t=>`<tr><td>${fmtDate.format(parseDate(t.date))}</td><td>${esc(t.description)}</td><td style="color:${t.type==='income'?'var(--green)':'var(--red)'}">${t.type==='income'?'+':'−'}${money(t.amount)}</td></tr>`).join('')}</tbody></table>${accepted.length>6?`<p class="proto-note" style="padding:0 10px">Exibindo 6 de ${accepted.length} lançamentos novos.</p>`:''}`;
    document.getElementById('csv-import-warning').textContent=investments.length?`Classifique as ${investments.length} aplicações. Valores vinculados a um objetivo serão somados ao que já está guardado; sem vínculo, ficam registrados separadamente na área escolhida. Aplicações não entram como despesas.`:'Confira os lançamentos antes de importar. Depois você poderá ajustar as categorias.';
    const button=document.getElementById('csv-confirm-import');
    button.disabled=(!accepted.length&&!investments.length)||unclassified>0;
    button.textContent=unclassified?`Classifique ${unclassified} aplicação(ões)`:accepted.length||investments.length?`Importar ${accepted.length+investments.length} movimentações`:'Nada novo para importar';
  }
  document.getElementById('csv-investment-list').addEventListener('change',event=>{
    const kindKey=event.target.dataset.csvKind;
    const goalKey=event.target.dataset.csvGoal;
    if(kindKey){csvSelections.set(kindKey,{kind:event.target.value,goalId:''});refreshCSVPreview();}
    else if(goalKey){const previous=csvSelections.get(goalKey)||{kind:'',goalId:''};csvSelections.set(goalKey,{...previous,goalId:event.target.value});refreshCSVPreview();}
  });
  csvFile.addEventListener('change',async event=>{
    const file=event.target.files?.[0];event.target.value='';if(!file)return;
    if(file.size>10*1024*1024){notify('O CSV deve ter até 10 MB.');return;}
    try{
      csvAnalysis=window.MeuDinheiroCSV.importCSV(await file.text(),CATEGORIES);
      csvSelections=new Map();
      refreshCSVPreview();
      csvDialog.showModal();
    }catch(error){pendingCsv=null;pendingAllocations=null;csvAnalysis=null;notify(error.message||'Não foi possível ler o CSV.');}
  });
  document.getElementById('csv-confirm-import').addEventListener('click',()=>{
    if(!pendingCsv||!pendingAllocations||pendingAllocations.some(a=>!a.kind))return;
    if(!pendingCsv.length&&!pendingAllocations.length)return;
    const added=pendingCsv.map(t=>({...t,id:t.id||uniqueId(),createdAt:new Date().toISOString()}));
    const addedAllocations=pendingAllocations.map(a=>({id:a.id||uniqueId(),date:a.date,description:a.description,amount:a.allocationDelta,kind:a.kind,goalId:a.goalId||'',importKey:a.importKey,createdAt:new Date().toISOString()}));
    const goals=data.goals.map(g=>({...g}));
    for(const allocation of addedAllocations){
      const goal=goals.find(g=>g.id===allocation.goalId);
      if(goal)goal.saved=Math.max(0,n2(goal.saved+allocation.amount));
    }
    const next={...data,goals,transactions:[...data.transactions,...added],allocations:[...(data.allocations||[]),...addedAllocations]};
    if(persist(next)){
      const newest=[...added,...addedAllocations].map(t=>t.date).sort().at(-1);if(newest)month=newest.slice(0,7);
      pendingCsv=null;pendingAllocations=null;csvDialog.close();render();notify(`${added.length} lançamentos e ${addedAllocations.length} aplicações importados.${added.some(t=>t.type==='income')?' 🔔 Confira seus aportes.':''}`);
    }
  });
  csvDialog.addEventListener('close',()=>{pendingCsv=null;pendingAllocations=null;csvAnalysis=null;csvSelections=new Map();});
  csvDialog.addEventListener('click',event=>{if(event.target===csvDialog)csvDialog.close();});
  csvDialog.querySelectorAll('.close-dialog').forEach(button=>button.addEventListener('click',()=>csvDialog.close()));
  renderNav();render();
  refreshCdiSilently();
  if('serviceWorker' in navigator)window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(()=>{}));
})();
