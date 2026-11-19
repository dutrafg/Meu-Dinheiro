const assert=require('node:assert/strict');
const test=require('node:test');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const read=rel=>fs.readFileSync(path.join(__dirname,'..',rel),'utf8');

function iniciar({semImpressao=false,erroAoImprimir=false,erroAoPreparar=false}={}){
  const eventos=[];const logs=[];const callbacks={};
  const destino={innerHTML:'',replaceChildren(){this.innerHTML='';eventos.push('limpar');},hasChildNodes(){return !!this.innerHTML;}};
  const botao={addEventListener:(nome,cb)=>{callbacks[nome]=cb;}};
  const document={getElementById:id=>({'export-pdf':botao,'print-report':destino}[id])};
  const window={addEventListener:(nome,cb)=>{callbacks[nome]=cb;},requestAnimationFrame:cb=>{eventos.push('agendar');cb();}};
  if(!semImpressao)window.print=()=>{if(erroAoImprimir)throw Error('Impressora bloqueada');eventos.push('imprimir');};
  const montarRelatorioFinanceiro=()=>'<article class="pdf-document">Meu Dinheiro</article>';
  const code=read('dist/modules/relatorio-pdf.js').replace(/^import .*;\s*$/gm,'').replace(/^export /gm,'');
  const context={document,window,montarRelatorioFinanceiro};
  vm.runInNewContext(`${code}\nthis.iniciarPdf=iniciarRelatorioPdf;`,context);
  const api=context.iniciarPdf({
    hideBackupMenu:()=>eventos.push('fechar menu'),registrar:(...args)=>logs.push(args),
    getData:()=>({goals:[],allocations:[]}),getView:()=> 'resumo',getMonth:()=> '2026-11',
    monthLabel:()=> 'novembro de 2026',transactionsInMonth:()=>{if(erroAoPreparar)throw Error('Sem dados');return [];},
    money:n=>`R$ ${n.toFixed(2)}`
  });
  return {api,eventos,logs,callbacks,destino};
}

test('PDF prepara conteúdo financeiro sem alterar a aba Ajustes e limpa depois',()=>{
  const {api,eventos,callbacks,destino}=iniciar();
  assert.equal(callbacks.click(),true);
  assert.deepEqual(eventos,['fechar menu','agendar','imprimir']);
  assert.match(destino.innerHTML,/Meu Dinheiro/);
  callbacks.afterprint();
  assert.equal(destino.innerHTML,'');
  assert.equal(typeof api.imprimir,'function');
});

test('Imprimir pelo atalho do sistema também prepara o relatório',()=>{
  const {callbacks,destino}=iniciar();
  assert.equal(destino.innerHTML,'');
  callbacks.beforeprint();
  assert.match(destino.innerHTML,/Meu Dinheiro/);
  callbacks.beforeprint();
  callbacks.afterprint();
  assert.equal(destino.innerHTML,'');
});

test('Sem API de impressão registra aviso e não expõe dados na tela',()=>{
  const {api,logs,destino}=iniciar({semImpressao:true});
  assert.equal(api.imprimir(),false);
  assert.equal(logs[0][1],'PDF_IMPRESSAO_INDISPONIVEL');
  assert.equal(destino.innerHTML,'');
});

test('Falha de impressão é registrada e o relatório temporário é limpo',()=>{
  const {api,logs,destino}=iniciar({erroAoImprimir:true});
  assert.equal(api.imprimir(),true);
  assert.equal(logs[0][1],'PDF_IMPRESSAO_FALHOU');
  assert.equal(destino.innerHTML,'');
});

test('Falha ao montar relatório é registrada sem abrir diálogo de impressão',()=>{
  const {api,logs,eventos,destino}=iniciar({erroAoPreparar:true});
  assert.equal(api.imprimir(),false);
  assert.equal(logs[0][1],'PDF_PREPARACAO_FALHOU');
  assert.ok(!eventos.includes('imprimir'));
  assert.equal(destino.innerHTML,'');
});

test('PDF possui identidade própria, paginação A4 e tabelas repetidas entre páginas',()=>{
  const css=read('dist/css/impressao.css');
  const html=read('dist/index.html');
  const app=read('dist/app.js');
  assert.match(css,/@media print/);
  assert.match(css,/@page\{size:A4/);
  assert.match(css,/counter\(page\)/);
  assert.match(css,/#main-content\{display:none!important\}/);
  assert.match(css,/\.pdf-table thead\{display:table-header-group\}/);
  assert.match(css,/\.pdf-kpis/);
  assert.match(css,/\.pdf-header/);
  assert.match(css,/\.pdf-goal-track/);
  assert.match(css,/\.desktop-nav,\.mobile-nav/);
  assert.match(css,/dialog/);
  assert.match(html,/id="print-report"/);
  assert.match(html,/id="export-pdf"/);
  assert.match(app,/getView:\(\)=>ultimaVisaoFinanceira/);
  assert.doesNotMatch(app,/print-report-title/);
});
