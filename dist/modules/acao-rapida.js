// Ação rápida isolada: botão compacto no celular e menu de criação no desktop.
export const TIPOS_CRIACAO_RAPIDA=Object.freeze(['income','expense','goal','dream','investment']);

export function acaoMovelParaVisao(visao){
  switch(visao){
    case 'metas':return {tipo:'goal',rotulo:'Criar meta'};
    case 'sonho':return {tipo:'dream',rotulo:'Criar sonho'};
    case 'despesas':return {tipo:'expense',rotulo:'Adicionar despesa'};
    case 'renda':return {tipo:'income',rotulo:'Adicionar renda'};
    default:return {tipo:'income',rotulo:'Adicionar renda ou despesa'};
  }
}

export function iniciarAcaoRapida({getView,openTransaction,openGoal,openInvestment,documento=document}){
  const botaoMovel=documento.getElementById('quick-add');
  const botaoDesktop=documento.getElementById('desktop-create-trigger');
  const grupoDesktop=documento.getElementById('desktop-create-wrap');
  const menu=documento.getElementById('desktop-create-menu');

  function fecharMenu(){
    menu.classList.add('hidden');
    botaoDesktop.setAttribute('aria-expanded','false');
  }
  function selecionar(tipo){
    if(!TIPOS_CRIACAO_RAPIDA.includes(tipo))return false;
    fecharMenu();
    if(tipo==='income'||tipo==='expense')openTransaction(tipo);
    else if(tipo==='investment')openInvestment();
    else openGoal(tipo);
    return true;
  }
  function atualizar(visao=getView()){
    const indisponivel=visao==='ajustes';
    botaoMovel.classList.toggle('hidden',indisponivel);
    grupoDesktop.classList.toggle('hidden',indisponivel);
    botaoMovel.setAttribute('aria-label',acaoMovelParaVisao(visao).rotulo);
    fecharMenu();
  }

  botaoMovel.addEventListener('click',()=>{
    if(getView()==='ajustes')return;
    selecionar(acaoMovelParaVisao(getView()).tipo);
  });
  botaoDesktop.addEventListener('click',()=>{
    if(getView()==='ajustes')return;
    if(menu.classList.contains('hidden')){
      menu.classList.remove('hidden');
      botaoDesktop.setAttribute('aria-expanded','true');
      menu.querySelector('[data-create-kind]')?.focus();
    }else fecharMenu();
  });
  menu.addEventListener('click',event=>{
    const opcao=event.target.closest('[data-create-kind]');
    if(opcao)selecionar(opcao.dataset.createKind);
  });
  documento.addEventListener('click',event=>{
    if(!grupoDesktop.contains(event.target))fecharMenu();
  });
  documento.addEventListener('keydown',event=>{
    if(event.key!=='Escape'||menu.classList.contains('hidden'))return;
    fecharMenu();botaoDesktop.focus();
  });
  return {atualizar,selecionar,fecharMenu};
}
