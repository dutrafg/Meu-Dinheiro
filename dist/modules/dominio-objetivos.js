// Regras financeiras de metas, reserva e sonhos, sem dependências de tela ou armazenamento.
const arredondar=valor=>Math.round((Number(valor)+Number.EPSILON)*100)/100;
const nomeReserva=nome=>/reserva|emerg[eê]ncia/i.test(nome||'');

export function percentualObjetivo(objetivo){
  const alvo=Number(objetivo?.target),guardado=Number(objetivo?.saved);
  return alvo>0&&Number.isFinite(alvo)&&Number.isFinite(guardado)?
    Math.min(100,Math.max(0,Math.round(guardado/alvo*100))):0;
}

export function restanteObjetivo(objetivo){
  const restante=arredondar(Number(objetivo?.target)-Number(objetivo?.saved));
  return Number.isFinite(restante)?Math.max(0,restante):0;
}

// Aplicações vinculadas já estão incorporadas em goal.saved; somá-las novamente
// duplicaria o patrimônio. Só entram à parte aplicações sem objetivo existente.
export function resumirObjetivos(dados,tipo){
  const metas=Array.isArray(dados?.goals)?dados.goals:[];
  const aplicacoes=Array.isArray(dados?.allocations)?dados.allocations:[];
  const filtradas=metas.filter(meta=>meta.kind===tipo);
  const ids=new Set(metas.map(meta=>meta.id));
  const semVinculo=aplicacoes.filter(aplicacao=>!ids.has(aplicacao.goalId)&&
    (tipo==='dream'?aplicacao.kind==='dream':['reserve','goal'].includes(aplicacao.kind)));
  const guardado=Math.max(0,arredondar(filtradas.reduce((s,m)=>s+m.saved,0)+
    semVinculo.reduce((s,a)=>s+a.amount,0)));
  const alvo=arredondar(filtradas.reduce((s,m)=>s+m.target,0));
  return {objetivos:filtradas,semVinculo,guardado,alvo};
}

export function candidatosVinculo(dados,tipo){
  const metas=Array.isArray(dados?.goals)?dados.goals:[];
  return metas.filter(meta=>tipo==='dream'?meta.kind==='dream':
    meta.kind==='goal'&&(tipo==='reserve'?nomeReserva(meta.name):!nomeReserva(meta.name)));
}

export function destaquesObjetivos(dados,reservaGoalId=''){
  const metas=Array.isArray(dados?.goals)?dados.goals:[];
  return {
    reserva:metas.find(meta=>meta.kind==='goal'&&
      (reservaGoalId?meta.id===reservaGoalId:nomeReserva(meta.name)))||
      metas.find(meta=>meta.kind==='goal')||null,
    sonho:metas.find(meta=>meta.kind==='dream')||null
  };
}
