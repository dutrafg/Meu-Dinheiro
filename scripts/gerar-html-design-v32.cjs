// Gera HTML único para homologação da camada visual v32 com o motor completo v31.
// Nenhum módulo do PWA publicado é modificado por este processo.
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const output = path.resolve(process.argv[2] || path.join(root, '..', 'Meu-Dinheiro-v32-Design-Testes.html'));
execFileSync(process.execPath, [path.join(__dirname, 'gerar-html-teste.cjs'), output], { stdio: 'pipe' });

const preview = name => fs.readFileSync(path.join(root, 'preview-v32', name), 'utf8');
const css = preview('design.css').replace(/<\/style/gi, '<\\/style');
const domain = preview('domain.js').replace(/<\/script/gi, '<\\/script');
const script = preview('design.js').replace(/<\/script/gi, '<\\/script');

let html = fs.readFileSync(output, 'utf8');
if (!html.includes('</head>') || !html.includes('</body>')) throw new Error('HTML base incompleto.');
html = html.replace('</head>', `<style id="design-v32-css">\n${css}\n</style>\n</head>`);
html = html.replace('</body>', `<script id="design-v32-domain">\n${domain}\n</script>\n<script id="design-v32-interface">\n${script}\n</script>\n</body>`);
html = html.replace('<title>Meu Dinheiro</title>', '<title>Meu Dinheiro — Prévia de Design v32</title>');
fs.writeFileSync(output, html);
console.log(`Prévia completa v32: ${output} (${Buffer.byteLength(html)} bytes)`);
