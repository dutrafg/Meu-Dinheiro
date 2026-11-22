// Calendário de fluxo diário: abre ao clicar no seletor de mês, fora do Resumo.
// Inspirado no heatmap de 5 níveis do Reserva Simples, incluindo renda e dias mistos.
import {cliqueForaDoDialogo} from './dialogos.js';
const DIAS_SEMANA=Object.freeze(['Seg','Ter','Qua','Qui','Sex','Sáb','Dom']);
const INTENSIDADES=Object.freeze([0,18,26,35,45,56]);

function mesValido(ym){
  if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(ym))return false;
  const ano=Number(ym.slice(0,4));
  return ano>=1&&ano<=9999;
}
function dataUTC(ano,mesIndice,dia){
  const data=new Date(0);
  data.setUTCHours(12,0,0,0);
  data.setUTCFullYear(ano,mesIndice,dia);
  return data;
}
export function navegarMesCalendario(ym,passos){
  if(!mesValido(ym)||![-1,1].includes(passos))throw Error('Mês ou direção inválidos.');
  const [ano,mes]=ym.split('-').map(Number);
  const posicao=ano*12+mes-1+passos;
  const novoAno=Math.floor(posicao/12),novoMes=posicao%12+1;
  if(novoAno<1||novoAno>9999)throw Error('Mês fora do intervalo permitido.');
  return `${String(novoAno).padStart(4,'0')}-${String(novoMes).padStart(2,'0')}`;
}

export function calcularCalendarioFinanceiro(ym,registros=[]){
  if(!mesValido(ym)||!Array.isArray(registros))throw Error('Mês ou registros inválidos.');
  const [ano,mes]=ym.split('-').map(Number);
  const totalDias=dataUTC(ano,mes,0).getUTCDate();
  const deslocamento=(dataUTC(ano,mes-1,1).getUTCDay()+6)%7;
  const dias=Array.from({length:totalDias},(_,idx)=>({date:`${ym}-${String(idx+1).padStart(2,'0')}`,day:idx+1,
    incomeCents:0,expenseCents:0,entries:[]}));
  for(const entry of registros){
    const data=entry?.occurrence||entry?.date;
    if(typeof data!=='string'||!data.startsWith(`${ym}-`)||!['income','expense'].includes(entry.type)||
      !Number.isFinite(entry.amount)||entry.amount<=0)continue;
    const dia=Number(data.slice(8,10));
    if(!/^\d{4}-\d{2}-\d{2}$/.test(data)||dia<1||dia>totalDias||data!==dias[dia-1].date)continue;
    const centavos=Math.round(entry.amount*100);
    const alvo=dias[dia-1];
    if(entry.type==='income')alvo.incomeCents+=centavos;
    else alvo.expenseCents+=centavos;
    alvo.entries.push(entry);
  }
  const maxMovimento=Math.max(0,...dias.map(d=>d.incomeCents+d.expenseCents));
  const resultado=dias.map(d=>{
    const movimento=d.incomeCents+d.expenseCents;
    const level=movimento&&maxMovimento?Math.max(1,Math.min(5,Math.ceil(movimento/maxMovimento*5))):0;
    const tone=d.incomeCents&&d.expenseCents?'mixed':d.incomeCents?'income':d.expenseCents?'expense':'empty';
    return {...d,netCents:d.incomeCents-d.expenseCents,level,tone,
      incomeShare:movimento?Math.round(d.incomeCents/movimento*100):0,alpha:INTENSIDADES[level]};
  });
  return {month:ym,offset:deslocamento,days:resultado,maxMovementCents:maxMovimento,
    totalIncomeCents:resultado.reduce((sum,d)=>sum+d.incomeCents,0),
    totalExpenseCents:resultado.reduce((sum,d)=>sum+d.expenseCents,0)};
}

export function compactarValorCalendario(centavos){
  const valor=Math.abs(centavos)/100;
  if(valor>=1000000)return `${(valor/1000000).toLocaleString('pt-BR',{maximumFractionDigits:1})}mi`;
  if(valor>=1000)return `${(valor/1000).toLocaleString('pt-BR',{maximumFractionDigits:1})}mil`;
  return valor.toLocaleString('pt-BR',{maximumFractionDigits:valor<10?2:0});
}

export function renderBotaoCalendario(ym,monthLabel,esc){
  const rotulo=esc(monthLabel(ym));
  return `<button type="button" data-calendar-open aria-haspopup="dialog" aria-controls="finance-calendar-dialog" aria-label="Abrir calendário financeiro de ${rotulo}">${rotulo}</button>`;
}

export function criarModuloCalendarioFinanceiro({getMonth,setMonth,render,transactionsInMonth,monthLabel,money,esc,fmtDate,parseDate,dialog,dialogoCalendario,documento=document}){
  let agenda=false;
  function calendarioDoMes(){return calcularCalendarioFinanceiro(getMonth(),transactionsInMonth(getMonth()));}
  function renderCalendario(){
    const calendario=calendarioDoMes();
    const hoje=new Date(),hojeISO=`${hoje.getFullYear()}-${String(hoje.getMonth()+1).padStart(2,'0')}-${String(hoje.getDate()).padStart(2,'0')}`;
    const diaHTML=dia=>{
      const temRenda=dia.incomeCents>0,temDespesa=dia.expenseCents>0;
      const aria=`Dia ${dia.day}. Renda ${money(dia.incomeCents/100)}. Despesas ${money(dia.expenseCents/100)}. Saldo ${money(dia.netCents/100)}.`;
      return `<button type="button" class="finance-calendar-day${dia.date===hojeISO?' is-today':''}" data-calendar-day="${dia.date}" data-flow-tone="${dia.tone}" data-flow-level="${dia.level}" style="--flow-alpha:${dia.alpha}%;--flow-split:${dia.incomeShare}%" aria-label="${esc(aria)}" ${dia.date===hojeISO?'aria-current="date"':''}>
        <span class="finance-calendar-number">${dia.day}</span><span class="finance-calendar-values">
          ${temRenda?`<span class="finance-income"><span class="finance-value-full">+${money(dia.incomeCents/100)}</span><span class="finance-value-short" aria-hidden="true">+${compactarValorCalendario(dia.incomeCents)}</span></span>`:''}
          ${temDespesa?`<span class="finance-expense"><span class="finance-value-full">−${money(dia.expenseCents/100)}</span><span class="finance-value-short" aria-hidden="true">−${compactarValorCalendario(dia.expenseCents)}</span></span>`:''}
        </span></button>`;
    };
    return `<section class="finance-calendar-card" aria-labelledby="finance-calendar-title">
      <div class="finance-calendar-heading"><div><h2 id="finance-calendar-title">Calendário financeiro</h2><p>Receitas e despesas de cada dia</p></div>
        <div class="finance-calendar-navigation" role="group" aria-label="Navegar entre meses">
          <button type="button" data-calendar-month="-1" aria-label="Mês anterior">‹</button>
          <strong aria-live="polite">${esc(monthLabel(calendario.month))}</strong>
          <button type="button" data-calendar-month="1" aria-label="Próximo mês">›</button>
          <button type="button" data-calendar-today aria-label="Ir para o mês atual">Hoje</button>
          <button type="button" data-calendar-mode aria-pressed="${agenda}" aria-label="Alternar entre calendário e agenda">${agenda?'Grade':'Agenda'}</button>
        </div>
        <div class="finance-calendar-legend" aria-label="Intensidade de 1 a 5: verde renda, vermelho despesas, degradê ambos"><span><i class="legend-income"></i> Renda</span><span><i class="legend-mixed"></i> Misto</span><span><i class="legend-expense"></i> Despesas</span></div></div>
      <div class="finance-calendar-grid${agenda ? " is-agenda" : ""}" aria-label="Dias de ${esc(monthLabel(calendario.month))}">
        ${DIAS_SEMANA.map(dia=>`<span class="finance-calendar-weekday" aria-hidden="true">${dia}</span>`).join('')}
        ${Array.from({length:calendario.offset},()=>'<span class="finance-calendar-outside" aria-hidden="true"></span>').join('')}
        ${calendario.days.map(diaHTML).join('')}
      </div><p class="finance-calendar-note">Cores mais fortes indicam maior movimentação no mês. A mistura acompanha a proporção entre renda e despesas. Selecione um dia para ver os lançamentos.</p>
    </section>`;
  }
  function atualizarCalendario(){documento.getElementById('finance-calendar-content').innerHTML=renderCalendario();}
  function abrirCalendario(){atualizarCalendario();dialogoCalendario.showModal();return true;}
  function abrirDia(date){
    const calendario=calendarioDoMes();
    const dia=calendario.days.find(d=>d.date===date);
    if(!dia)return false;
    documento.getElementById('calendar-day-title').textContent=fmtDate.format(parseDate(date));
    documento.getElementById('calendar-day-content').innerHTML=`<div class="finance-day-totals">
      <div><span>Renda</span><strong class="finance-income">${money(dia.incomeCents/100)}</strong></div>
      <div><span>Despesas</span><strong class="finance-expense">${money(dia.expenseCents/100)}</strong></div>
      <div><span>Saldo do dia</span><strong>${money(dia.netCents/100)}</strong></div></div>
      ${dia.entries.length?`<div class="finance-day-list">${dia.entries.map(entry=>`<div class="finance-day-entry"><div><strong>${esc(entry.description)}</strong><small>${esc(entry.category)}</small></div><b class="${entry.type==='income'?'finance-income':'finance-expense'}">${entry.type==='income'?'+':'−'}${money(entry.amount)}</b></div>`).join('')}</div>`:'<p class="finance-day-empty">Nenhuma renda ou despesa cadastrada neste dia.</p>'}`;
    dialog.showModal();
    return true;
  }
  dialog.addEventListener('click',event=>{if(cliqueForaDoDialogo(event,dialog))dialog.close();});
  dialogoCalendario.addEventListener('click',event=>{
    const controle=event.target.closest?.('[data-calendar-month]');
    if(controle){
      const passos=Number(controle.dataset.calendarMonth);
      if(![-1,1].includes(passos))return;
      try{setMonth(navegarMesCalendario(getMonth(),passos));}
      catch{return;}
      render();atualizarCalendario();return;
    }
    if(event.target.closest?.('[data-calendar-today]')){
      const hoje=new Date(),ym=`${hoje.getFullYear()}-${String(hoje.getMonth()+1).padStart(2,'0')}`;
      setMonth(ym);render();atualizarCalendario();return;
    }
    if(event.target.closest?.('[data-calendar-mode]')){agenda=!agenda;atualizarCalendario();return;}
    if(cliqueForaDoDialogo(event,dialogoCalendario))dialogoCalendario.close();
  });
  return {renderCalendario,abrirCalendario,atualizarCalendario,abrirDia,calendarioDoMes};
}
