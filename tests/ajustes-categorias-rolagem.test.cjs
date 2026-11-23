const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

function montarCategorias(){
  const eventos=new Map();
  const criar=tag=>({tagName:tag.toUpperCase(),dataset:{},style:{},children:[],value:'',textContent:'',
    append(...items){this.children.push(...items);},
    addEventListener(tipo,callback){eventos.set(`${tag}:${tipo}`,callback);},
    querySelector(selector){return selector==='span'?this.children.find(el=>el.tagName==='SPAN'):null;},
    closest(selector){if(selector==='[data-category-toggle]')return this.dataset.categoryToggle?this:null;
      if(selector==='[data-category-edit]')return this.dataset.categoryEdit?this:null;
      if(selector==='.category-manager-item')return this.parent||null;
      return null;}});
  const elementos=new Map();
  const obter=id=>{
    if(!elementos.has(id))elementos.set(id,{...criar('div'),id,addEventListener(tipo,callback){eventos.set(`${id}:${tipo}`,callback);}});
    return elementos.get(id);
  };
  const lista=obter('category-manager-list');
  let reconstrucoes=0;
  lista.replaceChildren=function(){reconstrucoes++;this.children=[];};
  lista.append=function(...items){for(const item of items){item.parent=this;this.children.push(item);}};
  const campoIcone={value:'🏷️',append:()=>{}};
  const campoNome={value:''},campoAnterior={value:''};
  const formCategoria=obter('category-manager-form');
  formCategoria.elements={namedItem:nome=>({icon:campoIcone,name:campoNome,oldName:campoAnterior})[nome]};
  formCategoria.reset=()=>{};
  obter('category-manager-kind').value='expense';
  const form=obter('settings-form');
  const campos={tema:{value:''},percentual:{value:''},limiteMensal:{value:''},metaPoupancaMensal:{value:''}};
  form.elements={namedItem:nome=>campos[nome]};
  const cores=obter('settings-colors');cores.replaceChildren=function(){this.children=[];};
  const categorias=obter('settings-categories');categorias.replaceChildren=function(){this.children=[];};
  const reserva=obter('settings-reserve');reserva.replaceChildren=function(){this.children=[];};
  const inicial={tema:'auto',cor:'azul',percentual:10,limiteMensal:null,metaPoupancaMensal:null,
    categoriasAporte:[],reservaGoalId:'',categoriasExtras:{income:[],expense:[]},
    categoriasOcultas:{income:[],expense:[]},categoriaIcones:{}};
  let preferencia=structuredClone(inicial),falhar=false,renderizacoes=0;
  const gestor={obter:()=>structuredClone(preferencia),salvar:next=>{
    if(falhar){falhar=false;return false;}
    preferencia=structuredClone(next);return true;
  }};
  const documento={getElementById:obter,documentElement:{dataset:{}},
    querySelector:()=>({content:''}),createElement:criar,createTextNode:texto=>texto};
  const janela={scrollY:650,matchMedia:()=>({matches:false,addEventListener:()=>{}})};
  const sandbox={document:documento,window:janela,setTimeout,clearTimeout};
  const source=fs.readFileSync(path.join(__dirname,'../dist/modules/ajustes.js'),'utf8')
    .replace(/^import .*$/gm,'').replace(/^export /gm,'');
  // Somente objetos de teste, sem armazenamento nem dados financeiros reais.
  sandbox.CORES={azul:'#2359cc'};sandbox.TEMAS=['auto','claro','escuro'];
  sandbox.ICONES_PERSONALIZADOS=['🏷️'];sandbox.normalizarPreferencias=valor=>valor;
  vm.runInNewContext(`${source}\nthis.iniciar=iniciarAjustes;`,sandbox);
  const api=sandbox.iniciar({gestor,getData:()=>({goals:[]}),
    CATEGORIES:{income:['Salário'],expense:['Mercado','Transporte','Contas','Casa','Lazer']},
    notify:()=>{},render:()=>{renderizacoes++;},onSave:()=>{},hideBackupMenu:()=>{}});
  api.abrir();
  const clicar=nome=>{
    const linha=lista.children.find(item=>item.children[0].textContent.includes(nome));
    const botao=linha.children[2];
    botao.parent=linha;
    eventos.get('category-manager-list:click')({target:botao});
    return {linha,botao};
  };
  return {lista,janela,gestor,clicar,obterReconstrucoes:()=>reconstrucoes,
    obterRenderizacoes:()=>renderizacoes,falharProxima:()=>{falhar=true;}};
}

test('Tirar/Mostrar preserva rolagem, foco no botão e lista no mesmo ponto',()=>{
  const app=montarCategorias();
  const reconstrucoes=app.obterReconstrucoes();
  const primeiro=app.clicar('Casa');
  assert.equal(app.gestor.obter().categoriasOcultas.expense.includes('Casa'),true);
  assert.equal(primeiro.botao.textContent,'Mostrar');
  assert.match(primeiro.linha.children[0].textContent,/Casa \(oculta\)/);
  assert.equal(app.obterReconstrucoes(),reconstrucoes,'Não desmontar a lista inteira após Tirar');
  assert.equal(app.lista.children.includes(primeiro.linha),true,'Botão clicado não deve ser substituído');
  assert.equal(app.janela.scrollY,650,'Não voltar para o topo após Tirar');
  const segundo=app.clicar('Contas');
  assert.equal(segundo.botao.textContent,'Mostrar');
  assert.equal(app.lista.children.includes(primeiro.linha),true);
  assert.equal(app.janela.scrollY,650,'Várias remoções consecutivas mantêm posição');
  const restaurar=app.clicar('Casa');
  assert.equal(restaurar.botao,primeiro.botao);
  assert.equal(restaurar.botao.textContent,'Tirar');
  assert.equal(app.gestor.obter().categoriasOcultas.expense.includes('Casa'),false);
  assert.equal(app.obterReconstrucoes(),reconstrucoes);
  assert.equal(app.obterRenderizacoes(),3,'Resumo ainda deve ser atualizado após salvar');
});

test('Se salvar categoria falhar, rótulo e botão continuam como antes',()=>{
  const app=montarCategorias();app.falharProxima();
  const antes=app.obterReconstrucoes();
  const {linha,botao}=app.clicar('Transporte');
  assert.equal(botao.textContent,'Tirar');
  assert.doesNotMatch(linha.children[0].textContent,/oculta/);
  assert.equal(app.gestor.obter().categoriasOcultas.expense.includes('Transporte'),false);
  assert.equal(app.obterReconstrucoes(),antes);
  assert.equal(app.janela.scrollY,650);
});
