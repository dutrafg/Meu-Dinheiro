const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { Script } = require('node:vm');

const root = path.resolve(__dirname, '..');
const b = require('../preview-v33/domain/orcamento.js');
const p = require('../preview-v33/domain/previsao.js');
const example = [
  { type:'income', amount:2500, category:'Salário base', occurrence:'2026-11-10' },
  { type:'expense', amount:250.25, category:'Alimentação', occurrence:'2026-11-12' },
  { type:'expense', amount:49.75, category:'Alimentação', occurrence:'2026-11-27' },
  { type:'expense', amount:60, category:'Contas', occurrence:'2026-11-03' }
];

function mockStorage() {
  const map = new Map();
  return {
    getItem:key=>map.get(key) ?? null,
    setItem:(key,val)=>{map.set(key,val);},
    contents:key=>map.get(key)
  };
}

test('Centavos exatos aceitam padrão brasileiro e rejeitam entradas ambíguas', () => {
  assert.equal(b.toCent('1.230,45'), 123045);
  assert.equal(b.toCent('0,01'), 1);
  assert.equal(b.toCent('R$ 800,00'), 80000);
  assert.equal(b.toCent('800.00'), 80000);
  assert.equal(b.toCent(0.1+0.2), 30);
  for (const invalid of ['-3','1,333','1.2.3','R$ 12abc','',null,NaN,-10,Infinity]) assert.equal(b.toCent(invalid), null);
});

test('Schema do orçamento recusa categoria duplicada, protótipo e limite inválido', () => {
  const good = {schemaVersion:1,revision:0,budgets:[{category:'Contas',limitCent:10000}]};
  assert.deepEqual(b.normalize(good),good);
  for (const entry of [{category:'__proto__',limitCent:10000},{category:'Contas',limitCent:0},{category:'Contas',limitCent:10.5}]) {
    assert.throws(()=>b.normalize({...good,budgets:[entry]}));
  }
  assert.throws(()=>b.normalize({...good,budgets:[good.budgets[0],good.budgets[0]]}));
  assert.throws(()=>b.normalize({...good,schemaVersion:2}));
});

test('Store de orçamento mantém cópia independente do financeiro e permite revisões', () => {
  const storage = mockStorage();
  storage.setItem('financial','{"transactions":[{"amount":10}]}');
  const store = b.createStore(storage,'budget');
  assert.equal(store.locked(),false);
  assert.equal(store.save([{category:'Alimentação',limitCent:50000}]).ok,true);
  assert.equal(store.current().revision,1);
  assert.equal(storage.getItem('financial'),'{"transactions":[{"amount":10}]}');
  const copy = store.current();copy.budgets[0].limitCent = 1;
  assert.equal(store.current().budgets[0].limitCent,50000);
});

test('Duas abas não sobrescrevem orçamento modificado por outra', () => {
  const storage = mockStorage();
  const first = b.createStore(storage,'budget');
  const second = b.createStore(storage,'budget');
  assert.equal(first.save([{category:'Contas',limitCent:50000}]).ok,true);
  assert.equal(second.save([{category:'Contas',limitCent:25000}]).reason,'conflito');
  assert.equal(second.refresh(),true);
  assert.equal(second.save([{category:'Contas',limitCent:25000}]).ok,true);
  assert.equal(first.save([]).reason,'conflito');
});

test('Arquivo local corrompido bloqueia escrita e preserva bytes originais', () => {
  const storage = mockStorage();
  storage.setItem('budget','{invalido');
  const store = b.createStore(storage,'budget');
  assert.equal(store.locked(),true);
  assert.equal(store.save([]).ok,false);
  assert.equal(storage.getItem('budget'),'{invalido');
});

test('Orçamento diferencia 79, 80, 100 e 101 por cento e despesas futuras', () => {
  const budget = [{category:'Alimentação',limitCent:10000}];
  for (const [amount,status] of [[79,'ok'],[80,'atencao'],[100,'atencao'],[101,'excedido']]) {
    const entries = [{type:'expense',category:'Alimentação',amount,occurrence:'2026-11-10'}];
    assert.equal(b.evaluate(entries,budget,'2026-11-21')[0].status,status);
  }
  const report = b.evaluate(example,budget,'2026-11-21')[0];
  assert.equal(report.spentCent,25025);
  assert.equal(report.scheduledCent,4975);
  assert.equal(report.pct,250.3);
});

test('Previsão em centavos separa realizado, compromissos e fechamento mensal', () => {
  const value = p.forecast(example,'2026-11','2026-11-21');
  assert.equal(value.byDay.length,30);
  assert.equal(value.currentResultCent,218975);
  assert.equal(value.futureExpenseCent,4975);
  assert.equal(value.futureIncomeCent,0);
  assert.equal(value.closingResultCent,214000);
  assert.equal(value.byDay.at(-1).balanceCent,value.closingResultCent);
});

test('Previsão trata fevereiro bissexto e mês anterior ou futuro', () => {
  assert.equal(p.forecast([], '2028-02','2028-02-21').byDay.length,29);
  const future = p.forecast(example.map(item=>({...item,occurrence:item.occurrence.replace('2026-11','2026-12')})),'2026-12','2026-11-21');
  assert.equal(future.currentResultCent,0);
  assert.equal(future.closingResultCent,214000);
  assert.throws(()=>p.forecast([], '2026-13','2026-11-21'));
});

test('Previsão é determinística, imutável e consistente em 1.000 cenários', () => {
  let seed = 61;
  const random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  for (let caseIndex=0;caseIndex<1000;caseIndex++) {
    const entries = Array.from({length:1+Math.floor(random()*50)},()=>({
      occurrence:`2026-11-${String(1+Math.floor(random()*30)).padStart(2,'0')}`,
      type:random()<.5?'income':'expense',
      amount:Math.floor(random()*20000)/100
    }));
    const before = JSON.stringify(entries);
    const forecast = p.forecast(entries,'2026-11','2026-11-21');
    const sum = entries.reduce((total,item)=>total+(item.type==='income'?1:-1)*Math.round(item.amount*100),0);
    assert.equal(forecast.closingResultCent,sum);
    assert.equal(JSON.stringify(entries),before);
  }
});

test('A prévia v33 mantém HTML autossuficiente, módulos e diagnóstico', () => {
  const filename = path.resolve(root,'..','Meu-Dinheiro-v33-Orcamento-Previsao-Testes.html');
  execFileSync(process.execPath,[path.join(root,'scripts/gerar-html-design-v33.cjs'),filename]);
  const html = fs.readFileSync(filename,'utf8');
  assert.match(html,/Meu Dinheiro — v33 Orçamento e Previsão/);
  assert.match(html,/data-preview-v33="domain\/orcamento.js"/);
  assert.match(html,/data-preview-v33="domain\/previsao.js"/);
  assert.match(html,/data-preview-v33="ui\/diagnostico.js"/);
  assert.match(html,/data-preview-v33="ui\/navegacao-hash.js"/);
  assert.match(html,/id="design-v33-budget-form"/);
  assert.match(html,/id="export-pdf"/);
  assert.match(html,/id="finance-calendar-dialog"/);
  assert.match(html,/id="investment-dialog"/);
  assert.doesNotMatch(html,/<script[^>]+src="\.\//);
  assert.doesNotMatch(html,/<link[^>]+href="\.\//);
  for (const [, source] of html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)) new Script(source);
});

test('O editor não altera registros financeiros diretamente nem apaga storage v1', () => {
  const source = fs.readFileSync(path.join(root,'preview-v33/ui/orcamento-previsao.js'),'utf8');
  assert.doesNotMatch(source,/localStorage\.setItem\(DATA_KEY|localStorage\.removeItem\(DATA_KEY/);
  assert.match(source,/design-v33-budget-export/);
  assert.match(source,/design-v33-budget-import/);
  assert.match(source,/confirm\(/);
});
