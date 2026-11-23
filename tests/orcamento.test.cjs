const test=require('node:test');
const assert=require('node:assert/strict');
const {pathToFileURL}=require('node:url');
const path=require('node:path');

const importar=()=>import(pathToFileURL(path.join(__dirname,'..','dist','modules','orcamento.js')).href);

test('Autoverificação do orçamento usa a cota real de R$ 9,65 e rejeita regressões',async()=>{
  const {verificarOrcamentoSintetico}=await import(pathToFileURL(path.join(__dirname,'..','dist','modules','registro-modulos.js')).href);
  assert.equal(verificarOrcamentoSintetico(),true);
  assert.equal(verificarOrcamentoSintetico(()=>({gastoAnterior:20,cotaHoje:10,diasRestantes:29,restanteMes:280})),false,
    'O valor antigo de R$ 10,00 não pode voltar a produzir falso erro');
  assert.equal(verificarOrcamentoSintetico(()=>null),false);
});

test('Cota diária usa saldo do orçamento antes de hoje e desconta despesa do dia',async()=>{
  const {calcularOrcamentoDia}=await importar();
  const r=calcularOrcamentoDia([
    {type:'expense',amount:2324,date:'2026-11-21'},
    {type:'expense',amount:8.50,date:'2026-11-22'},
    {type:'income',amount:10000,date:'2026-11-20'}
  ],2600,'2026-11-22');
  assert.equal(r.diasRestantes,9);
  assert.equal(r.cotaHoje,30.66);
  assert.equal(r.podeGastarHoje,22.16);
  assert.equal(r.gastoAcumulado,2332.5);
  assert.equal(r.percentual,90);
  assert.equal(r.excedeu,false);
});

test('Recorrência inclui apenas ocorrência vencida, incluindo dia 31 ajustado para fevereiro',async()=>{
  const {calcularOrcamentoDia}=await importar();
  const r=calcularOrcamentoDia([
    {type:'expense',amount:200,date:'2025-01-31',recurring:true},
    {type:'expense',amount:50,date:'2026-02-28'},
    {type:'expense',amount:999,date:'2026-03-01'}
  ],500,'2026-02-27');
  assert.equal(r.gastoAcumulado,0);
  assert.equal(r.diasRestantes,2);
  assert.equal(r.podeGastarHoje,250);
  assert.equal(calcularOrcamentoDia([{type:'expense',amount:200,date:'2025-01-31',recurring:true}],500,'2026-02-28').gastoHoje,200);
});

test('Limite ultrapassado não gera cota negativa ou falsa disponibilidade',async()=>{
  const {calcularOrcamentoDia}=await importar();
  const r=calcularOrcamentoDia([{type:'expense',amount:101,date:'2026-11-20'}],100,'2026-11-22');
  assert.equal(r.podeGastarHoje,0);
  assert.equal(r.restanteMes,0);
  assert.equal(r.excedeu,true);
  assert.equal(calcularOrcamentoDia([],NaN,'2026-11-22'),null);
  assert.equal(calcularOrcamentoDia([],500,'2026-02-30'),null);
});

test('Campos e painel de orçamento estão vinculados ao mesmo gestor de preferências',async()=>{
  const fs=require('node:fs');
  const root=path.join(__dirname,'..');
  const read=p=>fs.readFileSync(path.join(root,p),'utf8');
  assert.match(read('dist/index.html'),/name="limiteMensal"/);
  assert.match(read('dist/index.html'),/name="metaPoupancaMensal"/);
  assert.match(read('dist/modules/ajustes.js'),/limiteMensal,metaPoupancaMensal/);
  assert.match(read('dist/modules/resumo.js'),/Hoje você pode gastar/);
  assert.match(read('dist/modules/resumo.js'),/Não é saldo de conta/);
});
