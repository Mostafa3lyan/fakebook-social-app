
// Base class for all application-specific exceptions
export class ApplicationException extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
    cause?: unknown,
  ) {
    super(message, { cause });
    this.name = this.constructor.name; // "NotFoundException", etc.
    Error.captureStackTrace(this, this.constructor); // exclude constructor from stack trace
    Object.setPrototypeOf(this, new.target.prototype); // fix instanceof in transpiled JS
  }
}
