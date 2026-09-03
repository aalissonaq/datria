import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  UseGuards,
} from "@nestjs/common";
import {
  ApiCreatedResponse,
  ApiConflictResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from "@nestjs/swagger";
import { Request } from "express";
import { CurrentUser } from "../../authorization/decorators";
import { AuthenticatedUser } from "../../authorization/tenant-context.interface";
import { UnauthorizedException } from "../../../common/exceptions/domain.exception";
import {
  RateLimit,
  RateLimiterGuard,
} from "../../identity/infrastructure/rate-limiter.guard";
import { OrganizationService } from "../organization.service";
import { IsString, Length, Matches } from "class-validator";

export class CreateOrganizationRequestDto {
  @IsString()
  @Length(2, 160)
  name!: string;

  @IsString()
  @Length(3, 80)
  @Matches(/^[a-z0-9]+(-[a-z0-9]+)*$/, {
    message: "Slug must be lowercase alphanumeric characters and hyphens",
  })
  slug!: string;
}

@ApiTags("Organizations")
@Controller("organizations")
@UseGuards(RateLimiterGuard)
export class OrganizationController {
  constructor(private readonly organizationService: OrganizationService) {}

  @Post()
  @RateLimit({ limit: 10, windowMs: 60 * 60 * 1000 })
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: "Create New Organization" })
  @ApiCreatedResponse()
  @ApiConflictResponse()
  @ApiUnauthorizedResponse()
  async createOrganization(
    @Body() body: CreateOrganizationRequestDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    if (!user) {
      throw new UnauthorizedException();
    }

    const correlationId = req.correlationId || "unknown-correlation-id";

    const result = await this.organizationService.createOrganization(
      body,
      user.id,
      correlationId,
    );

    return {
      organization: {
        id: result.organization.id,
        name: result.organization.name,
        slug: result.organization.slug,
        status: result.organization.status,
      },
      membership: {
        id: result.membership.id,
        roles: result.membership.roles.map((r) => r.role.code),
      },
    };
  }
}
