/* Backup automático opcional: os dados nunca saem do dispositivo. */
(function (root) {
  'use strict';
  const FILE = 'meu-dinheiro-dados.json';
  const HISTORY = 'historico';
  const FIELDS = ['transactions', 'goals', 'allocations', 'completedAportes'];

  function sameData(saved, current) {
    return saved && saved.app === 'meu-dinheiro-essencial' && saved.version === 1 &&
      FIELDS.every(field => JSON.stringify(saved[field] || []) === JSON.stringify(current[field] || []));
  }
  function parseExisting(text) {
    try {
      const value = JSON.parse(text);
      if (!value || value.app !== 'meu-dinheiro-essencial' || value.version !== 1 ||
          !Array.isArray(value.transactions) || !Array.isArray(value.goals)) throw Error();
      return value;
    } catch (_) {
      throw new Error('A pasta contém um arquivo de dados incompatível. Escolha outra pasta para não sobrescrevê-lo.');
    }
  }
  function timestamp(date) {
    return date.toISOString().replace(/[:.]/g, '-');
  }
  async function readExisting(directory) {
    let file;
    try { file = await directory.getFileHandle(FILE); }
    catch (error) { if (error.name === 'NotFoundError') return null; throw error; }
    return (await file.getFile()).text();
  }
  async function writeFile(file, content) {
    const writable = await file.createWritable();
    try { await writable.write(content); await writable.close(); }
    catch (error) { try { await writable.abort(); } catch (_) {} throw error; }
  }

  function browserHandleStore(indexedDB) {
    function database() {
      return new Promise((resolve, reject) => {
        const req = indexedDB.open('meu-dinheiro-pasta-v1', 1);
        req.onupgradeneeded = () => { if (!req.result.objectStoreNames.contains('config')) req.result.createObjectStore('config'); };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error || Error('IndexedDB indisponível'));
      });
    }
    async function access(mode, value) {
      const db = await database();
      try {
        return await new Promise((resolve, reject) => {
          const tx = db.transaction('config', mode);
          const req = mode === 'readonly' ? tx.objectStore('config').get('pasta') : tx.objectStore('config').put(value, 'pasta');
          req.onsuccess = () => resolve(req.result);
          req.onerror = () => reject(req.error || Error('Não foi possível memorizar a pasta'));
          tx.onabort = () => reject(tx.error || Error('Falha no armazenamento da pasta'));
        });
      } finally { db.close(); }
    }
    return { load: () => access('readonly'), save: handle => access('readwrite', handle) };
  }

  function createManager(options) {
    const {
      chooseDirectory, store, getSnapshot, confirmReplace, onStatus,
      now = () => new Date(), defer = (fn, delay) => setTimeout(fn, delay), cancelDefer = clearTimeout
    } = options;
    let directory = null;
    let lastWritten = null;
    let state = 'off';
    let timer = null;
    let pending = 0;
    let completed = 0;
    let writing = null;
    let lastSavedAt = null;
    const status = (code, message) => { state = code; onStatus?.({code, message, folder: directory?.name || '', lastSavedAt}); };
    const snapshot = () => JSON.stringify({...getSnapshot(), exportedAt:now().toISOString()}, null, 2);

    async function permission(handle) {
      return (await handle.queryPermission({mode:'readwrite'})) === 'granted';
    }
    async function protectExisting(handle, ask) {
      const text = await readExisting(handle);
      if (text !== null && !sameData(parseExisting(text), getSnapshot())) {
        if (!ask || !confirmReplace('Esta pasta já tem dados diferentes do aplicativo. Deseja guardar uma cópia do arquivo antigo e substituí-lo pelos dados atuais?')) return {allowed:false};
        const history = await handle.getDirectoryHandle(HISTORY, {create:true});
        const old = await history.getFileHandle(`meu-dinheiro-anterior-${timestamp(now())}.json`, {create:true});
        await writeFile(old, text);
      }
      return {allowed:true, text};
    }
    async function initialize() {
      if (!store || !chooseDirectory) { status('unsupported', 'Este navegador não permite salvar diretamente em pastas. Use o backup JSON.'); return; }
      try {
        const saved = await store.load();
        if (!saved) { status('off', 'Escolha uma pasta para ativar o backup automático.'); return; }
        directory = saved;
        if (!await permission(directory)) { status('permission', 'Autorize novamente o acesso para continuar salvando.'); return; }
        const checked = await protectExisting(directory, false);
        if (!checked.allowed) { status('conflict', 'A pasta contém dados diferentes. Restaure o JSON ou selecione a pasta novamente para escolher o que manter.'); return; }
        lastWritten = checked.text;
        status('ready', 'Pasta conectada. As próximas alterações serão salvas automaticamente.');
      } catch (error) { status('error', error.message || 'Não foi possível verificar a pasta.'); }
    }
    async function connect() {
      if (!chooseDirectory || !store) { status('unsupported', 'Seleção de pasta indisponível neste navegador.'); return false; }
      let selected;
      try {
        // O seletor deve ser chamado diretamente a partir do clique do usuário.
        selected = await chooseDirectory();
        if (!await permission(selected)) {
          status('permission', 'Não foi concedida permissão de escrita para a pasta.');
          return false;
        }
        const checked = await protectExisting(selected, true);
        if (!checked.allowed) return false;
        await store.save(selected);
        directory = selected;
        lastWritten = checked.text;
        state = 'ready';
        pending++;
        return await flush();
      } catch (error) {
        if (error?.name === 'AbortError') return false;
        status('error', error.message || 'Não foi possível conectar a pasta.');
        return false;
      }
    }
    async function reauthorize() {
      if (!directory) return connect();
      try {
        if (!await permission(directory) && (await directory.requestPermission({mode:'readwrite'})) !== 'granted') {
          status('permission', 'A pasta continua sem permissão de escrita.');
          return false;
        }
        const checked = await protectExisting(directory, true);
        if (!checked.allowed) return false;
        lastWritten = checked.text;
        state = 'ready';
        pending++;
        return await flush();
      } catch (error) { status('error', error.message || 'Não foi possível reautorizar a pasta.'); return false; }
    }
    async function writeSnapshot() {
      if (!await permission(directory)) { status('permission', 'Permissão para gravar na pasta expirou. Reautorize no menu de backup.'); return false; }
      const current = await readExisting(directory);
      if (current !== lastWritten) {
        status('conflict', 'O arquivo foi alterado fora do aplicativo. Nenhum dado foi sobrescrito. Verifique o backup antes de reconectar.');
        return false;
      }
      const content = snapshot();
      status('saving', 'Salvando alterações na pasta…');
      await writeFile(await directory.getFileHandle(FILE, {create:true}), content);
      lastWritten = content;
      const history = await directory.getDirectoryHandle(HISTORY, {create:true});
      const filename = `meu-dinheiro-${now().toISOString().slice(0,10)}.json`;
      await writeFile(await history.getFileHandle(filename, {create:true}), content);
      lastSavedAt = now();
      status('saved', 'Dados salvos automaticamente nesta pasta.');
      return true;
    }
    async function flush() {
      if (writing) { await writing; if (pending <= completed) return true; }
      if (!directory || !['ready','saved','saving'].includes(state)) return false;
      const work = (async () => {
        try {
          while (completed < pending) {
            const version = pending;
            if (!await writeSnapshot()) return false;
            completed = version;
          }
          return true;
        } catch (error) {
          status('error', error.message || 'Falha ao gravar o backup. Os dados continuam guardados no navegador.');
          return false;
        }
      })();
      writing = work;
      try { return await work; }
      finally { if (writing === work) writing = null; }
    }
    function schedule() {
      if (!directory || !['ready','saved','saving'].includes(state)) return;
      pending++;
      if (timer !== null) cancelDefer(timer);
      timer = defer(() => { timer = null; void flush(); }, 350);
    }
    async function saveNow() {
      if (timer !== null) { cancelDefer(timer); timer = null; }
      pending++;
      return flush();
    }
    return {initialize, connect, reauthorize, schedule, saveNow, getState:()=>({state,folder:directory?.name||'',lastSavedAt})};
  }

  function createBrowserManager({getSnapshot,confirmReplace,onStatus}) {
    return createManager({
      chooseDirectory: typeof root.showDirectoryPicker === 'function' ? () => root.showDirectoryPicker({id:'meu-dinheiro',mode:'readwrite'}) : null,
      store: root.indexedDB ? browserHandleStore(root.indexedDB) : null,
      getSnapshot, confirmReplace, onStatus
    });
  }
  const api = {createManager,createBrowserManager,sameData,parseExisting,FILE};
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.MeuDinheiroFolderBackup = api;
})(typeof window === 'object' ? window : globalThis);
