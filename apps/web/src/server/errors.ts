/**
 * An error meant for the person: its message is shown as is, and `status` is the HTTP status a route
 * would answer with. Anything else that's thrown is a bug: logged, and replaced by a generic message.
 */
export class DomainError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

/** Stops an action with a message for the person. */
export function fail(message: string, status = 400): never {
  throw new DomainError(status, message);
}
