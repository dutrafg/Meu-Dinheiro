const assert=require('node:assert/strict');
const test=require('node:test');
const fs=require('node:fs');
const path=require('node:path');

const helper=fs.readFileSync(path.join(__dirname,'../dist/modules/dialogos.js'),'utf8').replace(/^export /gm,'');
const fonte=helper+'\n'+fs.readFileSync(path.join(__dirname,'../dist/modules/acao-rapida.js'),'utf8').replace(/^import .*$/gm,'');
const carregar=()=>import(`data:text/javascript;base64,${Buffer.from(fonte).toString('base64')}`);

function ambiente(){
  let visao='resumo';
  const chamadas=[];
  const criar=id=>{
    const ouvintes=new Map();
    const classes=new Set();
    const atributos=new Map();
    return {id,dataset:{},open:false,classList:{add:n=>classes.add(n),remove:n=>classes.delete(n),contains:n=>classes.has(n),
      toggle:(n,ativo)=>{if(ativo)classes.add(n);else classes.delete(n);}},
      addEventListener:(tipo,fn)=>ouvintes.set(tipo,fn),
      emitir:(tipo,extras={})=>ouvintes.get(tipo)?.({target:elementos.get(id),...extras}),
      setAttribute:(n,v)=>atributos.set(n,v),getAttribute:n=>atributos.get(n),
      focus(){this.focado=true;},contains:alvo=>alvo===elementos.get(id),
      getBoundingClientRect:()=>({left:20,right:350,top:200,bottom:760}),
      showModal(){this.open=true;this.aberturas=(this.aberturas||0)+1;},
      close(){this.open=false;this.emitir('close');}};
  };
  const elementos=new Map();
  for(const id of ['quick-add','desktop-create-trigger','desktop-create-wrap','desktop-create-menu','mobile-create-dialog'])
    elementos.set(id,criar(id));
  const menu=elementos.get('desktop-create-menu');
  menu.classList.add('hidden');
  const opcoes=['income','expense','goal','dream','investment'].map(tipo=>({dataset:{createKind:tipo},closest:()=>({dataset:{createKind:tipo}})}));
  menu.querySelector=()=>opcoes[0];
  opcoes[0].focus=()=>{opcoes[0].focado=true;};
  const grupo=elementos.get('desktop-create-wrap');
  grupo.contains=alvo=>[grupo,menu,elementos.get('desktop-create-trigger'),...opcoes].includes(alvo);
  const menuMovel=elementos.get('mobile-create-dialog');
  const opcoesMovel=['income','expense','goal','dream','investment'].map(tipo=>({dataset:{createKind:tipo},classList:{marcado:false,toggle(classe,ativo){if(classe==='is-context')this.marcado=ativo;}},
    closest(){return this;},focus(){this.focado=true;}}));
  menuMovel.querySelectorAll=()=>opcoesMovel;
  menuMovel.querySelector=seletor=>opcoesMovel.find(opcao=>seletor.includes(`"${opcao.dataset.createKind}"`));
  menuMovel.contains=alvo=>alvo===menuMovel||opcoesMovel.includes(alvo);
  const listeners=new Map();
  const documento={getElementById:id=>elementos.get(id),addEventListener:(tipo,fn)=>listeners.set(tipo,fn),
    emitir:(tipo,extras={})=>listeners.get(tipo)?.(extras)};
  return {documento,elementos,menu,menuMovel,opcoes,opcoesMovel,chamadas,obterVisao:()=>visao,alterarVisao:valor=>{visao=valor;},
    openTransaction:tipo=>chamadas.push(`transacao:${tipo}`),openGoal:tipo=>chamadas.push(`objetivo:${tipo}`),openInvestment:()=>chamadas.push('investimento')};
}

test('Ação móvel preserva o destaque contextual sem retirar os cinco cadastros',async()=>{
  const {acaoMovelParaVisao,TIPOS_CRIACAO_RAPIDA}=await carregar();
  assert.deepEqual([...TIPOS_CRIACAO_RAPIDA],['income','expense','goal','dream','investment']);
  for(const [visao,tipo] of [['resumo','income'],['renda','income'],['despesas','expense'],['metas','goal'],['sonho','dream']])
    assert.equal(acaoMovelParaVisao(visao).tipo,tipo);
});

test('Ao tocar no + móvel são exibidos os cinco cadastros, inclusive investimento',async()=>{
  const {iniciarAcaoRapida}=await carregar();
  const tela=ambiente();
  const api=iniciarAcaoRapida({...tela,getView:tela.obterVisao});
  api.atualizar('resumo');
  const fab=tela.elementos.get('quick-add');
  assert.match(fab.getAttribute('aria-label'),/opções de cadastro/);
  fab.emitir('click');
  assert.equal(tela.menuMovel.open,true);
  assert.equal(fab.getAttribute('aria-expanded'),'true');
  assert.equal(tela.opcoesMovel[0].focado,true);
  assert.equal(tela.opcoesMovel[0].classList.marcado,true);
  assert.equal(tela.chamadas.length,0,'Tocar no + não cria registro involuntariamente');
  for(const [indice,resultado] of ['transacao:income','transacao:expense','objetivo:goal','objetivo:dream','investimento'].entries()){
    if(indice>0)fab.emitir('click');
    tela.menuMovel.emitir('click',{target:tela.opcoesMovel[indice]});
    assert.equal(tela.chamadas.at(-1),resultado);
    assert.equal(tela.menuMovel.open,false);
    assert.equal(fab.getAttribute('aria-expanded'),'false');
  }
  assert.equal(tela.chamadas.length,5);
});

test('Sugestão de cadastro móvel muda conforme a tela, sem restringir investimento',async()=>{
  const {iniciarAcaoRapida}=await carregar();
  const tela=ambiente();
  const api=iniciarAcaoRapida({...tela,getView:tela.obterVisao});
  const fab=tela.elementos.get('quick-add');
  for(const [visao,tipo] of [['renda','income'],['despesas','expense'],['metas','goal'],['sonho','dream']]){
    tela.alterarVisao(visao);api.atualizar(visao);fab.emitir('click');
    assert.equal(tela.opcoesMovel.find(opcao=>opcao.dataset.createKind===tipo).classList.marcado,true);
    assert.equal(tela.opcoesMovel.filter(opcao=>opcao.classList.marcado).length,1);
    assert.equal(tela.opcoesMovel.find(opcao=>opcao.dataset.createKind===tipo).focado,true);
    tela.menuMovel.emitir('click',{target:tela.opcoesMovel[4]});
    assert.equal(tela.chamadas.at(-1),'investimento');
  }
  assert.equal(tela.chamadas.length,4);
});

test('Voltar, backdrop e troca de aba fecham painel móvel sem salvar nada',async()=>{
  const {iniciarAcaoRapida}=await carregar();
  const tela=ambiente();
  const api=iniciarAcaoRapida({...tela,getView:tela.obterVisao});
  const fab=tela.elementos.get('quick-add');
  fab.emitir('click');tela.menuMovel.close();
  assert.equal(fab.getAttribute('aria-expanded'),'false','Escape fecha diálogo nativo e sincroniza o botão');
  fab.emitir('click');tela.menuMovel.emitir('click',{target:tela.menuMovel,clientX:5,clientY:5});
  assert.equal(tela.menuMovel.open,false,'Clicar no fundo fecha');
  fab.emitir('click');api.atualizar('renda');
  assert.equal(tela.menuMovel.open,false,'Troca de módulo fecha');
  assert.deepEqual(tela.chamadas,[]);
  assert.equal(api.selecionar('invalido'),false);
});

test('Menu desktop reúne renda, despesa, meta, sonho e investimento com foco acessível',async()=>{
  const {iniciarAcaoRapida}=await carregar();
  const tela=ambiente();
  const api=iniciarAcaoRapida({...tela,getView:tela.obterVisao});
  api.atualizar('resumo');
  assert.equal(tela.elementos.get('desktop-create-trigger').getAttribute('aria-expanded'),'false');
  tela.elementos.get('desktop-create-trigger').emitir('click');
  assert.equal(tela.menu.classList.contains('hidden'),false);
  assert.equal(tela.elementos.get('desktop-create-trigger').getAttribute('aria-expanded'),'true');
  assert.equal(tela.opcoes[0].focado,true);
  for(const [idx,nome] of ['transacao:income','transacao:expense','objetivo:goal','objetivo:dream','investimento'].entries()){
    if(idx>0)tela.elementos.get('desktop-create-trigger').emitir('click');
    tela.menu.emitir('click',{target:tela.opcoes[idx]});
    assert.equal(tela.chamadas.at(-1),nome);
    assert.equal(tela.menu.classList.contains('hidden'),true);
  }
  assert.equal(tela.chamadas.length,5);
});

test('Escape e clique externo fecham menu sem criar registros',async()=>{
  const {iniciarAcaoRapida}=await carregar();
  const tela=ambiente();
  iniciarAcaoRapida({...tela,getView:tela.obterVisao});
  const trigger=tela.elementos.get('desktop-create-trigger');
  trigger.emitir('click');
  tela.documento.emitir('keydown',{key:'Escape'});
  assert.equal(tela.menu.classList.contains('hidden'),true);
  assert.equal(trigger.focado,true);
  trigger.emitir('click');
  tela.documento.emitir('click',{target:{}});
  assert.equal(tela.menu.classList.contains('hidden'),true);
  assert.equal(tela.chamadas.length,0);
});

test('Ajustes oculta ambos os atalhos e bloqueia acionamento involuntário',async()=>{
  const {iniciarAcaoRapida}=await carregar();
  const tela=ambiente();
  const api=iniciarAcaoRapida({...tela,getView:tela.obterVisao});
  tela.alterarVisao('despesas');api.atualizar('despesas');
  assert.match(tela.elementos.get('quick-add').getAttribute('aria-label'),/adicionar despesa/);
  tela.elementos.get('quick-add').emitir('click');
  assert.deepEqual(tela.chamadas,[]);
  assert.equal(tela.menuMovel.open,true);
  tela.alterarVisao('ajustes');api.atualizar('ajustes');
  assert.equal(tela.elementos.get('quick-add').classList.contains('hidden'),true);
  assert.equal(tela.menuMovel.open,false);
  assert.equal(tela.elementos.get('desktop-create-wrap').classList.contains('hidden'),true);
  tela.elementos.get('quick-add').emitir('click');
  tela.elementos.get('desktop-create-trigger').emitir('click');
  assert.equal(tela.menu.classList.contains('hidden'),true);
  assert.equal(tela.menuMovel.open,false);
  assert.equal(tela.chamadas.length,0);
});

test('Tipo de ação desconhecido é rejeitado sem abrir formulário',async()=>{
  const {iniciarAcaoRapida}=await carregar();
  const tela=ambiente();
  const api=iniciarAcaoRapida({...tela,getView:tela.obterVisao});
  assert.equal(api.selecionar('delete'),false);
  assert.equal(tela.chamadas.length,0);
});
