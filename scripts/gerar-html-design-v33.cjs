// Monta prévia v33 sobre v32 e motor v31: nenhum recurso externo necessário.
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const output = path.resolve(process.argv[2] || path.join(root, '..', 'Meu-Dinheiro-v33-Orcamento-Previsao-Testes.html'));
execFileSync(process.execPath, [path.join(__dirname, 'gerar-html-design-v32.cjs'), output], { stdio:'pipe' });

const source = filename => fs.readFileSync(path.join(root,'preview-v33',filename),'utf8');
const escape = (sourceText, tag) => sourceText.replace(new RegExp(`</${tag}`, 'gi'), `<\\/${tag}`);
const jsFiles = ['domain/orcamento.js','domain/previsao.js','ui/orcamento-previsao.js','ui/navegacao-hash.js','ui/diagnostico.js'];
const styles = escape(source('ui/styles.css'),'style');
let html = fs.readFileSync(output,'utf8');
html = html.replace('</head>', `<style id="design-v33-css">\n${styles}\n</style>\n</head>`);
html = html.replace('</body>', `${jsFiles.map(file=>`<script data-preview-v33="${file}">\n${escape(source(file),'script')}\n</script>`).join('\n')}\n</body>`);
html = html.replace('<title>Meu Dinheiro — Prévia de Design v32</title>', '<title>Meu Dinheiro — v33 Orçamento e Previsão</title>');
fs.writeFileSync(output,html);
console.log(`HTML completo v33 criado: ${output} (${Buffer.byteLength(html)} bytes)`);
