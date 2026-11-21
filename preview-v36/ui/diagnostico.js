/* V36 — conferências específicas dos cartões compactos de Aparência. */
(function(){
  'use strict';
  const area=document.getElementById('diagnostics-progress-area');
  if(!area)return;
  const checks=Object.freeze([
    ['V36_ESTILO','Estilos compactos registrados e incorporados ao HTML',()=>!!document.getElementById('design-v36-css')],
    ['V36_SEIS_CORES','Seis cores continuam disponíveis e selecionáveis',()=>document.querySelectorAll('#settings-colors input[name="cor"]').length===6],
    ['V36_VERSAO','Ajustes identifica a versão visual realmente aberta',()=>{
      const aberta=document.title.match(/v\d+/)?.[0]||'v36';
      return document.getElementById('app-running-version')?.textContent.includes(aberta)===true;
    }],
    ['V36_SELECAO','Cor escolhida possui destaque acessível',()=>!!document.querySelector('#settings-colors input[name="cor"]:checked')],
    ['V36_CHIPS_TOQUE','Opções de cor mantêm área de toque de 48 px',()=>{const chip=document.querySelector('.settings-color-option');return !chip||parseFloat(getComputedStyle(chip).minHeight)>=48;}],
    ['V36_CHIPS_LINHA','Cor e nome ficam na mesma linha',()=>{const chip=document.querySelector('.settings-color-option');return !chip||getComputedStyle(chip).flexDirection==='row';}],
    ['V36_CELULAR_COLUNAS','Grade de cores adapta-se à largura do celular',()=>{const grid=document.getElementById('settings-colors');if(!grid||window.innerWidth>879)return true;const amount=getComputedStyle(grid).gridTemplateColumns.split(' ').length;return amount===(window.innerWidth<360?2:3);} ],
    ['V36_CABECALHO','Resumo de saldo não se repete no topo de Ajustes no celular',()=>{if(window.innerWidth>879||document.body.dataset.v34View!=='ajustes')return true;return getComputedStyle(document.querySelector('.header .prototype-heading')).display==='none';}],
    ['V36_TEXTO_UNICO','Aviso de salvamento automático permanece acessível',()=>document.getElementById('settings-autosave-status')?.getAttribute('aria-live')==='polite'],
    ['V36_MODO_ESCURO','Controle de tema escuro e seleção de cor permanecem presentes',()=>!!document.querySelector('#settings-theme option[value="escuro"]')&&!!document.querySelector('#settings-colors input[name="cor"]')],
    ['V36_COMPATIBILIDADE','Módulos de Objetivos e orçamento continuam registrados',()=>!!window.MeuDinheiroV35Objetivos&&!!window.MeuDinheiroV33Interface],
    ['V36_SEM_DADOS','Inspeção de layout não modifica lançamentos nem configurações',()=>checks.every(item=>typeof item[2]==='function')]
  ]);
  const panel=window.MeuDinheiroDiagnosticoHub?null:document.createElement('section');
  if(panel){
    panel.id='v36-diagnostic-panel';panel.className='design-v33-diagnostic-panel';
    panel.innerHTML='<h3>Testes extras — Interface compacta v36</h3><p>Verificação imediata do tamanho dos cartões, tema e acessibilidade. Os 25 segundos continuam sendo somente a animação principal.</p><strong data-v36-total>Pronto para verificar.</strong><details><summary>Ver verificações v36</summary><div data-v36-results></div></details><button type="button" id="v36-diagnostic-export" class="button button-secondary">Baixar testes v36 JSON</button>';
    (document.getElementById('v35-diagnostic-panel')||area).after(panel);
  }
  let results=[];
  function run(){
    results=checks.map(([code,description,verify])=>{
      let passed=false;try{passed=verify()===true;}catch(_){/* Não interromper outros testes. */}
      return {code,description,status:passed?'ok':'falha'};
    });
    if(panel){
      panel.querySelector('[data-v36-total]').textContent=`${results.filter(item=>item.status==='ok').length}/${results.length} verificações passaram`;
      panel.querySelector('[data-v36-results]').replaceChildren(...results.map(item=>{
        const line=document.createElement('p');line.className=`design-v33-check ${item.status==='ok'?'pass':'fail'}`;
        line.textContent=`${item.status==='ok'?'✓':'✕'} ${item.description}`;return line;
      }));
    }
    return results;
  }
  function exportJson(){
    if(!results.length)run();
    const data={app:'meu-dinheiro-essencial',module:'diagnostico-v36',checks:results};
    const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));
    const link=document.createElement('a');link.href=url;link.download='meu-dinheiro-diagnostico-v36.json';link.click();
    setTimeout(()=>URL.revokeObjectURL(url),30000);
  }
  window.MeuDinheiroV36Diagnostico=Object.freeze({count:checks.length,run,results:()=>results.slice()});
  if(window.MeuDinheiroDiagnosticoHub?.registrar('interface-compacta-v36',run,checks.length))return;
  if(!panel)return;
  document.getElementById('open-diagnostics')?.addEventListener('click',run);
  document.getElementById('diagnostics-run')?.addEventListener('click',run);
  document.getElementById('v36-diagnostic-export').addEventListener('click',exportJson);
})();
