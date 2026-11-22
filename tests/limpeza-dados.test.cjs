const assert=require('node:assert/strict');
const test=require('node:test');
const fs=require('node:fs');
const path=require('node:path');

const helper=fs.readFileSync(path.join(__dirname,'../dist/modules/dialogos.js'),'utf8').replace(/^export /gm,'');
const source=helper+'\n'+fs.readFileSync(path.join(__dirname,'../dist/modules/limpeza-dados.js'),'utf8').replace(/^import .*$/gm,'');
const modulo=import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);

function criarTela(){
  const elementos=new Map();
  const criar=id=>{
    const eventos=new Map();
    const elemento={id,disabled:false,value:'',open:false,type:id==='delete-data-confirm'?'submit':'button',
      addEventListener:(evento,fn)=>eventos.set(evento,fn),
      async emitir(evento,extras={}){return eventos.get(evento)?.({target:elemento,preventDefault(){},...extras});},
      click(){return elemento.emitir('click');},
      showModal(){elemento.open=true;},
      close(){elemento.open=false;return elemento.emitir('close');},
      focus(){elemento.focado=true;}
    };
    elementos.set(id,elemento);
    return elemento;
  };
  for(const id of ['delete-all-data','delete-data-dialog','delete-data-form','delete-data-phrase','delete-data-confirm','delete-data-cancel'])criar(id);
  return {documento:{getElementById:id=>elementos.get(id)},elementos,pegar:id=>elementos.get(id)};
}

test('Apagar remove somente a chave financeira depois de pausar o backup',async()=>{
  const {apagarDadosLocais}=await modulo;
  const registros=new Map([['dados','original'],['preferencias','escuro'],['notificacoes','ocultas']]);
  const ordem=[];
  const storage={removeItem:key=>{ordem.push('apagar');registros.delete(key);}};
  const fez=await apagarDadosLocais({storage,chave:'dados',pausarBackup:async()=>{ordem.push('pausar');},aposLimpeza:()=>ordem.push('renderizar')});
  assert.equal(fez,true);
  assert.deepEqual(ordem,['pausar','apagar','renderizar']);
  assert.equal(registros.has('dados'),false);
  assert.equal(registros.get('preferencias'),'escuro');
  assert.equal(registros.get('notificacoes'),'ocultas');
});

test('Falhas ao pausar o backup ou remover a chave impedem confirmação de sucesso',async()=>{
  const {apagarDadosLocais}=await modulo;
  let apagou=0;
  const storage={removeItem:()=>{apagou++;throw Error('Armazenamento bloqueado');}};
  assert.equal(await apagarDadosLocais({storage,chave:'dados',pausarBackup:()=>{throw Error('Backup ocupado');}}),false);
  assert.equal(apagou,0);
  assert.equal(await apagarDadosLocais({storage,chave:'dados',pausarBackup:async()=>{}}),false);
  assert.equal(apagou,1);
  assert.equal(await apagarDadosLocais({storage:null,chave:'dados'}),false);
});

test('Confirmação cancelada na primeira etapa nunca executa exclusão',async()=>{
  const {iniciarLimpezaDados}=await modulo;
  const tela=criarTela();
  let apagamentos=0;
  iniciarLimpezaDados({documento:tela.documento,confirmar:async()=>false,apagarDados:async()=>{apagamentos++;return true;},notify:()=>{}});
  await tela.pegar('delete-all-data').click();
  assert.equal(tela.pegar('delete-data-dialog').open,false);
  await tela.pegar('delete-data-form').emitir('submit');
  assert.equal(apagamentos,0);
});

test('Segunda confirmação exige APAGAR exato e pode ser cancelada',async()=>{
  const {iniciarLimpezaDados,validarFraseLimpeza}=await modulo;
  const tela=criarTela();
  let apagamentos=0;
  const avisos=[];
  iniciarLimpezaDados({documento:tela.documento,confirmar:async()=>true,apagarDados:async()=>{apagamentos++;return true;},notify:v=>avisos.push(v)});
  assert.equal(validarFraseLimpeza('APAGAR'),true);
  for(const invalida of ['apagar','APAGAR ',' APAGAR','','APAGAR\n'])assert.equal(validarFraseLimpeza(invalida),false);
  await tela.pegar('delete-all-data').click();
  assert.equal(tela.pegar('delete-data-dialog').open,true);
  assert.equal(tela.pegar('delete-data-phrase').focado,true);
  assert.equal(tela.pegar('delete-data-confirm').disabled,true);
  tela.pegar('delete-data-phrase').value='apagar';
  await tela.pegar('delete-data-phrase').emitir('input');
  assert.equal(tela.pegar('delete-data-confirm').disabled,true);
  await tela.pegar('delete-data-form').emitir('submit');
  assert.equal(apagamentos,0);
  tela.pegar('delete-data-phrase').value='APAGAR';
  await tela.pegar('delete-data-phrase').emitir('input');
  assert.equal(tela.pegar('delete-data-confirm').disabled,false);
  await tela.pegar('delete-data-cancel').click();
  assert.equal(tela.pegar('delete-data-dialog').open,false);
  await tela.pegar('delete-data-form').emitir('submit');
  assert.equal(apagamentos,0,'Cancelar invalida confirmação mesmo com a frase digitada');
  assert.equal(avisos.length,0);
});

test('Após ambas as confirmações, exclui uma só vez e comunica resultado',async()=>{
  const {iniciarLimpezaDados}=await modulo;
  const tela=criarTela();
  let apagamentos=0;
  const avisos=[];
  iniciarLimpezaDados({documento:tela.documento,confirmar:async()=>true,apagarDados:async()=>{apagamentos++;return true;},notify:v=>avisos.push(v)});
  await tela.pegar('delete-all-data').click();
  tela.pegar('delete-data-phrase').value='APAGAR';
  await tela.pegar('delete-data-phrase').emitir('input');
  await tela.pegar('delete-data-form').emitir('submit');
  await tela.pegar('delete-data-form').emitir('submit');
  assert.equal(apagamentos,1);
  assert.equal(tela.pegar('delete-data-dialog').open,false);
  assert.equal(tela.pegar('delete-data-phrase').value,'');
  assert.match(avisos[0],/apagados/);
});

test('Falha do armazenamento mantém segunda etapa aberta para nova tentativa',async()=>{
  const {iniciarLimpezaDados}=await modulo;
  const tela=criarTela();
  const avisos=[];
  iniciarLimpezaDados({documento:tela.documento,confirmar:async()=>true,apagarDados:async()=>false,notify:v=>avisos.push(v)});
  await tela.pegar('delete-all-data').click();
  tela.pegar('delete-data-phrase').value='APAGAR';
  await tela.pegar('delete-data-phrase').emitir('input');
  await tela.pegar('delete-data-form').emitir('submit');
  assert.equal(tela.pegar('delete-data-dialog').open,true);
  assert.equal(tela.pegar('delete-data-confirm').disabled,false);
  assert.match(avisos[0],/Não foi possível apagar/);
});


test('Falha ao apagar espelho IndexedDB mantém os dados legados intactos',async()=>{
  const {apagarDadosLocais}=await modulo;
  let removidos=0;
  const storage={removeItem:()=>{removidos++;}};
  const resultado=await apagarDadosLocais({storage,chave:'dados',
    pausarBackup:async()=>{},
    antesRemocao:async()=>{throw Error('IndexedDB temporariamente bloqueado');}});
  assert.equal(resultado,false);
  assert.equal(removidos,0);
});

test('Edição em outra aba durante o backup impede excluir dados atualizados',async()=>{
  const {apagarDadosLocais}=await modulo;
  const valores=new Map([['dados','arquivo-original']]);
  let removidos=0,espelhoApagado=0;
  const storage={getItem:key=>valores.get(key)||null,removeItem:key=>{removidos++;valores.delete(key);}};
  const ok=await apagarDadosLocais({storage,chave:'dados',
    pausarBackup:async()=>valores.set('dados','alteracao-concorrente'),
    antesRemocao:async()=>{espelhoApagado++;}});
  assert.equal(ok,false);
  assert.equal(removidos,0);
  assert.equal(espelhoApagado,0,'Não tocar no espelho após detectar alteração');
  assert.equal(valores.get('dados'),'alteracao-concorrente');
});

test('Mudança enquanto o IndexedDB grava tombstone impede remover localStorage',async()=>{
  const {apagarDadosLocais}=await modulo;
  const valores=new Map([['dados','estado-original']]);
  let removidos=0;
  const storage={getItem:key=>valores.get(key)||null,removeItem:key=>{removidos++;valores.delete(key);}};
  const ok=await apagarDadosLocais({storage,chave:'dados',
    pausarBackup:async()=>{},
    antesRemocao:async()=>valores.set('dados','editado-durante-tombstone')});
  assert.equal(ok,false);
  assert.equal(removidos,0);
  assert.equal(valores.get('dados'),'editado-durante-tombstone');
});
