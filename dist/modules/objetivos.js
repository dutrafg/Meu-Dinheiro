export function criarModuloObjetivos(ctx) {
  const {getData, n2, esc, money, header, empty, savingPlan, currentMonth,
    monthLabel, reserveYieldEstimate, fmtDate, parseDate, icon, goalForm, goalDialog} = ctx;

  function goalProgressPercent(goal) {
    const target=Number(goal.target),saved=Number(goal.saved);
    return target>0&&Number.isFinite(target)&&Number.isFinite(saved)?Math.min(100,Math.max(0,Math.round(saved/target*100))):0;
  }
  function progressLine(goal) {
    const pct=goalProgressPercent(goal);
    const isDream=goal.kind==='dream';
    return `<div class="proto-progress ${isDream?'dream':'goal'}"><div class="proto-progress-top"><span>${icon(isDream?'sparkles':'target')} ${esc(goal.name)}</span><strong>${pct}%</strong></div><div class="bar progress-bar" role="progressbar" aria-label="Progresso de ${esc(goal.name)}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pct}"><div class="progress-bar-fill" style="width:${pct}%"></div></div><small>${money(goal.saved)} de ${money(goal.target)}</small></div>`;
  }
  function renderGoals(kind) {
    const data = getData();
    const isDream=kind==='dream';
    const goals=data.goals.filter(g=>g.kind===kind);
    const looseAllocations=(data.allocations||[]).filter(a=>!(data.goals||[]).some(g=>g.id===a.goalId)&&(isDream?a.kind==='dream':['reserve','goal'].includes(a.kind)));
    const sumSaved=Math.max(0,n2(goals.reduce((s,g)=>s+g.saved,0)+looseAllocations.reduce((s,a)=>s+a.amount,0)));
    const sumTarget=n2(goals.reduce((s,g)=>s+g.target,0));
    return `${header('')}
      <section class="card proto-total-card"><h3>${icon(isDream?'sparkles':'target')} ${isDream?'Seu sonho':'Reserva e metas'}</h3><div class="proto-goal-total">${money(sumSaved)} <span>${sumTarget>0?`de ${money(sumTarget)}`:'registrados'}</span></div></section>
      ${!isDream?renderMonthlyReserve():''}
      ${goals.length?`<div class="proto-goals-grid${goals.length===1?' single':''}">${goals.map(g=>renderGoal(g)).join('')}</div>`:
      `<div class="card proto-empty-card">${empty(isDream?'Qual sonho você quer realizar? Toque em + para criar.':'Crie sua reserva ou uma meta de economia pelo botão +.',isDream?'sparkles':'target')}</div>`}
      ${renderAllocations(kind)}
      <p class="proto-note">Os valores guardados são informados por você e não alteram o saldo automaticamente.</p>`;
  }
  function renderMonthlyReserve() {
    const plan=savingPlan(currentMonth);
    return `<section class="card proto-saving-card"><div class="proto-saving-heading"><h3>${icon('target')} Aporte planejado · ${plan.percentual}%</h3><small>${esc(monthLabel(currentMonth))}</small></div>
      ${plan.grupos.length?plan.grupos.map(g=>`<div class="proto-saving-row"><span>${esc(g.categoria)} <small>(${plan.percentual}% de ${money(g.base)})</small></span><strong>${money(g.aporte)}</strong></div>`).join(''):'<p class="proto-note">Escolha categorias de renda em Ajustes para calcular um aporte.</p>'}
      <div class="proto-saving-total"><span>Total a separar</span><strong>${money(plan.total)}</strong></div>
      <p class="proto-note">Planejamento, não transferência automática. Categorias e percentual podem ser alterados em Ajustes.</p>
      ${reserveYieldEstimate()}
    </section>`;
  }
  function renderAllocations(kind){
    const data = getData();
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
      <div class="proto-goal-header"><span class="proto-goal-icon" aria-hidden="true">${icon(isDream?'sparkles':'target')}</span><div class="proto-goal-heading"><span class="proto-goal-type">${isDream?'SONHO':'META / RESERVA'}</span><h2>${esc(g.name)}</h2></div></div>
      <div class="proto-goal-progress"><div class="proto-goal-progress-label"><span>Progresso</span><strong>${pct}%</strong></div>
        <div class="proto-goal-track progress-bar progress-bar-large" role="progressbar" aria-label="Progresso de ${esc(g.name)}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pct}"><span class="proto-goal-fill progress-bar-fill" style="width:${pct}%"></span></div>
        <div class="proto-goal-info"><strong>${money(g.saved)}</strong><span>de ${money(g.target)}</span></div>
      </div>
      <div class="proto-goal-foot"><span>${left===0?'Objetivo alcançado!':`Faltam ${money(left)}`}</span><span>${esc(deadline)}</span></div>
      <div class="proto-goal-actions"><button type="button" class="button button-secondary" data-action="edit-goal" data-id="${esc(g.id)}">Atualizar valor</button><button type="button" class="button button-danger" data-action="delete-goal" data-id="${esc(g.id)}" aria-label="Excluir ${esc(g.name)}">${icon('trash')}</button></div>
    </article>`;
  }
  function openGoal(kind,id='') {
    const data = getData();
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
  function goalCandidates(kind){
    const data = getData();
    return data.goals.filter(g=>kind==='dream'?g.kind==='dream':g.kind==='goal'&&(kind==='reserve'?/reserva|emerg[eê]ncia/i.test(g.name):!/reserva|emerg[eê]ncia/i.test(g.name)));
  }
  return {renderGoals, progressLine, goalProgressPercent, openGoal, goalCandidates};
}
