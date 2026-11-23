const assert=require('node:assert/strict');
const test=require('node:test');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const vm=require('node:vm');
const {execFileSync}=require('node:child_process');

const raiz=path.resolve(__dirname,'..');
const codigo=fs.readFileSync(path.join(raiz,'dist/modules/diagnostico.js'),'utf8');
const funcoes=codigo.slice(codigo.indexOf('const RECURSOS_OFFLINE'),codigo.indexOf('// Contraste WCAG'))
  .replace(/^export /gm,'');
const contexto={Uint8Array,JSON};
vm.runInNewContext(`${funcoes}\nthis.offline={verificarPacoteOffline,verificarHtmlIndependenteOffline};`,contexto);

test('Diagnóstico offline valida todos os recursos reais, inclusive manifest e PNG',async()=>{
  const leituras=[];
  const cache={match:async referencia=>{
    leituras.push(referencia);
    const arquivo=path.join(raiz,'dist',referencia.replace(/^\.\//,''));
    return new Response(fs.readFileSync(arquivo));
  }};
  const resultado=await contexto.offline.verificarPacoteOffline(cache);
  assert.equal(resultado.length,14);
  assert.ok(resultado.every(item=>item.estado==='ok'),JSON.stringify(resultado.filter(item=>item.estado!=='ok')));
  assert.ok(leituras.includes('./index.html'));
  assert.ok(leituras.includes('./modules/repositorio-financeiro.js'));
  assert.ok(leituras.includes('./modules/notificacoes.js'));
  assert.ok(leituras.includes('./icon-512.png'));
  assert.ok(resultado.every(item=>Object.keys(item).sort().join(',')==='codigo,descricao,estado,modulo'));
});

test('Diagnóstico distingue cache ausente, HTML disfarçado de JavaScript e ícone quebrado',async()=>{
  const cache={match:async arquivo=>{
    if(arquivo==='./manifest.webmanifest')return undefined;
    if(arquivo==='./app.js')return new Response('<!doctype html><html>falha</html>');
    if(arquivo==='./icon-192.png')return new Response('não é uma imagem PNG');
    return new Response(fs.readFileSync(path.join(raiz,'dist',arquivo.replace(/^\.\//,''))));
  }};
  const resultado=await contexto.offline.verificarPacoteOffline(cache);
  for(const parte of ['MANIFESTO','APLICACAO','ICONE_192'])
    assert.equal(resultado.find(item=>item.codigo===`OFFLINE_CACHE_${parte}`).estado,'aviso',parte);
  assert.equal(resultado.filter(item=>item.estado==='aviso').length,3);
});

test('Diagnóstico de HTML único identifica recursos externos e ausência de módulos internos',()=>{
  const criarElemento=(texto,atributos={})=>({textContent:texto,getAttribute:chave=>atributos[chave]||null});
  const script=criarElemento('function criarRelatorioDiagnostico() {}');
  const css=criarElemento(':root{--bg:#fff}.proto-card{color:red}');
  const documento=(externos=[])=>({querySelectorAll:seletor=>({script:[script],style:[css],
    'script[src],link[rel="stylesheet"][href],link[rel="manifest"][href],img[src]':externos})[seletor]||[]});
  const ok=contexto.offline.verificarHtmlIndependenteOffline(documento());
  assert.equal(ok.length,3);
  assert.ok(ok.every(item=>item.estado==='ok'));
  const vulneravel=contexto.offline.verificarHtmlIndependenteOffline(documento([criarElemento('',{src:'https://cdn.exemplo.invalid/app.js'})]));
  assert.equal(vulneravel.find(item=>item.codigo==='OFFLINE_HTML_SEM_DEPENDENCIAS').estado,'erro');
  assert.equal(contexto.offline.verificarHtmlIndependenteOffline(null)[0].estado,'nao_avaliado');
});

test('Gerador entrega HTML completo, sem dependências remotas, com diagnóstico acionável',()=>{
  const pasta=fs.mkdtempSync(path.join(os.tmpdir(),'meu-dinheiro-offline-'));
  const arquivo=path.join(pasta,'Meu-Dinheiro-Offline.html');
  try{
    execFileSync(process.execPath,[path.join(raiz,'scripts/gerar-html-teste.cjs'),arquivo]);
    const html=fs.readFileSync(arquivo,'utf8');
    assert.ok(Buffer.byteLength(html)>300000);
    assert.match(html,/<aside id="offline-validation-banner"/);
    assert.match(html,/id="offline-validation-run"/);
    assert.match(html,/function verificarPacoteOffline\(/);
    assert.match(html,/function criarRelatorioDiagnostico\(/);
    assert.match(html,/--bg:/);
    assert.doesNotMatch(html,/<script\s+[^>]*src=/i);
    assert.doesNotMatch(html,/<link\s+[^>]*rel="stylesheet"/i);
    assert.doesNotMatch(html,/<link\s+[^>]*rel="manifest"/i);
    assert.doesNotMatch(html,/<img\s+[^>]*src=/i);
    const scripts=[...html.matchAll(/<script(?:\s+[^>]*)?>([\s\S]*?)<\/script>/g)];
    assert.equal(scripts.length,2,'O app e o botão de diagnóstico devem ficar embutidos no arquivo');
    for(const script of scripts)new vm.Script(script[1]);
  }finally{fs.rmSync(pasta,{recursive:true,force:true});}
});
