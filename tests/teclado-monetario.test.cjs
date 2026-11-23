const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {pathToFileURL}=require('node:url');
const root=path.join(__dirname,'..');
const carregar=nome=>import(pathToFileURL(path.join(root,'dist/modules',nome)).href);
const ler=nome=>fs.readFileSync(path.join(root,nome),'utf8');

test('P2: teclado monetário insere centavos, apaga e respeita o limite',async()=>{
  const {aplicarTeclaMonetaria:tecla}=await carregar('teclado-monetario.js');
  assert.equal(tecla('0','1'),'0.01');
  assert.equal(tecla('0.01','2'),'0.12');
  assert.equal(tecla('0.12','3'),'1.23');
  assert.equal(tecla('1.23','00'),'123.00');
  assert.equal(tecla('1.23','backspace'),'0.12');
  assert.equal(tecla('0.00','backspace'),'0.00');
  assert.equal(tecla('999999999','1'),null);
  assert.equal(tecla('1','-'),null);
  assert.equal(tecla('-1','1'),null);
});

test('P2: keypad usa o campo nativo e categorias já cadastradas',async()=>{
  const {iniciarTecladoMonetario}=await carregar('teclado-monetario.js');
  const eventos={};
  const campo={value:'0',addEventListener:(tipo,fn)=>eventos['campo-'+tipo]=fn,dispatchEvent:()=>{}};
  const categoria={value:'Mercado',addEventListener:(tipo,fn)=>eventos['categoria-'+tipo]=fn,dispatchEvent:()=>{}};
  const visor={textContent:''};
  const tiles={innerHTML:'',querySelectorAll:()=>[]};
  const dialog={addEventListener:(tipo,fn)=>eventos[tipo]=fn,
    querySelector:selector=>selector==='#transaction-keypad-display'?visor:tiles,contains:()=>true};
  const form={elements:{namedItem:nome=>nome==='amount'?campo:categoria}};
  const teclado=iniciarTecladoMonetario({dialog,form,categorySet:()=>['Mercado','Contas','Transporte'],
    icones:{Mercado:'🛒'},esc:texto=>texto});
  teclado.atualizar('expense');
  assert.match(tiles.innerHTML,/Mercado/);
  assert.match(tiles.innerHTML,/🛒/);
  assert.match(visor.textContent,/R\$\s*0,00/);
  eventos.click({target:{closest:selector=>selector==='[data-money-key]'?{dataset:{moneyKey:'1'}}:null}});
  assert.equal(campo.value,'0.01');
  eventos.click({target:{closest:selector=>selector==='[data-mobile-category]'?{dataset:{mobileCategory:'Contas'}}:null}});
  assert.equal(categoria.value,'Contas');
});

test('P2: histórico agrupa despesas por dia sem alterar registros',async()=>{
  const {criarModuloLancamentos}=await carregar('lancamentos.js');
  const entradas=[
    {id:'a',type:'expense',description:'Mercado',category:'Mercado',amount:5,date:'2026-11-22',occurrence:'2026-11-22'},
    {id:'b',type:'expense',description:'Café',category:'Alimentação',amount:4,date:'2026-11-22',occurrence:'2026-11-22'},
    {id:'c',type:'expense',description:'Conta',category:'Contas',amount:12,date:'2026-11-21',occurrence:'2026-11-21'}
  ];
  const original=JSON.stringify(entradas);
  const ctx={getMonth:()=> '2026-11',getSearch:()=>'',getFilterCategory:()=>'',
    transactionsInMonth:()=>entradas,n2:n=>n,categorySet:()=>['Mercado','Contas','Alimentação'],
    header:()=>'',money:n=>`R$ ${n}`,esc:s=>String(s),CATEGORY_ICONS:{},
    fmtDate:{format:()=> '22 nov. 2026'},parseDate:s=>new Date(`${s}T12:00:00Z`),icon:()=>''};
  const html=criarModuloLancamentos(ctx).renderTransactions('expense');
  assert.equal((html.match(/data-day-group=/g)||[]).length,2);
  assert.equal((html.match(/class="proto-item"/g)||[]).length,3);
  assert.equal(JSON.stringify(entradas),original);
});

test('P2: atalhos financeiros estão no mobile e no resumo do PC',()=>{
  const html=ler('dist/index.html');
  const resumo=ler('dist/modules/resumo.js');
  const css=ler('dist/css/acao-rapida-mobile.css');
  for(const tipo of ['expense','income']){
    assert.match(html,new RegExp(`data-action="add" data-type="${tipo}"`));
    assert.match(resumo,new RegExp(`data-action="add" data-type="${tipo}"`));
  }
  assert.match(css,/\.transaction-category-tiles/);
  assert.match(css,/\.mobile-quick-actions:not\(\.hidden\)/);
});
