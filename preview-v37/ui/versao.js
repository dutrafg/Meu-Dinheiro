/* Diferencia a prévia v37 do núcleo financeiro, sem alterar atualização PWA. */
(function(){
  'use strict';
  const version=document.getElementById('app-running-version');
  if(version)version.textContent=version.textContent.replace('Prévia visual v36','Prévia visual v37');
})();
