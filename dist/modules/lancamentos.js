export function criarModuloLancamentos(ctx) {
  const {getData, getMonth, getSearch, getFilterCategory, transactionsInMonth,
    n2, categorySet, header, money, esc, CATEGORY_ICONS, fmtDate, parseDate,
    icon, transactionForm, transactionDialog, currentMonth, isoDate} = ctx;

  function entryList(items, emptyText) {
    return items.length ? items.map(renderEntry).join('') : `<div class="proto-empty">${esc(emptyText)}</div>`;
  }

  function renderTransactions(type) {
    const month = getMonth();
    const search = getSearch();
    const filterCategory = getFilterCategory();
    const isIncome=type==='income';
    const all=transactionsInMonth(month,type);
    const normalized=search.toLocaleLowerCase('pt-BR');
    const list=all.filter(t=>(!filterCategory||t.category===filterCategory)&&(!normalized||`${t.description} ${t.category}`.toLocaleLowerCase('pt-BR').includes(normalized)));
    const total=n2(all.reduce((sum,t)=>sum+t.amount,0));
    const categories=categorySet(type);
    return `${header('',true)}
      <section class="card proto-total-card"><div class="proto-total-heading">${isIncome?'💵':'🧾'} ${isIncome?'Renda do mês':'Despesas do mês'}</div><div class="proto-big-total" style="color:${isIncome?'var(--green)':'var(--red)'}">${money(total)}</div></section>
      ${all.length?`<div class="filter-panel"><input class="search-field" id="transaction-search" type="search" value="${esc(search)}" placeholder="Buscar lançamento" aria-label="Buscar lançamento"/><select id="transaction-category" aria-label="Filtrar categoria"><option value="">Todas as categorias</option>${categories.map(c=>`<option value="${esc(c)}" ${filterCategory===c?'selected':''}>${esc(c)}</option>`).join('')}</select></div>`:''}
      <section class="card proto-list-card"><h3>${isIncome?'Fontes de renda':'Transações recentes'}</h3>${entryList(list,all.length?'Nenhum resultado para esse filtro.':isIncome?'Adicione sua primeira renda pelo botão +.':'Adicione sua primeira despesa pelo botão +.')}</section>
      ${all.some(t=>t.recurring)?'<p class="section-note">↻ Itens recorrentes aparecem automaticamente nos meses seguintes.</p>':''}`;
  }
  function renderEntry(t) {
    const isIncome=t.type==='income';
    return `<div class="proto-item"><span class="proto-category-icon" aria-hidden="true">${CATEGORY_ICONS[t.category]||'💰'}</span><div class="proto-item-label"><strong>${esc(t.description)}</strong><small>${esc(t.category)} · ${fmtDate.format(parseDate(t.occurrence))}${t.recurring?' · Mensal':''}</small></div><span class="proto-item-value" style="color:${isIncome?'var(--green)':'var(--red)'}">${isIncome?'+':'−'}${money(t.amount)}</span><button class="proto-edit" type="button" data-action="edit" data-id="${esc(t.id)}" aria-label="Editar ${esc(t.description)}">${icon('edit')}</button><button class="proto-delete" type="button" data-action="delete" data-id="${esc(t.id)}" aria-label="Excluir ${esc(t.description)}">${icon('trash')}</button></div>`;
  }
  function openTransaction(type,id='') {
    const data = getData();
    const month = getMonth();
    const existing=id?data.transactions.find(t=>t.id===id):null;
    const form=transactionForm.elements;
    const effectiveType=existing?.type||type;
    form.namedItem('id').value=existing?.id||'';
    form.namedItem('description').value=existing?.description||'';
    form.namedItem('amount').value=existing?.amount??'';
    form.namedItem('date').value=existing?.date||(month===currentMonth?isoDate(new Date()):`${month}-01`);
    form.namedItem('recurring').checked=!!existing?.recurring;
    document.getElementById('transaction-recurring-warning').classList.toggle('hidden',!existing?.recurring);
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
  return {renderTransactions, renderEntry, openTransaction, setTransactionType};
}
