/* Ponte entre a interface PWA e o banco SQLite / diretórios nativos do Windows. */
(function (root) {
  'use strict';
  const KEY = 'meu-dinheiro-essencial:v1';
  const PENDING = 'meu-dinheiro-windows:pendente';
  const invoke = (command, args) => {
    if (!root.__TAURI__?.core?.invoke) throw new Error('Ponte nativa não disponível.');
    return root.__TAURI__.core.invoke(command, args);
  };
  let queue = Promise.resolve();
  let onBackupStatus = null;
  let warningShown = false;

  function warning(message) {
    let banner = document.getElementById('native-storage-alert');
    if (!banner) {
      banner = document.createElement('div');
      banner.id = 'native-storage-alert';
      banner.className = 'native-storage-alert';
      banner.setAttribute('role', 'alert');
      document.body.appendChild(banner);
    }
    banner.textContent = message;
    warningShown = true;
  }
  function clearWarning() {
    document.getElementById('native-storage-alert')?.remove();
    warningShown = false;
  }

  async function boot() {
    const fromDb = await invoke('load_data');
    if (fromDb) {
      const verified = JSON.parse(fromDb);
      if (!verified || !['transactions','goals','allocations','completedAportes'].every(field=>Array.isArray(verified[field]))) {
        throw new Error('O banco SQLite contém dados incompatíveis.');
      }
    }
    const staged = localStorage.getItem(PENDING);
    const cached = localStorage.getItem(KEY);
    let chosen = fromDb;
    if (staged && staged !== fromDb) {
      const recover = root.confirm('Uma gravação anterior no banco do Windows não foi concluída. Recuperar os últimos dados salvos na interface?');
      if (recover) {
        await invoke('save_data', {payload:staged});
        chosen = staged;
      }
      localStorage.removeItem(PENDING);
    } else if (staged) {
      localStorage.removeItem(PENDING);
    }
    if (!chosen && cached) {
      // Migração única do cache local da janela do aplicativo.
      const verified = JSON.parse(cached);
      if (!verified || !['transactions','goals','allocations','completedAportes'].every(field=>Array.isArray(verified[field]))) {
        throw new Error('Cache local incompatível; nenhum dado será sobrescrito.');
      }
      await invoke('save_data', {payload:cached});
      chosen = cached;
    }
    if (chosen) localStorage.setItem(KEY, chosen);
    else localStorage.removeItem(KEY);
  }

  function stage(next) {
    localStorage.setItem(PENDING, JSON.stringify(next));
  }
  function persist(next) {
    const payload = JSON.stringify(next);
    queue = queue.then(async () => {
      try {
        const response = await invoke('save_data', {payload});
        if (localStorage.getItem(PENDING) === payload) localStorage.removeItem(PENDING);
        if (warningShown) clearWarning();
        if (response?.code && response.code !== 'off') onBackupStatus?.(response);
      } catch (error) {
        console.error('Erro SQLite:', error);
        warning('Atenção: não foi possível gravar no banco SQLite. Os dados novos continuam nesta janela; verifique o armazenamento antes de fechar.');
      }
    });
    return queue;
  }

  function createFolderManager({confirmReplace, onStatus}) {
    let state = {code:'off',folder:'',message:'Escolha uma pasta para ativar o backup automático.'};
    onBackupStatus = update;
    function update(status) {
      state = status;
      onStatus?.(status);
    }
    async function action(command, args) {
      try {
        const result = await invoke(command, args);
        if (result) update(result);
        return result?.code === 'saved' || result?.code === 'ready';
      } catch (error) {
        update({code:'error',folder:state.folder,message:String(error)});
        return false;
      }
    }
    async function connect() {
      try {
        const selection = await invoke('select_backup_folder');
        if (!selection) return false;
        const allowReplace = !!selection.conflict && !!confirmReplace('A pasta já contém dados diferentes. Guardar uma cópia do arquivo anterior e substituí-lo?');
        if (selection.conflict && !allowReplace) return false;
        return action('activate_backup_folder', {allowReplace});
      } catch (error) {
        update({code:'error',folder:state.folder,message:String(error)});
        return false;
      }
    }
    async function reauthorize() {
      try {
        const result = await invoke('sync_backup');
        if (result.code !== 'conflict') {
          update(result);
          return result.code === 'saved';
        }
        update(result);
        if (!confirmReplace('O arquivo na pasta foi alterado. Fazer uma cópia do arquivo anterior e substituir pelo banco atual?')) return false;
        return action('resolve_backup_conflict');
      } catch (error) {
        update({code:'error',folder:state.folder,message:String(error)});
        return false;
      }
    }
    return {
      initialize: () => action('backup_status'),
      connect, reauthorize,
      schedule: () => {}, // save_data já sincroniza a pasta após salvar no SQLite.
      saveNow: () => action('sync_backup'),
      getState: () => ({state:state.code,folder:state.folder})
    };
  }
  root.MeuDinheiroNativeBridge = {boot, stage, persist, createFolderManager};
  if (typeof module !== 'undefined' && module.exports) module.exports = root.MeuDinheiroNativeBridge;
})(typeof window === 'object' ? window : globalThis);
