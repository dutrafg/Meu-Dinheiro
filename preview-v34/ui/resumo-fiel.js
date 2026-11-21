/*
 * Resumo visual v34 inspirado nos mockups aprovados. Todos os valores vêm de
 * lançamentos reais ou do cálculo de saldo já exibido pelo motor financeiro v31.
 * A tela original fica preservada numa seção expansível.
 */
(function () {
  'use strict';
  const content = document.getElementById('view-content');
  const nav = document.getElementById('desktop-nav');
  const group = window.MeuDinheiroDesignV32Domain;
  const forecast = window.MeuDinheiroV33Previsao;
  const budget = window.MeuDinheiroV33Orcamento;
  if (!content || !nav || !group || !forecast || !budget) return;

  const MONEY = new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'});
  const TODAY = () => {const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;};
  const MONTHS = ['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];
  const esc = value => String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const money = value => MONEY.format(Number(value)||0);
  const positive = cents => cents >= 0 ? 'is-income' : 'is-expense';
  const icon = name => `<svg aria-hidden="true"><use href="#i-${name}"></use></svg>`;
  const selectedView = () => nav.querySelector('.nav-button.active')?.dataset.view || 'resumo';

  function readData() {
    try { const data=JSON.parse(localStorage.getItem('meu-dinheiro-essencial:v1')||'{}');return data && typeof data==='object'?data:{}; }
    catch (_) { return {}; }
  }
  function period() {
    const label = content.querySelector('[data-calendar-open]')?.textContent?.toLocaleLowerCase('pt-BR')||'';
    const index = MONTHS.findIndex(name=>label.includes(name));
    const year = label.match(/\b(20\d{2})\b/);
    return index<0||!year?TODAY().slice(0,7):`${year[1]}-${String(index+1).padStart(2,'0')}`;
  }
  function monthDistance(from,to) {
    const [a,b]=from.split('-').map(Number),[c,d]=to.split('-').map(Number);
    return (c-a)*12+d-b;
  }
  function safeDate(date) {
    const parts=String(date||'').split('-');return `${parts[2]||'--'}/${parts[1]||'--'}`;
  }
  function chartSVG(projection,month,today) {
    const series=projection.byDay;
    if(!series.some(day=>day.incomeCent||day.expenseCent))return '<div class="v34-chart-empty">Cadastre receitas ou despesas com data para visualizar a evolução do mês.</div>';
    const all=series.map(item=>item.balanceCent/100),min=Math.min(...all,0),max=Math.max(...all,0);
    const padding=(max-min)*.15||100;
    const low=min-padding,high=max+padding;
    const x=i=>64+(i/Math.max(1,series.length-1))*590;
    const y=value=>173-(value-low)/(high-low)*136;
    const coordinate=(item,i)=>`${x(i).toFixed(1)},${y(item.balanceCent/100).toFixed(1)}`;
    const seen=series.filter(item=>item.date<=today).length;
    const points=series.map(coordinate);
    const actual=points.slice(0,Math.max(1,seen)).join(' ');
    const predicted=points.slice(Math.max(0,seen-1)).join(' ');
    const todayIndex=Math.min(Math.max(seen-1,0),series.length-1);
    const axis=[low,(low+high)/2,high].map(value=>`<g><line x1="64" y1="${y(value).toFixed(1)}" x2="654" y2="${y(value).toFixed(1)}" stroke="var(--border)" stroke-width="1"/><text x="56" y="${(y(value)+5).toFixed(1)}" text-anchor="end" fill="var(--sub)" font-size="11">${esc(new Intl.NumberFormat('pt-BR',{notation:'compact',maximumFractionDigits:1}).format(value))}</text></g>`).join('');
    const start=series[0].date.slice(8),end=series.at(-1).date.slice(8);
    return `<svg class="v34-forecast-svg" viewBox="0 0 680 212" role="img" aria-label="Resultado acumulado ao longo de ${esc(month)}; fechamento estimado ${esc(money(projection.closingResultCent/100))}">${axis}
      <polyline points="${actual}" fill="none" stroke="var(--accent)" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/>
      ${predicted?`<polyline points="${predicted}" fill="none" stroke="var(--accent)" stroke-width="3.5" stroke-dasharray="7 7" stroke-linecap="round" stroke-linejoin="round"/>`:''}
      ${seen>0&&seen<series.length?`<line x1="${x(todayIndex)}" y1="22" x2="${x(todayIndex)}" y2="181" stroke="var(--accent)" stroke-width="1.5" stroke-dasharray="5 5"/><circle cx="${x(todayIndex)}" cy="${y(series[todayIndex].balanceCent/100)}" r="5" fill="var(--accent)" stroke="var(--card)" stroke-width="3"/>`:''}
      <text x="64" y="204" fill="var(--sub)" font-size="12">${start} ${esc(MONTHS[Number(month.slice(5))-1].slice(0,3))}</text>
      <text x="359" y="204" text-anchor="middle" fill="var(--sub)" font-size="12">${esc(month.slice(0,7))}</text><text x="654" y="204" text-anchor="end" fill="var(--sub)" font-size="12">${end} ${esc(MONTHS[Number(month.slice(5))-1].slice(0,3))}</text>
    </svg>`;
  }
  function goalRow(goal) {
    if(!goal)return '<div class="v34-empty">Ainda não há meta cadastrada. Use o botão + para criar uma.</div>';
    const saved=Math.max(0,Number(goal.saved)||0),target=Math.max(0,Number(goal.target)||0);
    const pct=target>0?Math.min(100,Math.round(saved/target*100)):0;
    return `<div class="v34-goal-entry"><span class="v34-goal-symbol">${icon(goal.kind==='dream'?'sparkles':'target')}</span><div class="v34-goal-main"><strong>${esc(goal.name)}</strong><small>${esc(money(saved))} de ${esc(money(target))}</small><div class="v34-track"><span style="width:${pct}%"></span></div></div><span class="v34-goal-percent">${pct}%</span><button type="button" class="v34-goal-action" data-action="add-investment" data-id="${esc(goal.id)}" aria-label="Investir em ${esc(goal.name)}">Aportar</button></div>`;
  }
  function budgetRows(entries,month,today) {
    let limits=[];
    try { const raw=localStorage.getItem('meu-dinheiro-essencial:orcamentos:preview-v33');if(raw)limits=budget.normalize(JSON.parse(raw)).budgets; }
    catch (_) { /* A configuração inválida não gera números fictícios. */ }
    const evaluated=budget.evaluate(entries,limits,today);
    if(!evaluated.length)return `<p class="v34-empty">Defina limites para contas como água, luz, mercado e aluguel.</p>`;
    return evaluated.slice(0,3).map(item=>`<div class="v34-budget-row"><div><strong>${esc(item.category)}</strong><span>${esc(money(item.spentCent/100))} de ${esc(money(item.limitCent/100))}</span></div><div class="v34-track"><span class="state-${item.status}" style="width:${Math.min(100,item.pct)}%"></span></div><small>${item.pct.toLocaleString('pt-BR')}% usado${item.scheduledCent?` · ${esc(money(item.scheduledCent/100))} agendado`:''}</small></div>`).join('');
  }
  function upcoming(entries,today) {
    const future=entries.filter(item=>item.occurrence>today).sort((a,b)=>a.occurrence.localeCompare(b.occurrence)).slice(0,3);
    if(!future.length)return '<p class="v34-empty">Nenhum lançamento futuro cadastrado para este mês.</p>';
    return future.map(item=>`<div class="v34-upcoming-row"><span class="v34-date-pill">${esc(safeDate(item.occurrence))}</span><div><strong>${esc(item.description)}</strong><small>${esc(item.category)}</small></div><b class="${item.type==='income'?'is-income':'is-expense'}">${item.type==='income'?'+':'−'} ${esc(money(item.amount))}</b></div>`).join('');
  }
  function recent(entries) {
    const list=entries.slice(0,4);
    if(!list.length)return '<p class="v34-empty">Nenhum movimento no mês. Toque em + para cadastrar.</p>';
    return list.map(item=>`<div class="v34-recent-row"><span class="v34-transaction-icon ${item.type==='income'?'is-income':'is-expense'}">${icon(item.type==='income'?'down':'up')}</span><div><strong>${esc(item.description)}</strong><small>${esc(item.category)} · ${esc(safeDate(item.occurrence))}</small></div><b class="${item.type==='income'?'is-income':'is-expense'}">${item.type==='income'?'+':'−'} ${esc(money(item.amount))}</b></div>`).join('');
  }
  function addHome() {
    if(selectedView()!=='resumo'||content.querySelector('[data-v34-home]'))return;
    const originalBalance=content.querySelector('.proto-today-balance-value')?.textContent||'—';
    const month=period(),today=TODAY();
    const data=readData(),entries=group.monthlyEntries(data.transactions,month);
    const values=group.summary(entries,`${month}-31`);
    const projection=forecast.forecast(entries,month,today);
    const goals=Array.isArray(data.goals)?data.goals:[];
    const reserve=goals.find(item=>item.kind==='goal'&&/reserva|emerg[eê]ncia/i.test(item.name))||goals.find(item=>item.kind==='goal');
    const dream=goals.find(item=>item.kind==='dream');

    // Reutiliza o seletor nativo: setas, calendário de cores e mês selecionado.
    const monthNode=content.querySelector('.proto-page-meta');
    const shell=document.createElement('div');
    shell.className='v34-home';shell.dataset.v34Home='';
    shell.innerHTML=`<div class="v34-top-period"><div class="v34-month-slot"></div><button type="button" data-month="${monthDistance(month,today.slice(0,7))}" class="v34-today-button">Hoje</button></div>
      <section class="v34-balance-hero card"><span class="v34-eyebrow">SALDO ATÉ HOJE</span><strong class="v34-hero-amount" data-v34-money>${esc(originalBalance)}</strong><p>Receitas menos despesas já vencidas e aportes feitos com salário. Não representa o saldo bancário.</p></section>
      <section class="v34-month-metrics" aria-label="Valores do mês"><div class="v34-metric v34-income"><small>${icon('down')} Renda</small><strong data-v34-money>+ ${esc(money(values.income))}</strong></div><div class="v34-metric v34-expense"><small>${icon('up')} Despesas</small><strong data-v34-money>− ${esc(money(values.expense))}</strong></div><div class="v34-metric v34-net"><small>Saldo do mês</small><strong data-v34-money class="${positive(projection.closingResultCent)}">${esc(money(projection.closingResultCent/100))}</strong></div></section>
      <div class="v34-body-grid"><div class="v34-left-column"><section class="card v34-forecast-card"><div class="v34-card-heading"><div><h2>Previsão do mês</h2><p>Resultado dos lançamentos cadastrados até o fim do período</p></div><strong data-v34-money class="v34-forecast-value ${positive(projection.closingResultCent)}">${esc(money(projection.closingResultCent/100))}</strong></div>${chartSVG(projection,month,today)}<small class="v34-caveat">Projeção de receitas menos despesas; não é saldo bancário ou patrimônio.</small></section>
        <section class="card v34-recent-card"><div class="v34-card-heading"><h2>Últimos movimentos</h2><button type="button" data-view="renda" class="v34-link">Ver todos</button></div>${recent(entries)}</section></div>
        <div class="v34-right-column"><section class="card v34-budget-card"><div class="v34-card-heading"><h2>Orçamento</h2><button type="button" data-v33-open="budget" class="v34-link">Editar</button></div>${budgetRows(entries,month,today)}</section>
          <section class="card v34-upcoming-card"><div class="v34-card-heading"><h2>Próximos vencimentos</h2></div>${upcoming(entries,today)}</section>
          <section class="card v34-goals-card"><div class="v34-card-heading"><h2>Objetivos</h2><button type="button" data-view="metas" class="v34-link">Ver objetivos</button></div>${goalRow(reserve)}${dream?goalRow(dream):''}</section></div></div>`;
    if(monthNode){shell.querySelector('.v34-month-slot').append(monthNode);}
    // Mantém todos os módulos v31 em um painel acessível, sem duplicá-los na home.
    const advanced=document.createElement('details');
    advanced.className='v34-advanced';
    advanced.innerHTML='<summary>Detalhes e análises avançadas <span>Saúde financeira, gráficos e históricos</span></summary><div class="v34-advanced-body"></div>';
    while(content.firstChild)advanced.querySelector('.v34-advanced-body').append(content.firstChild);
    content.append(shell,advanced);
    updatePrivateValues();
  }

  const privacyKey='meu-dinheiro-essencial:modo-discreto:preview-v34';
  let privateMode=false;
  try {privateMode=localStorage.getItem(privacyKey)==='on';} catch (_) { /* Estado apenas da sessão. */ }
  function updatePrivateValues() {
    document.body.classList.toggle('v34-private',privateMode);
    for(const element of document.querySelectorAll('[data-v34-money]')){
      if(!element.dataset.originalValue)element.dataset.originalValue=element.textContent;
      element.textContent=privateMode?'••••':element.dataset.originalValue;
    }
    const button=document.getElementById('v34-privacy-toggle');
    if(button){button.setAttribute('aria-pressed',String(privateMode));button.setAttribute('aria-label',privateMode?'Mostrar valores':'Ocultar valores');button.title=privateMode?'Mostrar valores':'Ocultar valores';}
  }
  function setupHeader() {
    const actions=document.querySelector('.proto-header-actions');
    if(!actions||document.getElementById('v34-privacy-toggle'))return;
    const button=document.createElement('button');
    button.id='v34-privacy-toggle';button.type='button';
    button.className='v34-eye-button';
    button.innerHTML='<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/></svg>';
    actions.append(button);
    button.addEventListener('click',()=>{
      privateMode=!privateMode;
      try {localStorage.setItem(privacyKey,privateMode?'on':'off');}catch(_){}
      updatePrivateValues();
    });
    updatePrivateValues();
  }
  function updateViewAttribute() {
    document.body.dataset.v34View=selectedView();
  }
  let scheduled=false;
  function decorate() {
    updateViewAttribute();
    addHome();
  }
  function schedule() {
    if(scheduled)return;
    scheduled=true;
    queueMicrotask(()=>{scheduled=false;decorate();});
  }
  setupHeader();
  new MutationObserver(schedule).observe(content,{childList:true});
  new MutationObserver(schedule).observe(document.getElementById('header-label'),{childList:true});
  decorate();
  window.MeuDinheiroV34Resumo=Object.freeze({ chartSVG, monthDistance, hasHome:()=>!!content.querySelector('[data-v34-home]') });
})();
