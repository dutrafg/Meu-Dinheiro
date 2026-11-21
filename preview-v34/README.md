# Prévia v34 — Meu Dinheiro

Esta é uma versão de testes separada da `main`. A versão de produção e o aplicativo Windows não são substituídos automaticamente.

## O que havia de diferente nas imagens

As cinco imagens anteriores eram propostas artísticas com saldos e transações fictícios. O HTML v32/v33 acrescentava funcionalidades à tela antiga v31, sem substituir a sua hierarquia visual. Isso explica por que o aplicativo real ainda tinha a rosca grande, os cartões antigos e o formulário numérico padrão.

## O que muda

- Uma composição de Resumo inspirada na referência, com saldo real até hoje, três indicadores, previsão diária, orçamento, vencimentos e metas. Os componentes anteriores ficam em **Detalhes e análises avançadas**.
- Cadastro de despesas com as contas brasileiras mais comuns, em seis grupos; orçamento por categoria usa exatamente o mesmo catálogo.
- Busca de categorias no orçamento; filtros de categoria e recorrência em Movimentos.
- Cadastro rápido com teclado visual, chips e data simplificada, sempre utilizando a validação e a gravação original da aplicação.
- Anéis de progresso para metas, sem alterar seus investimentos registrados.
- Testes adicionais v34 integrados ao Diagnóstico original. O teto de 25 segundos refere-se apenas à animação, não à execução dos testes.
- O calendário permanece fechado até tocar no mês ou em Calendário, como solicitado.

## Organização e execução

- `dist/modules/categorias-brasileiras.js`: catálogo central, registrado no diagnóstico da v31.
- `preview-v34/ui/resumo-fiel.js`, `cadastro-rapido.js`, `metas-fieis.js`, `diagnostico.js`: módulos isolados para esta prévia.
- `preview-v34/ui/styles.css`, `cadastro.css`, `metas.css`: estilos isolados para esta prévia.
- `scripts/gerar-html-design-v34.cjs`: monta os módulos num **único HTML que funciona sem internet**.
- `tests/design-v34.test.cjs`: regressões e contratos da prévia.

Para gerar o HTML: `node scripts/gerar-html-design-v34.cjs Meu-Dinheiro-v34.html`.

Para rodar as verificações estáticas e financeiras: `node --test tests/*.test.cjs`.

## Limites da prévia

O orçamento v33 continua armazenado separadamente do backup financeiro v1. Exporte também o orçamento pela tela de Ajustes. Os valores exibidos dependem exclusivamente dos seus lançamentos: não são usados dados demonstrativos. Esta prévia não foi publicada como PWA/Windows e requer homologação visual/interativa no dispositivo antes de promover à `main`.
