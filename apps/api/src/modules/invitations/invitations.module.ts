import { Module } from "@nestjs/common";
import { PrismaModule } from "../../prisma/prisma.module";
import { AuditModule } from "../audit/audit.module";
import { MailModule } from "../mail/mail.module";
import { TokenService } from "../identity/infrastructure/token.service";
import { InvitationRepository } from "./invitation.repository";
import { InvitationService } from "./invitation.service";
import { InvitationController } from "./presentation/invitation.controller";

@Module({
  imports: [PrismaModule, MailModule, AuditModule],
  controllers: [InvitationController],
  providers: [TokenService, InvitationRepository, InvitationService],
  exports: [InvitationRepository, InvitationService],
})
export class InvitationsModule {}
