const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..');
const ler=nome=>fs.readFileSync(path.join(root,nome),'utf8');

test('P1: módulos de cálculo não dependem de DOM, persistência, rede ou UI',()=>{
  for(const arquivo of ['motor-financeiro','dominio-objetivos','dominio-investimentos','regras-financeiras']){
    const codigo=ler(`dist/modules/${arquivo}.js`);
    assert.doesNotMatch(codigo,/\b(?:document|window|localStorage|sessionStorage|indexedDB|fetch)\b/,
      `Cálculo financeiro deve ser independente: ${arquivo}`);
    assert.match(codigo,/export function /);
  }
});

test('P1: controladores usam os módulos puros mantendo exports antigos',()=>{
  const objetivos=ler('dist/modules/objetivos.js');
  const investimentos=ler('dist/modules/investimentos.js');
  const resumo=ler('dist/modules/resumo.js');
  assert.match(objetivos,/from '\.\/dominio-objetivos\.js'/);
  assert.match(investimentos,/from '\.\/dominio-investimentos\.js'/);
  assert.match(resumo,/from '\.\/motor-financeiro\.js'/);
  assert.doesNotMatch(investimentos,/export function (?:adicionarInvestimentoVinculado|validarVinculosSalariais)/);
  assert.doesNotMatch(resumo,/export function calcularSaldoDisponivelHoje/);
  assert.match(investimentos,/export \{encontrarSalarioAnterior,validarVinculosSalariais/);
  assert.match(resumo,/export \{calcularSaldoDisponivelHoje\}/);
});

test('P1: dois domínios constam no catálogo, autoverificação, offline e prévia',()=>{
  const catalogo=ler('dist/modules/catalogo-diagnostico.js');
  const registro=ler('dist/modules/registro-modulos.js');
  const cache=ler('dist/sw.js');
  const preview=ler('scripts/gerar-html-teste.cjs');
  for(const nome of ['dominio-objetivos','dominio-investimentos']){
    assert.ok(catalogo.includes(`'${nome}'`));
    assert.ok(registro.includes(`registrar('${nome}'`));
    assert.ok(cache.includes(`./modules/${nome}.js`));
    assert.ok(preview.includes(`modules/${nome}.js`));
  }
});
