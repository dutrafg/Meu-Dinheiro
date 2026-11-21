import {validarDataISO} from './validacao.js';
import {cliqueForaDoDialogo} from './dialogos.js';

export const CATEGORIAS_INVESTIMENTO=Object.freeze(['Poupança','CDB','Tesouro Direto','Fundos','Ações','Outros']);

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

// Um aporte é registrado no histórico e incorporado uma única vez ao valor guardado.
// Não cria renda/despesa: investir uma quantia já disponível não deve duplicar o fluxo.
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

// Reverte o aporte antigo em centavos antes de aplicar o novo. Mantém o ID, a
// posição no histórico e os campos de importação, sem mexer nas transações.
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

export function iniciarInvestimentos({getData,persist,render,notify,registrarEvento,uniqueId,isoDate,esc,dialog,form,documento=document}){
  function atualizarOrigem(){
    const date=form.elements.namedItem('date').value;
    const salario=encontrarSalarioAnterior(getData().transactions,date);
    const origem=form.elements.namedItem('origin');
    if(origem.value==='salary'&&!salario)origem.value='';
    const nota=documento.getElementById('investment-origin-note');
    nota.textContent=salario?`Salário encontrado em ${salario.date.split('-').reverse().join('/')}. Escolha explicitamente a origem; o salário só será descontado do saldo disponível se você selecionar essa opção.`:
      'Nenhum salário localizado nos 45 dias anteriores à data. Se o dinheiro já estava guardado, selecione “Investimento antigo”.';
  }
  function abrir(goalId='',investmentId=''){
    const dados=getData();
    const goals=dados.goals;
    if(!goals.length){notify('Crie uma meta ou sonho antes de adicionar um investimento.');return false;}
    const existente=investmentId?dados.allocations.find(a=>a.id===investmentId&&a.amount>0):null;
    if(investmentId&&!existente){notify('Investimento não encontrado para edição.');return false;}
    const seletor=form.elements.namedItem('goalId');
    seletor.innerHTML=goals.map(g=>`<option value="${esc(g.id)}">${esc(g.kind==='dream'?'Sonho':'Meta')} · ${esc(g.name)}</option>`).join('');
    const alvo=existente?.goalId||goalId;
    if(alvo&&goals.some(g=>g.id===alvo))seletor.value=alvo;
    form.elements.namedItem('id').value=existente?.id||'';
    form.elements.namedItem('description').value=existente?.description||'';
    form.elements.namedItem('amount').value=existente?.amount??'';
    form.elements.namedItem('date').value=existente?.date||isoDate(new Date());
    form.elements.namedItem('category').value=existente?.category||'';
    form.elements.namedItem('origin').value=existente?.origin||'';
    atualizarOrigem();
    documento.getElementById('investment-title').textContent=existente?'Editar investimento':'Adicionar investimento';
    documento.getElementById('investment-submit').textContent=existente?'Salvar alterações':'Salvar investimento';
    const categorias=[...new Set([...CATEGORIAS_INVESTIMENTO,...(getData().allocations||[]).map(a=>a.category).filter(Boolean)])];
    documento.getElementById('investment-category-suggestions').innerHTML=categorias.map(c=>`<option value="${esc(c)}"></option>`).join('');
    dialog.showModal();
    form.elements.namedItem('description').focus();
    return true;
  }
  const editar=id=>abrir('',id);
  form.elements.namedItem('date').addEventListener('change',atualizarOrigem);
  form.addEventListener('submit',event=>{
    event.preventDefault();
    const f=form.elements;
    try{
      const id=f.namedItem('id').value;
      const campos={id:id||uniqueId(),goalId:f.namedItem('goalId').value,description:f.namedItem('description').value,
        amount:Number(f.namedItem('amount').value),date:f.namedItem('date').value,category:f.namedItem('category').value,
        origin:f.namedItem('origin').value};
      const next=id?editarInvestimentoVinculado(getData(),campos):adicionarInvestimentoVinculado(getData(),campos);
      if(persist(next)){
        registrarEvento(id?'EDITAR_INVESTIMENTO':'CRIAR_INVESTIMENTO','dados');dialog.close();render();
        notify(id?'Investimento atualizado sem duplicar o aporte.':'Investimento adicionado ao objetivo.');
      }
    }catch(erro){notify(erro.message||'Não foi possível salvar o investimento.');}
  });
  dialog.addEventListener('click',event=>{if(cliqueForaDoDialogo(event,dialog))dialog.close();});
  return {abrir,editar};
}
