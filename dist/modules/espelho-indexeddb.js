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

  // Todas as decisões de comparar e escrever acontecem na MESMA transação.
  // Duas abas nunca podem passar por uma leitura antiga e gravar em seguida.
  let ultimaCopia=null;
  let bloqueado=false;

  async function transacionar(tipo,conteudo,esperado) {
    const db=await abrir();
    return new Promise((resolve,reject)=>{
      let resultado='conflito'; // Fechar sem confirmação nunca significa sucesso.
      try{
        const transacao=db.transaction(COLECAO_ESPELHO,'readwrite');
        const loja=transacao.objectStore(COLECAO_ESPELHO);
        transacao.oncomplete=()=>resolve(resultado);
        transacao.onerror=()=>reject(transacao.error||new Error('IDB_TRANSACTION'));
        transacao.onabort=()=>reject(transacao.error||new Error('IDB_ABORT'));
        if(tipo==='apagar'){
          loja.delete(REGISTRO_ESPELHO);
          resultado='ok';
          return;
        }
        const pedido=loja.get(REGISTRO_ESPELHO);
        pedido.onerror=()=>reject(pedido.error||new Error('IDB_READ'));
        pedido.onsuccess=()=>{
          try{
            const registro=pedido.result||null;
            if(registro&&(typeof registro.conteudo!=='string'||
              (registro.versao!==undefined&&registro.versao!==1))){
              resultado='conflito';return;
            }
            const atual=registro?.conteudo??null;
            if(tipo==='iniciar'){
              if(atual!==null&&atual!==conteudo){resultado='conflito';return;}
              if(!registro)loja.put({conteudo,versao:1,atualizadoEm:Date.now()},REGISTRO_ESPELHO);
              else if(registro.versao===undefined)loja.put({...registro,versao:1},REGISTRO_ESPELHO);
            }else{
              if(atual!==esperado){resultado='conflito';return;}
              if(atual!==conteudo)loja.put({conteudo,versao:1,atualizadoEm:Date.now()},REGISTRO_ESPELHO);
            }
            resultado='ok';
          }catch(error){
            try{transacao.abort();}catch{/* A transação já pode ter terminado. */}
            reject(error);
          }
        };
      }catch(error){reject(error);}
    });
  }

  // A verificação do bloqueio fica DENTRO da fila. Uma gravação agendada
  // antes de concluir iniciar() não pode ignorar um conflito descoberto depois.
  function enfileirar(tipo,conteudo) {
    if(!habilitado)return Promise.resolve(true);
    const tarefa=fila.catch(()=>false).then(async()=>{
      if(bloqueado&&tipo!=='apagar')return false;
      estado='pendente';
      try{
        const resultado=await transacionar(tipo,conteudo,ultimaCopia);
        if(resultado!=='ok'){
          bloqueado=true;
          estado='conflito';
          try{aoFalhar('IDB_CONFLITO_TRANSACIONAL');}catch{/* Telemetria opcional. */}
          return false;
        }
        ultimaCopia=tipo==='apagar'?null:conteudo;
        if(tipo==='apagar')bloqueado=false; // Exclusão exige confirmação dupla no controlador.
        estado='sincronizado';
        ultimaSincronizacao=new Date().toISOString();
        return true;
      }catch{
        estado='erro';
        falhas++;
        if(tipo==='iniciar')bloqueado=true; // Falha ao ler a origem: nunca sobrescrever depois.
        const codigo=tipo==='apagar'?'IDB_EXCLUSAO_FALHOU':
          tipo==='iniciar'?'IDB_INICIALIZACAO_FALHOU':'IDB_GRAVACAO_FALHOU';
        try{aoFalhar(codigo);}catch{/* Telemetria opcional. */}
        return false;
      }
    });
    fila=tarefa;
    return tarefa;
  }

  function iniciar(conteudoLegado) {
    if(!habilitado)return Promise.resolve(true);
    if(typeof conteudoLegado!=='string'||conteudoLegado.length===0)return Promise.resolve(false);
    return enfileirar('iniciar',conteudoLegado);
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
    iniciar,
    gravar:conteudo=>typeof conteudo==='string'&&conteudo.length>0?
      enfileirar('gravar',conteudo):Promise.resolve(false),
    apagar:()=>enfileirar('apagar',null),
    conferir,
    obterEstado:()=>({habilitado,estado,falhas,ultimaSincronizacao})
  });
}
