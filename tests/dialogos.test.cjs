const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function element() {
  const listeners=new Map();
  const classes=new Set();
  return {
    textContent:'',open:false,
    classList:{toggle:(name,enabled)=>{if(enabled)classes.add(name);else classes.delete(name);},contains:name=>classes.has(name)},
    addEventListener:(name,callback)=>listeners.set(name,callback),
    emit:(name,event={preventDefault:()=>{}})=>listeners.get(name)?.(event),
    showModal(){this.open=true;},close(){this.open=false;this.emit('close');},
    focus:()=>{},
    querySelectorAll:()=>[]
  };
}

function factory() {
  const els=Object.fromEntries(['confirmation-dialog','confirmation-title','confirmation-message','confirmation-cancel','confirmation-accept'].map(id=>[id,element()]));
  const code=fs.readFileSync(path.join(__dirname,'..','dist/modules/dialogos.js'),'utf8').replace(/^export /gm,'');
  const scope={document:{getElementById:id=>els[id]},window:{confirm:()=>{throw Error('Fallback inesperado');}}};
  vm.runInNewContext(`${code}\nthis.start=iniciarDialogos;`,scope);
  return {dialogs:scope.start(),els};
}

test('Confirmação só executa ação perigosa após aceite explícito',async()=>{
  const {dialogs,els}=factory();
  const pending=dialogs.confirmar({titulo:'Excluir',mensagem:'Remover lançamento?',acao:'Sim, excluir',perigoso:true});
  assert.equal(els['confirmation-dialog'].open,true);
  assert.equal(els['confirmation-title'].textContent,'Excluir');
  assert.equal(els['confirmation-message'].textContent,'Remover lançamento?');
  assert.equal(els['confirmation-accept'].classList.contains('button-danger'),true);
  els['confirmation-accept'].emit('click');
  assert.equal(await pending,true);
  assert.equal(els['confirmation-dialog'].open,false);
});

test('Cancelar e Escape interrompem alterações, inclusive confirmação simultânea',async()=>{
  const {dialogs,els}=factory();
  const first=dialogs.confirmar({mensagem:'Substituir backup?'});
  const second=await dialogs.confirmar({mensagem:'Outra ação'});
  assert.equal(second,false);
  els['confirmation-dialog'].emit('cancel');
  assert.equal(await first,false);
  const third=dialogs.confirmar({mensagem:'Outra ação'});
  els['confirmation-cancel'].emit('click');
  assert.equal(await third,false);
});

test('Aviso informativo não mostra botão de cancelar',async()=>{
  const {dialogs,els}=factory();
  const result=dialogs.informar('Falha','Não foi possível salvar');
  assert.equal(els['confirmation-cancel'].classList.contains('hidden'),true);
  els['confirmation-accept'].emit('click');
  assert.equal(await result,true);
});

test('Close atrasado do primeiro diálogo não cancela a segunda confirmação',async()=>{
  const {dialogs,els}=factory();
  const modal=els['confirmation-dialog'];
  modal.close=()=>{modal.open=false;}; // Navegador emite close na próxima tarefa.
  const primeira=dialogs.confirmar({mensagem:'Guardar as duas cópias?'});
  els['confirmation-accept'].emit('click');
  assert.equal(await primeira,true);
  const segunda=dialogs.confirmar({mensagem:'Recuperar origem escolhida?'});
  assert.equal(modal.open,true);
  modal.emit('close'); // Evento atrasado da confirmação anterior.
  assert.equal(modal.open,true);
  els['confirmation-accept'].emit('click');
  assert.equal(await segunda,true);
});
