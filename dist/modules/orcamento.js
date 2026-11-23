import {transacoesNoMes} from './motor-financeiro.js';

// Projeção apenas informativa: não grava lançamentos, nem confunde orçamento
// com saldo bancário ou disponibilidade de dinheiro em conta.
export function calcularOrcamentoDia(transacoes,limiteMensal,hojeISO){
  if(!Number.isFinite(limiteMensal)||limiteMensal<=0||limiteMensal>999999999||
    typeof hojeISO!=='string'||!/^(\d{4})-(\d{2})-(\d{2})$/.test(hojeISO))return null;
  const [ano,mes,dia]=hojeISO.split('-').map(Number);
  const ultimoDia=new Date(Date.UTC(ano,mes,0)).getUTCDate();
  if(mes<1||mes>12||dia<1||dia>ultimoDia)return null;
  const inicioDia=hojeISO;
  const despesas=transacoesNoMes(transacoes,hojeISO.slice(0,7),'expense');
  const centavos=item=>Math.round((item.amount+Number.EPSILON)*100);
  const limiteCentavos=Math.round((limiteMensal+Number.EPSILON)*100);
  const antes=despesas.filter(t=>t.occurrence<inicioDia).reduce((s,t)=>s+centavos(t),0);
  const hoje=despesas.filter(t=>t.occurrence===inicioDia).reduce((s,t)=>s+centavos(t),0);
  const gasto=antes+hoje;
  const diasRestantes=ultimoDia-dia+1;
  const cotaHoje=Math.max(0,Math.floor((limiteCentavos-antes)/diasRestantes));
  return {
    limite:limiteCentavos/100,
    gastoAnterior:antes/100,gastoHoje:hoje/100,gastoAcumulado:gasto/100,
    cotaHoje:cotaHoje/100,podeGastarHoje:Math.max(0,cotaHoje-hoje)/100,
    restanteMes:Math.max(0,limiteCentavos-gasto)/100,
    diasRestantes,percentual:Math.round(gasto/limiteCentavos*100),
    excedeu:gasto>limiteCentavos
  };
}
