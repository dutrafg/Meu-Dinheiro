const assert=require('node:assert/strict');
const test=require('node:test');
const fs=require('node:fs');
const path=require('node:path');

const fonte=fs.readFileSync(path.join(__dirname,'../dist/modules/acao-rapida.js'),'utf8');
const carregar=()=>import(`data:text/javascript;base64,${Buffer.from(fonte).toString('base64')}`);

function ambiente(){
  let visao='resumo';
  const chamadas=[];
  const criar=id=>{
    const ouvintes=new Map();
    const classes=new Set();
    const atributos=new Map();
    return {id,dataset:{},classList:{add:n=>classes.add(n),remove:n=>classes.delete(n),contains:n=>classes.has(n),
      toggle:(n,ativo)=>{if(ativo)classes.add(n);else classes.delete(n);}},
      addEventListener:(tipo,fn)=>ouvintes.set(tipo,fn),
      emitir:(tipo,extras={})=>ouvintes.get(tipo)?.({target:elementos.get(id),...extras}),
      setAttribute:(n,v)=>atributos.set(n,v),getAttribute:n=>atributos.get(n),
      focus(){this.focado=true;},contains:alvo=>alvo===elementos.get(id)};
  };
  const elementos=new Map();
  for(const id of ['quick-add','desktop-create-trigger','desktop-create-wrap','desktop-create-menu'])
    elementos.set(id,criar(id));
  const menu=elementos.get('desktop-create-menu');
  menu.classList.add('hidden');
  const opcoes=['income','expense','goal','dream','investment'].map(tipo=>({dataset:{createKind:tipo},closest:()=>({dataset:{createKind:tipo}})}));
  menu.querySelector=()=>opcoes[0];
  opcoes[0].focus=()=>{opcoes[0].focado=true;};
  const grupo=elementos.get('desktop-create-wrap');
  grupo.contains=alvo=>[grupo,menu,elementos.get('desktop-create-trigger'),...opcoes].includes(alvo);
  const listeners=new Map();
  const documento={getElementById:id=>elementos.get(id),addEventListener:(tipo,fn)=>listeners.set(tipo,fn),
    emitir:(tipo,extras={})=>listeners.get(tipo)?.(extras)};
  return {documento,elementos,menu,opcoes,chamadas,obterVisao:()=>visao,alterarVisao:valor=>{visao=valor;},
    openTransaction:tipo=>chamadas.push(`transacao:${tipo}`),openGoal:tipo=>chamadas.push(`objetivo:${tipo}`),openInvestment:()=>chamadas.push('investimento')};
}

test('Ação móvel mantém o contexto de cada tela e permite cinco tipos de criação no desktop',async()=>{
  const {acaoMovelParaVisao,TIPOS_CRIACAO_RAPIDA}=await carregar();
  assert.deepEqual([...TIPOS_CRIACAO_RAPIDA],['income','expense','goal','dream','investment']);
  for(const [visao,tipo] of [['resumo','income'],['renda','income'],['despesas','expense'],['metas','goal'],['sonho','dream']])
    assert.equal(acaoMovelParaVisao(visao).tipo,tipo);
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
  assert.equal(tela.elementos.get('quick-add').getAttribute('aria-label'),'Adicionar despesa');
  tela.elementos.get('quick-add').emitir('click');
  assert.deepEqual(tela.chamadas,['transacao:expense']);
  tela.alterarVisao('ajustes');api.atualizar('ajustes');
  assert.equal(tela.elementos.get('quick-add').classList.contains('hidden'),true);
  assert.equal(tela.elementos.get('desktop-create-wrap').classList.contains('hidden'),true);
  tela.elementos.get('quick-add').emitir('click');
  tela.elementos.get('desktop-create-trigger').emitir('click');
  assert.equal(tela.menu.classList.contains('hidden'),true);
  assert.equal(tela.chamadas.length,1);
});

test('Tipo de ação desconhecido é rejeitado sem abrir formulário',async()=>{
  const {iniciarAcaoRapida}=await carregar();
  const tela=ambiente();
  const api=iniciarAcaoRapida({...tela,getView:tela.obterVisao});
  assert.equal(api.selecionar('delete'),false);
  assert.equal(tela.chamadas.length,0);
});
