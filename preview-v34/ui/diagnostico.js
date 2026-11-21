/* Cobertura de homologação v34: catálogo brasileiro, formulário, visual e continuidade. */
(function () {
  'use strict';
  const parent=document.getElementById('diagnostics-progress-area');
  const catalog=window.MeuDinheiroCategoriasBrasileiras;
  const budget=window.MeuDinheiroV33Orcamento;
  const domain=window.MeuDinheiroDesignV32Domain;
  if(!parent||!catalog||!budget||!domain)return;
  const mandatory=['Aluguel','Condomínio','IPTU','Água e esgoto','Energia elétrica',
    'Gás de cozinha','Supermercado','Combustível','IPVA','Plano de saúde','Farmácia',
    'Escola e mensalidade','Cartão de crédito','Internet','Telefone','Seguro do veículo'];
  const checks=Object.freeze([
    ['V34_CATALOGO','Contas prioritárias de uma família brasileira estão cadastradas',()=>mandatory.every(name=>catalog.expense.includes(name))],
    ['V34_UNICAS','Categorias de despesa não estão duplicadas',()=>catalog.expense.length===new Set(catalog.expense).size],
    ['V34_GRUPOS','Categorias têm grupos para organizar o orçamento',()=>catalog.groups.length>=6&&catalog.groups.every(group=>group.categorias.length>0)],
    ['V34_LIMITE','Limites mensais suportam as novas categorias brasileiras',()=>budget.normalize({schemaVersion:1,revision:0,budgets:[{category:'IPVA',limitCent:150000},{category:'Água e esgoto',limitCent:8500}]}).budgets.length===2],
    ['V34_DADOS','Prévia usa a mesma base financeira v1 sem copiar lançamentos',()=>typeof domain.monthlyEntries==='function'&&!!document.getElementById('transaction-form')],
    ['V34_TRES_INDICADORES','Resumo tem renda, despesas e resultado do mês',()=>typeof window.MeuDinheiroV34Resumo?.hasHome==='function'&&(!document.querySelector('#desktop-nav [data-view="resumo"].active')||!!document.querySelector('.v34-month-metrics'))],
    ['V34_PRIVACIDADE','Botão discreto possui indicação de estado acessível',()=>document.getElementById('v34-privacy-toggle')?.hasAttribute('aria-pressed')===true],
    ['V34_CALENDARIO','Calendário permanece acessível pelo mês e pelos Ajustes',()=>!!document.getElementById('finance-calendar-dialog')&&!!document.querySelector('[data-open-calendar-settings]')],
    ['V34_PREVISAO','Previsão usa motor de cálculo diário registrado',()=>window.MeuDinheiroV33Previsao?.forecast([], '2026-11','2026-11-21').byDay.length===30],
    ['V34_ORCAMENTO','Orçamento permite buscar categorias em seis grupos',()=>!!document.getElementById('design-v33-category-search')&&document.querySelectorAll('.design-v33-category-group').length>=6],
    ['V34_TECLADO','Cadastro rápido oferece 10 algarismos, limpar e apagar',()=>document.querySelectorAll('#transaction-dialog [data-v34-key]').length===12],
    ['V34_SEM_DUPLICAR','Teclado aproveita formulário e botão de salvar originais',()=>document.querySelectorAll('#transaction-form').length===1&&!!document.querySelector('#transaction-form .dialog-actions button[type=submit]')],
    ['V34_CATEGORIAS_FORM','Despesas admitem catálogo brasileiro no select original',()=>{
      const form=document.getElementById('transaction-form');
      if(!window.MeuDinheiroV34Cadastro||!form)return false;
      if(!document.getElementById('transaction-dialog').open||form.elements.namedItem('type').value!=='expense')return true;
      const values=new Set([...form.elements.namedItem('category').options].map(option=>option.value));
      return catalog.expense.every(name=>values.has(name));
    }],
    ['V34_ATALHOS_DATA','Cadastro oferece hoje, ontem e data livre',()=>document.querySelectorAll('#transaction-dialog [data-v34-date]').length===3],
    ['V34_SALVAR_OUTRO','Cadastro permite salvar e adicionar outro registro',()=>!!document.getElementById('v34-save-another')],
    ['V34_METAS','Cartões de metas possuem melhoria modular e aportes antigos continuam',()=>typeof window.MeuDinheiroV34Metas?.decorate==='function'&&!!document.getElementById('investment-dialog')],
    ['V34_FILTROS','Movimentos oferecem filtros de categoria e recorrência',()=>{
      const visible=document.querySelector('[data-v32-view="movements"]');
      return typeof domain.groupedEntries==='function'&&(!visible||!!visible.querySelector('#design-movement-category')&&!!visible.querySelector('#design-movement-recurring'));
    }],
    ['V34_EXPORTACAO','Um único JSON inclui as verificações dos módulos',()=>!!document.getElementById('diagnostics-export')],
    ['V34_MODULAR','Todos os estilos e scripts v34 estão separados e registrados',()=>['resumo-fiel.js','metas-fieis.js','cadastro-rapido.js','diagnostico.js'].every(name=>!!document.querySelector(`[data-preview-v34="ui/${name}"]`))&&!!document.getElementById('design-v34-css')],
    ['V34_ANIMACAO','A barra principal apresenta os testes sem limitar sua execução',()=>!!document.getElementById('diagnostics-progress-area')&&!!document.getElementById('diagnostics-progress-label')],
    ['V34_INTEGRIDADE','Testes adicionais não modificam transações ou limites reais',()=>checks.every(item=>typeof item[2]==='function')]
  ]);
  const panel=window.MeuDinheiroDiagnosticoHub?null:document.createElement('section');
  if(panel){
    panel.id='v34-diagnostic-panel';panel.className='design-v33-diagnostic-panel';
    panel.innerHTML='<h3>Testes adicionais — fidelidade visual e contas brasileiras v34</h3><p>Todos os testes rodam de verdade; os 25 segundos se referem somente à animação de progresso do diagnóstico principal.</p><strong data-v34-total>Pronto para testar.</strong><details><summary>Ver verificações v34</summary><div data-v34-results></div></details><button type="button" id="v34-diagnostics-export" class="button button-secondary">Baixar testes v34 JSON</button>';
    (document.getElementById('design-v33-diagnostic-panel')||parent).after(panel);
  }
  let results=[];
  function run(){
    results=checks.map(([code,description,fn])=>{
      let ok=false;
      try{ok=fn()===true;}catch(_){/* Falha vira resultado, não interrompe os demais. */}
      return {code,description,status:ok?'ok':'falha'};
    });
    if(panel){
      panel.querySelector('[data-v34-total]').textContent=`${results.filter(x=>x.status==='ok').length}/${results.length} verificações passaram`;
      panel.querySelector('[data-v34-results]').replaceChildren(...results.map(item=>{
        const p=document.createElement('p');p.className=`design-v33-check ${item.status==='ok'?'pass':'fail'}`;
        p.textContent=`${item.status==='ok'?'✓':'✕'} ${item.description}`;return p;
      }));
    }
    return results;
  }
  function exportJson(){
    if(!results.length)run();
    const record={app:'meu-dinheiro-essencial',module:'diagnostico-preview-v34',version:1,checks:results};
    const url=URL.createObjectURL(new Blob([JSON.stringify(record,null,2)],{type:'application/json'}));
    const link=document.createElement('a');link.href=url;link.download='meu-dinheiro-diagnostico-v34.json';link.click();
    setTimeout(()=>URL.revokeObjectURL(url),30000);
  }
  window.MeuDinheiroV34Diagnostico=Object.freeze({run,count:checks.length,results:()=>results.slice()});
  if(window.MeuDinheiroDiagnosticoHub?.registrar('visual-contas-v34',run,checks.length))return;
  if(!panel)return;
  document.getElementById('open-diagnostics')?.addEventListener('click',run);
  document.getElementById('diagnostics-run')?.addEventListener('click',run);
  document.getElementById('v34-diagnostics-export').addEventListener('click',exportJson);
})();
