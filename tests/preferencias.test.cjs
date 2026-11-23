const assert=require('node:assert/strict');
const test=require('node:test');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

const arquivo=fs.readFileSync(path.join(__dirname,'..','dist','modules','preferencias.js'),'utf8');
const src=arquivo.replace(/^export /gm,'');
function carregar() {
  const sandbox={};vm.runInNewContext(`${src}\nthis.api={CORES,TEMAS,preferenciasPadrao,normalizarPreferencias,criarGestorPreferencias,CHAVE_PREFERENCIAS}`,sandbox);
  return sandbox.api;
}

test('Instalações novas usam azul, tema automático e aporte de 10%',()=>{
  const {preferenciasPadrao}=carregar();
  const p=preferenciasPadrao();
  assert.equal(p.tema,'auto');assert.equal(p.cor,'azul');assert.equal(p.percentual,10);
  assert.deepEqual([...p.categoriasAporte],['Salário base','Salário','Personal']);
  assert.equal(p.limiteMensal,null);assert.equal(p.metaPoupancaMensal,null);
});

test('Preferências rejeitam valores manipulados, categorias estranhas e percentuais fora do intervalo',()=>{
  const {normalizarPreferencias}=carregar();
  const p=normalizarPreferencias({tema:'__proto__',cor:'não existe',percentual:1000,
    categoriasAporte:['Salário','Salário','CPF 123','Personal'],reservaGoalId:42,
    limiteMensal:Infinity,metaPoupancaMensal:-5},['Salário','Personal']);
  assert.equal(p.tema,'auto');assert.equal(p.cor,'azul');assert.equal(p.percentual,10);
  assert.deepEqual([...p.categoriasAporte],['Salário','Personal']);
  assert.equal(p.reservaGoalId,'');
  assert.equal(p.limiteMensal,null);assert.equal(p.metaPoupancaMensal,null);
});

test('Mudanças ficam em chave própria, sem sobrescrever os dados financeiros',()=>{
  const api=carregar();
  const values=new Map([['meu-dinheiro-essencial:v1','REGISTROS_FINANCEIROS']]);
  const storage={getItem:key=>values.get(key)||null,setItem:(key,val)=>values.set(key,val)};
  const manager=api.criarGestorPreferencias({storage,categoriasRenda:['Salário','Personal']});
  assert.equal(manager.salvar({tema:'escuro',cor:'roxo',percentual:15,categoriasAporte:['Salário'],reservaGoalId:'meta-1',limiteMensal:2600,metaPoupancaMensal:300}),true);
  assert.equal(values.get('meu-dinheiro-essencial:v1'),'REGISTROS_FINANCEIROS');
  const reload=api.criarGestorPreferencias({storage,categoriasRenda:['Salário','Personal']});
  assert.equal(reload.obter().percentual,15);assert.equal(reload.obter().tema,'escuro');
  assert.equal(reload.obter().limiteMensal,2600);assert.equal(reload.obter().metaPoupancaMensal,300);
  const pref=reload.obter();pref.categoriasAporte.push('Outro');
  assert.deepEqual([...reload.obter().categoriasAporte],['Salário']);
});

test('Falha de gravação não declara sucesso nem altera a preferência na memória',()=>{
  const api=carregar();
  const storage={getItem:()=>null,setItem:()=>{throw Error('quota');}};
  const gestor=api.criarGestorPreferencias({storage});
  assert.equal(gestor.salvar({tema:'escuro',cor:'roxo',percentual:15,categoriasAporte:['Personal']}),false);
  assert.equal(gestor.obter().tema,'auto');
});
