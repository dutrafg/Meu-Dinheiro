# Meu Dinheiro — Continuação v33 (homologação)

Esta etapa complementa a v32 com regras financeiras de **orçamento por categoria**
e **previsão do resultado mensal**, mantendo o motor financeiro v31 e os recursos
visuais da v32. Não migra o formato de dados v1, nem substitui o PWA publicado.

## Construção

```bash
node scripts/gerar-html-design-v33.cjs
node --test tests/*.test.cjs
```

O HTML único resultante abre sem servidor e embute todos os módulos, CSS, telas,
formulários, PDF, CSV, calendário, investimentos e diagnósticos já existentes.

## Módulos novos

| Arquivo | Responsabilidade |
| --- | --- |
| `domain/orcamento.js` | Centavos, validação, faixas de gasto e persistência isolada com revisão |
| `domain/previsao.js` | Fluxo de receitas e despesas por dia, resultado acumulado e fim do mês |
| `ui/orcamento-previsao.js` | Cards no Resumo, editor em Ajustes e menus, exportar/importar JSON |
| `ui/navegacao-hash.js` | Retorno e avanço entre telas pelo histórico do navegador |
| `ui/diagnostico.js` | 17 verificações extras e download de complemento JSON sem dados pessoais |
| `ui/styles.css` | Layout e estados dos componentes novos |

Os limites usam a chave local `meu-dinheiro-essencial:orcamentos:preview-v33`.
**Não fazem parte do backup v31**, por isso existe exportação e importação
independentes de orçamento JSON. Guardar esse segundo arquivo junto do backup
financeiro. Em caso de dados inválidos, a gravação dos limites é bloqueada;
os lançamentos originais continuam preservados.

Na tela de Resumo, os gastos do orçamento mostram somente os realizados **até
hoje**; compromissos futuros cadastrados aparecem separadamente. A previsão
mostra receitas menos despesas do mês **já cadastradas**, não saldo bancário
ou patrimônio. Aportes não são despesas e não entram nessa previsão.

## Próximas fases pendentes

- Migração idempotente v1 → v2/IndexedDB com backup reversível e revisão.
- Recorrências em série, categorias personalizadas e estado central.
- Cadastro rápido único e expansão do calendário.
- Cofre criptografado, PIN/WebAuthn, CSV com regras aprendidas e PDF avançado.
- Integração definitiva do complemento ao relatório principal de diagnóstico.

Não publicar na `main` antes de validar o HTML no Android e no Windows.
