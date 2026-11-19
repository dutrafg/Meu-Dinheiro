const assert = require('node:assert/strict');
const test = require('node:test');
const csv = require('../dist/csv.js');

const categories = {
  income: ['Salário', 'Renda extra', 'Outros'],
  expense: ['Alimentação', 'Transporte', 'Faculdade', 'Farmácia', 'Cursos', 'Cartão de crédito', 'Internet', 'Telefone', 'Saúde', 'Educação', 'Outros']
};

test('Banco com preâmbulo, valores brasileiros e saldo separado', () => {
  const example = 'Extrato Conta Corrente\r\nPeríodo;2026\r\nSaldo;100,00\r\n\r\nData Lançamento;Histórico;Descrição;Valor;Saldo\r\n18/11/2026;Pix recebido;Pagamento;1.200,50;1300,50\r\n18/11/2026;Compra no débito;Supermercado;-123,45;1177,05\r\n17/11/2026;Aplicação;CDB;-200,00;977,05\r\n';
  const result = csv.importCSV(example, categories);
  assert.equal(result.items.length, 3);
  assert.equal(result.items[0].date, '2026-11-18');
  assert.equal(result.items[0].amount, 1200.5);
  assert.equal(result.items[0].type, 'income');
  assert.equal(result.items[1].amount, 123.45);
  assert.equal(result.items[1].type, 'expense');
  assert.equal(result.items[1].category, 'Alimentação');
  assert.equal(result.items[2].investmentTransfer, true);
  assert.equal(result.skipped, 0);
});

test('Exportação CSV volta ao aplicativo sem perder aspas e pontuação', () => {
  const tx = [{id:'1',date:'2026-11-05',type:'expense',description:'Mercado; "Centro"',category:'Alimentação',amount:52.8,recurring:true}];
  const result = csv.importCSV(csv.exportCSV(tx),categories);
  assert.equal(result.items.length,1);
  assert.equal(result.items[0].description,tx[0].description);
  assert.equal(result.items[0].amount,52.8);
  assert.equal(result.items[0].recurring,true);
  assert.equal(result.items[0].id,'1');
});

test('Datas inválidas são ignoradas e datas reais mantidas', () => {
  assert.equal(csv.iso('31/02/2026'),null);
  assert.equal(csv.iso('29/02/2024'),'2024-02-29');
  const parsed=csv.importCSV('Data;Descrição;Valor\n31/02/2026;Inválido;-20,00\n18/11/2026;Válido;-50,00',categories);
  assert.equal(parsed.items.length,1);
  assert.equal(parsed.skipped,1);
});

test('Mesmo extrato gera chaves estáveis para evitar nova importação', () => {
  const content='Data;Descrição;Valor\n18/11/2026;Exemplo;-25,00\n18/11/2026;Exemplo;-25,00';
  const first=csv.importCSV(content,categories).items;
  const second=csv.importCSV(content,categories).items;
  assert.equal(first.length,2);
  assert.notEqual(first[0].importKey,first[1].importKey);
  assert.deepEqual(first.map(v=>v.importKey),second.map(v=>v.importKey));
});

test('Aplicações e resgates voltam no CSV sem virar despesa nem renda', () => {
  const allocations = [
    {id:'aporte-1',date:'2026-11-18',kind:'reserve',description:'CDB liquidez diária',amount:250.4,importKey:'csv:aporte-1'},
    {id:'resgate-1',date:'2026-11-17',kind:'dream',description:'Resgate do sonho',amount:-32.15,importKey:'csv:resgate-1'}
  ];
  const parsed=csv.importCSV(csv.exportCSV([],allocations),categories).items;
  assert.equal(parsed.length,2);
  assert.ok(parsed.every(v=>v.investmentTransfer));
  assert.equal(parsed.find(v=>v.id==='aporte-1').allocationDelta,250.4);
  assert.equal(parsed.find(v=>v.id==='resgate-1').allocationDelta,-32.15);
  assert.equal(parsed.find(v=>v.id==='aporte-1').importKey,'csv:aporte-1');
});

test('Extrato classifica gastos específicos sem perder categorias antigas', () => {
  const lines=[
    'Data;Descrição;Valor',
    '18/11/2026;Mensalidade Faculdade;-700,00',
    '18/11/2026;Drogaria Central;-52,50',
    '18/11/2026;Curso de Inglês;-140,00',
    '18/11/2026;Pagamento fatura cartão;-650,00',
    '18/11/2026;Internet fibra ótica;-85,00',
    '18/11/2026;Conta telefone celular;-45,00',
    '18/11/2026;Consulta em clínica;-90,00'
  ];
  assert.deepEqual(csv.importCSV(lines.join('\n'),categories).items.map(v=>v.category),
    ['Faculdade','Farmácia','Cursos','Cartão de crédito','Internet','Telefone','Saúde']);
});

test('Categorias antigas recebem opções gerais antes de cair em Outros', () => {
  const antigas={income:['Salário','Renda extra','Outros'],
    expense:['Contas','Saúde','Educação','Alimentação','Outros']};
  const lines=['Data;Descrição;Valor',
    '18/11/2026;Internet fibra ótica;-85,00',
    '18/11/2026;Plano de telefone celular;-45,00',
    '18/11/2026;Pagamento fatura cartão;-310,00',
    '18/11/2026;Mensalidade Faculdade;-700,00',
    '18/11/2026;Farmácia do bairro;-52,50',
    '18/11/2026;Curso de inglês;-150,00',
    '18/11/2026;Compras sem correspondência;-10,00'];
  assert.deepEqual(csv.importCSV(lines.join('\n'),antigas).items.map(item=>item.category),
    ['Contas','Contas','Contas','Educação','Saúde','Educação','Outros']);
});

test('Categorias reconhecidas e selecionadas no CSV têm prioridade sobre inferências', () => {
  const explicita='Data;Descrição;Categoria;Valor\n18/11/2026;Internet fibra ótica;Saúde;-22,00';
  assert.equal(csv.importCSV(explicita,categories).items[0].category,'Saúde');
  assert.equal(csv.importCSV('Data;Descrição;Valor\n18/11/2026;Internet fibra ótica;-22,00',categories).items[0].category,'Internet');
});

test('Valores bancários com separador de milhar mantêm interpretação brasileira', () => {
  for(const [texto,esperado] of [['1.234',1234],['1,234',1234],['1.234,56',1234.56],
    ['1,234.56',1234.56],['(1.234,56)',-1234.56],['-0,01',-.01],['',null],['R$ 1 234,50',1234.5]]){
    assert.equal(csv.moneyNumber(texto),esperado,`Valor ${texto}`);
  }
});

test('Importa doze mil linhas sem perder datas e valores', () => {
  const content=['Data;Descrição;Valor'];
  for(let i=0;i<12000;i++) content.push(`18/11/2026;Despesa de teste ${i};-12,34`);
  const parsed=csv.importCSV(content.join('\n'),categories);
  assert.equal(parsed.items.length,12000);
  assert.equal(parsed.skipped,0);
  assert.ok(parsed.items.every(item=>item.amount===12.34&&item.date==='2026-11-18'));
});

test('Exportação CSV neutraliza texto que começa como fórmula de planilha', () => {
  const transaction={id:'seguro',type:'expense',description:'=HYPERLINK("https://exemplo.invalid")',category:'Outros',date:'2026-11-18',amount:2.5,recurring:false};
  const output=csv.exportCSV([transaction]);
  assert.match(output,/"'=HYPERLINK/);
  assert.match(output,/"\d{4}-\d{2}-\d{2}"/);
});
