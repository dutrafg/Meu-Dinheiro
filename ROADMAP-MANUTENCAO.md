# Roadmap de manutenção — Meu Dinheiro

**Situação:** **v66: teclado próprio removido, somente entrada numérica nativa; 372/372 testes Node e QA Chromium CI aprovados**, na branch `refactor/roadmap-manutencao-p0-20261122` (runs 45139318897 e 45139318864). O diagnóstico v64 do Samsung passou em 225 verificações sem erros, com um aviso preventivo de armazenamento. P2.1–P2.5 e P2.7 concluídas tecnicamente; P2.6 aguarda inspeção física no Samsung. **P1 concluída**, **P0.5 em homologação física** e `main` não alterada.

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
| **P2 — Qualidade, interface e funções de referência** | **v66 CI aprovado; inspeção física pendente** | Visual aprovado mantido; somente botão + para cadastros e somente campo monetário nativo no celular |
| P2.1 | ✅ Concluída em branch; teclado simplificado em v66 | Celular: valor via teclado do sistema, categorias por ícones e cadastros no +, sem barra fixa. PC: ações do Resumo. Histórico agrupado por dia |
| P2.2 | ✅ Concluída em branch (CI Node/Chromium) | Limite mensal e meta de guardar opcionais em Ajustes; orçamento diário em centavos, considerando despesas vencidas e do dia, aviso a partir de 80%, sem confundir estimativa com saldo bancário |
| **P2.3** | **✅ Concluída (CI v62)** | Agenda e previsão de 12 meses incluem contas a pagar e fixos; vencimentos e estado de pagamento; pagamento cria uma única despesa e preserva histórico, sem dupla contagem |
| P2.4 | ✅ Concluída (CI v62) | Categorias personalizadas com renomear/ocultar/ícone preservando o histórico; cartão parcelado com saldo a pagar, próxima fatura e confirmação de cada parcela |
| **P2.5** | **✅ Concluída na branch; CI Node + Chromium aprovados (v60)** | Resumo anual, compartilhamento explícito, desafio 52 semanas com meta real, 52 valores e confirmação de cada aporte via diálogo de investimento; nenhuma movimentação automática |
| P2.6 | 🟡 v66 CI aprovado; homologação física pendente | Orçamento do dia prioritário; seis abas sem sobreposição; botão + único; teclado personalizado excluído e somente entrada numérica nativa. Falta ensaio real no Samsung/PWA; modo demonstrativo fora do escopo publicado para proteger dados |
| P2.7 | ✅ Auditoria offline automatizada aprovada (v63) | 370/370 testes Node e Chromium aprovados: instalação do Service Worker, corte real de internet, recarga offline, dados preservados e HTML `file://`; inspeção física de P2.6 continua separada |
| **P3 — Logs e observabilidade** | **v66 CI aprovado** | Diagnóstico distingue erros reais e riscos preventivos; v66 detecta campo nativo bloqueado ou retorno acidental de teclado customizado |
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
- Gerador entrega `Meu-Dinheiro-v66-Teclado-Nativo-Offline.html` com instruções e botão para executar o diagnóstico. Guia manual em `VALIDACAO-OFFLINE.md`.
- **Não concluímos P0.5 nem P2.6 sem ensaio físico** em Android/iOS e confirmação explícita de backup/restauração de dados fictícios.
- CI v63 aprovado: código https://github.com/dutrafg/Meu-Dinheiro/actions/runs/45093963590 e navegador offline https://github.com/dutrafg/Meu-Dinheiro/actions/runs/45093963618.

## P3.3 — Auditoria do diagnóstico recebido em 23/11 (v64)

- O JSON de Samsung Internet/HTML independente apresentou **222 verificações, 1 erro, 2 avisos e 7 não avaliadas**. A única falha `MOD_ORCAMENTO` era um **erro do teste**, pois R$ 280 divididos por 29 dias resultam em **R$ 9,65**, não R$ 10,00; a fórmula de orçamento permanece correta.
- O aviso `AJUSTES_RELATORIOS_DESCOBERTA` procurava PDF/backup no lugar antigo. O teste foi substituído por verificações de controles em **Relatórios** e ausência de duplicação em **Ajustes**, com casos de regressão para botão ausente ou duplicado.
- O aviso `RISCO_OFFLINE_EVICCAO_DADOS` é legítimo e continua como risco preventivo de limpeza de armazenamento pelo navegador; `nao_avaliado` em Service Worker no HTML `file://` é comportamento correto.
- **371/371 Node e Chromium offline aprovados no CI da v64**: https://github.com/dutrafg/Meu-Dinheiro/actions/runs/45094976803 e https://github.com/dutrafg/Meu-Dinheiro/actions/runs/45094976827. Novo E2E confirma que as duas verificações aparecem aprovadas dentro do HTML desconectado. Ensaio em aparelho físico ainda pendente.

## P2.6b/P3.4 — Correção da experiência móvel (v65)

- Diagnóstico novo de Samsung Internet/HTML v64: **225 verificações, zero erros, um aviso legítimo de risco de limpeza pelo navegador e sete não avaliadas em contexto local**. Os dois erros de regra anteriores não reapareceram.
- A barra flutuante de dois cadastros foi retirada do celular a pedido do usuário. O **+** abre todos os cinco cadastros (renda, despesa, meta, sonho e investimento) e funciona sem duplicidade.
- Rótulos das seis abas passam a ficar abaixo de seus ícones, com seis colunas proporcionais e teste de largura em **320, 384, 390 e 768 px**. Inspeção automática das caixas visíveis evita sobreposição de rótulos.
- No diálogo de lançamento, teclado de centavos é padrão sem convocar o teclado do sistema; botão acessível permite optar pelo teclado numérico nativo. Abertura no celular não foca descrição à força.
- A v65 adiciona regressões Node e Chromium e autoverificações de layout/atalho/teclado; não modifica dados financeiros existentes, armazenamento, saldos nem fórmulas. **Homologação física de P0.5/P2.6 ainda é necessária.**
- **CI v65 aprovado:** 372/372 testes Node (https://github.com/dutrafg/Meu-Dinheiro/actions/runs/45137750414) e Chromium desktop/móvel + offline (https://github.com/dutrafg/Meu-Dinheiro/actions/runs/45137750327). A aprovação automatizada não substitui o ensaio manual do Samsung com o HTML v65 e o PWA instalado.

## P2.6c — Teclado nativo sem duplicação (v66)

- Foto no Samsung mostrou teclado próprio ocupando grande parte do diálogo. O usuário solicitou removê-lo completamente, preservando a nova interface.
- A interface passou a exibir **Valor (R$)** com `inputmode="decimal"` e `type="number"` imediatamente após a descrição, usando apenas o teclado do sistema ao tocar no campo. Removidos visor numérico, grade de teclas e botão de alternância.
- A seleção rápida de categorias permanece; sua lógica foi isolada em `categorias-rapidas.js`, retirando código monetário obsoleto e atualizando o inventário e cache offline. O motor financeiro, os registros e backups não mudaram.
- Testes de regressão de campo nativo e categorias; Chromium verifica abertura do formulário, ausência total de teclas próprias, valor digitado e seleção sem alteração de valor. P0.5 e P2.6 ainda exigem homologação física.
- **CI v66 aprovado:** 372/372 testes Node (https://github.com/dutrafg/Meu-Dinheiro/actions/runs/45139318897) e Chromium desktop/móvel + offline (https://github.com/dutrafg/Meu-Dinheiro/actions/runs/45139318864). Não equivale a validação física no Samsung.

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
