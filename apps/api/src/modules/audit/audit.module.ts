import { Global, Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { PrismaModule } from "../../prisma/prisma.module";
import { AuditRepository } from "./audit.repository";
import { AuditService } from "./audit.service";
import { AuditCleanupJob } from "./audit-cleanup.job";

@Global()
@Module({
  imports: [ConfigModule, PrismaModule],
  providers: [AuditRepository, AuditService, AuditCleanupJob],
  exports: [AuditRepository, AuditService, AuditCleanupJob],
})
export class AuditModule {}
