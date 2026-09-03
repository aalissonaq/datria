import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Put,
  Req,
  UseGuards,
} from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { Request } from "express";
import { CurrentTenant, CurrentUser } from "../../authorization/decorators";
import {
  AuthenticatedUser,
  TenantContext,
} from "../../authorization/tenant-context.interface";
import {
  ForbiddenException,
  UnauthorizedException,
} from "../../../common/exceptions/domain.exception";
import { RateLimiterGuard } from "../../identity/infrastructure/rate-limiter.guard";
import { MembershipManagementService } from "../../memberships/membership-management.service";
import { ArrayNotEmpty, IsArray, IsIn, IsString } from "class-validator";

export class UpdateMemberStatusDto {
  @IsIn(["ACTIVE", "SUSPENDED", "REMOVED"])
  status!: "ACTIVE" | "SUSPENDED" | "REMOVED";
}

export class UpdateMemberRolesDto {
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  roles!: string[];
}

@ApiTags("Memberships")
@Controller("organizations/:organizationId/members")
@UseGuards(RateLimiterGuard)
export class MembersController {
  constructor(
    private readonly membershipManagementService: MembershipManagementService,
  ) {}

  @Get()
  @ApiOperation({ summary: "List Organization Members" })
  async listMembers(
    @Param("organizationId") organizationId: string,
    @CurrentUser() user: AuthenticatedUser,
    @CurrentTenant() context: TenantContext,
  ) {
    if (!user) {
      throw new UnauthorizedException();
    }

    if (
      context.type !== "ORGANIZATION" ||
      context.organizationId !== organizationId
    ) {
      throw new ForbiddenException();
    }

    const members =
      await this.membershipManagementService.listMembers(organizationId);

    return {
      members: members.map((m) => ({
        id: m.id,
        userId: m.userId,
        status: m.status,
        joinedAt: m.joinedAt,
        suspendedAt: m.suspendedAt,
        roles: m.roles.map((r) => r.role.code),
      })),
    };
  }

  @Patch(":membershipId/status")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Update Member Status" })
  async updateStatus(
    @Param("organizationId") organizationId: string,
    @Param("membershipId") membershipId: string,
    @Body() body: UpdateMemberStatusDto,
    @CurrentUser() user: AuthenticatedUser,
    @CurrentTenant() context: TenantContext,
    @Req() req: Request,
  ) {
    if (!user) {
      throw new UnauthorizedException();
    }

    if (
      context.type !== "ORGANIZATION" ||
      context.organizationId !== organizationId ||
      !context.roles.includes("INSTITUTION_ADMIN")
    ) {
      throw new ForbiddenException(
        "Only organization administrators can update member status",
      );
    }

    const correlationId = req.correlationId || "unknown-correlation-id";

    const updated = await this.membershipManagementService.updateMemberStatus(
      organizationId,
      membershipId,
      body.status,
      user.id,
      correlationId,
    );

    return {
      membership: {
        id: updated.id,
        status: updated.status,
        suspendedAt: updated.suspendedAt,
        roles: updated.roles.map((r) => r.role.code),
      },
    };
  }

  @Put(":membershipId/roles")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Update Member Roles" })
  async updateRoles(
    @Param("organizationId") organizationId: string,
    @Param("membershipId") membershipId: string,
    @Body() body: UpdateMemberRolesDto,
    @CurrentUser() user: AuthenticatedUser,
    @CurrentTenant() context: TenantContext,
    @Req() req: Request,
  ) {
    if (!user) {
      throw new UnauthorizedException();
    }

    if (
      context.type !== "ORGANIZATION" ||
      context.organizationId !== organizationId ||
      !context.roles.includes("INSTITUTION_ADMIN")
    ) {
      throw new ForbiddenException(
        "Only organization administrators can update member roles",
      );
    }

    const correlationId = req.correlationId || "unknown-correlation-id";

    const updated = await this.membershipManagementService.updateMemberRoles(
      organizationId,
      membershipId,
      body.roles,
      user.id,
      correlationId,
    );

    return {
      membership: {
        id: updated.id,
        status: updated.status,
        roles: updated.roles.map((r) => r.role.code),
      },
    };
  }
}
