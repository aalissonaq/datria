export type ContextType = "PERSONAL" | "ORGANIZATION";

export interface PersonalContext {
  type: "PERSONAL";
  userId: string;
}

export interface OrganizationContext {
  type: "ORGANIZATION";
  userId: string;
  organizationId: string;
  organizationName: string;
  organizationSlug: string;
  membershipId: string;
  roles: string[];
}

export type TenantContext = PersonalContext | OrganizationContext;

export interface AuthenticatedUser {
  id: string;
  email: string;
  displayName: string;
  sessionId: string;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
      tenantContext?: TenantContext;
    }
  }
}
