import { ApplicationException } from './application.exception';
export class BadRequestException extends ApplicationException {
  constructor(message: string = "Bad Request", cause?: unknown) {
    super(message, 400, cause);
  }
}


export class NotFoundException extends ApplicationException {
  constructor(message: string = "Not Found", cause?: unknown) {
    super(message, 404, cause);
  }
}

export class UnAuthorizedException extends ApplicationException {
  constructor(message: string = "UnAuthorized", cause?: unknown) {
    super(message, 401, cause);
  }
}

export class ForBiddenException extends ApplicationException {
  constructor(message: string = "ForBidden", cause?: unknown) {
    super(message, 403, cause);
  }
}

export class ConflictException extends ApplicationException {
  constructor(message: string = "Conflict", cause?: unknown) {
    super(message, 409, cause);
  }
}

export class TooManyRequestException extends ApplicationException {
  constructor(message: string = "TooManyRequest", cause?: unknown) {
    super(message, 429, cause);
  }
}
