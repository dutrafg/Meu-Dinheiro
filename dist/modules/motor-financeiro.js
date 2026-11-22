// Motor financeiro compartilhado — regras puras, sem DOM ou armazenamento.
// Usado pelas telas e pelos testes; não altera os lançamentos originais.
const centavosMotor=valor=>Math.round((Number(valor)+Number.EPSILON)*100);
const reaisMotor=centavos=>centavos/100;

export function ocorrenciaNoMes(lancamento,mes) {
  if(!lancamento||typeof lancamento.date!=='string'||!/^\d{4}-\d{2}$/.test(mes))return null;
  if(!lancamento.recurring)return lancamento.date.slice(0,7)===mes?lancamento.date:null;
  if(lancamento.date.slice(0,7)>mes)return null;
  const dia=Number(lancamento.date.slice(8,10));
  const [ano,numeroMes]=mes.split('-').map(Number);
  const ultimoDia=new Date(Date.UTC(ano,numeroMes,0)).getUTCDate();
  return mes+'-'+String(Math.min(dia,ultimoDia)).padStart(2,'0');
}

export function transacoesNoMes(transacoes,mes,tipo) {
  return (Array.isArray(transacoes)?transacoes:[])
    .filter(item=>(!tipo||item.type===tipo)&&ocorrenciaNoMes(item,mes))
    .map(item=>({...item,occurrence:ocorrenciaNoMes(item,mes)}))
    .sort((a,b)=>b.occurrence.localeCompare(a.occurrence)||
      String(b.createdAt||'').localeCompare(String(a.createdAt||'')));
}

export function totaisDoMes(transacoes,mes) {
  const lista=transacoesNoMes(transacoes,mes);
  const receitas=lista.filter(t=>t.type==='income').reduce((total,t)=>total+centavosMotor(t.amount),0);
  const despesas=lista.filter(t=>t.type==='expense').reduce((total,t)=>total+centavosMotor(t.amount),0);
  return {income:reaisMotor(receitas),expense:reaisMotor(despesas),
    balance:reaisMotor(receitas-despesas),count:lista.length};
}

export function principalReserva(dados,reservaGoalId='') {
  const metas=Array.isArray(dados?.goals)?dados.goals:[];
  const aplicacoes=Array.isArray(dados?.allocations)?dados.allocations:[];
  const ids=new Set(metas.map(meta=>meta.id));
  const metasCentavos=metas.filter(meta=>meta.kind==='goal'&&
    (reservaGoalId?meta.id===reservaGoalId:/reserva|emerg[eê]ncia/i.test(meta.name)))
    .reduce((total,meta)=>total+centavosMotor(meta.saved),0);
  const semVinculo=aplicacoes.filter(aplicacao=>aplicacao.kind==='reserve'&&!ids.has(aplicacao.goalId))
    .reduce((total,aplicacao)=>total+centavosMotor(aplicacao.amount),0);
  return Math.max(0,reaisMotor(metasCentavos+semVinculo));
}
