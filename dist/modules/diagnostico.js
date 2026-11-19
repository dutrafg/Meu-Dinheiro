import { verificarIntegridade } from './integridade.js';
import { executarVerificacoesModulos,MODULOS_OBRIGATORIOS,totalRegistros } from './catalogo-diagnostico.js';
import { CORES,TEMAS,preferenciasPadrao } from './preferencias.js';
import { auditarCodigoPublicado } from './auditoria-codigo.js';
import { verificarPropostaInterface } from './diagnostico-proposta.js';
import { calcularSaldoDisponivelHoje } from './resumo.js';
import { normalizarDadosLocais, validarBackup, podeAplicarNoObjetivo } from './validacao.js';
import { apagarDadosLocais, validarFraseLimpeza } from './limpeza-dados.js';

const CHAVE_DADOS = 'meu-dinheiro-essencial:v1';
const CACHE_PREFIXO = 'meu-dinheiro-essencial-v';
export function calcularDuracaoDiagnostico(totalVerificacoes) {
  return Math.min(25000,5000 + Math.max(0,Math.trunc(totalVerificacoes)-9)*500);
}

// Nenhum lançamento, nome, descrição, valor, caminho de pasta ou objeto de erro sai no JSON.
export async function criarRelatorioDiagnostico({getData,CATEGORIES,getFolderState=()=>null,getUpdateStatus=()=>null,
  getStorageLocked=()=>false,getCdiStatus=()=>false,getPreferences=()=>null,getNotificationStatus=()=>null,obterLogs=()=>[]}) {
  const dados = getData();
  const integridade = verificarIntegridade(dados,CATEGORIES);
  const transactions = Array.isArray(dados?.transactions) ? dados.transactions : [];
  const dates = transactions.map(item=>item?.date).filter(value=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)).sort();
  let tamanhoBytes = null;
  let armazenamentoDisponivel = false;
  try {
    const raw = localStorage.getItem(CHAVE_DADOS);
    armazenamentoDisponivel = true;
    tamanhoBytes = raw===null?0:new Blob([raw]).size;
  } catch { /* Dados existentes não são modificados. */ }

  let usoEstimado = null;
  try {
    if (navigator.storage?.estimate) {
      const estimate = await navigator.storage.estimate();
      usoEstimado = {usoAproximado:estimate.usage??null,quotaAproximada:estimate.quota??null};
    }
  } catch { /* API opcional. */ }

  let swRegistrado = false;
  let swEmEspera = false;
  let cacheInstalado = [];
  try {
    const registration = await navigator.serviceWorker?.getRegistration?.();
    swRegistrado=Boolean(registration?.active);
    swEmEspera=Boolean(registration?.waiting);
  } catch { /* Browser sem SW ou sem permissão. */ }
  try {
    if (typeof caches !== 'undefined' && typeof caches.keys === 'function') {
      cacheInstalado=(await caches.keys()).filter(name=>name.startsWith(CACHE_PREFIXO));
    }
  } catch { /* Cache não disponível. */ }

  const pasta = getFolderState() || {};
  const update = getUpdateStatus() || {};
  const resumo = {
    lancamentos: transactions.length,
    metas: Array.isArray(dados?.goals)?dados.goals.length:0,
    aplicacoes: Array.isArray(dados?.allocations)?dados.allocations.length:0,
    lembretesConcluidos: Array.isArray(dados?.completedAportes)?dados.completedAportes.length:0,
    tamanhoDadosBytes:tamanhoBytes,
    primeiroLancamento:dates[0]||null,
    ultimoLancamento:dates.at(-1)||null,
    gravacaoBloqueada:Boolean(getStorageLocked())
  };
  const bibliotecas = {
    csv:typeof window.MeuDinheiroCSV?.importCSV==='function',
    graficos:typeof window.MeuDinheiroAnalytics?.expenseCategoryStats==='function',
    backup:typeof window.MeuDinheiroFolderBackup?.createBrowserManager==='function'
  };
  const adicionar=(codigo,estado,descricao,modulo='ambiente')=>integridade.itens.push({codigo,estado,descricao,modulo});
  const conferir=(codigo,ok,correto,problema,modulo='ambiente',estadoRuim='erro')=>adicionar(codigo,ok?'ok':estadoRuim,ok?correto:problema,modulo);
  // Cenário sintético: passado, recorrência mensal e transação futura, sem expor saldos.
  const saldoExemplo=calcularSaldoDisponivelHoje([
    {type:'income',date:'2026-02-10',amount:100,recurring:true},
    {type:'expense',date:'2026-03-14',amount:30},
    {type:'expense',date:'2026-03-20',amount:40},
    {type:'expense',date:'2026-01-31',amount:10,recurring:true}
  ],'2026-03-15');
  conferir('SALDO_DISPONIVEL_HOJE',saldoExemplo===150,
    'Saldo disponível calculado corretamente com recorrências e lançamentos futuros',
    'Cálculo do saldo disponível não corresponde ao cenário de referência','resumo');
  // Testes em armazenamento fictício: nunca removem registros do usuário.
  const armazenamentoTeste=new Map([['dados','financeiros'],['preferencias','escuro']]);
  const ordemLimpeza=[];
  const apagouTeste=await apagarDadosLocais({storage:{removeItem:chave=>{
    ordemLimpeza.push('remover');armazenamentoTeste.delete(chave);
  }},chave:'dados',pausarBackup:async()=>ordemLimpeza.push('pausar')});
  conferir('LIMPEZA_CHAVE_EXCLUSIVA',apagouTeste&&!armazenamentoTeste.has('dados')&&armazenamentoTeste.get('preferencias')==='escuro',
    'Limpeza remove somente a chave financeira no cenário de teste',
    'Limpeza não preservou outras configurações no cenário de teste','limpeza-dados');
  conferir('LIMPEZA_ORDEM_BACKUP',ordemLimpeza.join(',')==='pausar,remover',
    'Backup pausado antes da remoção local no cenário de teste',
    'Proteção do backup não precede a remoção local','limpeza-dados');
  const erroLimpeza=await apagarDadosLocais({storage:{removeItem:()=>{throw Error('simulação');}},chave:'dados'});
  conferir('LIMPEZA_FALHA_SEGURA',erroLimpeza===false,
    'Falha simulada de armazenamento não informa sucesso',
    'Limpeza informa sucesso após falha no armazenamento','limpeza-dados');
  conferir('LIMPEZA_FRASE_EXATA',validarFraseLimpeza('APAGAR')&&!validarFraseLimpeza('apagar')&&!validarFraseLimpeza('APAGAR '),
    'Segunda confirmação exige a frase exata',
    'Segunda confirmação aceita frase incompleta ou alterada','limpeza-dados');
  // Cenários artificiais: nenhuma alteração no armazenamento ou nos dados do usuário.
  const amostra={transactions:[{id:'diag-t',description:'Exemplo',type:'income',amount:10,date:'2026-11-19',category:'Salário'}],
    goals:[{id:'diag-g',name:'Reserva',kind:'goal',target:100,saved:10,deadline:''}],allocations:[],completedAportes:[]};
  const rejeita=entrada=>{try{normalizarDadosLocais(entrada);return false;}catch{return true;}};
  conferir('VALIDACAO_DADOS_VALIDOS',!rejeita(amostra),'Estrutura válida aceita na leitura local','Estrutura válida rejeitada na leitura local','validacao');
  conferir('VALIDACAO_ID_DUPLICADO',rejeita({...amostra,transactions:[...amostra.transactions,{...amostra.transactions[0]}]}),
    'IDs duplicados rejeitados na leitura local','Leitura local aceitou IDs de lançamentos duplicados','validacao');
  conferir('VALIDACAO_ID_ENTRE_LISTAS',rejeita({...amostra,allocations:[{id:'diag-t',description:'Aporte',kind:'reserve',amount:1,date:'2026-11-19',goalId:''}]}),
    'ID repetido entre lançamento e aplicação rejeitado','Leitura local aceitou ID repetido entre listas','validacao');
  conferir('VALIDACAO_VINCULO_TIPO',rejeita({...amostra,allocations:[{id:'diag-a',description:'Aporte',kind:'dream',amount:1,date:'2026-11-19',goalId:'diag-g'}]}),
    'Vínculo com tipo incompatível rejeitado','Leitura local aceitou vínculo de tipo incompatível','validacao');
  conferir('VALIDACAO_SEM_VINCULO',!rejeita({...amostra,allocations:[{id:'diag-a',description:'Aporte',kind:'reserve',amount:1,date:'2026-11-19',goalId:''}]}),
    'Aplicação sem vínculo preservada','Aplicação legítima sem vínculo foi rejeitada','validacao');
  const backupAmostra={app:'meu-dinheiro-essencial',version:1,transactions:amostra.transactions.map(t=>({...t,recurring:false,createdAt:'2026-11-19T12:00:00.000Z'})),goals:amostra.goals};
  const rejeitaBackup=entrada=>{try{validarBackup(entrada,CATEGORIES);return false;}catch{return true;}};
  conferir('BACKUP_VINCULO_TIPO',rejeitaBackup({...backupAmostra,allocations:[{id:'diag-a',description:'Aporte',kind:'dream',amount:1,date:'2026-11-19',goalId:'diag-g'}]}),
    'Backup rejeita vínculo incompatível','Backup aceitou vínculo incompatível','backup');
  conferir('RESGATE_LIMITE',podeAplicarNoObjetivo(10,-5)&&podeAplicarNoObjetivo(10,-10)&&!podeAplicarNoObjetivo(10,-20),
    'Limite de resgate de objetivo calculável','Limite de resgate de objetivo inconsistente','objetivos');
  for(const [nome,carregado] of Object.entries(bibliotecas))conferir(`LIB_${nome.toUpperCase()}`,carregado,`Biblioteca ${nome} carregada`,`Biblioteca ${nome} indisponível`,'bibliotecas');
  adicionar('GRAVACAO_SEGURA',resumo.gravacaoBloqueada?'erro':'ok',resumo.gravacaoBloqueada?'Gravação bloqueada para proteger dados inconsistentes':'Dados locais sem bloqueio de gravação');
  adicionar('ARMAZENAMENTO',armazenamentoDisponivel?'ok':'aviso',armazenamentoDisponivel?'Armazenamento local disponível':'Armazenamento local indisponível');
  conferir('TAMANHO_DADOS',tamanhoBytes===null||tamanhoBytes<4*1024*1024,'Espaço local ainda abaixo do alerta de 4 MB','Dados locais próximos do limite de 4 MB','armazenamento','aviso');
  conferir('API_INDEXED_DB',typeof indexedDB!=='undefined','IndexedDB disponível','IndexedDB indisponível (pasta automática opcional)','armazenamento','aviso');
  conferir('API_BLOB',typeof Blob==='function','API de arquivos Blob disponível','API de arquivos indisponível','armazenamento');
  conferir('API_SERVICE_WORKER','serviceWorker' in navigator,'API do Service Worker disponível','Service Worker não suportado neste ambiente','pwa','aviso');
  conferir('API_CACHE',typeof caches!=='undefined','API de cache disponível','Cache offline indisponível neste ambiente','pwa','aviso');
  conferir('SW_ATIVO',swRegistrado,'Service Worker ativo','Service Worker ainda não está ativo (ou modo HTML independente)','pwa','aviso');
  conferir('SW_CONTROLE',Boolean(navigator.serviceWorker?.controller),'Página sob controle do Service Worker','Página ainda sem controle offline (ou modo HTML independente)','pwa','aviso');
  conferir('CACHE_PWA',cacheInstalado.length>0,'Cache PWA encontrado','Cache PWA ainda não encontrado','pwa','aviso');
  conferir('CACHE_VERSAO',cacheInstalado.length<=1||swEmEspera,
    swEmEspera&&cacheInstalado.length>1?'Caches em transição: atualização aguarda sua autorização':'Versões de cache consistentes',
    'Mais de uma versão de cache sem atualização pendente','pwa','aviso');
  if(pasta.state==='paused')adicionar('BACKUP_PASTA','aviso','Backup automático pausado após exclusão local; arquivo externo preservado');
  else if(['conflict','permission','error'].includes(pasta.state))adicionar('BACKUP_PASTA','aviso','Backup em pasta requer atenção e não está sincronizado');
  else adicionar('BACKUP_PASTA','ok',['saved','ready','saving'].includes(pasta.state)?'Backup em pasta conectado':'Backup em pasta opcional, sem falha ativa');
  adicionar('ATUALIZADOR','ok',swEmEspera?'Nova versão disponível para instalar':'Estado da atualização consultado');
  conferir('BACKUP_ESTADO',['off','ready','saved','saving','permission','conflict','error','paused','unsupported',undefined].includes(pasta.state),'Estado de backup reconhecido','Estado de backup desconhecido','backup','aviso');
  conferir('ATUALIZADOR_ESTADO',update.ultimaVerificacao===undefined||Number.isFinite(update.ultimaVerificacao),'Estado do atualizador válido','Estado do atualizador inválido','atualizador');
  if(update.versaoEmExecucao!==undefined){
    conferir('ATUALIZADOR_VERSAO',/^v\d+$/.test(update.versaoEmExecucao),
      'Identificador da versão em execução válido','Identificador da versão em execução inválido','atualizador');
    if(typeof document!=='undefined')conferir('ATUALIZADOR_VERSAO_VISIVEL',
      document.getElementById('app-running-version')?.textContent===update.versaoEmExecucao,
      'Versão em execução exibida corretamente nos Ajustes','Número da versão não corresponde ao código em execução','atualizador');
  }
  conferir('LOGS_LIMITE',obterLogs().length<=50,'Log respeita o limite de 50 eventos','Log ultrapassou o limite de eventos','log');
  conferir('LOGS_FORMATO',obterLogs().every(l=>l&&/^[A-Z][A-Z0-9_]{2,49}$/.test(l.codigo||'')&&['erro','aviso','info','evento'].includes(l.nivel)),'Códigos do log sanitizados','Log contém códigos inesperados','log');
  const notificacoes=getNotificationStatus();
  if(notificacoes){
    conferir('NOTIFICACOES_PERSISTENCIA',notificacoes.armazenamentoOk,'Avisos podem ser dispensados e restaurados','Não foi possível gravar ou ler os avisos dispensados','notificacoes','aviso');
    conferir('NOTIFICACOES_OCULTAS',Number.isSafeInteger(notificacoes.ocultas)&&notificacoes.ocultas>=0,'Contagem de avisos ocultos válida','Contagem de avisos ocultos inválida','notificacoes');
  }
  const prefs=getPreferences();
  if(prefs){
    conferir('PREF_TEMA',TEMAS.includes(prefs.tema),'Tema configurado válido','Tema desconhecido','preferencias');
    conferir('PREF_COR',Object.hasOwn(CORES,prefs.cor),'Cor de destaque válida','Cor de destaque inválida','preferencias');
    conferir('PREF_PERCENTUAL',Number.isFinite(prefs.percentual)&&prefs.percentual>=0&&prefs.percentual<=100,'Percentual de aporte válido','Percentual de aporte fora do limite','regras-financeiras');
    conferir('PREF_CATEGORIAS',Array.isArray(prefs.categoriasAporte)&&prefs.categoriasAporte.every(c=>CATEGORIES.income.includes(c)),'Categorias de aporte válidas','Categorias de aporte inválidas','regras-financeiras');
    conferir('PREF_RESERVA',!prefs.reservaGoalId||dados.goals?.some(g=>g.id===prefs.reservaGoalId&&g.kind==='goal'),'Meta principal de reserva localizada','Meta principal da reserva foi removida','objetivos','aviso');
    conferir('PREF_CATEGORIAS_VAZIAS',prefs.categoriasAporte.length>0,'Há categorias consideradas no aporte','Nenhuma categoria selecionada para aporte','regras-financeiras','aviso');
  }
  // As preferências podem estar corretas no armazenamento e não ter efeito visual.
  // Conferir os estilos calculados detecta CSS ausente, tema ignorado e cor não aplicada.
  if(prefs&&typeof document!=='undefined'&&document.documentElement&&document.body&&typeof window.getComputedStyle==='function'){
    try {
      const root=document.documentElement;
      const estilo=window.getComputedStyle(root);
      const corEsperada=CORES[prefs.cor];
      const escuro=prefs.tema==='escuro'||(prefs.tema==='auto'&&Boolean(window.matchMedia?.('(prefers-color-scheme: dark)').matches));
      const fundoEsperado=escuro?'#131417':'#f5f6f8';
      const rgb=hex=>`rgb(${[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)).join(', ')})`;
      const normalizarCor=valor=>String(valor||'').toLowerCase().replace(/\s+/g,'');
      conferir('APARENCIA_TEMA_ATIVO',root.dataset.theme===prefs.tema,'Tema selecionado está ativo','Tema salvo não foi aplicado à página','ajustes');
      conferir('APARENCIA_COR_ATIVA',root.dataset.accent===prefs.cor,'Cor selecionada está ativa','Cor salva não foi aplicada à página','ajustes');
      conferir('APARENCIA_TEMA_CSS',normalizarCor(estilo.getPropertyValue('--bg'))===fundoEsperado,'Variáveis do tema carregadas','Variáveis CSS do tema não correspondem à seleção','ajustes');
      conferir('APARENCIA_COR_CSS',normalizarCor(estilo.getPropertyValue('--accent'))===corEsperada,'Variável CSS da cor de destaque carregada','Variável CSS da cor de destaque não corresponde à seleção','ajustes');
      conferir('APARENCIA_FUNDO',normalizarCor(window.getComputedStyle(document.body).backgroundColor)===normalizarCor(rgb(fundoEsperado)),
        'Fundo da tela corresponde ao tema','Fundo visível não corresponde ao tema configurado','ajustes');
      conferir('APARENCIA_ESQUEMA',String(estilo.colorScheme||'').split(' ').includes(escuro?'dark':'light'),
        'Esquema claro/escuro corresponde à seleção','Esquema de cores nativo não corresponde ao tema','ajustes');
      const botao=document.querySelector('.fab, .button-primary, .btn-primary');
      if(botao){
        const fundoBotao=normalizarCor(window.getComputedStyle(botao).backgroundColor);
        const corNormal=normalizarCor(rgb(corEsperada));
        const corHover=normalizarCor(rgb(estilo.getPropertyValue('--accent-hover').trim()));
        // Em telas de toque, :hover pode continuar ativo após o toque.
        const interagindo=Boolean(botao.matches?.(':hover, :active'));
        conferir('APARENCIA_BOTAO',fundoBotao===corNormal||(interagindo&&fundoBotao===corHover),
          'Cor de destaque aparece nos botões','Botões não receberam a cor de destaque','ajustes');
      }
    }catch{adicionar('APARENCIA_INSPECAO','aviso','O navegador não permitiu verificar os estilos aplicados','ajustes');}
  }
  if(typeof document!=='undefined'){
    const quickAdd=document.getElementById('quick-add');
    if(document.getElementById('header-label')?.textContent==='Resumo')
      conferir('UI_ADICIONAR_RESUMO',Boolean(quickAdd?.getAttribute('aria-label')?.includes('renda ou despesa')),
        'Ação rápida do resumo identifica renda e despesa','Ação rápida do resumo não identifica as duas opções','interface','aviso');
    const saldoTitulo=document.querySelector?.('.proto-today-balance h3');
    if(saldoTitulo)conferir('UI_SALDO_PERIODO',String(saldoTitulo.textContent||'').includes('acumulado'),
      'Período acumulado do saldo indicado','Período do saldo de hoje não está claro','interface','aviso');
    const editar=document.querySelector?.('.proto-edit');
    if(editar&&typeof editar.getBoundingClientRect==='function'){
      const tamanho=editar.getBoundingClientRect();
      conferir('UI_TOQUE_EDICAO',tamanho.width>=40&&tamanho.height>=44,
        'Área de toque para editar lançamento adequada','Área de toque para editar lançamento pequena','interface','aviso');
    }
    for(const [codigo,ids] of Object.entries({
      NAVEGACAO:['desktop-nav','mobile-nav','main-content'],LANCAMENTOS:['transaction-dialog','transaction-form','quick-add'],
      OBJETIVOS:['goal-dialog','goal-form'],LEMBRETES:['reminder-dialog','reminder-list'],NOTIFICACOES:['notifications-clear','notifications-restore'],
      BACKUP:['export-data','import-data','folder-backup-status'],CSV:['export-csv','import-csv','csv-preview-dialog'],
      AJUSTES:['settings-page','settings-form','settings-reserve'],ATUALIZACAO:['check-update','install-update','app-update-status'],
      PDF:['export-pdf','print-report'],SAUDE:['main-content'],
      DIAGNOSTICO:['diagnostics-dialog','diagnostics-run','diagnostics-progress','diagnostics-export'],
      CONFIRMACAO:['confirmation-dialog','confirmation-accept','confirmation-cancel'],
      LIMPEZA_DADOS:['delete-all-data','delete-data-dialog','delete-data-form','delete-data-phrase','delete-data-confirm','delete-data-cancel']})) {
      conferir(`UI_${codigo}`,ids.every(id=>Boolean(document.getElementById(id))),`Interface ${codigo.toLowerCase()} completa`,`Faltam componentes da interface ${codigo.toLowerCase()}`,'interface');
    }
    const entrada=document.getElementById('delete-data-phrase');
    const botao=document.getElementById('delete-data-confirm');
    if(entrada&&botao)conferir('LIMPEZA_CONFIRMACAO_FINAL',entrada.required&&botao.type==='submit'&&
      botao.closest?.('form')?.id==='delete-data-form'&&Boolean(document.getElementById('delete-data-dialog')?.getAttribute('aria-labelledby')),
      'Confirmação final exige campo obrigatório em diálogo identificado',
      'Confirmação final da limpeza está incompleta','limpeza-dados');
  }
  // Auditoria de manutenção: percorre os próprios módulos e folhas CSS publicados.
  // Os achados são sugestões, sem remoção automática ou leitura dos dados pessoais.
  const auditoria=await auditarCodigoPublicado();
  if(auditoria.disponivel){
    conferir('AUDITORIA_FONTES',true,`${auditoria.arquivosInspecionados} arquivos CSS/JS inspecionados`,'Arquivos de código indisponíveis','auditoria-codigo');
    adicionar('AUDITORIA_CSS_TOTAL','ok',`${auditoria.seletoresVerificados} classes CSS analisadas`,'auditoria-codigo');
    adicionar('AUDITORIA_FUNCOES_TOTAL','ok',`${auditoria.funcoesVerificadas} funções privadas analisadas`,'auditoria-codigo');
    for(const [i,item] of auditoria.cssNaoUsados.entries()){
      adicionar(`CSS_POSSIVELMENTE_SEM_USO_${i+1}`,'aviso',
        `Revisar .${item.nome} em ${item.arquivo}: classe sem referência estática`,'auditoria-codigo');
    }
    for(const [i,item] of auditoria.funcoesSemUso.entries()){
      adicionar(`FUNCAO_POSSIVELMENTE_SEM_USO_${i+1}`,'aviso',
        `Revisar ${item.nome}() em ${item.arquivo}: função sem chamada estática`,'auditoria-codigo');
    }
  }else{
    adicionar('AUDITORIA_FONTES','aviso',auditoria.motivo,'auditoria-codigo');
  }
  // Cada arquivo em dist/modules/ é declarado e inspecionado nesta lista.
  if(typeof executarVerificacoesModulos==='function'){
    integridade.itens.push(...executarVerificacoesModulos());
    conferir('REGISTRO_COMPLETO',totalRegistros()===MODULOS_OBRIGATORIOS.length,'Todos os módulos possuem autoverificação','Existem módulos sem registro','catalogo-diagnostico');
    // Confere individualmente o arquivo offline de cada módulo, somente se há PWA instalado.
    if(swRegistrado&&cacheInstalado.length&&typeof caches?.open==='function'){
      const ordem=nome=>Number(nome.slice(CACHE_PREFIXO.length))||0;
      const ativo=[...cacheInstalado].sort((a,b)=>ordem(b)-ordem(a))[0];
      try {
        const cache=await caches.open(ativo);
        for(const nome of MODULOS_OBRIGATORIOS){
          let existe=false;
          try {existe=Boolean(await cache.match(`./modules/${nome}.js`));}catch{/* Permissão opcional. */}
          conferir(`CACHE_MOD_${nome.toUpperCase().replaceAll('-','_')}`,existe,
            `Arquivo offline do módulo ${nome} presente`,`Arquivo offline do módulo ${nome} ausente`,'pwa','aviso');
        }
      }catch{adicionar('CACHE_LEITURA','aviso','Não foi possível ler os arquivos do cache PWA','pwa');}
    }
  }
  const propostaInterface=verificarPropostaInterface({documento:typeof document!=='undefined'?document:null,
    janela:window,padrao:preferenciasPadrao()});
  if(propostaInterface)integridade.itens.push(...propostaInterface.itens);
  integridade.erros=integridade.itens.filter(item=>item.estado==='erro').length;
  integridade.avisos=integridade.itens.filter(item=>item.estado==='aviso').length;
  return {
    aplicativo:'meu-dinheiro-essencial',formatoRelatorio:3,geradoEm:new Date().toISOString(),
    duracaoPrevistaMs:calcularDuracaoDiagnostico(integridade.itens.length),
    modulosPrevistos:typeof MODULOS_OBRIGATORIOS!=='undefined'?MODULOS_OBRIGATORIOS.length:null,
    privacidade:'Diagnóstico local sem descrições, nomes, saldos, valores financeiros ou caminhos de pasta.',
    ambiente:{
      navegador:String(navigator.userAgent||'desconhecido').slice(0,200),
      idioma:navigator.language||'desconhecido',
      fuso:Intl.DateTimeFormat().resolvedOptions().timeZone||'desconhecido',
      instalado:Boolean(window.matchMedia?.('(display-mode: standalone)').matches||navigator.standalone),
      larguraTela:window.innerWidth||null,alturaTela:window.innerHeight||null,
      recursos:{localStorage:armazenamentoDisponivel,indexedDB:typeof indexedDB!=='undefined',pasta:typeof window.showDirectoryPicker==='function',serviceWorker:'serviceWorker' in navigator},
      armazenamentoEstimado:usoEstimado
    },
    dados:resumo,
    backup:{estado:['off','ready','saved','saving','permission','conflict','error','unsupported'].includes(pasta.state)?pasta.state:'desconhecido',pastaConectada:Boolean(pasta.folder),ultimaGravacao:pasta.lastSavedAt instanceof Date?pasta.lastSavedAt.toISOString():null},
    atualizador:{registrado:swRegistrado,controlando:Boolean(navigator.serviceWorker?.controller),atualizacaoPendente:swEmEspera,versaoEmExecucao:/^v\d+$/.test(update.versaoEmExecucao||'')?update.versaoEmExecucao:null,versoesCache:cacheInstalado,ultimaVerificacao:typeof update.ultimaVerificacao==='number'&&update.ultimaVerificacao>0?new Date(update.ultimaVerificacao).toISOString():null},
    cdi:{cotacaoEmCacheValida:Boolean(getCdiStatus())},
    notificacoes:notificacoes?{ocultas:notificacoes.ocultas,armazenamentoOk:Boolean(notificacoes.armazenamentoOk)}:null,
    integridade,bibliotecas,logs:obterLogs(),
    propostaInterface:propostaInterface?{referencia:propostaInterface.referencia,total:propostaInterface.total,
      implementados:propostaInterface.implementados,pendentes:propostaInterface.pendentes,
      naoAvaliados:propostaInterface.naoAvaliados}:null,
    auditoriaCodigo:auditoria.disponivel?{
      arquivos:auditoria.arquivosInspecionados,classes:auditoria.seletoresVerificados,
      funcoes:auditoria.funcoesVerificadas,candidatosCss:auditoria.cssNaoUsados.length,
      candidatosFuncoes:auditoria.funcoesSemUso.length
    }:{disponivel:false}
  };
}

export function iniciarDiagnostico(ctx) {
  const {notify,hideBackupMenu,registrar,registrarEvento,configurarDetalhado,modoDetalhado} = ctx;
  const dialogo=document.getElementById('diagnostics-dialog');
  const resumo=document.getElementById('diagnostics-summary');
  const lista=document.getElementById('diagnostics-checks');
  const detalhado=document.getElementById('diagnostics-verbose');
  const barra=document.getElementById('diagnostics-progress');
  const preenchimento=document.getElementById('diagnostics-progress-fill');
  const progresso=document.getElementById('diagnostics-progress-label');
  const executarBotao=document.getElementById('diagnostics-run');
  const exportarBotao=document.getElementById('diagnostics-export');
  let ultimoRelatorio=null;
  let rodada=0;
  const grupos=new Map();
  const sinais=Object.freeze({ok:'✓',aviso:'!',erro:'✕',pendente:'○',nao_avaliado:'−'});
  function anexarResultado(item){
    const nome=item.modulo||'dados';
    let grupo=grupos.get(nome);
    if(!grupo){
      const elemento=document.createElement('details');elemento.className='diagnostics-group';
      const titulo=document.createElement('summary');titulo.className='diagnostics-group-heading';
      const conteudo=document.createElement('div');conteudo.className='diagnostics-group-items';
      elemento.append(titulo,conteudo);lista.append(elemento);
      grupo={elemento,titulo,conteudo,contagens:{ok:0,aviso:0,erro:0,pendente:0,nao_avaliado:0}};
      grupos.set(nome,grupo);
    }
    const estado=Object.hasOwn(sinais,item.estado)?item.estado:'aviso';
    grupo.contagens[estado]++;
    const c=grupo.contagens;
    grupo.titulo.textContent=`${nome.replaceAll('-',' ')} · ${c.ok} ok · ${c.erro} erros · ${c.aviso} avisos${c.pendente?` · ${c.pendente} pendentes`:''}`;
    grupo.elemento.dataset.state=c.erro?'erro':c.aviso?'aviso':c.pendente?'pendente':'ok';
    const linha=document.createElement('p');linha.className=`diagnostics-check diagnostics-${estado}`;
    linha.textContent=`${sinais[estado]} ${item.descricao}`;
    grupo.conteudo.append(linha);
  }
  function desenharProgresso(porcentagem,concluidas,total,restam) {
    barra.setAttribute('aria-valuenow',String(porcentagem));
    preenchimento.style.width=`${porcentagem}%`;
    progresso.textContent=porcentagem===100?'Diagnóstico concluído.':`Exibindo ${concluidas} de ${total} resultados · cerca de ${Math.ceil(restam/1000)}s restantes`;
  }

  async function executar() {
    const atual=++rodada;
    resumo.textContent='Analisando integridade, módulos e ambiente…';
    ultimoRelatorio=null;lista.replaceChildren();grupos.clear();desenharProgresso(0,0,0,0);
    executarBotao.disabled=true;exportarBotao.disabled=true;
    try {
      registrarEvento('INICIAR_VERIFICACAO','integridade');
      // A duração é visual: a coleta nunca é abreviada pelo limite da animação.
      const relatorio=await criarRelatorioDiagnostico(ctx);
      if(atual!==rodada)return null;
      const {integridade}=relatorio;
      const itens=integridade.itens;
      const duracao=calcularDuracaoDiagnostico(itens.length);
      resumo.textContent=`${itens.length} verificações executadas · exibindo resultados em até ${Math.ceil(duracao/1000)}s.`;
      const tempoRestante=duracao;
      const inicio=performance.now();
      await new Promise(resolve=>{
        let exibidas=0;
        const timer=setInterval(()=>{
          if(atual!==rodada){clearInterval(timer);resolve();return;}
          const decorrido=Math.min(tempoRestante,performance.now()-inicio);
          const percentual=Math.min(100,Math.floor(decorrido/tempoRestante*100));
          const ate=Math.min(itens.length,Math.floor(decorrido/tempoRestante*itens.length));
          while(exibidas<ate){
            anexarResultado(itens[exibidas++]);
          }
          desenharProgresso(percentual,exibidas,itens.length,tempoRestante-decorrido);
          if(decorrido>=tempoRestante){clearInterval(timer);resolve();}
        },50);
      });
      if(atual!==rodada)return null;
      ultimoRelatorio=relatorio;
      resumo.textContent=`${integridade.itens.length} verificações · ${integridade.erros} erro(s) · ${integridade.avisos} aviso(s)${relatorio.propostaInterface?` · ${relatorio.propostaInterface.pendentes} melhorias pendentes`:''}.`;
      if(integridade.erros)registrar('erro','INTEGRIDADE_FALHOU','integridade');
      else if(integridade.avisos)registrar('aviso','INTEGRIDADE_ALERTA','integridade');
      return relatorio;
    } catch {
      registrar('erro','RELATORIO_FALHOU','integridade');
      resumo.textContent='Não foi possível concluir o diagnóstico. Tente novamente.';
      return null;
    } finally {
      if(atual===rodada){executarBotao.disabled=false;exportarBotao.disabled=!ultimoRelatorio;}
    }
  }

  document.getElementById('open-diagnostics').addEventListener('click',()=>{
    hideBackupMenu();
    detalhado.checked=modoDetalhado();
    dialogo.showModal();
    void executar();
  });
  document.getElementById('diagnostics-run').addEventListener('click',()=>void executar());
  document.getElementById('diagnostics-export').addEventListener('click',async()=>{
    const relatorio=ultimoRelatorio;
    if(!relatorio)return;
    try {
      const blob=new Blob([JSON.stringify(relatorio,null,2)],{type:'application/json'});
      const url=URL.createObjectURL(blob);
      const link=document.createElement('a');
      link.href=url;
      link.download=`meu-dinheiro-diagnostico-${new Date().toISOString().slice(0,10)}.json`;
      link.click();
      window.setTimeout(()=>URL.revokeObjectURL(url),30000);
      notify('Relatório de diagnóstico gerado no dispositivo.');
    } catch {
      registrar('erro','RELATORIO_EXPORTACAO_FALHOU','integridade');
      notify('Não foi possível baixar o relatório. Tente novamente.');
    }
  });
  detalhado.addEventListener('change',()=>{
    configurarDetalhado(detalhado.checked);
    if(detalhado.checked)registrarEvento('LOG_DETALHADO_ATIVADO','sistema');
  });
  dialogo.addEventListener('close',()=>{rodada++;executarBotao.disabled=false;exportarBotao.disabled=!ultimoRelatorio;});
  dialogo.querySelectorAll('.close-dialog').forEach(button=>button.addEventListener('click',()=>dialogo.close()));
  dialogo.addEventListener('click',event=>{if(event.target===dialogo)dialogo.close();});
  return {executar};
}
