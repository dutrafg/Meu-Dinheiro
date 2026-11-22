const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const codigo=fs.readFileSync(path.join(__dirname,'../dist/modules/recuperacao-conflitos.js'),'utf8');
const validacao=fs.readFileSync(path.join(__dirname,'../dist/modules/validacao.js'),'utf8');
const carregar=texto=>import('data:text/javascript;base64,'+Buffer.from(texto).toString('base64'));
const modulo=carregar(codigo),util=carregar(validacao);
const dados=(descricao='Lançamento privado fictício')=>JSON.stringify({
  transactions:[{id:'transacao-teste',type:'income',description:descricao,amount:250,
    date:'2026-11-10',category:'Salário base'}],
  goals:[],allocations:[],completedAportes:[]
});
async function validar(){
  const {validarBackup}=await util;
  return arquivo=>validarBackup({...arquivo,app:'meu-dinheiro-essencial',version:1},{income:[],expense:[]});
}
function tela(){
  const elementos=new Map();
  for(const id of ['recovery-inspect','recovery-download-local','recovery-download-indexeddb',
    'recovery-status','recovery-local-summary','recovery-indexeddb-summary']){
    const eventos={};
    elementos.set(id,{disabled:false,textContent:'',addEventListener:(evento,fn)=>{eventos[evento]=fn;},
      click:()=>eventos.click?.()});
  }
  return {documento:{getElementById:id=>elementos.get(id)},elementos,pegar:id=>elementos.get(id)};
}

test('Comparação expõe só estados e contagens, sem valores, nomes nem descrições',async()=>{
  const {avaliarCopiasDeRecuperacao}=await modulo;
  const relatorio=avaliarCopiasDeRecuperacao({localRaw:dados('Descrição privada A'),
    idb:{estado:'dados',conteudo:dados('Descrição privada B')},validar:await validar()});
  assert.equal(relatorio.situacao,'divergente');
  assert.equal(relatorio.local.contagens.lancamentos,1);
  assert.equal(relatorio.indexeddb.contagens.lancamentos,1);
  const publico=JSON.stringify(relatorio);
  assert.equal(publico.includes('Descrição privada'),false);
  assert.equal(publico.includes('250'),false);
  const igual=avaliarCopiasDeRecuperacao({localRaw:dados(),
    idb:{estado:'dados',conteudo:dados()},validar:await validar()});
  assert.equal(igual.situacao,'sincronizado');
});

test('Marcador de exclusão, ausência e formato inválido nunca geram download habilitado',async()=>{
  const {avaliarCopiasDeRecuperacao}=await modulo,verificar=await validar();
  const apagada=avaliarCopiasDeRecuperacao({localRaw:dados(),idb:{estado:'apagado'},validar:verificar});
  assert.equal(apagada.indexeddb.estado,'apagada');
  assert.equal(apagada.situacao,'divergente');
  const vazia=avaliarCopiasDeRecuperacao({localRaw:null,idb:{estado:'vazio'},validar:verificar});
  assert.equal(vazia.situacao,'vazio');
  const invalida=avaliarCopiasDeRecuperacao({localRaw:'texto-invalido',
    idb:{estado:'dados',conteudo:dados()},validar:verificar});
  assert.equal(invalida.local.estado,'invalida');
  assert.equal(invalida.situacao,'verificacao-pendente');
});

test('Backup de recuperação usa formato importável sem campos desconhecidos',async()=>{
  const {montarBackupRecuperacao}=await modulo,verificar=await validar();
  const backup=montarBackupRecuperacao(dados(),verificar);
  assert.equal(backup.app,'meu-dinheiro-essencial');
  assert.equal(backup.version,1);
  assert.equal(backup.transactions.length,1);
  assert.deepEqual(backup.goals,[]);
  assert.equal(backup.preferences,undefined);
  assert.ok(/^\d{4}-\d\d-\d\dT/.test(backup.exportedAt));
  assert.throws(()=>montarBackupRecuperacao('{"transactions":[]}',verificar));
});

test('Inspeção é somente leitura e exige duas origens válidas para dois downloads',async()=>{
  const {iniciarRecuperacaoConflitos}=await modulo,verificar=await validar();
  const t=tela(),salvos=[],eventos=[];
  let local=dados('Origem local'),idb=dados('Origem IndexedDB'),gravacoes=0;
  const storage={getItem:()=>local,setItem:()=>{gravacoes++;}};
  const espelho={obterCopiaParaRecuperacao:async()=>({estado:'dados',conteudo:idb})};
  const app=iniciarRecuperacaoConflitos({storage,chave:'financeiro',espelho,validar:verificar,
    documento:t.documento,salvarArquivo:(arquivo,nome)=>{salvos.push({arquivo,nome});return true;},
    registrarEvento:codigo=>eventos.push(codigo)});
  assert.equal(t.pegar('recovery-download-local').disabled,true);
  assert.equal(t.pegar('recovery-download-indexeddb').disabled,true);
  const relatorio=await app.inspecionar();
  assert.equal(relatorio.situacao,'divergente');
  assert.equal(t.pegar('recovery-download-local').disabled,false);
  assert.equal(t.pegar('recovery-download-indexeddb').disabled,false);
  assert.equal(await app.baixar('local'),true);
  assert.equal(await app.baixar('indexeddb'),true);
  assert.equal(salvos.length,2);
  assert.match(salvos[0].nome,/recuperacao-local-/);
  assert.match(salvos[1].nome,/recuperacao-indexeddb-/);
  assert.equal(gravacoes,0,'Inspeção/exportação não escrevem armazenamento');
  assert.equal(JSON.stringify(t.pegar('recovery-status')).includes('Origem local'),false);
  assert.deepEqual(eventos,['RECUPERACAO_INSPECAO','RECUPERACAO_BACKUP_LOCAL','RECUPERACAO_BACKUP_IDB']);
});

test('Se uma aba alterar qualquer cópia após inspeção, download obsoleto é bloqueado',async()=>{
  const {iniciarRecuperacaoConflitos}=await modulo,verificar=await validar();
  const t=tela(),salvos=[];
  let local=dados('Versão inicial'),idb=dados('Cópia divergente');
  const app=iniciarRecuperacaoConflitos({storage:{getItem:()=>local},chave:'financeiro',
    espelho:{obterCopiaParaRecuperacao:async()=>({estado:'dados',conteudo:idb})},
    validar:verificar,documento:t.documento,
    salvarArquivo:(arquivo,nome)=>{salvos.push(nome);return true;}});
  await app.inspecionar();
  local=dados('Alteração concorrente');
  assert.equal(await app.baixar('local'),false);
  assert.equal(salvos.length,0);
  assert.equal(t.pegar('recovery-download-indexeddb').disabled,true);
  await app.inspecionar();
  idb=dados('Outra alteração concorrente');
  assert.equal(await app.baixar('indexeddb'),false);
  assert.equal(salvos.length,0);
});
