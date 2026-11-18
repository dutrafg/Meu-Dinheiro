# Meu Dinheiro

Aplicativo financeiro pessoal simples, responsivo e instalável como PWA (Progressive Web App), preparado para publicar na Vercel.

## Áreas do aplicativo

- **Resumo:** visão financeira, últimas transações e dois gráficos de gastos por categoria em um único card.
- **Renda:** salário base, Personal e demais entradas; lembretes de aporte de 10% para as duas fontes de salário.
- **Despesas:** lançamentos e categorias de gastos.
- **Metas:** reserva, objetivos de economia e estimativa ilustrativa de CDB a 100% do CDI a partir de dados do Banco Central.
- **Sonho:** acompanhamento de objetivos pessoais.

O aplicativo também oferece importação e exportação CSV, backup/restauração JSON e confirmação obrigatória de Reserva, Meta ou Sonho para aplicações identificadas no extrato bancário.

## Privacidade

Os lançamentos e lembretes ficam no armazenamento local do navegador. O código público **não contém extratos, saldos ou dados financeiros pessoais**. Os arquivos CSV e JSON são processados no dispositivo. Ao trocar de aparelho ou de domínio, use o backup JSON para transportar os dados.

## Executar e testar localmente

Requer Node.js para os testes e qualquer servidor de arquivos estáticos para abrir a PWA:

```bash
node --test tests/*.test.cjs
python -m http.server 4173 --directory dist
```

Acesse `http://localhost:4173`. O modo offline depende da instalação inicial do service worker, servido em `localhost` ou HTTPS.

## Publicação na Vercel

Conecte este repositório a um projeto Vercel com a branch de produção `main`. O arquivo `vercel.json` seleciona o conteúdo estático de `dist/`, sem etapa de compilação. Após a publicação HTTPS, o app pode ser instalado pelo navegador como PWA.

## Testes automáticos

Os testes são executados com `node --test tests/*.test.cjs`. O workflow do GitHub verifica o código em atualizações da branch `main` e em pull requests.
