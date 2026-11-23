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

  // Identifica uma cópia existente sem presumir seu formato ou sobrescrevê-la.
  function classificar(registro){
    if(registro==null)return {tipo:'vazio'};
    if(typeof registro!=='object'||(registro.versao!==undefined&&registro.versao!==1))
      return {tipo:'invalido'};
    if(registro.apagado===true){
      if(typeof registro.marcador!=='string'||registro.marcador.length<8||
        registro.marcador.length>120||registro.conteudo!==undefined)return {tipo:'invalido'};
      return {tipo:'apagado',marcador:registro.marcador};
    }
    if(typeof registro.conteudo==='string')return {tipo:'dados',conteudo:registro.conteudo,
      primario:registro.primario===true};
    return {tipo:'invalido'};
  }

  function coincide(atual,esperado){
    if(atual.tipo!==esperado.tipo)return false;
    if(atual.tipo==='dados')return atual.conteudo===esperado.conteudo;
    if(atual.tipo==='apagado')return atual.marcador===esperado.marcador;
    return atual.tipo==='vazio';
  }

  function novoMarcador(){
    try{if(typeof crypto!=='undefined'&&typeof crypto.randomUUID==='function')return crypto.randomUUID();}
    catch{/* ID do marcador não é segredo; aceita gerador alternativo. */}
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  }

  // A leitura, comparação e alteração ocorrem na MESMA transação readwrite.
  // O marcador de exclusão não contém histórico financeiro e impede ressuscitar dados.
  let esperado={tipo:'vazio'};
  let bloqueado=false;

  async function transacionar(tipo,conteudo,referencia){
    const db=await abrir();
    return new Promise((resolve,reject)=>{
      let resultado={estado:'conflito'};
      try{
        const transacao=db.transaction(COLECAO_ESPELHO,'readwrite');
        const loja=transacao.objectStore(COLECAO_ESPELHO);
        transacao.oncomplete=()=>resolve(resultado);
        transacao.onerror=()=>reject(transacao.error||new Error('IDB_TRANSACTION'));
        transacao.onabort=()=>reject(transacao.error||new Error('IDB_ABORT'));
        const pedido=loja.get(REGISTRO_ESPELHO);
        pedido.onerror=()=>reject(pedido.error||new Error('IDB_READ'));
        pedido.onsuccess=()=>{
          try{
            const registro=pedido.result||null;
            const atual=classificar(registro);
            if(atual.tipo==='invalido')return;
            if(tipo==='iniciar'){
              if(atual.tipo==='dados'&&atual.conteudo===conteudo){
                if(registro.versao===undefined||registro.primario!==true)
                  loja.put({...registro,versao:1,primario:true},REGISTRO_ESPELHO);
              }else if(atual.tipo==='vazio'){
                loja.put({conteudo,versao:1,primario:true,atualizadoEm:Date.now()},REGISTRO_ESPELHO);
              }else return;
              resultado={estado:'ok',esperado:{tipo:'dados',conteudo}};
            }else if(tipo==='iniciarVazio'){
              if(!['vazio','apagado'].includes(atual.tipo))return;
              resultado={estado:'ok',esperado:atual};
            }else if(tipo==='iniciarPrimario'){
              if(atual.tipo!=='dados'||!atual.primario)return;
              resultado={estado:'ok',esperado:atual};
            }else if(tipo==='gravar'){
              if(!coincide(atual,referencia))return;
              if(atual.tipo!=='dados'||atual.conteudo!==conteudo)
                loja.put({conteudo,versao:1,primario:true,atualizadoEm:Date.now()},REGISTRO_ESPELHO);
              resultado={estado:'ok',esperado:{tipo:'dados',conteudo}};
            }else if(tipo==='recuperar'){
              // Só substituir uma cópia válida que ainda é idêntica à inspecionada.
              // Nunca resolver automaticamente nem remover uma tombstone.
              if(atual.tipo!=='dados'||referencia.tipo!=='dados'||!coincide(atual,referencia))return;
              if(atual.conteudo!==conteudo)
                loja.put({conteudo,versao:1,primario:true,atualizadoEm:Date.now()},REGISTRO_ESPELHO);
              resultado={estado:'ok',esperado:{tipo:'dados',conteudo}};
            }else if(tipo==='apagar'){
              // Confirmado pelo usuário no controlador; não apagar nova versão de outra aba.
              if(!coincide(atual,referencia)&&atual.tipo!=='apagado')return;
              const marcador=novoMarcador();
              loja.put({versao:1,apagado:true,marcador,atualizadoEm:Date.now()},REGISTRO_ESPELHO);
              resultado={estado:'ok',esperado:{tipo:'apagado',marcador}};
            }
          }catch(error){
            try{transacao.abort();}catch{/* A transação já pode ter terminado. */}
            reject(error);
          }
        };
      }catch(error){reject(error);}
    });
  }

  // A verificação de bloqueio acontece DENTRO da fila, após inicialização pendente.
  function enfileirar(tipo,conteudo){
    if(!habilitado)return Promise.resolve(true);
    const tarefa=fila.catch(()=>false).then(async()=>{
      if(bloqueado&&tipo!=='apagar')return false;
      estado='pendente';
      try{
        const resultado=await transacionar(tipo,conteudo,esperado);
        if(resultado.estado!=='ok'){
          bloqueado=true;
          estado='conflito';
          try{aoFalhar('IDB_CONFLITO_TRANSACIONAL');}catch{/* Telemetria opcional. */}
          return false;
        }
        esperado=resultado.esperado;
        if(tipo==='apagar')bloqueado=false; // Limpeza exige dupla confirmação.
        estado='sincronizado';
        ultimaSincronizacao=new Date().toISOString();
        return true;
      }catch{
        estado='erro';
        falhas++;
        if(tipo==='iniciar'||tipo==='iniciarVazio')bloqueado=true;
        const codigo=tipo==='apagar'?'IDB_EXCLUSAO_FALHOU':
          tipo==='iniciar'||tipo==='iniciarVazio'?'IDB_INICIALIZACAO_FALHOU':'IDB_GRAVACAO_FALHOU';
        try{aoFalhar(codigo);}catch{/* Telemetria opcional. */}
        return false;
      }
    });
    fila=tarefa;
    return tarefa;
  }

  function iniciar(conteudoLegado){
    if(!habilitado)return Promise.resolve(true);
    if(typeof conteudoLegado!=='string'||conteudoLegado.length===0)return Promise.resolve(false);
    return enfileirar('iniciar',conteudoLegado);
  }
  function iniciarVazio(){return enfileirar('iniciarVazio',null);}
  function iniciarPrimarioSemLegado(){return enfileirar('iniciarPrimario',null);}

  // A confirmação e a exportação das duas origens são exigidas pelo controlador.
  // O commit IndexedDB ocorre primeiro; falha posterior do espelho legado é
  // reportada como conflito, sem alegar recuperação concluída.
  function recuperarComEscolha({idbAnterior,localAnterior,conteudoEscolhido,lerLocal,gravarLocal}){
    if(!habilitado||![idbAnterior,conteudoEscolhido].every(v=>typeof v==='string')||
      typeof lerLocal!=='function'||typeof gravarLocal!=='function')return Promise.resolve(false);
    const tarefa=fila.catch(()=>false).then(async()=>{
      try{
        if(lerLocal()!==localAnterior)return false;
        const resultado=await transacionar('recuperar',conteudoEscolhido,
          {tipo:'dados',conteudo:idbAnterior});
        if(resultado.estado!=='ok'){bloqueado=true;estado='conflito';return false;}
        esperado=resultado.esperado;
        if(lerLocal()!==localAnterior){bloqueado=true;estado='conflito';return false;}
        gravarLocal(conteudoEscolhido);
        bloqueado=false;estado='sincronizado';ultimaSincronizacao=new Date().toISOString();
        return true;
      }catch{
        bloqueado=true;estado='erro';falhas++;
        try{aoFalhar('IDB_RECUPERACAO_FALHOU');}catch{/* Apenas telemetria técnica. */}
        return false;
      }
    });
    fila=tarefa;
    return tarefa;
  }

  async function conferir(conteudoLegado){
    await fila;
    if(!habilitado)return {estado:'indisponivel'};
    try{
      const db=await abrir();
      const registro=await new Promise((resolve,reject)=>{
        try{
          const transacao=db.transaction(COLECAO_ESPELHO,'readonly');
          transacao.onerror=()=>reject(transacao.error||new Error('IDB_TRANSACTION'));
          transacao.onabort=()=>reject(transacao.error||new Error('IDB_ABORT'));
          const pedido=transacao.objectStore(COLECAO_ESPELHO).get(REGISTRO_ESPELHO);
          pedido.onsuccess=()=>resolve(pedido.result??null);
          pedido.onerror=()=>reject(pedido.error||new Error('IDB_READ'));
        }catch(error){reject(error);}
      });
      const atual=classificar(registro);
      if(atual.tipo==='invalido')return {estado:'erro'};
      if(conteudoLegado===null)return {estado:['vazio','apagado'].includes(atual.tipo)?'vazio':'residuo'};
      return {estado:atual.tipo==='dados'&&atual.conteudo===conteudoLegado?'sincronizado':'divergente'};
    }catch{
      return {estado:'erro'};
    }
  }

  // Exposição restrita à recuperação iniciada pelo usuário; nunca usada pelo Diagnóstico.
  async function obterCopiaParaRecuperacao({comPrimaria=false}={}){
    await fila;
    if(!habilitado)return {estado:'indisponivel'};
    try{
      const db=await abrir();
      const registro=await new Promise((resolve,reject)=>{
        const transacao=db.transaction(COLECAO_ESPELHO,'readonly');
        transacao.onerror=()=>reject(transacao.error||new Error('IDB_TRANSACTION'));
        transacao.onabort=()=>reject(transacao.error||new Error('IDB_ABORT'));
        const pedido=transacao.objectStore(COLECAO_ESPELHO).get(REGISTRO_ESPELHO);
        pedido.onsuccess=()=>resolve(pedido.result??null);
        pedido.onerror=()=>reject(pedido.error||new Error('IDB_READ'));
      });
      const copia=classificar(registro);
      if(copia.tipo==='dados')return {estado:'dados',conteudo:copia.conteudo,
        ...(comPrimaria?{primaria:copia.primario}:{})};
      if(copia.tipo==='apagado')return {estado:'apagado'};
      if(copia.tipo==='vazio')return {estado:'vazio'};
      return {estado:'invalido'};
    }catch{return {estado:'erro'};}
  }

  return Object.freeze({
    iniciar,iniciarVazio,iniciarPrimarioSemLegado,obterCopiaParaRecuperacao,recuperarComEscolha,
    gravar:conteudo=>typeof conteudo==='string'&&conteudo.length>0?
      enfileirar('gravar',conteudo):Promise.resolve(false),
    apagar:()=>enfileirar('apagar',null),
    conferir,
    obterEstado:()=>({habilitado,estado,falhas,ultimaSincronizacao,
      exclusaoProtegida:esperado.tipo==='apagado'})
  });
}
