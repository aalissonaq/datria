import { ConfigService } from "@nestjs/config";
import { Response } from "express";
import { CsrfController } from "./csrf.controller";
import { CSRF_COOKIE_NAME } from "../../../common/guards/csrf.guard";

describe("CsrfController", () => {
  let controller: CsrfController;
  let mockConfigService: ConfigService;
  let mockResponse: Partial<Response>;

  beforeEach(() => {
    mockConfigService = {
      get: jest.fn().mockReturnValue(false),
    } as unknown as ConfigService;
    mockResponse = {
      cookie: jest.fn(),
    };
    controller = new CsrfController(mockConfigService as never);
  });

  it("issues a 64-character hex CSRF token and sets the cookie", () => {
    const result = controller.issueCsrfToken(mockResponse as Response);

    expect(result.csrfToken).toBeDefined();
    expect(result.csrfToken).toHaveLength(64);
    expect(mockResponse.cookie).toHaveBeenCalledWith(
      CSRF_COOKIE_NAME,
      result.csrfToken,
      expect.objectContaining({
        httpOnly: false,
        sameSite: "lax",
        secure: false,
        path: "/",
      }),
    );
  });
});
