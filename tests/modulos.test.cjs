const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const read = filename => fs.readFileSync(path.join(root, filename), 'utf8');
const load = async filename => import(`data:text/javascript;base64,${Buffer.from(read(filename).replace(/^import .*$/gm,'')).toString('base64')}`);

function context(data) {
  const money = amount => `R$ ${Number(amount).toFixed(2)}`;
  const esc = text => String(text ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('"', '&quot;');
  const month = '2026-11';
  const transactionsInMonth = (ym, type) => data.transactions
    .filter(t => t.date.startsWith(ym) && (!type || t.type === type))
    .map(t => ({...t, occurrence: t.date}));
  const sums = ym => {
    const list = transactionsInMonth(ym);
    const income = list.filter(t => t.type === 'income').reduce((n, t) => n + t.amount, 0);
    const expense = list.filter(t => t.type === 'expense').reduce((n, t) => n + t.amount, 0);
    return {income, expense, balance: income - expense, count: list.length};
  };
  return {
    getData: () => data, getPreferences:()=>({reservaGoalId:''}), getMonth: () => month, getSearch: () => '', getFilterCategory: () => '',
    money, esc, n2: value => Math.round(Number(value) * 100) / 100,
    header: () => '<header>Resumo</header>', empty: text => `<p>${esc(text)}</p>`,
    icon: () => '<svg></svg>', currentMonth: month, sums, transactionsInMonth,
    CATEGORIES: {income: ['Salário base'], expense: ['Alimentação']},
    CATEGORY_ICONS: {'Salário base': '💼', Alimentação: '🍔'},
    EXPENSE_COLORS: {Alimentação: '#e5a270'},
    categorySet: type => type === 'income' ? ['Salário base'] : ['Alimentação'],
    shiftMonth: (ym, diff) => { const [y,m] = ym.split('-').map(Number); return new Date(Date.UTC(y,m-1+diff,1)).toISOString().slice(0,7); },
    monthLabel: ym => ym, shortMonth: ym => ym.slice(5),
    isoDate: value => value.toISOString().slice(0,10),
    parseDate: value => new Date(`${value}T12:00:00Z`),
    fmtDate: {format: date => date.toISOString().slice(0,10)},
    savingPlan: () => ({percentual:10,grupos:[{categoria:'Salário base',base:100,aporte:10}],base: 100, personal: 0, baseTen: 10, personalTen: 0, total: 10}),
    reserveYieldEstimate: () => '',
  };
}

test('Os cinco módulos de negócio exportam inicializadores independentes', async () => {
  const files = ['resumo','lancamentos','objetivos','backup','csv-interface'];
  for (const name of files) {
    const loaded = await load(`dist/modules/${name}.js`);
    assert.equal(Object.keys(loaded).length, 1, `Exportação do módulo ${name}`);
    assert.equal(typeof Object.values(loaded)[0], 'function');
  }
});

test('Resumo, Renda, Despesas, Metas e Sonho renderizam com os mesmos dados', async () => {
  const data = {
    transactions: [
      {id:'1',type:'income',description:'Salário',amount:3000,date:'2026-11-05',category:'Salário base',recurring:false,createdAt:'2026-11-05'},
      {id:'2',type:'expense',description:'Mercado',amount:500,date:'2026-11-06',category:'Alimentação',recurring:false,createdAt:'2026-11-06'},
    ],
    goals: [
      {id:'g1',kind:'goal',name:'Reserva de emergência',target:1000,saved:250,deadline:''},
      {id:'g2',kind:'dream',name:'Viagem',target:2000,saved:200,deadline:''},
    ],
    allocations: [], completedAportes: [],
  };
  const analytic = require('../dist/analytics.js');
  const oldWindow = global.window;
  global.window = {MeuDinheiroAnalytics: analytic};
  try {
    const ctx = context(data);
    const transactions = (await load('dist/modules/lancamentos.js')).criarModuloLancamentos(ctx);
    const goals = (await load('dist/modules/objetivos.js')).criarModuloObjetivos(ctx);
    const summary = (await load('dist/modules/resumo.js')).criarModuloResumo({...ctx,
      renderEntry: transactions.renderEntry, progressLine: goals.progressLine});
    assert.match(summary.renderSummary(), /Visão financeira/);
    assert.match(summary.renderSummary(), /Gastos por categoria/);
    assert.match(summary.renderSummary(), /Média por categoria/);
    assert.match(transactions.renderTransactions('income'), /Salário/);
    assert.match(transactions.renderTransactions('expense'), /Mercado/);
    assert.match(goals.renderGoals('goal'), /aria-valuenow="25"/);
    assert.match(goals.renderGoals('dream'), /aria-valuenow="10"/);
    assert.equal(goals.goalCandidates('reserve')[0].id, 'g1');
  } finally {
    global.window = oldWindow;
  }
});

test('Todas as folhas CSS são carregadas na ordem e incluídas no cache offline', () => {
  const css = read('dist/prototype.css');
  const assets = read('dist/sw.js');
  for (const name of ['estrutura','resumo','objetivos','dialogos','responsivo','ajustes']) {
    assert.ok(css.includes(`./css/${name}.css`), name);
    assert.ok(assets.includes(`./css/${name}.css`), name);
    assert.ok(read(`dist/css/${name}.css`).length > 50, name);
  }
});
