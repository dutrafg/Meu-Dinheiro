# Meu Dinheiro — v37 Diagnóstico Unificado

O diagnóstico anterior tinha uma bateria principal e outras quatro telas/exports
adicionais (v33–v36). Agora todas as verificações são registradas em um catálogo
único, executadas na mesma rodada e exportadas em **um JSON**.

- O núcleo `dist/modules/diagnostico.js` recebe módulos por registro e agrega
  resultados num único `integridade.itens`, com códigos, estado e nome do módulo.
- A barra de progresso mantém animação de no máximo **25 segundos**, enquanto
  os testes de verdade são executados antes da animação. Nenhum teste é pulado
  por atingir o tempo visual.
- Os testes v33, v34, v35 e v36 continuam separados em seus arquivos originais,
  mas não criam painéis nem botões redundantes.
- A exportação em Ajustes inclui todas as verificações, erros, avisos e os
  complementos por módulo, sem descrições de transações, valores financeiros
  ou caminhos locais.
- Verificações antigas de v34 foram alinhadas à navegação atual: o calendário
  está dentro de Ajustes e a exportação é unificada.
- A própria central unificada registra mais oito testes `V37_*`.

Comandos:

`node --test tests/*.test.cjs`

`node scripts/gerar-html-design-v37.cjs Meu-Dinheiro-v37.html`

Prévia isolada em branch; a `main` e o aplicativo Windows não foram alterados.
