# Roadmap de manutenção — Meu Dinheiro

**Situação:** **v63: P2.1–P2.5 e P2.7 com CI Node/Chromium aprovados, incluindo testes offline completos**, na branch `refactor/roadmap-manutencao-p0-20261122`. **370/370 testes Node e CI Chromium offline aprovados** (runs 45093963590 e 45093963618). P2.6 aguarda inspeção em dispositivo físico. **P1 concluída**, **P0.5 continua em homologação física** e `main` não alterada.

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
| **P2 — Qualidade, interface e funções de referência** | **Automação v63 aprovada; homologação física pendente** | Funções de referência e diagnósticos integrados; testes Node/Chromium offline aprovados. Falta validar PWA no celular real antes de declarar homologação irrestrita |
| P2.1 | ✅ Concluída em branch; CI Node + Chromium aprovados | Celular: teclado em centavos, categorias por ícones e botões − Gastei/+ Recebi. PC: ações de cadastro no Resumo. Histórico agrupado por dia nas telas de renda/despesas |
| P2.2 | ✅ Concluída em branch (CI Node/Chromium) | Limite mensal e meta de guardar opcionais em Ajustes; orçamento diário em centavos, considerando despesas vencidas e do dia, aviso a partir de 80%, sem confundir estimativa com saldo bancário |
| **P2.3** | **✅ Concluída (CI v62)** | Agenda e previsão de 12 meses incluem contas a pagar e fixos; vencimentos e estado de pagamento; pagamento cria uma única despesa e preserva histórico, sem dupla contagem |
| P2.4 | ✅ Concluída (CI v62) | Categorias personalizadas com renomear/ocultar/ícone preservando o histórico; cartão parcelado com saldo a pagar, próxima fatura e confirmação de cada parcela |
| **P2.5** | **✅ Concluída na branch; CI Node + Chromium aprovados (v60)** | Resumo anual, compartilhamento explícito, desafio 52 semanas com meta real, 52 valores e confirmação de cada aporte via diálogo de investimento; nenhuma movimentação automática |
| P2.6 | 🟡 Em homologação | Orçamento do dia prioritário, responsividade de compromissos e categorias no celular/PC; falta inspeção manual em aparelhos reais; modo demonstrativo permanece fora do escopo publicado para não arriscar dados do usuário |
| P2.7 | ✅ Auditoria offline automatizada aprovada (v63) | 370/370 testes Node e Chromium aprovados: instalação do Service Worker, corte real de internet, recarga offline, dados preservados e HTML `file://`; inspeção física de P2.6 continua separada |
| **P3 — Logs e observabilidade** | **Ampliada em v63** | Diagnóstico distingue erros reais de riscos preventivos, inspeciona integridade dos recursos cacheados, detecta HTML servido por engano como JavaScript e sinaliza risco de limpeza do armazenamento; notificações locais de vencimentos, parcelas, limites e armazenamento |
| **P4 — Homologação e publicação** | **Pendente** | Testes manuais PWA/Android/desktop, recuperação, backup e autorização para publicar |

## Regras de avanço

1. Nunca usar dados financeiros reais nos testes de CI.
2. Nenhuma resolução automática de conflito, migração destrutiva ou alteração da `main`.
3. Só declarar uma etapa concluída quando código, testes automatizados e, quando pertinente, navegador real estiverem aprovados.
4. A cada etapa, atualizar este roadmap, `DATABASE.md`, o changelog e o resumo de testes do PR.
5. `P0` somente estará concluída quando IndexedDB for a fonte primária **com backup, restauração e recuperação validados também em dispositivo real**.

## P2.7b/P3.2 — Bateria offline e HTML independente (v63)

- PWA: valida bytes de entrada HTML, scripts JavaScript, CSS, manifesto, ícones PNG e módulos críticos dentro do Cache Storage, sem acesso à rede e sem ler dados financeiros; verifica correspondência com a versão v63 e detecta cache incompleto ou versão antiga.
- Arquivo HTML único: valida scripts/estilos incorporados, ausência de dependências de rede (inclusive imagens) e bibliotecas internas; Service Worker é corretamente identificado como não aplicável nesse modo.
- Navegador automatizado (**CI aprovado**): instala cache conectado, corta realmente a rede do contexto Chromium, recarrega, navega entre telas, roda diagnóstico, confere espelho IndexedDB e reconecta; o HTML único é aberto em `file://` com navegador offline.
- Risco preventivo `RISCO_OFFLINE_EVICCAO_DADOS`: sistema operacional/navegador pode remover armazenamento não persistente; manter backup JSON fora do aparelho.
- Gerador entrega `Meu-Dinheiro-v63-Offline-Validacao.html` com instruções e botão para executar o diagnóstico. Guia manual em `VALIDACAO-OFFLINE.md`.
- **Não concluímos P0.5 nem P2.6 sem ensaio físico** em Android/iOS e confirmação explícita de backup/restauração de dados fictícios.
- CI v63 aprovado: código https://github.com/dutrafg/Meu-Dinheiro/actions/runs/45093963590 e navegador offline https://github.com/dutrafg/Meu-Dinheiro/actions/runs/45093963618.

## Verificação da P2 até v60

- CI do código (354 testes Node): https://github.com/dutrafg/Meu-Dinheiro/actions/runs/45090707674 — **aprovado**.
- QA Chromium desktop/celular: https://github.com/dutrafg/Meu-Dinheiro/actions/runs/45090707644 — **aprovado**, incluindo desafio 52 semanas e aportes fictícios.
- Prévia isolada v60: https://meu-dinheiro-mt7bc81l7-dutra8.vercel.app — não equivale à publicação em produção.
- Na v61: cartão de limite do dia priorizado no celular e cobertura responsiva ampliada; **356 testes Node e Chromium aprovados**: https://github.com/dutrafg/Meu-Dinheiro/actions/runs/45091040107 e https://github.com/dutrafg/Meu-Dinheiro/actions/runs/45091040083.
- v62: **366/366 testes Node e Chromium v62 aprovados**: https://github.com/dutrafg/Meu-Dinheiro/actions/runs/45092725146 e https://github.com/dutrafg/Meu-Dinheiro/actions/runs/45092725158. **Não considerar P2 fisicamente homologada** antes de verificar o PWA instalado no celular/dispositivo real.

## P2.3b, P2.4 e expansão P3 — contas, cartão, categorias e alertas (v62)

- Criado `commitments` opcional no backup JSON v1 e no snapshot IndexedDB para contas mensais, fixos finitos e compras parceladas. Pagamento é vinculado à transação (`commitmentId`, `commitmentMonth`) e confirmado via `persist`, com bloqueio de baixa duplicada, ajuste de dia 31 e histórico preservado após remoção do plano.
- Previsão inclui exclusivamente compromissos não pagos, sem somá-los outra vez aos pagamentos confirmados. Não gera transações automáticas e diferencia projeção de desembolso real.
- Categorias personalizadas, ocultação, ícone e mudança de nome em preferências separadas; renomear não reclassifica o passado. Categorias históricas continuam editáveis; restauração de backups mantém categorias antigas.
- Sininho mantém lembretes de aporte e acrescenta contas atrasadas, vencimentos nos próximos sete dias, cartão, limite 80%/100%, falha de backup em pasta e bloqueio de gravação; dispensar não equivale a pagar.
- Diagnóstico sanitizado sinaliza possíveis previsões duplicadas, cota de armazenamento acima de 80%, quase mil compromissos, ausência de cópia externa e três erros técnicos repetidos. Testes sintéticos comprovam backup de parcelas, compatibilidade legada e rejeição de pagamentos duplicados.
- Versão v62, cache, inventário de módulos e HTML independente atualizados. **CI Node e Chromium concluídos com sucesso; ensaios físicos ainda são necessários.**

## Critérios de encerramento da P1 (v55)

- Regras de totalização mensal, saldo histórico, CDI, aporte, reserva, metas e investimentos em módulos puros, sem DOM, rede ou armazenamento.
- Controladores visuais consultam cálculos e encaminham alterações à persistência transacional; formatos de dados e APIs históricas continuam compatíveis.
- Novos módulos presentes no catálogo de diagnóstico, no registro obrigatório, no cache PWA e no HTML independente.
- 333 testes Node aprovados localmente, incluindo checagem de sintaxe de cada módulo, regressões e dados sintéticos de até 10 mil registros. Verificação de navegador pelo CI da branch antes de propor merge.
- **P1 não depende da homologação física pendente da P0.5:** ambas são acompanhadas separadamente e `main` permanece protegida.
