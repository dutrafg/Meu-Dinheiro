const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const codigo=fs.readFileSync(path.join(__dirname,'../dist/modules/backup.js'),'utf8')
  .replace(/^import .*$/gm,'').replace(/^export /gm,'');

function preparar(){
  const elementos={};
  for(const id of ['folder-backup-connect','folder-backup-reconnect','folder-backup-status',
    'folder-backup-alert','export-data','import-data','import-file']){
    elementos[id]={dataset:{},textContent:'',innerHTML:'',disabled:false,
      classList:{toggle:()=>{},remove:()=>{}},addEventListener:()=>{}};
  }
  let estado={transactions:[],goals:[]},resolver;
  const prontidao=new Promise(resolve=>{resolver=resolve;});
  const snapshots=[],inicializacoes=[];
  const manager={initialize:async()=>{inicializacoes.push('inicio');snapshots.push(estado.transactions.length);},
    getState:()=>({state:'ready'}),schedule:()=>{}};
  const scope={document:{getElementById:id=>elementos[id]},
    window:{MeuDinheiroFolderBackup:{createBrowserManager:()=>manager}},
    normalizarPreferencias:v=>v,Promise,URL,Blob,Date,setTimeout};
  vm.runInNewContext(`${codigo}\nthis.iniciar=iniciarModuloBackup;`,scope);
  const modulo=scope.iniciar({getData:()=>estado,getPreferences:()=>({}),
    salvarPreferencias:()=>true,aplicarPreferencias:()=>{},icon:()=>'',isoDate:()=>'',
    notify:()=>{},persist:async()=>true,resetToSummary:()=>{},
    validarBackup:v=>v,CATEGORIES:{income:[],expense:[]},confirmar:async()=>true,
    registrar:()=>{},registrarEvento:()=>{},aguardarPersistencia:prontidao});
  return {elementos,modulo,snapshots,inicializacoes,resolver,setDados:v=>{estado=v;}};
}

test('Backup de pasta só inicia após carregar dados confirmados pelo IndexedDB',async()=>{
  const f=preparar();
  assert.equal(f.inicializacoes.length,0);
  f.setDados({transactions:Array.from({length:7},(_,i)=>({id:i})),goals:[]});
  f.resolver({modo:'primario'});
  await new Promise(resolve=>setImmediate(resolve));
  assert.deepEqual(f.inicializacoes,['inicio']);
  assert.deepEqual(f.snapshots,[7]);
});

test('Conflito impede inicialização automática de backup com dados provisórios',async()=>{
  const f=preparar();
  f.resolver({modo:'conflito'});
  await new Promise(resolve=>setImmediate(resolve));
  assert.deepEqual(f.inicializacoes,[]);
  assert.equal(f.elementos['folder-backup-connect'].disabled,true);
  assert.match(f.elementos['folder-backup-status'].textContent,/pausado/);
  f.modulo.retomarAposRecuperacao();
  await new Promise(resolve=>setImmediate(resolve));
  assert.deepEqual(f.inicializacoes,['inicio']);
});
