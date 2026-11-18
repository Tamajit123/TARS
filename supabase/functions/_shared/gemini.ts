// Compatibility exports for existing diagnostics. All generation uses Gemini.
export { assistantPolicy, ProviderError, providerMessage, getModel as getGeminiModel, getProviderHealth as getGeminiHealth, generateReply as generateGeminiReply } from './ai.ts';
export type { ProviderMessage } from './ai.ts';
