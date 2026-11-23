const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const ler=arquivo=>fs.readFileSync(path.join(__dirname,'..',arquivo),'utf8');

test('Resumo móvel apresenta orçamento antes dos gráficos com ordem visual explícita',()=>{
  const css=ler('dist/css/responsivo.css');
  assert.match(css,/#view-content:has\(> \.proto-budget-card\)>\.proto-budget-card\{order:1\}/);
  assert.match(css,/#view-content:has\(> \.proto-budget-card\)>\.proto-overview\{order:2\}/);
  assert.match(ler('dist/modules/resumo.js'),/proto-budget-card/);
});

test('Navegação de seis módulos mantém foco visível e testes cobrem três larguras móveis',()=>{
  const css=ler('dist/css/responsivo.css');
  const e2e=ler('scripts/verificar-interface.cjs');
  assert.match(css,/\.mobile-nav \.nav-button:focus-visible/);
  assert.match(e2e,/\[320,390,768\]/);
  assert.match(e2e,/document\.documentElement\.scrollWidth<=window\.innerWidth/);
});
