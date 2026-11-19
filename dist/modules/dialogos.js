// Confirmações acessíveis e consistentes, com cancelamento como resultado seguro.
export function iniciarDialogos() {
  const dialogo = document.getElementById('confirmation-dialog');
  const titulo = document.getElementById('confirmation-title');
  const mensagem = document.getElementById('confirmation-message');
  const cancelar = document.getElementById('confirmation-cancel');
  const aceitar = document.getElementById('confirmation-accept');
  let pendente = null;

  function encerrar(resultado) {
    const resolve = pendente;
    pendente = null;
    if (dialogo.open) dialogo.close();
    resolve?.(resultado);
  }

  cancelar.addEventListener('click',()=>encerrar(false));
  aceitar.addEventListener('click',()=>encerrar(true));
  dialogo.addEventListener('cancel',event=>{event.preventDefault();encerrar(false);});
  dialogo.addEventListener('close',()=>encerrar(false));
  dialogo.addEventListener('click',event=>{if(event.target===dialogo)encerrar(false);});

  function confirmar({titulo:rotulo='Confirmar ação',mensagem:texto='',acao='Confirmar',perigoso=false,informativo=false}) {
    if (pendente) return Promise.resolve(false);
    if (typeof dialogo.showModal !== 'function') {
      return Promise.resolve(informativo ? (window.alert(texto),true) : window.confirm(texto));
    }
    titulo.textContent=rotulo;
    mensagem.textContent=texto;
    aceitar.textContent=acao;
    aceitar.classList.toggle('button-danger',perigoso);
    aceitar.classList.toggle('button-primary',!perigoso);
    cancelar.classList.toggle('hidden',informativo);
    return new Promise(resolve=>{pendente=resolve;dialogo.showModal();aceitar.focus();});
  }

  const informar = (titulo,mensagem)=>confirmar({titulo,mensagem,acao:'Entendi',informativo:true});
  return {confirmar,informar};
}
