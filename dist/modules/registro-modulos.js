import {registrarModuloDiagnostico,executarVerificacoesModulos,MODULOS_OBRIGATORIOS} from './catalogo-diagnostico.js';
import {verificarIntegridade} from './integridade.js';
import {validarDataISO} from './validacao.js';
import {calcularSaudeFinanceira} from './saude.js';
import {analisarCodigoEstatico,auditarCodigoPublicado} from './auditoria-codigo.js';
import {montarRelatorioFinanceiro} from './relatorio-pdf-conteudo.js';
import {normalizarTipoRelatorioPdf} from './relatorio-pdf.js';
import {acaoMovelParaVisao,TIPOS_CRIACAO_RAPIDA} from './acao-rapida.js';
import {adicionarInvestimentoVinculado,editarInvestimentoVinculado,encontrarSalarioAnterior} from './investimentos.js';
import {calcularCalendarioFinanceiro,compactarValorCalendario,navegarMesCalendario,renderBotaoCalendario} from './calendario-financeiro.js';
import {avaliarRequisitosProposta,REQUISITOS_PROPOSTA} from './diagnostico-proposta.js';
import {validarFraseLimpeza,apagarDadosLocais} from './limpeza-dados.js';
import {criarProtecaoConcorrencia,solicitarPersistenciaLocal} from './concorrencia-dados.js';
import {mesLocalDaData,calcularViradaPeriodo} from './ciclo-periodo.js';
import {ocorrenciaNoMes,totaisDoMes,principalReserva,aportesPendentes,estimarRendimentoCdi,calcularSaldoDisponivelHoje} from './motor-financeiro.js';
import {percentualObjetivo,restanteObjetivo,resumirObjetivos,candidatosVinculo,destaquesObjetivos} from './dominio-objetivos.js';
import {validarVinculosSalariais} from './dominio-investimentos.js';
import {cliqueForaDoDialogo} from './dialogos.js';
import {CATEGORIAS_DESPESA,GRUPOS_DESPESA,renderizarOpcoesDespesas} from './categorias-brasileiras.js';
import {converterOfxParaCsv,identificarOfx} from './ofx.js';
import {categoriasVisiveis} from './categorias-rapidas.js';
import {calcularOrcamentoDia} from './orcamento.js';
import {criarModuloPrevisoes,projetarDozeMeses,proximasDespesasPrevistas} from './previsoes.js';
import {resumirAno} from './relatorio-anual.js';
import {resumirDesafio52,valorSemana52,renderDesafio52} from './desafio-52.js';
import {ocorrenciaCompromisso,registrarPagamentoCompromisso,resumirCartao} from './compromissos.js';

// Autoverificação determinística: a conta é feita em centavos pelo mesmo motor
// do Resumo, e o valor esperado reflete 280,00 divididos por 29 dias restantes.
export function verificarOrcamentoSintetico(calcular=calcularOrcamentoDia){
  const resultado=calcular([{date:'2026-11-01',type:'expense',amount:20}],300,'2026-11-02');
  return resultado?.gastoAnterior===20&&Math.round(resultado.cotaHoje*100)===965&&
    resultado.diasRestantes===29&&Math.round(resultado.restanteMes*100)===28000;
}

// Único ponto de registro; CI exige cobertura para cada arquivo em modules/.
export function registrarModulosDoApp(api) {
  const {dialogos,moduloResumo,moduloLancamentos,moduloObjetivos,moduloBackup,moduloCsv,
    atualizador,ajustes,limpeza,recuperacao,acaoRapida,investimentos,calendarioFinanceiro,preferencias,notificacoes,relatorioPdf,moduloSaude,regras,logger,diagnostico,espelho,repositorio,moduloCompromissos} = api;
  const registrar=(nome,teste)=>registrarModuloDiagnostico(nome,teste);
  registrar('compromissos',()=>{
    const plano={id:'diag-plan',kind:'card',name:'Teste',category:'Cartão de crédito',amount:10,day:31,startMonth:'2026-01',monthsCount:2};
    const base={transactions:[],goals:[],allocations:[],completedAportes:[],commitments:[plano]};
    const next=registrarPagamentoCompromisso(base,'diag-plan','2026-01',{id:'diag-pago',date:'2026-01-31'});
    return ocorrenciaCompromisso(plano,'2026-02')?.date==='2026-02-28'&&
      next.transactions.length===1&&base.transactions.length===0&&resumirCartao(next,'2026-01').restante===10;
  });
  registrar('compromissos-interface',()=>typeof moduloCompromissos?.render==='function'&&
    typeof moduloCompromissos?.novo==='function'&&Boolean(document.getElementById('commitment-form')));
  registrar('resumo',()=>typeof moduloResumo.renderSummary==='function'&&
    calcularSaldoDisponivelHoje([{type:'income',amount:100,date:'2026-02-01'},
      {type:'expense',amount:40,date:'2026-02-02'},
      {type:'expense',amount:20,date:'2026-02-20'}],'2026-02-10')===60);
  registrar('lancamentos',()=>typeof moduloLancamentos.renderTransactions==='function'&&typeof moduloLancamentos.openTransaction==='function');
  registrar('categorias-rapidas',()=>categoriasVisiveis(['Mercado','Contas'],'Contas').join('|')==='Contas|Mercado'&&
    categoriasVisiveis(Array.from({length:12},(_,i)=>String(i)),'3').length===8);
  registrar('orcamento',verificarOrcamentoSintetico);
  registrar('previsoes',()=>{
    const teste=[{type:'income',amount:200,date:'2026-11-05',recurring:true},
      {type:'expense',amount:50,date:'2026-11-10',recurring:true}];
    const meses=projetarDozeMeses(teste,'2026-11');
    return meses.length===12&&meses[0].livre===150&&meses[11].livre===150&&
      proximasDespesasPrevistas(teste,'2026-11-08').length===1&&
      typeof criarModuloPrevisoes==='function'&&Boolean(document.getElementById('forecast-panel'));
  });
  registrar('relatorio-anual',()=>{
    const r=resumirAno([{type:'income',amount:100,date:'2026-01-05'}],[],2026,'2026-11-22');
    return r?.receitas===100&&r.meses.length===12&&r.melhor?.mes==='2026-01'&&
      Boolean(document.getElementById('annual-panel'))&&Boolean(document.getElementById('annual-content'));
  });
  registrar('desafio-52',()=>valorSemana52(52)===104&&resumirDesafio52({goals:[],allocations:[]}).meta===2756&&
    renderDesafio52({goals:[],allocations:[]},{esc:valor=>String(valor),money:valor=>String(valor)}).includes('challenge-create'));
  registrar('categorias-brasileiras',()=>{
    const obrigatorias=['Aluguel','Água e esgoto','Energia elétrica','Supermercado','Combustível','IPVA',
      'Condomínio','IPTU','Farmácia','Cartão de crédito','Plano de saúde'];
    return obrigatorias.every(nome=>CATEGORIAS_DESPESA.includes(nome))&&
      new Set(CATEGORIAS_DESPESA).size===CATEGORIAS_DESPESA.length&&
      GRUPOS_DESPESA.length>=5&&renderizarOpcoesDespesas(texto=>texto).includes('<optgroup');
  });
  registrar('objetivos',()=>typeof moduloObjetivos.renderGoals==='function'&&typeof moduloObjetivos.openGoal==='function');
  registrar('dominio-objetivos',()=>percentualObjetivo({target:200,saved:50})===25&&
    restanteObjetivo({target:200,saved:50})===150&&
    resumirObjetivos({goals:[{id:'g',kind:'goal',target:200,saved:50}],allocations:[]},'goal').guardado===50&&
    candidatosVinculo({goals:[{id:'r',kind:'goal',name:'Reserva de emergência'}]},'reserve').length===1&&
    destaquesObjetivos({goals:[{id:'d',kind:'dream',name:'Viagem'}]}).sonho?.id==='d');
  registrar('dominio-investimentos',()=>validarVinculosSalariais({transactions:[],allocations:[]}).ok===true);
  registrar('backup',()=>typeof moduloBackup.folderBackup?.getState==='function');
  registrar('csv-interface',()=>typeof moduloCsv==='function');
  registrar('ofx',()=>{
    const exemplo='<OFX><STMTTRN><DTPOSTED>20261120<TRNAMT>-12.50<NAME>Teste</STMTTRN></OFX>';
    return identificarOfx(exemplo)&&converterOfxParaCsv(exemplo).includes('12.50');
  });
  registrar('atualizador',()=>typeof atualizador.getStatus==='function'&&/^v\d+$/.test(atualizador.getStatus().versaoEmExecucao));
  registrar('ajustes',()=>typeof ajustes.abrir==='function'&&typeof ajustes.aplicar==='function');
  registrar('acao-rapida',()=>typeof acaoRapida.atualizar==='function'&&typeof acaoRapida.selecionar==='function'&&
    typeof acaoRapida.abrirMenuMovel==='function'&&typeof acaoRapida.fecharMenuMovel==='function'&&
    acaoMovelParaVisao('despesas').tipo==='expense'&&acaoMovelParaVisao('sonho').tipo==='dream'&&
    TIPOS_CRIACAO_RAPIDA.length===5&&Boolean(document.getElementById('desktop-create-trigger'))&&
    Boolean(document.getElementById('mobile-create-dialog'))&&
    document.getElementById('mobile-create-dialog').querySelectorAll('[data-create-kind]').length===5);
  registrar('ciclo-periodo',()=>mesLocalDaData(new Date(2027,0,1))==='2027-01'&&
    calcularViradaPeriodo('2026-12','2026-12','2026-12-31',new Date(2027,0,1)).mesSelecionado==='2027-01');
  registrar('espelho-indexeddb',()=>typeof espelho?.iniciar==='function'&&typeof espelho?.iniciarVazio==='function'&&typeof espelho?.gravar==='function'&&
    typeof espelho?.apagar==='function'&&typeof espelho?.conferir==='function'&&
    typeof espelho?.obterEstado==='function');
  registrar('recuperacao-conflitos',()=>typeof recuperacao?.inspecionar==='function'&&
    typeof recuperacao?.baixar==='function'&&typeof recuperacao?.getEstado==='function'&&
    typeof recuperacao?.recuperar==='function'&&
    Boolean(document.getElementById('recovery-inspect'))&&
    Boolean(document.getElementById('recovery-download-local'))&&
    Boolean(document.getElementById('recovery-download-indexeddb'))&&
    Boolean(document.getElementById('recovery-choice'))&&Boolean(document.getElementById('recovery-apply')));
  registrar('repositorio-financeiro',()=>typeof repositorio?.iniciar==='function'&&
    typeof repositorio?.gravar==='function'&&typeof repositorio?.obterEstado==='function');
  registrar('concorrencia-dados',()=>{
    let raw='origem';const storage={getItem:()=>raw};const eventos=[];
    const proteger=criarProtecaoConcorrencia({storage,chave:'teste',janela:{addEventListener:()=>{}},
      aoAlterar:v=>{eventos.push(v);return true;},aoConflito:()=>eventos.push('conflito')});
    raw='mudou';return !proteger.podeGravar()&&proteger.sincronizar()&&proteger.podeGravar()&&
      eventos[0]==='mudou'&&typeof solicitarPersistenciaLocal==='function';
  });
  registrar('investimentos',()=>{
    const base={goals:[{id:'m',kind:'dream',saved:10}],transactions:[],allocations:[]};
    const next=adicionarInvestimentoVinculado(base,{id:'i',goalId:'m',description:'Exemplo',amount:5,date:'2026-11-19',category:'Poupança'});
    const alterado=editarInvestimentoVinculado(next,{id:'i',goalId:'m',description:'Exemplo corrigido',amount:7,date:'2026-11-19',category:'CDB'});
    return typeof investimentos.abrir==='function'&&typeof investimentos.editar==='function'&&next.goals[0].saved===15&&next.allocations.length===1&&
      alterado.allocations.length===1&&alterado.goals[0].saved===17&&
      next.allocations[0].kind==='dream'&&base.goals[0].saved===10&&
      encontrarSalarioAnterior([{id:'s',type:'income',category:'Salário base',date:'2026-11-05'}],'2026-11-19')?.id==='s'&&
      Boolean(document.getElementById('investment-dialog'));
  });
  registrar('calendario-financeiro',()=>{
    const mes=calcularCalendarioFinanceiro('2026-11',[
      {type:'income',amount:100,date:'2026-11-10'},{type:'expense',amount:40,date:'2026-11-10'}]);
    return typeof calendarioFinanceiro.renderCalendario==='function'&&typeof calendarioFinanceiro.abrirCalendario==='function'&&
      typeof calendarioFinanceiro.abrirDia==='function'&&typeof calendarioFinanceiro.atualizarCalendario==='function'&&
      mes.days.length===30&&mes.days[9].tone==='mixed'&&mes.days[9].netCents===6000&&
      mes.days[9].level===5&&compactarValorCalendario(150000)==='1,5mil'&&
      navegarMesCalendario('2026-12',1)==='2027-01'&&
      renderBotaoCalendario('2026-11',ym=>ym,x=>x).includes('data-calendar-open')&&
      Boolean(document.getElementById('calendar-day-dialog'))&&
      Boolean(document.getElementById('finance-calendar-dialog'))&&
      Boolean(document.getElementById('finance-calendar-content'));
  });
  registrar('limpeza-dados',()=>typeof limpeza.abrir==='function'&&typeof apagarDadosLocais==='function'&&
    validarFraseLimpeza('APAGAR')&&!validarFraseLimpeza('apagar')&&!validarFraseLimpeza('APAGAR ')&&
    typeof moduloBackup.folderBackup?.pause==='function');
  registrar('notificacoes',()=>typeof notificacoes.pendentes==='function'&&Array.isArray(notificacoes.pendentes())&&
    Number.isSafeInteger(notificacoes.getStatus().ocultas));
  registrar('saude',()=>typeof moduloSaude.renderSaude==='function'&&typeof moduloSaude.calcular==='function'&&
    calcularSaudeFinanceira({renda:100,despesas:85,saldo:15,reserva:300,despesasPeriodo:90,diasPeriodo:30}).situacao==='crescendo');
  registrar('auditoria-codigo',()=>typeof auditarCodigoPublicado==='function'&&
    analisarCodigoEstatico({fontesCss:{'teste.css':'.sem-uso{}'},fontesJs:{'teste.js':'function usada(){} usada();'}}).cssNaoUsados.length===1);
  registrar('relatorio-pdf',()=>typeof relatorioPdf.imprimir==='function'&&typeof relatorioPdf.obterTipo==='function'&&
    Boolean(document.getElementById('export-pdf'))&&Boolean(document.getElementById('pdf-report-type'))&&
    normalizarTipoRelatorioPdf('invalido')==='resumo'&&normalizarTipoRelatorioPdf('sonho')==='sonho');
  registrar('relatorio-pdf-conteudo',()=>{
    const exemplo=montarRelatorioFinanceiro({visao:'resumo',mes:'2026-11',mesExtenso:'novembro de 2026',
      transacoes:[{type:'income',amount:150,category:'Salário',description:'Receita de teste',date:'2026-11-01'},
        {type:'expense',amount:10,category:'Teste',description:'Despesa de teste',date:'2026-11-02'}],
      objetivos:[{id:'meta',kind:'goal',name:'Objetivo de teste',target:100,saved:10}],
      aplicacoesRegistradas:[{id:'ap',goalId:'meta',kind:'reserve',description:'Aplicação de teste',amount:5,date:'2026-11-03'}],
      money:n=>String(n)});
    return ['Despesas por categoria','Receitas por categoria','Receita de teste','Despesa de teste',
      'Objetivo de teste','Aplicação de teste','140'].every(valor=>exemplo.includes(valor));
  });
  registrar('preferencias',()=>['auto','claro','escuro'].includes(preferencias.obter().tema));
  registrar('motor-financeiro',()=>ocorrenciaNoMes({date:'2024-01-31',recurring:true},'2024-02')==='2024-02-29'&&
    totaisDoMes([{type:'income',amount:120.01,date:'2026-11-01',recurring:false},
      {type:'expense',amount:30,date:'2026-11-02',recurring:false}],'2026-11').balance===90.01&&
    principalReserva({goals:[{id:'m',name:'Reserva',kind:'goal',saved:10}],allocations:[]})===10&&
    aportesPendentes([{id:'s',type:'income',date:'2026-11-01',amount:100,description:'Exemplo',category:'Salário'}],
      [],'2026-11-22',()=>10)[0]?.tenPercent===10&&
    estimarRendimentoCdi(10000,0.04)===84.34&&
    calcularSaldoDisponivelHoje([{id:'s',type:'income',amount:150,date:'2026-11-01'}],'2026-11-22')===150);
  registrar('regras-financeiras',()=>regras.calcularAporte({type:'income',category:'Salário base',amount:100},{percentual:10,categoriasAporte:['Salário base']})===10);
  registrar('log',()=>Array.isArray(logger.obterLogs()));
  registrar('dialogos',()=>typeof dialogos.confirmar==='function'&&typeof dialogos.informar==='function'&&
    !cliqueForaDoDialogo({target:'area',clientX:50,clientY:50},{getBoundingClientRect:()=>({left:0,right:100,top:0,bottom:100})}));
  registrar('validacao',()=>validarDataISO('2024-02-29')&&!validarDataISO('2025-02-29'));
  registrar('integridade',()=>verificarIntegridade({transactions:[],goals:[],allocations:[],completedAportes:[]},{income:[],expense:[]}).erros===0);
  registrar('diagnostico',()=>typeof diagnostico.executar==='function');
  registrar('diagnostico-proposta',()=>{
    const relatorio=avaliarRequisitosProposta({TEMA_AUTO:true,TEMA_AZUL:false});
    return relatorio.total===REQUISITOS_PROPOSTA.length&&relatorio.implementados===1&&relatorio.pendentes===1;
  });
  registrar('catalogo-diagnostico',()=>typeof executarVerificacoesModulos==='function'&&MODULOS_OBRIGATORIOS.length>0);
  registrar('registro-modulos',()=>typeof registrarModulosDoApp==='function');
}
