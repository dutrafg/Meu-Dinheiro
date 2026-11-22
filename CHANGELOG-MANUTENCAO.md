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

## P0.2 — Proteção contra conflito na abertura

- A inicialização preserva uma cópia IndexedDB divergente.
- Divergências produzem código de diagnóstico; testes comprovam a preservação.
- Versão v41 de homologação, main inalterada.

## P1.1 — Cálculos modularizados

- Movimentações mensais, recorrências e reserva principal centralizadas num motor puro.
- Soma de receitas/despesas em centavos inteiros, com teste de 10 mil lançamentos.
- Testes de regressão do motor e atualização do catálogo diagnóstico.
- Prévia de homologação passa para v42 na branch, sem alterar main.

## P2.1 — Teste real de navegador no CI

- Novo workflow independente executa Chromium headless e simula fluxo desktop/mobile com dados fictícios.
- Dependência Playwright fixada para reprodutibilidade, sem alterar a distribuição estática.

## P2.2 — Correção encontrada pelo teste em navegador

- Removida capitalização automática do mês no calendário; preserva o padrão em português, como dezembro de 2026.
- Teste de interface real detectou divergência entre texto renderizado e esperado.
- Versão de homologação v43 sincronizada com o cache PWA.

## P2.3 — Alternância entre objetivos corrigida

- Botões acessíveis para alternar entre Metas/Reserva e Sonhos, que antes não eram exibidos apesar do suporte no controlador.
- Teste real de desktop e smartphone agora utiliza a rota Objetivos e seleciona Sonhos explicitamente.
- Versão de homologação v44, sem publicação na main.

## P3.1 — Log técnico automático da sessão

- Eventos técnicos detalhados são habilitados desde o início de cada abertura do aplicativo.
- Evento `SESSAO_INICIADA` retido apenas na sessão, em estrutura restrita (horário, nível, código, módulo); máximo de 50 entradas, sem valores pessoais.
- Navegador e teste estático verificam a ativação e o formato; versão de homologação v45.

## P2.4 — Verificação do calendário fechado no celular

- O teste do navegador agora confere o estado real do diálogo; o calendário mantém os dias no DOM após fechar, mas não é exibido ao usuário.

## P2.5 — Sincronização do teste de fechamento móvel

- O teste aguarda o evento nativo `close` do diálogo após Esc antes de validar `aria-expanded`, evitando uma corrida entre o browser e o teste.

## P2.6 — Teste alinhado à estrutura atual de Ajustes

- O teste de smartphone confere a seção de exportação/importação, os cinco comandos e o painel de atualizações/diagnóstico pelos rótulos reais.
