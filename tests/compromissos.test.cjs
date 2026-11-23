const test=require('node:test');
const assert=require('node:assert/strict');
const {pathToFileURL}=require('node:url');
const path=require('node:path');
const carregar=()=>import(pathToFileURL(path.join(__dirname,'../dist/modules/compromissos.js')).href);
const carregarValidador=()=>import(pathToFileURL(path.join(__dirname,'../dist/modules/validacao.js')).href);
const base=()=>({transactions:[],goals:[],allocations:[],completedAportes:[],commitments:[]});
const conta={id:'luz',kind:'bill',name:'Luz',category:'Contas',amount:160,day:31,startMonth:'2026-01',monthsCount:null};
const cartao={id:'tenis',kind:'card',name:'Tênis',category:'Cartão de crédito',amount:79.90,day:10,startMonth:'2026-11',monthsCount:3};

test('Compromissos mensais ajustam o dia 31 em fevereiro e respeitam quantidade limitada',async()=>{
  const {ocorrenciaCompromisso}=await carregar();
  assert.equal(ocorrenciaCompromisso(conta,'2026-02').date,'2026-02-28');
  assert.equal(ocorrenciaCompromisso({...conta,monthsCount:2},'2026-03'),null);
  assert.equal(ocorrenciaCompromisso(cartao,'2027-02'),null);
  assert.equal(ocorrenciaCompromisso(cartao,'2026-12').parcela,2);
});

test('Marcar uma conta paga cria uma despesa única e preserva a versão de origem',async()=>{
  const {registrarPagamentoCompromisso,listarCompromissosNoMes}=await carregar();
  const estado={...base(),commitments:[conta]};
  const antes=JSON.stringify(estado);
  const atualizado=registrarPagamentoCompromisso(estado,'luz','2026-11',{id:'pg-1',date:'2026-11-22'});
  assert.equal(atualizado.transactions.length,1);
  assert.equal(atualizado.transactions[0].amount,160);
  assert.equal(atualizado.transactions[0].commitmentId,'luz');
  assert.equal(atualizado.transactions[0].commitmentMonth,'2026-11');
  assert.equal(listarCompromissosNoMes(atualizado,'2026-11','2026-11-23')[0].paid,true);
  assert.equal(JSON.stringify(estado),antes);
  assert.throws(()=>registrarPagamentoCompromisso(atualizado,'luz','2026-11',{id:'pg-2',date:'2026-11-23'}));
});

test('Cartão calcula parcela, próximo mês e total restante sem duplicar valores pagos',async()=>{
  const {registrarPagamentoCompromisso,resumirCartao}=await carregar();
  const dados={...base(),commitments:[cartao]};
  assert.equal(resumirCartao(dados,'2026-11').restante,239.70);
  assert.equal(resumirCartao(dados,'2026-11').proximaFatura,79.90);
  const pago=registrarPagamentoCompromisso(dados,'tenis','2026-11',{id:'p1',date:'2026-11-22'});
  assert.equal(resumirCartao(pago,'2026-11').restante,159.80);
  assert.equal(resumirCartao(pago,'2026-12').proximaFatura,79.90);
  assert.match(pago.transactions[0].description,/parcela 1\/3/);
});

test('Backups antigos recebem compromissos vazios; backups novos preservam contas e parcelas',async()=>{
  const {validarBackup,normalizarDadosLocais}=await carregarValidador();
  const antigo={app:'meu-dinheiro-essencial',version:1,...base()};delete antigo.commitments;
  assert.deepEqual(validarBackup(antigo,{}).commitments,[]);
  const novo={...antigo,commitments:[conta,cartao]};
  const validado=validarBackup(novo,{});
  assert.equal(validado.commitments.length,2);
  assert.equal(normalizarDadosLocais(validado).commitments[1].monthsCount,3);
});

test('Backups manipulados com dias, pagamentos duplicados ou limite inválidos são rejeitados',async()=>{
  const {validarBackup}=await carregarValidador();
  const backup={app:'meu-dinheiro-essencial',version:1,...base(),commitments:[cartao]};
  for(const inválido of [{...cartao,monthsCount:0},{...cartao,day:32},{...cartao,amount:-5},{...cartao,startMonth:'2026-13'},
    {...cartao,id:'<script>' ,category:'<script>'}]){
    assert.throws(()=>validarBackup({...backup,commitments:[inválido]},{}));
  }
  const original={id:'p1',description:'Parcela teste',type:'expense',amount:79.9,date:'2026-11-22',category:'Cartão de crédito',
    commitmentId:'tenis',commitmentMonth:'2026-11'};
  assert.throws(()=>validarBackup({...backup,transactions:[original,{...original,id:'p2'}]},{}));
});
