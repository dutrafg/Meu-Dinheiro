const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname,'..','dist','app.js'),'utf8');
const section = source.slice(source.indexOf('  function occurrenceDate(t, ym) {'),source.indexOf('  function renderReminderCount() {'));

function model(data) {
  const sandbox = {
    data,
    preferencias:{obter:()=>({tema:'auto',cor:'verde',percentual:10,categoriasAporte:['Salário base','Salário','Personal'],reservaGoalId:''})},
    n2: value => Math.round((Number(value) + Number.EPSILON) * 100) / 100,
    isoDate: date => `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`,
    shiftMonth: (ym,diff) => {const [y,m]=ym.split('-').map(Number);return new Date(Date.UTC(y,m-1+diff,1)).toISOString().slice(0,7);},
    validCdiQuote: () => ({dailyPercent:0.04}), money: value => `R$ ${Number(value).toFixed(2)}`,
  };
  vm.createContext(sandbox);
  const rules=fs.readFileSync(path.join(__dirname,'..','dist','modules','regras-financeiras.js'),'utf8').replace(/^export /gm,'');
  vm.runInContext(`${rules}\n${section}\nthis.api={occurrenceDate,transactionsInMonth,sums,savingPlan,reservePrincipal,reserveYieldEstimate,dueAportes}`,sandbox);
  sandbox.api.setPreferences=prefs=>{sandbox.preferencias.obter=()=>prefs;};
  return sandbox.api;
}

const tx = (id,type,category,amount,date,recurring=false) => ({id,type,category,amount,date,recurring,
  description:`Teste ${id}`,createdAt:`${date}T12:00:00.000Z`});

test('Recorrência no dia 31 usa o último dia real do mês, incluindo fevereiro bissexto', () => {
  const t=tx('1','expense','Moradia',100,'2024-01-31',true);
  const m=model({transactions:[t],goals:[],allocations:[],completedAportes:[]});
  assert.equal(m.occurrenceDate(t,'2024-02'),'2024-02-29');
  assert.equal(m.occurrenceDate(t,'2025-02'),'2025-02-28');
  assert.equal(m.occurrenceDate(t,'2024-04'),'2024-04-30');
  assert.equal(m.occurrenceDate(t,'2024-03'),'2024-03-31');
  assert.equal(m.occurrenceDate(t,'2023-12'),null);
});

test('Lançamento simples não reaparece no mês seguinte e não duplica saldo', () => {
  const entries=[tx('1','income','Salário base',5000,'2026-11-05'),tx('2','expense','Moradia',1800,'2026-11-10'),tx('3','expense','Internet',100,'2026-11-11',true)];
  const m=model({transactions:entries,goals:[],allocations:[],completedAportes:[]});
  assert.equal(m.sums('2026-11').income,5000);
  assert.equal(m.sums('2026-11').expense,1900);
  assert.equal(m.sums('2026-11').balance,3100);
  assert.equal(m.sums('2026-12').income,0);
  assert.equal(m.sums('2026-12').expense,100);
  assert.equal(m.transactionsInMonth('2026-12').length,1);
});

test('Plano de aporte soma 10% apenas de Salário/Salário base e Personal', () => {
  const entries=[tx('1','income','Salário base',5000,'2026-11-05'),tx('2','income','Personal',1350,'2026-11-06'),
    tx('3','income','Renda extra',2000,'2026-11-06'),tx('4','expense','Moradia',900,'2026-11-06')];
  const plan=model({transactions:entries,goals:[],allocations:[],completedAportes:[]}).savingPlan('2026-11');
  assert.equal(plan.baseTen,500);
  assert.equal(plan.personalTen,135);
  assert.equal(plan.total,635);
});

test('Plano usa porcentagens/categorias escolhidas sem alterar lançamentos originais',()=>{
  const entries=[tx('1','income','Salário base',1000,'2026-11-05'),tx('2','income','Renda extra',200,'2026-11-05')];
  const m=model({transactions:entries,goals:[],allocations:[],completedAportes:[]});
  m.setPreferences({percentual:25,categoriasAporte:['Renda extra'],reservaGoalId:''});
  const plan=m.savingPlan('2026-11');
  assert.equal(plan.total,50);
  assert.equal(plan.grupos[0].categoria,'Renda extra');
  assert.equal(plan.grupos[0].base,200);
  assert.equal(entries[0].amount,1000);
});

test('Reserva inclui objetivos e aplicações sem vínculo, sem contar duas vezes as vinculadas', () => {
  const data={transactions:[],goals:[{id:'g1',kind:'goal',name:'Reserva de emergência',saved:2000,target:10000}],
    allocations:[{id:'a1',kind:'reserve',amount:500,goalId:'g1'},{id:'a2',kind:'reserve',amount:300,goalId:''}],completedAportes:[]};
  const m=model(data);
  assert.equal(m.reservePrincipal(),2300);
  assert.match(m.reserveYieldEstimate(),/100% do CDI/);
});

test('Dez mil lançamentos preservam os centavos ao totalizar', () => {
  const entries=Array.from({length:10000},(_,i)=>tx(String(i),'expense','Alimentação',0.01,'2026-11-18'));
  const m=model({transactions:entries,goals:[],allocations:[],completedAportes:[]});
  assert.equal(m.sums('2026-11').expense,100);
  assert.equal(m.sums('2026-11').count,10000);
});

test('Lembretes concluídos deixam de aparecer; os não concluídos permanecem', () => {
  const recent=new Date();
  const date=`${recent.getFullYear()}-${String(recent.getMonth()+1).padStart(2,'0')}-01`;
  const entries=[tx('1','income','Salário base',1000,date),tx('2','income','Renda extra',500,date)];
  const data={transactions:entries,goals:[],allocations:[],completedAportes:[`1@${date}`]};
  const due=model(data).dueAportes();
  assert.equal(due.length,1);
  assert.equal(due[0].key,`2@${date}`);
  assert.equal(due[0].tenPercent,null);
});
