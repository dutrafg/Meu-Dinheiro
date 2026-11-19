// Validação compartilhada entre formulário, armazenamento local e restauração.
// Não converte datas inexistentes (ex.: 31 de fevereiro) em outras datas.
export function validarDataISO(valor) {
  if (typeof valor !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(valor)) return false;
  const [ano, mes, dia] = valor.split('-').map(Number);
  if (ano < 1 || mes < 1 || mes > 12 || dia < 1 || dia > 31) return false;
  const data = new Date(0);
  data.setUTCHours(12, 0, 0, 0);
  data.setUTCFullYear(ano, mes - 1, dia);
  return data.getUTCFullYear() === ano && data.getUTCMonth() === mes - 1 && data.getUTCDate() === dia;
}

const valorValido = valor => Number.isFinite(valor) && valor >= 0 && valor <= 999999999;
const texto = (valor, limite) => typeof valor === 'string' && valor.trim().length > 0 && valor.length <= limite;

export function normalizarDadosLocais(saved) {
  if (!saved || typeof saved !== 'object' || !Array.isArray(saved.transactions) || !Array.isArray(saved.goals)) {
    throw new Error('Estrutura de dados locais inválida.');
  }
  const transactions = saved.transactions.map(t => {
    if (!t || !texto(t.id, 200) || !texto(t.description, 80) || !['income', 'expense'].includes(t.type) ||
        !valorValido(t.amount) || t.amount === 0 || !validarDataISO(t.date) || !texto(t.category, 120)) {
      throw new Error('Lançamento local inválido.');
    }
    // Compatibilidade com versões antigas, que não registravam recorrência/data de criação.
    return {...t, recurring: t.recurring === true,
      createdAt: texto(t.createdAt, 100) ? t.createdAt : `${t.date}T12:00:00.000Z`};
  });
  const goals = saved.goals.map(g => {
    if (!g || !texto(g.id, 200) || !texto(g.name, 80) || !['goal','dream'].includes(g.kind) ||
        !valorValido(g.target) || g.target === 0 || !valorValido(g.saved) ||
        (g.deadline && !validarDataISO(g.deadline))) throw new Error('Objetivo local inválido.');
    return {...g, deadline: g.deadline || ''};
  });
  const allocations = saved.allocations ?? [];
  const completedAportes = saved.completedAportes ?? [];
  if (!Array.isArray(allocations) || !Array.isArray(completedAportes)) throw new Error('Listas locais inválidas.');
  for (const a of allocations) {
    if (!a || !texto(a.id, 200) || !texto(a.description, 300) || !['goal','reserve','dream'].includes(a.kind) ||
        !Number.isFinite(a.amount) || Math.abs(a.amount) > 999999999 || !validarDataISO(a.date) ||
        typeof a.goalId !== 'string'||(a.category!==undefined&&!texto(a.category,120))||
        (a.origin!==undefined&&!['salary','previous'].includes(a.origin))||
        (a.origin==='salary'&&(!texto(a.salaryId,200)||!validarDataISO(a.salaryDate)))) throw new Error('Aplicação local inválida.');
  }
  if (completedAportes.some(v => !texto(v, 200))) throw new Error('Lembrete local inválido.');
  validarIntegridadeDados({transactions, goals, allocations});
  return {...saved, transactions, goals, allocations, completedAportes};
}

function validarIntegridadeDados({transactions,goals,allocations}) {
  const transactionIds=new Set(),goalIds=new Set();
  for(const t of transactions){if(transactionIds.has(t.id))throw Error('Lançamentos duplicados.');transactionIds.add(t.id);}
  for(const g of goals){if(goalIds.has(g.id))throw Error('Objetivos duplicados.');goalIds.add(g.id);}
  const allocationIds=new Set();
  for(const a of allocations){
    if(allocationIds.has(a.id)||transactionIds.has(a.id))throw Error('Aplicações duplicadas.');
    allocationIds.add(a.id);
    // Um objetivo removido pode deixar uma aplicação antiga sem vínculo.
    // Um ID existente, porém, deve sempre apontar para o tipo correto.
    const goal=goals.find(g=>g.id===a.goalId);
    if(goal && (a.kind==='dream'?goal.kind!=='dream':goal.kind!=='goal'))throw Error('Vínculo incompatível.');
  }
}

export function podeAplicarNoObjetivo(valorGuardado,variacao){
  return Number.isFinite(valorGuardado)&&Number.isFinite(variacao)&&
    Math.round((valorGuardado+variacao+Number.EPSILON)*100)/100>=0;
}

export function validarBackup(arquivo, categorias) {
  if (!arquivo || arquivo.app !== 'meu-dinheiro-essencial' || arquivo.version !== 1 ||
      !Array.isArray(arquivo.transactions) || !Array.isArray(arquivo.goals)) {
    throw new Error('Formato de backup incompatível.');
  }
  const transactions = arquivo.transactions;
  const goals = arquivo.goals;
  const allocations = arquivo.allocations ?? [];
  const completedAportes = arquivo.completedAportes ?? [];
  if (transactions.length > 20000 || goals.length > 2000 || !Array.isArray(allocations) || allocations.length > 20000 ||
      !Array.isArray(completedAportes) || completedAportes.length > 30000) throw new Error('Backup acima do limite de registros.');

  const ids = new Set();
  for (const t of transactions) {
    if (!t || !texto(t.id, 200) || ids.has(t.id) || !texto(t.description, 80) ||
        !['income','expense'].includes(t.type) || !valorValido(t.amount) || t.amount === 0 ||
        !validarDataISO(t.date) || !categorias[t.type]?.includes(t.category) ||
        typeof t.createdAt !== 'string' || typeof t.recurring !== 'boolean') {
      throw new Error('Há lançamentos inválidos ou duplicados no backup.');
    }
    ids.add(t.id);
  }
  for (const a of allocations) {
    if (!a || !texto(a.id, 200) || ids.has(a.id) || !texto(a.description, 300) ||
        !['goal','reserve','dream'].includes(a.kind) || !Number.isFinite(a.amount) ||
        Math.abs(a.amount) > 999999999 || !validarDataISO(a.date) || typeof a.goalId !== 'string'||
        (a.category!==undefined&&!texto(a.category,120))||
        (a.origin!==undefined&&!['salary','previous'].includes(a.origin))||
        (a.origin==='salary'&&(!texto(a.salaryId,200)||!validarDataISO(a.salaryDate)))) {
      throw new Error('Há aplicações inválidas ou duplicadas no backup.');
    }
    ids.add(a.id);
  }
  const goalIds = new Set();
  for (const g of goals) {
    if (!g || !texto(g.id, 200) || goalIds.has(g.id) || !texto(g.name, 80) ||
        !['goal','dream'].includes(g.kind) || !valorValido(g.target) || g.target === 0 ||
        !valorValido(g.saved) || typeof g.deadline !== 'string' ||
        (g.deadline && !validarDataISO(g.deadline))) {
      throw new Error('Há metas inválidas ou duplicadas no backup.');
    }
    goalIds.add(g.id);
  }
  if (completedAportes.some(v => !texto(v, 200))) throw new Error('Há lembretes inválidos no backup.');
  validarIntegridadeDados({transactions,goals,allocations});
  return {transactions, goals, allocations, completedAportes};
}
