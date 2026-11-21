const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const os=require('node:os');
const vm=require('node:vm');
const {execFileSync}=require('node:child_process');
const root=path.resolve(__dirname,'..');
const read=name=>fs.readFileSync(path.join(root,name),'utf8');

test('As seis cores ficam em chips baixos, com círculo ao lado do nome',()=>{
  const css=read('preview-v36/ui/styles.css');
  assert.match(css,/\.settings-page \.settings-section label\.settings-color-option\{[\s\S]*?flex-direction:row;/);
  assert.match(css,/min-height:48px/);
  assert.match(css,/\.settings-page \.settings-color-dot\{[\s\S]*?width:20px;/);
  assert.match(css,/\.settings-page \.settings-preview-hint\{display:none\}/);
  assert.match(css,/\.settings-page \.settings-colors\{[\s\S]*?grid-template-columns:repeat\(auto-fit,minmax\(108px,128px\)\)/);
});

test('A grade não provoca overflow e se adapta a celulares estreitos',()=>{
  const css=read('preview-v36/ui/styles.css');
  assert.match(css,/@media\(max-width:879px\)/);
  assert.match(css,/grid-template-columns:repeat\(3,minmax\(0,1fr\)\)/);
  assert.match(css,/@media\(max-width:359px\)/);
  assert.match(css,/grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
  assert.match(css,/min-width:0/);
});

test('O cabeçalho financeiro redundante some só em Ajustes no celular',()=>{
  const css=read('preview-v36/ui/styles.css');
  assert.match(css,/body\[data-v34-view="ajustes"\] \.header \.prototype-heading\{display:none\}/);
  assert.match(css,/body\[data-v34-view="ajustes"\] \.header \.proto-header-actions\{margin-left:auto\}/);
  assert.match(css,/body\[data-v34-view="ajustes"\] \.settings-page>\.settings-heading\{[\s\S]*?position:static;/);
  assert.doesNotMatch(css,/body\[data-v34-view="resumo"\]/);
});

test('As escolhas mantêm foco, gravação automática e temas antigos',()=>{
  const base=read('dist/css/ajustes.css');
  const ui=read('preview-v36/ui/styles.css');
  const behavior=read('dist/modules/ajustes.js');
  assert.match(base,/settings-color-option:focus-within/);
  assert.match(base,/settings-color-option:has\(input:checked\)/);
  assert.match(ui,/@media\(prefers-reduced-motion:reduce\)/);
  assert.match(behavior,/form\.addEventListener\('change',salvarAutomaticamente\)/);
  assert.match(behavior,/gestor\.salvar\(prefs\)/);
});

test('Diagnóstico registra os 12 testes da interface compacta sem alterar dados',()=>{
  const source=read('preview-v36/ui/diagnostico.js');
  const ids=[...source.matchAll(/\['(V36_[A-Z0-9_]+)'/g)].map(match=>match[1]);
  assert.equal(ids.length,12);
  assert.equal(new Set(ids).size,ids.length);
  for(const id of ['V36_VERSAO','V36_CHIPS_TOQUE','V36_CELULAR_COLUNAS','V36_MODO_ESCURO','V36_SEM_DADOS'])assert.ok(ids.includes(id));
  assert.match(source,/25 segundos/);
  assert.doesNotMatch(source,/localStorage\.setItem|gestor\.salvar/);
});

test('HTML independente v36 incorpora CSS e diagnóstico sem novos links externos',()=>{
  const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'md-v36-'));
  try{
    const file=path.join(tmp,'v36.html');
    execFileSync(process.execPath,[path.join(root,'scripts/gerar-html-design-v36.cjs'),file]);
    const html=fs.readFileSync(file,'utf8');
    assert.match(html,/<title>Meu Dinheiro — v36 Ajustes Compactos<\/title>/);
    assert.match(html,/id="design-v35-css"/);
    assert.match(html,/id="design-v36-css"/);
    assert.match(html,/data-preview-v36="ui\/diagnostico\.js"/);
    assert.match(html,/data-preview-v36="ui\/versao\.js"/);
    assert.doesNotMatch(html,/<script\s+src=|<link\s+[^>]*href=/);
    const script=html.match(/<script data-preview-v36="ui\/diagnostico.js">\n([\s\S]*?)<\/script>/);
    assert.ok(script);
    assert.doesNotThrow(()=>new vm.Script(script[1]));
    const versionScript=html.match(/<script data-preview-v36="ui\/versao.js">\n([\s\S]*?)<\/script>/);
    assert.ok(versionScript);
    assert.doesNotThrow(()=>new vm.Script(versionScript[1]));
  }finally{fs.rmSync(tmp,{recursive:true,force:true});}
});
