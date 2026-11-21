const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const os=require('node:os');
const vm=require('node:vm');
const {execFileSync}=require('node:child_process');
const root=path.resolve(__dirname,'..');
const read=file=>fs.readFileSync(path.join(root,file),'utf8');

function juntar(){
  const source=read('dist/modules/diagnostico.js');
  const start=source.indexOf('export function unificarResultadosDiagnosticos');
  const end=source.indexOf('export function iniciarDiagnostico',start);
  assert.ok(start>=0&&end>start);
  const clock=n=>Math.min(25000,5000+Math.max(0,Math.trunc(n)-9)*500);
  return new Function('calcularDuracaoDiagnostico',`${source.slice(start,end).replace(/^export /gm,'')}\nreturn unificarResultadosDiagnosticos;`)(clock);
}

const base=()=>({formatoRelatorio:3,integridade:{itens:[
  {codigo:'CORE_OK',modulo:'dados',estado:'ok',descricao:'Dados válidos'},
  {codigo:'CORE_AVISO',modulo:'sistema',estado:'aviso',descricao:'Aviso técnico'}
],erros:0,avisos:1}});

test('Junção conserva todos os testes e cria uma única contagem de erros, avisos e duração',()=>{
  const original=base();const frozen=JSON.stringify(original);
  const report=juntar()(original,[
    {nome:'orcamento-previsao-v33',esperados:2,resultados:[
      {code:'V33_PRIMEIRO',description:'Primeiro teste',status:'ok'},
      {code:'V33_SEGUNDO',description:'Falha constatada',status:'falha'}]},
    {nome:'visual-contas-v34',esperados:1,resultados:[
      {code:'V34_PRIMEIRO',description:'Teste visual',status:'ok'}]}
  ]);
  assert.equal(JSON.stringify(original),frozen,'O resultado principal original não é alterado');
  assert.equal(report.formatoRelatorio,4);
  assert.equal(report.integridade.itens.length,5);
  assert.equal(report.integridade.erros,1);
  assert.equal(report.integridade.avisos,1);
  assert.equal(report.integridade.naoAvaliados,0);
  assert.equal(report.complementos.total,3);
  assert.equal(report.complementos.modulos[0].aprovados,1);
  assert.equal(report.integridade.itens.find(item=>item.codigo==='V33_SEGUNDO').modulo,'orcamento-previsao-v33');
  assert.equal(report.duracaoPrevistaMs,5000);
});

test('Testes faltantes e códigos duplicados não somem silenciosamente',()=>{
  const report=juntar()(base(),[
    {nome:'visual-contas-v34',esperados:2,resultados:[{code:'CORE_OK',description:'ID duplicado',status:'ok'}]},
    {nome:'interface-compacta-v36',esperados:1,resultados:[]}
  ]);
  assert.equal(report.integridade.itens.length,5);
  assert.equal(report.integridade.erros,3);
  assert.equal(report.integridade.avisos,1);
  assert.equal(report.complementos.modulos.reduce((total,item)=>total+item.erros,0),3);
  assert.equal(report.complementos.modulos.reduce((total,item)=>total+item.total,0),3);
});

test('Animação consolidada continua limitada a 25 segundos mesmo com muitos testes',()=>{
  const many=Array.from({length:500},(_,i)=>({code:`V37_SIMULACAO_${i}`,description:'Teste de volume',status:'ok'}));
  const report=juntar()(base(),[{nome:'diagnostico-unificado-v37',esperados:500,resultados:many}]);
  assert.equal(report.integridade.itens.length,502);
  assert.equal(report.integridade.erros,0);
  assert.equal(report.duracaoPrevistaMs,25000);
});

test('Itens não aplicáveis permanecem visíveis sem virar avisos artificiais',()=>{
  const report=juntar()({...base(),integridade:{itens:[{codigo:'SW_ATIVO',modulo:'pwa',estado:'nao_avaliado',descricao:'HTML independente'}],erros:0,avisos:0}},[]);
  assert.equal(report.integridade.itens.length,1);
  assert.equal(report.integridade.avisos,0);
  assert.equal(report.integridade.naoAvaliados,1);
});

test('Todos os cinco módulos se registram sem criar cartões adicionais',()=>{
  const registry=new Map();
  const hub={registrar(name,run,count){assert.ok(!registry.has(name));registry.set(name,{run,count});return true;},quantidade:()=>registry.size};
  const scope={
    window:{MeuDinheiroDiagnosticoHub:hub,MeuDinheiroV33Orcamento:{},MeuDinheiroV33Previsao:{},MeuDinheiroDesignV32Domain:{},MeuDinheiroCategoriasBrasileiras:{}},
    document:{getElementById:()=>({}),querySelector:()=>null,querySelectorAll:()=>[]},
    Intl,Date,Object,Set,Map
  };
  for(const file of ['preview-v33/ui/diagnostico.js','preview-v34/ui/diagnostico.js','preview-v35/ui/diagnostico.js','preview-v36/ui/diagnostico.js','preview-v37/ui/diagnostico.js']){
    assert.doesNotThrow(()=>vm.runInNewContext(read(file),scope,{filename:file}));
  }
  assert.equal(registry.size,5);
  assert.deepEqual([...registry.values()].map(item=>item.count),[17,21,19,12,8]);
  assert.equal([...registry.values()].reduce((n,item)=>n+item.count,0),77);
});

test('UI mostra um único aviso de privacidade e um botão para baixar relatório completo',()=>{
  const html=read('dist/index.html');
  assert.equal((html.match(/class="diagnostics-privacy"/g)||[]).length,1);
  assert.match(html,/id="diagnostics-export"[^>]+>Baixar JSON completo/);
  assert.match(html,/id="diagnostics-run"[^>]+>Executar novamente/);
});

test('HTML completo v37 carrega os módulos e versiona a central única',()=>{
  const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'md-v37-'));
  try{
    const file=path.join(tmp,'test.html');
    execFileSync(process.execPath,[path.join(root,'scripts/gerar-html-design-v37.cjs'),file]);
    const html=fs.readFileSync(file,'utf8');
    assert.match(html,/Meu Dinheiro — v37 Diagnóstico Unificado/);
    assert.match(html,/id="design-v37-css"/);
    assert.match(html,/data-preview-v37="ui\/diagnostico.js"/);
    assert.doesNotMatch(html,/<script\s+src=/);
    for(const name of ['versao.js','diagnostico.js']){
      const script=html.match(new RegExp(`<script data-preview-v37="ui/${name.replaceAll('.','\\.')}"\\s*>\\n([\\s\\S]*?)<\\/script>`));
      assert.ok(script,name);
      assert.doesNotThrow(()=>new vm.Script(script[1]));
    }
  }finally{fs.rmSync(tmp,{recursive:true,force:true});}
});
