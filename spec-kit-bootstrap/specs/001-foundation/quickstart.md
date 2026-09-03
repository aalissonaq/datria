# Quickstart: Project Foundation

**Feature**: `001-foundation`  
**Supported runtime**: Node.js 24 LTS, pnpm, MySQL through XAMPP

## 1. Verify prerequisites

```bash
node --version
pnpm --version
git --version
```

The Node.js result must be from the 24 LTS line. The repository's `packageManager` field is
the source of truth for the exact pnpm version after implementation.

## 2. Start MySQL in XAMPP

1. Open the XAMPP Control Panel.
2. Start **MySQL**.
3. Confirm that the configured port is available; the default is `3306`.
4. Create an empty local development database named `datria_dev`.
5. Use a development-only MySQL account with access limited to that database when
   possible.

Do not commit the local username or password.

## 3. Configure the project

After cloning the repository:

```bash
pnpm install --frozen-lockfile
```

Copy `.env.example` to the local environment file using the operating system's file tool.
Set values equivalent to:

```dotenv
NODE_ENV=development
API_PORT=3000
WEB_ORIGIN=http://localhost:5173
VITE_API_BASE_URL=http://localhost:3000/api/v1
DATABASE_URL=mysql://LOCAL_USER:LOCAL_PASSWORD@localhost:3306/datria_dev
```

Replace the placeholders only in the untracked local file.

## 4. Start development

```bash
pnpm dev
```

Expected addresses:

- Web: `http://localhost:5173`
- API liveness: `http://localhost:3000/api/v1/health/live`
- API readiness: `http://localhost:3000/api/v1/health/ready`
- OpenAPI documentation: address defined during implementation and recorded in `README.md`

The temporary web page must show that the baseline loaded and that Datria is a codename.

## 5. Run quality checks

```bash
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm test:e2e
```

All commands must pass on the unchanged baseline.

## 6. Expected readiness behavior

With MySQL running and valid configuration:

```json
{
  "status": "ok",
  "service": "datria-api",
  "timestamp": "2026-09-02T00:00:00.000Z",
  "checks": {
    "database": "up"
  }
}
```

With MySQL unavailable, readiness returns HTTP `503` with a sanitized response. Liveness
may remain HTTP `200` while the API process itself can serve requests.

## 7. Common failures

| Symptom | Check | Expected resolution |
|---|---|---|
| API cannot connect to data service | MySQL state and configured port in XAMPP | Start MySQL or align `DATABASE_URL` |
| Authentication failure from MySQL | Local database user and permissions | Grant only required access to `datria_dev` |
| Port already in use | API, web, and MySQL configured ports | Stop conflicting process or use documented override |
| Frozen install fails | `package.json` and lockfile consistency | Regenerate lockfile only through reviewed dependency change |
| Readiness is `503` but liveness is `200` | Database connectivity | Treat as dependency failure, not process crash |
| E2E cannot open applications | Startup logs and configured base URLs | Start both apps or correct test configuration |

## 8. Completion evidence

Before closing `001-foundation`, attach or record:

- successful prerequisite versions;
- successful clean dependency installation;
- working web page and both health responses;
- output from every root quality command;
- successful GitHub Actions run;
- confirmation that no real secret is tracked;
- `/speckit.analyze` result with no unresolved critical finding.

