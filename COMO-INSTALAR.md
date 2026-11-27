<img src="public/logo.svg" width="56" alt="Logo do Esquisso">

# Esquisso: instalar noutro computador

Precisa de dois programas gratuitos (Node.js e Git) e de entrar na sua conta do
GitHub. A instalação demora cerca de 15 minutos e só se faz uma vez. Depois de
instalada, a aplicação funciona sem internet.

## O que vai precisar

| O quê | Para quê | Onde |
| --- | --- | --- |
| Node.js (versão LTS, 20 ou mais recente) | Corre a aplicação | [nodejs.org](https://nodejs.org) |
| Git | Descarrega o código e as atualizações | [git-scm.com](https://git-scm.com/downloads) |
| Conta GitHub (werlacher) | O código está no repositório werlacher/Repo | [github.com](https://github.com) |
| Chrome ou Edge | O botão Save grava diretamente no ficheiro | Já instalado na maioria dos PCs |

## Instalar no Windows

1. **Instalar o Node.js.** Abra [nodejs.org](https://nodejs.org), descarregue a
   versão **LTS** e instale-a com as opções por defeito.
2. **Instalar o Git.** Abra [git-scm.com/downloads](https://git-scm.com/downloads),
   descarregue a versão para Windows e instale-a com as opções por defeito.
3. **Abrir o PowerShell.** Carregue na tecla Windows, escreva `PowerShell` e
   carregue em Enter. Se já estava aberto, feche-o e abra de novo.
4. **Confirmar a instalação.** Escreva `node -v` e depois `git --version`. Cada
   um deve mostrar um número de versão (o do Node começa por v20 ou mais).
5. **Descarregar a aplicação:**
   ```
   cd $HOME
   git clone https://github.com/werlacher/Repo.git
   ```
   Se aparecer uma janela do GitHub, entre com a sua conta e autorize. A
   aplicação fica em `C:\Users\<o seu nome>\Repo`.
6. **Instalar as dependências** (só na primeira vez, 1 a 2 minutos):
   ```
   cd Repo
   npm.cmd install
   ```
7. **Criar o atalho:** na pasta Repo, faça duplo clique em
   `create-shortcut.bat`. Aparece no Ambiente de Trabalho um atalho
   **Esquisso** com o logo.
8. **Arrancar:** duplo clique no atalho. O browser abre em
   `http://127.0.0.1:5173`. A janela preta fica minimizada; não a feche
   enquanto trabalha.

**Sem Git:** no GitHub, abra werlacher/Repo, carregue em **Code › Download ZIP**,
extraia o ZIP e siga a partir do passo 6. Para atualizar terá de descarregar o
ZIP outra vez.

## Instalar num Mac

1. Instale o Node.js **LTS** a partir de [nodejs.org](https://nodejs.org).
2. Abra o **Terminal** e escreva `git --version`. Se o Mac pedir para instalar
   as ferramentas de linha de comandos, aceite.
3. Descarregue, instale e arranque:
   ```
   cd ~
   git clone https://github.com/werlacher/Repo.git
   cd Repo
   npm install
   npm start
   ```
   Se o Git pedir a password do GitHub, use um token de acesso (GitHub ›
   Settings › Developer settings › Personal access tokens).
4. Para arrancar sem Terminal use `start-mac.command`. Na primeira vez, abra-o
   com botão direito › Abrir.

## Usar no dia a dia e atualizar

**Arrancar:** duplo clique no atalho Esquisso (ou em `start-windows.bat`).

**Receber versões novas:**

1. Feche a aplicação (feche a janela preta).
2. No PowerShell:
   ```
   cd $HOME\Repo
   git pull
   npm.cmd install
   ```
3. Arranque pelo atalho e carregue em Ctrl+F5 no browser.

## Levar os seus diagramas

Os diagramas não vêm com o `git clone`: ficam no computador onde os fez.

1. No computador antigo, abra cada diagrama e use **File › Save**. Fica um
   ficheiro `.esquisso.json` (os antigos `.flowboard.json` também abrem).
2. Copie esses ficheiros para o computador novo (pen USB, OneDrive, email).
3. No computador novo, use **File › Open…**.

A cópia automática no browser só existe nesse browser e nesse computador. Não
conte com ela como cópia de segurança.

## Problemas comuns

| O que aparece | O que fazer |
| --- | --- |
| "running scripts is disabled on this system" | Use `npm.cmd` em vez de `npm`, ou o atalho. |
| "node", "npm" ou "git" não é reconhecido | Feche e volte a abrir o PowerShell. Se continuar, reinstale o programa. |
| "Repository not found" no `git clone` | Entre na conta werlacher do GitHub quando a janela aparecer. |
| "Could not read package.json" | Não está na pasta certa: escreva `cd $HOME\Repo` primeiro. |
| Página em branco | Use `http://127.0.0.1:5173`; não abra o `index.html` com duplo clique. |
| Não vejo as novidades | Faça `git pull`, arranque de novo e carregue em Ctrl+F5. |
| Abre em 127.0.0.1:5174 em vez de 5173 | A aplicação já está aberta noutra janela. Use essa, ou feche-a. |
| O atalho não aparece | Corra `create-shortcut.bat` outra vez e leia a mensagem que mostra. |
