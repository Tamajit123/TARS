export class ConnectionError extends Error {
  constructor(readonly status: number, message: string, readonly requestId?: string) { super(message); }
}
