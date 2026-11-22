// Teste visual funcional opcional: requer Playwright e Chromium instalados.
// Utiliza somente dados fictícios e servidor efêmero; não acessa dados pessoais.
const assert=require('node:assert/strict');
const http=require('node:http');
const fs=require('node:fs');
const path=require('node:path');
const {chromium}=require('playwright');

const pasta=path.resolve(__dirname,'../dist');
const tipos={'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.json':'application/json','.webmanifest':'application/manifest+json','.png':'image/png'};
const dados={transactions:[
  {id:'salario-teste',type:'income',description:'Salário fictício',amount:2500,date:'2026-11-05',category:'Salário base',recurring:false,createdAt:'2026-11-05T12:00:00.000Z'},
  {id:'despesa-teste',type:'expense',description:'Despesa fictícia',amount:400,date:'2026-11-08',category:'Moradia',recurring:false,createdAt:'2026-11-08T12:00:00.000Z'}
],goals:[
  {id:'meta-teste',kind:'goal',name:'Reserva fictícia',target:1000,saved:100,deadline:''},
  {id:'sonho-teste',kind:'dream',name:'Viagem fictícia',target:2000,saved:20,deadline:''}
],allocations:[],completedAportes:[]};

async function verificar(){
  const servidor=http.createServer((req,res)=>{
    let requisicao;
    try{requisicao=decodeURIComponent(new URL(req.url,'http://localhost').pathname);}catch{res.writeHead(400).end();return;}
    const arquivo=path.resolve(pasta,`.${requisicao==='/'?'/index.html':requisicao}`);
    if(!arquivo.startsWith(pasta+path.sep)){res.writeHead(403).end();return;}
    fs.readFile(arquivo,(erro,conteudo)=>{
      if(erro){res.writeHead(404).end();return;}
      res.writeHead(200,{'Content-Type':tipos[path.extname(arquivo)]||'application/octet-stream'}).end(conteudo);
    });
  });
  await new Promise(resolve=>servidor.listen(0,'127.0.0.1',resolve));
  let browser;
  try{
    const binario=process.env.CHROMIUM_BIN||(process.platform==='linux'&&fs.existsSync('/usr/bin/chromium')?'/usr/bin/chromium':undefined);
    browser=await chromium.launch({...(binario?{executablePath:binario}:{}),headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
    const contexto=await browser.newContext({viewport:{width:1440,height:900},serviceWorkers:'block'});
    await contexto.addInitScript(dadosIniciais=>{
      if(!localStorage.getItem('meu-dinheiro-essencial:v1'))localStorage.setItem('meu-dinheiro-essencial:v1',JSON.stringify(dadosIniciais));
    },dados);
    const page=await contexto.newPage(),erros=[];
    page.on('pageerror',erro=>erros.push(erro.message));
    await page.goto(`http://127.0.0.1:${servidor.address().port}/`);
    await page.locator('#desktop-create-trigger').waitFor();
    const logInicial=await page.evaluate(()=>JSON.parse(sessionStorage.getItem('meu-dinheiro-essencial:diagnostico-sessao')||'[]'));
    assert.ok(logInicial.some(e=>e.nivel==='evento'&&e.codigo==='SESSAO_INICIADA'&&e.modulo==='sistema'),
      'O aplicativo inicia com telemetria técnica da sessão ativada');
    assert.ok(logInicial.every(e=>!Object.keys(e).some(c=>!['t','nivel','codigo','modulo'].includes(c))),
      'A telemetria não contém campos financeiros nem descrições');
    assert.equal(await page.locator('#desktop-toolbar').evaluate(el=>getComputedStyle(el).position),'sticky');
    assert.equal(await page.locator('#desktop-toolbar').evaluate(el=>el.getBoundingClientRect().width>=window.innerWidth*.9),true,
      'A barra dos seis módulos ocupa a largura útil do desktop');
    assert.equal(await page.locator('.finance-calendar-day').count(),0,'O calendário não ocupa a tela Resumo');
    await page.locator('[data-calendar-open]').click();
    assert.equal(await page.locator('#finance-calendar-dialog').evaluate(el=>el.open),true);
    assert.equal(await page.locator('.finance-calendar-day').count(),30);
    await page.locator('[data-calendar-day="2026-11-05"]').click();
    assert.equal(await page.locator('#calendar-day-dialog').evaluate(el=>el.open),true);
    assert.match(await page.locator('#calendar-day-content').innerText(),/Salário fictício/);
    await page.locator('#calendar-day-dialog .close-dialog').first().click();
    await page.locator('#finance-calendar-dialog [data-calendar-month="1"]').click();
    assert.equal(await page.locator('.finance-calendar-day').count(),31,'Navegação do diálogo avança para dezembro');
    assert.match(await page.locator('#finance-calendar-content').innerText(),/dezembro de 2026/);
    await page.locator('#finance-calendar-dialog [data-calendar-month="-1"]').click();
    await page.locator('#finance-calendar-dialog .close-dialog').click();
    await page.evaluate(()=>window.scrollTo(0,850));
    assert.equal(Math.round((await page.locator('#desktop-toolbar').boundingBox()).y),0);
    await page.evaluate(()=>window.scrollTo(0,0));
    assert.equal(await page.locator('[aria-label="Resumo da reserva"]').count(),1);
    assert.equal(await page.locator('[aria-label="Resumo dos sonhos"]').count(),1);

    await page.locator('#desktop-create-trigger').click();
    await page.locator('#desktop-create-menu [data-create-kind="investment"]').click();
    const form=page.locator('#investment-form');
    await form.locator('[name="description"]').fill('Aporte do salário fictício');
    await form.locator('[name="amount"]').fill('300');
    await form.locator('[name="date"]').fill('2026-11-19');
    await form.locator('[name="category"]').fill('Nova categoria pessoal');
    assert.equal(await form.locator('[name="origin"]').inputValue(),'','A origem não pode ser presumida pelo aplicativo');
    await form.locator('[name="origin"]').selectOption('salary');
    await form.getByRole('button',{name:'Salvar investimento'}).click();
    assert.equal(await page.locator('#investment-dialog').evaluate(el=>el.open),false);
    assert.match(await page.locator('.proto-today-balance-value').innerText(),/1.800,00/);
    let gravado=await page.evaluate(()=>JSON.parse(localStorage.getItem('meu-dinheiro-essencial:v1')));
    assert.equal(gravado.goals[0].saved,400);
    assert.equal(gravado.allocations[0].salaryId,'salario-teste');
    assert.equal(gravado.allocations[0].category,'Nova categoria pessoal');

    await page.locator('.desktop-nav [data-view="metas"]').click();
    await page.locator('[data-objective-tab="dream"]').click();
    assert.equal(await page.locator('[data-objective-tab="dream"]').getAttribute('aria-pressed'),'true',
      'A aba Sonhos fica acessível dentro de Objetivos no desktop');
    await page.locator('[data-action="add-investment"]').click();
    assert.equal(await form.locator('[name="goalId"]').inputValue(),'sonho-teste');
    await form.locator('[name="description"]').fill('Aporte antigo para viagem');
    await form.locator('[name="amount"]').fill('50');
    await form.locator('[name="date"]').fill('2026-01-05');
    await form.locator('[name="category"]').fill('Nova categoria pessoal');
    assert.equal(await form.locator('[name="origin"]').inputValue(),'','Investimento antigo exige escolha explícita');
    await form.locator('[name="origin"]').selectOption('previous');
    await form.getByRole('button',{name:'Salvar investimento'}).click();
    gravado=await page.evaluate(()=>JSON.parse(localStorage.getItem('meu-dinheiro-essencial:v1')));
    assert.equal(gravado.goals[1].saved,70);
    assert.equal(gravado.allocations[1].origin,'previous');

    await page.locator('details.proto-history summary').click();
    await page.locator('[data-action="edit-investment"][data-id]').last().click();
    assert.equal(await form.locator('[name="description"]').inputValue(),'Aporte antigo para viagem');
    assert.equal(await form.locator('[name="origin"]').inputValue(),'previous');
    await form.locator('[name="description"]').fill('Aporte antigo corrigido');
    await form.locator('[name="amount"]').fill('90');
    await form.getByRole('button',{name:'Salvar alterações'}).click();
    gravado=await page.evaluate(()=>JSON.parse(localStorage.getItem('meu-dinheiro-essencial:v1')));
    assert.equal(gravado.goals[1].saved,110,'A edição aplica somente a diferença de 40 reais');
    assert.equal(gravado.allocations.length,2,'A edição não duplica investimentos');
    assert.equal(gravado.allocations[1].description,'Aporte antigo corrigido');

    await page.setViewportSize({width:390,height:844});
    assert.equal(await page.locator('#desktop-toolbar').isVisible(),false);
    assert.equal(await page.locator('#quick-add').isVisible(),true);
    await page.locator('.mobile-nav [data-view="resumo"]').click();
    assert.equal(await page.locator('[aria-label="Resumo da reserva"]').count(),1);
    assert.equal(await page.locator('[aria-label="Resumo dos sonhos"]').count(),1);
    assert.equal(await page.locator('#finance-calendar-dialog').evaluate(el=>el.open),false,
      'No celular o calendário permanece fechado até ser solicitado');
    await page.locator('[data-calendar-open]').click();
    assert.equal(await page.locator('.finance-calendar-day').count(),30);
    assert.equal(await page.locator('#finance-calendar-dialog').isVisible(),true);
    await page.locator('#finance-calendar-dialog .close-dialog').click();
    for(const [tipo,dialogo] of [['income','transaction-dialog'],['expense','transaction-dialog'],
      ['goal','goal-dialog'],['dream','goal-dialog'],['investment','investment-dialog']]){
      await page.locator('#quick-add').click();
      assert.equal(await page.locator('#mobile-create-dialog').evaluate(el=>el.open),true);
      assert.equal(await page.locator('#mobile-create-dialog [data-create-kind]').count(),5);
      await page.locator(`#mobile-create-dialog [data-create-kind="${tipo}"]`).click();
      assert.equal(await page.locator('#mobile-create-dialog').evaluate(el=>el.open),false);
      assert.equal(await page.locator(`#${dialogo}`).evaluate(el=>el.open),true,`Cadastro móvel de ${tipo}`);
      await page.locator(`#${dialogo} .close-dialog`).first().click();
    }
    await page.locator('#quick-add').click();
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('#quick-add').getAttribute('aria-expanded'),'false');
    await page.locator('.mobile-nav [data-view="metas"]').click();
    await page.locator('[data-objective-tab="dream"]').click();
    assert.equal(await page.locator('[data-objective-tab="dream"]').getAttribute('aria-pressed'),'true',
      'A aba Sonhos fica acessível dentro de Objetivos no celular');
    await page.locator('details.proto-history summary').click();
    assert.equal(await page.locator('[data-action="edit-investment"]').count(),1,
      'Investimentos anteriores continuam editáveis no smartphone');
    await page.locator('.mobile-nav [data-view="ajustes"]').click();
    assert.equal(await page.locator('#quick-add').isVisible(),false);
    assert.match(await page.locator('.settings-tools summary').innerText(),/PDF, CSV, importação e backup/);
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),true,'Sem barra horizontal no celular');
    assert.deepEqual(erros,[],'Nenhuma exceção de JavaScript no navegador');
    console.log('E2E desktop + mobile: navegação, calendário, cinco cadastros pelo +, edição de investimentos, saldo e layout validados.');
  }finally{
    if(browser)await browser.close();
    await new Promise(resolve=>servidor.close(resolve));
  }
}
verificar().catch(erro=>{console.error(erro);process.exitCode=1;});
