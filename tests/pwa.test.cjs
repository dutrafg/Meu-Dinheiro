const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.join(__dirname, '..');
const dist = path.join(root, 'dist');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');

test('Vercel publica a pasta dist sem compilação', () => {
  const config = JSON.parse(read('vercel.json'));
  assert.equal(config.outputDirectory, 'dist');
  assert.equal(config.framework, null);
  assert.equal(config.buildCommand, null);
  assert.ok(config.headers.some(item => item.source === '/sw.js'));
});

test('GitHub Pages abre o aplicativo e publica dist como raiz', () => {
  const entry=read('index.html');
  assert.match(entry,/http-equiv="refresh" content="0;url=\.\/dist\/"/);
  assert.match(entry,/window\.location\.replace\(new URL\('\.\/dist\/'/);
  const workflow=read('.github/workflows/pages.yml');
  assert.match(workflow,/actions\/upload-pages-artifact@v4/);
  assert.match(workflow,/path: dist/);
  assert.match(workflow,/actions\/deploy-pages@v4/);
  assert.ok(fs.existsSync(path.join(dist,'index.html')));
});

test('Manifesto PWA, ícones reais e scripts essenciais', () => {
  const manifest = JSON.parse(read('dist/manifest.webmanifest'));
  assert.equal(manifest.display, 'standalone');
  assert.equal(manifest.lang, 'pt-BR');
  assert.equal(manifest.start_url, './');
  assert.equal(manifest.scope, './');
  for (const icon of manifest.icons) {
    const filename=path.join(dist, icon.src.replace(/^\.\//,''));
    const image=fs.readFileSync(filename);
    assert.equal(image.subarray(1,4).toString(),'PNG');
    const [width,height]=icon.sizes.split('x').map(Number);
    assert.equal(image.readUInt32BE(16),width);
    assert.equal(image.readUInt32BE(20),height);
  }
  const html = read('dist/index.html');
  assert.match(html, /rel="manifest" href="\.\/manifest\.webmanifest"/);
  assert.ok(html.indexOf('src="./csv.js"') < html.indexOf('src="./analytics.js"'));
  assert.ok(html.indexOf('src="./analytics.js"') < html.indexOf('src="./app.js"'));
  assert.match(html, /name="viewport"/);
});

test('Análise com dois gráficos aparece somente em Resumo', () => {
  const app=read('dist/app.js');
  const summary=app.split('function renderSummary() {')[1].split('function renderTransactions(type) {')[0];
  const expenses=app.split('function renderTransactions(type) {')[1].split('function renderEntry(t) {')[0];
  assert.equal((summary.match(/renderExpenseCharts\(\)/g)||[]).length,1);
  assert.equal((expenses.match(/renderExpenseCharts\(\)/g)||[]).length,0);
  const css=read('dist/prototype.css');
  assert.match(css,/\.proto-expense-charts\{display:grid/);
  assert.match(css,/\.proto-expense-divider\{/);
  assert.match(css,/@media\(max-width:879px\)/);
});

test('Service worker coloca todos os arquivos offline no cache e muda de versão', () => {
  const source = read('dist/sw.js');
  const assets=JSON.parse(source.match(/const ASSETS=(\[[^\]]+\])/)[1].replaceAll("'",'"'));
  for (const asset of assets) {
    const local=asset==='./'?'index.html':asset.replace(/^\.\//,'');
    assert.ok(fs.existsSync(path.join(dist,local)),`Arquivo PWA ausente: ${local}`);
  }
  assert.ok(assets.includes('./analytics.js'));
  assert.match(source, /meu-dinheiro-essencial-v6/);
});

test('Offline: navegação recupera a página; arquivo inexistente nunca vira HTML', async () => {
  const events={};
  const offlineCache=new Map();
  const htmlResponse={ok:true,status:200,type:'html'};
  offlineCache.set('./index.html',htmlResponse);
  const cache={addAll:async()=>{},put:async()=>{}};
  const context={
    URL,
    self:{location:{origin:'https://meu-dinheiro.vercel.app'},addEventListener:(name,handler)=>{events[name]=handler;},skipWaiting:async()=>{},clients:{claim:async()=>{}}},
    caches:{open:async()=>cache,keys:async()=>[],delete:async()=>{},match:async request=>offlineCache.get(typeof request==='string'?request:request.url)||null},
    fetch:async()=>{throw Error('sem conexão');},
    Response:{error:()=>({status:0,type:'error'})}
  };
  vm.runInNewContext(read('dist/sw.js'),context);
  const call=async (url,mode)=>{
    let pending;
    events.fetch({request:{method:'GET',url,mode},respondWith:promise=>{pending=promise;},waitUntil:()=>{}});
    return pending;
  };
  assert.deepEqual(await call('https://meu-dinheiro.vercel.app/pagina','navigate'),htmlResponse);
  assert.deepEqual(await call('https://meu-dinheiro.vercel.app/foto-inexistente.png','no-cors'),{status:0,type:'error'});
});
