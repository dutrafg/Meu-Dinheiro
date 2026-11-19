const assert=require('node:assert/strict');
const test=require('node:test');
const fs=require('node:fs');
const path=require('node:path');

const read=name=>fs.readFileSync(path.join(__dirname,'../dist/modules',name),'utf8');
const carregar=()=>{
  const codigo=read('validacao.js').replace(/^export /gm,'')+'\n'+read('investimentos.js')
    .replace(/^import .*;\s*$/gm,'').replace(/^export /gm,'');
  return import(`data:text/javascript;base64,${Buffer.from(`${codigo}\nexport {adicionarInvestimentoVinculado,editarInvestimentoVinculado,encontrarSalarioAnterior,iniciarInvestimentos,CATEGORIAS_INVESTIMENTO,normalizarDadosLocais,validarBackup};`).toString('base64')}`);
};
const base=()=>({transactions:[],goals:[{id:'g',name:'Reserva',kind:'goal',target:1000,saved:20,deadline:''},
  {id:'d',name:'Viagem',kind:'dream',target:2000,saved:50,deadline:''}],allocations:[],completedAportes:[]});
const aporte=(extras={})=>({id:'a',goalId:'g',description:' Guardar para reserva ',amount:10.235,date:'2026-11-19',category:' Tesouro Direto ',...extras});

test('Aporte antigo aumenta somente a meta escolhida, uma única vez e arredondado em centavos',async()=>{
  const {adicionarInvestimentoVinculado}=await carregar();
  const original=base(),novo=adicionarInvestimentoVinculado(original,aporte());
  assert.equal(novo.goals[0].saved,30.24);
  assert.equal(novo.goals[1].saved,50);
  assert.equal(novo.allocations[0].amount,10.24);
  assert.equal(novo.allocations[0].description,'Guardar para reserva');
  assert.equal(novo.allocations[0].category,'Tesouro Direto');
  assert.equal(novo.allocations[0].kind,'goal');
  assert.equal(novo.allocations[0].origin,'previous');
  assert.equal(novo.transactions.length,0,'investimento não é lançamento de renda/despesa');
  assert.equal(original.goals[0].saved,20,'dados anteriores não são mutados');
  assert.equal(original.allocations.length,0);
});

test('Aporte em sonho é separado de meta e preserva descrição, categoria e data',async()=>{
  const {adicionarInvestimentoVinculado,normalizarDadosLocais,validarBackup}=await carregar();
  const novo=adicionarInvestimentoVinculado(base(),aporte({goalId:'d',category:'Nova categoria',amount:30,date:'2026-01-06'}));
  assert.equal(novo.goals[1].saved,80);
  assert.equal(novo.goals[0].saved,20);
  assert.equal(novo.allocations[0].kind,'dream');
  assert.equal(novo.allocations[0].date,'2026-01-06');
  assert.deepEqual(normalizarDadosLocais(novo).allocations,novo.allocations);
  assert.deepEqual(validarBackup({app:'meu-dinheiro-essencial',version:1,...novo},{income:[],expense:[]}).allocations,novo.allocations);
});

test('Entradas inválidas não alteram o valor guardado, limites e duplicidade são verificados',async()=>{
  const {adicionarInvestimentoVinculado}=await carregar();
  const data=base();
  for(const variation of [
    {goalId:'inexistente'},{description:' '},{amount:0},{amount:-5},{amount:Infinity},
    {amount:1000000000},{date:'2026-02-30'},{category:' '},{id:''},{id:'g'},
    {category:'x'.repeat(121)},{description:'x'.repeat(301)},{origin:'inventado'},{origin:'salary'}
  ]){
    if(variation.id==='g')continue;
    assert.throws(()=>adicionarInvestimentoVinculado(data,aporte(variation)),Error,JSON.stringify(variation));
  }
  assert.equal(data.goals[0].saved,20);
  const preenchido=adicionarInvestimentoVinculado(data,aporte());
  assert.throws(()=>adicionarInvestimentoVinculado(preenchido,aporte()),/Identificador/);
  assert.throws(()=>adicionarInvestimentoVinculado({...data,goals:[{...data.goals[0],saved:999999998}]},aporte()),/limite/);
});

test('Dados históricos sem categoria continuam legíveis e categoria inválida é recusada',async()=>{
  const {normalizarDadosLocais,validarBackup}=await carregar();
  const data=base();
  data.allocations=[{id:'old',goalId:'g',description:'Legado CSV',amount:5,date:'2026-11-19',kind:'goal'}];
  assert.equal(normalizarDadosLocais(data).allocations[0].category,undefined);
  for(const category of ['',null,42,'x'.repeat(121)]){
    const irregular={...data,allocations:[{...data.allocations[0],category}]};
    assert.throws(()=>normalizarDadosLocais(irregular));
    assert.throws(()=>validarBackup({app:'meu-dinheiro-essencial',version:1,...irregular},{income:[],expense:[]}));
  }
});

test('Formulário exige objetivo, oferece categorias reutilizáveis e salva apenas após persistência',async()=>{
  const {iniciarInvestimentos}=await carregar();
  const listeners={};
  const campos=new Map(['id','goalId','description','amount','date','category','origin'].map(name=>[name,{value:'',addEventListener:()=>{}}]));
  const form={elements:{namedItem:name=>campos.get(name)},addEventListener:(nome,fn)=>listeners[nome]=fn};
  const sugestoes={innerHTML:''},nota={textContent:''},titulo={textContent:''},salvar={textContent:''};
  const documento={getElementById:id=>({'investment-category-suggestions':sugestoes,'investment-origin-note':nota,
    'investment-title':titulo,'investment-submit':salvar})[id]};
  let conteudo=base();conteudo.allocations=[{id:'import',goalId:'',description:'Importado',amount:1,date:'2026-11-19',kind:'goal',category:'Minha categoria'}];
  const avisos=[],eventos=[];
  const dialog={showModal:()=>eventos.push('abrir'),close:()=>eventos.push('fechar'),addEventListener:()=>{}};
  const api=iniciarInvestimentos({getData:()=>conteudo,persist:next=>{conteudo=next;return true;},render:()=>eventos.push('render'),
    notify:msg=>avisos.push(msg),registrarEvento:()=>eventos.push('log'),uniqueId:()=> 'novo-id',isoDate:()=> '2026-11-19',
    esc:s=>String(s).replaceAll('&','&amp;'),dialog,form,documento});
  campos.get('description').focus=()=>{};
  assert.equal(api.abrir('g'),true);
  assert.match(sugestoes.innerHTML,/Minha categoria/);
  assert.equal(campos.get('date').value,'2026-11-19');
  assert.equal(campos.get('origin').value,'previous');
  assert.match(nota.textContent,/Nenhum salário/);
  assert.equal(campos.get('goalId').value,'g');
  campos.get('description').value='Aporte teste';
  campos.get('amount').value='25';
  campos.get('category').value='Minha categoria';
  listeners.submit({preventDefault(){}});
  assert.equal(conteudo.goals[0].saved,45);
  assert.equal(conteudo.allocations.at(-1).category,'Minha categoria');
  assert.deepEqual(eventos.slice(-3),['log','fechar','render']);
  assert.equal(avisos.at(-1),'Investimento adicionado ao objetivo.');
  assert.equal(api.editar('novo-id'),true);
  assert.equal(titulo.textContent,'Editar investimento');
  assert.equal(campos.get('id').value,'novo-id');
  campos.get('amount').value='35';
  listeners.submit({preventDefault(){}});
  assert.equal(conteudo.goals[0].saved,55,'edita apenas a diferença de 10');
  assert.equal(conteudo.allocations.length,2,'não cria outro registro ao editar');
  assert.equal(avisos.at(-1),'Investimento atualizado sem duplicar o aporte.');
});

test('Salário é localizado pela data efetiva, inclusive recorrência no fim do mês',async()=>{
  const {encontrarSalarioAnterior}=await carregar();
  const salarios=[{id:'fixo',type:'income',category:'Salário base',description:'Salário',date:'2026-01-31',recurring:true}];
  assert.deepEqual(encontrarSalarioAnterior(salarios,'2026-02-28'),{id:'fixo',date:'2026-02-28',description:'Salário'});
  assert.equal(encontrarSalarioAnterior(salarios,'2026-02-25')?.date,'2026-01-31');
  assert.equal(encontrarSalarioAnterior(salarios,'2026-01-30'),null);
  assert.equal(encontrarSalarioAnterior(salarios,'2026-03-25')?.date,'2026-02-28');
  assert.equal(encontrarSalarioAnterior(salarios,'2026-12-20')?.date,'2026-11-30');
});

test('Aporte do salário vincula lançamento e é validado no armazenamento local',async()=>{
  const {adicionarInvestimentoVinculado,normalizarDadosLocais,validarBackup}=await carregar();
  const dados=base();
  dados.transactions.push({id:'sal',type:'income',description:'Salário mensal',category:'Salário base',amount:2500,date:'2026-11-05',recurring:false,createdAt:'2026-11-05T12:00:00.000Z'});
  const novo=adicionarInvestimentoVinculado(dados,aporte({origin:'salary',amount:200}));
  assert.equal(novo.allocations[0].salaryId,'sal');
  assert.equal(novo.allocations[0].salaryDate,'2026-11-05');
  assert.equal(novo.allocations[0].origin,'salary');
  assert.equal(novo.goals[0].saved,220);
  assert.deepEqual(normalizarDadosLocais(novo).allocations,novo.allocations);
  assert.deepEqual(validarBackup({app:'meu-dinheiro-essencial',version:1,...novo},{income:['Salário base'],expense:[]}).allocations,novo.allocations);
  assert.throws(()=>adicionarInvestimentoVinculado(dados,aporte({origin:'salary',date:'2026-11-01'})),/Nenhum salário/);
  const ruim={...novo,allocations:[{...novo.allocations[0],salaryDate:'2026-02-30'}]};
  assert.throws(()=>normalizarDadosLocais(ruim));
});

test('Editar investimento corrige o valor sem duplicar registro ou alterar lançamentos',async()=>{
  const {adicionarInvestimentoVinculado,editarInvestimentoVinculado}=await carregar();
  const original=base(),aporteInicial=adicionarInvestimentoVinculado(original,aporte({amount:30}));
  const alterado=editarInvestimentoVinculado(aporteInicial,aporte({amount:35,category:'Ações',description:'Reclassificado'}));
  assert.equal(aporteInicial.goals[0].saved,50);
  assert.equal(alterado.goals[0].saved,55);
  assert.equal(alterado.allocations.length,1);
  assert.equal(alterado.allocations[0].id,'a');
  assert.equal(alterado.allocations[0].category,'Ações');
  assert.equal(alterado.transactions.length,0);
  const diminuido=editarInvestimentoVinculado(alterado,aporte({amount:10}));
  assert.equal(diminuido.goals[0].saved,30);
  assert.equal(diminuido.allocations[0].amount,10);
});

test('Mover investimento de meta para sonho ajusta os dois saldos, preservando histórico',async()=>{
  const {adicionarInvestimentoVinculado,editarInvestimentoVinculado,normalizarDadosLocais}=await carregar();
  const inicial=adicionarInvestimentoVinculado(base(),aporte({amount:40}));
  const movido=editarInvestimentoVinculado(inicial,aporte({goalId:'d',amount:50,date:'2026-11-18',category:'Poupança'}));
  assert.equal(movido.goals[0].saved,20);
  assert.equal(movido.goals[1].saved,100);
  assert.equal(movido.allocations[0].kind,'dream');
  assert.equal(movido.allocations[0].goalId,'d');
  assert.equal(normalizarDadosLocais(movido).allocations.length,1);
  assert.equal(inicial.goals[0].saved,60,'edição não altera estado anterior');
});

test('Editar pode alterar origem de salário para investimento antigo e vice-versa',async()=>{
  const {adicionarInvestimentoVinculado,editarInvestimentoVinculado}=await carregar();
  const dados=base();
  dados.transactions.push({id:'sal',type:'income',description:'Salário mensal',category:'Salário base',amount:3000,date:'2026-11-05',recurring:false});
  const inicial=adicionarInvestimentoVinculado(dados,aporte({amount:200,origin:'salary'}));
  const historico=editarInvestimentoVinculado(inicial,aporte({amount:200,origin:'previous'}));
  assert.equal(historico.allocations[0].origin,'previous');
  assert.equal(historico.allocations[0].salaryId,undefined);
  assert.equal(historico.allocations[0].salaryDate,undefined);
  assert.equal(historico.goals[0].saved,220);
  const restaurado=editarInvestimentoVinculado(historico,aporte({amount:200,origin:'salary'}));
  assert.equal(restaurado.allocations[0].salaryId,'sal');
});

test('Editar rejeita dados inválidos ou meta com saldo já menor que o aporte original',async()=>{
  const {adicionarInvestimentoVinculado,editarInvestimentoVinculado}=await carregar();
  const inicial=adicionarInvestimentoVinculado(base(),aporte({amount:30}));
  assert.throws(()=>editarInvestimentoVinculado(inicial,aporte({id:'inexistente'})),/não encontrado/);
  assert.throws(()=>editarInvestimentoVinculado(inicial,aporte({date:'2026-02-30'})),/Confira/);
  assert.throws(()=>editarInvestimentoVinculado(inicial,aporte({goalId:'falso'})),/Escolha/);
  const insuficiente={...inicial,goals:inicial.goals.map(g=>g.id==='g'?{...g,saved:10}:g)};
  assert.throws(()=>editarInvestimentoVinculado(insuficiente,aporte()),/menor que o aporte/);
  assert.equal(inicial.goals[0].saved,50);
});
