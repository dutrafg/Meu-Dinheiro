import {transacoesNoMes} from './motor-financeiro.js';

// Ano fechado até a data de referência: nada futuro entra como realizado.
// Aportes são um indicador separado, sem subtração dupla das despesas.
export function resumirAno(transacoes,aportes,ano,dataReferencia){
  if(!Number.isSafeInteger(ano)||ano<2000||ano>2100||
    typeof dataReferencia!=='string'||!/^(\d{4})-(\d{2})-(\d{2})$/.test(dataReferencia))return null;
  const meses=Array.from({length:12},(_,i)=>{
    const mes=`${ano}-${String(i+1).padStart(2,'0')}`;
    const itens=transacoesNoMes(transacoes,mes).filter(t=>t.occurrence<=dataReferencia);
    const centavos=tipo=>itens.filter(t=>t.type===tipo).reduce((s,t)=>s+Math.round(t.amount*100),0);
    const receitas=centavos('income'),despesas=centavos('expense');
    return {mes,receitas:receitas/100,despesas:despesas/100,saldo:(receitas-despesas)/100,registros:itens.length};
  });
  const totals=meses.reduce((s,m)=>({receitas:s.receitas+Math.round(m.receitas*100),despesas:s.despesas+Math.round(m.despesas*100)}),{receitas:0,despesas:0});
  const guardado=(Array.isArray(aportes)?aportes:[])
    .filter(item=>item?.date?.slice(0,4)===String(ano)&&item.date<=dataReferencia&&Number.isFinite(item.amount)&&item.amount>0)
    .reduce((s,item)=>s+Math.round(item.amount*100),0);
  const validos=meses.filter(m=>m.registros>0);
  const melhor=validos.length?validos.reduce((atual,proximo)=>proximo.saldo>atual.saldo?proximo:atual):null;
  return {ano,meses,receitas:totals.receitas/100,despesas:totals.despesas/100,
    saldo:(totals.receitas-totals.despesas)/100,aportes:guardado/100,melhor};
}

export function criarModuloRelatorioAnual({getData,money,esc,monthLabel,notify}){
  let anoSelecionado=new Date().getFullYear();
  const painel=document.getElementById('annual-panel');
  const content=document.getElementById('annual-content');
  const dataHoje=()=>{
    const agora=new Date();
    return `${agora.getFullYear()}-${String(agora.getMonth()+1).padStart(2,'0')}-${String(agora.getDate()).padStart(2,'0')}`;
  };
  const estado=()=>resumirAno(getData().transactions,getData().allocations,anoSelecionado,dataHoje());
  function textoCompartilhavel(r){
    return `Meu Dinheiro — resumo de ${r.ano}\nEntrou: ${money(r.receitas)}\nSaiu: ${money(r.despesas)}\nDiferença dos lançamentos: ${money(r.saldo)}\nAportes registrados: ${money(r.aportes)}\nAportes são mostrados separadamente e não descontados novamente das despesas.`;
  }
  function render(){
    const r=estado();
    if(!r)return;
    const max=Math.max(1,...r.meses.flatMap(m=>[m.receitas,m.despesas]));
    content.innerHTML=`<div class="annual-controls"><button type="button" data-annual-year="-1" aria-label="Ano anterior">‹</button><strong>${r.ano}</strong><button type="button" data-annual-year="1" aria-label="Próximo ano">›</button></div>
      <div class="annual-bars-scroll"><div class="annual-bars" role="img" aria-label="${esc(r.meses.map(m=>`${monthLabel(m.mes)}: entradas ${money(m.receitas)}, saídas ${money(m.despesas)}`).join('; '))}">
        ${r.meses.map(m=>`<div class="annual-bar-month"><div class="annual-bar-pair"><i class="annual-bar-income" style="height:${Math.max(0,m.receitas/max*100)}%"></i><i class="annual-bar-expense" style="height:${Math.max(0,m.despesas/max*100)}%"></i></div><small>${esc(m.mes.slice(5))}</small></div>`).join('')}
      </div></div><p class="annual-legend"><span>■ Entradas</span><span>■ Saídas</span></p>
      <div class="annual-summary-grid"><div><span>Entrou</span><strong>${money(r.receitas)}</strong></div><div><span>Saiu</span><strong>${money(r.despesas)}</strong></div><div><span>Aportes registrados</span><strong>${money(r.aportes)}</strong></div><div><span>Diferença</span><strong>${money(r.saldo)}</strong></div></div>
      ${r.melhor?`<p class="annual-best">Melhor mês pelos lançamentos: <strong>${esc(monthLabel(r.melhor.mes))}</strong>, diferença de ${money(r.melhor.saldo)}.</p>`:'<p class="field-hint">Sem movimentos registrados até a data atual neste ano.</p>'}
      <p class="field-hint">Aportes são exibidos à parte, sem subtração dupla. Recorrências futuras não entram no realizado. Os valores são do aplicativo, não do banco.</p>
      <button type="button" class="button button-secondary annual-share" data-annual-share>Compartilhar resumo deste ano</button>`;
  }
  painel.addEventListener('click',async event=>{
    const ano=event.target.closest('[data-annual-year]');
    if(ano){anoSelecionado=Math.min(2100,Math.max(2000,anoSelecionado+Number(ano.dataset.annualYear)));render();return;}
    if(!event.target.closest('[data-annual-share]'))return;
    const texto=textoCompartilhavel(estado());
    if(navigator.share){try{await navigator.share({title:'Meu Dinheiro — resumo anual',text:texto});}catch(error){if(error?.name!=='AbortError')notify('Não foi possível compartilhar.');}}
    else if(navigator.clipboard?.writeText){try{await navigator.clipboard.writeText(texto);notify('Resumo copiado para compartilhar.');}catch{notify('Não foi possível copiar o resumo.');}}
    else notify('Compartilhamento indisponível neste navegador.');
  });
  return {render,estado};
}
