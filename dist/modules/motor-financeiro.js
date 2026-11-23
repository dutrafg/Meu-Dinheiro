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

// Lista ocorrências de rendas ainda sem aporte concluído no intervalo de seis meses.
// O cálculo do percentual é injetado para manter regras-financeiras.js como única
// origem dos percentuais configuráveis. Nunca marca aportes nem altera os dados.
export function aportesPendentes(transacoes,concluidos,hojeISO,calcularValorAporte) {
  if(!/^\d{4}-\d{2}-\d{2}$/.test(hojeISO)||typeof calcularValorAporte!=='function')return [];
  const mesAtual=hojeISO.slice(0,7);
  const deslocarMes=deslocamento=>{
    const [ano,mes]=mesAtual.split('-').map(Number);
    const data=new Date(Date.UTC(ano,mes-1+deslocamento,1));
    return `${data.getUTCFullYear()}-${String(data.getUTCMonth()+1).padStart(2,'0')}`;
  };
  const meses=Array.from({length:6},(_,i)=>deslocarMes(i-5));
  const inicio=meses[0]+'-01';
  const feitos=new Set(Array.isArray(concluidos)?concluidos:[]);
  const itens=[];
  for(const t of Array.isArray(transacoes)?transacoes:[]){
    if(t.type!=='income')continue;
    const mesesDaRenda=t.recurring?meses:[t.date.slice(0,7)];
    for(const mes of mesesDaRenda){
      const date=ocorrenciaNoMes(t,mes);
      if(!date||date>hojeISO||date<inicio)continue;
      const key=`${t.id}@${date}`;
      if(feitos.has(key))continue;
      itens.push({key,date,description:t.description,category:t.category,
        tenPercent:calcularValorAporte(t)});
    }
  }
  return itens.sort((a,b)=>b.date.localeCompare(a.date));
}

// Simulação bruta ilustrativa, sem IOF/IR/taxas, baseada no CDI diário oficial.
// Os dias úteis e a taxa são parâmetros explícitos; nunca registra rendimento.
export function estimarRendimentoCdi(principal,percentualDiario,diasUteis=21) {
  if(!Number.isFinite(principal)||principal<=0||!Number.isFinite(percentualDiario)||
    percentualDiario<=0||percentualDiario>=1||!Number.isSafeInteger(diasUteis)||diasUteis<1)return null;
  return reaisMotor(centavosMotor(principal*(Math.pow(1+percentualDiario/100,diasUteis)-1)));
}

// Saldo disponível estimado até uma data, com recorrências vencidas e somente
// as aplicações declaradas como transferências internas vindas do salário.
// Não equivale ao saldo bancário e não altera transações ou aplicações.
export function calcularSaldoDisponivelHoje(transacoes,hojeISO,aplicacoes=[]){
  if(!Array.isArray(transacoes)||!/^\d{4}-\d{2}-\d{2}$/.test(hojeISO))return null;
  const [anoAtual,mesAtual]=hojeISO.split('-').map(Number);
  let total=0;
  for(const item of transacoes){
    if(!item||!/^\d{4}-\d{2}-\d{2}$/.test(item.date)||item.date>hojeISO||
      !['income','expense'].includes(item.type)||!Number.isFinite(item.amount))continue;
    let quantidade=1;
    if(item.recurring){
      const [anoInicio,mesInicio,dia]=item.date.split('-').map(Number);
      const meses=(anoAtual-anoInicio)*12+mesAtual-mesInicio;
      const ultimoDia=new Date(Date.UTC(anoAtual,mesAtual,0)).getUTCDate();
      const ocorrenciaAtual=`${hojeISO.slice(0,7)}-${String(Math.min(dia,ultimoDia)).padStart(2,'0')}`;
      quantidade=meses+(ocorrenciaAtual<=hojeISO?1:0);
    }
    total+=(item.type==='income'?1:-1)*item.amount*quantidade;
  }
  for(const aporte of Array.isArray(aplicacoes)?aplicacoes:[]){
    if(aporte?.origin==='salary'&&aporte.date<=hojeISO&&Number.isFinite(aporte.amount)&&
      transacoes.some(t=>t.id===aporte.salaryId&&t.type==='income'))total-=aporte.amount;
  }
  return Number.isFinite(total)?Math.round(total*100)/100:null;
}
