import { Request, Response } from "express";
import { CorrelationIdMiddleware } from "./correlation-id.middleware";

describe("CorrelationIdMiddleware", () => {
  let middleware: CorrelationIdMiddleware;
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let nextFunction: jest.Mock;

  beforeEach(() => {
    middleware = new CorrelationIdMiddleware();
    mockRequest = {
      headers: {},
    };
    mockResponse = {
      setHeader: jest.fn(),
    };
    nextFunction = jest.fn();
  });

  it("generates a new correlation UUID when no header is provided", () => {
    middleware.use(
      mockRequest as Request,
      mockResponse as Response,
      nextFunction,
    );

    expect(mockRequest.correlationId).toBeDefined();
    expect(mockRequest.correlationId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
    expect(mockResponse.setHeader).toHaveBeenCalledWith(
      "X-Correlation-Id",
      mockRequest.correlationId,
    );
    expect(nextFunction).toHaveBeenCalled();
  });

  it("reuses a valid incoming X-Correlation-Id header", () => {
    const validUuid = "a1b2c3d4-e5f6-4a1b-8c2d-3e4f5a6b7c8d";
    mockRequest.headers = { "x-correlation-id": validUuid };

    middleware.use(
      mockRequest as Request,
      mockResponse as Response,
      nextFunction,
    );

    expect(mockRequest.correlationId).toBe(validUuid);
    expect(mockResponse.setHeader).toHaveBeenCalledWith(
      "X-Correlation-Id",
      validUuid,
    );
    expect(nextFunction).toHaveBeenCalled();
  });

  it("generates a new UUID if incoming header is invalid", () => {
    mockRequest.headers = { "x-correlation-id": "invalid-non-uuid" };

    middleware.use(
      mockRequest as Request,
      mockResponse as Response,
      nextFunction,
    );

    expect(mockRequest.correlationId).not.toBe("invalid-non-uuid");
    expect(mockRequest.correlationId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
    expect(nextFunction).toHaveBeenCalled();
  });
});
