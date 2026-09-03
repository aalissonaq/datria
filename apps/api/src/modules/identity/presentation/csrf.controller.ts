import { randomBytes } from "node:crypto";
import { Controller, Get, Res } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { ApiOkResponse, ApiOperation, ApiTags } from "@nestjs/swagger";
import { Response } from "express";
import { CSRF_COOKIE_NAME, SkipCsrf } from "../../../common/guards/csrf.guard";
import { Public } from "../../authorization/authentication.guard";
import { EnvironmentVariables } from "../../../config/env.validation";

export interface CsrfResponseDto {
  csrfToken: string;
}

@ApiTags("Auth")
@Controller("auth")
export class CsrfController {
  private readonly isSecure: boolean;

  constructor(
    private readonly configService: ConfigService<EnvironmentVariables, true>,
  ) {
    this.isSecure =
      this.configService.get("COOKIE_SECURE", { infer: true }) ?? false;
  }

  @Get("csrf")
  @Public()
  @SkipCsrf()
  @ApiOperation({
    summary: "Issue CSRF Token",
    description:
      "Emits the readable CSRF cookie and returns the token required in the X-CSRF-Token header.",
  })
  @ApiOkResponse({
    description: "CSRF token generated successfully",
    schema: {
      type: "object",
      properties: {
        csrfToken: { type: "string" },
      },
    },
  })
  issueCsrfToken(
    @Res({ passthrough: true }) response: Response,
  ): CsrfResponseDto {
    const csrfToken = randomBytes(32).toString("hex");

    response.cookie(CSRF_COOKIE_NAME, csrfToken, {
      httpOnly: false, // Must be accessible to browser client to attach to header
      sameSite: "lax",
      secure: this.isSecure,
      path: "/",
    });

    return { csrfToken };
  }
}
