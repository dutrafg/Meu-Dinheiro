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
