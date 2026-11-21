const assert=require('node:assert/strict');
const test=require('node:test');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const read=relative=>fs.readFileSync(path.join(__dirname,'..',relative),'utf8');
const carregar=async()=>{
  const objetivos=read('dist/modules/objetivos.js').replace(/^export /gm,'');
  const diagnostico=read('dist/modules/diagnostico-proposta.js').replace(/^import .*$/gm,'');
  return import(`data:text/javascript;base64,${Buffer.from(`${objetivos}\n${diagnostico}`).toString('base64')}`);
};

function elementoDeTeste(){
  let markup='';
  return {
    set innerHTML(valor){markup=valor;},get innerHTML(){return markup;},
    querySelectorAll(){
      return [...markup.matchAll(/<(?:div|span)\b[^>]*\brole="progressbar"[^>]*>/g)].map(match=>({
        getAttribute:nome=>match[0].match(new RegExp(`\\b${nome}="([^"]*)"`))?.[1]||null,
        querySelector:()=>({style:{width:markup.slice(match.index+match[0].length)
          .match(/<(?:div|span)\b[^>]*\bclass="[^"]*progress-bar-fill[^"]*"[^>]*style="width:([^"]+)"/)?.[1]||''}})
      }));
    }
  };
}

function ambiente({css=true,dark=true,nav=true}={}){
  const make=()=>({querySelector:()=>({}),contains:()=>true,classList:{contains:()=>true}});
  const root={};
  const dom=new Map(['desktop-nav','mobile-nav','main-content','settings-page','settings-form','quick-add','view-content',
    'open-diagnostics','i-settings','diagnostics-checks','settings-title','backup-menu-button'].map(id=>[id,make()]));
  dom.delete('backup-menu-button');
  dom.get('settings-title').textContent='Ajustes';
  dom.get('open-diagnostics').textContent='Executar diagnóstico completo';
  dom.get('open-diagnostics').closest=()=>null;
  dom.get('open-diagnostics').querySelector=()=>({});
  dom.get('desktop-nav').querySelector=selector=>nav?{}:null;
  dom.get('mobile-nav').querySelector=selector=>nav?{}:null;
  dom.get('diagnostics-checks').classList.contains=name=>name==='diagnostics-groups';
  const bar={style:{background:'var(--goal-accent)'},getAttribute:n=>n==='role'?'progressbar':n==='aria-valuenow'?'25':null};
  const rules={
    '.progress-bar':{'height':'10px'},'.progress-bar-large':{'height':'12px'},
    '.proto-progress.goal':{'--goal-accent':'var(--green)'},
    '.proto-progress.dream':{'--goal-accent':'var(--purple)'},
    '.proto-progress .bar>div':{'background':'var(--goal-accent)'},
    '.proto-goal-card':{'--goal-accent':'var(--green)'},
    '.proto-goal-card.dream':{'--goal-accent':'var(--purple)'},
    '.proto-goal-fill':{'background':'var(--goal-accent)'},
    '.progress-bar-fill':{'animation':'progress-reveal .5s ease-out'},
    '.diagnostics-progress::after':{'background-image':'linear-gradient(...)'}
  };
  const cssRules=Object.entries(rules).map(([selectorText,values])=>({selectorText,
    style:{getPropertyValue:n=>values[n]||''},parentRule:selectorText==='.progress-bar-fill'?{conditionText:'(prefers-reduced-motion:reduce)'}:null}));
  const documento={documentElement:root,
    getElementById:id=>dom.get(id)||null,
    querySelector:selector=>selector==='.proto-progress .bar>div'||selector==='.proto-progress .bar'?bar:{},
    createElement:()=>elementoDeTeste(),
    styleSheets:css?[{cssRules}]:[]};
  const janela={getComputedStyle:el=>el===root?{
    colorScheme:dark?'dark':'light',getPropertyValue:n=>n==='--accent-text'?'#8fb7ff':n==='--card'?'#1d1e23':''
  }:{borderRadius:'50%'}};
  return {documento,janela,padrao:{tema:'auto',cor:'azul'}};
}

test('Checklist cobre cada item da proposta, com resultado próprio por requisito',async()=>{
  const {REQUISITOS_PROPOSTA,avaliarRequisitosProposta}=await carregar();
  assert.ok(REQUISITOS_PROPOSTA.length>=20);
  assert.equal(new Set(REQUISITOS_PROPOSTA.map(item=>item[0])).size,REQUISITOS_PROPOSTA.length);
  const resultado=avaliarRequisitosProposta({NAV_AJUSTES_DESKTOP:true,TEMA_AZUL:false});
  assert.equal(resultado.total,REQUISITOS_PROPOSTA.length);
  assert.equal(resultado.implementados,1);
  assert.equal(resultado.pendentes,1);
  assert.equal(resultado.naoAvaliados,resultado.total-2);
  assert.ok(resultado.itens.every(item=>item.codigo.startsWith('PROPOSTA_')&&item.modulo==='proposta-interface'));
  assert.ok(resultado.itens.every(item=>['ok','pendente','nao_avaliado'].includes(item.estado)));
});

test('Uma interface com todos os recursos previstos satisfaz o checklist',async()=>{
  const {verificarPropostaInterface}=await carregar();
  const resultado=verificarPropostaInterface(ambiente());
  assert.equal(resultado.pendentes,0);
  assert.equal(resultado.naoAvaliados,0);
  assert.equal(resultado.implementados,resultado.total);
});

test('Metas de exemplo verificam acessibilidade sem exigir registros financeiros reais',async()=>{
  const {testarAcessibilidadeMetasExemplo,verificarPropostaInterface}=await carregar();
  const mock=ambiente();
  assert.equal(testarAcessibilidadeMetasExemplo(mock.documento),true);
  const relatorio=verificarPropostaInterface(mock);
  assert.equal(relatorio.itens.find(i=>i.codigo==='PROPOSTA_BARRAS_ACESSIVEIS').estado,'ok');
  assert.equal(relatorio.implementados,22);
});

test('A auditoria reconhece seletores normalizados pelo navegador e detecta CSS semanticamente inválido',async()=>{
  const {verificarPropostaInterface}=await carregar();
  const mock=ambiente();
  const regras=mock.documento.styleSheets[0].cssRules;
  const regraBarra=regras.find(r=>r.selectorText==='.proto-progress .bar>div');
  regraBarra.selectorText='.proto-progress .bar > div';
  assert.equal(verificarPropostaInterface(mock).itens.find(i=>i.codigo==='PROPOSTA_BARRAS_CORES').estado,'ok');
  regraBarra.style.getPropertyValue=()=> 'var(--red)';
  assert.equal(verificarPropostaInterface(mock).itens.find(i=>i.codigo==='PROPOSTA_BARRAS_CORES').estado,'pendente');
});

test('Teste de exemplo informa falha real ou indisponibilidade do DOM, sem gravar em armazenamento',async()=>{
  const {testarAcessibilidadeMetasExemplo}=await carregar();
  assert.equal(testarAcessibilidadeMetasExemplo({}),undefined);
  assert.equal(testarAcessibilidadeMetasExemplo({createElement:()=>({querySelectorAll:()=>[]})}),false);
  const mock=ambiente();
  let criada=0;
  const original=mock.documento.createElement;
  mock.documento.createElement=()=>{criada++;return original();};
  assert.equal(testarAcessibilidadeMetasExemplo(mock.documento),true);
  assert.equal(criada,1,'Apenas um nó de diagnóstico desconectado é criado');
});

test('Falhas reais na navegação e alterações de padrão aparecem como pendências, não erros',async()=>{
  const {verificarPropostaInterface}=await carregar();
  const mock=ambiente({nav:false});
  mock.padrao.cor='verde';
  const r=verificarPropostaInterface(mock);
  assert.equal(r.itens.find(i=>i.codigo==='PROPOSTA_NAV_AJUSTES_DESKTOP').estado,'pendente');
  assert.equal(r.itens.find(i=>i.codigo==='PROPOSTA_TEMA_AZUL').estado,'pendente');
  assert.ok(r.pendentes>=3);
  assert.ok(r.itens.every(i=>i.estado!=='erro'&&i.estado!=='aviso'));
});

test('Navegador sem CSSOM e tema claro declara checagens visuais não avaliadas',async()=>{
  const {verificarPropostaInterface}=await carregar();
  const r=verificarPropostaInterface(ambiente({css:false,dark:false}));
  for(const codigo of ['BARRAS_ALTURAS','BARRAS_ANIMACAO','DIAGNOSTICO_ETAPAS','TEMA_CONTRASTE_ESCURO'])
    assert.equal(r.itens.find(i=>i.codigo===`PROPOSTA_${codigo}`).estado,'nao_avaliado');
});

test('Ausência de DOM não causa falso alarme no diagnóstico independente',async()=>{
  const {verificarPropostaInterface}=await carregar();
  assert.equal(verificarPropostaInterface({}),null);
  assert.equal(verificarPropostaInterface({documento:{getElementById:()=>({})}}),null);
});

test('A nova área permanece no DOM durante a troca de telas e possui controles acessíveis',()=>{
  const html=read('dist/index.html');const app=read('dist/app.js');
  assert.match(html,/<main id="main-content"[^>]*><div id="view-content"/);
  assert.match(html,/<section id="settings-page" class="settings-page hidden"/);
  assert.match(html,/<button type="button" id="open-diagnostics"><svg aria-hidden="true"><use href="#i-activity"\/>/);
  assert.match(html,/<symbol id="i-settings"/);
  assert.match(app,/\['ajustes', 'Ajustes', 'settings'\]/);
  assert.match(app,/if\(view==='ajustes'\)ajustes\.abrir\(\)/);
  assert.match(app,/acaoRapida\.atualizar\(view\)/);
  assert.doesNotMatch(app,/ultimaVisaoFinanceira/);
  assert.match(html,/id="pdf-report-type"/);
  assert.doesNotMatch(html,/id="backup-menu-button"|id="settings-dialog"/);
});

test('Barras seguem um componente visual único, indicador por módulo e movimento reduzido',()=>{
  const css=read('dist/css/progresso.css');const html=read('dist/index.html');
  assert.match(css,/\.progress-bar\{height:10px/);
  assert.match(css,/\.progress-bar-large\{height:12px/);
  assert.match(css,/@keyframes progress-reveal/);
  assert.match(css,/@media\(prefers-reduced-motion:reduce\)/);
  assert.match(css,/\.diagnostics-progress::after/);
  assert.match(html,/id="diagnostics-checks" class="diagnostics-checks diagnostics-groups"/);
  assert.match(read('dist/modules/diagnostico.js'),/function anexarResultado\(item\)/);
  assert.match(read('dist/modules/objetivos.js'),/role="progressbar" aria-label="Progresso de/);
});

test('Tema azul novo não altera preferências gravadas e adapta contraste de texto no escuro',async()=>{
  const prefs=await import(`data:text/javascript;base64,${Buffer.from(read('dist/modules/preferencias.js')).toString('base64')}`);
  assert.equal(prefs.preferenciasPadrao().cor,'azul');
  const storage={getItem:()=>JSON.stringify({...prefs.preferenciasPadrao(),cor:'verde'}),setItem:()=>{}};
  assert.equal(prefs.criarGestorPreferencias({storage}).obter().cor,'verde');
  const css=read('dist/css/ajustes.css');
  for(const cor of ['verde','roxo','laranja','rosa','turquesa'])
    assert.ok(css.includes(`:root[data-theme="escuro"][data-accent="${cor}"]{--accent-text:`));
  assert.match(css,/:root\[data-theme="escuro"\]\{--accent-text:#8fb7ff\}/);
  assert.match(css,/color:var\(--accent-text\)/);
  const luminancia=cor=>{
    const canais=[1,3,5].map(i=>parseInt(cor.slice(i,i+2),16)/255).map(n=>n<=.04045?n/12.92:((n+.055)/1.055)**2.4);
    return canais[0]*.2126+canais[1]*.7152+canais[2]*.0722;
  };
  const fundo=luminancia('#1d1e23');
  for(const cor of ['#8fb7ff','#6be0ae','#c4a2ff','#ffb476','#ff8eb4','#69dce5'])
    assert.ok((luminancia(cor)+.05)/(fundo+.05)>=4.5,`Contraste escuro insuficiente: ${cor}`);
});

test('Diagnóstico trata proposta como categoria separada de erros e avisa sobre itens pendentes',()=>{
  const codigo=read('dist/modules/diagnostico.js');
  assert.match(codigo,/propostaInterface=verificarPropostaInterface/);
  assert.match(codigo,/integridade\.itens\.push\(\.\.\.propostaInterface\.itens\)/);
  assert.match(codigo,/formatoRelatorio:3/);
  assert.match(codigo,/propostaInterface:propostaInterface\?/);
  assert.match(codigo,/melhorias pendentes/);
  assert.match(read('dist/index.html'),/Itens <strong>pendentes<\/strong> da proposta visual/);
});

test('Relatório principal incorpora o checklist sem classificar propostas pendentes como falhas',async()=>{
  const {avaliarRequisitosProposta}=await carregar();
  const codigo=read('dist/modules/investimentos.js').replace(/^import .*$/gm,'').replace(/^export /gm,'')+'\n'+
    read('dist/modules/calendario-financeiro.js').replace(/^import .*$/gm,'').replace(/^export /gm,'')+'\n'+
    read('dist/modules/diagnostico.js').replace(/^import .*$/gm,'').replace(/^export /gm,'');
  const verificar=()=>({itens:[],erros:0,avisos:0});
  const gerar=async(comProposta)=>{
    const contexto={Date,Intl,Blob,verificarIntegridade:verificar,
      auditarCodigoPublicado:async()=>({disponivel:false,motivo:'Sem fontes nesta simulação'}),
      verificarPropostaInterface:()=>comProposta?avaliarRequisitosProposta({TEMA_AUTO:true,TEMA_AZUL:false}):null,
      preferenciasPadrao:()=>({tema:'auto',cor:'azul'}),navigator:{userAgent:'Browser teste',serviceWorker:{}},
      window:{},localStorage:{getItem:()=>null}};
    vm.runInNewContext(`${read('dist/modules/resumo.js').replace(/^export /gm,'')}\n${read('dist/modules/validacao.js').replace(/^export /gm,'')}\n${read('dist/modules/limpeza-dados.js').replace(/^import .*$/gm,'').replace(/^export /gm,'')}\n${read('dist/modules/dialogos.js').replace(/^export /gm,'')}\n${read('dist/modules/concorrencia-dados.js').replace(/^export /gm,'')}\n${read('dist/modules/ciclo-periodo.js').replace(/^export /gm,'')}\n${codigo}\nthis.criar=criarRelatorioDiagnostico;`,contexto);
    return contexto.criar({getData:()=>({transactions:[],goals:[],allocations:[],completedAportes:[]}),CATEGORIES:{income:[],expense:[]}});
  };
  const sem=await gerar(false),com=await gerar(true);
  assert.equal(com.propostaInterface.total,22);
  assert.equal(com.propostaInterface.pendentes,1);
  assert.equal(com.integridade.erros,sem.integridade.erros);
  assert.equal(com.integridade.avisos,sem.integridade.avisos);
  assert.equal(com.integridade.itens.filter(i=>i.modulo==='proposta-interface').length,22);
  assert.ok(com.duracaoPrevistaMs<=25000);
  assert.doesNotMatch(JSON.stringify(com),/nome da pessoa|R\$ 741|CPF/);
});
