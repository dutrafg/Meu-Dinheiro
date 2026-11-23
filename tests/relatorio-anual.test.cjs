const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {pathToFileURL}=require('node:url');
const importar=()=>import(pathToFileURL(path.join(__dirname,'../dist/modules/relatorio-anual.js')).href);

test('Resumo anual conta só ocorrências vencidas e não projeta recorrências futuras',async()=>{
  const {resumirAno}=await importar();
  const r=resumirAno([
    {type:'income',amount:3200,date:'2026-01-05',recurring:true},
    {type:'expense',amount:900,date:'2026-01-10',recurring:true},
    {type:'expense',amount:50,date:'2026-11-25',recurring:false}
  ],[],2026,'2026-11-22');
  assert.equal(r.meses[10].receitas,3200);
  assert.equal(r.meses[10].despesas,900);
  assert.equal(r.meses[11].receitas,0);
  assert.equal(r.receitas,35200);
  assert.equal(r.despesas,9900);
  assert.equal(r.saldo,25300);
  assert.equal(r.melhor.mes,'2026-01');
});

test('Aportes aparecem em coluna independente sem diminuir novamente o saldo',async()=>{
  const {resumirAno}=await importar();
  const r=resumirAno([{type:'income',amount:1000,date:'2026-04-01'}],[
    {date:'2026-04-02',amount:200},
    {date:'2026-12-20',amount:500},
    {date:'2025-11-22',amount:50}
  ],2026,'2026-11-22');
  assert.equal(r.aportes,200);
  assert.equal(r.saldo,1000);
  assert.equal(r.receitas,1000);
  assert.equal(r.despesas,0);
});

test('Anos inválidos ou referência sem data não geram relatório',async()=>{
  const {resumirAno}=await importar();
  assert.equal(resumirAno([],[],1999,'2026-11-22'),null);
  assert.equal(resumirAno([],[],2026,''),null);
});

test('Compartilhamento depende de toque explícito, com texto resumido',()=>{
  const js=fs.readFileSync(path.join(__dirname,'../dist/modules/relatorio-anual.js'),'utf8');
  const html=fs.readFileSync(path.join(__dirname,'../dist/index.html'),'utf8');
  assert.match(js,/data-annual-share/);
  assert.match(js,/navigator\.share/);
  assert.match(js,/navigator\.clipboard/);
  assert.match(html,/id="annual-panel"/);
  assert.doesNotMatch(js,/fetch\(|localStorage|indexedDB/);
});
