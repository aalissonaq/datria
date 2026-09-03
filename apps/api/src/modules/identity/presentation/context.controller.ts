import { Controller, Get } from "@nestjs/common";
import { ApiOkResponse, ApiOperation, ApiTags } from "@nestjs/swagger";
import { CurrentTenant, CurrentUser } from "../../authorization/decorators";
import {
  AuthenticatedUser,
  TenantContext,
} from "../../authorization/tenant-context.interface";
import { UnauthorizedException } from "../../../common/exceptions/domain.exception";
import { ContextService } from "../application/context.service";

@ApiTags("Context")
@Controller("me/contexts")
export class ContextController {
  constructor(private readonly contextService: ContextService) {}

  @Get()
  @ApiOperation({ summary: "List Personal and Institutional Contexts" })
  @ApiOkResponse()
  async getContexts(
    @CurrentUser() user: AuthenticatedUser,
    @CurrentTenant() activeContext?: TenantContext,
  ) {
    if (!user) {
      throw new UnauthorizedException();
    }
    return this.contextService.getContext(user.id, activeContext);
  }
}
