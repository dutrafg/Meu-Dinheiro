// Montagem exclusivamente local do relatório. Sem DOM, armazenamento ou serviços externos.
const TIPOS=Object.freeze({resumo:'Resumo financeiro',renda:'Relatório de receitas',despesas:'Relatório de despesas',metas:'Metas e reserva',sonho:'Meus sonhos'});
const escapar=valor=>String(valor??'').replace(/[&<>"']/g,caractere=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[caractere]));
const numero=valor=>Number.isFinite(Number(valor))?Number(valor):0;
const centavos=valor=>Math.round(numero(valor)*100);
const percentual=(parte,total)=>total>0?Math.min(100,Math.max(0,Math.round(parte/total*100))):0;
const dataCurta=iso=>/^\d{4}-\d{2}-\d{2}$/.test(String(iso))?
  new Intl.DateTimeFormat('pt-BR',{day:'2-digit',month:'2-digit',year:'numeric',timeZone:'UTC'}).format(new Date(`${iso}T12:00:00Z`)):'Sem data';

function agrupar(itens){
  const acumulados=new Map();
  for(const item of itens){
    const categoria=String(item.category||'Outros');
    acumulados.set(categoria,(acumulados.get(categoria)||0)+centavos(item.amount));
  }
  return [...acumulados].map(([categoria,total])=>({categoria,total})).sort((a,b)=>b.total-a.total||a.categoria.localeCompare(b.categoria,'pt-BR'));
}

function tabelaCategorias(titulo,itens,money){
  const grupos=agrupar(itens),total=grupos.reduce((n,g)=>n+g.total,0);
  return `<section class="pdf-section"><div class="pdf-section-heading"><h2>${titulo}</h2><span>${grupos.length} ${grupos.length===1?'categoria':'categorias'}</span></div>
    ${grupos.length?`<table class="pdf-table pdf-categories"><thead><tr><th>Categoria</th><th>Participação</th><th class="pdf-right">Total</th></tr></thead><tbody>
    ${grupos.map(g=>`<tr><td>${escapar(g.categoria)}</td><td><div class="pdf-category-track"><span style="width:${percentual(g.total,total)}%"></span></div><small>${percentual(g.total,total)}% do total</small></td><td class="pdf-right pdf-strong">${money(g.total/100)}</td></tr>`).join('')}
    </tbody></table>`:'<p class="pdf-empty">Nenhum lançamento dessa natureza no período.</p>'}</section>`;
}

function tabelaMovimentacoes(itens,money){
  return `<section class="pdf-section"><div class="pdf-section-heading"><h2>Movimentações do período</h2><span>${itens.length} ${itens.length===1?'registro':'registros'}</span></div>
    ${itens.length?`<table class="pdf-table pdf-transactions"><thead><tr><th>Data</th><th>Descrição</th><th>Categoria</th><th>Tipo</th><th class="pdf-right">Valor</th></tr></thead><tbody>
    ${itens.map(t=>`<tr><td class="pdf-nowrap">${dataCurta(t.occurrence||t.date)}</td><td>${escapar(t.description||'Lançamento')}${t.recurring?' <small>· Mensal</small>':''}</td><td>${escapar(t.category||'Outros')}</td><td>${t.type==='income'?'Renda':'Despesa'}</td><td class="pdf-right pdf-nowrap pdf-strong ${t.type==='income'?'pdf-positive':'pdf-negative'}">${t.type==='income'?'+':'−'}${money(t.amount)}</td></tr>`).join('')}
    </tbody></table>`:'<p class="pdf-empty">Nenhuma movimentação registrada neste mês.</p>'}</section>`;
}

function metas(goals,money){
  const totalAlvo=goals.reduce((n,g)=>n+centavos(g.target),0);
  const totalGuardado=goals.reduce((n,g)=>n+centavos(g.saved),0);
  return `<section class="pdf-section"><div class="pdf-section-heading"><h2>Objetivos financeiros · posição atual</h2><span>${goals.length} ${goals.length===1?'objetivo':'objetivos'}</span></div>
    ${goals.length?`<div class="pdf-goals-summary"><span>Guardado <strong>${money(totalGuardado/100)}</strong></span><span>Objetivo total <strong>${money(totalAlvo/100)}</strong></span><span>A completar <strong>${money(Math.max(0,totalAlvo-totalGuardado)/100)}</strong></span></div>
    ${goals.map(g=>{const target=centavos(g.target),saved=centavos(g.saved),p=percentual(saved,target);
      return `<div class="pdf-goal"><div class="pdf-goal-heading"><strong>${escapar(g.name)}</strong><span>${g.kind==='dream'?'Sonho':'Meta / Reserva'} · ${p}% concluído</span></div>
      <div class="pdf-goal-track"><span style="width:${p}%"></span></div>
      <div class="pdf-goal-details"><span>${money(saved/100)} de ${money(target/100)}</span><span>${target<=saved?'Objetivo alcançado':`Faltam ${money((target-saved)/100)}`} · ${g.deadline?`Até ${dataCurta(g.deadline)}`:'Sem prazo definido'}</span></div></div>`;}).join('')}`:'<p class="pdf-empty">Nenhum objetivo cadastrado nesta área.</p>'}</section>`;
}

function aplicacoes(itens,goals,money){
  if(!itens.length)return '';
  return `<section class="pdf-section"><div class="pdf-section-heading"><h2>Histórico de aplicações e resgates</h2><span>${itens.length} registros · todos os períodos</span></div>
    <table class="pdf-table"><thead><tr><th>Data</th><th>Descrição / vínculo</th><th>Operação</th><th class="pdf-right">Valor</th></tr></thead><tbody>
    ${itens.slice().sort((a,b)=>b.date.localeCompare(a.date)).map(item=>{
      const goal=goals.find(g=>g.id===item.goalId);
      return `<tr><td class="pdf-nowrap">${dataCurta(item.date)}</td><td>${escapar(item.description||'Aplicação')}<small class="pdf-subline">${goal?`Vinculado a ${escapar(goal.name)}`:'Sem objetivo vinculado'}</small></td><td>${item.amount>=0?'Aplicação':'Resgate'}</td><td class="pdf-right pdf-nowrap pdf-strong">${money(Math.abs(item.amount))}</td></tr>`;
    }).join('')}</tbody></table></section>`;
}

export function montarRelatorioFinanceiro({visao='resumo',mes,mesExtenso,transacoes=[],objetivos=[],aplicacoesRegistradas=[],money,
  geradoEm=new Date()}={}){
  if(typeof money!=='function')throw new Error('Formatador monetário obrigatório');
  const titulo=TIPOS[visao]||TIPOS.resumo;
  const renda=transacoes.filter(t=>t.type==='income');
  const despesas=transacoes.filter(t=>t.type==='expense');
  const filtros=visao==='renda'?renda:visao==='despesas'?despesas:transacoes;
  const gerado=geradoEm.toLocaleString('pt-BR');
  const rendaCent=renda.reduce((n,t)=>n+centavos(t.amount),0);
  const despesaCent=despesas.reduce((n,t)=>n+centavos(t.amount),0);
  const saldoCent=rendaCent-despesaCent;
  const taxa=rendaCent>0?`${Math.round(saldoCent/rendaCent*1000)/10}%`:'—';
  const principal=agrupar(despesas)[0];
  const metasVisiveis=visao==='sonho'?objetivos.filter(g=>g.kind==='dream'):
    visao==='metas'?objetivos.filter(g=>g.kind==='goal'):objetivos;
  const metasRelatorio=['resumo','metas','sonho'].includes(visao);
  const aplicacoesVisiveis=aplicacoesRegistradas.filter(a=>visao==='sonho'?a.kind==='dream':a.kind==='goal'||a.kind==='reserve');
  const geral=['resumo','renda','despesas'].includes(visao);
  const referencia=geral?mesExtenso||mes:'Situação atual dos objetivos';
  const quantidade=geral?filtros.length:metasVisiveis.length;
  const itemContado=geral?(quantidade===1?'lançamento':'lançamentos'):(quantidade===1?'objetivo':'objetivos');
  const metricas=geral?[
    ['Renda do mês',rendaCent,'positive'],['Despesas do mês',despesaCent,'negative'],['Saldo do mês',saldoCent,'balance']
  ]:[
    ['Valor guardado',metasVisiveis.reduce((n,g)=>n+centavos(g.saved),0),'positive'],
    ['Valor dos objetivos',metasVisiveis.reduce((n,g)=>n+centavos(g.target),0),'balance'],
    ['A completar',metasVisiveis.reduce((n,g)=>n+Math.max(0,centavos(g.target)-centavos(g.saved)),0),'negative']
  ];
  return `<article class="pdf-document" aria-label="Relatório do Meu Dinheiro">
    <header class="pdf-header"><div class="pdf-brand"><span class="pdf-brand-mark">M</span><div><strong>Meu Dinheiro</strong><small>CONTROLE FINANCEIRO PESSOAL</small></div></div><div class="pdf-emissao"><span>RELATÓRIO FINANCEIRO</span><small>Gerado em ${escapar(gerado)}</small></div></header>
    <div class="pdf-hero"><span class="pdf-eyebrow">${geral?'RELATÓRIO DO PERÍODO':'ACOMPANHAMENTO DE OBJETIVOS'}</span><h1>${escapar(titulo)}</h1><div class="pdf-hero-meta"><span>${escapar(referencia)}</span><span>${quantidade} ${itemContado} considerados</span></div></div>
    <div class="pdf-kpis">${metricas.map(([nome,cent,classe])=>`<div class="pdf-kpi pdf-kpi-${classe}"><span>${nome}</span><strong>${money(cent/100)}</strong></div>`).join('')}</div>
    ${geral?`<div class="pdf-insights"><div><span>Taxa de poupança</span><strong>${taxa}</strong></div><div><span>Maior categoria de despesas</span><strong>${principal?escapar(principal.categoria):'Sem despesas'}</strong></div><div><span>Movimentações registradas</span><strong>${transacoes.length}</strong></div></div>`:''}
    ${visao==='resumo'||visao==='despesas'?tabelaCategorias('Despesas por categoria',despesas,money):''}
    ${visao==='resumo'||visao==='renda'?tabelaCategorias('Receitas por categoria',renda,money):''}
    ${geral?tabelaMovimentacoes(filtros,money):''}
    ${metasRelatorio?metas(metasVisiveis,money):''}
    ${visao==='metas'||visao==='sonho'?aplicacoes(aplicacoesVisiveis,objetivos,money):''}
    <section class="pdf-observacoes"><h2>Sobre este relatório</h2><p>Gerado exclusivamente no dispositivo a partir dos registros do Meu Dinheiro. ${geral?'O saldo é a diferença entre receitas e despesas do mês. Recorrências são apresentadas no período selecionado.':'As metas mostram a posição atual, e o histórico de aplicações reúne todos os períodos.'} Aportes e valores guardados são acompanhados separadamente, sem desconto duplicado. Este documento é informativo e não substitui extratos bancários.</p></section>
    <footer class="pdf-footer"><span>MEU DINHEIRO · RELATÓRIO LOCAL</span><span>${escapar(referencia)}</span></footer>
  </article>`;
}
