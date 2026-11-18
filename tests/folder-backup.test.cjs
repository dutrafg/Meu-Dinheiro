const assert = require('node:assert/strict');
const test = require('node:test');
const backup = require('../dist/folder-backup.js');

const FILE = 'meu-dinheiro-dados.json';
const base = () => ({app:'meu-dinheiro-essencial',version:1,transactions:[],goals:[],allocations:[],completedAportes:[]});

function fakeDirectory(name='Finanças') {
  const files = new Map();
  const history = new Map();
  let allowed = true;
  let fail = false;
  const directory = {
    name,files,history,
    setPermission: v => {allowed=v;},
    failWrites: v => {fail=v;},
    queryPermission: async () => allowed?'granted':'prompt',
    requestPermission: async () => {allowed=true;return 'granted';},
    async getFileHandle(filename, options={}) {return fileFor(files,filename,options);},
    async getDirectoryHandle(folder,options={}) {
      assert.equal(folder,'historico');assert.equal(options.create,true);
      return {getFileHandle:async(name,opts={})=>fileFor(history,name,opts)};
    }
  };
  function fileFor(map,filename,options) {
    if (!map.has(filename) && !options.create) throw Object.assign(Error('Inexistente'),{name:'NotFoundError'});
    return {
      getFile:async()=>({text:async()=>map.get(filename)}),
      createWritable:async()=>{
        if(fail)throw Error('Disco indisponível');
        let draft='';
        return {write:async text=>{draft=text;},close:async()=>{map.set(filename,draft);},abort:async()=>{}};
      }
    };
  }
  return directory;
}
function fixture(directory=fakeDirectory(),confirmReplace=()=>true) {
  let data=base();
  let stored=null;
  const statuses=[];
  const store={load:async()=>stored,save:async handle=>{stored=handle;}};
  const manager=backup.createManager({
    chooseDirectory:async()=>directory,store,
    getSnapshot:()=>data,confirmReplace,
    onStatus:value=>statuses.push(value),
    now:()=>new Date('2026-11-18T17:00:00.000Z')
  });
  return {directory,manager,statuses,setData:next=>{data=next;},store};
}

test('Primeira autorização grava dados completos e cópia diária', async () => {
  const f=fixture();
  await f.manager.initialize();
  assert.equal(f.manager.getState().state,'off');
  assert.equal(await f.manager.connect(),true);
  const saved=JSON.parse(f.directory.files.get(FILE));
  assert.deepEqual(saved.transactions,[]);
  assert.equal(saved.app,'meu-dinheiro-essencial');
  assert.equal(f.directory.history.get('meu-dinheiro-2026-11-18.json'),f.directory.files.get(FILE));
  assert.equal(f.manager.getState().state,'saved');
});

test('Cada alteração grava os dados mais recentes, preservando backup restaurável', async () => {
  const f=fixture();
  await f.manager.connect();
  const first={...base(),transactions:[{id:'renda',amount:1500}]};
  f.setData(first);
  assert.equal(await f.manager.saveNow(),true);
  assert.equal(JSON.parse(f.directory.files.get(FILE)).transactions[0].amount,1500);
  f.setData({...first,goals:[{id:'sonho',saved:500,target:2500}]});
  assert.equal(await f.manager.saveNow(),true);
  const disk=JSON.parse(f.directory.files.get(FILE));
  assert.equal(disk.goals[0].saved,500);
  assert.equal(disk.transactions.length,1);
  assert.equal(f.directory.history.size,1);
});

test('Não sobrescreve backup diferente quando o usuário cancela', async () => {
  const dir=fakeDirectory();
  dir.files.set(FILE,JSON.stringify({...base(),transactions:[{id:'antigo'}]}));
  const f=fixture(dir,()=>false);
  const previous=dir.files.get(FILE);
  assert.equal(await f.manager.connect(),false);
  assert.equal(dir.files.get(FILE),previous);
  assert.equal(dir.history.size,0);
});

test('Antes de substituir, guarda uma cópia recuperável dos dados antigos', async () => {
  const dir=fakeDirectory();
  const previous=JSON.stringify({...base(),goals:[{id:'meta-anterior'}]});
  dir.files.set(FILE,previous);
  const f=fixture(dir,()=>true);
  assert.equal(await f.manager.connect(),true);
  assert.equal(JSON.parse(dir.files.get(FILE)).goals.length,0);
  assert.equal(dir.history.get('meu-dinheiro-anterior-2026-11-18T17-00-00-000Z.json'),previous);
});

test('Detecta alteração externa do arquivo e não sobrescreve', async () => {
  const f=fixture();await f.manager.connect();
  f.directory.files.set(FILE,'arquivo modificado fora do app');
  f.setData({...base(),goals:[{name:'Reserva'}]});
  assert.equal(await f.manager.saveNow(),false);
  assert.equal(f.manager.getState().state,'conflict');
  assert.equal(f.directory.files.get(FILE),'arquivo modificado fora do app');
});

test('Permissão expirada bloqueia escrita e permite reautorizar pelo botão', async () => {
  const f=fixture();await f.manager.connect();
  f.directory.setPermission(false);
  f.setData({...base(),transactions:[{id:'personal'}]});
  assert.equal(await f.manager.saveNow(),false);
  assert.equal(f.manager.getState().state,'permission');
  assert.equal(await f.manager.reauthorize(),true);
  assert.equal(JSON.parse(f.directory.files.get(FILE)).transactions[0].id,'personal');
});

test('Erros do disco aparecem no status e não apagam dados existentes', async () => {
  const f=fixture();await f.manager.connect();
  const previous=f.directory.files.get(FILE);
  f.directory.failWrites(true);
  f.setData({...base(),goals:[{id:'reserva'}]});
  assert.equal(await f.manager.saveNow(),false);
  assert.equal(f.manager.getState().state,'error');
  assert.equal(f.directory.files.get(FILE),previous);
});

test('Restaurar sessão recupera pasta sem pedir seletor de novo', async () => {
  const f=fixture();await f.manager.connect();
  const another=backup.createManager({
    chooseDirectory:async()=>{throw Error('Não deveria abrir o seletor');},
    store:f.store,getSnapshot:base,onStatus:()=>{}
  });
  await another.initialize();
  assert.equal(another.getState().state,'ready');
});

test('Ausência de API não afeta o backup JSON manual', async () => {
  const manager=backup.createManager({chooseDirectory:null,store:null,getSnapshot:base,onStatus:()=>{}});
  await manager.initialize();
  assert.equal(manager.getState().state,'unsupported');
  assert.equal(await manager.connect(),false);
});

test('Verifica formato antes de comparar um arquivo existente', () => {
  assert.throws(()=>backup.parseExisting('{ arquivo quebrado'),/incompatível/);
  assert.equal(backup.sameData(base(),base()),true);
  assert.equal(backup.sameData({...base(),goals:[{id:'x'}]},base()),false);
});
