import type { PatternPiece, PPoint, SizeKey, SizeSystem, Style, Vec } from './types'
import { SIZES } from './types'
import { bbox } from './geometry'

/**
 * Grade rule tables. `girth` = full-body circumference change between consecutive
 * sizes (XS→S, S→M, …); `length` = body-length change per step.
 * GCC modest wear grades length in 2-inch steps (abaya lengths 52″–64″).
 */
export interface GradeRules {
  labels: Record<SizeKey, string>
  girth: number[]
  length: number[]
  note: string
}

export const GRADE_RULES: Record<SizeSystem, GradeRules> = {
  EU: {
    labels: { XS: '34', S: '36', M: '38', L: '40', XL: '42', XXL: '44', '3XL': '46' },
    girth: [4, 4, 6, 6, 8, 8], length: [0.8, 0.8, 1, 1, 1, 1],
    note: 'EN 13402 style metric steps',
  },
  US: {
    labels: { XS: '4', S: '6', M: '8', L: '10', XL: '12', XXL: '14', '3XL': '16' },
    girth: [3.81, 3.81, 5.08, 5.08, 7.62, 7.62], length: [0.64, 0.64, 1.27, 1.27, 1.27, 1.27],
    note: '1½″ / 2″ / 3″ girth steps',
  },
  UK: {
    labels: { XS: '8', S: '10', M: '12', L: '14', XL: '16', XXL: '18', '3XL': '20' },
    girth: [5, 5, 5, 5, 5, 5], length: [0.75, 0.75, 0.75, 0.75, 0.75, 0.75],
    note: 'Uniform 5 cm girth steps',
  },
  GCC: {
    labels: { XS: '52', S: '54', M: '56', L: '58', XL: '60', XXL: '62', '3XL': '64' },
    girth: [4, 4, 6, 6, 8, 8], length: [5.08, 5.08, 5.08, 5.08, 5.08, 5.08],
    note: 'Abaya length in inches; 2″ length steps on full-length styles',
  },
}

/** Body measurements (cm) per size, shared by all systems. */
export const BODY: Record<SizeKey, { bust: number; waist: number; hip: number; height: number }> = {
  XS: { bust: 82, waist: 64, hip: 88, height: 162 },
  S: { bust: 86, waist: 68, hip: 92, height: 165 },
  M: { bust: 90, waist: 72, hip: 96, height: 168 },
  L: { bust: 96, waist: 78, hip: 102, height: 170 },
  XL: { bust: 102, waist: 84, hip: 108, height: 172 },
  XXL: { bust: 110, waist: 92, hip: 116, height: 173 },
  '3XL': { bust: 118, waist: 100, hip: 124, height: 174 },
}

export const sizeLabel = (sys: SizeSystem, s: SizeKey) => GRADE_RULES[sys].labels[s]

/** Cumulative girth & length deltas from `base` to `target`. */
export function gradeDelta(sys: SizeSystem, base: SizeKey, target: SizeKey, fullLength: boolean) {
  const r = GRADE_RULES[sys]
  const i0 = SIZES.indexOf(base), i1 = SIZES.indexOf(target)
  let g = 0, l = 0
  const lenStep = (k: number) => (sys === 'GCC' && !fullLength ? 1 : r.length[k])
  if (i1 > i0) for (let k = i0; k < i1; k++) { g += r.girth[k]; l += lenStep(k) }
  else for (let k = i1; k < i0; k++) { g -= r.girth[k]; l -= lenStep(k) }
  return { girth: g, length: l }
}

const centred = (p: PatternPiece) => p.role === 'sleeve' || p.role === 'cuff' || p.role === 'hood' || p.role === 'scarf'

/** Proportional grade: each point moves by its relative position within the piece. */
export function gradePiece(piece: PatternPiece, d: { girth: number; length: number }): PatternPiece {
  if (!d.girth && !d.length) return piece
  const b = bbox(piece.points)
  const w = b.w || 1, h = b.h || 1
  const gx = d.girth * piece.gradeX
  const gy = d.length * piece.gradeY
  const mv = (v: Vec): Vec => {
    const rx = centred(piece) ? (v.x - b.cx) / (w / 2) * 0.5 : (v.x - b.minX) / w
    const ry = (v.y - b.minY) / h
    return { x: v.x + rx * gx, y: v.y + ry * gy }
  }
  const mp = (p: PPoint): PPoint => ({ ...p, ...mv(p), hin: p.hin && mv(p.hin), hout: p.hout && mv(p.hout) })
  const marks: PatternPiece['marks'] = {}
  for (const [k, y] of Object.entries(piece.marks)) marks[k as keyof typeof marks] = mv({ x: b.minX, y: y! }).y
  return {
    ...piece,
    points: piece.points.map(mp),
    internals: piece.internals.map((it) => ({ ...it, pts: it.pts.map(mv) })),
    grain: [mv(piece.grain[0]), mv(piece.grain[1])],
    marks,
  }
}

export const isFullLength = (style: Pick<Style, 'kind'>) => style.kind === 'dress' || style.kind === 'jumpsuit'

export function gradeStyle(style: Style, target: SizeKey): Style {
  if (target === style.baseSize) return style
  const d = gradeDelta(style.sizeSystem, style.baseSize, target, isFullLength(style))
  return { ...style, pieces: style.pieces.map((p) => gradePiece(p, d)) }
}
