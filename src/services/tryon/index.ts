import { mockProvider } from './mockProvider'
import { createHttpProvider } from './httpProvider'
import type { TryOnProvider } from './types'

export type { TryOnProvider, PhotoTryOnRequest, PhotoTryOnResult } from './types'

/** Provider registry — add new vendors here and select one with VITE_TRYON_PROVIDER. */
const registry: Record<string, () => TryOnProvider> = {
  mock: () => mockProvider,
  http: () => {
    const url = import.meta.env.VITE_TRYON_API_URL as string | undefined
    if (!url) {
      console.warn('[tryon] VITE_TRYON_API_URL is not set, using the mock provider')
      return mockProvider
    }
    return createHttpProvider(url)
  },
}

export function getTryOnProvider(): TryOnProvider {
  const id = (import.meta.env.VITE_TRYON_PROVIDER as string | undefined) || 'mock'
  return (registry[id] ?? registry.mock)()
}
