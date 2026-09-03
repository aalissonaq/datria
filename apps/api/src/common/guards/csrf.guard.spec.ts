import { ExecutionContext } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Reflector } from "@nestjs/core";
import { Request } from "express";
import { CsrfGuard, CSRF_COOKIE_NAME, CSRF_HEADER_NAME } from "./csrf.guard";
import { ForbiddenException } from "../exceptions/domain.exception";

describe("CsrfGuard", () => {
  let guard: CsrfGuard;
  let reflector: Reflector;
  let configService: ConfigService;

  beforeEach(() => {
    reflector = new Reflector();
    configService = {
      get: jest.fn().mockReturnValue("http://localhost:5173"),
    } as unknown as ConfigService;
    guard = new CsrfGuard(reflector, configService as never);
  });

  function createMockContext(
    method: string,
    cookies: Record<string, string> = {},
    headers: Record<string, string> = {},
  ): ExecutionContext {
    const request = {
      method,
      cookies,
      headers,
    } as unknown as Request;

    return {
      getHandler: () => ({}),
      getClass: () => ({}),
      switchToHttp: () => ({
        getRequest: () => request,
      }),
    } as unknown as ExecutionContext;
  }

  it("allows safe HTTP methods (GET, HEAD, OPTIONS) without tokens", () => {
    expect(guard.canActivate(createMockContext("GET"))).toBe(true);
    expect(guard.canActivate(createMockContext("HEAD"))).toBe(true);
    expect(guard.canActivate(createMockContext("OPTIONS"))).toBe(true);
  });

  it("allows requests when SkipCsrf metadata is set", () => {
    jest.spyOn(reflector, "getAllAndOverride").mockReturnValue(true);
    expect(guard.canActivate(createMockContext("POST"))).toBe(true);
  });

  it("rejects unsafe methods when cookie or header is missing", () => {
    const ctx1 = createMockContext("POST", {}, { [CSRF_HEADER_NAME]: "token" });
    expect(() => guard.canActivate(ctx1)).toThrow(ForbiddenException);

    const ctx2 = createMockContext("POST", { [CSRF_COOKIE_NAME]: "token" }, {});
    expect(() => guard.canActivate(ctx2)).toThrow(ForbiddenException);
  });

  it("rejects when cookie and header tokens mismatch", () => {
    const ctx = createMockContext(
      "POST",
      { [CSRF_COOKIE_NAME]: "token-a" },
      { [CSRF_HEADER_NAME]: "token-b" },
    );
    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });

  it("rejects when Origin header does not match WEB_ORIGIN", () => {
    const token = "a".repeat(32);
    const ctx = createMockContext(
      "POST",
      { [CSRF_COOKIE_NAME]: token },
      { [CSRF_HEADER_NAME]: token, origin: "http://malicious-site.com" },
    );
    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });

  it("allows state-modifying requests when token and origin are valid", () => {
    const token = "a".repeat(32);
    const ctx = createMockContext(
      "POST",
      { [CSRF_COOKIE_NAME]: token },
      { [CSRF_HEADER_NAME]: token, origin: "http://localhost:5173" },
    );
    expect(guard.canActivate(ctx)).toBe(true);
  });
});
