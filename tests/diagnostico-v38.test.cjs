const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const os=require('node:os');
const {execFileSync}=require('node:child_process');

const root=path.resolve(__dirname,'..');
const read=file=>fs.readFileSync(path.join(root,file),'utf8');

function contrastChecks(text,sub,card){
  const scope={
    window:{
      MeuDinheiroV33Orcamento:{},MeuDinheiroV33Previsao:{},MeuDinheiroDesignV32Domain:{},
      MeuDinheiroDiagnosticoHub:{registrar:()=>true}
    },
    document:{getElementById:id=>id==='diagnostics-dialog'?{}:null},
    getComputedStyle:()=>({getPropertyValue:key=>({'--text':text,'--sub':sub,'--card':card}[key]||'')})
  };
  vm.runInNewContext(read('preview-v33/ui/diagnostico.js'),scope);
  return scope.window.MeuDinheiroV33Diagnostico.run().filter(item=>['V33_TEMA_TEXTO','V33_TEMA_SUB'].includes(item.code));
}

test('Contraste v33 reconhece #fff e mantém limite WCAG de 4,5:1',()=>{
  assert.equal(contrastChecks('#172135','#647084','#fff').filter(item=>item.status==='ok').length,2);
  assert.equal(contrastChecks('#eff2f7','#a2acc0','#1a1d24').filter(item=>item.status==='ok').length,2);
  assert.equal(contrastChecks('#e7e7e7','#eeeeee','#fff').filter(item=>item.status==='falha').length,2,
    'Baixo contraste real precisa continuar reprovado');
});

test('Relatório não confunde HTML independente com falha do Service Worker',()=>{
  const source=read('dist/modules/diagnostico.js');
  assert.match(source,/const htmlIndependente=/);
  for(const check of ['SW_ATIVO','SW_CONTROLE','CACHE_PWA'])assert.match(source,new RegExp(`adicionar\\('${check}','nao_avaliado'`));
  assert.match(source,/htmlIndependente\?'nao_avaliado':'aviso'/);
  assert.match(source,/fundosPermitidos=escuro\?/);
  assert.match(source,/motorVisivel===update\.versaoEmExecucao/);
  const html=read('dist/index.html');
  assert.ok(html.indexOf('id="reports-page"')>=0&&html.indexOf('id="reports-page"')<html.indexOf('id="settings-page"'));
  assert.match(html,/id="export-pdf"/);
});

test('Módulo v38 entra na mesma central sem criar painel ou exportação próprios',()=>{
  const registro=[];
  const scope={
    window:{MeuDinheiroDiagnosticoHub:{registrar:(nome,run,count)=>{registro.push({nome,run,count});return true},quantidade:()=>6}},
    document:{getElementById:()=>null,querySelector:()=>null,querySelectorAll:()=>[]}
  };
  vm.runInNewContext(read('preview-v38/ui/diagnostico.js'),scope);
  assert.equal(registro.length,1);
  assert.equal(registro[0].nome,'regressoes-relatorio-v38');
  assert.equal(registro[0].count,7);
  assert.equal(scope.window.MeuDinheiroV38Diagnostico.count,7);
  assert.doesNotMatch(read('preview-v38/ui/diagnostico.js'),/createElement|appendChild|createObjectURL/);
});

test('Prévia v38 autônoma contém scripts completos sem depender de CDNs',()=>{
  const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'md-v38-'));
  try{
    const file=path.join(tmp,'v38.html');
    execFileSync(process.execPath,[path.join(root,'scripts/gerar-html-design-v38.cjs'),file]);
    const html=fs.readFileSync(file,'utf8');
    assert.match(html,/Meu Dinheiro — v38 Diagnóstico Corrigido/);
    assert.doesNotMatch(html,/<script\s+src=/);
    for(const name of ['versao.js','diagnostico.js']){
      const script=html.match(new RegExp(`<script data-preview-v38="ui/${name.replaceAll('.','\\.')}"\\s*>\\n([\\s\\S]*?)<\\/script>`));
      assert.ok(script,`${name} presente`);
      assert.doesNotThrow(()=>new vm.Script(script[1]));
    }
  }finally{fs.rmSync(tmp,{recursive:true,force:true});}
});

test('Homologação v38 publicada preserva a página estável modular',()=>{
  const homologacao=read('dist/homologacao-v38.html');
  assert.match(homologacao,/Meu Dinheiro — v38 Diagnóstico Corrigido/);
  assert.match(homologacao,/data-preview-v38="ui\/diagnostico.js"/);
  assert.match(read('dist/index.html'),/<script type="module" src="\.\/app\.js"><\/script>/);
});
