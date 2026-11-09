import type { Construction, Fabric, PrintPattern } from '@/types'
import { hashString, rng, shade, luminance } from './utils'

/**
 * Procedural fabric textures. Every swatch is drawn on a canvas from the fabric's
 * construction, colour and sheen, so the library needs no image assets and any
 * colourway can be generated on the fly. Tiles repeat seamlessly at `size`.
 */
export interface TextureOptions {
  color?: string
  print?: PrintPattern
  printColor?: string
  size?: number
}

const cache = new Map<string, string>()
const canvasCache = new Map<string, HTMLCanvasElement>()

export function fabricTextureCanvas(fabric: Pick<Fabric, 'id' | 'construction' | 'color' | 'sheen'>, opts: TextureOptions = {}) {
  const size = opts.size ?? 256
  const color = opts.color ?? fabric.color
  const print = opts.print ?? 'none'
  const printColor = opts.printColor ?? (luminance(color) > 0.4 ? '#1f1d1b' : '#f4efe6')
  const key = `${fabric.id}|${color}|${print}|${printColor}|${size}`
  const hit = canvasCache.get(key)
  if (hit) return hit

  const c = document.createElement('canvas')
  c.width = c.height = size
  const ctx = c.getContext('2d')!
  const rand = rng(hashString(fabric.id))
  drawConstruction(ctx, fabric.construction, color, fabric.sheen, size, rand)
  if (print !== 'none') drawPrint(ctx, print, printColor, size)
  canvasCache.set(key, c)
  return c
}

export function fabricTexture(fabric: Pick<Fabric, 'id' | 'construction' | 'color' | 'sheen'>, opts: TextureOptions = {}) {
  const size = opts.size ?? 256
  const key = `${fabric.id}|${opts.color ?? fabric.color}|${opts.print ?? 'none'}|${opts.printColor ?? ''}|${size}`
  const hit = cache.get(key)
  if (hit) return hit
  const url = fabricTextureCanvas(fabric, opts).toDataURL('image/png')
  cache.set(key, url)
  return url
}

function drawConstruction(
  ctx: CanvasRenderingContext2D, kind: Construction, color: string, sheen: number, s: number, rand: () => number,
) {
  ctx.fillStyle = color
  ctx.fillRect(0, 0, s, s)
  const dark = (a: number) => shade(color, -a)
  const light = (a: number) => shade(color, a)

  switch (kind) {
    case 'plain':
    case 'chiffon': {
      const step = kind === 'chiffon' ? 4 : 3
      ctx.globalAlpha = kind === 'chiffon' ? 0.18 : 0.28
      for (let i = 0; i < s; i += step) {
        ctx.fillStyle = (i / step) % 2 ? dark(0.12) : light(0.08)
        ctx.fillRect(i, 0, 1, s)
        ctx.fillStyle = (i / step) % 2 ? light(0.1) : dark(0.08)
        ctx.fillRect(0, i, s, 1)
      }
      ctx.globalAlpha = 1
      slub(ctx, s, rand, dark(0.1), kind === 'chiffon' ? 20 : 60)
      break
    }
    case 'twill':
    case 'tweed': {
      const step = kind === 'tweed' ? 6 : 4
      ctx.lineWidth = step * 0.55
      ctx.strokeStyle = dark(0.18)
      ctx.globalAlpha = 0.55
      for (let i = -s; i < s * 2; i += step) {
        ctx.beginPath(); ctx.moveTo(i, s); ctx.lineTo(i + s, 0); ctx.stroke()
      }
      ctx.globalAlpha = 0.25
      ctx.strokeStyle = light(0.2)
      ctx.lineWidth = 1
      for (let i = -s + step / 2; i < s * 2; i += step) {
        ctx.beginPath(); ctx.moveTo(i, s); ctx.lineTo(i + s, 0); ctx.stroke()
      }
      ctx.globalAlpha = 1
      if (kind === 'tweed') {
        const flecks = ['#c9a86a', '#8a3b2e', '#3e5a48', '#e8e0d0', '#2a2a2a']
        for (let i = 0; i < 900; i++) {
          ctx.fillStyle = flecks[Math.floor(rand() * flecks.length)]
          ctx.globalAlpha = 0.35 + rand() * 0.4
          ctx.fillRect(rand() * s, rand() * s, 1 + rand() * 3, 1)
        }
        ctx.globalAlpha = 1
      }
      break
    }
    case 'satin': {
      // Horizontally periodic sheen band so the tile repeats seamlessly.
      const g = ctx.createLinearGradient(0, 0, s, 0)
      g.addColorStop(0, dark(0.1))
      g.addColorStop(0.5, light(0.12 + sheen * 0.22))
      g.addColorStop(1, dark(0.1))
      ctx.fillStyle = g
      ctx.fillRect(0, 0, s, s)
      ctx.globalAlpha = 0.08
      ctx.fillStyle = light(0.4)
      for (let y = 0; y < s; y += 2) ctx.fillRect(0, y, s, 1)
      ctx.globalAlpha = 1
      break
    }
    case 'velvet': {
      const g = ctx.createLinearGradient(0, 0, s, 0)
      g.addColorStop(0, dark(0.18))
      g.addColorStop(0.5, light(0.1))
      g.addColorStop(1, dark(0.18))
      ctx.fillStyle = g
      ctx.fillRect(0, 0, s, s)
      noise(ctx, s, rand, 3500, 0.12, dark(0.3), light(0.15))
      break
    }
    case 'crepe': {
      noise(ctx, s, rand, 6000, 0.22, dark(0.18), light(0.12))
      break
    }
    case 'jersey': {
      const w = 6, h = 8
      ctx.strokeStyle = dark(0.2)
      ctx.lineWidth = 1.2
      ctx.globalAlpha = 0.5
      for (let x = 0; x < s; x += w) {
        for (let y = 0; y < s; y += h) {
          ctx.beginPath()
          ctx.moveTo(x, y); ctx.lineTo(x + w / 2, y + h); ctx.lineTo(x + w, y)
          ctx.stroke()
        }
      }
      ctx.globalAlpha = 1
      break
    }
    case 'rib': {
      const w = 8
      for (let x = 0; x < s; x += w) {
        const g = ctx.createLinearGradient(x, 0, x + w, 0)
        g.addColorStop(0, dark(0.3))
        g.addColorStop(0.5, light(0.12))
        g.addColorStop(1, dark(0.3))
        ctx.fillStyle = g
        ctx.fillRect(x, 0, w, s)
      }
      break
    }
    case 'jacquard': {
      ctx.strokeStyle = light(0.28)
      ctx.fillStyle = light(0.14)
      ctx.lineWidth = 1.5
      const cell = s / 4
      for (let x = 0; x < 4; x++) for (let y = 0; y < 4; y++) {
        const cx = x * cell + cell / 2, cy = y * cell + cell / 2
        ctx.beginPath()
        for (let k = 0; k < 4; k++) {
          const a = (k * Math.PI) / 2
          ctx.ellipse(cx + Math.cos(a) * cell * 0.18, cy + Math.sin(a) * cell * 0.18, cell * 0.16, cell * 0.08, a, 0, Math.PI * 2)
        }
        ctx.globalAlpha = 0.5; ctx.fill(); ctx.globalAlpha = 0.8; ctx.stroke()
        ctx.globalAlpha = 0.5
        ctx.beginPath(); ctx.moveTo(cx - cell / 2, cy - cell / 2); ctx.lineTo(cx, cy - cell * 0.4); ctx.stroke()
      }
      ctx.globalAlpha = 1
      break
    }
  }
}

function noise(ctx: CanvasRenderingContext2D, s: number, rand: () => number, n: number, alpha: number, a: string, b: string) {
  for (let i = 0; i < n; i++) {
    ctx.fillStyle = rand() > 0.5 ? a : b
    ctx.globalAlpha = alpha * rand()
    ctx.fillRect(rand() * s, rand() * s, 1 + rand() * 1.5, 1 + rand() * 1.5)
  }
  ctx.globalAlpha = 1
}

function slub(ctx: CanvasRenderingContext2D, s: number, rand: () => number, color: string, n: number) {
  ctx.fillStyle = color
  for (let i = 0; i < n; i++) {
    ctx.globalAlpha = 0.15 + rand() * 0.2
    ctx.fillRect(rand() * s, Math.floor(rand() * s), 6 + rand() * 18, 1)
  }
  ctx.globalAlpha = 1
}

function drawPrint(ctx: CanvasRenderingContext2D, print: PrintPattern, color: string, s: number) {
  ctx.save()
  ctx.fillStyle = color
  ctx.strokeStyle = color
  switch (print) {
    case 'stripes': {
      ctx.globalAlpha = 0.85
      for (let x = 0; x < s; x += s / 8) ctx.fillRect(x, 0, s / 32, s)
      break
    }
    case 'checks': {
      ctx.globalAlpha = 0.35
      for (let i = 0; i < s; i += s / 4) {
        ctx.fillRect(i, 0, s / 8, s)
        ctx.fillRect(0, i, s, s / 8)
      }
      ctx.globalAlpha = 0.8
      for (let i = s / 16; i < s; i += s / 4) {
        ctx.fillRect(i, 0, 1.5, s)
        ctx.fillRect(0, i, s, 1.5)
      }
      break
    }
    case 'dots': {
      ctx.globalAlpha = 0.9
      const step = s / 6
      for (let y = 0; y < 6; y++) for (let x = 0; x < 6; x++) {
        const ox = y % 2 ? step / 2 : 0
        ctx.beginPath()
        ctx.arc((x * step + ox + step / 4) % s, y * step + step / 2, s / 40, 0, Math.PI * 2)
        ctx.fill()
      }
      break
    }
    case 'houndstooth': {
      ctx.globalAlpha = 0.9
      const u = s / 8
      for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
        if ((x + y) % 2) continue
        const px = x * u, py = y * u
        ctx.beginPath()
        ctx.moveTo(px, py); ctx.lineTo(px + u / 2, py); ctx.lineTo(px + u, py + u / 2)
        ctx.lineTo(px + u, py + u); ctx.lineTo(px + u / 2, py + u); ctx.lineTo(px, py + u / 2)
        ctx.closePath(); ctx.fill()
      }
      break
    }
    case 'floral': {
      const spots: Array<[number, number, number]> = [
        [0.2, 0.25, 1], [0.7, 0.18, 0.8], [0.45, 0.6, 1.1], [0.88, 0.7, 0.9], [0.12, 0.82, 0.75],
      ]
      for (const [fx, fy, k] of spots) {
        const cx = fx * s, cy = fy * s, r = (s / 14) * k
        ctx.globalAlpha = 0.75
        for (let p = 0; p < 5; p++) {
          const a = (p / 5) * Math.PI * 2
          ctx.beginPath()
          ctx.ellipse(cx + Math.cos(a) * r, cy + Math.sin(a) * r, r * 0.75, r * 0.45, a, 0, Math.PI * 2)
          ctx.fill()
        }
        ctx.globalAlpha = 0.95
        ctx.beginPath(); ctx.arc(cx, cy, r * 0.35, 0, Math.PI * 2); ctx.fill()
        ctx.globalAlpha = 0.5; ctx.lineWidth = 1.5
        ctx.beginPath(); ctx.moveTo(cx + r * 1.4, cy + r); ctx.quadraticCurveTo(cx + r * 2.6, cy + r * 1.6, cx + r * 2.2, cy + r * 2.8); ctx.stroke()
      }
      break
    }
    case 'geometric': {
      ctx.globalAlpha = 0.8
      ctx.lineWidth = s / 64
      const u = s / 4
      for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) {
        const cx = x * u + u / 2, cy = y * u + u / 2
        ctx.beginPath()
        ctx.moveTo(cx, cy - u / 2.6); ctx.lineTo(cx + u / 2.6, cy); ctx.lineTo(cx, cy + u / 2.6); ctx.lineTo(cx - u / 2.6, cy)
        ctx.closePath(); ctx.stroke()
        if ((x + y) % 2 === 0) { ctx.beginPath(); ctx.arc(cx, cy, u / 12, 0, Math.PI * 2); ctx.fill() }
      }
      break
    }
  }
  ctx.restore()
}
