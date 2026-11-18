export class ProviderError extends Error {
  constructor(readonly code: string, readonly diagnostic: Record<string, string | number | null> = {}) { super(code); }
}
