import { MODULOS_OBRIGATORIOS } from './catalogo-diagnostico.js';

// Auditoria conservadora: aponta candidatos para revisão, nunca apaga arquivos.
// Símbolos construídos indiretamente podem parecer sem uso; por isso o nível é "aviso".
const BIBLIOTECAS_JS=['csv.js','analytics.js','folder-backup.js','app.js'];
const ARQUIVOS_CSS=['styles.css'];
const LOCALIZACAO_CLASSE=/(?<![\w-])\.([a-zA-Z_][\w-]*)/g;
const LOCALIZACAO_FUNCAO=/\b(?:(export)\s+)?(?:async\s+)?function\s+([a-zA-Z_$][\w$]*)\s*\(/g;
const LOCALIZACAO_SETA=/\b(?:(export)\s+)?(?:const|let)\s+([a-zA-Z_$][\w$]*)\s*=\s*(?:async\s*)?(?:(?:\([^;{}]*\)|[a-zA-Z_$][\w$]*)\s*=>|function\s*\()/g;

function mencionado(texto,nome,classe=false) {
  const limite=classe?'a-zA-Z0-9_-':'a-zA-Z0-9_$-';
  const padrao=new RegExp(`(?<![${limite}])${nome.replace(/\$/g,'\\$')}(?![${limite}])`,'g');
  return [...texto.matchAll(padrao)].length;
}

export function analisarCodigoEstatico({fontesCss,fontesJs,html=''}) {
  const codigo=Object.values(fontesJs).join('\n')+'\n'+html;
  // Classes criadas em runtime, como `diagnostics-${estado}`, não são lixo CSS.
  const prefixosDinamicos=[...codigo.matchAll(/([a-z][\w-]*-)\$\{/g)].map(m=>m[1]);
  const cssNaoUsados=[];let seletoresVerificados=0;
  for(const [arquivo,conteudo] of Object.entries(fontesCss)){
    const semComentarios=conteudo.replace(/\/\*[\s\S]*?\*\//g,'');
    const classes=[...new Set([...semComentarios.matchAll(LOCALIZACAO_CLASSE)].map(m=>m[1]))];
    seletoresVerificados+=classes.length;
    for(const nome of classes)if(!mencionado(codigo,nome,true)&&!prefixosDinamicos.some(prefixo=>nome.startsWith(prefixo)))
      cssNaoUsados.push({arquivo,nome});
  }
  const funcoesSemUso=[];let funcoesVerificadas=0;
  for(const [arquivo,conteudo] of Object.entries(fontesJs)){
    const nomes=new Set();
    for(const regex of [LOCALIZACAO_FUNCAO,LOCALIZACAO_SETA]){
      for(const match of conteudo.matchAll(regex)){
        const nome=match[2];
        if(match[1]||/\bexport\s+(?:default\s+)?$/.test(conteudo.slice(Math.max(0,match.index-20),match.index)))continue;
        nomes.add(nome);
      }
    }
    funcoesVerificadas+=nomes.size;
    for(const nome of nomes)if(mencionado(codigo,nome)===1)funcoesSemUso.push({arquivo,nome});
  }
  return {cssNaoUsados,funcoesSemUso,seletoresVerificados,funcoesVerificadas};
}

export async function auditarCodigoPublicado({buscar=typeof fetch==='function'?fetch.bind(globalThis):null,
  modulos=MODULOS_OBRIGATORIOS}={}) {
  // HTML de homologação é independente: não possui JS/CSS externos para consultar.
  if(typeof document!=='undefined'&&(!document.querySelector('link[href="./styles.css"]')||!document.querySelector('script[src="./app.js"]')))
    return {disponivel:false,motivo:'Prévia independente sem fontes modulares externas'};
  if(!buscar)return {disponivel:false,motivo:'Leitura de arquivos do aplicativo indisponível'};
  const carregar=async arquivo=>{
    const resposta=await buscar(`./${arquivo}`);
    if(!resposta.ok)throw Error('Fonte indisponível');
    const texto=await resposta.text();
    if(/^\s*<!doctype html/i.test(texto)&&arquivo!=='index.html')throw Error('Arquivo substituído por página HTML');
    return texto;
  };
  try {
    const [html,imports]=await Promise.all([carregar('index.html'),carregar('prototype.css')]);
    const css=[...ARQUIVOS_CSS,...[...imports.matchAll(/@import\s+url\("\.\/([^"\s]+\.css)"\)/g)].map(m=>m[1])];
    const js=[...BIBLIOTECAS_JS,...modulos.map(nome=>`modules/${nome}.js`)];
    const arquivos=[...new Set([...css,...js])];
    const textos=await Promise.all(arquivos.map(carregar));
    const carregados=Object.fromEntries(arquivos.map((arquivo,i)=>[arquivo,textos[i]]));
    return {disponivel:true,arquivosInspecionados:arquivos.length,
      ...analisarCodigoEstatico({fontesCss:Object.fromEntries(css.map(nome=>[nome,carregados[nome]])),
        fontesJs:Object.fromEntries(js.map(nome=>[nome,carregados[nome]])),html})};
  }catch{
    return {disponivel:false,motivo:'Não foi possível ler todos os arquivos publicados, inclusive offline'};
  }
}
