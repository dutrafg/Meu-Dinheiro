const assert=require('node:assert/strict');
const test=require('node:test');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'../dist/app.js'),'utf8');

function simular(){
  const eventos=[];const estados=new Map();
  const classList=(nome,initial=[])=>{
    const set=new Set(initial);estados.set(nome,set);
    return {contains:k=>set.has(k),add:k=>set.add(k),remove:k=>set.delete(k),
      toggle:(k,forcar)=>{if(forcar===undefined?set.has(k):!forcar)set.delete(k);else set.add(k);}};
  };
  const criar=(id,classes=[])=>({id,classList:classList(id,classes),innerHTML:'',textContent:'',dataset:{},setAttribute(){}});
  const elementos=new Map([
    ['desktop-nav',criar('desktop-nav')],['mobile-nav',criar('mobile-nav')],
    ['header-label',criar('header-label')],['header-balance',criar('header-balance')],
    ['quick-add',criar('quick-add')],['desktop-create-wrap',criar('desktop-create-wrap')],['settings-page',criar('settings-page',['hidden'])],
    ['view-content',criar('view-content')],['folder-backup-alert',criar('folder-backup-alert',['hidden'])],
    ['app-update-alert',criar('app-update-alert',['hidden'])]
  ]);
  const navBotoes=['resumo','renda','despesas','metas','ajustes'].map(nome=>({dataset:{view:nome},classList:classList(`nav-${nome}`),setAttribute(){}}));
  const dots=[criar('dot1',['hidden']),criar('dot2',['hidden'])];
  const document={body:{dataset:{}},getElementById:id=>elementos.get(id),querySelectorAll:selector=>selector==='.nav-button'?navBotoes:dots};
  const variables={view:'resumo',objectiveKind:'goal',search:'',filterCategory:'',month:'2026-11',
    NAV:[['resumo','Resumo','chart-pie'],['renda','Renda','wallet'],['despesas','Despesas','receipt'],['metas','Objetivos','target'],['ajustes','Ajustes','settings']],
    document,window:{scrollTo:()=>eventos.push('rolar')},viewContent:elementos.get('view-content'),settingsPage:elementos.get('settings-page'),
    ajustes:{abrir:()=>eventos.push('abrir'),concluirEdicao:()=>eventos.push('concluirEdicao')},
    renderReminderCount:()=>{},sums:()=>({balance:100}),money:n=>`R$ ${n}`,
    renderSummary:()=>'<div>Resumo</div>',renderTransactions:tipo=>`<div>${tipo}</div>`,renderGoals:kind=>`<div>${kind}</div>`,
    icon:n=>`<svg>${n}</svg>`,
    acaoRapida:{atualizar:visao=>{
      elementos.get('quick-add').classList.toggle('hidden',visao==='ajustes');
      elementos.get('desktop-create-wrap').classList.toggle('hidden',visao==='ajustes');
    }}};
  const nav=source.slice(source.indexOf('  function changeView(next) {'),source.indexOf('  function header(subtitle'));
  const render=source.slice(source.indexOf('  function render() {'),source.indexOf('  // Os módulos recebem'));
  vm.runInNewContext(`${nav}\n${render}\nthis.acao={changeView,renderNav,render,sincronizarAlertasNav};`,variables);
  return {api:variables.acao,elementos,eventos,estados,variables,dots};
}

test('Cinco rotas internas sem módulo Sonho duplicado e com destino Objetivos',()=>{
  const t=simular();t.api.renderNav();t.api.render();
  for(const id of ['desktop-nav','mobile-nav'])assert.match(t.elementos.get(id).innerHTML,/data-view="ajustes"/);
  assert.match(t.elementos.get('desktop-nav').innerHTML,/data-view="metas"[^>]+>.*Objetivos/);
  assert.doesNotMatch(t.elementos.get('desktop-nav').innerHTML,/data-view="sonho"/);
  assert.match(t.elementos.get('view-content').innerHTML,/Resumo/);
  assert.equal(t.elementos.get('settings-page').classList.contains('hidden'),true);
});

test('Abrir Ajustes esconde FAB e não desfaz as preferências ao mudar de área',()=>{
  const t=simular();t.api.render();const settings=t.elementos.get('settings-page');
  t.api.changeView('ajustes');
  assert.equal(settings.classList.contains('hidden'),false);
  assert.equal(t.elementos.get('view-content').classList.contains('hidden'),true);
  assert.equal(t.elementos.get('quick-add').classList.contains('hidden'),true);
  assert.equal(t.elementos.get('desktop-create-wrap').classList.contains('hidden'),true);
  assert.ok(t.eventos.includes('abrir'));
  t.api.changeView('despesas');
  assert.equal(settings.classList.contains('hidden'),true);
  assert.equal(t.elementos.get('quick-add').classList.contains('hidden'),false);
  assert.equal(t.elementos.get('desktop-create-wrap').classList.contains('hidden'),false);
  assert.match(t.elementos.get('view-content').innerHTML,/expense/);
  assert.ok(t.eventos.includes('concluirEdicao'));
  assert.equal(t.variables.view,'despesas');
});

test('Alertas de backup e PWA são espelhados nos indicadores da aba Ajustes',()=>{
  const t=simular();t.api.renderNav();
  assert.ok(t.dots.every(dot=>dot.classList.contains('hidden')));
  t.elementos.get('folder-backup-alert').classList.remove('hidden');t.api.sincronizarAlertasNav();
  assert.ok(t.dots.every(dot=>!dot.classList.contains('hidden')));
  t.elementos.get('folder-backup-alert').classList.add('hidden');t.api.sincronizarAlertasNav();
  assert.ok(t.dots.every(dot=>dot.classList.contains('hidden')));
  t.elementos.get('app-update-alert').classList.remove('hidden');t.api.sincronizarAlertasNav();
  assert.ok(t.dots.every(dot=>!dot.classList.contains('hidden')));
});

test('Navegação rejeita área inexistente e mantém o resumo',()=>{
  const t=simular();t.api.render();t.api.changeView('area-inexistente');
  assert.equal(t.variables.view,'resumo');
  assert.match(t.elementos.get('view-content').innerHTML,/Resumo/);
  assert.ok(!t.eventos.includes('concluirEdicao'));
});

test('Rota antiga Sonho abre a aba interna sem criar novo módulo de navegação',()=>{
  const t=simular();t.api.changeView('sonho');
  assert.equal(t.variables.view,'metas');
  assert.equal(t.variables.objectiveKind,'dream');
  assert.match(t.elementos.get('view-content').innerHTML,/dream/);
  assert.equal(t.elementos.get('header-label').textContent,'Objetivos');
});
