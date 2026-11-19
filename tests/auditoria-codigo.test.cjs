const assert=require('node:assert/strict');
const test=require('node:test');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.join(__dirname,'..','dist');
const arquivo=fs.readFileSync(path.join(root,'modules/auditoria-codigo.js'),'utf8');
const carregar=()=>{
  const contexto={MODULOS_OBRIGATORIOS:[],console};
  vm.runInNewContext(`${arquivo.replace(/^import .+;$/gm,'').replace(/^export /gm,'')}\nthis.api={analisarCodigoEstatico,auditarCodigoPublicado};`,contexto);
  return contexto.api;
};

test('Auditoria marca somente classes não mencionadas no código ou no HTML',()=>{
  const {analisarCodigoEstatico}=carregar();
  const dados={fontesCss:{'base.css':'/* .comentada */ .utilizada,.obsoleta:hover{color:red} .utilizada{margin:0}'},
    fontesJs:{'app.js':'document.querySelector(".utilizada");'},html:'<main class="dinamica"></main>'};
  const resultado=analisarCodigoEstatico(dados);
  assert.equal(resultado.seletoresVerificados,2);
  assert.deepEqual(Array.from(resultado.cssNaoUsados,item=>item.nome),['obsoleta']);
});

test('Classes montadas dinamicamente são preservadas como possíveis usos',()=>{
  const {analisarCodigoEstatico}=carregar();
  const resultado=analisarCodigoEstatico({fontesCss:{'base.css':'.diagnostics-ok{} .diagnostics-erro{} .proto-goals-grid{} .sobrou{}'},
    fontesJs:{'app.js':'linha.className=`diagnostics-${item.estado}`; tela.innerHTML=`<div class="proto-goals-grid${unico?" single":""}">`;'}});
  assert.deepEqual(Array.from(resultado.cssNaoUsados,item=>item.nome),['sobrou']);
});

test('Auditoria detecta funções declaradas e setas não utilizadas, mas ignora exports públicos',()=>{
  const {analisarCodigoEstatico}=carregar();
  const codigo='function auxiliar(){} auxiliar(); function esquecida(){} const naoChamada=()=>{}; '
    +'const usada=()=>42; usada(); export function publica(){} export const interfacePublica=()=>{};';
  const resultado=analisarCodigoEstatico({fontesCss:{},fontesJs:{'app.js':codigo}});
  assert.deepEqual(Array.from(resultado.funcoesSemUso,item=>item.nome).sort(),['esquecida','naoChamada']);
});

test('Auditoria percorre CSS importado e todos os módulos, sem consultar dados financeiros',async()=>{
  const {auditarCodigoPublicado}=carregar();
  const arquivos={
    'index.html':'<main class="usada"></main>',
    'prototype.css':'@import url("./css/tema.css");',
    'styles.css':'.usada{} .abandonada{}',
    'css/tema.css':'.usada:hover{}',
    'app.js':'function executar(){} executar(); function esquecida(){}',
    'csv.js':'', 'analytics.js':'', 'folder-backup.js':'',
    'modules/novo.js':'export function moduloNovo(){}'
  };
  const requisitadas=[];
  const buscar=async url=>{const nome=url.slice(2);requisitadas.push(nome);
    return {ok:Object.hasOwn(arquivos,nome),text:async()=>arquivos[nome]};};
  const resultado=await auditarCodigoPublicado({buscar,modulos:['novo']});
  assert.equal(resultado.disponivel,true);
  assert.equal(resultado.arquivosInspecionados,7);
  assert.ok(requisitadas.includes('modules/novo.js'));
  assert.deepEqual(Array.from(resultado.cssNaoUsados,item=>item.nome),['abandonada']);
  assert.deepEqual(Array.from(resultado.funcoesSemUso,item=>item.nome),['esquecida']);
});

test('Falha na leitura de um módulo impede auditoria incompleta sem expor erro interno',async()=>{
  const {auditarCodigoPublicado}=carregar();
  const resultado=await auditarCodigoPublicado({buscar:async path=>({ok:!path.includes('app.js'),text:async()=>''}),modulos:[]});
  assert.equal(resultado.disponivel,false);
  assert.ok(!JSON.stringify(resultado).includes('app.js'));
});

test('Módulo novo é obrigatório no cache, catálogo e HTML de homologação',()=>{
  const nome='auditoria-codigo';
  assert.match(fs.readFileSync(path.join(root,'sw.js'),'utf8'),/\.\/modules\/auditoria-codigo\.js/);
  assert.match(fs.readFileSync(path.join(root,'modules/catalogo-diagnostico.js'),'utf8'),/'auditoria-codigo'/);
  assert.match(fs.readFileSync(path.join(root,'modules/registro-modulos.js'),'utf8'),/registrar\('auditoria-codigo'/);
  assert.match(fs.readFileSync(path.join(__dirname,'..','scripts/gerar-html-teste.cjs'),'utf8'),/'modules\/auditoria-codigo\.js'/);
});

test('Código publicado não contém candidatos CSS/JS esquecidos na revisão atual',()=>{
  const {analisarCodigoEstatico}=carregar();
  const css=['styles.css',...fs.readdirSync(path.join(root,'css')).filter(n=>n.endsWith('.css')).map(n=>`css/${n}`)];
  const js=['app.js','csv.js','analytics.js','folder-backup.js',...fs.readdirSync(path.join(root,'modules')).filter(n=>n.endsWith('.js')).map(n=>`modules/${n}`)];
  const fontes=lista=>Object.fromEntries(lista.map(nome=>[nome,fs.readFileSync(path.join(root,nome),'utf8')]));
  const resultado=analisarCodigoEstatico({fontesCss:fontes(css),fontesJs:fontes(js),html:fs.readFileSync(path.join(root,'index.html'),'utf8')});
  assert.equal(resultado.cssNaoUsados.length,0,JSON.stringify(resultado.cssNaoUsados));
  assert.equal(resultado.funcoesSemUso.length,0,JSON.stringify(resultado.funcoesSemUso));
  assert.ok(resultado.seletoresVerificados>200);
  assert.ok(resultado.funcoesVerificadas>100);
});

test('Nenhuma folha CSS nova fica fora da auditoria e dos imports publicados',()=>{
  const entrada=fs.readFileSync(path.join(root,'prototype.css'),'utf8');
  const importados=[...entrada.matchAll(/@import url\("\.\/(css\/[^"\s]+\.css)"\)/g)].map(m=>m[1]).sort();
  const existentes=fs.readdirSync(path.join(root,'css')).filter(n=>n.endsWith('.css')).map(n=>`css/${n}`).sort();
  assert.deepEqual(importados,existentes);
});
