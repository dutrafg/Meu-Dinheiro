/* Projeção do resultado do mês com lançamentos JÁ registrados. Não é saldo bancário. */
(function (root) {
  'use strict';
  function cent(value) { return Math.round(Number(value) * 100); }
  function forecast(entries, month, todayISO) {
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month) || !/^\d{4}-\d{2}-\d{2}$/.test(todayISO)) throw Error('Período inválido');
    const [year, monthNo] = month.split('-').map(Number);
    const lastDay = new Date(Date.UTC(year, monthNo, 0)).getUTCDate();
    const daily = new Map();
    for (const item of Array.isArray(entries) ? entries : []) {
      if (!item || !['income', 'expense'].includes(item.type) ||
          !/^\d{4}-\d{2}-\d{2}$/.test(item.occurrence || '') || item.occurrence.slice(0, 7) !== month) continue;
      const cents = cent(item.amount);
      if (!Number.isSafeInteger(cents) || cents < 0) continue;
      const current = daily.get(item.occurrence) || { incomeCent: 0, expenseCent: 0 };
      current[item.type === 'income' ? 'incomeCent' : 'expenseCent'] += cents;
      daily.set(item.occurrence, current);
    }
    const byDay = [];
    let balanceCent = 0;
    let todayCent = 0;
    let futureIncomeCent = 0;
    let futureExpenseCent = 0;
    let negativeDays = 0;
    for (let day = 1; day <= lastDay; day++) {
      const date = `${month}-${String(day).padStart(2, '0')}`;
      const amounts = daily.get(date) || { incomeCent: 0, expenseCent: 0 };
      balanceCent += amounts.incomeCent - amounts.expenseCent;
      if (date <= todayISO) todayCent = balanceCent;
      else {
        futureIncomeCent += amounts.incomeCent;
        futureExpenseCent += amounts.expenseCent;
      }
      if (balanceCent < 0) negativeDays++;
      byDay.push({ date, ...amounts, balanceCent });
    }
    if (todayISO < `${month}-01`) todayCent = 0;
    if (todayISO > `${month}-${lastDay}`) todayCent = balanceCent;
    return { month, currentResultCent: todayCent, closingResultCent: balanceCent, futureIncomeCent, futureExpenseCent, negativeDays, byDay };
  }
  const api = Object.freeze({ forecast });
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.MeuDinheiroV33Previsao = api;
})(typeof window !== 'undefined' ? window : null);
