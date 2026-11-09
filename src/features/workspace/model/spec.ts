import type { GarmentKind, PatternPiece, Style } from './types'
import { bbox, dartIntakeAtY, dist, edgeLength, flatten, widthAtY, seamAllowanceOutline, signedArea } from './geometry'

/**
 * Measures the pattern to drive the 3D garment. Girths are read off the actual
 * piece outlines at their measuring lines (minus dart intake, × fold/cut count),
 * hem sweeps and waists from tagged edge lengths. Edit a side seam in 2D and the
 * 3D girth changes with it.
 */
export interface GarmentSpec {
  kind: GarmentKind
  body?: { bust: number; waist: number; hip: number; hem: number; length: number }
  skirt?: { waist: number; hip: number; hem: number; length: number }
  trousers?: { waist: number; hip: number; thigh: number; hem: number; length: number; rise: number }
  sleeve?: { length: number; bicep: number; opening: number; cutOn: boolean }
  collar: string
  materials: { upper?: string; lower?: string; sleeve?: string; collar?: string }
}

const visible = (p: PatternPiece) => p.visible && p.layer !== 'lining' && p.layer !== 'interfacing'
const halves = (p: PatternPiece) => (p.foldEdge ? 2 : p.cut)

function tagged(p: PatternPiece, tag: string) {
  let L = 0
  p.points.forEach((q, i) => { if (p.edgeTags[q.id] === tag) L += edgeLength(p.points, i) })
  return L
}

function girthAt(pieces: PatternPiece[], key: 'bust' | 'waist' | 'hip' | 'thigh', fallback: number, perLeg = false) {
  let g = 0, any = false
  for (const p of pieces) {
    const y = p.marks[key]
    if (y === undefined) continue
    const flat = flatten(p.points, 10)
    const ext = p.role === 'front' && !p.foldEdge ? Math.max(0, -bbox(p.points).minX) : 0
    let w = Math.max(0, widthAtY(flat, y) - ext - dartIntakeAtY(p.internals, y))
    // Cut-on sleeves (kimono, butterfly, batwing): the measuring line crosses the
    // sleeve, so cap the body width at the side seam.
    if (p.points.some((q) => p.edgeTags[q.id] === 'opening')) {
      const sideX = Math.max(...p.points.filter((q) => p.edgeTags[q.id] === 'side').map((q) => q.x), 0)
      if (sideX > 0) w = Math.min(w, sideX + ext)
    }
    g += w * (perLeg ? 1 : halves(p))
    any = true
  }
  return any ? g : fallback
}

function waistFromEdges(pieces: PatternPiece[]) {
  let g = 0
  for (const p of pieces) {
    let w = tagged(p, 'waist')
    for (const it of p.internals) {
      if (it.kind === 'pleat') w -= (it.size ?? 3) * 2
      if (it.kind === 'dart' && it.pts.length === 3 && Math.abs(it.pts[0].y - it.pts[1].y) > 3 && Math.min(it.pts[0].y, it.pts[1].y) < 2) w -= dist(it.pts[0], it.pts[2])
    }
    const gather = p.internals.find((it) => it.kind === 'gather')
    if (gather) w /= gather.size ?? 1.8
    g += Math.max(0, w) * halves(p)
  }
  return g
}

export function deriveSpec(style: Style): GarmentSpec {
  const ps = style.pieces.filter(visible)
  const by = (...roles: string[]) => ps.filter((p) => roles.includes(p.role))
  const body = by('front', 'back')
  const skirt = by('skirtFront', 'skirtBack')
  const trou = by('trouserFront', 'trouserBack')
  const sleeve = by('sleeve')[0]
  const front = body.find((p) => p.role === 'front')
  const spec: GarmentSpec = {
    kind: style.kind,
    collar: style.meta.collar,
    materials: {
      upper: front?.id ?? skirt[0]?.id ?? trou[0]?.id ?? ps[0]?.id,
      lower: skirt[0]?.id ?? trou[0]?.id,
      sleeve: sleeve?.id ?? front?.id,
      collar: by('collar', 'hood')[0]?.id,
    },
  }

  if (body.length) {
    const fb = bbox(front?.points ?? body[0].points)
    const hem = body.reduce((a, p) => a + tagged(p, 'hem') * halves(p), 0)
    const bust = girthAt(body, 'bust', 96)
    // A bodice that stops at the waist has no waist mark: its hem IS the waist.
    const waist = girthAt(body, 'waist', hem || bust)
    let hip = girthAt(body, 'hip', 0)
    if (!hip) hip = skirt.length || trou.length ? 0 : Math.max(waist, hem * 0.9)
    spec.body = { bust, waist, hip: hip || waist, hem: hem || hip, length: fb.maxY - Math.min(0, fb.minY) }
  }
  if (skirt.length) {
    const sb = bbox(skirt[0].points)
    const hem = skirt.reduce((a, p) => a + tagged(p, 'hem') * halves(p), 0)
    const waist = waistFromEdges(skirt)
    spec.skirt = { waist, hip: girthAt(skirt, 'hip', Math.max(waist * 1.2, Math.min(hem, 110))), hem, length: sb.h }
  }
  if (trou.length) {
    const tf = trou.find((p) => p.role === 'trouserFront') ?? trou[0]
    const tb = bbox(tf.points)
    const crotchPt = tf.points.find((q) => tf.edgeTags[q.id] === 'crotch')
    const rise = (crotchPt?.y ?? 26) - tb.minY
    spec.trousers = {
      waist: waistFromEdges(trou) / 2 * 2,
      hip: girthAt(trou, 'hip', 100) * 2,
      thigh: girthAt(trou, 'thigh', 60, true),
      hem: trou.reduce((a, p) => a + tagged(p, 'hem'), 0),
      length: tb.h,
      rise,
    }
  }
  const cutOn = style.meta.sleeve === 'kimono' || style.meta.sleeve === 'butterfly' || style.meta.sleeve === 'batwing'
  if (sleeve) {
    const sb = bbox(sleeve.points)
    const capY = sleeve.points[1]?.y ?? sb.minY + 12
    spec.sleeve = { length: sb.h, bicep: widthAtY(flatten(sleeve.points, 10), capY + 0.5), opening: tagged(sleeve, 'hem'), cutOn: false }
  } else if (cutOn && front) {
    const neckSide = front.points.find((q) => front.edgeTags[q.id] === 'shoulder')
    const open = front.points.find((q) => front.edgeTags[q.id] === 'opening')
    const opening = body.reduce((a, p) => a + tagged(p, 'opening'), 0)
    if (neckSide && open) spec.sleeve = { length: Math.max(10, dist(neckSide, open) - 13), bicep: Math.max(40, opening), opening, cutOn: true }
  }
  return spec
}

/**
 * Marker estimate per fabric. Each cut piece (fold pieces opened to full width,
 * cut-N repeated N times) becomes its seam-allowance bounding box, kept on grain,
 * and is shelf-packed across the usable width (first-fit decreasing height).
 * Marker length + 3 % end loss = metres. Also returns the marker's area efficiency.
 */
export function fabricUsage(style: Style, widthOf: (fabricId: string) => number) {
  const groups = new Map<string, { rects: Array<{ w: number; h: number }>; area: number; pieces: string[] }>()
  for (const p of style.pieces) {
    if (!p.visible) continue
    const sa = seamAllowanceOutline(p)
    const b = bbox(sa.length ? sa : flatten(p.points, 10))
    const flatA = Math.abs(signedArea(sa.length ? sa : flatten(p.points, 10)))
    const g = groups.get(p.material.fabricId) ?? { rects: [], area: 0, pieces: [] }
    const n = p.foldEdge ? 1 : p.cut
    for (let k = 0; k < n; k++) g.rects.push({ w: p.foldEdge ? b.w * 2 : b.w, h: b.h })
    g.area += flatA * (p.foldEdge ? 2 : p.cut)
    g.pieces.push(p.id)
    groups.set(p.material.fabricId, g)
  }
  return [...groups.entries()].map(([fabricId, g]) => {
    const W = widthOf(fabricId) - 2 // selvedge allowance
    const rects = [...g.rects].sort((a, b) => b.h - a.h)
    const shelves: Array<{ h: number; used: number }> = []
    for (const r of rects) {
      const w = Math.min(r.w, W)
      const s = shelves.find((x) => x.used + w <= W && r.h <= x.h)
      if (s) s.used += w
      else shelves.push({ h: r.h, used: w })
    }
    const lengthCm = shelves.reduce((a, x) => a + x.h, 0)
    return {
      fabricId, areaCm2: g.area, pieces: g.pieces,
      meters: (lengthCm / 100) * 1.03,
      efficiency: lengthCm ? g.area / (lengthCm * W) : 0,
    }
  })
}
