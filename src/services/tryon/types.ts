import type { Fabric, GarmentType } from '@/types'

export interface PhotoTryOnRequest {
  /** Full-body photo of the person */
  personImage: Blob
  garment: GarmentType
  fabric: Fabric
  /** Optional flat-sketch/garment image (PNG data URL) rendered from the studio */
  garmentImage?: string
  color?: string
}

export interface PhotoTryOnResult {
  /** URL (object URL or remote) of the rendered result */
  imageUrl: string
  provider: string
  /** ms */
  latency: number
}

/**
 * Any try-on backend (hosted diffusion model, vendor API, self-hosted service)
 * implements this interface and registers itself in `./index.ts`.
 */
export interface TryOnProvider {
  readonly id: string
  readonly label: string
  /** True when results are real model output (false for the demo provider) */
  readonly isRealModel: boolean
  photoTryOn(req: PhotoTryOnRequest, signal?: AbortSignal): Promise<PhotoTryOnResult>
}
