/* Ajustes como central única: navegação enxuta, seções recolhíveis e sem salvar/descartar. */
(function () {
  'use strict';
  const settings=document.getElementById('settings-page');
  const form=document.getElementById('settings-form');
  if(!settings||!form)return;
  const runningVersion=document.getElementById('app-running-version');
  if(runningVersion)runningVersion.textContent=`Prévia visual v35 · motor ${runningVersion.textContent.trim()||'v31'}`;

  function wrapSection(section,title,open=false,extraClass=''){
    if(!section||section.parentElement?.classList.contains('v35-settings-panel'))return null;
    const details=document.createElement('details');
    details.className=`settings-section v35-settings-panel ${extraClass}`;
    details.open=open;
    const summary=document.createElement('summary');
    summary.textContent=title;
    const heading=section.querySelector('h3');
    heading?.remove();
    section.before(details);
    section.classList.add('v35-inner-section');
    details.append(summary,section);
    return details;
  }

  const sections=[...form.querySelectorAll(':scope > section.settings-section')];
  wrapSection(sections[0],'Aparência',true,'v35-appearance');
  wrapSection(sections[1],'Planejamento do aporte',false,'v35-planning');

  const budget=document.getElementById('design-v33-budget-settings');
  if(budget&&!budget.closest('.v35-budget-wrapper')){
    const details=document.createElement('details');
    details.className='settings-section v35-settings-panel v35-budget-wrapper';
    const summary=document.createElement('summary');summary.textContent='Orçamento por categoria';
    budget.before(details);details.append(summary,budget);
  }

  const tools=settings.querySelector('details.settings-tools');
  if(tools&&!settings.querySelector('.v35-privacy-panel')){
    const details=document.createElement('details');
    details.className='settings-section v35-settings-panel v35-privacy-panel';
    const summary=document.createElement('summary');summary.textContent='Privacidade';
    const line=document.createElement('p');
    line.textContent='O modo discreto oculta os valores do Resumo neste dispositivo.';
    const button=document.createElement('button');
    button.type='button';button.className='button button-secondary';button.id='v35-privacy-action';
    button.textContent='Alternar visibilidade dos valores';
    button.addEventListener('click',()=>document.getElementById('v34-privacy-toggle')?.click());
    details.append(summary,line,button);tools.before(details);
  }

  window.MeuDinheiroV35Ajustes=Object.freeze({
    count:()=>settings.querySelectorAll('.v35-settings-panel').length,
    budgetInside:()=>!!settings.querySelector('.v35-budget-wrapper #design-v33-budget-form')
  });
})();
