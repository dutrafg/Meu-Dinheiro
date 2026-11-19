# Meu Dinheiro

Aplicativo financeiro pessoal simples, responsivo e instalável como PWA (Progressive Web App), preparado para publicar na Vercel e no GitHub Pages.

## Áreas do aplicativo

- **Resumo:** visão financeira, últimas transações e dois gráficos de gastos por categoria em um único card.
- **Renda:** salário base, Personal e demais entradas; lembretes de aporte de 10% para as duas fontes de salário.
- **Despesas:** lançamentos e categorias de gastos.
- **Metas:** reserva, objetivos de economia e estimativa ilustrativa de CDB a 100% do CDI a partir de dados do Banco Central.
- **Sonho:** acompanhamento de objetivos pessoais.

O aplicativo também oferece importação e exportação CSV, backup/restauração JSON, **backup automático em pasta escolhida no computador** e confirmação obrigatória de Reserva, Meta ou Sonho para aplicações identificadas no extrato bancário.

## Atualizações do aplicativo

O aplicativo instalado no navegador verifica automaticamente se há novas versões **ao abrir, ao voltar para a aba e periodicamente enquanto estiver em uso**. Um ponto azul nos três pontos (`⋯`) do cabeçalho e um aviso informam quando existe uma versão pronta. Abra o menu e toque em **Atualizar agora** para ativá-la. A página **só é recarregada após sua confirmação**, para não interromper formulários em andamento; salve lançamentos ainda não enviados antes de atualizar.

O menu oferece também **Verificar atualizações** para consultar manualmente. O atualizador usa o Service Worker do PWA: requer HTTPS ou `localhost`, e funciona após uma primeira instalação online. Ele atualiza arquivos da interface **sem apagar os registros do navegador**. Na prévia HTML única, aberta como arquivo local, esse recurso não funciona. Uma versão nova só será detectada se sua publicação atualizar `dist/sw.js` e sua versão de cache.

## Estrutura modular do código

O aplicativo continua sendo um PWA estático, sem etapa de compilação. A página `dist/index.html` contém a estrutura HTML e os diálogos; `dist/app.js` inicializa os serviços, o estado local e os controladores. As telas, o backup e o CSV agora ficam em arquivos independentes em `dist/modules/`.

| Área | Arquivo principal |
| --- | --- |
| Resumo e gráficos | `dist/modules/resumo.js` |
| Renda e Despesas | `dist/modules/lancamentos.js` |
| Metas, Reserva e Sonho | `dist/modules/objetivos.js` |
| Backup JSON e pasta do PC | `dist/modules/backup.js` |
| Importação/exportação CSV | `dist/modules/csv-interface.js` |
| Validação e recuperação de dados | `dist/modules/validacao.js` |
| Verificação de versões e aviso de atualização | `dist/modules/atualizador.js` + `dist/sw.js` |
| Aparência, layout e responsividade | `dist/css/` (carregado por `dist/prototype.css`) |
| Estado, persistência, navegação e lembretes | `dist/app.js` |

Consulte [ARQUITETURA.md](ARQUITETURA.md) antes de alterar um módulo. Mantenha o formato de dados e o fluxo de gravação sem mudanças silenciosas: usuários existentes precisam continuar acessando seus lançamentos e seus arquivos de backup.

## Salvar automaticamente em uma pasta do PC

1. Abra o aplicativo no **Chrome ou Edge no computador** (HTTPS ou `localhost`).
2. Clique nos três pontos (`⋯`) no cabeçalho e selecione **Escolher pasta de dados**.
3. Escolha uma pasta que será usada pelo aplicativo e autorize a gravação.
4. A partir de então, cada alteração bem-sucedida nos dados é salva automaticamente no arquivo `meu-dinheiro-dados.json`, após uma pequena pausa de 350 ms. Uma cópia do dia também fica em `historico/`.

O acesso à pasta é lembrado no navegador, mas a permissão de escrita pode expirar: nesse caso, um indicador aparece no botão de backup e o menu oferece **Reautorizar / salvar agora**. Se a pasta já contiver um backup com dados diferentes, o aplicativo **pede confirmação** e preserva uma cópia do arquivo anterior antes de substituí-lo. Se alguém editar o arquivo fora do app enquanto ele estiver aberto, a gravação é interrompida para evitar perda de dados.

O backup contém receitas, despesas, metas, reservas, sonhos, aplicações e lembretes de aportes. Ele usa o **mesmo formato JSON** da opção **Restaurar backup (JSON)**. Os arquivos não são criptografados: mantenha a pasta em local seguro. A sincronização por pasta é específica de cada navegador e origem; as versões Vercel e GitHub Pages mantêm dados locais e permissões separados. Em navegadores sem acesso direto a pastas, o backup manual JSON continua disponível.

## Privacidade

Os lançamentos e lembretes ficam no armazenamento local do navegador. Quando o backup em pasta está ativado, uma cópia é gravada no diretório escolhido; o aplicativo não envia esses arquivos a um servidor próprio. O código público **não contém extratos, saldos ou dados financeiros pessoais**. Os arquivos CSV e JSON são processados no dispositivo. Ao trocar de aparelho ou de domínio, use o backup JSON para transportar os dados.

## Executar e testar localmente

Requer Node.js para os testes e qualquer servidor de arquivos estáticos para abrir a PWA:

```bash
node --test tests/*.test.cjs
python -m http.server 4173 --directory dist
```

Acesse `http://localhost:4173`. O modo offline depende da instalação inicial do service worker, servido em `localhost` ou HTTPS.

## Publicação na Vercel

Conecte este repositório a um projeto Vercel com a branch de produção `main`. O arquivo `vercel.json` seleciona o conteúdo estático de `dist/`, sem etapa de compilação. Após a publicação HTTPS, o app pode ser instalado pelo navegador como PWA.

## Publicação no GitHub Pages

O fluxo `.github/workflows/pages.yml` publica os arquivos de `dist/` diretamente na raiz do GitHub Pages, ao atualizar a branch `main`. Para habilitar o fluxo, em **Settings → Pages → Build and deployment → Source**, selecione **GitHub Actions**.

Enquanto o Pages estiver configurado para publicar a raiz da branch, o `index.html` da raiz encaminha automaticamente para o aplicativo em `dist/`, sem mostrar o README.

## Testes automáticos

Os testes são executados com `node --test tests/*.test.cjs`. O workflow do GitHub verifica o código em atualizações da branch `main` e em pull requests.

Para gerar uma cópia HTML única de homologação, sem dependências de servidor:

```bash
node scripts/gerar-html-teste.cjs meu-dinheiro-teste.html
```

Essa cópia abre offline como arquivo HTML, mas **não instala o PWA nem recebe atualizações por Service Worker**. Para usar os recursos instaláveis e o atualizador, sirva a pasta `dist/` em HTTPS ou `localhost`.
