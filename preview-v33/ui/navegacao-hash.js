/* Rotas amigáveis: Voltar/Avançar do Android e desktop sem alterar o roteador v31. */
(function () {
  'use strict';
  // Uma rota Objetivos, mantendo #metas e #sonhos de versões antigas como aliases.
  const routeToView = Object.freeze({resumo:'resumo',movimentos:'renda',objetivos:'metas',ajustes:'ajustes'});
  const viewToRoute = Object.freeze({resumo:'resumo',renda:'movimentos',despesas:'movimentos',metas:'objetivos',ajustes:'ajustes'});
  const nav = document.getElementById('desktop-nav');
  if (!nav) return;
  let restoring = false;

  function fromHash() {
    const route = location.hash.replace(/^#/, '').toLocaleLowerCase('pt-BR');
    return Object.hasOwn(routeToView,route)||['metas','sonhos'].includes(route)?route:null;
  }
  function navigate(route) {
    const selector = `[data-view="${routeToView[route]||'metas'}"]`;
    const button = nav.querySelector(selector);
    if (!button) return false;
    restoring = true;
    button.click();
    if(route==='sonhos')queueMicrotask(()=>document.querySelector('[data-objective-tab="dream"]')?.click());
    queueMicrotask(() => { restoring = false; });
    return true;
  }
  function rememberRoute(view) {
    const route = viewToRoute[view];
    if (!route || restoring || fromHash() === route) return;
    try { history.pushState({ meuDinheiroRoute:route },'', `#${route}`); }
    catch (_) { /* Em navegadores que bloqueiam history, o app ainda navega. */ }
  }
  function restore() {
    const route = fromHash();
    if (route) navigate(route);
  }

  document.addEventListener('click', event => {
    const button = event.target.closest('[data-view]');
    if (!button) return;
    const expected = button.dataset.view;
    queueMicrotask(() => {
      const active = nav.querySelector('.nav-button.active')?.dataset.view;
      if (active === expected) rememberRoute(active);
    });
  });
  window.addEventListener('popstate',restore);
  window.addEventListener('hashchange',restore);
  if (fromHash()) restore();
  else {
    try { history.replaceState({ meuDinheiroRoute:'resumo' },'', '#resumo'); }
    catch (_) { /* Não afeta lançamento, saldo nem cadastro. */ }
  }
  window.MeuDinheiroV33Navegacao = Object.freeze({ routeCount:Object.keys(routeToView).length, fromHash });
})();
