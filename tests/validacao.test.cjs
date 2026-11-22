const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const read = filename => fs.readFileSync(path.join(__dirname, '..', filename), 'utf8');
const load = async filename => import(`data:text/javascript;base64,${Buffer.from(read(filename)).toString('base64')}`);
const categories = {income:['Salário base','Personal'],expense:['Alimentação','Moradia']};
const tx = (id = 't1') => ({id,type:'income',description:'Salário',amount:2500,date:'2026-11-18',category:'Salário base',recurring:false,createdAt:'2026-11-18T12:00:00.000Z'});
const goal = (id = 'g1') => ({id,kind:'goal',name:'Reserva',target:10000,saved:500,deadline:''});
const allocation = (id = 'a1') => ({id,kind:'reserve',description:'Aporte',amount:100,date:'2026-11-18',goalId:'g1'});
const backup = () => ({app:'meu-dinheiro-essencial',version:1,transactions:[tx()],goals:[goal()],allocations:[allocation()],completedAportes:['t1@2026-11-18']});

test('Calendário não aceita datas inexistentes, inclusive em anos bissextos', async () => {
  const {validarDataISO} = await load('dist/modules/validacao.js');
  for (const date of ['2024-02-29','2026-11-18','2000-02-29','2026-12-31','2026-01-01']) assert.equal(validarDataISO(date),true,date);
  for (const date of ['2026-02-29','2026-02-31','2026-04-31','1900-02-29','2026-00-10','2026-13-01','2026-12-00','2026-12-32','2026-2-01','texto']) assert.equal(validarDataISO(date),false,date);
});

test('Backup existente restaura todas as quatro coleções sem alterar os valores', async () => {
  const {validarBackup} = await load('dist/modules/validacao.js');
  const original=backup();
  const restored=validarBackup(original,categories);
  assert.deepEqual(restored,{transactions:original.transactions,goals:original.goals,allocations:original.allocations,completedAportes:original.completedAportes});
  assert.equal(original.goals[0].saved,500);
});

test('Backup antigo sem aplicações e lembretes continua compatível', async () => {
  const {validarBackup} = await load('dist/modules/validacao.js');
  const original=backup();
  delete original.allocations;
  delete original.completedAportes;
  assert.deepEqual(validarBackup(original,categories).allocations,[]);
});

test('Restauração recusa datas falsas, identificadores duplicados e valores inválidos', async () => {
  const {validarBackup} = await load('dist/modules/validacao.js');
  const variations = [
    b=>{b.transactions[0].date='2026-02-31';},
    b=>{b.allocations[0].date='2026-04-31';},
    b=>{b.goals[0].deadline='2026-02-29';},
    b=>{b.transactions.push({...tx('t1')});},
    b=>{b.allocations[0].id='t1';},
    b=>{b.goals.push(goal('g1'));},
    b=>{b.transactions[0].amount=-1;},
    b=>{b.transactions[0].amount=0;},
    b=>{b.transactions[0].amount=1e10;},
    b=>{b.transactions[0].category='<script>';},
    b=>{b.goals[0].saved=-10;},
    b=>{b.allocations[0].amount=Number.POSITIVE_INFINITY;},
    b=>{b.completedAportes.push(123);},
  ];
  for (const [i,change] of variations.entries()) {
    const sample=backup();change(sample);
    assert.throws(()=>validarBackup(sample,categories),Error,`Variação inválida ${i}`);
  }
});

test('Dados locais antigos recuperam campos opcionais sem perder registros', async () => {
  const {normalizarDadosLocais} = await load('dist/modules/validacao.js');
  const data={transactions:[{...tx(),recurring:undefined,createdAt:undefined}],goals:[{...goal(),deadline:undefined}]};
  const normalized=normalizarDadosLocais(data);
  assert.equal(normalized.transactions.length,1);
  assert.equal(normalized.transactions[0].recurring,false);
  assert.equal(normalized.transactions[0].createdAt,'2026-11-18T12:00:00.000Z');
  assert.equal(normalized.goals[0].deadline,'');
  assert.deepEqual(normalized.allocations,[]);
  assert.deepEqual(normalized.completedAportes,[]);
});

test('Dados locais corrompidos são rejeitados antes de renderizar', async () => {
  const {normalizarDadosLocais} = await load('dist/modules/validacao.js');
  for (const item of [{transactions:[{}],goals:[]},{transactions:[],goals:[{}]},
    {transactions:[{...tx(),date:'2026-02-31'}],goals:[]},
    {transactions:[],goals:[],allocations:[{...allocation(),id:123}]},
    {transactions:[],goals:[],completedAportes:[null]}]) {
    assert.throws(()=>normalizarDadosLocais(item),Error);
  }
});

test('Falha na leitura bloqueia substituição automática e permite restauração explícita', async () => {
  const {normalizarDadosLocais} = await load('dist/modules/validacao.js');
  const app=read('dist/app.js');
  const code=app.slice(app.indexOf('  function readData() {'),app.indexOf('  function icon(name) {'));
  const entries=new Map([['meu-dinheiro-essencial:v1','{"transactions":[{}],"goals":[]}']]);
  const warnings=[];
  const sandbox={
    KEY:'meu-dinheiro-essencial:v1', normalizarDadosLocais, storageLocked:false,
    localStorage:{getItem:key=>entries.get(key),setItem:(key,value)=>entries.set(key,value)},
    dialogos:{informar:(_,message)=>{warnings.push(message);return Promise.resolve(true);}},
    registrar:()=>{},console:{error:()=>{}},folderBackup:null,
    espelho:{gravar:()=>Promise.resolve(true)},
  };
  vm.createContext(sandbox);
  vm.runInContext(`${code}\nthis.readData=readData;this.persist=persist;`,sandbox);
  sandbox.data=sandbox.readData();
  const corrupt=entries.get(sandbox.KEY);
  assert.equal(sandbox.storageLocked,true);
  assert.equal(sandbox.persist({transactions:[tx()],goals:[goal()]}),false);
  assert.equal(entries.get(sandbox.KEY),corrupt);
  assert.ok(warnings.some(message=>message.includes('bloqueada')));
  const recovered={transactions:[tx()],goals:[goal()],allocations:[],completedAportes:[]};
  assert.equal(sandbox.persist(recovered,{allowRecovery:true}),true);
  assert.equal(sandbox.storageLocked,false);
  assert.deepEqual(JSON.parse(entries.get(sandbox.KEY)).transactions,[tx()]);
});
