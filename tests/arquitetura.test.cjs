const assert=require('node:assert/strict');
const test=require('node:test');
const fs=require('node:fs');
const path=require('node:path');

const dist=path.join(__dirname,'..','dist');
const read=file=>fs.readFileSync(path.join(dist,file),'utf8');

test('Cada módulo é independente, está em cache offline e na prévia HTML',()=>{
  const files=fs.readdirSync(path.join(dist,'modules')).filter(name=>name.endsWith('.js'));
  const cache=read('sw.js');
  const script=fs.readFileSync(path.join(__dirname,'..','scripts','gerar-html-teste.cjs'),'utf8');
  assert.ok(files.length>=9);
  for(const file of files){
    const full=`modules/${file}`;
    assert.ok(cache.includes(`'./${full}'`),`Offline sem ${full}`);
    assert.ok(script.includes(`'${full}'`),`HTML independente sem ${full}`);
    assert.match(read(full),/^export /m);
  }
});

test('Grafo de imports locais não possui módulos ausentes ou ciclos',()=>{
  const all=['app.js',...fs.readdirSync(path.join(dist,'modules')).filter(name=>name.endsWith('.js')).map(file=>`modules/${file}`)];
  const graph=new Map();
  for(const file of all){
    const deps=[];
    for(const match of read(file).matchAll(/^import\s+(?:.*?\s+from\s+)?['"]([^'"]+)['"];?$/gm)){
      const dependency=match[1];
      assert.ok(dependency.startsWith('./'),`Import não local em ${file}`);
      const target=path.posix.normalize(path.posix.join(path.posix.dirname(file),dependency));
      assert.ok(fs.existsSync(path.join(dist,target)),`Ausente: ${file} -> ${target}`);
      if(all.includes(target))deps.push(target);
    }
    graph.set(file,deps);
  }
  const visiting=new Set(),visited=new Set();
  function visit(file){
    assert.ok(!visiting.has(file),`Ciclo de dependências em ${file}`);
    if(visited.has(file))return;
    visiting.add(file);
    for(const dependency of graph.get(file)||[])visit(dependency);
    visiting.delete(file);visited.add(file);
  }
  for(const file of all)visit(file);
});

test('Todo módulo deve constar no catálogo e possuir autoverificação executável',async()=>{
  const files=fs.readdirSync(path.join(dist,'modules')).filter(name=>name.endsWith('.js')).map(name=>name.slice(0,-3)).sort();
  const catalogo=read('modules/catalogo-diagnostico.js');
  const inventario=catalogo.match(/MODULOS_OBRIGATORIOS = Object\.freeze\(\[([\s\S]*?)\]\)/)?.[1];
  assert.ok(inventario,'Inventário ausente');
  const declarados=[...inventario.matchAll(/'([^']+)'/g)].map(m=>m[1]).sort();
  assert.deepEqual(declarados,files,'Atualize o catálogo ao criar qualquer módulo');
  const registro=read('modules/registro-modulos.js');
  for(const nome of files)assert.ok(registro.includes(`registrar('${nome}',`),`Falta teste de ${nome} no Diagnóstico`);
  assert.match(read('index.html'),/id="diagnostics-progress"/);
});
