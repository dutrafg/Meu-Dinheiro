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
  const dialogo=obter('settings-dialog');
  dialogo.open=false;
  dialogo.showModal=()=>{dialogo.open=true;};
  dialogo.close=()=>{dialogo.open=false;eventos.get('settings-dialog:close')?.();};
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
  const preferenciasPadrao={tema:'auto',cor:'verde',percentual:10,categoriasAporte:[],reservaGoalId:''};
  let salvo={...preferenciasPadrao};
  const gestor={obter:()=>({...salvo}),salvar:novas=>{salvo=novas;return true;}};
  const mensagens=[];
  const sandbox={document,window:{matchMedia:()=>({matches:false,addEventListener:()=>{}})},
    CORES:{verde:'#16875c',roxo:'#7c3aed'},TEMAS:['auto','claro','escuro'],normalizarPreferencias:p=>p};
  const source=read('dist/modules/ajustes.js').replace(/^import .*$/gm,'').replace(/^export /gm,'');
  vm.runInNewContext(`${source}\nthis.api={aplicarAparencia,iniciarAjustes}`,sandbox);
  sandbox.api.iniciarAjustes({gestor,getData:()=>({goals:[]}),CATEGORIES:{income:[]},
    notify:mensagem=>mensagens.push(mensagem),render:()=>{},hideBackupMenu:()=>{}});
  const selecionar=(novoTema,novaCor)=>{
    tema.value=novoTema;
    for(const label of cores.children)for(const input of label.children){if(input.name==='cor')input.checked=input.value===novaCor;}
    eventos.get('settings-form:change')({target:{name:'tema'}});
  };
  return {eventos,dialogo,root,meta,gestor,mensagens,selecionar};
}

test('Tema e cor aparecem imediatamente, sem gravar dados financeiros nem preferências',()=>{
  const app=montarAjustes();
  app.eventos.get('open-settings:click')();
  app.selecionar('escuro','roxo');
  assert.equal(app.root.dataset.theme,'escuro');
  assert.equal(app.root.dataset.accent,'roxo');
  assert.equal(app.meta.content,'#131417');
  assert.equal(app.gestor.obter().tema,'auto');
  assert.equal(app.gestor.obter().cor,'verde');
});

test('Cancelar ou fechar sem salvar desfaz a prévia; Salvar mantém a escolha',()=>{
  const app=montarAjustes();
  app.eventos.get('open-settings:click')();
  app.selecionar('escuro','roxo');
  app.eventos.get('settings-form-cancel:click')();
  assert.equal(app.root.dataset.theme,'auto');
  assert.equal(app.root.dataset.accent,'verde');
  assert.equal(app.meta.content,'#f5f6f8');
  app.eventos.get('open-settings:click')();
  app.selecionar('escuro','roxo');
  app.eventos.get('settings-form:submit')({preventDefault:()=>{}});
  assert.equal(app.gestor.obter().tema,'escuro');
  assert.equal(app.gestor.obter().cor,'roxo');
  assert.equal(app.dialogo.open,false);
  assert.equal(app.root.dataset.theme,'escuro');
  assert.equal(app.root.dataset.accent,'roxo');
  assert.ok(app.mensagens.some(m=>m.includes('Ajustes salvos')));
});

test('Há botão Salvar visível no cabeçalho e dica clara sobre a prévia',()=>{
  const html=read('dist/index.html');
  const css=read('dist/css/ajustes.css');
  assert.match(html,/<button type="submit" form="settings-form"[^>]+id="settings-save-top">Salvar<\/button>/);
  assert.match(html,/A aparência muda na hora/);
  assert.match(css,/\.settings-dialog>\.settings-heading\{position:sticky/);
});
