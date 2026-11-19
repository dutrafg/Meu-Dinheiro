// No Windows, o instalador NSIS substitui o Service Worker do navegador.
// Não simular uma atualização automática que o aplicativo ainda não suporta.
export function iniciarAtualizador() {
  const status=document.getElementById('app-update-status');
  const verificar=document.getElementById('check-update');
  const instalar=document.getElementById('install-update');
  const aviso=document.getElementById('app-update-alert');
  status.textContent='Windows: novas versões são instaladas com o arquivo .exe disponibilizado no GitHub.';
  status.dataset.state='idle';
  verificar.disabled=true;
  verificar.title='O Windows utiliza instalador próprio; a verificação automática ainda não foi implementada.';
  instalar.classList.add('hidden');
  aviso.classList.add('hidden');
  return {
    getStatus:()=>({ultimaVerificacao:0,atualizacaoPendente:false,metodo:'instalador-windows'})
  };
}
