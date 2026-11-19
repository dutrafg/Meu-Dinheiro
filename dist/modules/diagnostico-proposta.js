// Checklist da proposta de navegação/Ajustes v19-2.
// Pendências de design não são erros de integridade nem entram nos logs de falha.
export const REQUISITOS_PROPOSTA = Object.freeze([
  ['NAV_AJUSTES_DESKTOP','Navegação','Aba Ajustes disponível na navegação desktop'],
  ['NAV_AJUSTES_MOBILE','Navegação','Aba Ajustes disponível na navegação móvel'],
  ['AJUSTES_PAGINA','Navegação','Ajustes renderizados como página dentro do conteúdo principal'],
  ['AJUSTES_FAB','Navegação','Botão flutuante oculto na tela Ajustes'],
  ['AJUSTES_SEM_MES','Navegação','Seletor de mês ausente na tela Ajustes'],
  ['AJUSTES_DIAGNOSTICO_DIRETO','Navegação','Diagnóstico acessível diretamente a partir da página Ajustes'],
  ['AJUSTES_SEM_MENU_REDUNDANTE','Navegação','Menu de reticências redundante removido'],
  ['AJUSTES_AVISO_NAV','Navegação','Alertas de backup e atualização indicados na aba Ajustes'],
  ['ICONE_ENGRENAGEM','Ícones','Ícone SVG de engrenagem registrado no sprite'],
  ['ICONE_DIAGNOSTICO','Ícones','Botão Diagnóstico usa o SVG de atividade'],
  ['ICONES_SEM_EMOJI','Ícones','Títulos e controles de Ajustes usam ícones consistentes'],
  ['BARRAS_ALTURAS','Barras de progresso','Barras usam 10 px em listas e 12 px em destaques'],
  ['BARRAS_CORES','Barras de progresso','Barras de objetivos usam a cor semântica do objetivo'],
  ['BARRAS_ACESSIVEIS','Barras de progresso','Progresso de metas possui rótulo e percentual acessíveis'],
  ['BARRAS_ANIMACAO','Barras de progresso','Animação de entrada respeita movimento reduzido'],
  ['DIAGNOSTICO_ETAPAS','Barras de progresso','Barra de diagnóstico possui marcadores de etapa'],
  ['TEMA_AUTO','Tema','Tema automático preservado como padrão inicial'],
  ['TEMA_AZUL','Tema','Azul adotado como destaque inicial recomendado'],
  ['TEMA_CONTRASTE_ESCURO','Tema','Cor de destaque tem contraste 4,5:1 no tema escuro'],
  ['AJUSTES_LINHAS','Interface','Preferências organizadas em linhas de configuração'],
  ['AJUSTES_CORES_PREVIEW','Interface','Pastilhas de cores circulares com prévia disponível'],
  ['DIAGNOSTICO_GRUPOS','Interface','Resultados agrupados em cartões expansíveis por módulo']
]);

const ler=(objeto,metodo,...args)=>typeof objeto?.[metodo]==='function'?objeto[metodo](...args):null;

function regrasCSS(documento){
  if(!documento?.styleSheets?.length)return null;
  const regras=[];const visitados=new Set();
  function percorrer(lista){
    if(!lista||visitados.has(lista))return;
    visitados.add(lista);
    for(const item of lista){
      if(item.selectorText&&item.style)regras.push(item);
      try{if(item.cssRules)percorrer(item.cssRules);if(item.styleSheet?.cssRules)percorrer(item.styleSheet.cssRules);}
      catch{/* Folha de outro domínio sem acesso permitido. */}
    }
  }
  try {for(const folha of documento.styleSheets)percorrer(folha.cssRules);}catch{return null;}
  return regras.length?regras:null;
}

function regraDe(regras,seletor){
  return regras?.find(regra=>regra.selectorText.split(',').some(s=>s.trim()===seletor))?.style||null;
}

function luminancia(cor){
  const hex=String(cor||'').trim().toLowerCase();
  const match=hex.match(/^#([0-9a-f]{6})$/);
  const rgb=match?[1,3,5].map(n=>parseInt(match[1].slice(n-1,n+1),16)):
    [...hex.matchAll(/\d+(?:\.\d+)?/g)].slice(0,3).map(v=>Number(v[0]));
  if(rgb.length!==3||rgb.some(n=>!Number.isFinite(n)||n<0||n>255))return null;
  const canais=rgb.map(n=>{const v=n/255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4;});
  return canais[0]*.2126+canais[1]*.7152+canais[2]*.0722;
}

export function avaliarRequisitosProposta(sinais={}) {
  const itens=REQUISITOS_PROPOSTA.map(([id,area,descricao])=>{
    const resultado=sinais[id];
    const estado=resultado===true?'ok':resultado===false?'pendente':'nao_avaliado';
    return {codigo:`PROPOSTA_${id}`,modulo:'proposta-interface',area,estado,
      descricao:`${estado==='ok'?'Implementado':estado==='pendente'?'Proposta pendente':'Não verificável neste contexto'}: ${descricao}`};
  });
  return {referencia:'Proposta-Ajustes-Diagnostico-na-Nav-v19-2',total:itens.length,
    implementados:itens.filter(i=>i.estado==='ok').length,pendentes:itens.filter(i=>i.estado==='pendente').length,
    naoAvaliados:itens.filter(i=>i.estado==='nao_avaliado').length,itens};
}

export function verificarPropostaInterface({documento,janela,padrao}={}) {
  if(!documento||typeof documento.querySelector!=='function'||typeof documento.getElementById!=='function')return null;
  const get=id=>documento.getElementById(id);
  const dnav=get('desktop-nav'),mnav=get('mobile-nav'),main=get('main-content'),pagina=get('settings-page');
  const fab=get('quick-add'),botaoDiagnostico=get('open-diagnostics');
  const ajustesAtivo=Boolean(ler(dnav,'querySelector','[data-view="ajustes"].active')||ler(mnav,'querySelector','[data-view="ajustes"].active'));
  const direto=pagina&&botaoDiagnostico&&pagina.contains?.(botaoDiagnostico)&&
    !Boolean(botaoDiagnostico.closest?.('details:not([open])'));
  const css=regrasCSS(documento);
  const altura=seletor=>regraDe(css,seletor)?.getPropertyValue('height')?.trim()||null;
  const inicio=regraDe(css,'.proto-progress .bar>div');
  const animacao=Boolean(regraDe(css,'.progress-bar-fill')?.getPropertyValue('animation'));
  const movimentoReduzido=Boolean(documento.styleSheets&&css?.some(r=>r.parentRule?.conditionText?.includes('prefers-reduced-motion')));
  const resumoBarra=ler(documento,'querySelector','.proto-progress .bar>div');
  const barraMeta=ler(documento,'querySelector','.proto-progress .bar');
  const titulo=String(get('settings-title')?.textContent||'');
  const textoDiagnostico=String(botaoDiagnostico?.textContent||'');
  const emoji=/[\u{1F300}-\u{1FAFF}\u2600-\u27BF]/u;
  const corBolinha=ler(documento,'querySelector','.settings-color-dot');
  const dadosContraste=(()=>{
    if(!janela?.getComputedStyle||!documento.documentElement)return null;
    try{
      const style=janela.getComputedStyle(documento.documentElement);
      if(!String(style.colorScheme||'').split(' ').includes('dark'))return null;
      const l1=luminancia(style.getPropertyValue('--accent-text')||style.getPropertyValue('--accent'));
      const l2=luminancia(style.getPropertyValue('--card'));
      return l1===null||l2===null?null:(Math.max(l1,l2)+.05)/(Math.min(l1,l2)+.05)>=4.5;
    }catch{return null;}
  })();
  const sinais={
    NAV_AJUSTES_DESKTOP:Boolean(ler(dnav,'querySelector','[data-view="ajustes"]')),
    NAV_AJUSTES_MOBILE:Boolean(ler(mnav,'querySelector','[data-view="ajustes"]')),
    AJUSTES_PAGINA:Boolean(pagina&&main?.contains?.(pagina)&&get('settings-form')&&pagina.contains(get('settings-form'))),
    AJUSTES_FAB:ajustesAtivo?Boolean(fab?.classList?.contains('hidden')):undefined,
    AJUSTES_SEM_MES:ajustesAtivo?(Boolean(get('view-content')?.classList?.contains('hidden'))||
      !Boolean(ler(main,'querySelector','.month-control'))):undefined,
    AJUSTES_DIAGNOSTICO_DIRETO:Boolean(direto),
    AJUSTES_SEM_MENU_REDUNDANTE:!get('backup-menu-button'),
    AJUSTES_AVISO_NAV:Boolean(ler(dnav,'querySelector','[data-view="ajustes"] .nav-status-dot')||
      ler(mnav,'querySelector','[data-view="ajustes"] .nav-status-dot')),
    ICONE_ENGRENAGEM:Boolean(get('i-settings')),
    ICONE_DIAGNOSTICO:Boolean(ler(botaoDiagnostico,'querySelector','svg use[href="#i-activity"]')),
    ICONES_SEM_EMOJI:!emoji.test(titulo)&&!emoji.test(textoDiagnostico),
    BARRAS_ALTURAS:css?altura('.progress-bar')==='10px'&&altura('.progress-bar-large')==='12px':undefined,
    BARRAS_CORES:resumoBarra&&String(resumoBarra.style?.background||'').includes('--goal-accent')||
      (css?String(inicio?.getPropertyValue('background')||'').includes('--goal-accent'):undefined),
    BARRAS_ACESSIVEIS:barraMeta?barraMeta.getAttribute?.('role')==='progressbar'&&Boolean(barraMeta.getAttribute('aria-valuenow')):undefined,
    BARRAS_ANIMACAO:css?animacao&&movimentoReduzido:undefined,
    DIAGNOSTICO_ETAPAS:css?Boolean(css.some(r=>r.selectorText.includes('.diagnostics-progress::after')&&
      r.style.getPropertyValue('background-image').includes('linear-gradient'))):undefined,
    TEMA_AUTO:padrao?padrao.tema==='auto':undefined,
    TEMA_AZUL:padrao?padrao.cor==='azul':undefined,
    TEMA_CONTRASTE_ESCURO:dadosContraste??undefined,
    AJUSTES_LINHAS:Boolean(ler(documento,'querySelector','#settings-page .settings-row')),
    AJUSTES_CORES_PREVIEW:corBolinha?(()=>{
      const raio=String(janela?.getComputedStyle?.(corBolinha)?.borderRadius||'');
      return raio.includes('50%')||parseFloat(raio)>=15;
    })():undefined,
    DIAGNOSTICO_GRUPOS:Boolean(get('diagnostics-checks')?.classList?.contains('diagnostics-groups'))
  };
  return avaliarRequisitosProposta(sinais);
}
