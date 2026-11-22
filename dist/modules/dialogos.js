// Confirmações acessíveis e consistentes, com cancelamento como resultado seguro.
export function cliqueForaDoDialogo(event,dialogo){
  if(event.target!==dialogo||typeof dialogo.getBoundingClientRect!=='function')return false;
  const area=dialogo.getBoundingClientRect();
  return Number.isFinite(event.clientX)&&Number.isFinite(event.clientY)&&
    (event.clientX<area.left||event.clientX>area.right||event.clientY<area.top||event.clientY>area.bottom);
}
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
  // O evento close é assíncrono. Se uma segunda confirmação já abriu, o
  // close da anterior nunca pode cancelar silenciosamente o novo diálogo.
  dialogo.addEventListener('close',()=>{if(!dialogo.open&&pendente)encerrar(false);});
  dialogo.addEventListener('click',event=>{if(cliqueForaDoDialogo(event,dialogo))encerrar(false);});

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
