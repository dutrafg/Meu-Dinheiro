// Telemetria exclusivamente local: apenas códigos predefinidos, nunca dados do usuário.
const CHAVE = 'meu-dinheiro-essencial:diagnostico-sessao';
const MAXIMO = 50;
const NIVEIS = new Set(['erro', 'aviso', 'info', 'evento']);
const MODULOS = new Set(['dados', 'backup', 'csv', 'pwa', 'interface', 'integridade', 'sistema']);
const CODIGO = /^[A-Z][A-Z0-9_]{2,49}$/;

function entradaValida(item) {
  return item && typeof item.t === 'string' && /^\d{4}-\d\d-\d\dT/.test(item.t) &&
    item.t.length <= 30 && NIVEIS.has(item.nivel) && MODULOS.has(item.modulo) &&
    typeof item.codigo === 'string' && CODIGO.test(item.codigo);
}

function lerSessao() {
  try {
    const valor = JSON.parse(sessionStorage.getItem(CHAVE) || '[]');
    return Array.isArray(valor) ? valor.filter(entradaValida).slice(-MAXIMO).map(({t,nivel,codigo,modulo})=>({t,nivel,codigo,modulo})) : [];
  } catch { return []; }
}

let buffer = lerSessao();
let detalhado = false;

function salvarSessao() {
  try { sessionStorage.setItem(CHAVE,JSON.stringify(buffer)); }
  catch { /* O diagnóstico continua disponível em memória. */ }
}

export function registrar(nivel, codigo, modulo='sistema') {
  if (!NIVEIS.has(nivel) || !MODULOS.has(modulo) || typeof codigo !== 'string' || !CODIGO.test(codigo)) return false;
  buffer.push({t:new Date().toISOString(),nivel,codigo,modulo});
  if (buffer.length > MAXIMO) buffer = buffer.slice(-MAXIMO);
  salvarSessao();
  return true;
}

export function registrarEvento(codigo, modulo='interface') {
  if (!detalhado) return false;
  return registrar('evento',codigo,modulo);
}

export function configurarDetalhado(ativo) { detalhado = ativo === true; }
export function modoDetalhado() { return detalhado; }
export function obterLogs() { return buffer.map(item=>({...item})); }

// Eventos globais são registrados sem mensagens, URLs, objetos de erro ou stack traces.
if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
  window.addEventListener('error',()=>{registrar('erro','ERRO_NAO_TRATADO','sistema');});
  window.addEventListener('unhandledrejection',()=>{registrar('erro','PROMESSA_NAO_TRATADA','sistema');});
}
