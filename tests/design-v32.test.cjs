const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { Script } = require('node:vm');

const root = path.resolve(__dirname, '..');
const domain = require('../preview-v32/domain.js');
const example = [
  { id: 'a', type: 'income', amount: 2500, description: 'Salário', category: 'Salário base', date: '2026-01-31', recurring: true },
  { id: 'b', type: 'expense', amount: 250.25, description: 'Alimentação', category: 'Alimentação', date: '2026-02-01', recurring: false },
  { id: 'c', type: 'expense', amount: 49.75, description: 'Internet', category: 'Contas', date: '2026-02-28', recurring: true },
  { id: 'd', type: 'expense', amount: 10, description: 'Não é fevereiro', category: 'Outros', date: '2026-03-03', recurring: false }
];

test('Recorrência mensal ajusta o último dia para fevereiro sem duplicar outras datas', () => {
  assert.equal(domain.occurrenceDate(example[0], '2026-02'), '2026-02-28');
  assert.equal(domain.occurrenceDate(example[0], '2028-02'), '2028-02-29');
  assert.equal(domain.occurrenceDate(example[3], '2026-02'), null);
  assert.equal(domain.occurrenceDate(example[1], '2026-03'), null);
  assert.equal(domain.occurrenceDate({ ...example[0], type: 'invalid' }, '2026-02'), null);
});

test('Extrato reúne receitas e despesas com valores íntegros e ordem por dia', () => {
  const entries = domain.monthlyEntries(example, '2026-02');
  assert.equal(entries.length, 3);
  assert.deepEqual(entries.map(item => item.occurrence), ['2026-02-28', '2026-02-28', '2026-02-01']);
  const groups = domain.groupedEntries(entries);
  assert.equal(groups.length, 2);
  assert.equal(groups[0].income, 2500);
  assert.equal(groups[0].expense, 49.75);
  assert.equal(groups[1].expense, 250.25);
  assert.equal(domain.groupedEntries(entries, 'expense').length, 2);
  assert.equal(domain.groupedEntries(entries, 'income').length, 1);
  assert.equal(domain.groupedEntries(entries, 'all', 'ALIMENTA').length, 1);
});

test('Indicadores diferenciam receitas, despesas, valores futuros e top categorias', () => {
  const stats = domain.summary(domain.monthlyEntries(example, '2026-02'), '2026-02-15');
  assert.equal(stats.income, 2500);
  assert.equal(stats.expense, 300);
  assert.equal(stats.currentBalance, -250.25);
  assert.equal(stats.futureIncome, 2500);
  assert.equal(stats.futureExpense, 49.75);
  assert.deepEqual(stats.categories.map(item => item.name), ['Alimentação', 'Contas']);
});

test('Prévia é isolada da publicação e mantém ações principais do HTML v31', () => {
  const markup = fs.readFileSync(path.join(root, 'dist/index.html'), 'utf8');
  const overlay = fs.readFileSync(path.join(root, 'preview-v32/design.js'), 'utf8');
  assert.match(markup, /id="investment-dialog"/);
  assert.match(markup, /id="finance-calendar-dialog"/);
  assert.match(markup, /id="open-diagnostics"/);
  assert.match(markup, /id="export-pdf"/);
  assert.match(overlay, /data-action=\\"edit\\"|data-action="edit"/);
  assert.match(read('dist/modules/resumo.js'), /data-calendar-open/);
  assert.doesNotMatch(markup, /data-open-calendar-settings/);
  assert.match(overlay, /data-design-open="settings"/);
  assert.match(overlay, /data-v32-view/);
  assert.doesNotMatch(overlay, /localStorage\.setItem|localStorage\.removeItem|indexedDB\.deleteDatabase/);
});

test('Gerador produz HTML único e JavaScript sintaticamente válido', () => {
  const output = path.join(root, '..', 'Meu-Dinheiro-v32-Design-Testes.html');
  execFileSync(process.execPath, [path.join(root, 'scripts/gerar-html-design-v32.cjs'), output]);
  const html = fs.readFileSync(output, 'utf8');
  assert.match(html, /<title>Meu Dinheiro — Prévia de Design v32<\/title>/);
  assert.match(html, /id="design-v32-css"/);
  assert.match(html, /id="design-v32-domain"/);
  assert.match(html, /id="design-v32-interface"/);
  assert.match(html, /Criar|Novo investimento/);
  assert.match(html, /diagnóstico completo|diagnostico/i);
  assert.doesNotMatch(html, /<script[^>]+src="\.\//);
  assert.doesNotMatch(html, /<link[^>]+href="\.\//);
  for (const [, source] of html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)) new Script(source);
});
