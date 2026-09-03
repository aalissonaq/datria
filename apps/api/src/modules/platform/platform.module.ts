import { Module } from "@nestjs/common";
import { PrismaModule } from "../../prisma/prisma.module";
import { AuditModule } from "../audit/audit.module";
import { PlatformRoleGuard } from "../authorization/platform-role.guard";
import { PlatformService } from "./platform.service";
import { PlatformController } from "./presentation/platform.controller";

@Module({
  imports: [PrismaModule, AuditModule],
  controllers: [PlatformController],
  providers: [PlatformService, PlatformRoleGuard],
  exports: [PlatformService, PlatformRoleGuard],
})
export class PlatformModule {}
