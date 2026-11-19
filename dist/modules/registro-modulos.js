import {registrarModuloDiagnostico,executarVerificacoesModulos,MODULOS_OBRIGATORIOS} from './catalogo-diagnostico.js';
import {verificarIntegridade} from './integridade.js';
import {validarDataISO} from './validacao.js';
import {calcularSaudeFinanceira} from './saude.js';
import {analisarCodigoEstatico,auditarCodigoPublicado} from './auditoria-codigo.js';

// Único ponto de registro; CI exige cobertura para cada arquivo em modules/.
export function registrarModulosDoApp(api) {
  const {dialogos,moduloResumo,moduloLancamentos,moduloObjetivos,moduloBackup,moduloCsv,
    atualizador,ajustes,preferencias,notificacoes,relatorioPdf,moduloSaude,regras,logger,diagnostico} = api;
  const registrar=(nome,teste)=>registrarModuloDiagnostico(nome,teste);
  registrar('resumo',()=>typeof moduloResumo.renderSummary==='function');
  registrar('lancamentos',()=>typeof moduloLancamentos.renderTransactions==='function'&&typeof moduloLancamentos.openTransaction==='function');
  registrar('objetivos',()=>typeof moduloObjetivos.renderGoals==='function'&&typeof moduloObjetivos.openGoal==='function');
  registrar('backup',()=>typeof moduloBackup.folderBackup?.getState==='function');
  registrar('csv-interface',()=>typeof moduloCsv==='function');
  registrar('atualizador',()=>typeof atualizador.getStatus==='function'&&/^v\d+$/.test(atualizador.getStatus().versaoEmExecucao));
  registrar('ajustes',()=>typeof ajustes.abrir==='function'&&typeof ajustes.aplicar==='function');
  registrar('notificacoes',()=>typeof notificacoes.pendentes==='function'&&Array.isArray(notificacoes.pendentes())&&
    Number.isSafeInteger(notificacoes.getStatus().ocultas));
  registrar('saude',()=>typeof moduloSaude.renderSaude==='function'&&typeof moduloSaude.calcular==='function'&&
    calcularSaudeFinanceira({renda:100,despesas:85,saldo:15,reserva:300,despesasPeriodo:90,diasPeriodo:30}).situacao==='crescendo');
  registrar('auditoria-codigo',()=>typeof auditarCodigoPublicado==='function'&&
    analisarCodigoEstatico({fontesCss:{'teste.css':'.sem-uso{}'},fontesJs:{'teste.js':'function usada(){} usada();'}}).cssNaoUsados.length===1);
  registrar('relatorio-pdf',()=>typeof relatorioPdf.imprimir==='function'&&Boolean(document.getElementById('export-pdf')));
  registrar('preferencias',()=>['auto','claro','escuro'].includes(preferencias.obter().tema));
  registrar('regras-financeiras',()=>regras.calcularAporte({type:'income',category:'Salário base',amount:100},{percentual:10,categoriasAporte:['Salário base']})===10);
  registrar('log',()=>Array.isArray(logger.obterLogs()));
  registrar('dialogos',()=>typeof dialogos.confirmar==='function'&&typeof dialogos.informar==='function');
  registrar('validacao',()=>validarDataISO('2024-02-29')&&!validarDataISO('2025-02-29'));
  registrar('integridade',()=>verificarIntegridade({transactions:[],goals:[],allocations:[],completedAportes:[]},{income:[],expense:[]}).erros===0);
  registrar('diagnostico',()=>typeof diagnostico.executar==='function');
  registrar('catalogo-diagnostico',()=>typeof executarVerificacoesModulos==='function'&&MODULOS_OBRIGATORIOS.length>0);
  registrar('registro-modulos',()=>typeof registrarModulosDoApp==='function');
}
