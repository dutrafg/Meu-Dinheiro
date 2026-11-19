// Preferências são independentes dos dados financeiros e validadas na leitura.
export const CHAVE_PREFERENCIAS = 'meu-dinheiro-essencial:preferencias:v1';
export const CORES = Object.freeze({
  verde:'#16875c',azul:'#2563eb',roxo:'#7c3aed',laranja:'#c05616',rosa:'#be185d',turquesa:'#087e8b'
});
export const TEMAS = Object.freeze(['auto','claro','escuro']);
export const CATEGORIAS_APORTE_PADRAO = Object.freeze(['Salário base','Salário','Personal']);

export function preferenciasPadrao() {
  return {tema:'auto',cor:'verde',percentual:10,categoriasAporte:[...CATEGORIAS_APORTE_PADRAO],reservaGoalId:''};
}

export function normalizarPreferencias(valor, categoriasRenda=[]) {
  const padrao=preferenciasPadrao();
  if (!valor || typeof valor!=='object' || Array.isArray(valor)) return padrao;
  const permitidas=new Set(categoriasRenda.length?categoriasRenda:['Salário base','Salário','Personal','Renda extra','Vendas','Benefícios','Outros']);
  const valido=Number(valor.percentual);
  return {
    tema:TEMAS.includes(valor.tema)?valor.tema:padrao.tema,
    cor:Object.hasOwn(CORES,valor.cor)?valor.cor:padrao.cor,
    percentual:typeof valor.percentual==='number'&&Number.isFinite(valido)&&valido>=0&&valido<=100?Math.round(valido*100)/100:padrao.percentual,
    categoriasAporte:Array.isArray(valor.categoriasAporte)?[...new Set(valor.categoriasAporte.filter(c=>typeof c==='string'&&permitidas.has(c)))]:padrao.categoriasAporte.filter(c=>permitidas.has(c)),
    reservaGoalId:typeof valor.reservaGoalId==='string'&&valor.reservaGoalId.length<=200?valor.reservaGoalId:''
  };
}

export function criarGestorPreferencias({storage, categoriasRenda=[]}={}) {
  let atual=preferenciasPadrao();
  let disponivel=true;
  try {
    const salvo=storage?.getItem(CHAVE_PREFERENCIAS);
    atual=salvo?normalizarPreferencias(JSON.parse(salvo),categoriasRenda):normalizarPreferencias(atual,categoriasRenda);
  } catch { disponivel=false; }
  return {
    obter:()=>({...atual,categoriasAporte:[...atual.categoriasAporte]}),
    salvar:valor=>{
      const proximo=normalizarPreferencias(valor,categoriasRenda);
      try {storage?.setItem(CHAVE_PREFERENCIAS,JSON.stringify(proximo));atual=proximo;disponivel=true;return true;}
      catch {disponivel=false;return false;}
    },
    disponivel:()=>disponivel
  };
}
