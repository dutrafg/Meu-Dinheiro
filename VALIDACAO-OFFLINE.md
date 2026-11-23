# Validação offline — Meu Dinheiro v68 (P4.2)

Este roteiro usa **somente dados fictícios em perfil de navegador separado, sem dados financeiros reais**. A v68 já foi publicada em `main` por autorização expressa, mas a homologação física de armazenamento e backup continua aberta. Para testes que criam/restauram registros fictícios, prefira a prévia em domínio separado.

## A) Arquivo HTML independente — celular ou PC

1. Baixe `Meu-Dinheiro-v68-Diagnostico-Direto-Offline.html` para o dispositivo e guarde uma cópia antes de começar.
2. Ative **modo avião**, desligando Wi-Fi e dados móveis. No PC, desconecte a internet.
3. Abra o arquivo no navegador pelo gerenciador de arquivos. Alguns celulares restringem HTML local; se isso acontecer, teste no PC ou outro navegador e registre a limitação.
4. Toque em **Executar diagnóstico completo** (no início do arquivo ou diretamente em Ajustes, sem abrir Atualizações), aguarde até "Diagnóstico concluído" (animação de até 25 segundos) e expanda os grupos **offline** e **proposta interface**.
5. Os testes `OFFLINE_HTML_*` devem estar verdes: scripts e estilos embutidos, bibliotecas presentes e nenhuma dependência obrigatória da internet.
6. Confirme que `PROPOSTA_AJUSTES_DIAGNOSTICO_DIRETO` está **ok**. Cadastre uma renda e despesa **fictícias**, navegue entre Resumo, Renda, Despesas, Objetivos e Ajustes; feche e reabra o arquivo. Verifique se os lançamentos permanecem, conforme as permissões do navegador.
7. Em **Relatórios → Exportar, importar e compartilhar**, baixe uma cópia JSON fictícia, confira que existe e recupere a cópia **somente em perfil/dispositivo de testes**. Não restaure sobre dados financeiros reais.

## B) PWA instalado — celular ou PC

1. Com internet, prefira a **prévia isolada v68** em https://meu-dinheiro-git-feature-p4-2-diagnostico-direto-v68-dutra8.vercel.app para testar com registros fictícios. Esta prévia está protegida pelo login da Vercel do proprietário; não desative essa proteção. O domínio é diferente do principal, de modo que o armazenamento local fica separado. Aguarde o Service Worker ativar e recarregue uma vez. O HTML independente `file://`/`content://` não substitui este teste do PWA; a versão em produção também é v68, mas não use o domínio principal para experiências de restauração.
2. Em **Ajustes**, toque no botão visível **Executar diagnóstico completo**, sem expandir Atualizações; verifique os grupos **offline** e **proposta interface**. Entrada, scripts, CSS, manifesto, ícones, persistência, validação, notificações e diagnóstico devem estar em cache; `OFFLINE_CACHE_INTEGRIDADE` e `PROPOSTA_AJUSTES_DIAGNOSTICO_DIRETO` devem indicar sucesso.
3. Se `OFFLINE_CACHE_VERSAO` alertar versão diferente, conclua a atualização e repita online antes de cortar a conexão.
4. Use apenas lançamentos fictícios, habilite modo avião, feche a aba/PWA e abra novamente sem internet. Resumo, Renda, Despesas, Objetivos, previsões e diagnóstico devem abrir; não dependa do CDI remoto.
5. Execute novamente o diagnóstico ainda desconectado. Registre os códigos e estados de aviso/erro; revise o JSON antes de compartilhar e não envie backups com valores financeiros.
6. Reconecte e reabra. Verifique que todos os registros fictícios ainda existem e que não houve duplicação, inclusive de parcelas/contas.
7. Em **Relatórios**, exporte um backup JSON e confira que está no dispositivo. Valide a restauração e a recuperação IndexedDB com dados fictícios, em ambiente isolado, **antes** de encerrar P0.5 e P2.6. Se o navegador impedir download ou permissão, anote a limitação.

## Checklist físico para P4.2

- [x] Diagnóstico direto em Ajustes reportado como `ok` no HTML independente do Samsung (v68).
- [x] Diagnóstico do HTML independente executou `OFFLINE_HTML_*` sem erros no Samsung (v68); confirmar manualmente o modo avião continua sendo recomendado.
- [ ] PWA instalado abriu e navegou após modo avião e reinicialização.
- [ ] Após reconectar, os registros **fictícios** permaneceram sem duplicações.
- [ ] Cópia JSON de teste exportada para fora do navegador e restauração testada em ambiente isolado.
- [ ] Nenhuma divergência entre IndexedDB e espelho local após gravar e reabrir.

Envie apenas os **códigos/estados do diagnóstico** e quais itens foram validados. Não é necessário mandar extratos ou backup com dados financeiros reais.

## Interpretação

| Situação | Ação recomendada |
| --- | --- |
| `OFFLINE_CACHE_*` aviso | Reconectar, instalar/atualizar o PWA e reexecutar. Sem isso não declarar offline pronto. |
| `OFFLINE_HTML_*` erro | Baixar novamente o HTML inteiro e abrir como arquivo local. |
| `SW_ATIVO` ou `SW_CONTROLE` aviso | Aguardar instalação, recarregar conectado e inspecionar novamente. |
| `RISCO_OFFLINE_EVICCAO_DADOS` aviso | Não é perda detectada: navegador pode limpar dados por espaço. Fazer backups externos regulares. |
| `ESPELHO_INDEXEDDB` ou `GRAVACAO_SEGURA` erro | Não insistir em gravar. Exportar backups independentes e acionar fluxo de recuperação. |

**Critério para concluir P4.2:** Node + Chromium em CI, testes manuais offline e de backup/restauração em dispositivo físico e sua confirmação explícita. A v68 foi publicada com sua autorização; isso não encerra a homologação física nem substitui backup externo.
