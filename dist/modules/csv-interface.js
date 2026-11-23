import { podeAplicarNoObjetivo } from './validacao.js';
import {cliqueForaDoDialogo} from './dialogos.js';
import {converterOfxParaCsv,identificarOfx} from './ofx.js';
export function iniciarModuloCsv(ctx) {
  const {getData, setMonth, goalCandidates, hideBackupMenu, isoDate, notify,
    esc, fmtDate, parseDate, money, CATEGORIES, uniqueId, n2, persist, render, registrar=()=>{}, registrarEvento=()=>{}} = ctx;
  let pendingCsv = null;
  let pendingAllocations = null;
  let csvSelections = new Map();
  let csvAnalysis = null;
  const csvDialog=document.getElementById('csv-preview-dialog');
  const csvFile=document.getElementById('csv-import-file');
  document.getElementById('export-csv').addEventListener('click',()=>{
    const data=getData();
    const contents=window.MeuDinheiroCSV.exportCSV(data.transactions,data.allocations||[]);
    const url=URL.createObjectURL(new Blob([contents],{type:'text/csv;charset=utf-8'}));
    const a=document.createElement('a');a.href=url;a.download=`meu-dinheiro-lancamentos-${isoDate(new Date())}.csv`;a.click();
    setTimeout(()=>URL.revokeObjectURL(url),30000);hideBackupMenu();notify('CSV exportado com todos os lançamentos.');
  });
  document.getElementById('import-csv').addEventListener('click',()=>{hideBackupMenu();csvFile.click();});
  function refreshCSVPreview(){
    const data=getData();
    const csv=csvAnalysis;if(!csv)return;
    const already=[...data.transactions,...(data.allocations||[])];
    const existingIds=new Set(already.map(t=>t.id));
    const existingKeys=new Set(already.map(t=>t.importKey).filter(Boolean));
    const accepted=[],investments=[];let duplicates=0;
    const batchIds=new Set(),batchKeys=new Set();
    for(const item of csv.items){
      if((item.id&&(existingIds.has(item.id)||batchIds.has(item.id)))||existingKeys.has(item.importKey)||batchKeys.has(item.importKey)){duplicates++;continue;}
      if(item.investmentTransfer)investments.push(item);else accepted.push(item);
      if(item.id)batchIds.add(item.id);batchKeys.add(item.importKey);
    }
    pendingCsv=accepted;
    pendingAllocations=investments.map(item=>({...item,...(csvSelections.get(item.importKey)||{kind:'',goalId:''})}));
    const income=accepted.filter(t=>t.type==='income').length,expense=accepted.length-income;
    const unclassified=pendingAllocations.filter(a=>!a.kind).length;
    document.getElementById('csv-import-summary').textContent=`${csv.items.length} movimentações reconhecidas. ${accepted.length} lançamentos comuns: ${income} entradas e ${expense} saídas. ${investments.length} aplicações/resgates para classificar. ${duplicates} já importadas.`;
    document.getElementById('csv-investment-list').innerHTML=investments.length?`<div class="csv-investment-heading">Classificação obrigatória de cada aplicação</div>${pendingAllocations.map(item=>{
      const choices=goalCandidates(item.kind);
      return `<div class="csv-investment-row"><div class="csv-investment-info"><strong>${esc(item.description)}</strong><small>${fmtDate.format(parseDate(item.date))} · ${item.allocationDelta>=0?'+':'−'}${money(Math.abs(item.allocationDelta))}</small></div><div class="csv-investment-fields"><label>Destino<select data-csv-kind="${esc(item.importKey)}" aria-label="Destino de ${esc(item.description)}"><option value="">Escolher...</option><option value="reserve" ${item.kind==='reserve'?'selected':''}>Reserva</option><option value="goal" ${item.kind==='goal'?'selected':''}>Meta</option><option value="dream" ${item.kind==='dream'?'selected':''}>Sonho</option></select></label><label>Vincular a objetivo (opcional)<select data-csv-goal="${esc(item.importKey)}" aria-label="Vincular ${esc(item.description)}" ${!item.kind?'disabled':''}><option value="">Sem vínculo por enquanto</option>${choices.map(g=>`<option value="${esc(g.id)}" ${g.id===item.goalId?'selected':''}>${esc(g.name)}</option>`).join('')}</select></label></div></div>`;
    }).join('')}`:'';
    document.getElementById('csv-preview-table').innerHTML=`<table><thead><tr><th>Data</th><th>Descrição</th><th>Valor</th></tr></thead><tbody>${accepted.slice(0,6).map(t=>`<tr><td>${fmtDate.format(parseDate(t.date))}</td><td>${esc(t.description)}</td><td style="color:${t.type==='income'?'var(--green-text)':'var(--red-text)'}">${t.type==='income'?'+':'−'}${money(t.amount)}</td></tr>`).join('')}</tbody></table>${accepted.length>6?`<p class="proto-note" style="padding:0 10px">Exibindo 6 de ${accepted.length} lançamentos novos.</p>`:''}`;
    document.getElementById('csv-import-warning').textContent=investments.length?`Classifique as ${investments.length} aplicações. Valores vinculados a um objetivo serão somados ao que já está guardado; sem vínculo, ficam registrados separadamente na área escolhida. Aplicações não entram como despesas.`:'Confira os lançamentos antes de importar. Depois você poderá ajustar as categorias.';
    const button=document.getElementById('csv-confirm-import');
    button.disabled=(!accepted.length&&!investments.length)||unclassified>0;
    button.textContent=unclassified?`Classifique ${unclassified} aplicação(ões)`:accepted.length||investments.length?`Importar ${accepted.length+investments.length} movimentações`:'Nada novo para importar';
  }
  document.getElementById('csv-investment-list').addEventListener('change',event=>{
    const kindKey=event.target.dataset.csvKind;
    const goalKey=event.target.dataset.csvGoal;
    if(kindKey){csvSelections.set(kindKey,{kind:event.target.value,goalId:''});refreshCSVPreview();}
    else if(goalKey){const previous=csvSelections.get(goalKey)||{kind:'',goalId:''};csvSelections.set(goalKey,{...previous,goalId:event.target.value});refreshCSVPreview();}
  });
  csvFile.addEventListener('change',async event=>{
    const file=event.target.files?.[0];event.target.value='';if(!file)return;
    if(file.size>10*1024*1024){registrar('aviso','CSV_ARQUIVO_GRANDE','csv');notify('O CSV deve ter até 10 MB.');return;}
    try{
      const texto=await file.text();
      const conteudo=identificarOfx(texto)||/\.ofx$/i.test(file.name)?converterOfxParaCsv(texto):texto;
      csvAnalysis=window.MeuDinheiroCSV.importCSV(conteudo,CATEGORIES);
      csvSelections=new Map();
      refreshCSVPreview();
      csvDialog.showModal();
    }catch{pendingCsv=null;pendingAllocations=null;csvAnalysis=null;registrar('erro','CSV_IMPORTACAO_FALHOU','csv');notify('Não foi possível ler o CSV. Confira o arquivo.');}
  });
  document.getElementById('csv-confirm-import').addEventListener('click',async()=>{
    const data=getData();
    if(!pendingCsv||!pendingAllocations||pendingAllocations.some(a=>!a.kind))return;
    if(!pendingCsv.length&&!pendingAllocations.length)return;
    const added=pendingCsv.map(t=>({...t,id:t.id||uniqueId(),createdAt:new Date().toISOString()}));
    const addedAllocations=pendingAllocations.map(a=>({id:a.id||uniqueId(),date:a.date,description:a.description,amount:a.allocationDelta,kind:a.kind,goalId:a.goalId||'',importKey:a.importKey,createdAt:new Date().toISOString()}));
    const goals=data.goals.map(g=>({...g}));
    for(const allocation of addedAllocations){
      const goal=goals.find(g=>g.id===allocation.goalId);
      if(goal && !podeAplicarNoObjetivo(goal.saved,allocation.amount)){notify('O resgate excede o valor guardado no objetivo. Ajuste o vínculo antes de importar.');return;}
      if(goal)goal.saved=n2(goal.saved+allocation.amount);
    }
    const next={...data,goals,transactions:[...data.transactions,...added],allocations:[...(data.allocations||[]),...addedAllocations]};
    if(await persist(next)){
      registrarEvento('IMPORTAR_CSV','csv');
      const newest=[...added,...addedAllocations].map(t=>t.date).sort().at(-1);if(newest)setMonth(newest.slice(0,7));
      pendingCsv=null;pendingAllocations=null;csvDialog.close();render();notify(`${added.length} lançamentos e ${addedAllocations.length} aplicações importados.${added.some(t=>t.type==='income')?' 🔔 Confira seus aportes.':''}`);
    }
  });
  csvDialog.addEventListener('close',()=>{pendingCsv=null;pendingAllocations=null;csvAnalysis=null;csvSelections=new Map();});
  csvDialog.addEventListener('click',event=>{if(cliqueForaDoDialogo(event,csvDialog))csvDialog.close();});
  csvDialog.querySelectorAll('.close-dialog').forEach(button=>button.addEventListener('click',()=>csvDialog.close()));
}
