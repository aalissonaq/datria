import { Module } from "@nestjs/common";
import { PrismaModule } from "../../prisma/prisma.module";
import { AuditModule } from "../audit/audit.module";
import { MembershipsModule } from "../memberships/memberships.module";
import { OrganizationRepository } from "./organization.repository";
import { OrganizationService } from "./organization.service";
import { MembersController } from "./presentation/members.controller";
import { OrganizationController } from "./presentation/organization.controller";

@Module({
  imports: [PrismaModule, AuditModule, MembershipsModule],
  controllers: [OrganizationController, MembersController],
  providers: [OrganizationRepository, OrganizationService],
  exports: [OrganizationRepository, OrganizationService],
})
export class OrganizationsModule {}
