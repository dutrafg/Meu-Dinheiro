const assert=require('node:assert/strict');
const test=require('node:test');
const vm=require('node:vm');
const fs=require('node:fs');
const path=require('node:path');

const source=fs.readFileSync(path.join(__dirname,'..','dist','modules','catalogo-diagnostico.js'),'utf8').replace(/^export /gm,'');
const montar=()=>{
  const sandbox={};
  vm.runInNewContext(`${source}\nthis.api={MODULOS_OBRIGATORIOS,registrarModuloDiagnostico,executarVerificacoesModulos,totalRegistros};`,sandbox);
  return sandbox.api;
};

test('Um módulo esquecido falha explicitamente no diagnóstico',()=>{
  const api=montar();
  assert.ok(api.MODULOS_OBRIGATORIOS.length>=16);
  const itens=api.executarVerificacoesModulos();
  assert.equal(itens.length,api.MODULOS_OBRIGATORIOS.length);
  assert.equal(itens.filter(item=>item.estado==='erro').length,itens.length);
  assert.ok(itens.every(item=>item.modulo&&item.codigo&&item.descricao));
});

test('Cada registro deve ter autoverificação funcional e não pode ser duplicado',()=>{
  const api=montar();
  for(const nome of api.MODULOS_OBRIGATORIOS)api.registrarModuloDiagnostico(nome,()=>nome!=='backup');
  assert.equal(api.totalRegistros(),api.MODULOS_OBRIGATORIOS.length);
  const resultados=api.executarVerificacoesModulos();
  assert.equal(resultados.filter(item=>item.estado==='erro').length,1);
  assert.equal(resultados.find(item=>item.modulo==='backup').estado,'erro');
  assert.throws(()=>api.registrarModuloDiagnostico('backup',()=>true));
  assert.throws(()=>api.registrarModuloDiagnostico('módulo-desconhecido',()=>true));
});
