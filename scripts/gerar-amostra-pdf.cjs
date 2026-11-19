// Gera uma amostra com dados FICTÍCIOS para revisão visual do layout A4.
// Uso: node scripts/gerar-amostra-pdf.cjs <pasta-destino> [resumo|metas|sonho]
const fs=require('node:fs');
const path=require('node:path');

async function executar(){
  const pasta=path.resolve(process.argv[2]||'./entregas');
  const visao=process.argv[3]||'resumo';
  const codigo=fs.readFileSync(path.join(__dirname,'../dist/modules/relatorio-pdf-conteudo.js'),'utf8');
  const {montarRelatorioFinanceiro}=await import(`data:text/javascript;base64,${Buffer.from(codigo).toString('base64')}`);
  const dinheiro=valor=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(valor);
  const tipos=['Alimentação','Moradia','Transporte','Saúde','Lazer','Educação','Contas'];
  const transacoes=[
    {type:'income',description:'Salário (exemplo)',category:'Salário',amount:5200,date:'2026-11-05'},
    {type:'income',description:'Serviço eventual (exemplo)',category:'Extra',amount:680,date:'2026-11-11'},
    ...Array.from({length:32},(_,i)=>({type:'expense',description:`Exemplo de compra ${i+1}`,category:tipos[i%tipos.length],
      amount:(i%7+1)*26.37,date:`2026-11-${String(i%25+1).padStart(2,'0')}`}))
  ];
  const objetivos=[
    {id:'m1',kind:'goal',name:'Reserva de emergência (exemplo)',target:15000,saved:6000,deadline:'2027-12-31'},
    {id:'m2',kind:'goal',name:'Curso profissional (exemplo)',target:4500,saved:1300,deadline:'2027-05-30'},
    {id:'s1',kind:'dream',name:'Viagem de férias (exemplo)',target:9000,saved:2750,deadline:'2028-01-15'}
  ];
  const aplicacoesRegistradas=Array.from({length:12},(_,i)=>({id:`a${i}`,kind:i%3===0?'dream':'goal',goalId:i%3===0?'s1':'m1',
    amount:i%5===0?-90:150+i*20,description:`Movimentação fictícia ${i+1}`,date:`2026-11-${String(i%25+1).padStart(2,'0')}`}));
  const conteudo=montarRelatorioFinanceiro({visao,mes:'2026-11',mesExtenso:'novembro de 2026',transacoes,objetivos,
    aplicacoesRegistradas,money:dinheiro,geradoEm:new Date('2026-11-19T12:00:00Z')});
  const css=fs.readFileSync(path.join(__dirname,'../dist/css/impressao.css'),'utf8');
  const html=`<!doctype html><html lang="pt-BR" data-theme="claro"><head><meta charset="utf-8"><title>Meu Dinheiro - amostra fictícia</title><style>:root{--accent:#16875c}body{margin:0} ${css}</style></head><body><section id="print-report" class="print-report">${conteudo}</section></body></html>`;
  fs.mkdirSync(pasta,{recursive:true});
  const destino=path.join(pasta,`Meu-Dinheiro-Amostra-${visao}.html`);
  fs.writeFileSync(destino,html);
  process.stdout.write(`${destino}\n`);
}
executar().catch(erro=>{console.error(erro);process.exitCode=1;});
