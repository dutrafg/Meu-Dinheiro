const assert=require('node:assert/strict');
const test=require('node:test');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

const read=rel=>fs.readFileSync(path.join(__dirname,'..',rel),'utf8');

function montarAjustes(){
  const eventos=new Map();
  const elemento=(id)=>({id,children:[],value:'',selectedIndex:0,dataset:{},
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
    setTimeout:()=>1,clearTimeout:()=>{},
    CORES:{azul:'#2563eb',roxo:'#7c3aed'},TEMAS:['auto','claro','escuro'],normalizarPreferencias:p=>p};
  const source=read('dist/modules/ajustes.js').replace(/^import .*$/gm,'').replace(/^export /gm,'');
  vm.runInNewContext(`${source}\nthis.api={aplicarAparencia,iniciarAjustes}`,sandbox);
  const api=sandbox.api.iniciarAjustes({gestor,getData:()=>({goals:[]}),CATEGORIES:{income:[]},
    notify:mensagem=>mensagens.push(mensagem),render:()=>{},hideBackupMenu:()=>{}});
  const selecionar=(novoTema,novaCor)=>{
    tema.value=novoTema;
    for(const label of cores.children)for(const input of label.children){if(input.name==='cor')input.checked=input.value===novaCor;}
    eventos.get('settings-form:change')({target:{name:'tema'}});
  };
  return {eventos,pagina,root,meta,gestor,mensagens,selecionar,percentual,api};
}

test('Tema e cor são aplicados e gravados automaticamente ao alterar preferência',()=>{
  const app=montarAjustes();
  app.api.abrir();
  app.selecionar('escuro','roxo');
  assert.equal(app.root.dataset.theme,'escuro');
  assert.equal(app.root.dataset.accent,'roxo');
  assert.equal(app.meta.content,'#131417');
  assert.equal(app.gestor.obter().tema,'escuro');
  assert.equal(app.gestor.obter().cor,'roxo');
});

test('Sair de Ajustes não desfaz mudanças e valores inválidos não substituem preferências',()=>{
  const app=montarAjustes();
  app.api.abrir();
  app.selecionar('escuro','roxo');
  app.api.concluirEdicao();
  assert.equal(app.gestor.obter().tema,'escuro');
  assert.equal(app.gestor.obter().cor,'roxo');
  app.percentual.value='';
  app.eventos.get('settings-form:change')({target:{name:'percentual'}});
  assert.equal(app.gestor.obter().percentual,10);
  assert.ok(app.mensagens.every(m=>!m.includes('Ajustes salvos')));
  assert.equal(typeof app.api.concluirEdicao,'function');
  assert.equal(app.root.dataset.theme,'escuro');
  assert.equal(app.root.dataset.accent,'roxo');
});

test('Ajustes têm estado de gravação acessível e nenhum botão Salvar/Descartar',()=>{
  const html=read('dist/index.html');
  const css=read('dist/css/ajustes.css');
  assert.match(html,/id="settings-autosave-status"[^>]+aria-live="polite"/);
  assert.match(html,/Tema e cores são aplicados e salvos automaticamente/);
  assert.doesNotMatch(html,/settings-save-top|settings-form-cancel|id="settings-cancel"/);
  assert.match(css,/\.settings-page>\.settings-heading\{position:sticky/);
  assert.match(html,/id="settings-page" class="settings-page hidden"/);
});
