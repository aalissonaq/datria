import path from "node:path";
import { MiddlewareConsumer, Module, NestModule } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from "@nestjs/core";
import { validateEnvironment } from "./config/env.validation";
import { PrismaModule } from "./prisma/prisma.module";
import { HealthModule } from "./modules/health/health.module";
import { MailModule } from "./modules/mail/mail.module";
import { AuditModule } from "./modules/audit/audit.module";
import { AuthorizationModule } from "./modules/authorization/authorization.module";
import { IdentityModule } from "./modules/identity/identity.module";
import { HttpExceptionFilter } from "./common/filters/http-exception.filter";
import { CorrelationIdMiddleware } from "./common/middleware/correlation-id.middleware";
import { AuthenticationGuard } from "./modules/authorization/authentication.guard";
import { CsrfGuard } from "./common/guards/csrf.guard";
import { TenantContextResolver } from "./modules/authorization/tenant-context.resolver";

import { SessionsModule } from "./modules/sessions/sessions.module";
import { OrganizationsModule } from "./modules/organizations/organizations.module";
import { MembershipsModule } from "./modules/memberships/memberships.module";
import { InvitationsModule } from "./modules/invitations/invitations.module";
import { PlatformModule } from "./modules/platform/platform.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [
        path.resolve(process.cwd(), ".env"),
        path.resolve(process.cwd(), "../../.env"),
        path.resolve(__dirname, "../../.env"),
        path.resolve(__dirname, "../../../.env"),
        ".env",
        "../../.env",
      ],
      validate: validateEnvironment,
    }),
    PrismaModule,
    HealthModule,
    MailModule,
    AuditModule,
    AuthorizationModule,
    SessionsModule,
    IdentityModule,
    OrganizationsModule,
    MembershipsModule,
    InvitationsModule,
    PlatformModule,
  ],
  providers: [
    {
      provide: APP_FILTER,
      useClass: HttpExceptionFilter,
    },
    {
      provide: APP_GUARD,
      useClass: AuthenticationGuard,
    },
    {
      provide: APP_GUARD,
      useClass: CsrfGuard,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: TenantContextResolver,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(CorrelationIdMiddleware).forRoutes("*");
  }
}
