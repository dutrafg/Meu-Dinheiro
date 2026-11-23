const test=require('node:test');
const assert=require('node:assert/strict');
const {pathToFileURL}=require('node:url');
const path=require('node:path');
const carregar=()=>import(pathToFileURL(path.join(__dirname,'../dist/modules/preferencias.js')).href);

test('Categorias personalizadas e ícones sobrevivem a preferências e preservam base',async()=>{
  const {criarGestorPreferencias,normalizarPreferencias}=await carregar();
  const local=new Map();const storage={getItem:key=>local.get(key)||null,setItem:(key,v)=>local.set(key,v)};
  const gestor=criarGestorPreferencias({storage,categoriasRenda:['Salário base']});
  const inicial=gestor.obter();
  const alterado={...inicial,categoriasExtras:{income:['Presente'],expense:['Mercado']},
    categoriasOcultas:{income:[],expense:['Alimentação']},categoriaIcones:{Mercado:'🛒'}};
  assert.equal(gestor.salvar(alterado),true);
  assert.deepEqual(gestor.obter().categoriasExtras.expense,['Mercado']);
  const copia=gestor.obter();copia.categoriasExtras.expense.push('Estragou');
  assert.deepEqual(gestor.obter().categoriasExtras.expense,['Mercado']);
  assert.deepEqual(normalizarPreferencias({...alterado,categoriaIcones:{Mercado:'<script>'}}).categoriaIcones,{});
  assert.deepEqual(inicial.categoriasExtras.expense,[]);
});

test('Excesso de categorias não ultrapassa limite de importação nem apaga preferências anteriores',async()=>{
  const {criarGestorPreferencias}=await carregar();
  const gestor=criarGestorPreferencias({storage:{getItem:()=>null,setItem:()=>{}},categoriasRenda:['Salário base']});
  const antes=JSON.stringify(gestor.obter());
  const grandes=Array.from({length:100},(_,i)=>`${i}-`.padEnd(50,'X'));
  const p=gestor.obter();p.categoriasOcultas.expense=grandes;p.categoriasOcultas.income=grandes;
  p.categoriasExtras.expense=grandes;
  assert.equal(gestor.salvar(p),false);
  assert.equal(JSON.stringify(gestor.obter()),antes);
});
