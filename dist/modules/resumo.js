export function criarModuloResumo(ctx) {
  const {getData, getPreferences, getMonth, shiftMonth, sums, monthLabel, money, esc,
    shortMonth, currentMonth, isoDate, transactionsInMonth, EXPENSE_COLORS,
    renderEntry, progressLine, header, renderSaude=()=>''} = ctx;

  function renderChart() {
    const month = getMonth();
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
        ${stats.current.length?`<svg class="proto-expense-donut" viewBox="0 0 120 120" role="img" aria-label="Total ${money(stats.currentTotal)}. ${esc(stats.current.map(t=>`${t.category}: ${money(t.amount)}`).join('; '))}">
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
  function renderSummary() {
    const month = getMonth();
    const data = getData();
    const s=sums(month);
    const selected=getPreferences().reservaGoalId;
    const goals=[data.goals.find(g=>g.kind==='goal'&&(selected?g.id===selected:/reserva|emerg[eê]ncia/i.test(g.name))),data.goals.find(g=>g.kind==='dream')].filter(Boolean);
    if(!goals.some(g=>g.kind==='goal')) {const another=data.goals.find(g=>g.kind==='goal');if(another)goals.unshift(another);}
    const recent=transactionsInMonth(month).slice(0,5);
    const hasHistory=Array.from({length:6},(_,i)=>sums(shiftMonth(month,i-5)).count).some(Boolean);
    return `${header('',true)}
      <div class="proto-overview">
        <section class="card proto-donut-card"><h3>Visão financeira</h3>${donut(s.income,s.expense)}<div class="proto-donut-legend"><span><i style="background:var(--green)"></i>Renda</span><span><i style="background:var(--red)"></i>Despesas</span></div></section>
        <div class="proto-overview-secondary">
          <div class="grid2"><div class="minicard bg-green"><div class="lbl">Renda</div><div class="val">${money(s.income)}</div></div><div class="minicard bg-red"><div class="lbl">Despesas</div><div class="val">${money(s.expense)}</div></div></div>
          <section class="card proto-progress-card"><h3>Reserva e sonho</h3>${goals.length?goals.map(progressLine).join(''):`<div class="proto-empty">Suas metas e sonhos aparecerão aqui.</div>`}</section>
        </div>
      </div>
      ${renderSaude()}
      <section class="card proto-list-card"><h3>Últimas transações</h3>${entryList(recent,'Nenhuma transação neste mês.')}</section>
      ${renderExpenseCharts()}
      ${hasHistory?`<details class="card proto-history"><summary>Comparar os últimos 6 meses</summary>${renderChart()}</details>`:''}
      <p class="proto-note">Valores guardados são acompanhados separadamente e não são descontados novamente do saldo.</p>`;
  }
  return {renderSummary};
}
