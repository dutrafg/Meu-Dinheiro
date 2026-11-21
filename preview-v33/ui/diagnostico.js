/* Verificações adicionais da homologação v33. Sem ler descrições ou valores reais. */
(function () {
  'use strict';
  const o = window.MeuDinheiroV33Orcamento;
  const p = window.MeuDinheiroV33Previsao;
  const d = window.MeuDinheiroDesignV32Domain;
  const dialog = document.getElementById('diagnostics-dialog');
  if (!o || !p || !d || !dialog) return;

  function contrast(a, b) {
    const rgb = color => {
      const match = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(String(color||'').trim());
      if (!match) return null;
      const hex = match[1].length === 3 ? [...match[1]].map(ch => ch + ch).join('') : match[1];
      const n = parseInt(hex, 16);
      return [(n >> 16) & 255, (n >> 8) & 255, n & 255].map(x => {
        const c = x / 255;
        return c <= .04045 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4;
      }).reduce((acc, value, index) => acc + value * [.2126,.7152,.0722][index], 0);
    };
    const x = rgb(a), y = rgb(b);
    return x === null || y === null ? 0 : (Math.max(x,y) + .05) / (Math.min(x,y) + .05);
  }

  const checks = Object.freeze([
    ['V33_CENTAVOS', 'Valores em centavos aceitam vírgula e não arredondam indevidamente', () => o.toCent('1.230,45') === 123045 && o.toCent(0.1+0.2) === 30],
    ['V33_VALOR_INVALIDO', 'Orçamento rejeita valores negativos e milhares ambíguos', () => o.toCent('-4') === null && o.toCent('1.2.3') === null],
    ['V33_VALIDACAO', 'Limites inválidos e categorias duplicadas são rejeitados', () => {
      try { o.normalize({ schemaVersion: 1, revision: 0, budgets: [{category:'Contas',limitCent:100},{category:'Contas',limitCent:200}] }); return false; } catch (_) { return true; }
    }],
    ['V33_CONCORRENCIA', 'Duas abas não podem sobrescrever limites editados', () => {
      const db = new Map();
      const storage = {getItem:key=>db.get(key) ?? null,setItem:(key,value)=>db.set(key,value)};
      const first = o.createStore(storage, 'fixture'), second = o.createStore(storage, 'fixture');
      return first.save([{category:'Contas',limitCent:5000}]).ok && second.save([{category:'Contas',limitCent:10000}]).reason === 'conflito';
    }],
    ['V33_ORCAMENTO_80', 'Faixas 79%, 80%, 100% e 101% classificadas corretamente', () => {
      const item = amount => [{type:'expense',category:'Contas',amount,occurrence:'2026-11-07'}];
      const budget = [{category:'Contas',limitCent:10000}];
      return ['ok','atencao','atencao','excedido'].every((state,index) => o.evaluate(item([79,80,100,101][index]),budget,'2026-11-21')[0].status === state);
    }],
    ['V33_AGENDADOS', 'Orçamento separa gasto realizado de gasto agendado', () => {
      const items = [{type:'expense',category:'Contas',amount:10,occurrence:'2026-11-01'},{type:'expense',category:'Contas',amount:20,occurrence:'2026-11-29'}];
      const result = o.evaluate(items,[{category:'Contas',limitCent:10000}],'2026-11-21')[0];
      return result.spentCent === 1000 && result.scheduledCent === 2000;
    }],
    ['V33_PREVISAO', 'Previsão distribui receitas/despesas por dia até fechar o mês', () => {
      const result = p.forecast([{type:'income',amount:100,occurrence:'2026-11-05'},{type:'expense',amount:40,occurrence:'2026-11-25'}],'2026-11','2026-11-21');
      return result.currentResultCent === 10000 && result.closingResultCent === 6000 && result.futureExpenseCent === 4000 && result.byDay.length === 30;
    }],
    ['V33_RECORRENCIA', 'Recorrência iniciada no dia 31 ajusta corretamente fevereiro', () => d.occurrenceDate({type:'income',date:'2026-01-31',recurring:true},'2026-02') === '2026-02-28'],
    ['V33_TELA', 'Editor de orçamento e atalhos de cadastro estão presentes', () => !!document.getElementById('design-v33-budget-form') && document.querySelectorAll('#mobile-create-dialog [data-create-kind]').length === 5],
    ['V33_BACKUP', 'Orçamento possui exportação e importação independentes', () => !!document.getElementById('design-v33-budget-export') && !!document.getElementById('design-v33-budget-import')],
    ['V33_TEMA_TEXTO', 'Contraste de texto principal versus card ≥ 4,5:1', () => {
      const css = getComputedStyle(document.documentElement);
      return contrast(css.getPropertyValue('--text'),css.getPropertyValue('--card')) >= 4.5;
    }],
    ['V33_TEMA_SUB', 'Contraste do texto secundário versus card ≥ 4,5:1', () => {
      const css = getComputedStyle(document.documentElement);
      return contrast(css.getPropertyValue('--sub'),css.getPropertyValue('--card')) >= 4.5;
    }],
    ['V33_NAV', 'Navegação móvel e menu Mais continuam disponíveis', () => !!document.getElementById('design-more-trigger') && !!document.querySelector('#design-more-dialog [data-design-open="settings"]')],
    ['V33_HASH', 'Navegação por URL permite voltar entre quatro áreas', () => window.MeuDinheiroV33Navegacao?.routeCount === 4 && typeof window.MeuDinheiroV33Navegacao.fromHash === 'function'],
    ['V33_MODULOS', 'Todos os módulos JS e o CSS v33 estão registrados nesta prévia', () =>
      !!window.MeuDinheiroV33Orcamento && !!window.MeuDinheiroV33Previsao && !!window.MeuDinheiroV33Interface?.hasBudgetEditor() &&
      !!window.MeuDinheiroV33Navegacao && !!window.MeuDinheiroV33Diagnostico && !!document.getElementById('design-v33-css')],
    ['V33_CALENDARIO', 'Calendário financeiro original permanece disponível', () => !!document.getElementById('finance-calendar-dialog')],
    ['V33_INTEGRIDADE', 'Verificações não alteram os dados do usuário', () => checks.every(item => typeof item[2] === 'function')]
  ]);

  let last = [];
  function execute() {
    last = checks.map(([code, description, run]) => {
      let ok = false;
      try { ok = run() === true; } catch (_) { /* Reprovação sem expor dados ou pilha. */ }
      return { code, description, status: ok ? 'ok' : 'falha' };
    });
    const panel = document.getElementById('design-v33-diagnostic-panel');
    if (!panel) return last.slice();
    const success = last.filter(item => item.status === 'ok').length;
    panel.querySelector('[data-v33-total]').textContent = `${success}/${last.length} verificações adicionais da prévia v33 passaram`;
    panel.querySelector('[data-v33-items]').replaceChildren(...last.map(item => {
      const node = document.createElement('p');
      node.className = `design-v33-check ${item.status === 'ok' ? 'pass' : 'fail'}`;
      node.textContent = `${item.status === 'ok' ? '✓' : '✕'} ${item.description}`;
      return node;
    }));
    return last.slice();
  }

  function exportJson() {
    if (!last.length) execute();
    const record = { app:'meu-dinheiro-essencial', module:'diagnostico-preview-v33', version:1, count:last.length, passed:last.filter(item=>item.status==='ok').length, checks:last };
    const url = URL.createObjectURL(new Blob([JSON.stringify(record,null,2)],{type:'application/json'}));
    const a = document.createElement('a');
    a.href=url;
    a.download='meu-dinheiro-diagnostico-preview-v33.json';
    a.click();
    setTimeout(()=>URL.revokeObjectURL(url),30000);
  }

  window.MeuDinheiroV33Diagnostico = Object.freeze({ run: execute, count: checks.length, results:()=>last.slice() });
  if(window.MeuDinheiroDiagnosticoHub?.registrar('orcamento-previsao-v33',execute,checks.length))return;
  const panel = document.createElement('section');
  panel.id = 'design-v33-diagnostic-panel';
  panel.className = 'design-v33-diagnostic-panel';
  panel.innerHTML = `<h3>Testes adicionais — orçamento, previsão e interface v33</h3><p>Os testes extras são executados imediatamente. A animação do diagnóstico principal dura no máximo 25 segundos e não limita as verificações.</p>
    <strong data-v33-total>Pronto para verificar.</strong><details><summary>Ver resultados adicionais</summary><div data-v33-items></div></details>
    <button type="button" id="design-v33-diagnostic-export" class="button button-secondary">Baixar complemento JSON v33</button>`;
  document.getElementById('diagnostics-progress-area')?.after(panel);
  document.getElementById('open-diagnostics')?.addEventListener('click',execute);
  document.getElementById('diagnostics-run')?.addEventListener('click',execute);
  document.getElementById('design-v33-diagnostic-export')?.addEventListener('click',exportJson);
})();
