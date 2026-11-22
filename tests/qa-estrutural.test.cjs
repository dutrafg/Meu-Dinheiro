const assert=require('node:assert/strict');
const test=require('node:test');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const arquivos=fs.readdirSync(path.join(root,'dist/modules')).filter(n=>n.endsWith('.js')).map(n=>`dist/modules/${n}`);

test('HTML tem IDs únicos e cada API de elemento fixo encontra seu componente',()=>{
  const html=read('dist/index.html');
  const ids=[...html.matchAll(/\bid="([A-Za-z][\w-]*)"/g)].map(m=>m[1]);
  assert.equal(new Set(ids).size,ids.length,'IDs duplicados na estrutura HTML');
  const source=arquivos.map(read).join('\n')+'\n'+read('dist/app.js');
  const referenced=[...source.matchAll(/getElementById\('([^']+)'\)/g)].map(m=>m[1]);
  for(const id of referenced){
    assert.ok(ids.includes(id)||source.includes(`id="${id}"`),`Componente ${id} referenciado, mas não declarado`);
  }
  assert.equal((html.match(/<main\b/g)||[]).length,1);
  assert.equal((html.match(/<meta name="viewport"/g)||[]).length,1);
});

test('Arquivos CSS e JS continuam separados, publicados e incluídos no HTML único',()=>{
  const css=read('dist/prototype.css');
  const sw=read('dist/sw.js');
  const standalone=read('scripts/gerar-html-teste.cjs');
  for(const [,filename] of css.matchAll(/@import url\("\.\/([^"\s]+)"\);/g)){
    assert.ok(fs.existsSync(path.join(root,'dist',filename)),`CSS ausente: ${filename}`);
    assert.ok(sw.includes(`'./${filename}'`),`CSS não está no cache: ${filename}`);
    assert.ok(standalone.includes(`'${filename}'`),`CSS não está no HTML único: ${filename}`);
  }
  for(const file of arquivos){
    const name=file.replace(/^dist\//,'');
    assert.ok(sw.includes(`'./${name}'`),`Módulo não está no cache: ${name}`);
    assert.ok(standalone.includes(`'${name}'`),`Módulo não está no HTML único: ${name}`);
  }
});

test('Todos os destaques com texto branco têm contraste WCAG AA mínimo',()=>{
  const prefs=read('dist/modules/preferencias.js');
  const body=prefs.match(/export const CORES = Object\.freeze\(\{([^}]+)\}\)/)[1];
  const colors=[...body.matchAll(/\w+:'(#[0-9a-fA-F]{6})'/g)].map(m=>m[1]);
  assert.equal(colors.length,6);
  const luminancia=hex=>{
    const rgb=[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);
    return rgb[0]*.2126+rgb[1]*.7152+rgb[2]*.0722;
  };
  for(const cor of colors)assert.ok(1.05/(luminancia(cor)+.05)>=4.5,`Contraste insuficiente: ${cor}`);
  const claro=luminancia('#17181c'),branco=luminancia('#ffffff');
  const escuro=luminancia('#131417'),texto=luminancia('#f0f1f3');
  assert.ok((branco+.05)/(claro+.05)>=7);
  assert.ok((texto+.05)/(escuro+.05)>=7);
});

test('Layout pequeno empilha os indicadores e impressão preserva contraste no escuro',()=>{
  assert.match(read('dist/css/saude.css'),/@media\(max-width:620px\)\{\.saude-grid\{grid-template-columns:1fr/);
  assert.match(read('dist/css/ajustes.css'),/\.settings-heading\{position:sticky/);
  const print=read('dist/css/impressao.css');
  assert.match(print,/:root\[data-theme\],:root\{color-scheme:light/);
  assert.match(print,/print-color-adjust:exact/);
  assert.match(print,/break-inside:avoid/);
});

test('Desktop e tablet utilizam largura disponível sem restringir o app a uma coluna central',()=>{
  const estrutura=read('dist/css/estrutura.css');
  const responsive=read('dist/css/responsivo.css');
  const ajustes=read('dist/css/ajustes.css');
  assert.match(estrutura,/\.app-shell\{width:100%;max-width:none/);
  assert.match(estrutura,/main\{width:100%;max-width:none/);
  assert.match(responsive,/@media\(min-width:650px\) and \(max-width:879px\)/);
  assert.match(responsive,/\.app-shell\{padding:0 19px;max-width:none\}/);
  assert.match(ajustes,/\.settings-page\{width:100%;max-width:none/);
});

test('Barra desktop fica fixa no topo e ação de criação não sobrepõe os dados',()=>{
  const css=read('dist/css/estrutura.css');
  const media=read('dist/css/responsivo.css');
  const impressao=read('dist/css/impressao.css');
  const html=read('dist/index.html');
  assert.match(css,/\.desktop-toolbar\{display:flex/);
  assert.match(css,/\.desktop-toolbar\{[^\n]*margin:0 calc\(0px - clamp\(18px,2\.5vw,48px\)\) 16px/,
    'A barra ultrapassa somente o recuo horizontal do app-shell');
  assert.match(css,/\.desktop-toolbar \.desktop-nav\{display:grid;grid-template-columns:repeat\(6,minmax\(0,1fr\)\)/);
  assert.match(css,/\.desktop-nav \.nav-button\.active\{[^\n]*color:var\(--accent-text\)/,
    'A navegação deve seguir a cor de destaque configurada');
  assert.match(css,/@media\(min-width:880px\)\{[\s\S]*?\.desktop-toolbar\{position:sticky;top:0;z-index:11\}/);
  assert.match(css,/\.desktop-create\{position:relative;flex:none;margin-top:[^}]+border-top:1px solid var\(--border\)\}/);\n  assert.match(css,/\.desktop-create-menu\{position:absolute/);
  assert.match(css,/\.fab\{display:none\}/);
  assert.match(media,/\.desktop-toolbar\{display:none\}/);
  assert.match(impressao,/\.desktop-toolbar,\.mobile-nav/);
  assert.match(html,/id="desktop-create-trigger"[^>]*aria-expanded="false"/);
  assert.match(html,/id="desktop-create-menu"[^>]*role="group"/);
  assert.match(html,/data-create-kind="investment"/);
  assert.match(read('dist/modules/objetivos.js'),/data-action="add-investment"/);
  assert.match(html,/id="investment-category-suggestions"/);
  assert.match(html,/id="calendar-day-dialog"/);
  assert.match(html,/id="finance-calendar-dialog"[^>]*aria-labelledby="finance-calendar-title"/);
  assert.match(html,/id="finance-calendar-content"/);
  assert.match(read('dist/modules/calendario-financeiro.js'),/data-calendar-open aria-haspopup="dialog"/);
  assert.match(read('dist/app.js'),/if\(abrirCalendario\)\{calendarioFinanceiro\.abrirCalendario\(\)/);
  assert.doesNotMatch(read('dist/modules/resumo.js'),/renderCalendario\(\)/,
    'O calendário não deve ocupar espaço na tela inicial sem clique no mês');
  const calendario=read('dist/css/calendario.css');
  assert.match(calendario,/grid-template-columns:repeat\(7,minmax\(0,1fr\)\)/);
  assert.match(calendario,/data-flow-tone="mixed"/);
  assert.match(calendario,/\.form-dialog\.finance-calendar-dialog\{position:fixed/);
  assert.match(calendario,/@media\(max-width:700px\)/);
});

test('Smartphone abre diálogo de cinco ações e mantém CSS e formulários modulares',()=>{
  const html=read('dist/index.html');
  const css=read('dist/css/acao-rapida-mobile.css');
  const logica=read('dist/modules/acao-rapida.js');
  const formulario=html.match(/<dialog id="mobile-create-dialog"[\s\S]*?<\/dialog>/)?.[0];
  assert.ok(formulario,'Diálogo de cadastro móvel ausente');
  assert.match(html,/id="quick-add"[^>]+aria-controls="mobile-create-dialog"[^>]+aria-haspopup="dialog"[^>]+aria-expanded="false"/);
  assert.match(formulario,/aria-labelledby="mobile-create-title"/);
  assert.match(formulario,/class="icon-button close-dialog" aria-label="Fechar opções de cadastro"/);
  const tipos=[...formulario.matchAll(/data-create-kind="([a-z]+)"/g)].map(match=>match[1]);
  assert.deepEqual(tipos,['income','expense','goal','dream','investment']);
  assert.match(css,/\.mobile-create-options button\[data-create-kind="investment"\]/);
  assert.match(css,/min-height:92px/);
  assert.match(css,/env\(safe-area-inset-bottom\)/);
  assert.match(css,/var\(--accent-soft\)/);
  assert.match(logica,/dialogoMovel\.showModal\(\)/);
  assert.match(logica,/dialogoMovel\.addEventListener\('close'/);
  assert.match(logica,/dialogoMovel\.querySelectorAll\('\[data-create-kind\]'\)/);
  assert.match(read('dist/modules/objetivos.js'),/Toque para consultar e editar os aportes/);
  assert.match(html,/id="reports-page"[\\s\\S]*id="export-pdf"/);
});

test('Análises não injetam categorias não confiáveis em atributos HTML',()=>{
  const resumo=read('dist/modules/resumo.js');
  assert.match(resumo,/aria-label="Total \$\{money\(stats\.currentTotal\)\}\. \$\{esc\(stats\.current\.map/);
  assert.match(read('dist/modules/notificacoes.js'),/\$\{esc\(a\.description\)\}/);
});

test('CSS limpa componentes aposentados sem remover a base do app',()=>{
  const base=read('dist/styles.css');
  for(const className of ['app-shell','header','nav-button','mobile-nav',
    'form-dialog','two-col','dialog-actions','button-primary','toast','bar-chart','chart-legend',
    'empty-state','filter-panel','search-field','section-note','field-hint']){
    assert.ok(base.includes(`.${className}`),`Componente ainda utilizado sem estilo-base: ${className}`);
  }
  for(const antigo of ['.stat-card','.overview-hero','.brand-mark','.entry-actions','.goal-card','.page-header']){
    assert.ok(!base.includes(antigo),`Estilo obsoleto ainda publicado: ${antigo}`);
  }
  assert.doesNotMatch(base,/\.backup-menu/);
  assert.match(base,/button:focus-visible/);
  assert.match(base,/textarea:focus-visible/);
  assert.match(base,/summary:focus-visible/);
});

test('Acessibilidade: áreas seguras, números alinhados e movimento reduzido',()=>{
  const media=read('dist/css/responsivo.css');
  const resumo=read('dist/css/resumo.css');
  const saude=read('dist/css/saude.css');
  const estrutura=read('dist/css/estrutura.css');
  assert.match(media,/env\(safe-area-inset-left\)/);
  assert.match(media,/env\(safe-area-inset-right\)/);
  assert.match(media,/env\(safe-area-inset-bottom\)/);
  assert.match(media,/@media\(prefers-reduced-motion:reduce\)/);
  assert.match(media,/@media\(prefers-reduced-motion:no-preference\)/);
  assert.match(media,/\.form-dialog\[open\]\{animation:/);
  for(const css of [resumo,saude,estrutura])assert.match(css,/font-variant-numeric:tabular-nums/);
  assert.match(read('dist/css/ajustes.css'),/:root\[data-theme="escuro"\]/);
});
