// Monta a prévia v34 fiel aos mockups, reaproveitando integralmente o HTML v33.
const fs=require('node:fs');
const path=require('node:path');
const {execFileSync}=require('node:child_process');
const root=path.resolve(__dirname,'..');
const output=path.resolve(process.argv[2]||path.join(root,'..','Meu-Dinheiro-v34-Contas-Brasileiras-Design.html'));
execFileSync(process.execPath,[path.join(__dirname,'gerar-html-design-v33.cjs'),output],{stdio:'pipe'});
const read=file=>fs.readFileSync(path.join(root,'preview-v34',file),'utf8');
const escape=(value,tag)=>value.replace(new RegExp(`</${tag}`,'gi'),`<\\/${tag}`);
const css=['ui/styles.css','ui/cadastro.css','ui/metas.css'].map(read).join('\n');
const scripts=['ui/resumo-fiel.js','ui/cadastro-rapido.js','ui/metas-fieis.js','ui/diagnostico.js'];
let html=fs.readFileSync(output,'utf8');
html=html.replace('</head>',`<style id="design-v34-css">\n${escape(css,'style')}\n</style>\n</head>`);
html=html.replace('</body>',`${scripts.map(name=>`<script data-preview-v34="${name}">\n${escape(read(name),'script')}\n</script>`).join('\n')}\n</body>`);
html=html.replace(/<title>Meu Dinheiro — v33 Orçamento e Previsão<\/title>/,'<title>Meu Dinheiro — v34 Design e Contas Brasileiras</title>');
fs.writeFileSync(output,html);
console.log(`Prévia completa v34: ${output} (${Buffer.byteLength(html)} bytes)`);
