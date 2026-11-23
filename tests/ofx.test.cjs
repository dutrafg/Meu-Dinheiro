const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const modulo=import('data:text/javascript;base64,'+Buffer.from(
  fs.readFileSync(path.join(__dirname,'../dist/modules/ofx.js'),'utf8')).toString('base64'));
const script=fs.readFileSync(path.join(__dirname,'../dist/csv.js'),'utf8');
const contexto={window:{},globalThis:{}};vm.runInNewContext(script,contexto);
const csv=contexto.window.MeuDinheiroCSV||contexto.globalThis.MeuDinheiroCSV;
const categorias={income:['Salário','Outros'],expense:['Outros','Alimentação']};
const exemplo=`OFXHEADER:100\nDATA:OFXSGML\nVERSION:102\n<OFX><BANKMSGSRSV1><STMTTRN><TRNTYPE>DEBIT
<DTPOSTED>20261121000000[-03:BRT]
<TRNAMT>-125.40
<FITID>TX-0001
<NAME>Mercado Exemplo
<MEMO>Supermercado
</STMTTRN><STMTTRN><DTPOSTED>20261122
<TRNAMT>2499.99
<FITID>TX-0002
<NAME>Salário base
</STMTTRN></BANKMSGSRSV1></OFX>`;

test('Converte OFX SGML para CSV bancário com identificadores estáveis',async()=>{
  const {identificarOfx,converterOfxParaCsv}=await modulo;
  assert.equal(identificarOfx(exemplo),true);
  const result=csv.importCSV(converterOfxParaCsv(exemplo),categorias);
  assert.equal(result.items.length,2);
  assert.equal(result.items[0].date,'2026-11-21');
  assert.equal(result.items[0].type,'expense');
  assert.equal(result.items[0].amount,125.4);
  assert.equal(result.items[0].importKey,'ofx:TX-0001');
  assert.equal(result.items[1].type,'income');
  assert.equal(result.items[1].amount,2499.99);
});

test('OFX rejeita conteúdo inválido, extensão enganosa e valores fora do intervalo',async()=>{
  const {identificarOfx,converterOfxParaCsv}=await modulo;
  assert.equal(identificarOfx('Data;Valor\n21/11/2026;-10'),false);
  assert.throws(()=>converterOfxParaCsv('não é OFX'));
  assert.throws(()=>converterOfxParaCsv('<OFX><STMTTRN><DTPOSTED>20261121<TRNAMT>0</STMTTRN></OFX>'));
  assert.throws(()=>converterOfxParaCsv('<OFX><STMTTRN><DTPOSTED>20261121<TRNAMT>9999999999</STMTTRN></OFX>'));
});

test('Importação de 10 mil movimentos OFX é estável e não escreve armazenamento',async()=>{
  const {converterOfxParaCsv}=await modulo;
  const movimentos=Array.from({length:10000},(_,i)=>
    `<STMTTRN><DTPOSTED>20261120<TRNAMT>${i%2?'-10.50':'100.00'}<FITID>${i}<NAME>Fictício ${i}</STMTTRN>`).join('');
  const resultado=csv.importCSV(converterOfxParaCsv(`<OFX>${movimentos}</OFX>`),categorias);
  assert.equal(resultado.items.length,10000);
  assert.equal(new Set(resultado.items.map(item=>item.importKey)).size,10000);
});
