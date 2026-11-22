// Assistente de recuperação somente leitura. A escolha de qual cópia usar
// será uma etapa separada: nenhum botão deste módulo substitui dados.
export function avaliarCopiasDeRecuperacao({localRaw,idb,validar}){
  function examinar(raw){
    if(raw===null)return {estado:'vazia',contagens:null};
    if(typeof raw!=='string')return {estado:'invalida',contagens:null};
    try{
      const dados=validar(JSON.parse(raw));
      return {estado:'valida',contagens:{
        lancamentos:dados.transactions.length,
        objetivos:dados.goals.length,
        investimentos:(dados.allocations||[]).length,
        lembretes:(dados.completedAportes||[]).length
      }};
    }catch{return {estado:'invalida',contagens:null};}
  }
  const local=examinar(localRaw);
  const indexeddb=idb?.estado==='dados'?examinar(idb.conteudo):
    {estado:({apagado:'apagada',vazio:'vazia',indisponivel:'indisponivel',
      invalido:'invalida',erro:'erro'})[idb?.estado]||'erro',contagens:null};
  const duas=local.estado==='valida'&&indexeddb.estado==='valida';
  const ambasVazias=['vazia','apagada'].includes(local.estado)&&['vazia','apagada'].includes(indexeddb.estado);
  const situacao=duas?(localRaw===idb.conteudo?'sincronizado':'divergente'):
    ambasVazias?'vazio':['invalida','erro','indisponivel'].includes(local.estado)||
    ['invalida','erro','indisponivel'].includes(indexeddb.estado)?'verificacao-pendente':'divergente';
  return {situacao,local,indexeddb};
}

export function montarBackupRecuperacao(raw,validar){
  if(typeof raw!=='string'||raw.length===0)throw Error('Cópia ausente');
  const dados=validar(JSON.parse(raw));
  return {app:'meu-dinheiro-essencial',version:1,exportedAt:new Date().toISOString(),
    transactions:dados.transactions,goals:dados.goals,
    allocations:dados.allocations||[],completedAportes:dados.completedAportes||[]};
}

function downloadLocal(arquivo,nome,documento){
  if(typeof URL==='undefined'||typeof URL.createObjectURL!=='function'||typeof Blob==='undefined')return false;
  const url=URL.createObjectURL(new Blob([JSON.stringify(arquivo,null,2)],{type:'application/json'}));
  try{
    const a=documento.createElement('a');a.href=url;a.download=nome;
    a.click();
    return true;
  }finally{setTimeout(()=>URL.revokeObjectURL(url),30000);}
}

export function iniciarRecuperacaoConflitos({espelho,storage,chave,validar,documento=document,
  notificar=()=>{},registrarEvento=()=>{},salvarArquivo=downloadLocal}){
  const inspecionarBotao=documento.getElementById('recovery-inspect');
  const localBotao=documento.getElementById('recovery-download-local');
  const idbBotao=documento.getElementById('recovery-download-indexeddb');
  const status=documento.getElementById('recovery-status');
  const localResumo=documento.getElementById('recovery-local-summary');
  const idbResumo=documento.getElementById('recovery-indexeddb-summary');
  let captura=null,emAndamento=false,ultimaSituacao='nao-verificado';
  const desativar=()=>{localBotao.disabled=true;idbBotao.disabled=true;};
  desativar();

  function descricao(copia){
    if(copia.estado!=='valida')return ({
      vazia:'Nenhuma cópia financeira nesta origem.',apagada:'Exclusão protegida por marcador.',
      indisponivel:'Armazenamento indisponível.',erro:'Não foi possível ler a cópia.',
      invalida:'Formato não validado; preserve o armazenamento sem substituí-lo.'
    })[copia.estado]||'Cópia não verificada.';
    const c=copia.contagens;
    return `Cópia válida: ${c.lancamentos} lançamentos, ${c.objetivos} objetivos, ${c.investimentos} investimentos e ${c.lembretes} lembretes.`;
  }

  async function inspecionar(){
    if(emAndamento)return null;
    emAndamento=true;inspecionarBotao.disabled=true;desativar();captura=null;
    status.textContent='Verificando as cópias locais…';
    try{
      const localRaw=storage.getItem(chave);
      const idb=await espelho.obterCopiaParaRecuperacao();
      if(storage.getItem(chave)!==localRaw)throw Error('Origem alterada durante inspeção');
      const relatorio=avaliarCopiasDeRecuperacao({localRaw,idb,validar});
      captura={localRaw,idb,relatorio};
      ultimaSituacao=relatorio.situacao;
      localResumo.textContent=descricao(relatorio.local);
      idbResumo.textContent=descricao(relatorio.indexeddb);
      status.textContent=relatorio.situacao==='sincronizado'?'As duas cópias estão sincronizadas.':
        relatorio.situacao==='vazio'?'Não há registros financeiros para recuperar.':
        relatorio.situacao==='divergente'?'As cópias são diferentes. Guarde ambas antes de decidir qual recuperar.':
        'A verificação encontrou uma cópia indisponível ou inválida. Não substitua os dados.';
      localBotao.disabled=relatorio.local.estado!=='valida';
      idbBotao.disabled=relatorio.indexeddb.estado!=='valida';
      registrarEvento('RECUPERACAO_INSPECAO','dados');
      return relatorio;
    }catch{
      ultimaSituacao='erro';status.textContent='Não foi possível verificar com segurança. Tente novamente.';
      localResumo.textContent='Cópia não verificada.';idbResumo.textContent='Cópia não verificada.';
      return null;
    }finally{inspecionarBotao.disabled=false;emAndamento=false;}
  }

  async function baixar(origem){
    if(emAndamento||!captura||!['local','indexeddb'].includes(origem))return false;
    const {localRaw,idb,relatorio}=captura;
    const valido=origem==='local'?relatorio.local.estado==='valida':relatorio.indexeddb.estado==='valida';
    if(!valido)return false;
    emAndamento=true;
    try{
      if(storage.getItem(chave)!==localRaw)throw Error('Origem local alterada');
      const atual=await espelho.obterCopiaParaRecuperacao();
      if(atual.estado!==idb.estado||
        (idb.estado==='dados'&&atual.conteudo!==idb.conteudo))throw Error('Cópia IndexedDB alterada');
      const raw=origem==='local'?localRaw:idb.conteudo;
      const backup=montarBackupRecuperacao(raw,validar);
      const data=new Date().toISOString().slice(0,10);
      const nome=`meu-dinheiro-recuperacao-${origem}-${data}.json`;
      if(!salvarArquivo(backup,nome,documento))throw Error('Download indisponível');
      registrarEvento(origem==='local'?'RECUPERACAO_BACKUP_LOCAL':'RECUPERACAO_BACKUP_IDB','dados');
      notificar('Cópia de recuperação gerada. Guarde o arquivo em local seguro.');
      return true;
    }catch{
      captura=null;desativar();status.textContent='As cópias mudaram ou o download falhou. Inspecione novamente.';
      return false;
    }finally{emAndamento=false;}
  }

  inspecionarBotao.addEventListener('click',()=>{void inspecionar();});
  localBotao.addEventListener('click',()=>{void baixar('local');});
  idbBotao.addEventListener('click',()=>{void baixar('indexeddb');});
  return {inspecionar,baixar,getEstado:()=>({situacao:ultimaSituacao,copiasInspecionadas:Boolean(captura)})};
}
