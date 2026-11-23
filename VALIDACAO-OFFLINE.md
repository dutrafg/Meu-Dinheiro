# Validação offline — Meu Dinheiro v65

Este roteiro usa **somente dados fictícios**. A homologação não autoriza publicação nem substitui backup real.

## A) Arquivo HTML independente — celular ou PC

1. Baixe `Meu-Dinheiro-v65-Mobile-Offline.html` para o dispositivo e guarde uma cópia antes de começar.
2. Ative **modo avião**, desligando Wi-Fi e dados móveis. No PC, desconecte a internet.
3. Abra o arquivo no navegador pelo gerenciador de arquivos. Alguns celulares restringem HTML local; se isso acontecer, teste no PC ou outro navegador e registre a limitação.
4. Toque em **Executar diagnóstico completo**, aguarde até a mensagem "Diagnóstico concluído" (animação de até 25 segundos) e expanda o grupo **offline**.
5. Os testes `OFFLINE_HTML_*` devem estar verdes: scripts e estilos embutidos, bibliotecas presentes e nenhuma dependência obrigatória da internet.
6. Cadastre uma renda e despesa **fictícias**, navegue entre Resumo, Renda, Despesas, Objetivos e Ajustes; feche e reabra o arquivo. Verifique se os lançamentos permanecem, conforme as permissões do navegador.
7. Em Ajustes, exporte uma cópia JSON fictícia, verifique que o arquivo existe e recupere a cópia **somente em perfil/dispositivo de testes**. Não use a restauração com dados reais existentes.

## B) PWA instalado — celular ou PC

1. Com internet, abra a versão v65 da **branch de homologação**, aguarde o Service Worker ativar e atualize a página uma vez.
2. Em **Ajustes → Executar diagnóstico completo**, verifique o grupo **offline**: entrada, aplicação, estilos, manifesto, ícones, persistência, validação, notificações e diagnóstico em cache; `OFFLINE_CACHE_INTEGRIDADE` deve indicar sucesso.
3. Se `OFFLINE_CACHE_VERSAO` alertar versão diferente, conclua a atualização e repita online antes de cortar a conexão.
4. Use apenas lançamentos fictícios, habilite modo avião, feche a aba/PWA e abra novamente sem internet. Resumo, Renda, Despesas, Objetivos, previsões e diagnóstico devem abrir; não dependa do CDI remoto.
5. Execute novamente o diagnóstico ainda desconectado, registre aviso/erro por código, sem compartilhar JSON contendo dados pessoais (o relatório já omite valores e nomes).
6. Reconecte e reabra. Verifique que todos os registros fictícios ainda existem e que não houve duplicação, inclusive de parcelas/contas.
7. Valide backup JSON, restauração e recuperação IndexedDB com dados fictícios, em ambiente isolado, **antes** de encerrar P0.5 e P2.6.

## Interpretação

| Situação | Ação recomendada |
| --- | --- |
| `OFFLINE_CACHE_*` aviso | Reconectar, instalar/atualizar o PWA e reexecutar. Sem isso não declarar offline pronto. |
| `OFFLINE_HTML_*` erro | Baixar novamente o HTML inteiro e abrir como arquivo local. |
| `SW_ATIVO` ou `SW_CONTROLE` aviso | Aguardar instalação, recarregar conectado e inspecionar novamente. |
| `RISCO_OFFLINE_EVICCAO_DADOS` aviso | Não é perda detectada: navegador pode limpar dados por espaço. Fazer backups externos regulares. |
| `ESPELHO_INDEXEDDB` ou `GRAVACAO_SEGURA` erro | Não insistir em gravar. Exportar backups independentes e acionar fluxo de recuperação. |

**Critério para concluir:** Node + Chromium em CI, testes manuais offline e de backup/restauração em dispositivo físico, e confirmação do responsável antes de publicar na `main`.
