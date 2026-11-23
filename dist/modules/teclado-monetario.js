// Entrada móvel opcional. O campo number continua editável pelo teclado físico.
const LIMITE_CENTAVOS=99999999900;
const formato=new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'});

export function aplicarTeclaMonetaria(valorAtual,tecla){
  const atual=Number(valorAtual);
  if(!Number.isFinite(atual)||atual<0)return null;
  const centavos=Math.round(atual*100);
  let proximo;
  if(tecla==='backspace')proximo=Math.floor(centavos/10);
  else if(tecla==='00')proximo=centavos*100;
  else if(/^\d$/.test(tecla))proximo=centavos*10+Number(tecla);
  else return null;
  if(!Number.isSafeInteger(proximo)||proximo>LIMITE_CENTAVOS)return null;
  return (proximo/100).toFixed(2);
}

export function iniciarTecladoMonetario({dialog,form,categorySet,icones,esc}){
  const campo=form?.elements?.namedItem?.('amount');
  const categoria=form?.elements?.namedItem?.('category');
  if(!dialog?.addEventListener||!campo||!categoria)return {atualizar:()=>{}};
  const visor=dialog.querySelector?.('#transaction-keypad-display');
  const tiles=dialog.querySelector?.('#transaction-category-tiles');
  const atualizarVisor=()=>{if(visor)visor.textContent=formato.format(Number(campo.value)||0);};
  const atualizarSelecao=()=>{
    tiles?.querySelectorAll?.('[data-mobile-category]').forEach(button=>{
      const ativo=button.dataset.mobileCategory===categoria.value;
      button.classList.toggle('is-selected',ativo);
      button.setAttribute('aria-pressed',String(ativo));
    });
  };
  function atualizar(tipo){
    atualizarVisor();
    if(!tiles)return;
    const categorias=categorySet(tipo);
    // Mostra até oito atalhos. O select mantém sempre todas as categorias.
    const preferencias=categorias.includes(categoria.value)?[categoria.value]:[];
    const visiveis=[...new Set([...preferencias,...categorias])].slice(0,8);
    tiles.innerHTML=visiveis.map(nome=>`<button type="button" data-mobile-category="${esc(nome)}" aria-pressed="false"><span aria-hidden="true">${icones[nome]||'📌'}</span><small>${esc(nome)}</small></button>`).join('');
    atualizarSelecao();
  }
  dialog.addEventListener('click',event=>{
    const tecla=event.target.closest?.('[data-money-key]');
    if(tecla&&dialog.contains(tecla)){
      const novo=aplicarTeclaMonetaria(campo.value||'0',tecla.dataset.moneyKey);
      if(novo!==null){campo.value=novo;campo.dispatchEvent(new Event('input',{bubbles:true}));atualizarVisor();}
      return;
    }
    const tile=event.target.closest?.('[data-mobile-category]');
    if(tile&&dialog.contains(tile)){
      categoria.value=tile.dataset.mobileCategory;
      categoria.dispatchEvent(new Event('change',{bubbles:true}));
      atualizarSelecao();
    }
  });
  campo.addEventListener('input',atualizarVisor);
  categoria.addEventListener('change',atualizarSelecao);
  return {atualizar};
}
