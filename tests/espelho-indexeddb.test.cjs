const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const source=fs.readFileSync(path.join(__dirname,'../dist/modules/espelho-indexeddb.js'),'utf8');
const apiModulo=import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));

function fakeIndexedDB({falhar=false,falharSomente=null}={}){
  const registros=new Map();
  let transacaoAnterior=Promise.resolve();
  const db={
    objectStoreNames:{contains:()=>false},
    createObjectStore:()=>{},
    close:()=>{},
    transaction:()=>{
      const anterior=transacaoAnterior;
      let liberar;
      transacaoAnterior=new Promise(resolve=>{liberar=resolve;});
      let pendentes=0,encerrada=false;
      const tx={
        error:null,
        abort(){
          if(encerrada)return;
          encerrada=true;tx.error=new Error('abortado');
          tx.onabort?.();liberar();
        }
      };
      function encerrarSePronto(){
        queueMicrotask(()=>{
          if(encerrada||pendentes!==0)return;
          encerrada=true;tx.oncomplete?.();liberar();
        });
      }
      function agendar(tipo,executar){
        pendentes++;
        void anterior.then(()=>queueMicrotask(()=>{
          if(encerrada)return;
          if(falhar||falharSomente===tipo){
            encerrada=true;tx.error=new Error('falha fictícia');
            tx.onerror?.();liberar();return;
          }
          try{executar();}
          catch(error){encerrada=true;tx.error=error;tx.onerror?.();liberar();return;}
          pendentes--;
          encerrarSePronto();
        }));
      }
      tx.objectStore=()=>({
        put:(value,key)=>agendar('put',()=>registros.set(key,value)),
        delete:key=>agendar('delete',()=>registros.delete(key)),
        get:key=>{
          const pedido={result:null};
          agendar('get',()=>{
            pedido.result=registros.get(key);
            pedido.onsuccess?.();
          });
          return pedido;
        }
      });
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

test('Gravação enfileirada antes de detectar conflito não destrói a cópia original',async()=>{
  const {criarEspelhoIndexedDB}=await apiModulo;
  const fake=fakeIndexedDB();
  const antigo=criarEspelhoIndexedDB({api:fake.api});
  assert.equal(await antigo.iniciar('versao-indexeddb'),true);
  const atual=criarEspelhoIndexedDB({api:fake.api});
  const comparando=atual.iniciar('versao-local-antiga');
  const salvando=atual.gravar('edicao-feita-durante-inicializacao');
  assert.deepEqual(await Promise.all([comparando,salvando]),[false,false]);
  assert.equal(fake.registros.get('principal').conteudo,'versao-indexeddb');
  assert.equal(atual.obterEstado().estado,'conflito');
});

test('Duas abas que inicializam juntas não sobrescrevem snapshots diferentes',async()=>{
  const {criarEspelhoIndexedDB}=await apiModulo;
  const fake=fakeIndexedDB();
  const primeira=criarEspelhoIndexedDB({api:fake.api});
  const segunda=criarEspelhoIndexedDB({api:fake.api});
  assert.deepEqual(await Promise.all([primeira.iniciar('origem-a'),segunda.iniciar('origem-b')]),[true,false]);
  assert.equal(fake.registros.get('principal').conteudo,'origem-a');
  assert.equal(segunda.obterEstado().estado,'conflito');
});

test('Gravação entre abas é comparada na transação e não perde versão concorrente',async()=>{
  const {criarEspelhoIndexedDB}=await apiModulo;
  const fake=fakeIndexedDB();
  const aba1=criarEspelhoIndexedDB({api:fake.api});
  const aba2=criarEspelhoIndexedDB({api:fake.api});
  assert.equal(await aba1.iniciar('mes-anterior'),true);
  assert.equal(await aba2.iniciar('mes-anterior'),true);
  assert.equal(await aba1.gravar('mes-atual'),true);
  assert.equal(await aba2.gravar('edicao-antiga'),false);
  assert.equal(fake.registros.get('principal').conteudo,'mes-atual');
  assert.equal(aba2.obterEstado().estado,'conflito');
});

test('Esquema futuro desconhecido é preservado e legado recebe marcador de versão',async()=>{
  const {criarEspelhoIndexedDB}=await apiModulo;
  const fake=fakeIndexedDB();
  fake.registros.set('principal',{conteudo:'dados-antigos',atualizadoEm:123});
  const atual=criarEspelhoIndexedDB({api:fake.api});
  assert.equal(await atual.iniciar('dados-antigos'),true);
  assert.equal(fake.registros.get('principal').versao,1);
  assert.equal(fake.registros.get('principal').atualizadoEm,123);
  fake.registros.set('principal',{conteudo:'dados-novos',versao:2,atualizadoEm:124});
  const obsoleto=criarEspelhoIndexedDB({api:fake.api});
  assert.equal(await obsoleto.iniciar('dados-novos'),false);
  assert.equal(await obsoleto.gravar('outra-versao'),false);
  assert.equal(fake.registros.get('principal').versao,2);
  assert.equal(fake.registros.get('principal').conteudo,'dados-novos');
});

test('Falha na transação de inicialização não autoriza gravação posterior arriscada',async()=>{
  const {criarEspelhoIndexedDB}=await apiModulo;
  const fake=fakeIndexedDB({falharSomente:'get'});
  const codigos=[];
  const espelho=criarEspelhoIndexedDB({api:fake.api,aoFalhar:codigo=>codigos.push(codigo)});
  assert.equal(await espelho.iniciar('legado-valido'),false);
  assert.equal(await espelho.gravar('outro-legado'),false);
  assert.equal(fake.registros.has('principal'),false);
  assert.deepEqual(codigos,['IDB_INICIALIZACAO_FALHOU']);
});
