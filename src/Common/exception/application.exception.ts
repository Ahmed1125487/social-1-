export class ApplicationException extends Error {
  constructor(
    override message: string,
    public status: number,
    override cause?: unknown,
  ) {
    super();
    // super(message, { cause });
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
}