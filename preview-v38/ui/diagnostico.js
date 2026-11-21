/* Testes de regressão da análise do relatório real de 21/11/2026, sem dados pessoais. */
(function(){
  'use strict';
  const hub=window.MeuDinheiroDiagnosticoHub;
  if(!hub)return;
  const checks=Object.freeze([
    ['V38_MODULOS','Seis conjuntos de testes registrados no diagnóstico único',()=>hub.quantidade()>=6],
    ['V38_VERSAO_MOTOR','Versões visual e do motor são identificadas separadamente',()=>/Prévia visual v38\s*·\s*motor v\d+/.test(document.getElementById('app-running-version')?.textContent||'')],
    ['V38_FUNDO_CSS','Fundo visível corresponde à variável CSS da paleta atual',()=>{
      const css=getComputedStyle(document.documentElement).getPropertyValue('--bg').trim();
      if(!/^#[0-9a-f]{6}$/i.test(css))return false;
      const rgb=`rgb(${[1,3,5].map(i=>parseInt(css.slice(i,i+2),16)).join(', ')})`;
      const atual=getComputedStyle(document.body).backgroundColor;
      return atual.replace(/\s+/g,'')===rgb.replace(/\s+/g,'');
    }],
    ['V38_CONTRASTE_V33','Teste de contraste aceita #fff e preserva a exigência de 4,5:1',()=>{
      const resultado=window.MeuDinheiroV33Diagnostico?.results?.()||[];
      return ['V33_TEMA_TEXTO','V33_TEMA_SUB'].every(codigo=>resultado.find(item=>item.code===codigo)?.status==='ok');
    }],
    ['V38_RELATORIOS','Ferramentas PDF e backup são identificáveis nos Ajustes',()=>{
      const titulo=document.querySelector('.settings-tools summary')?.textContent||'';
      return /PDF/i.test(titulo)&&/backup/i.test(titulo)&&!!document.getElementById('export-pdf')&&!!document.getElementById('export-data');
    }],
    ['V38_EXPORTACAO','Existe só um botão de exportação do diagnóstico',()=>document.querySelectorAll('#diagnostics-dialog #diagnostics-export').length===1],
    ['V38_CALENDARIO','Calendário original e módulo de navegação continuam presentes',()=>!!document.getElementById('finance-calendar-dialog')&&!!document.getElementById('mobile-nav')]
  ]);
  function run(){
    return checks.map(([code,description,test])=>{
      let ok=false;try{ok=test()===true;}catch(_){/* A falha é informada sem expor dados financeiros. */}
      return {code,description,status:ok?'ok':'falha'};
    });
  }
  hub.registrar('regressoes-relatorio-v38',run,checks.length);
  window.MeuDinheiroV38Diagnostico=Object.freeze({count:checks.length,run});
})();
