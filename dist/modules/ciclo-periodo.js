// Mantém dia e mês atuais sincronizados mesmo quando o PWA fica aberto por dias.
export function mesLocalDaData(data){
  return `${data.getFullYear()}-${String(data.getMonth()+1).padStart(2,'0')}`;
}
export function calcularViradaPeriodo(mesAtual,mesSelecionado,diaAnterior,instante){
  const proximoMes=mesLocalDaData(instante);
  const hoje=`${proximoMes}-${String(instante.getDate()).padStart(2,'0')}`;
  return {mesAtual:proximoMes,mesSelecionado:mesSelecionado===mesAtual?proximoMes:mesSelecionado,
    dia:hoje,mudou:proximoMes!==mesAtual||hoje!==diaAnterior};
}
