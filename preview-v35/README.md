# Meu Dinheiro — homologação v35 (Objetivos e Ajustes)

As cinco imagens e o `DESIGN-IDEAL-Meu-Dinheiro.md` orientaram o visual mobile-first, a hierarquia financeira, o cadastro rápido, a lista de movimentos e os cartões de objetivos. As imagens são referências de design com números exemplificativos; o aplicativo usa somente os lançamentos reais do dispositivo.

## Mudanças

- O destino único **Objetivos** reúne Metas e Sonhos por abas internas. O motor de objetivos (`dist/modules/objetivos.js`) já era único e continua assim, inclusive para os investimentos vinculados. Os dados v1 são preservados.
- **Mais** contém apenas **Ajustes**. Orçamento, calendário, relatórios, CSV, backup, atualização, diagnóstico, privacidade e apagar dados continuam acessíveis em Ajustes.
- Preferências são persistidas automaticamente ao mudar um campo válido; percentual usa intervalo 0–100 e aguarda 500 ms durante a digitação. Falhas são indicadas sem substituir o valor anterior.
- Orçamento por categoria é salvo ao confirmar a alteração do campo (evento `change`/perda de foco), sem botões de salvar/descartar. Valores inválidos não são gravados e exclusão de limite ainda pede confirmação.
- O planejamento do aporte torna-se recolhível na tela de Objetivos; os cartões ganham orientação de aporte mensal e acesso às três últimas aplicações.
- Seções de Ajustes ficam recolhíveis, com aparência aberta por padrão e ações destrutivas guardadas atrás de uma seção.
- Cada nova camada fica em arquivo próprio e entra no Diagnóstico com testes adicionais v35; o limite de 25 segundos continua pertencendo apenas à animação.

## Uso

`node scripts/gerar-html-design-v35.cjs Meu-Dinheiro-v35.html`

`node --test tests/*.test.cjs`

Prévia isolada, não publicada na branch `main` nem no aplicativo Windows. Não há migração de dados neste lote.
