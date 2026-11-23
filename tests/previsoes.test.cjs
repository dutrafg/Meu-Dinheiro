const assert=require('node:assert/strict');
const test=require('node:test');
const path=require('node:path');
const fs=require('node:fs');
const {pathToFileURL}=require('node:url');
const importar=()=>import(pathToFileURL(path.join(__dirname,'..','dist','modules','previsoes.js')).href);

test('Projeção de 12 meses repete somente recorrentes e preserva os dados de origem',async()=>{
  const {projetarDozeMeses}=await importar();
  const original=[
    {id:'sal',type:'income',amount:3200,date:'2026-10-05',recurring:true},
    {id:'fix',type:'expense',amount:900,date:'2026-10-10',recurring:true},
    {id:'uni',type:'expense',amount:120,date:'2026-11-16',recurring:false}
  ];
  const antes=JSON.stringify(original);
  const meses=projetarDozeMeses(original,'2026-11');
  assert.equal(meses.length,12);
  assert.equal(meses[0].receitas,3200);
  assert.equal(meses[0].despesas,1020);
  assert.equal(meses[1].despesas,900);
  assert.equal(meses[11].livre,2300);
  assert.equal(JSON.stringify(original),antes);
});

test('Agenda respeita horizonte, datas de dia 31 e não confunde despesas com pagamentos',async()=>{
  const {proximasDespesasPrevistas}=await importar();
  const itens=[
    {id:'luz',type:'expense',amount:160,date:'2025-01-31',description:'Luz',recurring:true},
    {id:'sal',type:'income',amount:2000,date:'2026-02-25',recurring:true},
    {id:'fora',type:'expense',amount:800,date:'2026-04-12',recurring:false}
  ];
  const agenda=proximasDespesasPrevistas(itens,'2026-02-26',35);
  assert.equal(agenda.length,2);
  assert.equal(agenda[0].vencimento,'2026-02-28');
  assert.equal(agenda[1].vencimento,'2026-03-31');
  assert.equal(agenda[0].recorrente,true);
  assert.equal(agenda.some(item=>item.id==='sal'),false);
});

test('Datas e limites inválidos não produzem previsões',async()=>{
  const {projetarDozeMeses,proximasDespesasPrevistas,deslocarMesPrevisao}=await importar();
  assert.deepEqual(projetarDozeMeses([],'2026-13'),[]);
  assert.deepEqual(proximasDespesasPrevistas([],'2026-02-30'),[]);
  assert.deepEqual(proximasDespesasPrevistas([],'2026-01-01',999),[]);
  assert.equal(deslocarMesPrevisao('2026-12',1),'2027-01');
});

test('Compromissos não pagos entram na previsão e parcelas pagas não duplicam despesas',async()=>{
  const {projetarDozeMeses,proximasDespesasPrevistas}=await importar();
  const plano={id:'conta',kind:'bill',name:'Conta exemplo',category:'Contas',amount:150,day:30,startMonth:'2026-11',monthsCount:2};
  const pagos=[{id:'p',type:'expense',description:'Conta exemplo',amount:155,date:'2026-11-30',category:'Contas',
    commitmentId:'conta',commitmentMonth:'2026-11',recurring:false}];
  const original=JSON.stringify({pagos,plano});
  const meses=projetarDozeMeses(pagos,'2026-11',[plano]);
  assert.equal(meses[0].despesas,155);
  assert.equal(meses[1].despesas,150);
  assert.equal(meses[2].despesas,0);
  const agenda=proximasDespesasPrevistas(pagos,'2026-11-28',35,[plano]);
  assert.equal(agenda.length,1);
  assert.equal(agenda[0].vencimento,'2026-12-30');
  assert.equal(agenda[0].planejado,true);
  assert.equal(JSON.stringify({pagos,plano}),original);
});

test('Relatórios têm tabela rolável com descrições escapadas e sem baixa automática',async()=>{
  const html=fs.readFileSync(path.join(__dirname,'../dist/index.html'),'utf8');
  const js=fs.readFileSync(path.join(__dirname,'../dist/modules/previsoes.js'),'utf8');
  const css=fs.readFileSync(path.join(__dirname,'../dist/css/previsoes.css'),'utf8');
  assert.match(html,/id="forecast-panel"/);
  assert.match(js,/esc\(item\.descricao\)/);
  assert.match(css,/overflow-x:auto/);
  assert.doesNotMatch(js,/localStorage|\.persist\(|indexedDB|marcar.*pago/i);
});
