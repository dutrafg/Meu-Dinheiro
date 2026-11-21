// Protege dados locais entre abas: uma cópia antiga nunca sobrescreve outra sem aviso.
// Não cria chaves novas nem migra o formato financeiro atual.
export function criarProtecaoConcorrencia({storage,chave,aoAlterar,aoConflito,janela=window}){
  let ultimaCopia=storage.getItem(chave);
  function podeGravar(){
    try{return storage.getItem(chave)===ultimaCopia;}catch{return false;}
  }
  function registrarGravacao(serializado){ultimaCopia=serializado;}
  function sincronizar(){
    let atual;
    try{atual=storage.getItem(chave);}catch{aoConflito();return false;}
    if(atual===ultimaCopia)return true;
    try{
      if(aoAlterar(atual)!==true){aoConflito();return false;}
    }catch{aoConflito();return false;}
    ultimaCopia=atual;
    return true;
  }
  janela.addEventListener?.('storage',evento=>{
    if((evento.key===chave||evento.key===null)&&(!evento.storageArea||evento.storageArea===storage))sincronizar();
  });
  return {podeGravar,registrarGravacao,sincronizar};
}

// Melhoria adicional quando suportada. Permissão negada nunca bloqueia uso ou backup.
export async function solicitarPersistenciaLocal(navegador){
  try{
    if(typeof navegador?.storage?.persist!=='function')return false;
    if(await navegador.storage.persisted?.())return true;
    return await navegador.storage.persist()===true;
  }catch{return false;}
}
