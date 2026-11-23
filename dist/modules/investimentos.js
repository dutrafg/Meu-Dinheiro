import {cliqueForaDoDialogo} from './dialogos.js';
import {encontrarSalarioAnterior,adicionarInvestimentoVinculado,editarInvestimentoVinculado} from './dominio-investimentos.js';
// API histórica preservada para módulos consumidores e integrações locais.
export {encontrarSalarioAnterior,validarVinculosSalariais,adicionarInvestimentoVinculado,editarInvestimentoVinculado} from './dominio-investimentos.js';

export const CATEGORIAS_INVESTIMENTO=Object.freeze(['Poupança','CDB','Tesouro Direto','Fundos','Ações','Outros']);

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
  form.addEventListener('submit',async event=>{
    event.preventDefault();
    const f=form.elements;
    try{
      const id=f.namedItem('id').value;
      const campos={id:id||uniqueId(),goalId:f.namedItem('goalId').value,description:f.namedItem('description').value,
        amount:Number(f.namedItem('amount').value),date:f.namedItem('date').value,category:f.namedItem('category').value,
        origin:f.namedItem('origin').value};
      const next=id?editarInvestimentoVinculado(getData(),campos):adicionarInvestimentoVinculado(getData(),campos);
      if(await persist(next)){
        registrarEvento(id?'EDITAR_INVESTIMENTO':'CRIAR_INVESTIMENTO','dados');dialog.close();render();
        notify(id?'Investimento atualizado sem duplicar o aporte.':'Investimento adicionado ao objetivo.');
      }
    }catch(erro){notify(erro.message||'Não foi possível salvar o investimento.');}
  });
  dialog.addEventListener('click',event=>{if(cliqueForaDoDialogo(event,dialog))dialog.close();});
  return {abrir,editar};
}
