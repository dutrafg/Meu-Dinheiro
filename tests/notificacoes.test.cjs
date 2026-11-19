const assert=require('node:assert/strict');
const test=require('node:test');
const fs=require('node:fs');
const path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'..','dist/modules/notificacoes.js'),'utf8');
const carregar=async()=>import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
const chave=n=>`renda-${n}@2026-11-18`;

async function montar({quantidade=3,storageFalha=false,confirmar=async()=>true,preexistente=null}={}){
  const {criarModuloNotificacoes,CHAVE_AVISOS}=await carregar();
  const listeners={};
  const elementos=new Map();
  const el=id=>{if(!elementos.has(id))elementos.set(id,{id,textContent:'',innerHTML:'',atributos:{},oculto:false,
    classList:{toggle(nome,estado){if(nome==='hidden')elementos.get(id).oculto=estado;}},
    setAttribute(nome,valor){this.atributos[nome]=valor;},
    addEventListener(tipo,cb){listeners[`${id}:${tipo}`]=cb;},
    insertAdjacentHTML(pos,html){this.innerHTML=html+this.innerHTML;}});return elementos.get(id);};
  const anterior=global.document;
  global.document={getElementById:el};
  const dados=new Map();if(preexistente!==null)dados.set(CHAVE_AVISOS,preexistente);
  const storage={getItem:key=>dados.get(key)||null,setItem:(key,value)=>{if(storageFalha)throw Error('quota');dados.set(key,value);}};
  const aportes=Array.from({length:quantidade},(_,n)=>({key:chave(n),date:'2026-11-18',description:`Salário ${n}`,category:'Salário',tenPercent:10}));
  const mensagens=[],logs=[];
  const modulo=criarModuloNotificacoes({getAportes:()=>aportes,getPreferences:()=>({percentual:10}),
    fmtDate:{format:()=> '18 nov. 2026'},parseDate:v=>v,money:v=>`R$ ${v}`,
    esc:v=>String(v).replaceAll('&','&amp;').replaceAll('<','&lt;'),
    notify:v=>mensagens.push(v),confirmar,storage,registrar:(...v)=>logs.push(v)});
  global.document=anterior;
  return {modulo,aportes,dados,CHAVE_AVISOS,el,listeners,mensagens,logs};
}

test('Limpar notificações oculta todos os lembretes sem marcar aporte como feito',async()=>{
  const app=await montar();
  assert.equal(app.modulo.pendentes().length,3);
  await app.listeners['notifications-clear:click']();
  assert.equal(app.modulo.pendentes().length,0);
  assert.equal(app.modulo.getStatus().ocultas,3);
  assert.equal(app.aportes.length,3);
  assert.equal(JSON.parse(app.dados.get(app.CHAVE_AVISOS)).length,3);
  app.modulo.renderBadge();
  assert.equal(app.el('reminder-count').oculto,true);
});

test('Cancelar a confirmação preserva os lembretes',async()=>{
  const app=await montar({confirmar:async()=>false});
  await app.listeners['notifications-clear:click']();
  assert.equal(app.modulo.pendentes().length,3);
  assert.equal(app.dados.has(app.CHAVE_AVISOS),false);
});

test('Restaurar avisos retorna apenas os não concluídos e preserva os dados',async()=>{
  const app=await montar({quantidade:2});
  await app.listeners['notifications-clear:click']();
  app.listeners['notifications-restore:click']();
  assert.equal(app.modulo.pendentes().length,2);
  assert.equal(app.modulo.getStatus().ocultas,0);
  assert.equal(app.el('notifications-restore').oculto,true);
});

test('Avisos novos continuam aparecendo após Limpar',async()=>{
  const app=await montar();
  await app.listeners['notifications-clear:click']();
  app.aportes.push({key:'renda-nova@2026-11-19',date:'2026-11-19',description:'Nova renda',category:'Salário',tenPercent:2});
  assert.deepEqual(app.modulo.pendentes().map(a=>a.key),['renda-nova@2026-11-19']);
});

test('Falha do armazenamento não declara os avisos limpos',async()=>{
  const app=await montar({storageFalha:true});
  await app.listeners['notifications-clear:click']();
  assert.equal(app.modulo.pendentes().length,3);
  assert.equal(app.modulo.getStatus().armazenamentoOk,false);
  assert.ok(app.logs.some(v=>v[1]==='NOTIFICACOES_GRAVACAO_FALHOU'));
});

test('JSON adulterado é isolado, sem executar dados ou bloquear o aplicativo',async()=>{
  const app=await montar({preexistente:'{"invalido":"x"}'});
  assert.equal(app.modulo.pendentes().length,3);
  assert.equal(app.modulo.getStatus().armazenamentoOk,false);
  assert.ok(app.logs.some(v=>v[1]==='NOTIFICACOES_LEITURA_FALHOU'));
});

test('Avisos dispensados sobrevivem a nova sessão e não aparecem no diagnóstico como IDs',async()=>{
  const app=await montar({preexistente:JSON.stringify([chave(0),chave(1)])});
  assert.equal(app.modulo.pendentes().length,1);
  assert.equal(app.modulo.getStatus().ocultas,2);
  assert.doesNotMatch(JSON.stringify(app.modulo.getStatus()),/renda-/);
  app.listeners['notifications-restore:click']();
  assert.equal(app.modulo.pendentes().length,3);
});

test('Interface limita a 100 itens renderizados, mas limpar dispensa todos',async()=>{
  const app=await montar({quantidade:205});
  app.modulo.renderDialog();
  assert.equal((app.el('reminder-list').innerHTML.match(/data-action="mark-aporte"/g)||[]).length,100);
  assert.match(app.el('reminder-list').innerHTML,/Mostrando 100 de 205/);
  await app.listeners['notifications-clear:click']();
  assert.equal(app.modulo.pendentes().length,0);
  assert.equal(app.modulo.getStatus().ocultas,205);
});
