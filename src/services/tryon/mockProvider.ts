import { fabricTextureCanvas } from '@/lib/textures'
import type { PhotoTryOnRequest, PhotoTryOnResult, TryOnProvider } from './types'

/**
 * Demo provider. Composites a translucent, fabric-textured garment silhouette over
 * the centre of the uploaded photo entirely in the browser, so the UI flow is
 * complete before a real model is wired in.
 */
export const mockProvider: TryOnProvider = {
  id: 'mock',
  label: 'Demo (in-browser overlay)',
  isRealModel: false,
  async photoTryOn(req: PhotoTryOnRequest, signal?: AbortSignal): Promise<PhotoTryOnResult> {
    const t0 = performance.now()
    const bmp = await createImageBitmap(req.personImage)
    const c = document.createElement('canvas')
    const k = Math.min(1, 900 / bmp.width)
    c.width = Math.round(bmp.width * k)
    c.height = Math.round(bmp.height * k)
    const ctx = c.getContext('2d')!
    ctx.drawImage(bmp, 0, 0, c.width, c.height)

    const W = c.width, H = c.height, cx = W / 2
    const g = req.garment
    const top = H * (g === 'trousers' || g === 'skirt' ? 0.48 : 0.2)
    const bottom = H * ({ abaya: 0.95, dress: 0.78, skirt: 0.75, trousers: 0.95, shirt: 0.55, jacket: 0.55 } as const)[g]
    const sw = W * 0.2
    const hw = W * (g === 'abaya' || g === 'dress' ? 0.27 : 0.2)
    const path = new Path2D()
    path.moveTo(cx - sw, top)
    path.lineTo(cx + sw, top)
    path.lineTo(cx + hw, bottom)
    path.lineTo(cx - hw, bottom)
    path.closePath()

    const pattern = ctx.createPattern(fabricTextureCanvas(req.fabric, { color: req.color }), 'repeat')!
    ctx.save()
    ctx.globalAlpha = 0.86
    ctx.fillStyle = pattern
    ctx.fill(path)
    ctx.globalCompositeOperation = 'multiply'
    const shadeGrad = ctx.createLinearGradient(cx - hw, 0, cx + hw, 0)
    shadeGrad.addColorStop(0, 'rgba(0,0,0,0.35)')
    shadeGrad.addColorStop(0.5, 'rgba(0,0,0,0)')
    shadeGrad.addColorStop(1, 'rgba(0,0,0,0.35)')
    ctx.fillStyle = shadeGrad
    ctx.fill(path)
    ctx.restore()

    // Simulated latency so loading states are exercised.
    await new Promise<void>((res, rej) => {
      const id = setTimeout(res, 900)
      signal?.addEventListener('abort', () => { clearTimeout(id); rej(new DOMException('Aborted', 'AbortError')) })
    })
    const blob: Blob = await new Promise((r) => c.toBlob((b) => r(b!), 'image/jpeg', 0.9))
    return { imageUrl: URL.createObjectURL(blob), provider: 'mock', latency: performance.now() - t0 }
  },
}
