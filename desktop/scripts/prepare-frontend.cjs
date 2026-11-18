const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '../..');
const source = path.join(root, 'dist');
const output = path.join(root, 'desktop', 'frontend');

function replaceOnce(text, before, after, file) {
  const first = text.indexOf(before);
  if (first < 0 || text.indexOf(before, first + before.length) >= 0) {
    throw new Error(`Ponto de integração alterado: ${file} (${before.slice(0, 45)})`);
  }
  return text.slice(0, first) + after + text.slice(first + before.length);
}

function prepare() {
  if (!fs.existsSync(path.join(source, 'app.js'))) throw new Error('PWA original não encontrado.');
  // A pasta frontend é gerada; o PWA em dist/ nunca é modificado.
  fs.rmSync(output, {recursive: true, force: true});
  fs.cpSync(source, output, {recursive: true});

  let html = fs.readFileSync(path.join(output, 'index.html'), 'utf8');
  html = replaceOnce(html, '<script src="./app.js" defer></script>',
    '<script src="./native-bridge.js" defer></script>\n  <script src="./app.js" defer></script>', 'index.html');
  html = replaceOnce(html, '<link rel="manifest" href="./manifest.webmanifest" />',
    '<link rel="stylesheet" href="./native-style.css" />', 'index.html');
  fs.writeFileSync(path.join(output, 'index.html'), html);

  let app = fs.readFileSync(path.join(output, 'app.js'), 'utf8');
  app = replaceOnce(app, '(() => {', '(async () => {', 'app.js');
  app = replaceOnce(app, '  let data = readData();', `  try {
    await window.MeuDinheiroNativeBridge.boot();
  } catch (error) {
    document.getElementById('main-content').innerHTML = '<section class="card native-fatal"><h2>Não foi possível abrir o banco de dados</h2><p>Seus dados não foram apagados. Feche e reabra o aplicativo ou restaure o backup.</p></section>';
    console.error('Banco nativo indisponível:', error);
    return;
  }
  let data = readData();`, 'app.js');
  app = replaceOnce(app, '      localStorage.setItem(KEY, JSON.stringify(next));',
    '      window.MeuDinheiroNativeBridge.stage(next);\n      localStorage.setItem(KEY, JSON.stringify(next));', 'app.js');
  app = replaceOnce(app, '      folderBackup?.schedule();',
    '      window.MeuDinheiroNativeBridge.persist(next);\n      folderBackup?.schedule();', 'app.js');
  app = replaceOnce(app, '  folderBackup=window.MeuDinheiroFolderBackup.createBrowserManager({',
    '  folderBackup=window.MeuDinheiroNativeBridge.createFolderManager({', 'app.js');
  app = replaceOnce(app,
    "  if('serviceWorker' in navigator)window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(()=>{}));",
    '  // O instalador Windows recebe novas versões; não registrar service worker.', 'app.js');
  fs.writeFileSync(path.join(output, 'app.js'), app);
  fs.copyFileSync(path.join(root, 'desktop/native-bridge.js'), path.join(output, 'native-bridge.js'));
  fs.copyFileSync(path.join(root, 'desktop/native-style.css'), path.join(output, 'native-style.css'));
  return output;
}

if (require.main === module) console.log('Frontend Windows preparado:', prepare());
module.exports = {prepare, replaceOnce};
