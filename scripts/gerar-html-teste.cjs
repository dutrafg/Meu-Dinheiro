// Gera uma prévia independente, sem servidor ou imports de arquivos externos.
// O aplicativo publicado continua modular; este arquivo é apenas para homologação.
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..', 'dist');
const output = path.resolve(process.argv[2] || path.join(__dirname,'..','meu-dinheiro-teste.html'));
const read = filename => fs.readFileSync(path.join(root,filename),'utf8');

const cssFiles = ['styles.css','css/estrutura.css','css/resumo.css','css/previsoes.css','css/compromissos.css','css/relatorio-anual.css','css/desafio-52.css','css/calendario.css','css/saude.css','css/objetivos.css','css/investimentos.css','css/progresso.css','css/dialogos.css','css/acao-rapida-mobile.css','css/responsivo.css','css/ajustes.css','css/impressao.css'];
const jsFiles = ['csv.js','analytics.js','folder-backup.js',
  'modules/log.js','modules/validacao.js','modules/compromissos.js','modules/compromissos-interface.js','modules/preferencias.js','modules/regras-financeiras.js','modules/motor-financeiro.js','modules/dominio-objetivos.js','modules/dominio-investimentos.js','modules/categorias-brasileiras.js',
  'modules/integridade.js','modules/catalogo-diagnostico.js','modules/categorias-rapidas.js','modules/lancamentos.js','modules/objetivos.js','modules/investimentos.js','modules/calendario-financeiro.js',
  'modules/desafio-52.js','modules/orcamento.js','modules/previsoes.js','modules/relatorio-anual.js','modules/resumo.js','modules/saude.js','modules/notificacoes.js','modules/relatorio-pdf-conteudo.js','modules/relatorio-pdf.js','modules/dialogos.js','modules/backup.js','modules/csv-interface.js','modules/atualizador.js',
  'modules/ajustes.js','modules/acao-rapida.js','modules/limpeza-dados.js','modules/concorrencia-dados.js','modules/espelho-indexeddb.js','modules/recuperacao-conflitos.js','modules/ofx.js','modules/repositorio-financeiro.js','modules/ciclo-periodo.js','modules/auditoria-codigo.js','modules/diagnostico-proposta.js','modules/diagnostico.js','modules/registro-modulos.js','app.js'];

const css = cssFiles.map(filename=>`/* ${filename} */\n${read(filename)}`).join('\n');
const js = jsFiles.map(filename=>{
  const contents=read(filename);
  // Módulos nativos se tornam funções locais no HTML único, sem mudar seus corpos.
  const inline=contents.split('\n').filter(line=>!/^import\s/.test(line)&&!/^export\s*\{.*\}\s*from\s/.test(line)).join('\n').replace(/^export\s+/gm,'');
  return `// ${filename}\n${inline}`;
}).join('\n\n');

let html=read('index.html')
  .replace(/\s*<link rel="manifest"[^>]*>/,'')
  .replace(/\s*<link rel="icon"[^>]*>/,'')
  .replace(/\s*<link rel="apple-touch-icon"[^>]*>/,'')
  .replace(/\s*<link rel="stylesheet" href="\.\/styles\.css"\s*\/>/,'')
  .replace(/\s*<link rel="stylesheet" href="\.\/prototype\.css"\s*\/>/,'')
  .replace('</head>',()=>`  <style>\n${css.replace(/<\/style/gi,'<\\/style')}\n  </style>\n<style>
  #offline-validation-banner{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:12px;padding:12px 18px;background:#153f32;color:#f3fff9;font:500 14px/1.5 system-ui,sans-serif}
  #offline-validation-banner strong{color:#fff;font-weight:750}
  #offline-validation-banner button{border:1px solid #9ce7c5;background:#e3fff1;color:#13382d;padding:9px 15px;border-radius:11px;font:700 14px system-ui,sans-serif;cursor:pointer}
</style>\n</head>`);

const marker='<script type="module" src="./app.js"></script>';
if(!html.includes(marker))throw Error('Entrada JavaScript não localizada no HTML original.');
// Callback de replace impede que símbolos como $' no JavaScript sejam expandidos.
html=html.replace(marker,()=>`<script>\n${js.replace(/<\/script/gi,'<\\/script')}\n</script>`);
html=html.replace(/<body([^>]*)>/i,(_,atributos)=>`<body${atributos}>
  <aside id="offline-validation-banner" role="note">
    <span><strong>🧪 HTML completo para validação offline.</strong> Abra sem internet no celular ou PC; use apenas dados fictícios. Em Ajustes, confira os testes de diagnóstico.</span>
    <button type="button" id="offline-validation-run">Executar diagnóstico completo</button>
  </aside>`);
html=html.replace('</body>',()=>`<script>
  document.getElementById('offline-validation-run').addEventListener('click',()=>{
    document.getElementById('open-diagnostics').click();
  });
</script>\n</body>`);
fs.mkdirSync(path.dirname(output),{recursive:true});
fs.writeFileSync(output,html);
console.log(`Prévia HTML criada: ${output} (${Buffer.byteLength(html)} bytes)`);
