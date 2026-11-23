import {ocorrenciaNoMes,totaisDoMes} from './motor-financeiro.js';

// Planejamento apenas de leitura. Lançamentos mensais são ocorrências projetadas,
// não cobrança comprovada; não existe aqui conceito de "pago" ou "atrasado".
export function deslocarMesPrevisao(mes,passos){
  if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(mes)||!Number.isSafeInteger(passos)||Math.abs(passos)>120)return null;
  const [ano,numero]=mes.split('-').map(Number);
  const d=new Date(Date.UTC(ano,numero-1+passos,1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,'0')}`;
}

export function projetarDozeMeses(transacoes,mesInicial){
  if(!deslocarMesPrevisao(mesInicial,0))return [];
  return Array.from({length:12},(_,i)=>{
    const mes=deslocarMesPrevisao(mesInicial,i);
    const s=totaisDoMes(transacoes,mes);
    return {mes,receitas:s.income,despesas:s.expense,livre:s.balance,
      percentualComprometido:s.income>0?Math.round(s.expense/s.income*100):null,
      registros:s.count};
  });
}

export function proximasDespesasPrevistas(transacoes,hojeISO,dias=30){
  if(!/^\d{4}-(0[1-9]|1[0-2])-\d{2}$/.test(hojeISO)||!Number.isSafeInteger(dias)||dias<1||dias>90)return [];
  const inicio=new Date(`${hojeISO}T00:00:00Z`);
  if(!Number.isFinite(inicio.getTime())||inicio.toISOString().slice(0,10)!==hojeISO)return [];
  const fim=new Date(inicio.getTime()+dias*86400000).toISOString().slice(0,10);
  const meses=[];
  for(let mes=hojeISO.slice(0,7);mes<=fim.slice(0,7);mes=deslocarMesPrevisao(mes,1))meses.push(mes);
  const saida=[];
  for(const t of Array.isArray(transacoes)?transacoes:[]){
    if(t?.type!=='expense'||!Number.isFinite(t.amount)||t.amount<=0||typeof t.date!=='string')continue;
    for(const mes of meses){
      const vencimento=ocorrenciaNoMes(t,mes);
      if(vencimento&&vencimento>hojeISO&&vencimento<=fim)
        saida.push({id:t.id,descricao:t.description||t.category||'Despesa',categoria:t.category||'',valor:t.amount,vencimento,recorrente:!!t.recurring});
    }
  }
  return saida.sort((a,b)=>a.vencimento.localeCompare(b.vencimento)||String(a.descricao).localeCompare(String(b.descricao)));
}

export function criarModuloPrevisoes({getData,getCurrentMonth,money,esc,monthLabel}){
  function renderPrevisoes(){
    const dados=getData();
    const hoje=new Date();
    const hojeISO=`${hoje.getFullYear()}-${String(hoje.getMonth()+1).padStart(2,'0')}-${String(hoje.getDate()).padStart(2,'0')}`;
    const linhas=projetarDozeMeses(dados.transactions,getCurrentMonth());
    const proximas=proximasDespesasPrevistas(dados.transactions,hojeISO);
    const totais=linhas.reduce((a,l)=>({receitas:a.receitas+Math.round(l.receitas*100),despesas:a.despesas+Math.round(l.despesas*100)}),{receitas:0,despesas:0});
    return `<div class="forecast-intro"><p>Projeção baseada em lançamentos futuros e itens marcados como mensais. Não confirma pagamento, vencimento contratual ou saldo bancário.</p></div>
      <section class="forecast-box" aria-labelledby="forecast-next-title"><h4 id="forecast-next-title">Próximas despesas previstas (30 dias)</h4>
        ${proximas.length?`<div class="forecast-next-list">${proximas.slice(0,12).map(item=>`<div class="forecast-next-row"><span class="forecast-date">${esc(item.vencimento.split('-').reverse().join('/'))}</span><span class="forecast-description"><strong>${esc(item.descricao)}</strong><small>${esc(item.categoria)}${item.recorrente?' · mensal':''}</small></span><strong>${money(item.valor)}</strong></div>`).join('')}</div>${proximas.length>12?`<p class="field-hint">Exibidas 12 de ${proximas.length} previsões. Consulte suas despesas para todas as ocorrências.</p>`:''}`:'<p class="field-hint">Nenhuma despesa futura ou mensal encontrada neste intervalo.</p>'}
      </section>
      <section class="forecast-box" aria-labelledby="forecast-year-title"><h4 id="forecast-year-title">Próximos 12 meses</h4>
        <div class="forecast-totals"><span>Entradas previstas <strong>${money(totais.receitas/100)}</strong></span><span>Saídas previstas <strong>${money(totais.despesas/100)}</strong></span></div>
        <div class="forecast-table-wrap"><table class="forecast-table"><thead><tr><th scope="col">Mês</th><th scope="col">Receitas</th><th scope="col">Despesas</th><th scope="col">Diferença prevista</th></tr></thead><tbody>
        ${linhas.map(item=>`<tr><th scope="row">${esc(monthLabel(item.mes))}</th><td>${money(item.receitas)}</td><td>${money(item.despesas)}</td><td class="${item.livre<0?'forecast-negative':'forecast-positive'}">${money(item.livre)}</td></tr>`).join('')}</tbody></table></div>
      </section>`;
  }
  return {renderPrevisoes};
}
