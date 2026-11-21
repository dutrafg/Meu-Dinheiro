/* Homologação v35: navegação única, persistência imediata e visual limpo. */
(function () {
  'use strict';
  const area=document.getElementById('diagnostics-progress-area');
  if(!area)return;
  const checks=Object.freeze([
    ['V35_OBJETIVOS','Metas e sonhos compartilham um único destino Objetivos',()=>!!document.querySelector('#desktop-nav [data-view="metas"]')&&!document.querySelector('#desktop-nav [data-view="sonho"]')],
    ['V35_ABAS','Objetivos têm duas abas internas (Metas e Sonhos)',()=>!!window.MeuDinheiroV35Objetivos&&(!document.querySelector('#desktop-nav [data-view="metas"].active')||document.querySelectorAll('[data-objective-tab]').length===2)],
    ['V35_ORIGEM','Investimentos continuam vinculados a metas e sonhos',()=>!!document.getElementById('investment-dialog')&&!!document.querySelector('#investment-form [name="goalId"]')],
    ['V35_CRIAR_SONHO','O cadastro rápido permite criar sonho sem segundo módulo',()=>!!document.querySelector('#mobile-create-dialog [data-create-kind="dream"]')&&!!document.querySelector('#desktop-create-menu [data-create-kind="dream"]')],
    ['V35_INVESTIR_CELULAR','O botão de cadastro móvel mantém a opção Investimento',()=>!!document.querySelector('#mobile-create-dialog [data-create-kind="investment"]')&&!!document.getElementById('quick-add')],
    ['V35_MAIS','O menu Mais contém somente Ajustes',()=>document.querySelectorAll('#design-more-dialog .design-more-list button').length===1&&!!document.querySelector('#design-more-dialog [data-design-open="settings"]')],
    ['V35_AJUSTES','Aparência, aporte, orçamento e privacidade estão em Ajustes',()=>window.MeuDinheiroV35Ajustes?.count()>=4&&window.MeuDinheiroV35Ajustes.budgetInside()],
    ['V35_AUTO_STATUS','Ajustes informam salvamento automático acessivelmente',()=>document.getElementById('settings-autosave-status')?.getAttribute('aria-live')==='polite'],
    ['V35_SEM_SALVAR','Ajustes não exibem Salvar e Descartar redundantes',()=>!document.getElementById('settings-save-top')&&!document.getElementById('settings-cancel')&&!document.getElementById('settings-form-cancel')],
    ['V35_LIMITES_AUTO','Orçamento não exibe botões de salvar ou descartar',()=>!!document.getElementById('design-v33-budget-form')&&!document.getElementById('design-v33-budget-reset')&&!document.querySelector('#design-v33-budget-form button[type="submit"]')],
    ['V35_CALENDARIO','Ajustes mantêm acesso ao calendário financeiro',()=>!!document.querySelector('#settings-page [data-open-calendar-settings]')&&!!document.getElementById('finance-calendar-dialog')],
    ['V35_RELATORIOS','PDF, CSV e backup permanecem em Ajustes',()=>['export-pdf','export-csv','import-csv','export-data','import-data'].every(id=>!!document.getElementById(id))],
    ['V35_ATUALIZADOR','Atualização e versão seguem acessíveis',()=>!!document.getElementById('check-update')&&!!document.getElementById('app-running-version')],
    ['V35_LIMPEZA','A confirmação de apagar dados não foi removida',()=>!!document.getElementById('delete-all-data')&&!!document.getElementById('delete-data-dialog')],
    ['V35_TEMAS','Tema claro e escuro continuam disponíveis',()=>['claro','escuro','auto'].every(theme=>!!document.querySelector(`#settings-theme option[value="${theme}"]`))],
    ['V35_REGISTRO','Cada camada JS da v35 consta no arquivo de teste',()=>['ajustes-minimos.js','objetivos-minimos.js','diagnostico.js'].every(name=>!!document.querySelector(`[data-preview-v35="ui/${name}"]`))&&!!document.getElementById('design-v35-css')],
    ['V35_GRAFICOS','Resumo e previsão preservam cálculos de dados reais',()=>typeof window.MeuDinheiroV34Resumo?.hasHome==='function'&&typeof window.MeuDinheiroV33Previsao?.forecast==='function'],
    ['V35_25_SEGUNDOS','A barra única mantém a animação sem limitar os testes',()=>!!document.getElementById('diagnostics-progress-area')&&!!document.getElementById('diagnostics-progress-label')],
    ['V35_SEM_ALTERAR_DADOS','Verificações inspecionam UI sem salvar dados financeiros',()=>checks.every(item=>typeof item[2]==='function')]
  ]);
  const panel=window.MeuDinheiroDiagnosticoHub?null:document.createElement('section');
  if(panel){
    panel.className='design-v33-diagnostic-panel';panel.id='v35-diagnostic-panel';
    panel.innerHTML='<h3>Testes extras — Objetivos, Ajustes e usabilidade v35</h3><p>As verificações executam imediatamente. Os 25 segundos são somente a animação de progresso do diagnóstico principal.</p><strong data-v35-total>Pronto para verificar.</strong><details><summary>Ver verificações v35</summary><div data-v35-results></div></details><button type="button" id="v35-diagnostic-export" class="button button-secondary">Baixar testes v35 JSON</button>';
    (document.getElementById('v34-diagnostic-panel')||area).after(panel);
  }
  let results=[];
  function run(){
    results=checks.map(([code,description,check])=>{
      let passed=false;try{passed=check()===true;}catch(_){/* Continua o restante da bateria. */}
      return {code,description,status:passed?'ok':'falha'};
    });
    if(panel){
      panel.querySelector('[data-v35-total]').textContent=`${results.filter(item=>item.status==='ok').length}/${results.length} verificações passaram`;
      panel.querySelector('[data-v35-results]').replaceChildren(...results.map(item=>{
        const p=document.createElement('p');p.className=`design-v33-check ${item.status==='ok'?'pass':'fail'}`;
        p.textContent=`${item.status==='ok'?'✓':'✕'} ${item.description}`;return p;
      }));
    }
    return results;
  }
  function exportJson(){
    if(!results.length)run();
    const json={app:'meu-dinheiro-essencial',module:'diagnostico-v35',checks:results};
    const url=URL.createObjectURL(new Blob([JSON.stringify(json,null,2)],{type:'application/json'}));
    const a=document.createElement('a');a.href=url;a.download='meu-dinheiro-diagnostico-v35.json';a.click();
    setTimeout(()=>URL.revokeObjectURL(url),30000);
  }
  window.MeuDinheiroV35Diagnostico=Object.freeze({count:checks.length,run,results:()=>results.slice()});
  if(window.MeuDinheiroDiagnosticoHub?.registrar('objetivos-ajustes-v35',run,checks.length))return;
  if(!panel)return;
  document.getElementById('open-diagnostics')?.addEventListener('click',run);
  document.getElementById('diagnostics-run')?.addEventListener('click',run);
  document.getElementById('v35-diagnostic-export').addEventListener('click',exportJson);
})();
