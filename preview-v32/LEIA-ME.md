# Prévia visual v32 — homologação sobre o motor v31

O plano de implementação original foi elaborado para a v30. A versão v31 já
possui proteção contra perdas de dados, calendário financeiro, investimentos
editáveis, relatórios e diagnósticos. Esta prévia acrescenta uma nova camada de
apresentação **sem migrar nem escrever o formato financeiro existente**.

## Como usar

```bash
node scripts/gerar-html-design-v32.cjs
```

Abra o arquivo `../Meu-Dinheiro-v32-Design-Testes.html` diretamente no navegador
de um computador ou celular. O HTML embute todos os recursos JS e CSS necessários;
não precisa de servidor ou acesso à internet para a navegação básica.

Para experimentar com lançamentos reais, **faça um backup JSON antes**. O arquivo
usa o armazenamento local do navegador em que é aberto. O formato continua sendo
`meu-dinheiro-essencial:v1`, tal como no aplicativo v31, sem migração para v2.

## Módulos independentes

- `domain.js`: derivação pura de recorrências, agrupamento diário e indicadores.
- `design.js`: apresentação, atalhos, navegação e filtros da prévia.
- `design.css`: tokens de tema, layout responsivo, sidebar e componentes.
- `scripts/gerar-html-design-v32.cjs`: montagem do HTML a partir do build v31.

## Funcionalidades nesta homologação

- Navegação lateral no desktop e barra móvel de quatro seções com `+` central.
- Movimentos unificados (receitas e despesas), busca e agrupamento por dia.
- Metas e sonhos acessíveis por abas; novo investimento mantém formulário v31.
- Calendário, diagnóstico, relatórios e backup acessíveis pelo menu “Mais”.
- Resumo com próximos lançamentos **cadastrados** e categorias predominantes.
- Aparência responsiva e temas claro, escuro e automático.

## Fora do escopo desta versão de testes

As fases de migração para armazenamento v2/IndexedDB, centavos inteiros, controle
de orçamento, detecção de duplicatas CSV, PIN/WebAuthn e previsões estatísticas
continuam pendentes: exigem trabalho de domínio e migração compatível, mais
testes de integridade, antes de serem consideradas aptas para dados reais.

Esta prévia **não é uma publicação da main** nem substitui o PWA Windows.
