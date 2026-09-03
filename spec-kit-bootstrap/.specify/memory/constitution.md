<!--
Sync Impact Report
- Version change: template/unratified -> 1.0.0
- Added principles:
  - I. Specification Is the Source of Truth
  - II. Vertical and Independently Verifiable Delivery
  - III. Tenant Isolation by Default
  - IV. Security, Privacy, and Least Privilege
  - V. Test-First for Critical Behavior
  - VI. Accessible and Resilient User Experience
  - VII. Observable and Reversible Operations
- Added sections:
  - Engineering Constraints
  - Development Workflow and Quality Gates
  - Governance
- Removed sections: none
- Templates requiring review after adoption:
  - .specify/templates/plan-template.md: constitution gates must reflect Principles I-VII
  - .specify/templates/spec-template.md: no mandatory change
  - .specify/templates/tasks-template.md: security, tenant, accessibility, and test tasks must be explicit
- Deferred items: none
-->

# Datria Constitution

## Core Principles

### I. Specification Is the Source of Truth

Every product increment MUST have an approved `spec.md`, `plan.md`, and `tasks.md`
before implementation begins. Requirements, acceptance scenarios, non-goals, domain
rules, contracts, and material architectural decisions MUST be recorded in the
appropriate Spec Kit artifact.

Chat conversations, agent outputs, temporary notes, prototypes, and source code MUST NOT
silently redefine approved behavior. When implementation reveals a necessary change, the
team MUST first update the affected canonical artifact, analyze its impact, and only then
change tasks or code.

Superpowers MAY support brainstorming, planning, test-driven development, debugging, and
review. Its conclusions become binding only after they are incorporated into the Spec Kit
artifacts and accepted through the normal review process.

Rationale: the project depends on durable, auditable intent instead of transient agent
context.

### II. Vertical and Independently Verifiable Delivery

The complete product vision MUST be decomposed into small vertical increments. Each user
story marked P1, P2, or P3 MUST state its independent value, independent test, and
verifiable acceptance scenarios. A story MUST be demonstrable without requiring all later
stories to be complete.

Plans and tasks MUST preserve this independence. Infrastructure-only work MAY exist when
it enables the first vertical slice, but it MUST have a bounded outcome, measurable
completion criteria, and no speculative framework building.

Complexity added for an unapproved future requirement MUST be rejected or explicitly
justified in the plan's complexity tracking section.

Rationale: a complete vision does not justify a high-risk big-bang release.

### III. Tenant Isolation by Default

All organization-owned data MUST carry an explicit tenant boundary. Every read, write,
background job, cache entry, file, audit event, import, export, and report involving tenant
data MUST enforce that boundary on the server.

Client-provided organization identifiers MUST NOT be trusted as authorization. Access MUST
be derived from the authenticated identity, active membership, role, and resource scope.
Cross-tenant access MUST be denied by default and covered by automated negative tests.

Global platform operations MUST be isolated from institutional roles and MUST generate
auditable privileged events. Shared content across organizations is prohibited until a
dedicated specification defines ownership, licensing, consent, and revocation.

Rationale: a single horizontal authorization failure could expose educational and personal
data from multiple customers.

### IV. Security, Privacy, and Least Privilege

Security and privacy MUST be designed into each increment. Secrets, credentials, tokens,
real personal data, answer keys, and sensitive response content MUST NOT be committed to
the repository or written to ordinary application logs.

All external input MUST be validated on the server. Authentication, authorization,
password recovery, invitations, file handling, and administrative actions MUST include
abuse cases and rate-limit considerations in their plans. Passwords MUST use a current,
adaptive password-hashing algorithm. Sessions and temporary tokens MUST be revocable,
expirable, and protected against replay where applicable.

Data collection MUST be limited to an explicit purpose. Retention, deletion, export, and
access to individual telemetry MUST follow approved product rules and LGPD obligations.
Biometrics, webcam, screen, and audio processing require a separate specification and
privacy review before implementation.

Rationale: the platform handles identity, assessment, performance, and behavioral data.

### V. Test-First for Critical Behavior

Critical domain and security behavior MUST be developed test-first. This includes tenant
isolation, permissions, authentication flows, assessment publication, attempt lifecycle,
autosave and submission idempotency, timers, grading, result release, question versioning,
and certificate validity.

For each critical behavior, the failing automated test MUST be observed before production
code is added. Unit tests MUST cover pure domain rules; integration tests MUST cover
database, authorization, and module boundaries; end-to-end tests MUST cover the smallest
critical user journeys.

A defect fix MUST include a reproducing test whenever technically feasible. Removing,
skipping, or weakening a test to make a pipeline pass is prohibited unless the associated
requirement changed and the canonical artifacts were amended first.

Rationale: assessment correctness and access control cannot depend on manual confidence.

### VI. Accessible and Resilient User Experience

Every user-facing increment MUST support keyboard operation, visible focus, semantic
structure, readable contrast, understandable errors, and compatible labels, targeting
WCAG 2.2 AA. Loading, empty, success, partial, offline or disconnected, and error states
MUST be designed where applicable.

Critical participant flows MUST be mobile-responsive and MUST not lose confirmed work
during transient network failures. The interface MUST clearly communicate synchronization,
remaining time, submission state, and irreversible actions.

Accessibility and resilience acceptance scenarios MUST be included in the feature
specification rather than deferred to a final audit.

Rationale: access conditions and user capabilities vary, while an assessment attempt is
time-sensitive and consequential.

### VII. Observable and Reversible Operations

Important business transitions MUST generate structured, correlated, and privacy-aware
events. The system MUST expose enough health, error, and performance information to
diagnose failures without revealing secrets or unnecessary personal data.

Database schema changes MUST use versioned migrations. Destructive or irreversible data
changes require a documented backup, rollback or forward-recovery strategy, and explicit
approval. Background work MUST be retry-safe and idempotent when duplicate execution is
possible.

Every release MUST be buildable from version-controlled instructions. Operational changes
MUST be reviewable, and critical failures MUST have a documented recovery path.

Rationale: reliable assessment delivery requires diagnosis and recovery, not only correct
happy-path code.

## Engineering Constraints

The approved baseline is a TypeScript monorepo managed with pnpm. The web application uses
React and Vite. The API uses NestJS as a modular monolith. Persistence uses MySQL through
Prisma ORM. During local development, MySQL runs through XAMPP while Node.js applications
run through pnpm.

The API MUST be versioned and documented through OpenAPI. Runtime inputs MUST be validated
at module boundaries. TypeScript strict mode MUST remain enabled. Shared packages MUST
contain stable cross-application concerns only; domain implementation MUST NOT be coupled
through an unrestricted generic package.

Authentication initially uses e-mail and password. Google authentication is a later
increment and MUST NOT introduce premature provider abstractions beyond a clean identity
boundary. The first implementation MUST keep account enumeration, password storage,
session protection, recovery-token expiration, and revocation in scope.

The system MUST begin as a modular monolith. A move to microservices requires measured
operational evidence, an approved ADR, updated specifications, and a migration plan.

The product MUST have original branding, content, terminology, components, and source
code. Functional research into reference products does not authorize copying protected
assets or trade dress. `Datria` is a temporary codename until a commercial name passes
brand, domain, and legal validation.

## Development Workflow and Quality Gates

Every increment MUST follow this order:

1. `/speckit.specify` defines user value, scenarios, requirements, non-goals, assumptions,
   and measurable outcomes.
2. `/speckit.clarify` resolves material ambiguity before architectural commitment.
3. `/speckit.plan` records technical context, constitution checks, research, contracts,
   data model, risks, and the chosen implementation strategy.
4. `/speckit.tasks` creates dependency-aware work grouped by independently testable user
   story.
5. `/speckit.analyze` checks consistency across constitution, specification, plan, and
   tasks. Any CRITICAL finding MUST be resolved before implementation.
6. Human review approves the canonical artifacts.
7. `/speckit.implement` executes only approved tasks, using test-first development for
   critical behavior.
8. Verification demonstrates acceptance scenarios and records evidence.

Before merge, the affected workspace MUST pass formatting, linting, type checking, tests,
and builds. API or data-contract changes MUST update their documentation. User-facing
changes MUST include accessibility review. Tenant-aware changes MUST include both allowed
and denied access tests.

A story is done only when its acceptance scenarios pass, its relevant automated tests
pass, observability is adequate, no unapproved high or critical vulnerability remains,
documentation is synchronized, and the Product Owner accepts the demonstrated behavior.

## Governance

This constitution supersedes informal conventions, chat instructions, generated plans,
and source-code behavior when they conflict. Product Vision and PRD define product-level
intent; this constitution defines mandatory delivery governance; each approved feature
specification defines the behavior of its increment.

Amendments require:

1. a written rationale and impact analysis;
2. an update to the Sync Impact Report;
3. Product Owner approval;
4. a semantic version increment;
5. synchronized changes to affected templates, specifications, plans, or guidance.

Versioning follows semantic versioning for governance:

- MAJOR: removes or incompatibly redefines a principle or governance obligation;
- MINOR: adds a principle or materially expands mandatory governance;
- PATCH: clarifies wording without changing obligations.

Every feature plan MUST contain a Constitution Check before research and after design.
Every code review MUST verify relevant principles. Unjustified violations block merge.
Time pressure alone is not an exception.

An exception requires documented scope, reason, risk owner, compensating controls, expiry
date, and remediation task. Principles involving tenant isolation, credential safety, or
unauthorized disclosure of personal data cannot be waived for a production release.

**Version**: 1.0.0 | **Ratified**: 2026-09-02 | **Last Amended**: 2026-09-02
