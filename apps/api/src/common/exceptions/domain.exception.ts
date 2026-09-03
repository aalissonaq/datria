import { HttpException, HttpStatus } from "@nestjs/common";

export class DomainException extends HttpException {
  public readonly code: string;

  constructor(message: string, code: string, status: HttpStatus) {
    super({ message, code }, status);
    this.code = code;
  }
}

export class ValidationErrorException extends DomainException {
  constructor(message = "Invalid request payload") {
    super(message, "VALIDATION_ERROR", HttpStatus.BAD_REQUEST);
  }
}

export class InvalidCredentialsException extends DomainException {
  constructor(message = "Invalid email or password") {
    super(message, "INVALID_CREDENTIALS", HttpStatus.UNAUTHORIZED);
  }
}

export class InvalidTokenException extends DomainException {
  constructor(
    message = "The provided token is invalid, expired, or already used",
  ) {
    super(message, "INVALID_TOKEN", HttpStatus.BAD_REQUEST);
  }
}

export class UnauthorizedException extends DomainException {
  constructor(message = "Authentication required or session expired") {
    super(message, "UNAUTHORIZED", HttpStatus.UNAUTHORIZED);
  }
}

export class ForbiddenException extends DomainException {
  constructor(message = "Operation not permitted") {
    super(message, "FORBIDDEN", HttpStatus.FORBIDDEN);
  }
}

export class ResourceNotFoundException extends DomainException {
  constructor(message = "Resource not found or inaccessible") {
    super(message, "NOT_FOUND", HttpStatus.NOT_FOUND);
  }
}

export class ConflictException extends DomainException {
  constructor(message: string, code = "CONFLICT") {
    super(message, code, HttpStatus.CONFLICT);
  }
}

export class LastAdminException extends ConflictException {
  constructor(
    message = "Cannot remove, demote, or suspend the last active administrator of the organization",
  ) {
    super(message, "LAST_ADMIN_PROTECTED");
  }
}

export class RateLimitedException extends DomainException {
  constructor(message = "Too many requests, please try again later") {
    super(message, "RATE_LIMITED", HttpStatus.TOO_MANY_REQUESTS);
  }
}
