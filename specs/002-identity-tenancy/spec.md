# Feature Specification: Identity and Multi-Tenancy

**Feature Branch**: `002-identity-tenancy`  
**Created**: 2026-09-03  
**Status**: Draft for Product Owner review  
**Input**: Provide open registration, secure e-mail/password authentication, personal and
multi-organization contexts, institutional roles, invitations, and enforced tenant
isolation for the Datria platform.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Register and access a personal context (Priority: P1)

As a new user, I want to create an account with my e-mail and password so that I can access
my personal context without waiting for an institutional invitation.

**Why this priority**: Open registration is the entry point for autonomous teachers,
participants, and future organization creators.

**Independent Test**: A visitor registers with a unique e-mail, verifies ownership of that
address, signs in, and reaches an empty personal context without receiving an institutional
or platform-administration role.

**Acceptance Scenarios**:

1. **Given** a visitor with an unused e-mail, **When** the visitor submits a valid name,
   e-mail, password, and required consent, **Then** the system creates a pending account and
   sends an e-mail verification instruction.
2. **Given** a pending account with a valid verification token, **When** the user verifies
   the e-mail, **Then** the account becomes active and can authenticate.
3. **Given** an active account, **When** the user signs in with valid credentials, **Then**
   the system opens the user's personal context.
4. **Given** a newly registered account, **When** permissions are inspected, **Then** the
   account has no SaaS administrator, institutional administrator, professor, or reviewer
   privilege merely because registration was public.
5. **Given** an e-mail already associated with an account, **When** registration is
   submitted again, **Then** the response does not expose sensitive account details and
   provides a safe next action.

---

### User Story 2 - Authenticate and manage secure sessions (Priority: P1)

As an active user, I want to sign in and sign out securely so that only I can use my
authenticated session.

**Why this priority**: Every protected capability depends on trustworthy identity and
revocable sessions.

**Independent Test**: An active user signs in, accesses a protected identity summary,
signs out, and can no longer use the revoked session.

**Acceptance Scenarios**:

1. **Given** an active account and correct credentials, **When** the user signs in, **Then**
   a protected session is established without exposing authentication secrets to browser
   scripts.
2. **Given** an incorrect e-mail or password, **When** sign-in is attempted, **Then** the
   system returns the same neutral error and does not reveal whether the account exists.
3. **Given** an authenticated user, **When** the user signs out, **Then** the current
   session is revoked and cannot access a protected resource again.
4. **Given** repeated failed attempts, **When** the configured abuse threshold is reached,
   **Then** the system slows or temporarily blocks further attempts without permanently
   denying the legitimate owner.
5. **Given** an inactive, unverified, or administratively blocked account, **When** correct
   credentials are supplied, **Then** authentication is refused with an appropriate safe
   recovery or support instruction.

---

### User Story 3 - Recover access after forgetting a password (Priority: P1)

As a user who forgot the password, I want to define a new password through a temporary
e-mail link so that I can recover access without support intervention.

**Why this priority**: Open registration requires a self-service recovery path and prevents
avoidable support dependency.

**Independent Test**: A user requests recovery, uses a valid single-use token, defines a
new password, signs in with it, and confirms that the previous password and older sessions
no longer work.

**Acceptance Scenarios**:

1. **Given** any syntactically valid e-mail, **When** recovery is requested, **Then** the
   same confirmation is shown whether or not an account exists.
2. **Given** an active account, **When** recovery is requested, **Then** a temporary,
   single-use link is sent to the registered e-mail.
3. **Given** a valid recovery token, **When** a compliant new password is submitted,
   **Then** the password is changed, the token is consumed, and existing sessions are
   revoked.
4. **Given** an expired, invalid, or previously consumed token, **When** it is submitted,
   **Then** no password changes and the user receives a safe instruction to request a new
   link.

---

### User Story 4 - Create and switch organization contexts (Priority: P1)

As an authenticated user, I want to create organizations and switch between my personal
and institutional contexts so that I can keep independent work and organization-owned work
separated.

**Why this priority**: The platform must serve autonomous users and users who participate
in multiple institutions without mixing ownership or permissions.

**Independent Test**: An authenticated user creates one organization, becomes its
institutional administrator, joins a second organization by invitation, switches among
both organizations and the personal context, and sees only resources authorized in the
active context.

**Acceptance Scenarios**:

1. **Given** an authenticated and verified user, **When** the user creates a valid
   organization, **Then** the organization is created and the creator receives its active
   institutional-administrator membership.
2. **Given** memberships in two organizations, **When** the user changes the active
   context, **Then** permissions and visible organization information change to that
   context without changing memberships in the other organization.
3. **Given** an authenticated user, **When** the user selects the personal context, **Then**
   no institutional role or organization-owned resource is inherited.
4. **Given** a request containing an organization identifier for which the user has no
   active membership, **When** the request reaches a protected operation, **Then** access
   is denied even if the identifier is valid.
5. **Given** a suspended membership in the currently active organization, **When** the user
   makes another protected request, **Then** access is denied and the user is directed to
   another available context.

---

### User Story 5 - Invite members and assign institutional roles (Priority: P2)

As an institutional administrator, I want to invite people and assign approved roles so
that professors, reviewers, participants, and other administrators receive only the access
needed in that organization.

**Why this priority**: Organizations require controlled onboarding and organization-scoped
authorization before academic or assessment resources are added.

**Independent Test**: An institutional administrator invites an unused e-mail as Professor,
the recipient creates or links an account, accepts the invitation, and gains Professor
access only inside that organization.

**Acceptance Scenarios**:

1. **Given** an institutional administrator, **When** a valid invitation with one or more
   permitted roles is created, **Then** the recipient receives a single-use, expiring
   invitation.
2. **Given** an invitee without an account, **When** the invitation is accepted after
   registration and e-mail verification, **Then** an active membership is created with the
   roles defined by the inviter.
3. **Given** an invitee with an existing account using the invited e-mail, **When** the
   authenticated invitee accepts, **Then** the membership is linked to that account without
   creating a duplicate user.
4. **Given** an expired, revoked, consumed, or e-mail-mismatched invitation, **When**
   acceptance is attempted, **Then** no membership is created.
5. **Given** an institutional administrator, **When** roles are changed or a membership is
   suspended, **Then** the new authorization takes effect on the next protected request and
   the change is audited.
6. **Given** any institutional administrator, **When** an attempt is made to grant the SaaS
   administrator role, **Then** the operation is denied.
7. **Given** an organization with only one active institutional administrator, **When**
   that person's administrator role or membership would be removed, **Then** the operation
   is blocked until another active administrator exists.

---

### User Story 6 - Operate platform administration separately (Priority: P3)

As a SaaS administrator, I want a separately controlled platform role so that I can manage
organizations and account status without inheriting ordinary institutional membership.

**Why this priority**: Platform operations are needed, but the global role carries elevated
risk and must not be mixed with public registration or institutional administration.

**Independent Test**: A pre-authorized SaaS administrator authenticates, performs one
audited platform operation, and a normal or institutional administrator is denied the same
operation.

**Acceptance Scenarios**:

1. **Given** a public registration or institutional invitation, **When** role assignment is
   processed, **Then** the SaaS administrator role is never available.
2. **Given** a pre-authorized SaaS administrator, **When** a platform operation is
   performed, **Then** access is allowed and the action is recorded in an immutable audit
   trail.
3. **Given** a user without the platform role, **When** the same operation is attempted,
   **Then** access is denied regardless of institutional roles.
4. **Given** a SaaS administrator inspecting an organization, **When** no support or
   operational purpose has been established, **Then** access to organization-owned content
   remains denied by default.

### Edge Cases

- E-mail addresses differ only by letter case or surrounding whitespace.
- Two registration requests for the same normalized e-mail arrive concurrently.
- The verification, recovery, or invitation link is opened more than once.
- A user requests multiple password-recovery links; only the applicable token remains
  usable according to the approved token policy.
- A user changes password while another device has an active session.
- A membership is suspended while the user is using that organization.
- Two administrators try to remove each other's final administrator role concurrently.
- An invitation is issued to an e-mail that later changes before acceptance.
- A user belongs to many organizations with different roles in each one.
- A request supplies a valid resource identifier from another tenant.
- Database uniqueness and application validation receive conflicting concurrent requests.
- E-mail delivery fails after a verification, invitation, or recovery request is created.
- The session expires while the user is switching contexts.
- A blocked account has valid organization memberships.

## Requirements *(mandatory)*

### Functional Requirements

#### Account registration and verification

- **FR-001**: The system MUST allow public registration using name, e-mail, password, and
  acceptance of the required legal terms.
- **FR-002**: The system MUST normalize e-mail addresses consistently and enforce one user
  account per normalized e-mail.
- **FR-003**: The system MUST verify ownership of the registered e-mail through an expiring,
  single-use, non-guessable token before protected product capabilities are enabled.
- **FR-004**: Public registration MUST create access to a personal context and MUST NOT
  grant any institutional or SaaS-administration role.
- **FR-005**: Registration and resend-verification responses MUST avoid exposing whether a
  usable account already exists.
- **FR-006**: The system MUST record the applicable terms/privacy version and timestamp of
  consent without treating consent as irrevocable authorization for unrelated processing.

#### Authentication and sessions

- **FR-007**: The system MUST authenticate active, verified users by e-mail and password.
- **FR-008**: Passwords MUST be checked against a documented minimum-strength policy and
  stored only through an adaptive password-hashing function approved by the technical plan.
- **FR-009**: Authentication responses MUST use neutral errors that do not enumerate
  accounts.
- **FR-010**: The browser session MUST use secure, HTTP-only cookie protection and MUST NOT
  persist bearer credentials in browser storage accessible to scripts.
- **FR-011**: Sessions MUST have defined idle and absolute expiration limits.
- **FR-012**: The system MUST support sign-out of the current session and invalidate it
  server-side.
- **FR-013**: Password changes, account blocking, and security-sensitive account recovery
  MUST revoke all existing sessions for that account.
- **FR-014**: Authentication, verification, invitation, and recovery endpoints MUST apply
  abuse protection appropriate to their risk.
- **FR-015**: Protected requests MUST re-evaluate account and membership status instead of
  trusting stale client-provided roles.

#### Password recovery

- **FR-016**: Any visitor MUST be able to request password recovery using a syntactically
  valid e-mail without learning whether an account exists.
- **FR-017**: Recovery tokens MUST be non-guessable, stored in non-reusable form, expire,
  and be consumed after successful use.
- **FR-018**: A successful password reset MUST enforce the password policy and revoke all
  existing sessions.
- **FR-019**: Invalid, expired, revoked, or consumed recovery tokens MUST NOT change account
  data.

#### Personal and organization contexts

- **FR-020**: Every active user MUST have a personal context that is logically distinct
  from all organizations.
- **FR-021**: A verified user MUST be able to create an organization and become its first
  active institutional administrator.
- **FR-022**: A user MUST be able to maintain active memberships in multiple organizations.
- **FR-023**: An authenticated user MUST be able to switch among the personal context and
  organizations with active memberships.
- **FR-024**: The active context MUST be validated on every protected server request and
  MUST NOT be accepted solely from a client-supplied organization identifier.
- **FR-025**: Personal resources MUST NOT inherit organization roles, and organization
  resources MUST NOT become visible from the personal context.
- **FR-026**: Organization-owned records MUST include an explicit tenant boundary and all
  tenant-aware queries and commands MUST enforce it.
- **FR-027**: Cross-tenant access attempts MUST be denied consistently and recorded when
  they meet the security-event policy.
- **FR-028**: Suspending or removing a membership MUST terminate its access no later than
  the user's next protected request.

#### Invitations, memberships, and roles

- **FR-029**: Institutional administrators MUST be able to invite a person by e-mail and
  assign only organization-scoped roles they are authorized to manage.
- **FR-030**: Invitations MUST be scoped to exactly one organization, expire, be revocable,
  and be accepted only once by the intended e-mail identity.
- **FR-031**: Accepting an invitation MUST create or activate one membership without
  duplicating an existing user account.
- **FR-032**: The initial organization roles MUST be Institutional Administrator,
  Professor, Reviewer, and Participant.
- **FR-033**: A membership MUST support more than one compatible organization role.
- **FR-034**: Institutional administrators MUST be able to list members, change permitted
  roles, resend or revoke pending invitations, and suspend or reactivate memberships.
- **FR-035**: The system MUST prevent an organization from having zero active institutional
  administrators.
- **FR-036**: Institutional roles MUST apply only inside the organization that granted
  them.
- **FR-037**: No institutional workflow MUST grant or revoke the SaaS Administrator role.

#### Platform administration and audit

- **FR-038**: SaaS Administrator MUST be a separate global role provisioned only through a
  controlled operational procedure defined in the technical plan.
- **FR-039**: SaaS administrators MUST be able to list organizations, inspect organization
  status, and block or reactivate an organization according to an audited platform policy.
- **FR-040**: SaaS administration MUST NOT automatically grant access to organization-owned
  academic, assessment, response, or content data.
- **FR-041**: The system MUST record security and administration events including account
  verification, successful and failed authentication according to policy, recovery,
  session revocation, organization creation, invitation lifecycle, membership status,
  role changes, and platform-status changes.
- **FR-042**: Audit records MUST identify actor, action, target category, tenant context
  when applicable, outcome, timestamp, and correlation identifier without storing passwords,
  raw tokens, session secrets, or unnecessary personal data.
- **FR-043**: Authorization denials MUST use consistent errors and MUST NOT reveal the
  existence of inaccessible cross-tenant resources.
- **FR-044**: Identity, membership, role, and invitation state changes MUST be safe under
  concurrent requests and protected by database constraints where applicable.
- **FR-045**: All identity and tenant operations MUST expose documented, versioned API
  contracts and validated inputs.

## Role Baseline

| Role | Scope | Initial responsibility | Assignment rule |
|---|---|---|---|
| SaaS Administrator | Global platform | Organization/account status and platform operation | Controlled operational provisioning only |
| Institutional Administrator | One organization | Members, invitations, roles, and organization settings | Organization creator or another authorized admin |
| Professor | One organization | Future academic and assessment authoring | Institutional invitation/assignment |
| Reviewer | One organization | Future review and approval workflows | Institutional invitation/assignment |
| Participant | One organization | Future participation in assigned activities | Institutional invitation/assignment |

Roles grant no domain capability that has not yet been specified. In this increment they
establish identity, scope, and authorization boundaries for future features.

## Key Entities

- **User**: Global identity with normalized e-mail, display name, status, verification
  state, password credential reference, consent evidence, and timestamps.
- **Session**: Revocable authenticated session tied to one user, with creation, last-use,
  idle expiration, absolute expiration, revocation, and security metadata.
- **VerificationToken**: Single-use, expiring proof for e-mail ownership; raw token is never
  persisted.
- **PasswordResetToken**: Single-use, expiring recovery authorization; raw token is never
  persisted.
- **Organization**: Tenant boundary with name, unique slug, status, timezone, and lifecycle
  timestamps.
- **Membership**: Relationship between one user and one organization, including status and
  lifecycle timestamps.
- **Role**: Approved global or organization-scoped authorization role.
- **MembershipRole**: Assignment of one organization role to one membership.
- **Invitation**: Expiring, revocable, single-use invitation for one e-mail, organization,
  and proposed role set.
- **AuditEvent**: Append-only evidence of a security or administrative action, scoped to an
  organization where applicable.

## Scope Boundaries

### In Scope

- public account registration;
- e-mail verification and resend flow;
- e-mail/password sign-in and sign-out;
- revocable browser sessions;
- self-service password recovery;
- personal context;
- organization creation;
- multiple organization memberships and active-context switching;
- roles defined in the Role Baseline;
- institutional invitations and membership management;
- SaaS administration boundary and minimal organization-status operations;
- tenant-aware authorization foundation;
- security and administration audit events;
- accessible, responsive screens required for these flows;
- automated unit, integration, authorization, isolation, and E2E tests.

### Out of Scope

- Google, Microsoft, or other social authentication;
- multi-factor authentication;
- enterprise SSO, SAML, or SCIM;
- custom role/permission builder;
- organization billing, subscriptions, limits, and plans;
- courses, disciplines, classes, participant imports, or academic enrollment;
- question bank, assessments, attempts, grading, reports, content, and certificates;
- support impersonation or unrestricted SaaS-admin access to tenant data;
- account merging, e-mail change, or ownership transfer;
- production-grade transactional e-mail provider selection beyond a replaceable delivery
  boundary and development-safe adapter.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: At least 95% of test participants can complete registration, e-mail
  verification, and first sign-in without assistance in five minutes or less.
- **SC-002**: One hundred percent of tested cross-tenant read and write attempts are denied
  without revealing whether the target resource exists.
- **SC-003**: Role or membership suspension affects the next protected request and requires
  no browser restart.
- **SC-004**: One user can switch among a personal context and at least three organization
  contexts without permissions or visible organization identity leaking between them.
- **SC-005**: One hundred percent of successful password resets invalidate every previously
  active session and reject reuse of the recovery token.
- **SC-006**: Public registration, institutional administration, and invitation workflows
  cannot assign SaaS Administrator in all automated negative tests.
- **SC-007**: Every role, membership, invitation, organization-status, and recovery state
  transition defined as auditable produces one correlated audit event without a password,
  raw token, or session secret.
- **SC-008**: Registration, login, recovery, invitation acceptance, organization switching,
  and member-management journeys pass keyboard-only and automated accessibility checks.
- **SC-009**: Under the agreed baseline load, 95% of interactive identity operations provide
  a user-visible result within two seconds, excluding external e-mail delivery time.

## Assumptions

- Open registration is available to all visitors, but self-registration creates only a
  personal context and no privileged role.
- E-mail verification is mandatory before protected product use, organization creation, or
  invitation acceptance.
- Any verified user may create an organization and becomes its first Institutional
  Administrator.
- A person may belong to multiple organizations while keeping a separate personal context.
- The first institutional roles are Institutional Administrator, Professor, Reviewer, and
  Participant; permissions are fixed in code for this increment.
- SaaS Administrator is provisioned operationally and never through public or institutional
  user interfaces.
- E-mail delivery uses a development-safe adapter locally and a replaceable provider
  boundary; production vendor selection may remain a deployment decision.
- Account status and organization status are revalidated during protected access.
- The product timezone default may be configured, while organization-specific timezone is
  persisted for later scheduling features.
- Datria remains a temporary codename.

## Dependencies

- Completed and accepted `001-foundation` with green continuous integration.
- Ratified project constitution.
- Approved Product Vision 1.2 and PRD 1.2.
- Working MySQL/Prisma baseline.
- A development-safe method to inspect verification, invitation, and recovery messages.

