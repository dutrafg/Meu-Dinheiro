/* Objetivos unifica visualmente Meta e Sonho, sem migrar ou alterar os registros. */
(function () {
  'use strict';
  const content=document.getElementById('view-content');
  if(!content)return;
  const money=new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'});
  const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const today=()=>{const now=new Date();return `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;};
  function guidance(goal,todayISO=today()){
    const missing=Math.max(0,Math.round((Number(goal.target)-Number(goal.saved))*100)/100);
    if(missing<=0)return {status:'Concluído',monthly:''};
    if(!/^\d{4}-\d{2}-\d{2}$/.test(goal.deadline||''))return {status:'Em andamento',monthly:'Defina um prazo para planejar os aportes.'};
    if(goal.deadline<todayISO)return {status:'Prazo vencido',monthly:'Ajuste o prazo para recalcular o aporte mensal.'};
    const current=todayISO.slice(0,7),deadline=goal.deadline.slice(0,7);
    const months=(Number(deadline.slice(0,4))-Number(current.slice(0,4)))*12+Number(deadline.slice(5))-Number(current.slice(5));
    const installment=missing/Math.max(1,months+(goal.deadline.slice(8)>=todayISO.slice(8)?1:0));
    return {status:'Em andamento',monthly:`Guardar ${money.format(installment)}/mês para alcançar o objetivo.`};
  }
  function data(){try{return JSON.parse(localStorage.getItem('meu-dinheiro-essencial:v1')||'{}');}catch(_){return {};}}
  function decorate(){
    if(!content.querySelector('[data-v32-goal-tabs]'))return;
    const snapshot=data();
    const goals=Array.isArray(snapshot.goals)?snapshot.goals:[];
    const allocations=Array.isArray(snapshot.allocations)?snapshot.allocations:[];
    for(const card of content.querySelectorAll('.proto-goal-card:not([data-v35-goal])')){
      const id=card.querySelector('[data-action="add-investment"]')?.dataset.id;
      const goal=goals.find(item=>item.id===id);
      if(!goal)continue;
      const info=guidance(goal);
      const badge=document.createElement('p');badge.className='v35-goal-guidance';
      badge.innerHTML=`<span class="v35-status" data-state="${info.status==='Concluído'?'done':info.status==='Prazo vencido'?'late':'active'}">${esc(info.status)}</span>${info.monthly?`<span>${esc(info.monthly)}</span>`:''}`;
      card.querySelector('.proto-goal-header')?.after(badge);
      const investments=allocations.filter(item=>item.goalId===id).sort((a,b)=>b.date.localeCompare(a.date)).slice(0,3);
      if(investments.length){
        const history=document.createElement('details');history.className='v35-goal-history';
        history.innerHTML=`<summary>Últimos aportes (${investments.length})</summary>${investments.map(item=>`<div class="v35-aporte-line"><span>${esc(item.date.split('-').reverse().join('/'))} · ${item.origin==='salary'?'Do salário':'Já guardado'}</span><strong>${esc(money.format(item.amount))}</strong><button type="button" data-action="edit-investment" data-id="${esc(item.id)}" aria-label="Editar aporte de ${esc(item.date)}">Editar</button></div>`).join('')}`;
        card.append(history);
      }
      card.dataset.v35Goal='';
    }
    const grid=content.querySelector('.proto-goals-grid');
    const plan=content.querySelector('.proto-saving-card');
    if(plan&&!plan.closest('.v35-plan-detail')){
      const wrapper=document.createElement('details');wrapper.className='v35-plan-detail';
      const summary=document.createElement('summary');summary.textContent='Planejamento de aporte · detalhes';
      plan.before(wrapper);wrapper.append(summary,plan);
      if(grid)grid.after(wrapper);
      else content.querySelector('.proto-empty-card')?.after(wrapper);
    }
    if(grid)content.querySelector('.proto-total-card')?.classList.add('v35-duplicate-total');
  }
  new MutationObserver(decorate).observe(content,{childList:true});
  decorate();
  window.MeuDinheiroV35Objetivos=Object.freeze({guidance,decorate,unified:()=>!document.querySelector('#desktop-nav [data-view="sonho"]')});
})();
