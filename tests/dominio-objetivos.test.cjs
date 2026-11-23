const test=require('node:test');
const assert=require('node:assert/strict');
const {pathToFileURL}=require('node:url');
const path=require('node:path');
const dominio=import(pathToFileURL(path.join(__dirname,'../dist/modules/dominio-objetivos.js')).href);

const dados=()=>({goals:[
  {id:'r',kind:'goal',name:'Reserva de emergência',target:1000,saved:230.12},
  {id:'m',kind:'goal',name:'Curso',target:1000,saved:50},
  {id:'d',kind:'dream',name:'Viagem',target:2500,saved:100.01}
],allocations:[
  {id:'i1',goalId:'r',kind:'goal',amount:30.05},
  {id:'i2',goalId:'',kind:'reserve',amount:0.03},
  {id:'i3',goalId:'desconhecido',kind:'goal',amount:15.01},
  {id:'i4',goalId:'',kind:'dream',amount:20.02}
]});

test('P1: progresso e restante são puros, limitados e precisos em centavos',async()=>{
  const {percentualObjetivo,restanteObjetivo}=await dominio;
  assert.equal(percentualObjetivo({target:200,saved:50}),25);
  assert.equal(percentualObjetivo({target:200,saved:250}),100);
  assert.equal(percentualObjetivo({target:0,saved:10}),0);
  assert.equal(percentualObjetivo({target:200,saved:-10}),0);
  assert.equal(restanteObjetivo({target:200.10,saved:20.03}),180.07);
  assert.equal(restanteObjetivo({target:200,saved:250}),0);
  assert.equal(restanteObjetivo({target:undefined,saved:10}),0);
});

test('P1: totais não contam investimento vinculado duas vezes',async()=>{
  const {resumirObjetivos}=await dominio;
  const entrada=dados(),antes=JSON.stringify(entrada);
  const metas=resumirObjetivos(entrada,'goal');
  const sonhos=resumirObjetivos(entrada,'dream');
  assert.equal(metas.guardado,295.16,'230,12 + 50 + 0,03 + 15,01');
  assert.equal(metas.alvo,2000);
  assert.equal(metas.semVinculo.length,2);
  assert.equal(sonhos.guardado,120.03);
  assert.equal(sonhos.alvo,2500);
  assert.equal(sonhos.semVinculo.length,1);
  assert.equal(JSON.stringify(entrada),antes,'Não altera metas ou aplicações originais');
  assert.equal(resumirObjetivos({goals:[],allocations:[]},'goal').guardado,0);
});

test('P1: candidatos respeitam meta, reserva e sonho sem modificar a seleção',async()=>{
  const {candidatosVinculo,destaquesObjetivos}=await dominio;
  const entrada=dados();
  assert.deepEqual(candidatosVinculo(entrada,'reserve').map(g=>g.id),['r']);
  assert.deepEqual(candidatosVinculo(entrada,'goal').map(g=>g.id),['m']);
  assert.deepEqual(candidatosVinculo(entrada,'dream').map(g=>g.id),['d']);
  assert.equal(destaquesObjetivos(entrada).reserva.id,'r');
  assert.equal(destaquesObjetivos(entrada).sonho.id,'d');
  assert.equal(destaquesObjetivos(entrada,'m').reserva.id,'m');
  assert.equal(destaquesObjetivos({goals:[]}).reserva,null);
});

test('P1: milhares de objetivos e aplicações não somam novamente vínculos',async()=>{
  const {resumirObjetivos}=await dominio;
  const entrada={goals:Array.from({length:1000},(_,i)=>({id:String(i),kind:'goal',name:'Meta',target:1,saved:0.01})),
    allocations:Array.from({length:10000},(_,i)=>({id:`i${i}`,goalId:String(i%1000),kind:'goal',amount:0.01}))};
  assert.equal(resumirObjetivos(entrada,'goal').guardado,10);
  assert.equal(resumirObjetivos(entrada,'goal').semVinculo.length,0);
});
