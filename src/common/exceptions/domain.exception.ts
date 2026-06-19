import { ApplicationException } from "./application.exceptions";


//  4xx client errors
export class BadRequestException extends ApplicationException {
  constructor(message = "bad request", cause?: unknown) {
    super(message, 400, cause);
  }
}

export class UnauthorizedException extends ApplicationException {
  constructor(message = "unauthorized", cause?: unknown) {
    super(message, 401, cause);
  }
}

export class ForbiddenException extends ApplicationException {
  constructor(message = "forbidden", cause?: unknown) {
    super(message, 403, cause);
  }
}

export class NotFoundException extends ApplicationException {
  constructor(message = "not found", cause?: unknown) {
    super(message, 404, cause);
  }
}

export class ConflictException extends ApplicationException {
  constructor(message = "conflict", cause?: unknown) {
    super(message, 409, cause);
  }
}

export class UnprocessableEntityException extends BadRequestException {
  constructor(message = "unprocessable entity", cause?: unknown) {
    super(message, cause);
    Object.defineProperty(this, "statusCode", { value: 422 });
  }
}

export class TooManyRequestsException extends ApplicationException {
  constructor(message = "too many requests", cause?: unknown) {
    super(message, 429, cause);
  }
}

// 5xx server errors

export class InternalServerException extends ApplicationException {
  constructor(message = "internal server error", cause?: unknown) {
    super(message, 500, cause);
  }
}

export class BadGatewayException extends ApplicationException {
  constructor(message = "bad gateway", cause?: unknown) {
    super(message, 502, cause);
  }
}