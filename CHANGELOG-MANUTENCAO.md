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

## P0.3a — Migração transacional incremental (v46)

- Leitura, comparação e escrita passam a ocorrer em uma mesma transação IndexedDB, com confirmação somente em `oncomplete`.
- Marcador de esquema do snapshot e trava de versão conhecida impedem sobrescrita por abas ou clientes defasados.
- Eliminada a corrida entre inicialização e gravação enfileirada; falhas iniciais não são confundidas com conflito confirmado.
- Cinco cenários novos de teste cobrem duas abas, conflito tardio, versão futura e falha de leitura; Chromium verifica a integridade do espelho no começo e após operações.

## P0.3b — Proteção da exclusão entre abas (v47)

- Tombstone persistente e transacional no IndexedDB após a dupla confirmação, sem conteúdo financeiro.
- Inicialização segura mesmo quando localStorage está vazio; cadastro novo permitido após exclusão confirmada.
- Bloqueio de gravações e exclusões obsoletas de abas antigas; revisão da origem antes de excluir.
- Diagnóstico inclui apenas sinalização técnica da proteção; testes abrangem falha e retomada da exclusão.
- Fluxo de exclusão e criação posterior coberto também no teste real de Chromium.


## P0.3c1 — Leitura e backups independentes de conflitos (v48)

- Nova seção de recuperação em Ajustes, acessível por inspeção manual, com estados/contagens sanitizados de localStorage e IndexedDB.
- Exportação separada das duas origens em JSON v1 validado, sem modificar nenhuma delas. Conflitos, tombstone, dados inválidos e alterações concorrentes impedem operações inseguras.
- Leitura IndexedDB transacional somente leitura, após a fila já existente, isolada dos diagnósticos automáticos.
- Testes unitários de privacidade, exportação, concorrência e ausência de escrita; Chromium testa divergência com dois downloads e preservação das origens.
- Cache e versão de homologação sincronizados na **v48**. A escolha transacional (P0.3c2) continua pendente; `main` não alterada.
- Falhas de transação de leitura agora são tratadas explicitamente e nunca deixam inspeções pendentes.

## P0.3c2 — Escolha explícita e recuperação transacional (v49)

- A tela de Ajustes passou a oferecer seleção da origem após os dois arquivos JSON e duas confirmações.
- Recuperação de conflitos só altera o IndexedDB após comparar o snapshot na transação e depois sincroniza localStorage; falhas impedem anunciar conclusão.
- Proteção contra abas concorrentes, tombstone e dados inválidos; testes de cancelamento, substituição e falha de escrita, inclusive no Chromium.

## P0.4 e P0.5 — Repositório primário e importação OFX (v50, em homologação)

- Repositório financeiro assíncrono passa a exigir o commit IndexedDB antes de aceitar lançamentos, investimentos, metas, CSV ou backup JSON. localStorage torna-se compatibilidade secundária.
- Novo parser OFX local acoplado à conferência prévia do CSV, com FITID para detecção de duplicatas e classificação manual das aplicações.
- Recuperação de JSON passa a exigir dupla confirmação; conflitos de origem permanecem bloqueados sem escolha explícita.
- Snapshot primário marcado de modo persistente; reabertura sem chave local é permitida somente com marcador válido. Tombstone e versões futuras continuam protegidas.
- Corrigida corrida entre dois diálogos de confirmação sucessivos encontrada no Chromium durante P0.3c2.
- Diagnóstico indica fonte primária e estado do espelho legado sem registrar conteúdo financeiro; testes de 1.000 e 10.000 registros e de falhas de persistência.
- **Homologação manual em PWA instalado e backup real ainda necessária antes de declarar P0 finalizada ou publicar na main.**

## P0.5 — Correção de inicialização e QA assíncrono (v51)

- Backup automático em pasta aguarda o carregamento do snapshot primário e fica suspenso durante divergências, evitando escrever estado vazio provisório.
- Após recuperar ou excluir dados, o backup em pasta pode ser reinicializado com o estado correto.
- QA do Chromium aguarda o fechamento dos formulários depois do commit assíncrono antes de comparar valores, eliminando leituras prematuras.

## P0.5 — Conflito durante commit assíncrono (v52)

- Se uma aba legada alterar localStorage enquanto o IndexedDB conclui uma gravação, a nova versão **não sobrescreve** essa origem. Ambos os estados são preservados para recuperação assistida; novas escritas são bloqueadas.
- Teste unitário específico reproduz a alteração concorrente no intervalo entre commit indexado e atualização da cópia de compatibilidade.

## P1.2 — Regras de lembretes e CDI isoladas (v53)

- `motor-financeiro.js` concentra agora a busca por aportes pendentes, com janela de seis meses, recorrências, conclusões e data de referência injetada.
- A estimativa bruta de CDI em dias úteis foi isolada da geração de HTML, sem criar rendimento, aporte ou alteração de saldo.
- `app.js` passou a adaptar as funções do motor à interface e reutilizar a regra de percentual de `regras-financeiras.js`; autoverificação e testes de 10 mil rendas sintéticas ampliados.
- Cache PWA e versão visível avançam juntos para **v53**. P0.5 permanece aguardando instalação/offline e backup real em dispositivo antes da conclusão; `main` permanece intacta.

## P1.3–P1.5 — Modularização financeira completa (v55)

- Criados `dominio-objetivos.js` e `dominio-investimentos.js`: fórmulas de metas, totalizações sem dupla contagem, candidatos a vínculo, origem salarial e edição imutável saíram dos controladores de tela.
- Saldo histórico disponível foi centralizado em `motor-financeiro.js` e reutilizado pelo Resumo. Os exports históricos do Resumo e dos Investimentos permanecem compatíveis.
- Catálogo, autoverificações, cache PWA e gerador de HTML receberam os novos domínios, sem mudanças no banco, backups ou direitos de publicação.
- Testes de contratos puros e de 10 mil aplicações sintéticas adicionados; após falha sintática detectada no CI da v54, a importação duplicada foi removida e adicionada checagem de sintaxe de **todos os módulos**. **333 testes Node locais aprovados**; o CI de Chromium é a verificação seguinte na branch.
- **P1 concluída tecnicamente.** P0.5 segue pendente apenas da homologação real no PWA e de um backup real; a `main` não foi modificada.

## P2.1 — Lançamento rápido celular/PC e histórico diário (v56)

- Adicionados dois atalhos de cadastro de renda/despesa no celular e ações diretas no Resumo do PC, preservando o botão + e todas as opções originais.
- Novo teclado monetário móvel, com valores em centavos, visor em reais, operação de apagar e limite de valor. Categorias rápidas reutilizam o catálogo oficial; formulário nativo continua disponível.
- Listas de Renda/Despesas agora incluem agrupamento por dia, sem alterar saldos ou recorrências.
- Incluídos testes de teclado, acessibilidade estrutural, catálogo único e agrupamento; **337 testes Node locais aprovados**, com Chromium no CI da branch a validar.
- As demais ideias das referências foram organizadas em P2.2–P2.7. `main` permanece intacta; P0.5 continua pendente de validação física.
