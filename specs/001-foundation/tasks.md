# Tasks: Project Foundation

**Input**: Design documents from `/specs/001-foundation/`  
**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md), [data-model.md](data-model.md), [contracts/health.openapi.yaml](contracts/health.openapi.yaml), [quickstart.md](quickstart.md), [.specify/memory/constitution.md](../../.specify/memory/constitution.md)  
**Tests**: Critical behavior tests are included per Constitution Principle V (Test-First for Critical Behavior) and FR-017 (Automated test for health capability and web build check).  
**Organization**: Tasks are grouped by phase and user story to enable independent implementation and testing of each story.

## Format: `- [ ] [TaskID] [P?] [Story?] Description with file path`

- **[P]**: Can run in parallel (different files, no dependencies on uncompleted tasks)
- **[Story]**: Which user story this task belongs to (e.g., [US1], [US2], [US3])
- File paths are exact repository-relative paths

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Monorepo root initialization, workspace configuration, tool pinning, and shared packages

- [X] T001 Initialize root workspace configuration with pnpm workspaces and Node.js 24 LTS engine pin in package.json
- [X] T002 [P] Configure pnpm workspace structure declaring apps/* and packages/* in pnpm-workspace.yaml
- [X] T003 [P] Pin Node.js runtime version to 24 in .node-version
- [X] T004 [P] Configure version control ignore rules for dependencies, build output, cache, and local environment secrets in .gitignore
- [X] T005 [P] Create template environment configuration with safe development defaults and descriptive comments in .env.example
- [X] T006 [P] Create shared base TypeScript configuration package in packages/tsconfig/base.json and packages/tsconfig/package.json
- [X] T007 [P] Create shared ESLint configuration package in packages/eslint-config/index.js and packages/eslint-config/package.json

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core application scaffolding, database configuration, and configuration validation that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T008 Initialize Prisma foundation with MySQL datasource and Prisma Client generator in prisma/schema.prisma
- [X] T009 [P] Scaffold NestJS API application workspace structure, dependencies, and build configuration in apps/api/package.json and apps/api/tsconfig.json
- [X] T010 [P] Scaffold React web application workspace structure, dependencies, and Vite configuration in apps/web/package.json, apps/web/tsconfig.json, and apps/web/vite.config.ts
- [X] T011 Implement environment configuration loader and runtime validation schema for API in apps/api/src/config/env.validation.ts
- [X] T012 Implement PrismaService wrapper for database lifecycle and bounded connectivity query in apps/api/src/prisma/prisma.service.ts
- [X] T013 Register PrismaModule and ConfigModule in API root module in apps/api/src/app.module.ts
- [X] T014 Configure API bootstrap entrypoint with /api/v1 global prefix, CORS origins, and OpenAPI Swagger documentation in apps/api/src/main.ts

**Checkpoint**: Foundation ready — user story implementation can now begin in parallel

---

## Phase 3: User Story 1 - Start the complete development environment (Priority: P1) 🎯 MVP

**Goal**: Enable a contributor on a supported workstation to install dependencies, run MySQL in XAMPP, start API and Web applications concurrently from root commands, and observe a working temporary web page and healthy service endpoints.

**Independent Test**: Following only documented instructions from a clean state, start MySQL in XAMPP, run `pnpm dev` from project root, open `http://localhost:5173` to see the temporary Datria baseline page, and fetch `http://localhost:3000/api/v1/health/live` and `/api/v1/health/ready` to confirm healthy operational state.

### Tests for User Story 1 ⚠️

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [X] T015 [P] [US1] Create unit tests for HealthController and HealthService verifying liveness and readiness responses in apps/api/src/modules/health/health.controller.spec.ts
- [X] T016 [P] [US1] Create API integration/contract tests verifying /api/v1/health/live (200 OK) and /api/v1/health/ready (200 OK when DB up, 503 unavailable when DB down) conforming to contracts/health.openapi.yaml in apps/api/test/health.e2e-spec.ts
- [X] T017 [P] [US1] Create unit/render test verifying temporary page content, codename disclaimer, and baseline status indicator in apps/web/tests/App.test.tsx

### Implementation for User Story 1

- [X] T018 [US1] Implement HealthService with bounded SELECT 1 database ping and sanitized health payload in apps/api/src/modules/health/health.service.ts
- [X] T019 [US1] Implement HealthController exposing GET /health/live and GET /health/ready matching OpenAPI contract in apps/api/src/modules/health/health.controller.ts
- [X] T020 [US1] Register HealthModule with HealthController and HealthService in apps/api/src/modules/health/health.module.ts
- [X] T021 [P] [US1] Create semantic HTML document shell with root container and accessible viewport metadata in apps/web/index.html
- [X] T022 [P] [US1] Implement CSS styles, typography, and status indicators in apps/web/src/styles/index.css
- [X] T023 [US1] Implement temporary web application view displaying Datria codename notice, baseline status, and live health check in apps/web/src/app/App.tsx
- [X] T024 [US1] Implement web application bootstrap entrypoint mounting React tree in apps/web/src/main.tsx
- [X] T025 [US1] Configure root dev script to run API and Web workspaces concurrently in package.json

**Checkpoint**: At this point, User Story 1 should be fully functional and testable independently (MVP Complete).

---

## Phase 4: User Story 2 - Verify project quality consistently (Priority: P2)

**Goal**: Provide contributors with a unified, deterministic suite of root commands to verify formatting, linting, typing, unit/integration tests, E2E smoke tests, and production builds across all workspaces.

**Independent Test**: Execute each root quality command (`pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`, `pnpm test:e2e`) on the unchanged baseline; verify all pass, and confirm that an injected defect in any workspace causes the corresponding command to fail with actionable output.

### Tests for User Story 2 ⚠️

- [X] T026 [P] [US2] Create Playwright E2E smoke test verifying web page load and API health check integration in tests/e2e/smoke.spec.ts

### Implementation for User Story 2

- [X] T027 [P] [US2] Configure Vitest test runner and DOM testing environment for web in apps/web/vitest.config.ts
- [X] T028 [P] [US2] Configure Jest test runner and ts-jest environment for API in apps/api/jest.config.ts
- [X] T029 [P] [US2] Configure Playwright end-to-end test harness with web and api webServer definitions in playwright.config.ts
- [X] T030 Configure ESLint shareable configurations for Node and React workspaces in packages/eslint-config/index.js
- [X] T031 Configure TypeScript shareable presets for Node and React workspaces in packages/tsconfig/node.json and packages/tsconfig/react.json
- [X] T032 Wire root quality scripts for format:check, format:write, lint, typecheck, test, build, and test:e2e in package.json
- [X] T033 Verify all root quality scripts execute deterministically across all workspaces and report unified exit codes in package.json

**Checkpoint**: At this point, User Stories 1 AND 2 should both work independently.

---

## Phase 5: User Story 3 - Validate changes automatically (Priority: P3)

**Goal**: Automatically run all mandatory quality checks on pull requests and pushes using GitHub Actions with an isolated MySQL service container, blocking integration on failure and preventing secret leakage.

**Independent Test**: Trigger the GitHub Actions CI workflow on a branch; verify that it installs dependencies from the frozen lockfile, runs all quality commands against the CI MySQL container, reports status, and masks sensitive values.

### Implementation for User Story 3

- [X] T034 [US3] Create GitHub Actions CI workflow defining trigger events, Node.js 24 setup, pnpm cache, and MySQL service container in .github/workflows/ci.yml
- [X] T035 [US3] Configure CI execution steps for frozen lockfile installation, Prisma generate, formatting check, linting, typecheck, tests, and builds in .github/workflows/ci.yml
- [X] T036 [US3] Configure CI E2E smoke test execution step with Playwright browser installation in .github/workflows/ci.yml
- [X] T037 [US3] Add secret leakage check step to ensure no sensitive credentials or environment values appear in CI logs in .github/workflows/ci.yml

**Checkpoint**: All user stories should now be independently functional and protected by continuous integration.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Contributor documentation, developer onboarding experience, quickstart validation, and lockfile freeze

- [X] T038 [P] Create comprehensive contributor documentation covering architecture, boundaries, setup, commands, and security guidelines in README.md
- [X] T039 [P] Document MySQL XAMPP setup, troubleshooting guide, and common failure resolutions in specs/001-foundation/quickstart.md
- [X] T040 Generate reproducible pnpm-lock.yaml and validate frozen lockfile installation in pnpm-lock.yaml
- [X] T041 Execute end-to-end quickstart validation and record completion evidence in specs/001-foundation/quickstart.md

### Completion Audit Remediation

- [X] T042 Ensure the root test workflow executes API unit and health contract tests using the declared Jest configurations in package.json and apps/api/jest.config.ts
- [X] T043 Add automated configuration-validation tests proving missing or invalid database configuration fails without exposing supplied values in apps/api/src/config/env.validation.spec.ts
- [X] T044 Add a real bounded MySQL readiness integration test and execute it against the GitHub Actions MySQL service in apps/api/test/mysql.integration-spec.ts and .github/workflows/ci.yml
- [X] T045 Cancel the bounded readiness timer after the database query settles to avoid leaked asynchronous handles in apps/api/src/prisma/prisma.service.ts
- [X] T046 Mask CI-only database values and make generated-output secret detection fail the workflow on a match in .github/workflows/ci.yml

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **Foundational (Phase 2)**: Depends on Setup (Phase 1) completion — BLOCKS all user stories
- **User Story 1 (Phase 3)**: Depends on Foundational (Phase 2) completion — Delivers core MVP
- **User Story 2 (Phase 4)**: Depends on Foundational (Phase 2) completion — Can proceed after or in parallel with US1
- **User Story 3 (Phase 5)**: Depends on Foundational (Phase 2) and US2 quality scripts definition — Can proceed once scripts exist
- **Polish (Phase 6)**: Depends on all user stories (Phases 3, 4, 5) reaching checkpoints

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Phase 2. Independent of US2 and US3.
- **User Story 2 (P2)**: Can start after Phase 2. Integrates with US1 components for test execution, but verification commands are independently runnable.
- **User Story 3 (P3)**: Can start after Phase 2 and consumes root scripts defined in US2. Operates independently in CI environment.

### Within Each User Story

- Test tasks (T015, T016, T017 for US1; T026 for US2) MUST be written first and fail before implementation
- Configuration/models before services
- Services before controllers/endpoints
- Components and styling before root integration
- Story checkpoint validated before declaring increment complete

### Parallel Opportunities

- In Phase 1: T002, T003, T004, T005, T006, T007 can all run in parallel
- In Phase 2: T009 and T010 can run in parallel
- In Phase 3 (US1):
  - T015, T016, T017 (tests) can be written in parallel
  - T021 and T022 (web assets/styles) can be created in parallel with API tasks
- In Phase 4 (US2): T026, T027, T028, T029 can be authored in parallel
- In Phase 6: T038 and T039 can be written in parallel

---

## Parallel Example: User Story 1

```bash
# Launch test tasks for User Story 1 together:
Task: "T015 [P] [US1] Create unit tests for HealthController and HealthService verifying liveness and readiness responses in apps/api/src/modules/health/health.controller.spec.ts"
Task: "T016 [P] [US1] Create API integration/contract tests verifying /api/v1/health/live and /api/v1/health/ready in apps/api/test/health.e2e-spec.ts"
Task: "T017 [P] [US1] Create unit/render test verifying temporary page content in apps/web/tests/App.test.tsx"

# Launch web styling and template tasks in parallel:
Task: "T021 [P] [US1] Create semantic HTML document shell in apps/web/index.html"
Task: "T022 [P] [US1] Implement CSS styles and design tokens in apps/web/src/styles/index.css"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001 - T007)
2. Complete Phase 2: Foundational (T008 - T014) — **CRITICAL BLOCKER**
3. Complete Phase 3: User Story 1 (T015 - T025)
4. **STOP and VALIDATE**: Verify local startup with `pnpm dev`, confirm `http://localhost:5173` temporary page, and test `/api/v1/health/live` and `/api/v1/health/ready`
5. Checkpoint reached: Local dev baseline ready for contributors (MVP delivered)

### Incremental Delivery

1. Complete Setup + Foundational → Core workspaces and database client ready
2. Deliver User Story 1 (P1) → Complete local dev environment (MVP)
3. Deliver User Story 2 (P2) → Deterministic quality checks (`format:check`, `lint`, `typecheck`, `test`, `build`, `test:e2e`)
4. Deliver User Story 3 (P3) → GitHub Actions continuous integration protecting the baseline
5. Complete Polish (Phase 6) → Documentation, quickstart validation, and reproducible lockfile

### Parallel Team Strategy

With multiple developers or agents:
1. Team completes Setup + Foundational together
2. Once Phase 2 checkpoint is reached:
   - Developer A: User Story 1 (API health & temporary web UI)
   - Developer B: User Story 2 (Quality tooling, Vitest, Jest, Playwright)
   - Developer C: User Story 3 (GitHub Actions CI workflow)
3. Stories complete and integrate without conflict

---

## Notes

- All tasks follow strict format: `- [ ] [TaskID] [P?] [Story?] Description with file path`
- [P] indicates tasks in different files with no dependencies on incomplete tasks
- [Story] maps directly to spec.md user stories ([US1], [US2], [US3])
- Test-first tasks ensure failures are observed before implementing logic (Constitution Principle V)
- All secrets and credentials strictly prohibited from version control and logs (Constitution Principle IV)
- Stop at each checkpoint to validate story independently
