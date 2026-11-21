// Compõe o HTML único v35 sobre a base funcional e testada da prévia v34.
const fs=require('node:fs');
const path=require('node:path');
const {execFileSync}=require('node:child_process');
const root=path.resolve(__dirname,'..');
const output=path.resolve(process.argv[2]||path.join(root,'..','Meu-Dinheiro-v35-Objetivos-Clean.html'));
execFileSync(process.execPath,[path.join(__dirname,'gerar-html-design-v34.cjs'),output],{stdio:'pipe'});
const load=name=>fs.readFileSync(path.join(root,'preview-v35',name),'utf8');
const protect=(source,tag)=>source.replace(new RegExp(`</${tag}`,'gi'),`<\\/${tag}`);
const js=['ui/ajustes-minimos.js','ui/objetivos-minimos.js','ui/diagnostico.js'];
let html=fs.readFileSync(output,'utf8');
html=html.replace('</head>',`<style id="design-v35-css">\n${protect(load('ui/styles.css'),'style')}\n</style>\n</head>`);
html=html.replace('</body>',`${js.map(name=>`<script data-preview-v35="${name}">\n${protect(load(name),'script')}\n</script>`).join('\n')}\n</body>`);
html=html.replace('<title>Meu Dinheiro — v34 Design e Contas Brasileiras</title>','<title>Meu Dinheiro — v35 Objetivos e Ajustes Clean</title>');
fs.writeFileSync(output,html);
console.log(`Prévia completa v35: ${output} (${Buffer.byteLength(html)} bytes)`);
