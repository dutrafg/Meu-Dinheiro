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
    // Compara conteúdo real no IndexedDB sem expô-lo no log de testes.
    const aguardarEspelho=(pagina=page)=>pagina.waitForFunction(async()=>{
      const pedido=indexedDB.open('meu-dinheiro-financeiro',1);
      const db=await new Promise((resolve,reject)=>{
        pedido.onsuccess=()=>resolve(pedido.result);
        pedido.onerror=()=>reject(pedido.error);
      });
      try{
        const transacao=db.transaction('snapshots','readonly');
        const consulta=transacao.objectStore('snapshots').get('principal');
        const registro=await new Promise((resolve,reject)=>{
          consulta.onsuccess=()=>resolve(consulta.result);
          consulta.onerror=()=>reject(consulta.error);
        });
        return registro?.versao===1&&registro.conteudo===localStorage.getItem('meu-dinheiro-essencial:v1');
      }finally{db.close();}
    },null,{timeout:8000});
    await aguardarEspelho();
    const lerEstadoEspelho=pagina=>pagina.evaluate(async()=>{
      const abertura=indexedDB.open('meu-dinheiro-financeiro',1);
      const db=await new Promise((resolve,reject)=>{
        abertura.onsuccess=()=>resolve(abertura.result);
        abertura.onerror=()=>reject(abertura.error);
      });
      try{
        const consulta=db.transaction('snapshots','readonly').objectStore('snapshots').get('principal');
        const registro=await new Promise((resolve,reject)=>{
          consulta.onsuccess=()=>resolve(consulta.result);
          consulta.onerror=()=>reject(consulta.error);
        });
        return {apagado:registro?.apagado===true,semConteudo:registro?.conteudo===undefined,
          marcadorPresente:typeof registro?.marcador==='string',versao:registro?.versao??null};
      }finally{db.close();}
    });
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

    // P2.2: preferências ficam isoladas do snapshot financeiro e refletem no Resumo.
    assert.match(await page.locator('.proto-budget-card').innerText(),/Defina um limite mensal/);
    await page.locator('.proto-budget-heading [data-view="ajustes"]').click();
    await page.locator('#settings-monthly-limit').fill('2600');
    await page.locator('#settings-monthly-saving').fill('300');
    await page.locator('#settings-monthly-saving').dispatchEvent('change');
    await page.waitForFunction(()=>JSON.parse(localStorage.getItem('meu-dinheiro-essencial:preferencias:v1')||'{}').metaPoupancaMensal===300);
    assert.equal(JSON.parse(await page.evaluate(()=>localStorage.getItem('meu-dinheiro-essencial:v1'))).transactions.length,2);
    await page.locator('.desktop-nav [data-view="resumo"]').click();
    assert.match(await page.locator('.proto-budget-card').innerText(),/Limite R\$\s*2\.600,00/);
    assert.match(await page.locator('.proto-budget-card').innerText(),/Meta de economia mensal/);
    await page.locator('.desktop-nav [data-view="relatorios"]').click();
    assert.equal(await page.locator('.forecast-table tbody tr').count(),12);
    assert.match(await page.locator('#forecast-content').innerText(),/Próximos 12 meses/);
    await page.locator('#annual-panel summary').click();
    assert.equal(await page.locator('#annual-content .annual-bar-month').count(),12);
    assert.match(await page.locator('#annual-content').innerText(),/Aportes registrados/);
    assert.equal(await page.locator('#annual-content [data-annual-share]').count(),1);
    await page.locator('.desktop-nav [data-view="resumo"]').click();

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
    await page.waitForFunction(()=>!document.getElementById('investment-dialog').open);
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
    await page.waitForFunction(()=>!document.getElementById('investment-dialog').open);
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
    await page.waitForFunction(()=>!document.getElementById('investment-dialog').open);
    gravado=await page.evaluate(()=>JSON.parse(localStorage.getItem('meu-dinheiro-essencial:v1')));
    assert.equal(gravado.goals[1].saved,110,'A edição aplica somente a diferença de 40 reais');
    assert.equal(gravado.allocations.length,2,'A edição não duplica investimentos');
    assert.equal(gravado.allocations[1].description,'Aporte antigo corrigido');

    await page.setViewportSize({width:390,height:844});
    assert.equal(await page.locator('#desktop-toolbar').isVisible(),false);
    assert.equal(await page.locator('#quick-add').isVisible(),true);
    assert.equal(await page.locator('#mobile-quick-actions').count(),0,
      'A barra fixa Gastei/Recebi foi removida; o botão + continua disponível');
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
      if(tipo==='expense'){
        const valor=page.locator('#transaction-form [name="amount"]');
        assert.equal(await page.locator('#transaction-dialog .transaction-amount-field').isVisible(),true);
        assert.equal(await valor.evaluate(el=>!el.readOnly&&el.inputMode==='decimal'),true,
          'Campo de valor móvel aceita o teclado numérico do sistema');
        assert.equal(await page.locator('#transaction-dialog [data-money-key], #transaction-keyboard-mode, #transaction-keypad-display').count(),0,
          'Nenhum teclado próprio deve disputar espaço com o teclado do celular');
        await valor.fill('12.34');
        assert.equal(await valor.inputValue(),'12.34');
        await page.locator('#transaction-category-tiles [data-mobile-category]').first().click();
        assert.equal(await valor.inputValue(),'12.34',
          'Escolher categoria não deve modificar valor digitado no teclado nativo');
      }
      await page.locator(`#${dialogo} .close-dialog`).first().click();
    }
    await page.locator('#quick-add').click();
    await page.keyboard.press('Escape');
    await page.waitForFunction(()=>document.getElementById('quick-add').getAttribute('aria-expanded')==='false');
    assert.equal(await page.locator('#mobile-create-dialog').evaluate(el=>el.open),false,
      'Esc encerra o diálogo nativo e o botão volta ao estado recolhido');
    await page.locator('.mobile-nav [data-view="metas"]').click();
    await page.locator('[data-objective-tab="goal"]').click();
    await page.locator('.proto-challenge summary').click();
    await page.locator('[data-action="challenge-create"]').click();
    assert.equal(await page.locator('#goal-form [name="target"]').inputValue(),'2756');
    assert.equal(await page.locator('#goal-form [name="name"]').inputValue(),'Desafio das 52 semanas');
    await page.locator('#goal-form [type="submit"]').click();
    await page.waitForFunction(()=>!document.getElementById('goal-dialog').open);
    await page.locator('.proto-challenge summary').click();
    assert.equal(await page.locator('.challenge-grid button').count(),52);
    await page.locator('[data-action="challenge-week"][data-week="1"]').click();
    assert.equal(await form.locator('[name="amount"]').inputValue(),'2');
    assert.equal(await form.locator('[name="category"]').inputValue(),'Desafio 52 semanas');
    assert.equal(await form.locator('[name="origin"]').inputValue(),'','A origem do aporte semanal exige escolha');
    await form.locator('[name="origin"]').selectOption('previous');
    await form.getByRole('button',{name:'Salvar investimento'}).click();
    await page.waitForFunction(()=>!document.getElementById('investment-dialog').open);
    await page.locator('.proto-challenge summary').click();
    assert.equal(await page.locator('[data-action="challenge-week"][data-week="1"]').isDisabled(),true);
    assert.match(await page.locator('.challenge-summary').innerText(),/1 de 52 semanas confirmadas/);
    for(const largura of [320,384,390,768]){
      await page.setViewportSize({width:largura,height:844});
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),true,
        `Sem rolagem horizontal da página em ${largura}px`);
      assert.equal(await page.locator('.mobile-nav .nav-button').count(),6);
      const medidasNav=await page.evaluate(()=>[...document.querySelectorAll('#mobile-nav .nav-button')]
        .map(botao=>{
          const b=botao.getBoundingClientRect();
          const rotulo=botao.querySelector('span')?.getBoundingClientRect();
          const icone=botao.querySelector('svg')?.getBoundingClientRect();
          return {rotuloDentro:!!rotulo&&rotulo.left>=b.left-1&&rotulo.right<=b.right+1,
            empilhado:!!rotulo&&!!icone&&rotulo.top>=icone.bottom-1,
            largura:b.width};
        }));
      assert.equal(medidasNav.every(b=>b.rotuloDentro&&b.empilhado&&b.largura>0),true,
        `Ícones e nomes das seis abas não podem se sobrepor em ${largura}px`);
    }
    await page.setViewportSize({width:390,height:844});
    await page.locator('[data-objective-tab="dream"]').click();
    assert.equal(await page.locator('[data-objective-tab="dream"]').getAttribute('aria-pressed'),'true',
      'A aba Sonhos fica acessível dentro de Objetivos no celular');
    await page.locator('details.proto-history summary').click();
    assert.equal(await page.locator('[data-action="edit-investment"]').count(),1,
      'Investimentos anteriores continuam editáveis no smartphone');
    await page.locator('.mobile-nav [data-view="ajustes"]').click();
    assert.equal(await page.locator('#quick-add').isVisible(),false);
    assert.match(await page.locator('#reports-tools-title').innerText(),/Exportar, importar e compartilhar/);
    for(const id of ['export-pdf','export-csv','import-csv','export-data','import-data'])
      assert.equal(await page.locator('#'+id).count(),1,'Ferramenta disponível nos Ajustes: '+id);
    assert.match(await page.locator('.settings-tools summary').innerText(),/Atualizações do aplicativo/);
    // Ao tocar em Tirar/Mostrar no meio da lista, o mesmo botão e a rolagem permanecem.
    const opcoesCategoria=page.locator('#category-manager-list [data-category-toggle]');
    assert.ok(await opcoesCategoria.count()>10,'Categorias suficientes para testar rolagem móvel');
    const botaoCategoria=opcoesCategoria.nth(10);
    await botaoCategoria.scrollIntoViewIfNeeded();
    const rolagemCategoria=await page.evaluate(()=>window.scrollY);
    const nodoCategoria=await botaoCategoria.elementHandle();
    await botaoCategoria.click();
    assert.equal(await nodoCategoria.evaluate(el=>el.isConnected&&el.textContent==='Mostrar'),true,
      'Ocultar categoria mantém o botão no lugar sem recriar a lista');
    assert.ok(Math.abs((await page.evaluate(()=>window.scrollY))-rolagemCategoria)<=3,
      'Tirar categoria não pode levar a página de volta ao topo');
    await botaoCategoria.click();
    assert.equal(await nodoCategoria.evaluate(el=>el.isConnected&&el.textContent==='Tirar'),true,
      'Mostrar reutiliza o mesmo botão e preserva as outras categorias');
    assert.ok(Math.abs((await page.evaluate(()=>window.scrollY))-rolagemCategoria)<=3,
      'Mostrar categoria também preserva a rolagem');
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),true,'Sem barra horizontal no celular');
    await aguardarEspelho(); // Mesmo após criar e editar lançamentos, as duas cópias coincidem.
    assert.deepEqual(erros,[],'Nenhuma exceção de JavaScript no navegador');
    // Contexto separado: a exclusão ocorre apenas sobre dados fictícios.
    const contextoLimpeza=await browser.newContext({viewport:{width:1280,height:800},serviceWorkers:'block'});
    const paginaLimpeza=await contextoLimpeza.newPage();
    await paginaLimpeza.goto(`http://127.0.0.1:${servidor.address().port}/`);
    await paginaLimpeza.locator('#desktop-create-trigger').waitFor();
    await paginaLimpeza.evaluate(d=>localStorage.setItem('meu-dinheiro-essencial:v1',JSON.stringify(d)),dados);
    await paginaLimpeza.reload();
    await paginaLimpeza.locator('#desktop-create-trigger').waitFor();
    await aguardarEspelho(paginaLimpeza);
    await paginaLimpeza.locator('.desktop-nav [data-view="ajustes"]').click();
    await paginaLimpeza.locator('#settings-danger-title').click();
    await paginaLimpeza.locator('#delete-all-data').click();
    await paginaLimpeza.locator('#confirmation-accept').click();
    await paginaLimpeza.locator('#delete-data-phrase').fill('APAGAR');
    await paginaLimpeza.locator('#delete-data-confirm').click();
    await paginaLimpeza.waitForFunction(()=>localStorage.getItem('meu-dinheiro-essencial:v1')===null);
    const marcador=await lerEstadoEspelho(paginaLimpeza);
    assert.deepEqual(marcador,{apagado:true,semConteudo:true,marcadorPresente:true,versao:1},
      'Exclusão cria tombstone sem conteúdo financeiro no IndexedDB');
    await paginaLimpeza.reload();
    await paginaLimpeza.locator('#desktop-create-trigger').waitFor();
    assert.equal(await paginaLimpeza.evaluate(()=>localStorage.getItem('meu-dinheiro-essencial:v1')),null,
      'Reabrir o aplicativo não ressuscita dados excluídos');
    assert.equal((await lerEstadoEspelho(paginaLimpeza)).apagado,true,'Tombstone persiste após recarregar');
    await paginaLimpeza.locator('#desktop-create-trigger').click();
    await paginaLimpeza.locator('#desktop-create-menu [data-create-kind="income"]').click();
    const novoLancamento=paginaLimpeza.locator('#transaction-form');
    await novoLancamento.locator('[name="description"]').fill('Cadastro após exclusão fictícia');
    await novoLancamento.locator('[name="amount"]').fill('80');
    await novoLancamento.locator('[name="date"]').fill('2026-11-19');
    await novoLancamento.locator('[name="category"]').selectOption({index:1});
    await novoLancamento.locator('button[type="submit"]').click();
    await aguardarEspelho(paginaLimpeza);
    assert.equal((await lerEstadoEspelho(paginaLimpeza)).apagado,false,
      'Novo cadastro legítimo substitui o marcador somente após inicialização segura');
    await contextoLimpeza.close();

    // Conflito sintético em perfil isolado: o assistente apenas inspeciona e exporta.
    const contextoConflito=await browser.newContext({viewport:{width:1280,height:800},serviceWorkers:'block',acceptDownloads:true});
    const paginaConflito=await contextoConflito.newPage();
    await paginaConflito.goto(`http://127.0.0.1:${servidor.address().port}/`);
    await paginaConflito.locator('#desktop-create-trigger').waitFor();
    await paginaConflito.evaluate(async base=>{
      const local={...base,transactions:base.transactions.map((t,i)=>i===0?{...t,description:'Origem local fictícia'}:t)};
      const indexado={...base,transactions:base.transactions.map((t,i)=>i===0?{...t,description:'Origem IndexedDB fictícia'}:t)};
      localStorage.setItem('meu-dinheiro-essencial:v1',JSON.stringify(local));
      const abertura=indexedDB.open('meu-dinheiro-financeiro',1);
      const db=await new Promise((resolve,reject)=>{
        abertura.onupgradeneeded=()=>{if(!abertura.result.objectStoreNames.contains('snapshots'))abertura.result.createObjectStore('snapshots');};
        abertura.onsuccess=()=>resolve(abertura.result);
        abertura.onerror=()=>reject(abertura.error);
      });
      await new Promise((resolve,reject)=>{
        const tx=db.transaction('snapshots','readwrite');
        tx.objectStore('snapshots').put({conteudo:JSON.stringify(indexado),versao:1,atualizadoEm:Date.now()},'principal');
        tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);
      });
      db.close();
    },dados);
    await paginaConflito.reload();
    await paginaConflito.locator('.desktop-nav [data-view="ajustes"]').click();
    await paginaConflito.locator('#settings-recovery-title').click();
    await paginaConflito.locator('#recovery-inspect').click();
    await paginaConflito.waitForFunction(()=>document.getElementById('recovery-status').textContent.includes('As cópias são diferentes'));
    assert.equal(await paginaConflito.locator('#recovery-download-local').isEnabled(),true);
    assert.equal(await paginaConflito.locator('#recovery-download-indexeddb').isEnabled(),true);
    const [downloadLocal]=await Promise.all([
      paginaConflito.waitForEvent('download'),paginaConflito.locator('#recovery-download-local').click()
    ]);
    assert.match(downloadLocal.suggestedFilename(),/recuperacao-local-/);
    const [downloadIndex]=await Promise.all([
      paginaConflito.waitForEvent('download'),paginaConflito.locator('#recovery-download-indexeddb').click()
    ]);
    assert.match(downloadIndex.suggestedFilename(),/recuperacao-indexeddb-/);
    await paginaConflito.locator('#recovery-choice').selectOption('local');
    await paginaConflito.locator('#recovery-apply').click();
    await paginaConflito.locator('#confirmation-accept').click();
    await paginaConflito.locator('#confirmation-accept').click();
    await paginaConflito.waitForFunction(()=>
      document.getElementById('recovery-status').textContent.includes('Cópia escolhida recuperada'));
    await paginaConflito.locator('#recovery-inspect').click();
    await paginaConflito.waitForFunction(()=>
      document.getElementById('recovery-status').textContent.includes('sincronizadas'));
    const intactas=await paginaConflito.evaluate(async()=>{
      const local=localStorage.getItem('meu-dinheiro-essencial:v1');
      const abertura=indexedDB.open('meu-dinheiro-financeiro',1);
      const db=await new Promise(resolve=>{abertura.onsuccess=()=>resolve(abertura.result);});
      const pedido=db.transaction('snapshots','readonly').objectStore('snapshots').get('principal');
      const registro=await new Promise(resolve=>{pedido.onsuccess=()=>resolve(pedido.result);});
      db.close();
      return {local:Boolean(local?.includes('Origem local fictícia')),
        idb:Boolean(registro?.conteudo?.includes('Origem local fictícia'))};
    });
    assert.deepEqual(intactas,{local:true,idb:true},'A escolha confirmou uma única origem após ambos os downloads');
    // Após a migração, IndexedDB continua primário mesmo sem a chave espelho.
    await paginaConflito.evaluate(()=>localStorage.removeItem('meu-dinheiro-essencial:v1'));
    await paginaConflito.reload();
    await paginaConflito.locator('#desktop-create-trigger').waitFor();
    await paginaConflito.locator('#desktop-create-trigger').click();
    await paginaConflito.locator('#desktop-create-menu [data-create-kind="income"]').click();
    const cadastroPrimario=paginaConflito.locator('#transaction-dialog');
    await cadastroPrimario.locator('[name="description"]').fill('Renda após reabrir IndexedDB');
    await cadastroPrimario.locator('[name="amount"]').fill('15');
    await cadastroPrimario.locator('[name="date"]').fill('2026-11-20');
    await cadastroPrimario.locator('[name="category"]').selectOption({index:1});
    await cadastroPrimario.locator('button[type="submit"]').click();
    await aguardarEspelho(paginaConflito);
    const persistiu=await paginaConflito.evaluate(async()=>{
      const local=localStorage.getItem('meu-dinheiro-essencial:v1');
      const db=await new Promise(resolve=>{
        const req=indexedDB.open('meu-dinheiro-financeiro',1);
        req.onsuccess=()=>resolve(req.result);
      });
      const tx=db.transaction('snapshots','readonly');
      const req=tx.objectStore('snapshots').get('principal');
      const registro=await new Promise(resolve=>{req.onsuccess=()=>resolve(req.result);});
      db.close();
      return {idb:registro.primario===true&&registro.conteudo.includes('Renda após reabrir IndexedDB'),
        local:Boolean(local?.includes('Renda após reabrir IndexedDB'))};
    });
    assert.deepEqual(persistiu,{idb:true,local:true},'IDB primário mantém dados e recompõe espelho local');
    // Importação OFX também atravessa a gravação indexada antes de encerrar o diálogo.
    await paginaConflito.locator('.desktop-nav [data-view="ajustes"]').click();
    const ofxFicticio='<OFX><STMTTRN><DTPOSTED>20261121<TRNAMT>-12.34<FITID>ofx-e2e-01<NAME>Mercado OFX fictício</STMTTRN></OFX>';
    await paginaConflito.locator('#csv-import-file').setInputFiles({
      name:'extrato-ficticio.ofx',mimeType:'application/x-ofx',buffer:Buffer.from(ofxFicticio)
    });
    await paginaConflito.locator('#csv-confirm-import').click();
    await paginaConflito.waitForFunction(()=>JSON.parse(localStorage.getItem('meu-dinheiro-essencial:v1')||'{}')
      .transactions?.some(t=>t.importKey==='ofx:ofx-e2e-01'));
    await paginaConflito.waitForFunction(()=>!document.getElementById('csv-preview-dialog').open);
    await aguardarEspelho(paginaConflito);
    // Backup JSON restaurado substitui as coleções somente após duas confirmações.
    const restauracao={app:'meu-dinheiro-essencial',version:1,...dados};
    await paginaConflito.locator('#import-file').setInputFiles({
      name:'backup-ficticio.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(restauracao))
    });
    await paginaConflito.locator('#confirmation-accept').click();
    await paginaConflito.locator('#confirmation-accept').click();
    await paginaConflito.waitForFunction(()=>JSON.parse(localStorage.getItem('meu-dinheiro-essencial:v1')||'{}')
      .transactions?.length===2);
    await aguardarEspelho(paginaConflito);
    await contextoConflito.close();

    // P2 completo: dados fictícios em perfil isolado. Cadastro, aviso, pagamento,
    // edição do catálogo, cópia restaurável, privacidade e 4 larguras.
    const contextoP2=await browser.newContext({viewport:{width:1440,height:900},serviceWorkers:'block',acceptDownloads:true});
    await contextoP2.addInitScript(entrada=>{if(!localStorage.getItem('meu-dinheiro-essencial:v1'))localStorage.setItem('meu-dinheiro-essencial:v1',JSON.stringify(entrada));},dados);
    const paginaP2=await contextoP2.newPage(),falhasP2=[];
    paginaP2.on('pageerror',err=>falhasP2.push(err.message));
    await paginaP2.goto(`http://127.0.0.1:${servidor.address().port}/`);
    await paginaP2.locator('#desktop-create-trigger').waitFor();
    await aguardarEspelho(paginaP2);
    await paginaP2.locator('.desktop-nav [data-view="relatorios"]').click();
    const hojeP2=await paginaP2.evaluate(()=>{const d=new Date();return {mes:`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`,dia:d.getDate()};});
    const cadastrarCompromisso=async(tipo,nome,valor,quantidade)=>{
      await paginaP2.locator('#commitment-new').click();
      const form=paginaP2.locator('#commitment-form');
      await form.locator('[name="kind"]').selectOption(tipo);
      await form.locator('[name="name"]').fill(nome);
      await form.locator('[name="amount"]').fill(String(valor));
      await form.locator('[name="day"]').fill(String(hojeP2.dia));
      await form.locator('[name="startMonth"]').fill(hojeP2.mes);
      if(quantidade)await form.locator('[name="monthsCount"]').fill(String(quantidade));
      await form.locator('button[type="submit"]').click();
      await paginaP2.waitForFunction(t=>JSON.parse(localStorage.getItem('meu-dinheiro-essencial:v1')||'{}').commitments?.some(c=>c.name===t),nome);
    };
    await cadastrarCompromisso('bill','Luz fictícia',160,null);
    await cadastrarCompromisso('card','Geladeira fictícia',189.90,7);
    assert.equal(await paginaP2.locator('#commitments-content .commitment-row').count()>=2,true);
    assert.match(await paginaP2.locator('#commitments-content').innerText(),/1\.329,30|1.329,30/,
      'O cartão calcula o total de sete parcelas ainda pendentes');
    await paginaP2.locator('#reminder-button').click();
    assert.match(await paginaP2.locator('#reminder-list').innerText(),/Luz fictícia|Geladeira fictícia/);
    await paginaP2.locator('#reminder-dialog .close-dialog').first().click();
    await paginaP2.locator('#commitments-content [data-commitment-pay]').first().click();
    await paginaP2.locator('#confirmation-accept').click();
    await paginaP2.waitForFunction(()=>JSON.parse(localStorage.getItem('meu-dinheiro-essencial:v1')||'{}').transactions?.some(t=>t.commitmentId));
    const estadoP2=await paginaP2.evaluate(()=>JSON.parse(localStorage.getItem('meu-dinheiro-essencial:v1')));
    assert.equal(estadoP2.commitments.length,2);
    assert.equal(estadoP2.transactions.filter(t=>t.commitmentId).length,1);
    assert.equal(estadoP2.transactions.find(t=>t.commitmentId).recurring,false);
    assert.match(await paginaP2.locator('#commitments-content').innerText(),/Paga ✓/);
    await paginaP2.locator('.desktop-nav [data-view="ajustes"]').click();
    await paginaP2.locator('#category-manager-name').fill('Mercado fictício');
    await paginaP2.locator('#category-manager-icon').selectOption('🛒');
    await paginaP2.locator('#category-manager-save').click();
    await paginaP2.waitForFunction(()=>JSON.parse(localStorage.getItem('meu-dinheiro-essencial:preferencias:v1')||'{}').categoriasExtras?.expense?.includes('Mercado fictício'));
    assert.equal(await paginaP2.locator('#category-manager-list').getByText(/Mercado fictício/).count(),1);
    await paginaP2.locator('.category-manager-item').filter({hasText:'Mercado fictício'}).locator('[data-category-edit]').click();
    await paginaP2.locator('#category-manager-name').fill('Compras fictícias');
    await paginaP2.locator('#category-manager-save').click();
    await paginaP2.waitForFunction(()=>JSON.parse(localStorage.getItem('meu-dinheiro-essencial:preferencias:v1')||'{}').categoriasExtras?.expense?.includes('Compras fictícias'));
    const renamed=paginaP2.locator('.category-manager-item').filter({hasText:'Compras fictícias'});
    await renamed.locator('[data-category-toggle]').click();
    await paginaP2.waitForFunction(()=>JSON.parse(localStorage.getItem('meu-dinheiro-essencial:preferencias:v1')||'{}').categoriasOcultas?.expense?.includes('Compras fictícias'));
    await renamed.locator('[data-category-toggle]').click();
    await paginaP2.waitForFunction(()=>!JSON.parse(localStorage.getItem('meu-dinheiro-essencial:preferencias:v1')||'{}').categoriasOcultas?.expense?.includes('Compras fictícias'));
    assert.equal(await paginaP2.evaluate(()=>JSON.parse(localStorage.getItem('meu-dinheiro-essencial:v1')).transactions.length),3,
      'Alterar categoria não reclassifica lançamentos antigos');
    for(const largura of [320,390,768,1440]){
      await paginaP2.setViewportSize({width:largura,height:850});
      assert.equal(await paginaP2.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+2),true,
        `Overflow horizontal na área Ajustes em ${largura}px`);
    }
    await paginaP2.setViewportSize({width:1440,height:900});
    await paginaP2.locator('.desktop-nav [data-view="relatorios"]').click();
    assert.match(await paginaP2.locator('#forecast-content').innerText(),/Próximos 12 meses/);
    const [copiaP2]=await Promise.all([paginaP2.waitForEvent('download'),paginaP2.locator('#export-data').click()]);
    const jsonP2=JSON.parse(fs.readFileSync(await copiaP2.path(),'utf8'));
    assert.equal(jsonP2.commitments.length,2,'Backup JSON inclui contas e cartão');
    assert.equal(jsonP2.preferences.categoriasExtras.expense.includes('Compras fictícias'),true,'Backup inclui categorias personalizadas');
    await aguardarEspelho(paginaP2);
    await paginaP2.reload();
    await paginaP2.locator('.desktop-nav [data-view="relatorios"]').click();
    assert.match(await paginaP2.locator('#commitments-content').innerText(),/Geladeira fictícia/);
    assert.equal(falhasP2.length,0,`Erros JavaScript durante P2: ${falhasP2.join('; ')}`);
    await contextoP2.close();

    // Offline real: primeiro popula o cache com internet, depois corta a conexão
    // do navegador e recarrega o app do Service Worker, sem mock de fetch.
    const contextoOffline=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'allow'});
    await contextoOffline.addInitScript(entrada=>{
      if(!localStorage.getItem('meu-dinheiro-essencial:v1'))
        localStorage.setItem('meu-dinheiro-essencial:v1',JSON.stringify(entrada));
    },dados);
    const paginaOffline=await contextoOffline.newPage(),errosOffline=[];
    paginaOffline.on('pageerror',erro=>errosOffline.push(erro.message));
    await paginaOffline.goto(`http://127.0.0.1:${servidor.address().port}/`);
    await paginaOffline.locator('#mobile-nav [data-view="resumo"]').waitFor();
    await aguardarEspelho(paginaOffline);
    await paginaOffline.evaluate(()=>navigator.serviceWorker.ready);
    await paginaOffline.waitForFunction(async()=>{
      const nomes=await caches.keys();
      const atual=nomes.find(nome=>/^meu-dinheiro-essencial-v\d+$/.test(nome));
      if(!atual)return false;
      const cache=await caches.open(atual);
      return Boolean(await cache.match('./index.html'))&&Boolean(await cache.match('./app.js'))&&
        Boolean(await cache.match('./modules/diagnostico.js'));
    },null,{timeout:20000});
    // A primeira navegação pode preceder a ativação; uma visita online captura o controlador.
    if(!await paginaOffline.evaluate(()=>Boolean(navigator.serviceWorker.controller)))
      await paginaOffline.reload({waitUntil:'domcontentloaded'});
    await paginaOffline.waitForFunction(()=>Boolean(navigator.serviceWorker.controller));
    const integridadeCache=await paginaOffline.evaluate(async()=>{
      const cache=await caches.open((await caches.keys()).find(nome=>nome.startsWith('meu-dinheiro-essencial-v')));
      const arquivos=['./index.html','./app.js','./styles.css','./manifest.webmanifest','./icon-192.png',
        './modules/repositorio-financeiro.js','./modules/notificacoes.js','./modules/diagnostico.js'];
      return (await Promise.all(arquivos.map(arquivo=>cache.match(arquivo)))).every(Boolean);
    });
    assert.equal(integridadeCache,true,'PWA possui entrada, estilos, scripts, manifesto e ícone em cache');
    await contextoOffline.setOffline(true);
    await paginaOffline.reload({waitUntil:'domcontentloaded'});
    await paginaOffline.locator('#mobile-nav [data-view="resumo"]').waitFor();
    assert.match(await paginaOffline.locator('body').innerText(),/Resumo|Reserva|Salário/i);
    await paginaOffline.locator('#mobile-nav [data-view="renda"]').click();
    assert.match(await paginaOffline.locator('body').innerText(),/Salário fictício/);
    await paginaOffline.locator('#mobile-nav [data-view="despesas"]').click();
    assert.match(await paginaOffline.locator('body').innerText(),/Despesa fictícia/);
    await paginaOffline.locator('#mobile-nav [data-view="ajustes"]').click();
    assert.equal(await paginaOffline.locator('#open-diagnostics').isVisible(),true,
      'Diagnóstico fica visível em Ajustes sem expandir Atualizações');
    assert.equal(await paginaOffline.locator('#open-diagnostics').evaluate(el=>el.closest('details')===null),true,
      'Botão de diagnóstico não pode ficar escondido em seção recolhida');
    await paginaOffline.locator('#open-diagnostics').click();
    await paginaOffline.waitForFunction(()=>document.getElementById('diagnostics-dialog').open);
    // O relatório usa caches.match, não fetch: deve inspecionar os arquivos desconectado.
    await paginaOffline.waitForFunction(()=>document.getElementById('diagnostics-progress-label')?.textContent?.includes('Diagnóstico concluído'),null,{timeout:40000});
    const statusOffline=await paginaOffline.evaluate(()=>{
      const grupos=[...document.querySelectorAll('.diagnostics-group')];
      const offline=grupos.find(g=>g.querySelector('summary')?.textContent?.startsWith('offline'));
      return {texto:offline?.innerText||'',erros:offline?.querySelectorAll('.diagnostics-erro').length||0,
        encontrados:offline?.querySelectorAll('.diagnostics-ok').length||0};
    });
    assert.equal(statusOffline.erros,0,'Os recursos essenciais não podem falhar no diagnóstico offline');
    assert.ok(statusOffline.encontrados>=14,'O diagnóstico offline precisa conferir os arquivos reais');
    await paginaOffline.locator('#diagnostics-dialog .close-dialog').first().click();
    const valorPreservado=await paginaOffline.evaluate(()=>JSON.parse(localStorage.getItem('meu-dinheiro-essencial:v1'))?.transactions?.length);
    assert.equal(valorPreservado,2,'Dados locais permanecem acessíveis após recarga sem rede');
    await aguardarEspelho(paginaOffline);
    assert.equal(errosOffline.length,0,`Erros JavaScript offline: ${errosOffline.join('; ')}`);
    await contextoOffline.setOffline(false);
    await paginaOffline.reload({waitUntil:'domcontentloaded'});
    await paginaOffline.locator('#mobile-nav [data-view="resumo"]').waitFor();
    await contextoOffline.close();

    // Validação do HTML portátil: abrir como arquivo local com o navegador offline.
    const saidaOffline=path.join(__dirname,'../meu-dinheiro-teste.html');
    require('node:child_process').execFileSync(process.execPath,[path.join(__dirname,'gerar-html-teste.cjs'),saidaOffline]);
    const contextoHtml=await browser.newContext({viewport:{width:390,height:844},offline:true,serviceWorkers:'block'});
    const paginaHtml=await contextoHtml.newPage(),errosHtml=[];
    paginaHtml.on('pageerror',erro=>errosHtml.push(erro.message));
    await paginaHtml.goto(`file://${saidaOffline}`);
    await paginaHtml.locator('#offline-validation-run').click();
    await paginaHtml.waitForFunction(()=>document.getElementById('diagnostics-dialog').open);
    await paginaHtml.waitForFunction(()=>document.getElementById('diagnostics-progress-label')?.textContent?.includes('Diagnóstico concluído'),null,{timeout:40000});
    const htmlTeste=await paginaHtml.evaluate(()=>[...document.querySelectorAll('.diagnostics-group')]
      .flatMap(grupo=>[...grupo.querySelectorAll('.diagnostics-check')].map(item=>item.textContent)));
    assert.ok(htmlTeste.some(texto=>texto.includes('Nenhum script, folha de estilos')),
      'O HTML independente deve comprovar ausência de dependências de rede');
    assert.ok(htmlTeste.some(texto=>texto.includes('Lógica do aplicativo incorporada')),
      'O HTML independente deve comprovar scripts embutidos');
    const regressaoDiagnostico=await paginaHtml.evaluate(()=>{
      const grupos=[...document.querySelectorAll('.diagnostics-group')];
      const orcamento=grupos.find(g=>g.querySelector('summary')?.textContent?.startsWith('orcamento'));
      const interfaceGrupo=grupos.find(g=>g.querySelector('summary')?.textContent?.startsWith('interface'));
      const propostaGrupo=grupos.find(g=>g.querySelector('summary')?.textContent?.startsWith('proposta interface'));
      return {orcamentoOk:orcamento?.querySelectorAll('.diagnostics-ok').length===1,
        relatoriosOk:[...(interfaceGrupo?.querySelectorAll('.diagnostics-ok')||[])].some(item=>
          item.textContent.includes('PDF, CSV, importação e backup estão disponíveis em Relatórios')),
        semDuplicacao:[...(interfaceGrupo?.querySelectorAll('.diagnostics-ok')||[])].some(item=>
          item.textContent.includes('Ajustes não duplica controles financeiros de Relatórios')),
        diagnosticoDireto:[...(propostaGrupo?.querySelectorAll('.diagnostics-ok')||[])].some(item=>
          item.textContent.includes('Diagnóstico acessível diretamente a partir da página Ajustes'))};
    });
    assert.deepEqual(regressaoDiagnostico,{orcamentoOk:true,relatoriosOk:true,semDuplicacao:true,diagnosticoDireto:true},
      'Os erros reais recebidos no JSON devem permanecer corrigidos no HTML offline');
    assert.equal(errosHtml.length,0,`Erros JavaScript no HTML independente: ${errosHtml.join('; ')}`);
    await contextoHtml.close();
    console.log('E2E desktop, smartphone, P2, PWA realmente offline (cache e recarga), HTML file:// sem rede, tombstone, OFX e backup JSON: validados.');
  }finally{
    if(browser)await browser.close();
    await new Promise(resolve=>servidor.close(resolve));
  }
}
verificar().catch(erro=>{console.error(erro);process.exitCode=1;});
