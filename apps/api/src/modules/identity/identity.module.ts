import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { PrismaModule } from "../../prisma/prisma.module";
import { MailModule } from "../mail/mail.module";
import { AuditModule } from "../audit/audit.module";
import { SessionsModule } from "../sessions/sessions.module";
import { Argon2PasswordHasher } from "./infrastructure/argon2-password-hasher";
import { TokenService } from "./infrastructure/token.service";
import { UserRepository } from "./infrastructure/user.repository";
import { PasswordResetTokenRepository } from "./infrastructure/password-reset-token.repository";
import { RegisterService } from "./application/register.service";
import {
  ResendVerificationService,
  VerifyEmailService,
} from "./application/verify-email.service";
import { LoginService, LogoutService } from "./application/login.service";
import { ContextService } from "./application/context.service";
import { PasswordResetService } from "./application/password-reset.service";
import { RateLimiterGuard } from "./infrastructure/rate-limiter.guard";
import { CsrfController } from "./presentation/csrf.controller";
import { AuthController } from "./presentation/auth.controller";
import { ContextController } from "./presentation/context.controller";

@Module({
  imports: [
    ConfigModule,
    PrismaModule,
    MailModule,
    AuditModule,
    SessionsModule,
  ],
  controllers: [CsrfController, AuthController, ContextController],
  providers: [
    Argon2PasswordHasher,
    TokenService,
    UserRepository,
    PasswordResetTokenRepository,
    RegisterService,
    VerifyEmailService,
    ResendVerificationService,
    LoginService,
    LogoutService,
    ContextService,
    PasswordResetService,
    RateLimiterGuard,
  ],
  exports: [
    Argon2PasswordHasher,
    TokenService,
    UserRepository,
    PasswordResetTokenRepository,
    RegisterService,
    VerifyEmailService,
    ResendVerificationService,
    LoginService,
    LogoutService,
    ContextService,
    PasswordResetService,
  ],
})
export class IdentityModule {}
