import { HttpStatus } from "@nestjs/common";
import { HttpExceptionFilter } from "./http-exception.filter";
import {
  InvalidCredentialsException,
  LastAdminException,
  ResourceNotFoundException,
} from "../exceptions/domain.exception";

describe("HttpExceptionFilter", () => {
  let filter: HttpExceptionFilter;
  let mockJson: jest.Mock;
  let mockStatus: jest.Mock;
  let mockResponse: { status: jest.Mock };
  let mockRequest: { correlationId?: string };
  let mockHost: {
    switchToHttp: () => {
      getRequest: () => unknown;
      getResponse: () => unknown;
    };
  };

  beforeEach(() => {
    filter = new HttpExceptionFilter();
    mockJson = jest.fn();
    mockStatus = jest.fn().mockReturnValue({ json: mockJson });
    mockResponse = { status: mockStatus };
    mockRequest = { correlationId: "12345678-1234-4234-8234-123456789abc" };
    mockHost = {
      switchToHttp: () => ({
        getRequest: () => mockRequest,
        getResponse: () => mockResponse,
      }),
    };
  });

  it("formats domain exceptions into the standard envelope", () => {
    const exception = new InvalidCredentialsException();
    filter.catch(exception, mockHost as never);

    expect(mockStatus).toHaveBeenCalledWith(HttpStatus.UNAUTHORIZED);
    expect(mockJson).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 401,
        code: "INVALID_CREDENTIALS",
        message: "Invalid email or password",
        correlationId: "12345678-1234-4234-8234-123456789abc",
      }),
    );
  });

  it("handles LastAdminException with status 409 and code LAST_ADMIN_PROTECTED", () => {
    const exception = new LastAdminException();
    filter.catch(exception, mockHost as never);

    expect(mockStatus).toHaveBeenCalledWith(HttpStatus.CONFLICT);
    expect(mockJson).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 409,
        code: "LAST_ADMIN_PROTECTED",
        message: expect.stringContaining("last active administrator"),
      }),
    );
  });

  it("formats ResourceNotFoundException to status 404", () => {
    const exception = new ResourceNotFoundException();
    filter.catch(exception, mockHost as never);

    expect(mockStatus).toHaveBeenCalledWith(HttpStatus.NOT_FOUND);
    expect(mockJson).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 404,
        code: "NOT_FOUND",
      }),
    );
  });

  it("sanitizes unexpected internal errors without leaking internals", () => {
    const exception = new Error("database password leaked: topsecret");
    filter.catch(exception, mockHost as never);

    expect(mockStatus).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
    expect(mockJson).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 500,
        code: "INTERNAL_SERVER_ERROR",
        message: "An unexpected error occurred",
      }),
    );
    expect(mockJson.mock.calls[0][0].message).not.toContain("topsecret");
  });
});
