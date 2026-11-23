// Regras puras de vinculação/edição de investimentos. Sem DOM, storage ou efeitos.
import {validarDataISO} from './validacao.js';

export function encontrarSalarioAnterior(transacoes,dataISO){
  if(!validarDataISO(dataISO))return null;
  const limite=Date.parse(`${dataISO}T12:00:00Z`);
  const [ano,mes]=dataISO.split('-').map(Number);
  const meses=[[ano,mes],[mes===1?ano-1:ano,mes===1?12:mes-1]];
  const candidatos=[];
  for(const t of transacoes||[]){
    if(t.type!=='income'||!validarDataISO(t.date)||
      !/sal[aá]rio|remunera[cç][aã]o|folha de pagamento/i.test(`${t.category||''} ${t.description||''}`))continue;
    const datas=t.recurring?meses.map(([anoAtual,mesAtual])=>{
      const [anoInicio,mesInicio,diaInicio]=t.date.split('-').map(Number);
      if((anoAtual-anoInicio)*12+mesAtual-mesInicio<0)return null;
      const ultimoDia=new Date(Date.UTC(anoAtual,mesAtual,0)).getUTCDate();
      return `${anoAtual}-${String(mesAtual).padStart(2,'0')}-${String(Math.min(diaInicio,ultimoDia)).padStart(2,'0')}`;
    }).filter(Boolean):[t.date];
    for(const data of datas){
      const distancia=limite-Date.parse(`${data}T12:00:00Z`);
      if(distancia>=0&&distancia<=45*86400000)candidatos.push({id:t.id,date:data,description:t.description||'Salário',amount:t.amount});
    }
  }
  return candidatos.sort((a,b)=>b.date.localeCompare(a.date))[0]||null;
}

export function validarVinculosSalariais(dados){
  const utilizados=new Map();
  for(const aporte of dados.allocations||[]){
    if(aporte.origin!=='salary'||aporte.amount<=0)continue;
    const fonte=dados.transactions.find(t=>t.id===aporte.salaryId);
    if(!fonte||fonte.type!=='income')return {ok:false,motivo:'Salário vinculado a investimento ausente.'};
    const referencia=encontrarSalarioAnterior([fonte],aporte.date);
    if(!referencia||referencia.date!==aporte.salaryDate)
      return {ok:false,motivo:'Data ou categoria do salário vinculada a investimento foi alterada.'};
    const chave=`${aporte.salaryId}@${aporte.salaryDate}`;
    utilizados.set(chave,(utilizados.get(chave)||0)+Math.round(aporte.amount*100));
    if(utilizados.get(chave)>Math.round(fonte.amount*100))
      return {ok:false,motivo:'Os investimentos superam o valor do salário vinculado.'};
  }
  return {ok:true,motivo:''};
}

// Não cria receita/despesa. O aporte só se incorpora ao objetivo uma vez.
export function adicionarInvestimentoVinculado(dados,{goalId,description,amount,date,category,id,origin='previous'}){
  const goal=dados.goals.find(g=>g.id===goalId);
  const valor=Math.round((Number(amount)+Number.EPSILON)*100)/100;
  const descricao=typeof description==='string'?description.trim():'';
  const categoria=typeof category==='string'?category.trim():'';
  if(!goal)throw Error('Escolha uma meta ou sonho existente.');
  if(!id||typeof id!=='string'||id.length>200||[...dados.allocations,...dados.transactions].some(a=>a.id===id))throw Error('Identificador de aplicação inválido.');
  if(!descricao||descricao.length>300||!categoria||categoria.length>120||
    !Number.isFinite(valor)||valor<=0||valor>999999999||!validarDataISO(date))throw Error('Confira descrição, valor, data e categoria.');
  if(!['salary','previous'].includes(origin))throw Error('Selecione a origem do investimento.');
  const salario=origin==='salary'?encontrarSalarioAnterior(dados.transactions,date):null;
  if(origin==='salary'&&!salario)throw Error('Nenhum salário registrado antes da data. Escolha investimento antigo ou registre o salário.');
  if(salario){
    const usados=(dados.allocations||[]).filter(a=>a.origin==='salary'&&a.salaryId===salario.id&&
      a.salaryDate===salario.date&&a.amount>0).reduce((centavos,a)=>centavos+Math.round(a.amount*100),0);
    if(usados+Math.round(valor*100)>Math.round(salario.amount*100))
      throw Error('Este salário não possui valor suficiente para os aportes vinculados.');
  }
  const total=Math.round((goal.saved+valor+Number.EPSILON)*100)/100;
  if(!Number.isFinite(total)||total>999999999)throw Error('O valor guardado ultrapassaria o limite permitido.');
  if(dados.allocations.length>=20000)throw Error('Limite de investimentos atingido. Faça um backup antes de continuar.');
  const investimento={id,kind:goal.kind,goalId,description:descricao,amount:valor,date,category:categoria,origin,
    ...(salario?{salaryId:salario.id,salaryDate:salario.date}:{})};
  return {...dados,goals:dados.goals.map(g=>g.id===goalId?{...g,saved:total}:g),
    allocations:[...dados.allocations,investimento]};
}

// Edição imutável: subtrai o antigo, valida o novo e conserva a ordem do histórico.
export function editarInvestimentoVinculado(dados,{id,...campos}){
  const anterior=dados.allocations.find(a=>a.id===id);
  if(!anterior||!Number.isFinite(anterior.amount)||anterior.amount<=0)throw Error('Investimento não encontrado ou não editável.');
  const original=dados.goals.find(g=>g.id===anterior.goalId);
  const antigoCentavos=Math.round(anterior.amount*100);
  if(original&&Math.round(original.saved*100)<antigoCentavos)
    throw Error('O valor guardado atual é menor que o aporte anterior. Corrija a meta antes de editar.');
  const base={...dados,goals:dados.goals.map(g=>g.id===anterior.goalId?
    {...g,saved:(Math.round(g.saved*100)-antigoCentavos)/100}:g),
    allocations:dados.allocations.filter(a=>a.id!==id)};
  const atualizado=adicionarInvestimentoVinculado(base,{...campos,id});
  const {salaryId:_anteriorSalario,salaryDate:_anteriorData,...metadados}=anterior;
  const novo={...metadados,...atualizado.allocations.at(-1)};
  return {...atualizado,allocations:dados.allocations.map(a=>a.id===id?novo:a)};
}
