# Data Model: Project Foundation

**Feature**: `001-foundation`  
**Date**: 2026-09-02

## Domain entities

This increment introduces **no persistent product-domain entity**. Users, organizations,
memberships, roles, sessions, and audit events belong to `002-identity-tenancy`.

Adding a placeholder table solely to prove database connectivity is prohibited because it
would create schema and migration debt without user value.

## Prisma foundation

The Prisma schema contains:

- the Prisma Client generator;
- a MySQL datasource configured exclusively through `DATABASE_URL`;
- no domain model until the next approved feature introduces one.

The API readiness check may execute a bounded, parameter-free connectivity query such as
`SELECT 1` through the data-access boundary. It MUST NOT modify data or expose connection
details.

## Runtime health representation

Health results are transient response values, not persisted entities.

| Field | Type | Rules |
|---|---|---|
| `status` | enum | `ok` for usable state; `unavailable` for a failed readiness dependency |
| `service` | string | Stable public service identifier, never host information |
| `timestamp` | ISO 8601 string | Server-generated UTC instant |
| `checks.database` | enum | `up` or `down`; readiness response only |

## Validation rules

- `DATABASE_URL` must use a MySQL-compatible scheme.
- A missing or invalid connection value blocks readiness and, according to startup policy,
  may block API startup with a sanitized error.
- Connectivity checks have a strict timeout and cannot wait indefinitely.
- Health responses never contain database name, username, password, hostname, schema,
  query text, or exception stack.

## Migration strategy

- No migration is expected for `001-foundation`.
- The first migration is created by `002-identity-tenancy` after its data model is approved.
- All later migrations are committed and reviewed.
- Destructive changes require an explicit recovery plan under the Constitution.

