# Regras de manutenção — Meu Dinheiro

Leia ARQUITETURA.md, DATABASE.md e os testes relacionados antes de modificar um módulo.

1. Trabalhe em branch própria; não publique/mescle em main sem autorização.
2. Corrija a causa de cada bug e adicione um teste de regressão com dados fictícios.
3. Evite reescrever módulos não relacionados. Use funções puras para regras de finanças; a interface nunca deve recalcular saldos de modo independente.
4. Preserve compatibilidade de backups, identificadores, recorrências, investimentos e preferências. Nenhuma alteração destrutiva automática de banco.
5. Todo arquivo novo em dist/modules/ deve estar em catalogo-diagnostico.js, registro-modulos.js, dist/sw.js e scripts/gerar-html-teste.cjs.
6. Toda atualização em arquivos do PWA precisa de versão sincronizada em dist/sw.js e dist/modules/atualizador.js.
7. Teste com node --test tests/*.test.cjs, node scripts/gerar-html-teste.cjs e os testes de navegador disponíveis.
8. Execute QA de dados, persistência, importação, backup/restauração, navegação e smartphone antes de propor merge.
9. Relatórios técnicos devem expor códigos e contagens, não valores financeiros, CPF, descrições, caminhos, extratos nem tokens.
10. Na ausência de execução real dos testes, declare a limitação; nunca descreva testes não executados como aprovados.
11. Use DATABASE.md para acompanhar a migração para IndexedDB. O espelho P0.1 NÃO é fonte primária.
12. Conserve um único botão para exportar o diagnóstico JSON.
