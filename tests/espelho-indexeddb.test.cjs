const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const source=fs.readFileSync(path.join(__dirname,'../dist/modules/espelho-indexeddb.js'),'utf8');
const apiModulo=import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));

function fakeIndexedDB({falhar=false}={}){
  const registros=new Map();
  const db={
    objectStoreNames:{contains:()=>false},
    createObjectStore:()=>{},
    close:()=>{},
    transaction:()=>{
      const tx={
        objectStore:()=>({
          put:(value,key)=>queueMicrotask(()=>{
            if(falhar){tx.error=new Error('falha fictícia');tx.onerror?.();return;}
            registros.set(key,value);tx.oncomplete?.();
          }),
          delete:key=>queueMicrotask(()=>{
            if(falhar){tx.error=new Error('falha fictícia');tx.onerror?.();return;}
            registros.delete(key);tx.oncomplete?.();
          }),
          get:key=>{
            const pedido={result:null};
            queueMicrotask(()=>{pedido.result=registros.get(key);pedido.onsuccess?.();});
            return pedido;
          }
        })
      };
      return tx;
    }
  };
  return {registros,api:{open:()=>{
    const pedido={result:db};
    queueMicrotask(()=>{pedido.onupgradeneeded?.();pedido.onsuccess?.();});
    return pedido;
  }}};
}

test('Replica os dados em ordem e verifica igualdade sem exibir o conteúdo',async()=>{
  const {criarEspelhoIndexedDB}=await apiModulo;
  const fake=fakeIndexedDB();
  const espelho=criarEspelhoIndexedDB({api:fake.api});
  const inicial=JSON.stringify({transactions:[{description:'Despesa particular',amount:23.45}]});
  const final=JSON.stringify({transactions:[{description:'Despesa particular',amount:23.46}]});
  const operacoes=[espelho.gravar(inicial),espelho.gravar(final)];
  assert.deepEqual(await Promise.all(operacoes),[true,true]);
  assert.equal(fake.registros.get('principal').conteudo,final);
  assert.equal((await espelho.conferir(final)).estado,'sincronizado');
  assert.equal((await espelho.conferir(inicial)).estado,'divergente');
  assert.equal(JSON.stringify(espelho.obterEstado()).includes('Despesa particular'),false);
});

test('Exclusão aguarda gravações anteriores e não ressuscita registros',async()=>{
  const {criarEspelhoIndexedDB}=await apiModulo;
  const fake=fakeIndexedDB();
  const espelho=criarEspelhoIndexedDB({api:fake.api});
  const gravando=espelho.gravar('dados antigos');
  const apagando=espelho.apagar();
  assert.equal(await gravando,true);
  assert.equal(await apagando,true);
  assert.equal(fake.registros.has('principal'),false);
  assert.equal((await espelho.conferir(null)).estado,'vazio');
});

test('Navegador sem IndexedDB mantém o caminho legado disponível',async()=>{
  const {criarEspelhoIndexedDB}=await apiModulo;
  const espelho=criarEspelhoIndexedDB({api:null});
  assert.equal(espelho.obterEstado().habilitado,false);
  assert.equal(await espelho.gravar('dados'),true);
  assert.equal(await espelho.apagar(),true);
  assert.equal((await espelho.conferir('dados')).estado,'indisponivel');
});

test('Falha de exclusão é identificada sem registrar conteúdo financeiro',async()=>{
  const {criarEspelhoIndexedDB}=await apiModulo;
  const fake=fakeIndexedDB({falhar:true});
  const codigos=[];
  const espelho=criarEspelhoIndexedDB({api:fake.api,aoFalhar:codigo=>codigos.push(codigo)});
  assert.equal(await espelho.gravar('saldo privado'),false);
  assert.equal(await espelho.apagar(),false);
  assert.deepEqual(codigos,['IDB_GRAVACAO_FALHOU','IDB_EXCLUSAO_FALHOU']);
  assert.equal(espelho.obterEstado().falhas,2);
  assert.equal(JSON.stringify(espelho.obterEstado()).includes('saldo privado'),false);
});


test('Inicialização preserva cópia divergente sem substituí-la',async()=>{
  const {criarEspelhoIndexedDB}=await apiModulo;
  const fake=fakeIndexedDB();
  const anterior=criarEspelhoIndexedDB({api:fake.api});
  assert.equal(await anterior.gravar('versao-indexeddb'),true);
  const inicial=criarEspelhoIndexedDB({api:fake.api});
  assert.equal(await inicial.iniciar('versao-local-antiga'),false);
  assert.equal(inicial.obterEstado().estado,'conflito');
  assert.equal(await inicial.gravar('nova-gravacao-local'),false);
  assert.equal(fake.registros.get('principal').conteudo,'versao-indexeddb');
  assert.equal((await inicial.conferir('versao-local-antiga')).estado,'divergente');
});

test('Inicialização idempotente preserva registro já sincronizado',async()=>{
  const {criarEspelhoIndexedDB}=await apiModulo;
  const fake=fakeIndexedDB();
  const primeiro=criarEspelhoIndexedDB({api:fake.api});
  assert.equal(await primeiro.iniciar('arquivo-legado'),true);
  const data=fake.registros.get('principal').atualizadoEm;
  assert.equal(await primeiro.iniciar('arquivo-legado'),true);
  assert.equal(fake.registros.get('principal').atualizadoEm,data);
  assert.equal((await primeiro.conferir('arquivo-legado')).estado,'sincronizado');
});
