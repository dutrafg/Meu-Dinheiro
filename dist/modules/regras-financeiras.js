// Regras puras para o plano de aporte. Nunca transferem ou alteram dinheiro.
export function calcularAporte(entrada, preferencias) {
  if(!entrada||entrada.type!=='income'||!preferencias.categoriasAporte.includes(entrada.category))return null;
  return Math.round((entrada.amount*preferencias.percentual/100+Number.EPSILON)*100)/100;
}

export function calcularPlanoAporte(entradas, preferencias) {
  const categorias=preferencias.categoriasAporte;
  const grupos=categorias.map(categoria=>{
    const base=Math.round(entradas.filter(t=>t.type==='income'&&t.category===categoria).reduce((s,t)=>s+t.amount,0)*100)/100;
    const aporte=Math.round((base*preferencias.percentual/100+Number.EPSILON)*100)/100;
    return {categoria,base,aporte};
  });
  const base=grupos.filter(g=>['Salário base','Salário'].includes(g.categoria)).reduce((s,g)=>s+g.base,0);
  const personal=grupos.find(g=>g.categoria==='Personal')?.base||0;
  const baseTen=grupos.filter(g=>['Salário base','Salário'].includes(g.categoria)).reduce((s,g)=>s+g.aporte,0);
  const personalTen=grupos.find(g=>g.categoria==='Personal')?.aporte||0;
  return {grupos,percentual:preferencias.percentual,base,personal,baseTen,personalTen,
    total:Math.round((grupos.reduce((s,g)=>s+g.aporte,0)+Number.EPSILON)*100)/100};
}
