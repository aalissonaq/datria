import { Module } from "@nestjs/common";
import { PrismaModule } from "../../prisma/prisma.module";
import { AuditModule } from "../audit/audit.module";
import { MembershipManagementService } from "./membership-management.service";
import { MembershipRepository } from "./membership.repository";

@Module({
  imports: [PrismaModule, AuditModule],
  providers: [MembershipRepository, MembershipManagementService],
  exports: [MembershipRepository, MembershipManagementService],
})
export class MembershipsModule {}
