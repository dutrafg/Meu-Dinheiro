const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const os=require('node:os');
const {execFileSync}=require('node:child_process');
const vm=require('node:vm');
const root=path.resolve(__dirname,'..');
const read=name=>fs.readFileSync(path.join(root,name),'utf8');

test('Imagem dos objetivos vira uma rota única com duas abas e sem segundo item na navegação',()=>{
  const code=read('dist/app.js');
  const overlay=read('preview-v32/design.js');
  assert.match(code,/\['metas', 'Objetivos', 'target'\]/);
  assert.doesNotMatch(code,/\['sonho', 'Sonho',/);
  assert.match(code,/objectiveKind = 'goal'/);
  assert.match(code,/data-objective-tab/);
  assert.match(overlay,/data-objective-tab="goal"/);
  assert.match(overlay,/data-objective-tab="dream"/);
});

test('Menu Mais não duplica calendário, sonhos, relatórios ou diagnóstico',()=>{
  const code=read('preview-v32/design.js');
  const menu=code.match(/<div class=\\"design-more-list\\">[\s\S]*?<\/div>`;/)||code.match(/<div class="design-more-list">[\s\S]*?<\/div>`;/);
  assert.ok(menu);
  assert.equal((menu[0].match(/data-design-open=/g)||[]).length,1);
  assert.match(menu[0],/data-design-open="settings"/);
  assert.doesNotMatch(menu[0],/data-design-open="calendar"|data-design-open="diagnostics"/);
});

test('Relatórios têm tela própria e o calendário fica acessível pelo Resumo',()=>{
  const html=read('dist/index.html');
  const app=read('dist/app.js');
  const reports=html.slice(html.indexOf('<section id="reports-page"'),html.indexOf('<section id="settings-page"'));
  const settings=html.slice(html.indexOf('<section id="settings-page"'),html.indexOf('</main>'));
  for(const id of ['export-pdf','export-csv','import-csv','export-data','import-data'])assert.ok(reports.includes(`id="${id}"`),id);
  for(const id of ['check-update','open-diagnostics','delete-all-data'])assert.ok(settings.includes(`id="${id}"`),id);
  assert.doesNotMatch(settings,/id="export-pdf"|id="export-csv"|id="import-csv"|id="export-data"|id="import-data"/);
  assert.doesNotMatch(html,/data-open-calendar-settings/);
  assert.match(app,/data-view=\"relatorios\"|\['relatorios', 'Relatórios'/);
  assert.match(html,/details class="settings-section settings-danger-zone"/);
});

test('Preferências são salvas automaticamente sem botões redundantes',()=>{
  const markup=read('dist/index.html');
  const behavior=read('dist/modules/ajustes.js');
  assert.doesNotMatch(markup,/settings-save-top|settings-form-cancel|settings-cancel/);
  assert.match(behavior,/form\.addEventListener\('change',salvarAutomaticamente\)/);
  assert.match(behavior,/setTimeout\(salvarAutomaticamente,500\)/);
  assert.match(behavior,/gestor\.salvar\(prefs\)/);
});

test('Orçamento salva ao alterar campo, respeita limites e bloqueio entre abas',()=>{
  const source=read('preview-v33/ui/orcamento-previsao.js');
  assert.match(source,/saveBudgetForm\(\{preventDefault\(\)\{\},target:event\.target\.closest\('form'\)\},true\)/);
  assert.match(source,/budgetStore\.save\(next\)/);
  assert.match(source,/budgets\.toCent\(value\)/);
  assert.match(source,/if \(removed\.length && !window\.confirm/);
  assert.doesNotMatch(source,/id="design-v33-budget-reset"/);
  assert.doesNotMatch(source,/type="submit" class="button button-primary">Salvar limites/);
});

test('Rota antiga de Sonhos continua reconhecida sem voltar a duplicar a navegação',()=>{
  const source=read('preview-v33/ui/navegacao-hash.js');
  assert.match(source,/sonhos/);
  assert.match(source,/objetivos:'metas'/);
  assert.match(source,/routeCount:Object\.keys\(routeToView\)\.length/);
});

test('Orientação de objetivos calcula o aporte mensal real quando existe prazo',()=>{
  const content={querySelector:()=>null};
  const sandbox={window:{},document:{getElementById:()=>content},localStorage:{getItem:()=>null},MutationObserver:class{observe(){}},Intl,Date};
  vm.runInNewContext(read('preview-v35/ui/objetivos-minimos.js'),sandbox);
  const guidance=sandbox.window.MeuDinheiroV35Objetivos.guidance;
  const goal={target:1000,saved:700,deadline:'2027-01-30'};
  const result=guidance(goal,'2026-11-21');
  assert.equal(result.status,'Em andamento');
  assert.match(result.monthly,/100,00/);
  assert.equal(guidance({...goal,saved:1000},'2026-11-21').status,'Concluído');
  assert.equal(guidance({...goal,deadline:'2026-10-01'},'2026-11-21').status,'Prazo vencido');
  assert.match(guidance({...goal,deadline:''},'2026-11-21').monthly,/Defina um prazo/);
});

test('Objetivos mantêm investimento editável e planejamento recolhível',()=>{
  const src=read('preview-v35/ui/objetivos-minimos.js');
  assert.match(src,/data-action="edit-investment"/);
  assert.match(src,/v35-plan-detail/);
  assert.match(src,/localStorage\.getItem/);
  assert.doesNotMatch(src,/localStorage\.setItem/);
});

test('Ajustes agrupam aparência, aporte, orçamento, privacidade e ferramentas',()=>{
  const src=read('preview-v35/ui/ajustes-minimos.js');
  for(const key of ['Aparência','Planejamento do aporte','Orçamento por categoria','Privacidade','settings-tools'])assert.ok(src.includes(key));
  assert.match(src,/Prévia visual v35 · motor/);
  assert.doesNotMatch(src,/localStorage\.setItem/);
});

test('Visual mínimo respeita temas, toque e redução de movimento',()=>{
  const css=read('preview-v35/ui/styles.css');
  assert.match(css,/var\(--text\)/);
  assert.match(css,/var\(--sub\)/);
  assert.match(css,/min-height:48px/);
  assert.match(css,/@media\(max-width:599px\)/);
  assert.match(css,/@media\(prefers-reduced-motion:reduce\)/);
});

test('Diagnóstico v35 registra cada melhoria sem alterar dados financeiros',()=>{
  const src=read('preview-v35/ui/diagnostico.js');
  const ids=[...src.matchAll(/\['(V35_[A-Z0-9_]+)'/g)].map(match=>match[1]);
  assert.ok(ids.length>=15);
  assert.equal(ids.length,new Set(ids).size);
  for(const id of ['V35_OBJETIVOS','V35_MAIS','V35_LIMITES_AUTO','V35_CRIAR_SONHO','V35_INVESTIR_CELULAR','V35_SEM_ALTERAR_DADOS'])assert.ok(ids.includes(id));
  assert.match(src,/25 segundos/);
  assert.doesNotMatch(src,/localStorage\.setItem/);
});

test('HTML completo v35 compila todos os scripts novos sem arquivos externos',()=>{
  const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'meu-dinheiro-v35-'));
  try{
    const output=path.join(tmp,'test.html');
    execFileSync(process.execPath,[path.join(root,'scripts/gerar-html-design-v35.cjs'),output]);
    const html=fs.readFileSync(output,'utf8');
    assert.match(html,/Meu Dinheiro — v35 Objetivos e Ajustes Clean/);
    assert.match(html,/id="design-v35-css"/);
    assert.doesNotMatch(html,/<script\s+src=/);
    for(const file of ['ajustes-minimos.js','objetivos-minimos.js','diagnostico.js']){
      const block=html.match(new RegExp(`<script data-preview-v35="ui/${file.replaceAll('.','\\.')}"\\s*>\\n([\\s\\S]*?)<\\/script>`));
      assert.ok(block,file);assert.doesNotThrow(()=>new vm.Script(block[1],{filename:file}));
    }
    assert.match(html,/v35-diagnostic-panel/);
  }finally{fs.rmSync(tmp,{recursive:true,force:true});}
});
