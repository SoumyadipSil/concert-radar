import type { EventProvider } from './types';

const providers: Map<string, EventProvider> = new Map();

/** Register a provider adapter. Call this once per provider at startup. */
export function registerProvider(provider: EventProvider): void {
  if (providers.has(provider.id)) {
    throw new Error(`Provider "${provider.id}" is already registered`);
  }
  providers.set(provider.id, provider);
}

/** Get a provider by ID. */
export function getProvider(id: string): EventProvider | undefined {
  return providers.get(id);
}

/** Get all registered providers. */
export function getAllProviders(): EventProvider[] {
  return Array.from(providers.values());
}

/**
 * Get providers that cover a given country.
 * Returns providers with '*' (global) coverage or whose supportedCountries includes the code.
 */
export function getProvidersForCountry(countryCode: string): EventProvider[] {
  return getAllProviders().filter((p) => {
    if (p.supportedCountries === '*') return true;
    return p.supportedCountries.includes(countryCode.toUpperCase());
  });
}
