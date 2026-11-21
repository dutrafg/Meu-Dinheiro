/* Informa a versão da prévia sem alterar a versão do núcleo/SW publicado. */
(function(){
  'use strict';
  const label=document.getElementById('app-running-version');
  if(!label)return;
  label.textContent=label.textContent.replace('Prévia visual v35','Prévia visual v36');
})();
