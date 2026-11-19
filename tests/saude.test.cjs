const assert=require('node:assert/strict');
const test=require('node:test');
const fs=require('node:fs');
const path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'..','dist/modules/saude.js'),'utf8');
const carregar=async()=>import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
const exemplo=(override={})=>({renda:5000,despesas:1500,saldo:3500,reserva:15000,despesasPeriodo:4500,diasPeriodo:90,...override});

test('Saúde financeira: taxa de poupança e dias de fôlego são calculados sem alterar dados',async()=>{
  const {calcularSaudeFinanceira}=await carregar();
  const input=exemplo();const anterior=JSON.stringify(input);
  const result=calcularSaudeFinanceira(input);
  assert.equal(result.poupanca,70);
  assert.equal(result.folego,300);
  assert.equal(result.situacao,'crescendo');
  assert.equal(JSON.stringify(input),anterior);
});

test('Faixas financeiras: crescendo ≥15%, estável ≥0%, apertado ou atenção por cobertura',async()=>{
  const {calcularSaudeFinanceira:f}=await carregar();
  assert.equal(f(exemplo({renda:100,despesas:85,saldo:15})).situacao,'crescendo');
  assert.equal(f(exemplo({renda:100,despesas:85.0001,saldo:14.9999})).situacao,'estavel');
  assert.equal(f(exemplo({renda:100,despesas:100,saldo:0})).situacao,'estavel');
  assert.equal(f(exemplo({renda:100,despesas:120,saldo:-20,reserva:2000,despesasPeriodo:3000,diasPeriodo:90})).situacao,'apertado');
  assert.equal(f(exemplo({renda:100,despesas:120,saldo:-20,reserva:100,despesasPeriodo:3000,diasPeriodo:90})).situacao,'atencao');
});

test('Sem renda ou sem gastos, percentuais não viram infinito nem NaN',async()=>{
  const {calcularSaudeFinanceira:f}=await carregar();
  const vazio=f(exemplo({renda:0,despesas:0,saldo:0,despesasPeriodo:0}));
  assert.equal(vazio.poupanca,null);assert.equal(vazio.folego,null);assert.equal(vazio.situacao,'sem-dados');
  const semRenda=f(exemplo({renda:0,despesas:500,saldo:-500,reserva:0}));
  assert.equal(semRenda.poupanca,null);assert.equal(semRenda.situacao,'atencao');
  const semReserva=f(exemplo({reserva:0}));assert.equal(semReserva.folego,0);
});

test('Entradas inválidas e negativas são rejeitadas pelos indicadores',async()=>{
  const {calcularSaudeFinanceira:f}=await carregar();
  for(const campo of ['renda','despesas','reserva','despesasPeriodo','diasPeriodo']){
    assert.throws(()=>f(exemplo({[campo]:-1})),/inválidos/);
    assert.throws(()=>f(exemplo({[campo]:Infinity})),/inválidos/);
    assert.throws(()=>f(exemplo({[campo]:NaN})),/inválidos/);
  }
});

test('Indicador usa até três meses e não conta despesas lançadas no futuro',async()=>{
  const {criarModuloSaude}=await carregar();
  const vistos=[];
  const modulo=criarModuloSaude({getMonth:()=> '2026-11',currentMonth:'2026-11',
    shiftMonth:(m,d)=>{const date=new Date(`${m}-01T00:00:00Z`);date.setUTCMonth(date.getUTCMonth()+d);return date.toISOString().slice(0,7);},
    sums:()=>({income:1000,expense:500,balance:500}),
    transactionsInMonth:mes=>{vistos.push(mes);return [{occurrence:'2026-01-01',amount:300},{occurrence:'2099-01-01',amount:100000}];},
    reservePrincipal:()=>900,money:v=>String(v)});
  const html=modulo.renderSaude();
  assert.match(html,/Saúde financeira/);assert.match(html,/Taxa de poupança/);
  assert.match(html,/Fôlego da reserva/);assert.match(html,/Crescendo/);
  assert.deepEqual(vistos,['2026-09','2026-10','2026-11']);
  assert.equal(modulo.calcular().situacao,'crescendo');
});

test('Meses futuros não recebem indicador fictício de saúde',async()=>{
  const {criarModuloSaude}=await carregar();
  const modulo=criarModuloSaude({getMonth:()=> '2099-12',currentMonth:'2026-11',
    shiftMonth:()=> '2099-10',sums:()=>({income:1000,expense:0,balance:1000}),
    transactionsInMonth:()=>{throw Error('Não deve calcular futuro');},reservePrincipal:()=>0});
  assert.equal(modulo.calcular().situacao,'sem-dados');
  assert.match(modulo.renderSaude(),/Sem dados/);
});

test('Quando não existe média de gastos, o texto esclarece fôlego desconhecido',async()=>{
  const {criarModuloSaude}=await carregar();
  const modulo=criarModuloSaude({getMonth:()=> '2026-11',currentMonth:'2026-11',
    shiftMonth:()=> '2026-09',sums:()=>({income:2000,expense:0,balance:2000}),
    transactionsInMonth:()=>[],reservePrincipal:()=>20000});
  const html=modulo.renderSaude();
  assert.match(html,/Crescendo/);
  assert.match(html,/Sem despesas no período para estimar a cobertura da reserva/);
  assert.match(html,/Fôlego da reserva<\/span><strong>—<\/strong>/);
});

test('Cinco mil cenários de renda, gasto e reserva respeitam limites e tendências',async()=>{
  const {calcularSaudeFinanceira:f}=await carregar();
  let seed=20261119;
  const rand=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  for(let i=0;i<5000;i++){
    const renda=Math.round(rand()*100000)/100;
    const despesas=Math.round(rand()*120000)/100;
    const reserva=Math.round(rand()*600000)/100;
    const despesasPeriodo=Math.round(rand()*250000)/100;
    const diasPeriodo=1+Math.floor(rand()*92);
    const args={renda,despesas,saldo:renda-despesas,reserva,despesasPeriodo,diasPeriodo};
    const antes=JSON.stringify(args);
    const result=f(args);
    assert.equal(JSON.stringify(args),antes);
    assert.ok(result.poupanca===null||Number.isFinite(result.poupanca));
    assert.ok(result.folego===null||Number.isFinite(result.folego));
    if(renda>0&&renda-despesas>=0.15*renda+1e-7)assert.equal(result.situacao,'crescendo');
    if(despesasPeriodo>0){
      const comMaisReserva=f({...args,reserva:reserva+10000});
      assert.ok(comMaisReserva.folego>=result.folego);
    }
  }
});
