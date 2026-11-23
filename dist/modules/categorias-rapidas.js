// Categorias de renda/despesa no celular: o valor sempre usa o campo nativo.
export function categoriasVisiveis(categorias,selecionada){
  const lista=Array.isArray(categorias)?categorias:[];
  const inicio=lista.includes(selecionada)?[selecionada]:[];
  return [...new Set([...inicio,...lista])].slice(0,8);
}

export function iniciarCategoriasRapidas({dialog,form,categorySet,icones,esc}){
  const categoria=form?.elements?.namedItem?.('category');
  const tiles=dialog?.querySelector?.('#transaction-category-tiles');
  if(!dialog?.addEventListener||!categoria||!tiles)return {atualizar:()=>{}};

  const atualizarSelecao=()=>{
    tiles.querySelectorAll('[data-mobile-category]').forEach(button=>{
      const ativo=button.dataset.mobileCategory===categoria.value;
      button.classList.toggle('is-selected',ativo);
      button.setAttribute('aria-pressed',String(ativo));
    });
  };
  function atualizar(tipo){
    const visiveis=categoriasVisiveis(categorySet(tipo),categoria.value);
    tiles.innerHTML=visiveis.map(nome=>`<button type="button" data-mobile-category="${esc(nome)}" aria-pressed="false"><span aria-hidden="true">${icones[nome]||'📌'}</span><small>${esc(nome)}</small></button>`).join('');
    atualizarSelecao();
  }
  dialog.addEventListener('click',event=>{
    const tile=event.target.closest?.('[data-mobile-category]');
    if(tile&&dialog.contains(tile)){
      categoria.value=tile.dataset.mobileCategory;
      categoria.dispatchEvent(new Event('change',{bubbles:true}));
      atualizarSelecao();
    }
  });
  categoria.addEventListener('change',atualizarSelecao);
  return {atualizar};
}
