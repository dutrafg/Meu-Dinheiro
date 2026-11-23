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

test('Relatórios têm tabela rolável com descrições escapadas e sem baixa automática',async()=>{
  const html=fs.readFileSync(path.join(__dirname,'../dist/index.html'),'utf8');
  const js=fs.readFileSync(path.join(__dirname,'../dist/modules/previsoes.js'),'utf8');
  const css=fs.readFileSync(path.join(__dirname,'../dist/css/previsoes.css'),'utf8');
  assert.match(html,/id="forecast-panel"/);
  assert.match(js,/esc\(item\.descricao\)/);
  assert.match(css,/overflow-x:auto/);
  assert.doesNotMatch(js,/localStorage|\.persist\(|indexedDB|marcar.*pago/i);
});
