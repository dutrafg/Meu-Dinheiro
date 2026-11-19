import './csv.js';
import './analytics.js';
import './folder-backup.js';
import { criarModuloResumo } from './modules/resumo.js';
import { criarModuloLancamentos } from './modules/lancamentos.js';
import { criarModuloObjetivos } from './modules/objetivos.js';
import { iniciarModuloBackup } from './modules/backup.js';
import { iniciarModuloCsv } from './modules/csv-interface.js';
import { validarDataISO, validarBackup, normalizarDadosLocais, podeAplicarNoObjetivo } from './modules/validacao.js';
import { iniciarAtualizador } from './modules/atualizador.js';
import { iniciarDialogos } from './modules/dialogos.js';
import { iniciarDiagnostico } from './modules/diagnostico.js';
import { registrar, registrarEvento, configurarDetalhado, modoDetalhado, obterLogs } from './modules/log.js';
import { criarGestorPreferencias } from './modules/preferencias.js';
import { calcularAporte, calcularPlanoAporte } from './modules/regras-financeiras.js';
import { iniciarAjustes, aplicarAparencia } from './modules/ajustes.js';
import { registrarModulosDoApp } from './modules/registro-modulos.js';
import { criarModuloSaude } from './modules/saude.js';
import { criarModuloNotificacoes } from './modules/notificacoes.js';
import { iniciarRelatorioPdf } from './modules/relatorio-pdf.js';
import { iniciarLimpezaDados, apagarDadosLocais } from './modules/limpeza-dados.js';
import { iniciarAcaoRapida } from './modules/acao-rapida.js';
import { iniciarInvestimentos } from './modules/investimentos.js';
import { criarModuloCalendarioFinanceiro, renderBotaoCalendario } from './modules/calendario-financeiro.js';
// Bibliotecas existentes continuam disponíveis para o PWA e para os testes Node.

(() => {
  'use strict';
  const KEY = 'meu-dinheiro-essencial:v1';
  const CDI_KEY = 'meu-dinheiro-essencial:cdi-oficial';
  const dialogos = iniciarDialogos();
  const CATEGORIES = {
    income: ['Salário base', 'Personal', 'Salário', 'Renda extra', 'Vendas', 'Benefícios', 'Outros'],
    expense: ['Moradia', 'Alimentação', 'Contas', 'Internet', 'Telefone', 'Cartão de crédito', 'Faculdade', 'Farmácia', 'Cursos', 'Transporte', 'Saúde', 'Educação', 'Lazer', 'Compras', 'Outros']
  };
  const preferencias = criarGestorPreferencias({storage:localStorage,categoriasRenda:CATEGORIES.income});
  aplicarAparencia(preferencias.obter());
  const NAV = [
    ['resumo', 'Resumo', 'chart-pie'], ['renda', 'Renda', 'wallet'], ['despesas', 'Despesas', 'receipt'],
    ['metas', 'Metas', 'target'], ['sonho', 'Sonho', 'sparkles'], ['ajustes', 'Ajustes', 'settings']
  ];
  // Ícones e categorias adaptados do protótipo Finanças-2.html.
  const CATEGORY_ICONS = {
    'Salário':'💼', 'Salário base':'💼', 'Personal':'🏋️', 'Renda extra':'💻', 'Vendas':'🛍️', 'Benefícios':'🎁',
    'Moradia':'🏠', 'Alimentação':'🍔', 'Contas':'🧾', 'Internet':'🌐', 'Telefone':'📱', 'Cartão de crédito':'💳',
    'Faculdade':'🎓', 'Farmácia':'💊', 'Cursos':'📚', 'Transporte':'🚗',
    'Saúde':'🩺', 'Educação':'📖', 'Lazer':'🎉', 'Compras':'🛍️', 'Outros':'📦'
  };
  const EXPENSE_COLORS = {
    'Outros':'#8998a9', 'Moradia':'#6b86a9', 'Alimentação':'#e5a270', 'Contas':'#7b9eac',
    'Internet':'#61a9d1', 'Telefone':'#77bfd7', 'Cartão de crédito':'#91a5c0',
    'Faculdade':'#568fbe', 'Farmácia':'#77b89f', 'Cursos':'#9a8cc8',
    'Transporte':'#e5ba78', 'Saúde':'#ca8eaa', 'Educação':'#9bb66d',
    'Lazer':'#ab92c9', 'Compras':'#cf9a80'
  };
  const fmt = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
  const fmtMonth = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric', timeZone: 'UTC' });
  const fmtShort = new Intl.DateTimeFormat('pt-BR', { month: 'short', timeZone: 'UTC' });
  const fmtDate = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' });
  const today = new Date();
  const currentMonth = [today.getFullYear(), String(today.getMonth() + 1).padStart(2, '0')].join('-');
  let storageLocked = false;
  let data = readData();
  let view = 'resumo';
  let month = currentMonth;
  let search = '';
  let filterCategory = '';
  let toastTimer;
  let folderBackup = null;
  let cdiQuote = readCdiCache();
  const viewContent = document.getElementById('view-content');
  const settingsPage = document.getElementById('settings-page');
  const transactionDialog = document.getElementById('transaction-dialog');
  const transactionForm = document.getElementById('transaction-form');
  const goalDialog = document.getElementById('goal-dialog');
  const goalForm = document.getElementById('goal-form');
  const investmentDialog = document.getElementById('investment-dialog');
  const investmentForm = document.getElementById('investment-form');
  const financeCalendarDialog = document.getElementById('finance-calendar-dialog');
  const calendarDayDialog = document.getElementById('calendar-day-dialog');
  const reminderDialog = document.getElementById('reminder-dialog');

  function readData() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return { transactions: [], goals: [], allocations: [], completedAportes: [] };
      return normalizarDadosLocais(JSON.parse(raw));
    } catch (error) {
      storageLocked = true;
      registrar('erro','DADOS_LEITURA_FALHOU','dados');
      console.error('Não foi possível ler os dados locais:', error);
      void dialogos.informar('Dados locais protegidos','Os dados locais parecem inconsistentes. A gravação foi bloqueada para preservar o arquivo original. Restaure um backup JSON válido para recuperar o aplicativo.');
      return { transactions: [], goals: [], allocations: [], completedAportes: [] };
    }
  }
  function persist(next, {allowRecovery = false} = {}) {
    if (storageLocked && !allowRecovery) {
      registrar('aviso','DADOS_GRAVACAO_BLOQUEADA','dados');
      void dialogos.informar('Gravação protegida','Os dados originais estão protegidos. Restaure um backup JSON válido antes de gravar novamente.');
      return false;
    }
    try {
      localStorage.setItem(KEY, JSON.stringify(next));
      data = next;
      storageLocked = false;
      folderBackup?.schedule();
      return true;
    } catch (error) {
      registrar('erro','DADOS_GRAVACAO_FALHOU','dados');
      console.error('Falha ao salvar:', error);
      void dialogos.informar('Falha ao salvar','Não foi possível salvar. Verifique o espaço disponível e as permissões do navegador.');
      return false;
    }
  }
  function icon(name) { return `<svg aria-hidden="true"><use href="#i-${name}"></use></svg>`; }
  function esc(value) { return String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]); }
  function money(n) { return fmt.format(Math.round((Number(n) || 0) * 100) / 100); }
  function n2(n) { return Math.round((Number(n) + Number.EPSILON) * 100) / 100; }
  function readCdiCache() {
    try {
      const quote=JSON.parse(localStorage.getItem(CDI_KEY));
      if(quote&&Number.isFinite(quote.dailyPercent)&&quote.dailyPercent>0&&quote.dailyPercent<1&&/^\d{4}-\d{2}-\d{2}$/.test(quote.date)&&Number.isFinite(quote.checkedAt))return quote;
    } catch (_) { /* Consulta opcional: não interfere nos lançamentos. */ }
    return null;
  }
  function validCdiQuote() {
    if(!cdiQuote)return null;
    const observed=new Date(`${cdiQuote.date}T12:00:00Z`).getTime();
    return Number.isFinite(observed)&&Date.now()-observed<14*86400000&&observed<Date.now()+86400000?cdiQuote:null;
  }
  async function refreshCdiSilently() {
    if(cdiQuote&&Date.now()-cdiQuote.checkedAt<24*3600000)return;
    const controller=new AbortController();
    const timeout=setTimeout(()=>controller.abort(),8000);
    try {
      // Série SGS 12: CDI diário em percentual, divulgado pelo Banco Central.
      const response=await fetch('https://api.bcb.gov.br/dados/serie/bcdata.sgs.12/dados/ultimos/10?formato=json',{signal:controller.signal,cache:'no-store'});
      if(!response.ok)throw Error('CDI indisponível');
      const quotes=await response.json();
      if(!Array.isArray(quotes)||!quotes.length)throw Error('Resposta CDI inválida');
      const latest=quotes[quotes.length-1];
      const match=/^(\d{2})\/(\d{2})\/(\d{4})$/.exec(latest.data);
      const dailyPercent=Number(String(latest.valor).replace(',','.'));
      if(!match||!Number.isFinite(dailyPercent)||dailyPercent<=0||dailyPercent>=1)throw Error('Taxa CDI inválida');
      const date=`${match[3]}-${match[2]}-${match[1]}`;
      const quote={dailyPercent,date,checkedAt:Date.now()};
      cdiQuote=quote;
      try{localStorage.setItem(CDI_KEY,JSON.stringify(quote));}catch(_){/* Sem cache. */}
      if(view==='metas')render();
    } catch (_) { /* Estimativa fica oculta se o dado oficial não chegar. */ }
    finally {clearTimeout(timeout);}
  }
  function isoDate(d) { return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; }
  function parseDate(s) { return new Date(`${s}T12:00:00Z`); }
  function shiftMonth(ym, diff) { const [y,m] = ym.split('-').map(Number); const d = new Date(Date.UTC(y,m-1+diff,1)); return `${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,'0')}`; }
  function monthLabel(ym) { return fmtMonth.format(parseDate(`${ym}-01`)); }
  function shortMonth(ym) { return fmtShort.format(parseDate(`${ym}-01`)).replace('.', ''); }
  function categorySet(type) { return CATEGORIES[type] || []; }
  function uniqueId() { return (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`; }
  function notify(message) { const toast = document.getElementById('toast'); toast.textContent = message; toast.classList.add('show'); clearTimeout(toastTimer); toastTimer = setTimeout(() => toast.classList.remove('show'), 2700); }
  function occurrenceDate(t, ym) {
    if (!t.recurring) return t.date.slice(0, 7) === ym ? t.date : null;
    if (t.date.slice(0, 7) > ym) return null;
    const day = Number(t.date.slice(8, 10));
    const [y,m] = ym.split('-').map(Number);
    const lastDay = new Date(Date.UTC(y,m,0)).getUTCDate();
    return `${ym}-${String(Math.min(day,lastDay)).padStart(2,'0')}`;
  }
  function transactionsInMonth(ym, type) {
    return data.transactions.filter(t => (!type || t.type === type) && occurrenceDate(t,ym))
      .map(t => ({ ...t, occurrence: occurrenceDate(t,ym) }))
      .sort((a,b) => b.occurrence.localeCompare(a.occurrence) || b.createdAt.localeCompare(a.createdAt));
  }
  function sums(ym) {
    const list = transactionsInMonth(ym);
    const income = n2(list.filter(t=>t.type==='income').reduce((sum,t)=>sum+t.amount,0));
    const expense = n2(list.filter(t=>t.type==='expense').reduce((sum,t)=>sum+t.amount,0));
    return { income, expense, balance:n2(income-expense), count:list.length };
  }
  function savingPlan(ym) {
    return calcularPlanoAporte(transactionsInMonth(ym,'income'),preferencias.obter());
  }
  function reservePrincipal() {
    const goalId=preferencias.obter().reservaGoalId;
    const fromGoals=data.goals.filter(g=>g.kind==='goal'&&(goalId?g.id===goalId:/reserva|emerg[eê]ncia/i.test(g.name))).reduce((sum,g)=>sum+g.saved,0);
    const unlinked=(data.allocations||[]).filter(a=>a.kind==='reserve'&&!data.goals.some(g=>g.id===a.goalId)).reduce((sum,a)=>sum+a.amount,0);
    return Math.max(0,n2(fromGoals+unlinked));
  }
  function reserveYieldEstimate() {
    const quote=validCdiQuote(),principal=reservePrincipal();
    if(!quote||!principal)return '';
    // Projeção ilustrativa de 21 dias úteis a 100% do CDI, antes de IR/IOF e taxas.
    const estimated=n2(principal*(Math.pow(1+quote.dailyPercent/100,21)-1));
    return `<p class="proto-cdi-estimate">CDB a 100% do CDI · rendimento bruto estimado em 21 dias úteis: <strong>${money(estimated)}</strong><small>Simulação sobre ${money(principal)}. Não é rendimento confirmado; sem impostos ou taxas.</small></p>`;
  }
  function dueAportes() {
    const todayText=isoDate(new Date());
    const threshold=shiftMonth(todayText.slice(0,7),-5)+'-01';
    const done=new Set(data.completedAportes||[]);
    const items=[];
    for(const t of data.transactions){
      if(t.type!=='income')continue;
      const months=t.recurring?Array.from({length:6},(_,i)=>shiftMonth(todayText.slice(0,7),i-5)):[t.date.slice(0,7)];
      for(const ym of months){
        const date=occurrenceDate(t,ym);
        if(!date||date>todayText||date<threshold)continue;
        const key=`${t.id}@${date}`;
        if(done.has(key))continue;
        const tenPercent=calcularAporte(t,preferencias.obter());
        items.push({key,date,description:t.description,category:t.category,tenPercent});
      }
    }
    return items.sort((a,b)=>b.date.localeCompare(a.date));
  }
  function renderReminderCount() {
    notificacoes.renderBadge();
  }
  function renderReminderDialog() {
    notificacoes.renderDialog();
  }
  function changeView(next) {
    if(!NAV.some(item=>item[0]===next))return;
    if(view==='ajustes'&&next!=='ajustes')ajustes.descartar();
    view = next; search=''; filterCategory='';
    document.querySelectorAll('.nav-button').forEach(el => { const active = el.dataset.view === view; el.classList.toggle('active',active); el.setAttribute('aria-current',active?'page':'false'); });
    if(view==='ajustes')ajustes.abrir();
    render(); window.scrollTo({top:0,behavior:'instant'});
  }
  function sincronizarAlertasNav(){
    const alerta=!document.getElementById('folder-backup-alert').classList.contains('hidden')||
      !document.getElementById('app-update-alert').classList.contains('hidden');
    document.querySelectorAll('.nav-status-dot').forEach(dot=>dot.classList.toggle('hidden',!alerta));
  }
  function renderNav() {
    for (const id of ['desktop-nav','mobile-nav']) {
      document.getElementById(id).innerHTML = NAV.map(([key,title,symbol]) => `<button class="nav-button ${key===view?'active':''}" type="button" data-view="${key}" aria-current="${key===view?'page':'false'}">${icon(symbol)}<span>${title}</span>${key==='ajustes'?'<span class="nav-status-dot hidden" aria-label="Há atualizações ou avisos de backup"></span>':''}</button>`).join('');
    }
    sincronizarAlertasNav();
  }
  function header(subtitle='',monthPicker=false) {
    return `<div class="proto-page-meta">${monthPicker?monthControl():`<p>${esc(subtitle)}</p>`}</div>`;
  }
  function monthControl() { return `<div class="month-control" aria-label="Mês selecionado"><button type="button" data-month="-1" aria-label="Mês anterior">${icon('chevron-left')}</button>${renderBotaoCalendario(month,monthLabel,esc)}<button type="button" data-month="1" aria-label="Próximo mês">${icon('chevron-right')}</button></div>`; }
  function empty(text, symbol='wallet') { return `<div class="empty-state">${icon(symbol)}<p>${esc(text)}</p></div>`; }
  function render() {
    renderReminderCount();
    document.getElementById('header-label').textContent=NAV.find(v=>v[0]===view)?.[1]||'Resumo';
    document.getElementById('header-balance').textContent=money(sums(month).balance);
    acaoRapida.atualizar(view);
    settingsPage.classList.toggle('hidden',view!=='ajustes');
    viewContent.classList.toggle('hidden',view==='ajustes');
    if(view==='ajustes')return;
    if (view === 'resumo') viewContent.innerHTML = renderSummary();
    else if (view === 'renda' || view === 'despesas') viewContent.innerHTML = renderTransactions(view==='renda'?'income':'expense');
    else viewContent.innerHTML = renderGoals(view==='metas'?'goal':'dream');
  }
  // Os módulos recebem apenas dependências explícitas e o estado atual por getters.
  // Nenhum arquivo de tela lê ou sobrescreve diretamente os dados persistidos.
  const common = {
    CATEGORIES, CATEGORY_ICONS, EXPENSE_COLORS, currentMonth,
    getData: () => data, getMonth: () => month, getSearch: () => search,
    getPreferences:()=>preferencias.obter(),salvarPreferencias:valor=>preferencias.salvar(valor),
    aplicarPreferencias:()=>aplicarAparencia(preferencias.obter()),
    getFilterCategory: () => filterCategory,
    setMonth: next => { month = next; },
    resetToSummary: () => { view = 'resumo'; month = currentMonth; renderNav(); render(); },
    categorySet, esc, icon, money, n2, fmtDate, parseDate, isoDate, validarBackup,
    shiftMonth, monthLabel, shortMonth, header, empty,
    sums, savingPlan, transactionsInMonth, reserveYieldEstimate,
    transactionDialog, transactionForm, goalDialog, goalForm,
    persist, render, renderNav, notify, uniqueId,
    confirmar:dialogos.confirmar,registrar,registrarEvento
  };
  const moduloLancamentos=criarModuloLancamentos(common);
  const {renderTransactions, renderEntry, openTransaction, setTransactionType} = moduloLancamentos;
  const moduloObjetivos=criarModuloObjetivos(common);
  const {renderGoals, progressLine, goalProgressPercent, openGoal, goalCandidates} = moduloObjetivos;
  const investimentos=iniciarInvestimentos({...common,dialog:investmentDialog,form:investmentForm,documento:document});
  const acaoRapida=iniciarAcaoRapida({getView:()=>view,openTransaction,openGoal,openInvestment:investimentos.abrir});
  const moduloSaude=criarModuloSaude({...common,reservePrincipal});
  const calendarioFinanceiro=criarModuloCalendarioFinanceiro({...common,dialog:calendarDayDialog,dialogoCalendario:financeCalendarDialog,documento:document});
  const notificacoes=criarModuloNotificacoes({getAportes:dueAportes,getPreferences:()=>preferencias.obter(),
    fmtDate,parseDate,money,esc,notify,confirmar:dialogos.confirmar,storage:localStorage,registrar});
  const moduloResumo=criarModuloResumo({...common, renderEntry, progressLine,renderSaude:moduloSaude.renderSaude});
  const {renderSummary} = moduloResumo;

  document.addEventListener('click',async event=>{
    const nav=event.target.closest('[data-view]');
    if(nav){changeView(nav.dataset.view);return;}
    const typeButton=event.target.closest('[data-trans-type]');
    if(typeButton){setTransactionType(typeButton.dataset.transType);return;}
    const monthButton=event.target.closest('[data-month]');
    if(monthButton){month=shiftMonth(month,Number(monthButton.dataset.month));render();return;}
    const abrirCalendario=event.target.closest('[data-calendar-open]');
    if(abrirCalendario){calendarioFinanceiro.abrirCalendario();return;}
    const calendarDay=event.target.closest('[data-calendar-day]');
    if(calendarDay){calendarioFinanceiro.abrirDia(calendarDay.dataset.calendarDay);return;}
    const button=event.target.closest('[data-action]');
    if(!button)return;
    const id=button.dataset.id;
    if(button.dataset.action==='add')openTransaction(button.dataset.type);
    else if(button.dataset.action==='edit')openTransaction(null,id);
    else if(button.dataset.action==='add-goal')openGoal(button.dataset.type);
    else if(button.dataset.action==='edit-goal')openGoal(null,id);
    else if(button.dataset.action==='add-investment')investimentos.abrir(id);
    else if(button.dataset.action==='edit-investment')investimentos.editar(id);
    else if(button.dataset.action==='mark-aporte'){
      if(!notificacoes.pendentes().some(a=>a.key===id))return;
      const completedAportes=[...(data.completedAportes||[]),id];
      if(persist({...data,completedAportes})){renderReminderCount();renderReminderDialog();notify('Lembrete concluído.');}
    }
    else if(button.dataset.action==='link-allocation'){
      const allocation=(data.allocations||[]).find(a=>a.id===id);
      const goalId=document.querySelector(`[data-allocation-goal="${CSS.escape(id)}"]`)?.value;
      const goal=data.goals.find(g=>g.id===goalId);
      if(!allocation||allocation.goalId||!goal||!goalCandidates(allocation.kind).some(g=>g.id===goalId)){notify('Selecione um objetivo compatível.');return;}
      if(!podeAplicarNoObjetivo(goal.saved,allocation.amount)){notify('O resgate excede o valor guardado nesse objetivo.');return;}
      const goals=data.goals.map(g=>g.id===goalId?{...g,saved:n2(g.saved+allocation.amount)}:g);
      const allocations=data.allocations.map(a=>a.id===id?{...a,goalId}:a);
      if(persist({...data,goals,allocations})){render();notify('Aplicação vinculada ao objetivo.');}
    }
    else if(button.dataset.action==='delete'){
      const t=data.transactions.find(v=>v.id===id);
      if(t&&await dialogos.confirmar({titulo:'Excluir lançamento',mensagem:`Excluir "${t.description}"${t.recurring?' de todos os meses':''}?`,acao:'Excluir lançamento',perigoso:true})){
        if(persist({...data,transactions:data.transactions.filter(v=>v.id!==id)})){render();notify('Lançamento excluído.');}
      }
    } else if(button.dataset.action==='delete-goal'){
      const g=data.goals.find(v=>v.id===id);
      if(g&&await dialogos.confirmar({titulo:'Excluir meta',mensagem:`Excluir "${g.name}"? O valor registrado como guardado também será removido desta meta.`,acao:'Excluir meta',perigoso:true})){
        const allocations=(data.allocations||[]).map(a=>a.goalId===id?{...a,goalId:''}:a);
        if(persist({...data,goals:data.goals.filter(v=>v.id!==id),allocations})){render();notify('Meta excluída. Aplicações preservadas sem vínculo.');}
      }
    }
  });
  document.getElementById('reminder-button').addEventListener('click',()=>{
    renderReminderDialog();reminderDialog.showModal();
  });
  document.addEventListener('input',event=>{
    if(event.target.id==='transaction-search'){
      search=event.target.value;
      const selection=event.target.selectionStart;
      const position=window.scrollY;
      render();const input=document.getElementById('transaction-search');if(input){input.focus({preventScroll:true});input.setSelectionRange(selection,selection);window.scrollTo(0,position);}
    }
  });
  document.addEventListener('change',event=>{
    if(event.target.id==='transaction-category'){filterCategory=event.target.value;render();}
  });
  document.querySelectorAll('.close-dialog').forEach(b=>b.addEventListener('click',()=>b.closest('dialog').close()));
  for(const dialog of [transactionDialog,goalDialog,reminderDialog])dialog.addEventListener('click',event=>{if(event.target===dialog)dialog.close();});
  transactionForm.addEventListener('submit',event=>{
    event.preventDefault();
    const f=transactionForm.elements;
    const type=f.namedItem('type').value;
    const amount=n2(Number(f.namedItem('amount').value));
    const description=f.namedItem('description').value.trim();
    const date=f.namedItem('date').value;
    const category=f.namedItem('category').value;
    if(!description||!(amount>0&&amount<=999999999)||!validarDataISO(date)||!categorySet(type).includes(category)){notify('Confira os dados do lançamento.');return;}
    const id=f.namedItem('id').value;
    const previous=data.transactions.find(t=>t.id===id);
    const entry={id:id||uniqueId(),type,description,amount,date,category,recurring:f.namedItem('recurring').checked,createdAt:previous?.createdAt||new Date().toISOString()};
    const next={...data,transactions:id?data.transactions.map(t=>t.id===id?entry:t):[...data.transactions,entry]};
    if(persist(next)){registrarEvento(id?'EDITAR_LANCAMENTO':'CRIAR_LANCAMENTO','dados');transactionDialog.close();month=date.slice(0,7);render();notify(id?'Lançamento atualizado.':type==='income'?'Renda salva. 🔔 Confira o aporte no sininho.':'Lançamento salvo.');}
  });
  goalForm.addEventListener('submit',event=>{
    event.preventDefault();
    const f=goalForm.elements;
    const name=f.namedItem('name').value.trim();
    const target=n2(Number(f.namedItem('target').value));
    const saved=n2(Number(f.namedItem('saved').value));
    const kind=f.namedItem('kind').value;
    const deadline=f.namedItem('deadline').value;
    if(!name||!(target>0&&target<=999999999)||!(saved>=0&&saved<=999999999)||!['dream','goal'].includes(kind)||deadline&&!validarDataISO(deadline)){notify('Confira os dados da meta.');return;}
    const id=f.namedItem('id').value;
    const entry={id:id||uniqueId(),kind,name,target,saved,deadline};
    const next={...data,goals:id?data.goals.map(g=>g.id===id?entry:g):[...data.goals,entry]};
    if(persist(next)){registrarEvento(id?'EDITAR_META':'CRIAR_META','dados');goalDialog.close();render();notify(id?'Valor atualizado.':'Objetivo salvo.');}
  });
  const backup = iniciarModuloBackup(common);
  folderBackup = backup.folderBackup;
  iniciarModuloCsv({...common, goalCandidates, hideBackupMenu: backup.hideBackupMenu});
  const atualizador=iniciarAtualizador({notify,registrar});
  const ajustes=iniciarAjustes({...common,gestor:preferencias,hideBackupMenu:backup.hideBackupMenu,
    onSave:()=>folderBackup?.schedule(),onCancel:()=>changeView('resumo')});
  const limpeza=iniciarLimpezaDados({confirmar:dialogos.confirmar,notify,
    apagarDados:()=>apagarDadosLocais({storage:localStorage,chave:KEY,
      pausarBackup:()=>folderBackup?.pause(),
      aposLimpeza:()=>{
        data={transactions:[],goals:[],allocations:[],completedAportes:[]};
        storageLocked=false;
        search='';filterCategory='';
        // A referência à meta excluída não deve ficar órfã nas preferências.
        const prefs=preferencias.obter();
        if(prefs.reservaGoalId)preferencias.salvar({...prefs,reservaGoalId:''});
        for(const modal of [transactionDialog,goalDialog,investmentDialog,financeCalendarDialog,calendarDayDialog,reminderDialog])if(modal?.open)modal.close();
        view='resumo';month=currentMonth;
        registrar('info','DADOS_APAGADOS','dados');
        renderNav();render();
      }})});
  const relatorioPdf=iniciarRelatorioPdf({...common,hideBackupMenu:backup.hideBackupMenu,registrar});
  const diagnostico=iniciarDiagnostico({...common,hideBackupMenu:backup.hideBackupMenu,
    getFolderState:()=>folderBackup?.getState(),getUpdateStatus:()=>atualizador.getStatus(),
    getStorageLocked:()=>storageLocked,getCdiStatus:()=>Boolean(validCdiQuote()),
    getNotificationStatus:()=>notificacoes.getStatus(),obterLogs,configurarDetalhado,modoDetalhado});
  registrarModulosDoApp({dialogos,moduloSaude,moduloResumo,moduloLancamentos,moduloObjetivos,moduloBackup:backup,
    moduloCsv:iniciarModuloCsv,atualizador,ajustes,limpeza,acaoRapida,investimentos,calendarioFinanceiro,preferencias,notificacoes,relatorioPdf,
    regras:{calcularAporte,calcularPlanoAporte},logger:{obterLogs},diagnostico});
  renderNav();render();
  if(typeof MutationObserver==='function')
    new MutationObserver(sincronizarAlertasNav).observe(document.querySelector('.nav-alert-sources'),{attributes:true,attributeFilter:['class'],subtree:true});
  refreshCdiSilently();
})();
