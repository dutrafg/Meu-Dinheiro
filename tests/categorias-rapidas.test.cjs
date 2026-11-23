const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {pathToFileURL}=require('node:url');
const root=path.join(__dirname,'..');
const carregar=nome=>import(pathToFileURL(path.join(root,'dist/modules',nome)).href);
const ler=nome=>fs.readFileSync(path.join(root,nome),'utf8');

test('P2: categorias rápidas exibem seleção em primeiro lugar e no máximo oito opções',async()=>{
  const {categoriasVisiveis}=await carregar('categorias-rapidas.js');
  const categorias=Array.from({length:12},(_,i)=>`Categoria ${i}`);
  const originais=[...categorias];
  const lista=categoriasVisiveis(categorias,'Categoria 10');
  assert.equal(lista.length,8);
  assert.equal(lista[0],'Categoria 10');
  assert.equal(new Set(lista).size,8);
  assert.deepEqual(categorias,originais);
  assert.deepEqual(categoriasVisiveis(['Mercado','Contas'],'Não cadastrada'),['Mercado','Contas']);
  assert.deepEqual(categoriasVisiveis(null,'Mercado'),[]);
});

test('P2: ícones de categoria atualizam o select existente, sem tocar no valor monetário',async()=>{
  const {iniciarCategoriasRapidas}=await carregar('categorias-rapidas.js');
  const eventos={};
  const campo={value:'12.34'};
  const categoria={value:'Mercado',addEventListener:(tipo,fn)=>eventos['categoria-'+tipo]=fn,
    dispatchEvent:()=>{eventos['categoria-change']?.();}};
  const tiles={innerHTML:'',querySelectorAll:()=>[]};
  const dialog={addEventListener:(tipo,fn)=>eventos[tipo]=fn,
    querySelector:seletor=>seletor==='#transaction-category-tiles'?tiles:null,contains:()=>true};
  const form={elements:{namedItem:nome=>nome==='amount'?campo:categoria}};
  const modulo=iniciarCategoriasRapidas({dialog,form,categorySet:()=>['Mercado','Contas','Transporte'],
    icones:{Mercado:'🛒'},esc:texto=>texto});
  modulo.atualizar('expense');
  assert.match(tiles.innerHTML,/Mercado/);
  assert.match(tiles.innerHTML,/🛒/);
  assert.doesNotMatch(tiles.innerHTML,/data-money-key|transaction-keypad/);
  eventos.click({target:{closest:seletor=>seletor==='[data-mobile-category]'?
    {dataset:{mobileCategory:'Contas'}}:null}});
  assert.equal(categoria.value,'Contas');
  assert.equal(campo.value,'12.34','Categoria não modifica o valor digitado pelo teclado do celular');
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

test('P2: somente o + cria no celular; categorias por ícones e atalhos do Resumo no PC permanecem',()=>{
  const html=ler('dist/index.html');
  const resumo=ler('dist/modules/resumo.js');
  const css=ler('dist/css/acao-rapida-mobile.css');
  const rapida=ler('dist/modules/acao-rapida.js');
  assert.match(html,/id="quick-add"/);
  assert.match(html,/id="transaction-category-tiles"/);
  assert.match(html,/data-create-kind="investment"/);
  assert.doesNotMatch(html,/id="mobile-quick-actions"|− Gastei|\+ Recebi/);
  assert.doesNotMatch(rapida,/mobile-quick-actions|quick-actions-visible/);
  for(const tipo of ['expense','income'])
    assert.match(resumo,new RegExp(`data-action="add" data-type="${tipo}"`));
  assert.match(css,/\.transaction-category-tiles/);
  assert.doesNotMatch(css,/\.mobile-quick-actions/);
});

test('P2: o valor usa teclado nativo Android sem visor, teclas próprias ou alternância',()=>{
  const html=ler('dist/index.html');
  const css=ler('dist/css/acao-rapida-mobile.css');
  const modulo=ler('dist/modules/categorias-rapidas.js');
  assert.match(html,/<input name="amount" inputmode="decimal" type="number"[^>]+required/);
  assert.doesNotMatch(html,/transaction-keypad|transaction-keyboard-mode|data-money-key|transaction-mobile-entry/);
  assert.doesNotMatch(css,/transaction-keypad|transaction-keyboard-toggle|transaction-native-keyboard/);
  assert.match(css,/#transaction-dialog \.transaction-amount-field\{display:flex\}/);
  assert.doesNotMatch(modulo,/readOnly|inputMode|\.focus\(|data-money-key/);
  assert.match(ler('dist/modules/diagnostico.js'),/TECLADO_NATIVO_SEM_DUPLICACAO/);
});
