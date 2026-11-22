const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const read = filename => fs.readFileSync(path.join(__dirname,'..',filename),'utf8');

function emitter(target={}) {
  const listeners=new Map();
  target.addEventListener=(name,listener)=>{
    if (!listeners.has(name)) listeners.set(name,[]);
    listeners.get(name).push(listener);
  };
  target.emit=name=>(listeners.get(name)||[]).forEach(listener=>listener());
  return target;
}

function fakeElement() {
  const states=new Set(['hidden']);
  return emitter({
    textContent:'',dataset:{},disabled:false,
    classList:{
      add:name=>states.add(name),
      remove:name=>states.delete(name),
      contains:name=>states.has(name)
    }
  });
}

function scenario({supported=true,controlled=true,protocol='https:',update}={}) {
  const elements=Object.fromEntries(['check-update','install-update','app-update-status','app-update-alert','app-running-version'].map(id=>[id,fakeElement()]));
  const registration=emitter({waiting:null,installing:null,updateCalls:0,async update(){
    this.updateCalls++;
    if (update) await update();
  }});
  const serviceWorker=emitter({controller:controlled?{}:null,registerCalls:0,async register(file,options){
    assert.equal(file,'./sw.js');
    assert.equal(options.updateViaCache,'none');
    this.registerCalls++;
    return registration;
  }});
  const navigator=supported?{serviceWorker}:{};
  const document=emitter({readyState:'complete',hidden:false,getElementById:id=>elements[id]});
  const window=emitter({location:{reload:()=>{window.reloadCalls++;}},reloadCalls:0,setInterval:()=>0});
  const notifications=[];
  const sandbox={document,window,navigator,location:{protocol},console};
  vm.runInNewContext(`${read('dist/modules/atualizador.js').replace(/^export /gm,'')}\nthis.start=iniciarAtualizador;`,sandbox);
  const updater=sandbox.start({notify:message=>notifications.push(message)});
  return {updater,elements,registration,serviceWorker,document,window,notifications};
}

const flush=()=>new Promise(resolve=>setImmediate(resolve));

test('Primeira instalação não avisa uma atualização inexistente', async () => {
  const app=scenario({controlled:false});
  assert.equal(app.elements['app-running-version'].textContent,'v49');
  assert.equal(app.updater.getStatus().versaoEmExecucao,'v49');
  await flush();
  assert.equal(app.serviceWorker.registerCalls,1);
  assert.equal(app.registration.updateCalls,1);
  const worker=emitter({state:'installing'});
  app.registration.installing=worker;
  app.registration.emit('updatefound');
  worker.state='installed';
  app.registration.waiting=worker;
  worker.emit('statechange');
  assert.equal(app.elements['install-update'].classList.contains('hidden'),true);
  assert.equal(app.notifications.length,0);
});

test('Nova versão avisa sem instalar; apenas o clique solicita ativação e recarrega uma vez', async () => {
  const app=scenario();
  await flush();
  const messages=[];
  const worker=emitter({state:'installing',postMessage:message=>messages.push(message)});
  app.registration.installing=worker;
  app.registration.emit('updatefound');
  worker.state='installed';
  app.registration.waiting=worker;
  worker.emit('statechange');
  assert.equal(app.elements['install-update'].classList.contains('hidden'),false);
  assert.equal(app.elements['app-update-alert'].classList.contains('hidden'),false);
  assert.equal(app.elements['app-update-status'].dataset.state,'ready');
  assert.equal(app.elements['app-running-version'].textContent,'v49','Uma versão aguardando autorização não muda a versão da página');
  assert.equal(app.notifications.length,1);
  assert.equal(messages.length,0);
  app.serviceWorker.emit('controllerchange');
  assert.equal(app.window.reloadCalls,0);
  app.elements['install-update'].emit('click');
  assert.deepEqual(messages.map(message=>message.type),['SKIP_WAITING']);
  assert.equal(app.window.reloadCalls,0);
  app.serviceWorker.emit('controllerchange');
  app.serviceWorker.emit('controllerchange');
  assert.equal(app.window.reloadCalls,1);
});

test('Checagem manual funciona e falha de conexão não apaga o aviso pendente', async () => {
  let offline=false;
  const app=scenario({update:async()=>{if(offline)throw Error('offline');}});
  await flush();
  assert.match(app.elements['app-update-status'].textContent,/versão mais recente/);
  app.elements['check-update'].emit('click');
  await flush();
  assert.equal(app.registration.updateCalls,2);
  offline=true;
  app.elements['check-update'].emit('click');
  await flush();
  assert.equal(app.elements['app-update-status'].dataset.state,'error');
  assert.equal(app.elements['check-update'].disabled,false);
  const worker=emitter({state:'installed',postMessage:()=>{}});
  app.registration.waiting=worker;
  app.elements['check-update'].emit('click');
  assert.equal(app.elements['app-update-status'].dataset.state,'ready');
});

test('Prévia HTML local, Android content: e browsers sem Service Worker não tentam registrar', () => {
  for (const options of [{protocol:'file:'},{protocol:'content:'},{protocol:'blob:'},{supported:false}]) {
    const app=scenario(options);
    assert.equal(app.elements['check-update'].disabled,true);
    assert.equal(app.serviceWorker.registerCalls,0);
    assert.match(app.elements['app-update-status'].textContent,/aplicativo publicado/);
    assert.equal(app.elements['app-running-version'].textContent,'v49','A versão precisa aparecer até no HTML de homologação');
  }
});

test('Versão exibida, cache PWA e relatório usam o mesmo identificador da release',()=>{
  const codigo=read('dist/modules/atualizador.js');
  const sw=read('dist/sw.js');
  const html=read('dist/index.html');
  const css=read('dist/css/ajustes.css');
  const versao=codigo.match(/export const VERSAO_EM_EXECUCAO = '(v\d+)'/)[1];
  assert.equal(sw.match(/const CACHE='meu-dinheiro-essencial-(v\d+)'/)[1],versao);
  assert.match(html,/id="app-running-version"/);
  assert.match(css,/\.app-current-version\{/);
  assert.match(read('dist/modules/diagnostico.js'),/ATUALIZADOR_VERSAO_VISIVEL/);
});

test('Service Worker espera confirmação antes de skipWaiting', async () => {
  const events={};
  let skips=0;
  const scope={
    self:{addEventListener:(name,handler)=>{events[name]=handler;},skipWaiting:()=>{skips++;},clients:{claim:async()=>{}},location:{origin:'https://example.test'}},
    caches:{open:async()=>({addAll:async()=>{}}),keys:async()=>[],delete:async()=>{}},
    fetch:async()=>({ok:true,clone:()=>({})}),URL,Response
  };
  vm.runInNewContext(read('dist/sw.js'),scope);
  let install;
  events.install({waitUntil:promise=>{install=promise;}});
  await install;
  assert.equal(skips,0);
  events.message({data:{type:'OTHER'}});
  assert.equal(skips,0);
  events.message({data:{type:'SKIP_WAITING'}});
  assert.equal(skips,1);
});

test('Registro do Service Worker falho diferencia segurança e rede sem expor dados do erro',async()=>{
  for(const nome of ['SecurityError','TypeError']){
    const events={};const logs=[];
    const button=fakeElement(),state=fakeElement();
    const context={document:{readyState:'complete',getElementById:id=>id==='check-update'?button:id==='app-update-status'?state:fakeElement(),addEventListener:()=>{}},
      window:{addEventListener:()=>{},setInterval:()=>0},navigator:{onLine:true,serviceWorker:{addEventListener:()=>{},register:async()=>{const error=new Error('URL privada, não registrar');error.name=nome;throw error;}}},
      location:{protocol:'https:'}};
    vm.runInNewContext(`${read('dist/modules/atualizador.js').replace(/^export /gm,'')}\nthis.iniciar=iniciarAtualizador;`,context);
    context.iniciar({notify:()=>{},registrar:(...val)=>logs.push(val)});
    await flush();
    assert.equal(logs.filter(v=>v[1].startsWith('PWA_REGISTRO_')).length,1,'A mesma falha não deve gerar registros duplicados');
    assert.ok(logs.some(v=>v[1]=== (nome==='SecurityError'?'PWA_REGISTRO_SEGURANCA':'PWA_REGISTRO_REDE_ARQUIVO')));
    assert.doesNotMatch(JSON.stringify(logs),/URL privada/);
    assert.equal(state.dataset.state,'error');
  }
});
