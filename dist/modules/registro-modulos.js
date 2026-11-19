import {registrarModuloDiagnostico,executarVerificacoesModulos,MODULOS_OBRIGATORIOS} from './catalogo-diagnostico.js';
import {verificarIntegridade} from './integridade.js';
import {validarDataISO} from './validacao.js';
import {calcularSaudeFinanceira} from './saude.js';
import {analisarCodigoEstatico,auditarCodigoPublicado} from './auditoria-codigo.js';
import {montarRelatorioFinanceiro} from './relatorio-pdf-conteudo.js';
import {avaliarRequisitosProposta,REQUISITOS_PROPOSTA} from './diagnostico-proposta.js';
import {calcularSaldoDisponivelHoje} from './resumo.js';
import {validarFraseLimpeza,apagarDadosLocais} from './limpeza-dados.js';

// Único ponto de registro; CI exige cobertura para cada arquivo em modules/.
export function registrarModulosDoApp(api) {
  const {dialogos,moduloResumo,moduloLancamentos,moduloObjetivos,moduloBackup,moduloCsv,
    atualizador,ajustes,limpeza,preferencias,notificacoes,relatorioPdf,moduloSaude,regras,logger,diagnostico} = api;
  const registrar=(nome,teste)=>registrarModuloDiagnostico(nome,teste);
  registrar('resumo',()=>typeof moduloResumo.renderSummary==='function'&&
    calcularSaldoDisponivelHoje([{type:'income',amount:100,date:'2026-02-01'},
      {type:'expense',amount:40,date:'2026-02-02'},
      {type:'expense',amount:20,date:'2026-02-20'}],'2026-02-10')===60);
  registrar('lancamentos',()=>typeof moduloLancamentos.renderTransactions==='function'&&typeof moduloLancamentos.openTransaction==='function');
  registrar('objetivos',()=>typeof moduloObjetivos.renderGoals==='function'&&typeof moduloObjetivos.openGoal==='function');
  registrar('backup',()=>typeof moduloBackup.folderBackup?.getState==='function');
  registrar('csv-interface',()=>typeof moduloCsv==='function');
  registrar('atualizador',()=>typeof atualizador.getStatus==='function'&&/^v\d+$/.test(atualizador.getStatus().versaoEmExecucao));
  registrar('ajustes',()=>typeof ajustes.abrir==='function'&&typeof ajustes.aplicar==='function');
  registrar('limpeza-dados',()=>typeof limpeza.abrir==='function'&&typeof apagarDadosLocais==='function'&&
    validarFraseLimpeza('APAGAR')&&!validarFraseLimpeza('apagar')&&!validarFraseLimpeza('APAGAR ')&&
    typeof moduloBackup.folderBackup?.pause==='function');
  registrar('notificacoes',()=>typeof notificacoes.pendentes==='function'&&Array.isArray(notificacoes.pendentes())&&
    Number.isSafeInteger(notificacoes.getStatus().ocultas));
  registrar('saude',()=>typeof moduloSaude.renderSaude==='function'&&typeof moduloSaude.calcular==='function'&&
    calcularSaudeFinanceira({renda:100,despesas:85,saldo:15,reserva:300,despesasPeriodo:90,diasPeriodo:30}).situacao==='crescendo');
  registrar('auditoria-codigo',()=>typeof auditarCodigoPublicado==='function'&&
    analisarCodigoEstatico({fontesCss:{'teste.css':'.sem-uso{}'},fontesJs:{'teste.js':'function usada(){} usada();'}}).cssNaoUsados.length===1);
  registrar('relatorio-pdf',()=>typeof relatorioPdf.imprimir==='function'&&Boolean(document.getElementById('export-pdf')));
  registrar('relatorio-pdf-conteudo',()=>montarRelatorioFinanceiro({visao:'resumo',mes:'2026-11',
    mesExtenso:'novembro de 2026',transacoes:[{type:'expense',amount:10,category:'Teste',description:'Exemplo',date:'2026-11-01'}],
    money:n=>String(n)}).includes('Despesas por categoria'));
  registrar('preferencias',()=>['auto','claro','escuro'].includes(preferencias.obter().tema));
  registrar('regras-financeiras',()=>regras.calcularAporte({type:'income',category:'Salário base',amount:100},{percentual:10,categoriasAporte:['Salário base']})===10);
  registrar('log',()=>Array.isArray(logger.obterLogs()));
  registrar('dialogos',()=>typeof dialogos.confirmar==='function'&&typeof dialogos.informar==='function');
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
