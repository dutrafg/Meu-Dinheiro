const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');
const {execFileSync} = require('node:child_process');

test('HTML único de homologação contém os estilos e scripts sem dependências externas', () => {
  const temp=fs.mkdtempSync(path.join(os.tmpdir(),'meu-dinheiro-html-'));
  try {
    const output=path.join(temp,'teste.html');
    execFileSync(process.execPath,[path.join(__dirname,'..','scripts','gerar-html-teste.cjs'),output]);
    const html=fs.readFileSync(output,'utf8');
    assert.match(html, /<title>Meu Dinheiro<\/title>/);
    assert.doesNotMatch(html, /<script[^>]+src=/);
    assert.doesNotMatch(html, /<link[^>]+rel="stylesheet"/);
    for(const module of ['criarModuloResumo','criarModuloLancamentos','criarModuloObjetivos','iniciarModuloBackup','iniciarModuloCsv','iniciarAtualizador','validarBackup']) {
      assert.ok(html.includes(module),module);
    }
    const inline=html.match(/<script>([\s\S]*?)<\/script>/)?.[1];
    assert.ok(inline,'JavaScript inline ausente');
    new vm.Script(inline);
  } finally {
    fs.rmSync(temp,{recursive:true,force:true});
  }
});
