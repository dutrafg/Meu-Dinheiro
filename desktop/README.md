# Meu Dinheiro — Windows nativo (x64)

Esta versão mantém a interface e as cinco áreas do PWA, mas executa em uma janela Windows com WebView2, empacotada pelo Tauri 2. **É um aplicativo de desktop com núcleo nativo Rust**, não uma reescrita dos componentes visuais em WinUI/WPF.

## Dados locais

- Banco principal: **SQLite** (`meu-dinheiro.sqlite3`) no diretório privado de dados do aplicativo (`%APPDATA%/br.com.dutrafg.meudinheiro/` no Windows). Operações atômicas e modo WAL.
- A interface mantém um cache para recuperação, mas na inicialização o **SQLite é a referência principal**. Se houver uma gravação interrompida, o usuário pode recuperar o último estado.
- Menu **⋯ → Escolher pasta de dados**: abre o seletor nativo do Windows e salva também `meu-dinheiro-dados.json` na pasta escolhida a cada modificação. Cópia diária em `historico/`. O programa avisa se a pasta não estiver disponível ou o arquivo for alterado externamente; não substitui dados diferentes sem confirmação e cópia anterior.
- Importação/exportação CSV, backup/restauração JSON, rendas, despesas, reserva, sonhos, gráficos e lembretes de 10% são reutilizados da versão web.
- O SQLite e os JSONs **não são criptografados** nesta primeira versão. Proteja sua conta de usuário e a pasta de backups.

Os dados do PWA no Chrome ou na Vercel **não aparecem automaticamente** no Windows: no PWA, use **⋯ → Backup completo (JSON)** e no desktop **⋯ → Restaurar backup (JSON)** para migrar. Os arquivos pessoais não devem ser enviados ao repositório.

## Gerar o instalador no Windows 11 x64

Requer [Microsoft C++ Build Tools, WebView2 e Rust](https://v2.tauri.app/start/prerequisites/), além de Node.js 22+.

```powershell
cd desktop
npm install
npm run build
```

O instalador estará em `desktop/src-tauri/target/release/bundle/nsis/*-setup.exe`. A configuração instala para o usuário atual, sem exigir privilégios administrativos. O instalador ainda **não possui assinatura de código**: o SmartScreen pode exibir um alerta.

## Compilação automática

O workflow `windows-native.yml` compila no runner oficial Windows x64 do GitHub Actions ao atualizar a branch `windows-native` ou executá-lo manualmente. O arquivo `.exe` fica disponível como **artifact `Meu-Dinheiro-Windows-x64`** na execução correspondente. Nenhuma publicação em Releases ou na branch `main` é automática nesta etapa.

## Estrutura

- `src-tauri/src/main.rs`: banco SQLite, gravação, diálogo de pasta, backups seguros.
- `native-bridge.js`: comunicação entre JavaScript e comandos Rust, recuperação de pendências.
- `scripts/prepare-frontend.cjs`: gera `frontend/` com o visual original adaptado para desktop, sem alterar `dist/` usado por Vercel/GitHub Pages.
- `src-tauri/tauri.conf.json`: janela, ícones e instalador NSIS.

Os ícones `.ico` e `.png` para o executável são gerados automaticamente a partir do `dist/icon-512.png` original durante o build; os binários gerados não entram no Git.

Testes da ponte JavaScript e geração do frontend: `node --test tests/*.test.cjs` na raiz. Os testes Rust (`cargo test`) e a compilação do instalador são executados no Windows. A escolha de pasta e o instalador precisam de validação real num PC Windows antes de declarar a versão estável.
