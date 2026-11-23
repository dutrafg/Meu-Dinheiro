// Preferências são independentes dos dados financeiros e validadas na leitura.
export const CHAVE_PREFERENCIAS = 'meu-dinheiro-essencial:preferencias:v1';
export const CORES = Object.freeze({
  verde:'#16875c',azul:'#2563eb',roxo:'#7c3aed',laranja:'#c05616',rosa:'#be185d',turquesa:'#087e8b'
});
export const TEMAS = Object.freeze(['auto','claro','escuro']);
export const CATEGORIAS_APORTE_PADRAO = Object.freeze(['Salário base','Salário','Personal']);
export const ICONES_PERSONALIZADOS=Object.freeze(['🏷️','🛒','🍔','🏠','💡','🚗','💊','🎉','🎁','💼','💰','📦','🐾','🎓','💳','📺','✈️','🧾']);
const nomeCategoriaValido=nome=>typeof nome==='string'&&nome.trim().length>0&&nome.length<=50&&!/[<>\r\n]/.test(nome);

export function normalizarCategoriasPersonalizadas(valor){
  const origem=valor&&typeof valor==='object'?valor:{};
  const extra={},ocultas={},icones={};
  for(const tipo of ['income','expense']){
    extra[tipo]=Array.isArray(origem.categoriasExtras?.[tipo])?[...new Set(origem.categoriasExtras[tipo].filter(nomeCategoriaValido).map(v=>v.trim()))].slice(0,50):[];
    ocultas[tipo]=Array.isArray(origem.categoriasOcultas?.[tipo])?[...new Set(origem.categoriasOcultas[tipo].filter(nomeCategoriaValido).map(v=>v.trim()))].slice(0,100):[];
  }
  if(origem.categoriaIcones&&typeof origem.categoriaIcones==='object'&&!Array.isArray(origem.categoriaIcones)){
    for(const [nome,icone] of Object.entries(origem.categoriaIcones).slice(0,100))
      if(nomeCategoriaValido(nome)&&ICONES_PERSONALIZADOS.includes(icone))icones[nome]=icone;
  }
  return {categoriasExtras:extra,categoriasOcultas:ocultas,categoriaIcones:icones};
}

export function preferenciasPadrao() {
  return {tema:'auto',cor:'azul',percentual:10,categoriasAporte:[...CATEGORIAS_APORTE_PADRAO],reservaGoalId:'',limiteMensal:null,metaPoupancaMensal:null,...normalizarCategoriasPersonalizadas({})};
}

function valorMonetarioOpcional(valor){
  if(valor===null||valor===undefined||valor==='')return null;
  if(typeof valor!=='number'||!Number.isFinite(valor)||valor<=0||valor>999999999)return null;
  return Math.round((valor+Number.EPSILON)*100)/100;
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
    reservaGoalId:typeof valor.reservaGoalId==='string'&&valor.reservaGoalId.length<=200?valor.reservaGoalId:'',
    limiteMensal:valorMonetarioOpcional(valor.limiteMensal),
    metaPoupancaMensal:valorMonetarioOpcional(valor.metaPoupancaMensal),
    ...normalizarCategoriasPersonalizadas(valor)
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
    obter:()=>({...atual,categoriasAporte:[...atual.categoriasAporte],
      categoriasExtras:{income:[...atual.categoriasExtras.income],expense:[...atual.categoriasExtras.expense]},
      categoriasOcultas:{income:[...atual.categoriasOcultas.income],expense:[...atual.categoriasOcultas.expense]},
      categoriaIcones:{...atual.categoriaIcones}}),
    salvar:valor=>{
      const proximo=normalizarPreferencias(valor,categoriasRenda);
      try {
        const serializado=JSON.stringify(proximo);
        if(serializado.length>8192)throw Error('Limite de preferências');
        storage?.setItem(CHAVE_PREFERENCIAS,serializado);atual=proximo;disponivel=true;return true;
      }
      catch {disponivel=false;return false;}
    },
    disponivel:()=>disponivel
  };
}
