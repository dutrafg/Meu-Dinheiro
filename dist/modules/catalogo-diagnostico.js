// Inventário obrigatório: toda adição em dist/modules deve entrar aqui com teste real.
// O teste de arquitetura compara esta lista com o diretório inteiro, sem exceções.
export const MODULOS_OBRIGATORIOS = Object.freeze([
  'acao-rapida','ajustes','atualizador','auditoria-codigo','backup','calendario-financeiro','catalogo-diagnostico','categorias-brasileiras','ciclo-periodo','concorrencia-dados','csv-interface','diagnostico','diagnostico-proposta','dialogos','espelho-indexeddb',
  'integridade','investimentos','lancamentos','limpeza-dados','log','motor-financeiro','notificacoes','objetivos','preferencias','registro-modulos','regras-financeiras','relatorio-pdf','relatorio-pdf-conteudo','resumo','saude','validacao'
]);

const registros=new Map();
export function registrarModuloDiagnostico(nome,verificar) {
  if(!MODULOS_OBRIGATORIOS.includes(nome)||typeof verificar!=='function'||registros.has(nome))
    throw new Error('Registro de diagnóstico ausente, repetido ou inválido.');
  registros.set(nome,verificar);
}

export function executarVerificacoesModulos() {
  return MODULOS_OBRIGATORIOS.map(nome=>{
    if(!registros.has(nome))return {codigo:`MOD_${nome.toUpperCase().replaceAll('-','_')}`,modulo:nome,estado:'erro',descricao:`Módulo ${nome} sem registro obrigatório`};
    let ok=false;
    try {ok=registros.get(nome)()===true;} catch {ok=false;}
    return {codigo:`MOD_${nome.toUpperCase().replaceAll('-','_')}`,modulo:nome,estado:ok?'ok':'erro',descricao:ok?`Módulo ${nome} carregado e validado`:`Módulo ${nome} não passou na autoverificação`};
  });
}

export function totalRegistros() {return registros.size;}
