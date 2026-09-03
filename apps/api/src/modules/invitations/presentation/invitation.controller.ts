import {
  Body,
  Controller,
  Delete,
  HttpCode,
  HttpStatus,
  Param,
  Post,
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
import {
  RateLimit,
  RateLimiterGuard,
} from "../../identity/infrastructure/rate-limiter.guard";
import { InvitationService } from "../invitation.service";
import { ArrayNotEmpty, IsArray, IsEmail, IsString } from "class-validator";

export class CreateInvitationDto {
  @IsEmail()
  email!: string;

  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  roles!: string[];
}

@ApiTags("Invitations")
@Controller()
@UseGuards(RateLimiterGuard)
export class InvitationController {
  constructor(private readonly invitationService: InvitationService) {}

  @Post("organizations/:organizationId/invitations")
  @RateLimit({ limit: 20, windowMs: 60 * 1000 })
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: "Invite Member to Organization" })
  async createInvitation(
    @Param("organizationId") organizationId: string,
    @Body() body: CreateInvitationDto,
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
        "Only organization administrators can invite members",
      );
    }

    const correlationId = req.correlationId || "unknown-correlation-id";

    const result = await this.invitationService.createInvitation(
      organizationId,
      body.email,
      body.roles,
      user.id,
      correlationId,
    );

    return {
      invitation: {
        id: result.invitation.id,
        email: result.invitation.email,
        status: result.invitation.status,
        expiresAt: result.invitation.expiresAt,
        roles: result.invitation.roles.map((r) => r.role.code),
      },
      rawToken: result.rawToken,
    };
  }

  @Post("organizations/:organizationId/invitations/:invitationId/resend")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Resend Invitation" })
  async resendInvitation(
    @Param("organizationId") organizationId: string,
    @Param("invitationId") invitationId: string,
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
      throw new ForbiddenException();
    }

    const correlationId = req.correlationId || "unknown-correlation-id";

    await this.invitationService.resendInvitation(
      organizationId,
      invitationId,
      user.id,
      correlationId,
    );

    return { message: "Invitation resent successfully" };
  }

  @Delete("organizations/:organizationId/invitations/:invitationId")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Revoke Invitation" })
  async revokeInvitation(
    @Param("organizationId") organizationId: string,
    @Param("invitationId") invitationId: string,
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
      throw new ForbiddenException();
    }

    const correlationId = req.correlationId || "unknown-correlation-id";

    await this.invitationService.revokeInvitation(
      organizationId,
      invitationId,
      user.id,
      correlationId,
    );

    return { message: "Invitation revoked successfully" };
  }

  @Post("invitations/:token/accept")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Accept Invitation" })
  async acceptInvitation(
    @Param("token") token: string,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    if (!user) {
      throw new UnauthorizedException();
    }

    const correlationId = req.correlationId || "unknown-correlation-id";

    const result = await this.invitationService.acceptInvitation(
      token,
      user.id,
      correlationId,
    );

    return {
      message: "Invitation accepted successfully",
      organization: {
        id: result.organization.id,
        name: result.organization.name,
        slug: result.organization.slug,
      },
    };
  }
}
