# Roadmap de manutenção — Meu Dinheiro

**Situação:** P0.1–P0.4 implementadas na branch `refactor/roadmap-manutencao-p0-20261122`; **v50 em homologação da P0.5**. `main` não alterada.

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
| **P1 — Modularização financeira** | **Parcial** | Motor puro mensal e reserva concluído; continuar extração e cobertura de regras |
| **P2 — Qualidade e interface** | **Base implementada** | Chromium desktop/mobile no CI; correções de calendário e navegação; continuar auditorias |
| **P3 — Logs e observabilidade** | **Parcial** | Log técnico de sessão automático e JSON sanitizado; ampliar verificações sem dados privados |
| **P4 — Homologação e publicação** | **Pendente** | Testes manuais PWA/Android/desktop, recuperação, backup e autorização para publicar |

## Regras de avanço

1. Nunca usar dados financeiros reais nos testes de CI.
2. Nenhuma resolução automática de conflito, migração destrutiva ou alteração da `main`.
3. Só declarar uma etapa concluída quando código, testes automatizados e, quando pertinente, navegador real estiverem aprovados.
4. A cada etapa, atualizar este roadmap, `DATABASE.md`, o changelog e o resumo de testes do PR.
5. `P0` somente estará concluída quando IndexedDB for a fonte primária **com backup, restauração e recuperação validados também em dispositivo real**.
