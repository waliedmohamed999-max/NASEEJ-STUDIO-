import { create } from 'zustand'
import { fabricById } from '@/data/fabrics'
import { fabricTextureCanvas } from '@/lib/textures'
import type { Artwork, Colorway, Material, PatternPiece, Style, Vec } from './model/types'

/* ------------------------------------------------------------------ */
/* Transient tool state (not persisted, not in history)               */
/* ------------------------------------------------------------------ */
export interface Measure { id: string; a: Vec; b: Vec; label: string }
export const useTransient = create<{
  cursor: Vec | null
  zoom: number
  pendingTrim: string | null
  sewFrom: { piece: string; edge: string } | null
  measures: Measure[]
  texVersion: number
  simStatus: 'idle' | 'running' | 'settled'
  simProgress: number
  set: (p: Partial<{ cursor: Vec | null; zoom: number; pendingTrim: string | null; sewFrom: { piece: string; edge: string } | null; measures: Measure[]; simStatus: 'idle' | 'running' | 'settled'; simProgress: number }>) => void
  bumpTex: () => void
}>((set) => ({
  cursor: null, zoom: 1, pendingTrim: null, sewFrom: null, measures: [], texVersion: 0, simStatus: 'idle', simProgress: 0,
  set: (p) => set(p),
  bumpTex: () => set((s) => ({ texVersion: s.texVersion + 1 })),
}))

/* ------------------------------------------------------------------ */
/* Units                                                              */
/* ------------------------------------------------------------------ */
export const fmtLen = (cm: number, units: 'cm' | 'in', digits = 1) =>
  units === 'in' ? `${(cm / 2.54).toFixed(digits + 1)}″` : `${cm.toFixed(digits)} cm`
export const toUnit = (cm: number, units: 'cm' | 'in') => (units === 'in' ? cm / 2.54 : cm)
export const fromUnit = (v: number, units: 'cm' | 'in') => (units === 'in' ? v * 2.54 : v)

/* ------------------------------------------------------------------ */
/* Colourways                                                         */
/* ------------------------------------------------------------------ */
export function effectiveMaterial(style: Style, piece: PatternPiece, colorwayId: string | null = style.activeColorway): Material {
  const cw: Colorway | undefined = colorwayId ? style.colorways.find((c) => c.id === colorwayId) : undefined
  const o = cw?.overrides[piece.id]
  return o ? { ...piece.material, ...Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) } : piece.material
}

/* ------------------------------------------------------------------ */
/* Artwork images (async decode, re-render when ready)                */
/* ------------------------------------------------------------------ */
const images = new Map<string, HTMLImageElement>()
export function getImage(src: string): HTMLImageElement | null {
  let img = images.get(src)
  if (!img) {
    img = new Image()
    img.onload = () => useTransient.getState().bumpTex()
    img.src = src
    images.set(src, img)
  }
  return img.complete && img.naturalWidth ? img : null
}

/* ------------------------------------------------------------------ */
/* Material tile: fabric weave + colour + print or artwork repeat      */
/* ------------------------------------------------------------------ */
const tileCache = new Map<string, { canvas: HTMLCanvasElement; url: string; aspect: number }>()

export function materialTile(m: Material, artworks: Artwork[]) {
  const art = m.artworkId ? artworks.find((a) => a.id === m.artworkId) : undefined
  const fabric = fabricById(m.fabricId) ?? fabricById('fab-cotton-poplin')!
  const img = art ? getImage(art.dataUrl) : null
  const key = `${m.fabricId}|${m.color}|${m.print}|${m.printColor}|${art?.id ?? ''}|${m.repeat}|${img ? 1 : 0}`
  const hit = tileCache.get(key)
  if (hit) return hit
  const base = fabricTextureCanvas(fabric, {
    color: m.color ?? undefined,
    print: art ? 'none' : m.print,
    printColor: m.printColor ?? undefined,
  })
  let canvas = base
  let aspect = 1
  if (art && img && m.repeat !== 'placement') {
    const W = 256, H = Math.round(W * (img.naturalHeight / img.naturalWidth))
    aspect = H / W
    const cols = m.repeat === 'full' ? 1 : 2
    const rows = m.repeat === 'mirror' ? 2 : 1
    canvas = document.createElement('canvas')
    canvas.width = W * cols
    canvas.height = H * rows
    const ctx = canvas.getContext('2d')!
    const pat = ctx.createPattern(base, 'repeat')!
    ctx.fillStyle = pat
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.globalCompositeOperation = 'multiply'
    if (m.repeat === 'full') ctx.drawImage(img, 0, 0, W, H)
    else if (m.repeat === 'halfDrop') {
      ctx.drawImage(img, 0, 0, W, H)
      ctx.drawImage(img, W, -H / 2, W, H)
      ctx.drawImage(img, W, H / 2, W, H)
    } else {
      for (let r = 0; r < 2; r++) for (let c = 0; c < 2; c++) {
        ctx.save()
        ctx.translate(c ? 2 * W : 0, r ? 2 * H : 0)
        ctx.scale(c ? -1 : 1, r ? -1 : 1)
        ctx.drawImage(img, 0, 0, W, H)
        ctx.restore()
      }
    }
    aspect = canvas.height / canvas.width
  }
  const out = { canvas, url: canvas.toDataURL('image/png'), aspect }
  tileCache.set(key, out)
  return out
}

/** Base pattern tile size in cm for a material (fabric tile ≈ 12 cm). */
export const tileCm = (m: Material, artworks: Artwork[]) => {
  const art = m.artworkId ? artworks.find((a) => a.id === m.artworkId) : undefined
  return (art && m.repeat !== 'placement' ? art.widthCm : 12) * m.scale
}

/* ------------------------------------------------------------------ */
/* Seam colours (cycle of quiet tones)                                */
/* ------------------------------------------------------------------ */
export const SEAM_COLORS = ['#b08d57', '#6b6f4e', '#7d5a6b', '#4e6b7d', '#8a6a3e', '#5e7d6b', '#7d6b4e', '#6b4e5e']
