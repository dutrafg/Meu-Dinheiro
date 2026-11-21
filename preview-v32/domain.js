/*
 * Regras de apresentação da prévia v32.
 * Não grava dados, não altera o formato v1 e não substitui as regras financeiras da v31.
 */
(function (root) {
  'use strict';

  function occurrenceDate(item, month) {
    if (!item || typeof item.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(item.date)) return null;
    if (!/^\d{4}-\d{2}$/.test(month) || !['income', 'expense'].includes(item.type)) return null;
    if (!item.recurring) return item.date.slice(0, 7) === month ? item.date : null;
    if (item.date.slice(0, 7) > month) return null;
    const [year, monthNumber] = month.split('-').map(Number);
    const lastDay = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
    return `${month}-${String(Math.min(Number(item.date.slice(8, 10)), lastDay)).padStart(2, '0')}`;
  }

  function monthlyEntries(transactions, month) {
    return (Array.isArray(transactions) ? transactions : [])
      .map(item => ({ ...item, occurrence: occurrenceDate(item, month) }))
      .filter(item => item.occurrence && Number.isFinite(Number(item.amount)) && Number(item.amount) >= 0)
      .sort((a, b) => b.occurrence.localeCompare(a.occurrence) || String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
  }

  function groupedEntries(entries, type = 'all', search = '') {
    const needle = String(search).trim().toLocaleLowerCase('pt-BR');
    const filtered = entries.filter(item =>
      (type === 'all' || item.type === type) &&
      (!needle || `${item.description || ''} ${item.category || ''}`.toLocaleLowerCase('pt-BR').includes(needle))
    );
    const groups = [];
    for (const item of filtered) {
      let current = groups[groups.length - 1];
      if (!current || current.date !== item.occurrence) {
        current = { date: item.occurrence, income: 0, expense: 0, entries: [] };
        groups.push(current);
      }
      current.entries.push(item);
      current[item.type] = Math.round((current[item.type] + Number(item.amount)) * 100) / 100;
    }
    return groups;
  }

  function summary(entries, todayISO) {
    const result = { income: 0, expense: 0, currentBalance: 0, futureIncome: 0, futureExpense: 0, categories: [] };
    const categories = new Map();
    for (const item of entries) {
      const amount = Number(item.amount);
      result[item.type] += amount;
      if (item.occurrence <= todayISO) result.currentBalance += item.type === 'income' ? amount : -amount;
      else result[item.type === 'income' ? 'futureIncome' : 'futureExpense'] += amount;
      if (item.type === 'expense') categories.set(item.category || 'Outros', (categories.get(item.category || 'Outros') || 0) + amount);
    }
    for (const key of ['income', 'expense', 'currentBalance', 'futureIncome', 'futureExpense']) result[key] = Math.round(result[key] * 100) / 100;
    result.categories = [...categories.entries()].map(([name, amount]) => ({ name, amount: Math.round(amount * 100) / 100 }))
      .sort((a, b) => b.amount - a.amount).slice(0, 3);
    return result;
  }

  const api = Object.freeze({ occurrenceDate, monthlyEntries, groupedEntries, summary });
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.MeuDinheiroDesignV32Domain = api;
})(typeof window !== 'undefined' ? window : null);
