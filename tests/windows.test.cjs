const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const {prepare,replaceOnce} = require('../desktop/scripts/prepare-frontend.cjs');

const repo = path.resolve(__dirname, '..');
const source = path.join(repo, 'dist');
const built = path.join(repo, 'desktop/frontend');

test('Frontend Windows é gerado sem modificar o PWA online', () => {
  const original = fs.readFileSync(path.join(source,'app.js'),'utf8');
  prepare();
  assert.equal(fs.readFileSync(path.join(source,'app.js'),'utf8'),original);
  const windows = fs.readFileSync(path.join(built,'app.js'),'utf8');
  const html = fs.readFileSync(path.join(built,'index.html'),'utf8');
  assert.match(windows,/^\(async \(\) => \{/);
  assert.match(windows,/await window\.MeuDinheiroNativeBridge\.boot\(\)/);
  assert.match(windows,/MeuDinheiroNativeBridge\.stage\(next\)/);
  assert.match(windows,/MeuDinheiroNativeBridge\.persist\(next\)/);
  assert.match(windows,/MeuDinheiroNativeBridge\.createFolderManager/);
  assert.doesNotMatch(windows,/navigator\.serviceWorker\.register/);
  assert.ok(html.indexOf('native-bridge.js')<html.indexOf('app.js'));
  assert.doesNotMatch(html,/rel="manifest"/);
  assert.ok(fs.existsSync(path.join(built,'icon-512.png')));
  assert.throws(()=>replaceOnce('abc','def','g','x'),/Ponto de integração/);
});

function runBridge({db=null, recover=true, failing=false}={}) {
  const values = new Map();
  const commands=[];
  const localStorage={
    getItem:k=>values.get(k)??null,
    setItem:(k,v)=>values.set(k,String(v)),
    removeItem:k=>values.delete(k)
  };
  const window={
    confirm:()=>recover,
    __TAURI__:{core:{invoke:async(command,args)=>{
      commands.push({command,args});
      if(command==='load_data')return db;
      if(command==='save_data') {
        if(failing)throw Error('SQLite indisponível');
        db=args.payload;
        return {code:'off',folder:'',message:'Pasta ainda não selecionada'};
      }
      if(command==='backup_status')return {code:'off',folder:'',message:'Pasta ainda não selecionada'};
      if(command==='select_backup_folder')return {folder:'Finanças',conflict:false};
      if(command==='activate_backup_folder')return {code:'saved',folder:'Finanças',message:'Conectado'};
      if(command==='sync_backup')return {code:'saved',folder:'Finanças',message:'Salvo'};
      return null;
    }}}
  };
  const elements=new Map();
  const document={
    getElementById:id=>elements.get(id)||null,
    createElement:()=>({setAttribute(){},remove(){elements.delete('native-storage-alert');}}),
    body:{appendChild:element=>elements.set('native-storage-alert',element)}
  };
  const context={window,localStorage,document,console:{error:()=>{}}};
  vm.runInNewContext(fs.readFileSync(path.join(repo,'desktop/native-bridge.js'),'utf8'),context);
  return {bridge:window.MeuDinheiroNativeBridge,values,commands,elements,readDb:()=>db};
}

const data={transactions:[{id:'renda',amount:1500}],goals:[],allocations:[],completedAportes:[]};
const key='meu-dinheiro-essencial:v1';
const pending='meu-dinheiro-windows:pendente';

test('Inicia pelo SQLite e ignora dados antigos do cache',async()=>{
  const f=runBridge({db:JSON.stringify(data)});
  f.values.set(key,JSON.stringify({...data,transactions:[]}));
  await f.bridge.boot();
  assert.deepEqual(JSON.parse(f.values.get(key)),data);
  assert.equal(f.commands.filter(c=>c.command==='save_data').length,0);
});

test('Importa uma cópia antiga apenas quando o banco ainda está vazio',async()=>{
  const f=runBridge();f.values.set(key,JSON.stringify(data));
  await f.bridge.boot();
  assert.equal(f.readDb(),JSON.stringify(data));
});

test('Marcação de pendência é removida somente após salvar no SQLite',async()=>{
  const f=runBridge();await f.bridge.boot();
  f.bridge.stage(data);
  assert.equal(f.values.get(pending),JSON.stringify(data));
  await f.bridge.persist(data);
  assert.equal(f.values.has(pending),false);
  assert.equal(f.readDb(),JSON.stringify(data));
});

test('Escrita com erro conserva estado pendente e mostra alerta',async()=>{
  const f=runBridge({failing:true});await f.bridge.boot();
  f.bridge.stage(data);await f.bridge.persist(data);
  assert.equal(f.values.get(pending),JSON.stringify(data));
  assert.ok(f.elements.has('native-storage-alert'));
});

test('Reiniciar oferece recuperar gravação ainda pendente',async()=>{
  const f=runBridge({db:JSON.stringify({...data,transactions:[]})});
  f.values.set(pending,JSON.stringify(data));
  await f.bridge.boot();
  assert.equal(f.readDb(),JSON.stringify(data));
  assert.equal(f.values.has(pending),false);
});

test('Dados quebrados no SQLite bloqueiam inicialização sem apagar o cache',async()=>{
  const f=runBridge({db:'{"transactions":42}'});
  f.values.set(key,JSON.stringify(data));
  await assert.rejects(f.bridge.boot(),/incompatíveis/);
  assert.equal(f.values.get(key),JSON.stringify(data));
  assert.equal(f.commands.filter(c=>c.command==='save_data').length,0);
});

test('Gerenciador de pastas usa diálogo nativo e status visível',async()=>{
  const f=runBridge();await f.bridge.boot();
  const statuses=[];
  const folder=f.bridge.createFolderManager({confirmReplace:()=>true,onStatus:status=>statuses.push(status)});
  await folder.initialize();
  assert.equal(await folder.connect(),true);
  assert.equal(folder.getState().folder,'Finanças');
  assert.equal(await folder.reauthorize(),true);
  assert.equal(statuses.at(-1).code,'saved');
});

test('Configuração Windows gera instalador x64 com ícone e janela ajustável',()=>{
  const config=JSON.parse(fs.readFileSync(path.join(repo,'desktop/src-tauri/tauri.conf.json'),'utf8'));
  assert.ok(config.bundle.targets.includes('nsis'));
  assert.ok(config.app.withGlobalTauri);
  assert.ok(config.app.windows[0].minWidth<=390);
  assert.ok(fs.existsSync(path.join(repo,'dist/icon-512.png')));
  assert.match(JSON.parse(fs.readFileSync(path.join(repo,'desktop/package.json'),'utf8')).scripts.icons,/tauri icon/);
});
