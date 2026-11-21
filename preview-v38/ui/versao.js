/* A prévia v38 mantém o identificador do motor PWA e indica a camada visual em separado. */
(function(){
  'use strict';
  const label=document.getElementById('app-running-version');
  if(label)label.textContent=label.textContent.replace('Prévia visual v37','Prévia visual v38');
})();
