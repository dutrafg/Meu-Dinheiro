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
  assert.match(html, /<script type="module" src="\.\/app\.js"><\/script>/);
  const app=read('dist/app.js');
  const moduleImports=app+'\n'+read('dist/modules/diagnostico.js')+'\n'+read('dist/modules/relatorio-pdf.js');
  for(const dependency of ['csv.js','analytics.js','folder-backup.js',
    'modules/resumo.js','modules/saude.js','modules/notificacoes.js','modules/relatorio-pdf-conteudo.js','modules/relatorio-pdf.js','modules/lancamentos.js','modules/objetivos.js','modules/backup.js','modules/csv-interface.js','modules/validacao.js','modules/atualizador.js','modules/dialogos.js','modules/diagnostico.js','modules/diagnostico-proposta.js','modules/integridade.js','modules/log.js','modules/preferencias.js','modules/regras-financeiras.js','modules/ajustes.js','modules/catalogo-diagnostico.js','modules/registro-modulos.js']) {
    assert.ok(moduleImports.includes(`from './${dependency}'`)||moduleImports.includes(`import './${dependency}'`)||
      moduleImports.includes(`from './${dependency.replace('modules/','')}'`),`Import ausente: ${dependency}`);
  }
  assert.match(html, /id="folder-backup-connect"/);
  assert.match(html, /id="folder-backup-reconnect"/);
  assert.match(html, /id="check-update"/);
  assert.match(html, /id="install-update" class="hidden"/);
  assert.match(html, /id="app-update-alert" class="app-update-alert hidden"/);
  assert.match(html, /id="diagnostics-dialog"/);
  assert.match(html, /id="confirmation-dialog"/);
  assert.match(html, /id="transaction-recurring-warning"/);
  assert.match(html, /id="settings-page"/);
  assert.match(html, /id="diagnostics-progress"/);
  assert.match(html, /rel="apple-touch-icon"/);
  assert.match(html, /name="viewport"/);
});

test('Análise com dois gráficos aparece somente em Resumo', () => {
  const summary=read('dist/modules/resumo.js').split('function renderSummary() {')[1];
  const expenses=read('dist/modules/lancamentos.js');
  assert.equal((summary.match(/renderExpenseCharts\(\)/g)||[]).length,1);
  assert.equal((expenses.match(/renderExpenseCharts\(\)/g)||[]).length,0);
  const css=read('dist/css/resumo.css')+read('dist/css/responsivo.css');
  assert.match(css,/\.proto-expense-charts\{display:grid/);
  assert.match(css,/\.proto-expense-divider\{/);
  assert.match(css,/@media\(max-width:879px\)/);
});

test('Meta e sonho mostram barra proporcional, porcentagem e ações padronizadas', () => {
  const app=read('dist/modules/objetivos.js');
  const percent=app.split('function goalProgressPercent(goal) {')[1].split('function progressLine(goal) {')[0];
  const dominio=read('dist/modules/dominio-objetivos.js').replace(/^export /gm,'');
  const renderer=app.split('function renderGoal(g) {')[1].split('function openGoal(kind,id=')[0];
  const sandbox={
    money:value=>`R$ ${Number(value).toFixed(2)}`,
    esc:value=>String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;'),
    n2:value=>Math.round(value*100)/100,
    icon:()=>'<svg></svg>',
    parseDate:value=>new Date(`${value}T00:00:00Z`),
    fmtDate:{format:()=> '30 nov. 2026'}
  };
  vm.runInNewContext(`${dominio}\nfunction goalProgressPercent(goal) {${percent}function renderGoal(g) {${renderer}this.renderGoal=renderGoal;this.goalProgressPercent=goalProgressPercent;`,sandbox);
  const makeGoal=(kind,saved,target=100)=>({id:`id-${kind}`,kind,name:kind==='goal'?'Reserva':'Carro',target,saved,deadline:''});
  for(const kind of ['goal','dream']){
    for(const [saved,expected] of [[0,0],[25,25],[100,100],[150,100]]){
      const html=sandbox.renderGoal(makeGoal(kind,saved));
      assert.match(html,new RegExp(`role="progressbar"[^>]*aria-valuenow="${expected}"`));
      assert.match(html,new RegExp(`class="proto-goal-fill progress-bar-fill" style="width:${expected}%"`));
      assert.match(html,new RegExp(`>${expected}%</strong>`));
      assert.match(html,/data-action="edit-goal"/);
      assert.match(html,/data-action="delete-goal"/);
      assert.match(html,/class="button button-secondary"/);
    }
  }
  assert.equal(sandbox.goalProgressPercent(makeGoal('goal',10,0)),0);
  assert.equal(sandbox.goalProgressPercent(makeGoal('goal',50,200)),25);
  const css=read('dist/css/resumo.css')+read('dist/css/objetivos.css')+read('dist/css/responsivo.css');
  assert.match(css,/\.proto-goal-track\{[^}]*width:100%/);
  assert.match(css,/\.proto-progress \.bar\{width:100%/);
  assert.match(css,/\.proto-goal-card\.dream\{--goal-accent:var\(--purple\)/);
  assert.match(app,/proto-goals-grid\$\{goals\.length===1\?' single':''\}/);
  assert.match(css,/\.proto-goals-grid\.single\{grid-template-columns:minmax\(0,1fr\)\}/);
  assert.match(css,/@media\(max-width:879px\)[\s\S]*\.proto-goals-grid\{grid-template-columns:1fr\}/);
});

test('Log detalhado inicia automaticamente sem registrar dados financeiros', () => {
  const app=read('dist/app.js');
  const ativacao=app.indexOf('configurarDetalhado(true);');
  const inicializacao=app.indexOf("registrarEvento('SESSAO_INICIADA','sistema');");
  const leitura=app.indexOf('let data = readData();');
  assert.ok(ativacao>=0&&ativacao<inicializacao&&inicializacao<leitura,
    'A telemetria precisa ser habilitada antes de ler dados locais');
  const logger=read('dist/modules/log.js');
  assert.match(logger,/const MAXIMO = 50;/);
  assert.match(logger,/sessionStorage\.setItem\(CHAVE,JSON\.stringify\(buffer\)\)/);
});

test('Exclusão protegida usa tombstone e inicialização vazia em todo PWA', () => {
  const app=read('dist/app.js');
  const espelho=read('dist/modules/espelho-indexeddb.js');
  const diagnostico=read('dist/modules/diagnostico.js');
  assert.match(read('dist/modules/repositorio-financeiro.js'),/espelho\.iniciarVazio\(\)/);
  assert.match(app,/repositorio\.gravar\(serializado\)/);
  assert.match(app,/guardaConcorrencia\.podeGravar\(\)/);
  assert.match(espelho,/apagado:true,marcador/);
  assert.match(diagnostico,/exclusaoProtegida:Boolean\(estadoEspelho\.exclusaoProtegida\)/);
});

test('Recuperação assistida exige inspeção, dois backups e seleção com dupla confirmação', () => {
  const html=read('dist/index.html');
  const app=read('dist/app.js');
  const modulo=read('dist/modules/recuperacao-conflitos.js');
  for(const id of ['recovery-inspect','recovery-status','recovery-local-summary',
    'recovery-indexeddb-summary','recovery-download-local','recovery-download-indexeddb',
    'recovery-choice','recovery-apply'])
    assert.match(html,new RegExp('id="'+id+'"'));
  assert.match(app,/iniciarRecuperacaoConflitos\(/);
  assert.match(modulo,/obterCopiaParaRecuperacao\(\)/);
  assert.match(modulo,/montarBackupRecuperacao/);
  const leitura=modulo.slice(modulo.indexOf('async function inspecionar()'),
    modulo.indexOf('async function recuperar()'));
  assert.doesNotMatch(leitura,/\.setItem\(|\.removeItem\(|\.clear\(|\.put\(|\.delete\(/);
  assert.match(modulo,/recuperarComEscolha\(/);
  assert.equal((modulo.match(/await confirmar\(/g)||[]).length,2);
  assert.match(read('dist/sw.js'),/\.\/modules\/recuperacao-conflitos\.js/);
});

test('Objetivos têm controles visíveis para alternar entre reserva e sonhos', () => {
  const objetivos=read('dist/modules/objetivos.js');
  const app=read('dist/app.js');
  const css=read('dist/css/objetivos.css');
  assert.match(objetivos,/data-objective-tab="goal"/);
  assert.match(objetivos,/data-objective-tab="dream"/);
  assert.match(objetivos,/role="group" aria-label="Tipo de objetivo"/);
  assert.match(objetivos,/aria-pressed=/);
  assert.match(app,/objectiveTab\.dataset\.objectiveTab/);
  assert.match(css,/\.objective-kind-button:focus-visible/);
});

test('Service worker coloca todos os arquivos offline no cache e muda de versão', () => {
  const source = read('dist/sw.js');
  const assets=JSON.parse(source.match(/const ASSETS=(\[[^\]]+\])/)[1].replaceAll("'",'"'));
  for (const asset of assets) {
    const local=asset==='./'?'index.html':asset.replace(/^\.\//,'');
    assert.ok(fs.existsSync(path.join(dist,local)),`Arquivo PWA ausente: ${local}`);
  }
  assert.ok(assets.includes('./analytics.js'));
  assert.match(source, /meu-dinheiro-essencial-v65/);
  assert.ok(assets.includes('./folder-backup.js'));
  assert.ok(assets.includes('./modules/csv-interface.js'));
  assert.ok(assets.includes('./modules/atualizador.js'));
  for (const name of ['log','integridade','diagnostico','dialogos']) assert.ok(assets.includes(`./modules/${name}.js`));
  assert.ok(assets.includes('./css/responsivo.css'));
  assert.ok(assets.includes('./css/progresso.css'));
  assert.ok(assets.includes('./modules/diagnostico-proposta.js'));
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
