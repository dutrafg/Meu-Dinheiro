// Avisos dispensados são distintos de aportes concluídos e de dados financeiros.
export const CHAVE_AVISOS = 'meu-dinheiro-essencial:avisos-ocultos:v1';

// Somente alertas locais, sem push remoto e sem criar despesas automaticamente.
export function avisosPlanejamento(dados,hoje,limiteMensal=null){
  if(!/^\d{4}-\d{2}-\d{2}$/.test(hoje))return [];
  const hojeUTC=new Date(`${hoje}T12:00:00Z`);
  if(Number.isNaN(hojeUTC.getTime())||hojeUTC.toISOString().slice(0,10)!==hoje)return [];
  const fim=new Date(hojeUTC.getTime()+7*86400000).toISOString().slice(0,10);
  const inicio=new Date(hojeUTC.getTime()-62*86400000).toISOString().slice(0,10);
  const transacoes=Array.isArray(dados?.transactions)?dados.transactions:[];
  const retorno=[];
  const planos=Array.isArray(dados?.commitments)?dados.commitments:[];
  for(const plano of planos.slice(0,1000)){
    if(!plano||!Number.isInteger(plano.day)||!/^(20\d{2}|2100)-\d{2}$/.test(plano.startMonth))continue;
    for(let passo=-2;passo<=1;passo++){
      const mes=new Date(Date.UTC(hojeUTC.getUTCFullYear(),hojeUTC.getUTCMonth()+passo,1));
      const mesISO=mes.toISOString().slice(0,7),[ano,m]=mesISO.split('-').map(Number);
      const [y,im]=plano.startMonth.split('-').map(Number);
      const parcela=(ano-y)*12+m-im+1;
      if(parcela<1||(plano.monthsCount!==null&&parcela>plano.monthsCount))continue;
      const maxDia=new Date(Date.UTC(ano,m,0)).getUTCDate();
      const data=`${mesISO}-${String(Math.min(plano.day,maxDia)).padStart(2,'0')}`;
      if(data<inicio||data>fim||transacoes.some(t=>t.commitmentId===plano.id&&t.commitmentMonth===mesISO))continue;
      const atraso=data<hoje;
      retorno.push({key:`plano-${plano.id}@${data}`,kind:'compromisso',date:data,
        description:plano.name,category:plano.kind==='card'?'Cartão de crédito':'Conta a pagar',
        message:atraso?'Vencimento anterior sem pagamento confirmado. Confira se já pagou.':data===hoje?'Vence hoje. Confirme o pagamento na área Relatórios.':'Vence nos próximos 7 dias. Confira o valor na área Relatórios.',
        urgencia:atraso?'atrasado':'proximo'});
    }
  }
  if(typeof limiteMensal==='number'&&limiteMensal>0){
    const mes=hoje.slice(0,7);
    const total=transacoes.filter(t=>t.type==='expense'&&t.date?.slice(0,7)===mes)
      .reduce((centavos,t)=>centavos+Math.round((Number(t.amount)||0)*100),0)/100;
    const percentual=Math.round(total/limiteMensal*100);
    if(percentual>=80){
      const nivel=percentual>=100?'100':'80';
      retorno.push({key:`limite-${nivel}@${mes}-01`,kind:'limite',date:hoje,description:'Atenção ao limite mensal',category:'Orçamento',
        message:percentual>=100?'Seu gasto lançado alcançou ou ultrapassou o limite mensal.':'Seu gasto lançado atingiu pelo menos 80% do limite mensal.',urgencia:percentual>=100?'atrasado':'proximo'});
    }
  }
  return retorno.sort((a,b)=>a.date.localeCompare(b.date)||a.description.localeCompare(b.description));
}

export function criarModuloNotificacoes({getAportes,getPreferences,fmtDate,parseDate,money,esc,
  notify,confirmar,storage,registrar=()=>{},getData=()=>null,getHoje=()=>'',getStorageLocked=()=>false,getBackupState=()=>null}) {
  let ocultos=new Set();
  let armazenamentoOk=true;
  try {
    const raw=storage?.getItem(CHAVE_AVISOS);
    const salvo=raw?JSON.parse(raw):[];
    if(!Array.isArray(salvo)||!salvo.every(v=>typeof v==='string'&&v.length<=300&&/^.+@\d{4}-\d{2}-\d{2}$/.test(v)))throw Error('Formato inválido');
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
  const pendentes=()=>{
    const hoje=getHoje();
    const adicionais=avisosPlanejamento(getData(),hoje,getPreferences()?.limiteMensal);
    if(/^\d{4}-\d{2}-\d{2}$/.test(hoje)){
      if(getStorageLocked())adicionais.push({key:`armazenamento-bloqueado@${hoje}`,kind:'sistema',date:hoje,description:'Proteção dos seus dados',category:'Armazenamento',message:'Gravação bloqueada por conflito. Confira Ajustes e faça cópia antes de continuar.'});
      const backup=getBackupState();
      if(['conflict','permission','error','paused'].includes(backup?.state))adicionais.push({key:`backup-atencao@${hoje}`,kind:'sistema',date:hoje,description:'Cópia de segurança',category:'Backup',message:'A cópia em pasta requer atenção. Confira Ajustes para manter seus dados protegidos.'});
    }
    return [...getAportes().map(v=>({...v,kind:'aporte'})),...adicionais].filter(v=>!ocultos.has(v.key));
  };
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
    abrir.setAttribute('aria-label',count?`${count} ${count===1?'notificação pendente':'notificações pendentes'}`:'Notificações, nenhuma pendente');
  }
  function renderDialog() {
    const todos=pendentes();
    const visiveis=todos.slice(0,100);
    lista.innerHTML=visiveis.length?visiveis.map(a=>`<div class="proto-reminder-item"><div><strong>${esc(a.description)}</strong><small>${esc(a.category)} · ${fmtDate.format(parseDate(a.date))}</small><p>${a.kind!=='aporte'?esc(a.message):a.tenPercent===null?'Lembre-se de verificar se fará um aporte com esta entrada.':`Separe <b>${money(a.tenPercent)}</b> (${getPreferences().percentual}% desta renda) para sua reserva.`}</p></div><button type="button" class="button button-secondary" data-action="${a.kind==='aporte'?'mark-aporte':'dismiss-notification'}" data-id="${esc(a.key)}">${a.kind==='aporte'?'Já fiz':'Dispensar'}</button></div>`).join(''):`<div class="proto-empty">Nenhum aviso pendente. Novos recebimentos, vencimentos e alertas voltarão a aparecer aqui. ✓</div>`;
    if(todos.length>100)lista.insertAdjacentHTML('afterbegin',`<p class="field-hint">Mostrando 100 de ${todos.length} avisos. Limpar avisos dispensa todos os pendentes.</p>`);
    limpar.classList.toggle('hidden',todos.length===0);
    restaurar.classList.toggle('hidden',ocultos.size===0);
  }
  limpar.addEventListener('click',async()=>{
    const todos=pendentes();
    if(!todos.length)return;
    if(!await confirmar({titulo:'Limpar notificações?',mensagem:`Dispensar ${todos.length} notificação(ões)? Nenhum lançamento será excluído, nenhuma conta será marcada como paga e nenhum aporte será concluído. Você poderá restaurar os avisos.`,acao:'Limpar avisos'}))return;
    if(!gravar(new Set([...ocultos,...todos.map(a=>a.key)]))){notify('Não foi possível salvar a limpeza dos avisos.');return;}
    renderBadge();renderDialog();notify('Avisos dispensados. Os próximos recebimentos continuarão sendo lembrados.');
  });
  restaurar.addEventListener('click',()=>{
    if(!gravar(new Set())){notify('Não foi possível restaurar os avisos.');return;}
    renderBadge();renderDialog();notify('Avisos restaurados.');
  });
  function dispensar(key){
    if(!pendentes().some(a=>a.key===key))return false;
    const gravou=gravar(new Set([...ocultos,key]));
    if(gravou){renderBadge();renderDialog();}
    return gravou;
  }
  return {pendentes,renderBadge,renderDialog,dispensar,getStatus:()=>({ocultas:ocultos.size,armazenamentoOk})};
}
