import { Global, Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { PrismaModule } from "../../prisma/prisma.module";
import { AuditModule } from "../audit/audit.module";
import { TokenService } from "../identity/infrastructure/token.service";
import { SessionRepository } from "./session.repository";
import { SessionService } from "./session.service";

@Global()
@Module({
  imports: [PrismaModule, JwtModule.register({}), AuditModule],
  providers: [SessionRepository, SessionService, TokenService],
  exports: [SessionRepository, SessionService, TokenService],
})
export class SessionsModule {}
