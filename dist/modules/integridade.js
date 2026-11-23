import { normalizarDadosLocais, validarDataISO } from './validacao.js';

// Verificações somente leitura: nunca corrigem dados financeiros silenciosamente.
export function verificarIntegridade(dados, categorias) {
  const itens = [];
  const adicionar = (codigo, estado, descricao) => itens.push({codigo,estado,descricao});
  try { normalizarDadosLocais(dados); adicionar('ESTRUTURA_DADOS','ok','Estrutura financeira e datas válidas'); }
  catch { adicionar('ESTRUTURA_DADOS','erro','Existem registros inválidos ou incompletos'); }

  const lancamentos = Array.isArray(dados?.transactions) ? dados.transactions : [];
  const metas = Array.isArray(dados?.goals) ? dados.goals : [];
  const aplicacoes = Array.isArray(dados?.allocations) ? dados.allocations : [];
  const compromissos = Array.isArray(dados?.commitments) ? dados.commitments : [];
  const ids = [...lancamentos,...aplicacoes].map(item=>item?.id);
  const idMetas = metas.map(item=>item?.id);
  const duplicados = new Set(ids).size !== ids.length || new Set(idMetas).size !== idMetas.length;
  adicionar('IDENTIFICADORES',duplicados?'erro':'ok',duplicados?'Identificadores duplicados detectados':'Identificadores sem duplicidade');

  const categoriasAntigas = lancamentos.filter(item=>item && !categorias?.[item.type]?.includes(item.category)).length;
  adicionar('CATEGORIAS',categoriasAntigas?'aviso':'ok',categoriasAntigas?'Alguns lançamentos usam categorias não reconhecidas':'Categorias reconhecidas');
  const goalIds = new Set(metas.map(item=>item?.id));
  const vinculosInvalidos = aplicacoes.filter(item=>item?.goalId && !goalIds.has(item.goalId)).length;
  adicionar('VINCULOS',vinculosInvalidos?'aviso':'ok',vinculosInvalidos?'Existem aplicações vinculadas a metas ausentes':'Vínculos entre aplicações e metas consistentes');
  const tiposIncompativeis=aplicacoes.some(a=>{
    const g=metas.find(g=>g?.id===a?.goalId);
    return g&&(a.kind==='dream'?g.kind!=='dream':g.kind!=='goal');
  });
  adicionar('VINCULOS_TIPO',tiposIncompativeis?'erro':'ok',tiposIncompativeis?'Aplicação vinculada a objetivo de tipo incompatível':'Tipos de aplicações e objetivos vinculados compatíveis');

  // Verificações independentes: uma falha não esconde o resultado das demais.
  const conferir=(codigo,correto,descricao,problema,estado='erro')=>adicionar(codigo,correto?'ok':estado,correto?descricao:problema);
  const array=(value)=>Array.isArray(value);
  conferir('LISTA_LANCAMENTOS',array(dados?.transactions),'Lista de lançamentos disponível','Lista de lançamentos ausente');
  conferir('LISTA_METAS',array(dados?.goals),'Lista de metas disponível','Lista de metas ausente');
  conferir('LISTA_APLICACOES',array(dados?.allocations),'Lista de aplicações disponível','Lista de aplicações inválida');
  conferir('LISTA_LEMBRETES',array(dados?.completedAportes),'Lista de lembretes disponível','Lista de lembretes inválida');
  conferir('LISTA_COMPROMISSOS',dados?.commitments===undefined||array(dados.commitments),'Lista de compromissos disponível ou compatível com versão antiga','Lista de compromissos inválida');
  conferir('TIPOS_LANCAMENTOS',lancamentos.every(t=>t&&['income','expense'].includes(t.type)),'Tipos de lançamentos válidos','Há tipos de lançamento desconhecidos');
  conferir('VALORES_LANCAMENTOS',lancamentos.every(t=>t&&Number.isFinite(t.amount)&&t.amount>0&&t.amount<=999999999),'Valores de lançamentos válidos','Há lançamentos com valores inválidos');
  conferir('DATAS_LANCAMENTOS',lancamentos.every(t=>t&&validarDataISO(t.date)),'Datas de lançamentos válidas','Há datas impossíveis em lançamentos');
  conferir('RECORRENCIAS',lancamentos.every(t=>t&&typeof t.recurring==='boolean'),'Recorrências com formato válido','Há recorrências com tipo incorreto');
  conferir('CRIACAO_LANCAMENTOS',lancamentos.every(t=>t&&typeof t.createdAt==='string'&&!Number.isNaN(Date.parse(t.createdAt))),'Datas de cadastro interpretáveis','Há datas de cadastro inválidas');
  conferir('DESCRICOES_LANCAMENTOS',lancamentos.every(t=>t&&typeof t.description==='string'&&t.description.trim().length>0&&t.description.length<=80),'Descrições de lançamentos preenchidas','Há descrições incompletas');
  conferir('TIPOS_METAS',metas.every(g=>g&&['goal','dream'].includes(g.kind)),'Tipos de objetivos válidos','Há tipos de objetivo inválidos');
  conferir('VALORES_METAS',metas.every(g=>g&&Number.isFinite(g.target)&&g.target>0&&Number.isFinite(g.saved)&&g.saved>=0),'Valores de metas válidos','Há metas com valores inválidos');
  conferir('PRAZOS_METAS',metas.every(g=>g&&(!g.deadline||validarDataISO(g.deadline))),'Prazos de metas válidos','Há prazos inválidos');
  conferir('IDENTIFICADORES_METAS',new Set(idMetas).size===idMetas.length,'IDs de metas sem duplicidade','Há metas com ID repetido');
  conferir('VALORES_APLICACOES',aplicacoes.every(a=>a&&Number.isFinite(a.amount)&&Math.abs(a.amount)<=999999999),'Valores das aplicações válidos','Há aplicações com valores inválidos');
  conferir('DATAS_APLICACOES',aplicacoes.every(a=>a&&validarDataISO(a.date)),'Datas de aplicações válidas','Há aplicações com datas inválidas');
  conferir('TIPOS_APLICACOES',aplicacoes.every(a=>a&&['goal','reserve','dream'].includes(a.kind)),'Tipos de aplicações válidos','Há aplicações com tipo inválido');
  conferir('REFERENCIAS_APLICACOES',aplicacoes.every(a=>a&&typeof a.goalId==='string'),'Referências de aplicações bem formadas','Há referências de aplicação inválidas');
  const concluidos=array(dados?.completedAportes)?dados.completedAportes:[];
  conferir('IDS_LEMBRETES',new Set(concluidos).size===concluidos.length,'Lembretes concluídos sem duplicatas','Lembretes concluídos repetidos', 'aviso');
  conferir('FORMATO_LEMBRETES',concluidos.every(id=>typeof id==='string'&&id.length<=200&&/^.+@\d{4}-\d{2}-\d{2}$/.test(id)&&validarDataISO(id.slice(-10))),'Lembretes com datas válidas','Lembretes com formato de data inválido');
  conferir('VINCULOS_LEMBRETES',concluidos.every(id=>lancamentos.some(t=>t?.id===id.slice(0,-11)&&t.type==='income')),'Lembretes referenciam entradas existentes','Há lembretes de receitas excluídas','aviso');
  conferir('SOMAS_FINANCEIRAS',Number.isFinite(lancamentos.reduce((s,t)=>s+(Number(t?.amount)||0),0)),'Somas financeiras sem estouro numérico','Somas financeiras ultrapassam os limites');
  conferir('LIMITE_LANCAMENTOS',lancamentos.length<=20000,'Volume de lançamentos compatível com backup','Lançamentos acima do limite do backup','aviso');
  conferir('LIMITE_METAS',metas.length<=2000,'Volume de metas compatível com backup','Metas acima do limite do backup','aviso');
  conferir('LIMITE_APLICACOES',aplicacoes.length<=20000,'Volume de aplicações compatível com backup','Aplicações acima do limite do backup','aviso');
  conferir('LIMITE_COMPROMISSOS',compromissos.length<=1000,'Volume de compromissos compatível com backup','Compromissos acima do limite do backup','aviso');
  const pagamentos=lancamentos.filter(t=>t?.commitmentId!==undefined);
  conferir('PAGAMENTOS_COMPROMISSOS',new Set(pagamentos.map(t=>`${t.commitmentId}@${t.commitmentMonth}`)).size===pagamentos.length,
    'Pagamentos de compromissos sem duplicidade','Pagamentos de compromissos duplicados');
  const mesesPlanoValidos=pagamentos.every(t=>{
    const plano=compromissos.find(p=>p?.id===t.commitmentId);
    if(!plano)return true; // Excluir o planejamento não remove nem invalida o histórico.
    const [anoInicial,mesInicial]=plano.startMonth.split('-').map(Number);
    const [anoPago,mesPago]=String(t.commitmentMonth).split('-').map(Number);
    const posicao=(anoPago-anoInicial)*12+mesPago-mesInicial;
    return posicao>=0&&(plano.monthsCount===null||posicao<plano.monthsCount);
  });
  conferir('PAGAMENTOS_FORA_DO_PLANO',mesesPlanoValidos,
    'Pagamentos se referem a meses válidos de seus planos','Há pagamento em mês fora do intervalo cadastrado');
  // Riscos preventivos, separados de erros reais. Verificações não criam nem alteram lançamentos.
  const sobreposicao=compromissos.some(plano=>lancamentos.some(t=>t?.type==='expense'&&t.recurring===true&&
    t.description?.toLocaleLowerCase('pt-BR')===plano.name?.toLocaleLowerCase('pt-BR')&&
    Math.round(t.amount*100)===Math.round(plano.amount*100)));
  conferir('RISCO_PREVISAO_DUPLICADA',!sobreposicao,
    'Nenhuma possível sobreposição entre lançamento mensal e compromisso com mesmo nome e valor',
    'Risco preventivo: lançamento mensal e compromisso com mesmo nome e valor podem duplicar previsão','aviso');
  conferir('RISCO_LIMITE_COMPROMISSOS',compromissos.length<900,
    'Quantidade de compromissos abaixo de 90% do limite técnico',
    'Risco futuro: próximo do limite de 1000 compromissos; exporte um backup e revise cadastros','aviso');
  return {itens, erros:itens.filter(item=>item.estado==='erro').length, avisos:itens.filter(item=>item.estado==='aviso').length};
}
