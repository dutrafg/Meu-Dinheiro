const assert = require('node:assert/strict');
const test = require('node:test');
const { expenseCategoryStats } = require('../dist/analytics.js');

test('Média usa apenas meses com registro em cada categoria', () => {
  const stats = expenseCategoryStats([
    {month:'2026-09',entries:[{category:'Faculdade',amount:100},{category:'Internet',amount:40}]},
    {month:'2026-10',entries:[{category:'Internet',amount:60},{category:'Internet',amount:10}]},
    {month:'2026-11',entries:[{category:'Faculdade',amount:200},{category:'Faculdade',amount:30}]}
  ]);
  assert.equal(stats.currentTotal,230);
  assert.deepEqual(stats.current,[{category:'Faculdade',amount:230}]);
  assert.deepEqual(stats.averages,[
    {category:'Faculdade',average:165,recordedMonths:2,total:330},
    {category:'Internet',average:55,recordedMonths:2,total:110}
  ]);
});

test('Até sete meses, sem preencher meses vazios com gastos artificiais', () => {
  const months=Array.from({length:7},(_,i)=>({month:String(i),entries:i===0?[{category:'Farmácia',amount:75}]:[]}));
  const stats=expenseCategoryStats(months);
  assert.equal(stats.currentTotal,0);
  assert.deepEqual(stats.current,[]);
  assert.equal(stats.averages[0].average,75);
  assert.equal(stats.averages[0].recordedMonths,1);
});

test('Sem lançamentos, ambos os gráficos exibem estado vazio', () => {
  const stats=expenseCategoryStats([{month:'2026-11',entries:[]}]);
  assert.deepEqual(stats,{current:[],averages:[],currentTotal:0});
});

test('Dez mil despesas continuam totalizando sem misturar categorias ou meses', () => {
  const months=Array.from({length:7},(_,i)=>({month:String(i),entries:[]}));
  let expected=0;
  for(let i=0;i<10000;i++){
    const index=i%7;
    const amount=(i%13)+1;
    months[index].entries.push({category:`Categoria ${i%9}`,amount});
    if(index===6)expected+=amount;
  }
  const result=expenseCategoryStats(months);
  assert.equal(result.currentTotal,expected);
  assert.equal(result.current.reduce((sum,item)=>sum+item.amount,0),expected);
  assert.equal(result.averages.length,9);
  assert.ok(result.averages.every(item=>item.recordedMonths===7));
});
