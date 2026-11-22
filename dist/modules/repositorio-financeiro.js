// Fonte primária transacional IndexedDB; localStorage passa a ser um espelho
// de compatibilidade. A primeira migração nunca decide conflitos sozinha.
export function criarRepositorioFinanceiro({espelho,storage,chave,validar,aoAvisar=()=>{}}){
  let modo='iniciando';
  let confirmado=null;

  async function iniciar(){
    let legado;
    try{legado=storage.getItem(chave);}catch{modo='bloqueado';return {modo,dados:null};}
    if(legado!==null){
      try{validar(legado);}catch{modo='bloqueado';return {modo,dados:null};}
    }
    if(!espelho.obterEstado().habilitado){
      modo='legado';confirmado=legado;
      aoAvisar('IDB_INDISPONIVEL_LEGADO');
      return {modo,dados:legado===null?null:validar(legado)};
    }
    if(legado===null){
      const existente=await espelho.obterCopiaParaRecuperacao({comPrimaria:true});
      if(existente.estado==='dados'&&existente.primaria===true){
        let dados;
        try{dados=validar(existente.conteudo);}catch{modo='bloqueado';return {modo,dados:null};}
        if(!await espelho.iniciarPrimarioSemLegado()){
          modo='conflito';return {modo,dados:null};
        }
        confirmado=existente.conteudo;modo='primario';
        return {modo,dados};
      }
    }
    const sincronizou=legado===null?await espelho.iniciarVazio():await espelho.iniciar(legado);
    if(!sincronizou){modo='conflito';return {modo,dados:null};}
    const copia=await espelho.obterCopiaParaRecuperacao();
    if(legado!==null&&copia.estado==='dados'&&copia.conteudo===legado){
      confirmado=copia.conteudo;modo='primario';
      return {modo,dados:validar(copia.conteudo)};
    }
    if(legado===null&&['vazio','apagado'].includes(copia.estado)){
      confirmado=null;modo='primario';return {modo,dados:null};
    }
    modo='conflito';return {modo,dados:null};
  }

  async function gravar(serializado){
    if(typeof serializado!=='string'||!serializado.length)return {ok:false,modo};
    try{validar(serializado);}catch{return {ok:false,modo};}
    if(modo==='legado'){
      try{storage.setItem(chave,serializado);confirmado=serializado;return {ok:true,modo};}
      catch{return {ok:false,modo};}
    }
    if(modo!=='primario')return {ok:false,modo};
    let legadoAnterior;
    try{legadoAnterior=storage.getItem(chave);}catch{legadoAnterior=null;}
    const ok=await espelho.gravar(serializado);
    if(!ok){modo='conflito';aoAvisar('IDB_COMMIT_BLOQUEADO');return {ok:false,modo};}
    // A escrita só é considerada financeira depois do transaction.oncomplete.
    confirmado=serializado;
    try{
      // Outra aba legada pode mudar localStorage durante o commit assíncrono.
      // Preservar essa cópia em conflito para a recuperação assistida.
      if(storage.getItem(chave)!==legadoAnterior){
        modo='espelho-pendente';aoAvisar('IDB_ESPELHO_LOCAL_CONFLITO');
        return {ok:true,modo};
      }
      storage.setItem(chave,serializado);return {ok:true,modo};
    }
    catch{
      modo='espelho-pendente';aoAvisar('IDB_ESPELHO_LOCAL_FALHOU');
      // O lançamento JÁ existe no banco primário. Não instruir o usuário a
      // repetir a operação para evitar duplicação; solicitar backup imediato.
      return {ok:true,modo};
    }
  }

  async function restaurarBackup(serializado){
    try{validar(serializado);}catch{return {ok:false,modo};}
    if(modo==='primario'||modo==='legado')return gravar(serializado);
    if(modo==='espelho-pendente')return {ok:false,modo};
    let localAnterior;
    try{localAnterior=storage.getItem(chave);}catch{return {ok:false,modo};}
    const copia=await espelho.obterCopiaParaRecuperacao();
    if(copia.estado!=='dados')return {ok:false,modo};
    const ok=await espelho.recuperarComEscolha({idbAnterior:copia.conteudo,
      localAnterior,conteudoEscolhido:serializado,
      lerLocal:()=>storage.getItem(chave),gravarLocal:raw=>storage.setItem(chave,raw)});
    if(!ok)return {ok:false,modo};
    confirmado=serializado;modo='primario';return {ok:true,modo};
  }

  function sincronizadoAposRecuperacao(raw){confirmado=raw;modo='primario';}
  function sincronizadoAposExclusao(){confirmado=null;modo='primario';}
  return Object.freeze({iniciar,gravar,restaurarBackup,sincronizadoAposRecuperacao,
    sincronizadoAposExclusao,obterEstado:()=>({modo,primario:modo==='primario',
      espelhoPendente:modo==='espelho-pendente',temSnapshot:confirmado!==null})});
}
