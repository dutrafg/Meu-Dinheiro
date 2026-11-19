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
  assert.match(windows,/\(async \(\) => \{/);
  assert.match(windows,/await window\.MeuDinheiroNativeBridge\.boot\(\)/);
  assert.match(windows,/MeuDinheiroNativeBridge\.stage\(next\)/);
  assert.match(windows,/MeuDinheiroNativeBridge\.persist\(next\)/);
  assert.match(windows,/import \{ iniciarAtualizador \} from '\.\/native-updater\.js'/);
  const backup=fs.readFileSync(path.join(built,'modules/backup.js'),'utf8');
  assert.match(backup,/MeuDinheiroNativeBridge\.createFolderManager/);
  assert.doesNotMatch(windows,/navigator\.serviceWorker\.register/);
  assert.ok(html.indexOf('native-bridge.js')<html.indexOf('app.js'));
  assert.match(html,/<script type="module" src="\.\/app\.js"><\/script>/);
  assert.doesNotMatch(html,/rel="manifest"/);
  assert.ok(fs.existsSync(path.join(built,'icon-512.png')));
  for(const name of ['diagnostico','ajustes','notificacoes','registro-modulos','atualizador','diagnostico-proposta','auditoria-codigo','relatorio-pdf-conteudo']){
    assert.ok(fs.existsSync(path.join(built,`modules/${name}.js`)),`Módulo ausente: ${name}`);
  }
  for(const name of ['native-updater.js','native-style.css','css/ajustes.css','css/responsivo.css']){
    assert.ok(fs.existsSync(path.join(built,name)),`Arquivo ausente: ${name}`);
  }
  assert.throws(()=>replaceOnce('abc','def','g','x'),/Ponto de integração/);
});

function runBridge({db=null, recover=true, failing=false, conflict=false, syncConflict=false}={}) {
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
      if(command==='select_backup_folder')return {folder:'Finanças',conflict};
      if(command==='activate_backup_folder')return {code:conflict&&!args.allowReplace?'conflict':'saved',folder:'Finanças',message:'Conectado'};
      if(command==='sync_backup')return {code:syncConflict?'conflict':'saved',folder:'Finanças',message:'Salvo'};
      if(command==='resolve_backup_conflict')return {code:'saved',folder:'Finanças',message:'Conflito resolvido'};
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

test('Conflitos no backup aguardam confirmação assíncrona antes de sobrescrever',async()=>{
  const f=runBridge({conflict:true,syncConflict:true});await f.bridge.boot();
  let confirmado=false;
  const folder=f.bridge.createFolderManager({confirmReplace:async()=>{await Promise.resolve();return confirmado;},onStatus:()=>{}});
  await folder.initialize();
  assert.equal(await folder.connect(),false);
  assert.equal(f.commands.some(c=>c.command==='activate_backup_folder'),false,'Não deve substituir antes da confirmação');
  confirmado=true;
  assert.equal(await folder.connect(),true);
  assert.equal(f.commands.find(c=>c.command==='activate_backup_folder').args.allowReplace,true);
  confirmado=false;
  assert.equal(await folder.reauthorize(),false);
  assert.equal(f.commands.some(c=>c.command==='resolve_backup_conflict'),false);
  confirmado=true;
  assert.equal(await folder.reauthorize(),true);
  assert.equal(f.commands.filter(c=>c.command==='resolve_backup_conflict').length,1);
});

test('Diagnóstico nativo verifica SQLite e pendências sem expor informações financeiras',async()=>{
  const f=runBridge({db:JSON.stringify(data)});
  const healthy=await f.bridge.diagnosticar();
  assert.deepEqual(JSON.parse(JSON.stringify(healthy)),{ponteOk:true,sqliteOk:true,pendente:false});
  f.bridge.stage(data);
  assert.equal((await f.bridge.diagnosticar()).pendente,true);
  assert.doesNotMatch(JSON.stringify(healthy),/renda|1500|SQLite indisponível/);
});

test('Relatório Windows inspeciona SQLite e dispensa testes exclusivos de Service Worker',async()=>{
  const empty={transactions:[],goals:[],allocations:[],completedAportes:[]};
  const context={Date,Intl,Blob,navigator:{userAgent:'Windows test'},
    window:{MeuDinheiroNativeBridge:{diagnosticar:async()=>({ponteOk:true,sqliteOk:true,pendente:false})}},
    verificarIntegridade:()=>({itens:[],erros:0,avisos:0}),localStorage:{getItem:()=>null},
    preferenciasPadrao:()=>({tema:'auto',cor:'azul'}),
    verificarPropostaInterface:()=>null,
    auditarCodigoPublicado:async()=>({disponivel:false,motivo:'Diagnóstico sem navegador'})};
  const dependencias=['resumo.js','validacao.js'].map(file=>fs.readFileSync(path.join(repo,'dist/modules',file),'utf8').replace(/^export /gm,'')).join('\n');
  const source=fs.readFileSync(path.join(repo,'dist/modules/diagnostico.js'),'utf8').replace(/^import .*$/gm,'').replace(/^export /gm,'');
  vm.runInNewContext(`${dependencias}\n${source}\nthis.gerar=criarRelatorioDiagnostico`,context);
  const report=await context.gerar({getData:()=>empty,CATEGORIES:{income:[],expense:[]}});
  assert.equal(report.ambiente.plataforma,'windows-nativo');
  assert.equal(report.atualizador.metodo,'instalador-windows');
  assert.ok(report.integridade.itens.filter(i=>i.codigo.startsWith('WINDOWS_')).every(i=>i.estado==='ok'));
  assert.ok(!report.integridade.itens.some(i=>i.codigo==='SW_ATIVO'||i.codigo==='CACHE_PWA'));
});

test('Atualizador Windows informa uso do instalador sem ativar Service Worker',()=>{
  const elements=new Map();
  for(const id of ['app-update-status','check-update','install-update','app-update-alert','app-running-version'])
    elements.set(id,{textContent:'',dataset:{},disabled:false,title:'',classList:{add:()=>{}}});
  const context={document:{getElementById:id=>elements.get(id)}};
  vm.runInNewContext(fs.readFileSync(path.join(repo,'desktop/native-updater.js'),'utf8').replace(/^export /gm,'')+'\nthis.iniciar=iniciarAtualizador;',context);
  const updater=context.iniciar();
  assert.equal(updater.getStatus().metodo,'instalador-windows');
  assert.equal(updater.getStatus().versaoEmExecucao,'v24');
  assert.match(elements.get('app-running-version').textContent,/Windows 0\.3\.0/);
  assert.equal(elements.get('check-update').disabled,true);
  assert.match(elements.get('app-update-status').textContent,/instaladas com o arquivo \.exe/);
});

test('Configuração Windows gera instalador x64 com ícone e janela ajustável',()=>{
  const config=JSON.parse(fs.readFileSync(path.join(repo,'desktop/src-tauri/tauri.conf.json'),'utf8'));
  assert.ok(config.bundle.targets.includes('nsis'));
  assert.ok(config.app.withGlobalTauri);
  assert.equal(config.identifier,'br.com.dutrafg.meudinheiro','Mesmo identificador preserva o diretório SQLite de versões anteriores');
  assert.ok(config.app.windows[0].minWidth<=390);
  assert.ok(fs.existsSync(path.join(repo,'dist/icon-512.png')));
  assert.match(JSON.parse(fs.readFileSync(path.join(repo,'desktop/package.json'),'utf8')).scripts.icons,/tauri icon/);
  assert.equal(config.version,'0.3.0');
  assert.match(fs.readFileSync(path.join(repo,'desktop/src-tauri/Cargo.toml'),'utf8'),/^version = "0\.3\.0"/m);
});
