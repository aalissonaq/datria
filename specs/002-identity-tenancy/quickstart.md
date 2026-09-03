# Quickstart: Identidade e Multi-Tenancy

## Pré-requisitos

- Node.js 24 LTS e pnpm configurados;
- MySQL iniciado no XAMPP;
- banco `datria_dev` e banco separado `datria_test`;
- Mailpit disponível no PATH ou em local conhecido;
- feature `001-foundation` concluída.

## Variáveis locais

Adicionar ao `.env.example` e copiar os valores adequados para o `.env` local:

```dotenv
DATABASE_URL="mysql://LOCAL_USER:LOCAL_PASSWORD@localhost:3306/datria_dev"
TEST_DATABASE_URL="mysql://LOCAL_USER:LOCAL_PASSWORD@localhost:3306/datria_test"
JWT_ACCESS_SECRET="replace-with-at-least-32-random-bytes"
JWT_ISSUER="datria-api"
JWT_AUDIENCE="datria-web"
ACCESS_TOKEN_TTL="15m"
SESSION_IDLE_TTL="30m"
SESSION_ABSOLUTE_TTL="8h"
EMAIL_VERIFICATION_TTL="24h"
PASSWORD_RESET_TTL="30m"
INVITATION_TTL="7d"
SMTP_HOST="localhost"
SMTP_PORT="1025"
SMTP_FROM="no-reply@datria.local"
MAILPIT_UI_URL="http://localhost:8025"
AUDIT_RETENTION_DAYS="180"
COOKIE_SECURE="false"
WEB_ORIGIN="http://localhost:5173"
```

O `.env` real não pode ser versionado. O segredo acima é somente placeholder.

## Iniciar serviços

1. Inicie MySQL no painel do XAMPP.
2. Inicie o Mailpit:

```powershell
mailpit --smtp 0.0.0.0:1025 --listen 0.0.0.0:8025
```

3. Em outro terminal, aplique a migration e o seed:

```powershell
pnpm prisma:generate
pnpm prisma:migrate
pnpm prisma:seed
```

4. Inicie web e API:

```powershell
pnpm dev
```

## Fluxo manual mínimo

1. Abra `http://localhost:5173/register`.
2. Cadastre uma conta com uma senha compatível.
3. Abra `http://localhost:8025` e use o e-mail de verificação.
4. Faça login.
5. Confirme o contexto pessoal.
6. Crie uma organização e confirme que o criador virou Admin institucional.
7. Convide outro e-mail como Professor.
8. Abra o Mailpit, aceite o convite e confirme a membership.
9. Troque entre contexto pessoal e organização.
10. Tente acessar a organização com um usuário sem membership e confirme a negação segura.

## Verificações obrigatórias

```powershell
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm test:integration
pnpm build
pnpm test:e2e
```

## Teste de isolamento

Os fixtures E2E devem criar:

- usuário A e organização A;
- usuário B e organização B;
- usuário C membro de A e B;
- contexto pessoal de cada usuário.

Executar tentativas de leitura e escrita A→B e B→A, inclusive usando UUIDs válidos. Todas
devem ser negadas sem revelar a existência do recurso.

## Evidências para encerramento

- migrations aplicadas em bancos vazios de desenvolvimento e teste;
- cadastro, verificação, login, refresh, logout e recuperação demonstrados;
- refresh reuse revoga a família;
- contexto pessoal e troca de organizações demonstrados;
- último Admin protegido;
- Mailpit recebe os três templates;
- auditoria sem credenciais ou tokens;
- matriz cross-tenant totalmente aprovada;
- GitHub Actions verde;
- `/speckit.analyze` sem finding crítico.

