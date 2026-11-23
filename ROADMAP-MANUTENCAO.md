# Roadmap de manutenção — Meu Dinheiro

**Situação:** **v60: P2.1, P2.2 e P2.5 concluídas; P2.3 parcialmente implementada; P2.4/P2.6/P2.7 pendentes** na branch `refactor/roadmap-manutencao-p0-20261122`. **354 testes Node e CI Chromium aprovados na v60**. **P1 concluída**, **P0.5 continua em homologação física** e `main` não alterada.

| Fase | Status | Entregas e próximos passos |
| --- | --- | --- |
| **P0 — Segurança e persistência** | **Homologação pendente** | IndexedDB primário implementado em v50; validar recuperação no PWA instalado e backup real antes da conclusão |
| P0.1 | ✅ Concluída | Espelho IndexedDB, exclusão protegida, diagnóstico e testes |
| P0.2 | ✅ Concluída | Preservar cópias divergentes e bloqueio de sobrescrita |
| P0.3a | ✅ Concluída | Transações atômicas, versão do snapshot e comparação entre abas |
| P0.3b | ✅ Concluída | Tombstone de exclusão, inicialização vazia, proteção contra abas antigas |
| P0.3c1 | ✅ Concluída | Inspeção manual de localStorage e IndexedDB, contagens sem valores privados e exportação independente em JSON sem sobrescrita |
| P0.3c2 | ✅ Concluída | Escolha explícita após exportar ambas as cópias, dupla confirmação, restauração transacional e proteção contra falhas/conflitos |
| P0.4 | ✅ Implementada | Backup/restauração, CSV e OFX usam gravação confirmada pelo repositório; limpeza e diagnóstico integrados; testes de 1 mil e 10 mil registros |
| **P0.5** | **🧪 Em homologação** | IndexedDB é fonte primária transacional; localStorage é espelho de compatibilidade. Necessário teste manual no PWA instalado e backup real antes de encerrar P0 |
| **P1 — Modularização financeira** | **✅ Concluída tecnicamente (v55)** | Núcleo financeiro, metas, investimentos, saldo e aportes isolados; contratos, diagnóstico, PWA e prévia integrados. Acompanhar CI da branch |
| P1.1 | ✅ Implementada | Motor puro de recorrências, totais mensais e reserva, coberto por testes com 10 mil transações |
| P1.2 | ✅ Concluída | Motor puro de lembretes de aporte (janela de seis meses, dia 31, concluídos) e estimativa CDI bruta; adaptadores finos no app |
| P1.3 | ✅ Concluída | Cálculo puro de metas/sonhos: progresso, restante, totais sem duplicar aplicações vinculadas, candidatos e destaques |
| P1.4 | ✅ Concluída | Regras puras de investimentos/edição/vínculos salariais em `dominio-investimentos.js`, controlador visual isolado e API histórica preservada |
| P1.5 | ✅ Concluída localmente | Saldo disponível extraído para motor único; testes de contratos, 10 mil investimentos sintéticos, verificação sintática, cache offline, HTML independente e regressões existentes (333/333) |
| **P2 — Qualidade, interface e funções de referência** | **Em andamento (v60)** | Fotos de referência analisadas; executar subetapas P2.1–P2.7 sem copiar paywall ou comprometer dados |
| P2.1 | ✅ Concluída em branch; CI Node + Chromium aprovados | Celular: teclado em centavos, categorias por ícones e botões − Gastei/+ Recebi. PC: ações de cadastro no Resumo. Histórico agrupado por dia nas telas de renda/despesas |
| P2.2 | ✅ Concluída em branch (CI Node/Chromium) | Limite mensal e meta de guardar opcionais em Ajustes; orçamento diário em centavos, considerando despesas vencidas e do dia, aviso a partir de 80%, sem confundir estimativa com saldo bancário |
| **P2.3** | **🟡 Parcial: agenda e projeção aprovadas; contas a pagar pendentes** | Relatórios exibem despesas futuras previstas e tabela dos próximos 12 meses com receitas/despesas recorrentes; falta modelo independente de contas a pagar, confirmação de pagamento e cadastro de contas mensais sem dupla contagem |
| P2.4 | ⏳ Planejada | Gestão de categorias e parcelas de cartão com regras de integridade e importação compatíveis |
| **P2.5** | **✅ Concluída na branch; CI Node + Chromium aprovados (v60)** | Resumo anual, compartilhamento explícito, desafio 52 semanas com meta real, 52 valores e confirmação de cada aporte via diálogo de investimento; nenhuma movimentação automática |
| P2.6 | ⏳ Planejada | Refinamento de navegação, hierarquia, contrastes e espaçamento em celular, tablet e PC; proteção de dados e modo de exemplo somente isolado |
| P2.7 | ⏳ Planejada | Auditoria funcional, acessibilidade, navegação, performance e responsividade desktop/mobile, com diagnóstico sanitizado |
| **P3 — Logs e observabilidade** | **Parcial** | Log técnico de sessão automático e JSON sanitizado; ampliar verificações sem dados privados |
| **P4 — Homologação e publicação** | **Pendente** | Testes manuais PWA/Android/desktop, recuperação, backup e autorização para publicar |

## Regras de avanço

1. Nunca usar dados financeiros reais nos testes de CI.
2. Nenhuma resolução automática de conflito, migração destrutiva ou alteração da `main`.
3. Só declarar uma etapa concluída quando código, testes automatizados e, quando pertinente, navegador real estiverem aprovados.
4. A cada etapa, atualizar este roadmap, `DATABASE.md`, o changelog e o resumo de testes do PR.
5. `P0` somente estará concluída quando IndexedDB for a fonte primária **com backup, restauração e recuperação validados também em dispositivo real**.

## Verificação da P2 até v60

- CI do código (354 testes Node): https://github.com/dutrafg/Meu-Dinheiro/actions/runs/45090707674 — **aprovado**.
- QA Chromium desktop/celular: https://github.com/dutrafg/Meu-Dinheiro/actions/runs/45090707644 — **aprovado**, incluindo desafio 52 semanas e aportes fictícios.
- Prévia isolada v60: https://meu-dinheiro-mt7bc81l7-dutra8.vercel.app — não equivale à publicação em produção.
- Próximos blocos de implementação: P2.3b (contas com status de pagamento), P2.4 (categorias editáveis e parcelas), P2.6 (acabamento visual), P2.7 (auditoria final). **Não considerar P2 totalmente concluída** enquanto esses blocos e os testes reais necessários estiverem pendentes.

## Critérios de encerramento da P1 (v55)

- Regras de totalização mensal, saldo histórico, CDI, aporte, reserva, metas e investimentos em módulos puros, sem DOM, rede ou armazenamento.
- Controladores visuais consultam cálculos e encaminham alterações à persistência transacional; formatos de dados e APIs históricas continuam compatíveis.
- Novos módulos presentes no catálogo de diagnóstico, no registro obrigatório, no cache PWA e no HTML independente.
- 333 testes Node aprovados localmente, incluindo checagem de sintaxe de cada módulo, regressões e dados sintéticos de até 10 mil registros. Verificação de navegador pelo CI da branch antes de propor merge.
- **P1 não depende da homologação física pendente da P0.5:** ambas são acompanhadas separadamente e `main` permanece protegida.
