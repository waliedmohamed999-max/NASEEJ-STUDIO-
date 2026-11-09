import type { PhotoTryOnRequest, PhotoTryOnResult, TryOnProvider } from './types'

/**
 * Generic HTTP provider for a try-on backend that accepts multipart form data and
 * returns an image. Point VITE_TRYON_API_URL at your own proxy (keep vendor API keys
 * server-side, e.g. in a Supabase Edge Function) and adapt the field names here.
 */
export function createHttpProvider(endpoint: string): TryOnProvider {
  return {
    id: 'http',
    label: 'HTTP try-on service',
    isRealModel: true,
    async photoTryOn(req: PhotoTryOnRequest, signal?: AbortSignal): Promise<PhotoTryOnResult> {
      const t0 = performance.now()
      const form = new FormData()
      form.append('person', req.personImage)
      form.append('garment_type', req.garment)
      form.append('fabric', JSON.stringify({ id: req.fabric.id, drape: req.fabric.drape, stretch: req.fabric.stretchPct }))
      if (req.garmentImage) form.append('garment_image', req.garmentImage)
      if (req.color) form.append('color', req.color)
      const res = await fetch(endpoint, { method: 'POST', body: form, signal })
      if (!res.ok) throw new Error(`Try-on service responded ${res.status}`)
      const blob = await res.blob()
      return { imageUrl: URL.createObjectURL(blob), provider: 'http', latency: performance.now() - t0 }
    },
  }
}
