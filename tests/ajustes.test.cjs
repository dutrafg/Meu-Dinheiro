const assert=require('node:assert/strict');
const test=require('node:test');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

const read=rel=>fs.readFileSync(path.join(__dirname,'..',rel),'utf8');

function montarAjustes(){
  const eventos=new Map();
  const elemento=(id)=>({id,children:[],value:'',selectedIndex:0,
    addEventListener:(tipo,cb)=>eventos.set(`${id}:${tipo}`,cb),
    replaceChildren(){this.children=[];},
    append(...filhos){this.children.push(...filhos);}});
  const elementos=new Map();
  const obter=id=>{if(!elementos.has(id))elementos.set(id,elemento(id));return elementos.get(id);};
  const pagina=obter('settings-page');
  pagina.classList={contains:n=>n==='hidden'?false:false};
  const form=obter('settings-form');
  const tema={value:'auto'},percentual={value:'10'};
  form.elements={namedItem:n=>({tema,percentual})[n]};
  const cores=obter('settings-colors');
  form.querySelector=()=>cores.children.flatMap(label=>label.children).find(input=>input.name==='cor'&&input.checked);
  form.querySelectorAll=()=>[];
  const root={dataset:{}};
  const meta={content:''};
  const document={documentElement:root,querySelector:()=>meta,getElementById:obter,
    createElement:tag=>Object.assign(elemento(tag),{style:{}}),createTextNode:text=>text};
  const preferenciasPadrao={tema:'auto',cor:'azul',percentual:10,categoriasAporte:[],reservaGoalId:''};
  let salvo={...preferenciasPadrao};
  const gestor={obter:()=>({...salvo}),salvar:novas=>{salvo=novas;return true;}};
  const mensagens=[];
  const sandbox={document,window:{matchMedia:()=>({matches:false,addEventListener:()=>{}})},
    CORES:{azul:'#2563eb',roxo:'#7c3aed'},TEMAS:['auto','claro','escuro'],normalizarPreferencias:p=>p};
  const source=read('dist/modules/ajustes.js').replace(/^import .*$/gm,'').replace(/^export /gm,'');
  vm.runInNewContext(`${source}\nthis.api={aplicarAparencia,iniciarAjustes}`,sandbox);
  const api=sandbox.api.iniciarAjustes({gestor,getData:()=>({goals:[]}),CATEGORIES:{income:[]},
    notify:mensagem=>mensagens.push(mensagem),render:()=>{},hideBackupMenu:()=>{},onCancel:()=>mensagens.push('voltar')});
  const selecionar=(novoTema,novaCor)=>{
    tema.value=novoTema;
    for(const label of cores.children)for(const input of label.children){if(input.name==='cor')input.checked=input.value===novaCor;}
    eventos.get('settings-form:change')({target:{name:'tema'}});
  };
  return {eventos,pagina,root,meta,gestor,mensagens,selecionar,api};
}

test('Tema e cor aparecem imediatamente, sem gravar dados financeiros nem preferências',()=>{
  const app=montarAjustes();
  app.api.abrir();
  app.selecionar('escuro','roxo');
  assert.equal(app.root.dataset.theme,'escuro');
  assert.equal(app.root.dataset.accent,'roxo');
  assert.equal(app.meta.content,'#131417');
  assert.equal(app.gestor.obter().tema,'auto');
  assert.equal(app.gestor.obter().cor,'azul');
});

test('Cancelar ou fechar sem salvar desfaz a prévia; Salvar mantém a escolha',()=>{
  const app=montarAjustes();
  app.api.abrir();
  app.selecionar('escuro','roxo');
  app.eventos.get('settings-form-cancel:click')();
  assert.equal(app.root.dataset.theme,'auto');
  assert.equal(app.root.dataset.accent,'azul');
  assert.equal(app.meta.content,'#f5f6f8');
  assert.ok(app.mensagens.includes('voltar'));
  app.api.abrir();
  app.selecionar('escuro','roxo');
  app.eventos.get('settings-form:submit')({preventDefault:()=>{}});
  assert.equal(app.gestor.obter().tema,'escuro');
  assert.equal(app.gestor.obter().cor,'roxo');
  assert.equal(typeof app.api.descartar,'function');
  assert.equal(app.root.dataset.theme,'escuro');
  assert.equal(app.root.dataset.accent,'roxo');
  assert.ok(app.mensagens.some(m=>m.includes('Ajustes salvos')));
});

test('Há botão Salvar visível no cabeçalho e dica clara sobre a prévia',()=>{
  const html=read('dist/index.html');
  const css=read('dist/css/ajustes.css');
  assert.match(html,/<button type="submit" form="settings-form"[^>]+id="settings-save-top">Salvar alterações<\/button>/);
  assert.match(html,/Aparência em prévia/);
  assert.match(css,/\.settings-page>\.settings-heading\{position:sticky/);
  assert.match(html,/id="settings-page" class="settings-page hidden"/);
});
