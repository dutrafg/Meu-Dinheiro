const assert=require('node:assert/strict');
const test=require('node:test');
const fs=require('node:fs');
const path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../dist/modules/motor-financeiro.js'),'utf8');
const motor=import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
const regrasSource=fs.readFileSync(path.join(__dirname,'../dist/modules/regras-financeiras.js'),'utf8');
const regras=import('data:text/javascript;base64,'+Buffer.from(regrasSource).toString('base64'));

const criar=(id,type,amount,date,recurring=false)=>({id,type,amount,date,recurring,
  category:'Teste',description:'Exemplo',createdAt:date+'T12:00:00Z'});

test('Motor trata recorrências no dia 31 e fevereiro bissexto',async()=>{
  const {ocorrenciaNoMes}=await motor;
  const conta=criar('1','expense',10,'2024-01-31',true);
  assert.equal(ocorrenciaNoMes(conta,'2024-02'),'2024-02-29');
  assert.equal(ocorrenciaNoMes(conta,'2025-02'),'2025-02-28');
  assert.equal(ocorrenciaNoMes(conta,'2023-12'),null);
  assert.equal(ocorrenciaNoMes(criar('2','income',10,'2024-01-31'),'2024-02'),null);
});

test('Motor totaliza dez mil centavos sem perda de precisão',async()=>{
  const {totaisDoMes}=await motor;
  const itens=Array.from({length:10000},(_,i)=>criar(String(i),'expense',0.01,'2026-11-18'));
  const resultado=totaisDoMes(itens,'2026-11');
  assert.equal(resultado.expense,100);
  assert.equal(resultado.income,0);
  assert.equal(resultado.balance,-100);
  assert.equal(resultado.count,10000);
});

test('Motor separa investimentos vinculados da reserva não vinculada',async()=>{
  const {principalReserva}=await motor;
  const dados={transactions:[],goals:[
    {id:'reserva',name:'Reserva de emergência',kind:'goal',saved:200.12},
    {id:'viagem',name:'Viagem',kind:'goal',saved:300}],
    allocations:[
      {id:'i1',kind:'reserve',goalId:'reserva',amount:20.05},
      {id:'i2',kind:'reserve',goalId:'',amount:0.03}]};
  assert.equal(principalReserva(dados),200.15);
  assert.equal(principalReserva(dados,'reserva'),200.15);
  assert.equal(principalReserva({...dados,goals:[]}),20.08);
});

test('Motor não modifica entradas e filtra tipos/mês corretamente',async()=>{
  const {transacoesNoMes,totaisDoMes}=await motor;
  const itens=[criar('a','income',101.03,'2026-11-01'),criar('b','expense',25.02,'2026-11-15')];
  const anterior=JSON.stringify(itens);
  assert.equal(transacoesNoMes(itens,'2026-11','income').length,1);
  assert.equal(transacoesNoMes(itens,'2026-12').length,0);
  assert.equal(totaisDoMes(itens,'2026-11').balance,76.01);
  assert.equal(JSON.stringify(itens),anterior);
});

test('Motor identifica lembretes em seis meses e respeita aportes concluídos',async()=>{
  const {aportesPendentes}=await motor;
  const {calcularAporte}=await regras;
  const rendas=[
    {...criar('salario','income',100.01,'2026-01-31',true),category:'Salário base'},
    {...criar('avulso','income',50,'2026-06-01'),category:'Personal'},
    {...criar('antigo','income',90,'2026-05-31'),category:'Personal'},
    {...criar('futuro','income',90,'2026-11-23'),category:'Personal'},
    {...criar('outra','income',20,'2026-11-10'),category:'Renda extra'},
    criar('despesa','expense',30,'2026-11-03')
  ];
  const antes=JSON.stringify(rendas);
  const prefs={percentual:10,categoriasAporte:['Salário base','Personal']};
  const itens=aportesPendentes(rendas,['salario@2026-10-31'],'2026-11-22',t=>calcularAporte(t,prefs));
  assert.deepEqual(itens.map(item=>item.key),[
    'outra@2026-11-10','salario@2026-09-30','salario@2026-08-31',
    'salario@2026-07-31','salario@2026-06-30','avulso@2026-06-01'
  ]);
  assert.equal(itens[0].tenPercent,null,'Renda não configurada não recebe percentual automático');
  assert.equal(itens[1].tenPercent,10);
  assert.equal(itens.at(-1).tenPercent,5);
  assert.equal(JSON.stringify(rendas),antes,'Lembretes não alteram transações');
});

test('Motor preserva dia de recorrência no fevereiro bissexto e ignora datas futuras',async()=>{
  const {aportesPendentes}=await motor;
  const renda=criar('r','income',100,'2024-01-31',true);
  const itens=aportesPendentes([renda],[],'2024-02-29',()=>10);
  assert.ok(itens.some(item=>item.key==='r@2024-02-29'));
  assert.ok(itens.some(item=>item.key==='r@2024-01-31'));
  assert.equal(aportesPendentes([renda],[],'2024-02-15',()=>10).some(item=>item.date==='2024-02-29'),false);
  assert.deepEqual(aportesPendentes([renda],[],'data-invalida',()=>10),[]);
});

test('Motor calcula projeção CDI bruta em centavos e não a confunde com saldo real',async()=>{
  const {estimarRendimentoCdi}=await motor;
  assert.equal(estimarRendimentoCdi(10000,0.04),84.34);
  assert.equal(estimarRendimentoCdi(10000,0.04,1),4);
  assert.equal(estimarRendimentoCdi(0,0.04),null);
  assert.equal(estimarRendimentoCdi(10000,0),null);
  assert.equal(estimarRendimentoCdi(10000,2),null);
  assert.equal(estimarRendimentoCdi(Number.NaN,0.04),null);
  assert.equal(estimarRendimentoCdi(10000,0.04,0),null);
});

test('Motor processa dez mil rendas avulsas sem criar ou alterar aportes',async()=>{
  const {aportesPendentes}=await motor;
  const itens=Array.from({length:10000},(_,i)=>criar(String(i),'income',0.01,'2026-11-01'));
  const resultado=aportesPendentes(itens,[], '2026-11-22',()=>0);
  assert.equal(resultado.length,10000);
  assert.equal(resultado[0].tenPercent,0);
  assert.equal(itens[0].occurrence,undefined);
  assert.equal(itens.at(-1).occurrence,undefined);
});
