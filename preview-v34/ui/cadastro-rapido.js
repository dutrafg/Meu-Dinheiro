/* Melhoria progressiva do formulário v31: teclado, chips e datas, sem duplicar o salvamento. */
(function () {
  'use strict';
  const dialog=document.getElementById('transaction-dialog');
  const form=document.getElementById('transaction-form');
  if(!dialog||!form)return;
  const amount=form.elements.namedItem('amount');
  const date=form.elements.namedItem('date');
  const category=form.elements.namedItem('category');
  const description=form.elements.namedItem('description');
  let repeatAfterSave=false;

  function iso(date) {return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;}
  const choices={
    expense:['Supermercado','Transporte','Água e esgoto','Energia elétrica','Outros'],
    income:['Salário base','Personal','Renda extra','Benefícios','Outros']
  };
  function chips() {
    const type=form.elements.namedItem('type').value||'expense';
    const target=document.getElementById('v34-category-chips');
    if(!target)return;
    target.innerHTML=(choices[type]||choices.expense).map(name=>`<button type="button" data-v34-category="${name}" aria-pressed="${category.value===name}">${name}</button>`).join('')+
      '<button type="button" data-v34-category-more>Mais…</button>';
  }
  function refreshDates() {
    const today=new Date(),yesterday=new Date(today.getFullYear(),today.getMonth(),today.getDate()-1);
    for(const button of document.querySelectorAll('[data-v34-date]')){
      const match=button.dataset.v34Date==='today'?date.value===iso(today):button.dataset.v34Date==='yesterday'?date.value===iso(yesterday):date.value!==iso(today)&&date.value!==iso(yesterday);
      button.setAttribute('aria-pressed',String(match));
    }
  }
  function refreshAmount() {
    const pretty=document.getElementById('v34-keypad-value');
    if(!pretty)return;
    const number=Number(amount.value)||0;
    pretty.textContent=new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(number);
  }
  function keypad(key) {
    let cents=Math.max(0,Math.round((Number(amount.value)||0)*100));
    if(key==='clear')cents=0;
    else if(key==='back')cents=Math.floor(cents/10);
    else if(/^\d$/.test(key))cents=Math.min(99999999900,cents*10+Number(key));
    amount.value=(cents/100).toFixed(2);
    amount.dispatchEvent(new Event('input',{bubbles:true}));
    refreshAmount();
  }

  // Reaproveita o input number e o submit original; qualquer erro continua no motor v31.
  const toggle=form.querySelector('#transaction-type-toggle');
  const amountLabel=amount.closest('label');
  if(toggle&&amountLabel)toggle.after(amountLabel);
  amountLabel?.classList.add('v34-amount-label');
  const value=document.createElement('div');
  value.className='v34-keypad-value';value.id='v34-keypad-value';value.setAttribute('aria-hidden','true');
  amountLabel?.before(value);
  const chipsBox=document.createElement('section');
  chipsBox.className='v34-category-selector';
  chipsBox.innerHTML='<h3>Categoria</h3><div id="v34-category-chips" class="v34-category-chips"></div>';
  const descriptionLabel=description.closest('label');
  if(descriptionLabel)descriptionLabel.before(chipsBox);
  const dateChips=document.createElement('div');
  dateChips.className='v34-date-shortcuts';
  dateChips.innerHTML='<button type="button" data-v34-date="today">Hoje</button><button type="button" data-v34-date="yesterday">Ontem</button><button type="button" data-v34-date="other">Outra data</button>';
  date.closest('.two-col')?.before(dateChips);
  const pad=document.createElement('div');pad.className='v34-keypad';
  pad.setAttribute('aria-label','Teclado numérico para o valor');
  pad.innerHTML=['1','2','3','4','5','6','7','8','9','clear','0','back'].map(key=>
    `<button type="button" data-v34-key="${key}" aria-label="${key==='clear'?'Limpar valor':key==='back'?'Apagar dígito':key}">${key==='clear'?'C':key==='back'?'⌫':key}</button>`).join('');
  amount.closest('label')?.after(pad);
  const actions=form.querySelector('.dialog-actions');
  if(actions){const button=document.createElement('button');button.type='button';button.id='v34-save-another';button.className='v34-save-another';button.textContent='Salvar e adicionar outro';actions.after(button);}

  dialog.addEventListener('click',event=>{
    const digit=event.target.closest('[data-v34-key]');
    if(digit){keypad(digit.dataset.v34Key);return;}
    const chip=event.target.closest('[data-v34-category]');
    if(chip){category.value=chip.dataset.v34Category;chips();return;}
    if(event.target.closest('[data-v34-category-more]')){
      try{category.showPicker?.();}catch(_){category.focus();}
      return;
    }
    const shortcut=event.target.closest('[data-v34-date]');
    if(shortcut){
      const now=new Date();
      if(shortcut.dataset.v34Date==='today')date.value=iso(now);
      else if(shortcut.dataset.v34Date==='yesterday')date.value=iso(new Date(now.getFullYear(),now.getMonth(),now.getDate()-1));
      else try{date.showPicker?.();}catch(_){date.focus();}
      date.dispatchEvent(new Event('change',{bubbles:true}));refreshDates();return;
    }
    if(event.target.closest('#v34-save-another')){
      if(form.elements.namedItem('id').value)return;
      repeatAfterSave=true;
      form.requestSubmit();
      // Validação HTML bloqueia submit; não deixa o modo repetir preso.
      if(!form.checkValidity())repeatAfterSave=false;
    }
  });
  dialog.addEventListener('change',event=>{if(event.target===category)chips();if(event.target===date)refreshDates();});
  amount.addEventListener('input',refreshAmount);
  document.addEventListener('click',event=>{
    if(event.target.closest('[data-trans-type]'))queueMicrotask(chips);
  });
  form.addEventListener('submit',()=>{
    if(!repeatAfterSave)return;
    const type=form.elements.namedItem('type').value;
    queueMicrotask(()=>{
      const succeeded=!dialog.open;
      repeatAfterSave=false;
      if(succeeded)document.querySelector(`#mobile-create-dialog [data-create-kind="${type}"]`)?.click();
    });
  });
  const dialogObserver=new MutationObserver(()=>{
    if(dialog.open){chips();refreshDates();refreshAmount();document.getElementById('v34-save-another').hidden=!!form.elements.namedItem('id').value;}
  });
  dialogObserver.observe(dialog,{attributes:true,attributeFilter:['open']});
  chips();refreshDates();refreshAmount();
  window.MeuDinheiroV34Cadastro=Object.freeze({hasKeypad:()=>!!document.querySelector('[data-v34-key]'),categoryCount:()=>category.options.length});
})();
