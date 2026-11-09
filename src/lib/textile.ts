import type { Body, Fabric, GarmentTemplate, PrintPattern } from '@/types'
import { sizeChart, type SizeCode } from '@/data/garments'

/* ---------- Unit conversions ---------- */

export const OZ_PER_GSM = 1 / 33.906
export const gsmToOz = (gsm: number) => gsm * OZ_PER_GSM
export const ozToGsm = (oz: number) => oz * 33.906
export const mommeToGsm = (mm: number) => mm * 4.306

export type YarnUnit = 'tex' | 'ne' | 'nm' | 'denier'

/** Convert any yarn count to all others via tex (g / 1000 m). */
export function yarnCount(value: number, from: YarnUnit): Record<YarnUnit, number> {
  if (!(value > 0)) return { tex: 0, ne: 0, nm: 0, denier: 0 }
  const tex =
    from === 'tex' ? value :
    from === 'ne' ? 590.5 / value :
    from === 'nm' ? 1000 / value :
    value / 9
  return { tex, ne: 590.5 / tex, nm: 1000 / tex, denier: tex * 9 }
}

/* ---------- Shrinkage ---------- */

export const shrinkagePct = (before: number, after: number) => (before > 0 ? ((before - after) / before) * 100 : 0)
/** Length to cut so the piece is `finished` long after shrinking `pct` %. */
export const cutLengthFor = (finished: number, pct: number) => finished / (1 - pct / 100)

/* ---------- Fabric consumption ---------- */

export const sizeGrade: Record<SizeCode, number> = { XS: 0.9, S: 0.95, M: 1, L: 1.06, XL: 1.12, XXL: 1.2 }

export interface ConsumptionInput {
  garment: GarmentTemplate
  size: SizeCode
  /** Fabric per piece; falls back to garment default */
  pieceFabrics: Array<{ pieceId: string; fabric: Fabric; print: PrintPattern; scale: number }>
}

export interface ConsumptionLine {
  pieceId: string
  fabricId: string
  meters: number
}

/**
 * Industry-style marker estimate: base yardage at 150 cm width / size M, graded by size,
 * corrected for usable width, shrinkage, one-way layouts (nap, sheen, prints) and pattern
 * repeat, plus 5 % cutting loss.
 */
export function estimateConsumption({ garment, size, pieceFabrics }: ConsumptionInput) {
  const lines: ConsumptionLine[] = garment.pieces.map((piece) => {
    const pf = pieceFabrics.find((p) => p.pieceId === piece.id)
    if (!pf) return { pieceId: piece.id, fabricId: '', meters: 0 }
    const { fabric, print, scale } = pf
    const widthFactor = Math.pow(150 / fabric.widthCm, 0.85)
    const shrink = 1 + fabric.shrinkagePct / 100
    const oneWay = fabric.construction === 'velvet' || fabric.sheen > 0.6 ? 1.08 : 1
    const repeat = print === 'none' ? 1 : 1 + Math.min(0.15, 0.04 * scale)
    const m = garment.baseConsumptionM * piece.areaShare * sizeGrade[size] * widthFactor * shrink * oneWay * repeat * 1.05
    return { pieceId: piece.id, fabricId: fabric.id, meters: m }
  })
  const byFabric = new Map<string, number>()
  for (const l of lines) if (l.fabricId) byFabric.set(l.fabricId, (byFabric.get(l.fabricId) ?? 0) + l.meters)
  const total = lines.reduce((a, l) => a + l.meters, 0)
  return { lines, byFabric, total }
}

/** Graded garment measurements for a size (body-measurement deltas from M applied to circumferences). */
export function gradeMeasurements(garment: GarmentTemplate, size: SizeCode) {
  const m = sizeChart.find((s) => s.size === 'M')!
  const t = sizeChart.find((s) => s.size === size)!
  const delta: Record<string, number> = {
    bust: t.bust - m.bust, chest: t.bust - m.bust,
    waist: t.waist - m.waist,
    hips: t.hips - m.hips, hem: (t.hips - m.hips) * 1.5,
    shoulder: (t.bust - m.bust) * 0.12,
    length: (sizeGrade[size] - 1) * 10, sleeve: (sizeGrade[size] - 1) * 6,
    collar: (t.bust - m.bust) * 0.1, rise: (sizeGrade[size] - 1) * 6,
    inseam: 0, legOpening: (t.hips - m.hips) * 0.3,
  }
  return garment.measurements.map((x) => ({ ...x, m: Math.round((x.m + (delta[x.key] ?? 0)) * 2) / 2 }))
}

/* ---------- Cost ---------- */

export interface CostInput {
  meters: number
  pricePerMeter: number
  trims: number
  cmt: number // cut-make-trim labour
  overheadPct: number
  marginPct: number
  units: number
}
export function estimateCost(i: CostInput) {
  const fabric = i.meters * i.pricePerMeter
  const direct = fabric + i.trims + i.cmt
  const overhead = direct * (i.overheadPct / 100)
  const unitCost = direct + overhead
  const wholesale = unitCost / (1 - i.marginPct / 100 || 1)
  return { fabric, direct, overhead, unitCost, wholesale, batchCost: unitCost * i.units }
}

/* ---------- Fit ---------- */

export type FitZone = 'bust' | 'waist' | 'hips'
export type FitStatus = 'tight' | 'good' | 'loose'

export interface ZoneFit { zone: FitZone; ease: number; status: FitStatus }

export function zoneFits(body: Body, garment: GarmentTemplate, fabric: Fabric, size: SizeCode): ZoneFit[] {
  const chart = sizeChart.find((s) => s.size === size)!
  const bodyVal: Record<FitZone, number> = { bust: body.bustCm, waist: body.waistCm, hips: body.hipsCm }
  // Knits and stretch wovens tolerate negative ease proportional to their stretch.
  const stretchAllowance = (zone: FitZone) => bodyVal[zone] * (fabric.stretchPct / 100) * 0.35
  return garment.covers.map((zone) => {
    const garmentCirc = chart[zone] + garment.ease[zone]
    const ease = garmentCirc - bodyVal[zone]
    const target = garment.ease[zone]
    const minEase = Math.min(target * 0.4, 4) - stretchAllowance(zone)
    const flared = zone === 'hips' && garment.flare > 0.25
    const maxEase = flared ? target + 40 : target * 1.7 + 6
    const status: FitStatus = ease < minEase ? 'tight' : ease > maxEase ? 'loose' : 'good'
    return { zone, ease, status }
  })
}

export function recommendSize(body: Body, garment: GarmentTemplate, fabric: Fabric) {
  let best: { size: SizeCode; score: number } | null = null
  for (const { size } of sizeChart) {
    const fits = zoneFits(body, garment, fabric, size)
    const score = fits.reduce((acc, f) => {
      const dev = f.ease - garment.ease[f.zone]
      return acc + (f.status === 'tight' ? 1000 : 0) + (dev < 0 ? dev * dev * 4 : dev * dev)
    }, 0)
    if (!best || score < best.score) best = { size, score }
  }
  return best!.size
}
