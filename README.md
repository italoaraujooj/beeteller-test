<p align="center">
  <a href="http://nestjs.com/" target="blank"><img src="https://nestjs.com/img/logo-small.svg" width="120" alt="Nest Logo" /></a>
</p>

<h1 align="center">PIX-BEETELLER-API</h1>

<p align="center">
  Uma API para coleta de mensagens Pix, desenvolvida como parte de um desafio técnico.
</p>

## Descrição

A **PIX-BEETELLER-API** é uma aplicação backend construída com [NestJS](https://nestjs.com/) (Node.js) e TypeScript, projetada para simular a coleta e o gerenciamento de mensagens Pix em um cenário de alto volume e escalabilidade. Este projeto tem como base as especificações da Interface de Comunicação do SPI (Sistema de Pagamentos Instantâneos) do Banco Central do Brasil.

O objetivo principal é implementar um mecanismo avançado para o gerenciamento de *streams* de mensagens, garantindo a entrega única, controle de concorrência e funcionalidades de *long polling*, conforme detalhado nos requisitos do desafio.

### Formato dos Dados

**Nota sobre Campos Monetários:**
O campo `valor` nas mensagens Pix é retornado como uma **string** para garantir a máxima precisão monetária (ex: `"valor": "123.45"`). Os clientes desta API devem estar preparados para tratar este campo como uma string e, se necessário, convertê-lo para um tipo Decimal ou BigNumber apropriado em sua própria lógica para realizar cálculos.

## Tecnologias Utilizadas

* **Backend:** [NestJS](https://nestjs.com/) (Node.js)
* **Linguagem:** [TypeScript](https://www.typescriptlang.org/)
* **Banco de Dados:** [PostgreSQL](https://www.postgresql.org/)
* **ORM:** [TypeORM](https://typeorm.io/) (a ser integrado)
* **Testes:** Jest (para testes unitários e e2e)

## Pré-requisitos

Antes de começar, você precisará ter instalado em sua máquina:
* [Node.js](https://nodejs.org/) (versão recomendada: >= 18.x)
* [npm](https://www.npmjs.com/) ou [yarn](https://yarnpkg.com/)
* [PostgreSQL](https://www.postgresql.org/download/) (ou uma instância Docker rodando)
* [Git](https://git-scm.com/)

## Configuração do Projeto (Setup)

1.  **Clone o repositório:**
    ```bash
    $ git clone https://github.com/italoaraujooj/beetellet-test.git
    $ cd PIX-BEETELLER-API
    ```

2.  **Instale as dependências:**
    ```bash
    $ npm install
    ```
    ou
    ```bash
    $ yarn install
    ```

3.  **Configuração do Ambiente:**
    * Crie um arquivo `.env` na raiz do projeto, baseado no arquivo `.env.example` (que você deverá criar).
    * Preencha as variáveis de ambiente necessárias, especialmente para a conexão com o banco de dados PostgreSQL:
        ```env
        # Exemplo de variáveis para .env
        DB_HOST=localhost
        DB_PORT=5432
        DB_USERNAME=seu_usuario_pg
        DB_PASSWORD=sua_senha_pg
        DB_DATABASE=pix_beeteller_db
        PORT=3000
        ```
    * Certifique-se de que o banco de dados `pix_beeteller_db` (ou o nome que você escolher) exista na sua instância PostgreSQL.

## Rodando a Aplicação

1.  **Modo de Desenvolvimento (com watch):**
    ```bash
    $ npm run start:dev
    ```
    ou
    ```bash
    $ yarn start:dev
    ```
    A aplicação estará disponível em `http://localhost:3000` (ou a porta configurada no `.env`).

2.  **Produção (build e execução):**
    ```bash
    # Para criar o build de produção
    $ npm run build

    # Para rodar a aplicação em modo de produção
    $ npm run start:prod
    ```

## Testes

1.  **Testes Unitários:**
    ```bash
    $ npm run test
    ```
    ou
    ```bash
    $ yarn test
    ```

2.  **Testes End-to-End (e2e):**
    ```bash
    $ npm run test:e2e
    ```
    ou
    ```bash
    $ yarn test:e2e
    ```
    *Nota: Os testes e2e podem requerer um banco de dados de teste configurado.*

3.  **Cobertura de Testes:**
    ```bash
    $ npm run test:cov
    ```
    ou
    ```bash
    $ yarn test:cov
    ```

## Visão Geral da API (Endpoints Principais)

* `POST /api/util/msgs/{ispb}/{number}`: Endpoint utilitário para popular o banco com mensagens Pix de teste.
* `GET /api/pix/{ispb}/stream/start`: Inicia um novo *stream* para coleta de mensagens Pix.
* `GET /api/pix/{ispb}/stream/{interationId}`: Continua um *stream* existente para coleta de mensagens.
* `DELETE /api/pix/{ispb}/stream/{interationId}`: Finaliza um *stream* de coleta.

*(Mais detalhes sobre os parâmetros, headers e corpos de resposta/requisição serão adicionados conforme o desenvolvimento.)*

## Estrutura do Projeto e Decisões de Design

*(Esta seção será preenchida com explicações sobre as escolhas de arquitetura, organização de pastas e outras decisões técnicas relevantes tomadas durante o desenvolvimento do desafio.)*

## License

Este projeto está licenciado sob os termos da licença MIT. Veja o arquivo [LICENSE](LICENSE) para mais detalhes (o NestJS geralmente inclui um arquivo LICENSE.md, caso contrário, você pode adicionar um padrão MIT).

---

<p align="center">
  Desenvolvido para o desafio técnico da empresa Beeteller, feito por Italo Ramalho.
</p>