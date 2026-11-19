// A exportação usa impressão nativa, com conteúdo de relatório separado da tela.
// Nenhuma informação financeira é enviada a um serviço externo.
import { montarRelatorioFinanceiro } from './relatorio-pdf-conteudo.js';
export function iniciarRelatorioPdf({hideBackupMenu,registrar=()=>{},getData,getView,getMonth,monthLabel,
  transactionsInMonth,money}) {
  const botao=document.getElementById('export-pdf');
  const destino=document.getElementById('print-report');
  function limpar(){destino.replaceChildren();}
  function preparar(){
    try {
      const dados=getData();const mes=getMonth();
      destino.innerHTML=montarRelatorioFinanceiro({visao:getView(),mes,mesExtenso:monthLabel(mes),
        transacoes:transactionsInMonth(mes),objetivos:dados.goals||[],aplicacoesRegistradas:dados.allocations||[],money});
      return true;
    }catch{
      limpar();registrar('aviso','PDF_PREPARACAO_FALHOU','relatorio-pdf');return false;
    }
  }
  function imprimir() {
    hideBackupMenu();
    if(typeof window.print!=='function'){
      registrar('aviso','PDF_IMPRESSAO_INDISPONIVEL','relatorio-pdf');
      return false;
    }
    if(!preparar())return false;
    // Um frame permite que o diálogo se feche antes de imprimir a tela atual.
    const executar=()=>{try{window.print();}catch{limpar();registrar('aviso','PDF_IMPRESSAO_FALHOU','relatorio-pdf');}};
    if(typeof window.requestAnimationFrame==='function')window.requestAnimationFrame(executar);
    else window.setTimeout(executar,0);
    return true;
  }
  window.addEventListener('beforeprint',()=>{if(!destino.hasChildNodes())preparar();});
  window.addEventListener('afterprint',limpar);
  botao.addEventListener('click',imprimir);
  return {imprimir};
}
