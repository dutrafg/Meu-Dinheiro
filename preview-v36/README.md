# Meu Dinheiro — homologação v36 (Ajustes compactos)

Correção visual baseada na captura mobile `1000489393.jpg`. A versão v35 mantinha
seis cores em cartões altos de duas linhas e repetia o cabeçalho de saldo sobre
o título de Ajustes, aumentando a altura útil consumida antes das ferramentas.

- Seis cores em chips horizontais de pelo menos 48 px, com o círculo e o nome
  lado a lado. Três colunas no celular, duas abaixo de 360 px, encaixe flexível
  no desktop. Os temas e a gravação automática permanecem inalterados.
- O cabeçalho financeiro é oculto apenas durante Ajustes no celular; o título
  **Ajustes** permanece no conteúdo e o sino e modo discreto ficam acessíveis.
- Menos margem/padding nos blocos recolhíveis e retirada da frase redundante de
  salvamento dentro de Aparência, preservando o indicador acessível no topo.
- 12 novas verificações de layout, versão, tema, toque e integridade no Diagnóstico.
- Rótulo da versão distingue **prévia v36** do núcleo v31, sem fingir que o PWA
  publicado recebeu uma atualização.

`node scripts/gerar-html-design-v36.cjs Meu-Dinheiro-v36.html`

`node --test tests/*.test.cjs`

Esta é uma prévia independente, sem migração de dados e sem alterações na main.
