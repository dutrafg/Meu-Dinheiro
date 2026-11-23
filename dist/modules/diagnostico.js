import { verificarIntegridade } from './integridade.js';
import { executarVerificacoesModulos,MODULOS_OBRIGATORIOS,totalRegistros } from './catalogo-diagnostico.js';
import { CORES,TEMAS,preferenciasPadrao } from './preferencias.js';
import { auditarCodigoPublicado } from './auditoria-codigo.js';
import { verificarPropostaInterface } from './diagnostico-proposta.js';
import { calcularSaldoDisponivelHoje } from './resumo.js';
import { normalizarDadosLocais, validarBackup, podeAplicarNoObjetivo } from './validacao.js';
import { apagarDadosLocais, validarFraseLimpeza } from './limpeza-dados.js';
import { adicionarInvestimentoVinculado, editarInvestimentoVinculado, encontrarSalarioAnterior,validarVinculosSalariais } from './investimentos.js';
import { calcularCalendarioFinanceiro, compactarValorCalendario, navegarMesCalendario, renderBotaoCalendario } from './calendario-financeiro.js';
import {cliqueForaDoDialogo} from './dialogos.js';
import {criarProtecaoConcorrencia} from './concorrencia-dados.js';
import {calcularViradaPeriodo} from './ciclo-periodo.js';

const CHAVE_DADOS = 'meu-dinheiro-essencial:v1';
const CACHE_PREFIXO = 'meu-dinheiro-essencial-v';
// O teste lê SOMENTE arquivos públicos do cache; não consulta nem modifica dados financeiros.
const RECURSOS_OFFLINE = Object.freeze([
  ['ENTRADA','./index.html','html'],['APLICACAO','./app.js','javascript'],
  ['ESTILOS','./styles.css','css'],['ESTILOS_MODULARES','./prototype.css','css'],
  ['MANIFESTO','./manifest.webmanifest','manifesto'],
  ['ICONE_192','./icon-192.png','png'],['ICONE_512','./icon-512.png','png'],
  ['IMPORTACAO_CSV','./csv.js','javascript'],['GRAFICOS','./analytics.js','javascript'],
  ['COPIA_LOCAL','./folder-backup.js','javascript'],
  ['PERSISTENCIA','./modules/repositorio-financeiro.js','javascript'],
  ['VALIDACAO','./modules/validacao.js','javascript'],
  ['NOTIFICACOES','./modules/notificacoes.js','javascript'],
  ['DIAGNOSTICO','./modules/diagnostico.js','javascript']
]);

export async function verificarPacoteOffline(cache){
  const resultados=[];
  for(const [nome,caminho,tipo] of RECURSOS_OFFLINE){
    let valido=false;
    try{
      const resposta=await cache.match(caminho);
      if(resposta?.ok&&typeof resposta.clone==='function'){
        const copia=resposta.clone();
        if(tipo==='png'){
          const bytes=new Uint8Array(await copia.arrayBuffer());
          valido=bytes.length>24&&[137,80,78,71,13,10,26,10].every((valor,i)=>bytes[i]===valor);
        }else{
          const corpo=await copia.text();
          if(tipo==='html')valido=/<!doctype\s+html/i.test(corpo)&&/<script/i.test(corpo);
          if(tipo==='javascript')valido=!/^\s*(?:<!doctype|<html)/i.test(corpo)&&/\b(?:import|export|function|const|let|var)\b/.test(corpo);
          if(tipo==='css')valido=!/^\s*(?:<!doctype|<html)/i.test(corpo)&&
            ((corpo.includes('{')&&corpo.includes('}'))||/^\s*@import\s+url\(/m.test(corpo));
          if(tipo==='manifesto'){
            const manifesto=JSON.parse(corpo);
            valido=manifesto.start_url==='./'&&Array.isArray(manifesto.icons)&&manifesto.icons.length>=2;
          }
        }
      }
    }catch{/* Arquivo ausente, corrompido ou API de cache indisponível. */}
    resultados.push({codigo:`OFFLINE_CACHE_${nome}`,estado:valido?'ok':'aviso',
      descricao:valido?`Recurso ${nome.toLowerCase().replaceAll('_',' ')} íntegro para uso offline`:
        `Recurso ${nome.toLowerCase().replaceAll('_',' ')} ausente/inválido no cache: reconecte, atualize e execute o teste novamente`,modulo:'offline'});
  }
  return resultados;
}

export function verificarHtmlIndependenteOffline(documento){
  if(typeof documento?.querySelectorAll!=='function')return [{codigo:'OFFLINE_HTML_VERIFICACAO',estado:'nao_avaliado',
    descricao:'HTML único: verificação do documento indisponível neste ambiente',modulo:'offline'}];
  const scripts=[...documento.querySelectorAll('script')];
  const estilos=[...documento.querySelectorAll('style')];
  const externos=[...documento.querySelectorAll('script[src],link[rel="stylesheet"][href],link[rel="manifest"][href],img[src]')]
    .filter(elemento=>!String(elemento.getAttribute?.('src')||elemento.getAttribute?.('href')||'').startsWith('data:'));
  return [
    {codigo:'OFFLINE_HTML_JAVASCRIPT',estado:scripts.some(e=>!e.getAttribute?.('src')&&String(e.textContent||'').includes('criarRelatorioDiagnostico'))?'ok':'erro',
      descricao:'Lógica do aplicativo incorporada no próprio HTML',modulo:'offline'},
    {codigo:'OFFLINE_HTML_ESTILOS',estado:estilos.some(e=>String(e.textContent||'').includes('--bg')&&String(e.textContent||'').includes('.proto'))?'ok':'erro',
      descricao:'Aparência e estilos incorporados no próprio HTML',modulo:'offline'},
    {codigo:'OFFLINE_HTML_SEM_DEPENDENCIAS',estado:externos.length===0?'ok':'erro',
      descricao:externos.length===0?'Nenhum script, folha de estilos, manifesto ou imagem externa obrigatória':
        'Há recursos externos necessários: esta prévia pode falhar sem internet',modulo:'offline'}
  ];
}
// Contraste WCAG de texto comum: razão mínima 4,5:1. Sem dependências ou DOM.
export function calcularContrasteCSS(primeira,segunda){
  const canais=cor=>{
    const hex=String(cor||'').trim().toLowerCase();
    if(!/^#[0-9a-f]{3}(?:[0-9a-f]{3})?$/.test(hex))return null;
    const completa=hex.length===4?`#${[1,2,3].map(i=>hex[i]+hex[i]).join('')}`:hex;
    return [1,3,5].map(i=>parseInt(completa.slice(i,i+2),16)/255)
      .map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);
  };
  const a=canais(primeira),b=canais(segunda);
  if(!a||!b)return null;
  const luz=c=>c[0]*.2126+c[1]*.7152+c[2]*.0722;
  const x=luz(a),y=luz(b);
  return (Math.max(x,y)+.05)/(Math.min(x,y)+.05);
}
export function calcularDuracaoDiagnostico(totalVerificacoes) {
  return Math.min(25000,5000 + Math.max(0,Math.trunc(totalVerificacoes)-9)*500);
}

// Nenhum lançamento, nome, descrição, valor, caminho de pasta ou objeto de erro sai no JSON.
export async function criarRelatorioDiagnostico({getData,CATEGORIES,getFolderState=()=>null,getUpdateStatus=()=>null,
  getStorageLocked=()=>false,getCdiStatus=()=>false,getPreferences=()=>null,getNotificationStatus=()=>null,
  getPersistenciaState=()=>null,getPersistenciaCheck=async()=>null,obterLogs=()=>[]}) {
  const dados = getData();
  const prefsAtuais=getPreferences();
  const categoriasDiagnostico={income:[...(CATEGORIES?.income||[]),...(prefsAtuais?.categoriasExtras?.income||[])],
    expense:[...(CATEGORIES?.expense||[]),...(prefsAtuais?.categoriasExtras?.expense||[])]};
  const integridade = verificarIntegridade(dados,categoriasDiagnostico);
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
    compromissos:Array.isArray(dados?.commitments)?dados.commitments.length:0,
    metas: Array.isArray(dados?.goals)?dados.goals.length:0,
    aplicacoes: Array.isArray(dados?.allocations)?dados.allocations.length:0,
    lembretesConcluidos: Array.isArray(dados?.completedAportes)?dados.completedAportes.length:0,
    tamanhoDadosBytes:tamanhoBytes,
    primeiroLancamento:dates[0]||null,
    ultimoLancamento:dates.at(-1)||null,
    gravacaoBloqueada:Boolean(getStorageLocked())
  };
  const estadoEspelho=getPersistenciaState();
  let verificacaoEspelho=null;
  try{verificacaoEspelho=await getPersistenciaCheck();}
  catch{verificacaoEspelho={estado:'erro'};}
  const bibliotecas = {
    csv:typeof window.MeuDinheiroCSV?.importCSV==='function',
    graficos:typeof window.MeuDinheiroAnalytics?.expenseCategoryStats==='function',
    backup:typeof window.MeuDinheiroFolderBackup?.createBrowserManager==='function'
  };
  const adicionar=(codigo,estado,descricao,modulo='ambiente')=>integridade.itens.push({codigo,estado,descricao,modulo});
  const conferir=(codigo,ok,correto,problema,modulo='ambiente',estadoRuim='erro')=>adicionar(codigo,ok?'ok':estadoRuim,ok?correto:problema,modulo);
  if(estadoEspelho?.habilitado){
    const consistente=['sincronizado','vazio'].includes(verificacaoEspelho?.estado)||
      (estadoEspelho.primario&&verificacaoEspelho?.estado==='residuo');
    conferir('ESPELHO_INDEXEDDB',consistente,'Cópia financeira IndexedDB sincronizada',
      'Verifique a sincronização do armazenamento IndexedDB','dados','aviso');
    conferir('FONTE_PRIMARIA_INDEXEDDB',estadoEspelho.primario===true&&!estadoEspelho.espelhoPendente,
      'IndexedDB é a fonte principal e confirma as gravações antes do espelho legado',
      'Banco primário indisponível, não inicializado ou com cópia local pendente','dados','aviso');
  }
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
  const planoTeste={id:'diag-c',kind:'card',name:'Parcela exemplo',category:'Cartão de crédito',amount:25,day:31,startMonth:'2026-11',monthsCount:2};
  const pagamentoTeste={id:'diag-p',description:'Parcela exemplo',type:'expense',category:'Cartão de crédito',amount:25,date:'2026-11-30',
    recurring:false,commitmentId:'diag-c',commitmentMonth:'2026-11'};
  conferir('PREVENTIVO_BACKUP_PARCELAS',!rejeitaBackup({...backupAmostra,commitments:[planoTeste],transactions:[...backupAmostra.transactions,pagamentoTeste]}),
    'Backup sintético preserva compromissos e pagamentos vinculados',
    'Risco de perda de parcelas ao restaurar backup completo','backup');
  conferir('PREVENTIVO_PAGAMENTO_DUPLICADO',rejeitaBackup({...backupAmostra,commitments:[planoTeste],transactions:[...backupAmostra.transactions,pagamentoTeste,{...pagamentoTeste,id:'diag-p2'}]}),
    'Backup bloqueia duas baixas da mesma parcela',
    'Risco: uma mesma parcela poderia ser paga duas vezes','backup');
  conferir('PREVENTIVO_BACKUP_ANTIGO',!rejeitaBackup({...backupAmostra,commitments:undefined}),
    'Backup antigo sem compromissos continua legível',
    'Risco: versões antigas de backup poderiam deixar de ser restauradas','backup');
  conferir('BACKUP_VINCULO_TIPO',rejeitaBackup({...backupAmostra,allocations:[{id:'diag-a',description:'Aporte',kind:'dream',amount:1,date:'2026-11-19',goalId:'diag-g'}]}),
    'Backup rejeita vínculo incompatível','Backup aceitou vínculo incompatível','backup');
  const legado={...backupAmostra,transactions:[{...amostra.transactions[0],category:'Categoria histórica'}]};
  const legadoRestaurado=validarBackup(legado,CATEGORIES);
  conferir('BACKUP_ROUNDTRIP_LEGADO',legadoRestaurado.transactions[0].category==='Categoria histórica'&&
    legadoRestaurado.transactions[0].recurring===false&&Boolean(legadoRestaurado.transactions[0].createdAt)&&
    rejeitaBackup({...backupAmostra,transactions:[{...backupAmostra.transactions[0],date:'2026-02-30'}]}),
    'Restauração preserva categorias antigas e migra campos opcionais',
    'Restauração não preservou categoria ou migração do backup antigo','backup');
  const rejeitouCategoriaInsegura=rejeitaBackup({...backupAmostra,transactions:[{...backupAmostra.transactions[0],category:'<script>'}]});
  conferir('BACKUP_CATEGORIA_SEGURA',rejeitouCategoriaInsegura,
    'Backup bloqueia marcação HTML na categoria',
    'Backup aceitou categoria de risco','backup');
  const limiteTeste=Array.from({length:10000},(_,i)=>({...backupAmostra.transactions[0],id:`teste-${i}`}));
  let volumeOk=false;
  try{volumeOk=validarBackup({...backupAmostra,transactions:limiteTeste},CATEGORIES).transactions.length===10000;}catch{/* Detectado no relatório. */}
  conferir('BACKUP_VOLUME_SINTETICO',volumeOk,'Dez mil registros fictícios validados sem alterar dados locais',
    'Falha na validação de dados sintéticos em volume','backup');
  conferir('RESGATE_LIMITE',podeAplicarNoObjetivo(10,-5)&&podeAplicarNoObjetivo(10,-10)&&!podeAplicarNoObjetivo(10,-20),
    'Limite de resgate de objetivo calculável','Limite de resgate de objetivo inconsistente','objetivos');
  const aporte=adicionarInvestimentoVinculado(amostra,{id:'diag-i',goalId:'diag-g',description:'Aporte sintético',amount:12.34,date:'2026-11-19',category:'CDB'});
  conferir('INVESTIMENTO_SEM_DUPLICACAO',aporte.goals[0].saved===22.34&&aporte.allocations.length===1&&amostra.goals[0].saved===10,
    'Aporte aumenta objetivo uma vez, preservando dados anteriores','Aporte contabilizado incorretamente','investimentos');
  conferir('INVESTIMENTO_CATEGORIA',aporte.allocations[0].category==='CDB'&&!rejeita(aporte)&&
    rejeita({...aporte,allocations:[{...aporte.allocations[0],category:''}]}),
    'Categoria personalizada é armazenada e validada','Categoria de investimento não foi validada corretamente','investimentos');
  const salarioAmostra=encontrarSalarioAnterior(amostra.transactions,'2026-11-19');
  const aporteSalario=adicionarInvestimentoVinculado(amostra,{id:'diag-s',goalId:'diag-g',description:'Do salário',amount:3,date:'2026-11-19',category:'Poupança',origin:'salary'});
  conferir('INVESTIMENTO_ORIGEM_SALARIO',salarioAmostra?.id==='diag-t'&&aporteSalario.allocations[0].salaryId==='diag-t',
    'Aporte do salário vinculado ao rendimento com data compatível','Origem do salário não corresponde à data registrada','investimentos');
  let impediuExcesso=false;
  try{adicionarInvestimentoVinculado(aporteSalario,{id:'diag-excesso',goalId:'diag-g',description:'Excedente fictício',amount:8,date:'2026-11-19',category:'CDB',origin:'salary'});}catch{impediuExcesso=true;}
  conferir('INVESTIMENTO_LIMITE_SALARIO',impediuExcesso&&validarVinculosSalariais(aporteSalario).ok,
    'Investimento acima do valor do salário é bloqueado','Aportes ultrapassaram a renda salarial','investimentos');
  conferir('INVESTIMENTO_ORFAO_SALARIO',!validarVinculosSalariais({...aporteSalario,transactions:[]}).ok&&
    !validarVinculosSalariais({...aporteSalario,transactions:[{...amostra.transactions[0],amount:2}]}).ok,
    'Exclusão e redução de salário vinculado são identificadas',
    'Alteração de salário não é validada contra os aportes','investimentos');
  conferir('INVESTIMENTO_SALDO_DISPONIVEL',calcularSaldoDisponivelHoje(amostra.transactions,'2026-11-19',aporteSalario.allocations)===7&&
    calcularSaldoDisponivelHoje(amostra.transactions,'2026-11-19',aporte.allocations)===10,
    'Somente aporte do salário reduz dinheiro disponível','Investimento antigo e salário não foram separados no saldo','resumo');
  const aporteEditado=editarInvestimentoVinculado(aporte,{id:'diag-i',goalId:'diag-g',description:'Aporte corrigido',amount:15,date:'2026-11-19',category:'Tesouro Direto'});
  conferir('INVESTIMENTO_EDICAO_DELTA',aporteEditado.goals[0].saved===25&&aporteEditado.allocations.length===1&&
    aporteEditado.allocations[0].amount===15&&aporte.goals[0].saved===22.34,
    'Edição altera apenas diferença sem duplicar investimento','Edição de investimento distorceu a meta ou o histórico','investimentos');
  const edicaoOrigem=editarInvestimentoVinculado(aporteSalario,{id:'diag-s',goalId:'diag-g',description:'Poupança anterior',amount:3,date:'2026-11-19',category:'Poupança',origin:'previous'});
  conferir('INVESTIMENTO_EDICAO_ORIGEM',edicaoOrigem.allocations[0].origin==='previous'&&
    !('salaryId' in edicaoOrigem.allocations[0])&&
    calcularSaldoDisponivelHoje(amostra.transactions,'2026-11-19',edicaoOrigem.allocations)===10,
    'Edição recalcula origem do dinheiro e saldo sem retenção de salário antigo',
    'Edição manteve vínculo salarial incorreto ou desconto duplicado','investimentos');
  const duasMetas={...amostra,goals:[...amostra.goals,{id:'diag-d',name:'Sonho',kind:'dream',target:50,saved:4,deadline:''}]};
  const antesDeMover=adicionarInvestimentoVinculado(duasMetas,{id:'diag-m',goalId:'diag-g',description:'Exemplo',amount:5,date:'2026-11-19',category:'CDB'});
  const movido=editarInvestimentoVinculado(antesDeMover,{id:'diag-m',goalId:'diag-d',description:'Para sonho',amount:7,date:'2026-11-19',category:'Poupança'});
  conferir('INVESTIMENTO_EDICAO_OBJETIVO',movido.goals[0].saved===10&&movido.goals[1].saved===11&&
    movido.allocations.length===1&&movido.allocations[0].goalId==='diag-d'&&movido.allocations[0].kind==='dream',
    'Edição transfere corretamente a aplicação entre meta e sonho','Edição duplicou saldo ao mudar objetivo','investimentos');
  let bloqueouEdicaoInvalida=false;
  try{editarInvestimentoVinculado({...aporte,goals:[{...aporte.goals[0],saved:2}]},{id:'diag-i',goalId:'diag-g',description:'Inválido',amount:5,date:'2026-11-19',category:'CDB'});}catch{bloqueouEdicaoInvalida=true;}
  conferir('INVESTIMENTO_EDICAO_SALDO_NEGATIVO',bloqueouEdicaoInvalida,
    'Edição impede retirar aporte maior que saldo guardado','Edição aceitou deixar objetivo com saldo negativo','investimentos');
  const mesTeste=calcularCalendarioFinanceiro('2026-11',[
    {type:'income',amount:100,occurrence:'2026-11-05'},
    {type:'expense',amount:40,occurrence:'2026-11-05'},
    {type:'expense',amount:200,occurrence:'2026-11-06'},
    {type:'income',amount:80,occurrence:'2026-11-07'}]);
  conferir('CALENDARIO_DIAS_E_DATAS',mesTeste.days.length===30&&mesTeste.days[4].day===5&&
    mesTeste.days[4].date==='2026-11-05'&&mesTeste.offset===6,
    'Calendário exibe dias reais do mês na semana correta','Calendário apresenta datas ou dias incorretos','calendario-financeiro');
  conferir('CALENDARIO_MISTURA_CORES',mesTeste.days[4].tone==='mixed'&&mesTeste.days[4].incomeShare===71&&
    mesTeste.days[5].tone==='expense'&&mesTeste.days[6].tone==='income'&&
    mesTeste.days[5].level===5&&mesTeste.days[6].level<5,
    'Cinco intensidades representam renda, despesa e dias mistos','Tonalidades do calendário não correspondem ao fluxo diário','calendario-financeiro');
  conferir('CALENDARIO_CENTAVOS',mesTeste.totalIncomeCents===18000&&mesTeste.totalExpenseCents===24000&&
    compactarValorCalendario(150000)==='1,5mil',
    'Calendário soma centavos e resume valores pequenos para telas compactas','Soma ou formato diário incorreto','calendario-financeiro');
  const disparador=renderBotaoCalendario('2026-11',ym=>ym,x=>x);
  conferir('CALENDARIO_SELETOR_MES',disparador.includes('data-calendar-open')&&
    disparador.includes('aria-haspopup="dialog"')&&disparador.includes('aria-controls="finance-calendar-dialog"'),
    'Clique no mês abre calendário em diálogo acessível','Seletor do mês não abre o calendário corretamente','calendario-financeiro');
  conferir('CALENDARIO_NAVEGACAO_MENSAL',navegarMesCalendario('2026-12',1)==='2027-01'&&
    navegarMesCalendario('2026-01',-1)==='2025-12'&&
    calcularCalendarioFinanceiro('2024-02',[]).days.length===29,
    'Calendário navega entre meses e respeita ano bissexto','Navegação mensal ou fevereiro incorretos','calendario-financeiro');
  conferir('CALENDARIO_MES_SEM_MOVIMENTO',calcularCalendarioFinanceiro('2026-11',[]).days.every(d=>d.level===0&&d.tone==='empty'),
    'Mês sem lançamentos não recebe cores falsas','Mês vazio contém movimentações fictícias','calendario-financeiro');
  const virada=calcularViradaPeriodo('2026-12','2026-12','2026-12-31',new Date(2027,0,1));
  const mesHistorico=calcularViradaPeriodo('2026-12','2026-10','2026-12-31',new Date(2027,0,1));
  conferir('PERIODO_VIRADA_AUTOMATICA',virada.mudou&&virada.mesAtual==='2027-01'&&virada.mesSelecionado==='2027-01'&&
    mesHistorico.mesSelecionado==='2026-10',
    'Virada do mês atualiza a tela sem tirar o usuário do mês histórico',
    'Virada de mês não respeita navegação histórica','ciclo-periodo');
  const dialogoTeste={getBoundingClientRect:()=>({left:20,right:320,top:100,bottom:600})};
  conferir('DIALOGO_BORDA_SEGURA',!cliqueForaDoDialogo({target:dialogoTeste,clientX:30,clientY:120},dialogoTeste)&&
    cliqueForaDoDialogo({target:dialogoTeste,clientX:5,clientY:80},dialogoTeste),
    'Toque no padding não fecha formulário; toque fora fecha',
    'Diálogo confunde toque interno com fundo','dialogos');
  let snapshot='primeiro',recebido='',avisoConflito=0;
  const protecao=criarProtecaoConcorrencia({storage:{getItem:()=>snapshot},chave:'teste',
    janela:{addEventListener:()=>{}},aoAlterar:valor=>{recebido=valor;return true;},aoConflito:()=>{avisoConflito++;}});
  snapshot='segunda';const bloqueou=!protecao.podeGravar();
  conferir('DADOS_ABAS_CONFLITO',bloqueou&&protecao.sincronizar()&&protecao.podeGravar()&&recebido==='segunda'&&avisoConflito===0,
    'Alterações externas são detectadas antes de sobrescrever dados',
    'Edição simultânea pode sobrescrever informações recentes','concorrencia-dados');
  if(typeof window!=='undefined'&&typeof window.MeuDinheiroCSV?.importCSV==='function'&&
    typeof window.MeuDinheiroCSV?.exportCSV==='function'){
    try{
      const resultados=window.MeuDinheiroCSV.importCSV('Data;Tipo;Descrição;Valor\n19/11/2026;Pagamento recebido;Salário;100,00\n19/11/2026;Despesa;Imposto;10,00\n19/11/2026;Despesa;Concurso;20,00',
        {income:['Salário','Outros'],expense:['Outros','Transporte','Cursos']}).items;
      conferir('CSV_TIPO_RECEBIMENTO',resultados[0]?.type==='income'&&resultados[0]?.amount===100,
        'Recebimentos não são confundidos com pagamentos efetuados',
        'Classificação de crédito no CSV incorreta','csv-interface');
      conferir('CSV_CATEGORIAS_FALSOS_POSITIVOS',resultados[1]?.category==='Outros'&&resultados[2]?.category==='Outros',
        'Imposto e concurso não são classificados por substrings incorretas',
        'CSV classificou categoria por palavra parcial','csv-interface');
      const exportado=window.MeuDinheiroCSV.exportCSV([{id:'1',type:'expense',description:'-2+3',category:'Outros',amount:1,date:'2026-11-19',recurring:false}]);
      conferir('CSV_FORMULA_PROTEGIDA',exportado.includes("\"'-2+3\""),
        'Exportação neutraliza fórmulas iniciadas por hífen',
        'CSV ainda permite fórmula iniciada com hífen','csv-interface');
    }catch{conferir('CSV_CENARIOS_SINTETICOS',false,'','Teste de regressão CSV falhou','csv-interface');}
  }
  let rejeitouMeta=false;try{adicionarInvestimentoVinculado(amostra,{id:'diag-i',goalId:'inexistente',description:'Aporte',amount:5,date:'2026-11-19',category:'CDB'});}catch{rejeitouMeta=true;}
  conferir('INVESTIMENTO_META_EXISTENTE',rejeitouMeta,'Aporte exige objetivo existente','Aporte aceito sem objetivo','investimentos');
  for(const [nome,carregado] of Object.entries(bibliotecas))conferir(`LIB_${nome.toUpperCase()}`,carregado,`Biblioteca ${nome} carregada`,`Biblioteca ${nome} indisponível`,'bibliotecas');
  adicionar('GRAVACAO_SEGURA',resumo.gravacaoBloqueada?'erro':'ok',resumo.gravacaoBloqueada?'Gravação bloqueada para proteger dados inconsistentes':'Dados locais sem bloqueio de gravação');
  adicionar('ARMAZENAMENTO',armazenamentoDisponivel?'ok':'aviso',armazenamentoDisponivel?'Armazenamento local disponível':'Armazenamento local indisponível');
  conferir('TAMANHO_DADOS',tamanhoBytes===null||tamanhoBytes<4*1024*1024,'Espaço local ainda abaixo do alerta de 4 MB','Dados locais próximos do limite de 4 MB','armazenamento','aviso');
  const usoQuota=usoEstimado&&Number.isFinite(usoEstimado.usoAproximado)&&Number.isFinite(usoEstimado.quotaAproximada)&&usoEstimado.quotaAproximada>0?
    usoEstimado.usoAproximado/usoEstimado.quotaAproximada:null;
  conferir('RISCO_COTA_ARMAZENAMENTO',usoQuota===null||usoQuota<.8,
    'Uso estimado inferior a 80% da cota do navegador ou quota indisponível',
    'Risco futuro: armazenamento perto de esgotar; gere backup e libere espaço com segurança','armazenamento','aviso');
  conferir('API_INDEXED_DB',typeof indexedDB!=='undefined','IndexedDB disponível','IndexedDB indisponível (pasta automática opcional)','armazenamento','aviso');
  conferir('API_BLOB',typeof Blob==='function','API de arquivos Blob disponível','API de arquivos indisponível','armazenamento');
  const htmlIndependente=typeof location!=='undefined'&&!['https:','http:'].includes(location.protocol);
  if(htmlIndependente){
    adicionar('API_SERVICE_WORKER','nao_avaliado','Service Worker não é necessário no arquivo HTML independente','pwa');
    adicionar('API_CACHE','nao_avaliado','Cache PWA não é necessário no arquivo HTML independente','pwa');
    integridade.itens.push(...verificarHtmlIndependenteOffline(typeof document!=='undefined'?document:null));
    conferir('OFFLINE_HTML_BIBLIOTECAS',Object.values(bibliotecas).every(Boolean),
      'Importação, gráficos e cópias funcionam sem baixar bibliotecas',
      'Há uma biblioteca interna não carregada no HTML independente','offline');
  }else{
    conferir('API_SERVICE_WORKER','serviceWorker' in navigator,'API do Service Worker disponível','Service Worker não suportado neste ambiente','pwa','aviso');
    conferir('API_CACHE',typeof caches!=='undefined','API de cache disponível','Cache offline indisponível neste ambiente','pwa','aviso');
  }
  if(htmlIndependente){
    adicionar('SW_ATIVO','nao_avaliado','Service Worker não se aplica ao HTML independente; testar no PWA publicado','pwa');
    adicionar('SW_CONTROLE','nao_avaliado','Controle offline não se aplica ao HTML independente; testar no PWA publicado','pwa');
    adicionar('CACHE_PWA','nao_avaliado','Cache PWA não se aplica ao HTML independente; testar no PWA publicado','pwa');
  }else{
    conferir('SW_ATIVO',swRegistrado,'Service Worker ativo','Service Worker ainda não está ativo','pwa','aviso');
    conferir('SW_CONTROLE',Boolean(navigator.serviceWorker?.controller),'Página sob controle do Service Worker','Página ainda sem controle offline','pwa','aviso');
    conferir('CACHE_PWA',cacheInstalado.length>0,'Cache PWA encontrado','Cache PWA ainda não encontrado','pwa','aviso');
    if(swRegistrado&&cacheInstalado.length&&typeof caches?.open==='function'){
      const ordem=nome=>Number(nome.slice(CACHE_PREFIXO.length))||0;
      const ativo=[...cacheInstalado].sort((a,b)=>ordem(b)-ordem(a))[0];
      try{
        const cache=await caches.open(ativo);
        const resultados=await verificarPacoteOffline(cache);
        integridade.itens.push(...resultados);
        conferir('OFFLINE_CACHE_INTEGRIDADE',resultados.every(item=>item.estado==='ok'),
          'Pacote essencial íntegro e consultável sem rede',
          'Cache offline incompleto ou inválido; reconecte e atualize antes de desconectar','offline','aviso');
        if(/^v\d+$/.test(update.versaoEmExecucao||''))
          conferir('OFFLINE_CACHE_VERSAO',ativo===`${CACHE_PREFIXO}${update.versaoEmExecucao.slice(1)}`,
            'Cache corresponde ao código em execução',
            'Versão do cache diferente do aplicativo; recarregue online após concluir a atualização','offline','aviso');
      }catch{adicionar('OFFLINE_CACHE_LEITURA','aviso','Cache encontrado, mas a leitura dos arquivos essenciais falhou','offline');}
    }else adicionar('OFFLINE_CACHE_INSPECAO','nao_avaliado',
      'Instale/abra o PWA conectado, aguarde o Service Worker e repita para inspecionar o pacote offline','offline');
  }
  if(navigator.storage?.persisted){
    try{
      const persistente=await navigator.storage.persisted();
      adicionar('RISCO_OFFLINE_EVICCAO_DADOS',persistente?'ok':'aviso',
        persistente?'Navegador confirmou armazenamento persistente':
          'Risco futuro: navegador pode limpar dados locais por falta de espaço ou política do sistema; mantenha backup externo','offline');
    }catch{adicionar('OFFLINE_PERSISTENCIA','nao_avaliado','Permissão de armazenamento persistente não pôde ser consultada','offline');}
  }else adicionar('OFFLINE_PERSISTENCIA','nao_avaliado','Navegador não informa persistência do armazenamento','offline');
  conferir('CACHE_VERSAO',cacheInstalado.length<=1||swEmEspera,
    swEmEspera&&cacheInstalado.length>1?'Caches em transição: atualização aguarda sua autorização':'Versões de cache consistentes',
    'Mais de uma versão de cache sem atualização pendente','pwa','aviso');
  if(pasta.state==='paused')adicionar('BACKUP_PASTA','aviso','Backup automático pausado após exclusão local; arquivo externo preservado');
  else if(['conflict','permission','error'].includes(pasta.state))adicionar('BACKUP_PASTA','aviso','Backup em pasta requer atenção e não está sincronizado');
  else adicionar('BACKUP_PASTA','ok',['saved','ready','saving'].includes(pasta.state)?'Backup em pasta conectado':'Backup em pasta opcional, sem falha ativa');
  if(transactions.length>0||resumo.compromissos>0)
    conferir('RISCO_SEM_BACKUP_EXTERNO',['saved','ready','saving'].includes(pasta.state),
      'Cópia em pasta disponível para preservar os dados',
      'Risco preventivo: não há cópia externa em pasta confirmada; exporte um JSON regularmente','backup','aviso');
  adicionar('ATUALIZADOR','ok',swEmEspera?'Nova versão disponível para instalar':'Estado da atualização consultado');
  conferir('BACKUP_ESTADO',['off','ready','saved','saving','permission','conflict','error','paused','unsupported',undefined].includes(pasta.state),'Estado de backup reconhecido','Estado de backup desconhecido','backup','aviso');
  conferir('ATUALIZADOR_ESTADO',update.ultimaVerificacao===undefined||Number.isFinite(update.ultimaVerificacao),'Estado do atualizador válido','Estado do atualizador inválido','atualizador');
  if(update.versaoEmExecucao!==undefined){
    conferir('ATUALIZADOR_VERSAO',/^v\d+$/.test(update.versaoEmExecucao),
      'Identificador da versão em execução válido','Identificador da versão em execução inválido','atualizador');
    if(typeof document!=='undefined'){
      const textoVersao=document.getElementById('app-running-version')?.textContent?.trim()||'';
      // Na prévia independente, o rótulo mostra a versão visual e o motor PWA separadamente.
      const motorVisivel=/(?:^|\W)motor\s+(v\d+)(?:\W|$)/i.exec(textoVersao)?.[1];
      conferir('ATUALIZADOR_VERSAO_VISIVEL',
      textoVersao===update.versaoEmExecucao||motorVisivel===update.versaoEmExecucao,
      'Versão em execução exibida corretamente nos Ajustes','Número da versão não corresponde ao código em execução','atualizador');
    }
  }
  conferir('LOGS_LIMITE',obterLogs().length<=50,'Log respeita o limite de 50 eventos','Log ultrapassou o limite de eventos','log');
  conferir('LOGS_FORMATO',obterLogs().every(l=>l&&/^[A-Z][A-Z0-9_]{2,49}$/.test(l.codigo||'')&&['erro','aviso','info','evento'].includes(l.nivel)),'Códigos do log sanitizados','Log contém códigos inesperados','log');
  const errosRecentes=obterLogs().filter(l=>l?.nivel==='erro');
  const reincidencias=new Map();
  for(const log of errosRecentes)reincidencias.set(log.codigo,(reincidencias.get(log.codigo)||0)+1);
  conferir('RISCO_ERROS_REPETIDOS',![...reincidencias.values()].some(qtd=>qtd>=3),
    'Nenhuma mesma falha repetida três vezes nos últimos eventos desta sessão',
    'Risco preventivo: uma falha técnica se repetiu ao menos três vezes nesta sessão; exporte diagnóstico e revise','log','aviso');
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
      // Duas paletas legítimas: produção (v31) e prévia visual modular (v32+).
      // O teste ainda rejeita um tema claro aplicado quando o escuro está selecionado.
      const fundosPermitidos=escuro?['#131417','#111318']:['#f5f6f8','#f6f7fa'];
      const rgb=hex=>`rgb(${[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)).join(', ')})`;
      const normalizarCor=valor=>String(valor||'').toLowerCase().replace(/\s+/g,'');
      const fundoCss=normalizarCor(estilo.getPropertyValue('--bg'));
      const fundoValido=fundosPermitidos.includes(fundoCss);
      conferir('APARENCIA_TEMA_ATIVO',root.dataset.theme===prefs.tema,'Tema selecionado está ativo','Tema salvo não foi aplicado à página','ajustes');
      conferir('APARENCIA_COR_ATIVA',root.dataset.accent===prefs.cor,'Cor selecionada está ativa','Cor salva não foi aplicada à página','ajustes');
      conferir('APARENCIA_TEMA_CSS',fundoValido,'Variáveis do tema carregadas','Variáveis CSS do tema não correspondem à seleção','ajustes');
      conferir('APARENCIA_COR_CSS',normalizarCor(estilo.getPropertyValue('--accent'))===corEsperada,'Variável CSS da cor de destaque carregada','Variável CSS da cor de destaque não corresponde à seleção','ajustes');
      conferir('APARENCIA_FUNDO',fundoValido&&normalizarCor(window.getComputedStyle(document.body).backgroundColor)===normalizarCor(rgb(fundoCss)),
        'Fundo da tela corresponde ao tema','Fundo visível não corresponde ao tema configurado','ajustes');
      conferir('APARENCIA_ESQUEMA',String(estilo.colorScheme||'').split(' ').includes(escuro?'dark':'light'),
        'Esquema claro/escuro corresponde à seleção','Esquema de cores nativo não corresponde ao tema','ajustes');
      for(const [codigo,texto,fundo] of [
        ['CONTRASTE_TEXTO_SECUNDARIO','--sub','--bg'],
        ['CONTRASTE_RECEITAS_CARD','--green-text','--card'],
        ['CONTRASTE_RECEITAS_FUNDO','--green-text','--green-bg'],
        ['CONTRASTE_DESPESAS_CARD','--red-text','--card'],
        ['CONTRASTE_DESPESAS_FUNDO','--red-text','--red-bg'],
        ['CONTRASTE_NAVEGACAO','--accent-text','--card']]){
        const relacao=calcularContrasteCSS(estilo.getPropertyValue(texto),estilo.getPropertyValue(fundo));
        conferir(codigo,relacao!==null&&relacao>=4.5,
          `${codigo.replaceAll('_',' ').toLowerCase()}: texto legível com contraste AA`,
          `${codigo.replaceAll('_',' ').toLowerCase()}: contraste inferior a 4,5:1 ou cor ausente`,
          'acessibilidade');
      }
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
      conferir('UI_ADICIONAR_RESUMO',Boolean(quickAdd?.getAttribute('aria-label')?.includes('opções de cadastro')),
        'Ação rápida do resumo oferece todas as opções de cadastro','Ação rápida do resumo não informa as opções de cadastro','interface','aviso');
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
      NAVEGACAO:['desktop-toolbar','desktop-nav','mobile-nav','main-content'],LANCAMENTOS:['transaction-dialog','transaction-form','quick-add'],
      ACAO_RAPIDA:['desktop-create-wrap','desktop-create-trigger','desktop-create-menu','quick-add','mobile-create-dialog','mobile-create-title'],
      OBJETIVOS:['goal-dialog','goal-form'],INVESTIMENTOS:['investment-dialog','investment-form','investment-category-suggestions','investment-origin-note','investment-submit'],
      CALENDARIO:['finance-calendar-dialog','finance-calendar-content','calendar-day-dialog','calendar-day-title','calendar-day-content'],LEMBRETES:['reminder-dialog','reminder-list'],NOTIFICACOES:['notifications-clear','notifications-restore'],
      BACKUP:['export-data','import-data','folder-backup-status'],CSV:['export-csv','import-csv','csv-preview-dialog'],
      AJUSTES:['settings-page','settings-form','settings-reserve'],ATUALIZACAO:['check-update','install-update','app-update-status'],
      PDF:['export-pdf','pdf-report-type','print-report'],SAUDE:['main-content'],
      DIAGNOSTICO:['diagnostics-dialog','diagnostics-run','diagnostics-progress','diagnostics-export'],
      CONFIRMACAO:['confirmation-dialog','confirmation-accept','confirmation-cancel'],
      LIMPEZA_DADOS:['delete-all-data','delete-data-dialog','delete-data-form','delete-data-phrase','delete-data-confirm','delete-data-cancel']})) {
      conferir(`UI_${codigo}`,ids.every(id=>Boolean(document.getElementById(id))),`Interface ${codigo.toLowerCase()} completa`,`Faltam componentes da interface ${codigo.toLowerCase()}`,'interface');
    }
    const modalCalendario=document.getElementById('finance-calendar-dialog');
    if(typeof modalCalendario?.open==='boolean')conferir('UI_CALENDARIO_FECHADO',!modalCalendario.open,
      'Calendário completo fica oculto até o usuário tocar no mês',
      'Calendário está aberto enquanto o usuário acessa Ajustes','calendario-financeiro');
    const seletorMes=document.querySelector?.('.month-control [data-calendar-open]');
    if(seletorMes?.getAttribute)conferir('UI_CALENDARIO_ACESSIVEL',
      seletorMes.getAttribute('aria-haspopup')==='dialog'&&
      seletorMes.getAttribute('aria-controls')===modalCalendario?.id,
      'Nome do mês aponta para o calendário expandido',
      'Botão do mês não controla o diálogo correto','calendario-financeiro');
    const entrada=document.getElementById('delete-data-phrase');
    const botao=document.getElementById('delete-data-confirm');
    if(entrada&&botao)conferir('LIMPEZA_CONFIRMACAO_FINAL',entrada.required&&botao.type==='submit'&&
      botao.closest?.('form')?.id==='delete-data-form'&&Boolean(document.getElementById('delete-data-dialog')?.getAttribute('aria-labelledby')),
      'Confirmação final exige campo obrigatório em diálogo identificado',
      'Confirmação final da limpeza está incompleta','limpeza-dados');
    const seletorRelatorio=document.getElementById('pdf-report-type');
    if(seletorRelatorio)conferir('PDF_TIPO_SELECIONADO',['resumo','renda','despesas','metas','sonho'].includes(seletorRelatorio.value),
      'Relatório PDF possui seleção explícita e válida',
      'Tipo do relatório PDF ausente ou inválido','relatorio-pdf');
    const botaoDesktop=document.getElementById('desktop-create-trigger');
    const menuDesktop=document.getElementById('desktop-create-menu');
    if(botaoDesktop?.getAttribute&&menuDesktop?.querySelectorAll)conferir('ACAO_RAPIDA_MENU',
      botaoDesktop.getAttribute('aria-controls')===menuDesktop.id&&menuDesktop.querySelectorAll('[data-create-kind]').length===5,
      'Menu desktop oferece criação direta de cinco registros, inclusive investimentos',
      'Ações ou acessibilidade do menu desktop incompletas','acao-rapida');
    const menuMovel=document.getElementById('mobile-create-dialog');
    if(quickAdd?.getAttribute&&menuMovel?.querySelectorAll){
      const tiposEsperados=['income','expense','goal','dream','investment'];
      const tiposDesktop=[...(menuDesktop?.querySelectorAll?.('[data-create-kind]')||[])].map(item=>item.dataset.createKind);
      const opcoesMovel=[...menuMovel.querySelectorAll('[data-create-kind]')];
      const tiposMovel=opcoesMovel.map(item=>item.dataset.createKind);
      conferir('ACAO_RAPIDA_MOBILE_DIALOGO',menuMovel.tagName?.toLowerCase()==='dialog'&&
        menuMovel.getAttribute('aria-labelledby')==='mobile-create-title'&&
        quickAdd.getAttribute('aria-controls')===menuMovel.id&&quickAdd.getAttribute('aria-haspopup')==='dialog'&&
        ['true','false'].includes(quickAdd.getAttribute('aria-expanded')),
        'Painel móvel identificado, com acionador acessível','Painel de criação móvel ou seus atributos acessíveis ausentes','acao-rapida');
      conferir('ACAO_RAPIDA_PARIDADE',tiposDesktop.join('|')===tiposEsperados.join('|')&&
        tiposMovel.join('|')===tiposEsperados.join('|')&&new Set(tiposMovel).size===5,
        'Desktop e smartphone oferecem os mesmos cinco tipos de cadastro',
        'Desktop e smartphone oferecem opções diferentes, duplicadas ou incompletas','acao-rapida');
      conferir('ACAO_RAPIDA_MOBILE_ATALHOS',opcoesMovel.every(opcao=>
        opcao.tagName?.toLowerCase()==='button'&&opcao.getAttribute('type')==='button'&&
        Boolean(opcao.textContent?.trim())),
        'Cinco opções móveis possuem rótulo e toque independente',
        'Alguma opção móvel não é botão identificado','acao-rapida');
      if(typeof window!=='undefined'&&window.innerWidth<880&&
        typeof window.getComputedStyle==='function'&&typeof quickAdd.getBoundingClientRect==='function'&&
        !quickAdd.classList?.contains('hidden')){
        const area=quickAdd.getBoundingClientRect();
        conferir('ACAO_RAPIDA_TOQUE_MOBILE',area.width>=44&&area.height>=44,
          'Botão de criação móvel tem área de toque adequada',
          'Botão de criação móvel menor que 44 × 44 pixels','interface','aviso');
      }
    }
    const barraMovel=document.getElementById('mobile-nav');
    if(barraMovel?.querySelectorAll){
      const botoes=[...barraMovel.querySelectorAll('.nav-button')];
      conferir('NAVEGACAO_MOBILE_SEIS_ABAS',botoes.length===6,
        'As seis áreas estão na navegação do smartphone',
        'A navegação móvel não apresenta todas as áreas','interface');
      if(typeof window!=='undefined'&&window.innerWidth<880&&botoes.length===6&&
        botoes.every(botao=>typeof botao.getBoundingClientRect==='function')){
        const semSobreposicao=botoes.every(botao=>{
          const area=botao.getBoundingClientRect();
          const icone=botao.querySelector('svg')?.getBoundingClientRect();
          const rotulo=botao.querySelector('span')?.getBoundingClientRect();
          return area.width>0&&Boolean(icone&&rotulo)&&rotulo.left>=area.left-1&&
            rotulo.right<=area.right+1&&rotulo.top>=icone.bottom-1;
        });
        conferir('NAVEGACAO_MOBILE_SEM_SOBREPOSICAO',semSobreposicao,
          'Ícones e rótulos das seis abas cabem sem sobreposição',
          'Navegação móvel: ícones e textos se sobrepõem ou extrapolam seus botões','interface','aviso');
      }
      if(typeof document.getElementById==='function'&&document.getElementById('quick-add')){
        conferir('ACAO_RAPIDA_UNICA_MOBILE',!document.querySelector?.('#mobile-quick-actions'),
          'Botão + reúne cadastros sem barra fixa Gastei/Recebi',
          'Há barra de lançamentos rápidos duplicada com o botão +','interface','aviso');
        const entrada=document.getElementById('transaction-keyboard-mode');
        if(entrada)conferir('TECLADO_MONETARIO_ALTERNANCIA',Boolean(document.getElementById('transaction-keypad-display')),
          'Entrada monetária oferece teclado em centavos e opção de teclado do celular',
          'Opção de teclado monetário sem visor de valor','interface','aviso');
      }
    }
    // Desde a P2 as ferramentas financeiras ficam em Relatórios, sem cópia em Ajustes.
    const relatorios=document.getElementById('reports-page');
    const ajustesPage=document.getElementById('settings-page');
    if(typeof relatorios?.querySelector==='function'&&typeof ajustesPage?.querySelector==='function'){
      const ids=['export-pdf','export-csv','import-csv','export-data','import-data','folder-backup-connect'];
      conferir('RELATORIOS_EXPORTACAO_DESCOBERTA',ids.every(id=>
        relatorios.querySelector(`#${id}`)===document.getElementById(id)&&Boolean(document.getElementById(id))),
      'PDF, CSV, importação e backup estão disponíveis em Relatórios',
      'Uma ferramenta de PDF, CSV ou backup não está localizada em Relatórios','interface','aviso');
      conferir('AJUSTES_SEM_EXPORTACAO_DUPLICADA',ids.every(id=>!ajustesPage.querySelector(`#${id}`)),
      'Ajustes não duplica controles financeiros de Relatórios',
      'Há ferramentas financeiras duplicadas na área Ajustes','interface','aviso');
    }
    const barraDesktop=document.getElementById('desktop-toolbar');
    if(barraDesktop&&typeof window!=='undefined'&&window.innerWidth>=880&&typeof window.getComputedStyle==='function'){
      const estilo=window.getComputedStyle(barraDesktop);
      conferir('NAVEGACAO_FIXA_DESKTOP',estilo.position==='sticky'&&estilo.top==='0px',
        'Navegação permanece no topo durante a rolagem no desktop',
        'Barra de navegação não está fixada no topo do desktop','interface');
      const dimensoes=barraDesktop.getBoundingClientRect?.();
      if(dimensoes?.width>0)conferir('NAVEGACAO_LARGURA_DESKTOP',dimensoes.width>=window.innerWidth*.9,
        'Barra dos módulos ocupa a largura disponível da tela',
        'Barra desktop está estreita demais para o espaço disponível','interface');
    }
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
    adicionar('AUDITORIA_FONTES',htmlIndependente?'nao_avaliado':'aviso',
      htmlIndependente?'Auditoria estática de arquivos externos não se aplica ao HTML único; executar no PWA publicado':auditoria.motivo,'auditoria-codigo');
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
  integridade.naoAvaliados=integridade.itens.filter(item=>item.estado==='nao_avaliado').length;
  integridade.riscosPreventivos=integridade.itens.filter(item=>item.codigo.startsWith('RISCO_')&&item.estado==='aviso').length;
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
    persistenciaIndexedDB:estadoEspelho?{habilitado:estadoEspelho.habilitado,
      estado:verificacaoEspelho?.estado||estadoEspelho.estado,
      exclusaoProtegida:Boolean(estadoEspelho.exclusaoProtegida),
      primario:Boolean(estadoEspelho.primario),modo:estadoEspelho.modo||'legado',
      falhas:estadoEspelho.falhas,ultimaSincronizacao:estadoEspelho.ultimaSincronizacao}:null,
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

// Converte os testes complementares em itens nativos do mesmo relatório.
// Nenhum complemento lê ou escreve o armazenamento financeiro durante a junção.
export function unificarResultadosDiagnosticos(relatorio,complementos=[]) {
  const itensBase=relatorio.integridade.itens;
  const usados=new Set(itensBase.map(item=>item.codigo));
  const extras=[];
  const modulos=[];
  for(const grupo of complementos){
    const nome=String(grupo.nome||'extensao').replace(/[^a-z0-9-]/gi,'').slice(0,48)||'extensao';
    const resultados=Array.isArray(grupo.resultados)?grupo.resultados:[];
    let aprovados=0,erros=0;
    const totalEsperado=Number.isInteger(grupo.esperados)&&grupo.esperados>=0?grupo.esperados:resultados.length;
    for(const [indice,item] of resultados.entries()){
      const id=String(item?.code||'').trim();
      const valido=/^[A-Z][A-Z0-9_]{2,90}$/.test(id)&&!usados.has(id);
      const codigo=valido?id:`EXTENSAO_${nome.toUpperCase().replaceAll('-','_')}_${indice+1}`;
      usados.add(codigo);
      const ok=valido&&item?.status==='ok'&&typeof item?.description==='string'&&item.description.length>0;
      const descricao=typeof item?.description==='string'?item.description.slice(0,240):'Teste complementar sem descrição válida';
      extras.push({codigo,modulo:nome,estado:ok?'ok':'erro',descricao});
      if(ok)aprovados++;else erros++;
    }
    for(let indice=resultados.length;indice<totalEsperado;indice++){
      const codigo=`EXTENSAO_${nome.toUpperCase().replaceAll('-','_')}_AUSENTE_${indice+1}`;
      extras.push({codigo,modulo:nome,estado:'erro',descricao:'Verificação registrada não retornou resultado'});
      erros++;
    }
    modulos.push({nome,total:Math.max(resultados.length,totalEsperado),aprovados,erros});
  }
  const itens=[...itensBase,...extras];
  return {...relatorio,formatoRelatorio:4,duracaoPrevistaMs:calcularDuracaoDiagnostico(itens.length),
    integridade:{...relatorio.integridade,itens,erros:itens.filter(item=>item.estado==='erro').length,
      avisos:itens.filter(item=>item.estado==='aviso').length,
      riscosPreventivos:itens.filter(item=>item.codigo.startsWith('RISCO_')&&item.estado==='aviso').length,
      naoAvaliados:itens.filter(item=>item.estado==='nao_avaliado').length},
    complementos:{total:extras.length,modulos}};
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
  const extensoes=new Map();
  const hub=Object.freeze({
    registrar(nome,executar,esperados){
      if(!/^[a-z0-9-]{2,48}$/.test(nome)||typeof executar!=='function'||extensoes.has(nome))return false;
      extensoes.set(nome,{executar,esperados});return true;
    },
    quantidade:()=>extensoes.size
  });
  window.MeuDinheiroDiagnosticoHub=hub;
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
    grupo.titulo.textContent=`${nome.replaceAll('-',' ')} · ${c.ok} ok · ${c.erro} erros · ${c.aviso} avisos${c.nao_avaliado?` · ${c.nao_avaliado} não avaliados`:''}${c.pendente?` · ${c.pendente} pendentes`:''}`;
    grupo.elemento.dataset.state=c.erro?'erro':c.aviso?'aviso':c.nao_avaliado?'nao_avaliado':c.pendente?'pendente':'ok';
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
      const base=await criarRelatorioDiagnostico(ctx);
      const complementos=[];
      for(const [nome,extensao] of extensoes){
        let resultados;
        try{resultados=extensao.executar();}
        catch(_){resultados=[{code:`EXTENSAO_${nome.toUpperCase().replaceAll('-','_')}_FALHA`,description:'Falha ao executar módulo complementar',status:'falha'}];}
        complementos.push({nome,resultados,esperados:extensao.esperados});
      }
      const relatorio=unificarResultadosDiagnosticos(base,complementos);
      if(atual!==rodada)return null;
      const {integridade}=relatorio;
      const itens=integridade.itens;
      const duracao=calcularDuracaoDiagnostico(itens.length);
      resumo.textContent=`${itens.length} verificações executadas · organizando o relatório do sistema.`;
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
      resumo.textContent=`${integridade.itens.length} verificações · ${integridade.erros} erro(s) · ${integridade.avisos} aviso(s)${integridade.riscosPreventivos?` (${integridade.riscosPreventivos} riscos preventivos)`:''}${integridade.naoAvaliados?` · ${integridade.naoAvaliados} não avaliadas`:''}${relatorio.propostaInterface?` · ${relatorio.propostaInterface.pendentes} melhorias pendentes`:''}.`;
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
  dialogo.addEventListener('click',event=>{if(cliqueForaDoDialogo(event,dialogo))dialogo.close();});
  return {executar};
}
