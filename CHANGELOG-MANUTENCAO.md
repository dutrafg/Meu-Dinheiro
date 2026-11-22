# Mudanças propostas — roadmap de manutenção

## P0.1 — Branch de homologação

- Criada camada isolada de replicação financeira para IndexedDB, com transações ordenadas.
- Inclusão de autoverificação no catálogo e estado de sincronização no diagnóstico JSON.
- Exclusão de dados aguarda a remoção do espelho; falhas impedem confirmação enganosa.
- Adicionados testes automatizados do espelho, concorrência de operações, falha de exclusão e privacidade.
- Nova orientação de manutenção AGENTS.md e documentação de migração DATABASE.md.
- Cache/versão PWA sincronizados para v40 apenas na branch; main continua estável até aprovação.

## Pendente

- IndexedDB como armazenamento primário (P0.2–P0.5).
- Backups restauráveis testados ponta a ponta com o novo repositório.
- Desacoplamento adicional das regras financeiras de dist/app.js.
- Execução end-to-end em browsers reais e homologação no smartphone.
- Próximas prioridades P1–P4 do roadmap.
