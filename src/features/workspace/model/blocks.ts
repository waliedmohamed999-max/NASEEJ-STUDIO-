import type { LText } from '@/types'
import { uid } from '@/lib/utils'
import type {
  EdgeTag, GarmentKind, Internal, Material, PatternPiece, PieceRole, PPoint, Seam, StitchType, Vec,
} from './types'
import { pt } from './geometry'
import { BODY } from './grading'

/**
 * Parametric base blocks drafted for the size-M body (bust 90 / waist 72 / hip 96,
 * height 168). Every template is a set of parameters fed into these drafts, so all
 * 60+ styles share the same block proportions and grade the same way.
 */
export type Neckline = 'crew' | 'v' | 'scoop' | 'boat' | 'high' | 'square'
export type SleeveType = 'none' | 'cap' | 'short' | 'elbow' | 'threeQuarter' | 'long' | 'bell' | 'kimono' | 'butterfly' | 'batwing'
export type Closure = 'none' | 'buttons' | 'zip' | 'open'
export type CollarType = 'none' | 'shirt' | 'mandarin' | 'lapel' | 'polo' | 'hood'
export type SkirtType = 'straight' | 'pencil' | 'aline' | 'circle' | 'pleated' | 'gathered' | 'mermaid'
export type LegShape = 'straight' | 'wide' | 'slim' | 'jogger' | 'legging'

export interface TemplateParams {
  ease?: { bust: number; waist: number; hip: number }
  /** top/dress: from high-point shoulder; skirt/trousers: from waist (cm) */
  length?: number
  hemFlare?: number
  neckline?: Neckline
  closure?: Closure
  sleeve?: SleeveType
  sleeveEase?: number
  collar?: CollarType
  darts?: boolean
  waistSeam?: boolean
  skirtType?: SkirtType
  skirtLength?: number
  cuffs?: boolean
  pockets?: boolean
  waistband?: boolean
  legShape?: LegShape
  pleats?: number
  slits?: boolean
  scarf?: { w: number; h: number }
  /** jumpsuit: trouser length from waist */
  trouserLength?: number
}

export interface DraftResult {
  pieces: PatternPiece[]
  seams: Seam[]
  meta: { sleeve: SleeveType; collar: CollarType; closure: Closure; neckline: Neckline }
}

/* ---------------- helpers ---------------- */

const T = (en: string, ar: string): LText => ({ en, ar })

function piece(
  name: LText, role: PieceRole, points: PPoint[], tags: EdgeTag[], o: Partial<PatternPiece> & { material: Material },
): PatternPiece {
  const edgeTags: Record<string, EdgeTag> = {}
  points.forEach((p, i) => { if (tags[i]) edgeTags[p.id] = tags[i] })
  const xs = points.map((p) => p.x), ys = points.map((p) => p.y)
  const cx = (Math.min(...xs) + Math.max(...xs)) / 2
  const y0 = Math.min(...ys), y1 = Math.max(...ys)
  return {
    id: uid(), name, role, points, x: 0, y: 0, rotation: 0, flipped: false,
    foldEdge: null, cut: 1, seamAllowance: 1, edgeSA: {}, edgeTags, topstitch: [],
    grain: [{ x: cx, y: y0 + (y1 - y0) * 0.2 }, { x: cx, y: y0 + (y1 - y0) * 0.8 }],
    notches: [], internals: [], marks: {}, layer: 'shell', gradeX: 0.25, gradeY: 1,
    visible: true, locked: false, group: null,
    ...o,
  }
}

const edgeId = (p: PatternPiece, tag: EdgeTag, nth = 0) =>
  p.points.filter((pp) => p.edgeTags[pp.id] === tag)[nth]?.id

function seam(a: PatternPiece, ta: EdgeTag, b: PatternPiece, tb: EdgeTag, stitch: StitchType = '301', na = 0, nb = 0): Seam | null {
  const ea = edgeId(a, ta, na), eb = edgeId(b, tb, nb)
  if (!ea || !eb) return null
  return { id: uid(), a: { piece: a.id, edge: ea }, b: { piece: b.id, edge: eb }, stitch }
}

const dart = (x: number, y: number, width: number, apexY: number): Internal => ({
  id: uid(), kind: 'dart', pts: [{ x: x - width / 2, y }, { x, y: apexY }, { x: x + width / 2, y }],
})

/* ---------------- bodice / body block ---------------- */

interface BodyOpts {
  front: boolean
  ease: { bust: number; waist: number; hip: number }
  length: number
  flare: number
  neck: Neckline
  closure: Closure
  sleeve: SleeveType
  darts: boolean
  material: Material
  name?: LText
}

function bodyHalf(o: BodyOpts): PatternPiece {
  const b = BODY.M
  const bustQ = (b.bust + o.ease.bust) / 4
  const waistQ = (b.waist + o.ease.waist) / 4
  const hipQ = (b.hip + o.ease.hip) / 4
  const neckW = { crew: 7, v: 7.5, scoop: 9.5, boat: 11, high: 6.5, square: 9 }[o.neck]
  const neckD = o.front
    ? { crew: 8, v: 21, scoop: 14, boat: 3, high: 5, square: 13 }[o.neck]
    : { crew: 2.2, v: 3, scoop: 4, boat: 2, high: 2, square: 3 }[o.neck]
  const shoulderX = 19 + (o.ease.bust > 16 ? 1.5 : 0)
  const shoulderY = 4.5
  const armholeY = 21 + o.ease.bust / 10
  const waistY = 42, hipY = 62
  const L = o.length
  const dartTake = o.darts ? (o.front ? 2.5 : 2) : 0
  const ext = o.front && o.closure === 'buttons' ? 2 : 0
  const pts: PPoint[] = []
  const tags: EdgeTag[] = []
  const push = (p: PPoint, tag: EdgeTag) => { pts.push(p); tags.push(tag) }
  const cutOn = o.sleeve === 'kimono' || o.sleeve === 'butterfly' || o.sleeve === 'batwing'

  // neckline (CF/CB → neck side)
  const necks = o.neck === 'v' || o.neck === 'square'
  push(pt(-ext, neckD, null, necks ? null : { x: neckW * 0.55, y: neckD }), 'neck')
  if (o.neck === 'square') { pts[0].x = -ext; push(pt(neckW, neckD), 'neck') }
  push(pt(neckW, 0, necks ? null : { x: neckW, y: neckD * 0.45 }, null), 'shoulder')

  let underarm: Vec
  if (!cutOn) {
    push(pt(shoulderX, shoulderY, null, { x: shoulderX - 1.6, y: shoulderY + (armholeY - shoulderY) * 0.55 }), 'armhole')
    underarm = { x: bustQ, y: armholeY }
    push(pt(underarm.x, underarm.y, { x: bustQ - 4, y: armholeY - 0.3 }, null), 'side')
  } else if (o.sleeve === 'kimono') {
    const ang = (14 * Math.PI) / 180, len = L > 100 ? 62 : 34, ow = L > 100 ? 34 : 24
    const E = { x: shoulderX + len * Math.cos(ang), y: shoulderY + len * Math.sin(ang) }
    push(pt(E.x, E.y), 'opening')
    push(pt(E.x - ow * Math.sin(ang), E.y + ow * Math.cos(ang), null, { x: bustQ + 6, y: armholeY + 10 }), 'underarm')
    underarm = { x: bustQ + 2, y: armholeY + 14 }
    push(pt(underarm.x, underarm.y, { x: bustQ + 2, y: armholeY + 8 }, null), 'side')
  } else if (o.sleeve === 'butterfly') {
    const wing = 74
    push(pt(wing, 7), 'opening')
    push(pt(wing, 62), 'underarm')
    underarm = { x: hipQ + 8, y: Math.min(L - 10, 100) }
    push(pt(underarm.x, underarm.y), 'side')
  } else {
    // batwing: deep underarm meeting the side at the waist
    push(pt(shoulderX + 42, 22), 'opening')
    push(pt(shoulderX + 38, 34, null, { x: bustQ + 10, y: waistY - 4 }), 'underarm')
    underarm = { x: waistQ + 2, y: waistY }
    push(pt(underarm.x, underarm.y, { x: waistQ + 6, y: waistY - 8 }, null), 'side')
  }

  // side seam down to hem
  if (!cutOn || o.sleeve === 'kimono' || o.sleeve === 'batwing') {
    if (L > waistY + 3 && underarm.y < waistY - 2) {
      const wx = Math.max(waistQ + dartTake, cutOn ? hipQ : 0)
      push(pt(wx, waistY, { x: wx, y: waistY - 6 }, { x: wx, y: waistY + 6 }), 'side')
    }
    if (L > hipY + 3 && underarm.y < hipY - 2) push(pt(hipQ, hipY, { x: hipQ - 0.3, y: hipY - 6 }, null), 'side')
  }
  const hemQ = L > hipY
    ? hipQ + o.flare
    : L > waistY ? waistQ + dartTake + (hipQ - waistQ - dartTake) * ((L - waistY) / (hipY - waistY)) + o.flare
      : bustQ + (waistQ + dartTake - bustQ) * Math.max(0, (L - armholeY) / (waistY - armholeY))
  const curveHem = o.flare > 6
  push(pt(Math.max(hemQ, underarm.x * 0.6), L, null, curveHem ? { x: hemQ * 0.6, y: L + o.flare * 0.12 } : null), 'hem')
  push(pt(-ext, L + (curveHem ? o.flare * 0.12 : 0), curveHem ? { x: hemQ * 0.25, y: L + o.flare * 0.12 } : null, null), o.front ? 'cf' : 'cb')

  const onFold = !(o.front && (o.closure === 'buttons' || o.closure === 'open' || o.closure === 'zip'))
  const p = piece(o.name ?? (o.front ? T('Front', 'الأمام') : T('Back', 'الخلف')), o.front ? 'front' : 'back', pts, tags, {
    material: o.material, cut: onFold ? 1 : 2, gradeX: 0.25,
  })
  p.foldEdge = onFold ? pts[pts.length - 1].id : null
  p.marks = { bust: Math.min(armholeY + 2, L - 1) }
  if (L > waistY) p.marks.waist = waistY
  if (L > hipY) p.marks.hip = hipY
  p.grain = [{ x: bustQ * 0.45, y: armholeY }, { x: bustQ * 0.45, y: Math.max(armholeY + 10, L - 12) }]
  if (o.darts && L >= waistY - 0.5) {
    const dx = bustQ * 0.5
    p.internals.push(dart(dx, waistY, dartTake, waistY - (o.front ? 16 : 18)))
    if (L > hipY) p.internals.push(dart(dx, waistY, dartTake, waistY + 13))
  }
  if (o.front && o.closure === 'buttons') {
    for (let y = neckD + 1.5; y < Math.min(L - 8, 110); y += 9) {
      p.internals.push({ id: uid(), kind: 'buttonhole', pts: [{ x: -0.4, y }, { x: 1.4, y }] })
    }
  }
  const arm = pts.find((q) => p.edgeTags[q.id] === 'armhole')
  if (arm) p.notches.push({ id: uid(), edge: arm.id, t: o.front ? 0.62 : 0.55 })
  return p
}

/* ---------------- sleeve block ---------------- */

function sleevePiece(type: SleeveType, ease: number, cuffs: boolean, material: Material): PatternPiece | null {
  if (type === 'none' || type === 'kimono' || type === 'butterfly' || type === 'batwing') return null
  const bicep = 28 + ease
  const capH = type === 'cap' ? 9 : ease > 8 ? 11 : 13.5
  const len = { cap: 11, short: 24, elbow: 36, threeQuarter: 46, long: cuffs ? 54 : 60, bell: 60 }[type]
  const open = { cap: bicep - 1, short: bicep - 3, elbow: 27, threeQuarter: 24, long: cuffs ? 24 : 22, bell: 52 }[type]
  const hw = bicep / 2, ow = open / 2
  const pts = [
    pt(0, 0, { x: -hw * 0.42, y: 0 }, { x: hw * 0.42, y: 0 }),
    pt(hw, capH, { x: hw * 0.72, y: capH * 0.58 }, null),
    pt(ow, len, null, type === 'bell' ? { x: ow * 0.5, y: len + 2.5 } : null),
    pt(-ow, len, type === 'bell' ? { x: -ow * 0.5, y: len + 2.5 } : null, null),
    pt(-hw, capH, null, { x: -hw * 0.72, y: capH * 0.58 }),
  ]
  const p = piece(T('Sleeve', 'الكم'), 'sleeve', pts, ['cap', 'underarm', 'hem', 'underarm', 'cap'], {
    material, cut: 2, gradeX: 0.16, gradeY: 0.6,
  })
  p.marks = {}
  p.grain = [{ x: 0, y: capH + 2 }, { x: 0, y: len - 4 }]
  p.notches.push({ id: uid(), edge: pts[0].id, t: 0.55 }, { id: uid(), edge: pts[4].id, t: 0.45 })
  return p
}

/* ---------------- skirt block ---------------- */

function skirtHalf(front: boolean, type: SkirtType, length: number, ease: { waist: number; hip: number }, pleats: number, material: Material): PatternPiece {
  const b = BODY.M
  const waist = b.waist + ease.waist
  const waistQ = waist / 4, hipQ = (b.hip + ease.hip) / 4
  const role: PieceRole = front ? 'skirtFront' : 'skirtBack'
  const name = front ? T('Skirt front', 'التنورة الأمامية') : T('Skirt back', 'التنورة الخلفية')
  const L = length
  if (type === 'circle') {
    // quarter-circle sector (half panel on fold) — inner arc = waist / 4
    const r = waist / (2 * Math.PI), R = r + L, k = 0.5523
    const pts = [
      pt(0, 0, null, { x: r * k, y: 0 }),
      pt(r, -r, { x: r, y: -r + r * k }, null),
      pt(R, -r, null, { x: R, y: -r + R * k }),
      pt(0, -r + R, { x: R * k, y: -r + R }, null),
    ]
    const p = piece(name, role, pts, ['waist', 'side', 'hem', front ? 'cf' : 'cb'], { material, gradeX: 0.08, gradeY: 1 })
    p.foldEdge = pts[3].id
    p.grain = [{ x: 2, y: 4 }, { x: 2, y: L - 6 }]
    return p
  }
  const gathered = type === 'gathered'
  const pleatW = type === 'pleated' ? pleats * 3 * 2 : 0
  const dartTake = type === 'straight' || type === 'pencil' || type === 'mermaid' ? 2 : 0
  const topQ = gathered ? hipQ * 1.8 : waistQ + dartTake + pleatW
  const hipW = gathered ? hipQ * 1.8 : hipQ + pleatW
  const hem = type === 'pencil' ? hipW - 2 : type === 'aline' ? hipW + 0.2 * (L - 20) : hipW
  const pts: PPoint[] = [pt(0, front ? 1 : 0, null, { x: topQ * 0.5, y: front ? 1 : 0 })]
  const tags: EdgeTag[] = ['waist']
  if (gathered) {
    pts.push(pt(topQ, 0)); tags.push('side')
  } else {
    pts.push(pt(topQ, 0, { x: topQ * 0.7, y: 0 }, { x: topQ + 0.4, y: 8 })); tags.push('side')
    pts.push(pt(hipW, 20, { x: hipW, y: 14 }, null)); tags.push('side')
  }
  if (type === 'mermaid') {
    pts.push(pt(hipW - 3, Math.min(55, L - 15), null, { x: hipW - 2.5, y: L - 12 })); tags.push('side')
    pts.push(pt(hipW + 22, L, { x: hipW + 8, y: L - 4 }, null)); tags.push('hem')
  } else {
    pts.push(pt(hem, L)); tags.push('hem')
  }
  pts.push(pt(0, L)); tags.push(front ? 'cf' : 'cb')
  const p = piece(name, role, pts, tags, { material, gradeX: gathered ? 0.4 : 0.25, gradeY: 1 })
  p.foldEdge = pts[pts.length - 1].id
  p.marks = gathered ? {} : { hip: 20 }
  p.grain = [{ x: hipW * 0.5, y: 6 }, { x: hipW * 0.5, y: L - 6 }]
  if (dartTake) p.internals.push(dart(waistQ * 0.55, front ? 0.6 : 0, dartTake, front ? 9 : 12))
  if (type === 'pleated') {
    for (let i = 0; i < pleats; i++) {
      const x = 4 + i * ((topQ - 6) / Math.max(1, pleats))
      p.internals.push({ id: uid(), kind: 'pleat', pts: [{ x, y: 0 }, { x, y: 14 }], size: 3 })
    }
  }
  if (gathered) p.internals.push({ id: uid(), kind: 'gather', pts: [{ x: 1, y: 0.5 }, { x: topQ - 1, y: 0 }], size: 1.8 })
  return p
}

/* ---------------- trouser block ---------------- */

function trouserHalf(front: boolean, length: number, ease: { waist: number; hip: number }, shape: LegShape, darts: boolean, material: Material): PatternPiece {
  const b = BODY.M
  const waistQ = (b.waist + ease.waist) / 4 + (darts ? 1.5 : 0)
  const hipQ = (b.hip + ease.hip) / 4
  const rise = 26
  const ext = front ? b.hip / 16 : b.hip / 8
  const opening = { straight: 42, wide: 60, slim: 32, jogger: 26, legging: 22 }[shape]
  const hw = (opening / 2 + (front ? -2 : 2)) / 2
  const cx = (ext + hipQ + ext) / 2 - ext * 0.15
  const L = length
  const knee = Math.min(L - 4, rise + 32)
  const kneeW = { straight: hw + 0.5, wide: hw, slim: hw + 1.5, jogger: hw + 4, legging: hw + 2.5 }[shape]
  const top = front ? 0 : -3
  const pts = [
    pt(ext + (front ? 0 : 1.5), top),
    pt(ext + waistQ, front ? 0 : -0.5, null, { x: ext + waistQ + 0.6, y: 8 }),
    pt(ext + hipQ, 18, { x: ext + hipQ, y: 12 }, null),
    pt(cx + kneeW, knee, { x: cx + kneeW + 2, y: knee - 14 }, null),
    pt(cx + hw, L),
    pt(cx - hw, L),
    pt(cx - kneeW, knee, null, { x: cx - kneeW - 1.5, y: knee - 14 }),
    pt(0, rise, { x: ext * 0.15, y: rise + 3 }, { x: ext * 0.55, y: rise - 0.3 }),
    pt(ext, rise - 8, { x: ext, y: rise - 3 }, null),
  ]
  const tags: EdgeTag[] = ['waist', 'side', 'side', 'side', 'hem', 'inseam', 'inseam', 'crotch', front ? 'cf' : 'cb']
  const p = piece(front ? T('Trouser front', 'السروال الأمامي') : T('Trouser back', 'السروال الخلفي'), front ? 'trouserFront' : 'trouserBack', pts, tags, {
    material, cut: 2, gradeX: 0.25, gradeY: 1,
  })
  p.marks = { hip: 18, thigh: rise + 2 }
  p.grain = [{ x: cx, y: rise }, { x: cx, y: L - 8 }]
  if (darts) p.internals.push(dart(ext + waistQ * 0.5, front ? 0 : -1.5, 1.5, front ? 9 : 12))
  p.notches.push({ id: uid(), edge: pts[1].id, t: 0.5 })
  return p
}

/* ---------------- small pieces ---------------- */

const rect = (w: number, h: number) => [pt(0, 0), pt(w, 0), pt(w, h), pt(0, h)]

function collarPiece(type: CollarType, material: Material): PatternPiece | null {
  if (type === 'none') return null
  if (type === 'hood') {
    const pts = [
      pt(0, 34, null, { x: 9, y: 36 }),
      pt(25, 33, null, { x: 30, y: 22 }),
      pt(26, 8, { x: 29, y: 18 }, { x: 22, y: -2 }),
      pt(10, -3, { x: 18, y: -4 }, null),
      pt(0, 2),
    ]
    const p = piece(T('Hood', 'القلنسوة'), 'hood', pts, ['neck', 'other', 'other', 'other', 'opening'], { material, cut: 2, gradeX: 0.1, gradeY: 0.2 })
    return p
  }
  const dims = { shirt: [21, 7.5], mandarin: [20.5, 3.8], lapel: [22, 7], polo: [21, 8] }[type]
  const [w, h] = dims
  const pts = type === 'mandarin'
    ? [pt(0, 0), pt(w - 1, 0.6, null, { x: w + 0.2, y: 1.2 }), pt(w, h, { x: w, y: h - 1 }, null), pt(0, h)]
    : type === 'shirt' || type === 'lapel'
      ? [pt(0, 0), pt(w, 0), pt(w + 2.5, h), pt(0, h)]
      : rect(w, h)
  const p = piece(T('Collar', 'الياقة'), 'collar', pts, ['neck', 'other', 'other', 'fold'], { material, gradeX: 0.06, gradeY: 0 })
  p.foldEdge = pts[3].id
  p.edgeTags[pts[0].id] = 'neck'
  p.grain = [{ x: w * 0.3, y: h / 2 }, { x: w * 0.7, y: h / 2 }]
  return p
}

/* ---------------- top-level drafting ---------------- */

export function draft(kind: GarmentKind, prm: TemplateParams, material: Material): DraftResult {
  const ease = prm.ease ?? { bust: 8, waist: 8, hip: 8 }
  const neck = prm.neckline ?? 'crew'
  const closure = prm.closure ?? 'none'
  const sleeve = prm.sleeve ?? 'none'
  const collar = prm.collar ?? 'none'
  const pieces: PatternPiece[] = []
  const seams: Array<Seam | null> = []
  const meta = { sleeve, collar, closure, neckline: neck }

  if (kind === 'scarf') {
    const { w, h } = prm.scarf ?? { w: 180, h: 70 }
    const p = piece(T('Scarf', 'الوشاح'), 'scarf', rect(w, h), ['hem', 'hem', 'hem', 'hem'], { material, gradeX: 0, gradeY: 0 })
    p.seamAllowance = 0.6
    p.topstitch = p.points.map((q) => q.id)
    return { pieces: [p], seams: [], meta }
  }

  const addBody = (length: number, flare: number) => {
    const f = bodyHalf({ front: true, ease, length, flare, neck, closure, sleeve, darts: !!prm.darts, material })
    const bk = bodyHalf({ front: false, ease, length, flare, neck, closure, sleeve, darts: !!prm.darts, material })
    pieces.push(f, bk)
    seams.push(seam(f, 'shoulder', bk, 'shoulder'), seam(f, 'side', bk, 'side', '504'))
    if (sleeve === 'kimono' || sleeve === 'batwing' || sleeve === 'butterfly') seams.push(seam(f, 'underarm', bk, 'underarm', '504'))
    const s = sleevePiece(sleeve, prm.sleeveEase ?? (ease.bust > 14 ? 10 : 6), !!prm.cuffs, material)
    if (s) {
      pieces.push(s)
      seams.push(seam(s, 'cap', f, 'armhole', '301', 1, 0), seam(s, 'cap', bk, 'armhole', '301', 0, 0), seam(s, 'underarm', s, 'underarm', '504', 0, 1))
      if (prm.cuffs) {
        const c = piece(T('Cuff', 'الإسورة'), 'cuff', rect(24, 6), ['other', 'other', 'other', 'other'], { material, cut: 2, gradeX: 0.05, gradeY: 0 })
        pieces.push(c)
        seams.push(seam(s, 'hem', c, 'other'))
      }
    }
    const c = collarPiece(collar, material)
    if (c) { pieces.push(c); seams.push(seam(c, 'neck', f, 'neck')) }
    return { f, bk }
  }

  if (kind === 'top' || kind === 'dress' || kind === 'jumpsuit') {
    const fullLen = kind === 'jumpsuit' ? 44 : prm.length ?? (kind === 'top' ? 66 : 110)
    if ((prm.waistSeam || kind === 'jumpsuit') && kind !== 'top') {
      const { f, bk } = addBody(42, 0)
      if (kind === 'jumpsuit') {
        const tf = trouserHalf(true, prm.trouserLength ?? 100, ease, prm.legShape ?? 'straight', false, material)
        const tb = trouserHalf(false, prm.trouserLength ?? 100, ease, prm.legShape ?? 'straight', false, material)
        pieces.push(tf, tb)
        seams.push(seam(f, 'hem', tf, 'waist'), seam(bk, 'hem', tb, 'waist'), seam(tf, 'side', tb, 'side', '504'), seam(tf, 'inseam', tb, 'inseam', '504'))
      } else {
        const st = prm.skirtType ?? 'aline'
        const sl = prm.skirtLength ?? 68
        const sf = skirtHalf(true, st, sl, ease, prm.pleats ?? 4, material)
        const sb = skirtHalf(false, st, sl, ease, prm.pleats ?? 4, material)
        pieces.push(sf, sb)
        seams.push(seam(f, 'hem', sf, 'waist'), seam(bk, 'hem', sb, 'waist'), seam(sf, 'side', sb, 'side', '504'))
      }
    } else {
      addBody(fullLen, prm.hemFlare ?? 0)
    }
    if (prm.pockets) pieces.push(piece(T('Patch pocket', 'جيب خارجي'), 'pocket', rect(15, 17), ['opening', 'other', 'other', 'other'], { material, cut: 2, gradeX: 0.02, gradeY: 0.05 }))
  }

  if (kind === 'skirt') {
    const st = prm.skirtType ?? 'aline'
    const L = prm.length ?? 64
    const sf = skirtHalf(true, st, L, ease, prm.pleats ?? 6, material)
    const sb = skirtHalf(false, st, L, ease, prm.pleats ?? 6, material)
    pieces.push(sf, sb)
    seams.push(seam(sf, 'side', sb, 'side', '504'))
    if (prm.waistband !== false) {
      const wb = piece(T('Waistband', 'حزام الخصر'), 'waistband', rect(BODY.M.waist + ease.waist + 4, 8), ['other', 'other', 'other', 'other'], { material, gradeX: 1, gradeY: 0 })
      pieces.push(wb)
      seams.push(seam(sf, 'waist', wb, 'other'))
    }
  }

  if (kind === 'trousers') {
    const L = prm.length ?? 102
    const shape = prm.legShape ?? 'straight'
    const tf = trouserHalf(true, L, ease, shape, !!prm.darts, material)
    const tb = trouserHalf(false, L, ease, shape, !!prm.darts, material)
    pieces.push(tf, tb)
    seams.push(seam(tf, 'side', tb, 'side', '504'), seam(tf, 'inseam', tb, 'inseam', '504'), seam(tf, 'crotch', tb, 'crotch', '401'))
    if (prm.waistband !== false) {
      const wb = piece(T('Waistband', 'حزام الخصر'), 'waistband', rect(BODY.M.waist + ease.waist + 4, shape === 'jogger' || shape === 'legging' ? 7 : 8), ['other', 'other', 'other', 'other'], { material, gradeX: 1, gradeY: 0 })
      pieces.push(wb)
      seams.push(seam(tf, 'waist', wb, 'other'))
    }
    if (shape === 'jogger') pieces.push(piece(T('Ankle cuff', 'إسورة الكاحل'), 'cuff', rect(24, 8), ['other', 'other', 'other', 'other'], { material, cut: 2, gradeX: 0.05, gradeY: 0 }))
    if (prm.pockets) pieces.push(piece(T('Cargo pocket', 'جيب كارجو'), 'pocket', rect(18, 20), ['opening', 'other', 'other', 'other'], { material, cut: 2, gradeX: 0.02, gradeY: 0.05 }))
  }

  // Lay pieces out on the cutting table in a row with 6 cm gutters.
  let cursor = 0
  for (const p of pieces) {
    const xs = p.points.map((q) => q.x), ys = p.points.map((q) => q.y)
    p.x = cursor - Math.min(...xs) + 4
    p.y = -Math.min(...ys) + 6
    cursor += Math.max(...xs) - Math.min(...xs) + 8
  }
  return { pieces, seams: seams.filter(Boolean) as Seam[], meta }
}
