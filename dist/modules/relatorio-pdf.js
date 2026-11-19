// A exportação usa a impressão nativa do navegador, que permite "Salvar como PDF".
// Nenhuma informação financeira é enviada a um serviço externo.
export function iniciarRelatorioPdf({hideBackupMenu,registrar=()=>{}}) {
  const botao=document.getElementById('export-pdf');
  const dialogo=document.getElementById('settings-dialog');
  function imprimir() {
    hideBackupMenu();
    dialogo.close();
    if(typeof window.print!=='function'){
      registrar('aviso','PDF_IMPRESSAO_INDISPONIVEL','relatorio-pdf');
      return false;
    }
    // Um frame permite que o diálogo se feche antes de imprimir a tela atual.
    const executar=()=>{try{window.print();}catch{registrar('aviso','PDF_IMPRESSAO_FALHOU','relatorio-pdf');}};
    if(typeof window.requestAnimationFrame==='function')window.requestAnimationFrame(executar);
    else window.setTimeout(executar,0);
    return true;
  }
  botao.addEventListener('click',imprimir);
  return {imprimir};
}
