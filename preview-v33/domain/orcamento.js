/* Domínio independente: orçamento mensal por categoria, valores exatos em centavos. */
(function (root) {
  'use strict';
  const SCHEMA = 1;
  const MAX_CENTS = 100_000_000_000;

  function toCent(value) {
    if (typeof value === 'string') {
      let text = value.trim().replace(/^R\$\s*/i, '').replace(/\s/g, '');
      if (!text || !/^[0-9.,]+$/.test(text)) return null;
      if (text.includes(',')) text = text.replace(/\./g, '').replace(',', '.');
      if (!/^\d+(\.\d{1,2})?$/.test(text)) return null;
      const [whole, fraction = ''] = text.split('.');
      const cents = Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
      return Number.isSafeInteger(cents) && cents >= 0 && cents <= MAX_CENTS ? cents : null;
    }
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > MAX_CENTS / 100) return null;
    const cents = Math.round((value + Number.EPSILON) * 100);
    return Number.isSafeInteger(cents) ? cents : null;
  }

  function validCategory(category) {
    return typeof category === 'string' && category.length > 0 && category.length <= 80 && category.trim() === category &&
      !/[\u0000-\u001f\u007f]/.test(category) && !['__proto__', 'prototype', 'constructor'].includes(category);
  }

  function normalize(raw) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw) || raw.schemaVersion !== SCHEMA ||
        !Number.isSafeInteger(raw.revision) || raw.revision < 0 || !Array.isArray(raw.budgets) || raw.budgets.length > 150) {
      throw Error('Orçamento incompatível');
    }
    const categories = new Set();
    const budgets = raw.budgets.map(item => {
      if (!item || !validCategory(item.category) || categories.has(item.category) ||
          !Number.isSafeInteger(item.limitCent) || item.limitCent < 100 || item.limitCent > MAX_CENTS) throw Error('Limite inválido');
      categories.add(item.category);
      return { category: item.category, limitCent: item.limitCent };
    });
    return { schemaVersion: SCHEMA, revision: raw.revision, budgets };
  }

  function empty() { return { schemaVersion: SCHEMA, revision: 0, budgets: [] }; }

  function evaluate(entries, budgets, todayISO) {
    const results = [];
    for (const budget of budgets) {
      let spentCent = 0;
      let scheduledCent = 0;
      for (const item of entries) {
        if (item.type !== 'expense' || item.category !== budget.category || !item.occurrence) continue;
        const cents = toCent(Number(item.amount));
        if (cents === null) continue;
        if (item.occurrence <= todayISO) spentCent += cents;
        else scheduledCent += cents;
      }
      const pct = Math.round(spentCent / budget.limitCent * 1000) / 10;
      const status = pct > 100 ? 'excedido' : pct >= 80 ? 'atencao' : 'ok';
      results.push({ category: budget.category, limitCent: budget.limitCent, spentCent, scheduledCent, pct, status });
    }
    return results.sort((a, b) => b.pct - a.pct || a.category.localeCompare(b.category, 'pt-BR'));
  }

  // Nenhuma alteração da base financeira v1: a chave e o controle de revisão são exclusivos.
  function createStore(storage, key) {
    let state = empty();
    let snapshot = null;
    let locked = false;
    try {
      snapshot = storage.getItem(key);
      if (snapshot !== null) state = normalize(JSON.parse(snapshot));
    } catch (_) { locked = true; }
    return {
      current: () => ({ ...state, budgets: state.budgets.map(item => ({ ...item })) }),
      locked: () => locked,
      save: (budgets) => {
        if (locked) return { ok: false, reason: 'bloqueado' };
        const next = { schemaVersion: SCHEMA, revision: state.revision + 1, budgets };
        try {
          const validated = normalize(next);
          if (storage.getItem(key) !== snapshot) return { ok: false, reason: 'conflito' };
          const raw = JSON.stringify(validated);
          storage.setItem(key, raw);
          snapshot = raw;
          state = validated;
          return { ok: true, state: { ...state, budgets: state.budgets.map(item => ({ ...item })) } };
        } catch (_) { return { ok: false, reason: 'invalidos' }; }
      },
      refresh: () => {
        try {
          const raw = storage.getItem(key);
          const restored = raw === null ? empty() : normalize(JSON.parse(raw));
          state = restored;
          snapshot = raw;
          locked = false;
          return true;
        } catch (_) { locked = true; return false; }
      }
    };
  }

  const api = Object.freeze({ SCHEMA, toCent, normalize, empty, evaluate, createStore });
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.MeuDinheiroV33Orcamento = api;
})(typeof window !== 'undefined' ? window : null);
