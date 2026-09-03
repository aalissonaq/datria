import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UseGuards,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  ApiAcceptedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from "@nestjs/swagger";
import { Request, Response } from "express";
import { CurrentUser, CurrentTenant } from "../../authorization/decorators";
import {
  Public,
  ACCESS_COOKIE_NAME,
} from "../../authorization/authentication.guard";
import {
  AuthenticatedUser,
  TenantContext,
} from "../../authorization/tenant-context.interface";
import { UnauthorizedException } from "../../../common/exceptions/domain.exception";
import { EnvironmentVariables } from "../../../config/env.validation";
import { LoginService, LogoutService } from "../application/login.service";
import { RegisterService } from "../application/register.service";
import {
  ResendVerificationService,
  VerifyEmailService,
} from "../application/verify-email.service";
import { ContextService } from "../application/context.service";
import { SessionService } from "../../sessions/session.service";
import {
  RateLimit,
  RateLimiterGuard,
} from "../infrastructure/rate-limiter.guard";
import { PasswordResetService } from "../application/password-reset.service";
import {
  ForgotPasswordRequestDto,
  LoginRequestDto,
  LoginResponseDto,
  MessageResponseDto,
  RegisterRequestDto,
  ResendVerificationRequestDto,
  ResetPasswordRequestDto,
  UserResponseDto,
  VerifyEmailRequestDto,
} from "./dto/auth.dto";

export const REFRESH_COOKIE_NAME = "datria_refresh";

@ApiTags("Auth")
@Controller("auth")
@UseGuards(RateLimiterGuard)
export class AuthController {
  private readonly isSecure: boolean;
  private readonly webOrigin: string;

  constructor(
    private readonly registerService: RegisterService,
    private readonly verifyEmailService: VerifyEmailService,
    private readonly resendVerificationService: ResendVerificationService,
    private readonly loginService: LoginService,
    private readonly logoutService: LogoutService,
    private readonly sessionService: SessionService,
    private readonly contextService: ContextService,
    private readonly passwordResetService: PasswordResetService,
    private readonly configService: ConfigService<EnvironmentVariables, true>,
  ) {
    this.isSecure =
      this.configService.get("COOKIE_SECURE", { infer: true }) ?? false;
    this.webOrigin =
      this.configService.get("WEB_ORIGIN", { infer: true }) ||
      "http://localhost:5173";
  }

  private setAuthCookies(
    res: Response,
    accessToken: string,
    refreshToken: string,
  ): void {
    res.cookie(ACCESS_COOKIE_NAME, accessToken, {
      httpOnly: true,
      sameSite: "lax",
      secure: this.isSecure,
      path: "/",
      maxAge: 15 * 60 * 1000, // 15 minutes
    });

    res.cookie(REFRESH_COOKIE_NAME, refreshToken, {
      httpOnly: true,
      sameSite: "lax",
      secure: this.isSecure,
      path: "/api/v1/auth/refresh",
      maxAge: 8 * 60 * 60 * 1000, // 8 hours absolute
    });
  }

  private clearAuthCookies(res: Response): void {
    res.clearCookie(ACCESS_COOKIE_NAME, {
      httpOnly: true,
      sameSite: "lax",
      secure: this.isSecure,
      path: "/",
    });
    res.clearCookie(REFRESH_COOKIE_NAME, {
      httpOnly: true,
      sameSite: "lax",
      secure: this.isSecure,
      path: "/api/v1/auth/refresh",
    });
  }

  @Post("register")
  @Public()
  @RateLimit({ limit: 10, windowMs: 60 * 60 * 1000 })
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: "Register New User Account" })
  @ApiAcceptedResponse({ type: MessageResponseDto })
  async register(
    @Body() body: RegisterRequestDto,
    @Req() req: Request,
  ): Promise<MessageResponseDto> {
    const correlationId = req.correlationId || "unknown-correlation-id";
    return this.registerService.register(body, correlationId, this.webOrigin);
  }

  @Post("verify-email")
  @Public()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Verify Email Address" })
  @ApiNoContentResponse()
  async verifyEmail(
    @Body() body: VerifyEmailRequestDto,
    @Req() req: Request,
  ): Promise<void> {
    const correlationId = req.correlationId || "unknown-correlation-id";
    await this.verifyEmailService.verifyEmail(body, correlationId);
  }

  @Post("resend-verification")
  @Public()
  @RateLimit({ limit: 3, windowMs: 15 * 60 * 1000 })
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: "Resend Email Verification Link" })
  @ApiAcceptedResponse({ type: MessageResponseDto })
  async resendVerification(
    @Body() body: ResendVerificationRequestDto,
    @Req() req: Request,
  ): Promise<MessageResponseDto> {
    const correlationId = req.correlationId || "unknown-correlation-id";
    return this.resendVerificationService.resendVerification(
      body,
      correlationId,
      this.webOrigin,
    );
  }

  @Post("login")
  @Public()
  @RateLimit({ limit: 5, windowMs: 15 * 60 * 1000 })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Sign In with Credentials" })
  @ApiOkResponse({ type: LoginResponseDto })
  @ApiUnauthorizedResponse()
  async login(
    @Body() body: LoginRequestDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<LoginResponseDto> {
    const correlationId = req.correlationId || "unknown-correlation-id";
    const ip = req.ip || req.socket.remoteAddress;
    const userAgent = req.headers["user-agent"];

    const result = await this.loginService.login(
      body,
      correlationId,
      ip,
      userAgent,
    );

    this.setAuthCookies(res, result.accessToken, result.refreshToken);

    return { user: result.user };
  }

  @Post("refresh")
  @Public()
  @RateLimit({ limit: 30, windowMs: 60 * 1000 })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Rotate Refresh Token" })
  @ApiOkResponse({ type: MessageResponseDto })
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<MessageResponseDto> {
    const correlationId = req.correlationId || "unknown-correlation-id";
    const rawRefreshToken = req.cookies?.[REFRESH_COOKIE_NAME];

    if (!rawRefreshToken) {
      throw new UnauthorizedException("Missing refresh token cookie");
    }

    const result = await this.sessionService.rotateRefreshToken(
      rawRefreshToken,
      correlationId,
    );

    this.setAuthCookies(res, result.accessToken, result.refreshToken);

    return { message: "Session refreshed successfully" };
  }

  @Post("logout")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Terminate Session" })
  @ApiNoContentResponse()
  async logout(
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    const correlationId = req.correlationId || "unknown-correlation-id";
    if (user?.sessionId) {
      await this.logoutService.logout(user.sessionId, user.id, correlationId);
    }
    this.clearAuthCookies(res);
  }

  @Post("forgot-password")
  @Public()
  @RateLimit({ limit: 5, windowMs: 15 * 60 * 1000 })
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: "Request Password Reset Link" })
  @ApiAcceptedResponse({ type: MessageResponseDto })
  async forgotPassword(
    @Body() body: ForgotPasswordRequestDto,
    @Req() req: Request,
  ): Promise<MessageResponseDto> {
    const correlationId = req.correlationId || "unknown-correlation-id";
    return this.passwordResetService.requestPasswordReset(
      body.email,
      correlationId,
      this.webOrigin,
    );
  }

  @Post("reset-password")
  @Public()
  @RateLimit({ limit: 10, windowMs: 15 * 60 * 1000 })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Reset Password With Token" })
  @ApiOkResponse({ type: MessageResponseDto })
  async resetPassword(
    @Body() body: ResetPasswordRequestDto,
    @Req() req: Request,
  ): Promise<MessageResponseDto> {
    const correlationId = req.correlationId || "unknown-correlation-id";
    return this.passwordResetService.resetPassword(body, correlationId);
  }

  @Get("me")
  @ApiOperation({ summary: "Get Authenticated Identity" })
  @ApiOkResponse({ type: UserResponseDto })
  getMe(@CurrentUser() user: AuthenticatedUser): UserResponseDto {
    if (!user) {
      throw new UnauthorizedException();
    }
    return {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
    };
  }

  @Get("context")
  @ApiOperation({ summary: "Get Active and Available Contexts" })
  async getContext(
    @CurrentUser() user: AuthenticatedUser,
    @CurrentTenant() activeContext?: TenantContext,
  ) {
    if (!user) {
      throw new UnauthorizedException();
    }
    return this.contextService.getContext(user.id, activeContext);
  }
}
