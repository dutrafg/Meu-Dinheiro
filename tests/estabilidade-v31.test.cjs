const assert=require('node:assert/strict');
const test=require('node:test');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const read=arquivo=>fs.readFileSync(path.join(__dirname,'..',arquivo),'utf8');
const carregar=async(arquivo)=>import(`data:text/javascript;base64,${Buffer.from(read(arquivo)).toString('base64')}`);

test('Duas abas detectam conflito antes de gravar e sincronizam sem perda',async()=>{
  const {criarProtecaoConcorrencia}=await carregar('dist/modules/concorrencia-dados.js');
  const valores=new Map([['dados','versao-inicial']]);
  const storage={getItem:chave=>valores.get(chave)||null,setItem:(chave,valor)=>valores.set(chave,valor)};
  const eventos=[];let atualA='',atualB='',conflitos=0;
  const criar=(callback)=>criarProtecaoConcorrencia({storage,chave:'dados',
    janela:{addEventListener:(nome,fn)=>{if(nome==='storage')eventos.push(fn);}},
    aoAlterar:callback,aoConflito:()=>{conflitos++;}});
  const abaA=criar(valor=>{atualA=valor;return true;});
  const abaB=criar(valor=>{atualB=valor;return true;});
  storage.setItem('dados','versao-A');abaA.registrarGravacao('versao-A');
  assert.equal(abaB.podeGravar(),false,'Cópia antiga nunca deve sobrescrever outra aba');
  eventos[1]({key:'dados',storageArea:storage});
  assert.equal(atualB,'versao-A');
  assert.equal(abaB.podeGravar(),true);
  storage.setItem('dados','versao-B');abaB.registrarGravacao('versao-B');
  eventos[0]({key:null,storageArea:storage});
  assert.equal(atualA,'versao-B');
  assert.equal(conflitos,0);
});

test('Uma aba com formulário aberto bloqueia a sincronização até uma recuperação segura',async()=>{
  const {criarProtecaoConcorrencia}=await carregar('dist/modules/concorrencia-dados.js');
  let valor='original',avisos=0,aceita=false;
  const protecao=criarProtecaoConcorrencia({storage:{getItem:()=>valor},chave:'dados',
    janela:{addEventListener:()=>{}},aoAlterar:()=>aceita,aoConflito:()=>{avisos++;}});
  valor='mais-recente';
  assert.equal(protecao.sincronizar(),false);
  assert.equal(protecao.podeGravar(),false);
  assert.equal(avisos,1);
  aceita=true;
  assert.equal(protecao.sincronizar(),true);
  assert.equal(protecao.podeGravar(),true);
});

test('Permissão opcional de armazenamento nunca bloqueia quando indisponível ou negada',async()=>{
  const {solicitarPersistenciaLocal}=await carregar('dist/modules/concorrencia-dados.js');
  assert.equal(await solicitarPersistenciaLocal(null),false);
  assert.equal(await solicitarPersistenciaLocal({storage:{persist:async()=>{throw Error('negado');}}}),false);
  assert.equal(await solicitarPersistenciaLocal({storage:{persisted:async()=>true,persist:async()=>{throw Error('não deveria executar');}}}),true);
  assert.equal(await solicitarPersistenciaLocal({storage:{persist:async()=>true}}),true);
});

test('Virada de mês e ano preserva a seleção histórica do usuário',async()=>{
  const {calcularViradaPeriodo,mesLocalDaData}=await carregar('dist/modules/ciclo-periodo.js');
  const janeiro=new Date(2027,0,1,0,5);
  assert.equal(mesLocalDaData(janeiro),'2027-01');
  const atual=calcularViradaPeriodo('2026-12','2026-12','2026-12-31',janeiro);
  assert.deepEqual(atual,{mesAtual:'2027-01',mesSelecionado:'2027-01',dia:'2027-01-01',mudou:true});
  const historico=calcularViradaPeriodo('2026-12','2026-10','2026-12-31',janeiro);
  assert.equal(historico.mesSelecionado,'2026-10');
  const outroDia=calcularViradaPeriodo('2027-01','2027-01','2027-01-01',new Date(2027,0,2));
  assert.equal(outroDia.mudou,true,'Saldo de hoje deve mudar sem precisar trocar de mês');
});

test('Backup antigo com categoria fora do catálogo preserva dinheiro e estrutura',async()=>{
  const {validarBackup}=await carregar('dist/modules/validacao.js');
  const legado={app:'meu-dinheiro-essencial',version:1,transactions:[{id:'t1',type:'income',date:'2026-11-18',
    amount:123.45,category:'Comissão histórica',description:'Recebimento antigo'}],goals:[]};
  const categorias={income:['Salário'],expense:['Outros']};
  const normalizado=validarBackup(legado,categorias);
  assert.equal(normalizado.transactions[0].category,'Comissão histórica');
  assert.equal(normalizado.transactions[0].amount,123.45);
  assert.equal(normalizado.transactions[0].recurring,false);
  assert.equal(normalizado.transactions[0].createdAt,'2026-11-18T12:00:00.000Z');
  assert.deepEqual(normalizado.allocations,[]);
  assert.deepEqual(normalizado.completedAportes,[]);
  assert.throws(()=>validarBackup({...legado,transactions:[{...legado.transactions[0],category:'<img src=x>'}]},categorias));
});

test('Origem do salário limita aportes e não contabiliza investimento anterior como despesa',()=>{
  const base={transactions:[{id:'salario',type:'income',date:'2026-11-05',amount:100,
    description:'Salário de novembro',category:'Salário',recurring:false}],
    goals:[{id:'meta',kind:'goal',name:'Reserva',target:300,saved:0,deadline:''}],allocations:[],completedAportes:[]};
  const context={Date,Math};
  vm.runInNewContext(`${read('dist/modules/validacao.js').replace(/^export /gm,'')}\n${read('dist/modules/dominio-investimentos.js').replace(/^import .*$/gm,'').replace(/^export /gm,'')}\n${read('dist/modules/investimentos.js').replace(/^import .*$/gm,'').replace(/^export \{.*\} from .*$/gm,'').replace(/^export /gm,'')}\nthis.api={adicionarInvestimentoVinculado,editarInvestimentoVinculado,validarVinculosSalariais};`,context);
  const {adicionarInvestimentoVinculado:adicionar,editarInvestimentoVinculado:editar,validarVinculosSalariais:validar}=context.api;
  const comSalario=adicionar(base,{id:'a',goalId:'meta',description:'Aporte salário',amount:80,date:'2026-11-06',category:'CDB',origin:'salary'});
  assert.equal(comSalario.allocations[0].salaryId,'salario');
  assert.throws(()=>adicionar(comSalario,{id:'b',goalId:'meta',description:'Acima do salário',amount:20.01,date:'2026-11-06',category:'CDB',origin:'salary'}));
  const comAntigo=adicionar(comSalario,{id:'c',goalId:'meta',description:'Valor antigo',amount:40,date:'2026-11-06',category:'CDB',origin:'previous'});
  assert.equal(comAntigo.goals[0].saved,120);
  assert.equal(validar(comAntigo).ok,true);
  assert.equal(validar({...comAntigo,transactions:[{...base.transactions[0],amount:75}]}).ok,false);
  const editado=editar(comAntigo,{id:'a',goalId:'meta',description:'Mudou de origem',amount:80,date:'2026-11-06',category:'CDB',origin:'previous'});
  assert.equal(editado.allocations.find(a=>a.id==='a').salaryId,undefined);
  assert.equal(validar({...editado,transactions:[]}).ok,true);
});

test('CSV identifica crédito apesar de nome ambíguo, categorias por palavra e fórmulas',()=>{
  const csv=require('../dist/csv.js');
  const cats={income:['Salário','Outros'],expense:['Transporte','Cursos','Alimentação','Outros']};
  const conteudo=['Data;Tipo;Descrição;Crédito;Débito',
    '19/11/2026;Pagamento recebido;Salário;123,45;',
    '19/11/2026;Pagamento;Imposto;;10,00',
    '19/11/2026;Pagamento;Concurso;;20,00',
    '19/11/2026;Pagamento;Mercado Pago;;30,00',
    '19/11/2026;Pagamento;Posto de gasolina;;12,50'].join('\n');
  const itens=csv.importCSV(conteudo,cats).items;
  assert.equal(itens[0].type,'income');
  assert.equal(itens[0].amount,123.45);
  assert.deepEqual(itens.slice(1).map(item=>item.category),['Outros','Outros','Outros','Transporte']);
  const exportado=csv.exportCSV([{id:'t',date:'2026-11-19',type:'expense',description:'-3+5',category:'Outros',amount:5,recurring:false}]);
  assert.match(exportado,/"'-3\+5"/);
});

test('Texto semântico de receita, despesa e rótulos tem contraste mínimo em temas claro e escuro',()=>{
  const diagnostico=read('dist/modules/diagnostico.js');
  const bloco=diagnostico.slice(diagnostico.indexOf('export function calcularContrasteCSS'),
    diagnostico.indexOf('export function calcularDuracaoDiagnostico')).replace(/^export /gm,'');
  const contraste=new Function(`${bloco}\nreturn calcularContrasteCSS;`)();
  assert.equal(contraste('#ffffff','não é cor'),null);
  assert.equal(contraste('#000000','#ffffff'),21);
  const estrutura=read('dist/css/estrutura.css');
  const ajustes=read('dist/css/ajustes.css');
  const paletas=[estrutura.match(/:root\{([^}]+)\}/)?.[1],
    ajustes.match(/:root\[data-theme="escuro"\]\{([^}]+)\}/)?.[1]];
  const variavel=(paleta,nome)=>paleta.match(new RegExp(`(?:^|;)\\s*${nome}:([^;]+)`))?.[1]?.trim();
  for(const [tema,paleta] of [['claro',paletas[0]],['escuro',paletas[1]]]){
    assert.ok(paleta,tema);
    for(const [texto,fundo] of [['--sub','--bg'],['--green-text','--card'],['--green-text','--green-bg'],
      ['--red-text','--card'],['--red-text','--red-bg']]){
      const indice=contraste(variavel(paleta,texto),variavel(paleta,fundo));
      assert.ok(indice>=4.5,`${tema} ${texto}/${fundo}: ${indice}`);
    }
  }
  assert.match(diagnostico,/CONTRASTE_TEXTO_SECUNDARIO/);
  assert.match(diagnostico,/CONTRASTE_RECEITAS_FUNDO/);
  assert.match(diagnostico,/CONTRASTE_DESPESAS_FUNDO/);
});
