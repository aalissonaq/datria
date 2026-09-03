import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Req,
  UseGuards,
} from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { Request } from "express";
import { CurrentUser } from "../../authorization/decorators";
import { AuthenticatedUser } from "../../authorization/tenant-context.interface";
import { PlatformRoleGuard } from "../../authorization/platform-role.guard";
import { PlatformService } from "../platform.service";
import { IsIn, IsNotEmpty, IsString, MinLength } from "class-validator";

export class UpdateOrgStatusDto {
  @IsIn(["ACTIVE", "SUSPENDED"])
  status!: "ACTIVE" | "SUSPENDED";

  @IsString()
  @IsNotEmpty()
  @MinLength(5)
  reason!: string;
}

@ApiTags("Platform Administration")
@Controller("platform/organizations")
@UseGuards(PlatformRoleGuard)
export class PlatformController {
  constructor(private readonly platformService: PlatformService) {}

  @Get()
  @ApiOperation({ summary: "List All Organizations (SaaS Admin)" })
  async listOrganizations() {
    const organizations = await this.platformService.listOrganizations();
    return { organizations };
  }

  @Patch(":organizationId/status")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Update Organization Status (SaaS Admin)" })
  async updateStatus(
    @Param("organizationId") organizationId: string,
    @Body() body: UpdateOrgStatusDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    const correlationId = req.correlationId || "unknown-correlation-id";

    const updated = await this.platformService.updateOrganizationStatus(
      organizationId,
      body.status,
      body.reason,
      user.id,
      correlationId,
    );

    return {
      organization: {
        id: updated.id,
        name: updated.name,
        slug: updated.slug,
        status: updated.status,
      },
    };
  }
}
