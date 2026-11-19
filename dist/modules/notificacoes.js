// Avisos dispensados são distintos de aportes concluídos e de dados financeiros.
export const CHAVE_AVISOS = 'meu-dinheiro-essencial:avisos-ocultos:v1';

export function criarModuloNotificacoes({getAportes,getPreferences,fmtDate,parseDate,money,esc,
  notify,confirmar,storage,registrar=()=>{}}) {
  let ocultos=new Set();
  let armazenamentoOk=true;
  try {
    const raw=storage?.getItem(CHAVE_AVISOS);
    const salvo=raw?JSON.parse(raw):[];
    if(!Array.isArray(salvo)||!salvo.every(v=>typeof v==='string'&&v.length<=220&&/^.+@\d{4}-\d{2}-\d{2}$/.test(v)))throw Error('Formato inválido');
    // Os lembretes só alcançam os últimos seis meses: descarta chaves antigas.
    const limite=new Date();limite.setMonth(limite.getMonth()-7);
    const dataLimite=limite.toISOString().slice(0,10);
    ocultos=new Set(salvo.filter(key=>key.slice(-10)>=dataLimite));
  } catch {registrar('aviso','NOTIFICACOES_LEITURA_FALHOU','notificacoes');armazenamentoOk=false;}
  const badge=document.getElementById('reminder-count');
  const abrir=document.getElementById('reminder-button');
  const lista=document.getElementById('reminder-list');
  const limpar=document.getElementById('notifications-clear');
  const restaurar=document.getElementById('notifications-restore');
  const pendentes=()=>getAportes().filter(v=>!ocultos.has(v.key));
  function gravar(proximo) {
    try {
      if(!storage)throw Error('Armazenamento indisponível');
      storage.setItem(CHAVE_AVISOS,JSON.stringify([...proximo]));
      ocultos=proximo;armazenamentoOk=true;
      return true;
    }catch{registrar('aviso','NOTIFICACOES_GRAVACAO_FALHOU','notificacoes');armazenamentoOk=false;return false;}
  }
  function renderBadge() {
    const count=pendentes().length;
    badge.classList.toggle('hidden',count===0);
    badge.textContent=count>99?'99+':String(count);
    abrir.setAttribute('aria-label',count?`${count} ${count===1?'lembrete de aporte pendente':'lembretes de aporte pendentes'}`:'Lembretes de aporte, nenhum pendente');
  }
  function renderDialog() {
    const todos=pendentes();
    const visiveis=todos.slice(0,100);
    lista.innerHTML=visiveis.length?visiveis.map(a=>`<div class="proto-reminder-item"><div><strong>${esc(a.description)}</strong><small>${esc(a.category)} · ${fmtDate.format(parseDate(a.date))}</small><p>${a.tenPercent===null?'Lembre-se de verificar se fará um aporte com esta entrada.':`Separe <b>${money(a.tenPercent)}</b> (${getPreferences().percentual}% desta renda) para sua reserva.`}</p></div><button type="button" class="button button-secondary" data-action="mark-aporte" data-id="${esc(a.key)}">Já fiz</button></div>`).join(''):`<div class="proto-empty">Nenhum aviso pendente. Novos recebimentos voltarão a aparecer aqui. ✓</div>`;
    if(todos.length>100)lista.insertAdjacentHTML('afterbegin',`<p class="field-hint">Mostrando 100 de ${todos.length} avisos. Limpar avisos dispensa todos os pendentes.</p>`);
    limpar.classList.toggle('hidden',todos.length===0);
    restaurar.classList.toggle('hidden',ocultos.size===0);
  }
  limpar.addEventListener('click',async()=>{
    const todos=pendentes();
    if(!todos.length)return;
    if(!await confirmar({titulo:'Limpar notificações?',mensagem:`Dispensar ${todos.length} lembrete(s) de aporte? Nenhum lançamento será excluído e nenhum aporte será marcado como feito. Você poderá restaurar os avisos.`,acao:'Limpar avisos'}))return;
    if(!gravar(new Set([...ocultos,...todos.map(a=>a.key)]))){notify('Não foi possível salvar a limpeza dos avisos.');return;}
    renderBadge();renderDialog();notify('Avisos dispensados. Os próximos recebimentos continuarão sendo lembrados.');
  });
  restaurar.addEventListener('click',()=>{
    if(!gravar(new Set())){notify('Não foi possível restaurar os avisos.');return;}
    renderBadge();renderDialog();notify('Avisos restaurados.');
  });
  return {pendentes,renderBadge,renderDialog,getStatus:()=>({ocultas:ocultos.size,armazenamentoOk})};
}
