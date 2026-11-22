# Persistência — Meu Dinheiro

## Estado da migração (P0 — etapa 1)

O armazenamento oficial do PWA continua na chave legada "meu-dinheiro-essencial:v1" do localStorage. O código desta branch cria **um espelho assíncrono** em IndexedDB ("meu-dinheiro-financeiro" / "snapshots" / "principal").

**Ainda não é uma migração concluída para IndexedDB como fonte primária.** Não remover a chave legada nem anunciar que a migração está finalizada.

### Protocolo desta etapa

1. Na inicialização, ler e validar os dados legados existentes. Apenas um conjunto válido pode ser espelhado; nunca corrigir dados silenciosamente.
2. Ao salvar, gravar no localStorage pelo caminho legado e enfileirar a cópia idêntica no IndexedDB, preservando a ordem de gravação.
3. Uma falha do espelho não invalida a gravação legada já confirmada; é registrada como aviso técnico sem expor valores.
4. A exclusão com dupla confirmação primeiro pausa o backup externo, aguarda/apaga o espelho e só depois remove a chave legada. Se o espelho falhar, não confirmar a exclusão.
5. O diagnóstico compara as cópias apenas quando o usuário executa o diagnóstico completo. O JSON registra somente estados, nunca registros financeiros.
6. Não restaurar automaticamente uma cópia do IndexedDB quando localStorage estiver vazio: isso poderia ressuscitar dados que foram apagados em uma versão anterior.

### Etapas para converter IndexedDB em fonte primária

- P0.2: introduzir um repositório assíncrono com transações de leitura/escrita e revisão de todos os pontos de gravação; não confirmar sucesso de uma operação até ocorrer transaction.oncomplete.
- P0.3: migração idempotente com marcadores de versão, testes de queda entre gravações, resolução explícita de conflitos e tombstone de exclusão entre abas; a origem legada fica como backup de compatibilidade.
- P0.4: converter backup/restauração, importação CSV/OFX, limpeza, diagnóstico e HTML standalone para usar o repositório; testar com 1.000 e 10.000 registros.
- P0.5: retirar escrita financeira em localStorage **somente após** validação no PWA real, testes de recuperação e homologação com backup exportado.

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
- **P0.3c2 ainda pendente:** decisão explícita, restauração transacional e testes de retomada, sem ressuscitar tombstones por acidente.

## P0.3c2 — Recuperação transacional escolhida (v49)

- A seleção só é habilitada após a inspeção de **duas cópias válidas e divergentes** e a solicitação de ambos os downloads JSON.
- A origem é escolhida manualmente, seguida de **duas confirmações**; nenhuma resolução automática é realizada.
- O IndexedDB aplica a escolha em transação `readwrite` com comparação da versão exata previamente inspecionada, e confirma apenas em `transaction.oncomplete`.
- Em seguida, a chave legada é sincronizada. Se a chave local mudar entre inspeção e confirmação ou a escrita falhar, o processo não declara sucesso e exige nova inspeção; os arquivos externos precisam ser preservados.
- Tombstone de exclusão, versões desconhecidas e cópias inválidas continuam bloqueadas para escolha direta. Recuperação nesses casos exige backup JSON externo.
- O controlador atualiza a memória e o backup de pasta **somente após** a confirmação das gravações. Falhas são registradas apenas como códigos técnicos.
