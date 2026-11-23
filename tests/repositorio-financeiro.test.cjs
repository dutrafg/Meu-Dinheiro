const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const carregar=()=>import('data:text/javascript;base64,'+Buffer.from(
  fs.readFileSync(path.join(__dirname,'../dist/modules/repositorio-financeiro.js'),'utf8')).toString('base64'));
const validar=raw=>{
  const dados=JSON.parse(raw);
  if(!Array.isArray(dados.transactions)||!Array.isArray(dados.goals))throw Error('Inválido');
  return dados;
};
const criar=()=>JSON.stringify({transactions:[],goals:[],allocations:[],completedAportes:[]});

test('Migração idempotente só considera IndexedDB primário após confirmação',async()=>{
  const {criarRepositorioFinanceiro}=await carregar();
  let legado=criar(),idb=null,liberar;
  const log=[];
  const espelho={obterEstado:()=>({habilitado:true}),
    iniciar:async raw=>{idb=raw;return true;},iniciarVazio:async()=>false,
    obterCopiaParaRecuperacao:async()=>({estado:'dados',conteudo:idb}),
    gravar:raw=>new Promise(resolve=>{liberar=()=>{idb=raw;log.push('commit');resolve(true);};})};
  const storage={getItem:()=>legado,setItem:(key,raw)=>{legado=raw;log.push('legado');}};
  const repo=criarRepositorioFinanceiro({espelho,storage,chave:'dados',validar});
  assert.equal((await repo.iniciar()).modo,'primario');
  const novo=JSON.stringify({transactions:[{id:'teste'}],goals:[]});
  const pendente=repo.gravar(novo);
  assert.notEqual(legado,novo,'O legado não pode ser gravado antes do commit IndexedDB');
  liberar();
  assert.deepEqual(await pendente,{ok:true,modo:'primario'});
  assert.deepEqual(log,['commit','legado']);
  assert.equal(idb,novo);
});

test('Conflito de migração nunca escolhe vencedor nem escreve qualquer origem',async()=>{
  const {criarRepositorioFinanceiro}=await carregar();
  let writes=0;
  const repo=criarRepositorioFinanceiro({espelho:{obterEstado:()=>({habilitado:true}),
    iniciar:async()=>false},storage:{getItem:()=>criar(),setItem:()=>writes++},
    chave:'dados',validar});
  assert.equal((await repo.iniciar()).modo,'conflito');
  assert.equal((await repo.gravar(criar())).ok,false);
  assert.equal(writes,0);
});

test('Falha no espelho legado preserva commit primário e sinaliza alerta',async()=>{
  const {criarRepositorioFinanceiro}=await carregar();
  const avisos=[];const raw=criar();
  const repo=criarRepositorioFinanceiro({espelho:{obterEstado:()=>({habilitado:true}),
    iniciar:async()=>true,obterCopiaParaRecuperacao:async()=>({estado:'dados',conteudo:raw}),
    gravar:async()=>true},storage:{getItem:()=>raw,setItem:()=>{throw Error('Quota');}},
    chave:'dados',validar,aoAvisar:codigo=>avisos.push(codigo)});
  await repo.iniciar();
  const resultado=await repo.gravar(JSON.stringify({transactions:[{id:'novo'}],goals:[]}));
  assert.deepEqual(resultado,{ok:true,modo:'espelho-pendente'});
  assert.equal(repo.obterEstado().primario,false);
  assert.deepEqual(avisos,['IDB_ESPELHO_LOCAL_FALHOU']);
  assert.equal((await repo.gravar(criar())).ok,false);
});

test('Outra aba altera localStorage durante commit: preservar sua cópia sem sobrescrever',async()=>{
  const {criarRepositorioFinanceiro}=await carregar();
  const antigo=criar(),avisos=[];let local=antigo,liberar;
  const repo=criarRepositorioFinanceiro({espelho:{obterEstado:()=>({habilitado:true}),
    iniciar:async()=>true,obterCopiaParaRecuperacao:async()=>({estado:'dados',conteudo:antigo}),
    gravar:()=>new Promise(resolve=>{liberar=()=>resolve(true);})},
    storage:{getItem:()=>local,setItem:(key,raw)=>{local=raw;}},
    chave:'dados',validar,aoAvisar:codigo=>avisos.push(codigo)});
  await repo.iniciar();
  const pendente=repo.gravar(JSON.stringify({transactions:[{id:'nova'}],goals:[]}));
  local=JSON.stringify({transactions:[{id:'de-outra-aba'}],goals:[]});
  liberar();
  assert.deepEqual(await pendente,{ok:true,modo:'espelho-pendente'});
  assert.match(local,/de-outra-aba/);
  assert.deepEqual(avisos,['IDB_ESPELHO_LOCAL_CONFLITO']);
});

test('Com 1.000 e 10.000 registros o repositório preserva todos em ordem',async()=>{
  const {criarRepositorioFinanceiro}=await carregar();
  for(const n of [1000,10000]){
    let idb=null,legado=null,escritas=0;
    const espelho={obterEstado:()=>({habilitado:true}),iniciarVazio:async()=>true,
      obterCopiaParaRecuperacao:async()=>({estado:'vazio'}),
      gravar:async raw=>{idb=raw;escritas++;return true;}};
    const repo=criarRepositorioFinanceiro({espelho,storage:{getItem:()=>legado,
      setItem:(key,value)=>{legado=value;}},chave:'dados',validar});
    assert.equal((await repo.iniciar()).modo,'primario');
    const transacoes=Array.from({length:n},(_,i)=>({id:`ficticio-${i}`,amount:i/100}));
    assert.equal((await repo.gravar(JSON.stringify({transactions:transacoes,goals:[]}))).ok,true);
    assert.equal(JSON.parse(idb).transactions.length,n);
    assert.equal(idb,legado);
    assert.equal(escritas,1);
  }
});

test('Backup explícito recupera origem local corrompida sem importar dados inválidos',async()=>{
  const {criarRepositorioFinanceiro}=await carregar();
  let local='arquivo-corrompido',idb=criar();
  const repo=criarRepositorioFinanceiro({espelho:{obterEstado:()=>({habilitado:true}),
    obterCopiaParaRecuperacao:async()=>({estado:'dados',conteudo:idb}),
    recuperarComEscolha:async op=>{
      assert.equal(op.idbAnterior,idb);
      assert.equal(op.localAnterior,local);
      idb=op.conteudoEscolhido;
      op.gravarLocal(idb);
      return true;
    }},storage:{getItem:()=>local,setItem:(key,v)=>{local=v;}},chave:'dados',validar});
  assert.equal((await repo.iniciar()).modo,'bloqueado');
  assert.equal((await repo.restaurarBackup('{errado')).ok,false);
  const backup=JSON.stringify({transactions:[{id:'valido'}],goals:[]});
  assert.equal((await repo.restaurarBackup(backup)).ok,true);
  assert.equal(local,idb);
  assert.equal(repo.obterEstado().primario,true);
});

test('Reabre fonte primária sem chave legada depois da migração marcada',async()=>{
  const {criarRepositorioFinanceiro}=await carregar();
  const dados=criar();
  let gravado=null;
  const repo=criarRepositorioFinanceiro({espelho:{
    obterEstado:()=>({habilitado:true}),
    obterCopiaParaRecuperacao:async()=>({estado:'dados',conteudo:dados,primaria:true}),
    iniciarPrimarioSemLegado:async()=>true,
    gravar:async raw=>{gravado=raw;return true;}
  },storage:{getItem:()=>null,setItem:()=>{}},chave:'dados',validar});
  assert.equal((await repo.iniciar()).modo,'primario');
  assert.equal((await repo.gravar(dados)).ok,true);
  assert.equal(gravado,dados);
});
