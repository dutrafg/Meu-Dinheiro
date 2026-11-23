const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const {pathToFileURL}=require('node:url');

const read=file=>fs.readFileSync(path.join(__dirname,'..',file),'utf8');
const load=async file=>import(pathToFileURL(path.join(__dirname,'..',file)).href);

test('Edição mensal mostra alerta sobre toda a série, sem alerta em lançamento novo',async()=>{
  const {criarModuloLancamentos}=await load('dist/modules/lancamentos.js');
  const inputs=Object.fromEntries(['id','description','amount','date','recurring','type','category'].map(name=>[name,{value:'',checked:false,focus:()=>{},innerHTML:''}]));
  const classes=[];
  const warning={classList:{toggle:(name,hidden)=>classes.push({name,hidden})}};
  const documentOld=global.document;
  global.document={
    getElementById:id=>id==='transaction-recurring-warning'?warning:
      id==='transaction-title'?{set textContent(value){}}:{classList:{toggle:()=>{}}},
    querySelectorAll:()=>[]
  };
  try {
    const ctx={getData:()=>({transactions:[{id:'t1',type:'expense',description:'Internet',amount:99,date:'2026-11-10',category:'Contas',recurring:true}]}),
      getMonth:()=> '2026-11',currentMonth:'2026-11',isoDate:()=> '2026-11-18',esc:value=>value,
      transactionForm:{elements:{namedItem:name=>inputs[name]}},transactionDialog:{showModal:()=>{}},
      categorySet:()=>['Contas']};
    const modulo=criarModuloLancamentos(ctx);
    modulo.openTransaction(null,'t1');
    assert.equal(classes.at(-1).hidden,false);
    modulo.openTransaction('expense');
    assert.equal(classes.at(-1).hidden,true);
    assert.match(read('dist/index.html'),/editar este lançamento modifica todas as ocorrências/);
  } finally {global.document=documentOld;}
});
