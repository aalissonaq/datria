# Datria — Linha de Base de Engenharia

> **Aviso**: **Datria** é um codinome temporário de projeto. O branding definitivo e o nome comercial do produto serão definidos e validados em iterações posteriores.

---

## 1. Visão Geral e Arquitetura do Monorepo

O Datria está estruturado como um monorepo TypeScript leve utilizando **pnpm workspaces**. O sistema inicia como um monólito modular com isolamento rigoroso de fronteiras.

```text
datria/
├── apps/
│   ├── api/                 # Backend API (monólito modular em NestJS)
│   └── web/                 # Aplicação web cliente (React + Vite)
├── packages/
│   ├── eslint-config/       # Preset compartilhado de ESLint 9
│   └── tsconfig/            # Presets compartilhados de TypeScript
├── prisma/
│   └── schema.prisma        # Esquema raiz do banco de dados Prisma (MySQL)
├── tests/
│   └── e2e/                 # Testes de fumaça ponta a ponta com Playwright
├── .github/
│   └── workflows/ci.yml     # Pipeline automatizada de CI com serviço MySQL
├── .env.example             # Modelo seguro para variáveis de ambiente locais
├── .node-version            # Fixação do runtime (Node.js 24 LTS)
└── pnpm-workspace.yaml      # Configuração de workspaces do monorepo
```

### Fronteiras dos Workspaces e Regras de Dependência

- **`apps/web`**: Responsável pela renderização no navegador, interface do usuário (UI) e estado do cliente. Comunica-se com o `apps/api` exclusivamente via HTTP através dos contratos documentados em OpenAPI. Importações diretas de código ou módulos do `apps/api` são estritamente proibidas.
- **`apps/api`**: Responsável pela lógica de servidor, endpoints da API, documentação OpenAPI, validação em tempo de execução e persistência de dados via Prisma. NÃO DEVE depender de pacotes de navegador ou de código frontend.
- **`packages/*`**: Exclusivamente para políticas de build e qualidade compartilhadas (`@datria/tsconfig`, `@datria/eslint-config`). Implementações de domínio e lógica de negócio são mantidas desacopladas neste incremento.
- **`prisma/`**: Localizado na raiz para manter a fonte de dados MySQL e um histórico único e versionado de migrações.

---

## 2. Pré-requisitos

As seguintes versões de software são necessárias na estação de trabalho:

- **Node.js**: `v24.x` (LTS)
- **pnpm**: `>= 10.0.0` (Recomendado: `11.25.0`)
- **Git**: `>= 2.40.0`
- **MySQL**: Servidor compatível com a versão 8.0+. Em estações de desenvolvimento local, o **MySQL do XAMPP** rodando em `localhost:3306` é o padrão suportado.

Para verificar as versões instaladas:

```bash
node --version
pnpm --version
git --version
```

---

## 3. Início Rápido e Configuração Local

### Passo 1: Instalar Dependências

```bash
pnpm install --frozen-lockfile
```

### Passo 2: Configurar o Ambiente

Copie o arquivo `.env.example` para `.env`:

```bash
# Windows PowerShell:
Copy-Item .env.example .env

# Linux / macOS:
cp .env.example .env
```

Certifique-se de que a variável `DATABASE_URL` corresponda ao seu serviço MySQL local (por exemplo, `mysql://root:@localhost:3306/datria_dev`).

### Passo 3: Iniciar o MySQL no XAMPP

1. Abra o **XAMPP Control Panel**.
2. Inicie o módulo **MySQL** (porta padrão `3306`).
3. Crie um banco de dados de desenvolvimento vazio chamado `datria_dev`.

### Passo 4: Executar o Ambiente de Desenvolvimento

```bash
pnpm dev
```

- **Cliente Web**: [http://localhost:5173](http://localhost:5173)
- **API (Liveness)**: [http://localhost:3000/api/v1/health/live](http://localhost:3000/api/v1/health/live)
- **API (Readiness)**: [http://localhost:3000/api/v1/health/ready](http://localhost:3000/api/v1/health/ready)
- **Documentação OpenAPI (Swagger)**: [http://localhost:3000/api/v1/docs](http://localhost:3000/api/v1/docs)

---

## 4. Comandos de Verificação de Qualidade

Todos os comandos de qualidade podem ser executados a partir da raiz do repositório e cobrem todos os workspaces:

| Comando             | Objetivo                                                               |
| ------------------- | ---------------------------------------------------------------------- |
| `pnpm format:check` | Verifica a formatação do código com o Prettier                         |
| `pnpm format:write` | Formata automaticamente todos os arquivos com o Prettier               |
| `pnpm lint`         | Executa o ESLint em todos os workspaces                                |
| `pnpm typecheck`    | Executa a checagem estrita de tipos do TypeScript sem emitir arquivos  |
| `pnpm test`         | Executa testes unitários e de integração (Vitest na web e Jest na API) |
| `pnpm test:mysql`   | Valida a consulta real de prontidão contra o MySQL configurado         |
| `pnpm build`        | Gera os pacotes de produção de todas as aplicações e bibliotecas       |
| `pnpm test:e2e`     | Executa os testes de fumaça ponta a ponta com o Playwright             |

---

## 5. Contratos de Saúde e Prontidão

A API disponibiliza endpoints de observabilidade em conformidade com o contrato em `contracts/health.openapi.yaml`:

- `GET /api/v1/health/live`: Verificação de vivacidade do processo (_liveness_). Retorna HTTP 200 `{ status: "ok", service: "datria-api", timestamp }` enquanto o processo Node.js estiver responsivo.
- `GET /api/v1/health/ready`: Verificação de prontidão das dependências (_readiness_). Executa uma consulta delimitada `SELECT 1` no MySQL. Retorna HTTP 200 `{ status: "ok", checks: { database: "up" } }` quando o banco estiver acessível, ou HTTP 503 `{ status: "unavailable", checks: { database: "down" } }` caso o MySQL esteja indisponível. As respostas nunca expõem credenciais, dados do host ou rastreamento de pilha (_stack traces_).

---

## 6. Integração Contínua (CI)

Todas as propostas de alteração e envios de código são validados automaticamente pelo GitHub Actions (`.github/workflows/ci.yml`), garantindo:

1. Instalação reproduzível a partir do lockfile congelado (`--frozen-lockfile`)
2. Verificação de formatação (`pnpm format:check`)
3. Análise estática de código (`pnpm lint`)
4. Checagem estrita de tipos (`pnpm typecheck`)
5. Testes unitários e contratuais (`pnpm test`) e integração real com o container MySQL 8 (`pnpm test:mysql`)
6. Build de produção de todos os workspaces (`pnpm build`)
7. Testes de fumaça E2E com Playwright (`pnpm test:e2e`)
8. Verificação contra vazamento de segredos nos logs de execução
