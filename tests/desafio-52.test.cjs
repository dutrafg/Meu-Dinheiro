const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {pathToFileURL}=require('node:url');
const importar=()=>import(pathToFileURL(path.join(__dirname,'../dist/modules/desafio-52.js')).href);

test('Desafio tem 52 semanas de 2 a 104 reais, total 2756',async()=>{
  const {valorSemana52,resumirDesafio52}=await importar();
  assert.equal(valorSemana52(1),2);
  assert.equal(valorSemana52(52),104);
  assert.equal(valorSemana52(0),null);
  assert.equal(valorSemana52(53),null);
  const r=resumirDesafio52({goals:[],allocations:[]});
  assert.equal(r.meta,2756);
  assert.equal(r.semanas.length,52);
  assert.equal(r.semanas.reduce((s,x)=>s+x.valor,0),2756);
});

test('Só registra semanas com aporte real e descrição, categoria e valor correspondentes',async()=>{
  const {resumirDesafio52,descricaoSemana52,CATEGORIA_DESAFIO_52}=await importar();
  const dados={goals:[{id:'g52',kind:'goal',name:'Desafio das 52 semanas',saved:500,target:2756}],allocations:[
    {goalId:'g52',category:CATEGORIA_DESAFIO_52,description:descricaoSemana52(1),amount:2},
    {goalId:'g52',category:CATEGORIA_DESAFIO_52,description:descricaoSemana52(2),amount:4},
    {goalId:'g52',category:'Outro',description:descricaoSemana52(3),amount:6},
    {goalId:'outro',category:CATEGORIA_DESAFIO_52,description:descricaoSemana52(4),amount:8},
    {goalId:'g52',category:CATEGORIA_DESAFIO_52,description:descricaoSemana52(5),amount:999}
  ]};
  const antes=JSON.stringify(dados);
  const r=resumirDesafio52(dados);
  assert.equal(r.concluidas,2);assert.equal(r.guardado,6);
  assert.equal(r.semanas[2].registrado,false);
  assert.equal(JSON.stringify(dados),antes);
});

test('Duas alocações idênticas não contam duas vezes e avisam duplicidade',async()=>{
  const {resumirDesafio52,descricaoSemana52,CATEGORIA_DESAFIO_52}=await importar();
  const a={goalId:'g',category:CATEGORIA_DESAFIO_52,description:descricaoSemana52(1),amount:2};
  const r=resumirDesafio52({goals:[{id:'g',kind:'goal',name:'Desafio das 52 semanas'}],allocations:[a,{...a}]});
  assert.equal(r.guardado,2);assert.equal(r.concluidas,1);assert.equal(r.duplicadas,true);
});

test('Cada semana abre investimento com origem escolhida pelo usuário, não grava por toque',()=>{
  const app=fs.readFileSync(path.join(__dirname,'../dist/app.js'),'utf8');
  const resumo=fs.readFileSync(path.join(__dirname,'../dist/modules/desafio-52.js'),'utf8');
  assert.match(app,/investimentos\.abrir\(id\)/);
  assert.match(app,/CATEGORIA_DESAFIO_52/);
  assert.match(resumo,/confirmar e salvar o aporte/);
  assert.doesNotMatch(resumo,/persist\(|localStorage|indexedDB/);
});
