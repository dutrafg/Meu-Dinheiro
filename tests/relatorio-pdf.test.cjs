const assert=require('node:assert/strict');
const test=require('node:test');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const read=rel=>fs.readFileSync(path.join(__dirname,'..',rel),'utf8');

test('PDF usa impressão local somente depois de fechar os Ajustes',()=>{
  const eventos=[];let click;
  const document={getElementById:id=>id==='export-pdf'?{addEventListener:(tipo,cb)=>{click=cb;}}:{close:()=>eventos.push('fechar')}};
  const window={requestAnimationFrame:cb=>{eventos.push('agendar');cb();},print:()=>eventos.push('imprimir')};
  const script=read('dist/modules/relatorio-pdf.js').replace(/^export /gm,'');
  const context={document,window};vm.runInNewContext(`${script}\nthis.iniciar=iniciarRelatorioPdf;`,context);
  const modulo=context.iniciar({hideBackupMenu:()=>eventos.push('fechar menu')});
  click();
  assert.deepEqual(eventos,['fechar menu','fechar','agendar','imprimir']);
  assert.equal(typeof modulo.imprimir,'function');
});

test('Sem API de impressão registra aviso sem realizar operações externas',()=>{
  let click;const logs=[];
  const context={document:{getElementById:id=>id==='export-pdf'?{addEventListener:(tipo,cb)=>{click=cb;}}:{close:()=>{}}},window:{}};
  vm.runInNewContext(`${read('dist/modules/relatorio-pdf.js').replace(/^export /gm,'')}\nthis.iniciar=iniciarRelatorioPdf;`,context);
  context.iniciar({hideBackupMenu:()=>{},registrar:(...log)=>logs.push(log)});
  assert.equal(click(),false);
  assert.equal(logs[0][1],'PDF_IMPRESSAO_INDISPONIVEL');
});

test('Falha do diálogo de impressão não quebra a navegação',()=>{
  const logs=[];
  const context={document:{getElementById:id=>id==='export-pdf'?{addEventListener:()=>{}}:{close:()=>{}}},
    window:{requestAnimationFrame:cb=>cb(),print:()=>{throw Error('Bloqueado');}}};
  vm.runInNewContext(`${read('dist/modules/relatorio-pdf.js').replace(/^export /gm,'')}\nthis.iniciar=iniciarRelatorioPdf;`,context);
  const relatorio=context.iniciar({hideBackupMenu:()=>{},registrar:(...val)=>logs.push(val)});
  assert.equal(relatorio.imprimir(),true);
  assert.equal(logs[0][1],'PDF_IMPRESSAO_FALHOU');
});

test('Folha A4 imprime somente a tela atual sem botões, navegação e diálogos',()=>{
  const css=read('dist/css/impressao.css');
  const html=read('dist/index.html');
  assert.match(css,/@media print/);
  assert.match(css,/@page\{size:A4/);
  assert.match(css,/\.desktop-nav,\.mobile-nav/);
  assert.match(css,/dialog/);
  assert.match(html,/id="print-report-title"/);
  assert.match(html,/id="export-pdf"/);
  assert.match(read('dist/app.js'),/print-report-title/);
});
