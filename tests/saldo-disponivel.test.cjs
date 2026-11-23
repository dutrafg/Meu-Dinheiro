const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {pathToFileURL}=require('node:url');
const source=fs.readFileSync(path.join(__dirname,'..','dist/modules/resumo.js'),'utf8');
const carregar=()=>import(pathToFileURL(path.join(__dirname,'..','dist/modules/resumo.js')).href);

test('Saldo de hoje acumula histórico até a data atual, sem antecipar lançamentos',async()=>{
  const {calcularSaldoDisponivelHoje:saldo}=await carregar();
  const items=[
    {type:'income',date:'2026-10-25',amount:1200},
    {type:'expense',date:'2026-11-01',amount:250},
    {type:'expense',date:'2026-11-19',amount:70},
    {type:'income',date:'2026-11-20',amount:5000},
    {type:'expense',date:'2026-12-01',amount:2000}
  ];
  assert.equal(saldo(items,'2026-11-19'),880);
  assert.equal(saldo(items,'2026-11-20'),5880);
  assert.equal(saldo(items,'2026-10-01'),0);
});

test('Recorrência mensal conta o primeiro mês e apenas as parcelas já vencidas',async()=>{
  const {calcularSaldoDisponivelHoje:saldo}=await carregar();
  const items=[{type:'income',date:'2026-01-31',amount:100,recurring:true}];
  assert.equal(saldo(items,'2026-01-30'),0);
  assert.equal(saldo(items,'2026-01-31'),100);
  assert.equal(saldo(items,'2026-02-27'),100);
  assert.equal(saldo(items,'2026-02-28'),200,'Dia 31 é ajustado ao fim de fevereiro');
  assert.equal(saldo(items,'2026-03-30'),200);
  assert.equal(saldo(items,'2026-03-31'),300);
});

test('Saldo permite resultado negativo e não desconta metas nem aplicações',async()=>{
  const {calcularSaldoDisponivelHoje:saldo}=await carregar();
  const items=[{type:'expense',date:'2026-11-01',amount:400,recurring:true},
    {type:'income',date:'2026-11-10',amount:120}];
  const original=JSON.stringify(items);
  assert.equal(saldo(items,'2026-11-19'),-280);
  assert.equal(JSON.stringify(items),original,'Cálculo não modifica os dados registrados');
  assert.equal(saldo([],'2026-11-19'),0);
  assert.equal(saldo(null,'2026-11-19'),null);
  assert.equal(saldo(items,'data inválida'),null);
});

test('Investimento do salário reduz caixa disponível sem virar despesa, e antigo não reduz',async()=>{
  const {calcularSaldoDisponivelHoje:saldo}=await carregar();
  const lancamentos=[{id:'s',type:'income',date:'2026-11-05',amount:2500,category:'Salário base'},
    {id:'d',type:'expense',date:'2026-11-08',amount:400}];
  const aportes=[{origin:'salary',salaryId:'s',date:'2026-11-10',amount:500},
    {origin:'previous',date:'2026-11-01',amount:1000},
    {origin:'salary',salaryId:'s',date:'2026-11-20',amount:200},
    {date:'2026-11-04',amount:150}];
  assert.equal(saldo(lancamentos,'2026-11-09',aportes),2100);
  assert.equal(saldo(lancamentos,'2026-11-19',aportes),1600);
  assert.equal(saldo(lancamentos,'2026-11-20',aportes),1400);
  assert.equal(saldo(lancamentos,'2026-11-20',[{origin:'salary',salaryId:'inexistente',date:'2026-11-10',amount:500}]),2100);
});

test('Resumo mostra cards independentes de reserva e sonhos com ações em estados vazios',()=>{
  assert.match(source,/aria-label="Resumo da reserva"/);
  assert.match(source,/aria-label="Resumo dos sonhos"/);
  assert.match(source,/data-action="add-goal" data-type="goal"/);
  assert.match(source,/data-action="add-goal" data-type="dream"/);
  assert.doesNotMatch(source,/<h3>Reserva e sonho<\/h3>/);
});

test('Diagnóstico traz verificação própria de saldo e cenário fictício sem dados financeiros reais',()=>{
  const diag=fs.readFileSync(path.join(__dirname,'..','dist/modules/diagnostico.js'),'utf8');
  const registro=fs.readFileSync(path.join(__dirname,'..','dist/modules/registro-modulos.js'),'utf8');
  assert.match(diag,/conferir\('SALDO_DISPONIVEL_HOJE'/);
  assert.match(diag,/saldoExemplo===150/);
  assert.match(registro,/registrar\('resumo',[\s\S]*calcularSaldoDisponivelHoje/);
});
