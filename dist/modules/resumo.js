// Saldo estimado de todo o histórico até hoje. Recorrências são contadas somente
// quando a respectiva ocorrência mensal já venceu; não altera nenhum registro.
export function calcularSaldoDisponivelHoje(transacoes,hojeISO,aplicacoes=[]){
  if(!Array.isArray(transacoes)||!/^\d{4}-\d{2}-\d{2}$/.test(hojeISO))return null;
  const [anoAtual,mesAtual]=hojeISO.split('-').map(Number);
  let total=0;
  for(const item of transacoes){
    if(!item||!/^\d{4}-\d{2}-\d{2}$/.test(item.date)||item.date>hojeISO||
      !['income','expense'].includes(item.type)||!Number.isFinite(item.amount))continue;
    let quantidade=1;
    if(item.recurring){
      const [anoInicio,mesInicio,dia]=item.date.split('-').map(Number);
      const meses=(anoAtual-anoInicio)*12+mesAtual-mesInicio;
      const ultimoDia=new Date(Date.UTC(anoAtual,mesAtual,0)).getUTCDate();
      const ocorrenciaAtual=`${hojeISO.slice(0,7)}-${String(Math.min(dia,ultimoDia)).padStart(2,'0')}`;
      quantidade=meses+(ocorrenciaAtual<=hojeISO?1:0);
    }
    total+=(item.type==='income'?1:-1)*item.amount*quantidade;
  }
  // Transferência interna comprovada pelo usuário: sai do dinheiro disponível,
  // mas não vira despesa e não reduz o valor total do patrimônio investido.
  for(const aporte of Array.isArray(aplicacoes)?aplicacoes:[]){
    if(aporte?.origin==='salary'&&aporte.date<=hojeISO&&Number.isFinite(aporte.amount)&&
      transacoes.some(t=>t.id===aporte.salaryId&&t.type==='income'))total-=aporte.amount;
  }
  return Number.isFinite(total)?Math.round(total*100)/100:null;
}

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
        ${stats.averages.length?`<div class="proto-average-list">${stats.averages.map(item=>`<div class="proto-average-item"><div class="proto-average-top"><span><i class="proto-category-color" style="background:${color(item.category)}"></i>${esc(item.category)}</span><strong>${money(item.average)}</strong></div><div class="proto-average-track progress-bar" role="img" aria-label="Média de ${esc(item.category)}: ${money(item.average)} em ${item.recordedMonths} ${item.recordedMonths===1?'mês':'meses'} com registro"><div class="progress-bar-fill" style="width:${Math.max(2,(item.average/maxAverage)*100)}%;background:${color(item.category)}"></div></div><small>${item.recordedMonths} ${item.recordedMonths===1?'mês com registro':'meses com registros'}</small></div>`).join('')}</div>`:
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
    const hojeISO=isoDate(new Date());
    const saldoDisponivel=calcularSaldoDisponivelHoje(data.transactions,hojeISO,data.allocations);
    const selected=getPreferences().reservaGoalId;
    const reserva=data.goals.find(g=>g.kind==='goal'&&(selected?g.id===selected:/reserva|emerg[eê]ncia/i.test(g.name)))||data.goals.find(g=>g.kind==='goal');
    const sonho=data.goals.find(g=>g.kind==='dream');
    const recent=transactionsInMonth(month).slice(0,5);
    const hasHistory=Array.from({length:6},(_,i)=>sums(shiftMonth(month,i-5)).count).some(Boolean);
    return `${header('',true)}
      <div class="proto-overview">
        <section class="card proto-donut-card"><h3>Visão financeira</h3>${donut(s.income,s.expense)}<div class="proto-donut-legend"><span><i style="background:var(--green)"></i>Renda</span><span><i style="background:var(--red)"></i>Despesas</span></div></section>
        <div class="proto-overview-secondary">
          <section class="card proto-today-balance ${saldoDisponivel!==null&&saldoDisponivel<0?'is-negative':''}" aria-label="Saldo disponível hoje, estimado pelos lançamentos e investimentos feitos com salário">
            <div class="proto-today-balance-heading"><h3>Saldo acumulado até hoje</h3><span>${esc(hojeISO.split('-').reverse().join('/'))}</span></div>
            <strong class="proto-today-balance-value">${saldoDisponivel===null?'—':money(saldoDisponivel)}</strong>
            <p>Receitas menos despesas até hoje, incluindo recorrências vencidas e aportes identificados como saídos do salário. Não é o saldo bancário.</p>
          </section>
          <div class="grid2"><div class="minicard bg-green"><div class="lbl">Renda</div><div class="val">${money(s.income)}</div></div><div class="minicard bg-red"><div class="lbl">Despesas</div><div class="val">${money(s.expense)}</div></div></div>
          <div class="proto-goal-summary-grid">
            <section class="card proto-progress-card" aria-label="Resumo da reserva"><h3>Reserva</h3>${reserva?progressLine(reserva):'<div class="proto-empty">Nenhuma reserva cadastrada. <button type="button" class="button button-secondary" data-action="add-goal" data-type="goal">Criar meta</button></div>'}</section>
            <section class="card proto-progress-card" aria-label="Resumo dos sonhos"><h3>Sonhos</h3>${sonho?progressLine(sonho):'<div class="proto-empty">Nenhum sonho cadastrado. <button type="button" class="button button-secondary" data-action="add-goal" data-type="dream">Criar sonho</button></div>'}</section>
          </div>
        </div>
      </div>
      ${renderSaude()}
      <section class="card proto-list-card"><h3>Últimas transações</h3>${entryList(recent,'Nenhuma transação neste mês.')}</section>
      ${renderExpenseCharts()}
      ${hasHistory?`<details class="card proto-history"><summary>Comparar os últimos 6 meses</summary>${renderChart()}</details>`:''}
      <p class="proto-note">Investimentos antigos não alteram o saldo disponível. Aportes confirmados como feitos com salário são tratados como transferências internas, sem criar novas despesas.</p>`;
  }
  return {renderSummary};
}
