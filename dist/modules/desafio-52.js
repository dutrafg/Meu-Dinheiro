export const NOME_DESAFIO_52='Desafio das 52 semanas';
export const CATEGORIA_DESAFIO_52='Desafio 52 semanas';
export const TOTAL_DESAFIO_52=2756;

export function valorSemana52(semana){
  return Number.isSafeInteger(semana)&&semana>=1&&semana<=52?semana*2:null;
}
export function descricaoSemana52(semana){
  return `Desafio 52 semanas · Semana ${String(semana).padStart(2,'0')}`;
}

// Progresso derivado das alocações financeiras existentes. Não existem
// "semanas salvas" paralelas, nem incremento no goal.saved sem transação.
export function resumirDesafio52(dados){
  const objetivo=(dados?.goals||[]).find(g=>g.kind==='goal'&&g.name===NOME_DESAFIO_52);
  const aportes=objetivo?(dados?.allocations||[]).filter(a=>a.goalId===objetivo.id&&a.category===CATEGORIA_DESAFIO_52):[];
  const semanas=Array.from({length:52},(_,i)=>{
    const numero=i+1,valor=valorSemana52(numero);
    const registros=aportes.filter(a=>a.description===descricaoSemana52(numero)&&a.amount===valor);
    return {numero,valor,registrado:registros.length>0,duplicado:registros.length>1};
  });
  const guardado=semanas.filter(s=>s.registrado).reduce((total,s)=>total+s.valor,0);
  return {objetivo,semanas,guardado,meta:TOTAL_DESAFIO_52,
    concluidas:semanas.filter(s=>s.registrado).length,
    duplicadas:semanas.some(s=>s.duplicado)};
}

export function renderDesafio52(dados,{esc,money}){
  const estado=resumirDesafio52(dados);
  return `<details class="card proto-challenge"><summary>Desafio das 52 semanas · guarde de R$ 2 a R$ 104</summary>
    <p class="field-hint">Na semana 1 são R$ 2, na 2 R$ 4, até R$ 104 na semana 52. Se concluir todas, soma R$ 2.756. Só conta quando você confirmar e salvar o aporte.</p>
    ${estado.objetivo?`<div class="challenge-summary"><strong>${money(estado.guardado)} registrados de ${money(estado.meta)}</strong><span>${estado.concluidas} de 52 semanas confirmadas</span></div>
      <div class="progress-bar challenge-track" role="progressbar" aria-label="Progresso do desafio de 52 semanas" aria-valuemin="0" aria-valuemax="52" aria-valuenow="${estado.concluidas}"><div class="progress-bar-fill" style="width:${estado.concluidas/52*100}%"></div></div>
      ${estado.duplicadas?'<p class="challenge-warning" role="alert">Há semanas com dois aportes iguais. Confira o histórico para evitar duplicidade.</p>':''}
      <div class="challenge-grid" role="group" aria-label="Semanas do desafio">
      ${estado.semanas.map(s=>`<button type="button" data-action="challenge-week" data-id="${esc(estado.objetivo.id)}" data-week="${s.numero}" aria-label="Semana ${s.numero}, ${money(s.valor)}${s.registrado?', aporte registrado':''}" ${s.registrado?'disabled':''} class="${s.registrado?'is-done':''}"><strong>${s.numero}${s.registrado?' ✓':''}</strong><small>${money(s.valor)}</small></button>`).join('')}
      </div><p class="field-hint">Toque numa semana para preencher o aporte. Escolha a origem e confirme em Salvar investimento. Para editar ou corrigir, use o Histórico de investimentos abaixo. Este desafio não cria renda automaticamente.</p>`:
      `<p>Crie a meta do desafio para acompanhar as semanas no seu backup financeiro.</p><button type="button" class="button button-primary" data-action="challenge-create">Criar meta de R$ 2.756</button>`}
  </details>`;
}
