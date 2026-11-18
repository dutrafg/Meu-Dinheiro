/* Agrupamentos locais para os gráficos de despesas. Não envia dados para servidores. */
(function (root) {
  'use strict';
  const n2 = n => Math.round((n + Number.EPSILON) * 100) / 100;

  // Espera os meses em ordem cronológica, com o mês corrente por último.
  // Uma categoria sem gasto em determinado mês não entra no divisor da média.
  function expenseCategoryStats(months) {
    const series = new Map();
    months.forEach((month, index) => {
      for (const entry of month.entries || []) {
        const amount = Number(entry.amount);
        if (!entry.category || !Number.isFinite(amount) || amount <= 0) continue;
        if (!series.has(entry.category)) series.set(entry.category, new Array(months.length).fill(0));
        const values = series.get(entry.category);
        values[index] = n2(values[index] + amount);
      }
    });
    const currentIndex = months.length - 1;
    const current = [];
    const averages = [];
    for (const [category, values] of series) {
      const currentAmount = currentIndex >= 0 ? values[currentIndex] : 0;
      if (currentAmount > 0) current.push({ category, amount: currentAmount });
      const recordedMonths = values.filter(v => v > 0).length;
      const total = n2(values.reduce((s, value) => s + value, 0));
      if (recordedMonths) averages.push({ category, average: n2(total / recordedMonths), recordedMonths, total });
    }
    current.sort((a, b) => b.amount - a.amount || a.category.localeCompare(b.category, 'pt-BR'));
    averages.sort((a, b) => b.average - a.average || a.category.localeCompare(b.category, 'pt-BR'));
    return { current, averages, currentTotal: n2(current.reduce((s, item) => s + item.amount, 0)) };
  }

  const api = { expenseCategoryStats };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.MeuDinheiroAnalytics = api;
})(typeof globalThis === 'object' ? globalThis : this);
