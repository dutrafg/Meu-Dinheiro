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

test('Análises não injetam categorias não confiáveis em atributos HTML',()=>{
  const resumo=read('dist/modules/resumo.js');
  assert.match(resumo,/aria-label="Total \$\{money\(stats\.currentTotal\)\}\. \$\{esc\(stats\.current\.map/);
  assert.match(read('dist/modules/notificacoes.js'),/\$\{esc\(a\.description\)\}/);
});

test('CSS limpa componentes aposentados sem remover a base do app',()=>{
  const base=read('dist/styles.css');
  for(const className of ['app-shell','header','nav-button','mobile-nav','backup-menu',
    'form-dialog','two-col','dialog-actions','button-primary','toast','bar-chart','chart-legend',
    'empty-state','filter-panel','search-field','section-note','field-hint']){
    assert.ok(base.includes(`.${className}`),`Componente ainda utilizado sem estilo-base: ${className}`);
  }
  for(const antigo of ['.stat-card','.overview-hero','.brand-mark','.entry-actions','.goal-card','.page-header']){
    assert.ok(!base.includes(antigo),`Estilo obsoleto ainda publicado: ${antigo}`);
  }
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
