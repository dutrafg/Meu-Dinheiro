// Indicadores informativos: não gravam lançamentos nem movimentam valores.
export function calcularSaudeFinanceira({renda,despesas,saldo,reserva,despesasPeriodo,diasPeriodo}) {
  const validos=[renda,despesas,saldo,reserva,despesasPeriodo,diasPeriodo].every(v=>typeof v==='number'&&Number.isFinite(v));
  if(!validos||renda<0||despesas<0||reserva<0||despesasPeriodo<0||diasPeriodo<0)throw new Error('Indicadores financeiros inválidos');
  const taxaReal=renda>0?saldo/renda*100:null;
  const poupanca=taxaReal===null?null:Math.round(taxaReal*100)/100;
  const gastoDiario=despesasPeriodo>0&&diasPeriodo>0?despesasPeriodo/diasPeriodo:null;
  const folego=gastoDiario?Math.round(reserva/gastoDiario*10)/10:null;
  let situacao='sem-dados';
  if(renda>0||despesas>0){
    if(renda>0&&taxaReal>=15)situacao='crescendo';
    else if(saldo>=0)situacao='estavel';
    else situacao=folego!==null&&folego>=30?'apertado':'atencao';
  }
  return {poupanca,folego,situacao};
}

export function criarModuloSaude({getMonth,currentMonth,getCurrentMonth,shiftMonth,sums,transactionsInMonth,reservePrincipal,money}) {
  function calcular() {
    const mes=getMonth();
    const mesAtual=getCurrentMonth?.()||currentMonth;
    if(mes>mesAtual)return {poupanca:null,folego:null,situacao:'sem-dados'};
    const hoje=new Date();
    const diaAtual=new Date(Date.UTC(hoje.getFullYear(),hoje.getMonth(),hoje.getDate()));
    const inicio=new Date(`${shiftMonth(mes,-2)}-01T00:00:00Z`);
    const fimMes=new Date(Date.UTC(Number(mes.slice(0,4)),Number(mes.slice(5,7)),0));
    const fim=fimMes>diaAtual?diaAtual:fimMes;
    const diasPeriodo=Math.max(0,Math.floor((fim-inicio)/86400000)+1);
    let despesasPeriodo=0;
    for(const offset of [-2,-1,0]){
      const ym=shiftMonth(mes,offset);
      if(ym>mesAtual)continue;
      despesasPeriodo+=transactionsInMonth(ym,'expense')
        .filter(t=>t.occurrence<=diaAtual.toISOString().slice(0,10))
        .reduce((total,t)=>total+t.amount,0);
    }
    const atual=sums(mes);
    return calcularSaudeFinanceira({renda:atual.income,despesas:atual.expense,saldo:atual.balance,
      reserva:reservePrincipal(),despesasPeriodo,diasPeriodo});
  }
  function renderSaude() {
    const s=calcular();
    const situacoes={crescendo:['🌱 Crescendo','Taxa de poupança de pelo menos 15%.'],
      estavel:['😌 Estável','Saldo do mês sem déficit.'],
      apertado:['⚠️ Apertado','Saldo negativo, mas reserva cobre pelo menos 30 dias.'],
      atencao:['🔥 Atenção','Saldo negativo e reserva cobre menos de 30 dias.'],
      'sem-dados':['○ Sem dados','Registre renda e despesas para avaliar o mês.']};
    const [titulo,descricao]=situacoes[s.situacao];
    const detalhe=s.folego===null&&s.situacao!=='sem-dados'
      ?`${descricao} Sem despesas no período para estimar a cobertura da reserva.`:descricao;
    const porcentagem=s.poupanca===null?'—':`${s.poupanca.toLocaleString('pt-BR',{maximumFractionDigits:2})}%`;
    const dias=s.folego===null?'—':`${s.folego.toLocaleString('pt-BR',{maximumFractionDigits:1})} dias`;
    return `<section class="card saude-card" id="saude-financeira" aria-labelledby="saude-title">
      <div class="saude-heading"><h3 id="saude-title">Saúde financeira</h3><span class="saude-situacao" data-situacao="${s.situacao}">${titulo}</span></div>
      <div class="saude-grid"><div><span>Taxa de poupança</span><strong>${porcentagem}</strong><small>Saldo ÷ renda do mês</small></div>
      <div><span>Fôlego da reserva</span><strong>${dias}</strong><small>Reserva ÷ gasto diário médio</small></div>
      <div><span>Situação do mês</span><strong>${titulo}</strong><small>${detalhe}</small></div></div>
      <p class="saude-note">Fôlego estimado com as despesas dos últimos 3 meses, até hoje. Sem despesas no período, não há média confiável. Os indicadores são informativos.</p>
    </section>`;
  }
  return {calcular,renderSaude};
}
