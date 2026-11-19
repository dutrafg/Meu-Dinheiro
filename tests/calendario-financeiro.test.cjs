const assert=require('node:assert/strict');
const test=require('node:test');
const fs=require('node:fs');
const path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../dist/modules/calendario-financeiro.js'),'utf8');
const carregar=()=>import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);

test('Calendário respeita semanas, fevereiro bissexto e meses com 30 ou 31 dias',async()=>{
  const {calcularCalendarioFinanceiro:calcular}=await carregar();
  const fevereiro=calcular('2024-02',[]),novembro=calcular('2026-11',[]),janeiro=calcular('2027-01',[]);
  assert.equal(fevereiro.days.length,29);
  assert.equal(fevereiro.offset,3,'quinta-feira é a quarta coluna, começando na segunda');
  assert.equal(fevereiro.days.at(-1).date,'2024-02-29');
  assert.equal(novembro.days.length,30);
  assert.equal(novembro.offset,6,'novembro de 2026 começa no domingo');
  assert.equal(janeiro.days.length,31);
  assert.equal(calcular('0004-02',[]).days.length,29,'anos anteriores a 100 não viram 1900 no JavaScript');
  assert.equal(calcular('0100-02',[]).days.length,28);
  assert.throws(()=>calcular('2026-13',[]));
  assert.throws(()=>calcular('invalido',[]));
});

test('Renda, despesa e movimentações do mesmo dia são somadas em centavos sem duplicação',async()=>{
  const {calcularCalendarioFinanceiro:calcular}=await carregar();
  const entradas=[{type:'income',amount:100.33,date:'2026-11-05'},
    {type:'income',amount:.17,date:'2026-11-05'},
    {type:'expense',amount:40.25,date:'2026-11-05'},
    {type:'expense',amount:.25,date:'2026-11-05'},
    {type:'expense',amount:300,date:'2026-10-30'},
    {type:'expense',amount:5,date:'2026-11-32'},
    {type:'expense',amount:5,date:'2026-11-00'}];
  const antes=JSON.stringify(entradas),calendario=calcular('2026-11',entradas),dia=calendario.days[4];
  assert.equal(dia.incomeCents,10050);
  assert.equal(dia.expenseCents,4050);
  assert.equal(dia.netCents,6000);
  assert.equal(dia.entries.length,4);
  assert.equal(calendario.totalIncomeCents,10050);
  assert.equal(calendario.totalExpenseCents,4050);
  assert.equal(JSON.stringify(entradas),antes);
});

test('Recorrência usa a ocorrência ajustada ao mês e não o lançamento original',async()=>{
  const {calcularCalendarioFinanceiro:calcular}=await carregar();
  const dias=calcular('2026-02',[
    {type:'income',date:'2026-01-31',occurrence:'2026-02-28',amount:1500,recurring:true},
    {type:'expense',date:'2026-01-04',occurrence:'2026-02-04',amount:300,recurring:true}
  ]).days;
  assert.equal(dias[27].incomeCents,150000);
  assert.equal(dias[3].expenseCents,30000);
  assert.equal(dias[30],undefined);
});

test('Cinco tons usam maior movimento e misturam as cores na proporção da receita/despesa',async()=>{
  const {calcularCalendarioFinanceiro:calcular}=await carregar();
  const entradas=[
    {type:'income',date:'2026-11-01',amount:100},
    {type:'expense',date:'2026-11-02',amount:200},
    {type:'income',date:'2026-11-03',amount:60},
    {type:'expense',date:'2026-11-03',amount:40},
    {type:'income',date:'2026-11-04',amount:10}
  ];
  const dias=calcular('2026-11',entradas).days;
  assert.deepEqual(dias.slice(0,4).map(d=>d.tone),['income','expense','mixed','income']);
  assert.equal(dias[1].level,5);
  assert.equal(dias[0].level,3);
  assert.equal(dias[2].incomeShare,60);
  assert.equal(dias[2].level,3);
  assert.equal(dias[3].level,1);
  assert.equal(dias[4].level,0);
  assert.ok(dias[1].alpha>dias[0].alpha&&dias[0].alpha>dias[3].alpha);
});

test('Valores compactos mantêm leitura móvel e não incluem dados confidenciais em estilos',async()=>{
  const {compactarValorCalendario:compactar,calcularCalendarioFinanceiro:calcular}=await carregar();
  assert.equal(compactar(150000),'1,5mil');
  assert.equal(compactar(200000000),'2mi');
  assert.equal(compactar(9500),'95');
  assert.equal(compactar(125),'1,25');
  const dia=calcular('2026-11',[{type:'income',date:'2026-11-19',description:'privado',amount:100}]).days[18];
  assert.deepEqual(Object.keys(dia).filter(k=>['tone','level','alpha','incomeShare'].includes(k)),['level','tone','incomeShare','alpha']);
});

test('Cartão exibe todos os dias e o detalhe não modifica os lançamentos',async()=>{
  const {criarModuloCalendarioFinanceiro}=await carregar();
  const originais=[{type:'income',date:'2026-11-12',occurrence:'2026-11-12',description:'<Salário>',category:'Salário',amount:1500},
    {type:'expense',date:'2026-11-12',occurrence:'2026-11-12',description:'Farmácia & mercado',category:'Saúde',amount:40}];
  const antes=JSON.stringify(originais),elementos={
    'calendar-day-title':{textContent:''},'calendar-day-content':{innerHTML:''}
  };
  const dialog={open:false,showModal(){this.open=true;},close(){this.open=false;},addEventListener:()=>{}};
  const api=criarModuloCalendarioFinanceiro({getMonth:()=> '2026-11',transactionsInMonth:()=>originais,
    monthLabel:()=> 'novembro de 2026',money:n=>`R$ ${n.toFixed(2)}`,esc:s=>String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'),
    fmtDate:new Intl.DateTimeFormat('pt-BR',{timeZone:'UTC'}),parseDate:s=>new Date(`${s}T12:00:00Z`),dialog,
    documento:{getElementById:id=>elementos[id]}});
  const html=api.renderCalendario();
  assert.equal((html.match(/data-calendar-day=/g)||[]).length,30);
  assert.match(html,/data-flow-tone="mixed"/);
  assert.match(html,/finance-calendar-legend/);
  assert.match(html,/style="--flow-alpha:\d+%;--flow-split:\d+%"/);
  assert.equal(api.abrirDia('2026-11-12'),true);
  assert.equal(dialog.open,true);
  assert.match(elementos['calendar-day-content'].innerHTML,/&lt;Salário&gt;/);
  assert.match(elementos['calendar-day-content'].innerHTML,/Farmácia &amp; mercado/);
  assert.equal(api.abrirDia('2026-12-01'),false);
  assert.equal(JSON.stringify(originais),antes);
});

test('Centenas de cenários preservam o total mensal em dias somados',async()=>{
  const {calcularCalendarioFinanceiro:calcular}=await carregar();
  for(let mes=1;mes<=12;mes++){
    const ym=`2026-${String(mes).padStart(2,'0')}`;
    const itens=Array.from({length:100},(_,i)=>({type:i%3===0?'income':'expense',date:`${ym}-${String(i%28+1).padStart(2,'0')}`,amount:(i+1)/100}));
    const soma=itens.reduce((total,item)=>total+(item.type==='income'?1:-1)*Math.round(item.amount*100),0);
    const result=calcular(ym,itens);
    assert.equal(result.days.reduce((total,d)=>total+d.netCents,0),soma);
  }
});
