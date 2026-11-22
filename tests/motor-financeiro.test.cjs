const assert=require('node:assert/strict');
const test=require('node:test');
const fs=require('node:fs');
const path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../dist/modules/motor-financeiro.js'),'utf8');
const motor=import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));

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
