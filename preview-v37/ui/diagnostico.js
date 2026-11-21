/* O próprio unificador também participa da única bateria de testes. */
(function(){
  'use strict';
  const hub=window.MeuDinheiroDiagnosticoHub;
  if(!hub)return;
  const checks=Object.freeze([
    ['V37_REGISTRO','As cinco camadas originais e suas sucessoras estão registradas no núcleo',()=>hub.quantidade()>=5],
    ['V37_SEM_PAINEIS','A janela não duplica painéis das versões anteriores',()=>!['design-v33-diagnostic-panel','v34-diagnostic-panel','v35-diagnostic-panel','v36-diagnostic-panel'].some(id=>document.getElementById(id))],
    ['V37_EXPORTACAO_UNICA','Um botão baixa o relatório completo',()=>document.querySelectorAll('#diagnostics-dialog #diagnostics-export').length===1&&!document.querySelector('[id$="diagnostic-export"], [id$="diagnostics-export"]:not(#diagnostics-export)')],
    ['V37_RESULTADO_UNICO','As verificações aparecem na lista principal agrupadas por módulo',()=>!!document.getElementById('diagnostics-checks')&&!!document.getElementById('diagnostics-summary')],
    ['V37_PROGRESO','A barra principal de progresso continua acessível',()=>document.getElementById('diagnostics-progress')?.getAttribute('role')==='progressbar'],
    ['V37_VERSAO','A versão da prévia unificada aparece em Ajustes',()=>{
      const aberta=/v\d+/.exec(document.title)?.[0];
      return Boolean(aberta&&document.getElementById('app-running-version')?.textContent.includes(aberta));
    }],
    ['V37_CADASTRO','Renda, despesa e investimento continuam disponíveis no celular',()=>['income','expense','investment'].every(id=>!!document.querySelector(`#mobile-create-dialog [data-create-kind="${id}"]`))],
    ['V37_PRIVACIDADE','A exportação não requer informações financeiras pessoais',()=>!!document.querySelector('#diagnostics-dialog .diagnostics-privacy')&&checks.every(item=>typeof item[2]==='function')]
  ]);
  function run(){
    return checks.map(([code,description,test])=>{
      let ok=false;try{ok=test()===true;}catch(_){/* Falhas são informadas no relatório. */}
      return {code,description,status:ok?'ok':'falha'};
    });
  }
  hub.registrar('diagnostico-unificado-v37',run,checks.length);
  window.MeuDinheiroV37Diagnostico=Object.freeze({count:checks.length,run});
})();
