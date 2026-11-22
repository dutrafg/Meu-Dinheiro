// Etapa segura da migração: replica o formato financeiro legado em IndexedDB.
// O localStorage continua sendo a fonte da versão atual até a troca transacional.
const BANCO_ESPELHO = 'meu-dinheiro-financeiro';
const COLECAO_ESPELHO = 'snapshots';
const REGISTRO_ESPELHO = 'principal';

export function criarEspelhoIndexedDB({api=null,aoFalhar=()=>{}}={}) {
  const habilitado=Boolean(api&&typeof api.open==='function');
  let abertura=null;
  let fila=Promise.resolve(true);
  let estado=habilitado?'aguardando':'indisponivel';
  let falhas=0;
  let ultimaSincronizacao=null;

  function abrir() {
    if(!habilitado)return Promise.resolve(null);
    if(abertura)return abertura;
    abertura=new Promise((resolve,reject)=>{
      let pedido;
      try{pedido=api.open(BANCO_ESPELHO,1);}
      catch(error){reject(error);return;}
      pedido.onupgradeneeded=()=>{
        const db=pedido.result;
        if(!db.objectStoreNames.contains(COLECAO_ESPELHO))db.createObjectStore(COLECAO_ESPELHO);
      };
      pedido.onsuccess=()=>{
        const db=pedido.result;
        db.onversionchange=()=>{db.close();abertura=null;};
        resolve(db);
      };
      pedido.onerror=()=>reject(pedido.error||new Error('IDB_OPEN'));
      pedido.onblocked=()=>reject(new Error('IDB_BLOCKED'));
    }).catch(error=>{abertura=null;throw error;});
    return abertura;
  }

  async function alterar(tipo,conteudo) {
    const db=await abrir();
    return new Promise((resolve,reject)=>{
      try {
        const transacao=db.transaction(COLECAO_ESPELHO,'readwrite');
        const store=transacao.objectStore(COLECAO_ESPELHO);
        transacao.oncomplete=()=>resolve(true);
        transacao.onerror=()=>reject(transacao.error||new Error('IDB_TRANSACTION'));
        transacao.onabort=()=>reject(transacao.error||new Error('IDB_ABORT'));
        if(tipo==='apagar')store.delete(REGISTRO_ESPELHO);
        else store.put({conteudo,atualizadoEm:Date.now()},REGISTRO_ESPELHO);
      } catch(error){reject(error);}
    });
  }

  function executar(tipo,conteudo) {
    if(!habilitado)return Promise.resolve(true);
    estado='pendente';
    const tarefa=fila.catch(()=>false).then(()=>alterar(tipo,conteudo)).then(()=>{
      estado='sincronizado';
      ultimaSincronizacao=new Date().toISOString();
      return true;
    }).catch(()=>{
      estado='erro';
      falhas++;
      try{aoFalhar(tipo==='apagar'?'IDB_EXCLUSAO_FALHOU':'IDB_GRAVACAO_FALHOU');}catch{/* Telemetria opcional. */}
      return false;
    });
    fila=tarefa;
    return tarefa;
  }

  async function conferir(conteudoLegado) {
    await fila;
    if(!habilitado)return {estado:'indisponivel'};
    try{
      const db=await abrir();
      const conteudo=await new Promise((resolve,reject)=>{
        let pedido;
        try{
          pedido=db.transaction(COLECAO_ESPELHO,'readonly').objectStore(COLECAO_ESPELHO).get(REGISTRO_ESPELHO);
          pedido.onsuccess=()=>resolve(pedido.result?.conteudo??null);
          pedido.onerror=()=>reject(pedido.error||new Error('IDB_READ'));
        }catch(error){reject(error);}
      });
      if(conteudoLegado===null)return {estado:conteudo===null?'vazio':'residuo'};
      return {estado:conteudo===conteudoLegado?'sincronizado':'divergente'};
    }catch{
      return {estado:'erro'};
    }
  }

  return Object.freeze({
    gravar:conteudo=>typeof conteudo==='string'&&conteudo.length>0?executar('gravar',conteudo):Promise.resolve(false),
    apagar:()=>executar('apagar',null),
    conferir,
    obterEstado:()=>({habilitado,estado,falhas,ultimaSincronizacao})
  });
}
