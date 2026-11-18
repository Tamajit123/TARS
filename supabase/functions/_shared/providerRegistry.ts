import type {ResearchResult} from './researchProviders.ts';
import type {IntentCategory} from './richResponse.ts';
export type ProviderDefinition={name:string;capabilities:string[];configured:boolean;authentication:string;inputSchema:Record<string,unknown>;outputSchema:Record<string,unknown>;timeoutMs:number;rateLimit:string;freshness:string;errorFormat:{code:string;message:string};sourceMetadata:string[]};
export interface ResearchAdapter {definition:ProviderDefinition;execute(input:string,category:IntentCategory,signal?:AbortSignal):Promise<ResearchResult>}
/** Replaceable server-only adapters. Registration cannot grant a user permission. */
export function createProviderRegistry(adapters:ResearchAdapter[]):Map<string,ResearchAdapter>{
  const registry=new Map<string,ResearchAdapter>();for(const adapter of adapters){if(registry.has(adapter.definition.name))throw new Error('Duplicate provider registration.');registry.set(adapter.definition.name,adapter);}return registry;
}
