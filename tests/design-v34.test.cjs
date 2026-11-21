const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {Script}=require('node:vm');
const {execFileSync}=require('node:child_process');

const root=path.resolve(__dirname,'..');
const files=name=>fs.readFileSync(path.join(root,name),'utf8');
const budget=require('../preview-v33/domain/orcamento.js');
const month=require('../preview-v32/domain.js');

test('Contas domésticas brasileiras incluem tributos, serviços, casa, escola e saúde',async()=>{
  const {CATEGORIAS_DESPESA}=await import('../dist/modules/categorias-brasileiras.js');
  const categories=new Set(CATEGORIAS_DESPESA);
  const expected=['Aluguel','Financiamento imobiliário','Condomínio','IPTU','Água e esgoto','Energia elétrica','Gás de cozinha',
    'Supermercado','Feira e hortifruti','Transporte público','Combustível','IPVA','Seguro do veículo','Plano de saúde',
    'Farmácia','Escola e mensalidade','Faculdade','Material escolar','Internet','Celular e plano móvel',
    'Cartão de crédito','Empréstimos','Tarifas bancárias','Streaming e assinaturas','Pets','Outros'];
  for(const category of expected)assert.ok(categories.has(category),category);
  assert.ok(categories.size>=55);
});

test('Categorias novas agrupadas não duplicam categorias antigas dos backups',async()=>{
  const {CATEGORIAS_DESPESA,GRUPOS_DESPESA,CATEGORIAS_RENDA}=await import('../dist/modules/categorias-brasileiras.js');
  assert.equal(new Set(CATEGORIAS_DESPESA).size,CATEGORIAS_DESPESA.length);
  assert.equal(GRUPOS_DESPESA.length,6);
  assert.deepEqual(CATEGORIAS_DESPESA,GRUPOS_DESPESA.flatMap(group=>group.categorias));
  for(const legacy of ['Moradia','Contas','Alimentação','Saúde','Educação','Transporte','Compras','Outros'])assert.ok(CATEGORIAS_DESPESA.includes(legacy));
  for(const legacy of ['Salário base','Personal','Salário','Vendas','Benefícios'])assert.ok(CATEGORIAS_RENDA.includes(legacy));
});

test('Seletor de despesa apresenta as 6 famílias de contas em optgroups',async()=>{
  const {renderizarOpcoesDespesas,CATEGORIAS_DESPESA,GRUPOS_DESPESA}=await import('../dist/modules/categorias-brasileiras.js');
  const html=renderizarOpcoesDespesas(text=>text.replaceAll('&','&amp;'));
  assert.equal((html.match(/<optgroup/g)||[]).length,6);
  assert.equal((html.match(/<option value=/g)||[]).length,CATEGORIAS_DESPESA.length);
  for(const group of GRUPOS_DESPESA)assert.ok(html.includes(group.titulo));
});

test('Categorias específicas entram no orçamento e suas despesas permanecem separadas',()=>{
  const entries=month.monthlyEntries([
    {id:'1',type:'income',amount:3000,category:'Salário base',date:'2026-11-05'},
    {id:'2',type:'expense',amount:130,category:'Energia elétrica',date:'2026-11-08'},
    {id:'3',type:'expense',amount:80,category:'Água e esgoto',date:'2026-11-12'},
    {id:'4',type:'expense',amount:250,category:'Energia elétrica',date:'2026-11-26'}
  ],'2026-11');
  const rows=budget.evaluate(entries,[{category:'Energia elétrica',limitCent:30000},{category:'Água e esgoto',limitCent:10000}],'2026-11-21');
  const luz=rows.find(row=>row.category==='Energia elétrica');
  assert.equal(luz.spentCent,13000);
  assert.equal(luz.scheduledCent,25000);
  assert.equal(rows.find(row=>row.category==='Água e esgoto').spentCent,8000);
  assert.equal(month.summary(entries,'2026-11-31').income,3000);
});

test('Novos estilos preservam seletor mensal e gráfico real em vez de dados fictícios',()=>{
  const home=files('preview-v34/ui/resumo-fiel.js');
  assert.match(home,/\.proto-today-balance-value/);
  assert.match(home,/domain|group\.monthlyEntries/);
  assert.match(home,/forecast\.forecast/);
  assert.match(home,/data-calendar-open/);
  assert.match(home,/className='v34-advanced'/);
  assert.doesNotMatch(home,/localStorage\.setItem\('meu-dinheiro-essencial:v1'/);
});

test('Cadastro rápido reutiliza o form original, com teclado e botão de repetir',()=>{
  const source=files('preview-v34/ui/cadastro-rapido.js');
  for(const text of ['transaction-form','data-v34-key','data-v34-category','data-v34-date','v34-save-another','form.requestSubmit()'])assert.ok(source.includes(text));
  assert.doesNotMatch(source,/localStorage\.setItem|fetch\(/);
  assert.match(source,/new Event\('input'/);
});

test('Movimentos recebem filtros de categoria e recorrência sem remover edição/exclusão',()=>{
  const source=files('preview-v32/design.js');
  for(const text of ['design-movement-category','design-movement-recurring','data-action="edit"','data-action="delete"','domain.groupedEntries'])assert.ok(source.includes(text));
});

test('Metas mantêm os investimentos originais e ganham anéis calculados do valor salvo',()=>{
  const source=files('preview-v34/ui/metas-fieis.js');
  assert.match(source,/proto-goal-track\[aria-valuenow\]/);
  assert.match(source,/data-action="add-investment"/);
  assert.match(source,/v34-goal-ring/);
  assert.doesNotMatch(source,/localStorage\.setItem/);
});

test('Diagnóstico extra tem cobertura das novas telas e preserva os 25 segundos de animação',()=>{
  const source=files('preview-v34/ui/diagnostico.js');
  const checks=[...source.matchAll(/\['(V34_[A-Z0-9_]+)'/g)].map(match=>match[1]);
  assert.ok(checks.length>=20);
  assert.equal(checks.length,new Set(checks).size);
  for(const key of ['V34_CATALOGO','V34_CALENDARIO','V34_ORCAMENTO','V34_TECLADO','V34_METAS','V34_FILTROS','V34_INTEGRIDADE'])assert.ok(checks.includes(key));
  assert.match(source,/25 segundos/);
  assert.match(source,/diagnostics-run/);
});

test('CSS contempla contraste temático, responsividade e teclas de 40 px ou maiores',()=>{
  const source=['styles.css','cadastro.css','metas.css'].map(name=>files(`preview-v34/ui/${name}`)).join('\n');
  assert.match(source,/@media\(max-width:599px\)/);
  assert.match(source,/var\(--accent-text\)/);
  assert.match(source,/min-height:40px/);
  assert.match(source,/\.v34-home/);
  assert.match(source,/\.v34-goal-ring/);
});

test('HTML completo v34 embute todos os módulos sem links, imports externos ou dados pessoais',()=>{
  const temp=fs.mkdtempSync(path.join(os.tmpdir(),'meu-dinheiro-v34-'));
  try{
    const output=path.join(temp,'v34.html');
    execFileSync(process.execPath,[path.join(root,'scripts/gerar-html-design-v34.cjs'),output]);
    const html=fs.readFileSync(output,'utf8');
    assert.match(html,/<title>Meu Dinheiro — v34 Design e Contas Brasileiras<\/title>/);
    assert.match(html,/id="design-v34-css"/);
    assert.doesNotMatch(html,/<script\s+src=/);
    assert.doesNotMatch(html,/<link[^>]+rel="stylesheet"/);
    for(const module of ['resumo-fiel.js','cadastro-rapido.js','metas-fieis.js','diagnostico.js']){
      const regex=new RegExp(`<script data-preview-v34="ui/${module.replaceAll('.','\\.')}"\\s*>\\n([\\s\\S]*?)<\\/script>`);
      const match=html.match(regex);
      assert.ok(match,`${module} não embutido`);
      assert.doesNotThrow(()=>new Script(match[1],{filename:module}));
    }
    assert.match(html,/MeuDinheiroCategoriasBrasileiras/);
    assert.match(html,/v34-diagnostic-panel/);
  }finally{fs.rmSync(temp,{recursive:true,force:true});}
});

test('Gerador é determinístico e mantém estilos da versão anterior',()=>{
  const temp=fs.mkdtempSync(path.join(os.tmpdir(),'meu-dinheiro-v34-repeat-'));
  try{
    const first=path.join(temp,'um.html'),second=path.join(temp,'dois.html');
    execFileSync(process.execPath,[path.join(root,'scripts/gerar-html-design-v34.cjs'),first]);
    execFileSync(process.execPath,[path.join(root,'scripts/gerar-html-design-v34.cjs'),second]);
    assert.equal(fs.readFileSync(first,'utf8'),fs.readFileSync(second,'utf8'));
    const html=fs.readFileSync(first,'utf8');
    assert.match(html,/id="design-v32-css"/);
    assert.match(html,/id="design-v33-css"/);
    assert.match(html,/id="design-v34-css"/);
  }finally{fs.rmSync(temp,{recursive:true,force:true});}
});
