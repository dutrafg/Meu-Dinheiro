# Meu Dinheiro — prévia v38

Correções fundamentadas no relatório de diagnóstico do Samsung Internet em 21/11/2026:

- Reconhecimento da versão **visual v38** e do **motor v38** como identificadores distintos (camadas independentes mesmo quando os números coincidem).
- Contraste textual v33 agora interpreta cores abreviadas (`#fff`, `#000`), mantendo o mínimo de 4,5:1.
- Tema claro/escuro aceita as paletas válidas de produção e da prévia, verificando o fundo **realmente desenhado**.
- Serviços offline e auditoria de arquivos externos ficam como **não avaliados** quando o HTML é independente; no PWA publicado continuam sendo conferidos.
- Seção de relatórios recebe um nome identificável: **Relatórios PDF, CSV e backup**.
- Sete novos testes de regressão v38 entram no único relatório JSON.

Para gerar o HTML autônomo: `node scripts/gerar-html-design-v38.cjs`. Execute o diagnóstico no dispositivo e envie **o único JSON completo** para reavaliação.

O arquivo de homologação é publicado também em `dist/homologacao-v38.html` sem trocar a página principal do PWA. Assim, a versão visual nova pode ser testada no próprio domínio, usando o armazenamento local da origem, antes de substituir o layout principal.

Os testes de prévia não atualizam o PWA publicado nem a branch `main`.
