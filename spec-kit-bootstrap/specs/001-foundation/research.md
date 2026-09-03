# Technical Research: Project Foundation

**Feature**: `001-foundation`  
**Date**: 2026-09-02  
**Status**: Decisions resolved for planning

## Decision 1: Runtime baseline

**Decision**: Standardize on Node.js 24 LTS and record the runtime in `.node-version` and
the root package engine constraint.

**Rationale**: The Product Owner selected the active LTS line. A single runtime baseline
reduces differences between local work and continuous integration.

**Alternatives considered**:

- Node.js 22 LTS: stable but not the selected baseline.
- Whatever LTS exists on each workstation: rejected because it weakens reproducibility.

## Decision 2: Workspace coordination

**Decision**: Use native pnpm workspaces and root scripts. Do not add a task orchestrator in
the foundation increment.

**Rationale**: Two applications and a small number of policy packages do not yet justify
another execution layer. The approach remains easy to replace after measured need.

**Alternatives considered**:

- Turborepo: useful for caching and larger graphs, but premature here.
- Nx: rich governance and generators, but adds concepts and configuration before need.
- npm workspaces: not selected because pnpm is the approved package manager.

## Decision 3: Testing ownership

**Decision**: Vitest for the web application and shared packages, Jest with Supertest for
the NestJS API, and Playwright for cross-application E2E smoke tests.

**Rationale**: Each tool follows its strongest ecosystem integration. Explicit ownership
prevents duplicated coverage and unclear commands.

**Alternatives considered**:

- Vitest for the complete stack: simpler tool count, but increases adaptation work for
  NestJS defaults in the first increment.
- Jest plus Cypress: viable, but not the selected strategy.

## Decision 4: Continuous integration

**Decision**: Use GitHub Actions. The workflow invokes the same root scripts used locally
and provisions an isolated MySQL service for integration and E2E tests.

**Rationale**: The Product Owner selected GitHub Actions. Reusing root scripts prevents a
separate CI-only validation path.

**Alternatives considered**:

- GitLab CI: not the selected repository workflow.
- Local checks only: rejected because it cannot enforce checks consistently.

## Decision 5: Local database runtime

**Decision**: Support MySQL through XAMPP for ordinary local development. Node.js
applications connect through `DATABASE_URL`; they do not start or manage MySQL.

**Rationale**: This matches the approved development environment and separates application
lifecycle from the data-service lifecycle.

**Alternatives considered**:

- Docker Compose as mandatory local runtime: rejected because it conflicts with the chosen
  XAMPP workflow. It may be documented later as an optional alternative.
- Embedded database for development: rejected because behavior would differ from MySQL.

## Decision 6: Database access foundation

**Decision**: Configure one root Prisma schema and generated client for the modular
monolith. The foundation adds no artificial product table.

**Rationale**: The next identity and tenancy feature should introduce the first real
domain migration. A placeholder table would create unnecessary schema history.

**Alternatives considered**:

- Add a `SystemMetadata` table: rejected because no approved requirement needs persisted
  metadata.
- Separate Prisma schema per API module: rejected until real modular ownership requires it.

## Decision 7: Health semantics

**Decision**: Provide separate liveness and readiness endpoints. Liveness verifies request
handling; readiness includes a bounded MySQL connectivity query.

**Rationale**: Process health and dependency usability answer different operational
questions. The split supports diagnosis without exposing implementation details.

**Alternatives considered**:

- One combined `/health` endpoint: simpler but cannot distinguish process failure from a
  dependency outage.
- Detailed infrastructure diagnostics in public response: rejected for security reasons.

## Decision 8: Version pinning

**Decision**: Choose mutually compatible stable dependency versions during implementation,
record the pnpm version in `packageManager`, constrain Node.js in `engines`, and commit the
lockfile with frozen installation in CI.

**Rationale**: Exact versions can change faster than product requirements. The repository,
not this plan's prose, is the authoritative dependency record.

**Alternatives considered**:

- Floating latest versions: rejected because builds would not be reproducible.
- Hard-code guessed framework versions in the specification: rejected because the feature
  specification should focus on required outcomes.

