import {validarDataISO} from './validacao.js';

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
      if(distancia>=0&&distancia<=45*86400000)candidatos.push({id:t.id,date:data,description:t.description||'Salário'});
    }
  }
  return candidatos.sort((a,b)=>b.date.localeCompare(a.date))[0]||null;
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
  const total=Math.round((goal.saved+valor+Number.EPSILON)*100)/100;
  if(!Number.isFinite(total)||total>999999999)throw Error('O valor guardado ultrapassaria o limite permitido.');
  if(dados.allocations.length>=20000)throw Error('Limite de investimentos atingido. Faça um backup antes de continuar.');
  const investimento={id,kind:goal.kind,goalId,description:descricao,amount:valor,date,category:categoria,origin,
    ...(salario?{salaryId:salario.id,salaryDate:salario.date}:{})};
  return {...dados,goals:dados.goals.map(g=>g.id===goalId?{...g,saved:total}:g),
    allocations:[...dados.allocations,investimento]};
}

export function iniciarInvestimentos({getData,persist,render,notify,registrarEvento,uniqueId,isoDate,esc,dialog,form,documento=document}){
  function atualizarOrigem(){
    const date=form.elements.namedItem('date').value;
    const salario=encontrarSalarioAnterior(getData().transactions,date);
    const origem=form.elements.namedItem('origin');
    origem.value=salario?'salary':'previous';
    const nota=documento.getElementById('investment-origin-note');
    nota.textContent=salario?`Salário encontrado em ${salario.date.split('-').reverse().join('/')}. Confirme a origem; se o dinheiro já estava guardado, escolha “Investimento antigo”.`:
      'Nenhum salário localizado nos 45 dias anteriores à data. Se já era dinheiro guardado, mantenha “Investimento antigo”.';
  }
  function abrir(goalId=''){
    const goals=getData().goals;
    if(!goals.length){notify('Crie uma meta ou sonho antes de adicionar um investimento.');return false;}
    const seletor=form.elements.namedItem('goalId');
    seletor.innerHTML=goals.map(g=>`<option value="${esc(g.id)}">${esc(g.kind==='dream'?'Sonho':'Meta')} · ${esc(g.name)}</option>`).join('');
    if(goalId&&goals.some(g=>g.id===goalId))seletor.value=goalId;
    form.elements.namedItem('description').value='';
    form.elements.namedItem('amount').value='';
    form.elements.namedItem('date').value=isoDate(new Date());
    form.elements.namedItem('category').value='';
    atualizarOrigem();
    const categorias=[...new Set([...CATEGORIAS_INVESTIMENTO,...(getData().allocations||[]).map(a=>a.category).filter(Boolean)])];
    documento.getElementById('investment-category-suggestions').innerHTML=categorias.map(c=>`<option value="${esc(c)}"></option>`).join('');
    dialog.showModal();
    form.elements.namedItem('description').focus();
    return true;
  }
  form.elements.namedItem('date').addEventListener('change',atualizarOrigem);
  form.addEventListener('submit',event=>{
    event.preventDefault();
    const f=form.elements;
    try{
      const next=adicionarInvestimentoVinculado(getData(),{
        id:uniqueId(),goalId:f.namedItem('goalId').value,description:f.namedItem('description').value,
        amount:Number(f.namedItem('amount').value),date:f.namedItem('date').value,category:f.namedItem('category').value,
        origin:f.namedItem('origin').value
      });
      if(persist(next)){
        registrarEvento('CRIAR_INVESTIMENTO','dados');dialog.close();render();notify('Investimento adicionado ao objetivo.');
      }
    }catch(erro){notify(erro.message||'Não foi possível salvar o investimento.');}
  });
  dialog.addEventListener('click',event=>{if(event.target===dialog)dialog.close();});
  return {abrir};
}
