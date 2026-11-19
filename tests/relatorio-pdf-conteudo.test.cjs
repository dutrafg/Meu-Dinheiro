const assert=require('node:assert/strict');
const test=require('node:test');
const fs=require('node:fs');
const path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'..','dist/modules/relatorio-pdf-conteudo.js'),'utf8');
const carregar=async()=>import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
const dinheiro=valor=>`R$ ${Number(valor).toFixed(2)}`;
const transacoes=[
  {id:'r',type:'income',description:'Salário mensal',category:'Salário',amount:5000,date:'2026-11-05',occurrence:'2026-11-05'},
  {id:'d1',type:'expense',description:'Mercado',category:'Alimentação',amount:450.75,date:'2026-11-10',occurrence:'2026-11-10'},
  {id:'d2',type:'expense',description:'Padaria',category:'Alimentação',amount:49.25,date:'2026-11-12',occurrence:'2026-11-12'},
  {id:'d3',type:'expense',description:'Internet',category:'Contas',amount:100,date:'2026-11-13',occurrence:'2026-11-13',recurring:true}
];
const objetivos=[
  {id:'g1',kind:'goal',name:'Reserva de emergência',target:3000,saved:1250,deadline:'2027-06-30'},
  {id:'g2',kind:'dream',name:'Viagem',target:6000,saved:1500,deadline:''}
];
const base=(extras={})=>({visao:'resumo',mes:'2026-11',mesExtenso:'novembro de 2026',transacoes,objetivos,money:dinheiro,
  geradoEm:new Date('2026-11-19T12:00:00Z'),...extras});

test('Resumo imprime marca, período, indicadores e todas as movimentações',async()=>{
  const {montarRelatorioFinanceiro}=await carregar();
  const html=montarRelatorioFinanceiro(base());
  assert.match(html,/Meu Dinheiro/);
  assert.match(html,/Resumo financeiro/);
  assert.match(html,/novembro de 2026/);
  for(const valor of ['R$ 5000.00','R$ 600.00','R$ 4400.00'])assert.ok(html.includes(valor),valor);
  for(const descricao of ['Salário mensal','Mercado','Padaria','Internet'])assert.ok(html.includes(descricao));
  assert.match(html,/Despesas por categoria/);
  assert.match(html,/Receitas por categoria/);
  assert.match(html,/Objetivos financeiros/);
  assert.match(html,/42% concluído/);
  assert.match(html,/Mensal/);
  assert.match(html,/88%/); // Taxa de poupança do mês.
});

test('Receitas e despesas selecionam apenas seus lançamentos sem esconder indicadores do mês',async()=>{
  const {montarRelatorioFinanceiro}=await carregar();
  const receita=montarRelatorioFinanceiro(base({visao:'renda'}));
  const despesa=montarRelatorioFinanceiro(base({visao:'despesas'}));
  const tabela=html=>html.match(/<table class="pdf-table pdf-transactions">[\s\S]*?<\/table>/)?.[0];
  assert.match(receita,/Relatório de receitas/);
  assert.match(tabela(receita),/Salário mensal/);
  assert.doesNotMatch(tabela(receita),/Mercado/);
  assert.match(despesa,/Relatório de despesas/);
  assert.match(tabela(despesa),/Mercado/);
  assert.doesNotMatch(tabela(despesa),/Salário mensal/);
  assert.match(despesa,/R\$ 4400\.00/);
});

test('Metas e sonhos apresentam progresso, prazo, valores restantes e aplicações vinculadas',async()=>{
  const {montarRelatorioFinanceiro}=await carregar();
  const aplicacoesRegistradas=[
    {id:'a1',kind:'reserve',description:'CDB Reserva',date:'2026-11-04',amount:300,goalId:'g1'},
    {id:'a2',kind:'dream',description:'Resgate viagem',date:'2026-11-03',amount:-120,goalId:'g2'}
  ];
  const metas=montarRelatorioFinanceiro(base({visao:'metas',aplicacoesRegistradas}));
  const sonho=montarRelatorioFinanceiro(base({visao:'sonho',aplicacoesRegistradas}));
  assert.match(metas,/Reserva de emergência/);
  assert.match(metas,/Situação atual dos objetivos/);
  assert.match(metas,/1 objetivo considerado/);
  assert.doesNotMatch(metas,/lançamentos considerados/);
  assert.doesNotMatch(metas,/Resgate viagem/);
  assert.match(metas,/CDB Reserva/);
  assert.match(metas,/todos os períodos/);
  assert.match(metas,/30\/06\/2027/);
  assert.match(metas,/Faltam R\$ 1750\.00/);
  assert.match(sonho,/Viagem/);
  assert.doesNotMatch(sonho,/CDB Reserva/);
  assert.match(sonho,/Resgate viagem/);
  assert.match(sonho,/Resgate/);
  assert.match(sonho,/25% concluído/);
});

test('Dados financeiros e nomes são escapados antes de inserir no HTML de impressão',async()=>{
  const {montarRelatorioFinanceiro}=await carregar();
  const html=montarRelatorioFinanceiro(base({transacoes:[{...transacoes[1],category:'<script>alert(1)</script>',description:'"Mercado" & <b>teste</b>'}],
    objetivos:[{...objetivos[0],name:'<img src=x onerror=alert(1)>'}]}));
  assert.doesNotMatch(html,/<script>|<img src=x|<b>teste<\/b>/);
  assert.match(html,/&lt;script&gt;/);
  assert.match(html,/&lt;img src=x onerror=alert\(1\)&gt;/);
  assert.match(html,/&quot;Mercado&quot; &amp; &lt;b&gt;teste&lt;\/b&gt;/);
});

test('Mês vazio não mostra NaN/Infinity, cobre metas sem prazo e preserva os dados originais',async()=>{
  const {montarRelatorioFinanceiro}=await carregar();
  const dados=base({transacoes:[],objetivos:[]});const antes=JSON.stringify(dados);
  const html=montarRelatorioFinanceiro(dados);
  assert.match(html,/Nenhuma movimentação registrada/);
  assert.match(html,/Nenhum objetivo cadastrado/);
  assert.doesNotMatch(html,/NaN|Infinity|undefined/);
  assert.equal(JSON.stringify(dados),antes);
});

test('Dois mil lançamentos ficam no PDF sem limite artificial ou perda de centavos',async()=>{
  const {montarRelatorioFinanceiro}=await carregar();
  const itens=Array.from({length:2000},(_,i)=>({...transacoes[1],description:`Movimento ${i}`,amount:.01}));
  const html=montarRelatorioFinanceiro(base({visao:'despesas',transacoes:itens}));
  assert.match(html,/2000 lançamentos considerados/);
  assert.match(html,/R\$ 20\.00/);
  assert.match(html,/Movimento 1999/);
  assert.equal((html.match(/class="pdf-right pdf-nowrap pdf-strong pdf-negative"/g)||[]).length,2000);
});
