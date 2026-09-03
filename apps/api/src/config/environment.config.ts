import { ConfigService } from "@nestjs/config";
import { EnvironmentVariables } from "./env.validation";

export interface IdentityConfig {
  jwtAccessSecret: string;
  jwtIssuer: string;
  jwtAudience: string;
  accessTokenTtl: string;
  sessionIdleTtl: string;
  sessionAbsoluteTtl: string;
  emailVerificationTtl: string;
  passwordResetTtl: string;
  invitationTtl: string;
  cookieSecure: boolean;
  webOrigin: string;
}

export interface MailConfig {
  host: string;
  port: number;
  from: string;
  uiUrl: string;
}

export interface AuditConfig {
  retentionDays: number;
}

export function getIdentityConfig(
  configService: ConfigService<EnvironmentVariables, true>,
): IdentityConfig {
  return {
    jwtAccessSecret: configService.get("JWT_ACCESS_SECRET", { infer: true }),
    jwtIssuer: configService.get("JWT_ISSUER", { infer: true }),
    jwtAudience: configService.get("JWT_AUDIENCE", { infer: true }),
    accessTokenTtl: configService.get("ACCESS_TOKEN_TTL", { infer: true }),
    sessionIdleTtl: configService.get("SESSION_IDLE_TTL", { infer: true }),
    sessionAbsoluteTtl: configService.get("SESSION_ABSOLUTE_TTL", {
      infer: true,
    }),
    emailVerificationTtl: configService.get("EMAIL_VERIFICATION_TTL", {
      infer: true,
    }),
    passwordResetTtl: configService.get("PASSWORD_RESET_TTL", { infer: true }),
    invitationTtl: configService.get("INVITATION_TTL", { infer: true }),
    cookieSecure: configService.get("COOKIE_SECURE", { infer: true }),
    webOrigin: configService.get("WEB_ORIGIN", { infer: true }),
  };
}

export function getMailConfig(
  configService: ConfigService<EnvironmentVariables, true>,
): MailConfig {
  return {
    host: configService.get("SMTP_HOST", { infer: true }),
    port: configService.get("SMTP_PORT", { infer: true }),
    from: configService.get("SMTP_FROM", { infer: true }),
    uiUrl: configService.get("MAILPIT_UI_URL", { infer: true }),
  };
}

export function getAuditConfig(
  configService: ConfigService<EnvironmentVariables, true>,
): AuditConfig {
  return {
    retentionDays: configService.get("AUDIT_RETENTION_DAYS", { infer: true }),
  };
}
