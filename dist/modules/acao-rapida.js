// Ação rápida isolada: mesmo catálogo de cadastros no desktop e no celular.
import {cliqueForaDoDialogo} from './dialogos.js';
export const TIPOS_CRIACAO_RAPIDA=Object.freeze(['income','expense','goal','dream','investment']);

export function acaoMovelParaVisao(visao,objetivoAtual='goal'){
  switch(visao){
    case 'metas':return objetivoAtual==='dream'?{tipo:'dream',rotulo:'Criar sonho'}:{tipo:'goal',rotulo:'Criar meta'};
    case 'sonho':return {tipo:'dream',rotulo:'Criar sonho'};
    case 'despesas':return {tipo:'expense',rotulo:'Adicionar despesa'};
    case 'renda':return {tipo:'income',rotulo:'Adicionar renda'};
    default:return {tipo:'income',rotulo:'Adicionar renda ou despesa'};
  }
}

export function iniciarAcaoRapida({getView,getObjectiveKind=()=> 'goal',openTransaction,openGoal,openInvestment,documento=document}){
  const botaoMovel=documento.getElementById('quick-add');
  const botaoDesktop=documento.getElementById('desktop-create-trigger');
  const grupoDesktop=documento.getElementById('desktop-create-wrap');
  const menu=documento.getElementById('desktop-create-menu');
  const dialogoMovel=documento.getElementById('mobile-create-dialog');

  function fecharMenu(){
    menu.classList.add('hidden');
    botaoDesktop.setAttribute('aria-expanded','false');
  }
  function fecharMenuMovel(){
    if(dialogoMovel.open)dialogoMovel.close();
    botaoMovel.setAttribute('aria-expanded','false');
  }
  function abrirMenuMovel(){
    if(getView()==='ajustes'||dialogoMovel.open)return false;
    const preferido=acaoMovelParaVisao(getView(),getObjectiveKind()).tipo;
    dialogoMovel.querySelectorAll('[data-create-kind]').forEach(opcao=>{
      opcao.classList.toggle('is-context',opcao.dataset.createKind===preferido);
    });
    fecharMenu();
    dialogoMovel.showModal();
    botaoMovel.setAttribute('aria-expanded','true');
    dialogoMovel.querySelector(`[data-create-kind="${preferido}"]`)?.focus();
    return true;
  }
  function selecionar(tipo){
    if(!TIPOS_CRIACAO_RAPIDA.includes(tipo))return false;
    fecharMenu();
    fecharMenuMovel();
    if(tipo==='income'||tipo==='expense')openTransaction(tipo);
    else if(tipo==='investment')openInvestment();
    else openGoal(tipo);
    return true;
  }
  function atualizar(visao=getView()){
    const indisponivel=visao==='ajustes'||visao==='relatorios';
    botaoMovel.classList.toggle('hidden',indisponivel);
    grupoDesktop.classList.toggle('hidden',indisponivel);
    botaoMovel.setAttribute('aria-label',`Abrir opções de cadastro; sugestão: ${acaoMovelParaVisao(visao,getObjectiveKind()).rotulo.toLowerCase()}`);
    fecharMenu();
    fecharMenuMovel();
  }

  botaoMovel.addEventListener('click',abrirMenuMovel);
  dialogoMovel.addEventListener('click',event=>{
    if(cliqueForaDoDialogo(event,dialogoMovel)){fecharMenuMovel();return;}
    const opcao=event.target.closest?.('[data-create-kind]');
    if(opcao&&dialogoMovel.contains(opcao))selecionar(opcao.dataset.createKind);
  });
  dialogoMovel.addEventListener('close',()=>botaoMovel.setAttribute('aria-expanded','false'));
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
  return {atualizar,selecionar,fecharMenu,abrirMenuMovel,fecharMenuMovel};
}
