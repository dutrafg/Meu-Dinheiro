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
import {calcularSaldoDisponivelHoje} from './resumo.js';
import {validarFraseLimpeza,apagarDadosLocais} from './limpeza-dados.js';
import {criarProtecaoConcorrencia,solicitarPersistenciaLocal} from './concorrencia-dados.js';
import {mesLocalDaData,calcularViradaPeriodo} from './ciclo-periodo.js';
import {ocorrenciaNoMes,totaisDoMes,principalReserva} from './motor-financeiro.js';
import {cliqueForaDoDialogo} from './dialogos.js';
import {CATEGORIAS_DESPESA,GRUPOS_DESPESA,renderizarOpcoesDespesas} from './categorias-brasileiras.js';

// Único ponto de registro; CI exige cobertura para cada arquivo em modules/.
export function registrarModulosDoApp(api) {
  const {dialogos,moduloResumo,moduloLancamentos,moduloObjetivos,moduloBackup,moduloCsv,
    atualizador,ajustes,limpeza,recuperacao,acaoRapida,investimentos,calendarioFinanceiro,preferencias,notificacoes,relatorioPdf,moduloSaude,regras,logger,diagnostico,espelho} = api;
  const registrar=(nome,teste)=>registrarModuloDiagnostico(nome,teste);
  registrar('resumo',()=>typeof moduloResumo.renderSummary==='function'&&
    calcularSaldoDisponivelHoje([{type:'income',amount:100,date:'2026-02-01'},
      {type:'expense',amount:40,date:'2026-02-02'},
      {type:'expense',amount:20,date:'2026-02-20'}],'2026-02-10')===60);
  registrar('lancamentos',()=>typeof moduloLancamentos.renderTransactions==='function'&&typeof moduloLancamentos.openTransaction==='function');
  registrar('categorias-brasileiras',()=>{
    const obrigatorias=['Aluguel','Água e esgoto','Energia elétrica','Supermercado','Combustível','IPVA',
      'Condomínio','IPTU','Farmácia','Cartão de crédito','Plano de saúde'];
    return obrigatorias.every(nome=>CATEGORIAS_DESPESA.includes(nome))&&
      new Set(CATEGORIAS_DESPESA).size===CATEGORIAS_DESPESA.length&&
      GRUPOS_DESPESA.length>=5&&renderizarOpcoesDespesas(texto=>texto).includes('<optgroup');
  });
  registrar('objetivos',()=>typeof moduloObjetivos.renderGoals==='function'&&typeof moduloObjetivos.openGoal==='function');
  registrar('backup',()=>typeof moduloBackup.folderBackup?.getState==='function');
  registrar('csv-interface',()=>typeof moduloCsv==='function');
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
    Boolean(document.getElementById('recovery-inspect'))&&
    Boolean(document.getElementById('recovery-download-local'))&&
    Boolean(document.getElementById('recovery-download-indexeddb')));
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
    principalReserva({goals:[{id:'m',name:'Reserva',kind:'goal',saved:10}],allocations:[]})===10);
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
