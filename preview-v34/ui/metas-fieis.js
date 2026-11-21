/* Aproxima os objetivos reais dos mockups: anel de progresso sem criar dados. */
(function () {
  'use strict';
  const content=document.getElementById('view-content');
  if(!content)return;
  function decorate() {
    for(const card of content.querySelectorAll('.proto-goal-card:not([data-v34-goal])')){
      const progress=card.querySelector('.proto-goal-track[aria-valuenow]');
      if(!progress)continue;
      const percent=Math.max(0,Math.min(100,Number(progress.getAttribute('aria-valuenow'))||0));
      const ring=document.createElement('div');
      ring.className='v34-goal-ring';
      ring.style.setProperty('--goal-progress',`${percent}%`);
      ring.setAttribute('role','img');
      ring.setAttribute('aria-label',`${percent}% do objetivo alcançado`);
      const center=document.createElement('span');
      const number=document.createElement('strong');number.textContent=`${percent}%`;
      const caption=document.createElement('small');caption.textContent='concluído';
      center.append(number,caption);ring.append(center);
      card.querySelector('.proto-goal-progress')?.prepend(ring);
      const invest=card.querySelector('[data-action="add-investment"]');
      if(invest){const svg=invest.querySelector('svg')?.outerHTML||'';invest.innerHTML=`${svg} Aportar`;}
      const edit=card.querySelector('[data-action="edit-goal"]');
      if(edit)edit.textContent='Ajustar';
      card.dataset.v34Goal='';
    }
  }
  new MutationObserver(decorate).observe(content,{childList:true});
  decorate();
  window.MeuDinheiroV34Metas=Object.freeze({hasRing:()=>!!content.querySelector('.v34-goal-ring'),decorate});
})();
