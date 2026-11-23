# Persistência — Meu Dinheiro

## Estado da migração (P0 — versão v52, em homologação)

Em navegadores com IndexedDB disponível, o armazenamento financeiro **primário é IndexedDB** ("meu-dinheiro-financeiro" / "snapshots" / "principal") após migração idempotente e validação. A chave legada "meu-dinheiro-essencial:v1" do localStorage permanece como **espelho de compatibilidade**.

**O código da P0.5 está em homologação.** Não remover a chave legada nem anunciar P0 encerrada sem testes manuais em PWA instalado, recuperação e backups reais.

### Protocolo desta etapa

1. Na inicialização, validar dados existentes. Migração somente quando as duas cópias coincidirem ou o IndexedDB ainda estiver vazio; nunca resolver conflitos silenciosamente.
2. Ao salvar, validar e aguardar **transaction.oncomplete no IndexedDB** antes de atualizar memória, tela e localStorage compatível. Falha no commit impede anunciar sucesso.
3. Se a escrita no espelho legado falhar depois do commit primário, manter o registro no IndexedDB, bloquear nova escrita e solicitar backup; nunca pedir para repetir lançamento já confirmado.
4. A exclusão com dupla confirmação primeiro pausa o backup externo, aguarda/apaga o espelho e só depois remove a chave legada. Se o espelho falhar, não confirmar a exclusão.
5. O diagnóstico compara as cópias apenas quando o usuário executa o diagnóstico completo. O JSON registra somente estados, nunca registros financeiros.
6. Quando localStorage estiver vazio, reabrir IndexedDB como fonte primária **somente se o snapshot possuir marcador `primario:true`**; snapshots legados órfãos continuam bloqueados e tombstones nunca são restauradas automaticamente.

### Etapas para converter IndexedDB em fonte primária

- P0.2: introduzir um repositório assíncrono com transações de leitura/escrita e revisão de todos os pontos de gravação; não confirmar sucesso de uma operação até ocorrer transaction.oncomplete.
- P0.3: migração idempotente com marcadores de versão, testes de queda entre gravações, resolução explícita de conflitos e tombstone de exclusão entre abas; a origem legada fica como backup de compatibilidade.
- P0.4: converter backup/restauração, importação CSV/OFX, limpeza, diagnóstico e HTML standalone para usar o repositório; testar com 1.000 e 10.000 registros.
- P0.5: IndexedDB como fonte de verdade com escrita local secundária de compatibilidade; a remoção futura do legado somente após homologação em PWA real com backup exportado.

### Invariantes obrigatórias

- Valores financeiros nunca são logados.
- Backup JSON v1 permanece importável.
- Não eliminar dados existentes durante atualizações do Service Worker.
- Nenhuma comparação de estados deve escrever ou apagar dados do usuário.
- A remoção de dados depende de confirmação explícita e preserva backups externos.

## P0.2 — Divergência entre cópias

A inicialização compara o espelho IndexedDB com o legado antes de replicar. Se forem diferentes, o espelho preexistente NÃO é sobrescrito silenciosamente. O diagnóstico marca a divergência; uma resolução automática de conflitos não está autorizada até que exista uma recuperação explícita e transacional.

## P0.3a — comparação e gravação transacionais (v46)

- A leitura, a comparação e a escrita do snapshot compartilham a mesma transação `readwrite` em IndexedDB. A confirmação ocorre somente em `transaction.oncomplete`.
- O registro financeiro ganha um marcador interno `versao: 1` (a versão de abertura do banco continua 1); registros legados sem marcador são aceitos e recebem o marcador sem alterar o instante original.
- Cada gravação compara a cópia existente com a última cópia confirmada pela instância. Se outra aba tiver alterado ou apagado o registro, a gravação antiga é bloqueada com `IDB_CONFLITO_TRANSACIONAL`.
- Uma gravação enfileirada antes do fim da inicialização reavalia o bloqueio ao executar. Falha de leitura inicial mantém o espelho bloqueado até nova inicialização ou exclusão explícita.
- **Não há escolha automática entre cópias.** A resolução assistida de conflitos, o marcador de exclusão (*tombstone*) e a troca de fonte primária permanecem para as próximas etapas. O `localStorage` continua oficial.

## P0.3b — Marcador de exclusão entre abas (v47)

- Após as duas confirmações, a remoção do espelho grava uma **tombstone transacional** (versão, identificador de exclusão e horário, sem dados financeiros), aguardando `transaction.oncomplete`. A chave legada só é removida depois.
- Inicializar sem `localStorage` consulta a tombstone pelo novo `iniciarVazio()`. Outra aba que ainda possui a versão anterior não pode gravar seus dados sobre o marcador.
- Uma página reaberta após a exclusão pode cadastrar novos dados: a transação substitui o marcador somente se seu identificador ainda coincidir. Uma aba antiga não pode sobrescrever esses novos lançamentos nem apagá-los.
- Se o navegador fechar entre a escrita da tombstone e a remoção da chave legada, o aplicativo **não restaura nem apaga automaticamente** a origem. Nova exclusão explícita pode concluir a limpeza.
- Antes de apagar a chave local, o processo compara novamente o conteúdo com o valor lido antes da pausa do backup. Alterações de outra aba interrompem a exclusão.
- O diagnóstico JSON expõe apenas o booleano técnico `exclusaoProtegida`; não inclui conteúdo nem identificador do marcador.
- **Ainda pendente na P0.3:** recuperação assistida quando houver duas cópias divergentes, com exportação prévia e decisão do usuário. A tombstone não conclui a migração para IndexedDB primário.


## P0.3c1 — Inspeção e exportação assistidas (v48)

- Em **Ajustes → Recuperação de cópias financeiras**, o usuário inicia a leitura somente quando seleciona **Inspecionar cópias**.
- A ferramenta consulta localStorage e IndexedDB por caminhos distintos, incluindo ausência, erro, versão desconhecida e tombstone de exclusão. A leitura IndexedDB utiliza transação `readonly` e aguarda operações previamente enfileiradas.
- A interface exibe **somente estados e quantidades de registros**. Não mostra nem envia valores, descrições, nomes ou dados financeiros. Os arquivos JSON de recuperação, baixados sob comando do usuário, **contêm** os dados financeiros e devem ser guardados com cuidado.
- Os dois downloads são independentes e têm nomes diferentes. Cada origem é validada antes da exportação, gerando JSON v1 importável. Se qualquer cópia mudar entre inspeção e download, o arquivo não é gerado e uma nova inspeção é exigida.
- **Nenhuma leitura, inspeção ou exportação substitui, apaga ou migra dados.** O aplicativo conserva localStorage como fonte primária e mantém o bloqueio de divergências.
- **P0.3c2 implementada na v49:** decisão explícita, restauração transacional e testes de retomada, sem ressuscitar tombstones por acidente.

## P0.4 — Importação e fluxos assíncronos (v50)

- Backup JSON e importações CSV/OFX aguardam persistência confirmada antes de atualizar a interface; operações de arquivo mantêm validação e confirmação explícita.
- OFX SGML/XML é convertido localmente para a mesma revisão de importação CSV, incluindo a classificação de aplicações, sem upload de extratos.
- Exclusão financeira mantém tombstone transacional antes de remover o espelho local. Diagnóstico sanitizado informa quando IndexedDB é primário e quando o espelho local está pendente.
- Testes sintéticos de 1.000 e 10.000 registros conferem persistência e integridade, sem dados reais.

## P0.5 — IndexedDB primário, aguardando homologação no dispositivo (v52)

- `repositorio-financeiro.js` controla a ordem: validação → commit IndexedDB → espelho local → atualização da UI e backup de pasta. A fonte primária é o snapshot indexado quando disponível.
- Cada snapshot migrado recebe `primario:true`. Na ausência da chave local, apenas snapshots com esse marcador podem reabrir o app; cópias legadas órfãs não são escolhidas automaticamente.
- Escritas não prosseguem em divergências e mudanças concorrentes; o assistente P0.3c2 requer duas exportações e duas confirmações.
- Navegadores sem IndexedDB mantêm modo legado com aviso explícito. Falha ao espelhar localmente após um commit indexado preserva o lançamento e bloqueia novas escritas até recuperação.
- **Pendente para declarar P0 concluída:** teste manual de instalação/offline no dispositivo do usuário, restauração de backup real e retorno de um diagnóstico JSON sanitizado. Não publicar na `main` sem autorização.

## P1.2 — Cálculos financeiros isolados (v53)

- Lembretes de aporte e projeção bruta de CDI foram isolados em funções puras do motor financeiro; não alteram o protocolo transacional P0.5 nem migram dados.
- O repositório IndexedDB permanece primário, com espelho local de compatibilidade. A homologação real da P0.5 continua pendente.

## P1.3–P1.5 — Domínios financeiros isolados (v55)

- Metas/sonhos, investimentos e vínculos salariais possuem regras puras independentes da UI. O cálculo de saldo disponível também usa o motor financeiro compartilhado.
- **Nenhum esquema, chave, identificador ou formato de backup mudou** nesta etapa; o fluxo de escrita transacional continua idêntico ao da v53. Os exports anteriores dos controladores permanecem acessíveis.
- A validação física pendente da P0.5 **não foi substituída** pelos testes da P1. Não publicar na `main` sem autorização.

## P2.1 — Atalhos de interface sem migração (v56)

- Teclado em centavos, seleção visual de categorias, agrupamento de lista e botões rápidos usam as estruturas financeiras e `persist()` existentes. Nenhuma chave nova, migração ou modificação do formato do backup.
- A homologação da P0.5 em dispositivo físico continua pendente e independente dos testes de layout da P2.

## P2.3b/P2.4 — Compromissos financeiros opcionais (v62)

- `commitments` é um array opcional no mesmo snapshot financeiro e arquivo backup JSON v1. Backup antigo sem o campo migra para `[]`, sem apagar os demais dados. Cada item `{id,kind,name,category,amount,day,startMonth,monthsCount}`. `kind` aceita `bill` e `card`; `monthsCount` é `null` (indefinido para contas mensais) ou inteiro 1–120; cartão exige quantidade finita.
- Um pagamento explicitamente confirmado gera um lançamento convencional de despesa com campos opcionais `commitmentId` e `commitmentMonth`. O mesmo plano/mês só aceita um pagamento; qualquer duplicação invalida o snapshot e o backup. O vencimento ajusta dias 29–31 em meses curtos.
- Se o usuário excluir um compromisso, pagamentos antigos conservam vínculo histórico sem obrigar reintrodução do plano. Alterações de período ou tipo são restritas caso existam pagamentos. Projeções não geram lançamentos e separam o pago do a pagar.
- Categorias personalizadas (`categoriasExtras`, `categoriasOcultas`, `categoriaIcones`) continuam na chave de preferências, com tamanho máximo de 8192 caracteres, independente do snapshot financeiro. Renomear ou ocultar afeta a lista futura, não o histórico. Preferências antigas são normalizadas e preservadas.
- Nenhum dado financeiro ou nome de compromisso é registrado no diagnóstico JSON. Avisos de contas/cartão/limite/armazenamento são apenas locais, com IDs de dispensa isolados. **P0.5 ainda precisa da homologação real do PWA.**

## v63 — Inspeção offline sem mutação de dados

- A auditoria de cache usa somente `caches.open` e `cache.match` para validar arquivos estáticos e não acessa `transactions`, `goals` ou os objetos IndexedDB; o relatório registra apenas códigos/estados técnicos.
- `navigator.storage.persisted()` é somente leitura. Retorno falso significa risco de remoção futura pelo navegador, **não** corrupção detectada e **não** solicita autorização persistente.
- O arquivo HTML único inclui a lógica e os estilos no documento. Quando aberto em `file://`, não registra Service Worker, não usa Cache Storage obrigatório e mantém o armazenamento sujeito às permissões do navegador; a exportação JSON continua necessária.
- Testes de homologação offline com dados fictícios não substituem ensaios de backup/restauração e recuperação de conflito IndexedDB em aparelho real (P0.5 pendente).

## v65 — Ajustes de interface sem migração

- O botão `+` único, o teclado monetário alternável e a grade inferior de seis abas não escrevem preferências adicionais nem transformam registros ou backups.
- `input type=number` e armazenamento de valores numéricos permanecem inalterados; o teclado em centavos apenas apresenta a entrada de modo diferente no celular. A homologação física da P0.5 continua pendente.

## v66 — Somente entrada numérica nativa

- Removido o teclado de centavos customizado por preferência do usuário. O campo monetário original `type=number/inputmode=decimal` é usado em celular e PC; nenhuma transformação de valores ou esquema novo é introduzido.
- As categorias rápidas alteram apenas o `<select>` antes de salvar. O repositório IndexedDB, o espelho local e os formatos de backup/CSV/OFX permanecem idênticos; P0.5 segue em homologação física.

## v67 — Ocultação de categorias sem alteração de armazenamento

- A preferência `categoriasOcultas` mantém exatamente o mesmo formato e processo de gravação. A mudança ocorre apenas depois de salvar: atualiza o texto do botão/linha em vez de refazer a lista inteira, conservando a posição do usuário.
- Não elimina categorias do histórico financeiro nem modifica IndexedDB, importação/exportação ou backups. A P0.5 continua pendente de ensaio físico.

## P2.2 — Preferências de planejamento (v57)

- `meu-dinheiro-essencial:preferencias:v1` passa a permitir `limiteMensal` e `metaPoupancaMensal`, ambos números monetários positivos até R$ 999.999.999,00, ou `null` quando não definidos. Preferências antigas são normalizadas, sem migração destrutiva.
- Essas opções **não** integram o snapshot financeiro IndexedDB, os lançamentos nem o backup JSON financeiro. São preferências locais deste navegador; devem ser reconfiguradas após a troca de dispositivo.
- A simulação orçamentária usa somente leituras de transações e ocorrências mensais já existentes; não escreve automaticamente em nenhuma base nem representa saldo bancário.

## P2.3a — Previsões sem esquema novo (v58)

- `previsoes.js` projeta somente transações existentes por data de ocorrência, reutilizando a regra de recorrência do motor financeiro. Não cadastra obrigação, não marca pagamento e não insere lançamento futuro: os resultados permanecem fora do snapshot e do backup.
- Ausência de uma coleção de contas a pagar significa ausência de estado “paga/atrasada”; exibir esse estado sem registro verificável seria incorreto. O cadastro persistente de contas ainda depende de projeto de esquema, validação, recuperação e fluxo de backup antes de habilitar escrita.

## P2.5a — Relatório anual somente leitura (v59)

- Agregações do ano derivam de transações existentes com ocorrências até a data atual. Aportes vinculados continuam na coleção já existente e entram somente como coluna informativa separada.
- Nenhuma chave, formato de backup ou movimentação automática foi criada. O compartilhamento gera texto **somente** quando solicitado pelo usuário.

## P2.5b — Desafio de 52 semanas usando contratos existentes (v60)

- A meta do desafio é uma entrada normal de `goals` (`kind=goal`, nome "Desafio das 52 semanas", alvo R$ 2.756). A grade deriva o estado das 52 semanas de entradas normais em `allocations` vinculadas por `goalId`, com categoria "Desafio 52 semanas", descrição e valor exatos.
- A confirmação usa o formulário atual de investimentos, com seleção obrigatória de origem, validação e gravação transacional. Nenhuma chave nova, coleção nova ou mecanismo paralelo de "semanas guardadas". Backup/restauração atuais já incluem essas entradas.
- A interpretação visual de semana concluída exige um aporte correspondente; metas preexistentes com nomes semelhantes não são apagadas ou migradas.

## P0.3c2 — Recuperação transacional escolhida (v49)

- A seleção só é habilitada após a inspeção de **duas cópias válidas e divergentes** e a solicitação de ambos os downloads JSON.
- A origem é escolhida manualmente, seguida de **duas confirmações**; nenhuma resolução automática é realizada.
- O IndexedDB aplica a escolha em transação `readwrite` com comparação da versão exata previamente inspecionada, e confirma apenas em `transaction.oncomplete`.
- Em seguida, a chave legada é sincronizada. Se a chave local mudar entre inspeção e confirmação ou a escrita falhar, o processo não declara sucesso e exige nova inspeção; os arquivos externos precisam ser preservados.
- Tombstone de exclusão, versões desconhecidas e cópias inválidas continuam bloqueadas para escolha direta. Recuperação nesses casos exige backup JSON externo.
- O controlador atualiza a memória e o backup de pasta **somente após** a confirmação das gravações. Falhas são registradas apenas como códigos técnicos.
