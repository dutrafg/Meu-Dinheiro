import {validarCompromisso} from './validacao.js';
import {MAX_COMPROMISSOS,listarCompromissosNoMes,ocorrenciaCompromisso,pagamentoRegistrado,registrarPagamentoCompromisso,resumirCartao,avancarMesCompromisso} from './compromissos.js';

export function iniciarCompromissos({getData,persist,render,notify,confirmar,uniqueId,isoDate,money,esc,getCurrentMonth,monthLabel,registrarEvento}){
  const painel=document.getElementById('commitments-panel');
  const conteudo=document.getElementById('commitments-content');
  const form=document.getElementById('commitment-form');
  const detalhes=document.getElementById('commitment-form-details');
  const campo=nome=>form.elements.namedItem(nome);
  const agora=()=>isoDate(new Date());

  function configurarTipo(){
    const cartao=campo('kind').value==='card';
    const quantidade=campo('monthsCount');
    quantidade.required=cartao;
    quantidade.placeholder=cartao?'Parcelas restantes':'Vazio = todo mês';
    const categoria=campo('category');
    if(cartao){categoria.value='Cartão de crédito';categoria.readOnly=true;}
    else{categoria.readOnly=false;if(categoria.value==='Cartão de crédito')categoria.value='Contas';}
  }

  function novo(){
    form.reset();campo('id').value='';campo('startMonth').value=getCurrentMonth();
    campo('day').value=String(new Date().getDate());
    campo('category').value='Contas';configurarTipo();
    detalhes.open=true;campo('name').focus();
  }

  function editar(id){
    const plano=(getData().commitments||[]).find(c=>c.id===id);
    if(!plano)return;
    form.reset();
    for(const key of ['id','kind','name','category','amount','day','startMonth'])campo(key).value=String(plano[key]);
    campo('monthsCount').value=plano.monthsCount??'';
    configurarTipo();detalhes.open=true;campo('name').focus();
  }

  function situacao(item){
    return item.paid?'<span class="commitment-status is-paid">Paga ✓</span>':
      item.overdue?'<span class="commitment-status is-late">Atrasada</span>':
      '<span class="commitment-status is-upcoming">Prevista</span>';
  }
  function linha(item){
    return `<div class="commitment-row"><div class="commitment-row-main"><strong>${esc(item.name)}</strong><small>${esc(item.date.split('-').reverse().join('/'))} · ${esc(item.category)}${item.kind==='card'?` · Parcela ${item.parcela}/${item.totalParcelas}`:item.totalParcelas===null?' · Mensal':''}</small></div>
      <strong class="commitment-value">${money(item.amount)}</strong>${situacao(item)}
      <div class="commitment-row-actions">${item.paid?'<small>Despesa registrada</small>':`<button type="button" class="button button-secondary" data-commitment-pay="${esc(item.id)}" data-month="${esc(item.month)}">${item.kind==='card'?'Paguei 1':'Marcar paga'}</button>`}
      <button type="button" class="button button-secondary" data-commitment-edit="${esc(item.id)}">Editar</button><button type="button" class="button button-danger" data-commitment-delete="${esc(item.id)}" aria-label="Excluir planejamento ${esc(item.name)}">Excluir</button></div></div>`;
  }

  function renderizar(){
    const dados=getData(),mes=getCurrentMonth(),hoje=agora(),proximoMes=avancarMesCompromisso(mes,1);
    const atuais=listarCompromissosNoMes(dados,mes,hoje),proximos=listarCompromissosNoMes(dados,proximoMes,hoje);
    const contas=atuais.filter(item=>item.kind==='bill');
    const futuras=proximos.filter(item=>item.kind==='bill');
    const cartoes=atuais.filter(item=>item.kind==='card');
    const totais=resumirCartao(dados,mes);
    conteudo.innerHTML=`<p class="field-hint">Cadastre contas e parcelas uma única vez. O planejamento não altera o saldo. Somente “Marcar paga” ou “Paguei 1”, com confirmação, cria uma despesa no histórico.</p>
      <section class="commitments-group"><h4>Contas a pagar · ${esc(monthLabel(mes))}</h4>${contas.length?contas.map(linha).join(''):'<p class="field-hint">Nenhuma conta cadastrada para este mês.</p>'}
      ${futuras.length?`<details class="commitments-next"><summary>Contas previstas para ${esc(monthLabel(proximoMes))} (${futuras.length})</summary>${futuras.map(linha).join('')}</details>`:''}</section>
      <section class="commitments-group"><h4>Cartão de crédito</h4><div class="commitment-card-totals"><div><small>Próxima fatura (${esc(monthLabel(proximoMes))})</small><strong>${money(totais.proximaFatura)}</strong></div><div><small>Falta pagar no total</small><strong>${money(totais.restante)}</strong></div></div>
      ${cartoes.length?cartoes.map(linha).join(''):'<p class="field-hint">Nenhuma parcela de cartão prevista neste mês.</p>'}
      ${(dados.commitments||[]).some(c=>c.kind==='card'&&!cartoes.some(a=>a.id===c.id))?`<details class="commitments-next"><summary>Outras compras parceladas</summary>${(dados.commitments||[]).filter(c=>c.kind==='card'&&!cartoes.some(a=>a.id===c.id)).map(c=>`<div class="commitment-row"><div class="commitment-row-main"><strong>${esc(c.name)}</strong><small>${c.monthsCount} parcelas · início ${esc(c.startMonth)}</small></div><strong>${money(c.amount)}</strong><button type="button" class="button button-secondary" data-commitment-edit="${esc(c.id)}">Editar</button><button type="button" class="button button-danger" data-commitment-delete="${esc(c.id)}">Excluir</button></div>`).join('')}</details>`:''}</section>
      <p class="field-hint">Não cadastre novamente como compromisso uma despesa mensal que você já lançou como recorrente; isso duplicaria a previsão. Excluir o planejamento preserva pagamentos anteriores.</p>`;
  }

  form.addEventListener('change',event=>{if(event.target?.name==='kind')configurarTipo();});
  form.addEventListener('submit',async event=>{
    event.preventDefault();
    const dados=getData(),id=campo('id').value||uniqueId();
    const kind=campo('kind').value;
    let compromisso;
    try{
      compromisso=validarCompromisso({id,kind,name:campo('name').value,category:kind==='card'?'Cartão de crédito':campo('category').value,
        amount:Number(campo('amount').value),day:Number(campo('day').value),startMonth:campo('startMonth').value,
        monthsCount:campo('monthsCount').value===''?null:Number(campo('monthsCount').value)});
      const atual=(dados.commitments||[]).find(c=>c.id===id);
      if(!atual&&(dados.commitments||[]).length>=MAX_COMPROMISSOS)throw Error('Limite de compromissos atingido.');
      if(atual){
        const pagos=dados.transactions.filter(t=>t.commitmentId===id);
        if(pagos.some(t=>!ocorrenciaCompromisso(compromisso,t.commitmentMonth))||
          (pagos.length&&atual.kind!==compromisso.kind))throw Error('Há pagamentos registrados. Preserve tipo e período dessas parcelas.');
      }
      const commitments=atual?dados.commitments.map(c=>c.id===id?compromisso:c):[...(dados.commitments||[]),compromisso];
      if(await persist({...dados,commitments})){
        registrarEvento(atual?'EDITAR_COMPROMISSO':'CRIAR_COMPROMISSO','dados');
        detalhes.open=false;render();notify(atual?'Compromisso atualizado.':'Compromisso cadastrado.');
      }
    }catch(error){notify(error?.message||'Confira os dados do compromisso.');}
  });

  painel.addEventListener('click',async event=>{
    const editarBotao=event.target.closest('[data-commitment-edit]');
    if(editarBotao){editar(editarBotao.dataset.commitmentEdit);return;}
    const excluirBotao=event.target.closest('[data-commitment-delete]');
    if(excluirBotao){
      const id=excluirBotao.dataset.commitmentDelete;
      const plano=(getData().commitments||[]).find(c=>c.id===id);if(!plano)return;
      if(!await confirmar({titulo:'Excluir planejamento?',mensagem:'Os pagamentos já registrados serão preservados no histórico. As próximas previsões serão removidas.',acao:'Excluir planejamento',perigoso:true}))return;
      const dados=getData();
      if(await persist({...dados,commitments:(dados.commitments||[]).filter(c=>c.id!==id)})){
        registrarEvento('EXCLUIR_COMPROMISSO','dados');render();notify('Planejamento excluído. Pagamentos preservados.');
      }return;
    }
    const pagar=event.target.closest('[data-commitment-pay]');
    if(!pagar)return;
    const id=pagar.dataset.commitmentPay,mes=pagar.dataset.month;
    const dados=getData(),plano=(dados.commitments||[]).find(c=>c.id===id),ocorrencia=ocorrenciaCompromisso(plano,mes);
    if(!ocorrencia||pagamentoRegistrado(dados.transactions,id,mes)){notify('Pagamento já registrado ou indisponível.');return;}
    if(!await confirmar({titulo:'Registrar pagamento?',mensagem:`Confirmar o pagamento de ${ocorrencia.name} no valor previsto? Será criado um lançamento de despesa; ajuste-o no histórico se o valor real foi diferente.`,acao:'Registrar despesa',perigoso:false}))return;
    try{
      const next=registrarPagamentoCompromisso(getData(),id,mes,{id:uniqueId(),date:agora(),createdAt:new Date().toISOString()});
      if(await persist(next)){registrarEvento('PAGAR_COMPROMISSO','dados');render();notify('Pagamento registrado como despesa.');}
    }catch{notify('Pagamento indisponível ou já registrado.');}
  });

  configurarTipo();
  campo('startMonth').value=getCurrentMonth();
  return {render:renderizar,novo,editar};
}
