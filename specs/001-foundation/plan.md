# Implementation Plan: Project Foundation

**Branch**: `001-foundation` | **Date**: 2026-09-02 | **Spec**: [spec.md](spec.md)  
**Input**: Feature specification from `/specs/001-foundation/spec.md`

## Summary

Establish a reproducible TypeScript monorepo that runs the Datria web application and API,
connects the API to a local MySQL service, exposes liveness and readiness checks, and gives
contributors one set of commands for development and quality verification. The baseline
uses pnpm workspaces without an additional monorepo orchestrator, React with Vite for the
web application, NestJS for the API, and Prisma for data access. GitHub Actions reproduces
the mandatory local checks. This increment deliberately excludes identity, tenancy, and
assessment-domain behavior.

## Technical Context

**Language/Version**: TypeScript strict mode on Node.js 24 LTS  
**Primary Dependencies**: React, Vite, NestJS, Prisma Client  
**Storage**: MySQL 8-compatible server; XAMPP is the supported local runtime  
**Testing**: Vitest for web/shared packages, Jest + Supertest for API, Playwright for E2E  
**Target Platform**: Modern desktop browsers; Node.js server on Windows/Linux  
**Project Type**: Web application plus REST API in a pnpm monorepo  
**Performance Goals**: Local health result visible within 2 seconds after request; temporary
web page interactive within 3 seconds on the reference development machine  
**Constraints**: No secrets in version control; no Docker dependency for ordinary local
development; reproducible lockfile; strict TypeScript; MySQL expected on `localhost:3306`
unless configured otherwise  
**Scale/Scope**: Two applications, initial shared configuration packages, one readiness
dependency, one temporary page, and a minimal E2E smoke path

## Constitution Check

### Gate before Phase 0 research

| Principle | Status | Evidence / required action |
|---|---|---|
| I. Specification is source of truth | PASS | Spec and checklist exist; this plan stays within approved scope |
| II. Vertical, independently verifiable delivery | PASS | P1 starts complete local baseline; P2 and P3 remain independently testable |
| III. Tenant isolation by default | PASS | No tenant data is introduced; next increment must implement the boundary before domain data |
| IV. Security, privacy, least privilege | PASS | Example configuration only; secret scanning and log-safety requirements included |
| V. Test-first for critical behavior | PASS | Health behavior and configuration failure paths receive tests before implementation |
| VI. Accessible and resilient UX | PASS | Temporary page requires semantic output and explicit success/error behavior |
| VII. Observable and reversible operations | PASS | Separate liveness/readiness endpoints; no destructive migration or production operation |

**Gate result**: PASS. Phase 0 research may proceed.

## Project Structure

### Documentation for this feature

```text
specs/001-foundation/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── health.openapi.yaml
├── checklists/
│   └── requirements.md
└── spec.md
```

### Source code at repository root

```text
apps/
├── api/
│   ├── src/
│   │   ├── app.module.ts
│   │   ├── main.ts
│   │   └── modules/
│   │       └── health/
│   └── test/
└── web/
    ├── src/
    │   ├── app/
    │   ├── main.tsx
    │   └── styles/
    └── tests/

packages/
├── eslint-config/
└── tsconfig/

prisma/
└── schema.prisma

tests/
└── e2e/

.github/
└── workflows/
    └── ci.yml

.env.example
.gitignore
.node-version
package.json
pnpm-lock.yaml
pnpm-workspace.yaml
README.md
```

**Structure Decision**: Use native pnpm workspaces and root scripts for this increment.
Avoid Turborepo or Nx until repository size or measured build time demonstrates a need.
Keep Prisma at the repository root because the modular monolith initially has a single
database schema and migration history.

## Phase 0: Research and Decisions

Research outputs are recorded in [research.md](research.md). All material technical
unknowns for this increment are resolved:

- Node.js 24 LTS is the supported runtime.
- pnpm workspaces provide dependency and script coordination.
- GitHub Actions is the continuous-integration provider.
- Vitest covers web and shared packages; Jest + Supertest covers the NestJS API;
  Playwright covers cross-application smoke flows.
- XAMPP MySQL remains external to Node.js and is configured through `DATABASE_URL`.
- API health is split into liveness and readiness.
- Framework versions are selected at implementation time from mutually compatible stable
  releases and frozen in the lockfile; uncontrolled floating versions are prohibited.

## Phase 1: Design and Contracts

### Application boundaries

- `apps/web` owns browser rendering and communicates with the API through documented HTTP
  contracts. It MUST NOT import API implementation modules.
- `apps/api` owns server-side validation, business boundaries, health checks, and data
  access. It MUST NOT depend on browser packages.
- `packages/tsconfig` and `packages/eslint-config` own stable build and quality policy only.
- No generic shared domain package is created in this increment.
- `prisma` owns the database datasource, generator, and later migration history.

### Local runtime

- Web default address: `http://localhost:5173`.
- API default address: `http://localhost:3000`.
- API prefix: `/api/v1`.
- MySQL default address: `localhost:3306`.
- Environment values override defaults where safe.
- XAMPP starts and stops MySQL; pnpm starts and stops Node.js applications.

### Health contract

- `GET /api/v1/health/live` reports whether the API process can serve requests.
- `GET /api/v1/health/ready` reports whether required dependencies are usable.
- Readiness performs a bounded database connectivity check.
- Health responses never contain credentials, connection strings, stack traces, host
  details, or schema data.
- The canonical contract is [contracts/health.openapi.yaml](contracts/health.openapi.yaml).

### Configuration model

The root `.env.example` documents, at minimum:

- `NODE_ENV`
- `API_PORT`
- `WEB_ORIGIN`
- `VITE_API_BASE_URL`
- `DATABASE_URL`

Each application validates the variables it consumes at startup. Production-like secrets
must not have usable fallback values. Tests use isolated configuration and do not depend on
a contributor's personal `.env`.

### Verification model

Root scripts expose:

- `pnpm dev`
- `pnpm build`
- `pnpm lint`
- `pnpm typecheck`
- `pnpm test`
- `pnpm test:e2e`
- `pnpm format:check`

The CI workflow installs the pinned pnpm version through Corepack, uses the committed
lockfile, and runs formatting verification, lint, type checking, unit/integration tests,
builds, and E2E smoke tests. A MySQL service container is permitted in CI even though local
development uses XAMPP.

### Data design

No product-domain entity is introduced. Prisma validates database connectivity and creates
the foundation for later versioned migrations. See [data-model.md](data-model.md).

## Post-Design Constitution Check

| Principle | Status | Design evidence |
|---|---|---|
| I | PASS | Contracts and decisions are stored under the feature directory |
| II | PASS | The P1 path can be demonstrated without P2/P3 implementation |
| III | PASS | No organization-owned schema exists; root Prisma placement does not weaken future tenant rules |
| IV | PASS | Environment validation, secret-safe output, and CI configuration are explicit |
| V | PASS | Test ownership and framework boundaries are defined before implementation |
| VI | PASS | Temporary page remains semantic and responsive; E2E validates visible readiness |
| VII | PASS | Health separation and deterministic build/CI evidence are defined |

**Gate result**: PASS. Task decomposition may proceed.

## Implementation Sequence

1. Create root workspace metadata, runtime pin, ignore rules, and configuration example.
2. Create shared TypeScript and ESLint policy packages.
3. Scaffold the API and add configuration validation.
4. Write failing health unit/integration tests, then implement liveness and readiness.
5. Configure Prisma for MySQL and bounded readiness connectivity.
6. Scaffold the web application and implement the semantic temporary page.
7. Add Vitest and the web build verification.
8. Add Playwright smoke coverage across web and API.
9. Add root quality scripts and contributor documentation.
10. Add GitHub Actions with MySQL service and all mandatory gates.
11. Run `/speckit.analyze`, execute the quickstart on a clean checkout, and capture evidence.

## Risks and Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| XAMPP ships a MySQL-compatible version unsupported by selected Prisma release | Local setup blocked | Verify actual server version before dependency lock; document minimum supported version |
| Port 3306, 3000, or 5173 already occupied | Startup failure | All ports configurable; quickstart includes diagnosis commands |
| API tests depend on personal local database | Non-reproducible tests | Isolated test database configuration; CI-owned MySQL service |
| Multiple test frameworks confuse contributors | Maintenance friction | Clear ownership: Vitest web/shared, Jest API, Playwright cross-app E2E |
| CI and local commands diverge | False confidence | CI invokes the same root scripts documented for contributors |
| Premature shared abstractions | Coupling | Only configuration packages in foundation; contracts added when real consumers exist |

## Complexity Tracking

No constitution violation or exceptional complexity is approved. The explicit decision not
to add Nx, Turborepo, Docker as a local requirement, Redis, queues, authentication, or
domain entities keeps this increment within its validated scope.

