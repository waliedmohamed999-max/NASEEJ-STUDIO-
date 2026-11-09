import type { Internal, PatternPiece, PPoint, Vec } from './types'
import { uid } from '@/lib/utils'

/* ------------------------------------------------------------------ */
/* Vectors                                                            */
/* ------------------------------------------------------------------ */
export const add = (a: Vec, b: Vec): Vec => ({ x: a.x + b.x, y: a.y + b.y })
export const sub = (a: Vec, b: Vec): Vec => ({ x: a.x - b.x, y: a.y - b.y })
export const mul = (a: Vec, k: number): Vec => ({ x: a.x * k, y: a.y * k })
export const dist = (a: Vec, b: Vec) => Math.hypot(a.x - b.x, a.y - b.y)
export const lerpV = (a: Vec, b: Vec, t: number): Vec => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t })
export const rot = (v: Vec, deg: number): Vec => {
  const r = (deg * Math.PI) / 180, c = Math.cos(r), s = Math.sin(r)
  return { x: v.x * c - v.y * s, y: v.x * s + v.y * c }
}

export const pt = (x: number, y: number, hin: Vec | null = null, hout: Vec | null = null): PPoint => ({ id: uid(), x, y, hin, hout })

/* ------------------------------------------------------------------ */
/* Bézier edges                                                       */
/* ------------------------------------------------------------------ */
export function edgeControls(points: PPoint[], i: number): [Vec, Vec, Vec, Vec] {
  const p0 = points[i], p1 = points[(i + 1) % points.length]
  return [p0, p0.hout ?? p0, p1.hin ?? p1, p1]
}
export const isCurved = (points: PPoint[], i: number) => !!(points[i].hout || points[(i + 1) % points.length].hin)

export function cubic(c: [Vec, Vec, Vec, Vec], t: number): Vec {
  const u = 1 - t
  const a = u * u * u, b = 3 * u * u * t, d = 3 * u * t * t, e = t * t * t
  return { x: a * c[0].x + b * c[1].x + d * c[2].x + e * c[3].x, y: a * c[0].y + b * c[1].y + d * c[2].y + e * c[3].y }
}

/** Polyline of one edge including both endpoints. */
export function edgePolyline(points: PPoint[], i: number, segs = 16): Vec[] {
  const c = edgeControls(points, i)
  if (!isCurved(points, i)) return [c[0], c[3]]
  return Array.from({ length: segs + 1 }, (_, k) => cubic(c, k / segs))
}

export function edgeLength(points: PPoint[], i: number) {
  const pl = edgePolyline(points, i, 32)
  let L = 0
  for (let k = 1; k < pl.length; k++) L += dist(pl[k - 1], pl[k])
  return L
}

export interface FlatPoint extends Vec { edge: number }
/** Closed outline with each vertex tagged by the edge it starts. */
export function flatten(points: PPoint[], segs = 12): FlatPoint[] {
  const out: FlatPoint[] = []
  for (let i = 0; i < points.length; i++) {
    const pl = edgePolyline(points, i, segs)
    for (let k = 0; k < pl.length - 1; k++) out.push({ ...pl[k], edge: i })
  }
  return out
}

export function pathD(points: PPoint[], close = true) {
  if (!points.length) return ''
  let d = `M${points[0].x} ${points[0].y}`
  const n = close ? points.length : points.length - 1
  for (let i = 0; i < n; i++) {
    const [, c1, c2, p1] = edgeControls(points, i)
    d += isCurved(points, i) ? ` C${c1.x} ${c1.y} ${c2.x} ${c2.y} ${p1.x} ${p1.y}` : ` L${p1.x} ${p1.y}`
  }
  return close ? d + ' Z' : d
}
export const polyD = (poly: Vec[], close = true) =>
  poly.length ? `M${poly.map((p) => `${p.x.toFixed(3)} ${p.y.toFixed(3)}`).join(' L')}${close ? ' Z' : ''}` : ''

/* ------------------------------------------------------------------ */
/* Measurement                                                        */
/* ------------------------------------------------------------------ */
export function signedArea(poly: Vec[]) {
  let a = 0
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i], q = poly[(i + 1) % poly.length]
    a += p.x * q.y - q.x * p.y
  }
  return a / 2
}
export const area = (poly: Vec[]) => Math.abs(signedArea(poly))

export function bbox(poly: Vec[]) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (const p of poly) { minX = Math.min(minX, p.x); minY = Math.min(minY, p.y); maxX = Math.max(maxX, p.x); maxY = Math.max(maxY, p.y) }
  return { minX, minY, maxX, maxY, w: maxX - minX, h: maxY - minY, cx: (minX + maxX) / 2, cy: (minY + maxY) / 2 }
}

/** Horizontal extent of a closed polygon at height y (0 if the line misses). */
export function widthAtY(poly: Vec[], y: number) {
  const xs: number[] = []
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length]
    if ((a.y <= y && b.y > y) || (b.y <= y && a.y > y)) xs.push(a.x + ((y - a.y) / (b.y - a.y)) * (b.x - a.x))
  }
  if (xs.length < 2) return 0
  return Math.max(...xs) - Math.min(...xs)
}

/** Dart intake crossing height y (dart legs → apex, linear). */
export function dartIntakeAtY(internals: Internal[], y: number) {
  let take = 0
  for (const d of internals) {
    if (d.kind !== 'dart' || d.pts.length < 3) continue
    const [l1, apex, l2] = d.pts
    const legY = (l1.y + l2.y) / 2
    const lo = Math.min(legY, apex.y), hi = Math.max(legY, apex.y)
    if (y < lo || y > hi || hi - lo < 0.01) continue
    // vertical darts only contribute to horizontal girth
    if (Math.abs(l1.x - l2.x) < Math.abs(l1.y - l2.y)) continue
    const t = 1 - Math.abs(y - legY) / (hi - lo)
    take += Math.abs(l2.x - l1.x) * t
  }
  return take
}

/** Nearest location on the outline: edge index, parameter t, point and distance. */
export function nearestOnOutline(points: PPoint[], p: Vec) {
  let best = { edge: -1, t: 0, point: p, d: Infinity }
  for (let i = 0; i < points.length; i++) {
    const segs = isCurved(points, i) ? 40 : 1
    const pl = edgePolyline(points, i, segs)
    for (let k = 0; k < pl.length - 1; k++) {
      const a = pl[k], b = pl[k + 1]
      const ab = sub(b, a)
      const len2 = ab.x * ab.x + ab.y * ab.y || 1e-9
      const u = Math.max(0, Math.min(1, ((p.x - a.x) * ab.x + (p.y - a.y) * ab.y) / len2))
      const q = add(a, mul(ab, u))
      const d = dist(p, q)
      if (d < best.d) best = { edge: i, t: (k + u) / (pl.length - 1), point: q, d }
    }
  }
  return best
}

/** Point at parameter t along an edge, plus unit normal (outward for CW-in-screen outlines). */
export function pointOnEdge(points: PPoint[], i: number, t: number) {
  const c = edgeControls(points, i)
  const p = cubic(c, t)
  const p2 = cubic(c, Math.min(1, t + 0.01)), p1 = cubic(c, Math.max(0, t - 0.01))
  const tan = sub(p2, p1)
  const L = Math.hypot(tan.x, tan.y) || 1
  return { p, tangent: { x: tan.x / L, y: tan.y / L } }
}

/* ------------------------------------------------------------------ */
/* Seam allowance: per-edge outward offset with mitred joins          */
/* ------------------------------------------------------------------ */
export function seamAllowanceOutline(piece: Pick<PatternPiece, 'points' | 'seamAllowance' | 'edgeSA' | 'foldEdge'>): Vec[] {
  const pts = piece.points
  if (pts.length < 3) return []
  const flat = flatten(pts, 10)
  const ccw = signedArea(flat) > 0 // in y-down screen space, >0 means clockwise visually
  const saFor = (edge: number) => {
    const id = pts[edge].id
    if (piece.foldEdge === id) return 0
    return piece.edgeSA[id] ?? piece.seamAllowance
  }
  // offset each segment
  const segs: Array<[Vec, Vec]> = []
  for (let i = 0; i < flat.length; i++) {
    const a = flat[i], b = flat[(i + 1) % flat.length]
    const d = sub(b, a)
    const L = Math.hypot(d.x, d.y)
    if (L < 1e-6) continue
    const n = ccw ? { x: d.y / L, y: -d.x / L } : { x: -d.y / L, y: d.x / L }
    const s = saFor(a.edge)
    segs.push([add(a, mul(n, s)), add(b, mul(n, s))])
  }
  const out: Vec[] = []
  for (let i = 0; i < segs.length; i++) {
    const [a1, a2] = segs[(i - 1 + segs.length) % segs.length]
    const [b1, b2] = segs[i]
    const x = lineIntersect(a1, a2, b1, b2)
    if (x && dist(x, b1) < 6) out.push(x)
    else { out.push(a2); out.push(b1) }
  }
  return out
}

export function lineIntersect(a1: Vec, a2: Vec, b1: Vec, b2: Vec): Vec | null {
  const d = (a1.x - a2.x) * (b1.y - b2.y) - (a1.y - a2.y) * (b1.x - b2.x)
  if (Math.abs(d) < 1e-9) return null
  const t = ((a1.x - b1.x) * (b1.y - b2.y) - (a1.y - b1.y) * (b1.x - b2.x)) / d
  return { x: a1.x + t * (a2.x - a1.x), y: a1.y + t * (a2.y - a1.y) }
}

/* ------------------------------------------------------------------ */
/* Transforms between piece-local and table coordinates               */
/* ------------------------------------------------------------------ */
export function pieceCenter(piece: PatternPiece) {
  const b = bbox(piece.points)
  return { x: b.cx, y: b.cy }
}
export function toTable(piece: PatternPiece, v: Vec): Vec {
  const c = pieceCenter(piece)
  let p = sub(v, c)
  if (piece.flipped) p = { x: -p.x, y: p.y }
  p = rot(p, piece.rotation)
  return { x: p.x + c.x + piece.x, y: p.y + c.y + piece.y }
}
export function toLocal(piece: PatternPiece, v: Vec): Vec {
  const c = pieceCenter(piece)
  let p = { x: v.x - piece.x - c.x, y: v.y - piece.y - c.y }
  p = rot(p, -piece.rotation)
  if (piece.flipped) p = { x: -p.x, y: p.y }
  return add(p, c)
}
/** SVG transform equivalent to toTable */
export function pieceTransform(piece: PatternPiece) {
  const c = pieceCenter(piece)
  return `translate(${piece.x + c.x} ${piece.y + c.y}) rotate(${piece.rotation}) scale(${piece.flipped ? -1 : 1} 1) translate(${-c.x} ${-c.y})`
}

/* ------------------------------------------------------------------ */
/* Editing operations                                                 */
/* ------------------------------------------------------------------ */

/** Insert a point on edge i at t (de Casteljau keeps the curve shape). */
export function splitEdge(points: PPoint[], i: number, t: number): PPoint[] {
  const n = points.length
  const p0 = points[i], p1 = points[(i + 1) % n]
  const next = points.map((p) => ({ ...p }))
  if (!isCurved(points, i)) {
    next.splice(i + 1, 0, pt(p0.x + (p1.x - p0.x) * t, p0.y + (p1.y - p0.y) * t))
    return next
  }
  const [a, b, c, d] = edgeControls(points, i)
  const ab = lerpV(a, b, t), bc = lerpV(b, c, t), cd = lerpV(c, d, t)
  const abc = lerpV(ab, bc, t), bcd = lerpV(bc, cd, t), m = lerpV(abc, bcd, t)
  next[i] = { ...next[i], hout: p0.hout ? ab : null }
  next[(i + 1) % n] = { ...next[(i + 1) % n], hin: p1.hin ? cd : null }
  next.splice(i + 1, 0, { id: uid(), x: m.x, y: m.y, hin: abc, hout: bcd })
  return next
}

/** Pull an edge toward `target` (curve tool): converts it to a cubic passing near target. */
export function bendEdge(points: PPoint[], i: number, target: Vec): PPoint[] {
  const n = points.length
  const a = points[i], d = points[(i + 1) % n]
  // For a cubic with symmetric handles at 1/3 & 2/3, the midpoint is (a + 3b + 3c + d)/8.
  const mid = lerpV(a, d, 0.5)
  const off = mul(sub(target, mid), 4 / 3)
  const next = points.map((p) => ({ ...p }))
  next[i] = { ...next[i], hout: add(lerpV(a, d, 1 / 3), off) }
  next[(i + 1) % n] = { ...next[(i + 1) % n], hin: add(lerpV(a, d, 2 / 3), off) }
  return next
}

/** Mirror outline horizontally (keeps winding by reversing order). */
export function mirrorPoints(points: PPoint[]): PPoint[] {
  const b = bbox(points)
  const fx = (x: number) => b.minX + b.maxX - x
  return [...points].reverse().map((p) => ({
    id: p.id, x: fx(p.x), y: p.y,
    hin: p.hout ? { x: fx(p.hout.x), y: p.hout.y } : null,
    hout: p.hin ? { x: fx(p.hin.x), y: p.hin.y } : null,
  }))
}

/** Reflect across the line through a and b. */
function reflect(v: Vec, a: Vec, b: Vec): Vec {
  const d = sub(b, a)
  const L2 = d.x * d.x + d.y * d.y || 1e-9
  const t = ((v.x - a.x) * d.x + (v.y - a.y) * d.y) / L2
  const proj = add(a, mul(d, t))
  return sub(mul(proj, 2), v)
}

/** Unfold a piece across its fold edge into a single full piece. */
export function unfold(piece: PatternPiece): Pick<PatternPiece, 'points' | 'internals' | 'notches' | 'foldEdge' | 'edgeTags' | 'edgeSA' | 'marks'> | null {
  const pts = piece.points
  const fi = pts.findIndex((p) => p.id === piece.foldEdge)
  if (fi < 0) return null
  const n = pts.length
  const a = pts[fi], b = pts[(fi + 1) % n]
  // Walk from b around to a (excluding the fold edge), then append the mirrored walk back.
  const forward: PPoint[] = []
  for (let k = 0; k < n; k++) forward.push(pts[(fi + 1 + k) % n])
  const mirrored: PPoint[] = forward.slice(1, -1).reverse().map((p) => ({
    id: uid(),
    ...reflect(p, a, b),
    hin: p.hout ? reflect(p.hout, a, b) : null,
    hout: p.hin ? reflect(p.hin, a, b) : null,
  }))
  // b and a become interior points: the edges arriving at b and leaving a are
  // mirror images of b→next and prev→a, so their handles are reflections.
  const full = [...forward.map((p) => ({ ...p })), ...mirrored]
  full[0] = { ...full[0], hin: b.hout ? reflect(b.hout, a, b) : null }
  const last = forward.length - 1
  full[last] = { ...full[last], hout: a.hin ? reflect(a.hin, a, b) : null }
  const mirrorInternals = piece.internals.map((it) => ({ ...it, id: uid(), pts: it.pts.map((v) => reflect(v, a, b)) }))
  const edgeTags = { ...piece.edgeTags }
  delete edgeTags[a.id]
  return {
    points: full,
    internals: [...piece.internals, ...mirrorInternals],
    notches: piece.notches,
    foldEdge: null,
    edgeTags,
    edgeSA: piece.edgeSA,
    marks: piece.marks,
  }
}

/** Cut a piece by the infinite line a→b. Returns 0 or 2 outlines (corner points). */
export function cutPolygon(points: PPoint[], a: Vec, b: Vec): [PPoint[], PPoint[]] | null {
  const poly = flatten(points, 14)
  const side = (p: Vec) => (b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x)
  const clip = (keep: (s: number) => boolean) => {
    const out: Vec[] = []
    for (let i = 0; i < poly.length; i++) {
      const p = poly[i], q = poly[(i + 1) % poly.length]
      const sp = side(p), sq = side(q)
      if (keep(sp)) out.push(p)
      if ((sp > 0) !== (sq > 0) && sp !== 0 && sq !== 0) out.push(lineIntersect(p, q, a, b)!)
    }
    return out
  }
  const A = simplify(clip((s) => s >= 0), 0.15), B = simplify(clip((s) => s < 0), 0.15)
  if (A.length < 3 || B.length < 3 || area(A) < 1 || area(B) < 1) return null
  return [A.map((v) => pt(v.x, v.y)), B.map((v) => pt(v.x, v.y))]
}

/** Ramer–Douglas–Peucker on a closed polygon. */
export function simplify(poly: Vec[], eps: number): Vec[] {
  if (poly.length < 4) return poly
  const rdp = (pts: Vec[]): Vec[] => {
    if (pts.length < 3) return pts
    const a = pts[0], b = pts[pts.length - 1]
    let idx = -1, dmax = 0
    for (let i = 1; i < pts.length - 1; i++) {
      const d = Math.abs((b.x - a.x) * (a.y - pts[i].y) - (a.x - pts[i].x) * (b.y - a.y)) / (dist(a, b) || 1)
      if (d > dmax) { dmax = d; idx = i }
    }
    if (dmax <= eps) return [a, b]
    return [...rdp(pts.slice(0, idx + 1)).slice(0, -1), ...rdp(pts.slice(idx))]
  }
  return rdp([...poly, poly[0]]).slice(0, -1)
}

/** Total piece area (cm²), counting fold and cut quantity. */
export function cutArea(piece: PatternPiece) {
  const a = area(flatten(piece.points, 10))
  return a * (piece.foldEdge ? 2 : 1) * (piece.foldEdge ? 1 : piece.cut)
}

/**
 * Length an edge contributes once sewn: minus darts and pleats whose legs sit on the
 * edge, and divided by the gather ratio of gathers along it.
 */
export function sewnLength(piece: Pick<PatternPiece, 'points' | 'internals'>, i: number) {
  let L = edgeLength(piece.points, i)
  const poly = edgePolyline(piece.points, i, 24)
  const near = (v: Vec) => {
    let d = Infinity
    for (let k = 0; k < poly.length - 1; k++) {
      const a = poly[k], b = poly[k + 1], ab = sub(b, a)
      const L2 = ab.x * ab.x + ab.y * ab.y || 1e-9
      const t = Math.max(0, Math.min(1, ((v.x - a.x) * ab.x + (v.y - a.y) * ab.y) / L2))
      d = Math.min(d, dist(v, add(a, mul(ab, t))))
    }
    return d < 0.6
  }
  for (const it of piece.internals) {
    if (it.kind === 'dart' && it.pts.length === 3 && near(it.pts[0]) && near(it.pts[2])) L -= dist(it.pts[0], it.pts[2])
    if (it.kind === 'pleat' && near(it.pts[0])) L -= (it.size ?? 2.5) * 2
    if (it.kind === 'tuck' && near(it.pts[0])) L -= (it.size ?? 1) * 2
  }
  const g = piece.internals.find((it) => it.kind === 'gather' && near(it.pts[0]) && near(it.pts[1]))
  if (g) L /= g.size ?? 1.6
  return Math.max(0, L)
}
