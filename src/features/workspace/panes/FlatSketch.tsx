import { useId, useMemo } from 'react'
import type { PatternPiece, Style, Vec } from '../model/types'
import { deriveSpec, type GarmentSpec } from '../model/spec'
import { effectiveMaterial, materialTile, useTransient } from '../render'
import { TRIMS } from '../model/trims'

/**
 * Technical flat (front/back) generated from the measured pattern.
 * Flat widths are half-girths, so piece-local coordinates of darts, buttonholes
 * and trims map straight onto the drawing.
 * Coordinates: cm, x = 0 at centre, y = 0 at high-point shoulder (waist for bottoms).
 */
export interface FlatGeom {
  outline: Vec[][]   // closed silhouettes (body, legs)
  sleeves: Vec[][]
  lines: Array<{ pts: Vec[]; dash?: string; w?: number }>
  dots: Array<{ c: Vec; r: number }>
  fills: { upper?: string; lower?: string; sleeve?: string }
  lowerFrom: number | null
  bounds: { minX: number; maxX: number; minY: number; maxY: number }
}

const mirrorX = (pts: Vec[]) => pts.map((p) => ({ x: -p.x, y: p.y }))
const sym = (half: Vec[]) => [...half, ...mirrorX(half).reverse()]

export function buildFlat(style: Style, view: 'front' | 'back', spec: GarmentSpec = deriveSpec(style)): FlatGeom {
  const m = style.meta
  const outline: Vec[][] = []
  const sleeves: Vec[][] = []
  const lines: FlatGeom['lines'] = []
  const dots: FlatGeom['dots'] = []
  const front = style.pieces.find((p) => p.role === (view === 'front' ? 'front' : 'back'))
  let lowerFrom: number | null = null

  if (style.kind === 'scarf') {
    const sc = style.pieces[0]
    const xs = sc.points.map((p) => p.x), ys = sc.points.map((p) => p.y)
    const w = Math.max(...xs) - Math.min(...xs), h = Math.max(...ys) - Math.min(...ys)
    outline.push([{ x: -w / 2, y: 0 }, { x: w / 2, y: 0 }, { x: w / 2, y: h }, { x: -w / 2, y: h }])
    lines.push({ pts: [{ x: -w / 2 + 1, y: 1 }, { x: w / 2 - 1, y: 1 }, { x: w / 2 - 1, y: h - 1 }, { x: -w / 2 + 1, y: h - 1 }, { x: -w / 2 + 1, y: 1 }], dash: '1 0.8', w: 0.6 })
    return finish()
  }

  const neckW = ({ crew: 7, v: 7.5, scoop: 9.5, boat: 11, high: 6.5, square: 9 } as Record<string, number>)[m.neckline] ?? 7
  const neckD = view === 'front'
    ? (({ crew: 8, v: 21, scoop: 14, boat: 3, high: 5, square: 13 } as Record<string, number>)[m.neckline] ?? 8)
    : 2.2


  if (spec.body) {
    const b = spec.body
    const sx = 19 + (b.bust > 120 ? 1.5 : 0)
    const L = style.kind === 'jumpsuit' || (spec.skirt && style.kind === 'dress') ? Math.min(b.length, 42) : b.length
    const cutOn = !!spec.sleeve?.cutOn
    const half: Vec[] = [{ x: 0, y: neckD }]
    if (m.neckline === 'square' && view === 'front') half.push({ x: neckW, y: neckD })
    else if (m.neckline !== 'v' || view === 'back') half.push({ x: neckW * 0.55, y: neckD * 0.92 }, { x: neckW * 0.9, y: neckD * 0.45 })
    half.push({ x: neckW, y: 0 })
    if (!cutOn) half.push({ x: sx, y: 4.5 }, { x: sx - 1, y: 12 }, { x: b.bust / 4, y: 21 })
    else half.push({ x: sx, y: 4.5 })
    let underY = 21
    if (cutOn) {
      const ang = m.sleeve === 'butterfly' ? 6 : m.sleeve === 'batwing' ? 24 : 16
      const a = (ang * Math.PI) / 180
      const Ls = Math.min(spec.sleeve!.length, 70)
      const T = { x: sx + Ls * Math.cos(a), y: 4.5 + Ls * Math.sin(a) }
      const op = Math.min(spec.sleeve!.opening / 2, m.sleeve === 'butterfly' ? 60 : 30)
      const U = { x: T.x - op * Math.sin(a) * 0.6, y: T.y + op * Math.cos(a) }
      underY = m.sleeve === 'butterfly' ? Math.min(L - 12, 95) : m.sleeve === 'batwing' ? 42 : 34
      half.push(T, U, { x: (m.sleeve === 'butterfly' ? b.hip : b.bust) / 4 + 2, y: underY })
    }
    if (L > 42 && underY < 41) half.push({ x: b.waist / 4, y: 42 })
    if (L > 62 && underY < 61) half.push({ x: b.hip / 4, y: 62 })
    const hemHalf = L > 62 ? Math.min(b.hem / 4, b.hip / 4 + (L - 62) * 0.5) : L > 42 ? b.waist / 4 + (b.hip - b.waist) / 4 * ((L - 42) / 20) : b.bust / 4 - (b.bust - b.waist) / 4 * Math.max(0, (L - 21) / 21)
    half.push({ x: Math.max(hemHalf, 8), y: L }, { x: 0, y: L })
    outline.push(sym(half))


    // set-in sleeves
    if (spec.sleeve && !cutOn) {
      const s = spec.sleeve
      const a = (11 * Math.PI) / 180
      const d = { x: Math.sin(a), y: Math.cos(a) }
      const S = { x: sx, y: 4.5 }, A = { x: b.bust / 4, y: 21 }
      const Ls = Math.max(6, s.length - 11)
      const T = { x: S.x + d.x * Ls, y: S.y + d.y * Ls }
      const op = Math.max(s.opening / 2, 6)
      const U = { x: T.x - Math.cos(a) * op, y: T.y + Math.sin(a) * op }
      const sl = [S, T, U, A]
      sleeves.push(sl, mirrorX(sl))
      lines.push({ pts: [{ x: T.x - (T.x - U.x) * 0.05, y: T.y - 1.4 }, { x: U.x + (T.x - U.x) * 0.05, y: U.y - 1.4 }], dash: '0.8 0.6', w: 0.5 })
    }

    // closure
    if (view === 'front' && m.closure === 'buttons') {
      lines.push({ pts: [{ x: 0, y: neckD }, { x: 0, y: L }], w: 0.6 }, { pts: [{ x: -2, y: neckD + 1 }, { x: -2, y: L }], dash: '0.8 0.6', w: 0.4 })
      const holes = front?.internals.filter((i) => i.kind === 'buttonhole') ?? []
      const ys = holes.length ? holes.map((h) => h.pts[0].y) : Array.from({ length: Math.floor((L - neckD - 8) / 9) }, (_, i) => neckD + 1.5 + i * 9)
      ys.filter((y) => y < L - 2).forEach((y) => dots.push({ c: { x: 0, y }, r: 0.7 }))
    }
    if (m.closure === 'zip' && ((view === 'front' && front?.role === 'front' && !front.foldEdge) || view === 'back')) {
      const zl = view === 'front' ? L - 2 : Math.min(L, 58)
      lines.push({ pts: [{ x: 0, y: neckD }, { x: 0, y: zl }], w: 0.7 })
      for (let y = neckD + 1; y < zl; y += 1.2) lines.push({ pts: [{ x: -0.5, y }, { x: 0.5, y }], w: 0.3 })
    }
    if (m.closure === 'open' && view === 'front') lines.push({ pts: [{ x: 0, y: neckD }, { x: -1.2, y: L }], w: 0.5 }, { pts: [{ x: 0, y: neckD }, { x: 1.2, y: L }], w: 0.5 })
    if (view === 'back' && front && !front.foldEdge && m.closure !== 'zip') lines.push({ pts: [{ x: 0, y: neckD }, { x: 0, y: L }], w: 0.5 })

    // collar
    if (m.collar === 'shirt' || m.collar === 'lapel') {
      const depth = m.collar === 'lapel' ? Math.max(neckD, 20) : neckD + 2
      const c = view === 'front'
        ? [{ x: neckW, y: -1.5 }, { x: neckW + 3, y: depth * 0.45 }, { x: 0.5, y: depth }, { x: neckW * 0.6, y: neckD * 0.4 }]
        : [{ x: -neckW - 0.5, y: -1.5 }, { x: neckW + 0.5, y: -1.5 }, { x: neckW + 1.5, y: 4.5 }, { x: -neckW - 1.5, y: 4.5 }]
      outline.push(view === 'front' ? c : c, ...(view === 'front' ? [mirrorX(c)] : []))
    } else if (m.collar === 'mandarin' || m.collar === 'polo') {
      const h = m.collar === 'polo' ? 4 : 3.5
      outline.push([{ x: -neckW, y: 0 }, { x: -neckW + 0.3, y: -h }, { x: neckW - 0.3, y: -h }, { x: neckW, y: 0 }, { x: neckW * 0.5, y: neckD * 0.5 }, { x: -neckW * 0.5, y: neckD * 0.5 }])
      if (m.collar === 'polo' && view === 'front') lines.push({ pts: [{ x: -1.5, y: neckD }, { x: -1.5, y: neckD + 12 }, { x: 1.5, y: neckD + 12 }, { x: 1.5, y: neckD }], w: 0.5 })
    } else if (m.collar === 'hood') {
      outline.push(view === 'back'
        ? [{ x: -neckW - 3, y: 4 }, { x: -neckW - 5, y: -18 }, { x: 0, y: -30 }, { x: neckW + 5, y: -18 }, { x: neckW + 3, y: 4 }]
        : [{ x: -neckW - 3, y: 2 }, { x: -neckW - 5, y: -18 }, { x: -neckW, y: -26 }, { x: -neckW + 1, y: -4 }, { x: neckW - 1, y: -4 }, { x: neckW, y: -26 }, { x: neckW + 5, y: -18 }, { x: neckW + 3, y: 2 }])
    }

    // darts, pockets, hem stitching from the actual pieces
    if (front) addMarkings(front, lines, dots, 0, L)
    const pocket = style.pieces.find((p) => p.role === 'pocket' && p.visible)
    if (pocket && view === 'front') {
      const py = Math.min(L - 22, 56), px = b.hip / 4 * 0.55
      for (const sgn of [-1, 1]) {
        lines.push({ pts: [{ x: sgn * (px - 7), y: py }, { x: sgn * (px + 7), y: py }, { x: sgn * (px + 7), y: py + 15 }, { x: sgn * (px - 7), y: py + 15 }, { x: sgn * (px - 7), y: py }], w: 0.5 })
      }
    }
    lines.push({ pts: [{ x: -hemHalf + 0.6, y: L - 2 }, { x: hemHalf - 0.6, y: L - 2 }], dash: '0.8 0.6', w: 0.4 })
  }

  // skirt (standalone or attached at the waist)
  if (spec.skirt) {
    const s = spec.skirt
    const y0 = style.kind === 'skirt' ? 0 : 42
    lowerFrom = style.kind === 'skirt' ? null : y0
    const hemHalf = Math.min(s.hem / 4, s.hip / 4 + s.length * 0.55)
    const half: Vec[] = [{ x: 0, y: y0 }, { x: s.waist / 4, y: y0 }]
    if (s.length > 22) half.push({ x: Math.max(s.hip / 4, s.waist / 4), y: y0 + 20 })
    half.push({ x: hemHalf, y: y0 + s.length }, { x: 0, y: y0 + s.length + (hemHalf > s.hip / 4 + 15 ? 2 : 0) })
    outline.push(sym(half))
    if (style.kind === 'skirt') outline.push([{ x: -s.waist / 4, y: -4 }, { x: s.waist / 4, y: -4 }, { x: s.waist / 4, y: 0 }, { x: -s.waist / 4, y: 0 }])
    const sk = style.pieces.find((p) => p.role === (view === 'front' ? 'skirtFront' : 'skirtBack'))
    if (sk) addMarkings(sk, lines, dots, y0, y0 + s.length)
    lines.push({ pts: [{ x: -hemHalf + 0.6, y: y0 + s.length - 2 }, { x: hemHalf - 0.6, y: y0 + s.length - 2 }], dash: '0.8 0.6', w: 0.4 })

  }

  // trousers
  if (spec.trousers) {
    const tr = spec.trousers
    const y0 = style.kind === 'jumpsuit' ? 42 : 0
    lowerFrom = style.kind === 'jumpsuit' ? y0 : null
    const hipH = tr.hip / 4
    const legHem = Math.max(tr.hem / 4, 5)
    const legCx = hipH / 2 + 1
    const thighHalf = Math.max(tr.thigh / 4, legHem)
    const leg: Vec[] = [
      { x: 0, y: y0 }, { x: tr.waist / 4, y: y0 }, { x: hipH, y: y0 + 18 },
      { x: legCx + legHem, y: y0 + tr.length }, { x: legCx - legHem, y: y0 + tr.length },
      { x: Math.max(0.6, legCx - thighHalf + 1), y: y0 + tr.rise + 4 }, { x: 0, y: y0 + tr.rise },
    ]
    outline.push(sym(leg))
    if (style.kind === 'trousers') outline.push([{ x: -tr.waist / 4, y: -4 }, { x: tr.waist / 4, y: -4 }, { x: tr.waist / 4, y: 0 }, { x: -tr.waist / 4, y: 0 }])
    if (view === 'front') lines.push({ pts: [{ x: 0, y: y0 }, { x: 0, y: y0 + tr.rise - 6 }], w: 0.5 }, { pts: [{ x: 3, y: y0 }, { x: 3, y: y0 + tr.rise - 8 }, { x: 0.3, y: y0 + tr.rise - 5 }], dash: '0.8 0.6', w: 0.4 })
    for (const sgn of [-1, 1]) lines.push({ pts: [{ x: sgn * (legCx - legHem + 0.5), y: y0 + tr.length - 2.5 }, { x: sgn * (legCx + legHem - 0.5), y: y0 + tr.length - 2.5 }], dash: '0.8 0.6', w: 0.4 })

  }

  // trims placed on the matching piece
  for (const u of style.trims) {
    if (!u.piece || !u.at) continue
    const p = style.pieces.find((q) => q.id === u.piece)
    if (!p || p.role !== (view === 'front' ? 'front' : 'back')) continue
    const def = TRIMS.find((x) => x.id === u.trimId)
    dots.push({ c: { x: u.at.x, y: u.at.y }, r: def?.cat === 'button' ? 0.8 : 1.2 })
  }

  // fills
  const fills: FlatGeom['fills'] = {}
  const mat = (id?: string) => {
    const p = id ? style.pieces.find((q) => q.id === id) : undefined
    return p ? materialTile(effectiveMaterial(style, p), style.artworks).url : undefined
  }
  fills.upper = mat(spec.materials.upper)
  fills.lower = mat(spec.materials.lower)
  fills.sleeve = mat(spec.materials.sleeve)
  return finish()

  function finish(): FlatGeom {
    const all = [...outline.flat(), ...sleeves.flat()]
    const xs = all.map((p) => p.x), ys = all.map((p) => p.y)
    return {
      outline, sleeves, lines, dots, lowerFrom,
      fills: style.kind === 'scarf' ? { upper: mat0() } : fills,
      bounds: { minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys) },
    }
  }
  function mat0() {
    const p = style.pieces[0]
    return p ? materialTile(effectiveMaterial(style, p), style.artworks).url : undefined
  }
}

function addMarkings(p: PatternPiece, lines: FlatGeom['lines'], dots: FlatGeom['dots'], yOff: number, maxY: number) {
  const minY = Math.min(...p.points.map((q) => q.y))
  const tr = (v: Vec) => ({ x: v.x, y: v.y - minY + yOff })
  for (const it of p.internals) {
    if (it.kind === 'dart' && it.pts.length === 3) {
      const [a, apex, b] = it.pts.map(tr)
      if (apex.y > maxY + 1) continue
      for (const s of [1, -1]) lines.push({ pts: [{ x: s * a.x, y: a.y }, { x: s * apex.x, y: apex.y }, { x: s * b.x, y: b.y }], w: 0.4 })
    } else if (it.kind === 'pleat' || it.kind === 'tuck') {
      const [a, b] = it.pts.map(tr)
      for (const s of [1, -1]) lines.push({ pts: [{ x: s * a.x, y: a.y }, { x: s * b.x, y: b.y }], w: 0.4 })
    } else if (it.kind === 'gather') {
      const [a, b] = it.pts.map(tr)
      for (const s of [1, -1]) for (let k = 0; k <= 8; k++) {
        const x = s * (a.x + (b.x - a.x) * (k / 8))
        lines.push({ pts: [{ x, y: a.y + 0.3 }, { x, y: a.y + 3 }], w: 0.25 })
      }
    } else if (it.kind === 'button') {
      const c = tr(it.pts[0])
      dots.push({ c, r: (it.size ?? 15) / 20 })
    }
  }
}

export function FlatSketch({
  style, view, className, filled = true, strokeScale = 1, children, decorative = false,
}: { style: Style; view: 'front' | 'back'; className?: string; filled?: boolean; strokeScale?: number; children?: React.ReactNode; decorative?: boolean }) {
  useTransient((s) => s.texVersion) // re-render when artwork images decode
  const g = useMemo(() => buildFlat(style, view), [style, view])
  const uid = useId().replace(/:/g, '')
  const pad = 6
  const { minX, maxX, minY, maxY } = g.bounds
  const vb = `${minX - pad} ${minY - pad} ${maxX - minX + pad * 2} ${maxY - minY + pad * 2}`
  const d = (pts: Vec[], close = true) => `M${pts.map((p) => `${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(' L')}${close ? ' Z' : ''}`
  const sw = 0.55 * strokeScale
  const fillFor = (k: 'upper' | 'lower' | 'sleeve') => (filled && g.fills[k] ? `url(#${uid}-${k})` : 'var(--surface, #fff)')
  return (
    <svg viewBox={vb} className={className} xmlns="http://www.w3.org/2000/svg" {...(decorative ? { 'aria-hidden': true } : { role: 'img', 'aria-label': `${style.name} — ${view}` })}>
      <defs>
        {(['upper', 'lower', 'sleeve'] as const).map((k) => g.fills[k] && (
          <pattern key={k} id={`${uid}-${k}`} patternUnits="userSpaceOnUse" width={12} height={12}>
            <image href={g.fills[k]} width={12} height={12} preserveAspectRatio="none" />
          </pattern>
        ))}
        {g.lowerFrom !== null && (
          <clipPath id={`${uid}-lower`}><rect x={-500} y={g.lowerFrom} width={1000} height={1000} /></clipPath>
        )}
      </defs>
      <g stroke="#1a1a1a" strokeLinejoin="round" strokeLinecap="round" fill="none">
        {g.sleeves.map((s, i) => <path key={`s${i}`} d={d(s)} fill={fillFor('sleeve')} strokeWidth={sw} />)}
        {g.outline.map((o, i) => <path key={`o${i}`} d={d(o)} fill={fillFor('upper')} strokeWidth={sw} />)}
        {g.lowerFrom !== null && g.outline.map((o, i) => <path key={`l${i}`} d={d(o)} fill={fillFor('lower')} clipPath={`url(#${uid}-lower)`} stroke="none" />)}
        {g.lowerFrom !== null && g.outline.map((o, i) => <path key={`lo${i}`} d={d(o)} strokeWidth={sw} />)}
        {g.lines.map((l, i) => <path key={`ln${i}`} d={d(l.pts, false)} strokeWidth={(l.w ?? 0.5) * strokeScale} strokeDasharray={l.dash} />)}
        {g.dots.map((c, i) => <circle key={`d${i}`} cx={c.c.x} cy={c.c.y} r={c.r} fill="#f7f4ee" strokeWidth={0.3 * strokeScale} />)}
      </g>
      {children}
    </svg>
  )
}
