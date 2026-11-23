const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const read = file=>fs.readFileSync(path.join(__dirname,'..',file),'utf8');
const semModulos = file=>read(file).replace(/^import .*$/gm,'').replace(/^export \{.*\} from .*$/gm,'').replace(/^export /gm,'');
const semImports = file=>(file==='dist/modules/diagnostico.js'?
  `const verificarPropostaInterface=()=>null;const preferenciasPadrao=()=>({tema:"auto",cor:"azul"});\n${semModulos('dist/modules/motor-financeiro.js')}\n${semModulos('dist/modules/dominio-objetivos.js')}\n${semModulos('dist/modules/resumo.js')}\n${semModulos('dist/modules/validacao.js')}\n${semModulos('dist/modules/limpeza-dados.js')}\n${semModulos('dist/modules/dialogos.js')}\n${semModulos('dist/modules/concorrencia-dados.js')}\n${semModulos('dist/modules/ciclo-periodo.js')}\n`:'')+
  (file==='dist/modules/diagnostico.js'?semModulos('dist/modules/dominio-investimentos.js')+'\n'+semModulos('dist/modules/investimentos.js')+'\n'+
    read('dist/modules/calendario-financeiro.js').replace(/^import .*$/gm,'').replace(/^export /gm,'')+'\n':'')+
  read(file).replace(/^import .*$/gm,'').replace(/^export /gm,'');
const dados = ()=>({
  transactions:[{id:'id-1',description:'Despesa CPF 123.456.789-00',type:'expense',amount:741.59,date:'2026-11-05',category:'Alimentação',recurring:false,createdAt:'2026-11-05T12:00:00.000Z'}],
  goals:[{id:'meta-1',kind:'goal',name:'Viagem particular',target:5000,saved:700,deadline:''}],
  allocations:[],completedAportes:[]
});
const CATEGORIES={income:['Salário'],expense:['Alimentação']};

async function integridade() {
  const {normalizarDadosLocais,validarDataISO}=await import(`data:text/javascript;base64,${Buffer.from(read('dist/modules/validacao.js')).toString('base64')}`);
  return new Function('normalizarDadosLocais','validarDataISO',`${semImports('dist/modules/integridade.js')}\nreturn verificarIntegridade;`)(normalizarDadosLocais,validarDataISO);
}

test('Integridade verifica estrutura, IDs e vínculos sem modificar os dados', async()=>{
  const verificar=await integridade();
  const valor=dados();
  const original=JSON.stringify(valor);
  const result=verificar(valor,CATEGORIES);
  assert.equal(result.erros,0);
  assert.equal(result.avisos,0);
  assert.equal(JSON.stringify(valor),original);

  valor.transactions.push({...valor.transactions[0]});
  valor.allocations.push({id:'aplicacao',description:'Aplicação',amount:50,date:'2026-11-05',kind:'goal',goalId:'inexistente'});
  valor.transactions[0].category='Não mapeada';
  const alterado=verificar(valor,CATEGORIES);
  assert.equal(alterado.erros,2);
  assert.equal(alterado.avisos,2);
  assert.equal(alterado.itens.find(item=>item.codigo==='IDENTIFICADORES').estado,'erro');
});

test('Logger guarda no máximo 50 códigos e não aceita conteúdo financeiro arbitrário',()=>{
  const values=new Map();
  const sessionStorage={getItem:key=>values.get(key)||null,setItem:(key,value)=>values.set(key,value)};
  const context={sessionStorage,Date,window:{addEventListener:()=>{}}};
  vm.runInNewContext(`${semImports('dist/modules/log.js')}\nthis.logApi={registrar,registrarEvento,configurarDetalhado,obterLogs};`,context);
  const {registrar,registrarEvento,configurarDetalhado,obterLogs}=context.logApi;
  assert.equal(registrar('erro','SALDO_741.59 CPF 123','dados'),false);
  assert.equal(registrar('erro','CORRETO','pasta-pessoal'),false);
  assert.equal(registrarEvento('ABRIU_FORMULARIO','interface'),false);
  configurarDetalhado(true);
  assert.equal(registrarEvento('ABRIU_FORMULARIO','interface'),true);
  for(let i=0;i<80;i++)registrar('info',`TESTE_${i}`,'sistema');
  const entries=obterLogs();
  assert.equal(entries.length,50);
  assert.equal(entries.at(-1).codigo,'TESTE_79');
  assert.ok(entries.every(item=>Object.keys(item).sort().join(',')==='codigo,modulo,nivel,t'));
  assert.doesNotMatch(JSON.stringify(entries),/741\.59|CPF|pasta-pessoal/);
  assert.ok(values.size>0);
});

test('Logger descarta entradas antigas adulteradas e mantém dados somente na sessão',()=>{
  const values=new Map([['meu-dinheiro-essencial:diagnostico-sessao',JSON.stringify([
    {t:'2026-11-18T00:00:00.000Z',nivel:'erro',codigo:'CODIGO_VALIDO',modulo:'dados',mensagem:'segredo'},
    {t:'2026-11-18T00:00:00.000Z',nivel:'erro',codigo:'PIX VALOR 2500',modulo:'dados'}
  ])]]);
  const context={sessionStorage:{getItem:key=>values.get(key),setItem:(key,value)=>values.set(key,value)},Date};
  vm.runInNewContext(`${semImports('dist/modules/log.js')}\nthis.obter=obterLogs;`,context);
  assert.equal(context.obter().length,1);
  assert.equal(context.obter()[0].codigo,'CODIGO_VALIDO');
  assert.equal('mensagem' in context.obter()[0],false);
});

test('Relatório inclui apenas contagens e estado técnico, sem valores ou nomes pessoais',async()=>{
  const verificar=await integridade();
  const raw=JSON.stringify(dados());
  const context={
    verificarIntegridade:verificar,Date,Intl,Blob,
    auditarCodigoPublicado:async()=>({disponivel:false,motivo:'Prévia de teste sem fontes externas'}),
    navigator:{userAgent:'TesteBrowser 1.0',language:'pt-BR',storage:{estimate:async()=>({usage:1234,quota:10000})},serviceWorker:{controller:{},getRegistration:async()=>({active:{},waiting:{}})}},
    window:{innerWidth:390,innerHeight:844,matchMedia:()=>({matches:true}),MeuDinheiroCSV:{importCSV:()=>{}},MeuDinheiroAnalytics:{expenseCategoryStats:()=>{}},MeuDinheiroFolderBackup:{createBrowserManager:()=>{}}},
    localStorage:{getItem:()=>raw},caches:{keys:async()=>['outra-app','meu-dinheiro-essencial-v12']}
  };
  vm.runInNewContext(`${semImports('dist/modules/diagnostico.js')}\nthis.criar=criarRelatorioDiagnostico;`,context);
  const report=await context.criar({getData:dados,CATEGORIES,getFolderState:()=>({state:'saved',folder:'/Usuários/Ana/Finanças',lastSavedAt:new Date('2026-11-18T16:00:00Z')}),
    getUpdateStatus:()=>({ultimaVerificacao:1763510400000}),obterLogs:()=>[{t:'2026-11-18T00:00:00.000Z',nivel:'erro',codigo:'PWA_VERIFICACAO_FALHOU',modulo:'pwa'}]});
  assert.ok(report.integridade.itens.length>=65,`Inventário insuficiente: ${report.integridade.itens.length} testes`);
  assert.equal(report.integridade.erros,0);
  for(const codigo of ['LIMPEZA_CHAVE_EXCLUSIVA','LIMPEZA_ORDEM_BACKUP','LIMPEZA_FALHA_SEGURA','LIMPEZA_FRASE_EXATA'])
    assert.equal(report.integridade.itens.find(item=>item.codigo===codigo)?.estado,'ok',codigo);
  for(const codigo of ['CALENDARIO_DIAS_E_DATAS','CALENDARIO_MISTURA_CORES','CALENDARIO_CENTAVOS',
    'CALENDARIO_SELETOR_MES','CALENDARIO_NAVEGACAO_MENSAL','CALENDARIO_MES_SEM_MOVIMENTO',
    'INVESTIMENTO_EDICAO_DELTA','INVESTIMENTO_EDICAO_ORIGEM',
    'INVESTIMENTO_EDICAO_OBJETIVO','INVESTIMENTO_EDICAO_SALDO_NEGATIVO'])
    assert.equal(report.integridade.itens.find(item=>item.codigo===codigo)?.estado,'ok',codigo);
  for(const codigo of ['BACKUP_ROUNDTRIP_LEGADO','BACKUP_CATEGORIA_SEGURA','BACKUP_VOLUME_SINTETICO',
    'INVESTIMENTO_LIMITE_SALARIO','INVESTIMENTO_ORFAO_SALARIO','PERIODO_VIRADA_AUTOMATICA',
    'DIALOGO_BORDA_SEGURA','DADOS_ABAS_CONFLITO'])
    assert.equal(report.integridade.itens.find(item=>item.codigo===codigo)?.estado,'ok',codigo);
  assert.equal(report.dados.lancamentos,1);
  assert.equal(report.dados.metas,1);
  assert.equal(report.backup.pastaConectada,true);
  assert.equal(report.atualizador.atualizacaoPendente,true);
  assert.ok(report.atualizador.versoesCache.includes('meu-dinheiro-essencial-v12'));
  assert.ok(report.dados.tamanhoDadosBytes>0);
  const json=JSON.stringify(report);
  for(const forbidden of ['741.59','123.456.789-00','Despesa CPF','Viagem particular','/Usuários/Ana/Finanças'])assert.ok(!json.includes(forbidden),forbidden);
});

test('Diagnóstico realmente detecta contraste insuficiente das cores aplicadas',async()=>{
  const raiz={dataset:{theme:'claro',accent:'azul'}},corpo={};
  const cores={'--bg':'#f5f6f8','--card':'#fff','--sub':'#5d626b',
    '--green-text':'#0b754e','--green-bg':'#e3f7ee','--red-text':'#aa2820',
    '--red-bg':'#fce8e6','--accent':'#2563eb','--accent-text':'#2563eb','--accent-hover':'#1d4ed8'};
  const context={Date,Intl,Blob,TEMAS:['auto','claro','escuro'],CORES:{azul:'#2563eb'},
    verificarIntegridade:()=>({itens:[],erros:0,avisos:0}),
    auditarCodigoPublicado:async()=>({disponivel:false,motivo:'Ambiente de teste'}),
    navigator:{userAgent:'Teste'},document:{documentElement:raiz,body:corpo,getElementById:()=>null,querySelector:()=>null},
    window:{matchMedia:()=>({matches:false}),getComputedStyle:elemento=>elemento===raiz?
      {getPropertyValue:chave=>cores[chave]||'',colorScheme:'light'}:{backgroundColor:'rgb(245, 246, 248)'}},
    localStorage:{getItem:()=>null}};
  vm.runInNewContext(`${semImports('dist/modules/diagnostico.js')}\nthis.criar=criarRelatorioDiagnostico;`,context);
  const gerar=()=>context.criar({getData:()=>({transactions:[],goals:[],allocations:[],completedAportes:[]}),
    CATEGORIES:{income:['Salário'],expense:['Outros']},getPreferences:()=>({tema:'claro',cor:'azul',percentual:10,
      categoriasAporte:['Salário'],reservaGoalId:''})});
  const extrair=(relatorio,codigo)=>relatorio.integridade.itens.find(item=>item.codigo===codigo)?.estado;
  const correto=await gerar();
  for(const codigo of ['CONTRASTE_TEXTO_SECUNDARIO','CONTRASTE_RECEITAS_CARD','CONTRASTE_RECEITAS_FUNDO',
    'CONTRASTE_DESPESAS_CARD','CONTRASTE_DESPESAS_FUNDO','CONTRASTE_NAVEGACAO'])
    assert.equal(extrair(correto,codigo),'ok',codigo);
  cores['--green-text']='#b0b0b0';
  cores['--red-text']='#ffbaba';
  const incorreto=await gerar();
  for(const codigo of ['CONTRASTE_RECEITAS_CARD','CONTRASTE_RECEITAS_FUNDO',
    'CONTRASTE_DESPESAS_CARD','CONTRASTE_DESPESAS_FUNDO'])
    assert.equal(extrair(incorreto,codigo),'erro',codigo);
});

test('Diagnóstico testa regressões reais de importação CSV e fórmulas exportadas',async()=>{
  const csv=require('../dist/csv.js');
  const context={Date,Intl,Blob,verificarIntegridade:()=>({itens:[],erros:0,avisos:0}),
    auditarCodigoPublicado:async()=>({disponivel:false,motivo:'Ambiente de teste'}),
    navigator:{userAgent:'Teste'},window:{MeuDinheiroCSV:csv},localStorage:{getItem:()=>null}};
  vm.runInNewContext(`${semImports('dist/modules/diagnostico.js')}\nthis.criar=criarRelatorioDiagnostico;`,context);
  const report=await context.criar({getData:()=>({transactions:[],goals:[],allocations:[],completedAportes:[]}),
    CATEGORIES:{income:['Salário','Outros'],expense:['Outros','Transporte','Cursos']}});
  for(const codigo of ['CSV_TIPO_RECEBIMENTO','CSV_CATEGORIAS_FALSOS_POSITIVOS','CSV_FORMULA_PROTEGIDA'])
    assert.equal(report.integridade.itens.find(item=>item.codigo===codigo)?.estado,'ok',codigo);
});

test('Diagnóstico não falha se armazenamento, Cache API e Service Worker não estiverem disponíveis',async()=>{
  const verificar=await integridade();
  const context={verificarIntegridade:verificar,Date,Intl,Blob,
    auditarCodigoPublicado:async()=>({disponivel:false,motivo:'Prévia de teste sem fontes externas'}),
    navigator:{userAgent:'Teste'},window:{},localStorage:{getItem:()=>{throw Error('bloqueado');}}};
  vm.runInNewContext(`${semImports('dist/modules/diagnostico.js')}\nthis.criar=criarRelatorioDiagnostico;`,context);
  const result=await context.criar({getData:dados,CATEGORIES});
  assert.equal(result.dados.tamanhoDadosBytes,null);
  assert.equal(result.ambiente.recursos.localStorage,false);
  assert.equal(result.atualizador.registrado,false);
});

test('Diagnóstico verifica que o calendário permanece recolhido e tem componentes separados',async()=>{
  const modal={id:'finance-calendar-dialog',open:false};
  const elementos={'finance-calendar-dialog':modal,'finance-calendar-content':{id:'finance-calendar-content'},
    'calendar-day-dialog':{id:'calendar-day-dialog'},'calendar-day-title':{id:'calendar-day-title'},
    'calendar-day-content':{id:'calendar-day-content'}};
  const context={Date,Intl,Blob,verificarIntegridade:()=>({itens:[],erros:0,avisos:0}),
    auditarCodigoPublicado:async()=>({disponivel:false,motivo:'Teste local'}),
    navigator:{userAgent:'Teste',serviceWorker:{}},window:{},
    document:{getElementById:id=>elementos[id]||{},querySelector:()=>null},
    localStorage:{getItem:()=>null}};
  vm.runInNewContext(`${semImports('dist/modules/diagnostico.js')}\nthis.criar=criarRelatorioDiagnostico;`,context);
  const gerar=()=>context.criar({getData:()=>({transactions:[],goals:[],allocations:[],completedAportes:[]}),CATEGORIES:{income:[],expense:[]}});
  const recolhido=await gerar();
  assert.equal(recolhido.integridade.itens.find(item=>item.codigo==='UI_CALENDARIO_FECHADO').estado,'ok');
  assert.equal(recolhido.integridade.itens.find(item=>item.codigo==='UI_CALENDARIO').estado,'ok');
  modal.open=true;
  const aberto=await gerar();
  assert.equal(aberto.integridade.itens.find(item=>item.codigo==='UI_CALENDARIO_FECHADO').estado,'erro');
});

test('Diagnóstico inspeciona paridade móvel, acessibilidade do diálogo e descoberta de relatórios',async()=>{
  const tipos=['income','expense','goal','dream','investment'];
  const criarOpcao=tipo=>({dataset:{createKind:tipo},tagName:'BUTTON',textContent:`Novo ${tipo}`,
    getAttribute:chave=>chave==='type'?'button':null});
  const itensDesktop=tipos.map(criarOpcao);
  const itensMovel=tipos.map(criarOpcao);
  const menuDesktop={id:'desktop-create-menu',querySelectorAll:()=>itensDesktop};
  const menuMovel={id:'mobile-create-dialog',tagName:'DIALOG',querySelectorAll:()=>itensMovel,
    getAttribute:chave=>chave==='aria-labelledby'?'mobile-create-title':null};
  const atributosFab={'aria-label':'Abrir opções de cadastro','aria-controls':'mobile-create-dialog',
    'aria-haspopup':'dialog','aria-expanded':'false'};
  let oculto=false;
  const fab={getAttribute:chave=>atributosFab[chave],classList:{contains:nome=>nome==='hidden'&&oculto},
    getBoundingClientRect:()=>({width:oculto?0:54,height:oculto?0:54})};
  const ferramentas=['export-pdf','export-csv','import-csv','export-data','import-data','folder-backup-connect'];
  const botoes=Object.fromEntries(ferramentas.map(id=>[id,{id}]));
  const relatorios={querySelector:selector=>botoes[selector.replace(/^#/,'')]||null};
  const ajustesPage={querySelector:()=>null};
  const elementos={'quick-add':fab,'desktop-create-trigger':{
    getAttribute:chave=>chave==='aria-controls'?'desktop-create-menu':null},
    'desktop-create-menu':menuDesktop,'mobile-create-dialog':menuMovel,
    'mobile-nav':{querySelectorAll:()=>Array.from({length:6},()=>({}))},
    'reports-page':relatorios,'settings-page':ajustesPage,...botoes};
  const context={Date,Intl,Blob,verificarIntegridade:()=>({itens:[],erros:0,avisos:0}),
    auditarCodigoPublicado:async()=>({disponivel:false,motivo:'Teste local'}),
    navigator:{userAgent:'Teste',serviceWorker:{}},window:{innerWidth:390,getComputedStyle:()=>({})},
    document:{getElementById:id=>elementos[id]||{},querySelector:()=>null},
    localStorage:{getItem:()=>null}};
  vm.runInNewContext(`${semImports('dist/modules/diagnostico.js')}\nthis.criar=criarRelatorioDiagnostico;`,context);
  const gerar=()=>context.criar({getData:()=>({transactions:[],goals:[],allocations:[],completedAportes:[]}),CATEGORIES:{income:[],expense:[]}});
  const extrair=(relatorio,codigo)=>relatorio.integridade.itens.find(item=>item.codigo===codigo)?.estado;
  const correto=await gerar();
  for(const codigo of ['ACAO_RAPIDA_MENU','ACAO_RAPIDA_MOBILE_DIALOGO','ACAO_RAPIDA_PARIDADE',
    'ACAO_RAPIDA_MOBILE_ATALHOS','ACAO_RAPIDA_TOQUE_MOBILE','NAVEGACAO_MOBILE_SEIS_ABAS',
    'RELATORIOS_EXPORTACAO_DESCOBERTA','AJUSTES_SEM_EXPORTACAO_DUPLICADA'])
    assert.equal(extrair(correto,codigo),'ok',codigo);
  const antigo=botoes['export-pdf'];
  delete botoes['export-pdf'];
  const pdfAusente=await gerar();
  assert.equal(extrair(pdfAusente,'RELATORIOS_EXPORTACAO_DESCOBERTA'),'aviso',
    'A ausência de PDF em Relatórios precisa ser detectada');
  botoes['export-pdf']=antigo;
  ajustesPage.querySelector=selector=>selector==='#import-data'?botoes['import-data']:null;
  const duplicadoAjustes=await gerar();
  assert.equal(extrair(duplicadoAjustes,'AJUSTES_SEM_EXPORTACAO_DUPLICADA'),'aviso',
    'Controles duplicados em Ajustes precisam ser detectados');
  ajustesPage.querySelector=()=>null;
  oculto=true;
  const ajustes=await gerar();
  assert.equal(extrair(ajustes,'ACAO_RAPIDA_TOQUE_MOBILE'),undefined,
    'O + intencionalmente oculto em Ajustes não deve provocar falso alerta de tamanho');
  oculto=false;
  itensMovel[4].dataset.createKind='income';
  const duplicado=await gerar();
  assert.equal(extrair(duplicado,'ACAO_RAPIDA_PARIDADE'),'erro','Ações duplicadas devem falhar');
  itensMovel[4].dataset.createKind='investment';
  atributosFab['aria-controls']='dialog-inexistente';
  const rotuloInvalido=await gerar();
  assert.equal(extrair(rotuloInvalido,'ACAO_RAPIDA_MOBILE_DIALOGO'),'erro','Associação ARIA incorreta deve falhar');
  atributosFab['aria-controls']='mobile-create-dialog';
  itensMovel[2].textContent='';
  const semRotulo=await gerar();
  assert.equal(extrair(semRotulo,'ACAO_RAPIDA_MOBILE_ATALHOS'),'erro','Botão sem rótulo deve falhar');
});

test('Diagnóstico compara tema e cor salvos com os estilos realmente visíveis',async()=>{
  const prefs={tema:'escuro',cor:'roxo',percentual:10,categoriasAporte:['Salário'],reservaGoalId:''};
  const root={dataset:{theme:'escuro',accent:'roxo'}};
  const body={};
  const estado={fundo:'#131417',cor:'#7c3aed',corHover:'#6d28d9',corFundo:'rgb(19, 20, 23)',corBotao:'rgb(124, 58, 237)',esquema:'dark',hover:false};
  const botao={matches:selector=>selector===':hover, :active'&&estado.hover};
  const style=(el)=>el===root?{getPropertyValue:n=>n==='--bg'?estado.fundo:n==='--accent-hover'?estado.corHover:estado.cor,colorScheme:estado.esquema}
    :el===body?{backgroundColor:estado.corFundo}:{backgroundColor:estado.corBotao};
  const context={Date,Intl,Blob,CORES:{verde:'#16875c',roxo:'#7c3aed'},TEMAS:['auto','claro','escuro'],
    auditarCodigoPublicado:async()=>({disponivel:false,motivo:'Prévia de teste sem fontes externas'}),
    verificarIntegridade:()=>({itens:[],erros:0,avisos:0}),
    navigator:{userAgent:'Teste',serviceWorker:{}},
    window:{getComputedStyle:style,matchMedia:()=>({matches:false})},
    document:{documentElement:root,body,querySelector:()=>botao,getElementById:()=>({})},
    localStorage:{getItem:()=>null}};
  vm.runInNewContext(`${semImports('dist/modules/diagnostico.js')}\nthis.criar=criarRelatorioDiagnostico;`,context);
  const verificar=async()=>context.criar({getData:dados,CATEGORIES,getPreferences:()=>prefs});
  const bom=await verificar();
  const aparencia=bom.integridade.itens.filter(v=>v.codigo.startsWith('APARENCIA_'));
  assert.equal(aparencia.length,7);
  assert.ok(aparencia.every(v=>v.estado==='ok'));
  estado.fundo='#111318';estado.corFundo='rgb(17, 19, 24)';
  const previa=await verificar();
  assert.equal(previa.integridade.itens.find(v=>v.codigo==='APARENCIA_TEMA_CSS').estado,'ok',
    'A paleta escura da prévia não deve disparar falso erro');
  assert.equal(previa.integridade.itens.find(v=>v.codigo==='APARENCIA_FUNDO').estado,'ok',
    'O fundo visível segue o CSS da prévia');
  estado.fundo='#131417';estado.corFundo='rgb(19, 20, 23)';
  estado.hover=true;estado.corBotao='rgb(109, 40, 217)';
  const hover=await verificar();
  assert.equal(hover.integridade.itens.find(v=>v.codigo==='APARENCIA_BOTAO').estado,'ok','Hover em tela de toque usa --accent-hover');
  estado.hover=false;
  const hoverInvalido=await verificar();
  assert.equal(hoverInvalido.integridade.itens.find(v=>v.codigo==='APARENCIA_BOTAO').estado,'erro','Cor de hover fora de interação não deve ocultar defeitos');
  root.dataset.theme='claro';root.dataset.accent='verde';estado.fundo='#f5f6f8';estado.cor='#16875c';
  estado.corFundo='rgb(245, 246, 248)';estado.corBotao='rgb(22, 135, 92)';estado.esquema='light';
  const ruim=await verificar();
  const erros=ruim.integridade.itens.filter(v=>v.codigo.startsWith('APARENCIA_')&&v.estado==='erro');
  assert.equal(erros.length,7);
  assert.ok(erros.some(v=>v.codigo==='APARENCIA_FUNDO'));
  assert.ok(erros.some(v=>v.codigo==='APARENCIA_BOTAO'));
  assert.doesNotMatch(JSON.stringify(ruim),/741\.59|Despesa CPF|Viagem particular/);
});

test('Tempo de progresso inicia em 5 segundos e soma 0,5 segundo por nova verificação',()=>{
  const context={};
  vm.runInNewContext(`${semImports('dist/modules/diagnostico.js')}\nthis.duracao=calcularDuracaoDiagnostico;`,context);
  assert.equal(context.duracao(9),5000);
  assert.equal(context.duracao(10),5500);
  assert.equal(context.duracao(19),10000);
  assert.equal(context.duracao(49),25000);
  assert.equal(context.duracao(79),25000);
  assert.equal(context.duracao(500),25000);
});

test('Limite visual de 25 segundos não corta a execução das verificações',()=>{
  const source=read('dist/modules/diagnostico.js');
  assert.match(source,/const base=await criarRelatorioDiagnostico\(ctx\)/);
  assert.match(source,/const relatorio=unificarResultadosDiagnosticos\(base,complementos\)/);
  assert.doesNotMatch(source,/Promise\.race|Tempo máximo de diagnóstico esgotado/);
  assert.match(source,/const tempoRestante=duracao/);
});

test('Diagnóstico apresenta CSS e funções candidatas como avisos sem apagar código',async()=>{
  const context={Date,Intl,Blob,
    verificarIntegridade:()=>({itens:[],erros:0,avisos:0}),
    auditarCodigoPublicado:async()=>({disponivel:true,arquivosInspecionados:33,
      seletoresVerificados:243,funcoesVerificadas:131,
      cssNaoUsados:[{arquivo:'css/resumo.css',nome:'inativa'}],
      funcoesSemUso:[{arquivo:'modules/resumo.js',nome:'semChamada'}]}),
    navigator:{userAgent:'Teste',serviceWorker:{}},
    window:{MeuDinheiroCSV:{importCSV:()=>{}},MeuDinheiroAnalytics:{expenseCategoryStats:()=>{}},
      MeuDinheiroFolderBackup:{createBrowserManager:()=>{}}},localStorage:{getItem:()=>null}
  };
  vm.runInNewContext(`${semImports('dist/modules/diagnostico.js')}\nthis.criar=criarRelatorioDiagnostico;`,context);
  const relatorio=await context.criar({getData:()=>({transactions:[],goals:[],allocations:[],completedAportes:[]}),CATEGORIES:{income:[],expense:[]}});
  assert.equal(relatorio.auditoriaCodigo.candidatosCss,1);
  assert.equal(relatorio.auditoriaCodigo.candidatosFuncoes,1);
  assert.equal(relatorio.integridade.erros,0);
  assert.equal(relatorio.integridade.itens.find(item=>item.codigo==='CSS_POSSIVELMENTE_SEM_USO_1').estado,'aviso');
  assert.equal(relatorio.integridade.itens.find(item=>item.codigo==='FUNCAO_POSSIVELMENTE_SEM_USO_1').estado,'aviso');
  assert.ok(relatorio.duracaoPrevistaMs<=25000);
});

test('Diagnóstico informa a versão carregada e avisa se o indicador visual divergir',async()=>{
  const versao={textContent:'v22'};
  const context={Date,Intl,Blob,
    verificarIntegridade:()=>({itens:[],erros:0,avisos:0}),
    auditarCodigoPublicado:async()=>({disponivel:false,motivo:'Sem acesso a código no teste'}),
    navigator:{userAgent:'Teste',serviceWorker:{}},window:{},
    document:{getElementById:id=>id==='app-running-version'?versao:{}},
    localStorage:{getItem:()=>null}
  };
  vm.runInNewContext(`${semImports('dist/modules/diagnostico.js')}\nthis.criar=criarRelatorioDiagnostico;`,context);
  const gerar=()=>context.criar({getData:()=>({transactions:[],goals:[],allocations:[],completedAportes:[]}),
    CATEGORIES:{income:[],expense:[]},getUpdateStatus:()=>({versaoEmExecucao:'v22'})});
  const certo=await gerar();
  assert.equal(certo.atualizador.versaoEmExecucao,'v22');
  assert.equal(certo.integridade.itens.find(item=>item.codigo==='ATUALIZADOR_VERSAO_VISIVEL').estado,'ok');
  versao.textContent='Prévia visual v38 · motor v22';
  const homologacao=await gerar();
  assert.equal(homologacao.integridade.itens.find(item=>item.codigo==='ATUALIZADOR_VERSAO_VISIVEL').estado,'ok',
    'A versão visual é diferente da versão do motor PWA');
  versao.textContent='Prévia visual v38 · motor v21';
  const motorErrado=await gerar();
  assert.equal(motorErrado.integridade.itens.find(item=>item.codigo==='ATUALIZADOR_VERSAO_VISIVEL').estado,'erro',
    'Motor divergente continua sendo detectado');
  versao.textContent='v18';
  const errado=await gerar();
  assert.equal(errado.integridade.itens.find(item=>item.codigo==='ATUALIZADOR_VERSAO_VISIVEL').estado,'erro');
});

test('PWA instalado verifica o cache de cada módulo separadamente',async()=>{
  const modulos=['resumo','integridade','ajustes'];
  const context={Date,Intl,Blob,
    auditarCodigoPublicado:async()=>({disponivel:false,motivo:'Prévia de teste sem fontes externas'}),
    verificarIntegridade:()=>({itens:[],erros:0,avisos:0}),
    MODULOS_OBRIGATORIOS:modulos,totalRegistros:()=>3,
    executarVerificacoesModulos:()=>modulos.map(nome=>({codigo:`MOD_${nome}`,estado:'ok',descricao:'Carregado',modulo:nome})),
    caches:{keys:async()=>['meu-dinheiro-essencial-v13'],open:async()=>({match:async file=>file.includes('integridade')?null:{ok:true}})},
    navigator:{userAgent:'Teste',serviceWorker:{controller:{},getRegistration:async()=>({active:{}})}},
    window:{MeuDinheiroCSV:{importCSV:()=>{}},MeuDinheiroAnalytics:{expenseCategoryStats:()=>{}},MeuDinheiroFolderBackup:{createBrowserManager:()=>{}}},
    localStorage:{getItem:()=>null}
  };
  vm.runInNewContext(`${semImports('dist/modules/diagnostico.js')}\nthis.criar=criarRelatorioDiagnostico;`,context);
  const report=await context.criar({getData:()=>({transactions:[],goals:[],allocations:[],completedAportes:[]}),CATEGORIES:{income:[],expense:[]}});
  const cache=report.integridade.itens.filter(v=>v.codigo.startsWith('CACHE_MOD_'));
  assert.equal(cache.length,3);
  assert.equal(cache.find(v=>v.modulo==='pwa'&&v.codigo==='CACHE_MOD_INTEGRIDADE').estado,'aviso');
  assert.equal(cache.find(v=>v.codigo==='CACHE_MOD_RESUMO').estado,'ok');
  assert.equal(report.duracaoPrevistaMs,Math.min(25000,5000+Math.max(0,report.integridade.itens.length-9)*500));
});
