// Verifica novas versões do PWA e só ativa uma versão em espera após consentimento.
// Este número identifica o código da página aberta, não o Service Worker em espera.
export const VERSAO_EM_EXECUCAO = 'v29';
export function iniciarAtualizador({notify,registrar=()=>{}}) {
  const checkButton = document.getElementById('check-update');
  const installButton = document.getElementById('install-update');
  const status = document.getElementById('app-update-status');
  const alertBadge = document.getElementById('app-update-alert');
  const versaoElemento = document.getElementById('app-running-version');
  versaoElemento.textContent = VERSAO_EM_EXECUCAO;
  const INTERVALO_VERIFICACAO = 30 * 60 * 1000;
  let registration = null;
  let ultimaVerificacao = 0;
  let ativacaoSolicitada = false;
  let recarregando = false;
  let verificando = false;
  const observados = new WeakSet();

  function mostrarEstado(mensagem, estado='idle') {
    status.textContent = mensagem;
    status.dataset.state = estado;
  }

  function mostrarAtualizacao() {
    if (!registration?.waiting || !navigator.serviceWorker.controller) return false;
    installButton.classList.remove('hidden');
    alertBadge.classList.remove('hidden');
    if (status.dataset.state !== 'ready') notify('Nova versão disponível! Abra Ajustes para atualizar.');
    mostrarEstado('Nova versão pronta. Salve o que estiver editando e toque em Atualizar agora.', 'ready');
    return true;
  }

  function observarInstalacao(worker) {
    if (!worker || observados.has(worker)) return;
    observados.add(worker);
    const verificarEstado = () => {
      if (worker.state === 'installed') {
        if (!mostrarAtualizacao()) mostrarEstado('Aplicativo pronto para uso offline.');
      } else if (worker.state === 'redundant') {
        registrar('erro','PWA_INSTALACAO_FALHOU','pwa');
        mostrarEstado('A instalação da atualização falhou. Tente novamente.', 'error');
      } else if (worker.state === 'installing') {
        mostrarEstado('Preparando nova versão…');
      }
    };
    worker.addEventListener('statechange', verificarEstado);
    verificarEstado();
  }

  async function verificarAtualizacoes(manual=false) {
    if (!registration || verificando) return;
    if (!manual && Date.now() - ultimaVerificacao < INTERVALO_VERIFICACAO) return;
    if (mostrarAtualizacao()) return;
    verificando = true;
    ultimaVerificacao = Date.now();
    checkButton.disabled = true;
    mostrarEstado('Verificando atualizações…');
    try {
      await registration.update();
      observarInstalacao(registration.installing);
      if (!mostrarAtualizacao()) {
        mostrarEstado(registration.installing ? 'Baixando atualização…' : 'Você está usando a versão mais recente.');
      }
    } catch {
      registrar('aviso','PWA_VERIFICACAO_FALHOU','pwa');
      if (!mostrarAtualizacao()) mostrarEstado('Não foi possível verificar. Confira sua conexão e tente novamente.', 'error');
    } finally {
      verificando = false;
      checkButton.disabled = false;
    }
  }

  async function iniciar() {
    if (!('serviceWorker' in navigator) || location.protocol === 'file:') {
      mostrarEstado('Atualizações automáticas disponíveis no aplicativo publicado (HTTPS).');
      checkButton.disabled = true;
      return;
    }
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!ativacaoSolicitada || recarregando) return;
      recarregando = true;
      window.location.reload();
    });
    try {
      registration = await navigator.serviceWorker.register('./sw.js', {updateViaCache:'none'});
      registration.addEventListener('updatefound', () => observarInstalacao(registration.installing));
      observarInstalacao(registration.installing);
      if (!mostrarAtualizacao()) mostrarEstado('Atualizações automáticas ativadas.');
      await verificarAtualizacoes();
    } catch (error) {
      registrar('erro','PWA_REGISTRO_FALHOU','pwa');
      // Apenas o nome padronizado do erro: nunca registrar URL, caminho ou mensagem bruta.
      if(error?.name==='SecurityError')registrar('aviso','PWA_REGISTRO_SEGURANCA','pwa');
      else if(error?.name==='TypeError')registrar('aviso','PWA_REGISTRO_REDE_ARQUIVO','pwa');
      mostrarEstado(navigator.onLine===false?'Sem conexão para ativar atualizações. Tente novamente quando estiver online.':
        'Não foi possível ativar as atualizações. Confira o HTTPS, a conexão e tente novamente.', 'error');
    }
  }

  checkButton.addEventListener('click', () => {
    if (!registration) {
      void iniciar();
      return;
    }
    void verificarAtualizacoes(true);
  });
  installButton.addEventListener('click', () => {
    if (!registration?.waiting) return;
    ativacaoSolicitada = true;
    installButton.disabled = true;
    mostrarEstado('Instalando nova versão…');
    registration.waiting.postMessage({type:'SKIP_WAITING'});
  });
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) void verificarAtualizacoes();
  });
  window.addEventListener('online', () => void verificarAtualizacoes());
  window.setInterval(() => {
    if (!document.hidden) void verificarAtualizacoes();
  }, INTERVALO_VERIFICACAO);
  if (document.readyState === 'complete') void iniciar();
  else window.addEventListener('load', () => void iniciar(), {once:true});

  return {verificarAtualizacoes,getStatus:()=>({ultimaVerificacao,atualizacaoPendente:Boolean(registration?.waiting),versaoEmExecucao:VERSAO_EM_EXECUCAO})};
}
