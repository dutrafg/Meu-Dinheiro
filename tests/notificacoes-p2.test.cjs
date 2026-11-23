const test=require('node:test');
const assert=require('node:assert/strict');
const {pathToFileURL}=require('node:url');
const path=require('node:path');
const carregar=()=>import(pathToFileURL(path.join(__dirname,'../dist/modules/notificacoes.js')).href);
const plano={id:'conta-1',kind:'bill',name:'Luz de exemplo',category:'Contas',amount:160,day:22,startMonth:'2026-11',monthsCount:null};

test('Avisos incluem conta vencida, próxima parcela e limite alto sem registrar pagamento',async()=>{
  const {avisosPlanejamento}=await carregar();
  const dados={commitments:[plano,{...plano,id:'cartao-1',name:'Geladeira',kind:'card',monthsCount:3,day:25}],
    transactions:[{id:'t1',type:'expense',amount:90,date:'2026-11-01'}]};
  const antes=JSON.stringify(dados);
  const notificacoes=avisosPlanejamento(dados,'2026-11-23',100);
  assert.equal(notificacoes.filter(item=>item.kind==='compromisso').length,2);
  assert.equal(notificacoes.find(item=>item.description==='Luz de exemplo').urgencia,'atrasado');
  assert.equal(notificacoes.find(item=>item.description==='Geladeira').urgencia,'proximo');
  assert.match(notificacoes.find(item=>item.kind==='limite').message,/80%/);
  assert.equal(JSON.stringify(dados),antes);
});

test('Pagamento confirmado retira o vencimento e aviso não aparece após acabar parcelas',async()=>{
  const {avisosPlanejamento}=await carregar();
  const pagos={commitments:[{...plano,monthsCount:1}],transactions:[{id:'p1',type:'expense',amount:160,
    date:'2026-11-23',commitmentId:'conta-1',commitmentMonth:'2026-11'}]};
  assert.equal(avisosPlanejamento(pagos,'2026-11-23').length,0);
  assert.equal(avisosPlanejamento(pagos,'2026-12-21').length,0);
  assert.deepEqual(avisosPlanejamento(pagos,'2026-02-30'),[]);
});
