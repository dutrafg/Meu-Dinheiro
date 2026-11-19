import {normalizarPreferencias} from './preferencias.js';

export function iniciarModuloBackup(ctx) {
  const {getData, getPreferences, salvarPreferencias, aplicarPreferencias, icon, isoDate, notify, persist, resetToSummary, validarBackup, CATEGORIES, confirmar, registrar, registrarEvento} = ctx;
  const backupButton=document.getElementById('backup-menu-button');
  const backupMenu=document.getElementById('backup-menu');
  const folderConnectButton=document.getElementById('folder-backup-connect');
  const folderReconnectButton=document.getElementById('folder-backup-reconnect');
  const folderStatus=document.getElementById('folder-backup-status');
  const folderAlert=document.getElementById('folder-backup-alert');
  let ultimoAlerta='';
  function hideBackupMenu() {
    backupMenu.classList.add('hidden');
    backupButton.setAttribute('aria-expanded','false');
  }
  const folderBackup=window.MeuDinheiroFolderBackup.createBrowserManager({
    getSnapshot:()=>{
      const data=getData();
      return {app:'meu-dinheiro-essencial',version:1,transactions:data.transactions,goals:data.goals,allocations:data.allocations||[],completedAportes:data.completedAportes||[],preferences:getPreferences()};
    },
    confirmReplace:message=>confirmar({titulo:'Proteger backup existente',mensagem:message,acao:'Guardar cópia e substituir',perigoso:true}),
    onStatus:({code,message,folder})=>{
      folderStatus.dataset.state=code;
      folderStatus.textContent=folder?`${folder} · ${message}`:message;
      folderConnectButton.innerHTML=`${icon('folder')}${folder?' Trocar pasta':' Escolher pasta de dados'}`;
      folderReconnectButton.classList.toggle('hidden',!['permission','conflict','error'].includes(code)||!folder);
      folderAlert.classList.toggle('hidden',!['permission','conflict','error'].includes(code));
      if(['permission','conflict','error'].includes(code)) {
        if(ultimoAlerta!==code){
          registrar(code==='error'?'erro':'aviso',`BACKUP_${code.toUpperCase()}`,'backup');
          notify('Atenção: o backup em pasta precisa de verificação. Abra Ajustes.');
        }
        ultimoAlerta=code;
      } else if(['saved','ready'].includes(code)) ultimoAlerta='';
    }
  });
  void folderBackup.initialize();
  folderConnectButton.addEventListener('click',async()=>{
    registrarEvento('CONECTAR_PASTA','backup');
    hideBackupMenu();
    const result=await folderBackup.connect();
    if(result)notify('Pasta conectada. Backup automático ativado.');
    else if(folderBackup.getState().state==='error')notify('Erro ao conectar a pasta. Confira o menu de backup.');
  });
  folderReconnectButton.addEventListener('click',async()=>{
    registrarEvento('REAUTORIZAR_PASTA','backup');
    hideBackupMenu();
    const result=await folderBackup.reauthorize();
    notify(result?'Backup na pasta atualizado.':'Não foi possível salvar na pasta. Confira as permissões.');
  });
  backupButton.addEventListener('click',()=>{const show=backupMenu.classList.toggle('hidden')===false;backupButton.setAttribute('aria-expanded',show?'true':'false');});
  document.addEventListener('click',event=>{if(!event.target.closest('#backup-menu')&&!event.target.closest('#backup-menu-button')){backupMenu.classList.add('hidden');backupButton.setAttribute('aria-expanded','false');}});
  document.getElementById('export-data').addEventListener('click',()=>{
    const data=getData();
    const contents=JSON.stringify({app:'meu-dinheiro-essencial',version:1,exportedAt:new Date().toISOString(),...data,preferences:getPreferences()},null,2);
    const url=URL.createObjectURL(new Blob([contents],{type:'application/json'}));
    const a=document.createElement('a');a.href=url;a.download=`meu-dinheiro-backup-${isoDate(new Date())}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),30000);
    backupMenu.classList.add('hidden');backupButton.setAttribute('aria-expanded','false');notify('Backup gerado. Guarde o arquivo em local seguro.');
  });
  document.getElementById('import-data').addEventListener('click',()=>{document.getElementById('import-file').click();backupMenu.classList.add('hidden');backupButton.setAttribute('aria-expanded','false');});
  document.getElementById('import-file').addEventListener('change',async event=>{
    const file=event.target.files?.[0];event.target.value='';if(!file)return;
    if(file.size>5*1024*1024){registrar('aviso','BACKUP_ARQUIVO_GRANDE','backup');notify('Arquivo muito grande (limite: 5 MB).');return;}
    try{
      const arquivo=JSON.parse(await file.text());
      const incoming=validarBackup(arquivo,CATEGORIES);
      if(arquivo.preferences!==undefined && JSON.stringify(arquivo.preferences).length>8192)throw Error('Preferências excessivas');
      if(!await confirmar({titulo:'Restaurar backup completo',mensagem:`Este backup contém ${incoming.transactions.length} lançamentos e ${incoming.goals.length} objetivos. Deseja substituir todos os dados atuais?`,acao:'Restaurar dados',perigoso:true}))return;
      registrarEvento('RESTAURAR_BACKUP','backup');
      if(persist(incoming,{allowRecovery:true})){
        let preferenciaOk=true;
        if(arquivo.preferences!==undefined)preferenciaOk=salvarPreferencias(normalizarPreferencias(arquivo.preferences,CATEGORIES.income));
        if(arquivo.preferences!==undefined&&preferenciaOk)aplicarPreferencias();
        resetToSummary();
        notify(preferenciaOk?'Backup restaurado com sucesso.':'Dados restaurados. Não foi possível gravar as preferências.');
      }
    }catch{registrar('erro','BACKUP_IMPORTACAO_INVALIDA','backup');notify('Backup JSON inválido ou incompatível. Nenhum dado foi substituído.');}
  });
  return {folderBackup, hideBackupMenu};
}
