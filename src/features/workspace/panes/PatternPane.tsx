import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { uid } from '@/lib/utils'
import { toast } from '@/stores/ui'
import { useWorkspace, useActiveStyle } from '../store'
import { useTransient, fmtLen, effectiveMaterial, materialTile, tileCm, SEAM_COLORS } from '../render'
import { updatePiece, updatePieces, mirrorPiece, unfoldPiece, withGroups } from '../actions'
import {
  pathD, polyD, flatten, seamAllowanceOutline, toLocal, toTable, pieceTransform, nearestOnOutline, splitEdge, bendEdge,
  cutPolygon, edgeLength, sewnLength, pointOnEdge, dist, sub, add, mul, bbox, pt, edgeControls,
} from '../model/geometry'
import { gradeDelta, gradePiece, isFullLength } from '../model/grading'
import { SIZES, type PatternPiece, type PPoint, type Style, type Vec } from '../model/types'
import { defaultMaterial } from '../model/style'
import { trimById } from '../model/trims'
import { MoodTray } from '../panels/Moodboard'

/* ------------------------------------------------------------------ */
/* View transform: screen px = (table cm) * k + t                      */
/* ------------------------------------------------------------------ */
interface View { k: number; tx: number; ty: number }
const PX_PER_CM_100 = 4 // 100 % zoom

type Drag =
  | { kind: 'pan'; start: Vec; view: View }
  | { kind: 'move'; start: Vec; orig: Record<string, Vec> }
  | { kind: 'marquee'; start: Vec; cur: Vec }
  | { kind: 'point'; piece: string; point: string; start: Vec; orig: PPoint }
  | { kind: 'handle'; piece: string; point: string; which: 'hin' | 'hout' }
  | { kind: 'curve'; piece: string; edge: number; orig: PPoint[] }
  | { kind: 'line'; tool: 'cut' | 'ruler' | 'grain' | 'gather' | 'dart'; start: Vec; cur: Vec; piece?: string; edge?: number }
  | { kind: 'pen'; }

export function PatternPane() {
  const { t, i18n } = useTranslation('ws')
  const style = useActiveStyle()
  const w = useWorkspace()
  const tr = useTransient()
  const svgRef = useRef<SVGSVGElement>(null)
  const [view, setView] = useState<View>({ k: PX_PER_CM_100, tx: 40, ty: 40 })
  const [drag, setDrag] = useState<Drag | null>(null)
  const [pen, setPen] = useState<PPoint[]>([])
  const [hoverEdge, setHoverEdge] = useState<{ piece: string; edge: number } | null>(null)
  const fitted = useRef<string | null>(null)
  const lang = (i18n.resolvedLanguage ?? 'en').split('-')[0]
  const editable = !!style && w.viewSize === style.baseSize

  // Pieces as displayed (graded when viewing another size)
  const pieces = useMemo(() => {
    if (!style) return []
    if (w.viewSize === style.baseSize) return style.pieces
    const d = gradeDelta(style.sizeSystem, style.baseSize, w.viewSize, isFullLength(style))
    return style.pieces.map((p) => gradePiece(p, d))
  }, [style, w.viewSize])

  /* ---------- fit to content ---------- */
  const fit = useCallback(() => {
    const svg = svgRef.current
    if (!svg || !pieces.length) return
    const r = svg.getBoundingClientRect()
    const pts = pieces.flatMap((p) => flatten(p.points, 4).map((v) => toTable(p, v)))
    const b = bbox(pts)
    const k = Math.min((r.width - 80) / (b.w + 10), (r.height - 80) / (b.h + 10))
    setView({ k, tx: (r.width - b.w * k) / 2 - b.minX * k, ty: (r.height - b.h * k) / 2 - b.minY * k })
  }, [pieces])
  useEffect(() => {
    if (style && fitted.current !== style.id) { fitted.current = style.id; requestAnimationFrame(fit) }
  }, [style, fit])
  useEffect(() => { tr.set({ zoom: view.k / PX_PER_CM_100 }) }, [view.k]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === '0') { e.preventDefault(); fit() }
      if (e.key === 'Escape') { setPen([]); setDrag(null); tr.set({ sewFrom: null }) }
      if (e.key === 'Enter' && pen.length >= 3) closePen()
    }
    window.addEventListener('keydown', on)
    return () => window.removeEventListener('keydown', on)
  })

  /* ---------- coordinates & hit testing ---------- */
  const toCm = (e: { clientX: number; clientY: number }): Vec => {
    const r = svgRef.current!.getBoundingClientRect()
    return { x: (e.clientX - r.left - view.tx) / view.k, y: (e.clientY - r.top - view.ty) / view.k }
  }
  const tol = 7 / view.k
  const snapV = (v: Vec): Vec => {
    if (!w.snap) return v
    const g = w.units === 'in' ? 2.54 / 8 : 0.5
    return { x: Math.round(v.x / g) * g, y: Math.round(v.y / g) * g }
  }
  const pieceAt = (p: Vec) => {
    for (let i = pieces.length - 1; i >= 0; i--) {
      const pc = pieces[i]
      if (!pc.visible) continue
      if (insidePoly(flatten(pc.points, 8), toLocal(pc, p))) return pc
    }
    return null
  }
  const pointAt = (p: Vec, only?: string) => {
    for (const pc of [...pieces].reverse()) {
      if (!pc.visible || (only && pc.id !== only)) continue
      const l = toLocal(pc, p)
      const q = pc.points.find((v) => dist(v, l) < tol)
      if (q) return { piece: pc, point: q }
    }
    return null
  }
  const edgeAt = (p: Vec) => {
    let best: { piece: PatternPiece; edge: number; t: number; local: Vec; d: number } | null = null
    for (const pc of pieces) {
      if (!pc.visible) continue
      const l = toLocal(pc, p)
      const n = nearestOnOutline(pc.points, l)
      if (n.d < tol * 1.3 && (!best || n.d < best.d)) best = { piece: pc, edge: n.edge, t: n.t, local: n.point, d: n.d }
    }
    return best
  }
  const handleAt = (p: Vec) => {
    const sp = w.sel.point
    if (!sp) return null
    const pc = pieces.find((x) => x.id === sp.piece)
    const q = pc?.points.find((x) => x.id === sp.point)
    if (!pc || !q) return null
    const l = toLocal(pc, p)
    if (q.hin && dist(q.hin, l) < tol) return 'hin' as const
    if (q.hout && dist(q.hout, l) < tol) return 'hout' as const
    return null
  }

  /* ---------- pointer handlers ---------- */
  const onDown = (e: React.PointerEvent) => {
    if (!style) return
    ;(e.target as Element).setPointerCapture?.(e.pointerId)
    const p = toCm(e)
    if (e.button === 1 || w.tool === 'hand' || (e.button === 0 && e.altKey && w.tool === 'select')) {
      setDrag({ kind: 'pan', start: { x: e.clientX, y: e.clientY }, view })
      return
    }
    if (e.button !== 0) return
    const ro = !editable && w.tool !== 'select' && w.tool !== 'measure' && w.tool !== 'ruler'
    if (ro) { toast(`${style.baseSize} ↔ ${w.viewSize}`); return }

    switch (w.tool) {
      case 'select': {
        const pc = pieceAt(p)
        if (!pc) {
          if (!e.shiftKey) w.clearSel()
          setDrag({ kind: 'marquee', start: p, cur: p })
          return
        }
        let ids = w.sel.pieces
        if (e.shiftKey) ids = ids.includes(pc.id) ? ids.filter((x) => x !== pc.id) : [...ids, pc.id]
        else if (!ids.includes(pc.id)) ids = [pc.id]
        ids = withGroups(ids)
        w.select({ pieces: ids, point: null, edge: null, internal: null, seam: null })
        if (!editable) return
        const orig: Record<string, Vec> = {}
        for (const x of style.pieces) if (ids.includes(x.id)) orig[x.id] = { x: x.x, y: x.y }
        setDrag({ kind: 'move', start: p, orig })
        return
      }
      case 'point': {
        const h = handleAt(p)
        if (h && w.sel.point) { setDrag({ kind: 'handle', piece: w.sel.point.piece, point: w.sel.point.point, which: h }); return }
        const hit = pointAt(p)
        if (hit) {
          if (e.altKey) { toggleSmooth(hit.piece, hit.point); return }
          w.select({ pieces: [hit.piece.id], point: { piece: hit.piece.id, point: hit.point.id }, edge: null, internal: null })
          setDrag({ kind: 'point', piece: hit.piece.id, point: hit.point.id, start: p, orig: hit.point })
          return
        }
        const eh = edgeAt(p)
        if (eh) { w.select({ pieces: [eh.piece.id], edge: { piece: eh.piece.id, edge: eh.piece.points[eh.edge].id }, point: null, internal: null }); return }
        const im = internalAt(p)
        if (im) { w.select({ pieces: [im.piece], internal: im, point: null, edge: null }); return }
        w.clearSel()
        return
      }
      case 'pen': {
        const sp = snapV(p)
        if (pen.length >= 3 && dist(sp, pen[0]) < tol * 1.5) { closePen(); return }
        setPen([...pen, pt(sp.x, sp.y)])
        setDrag({ kind: 'pen' })
        return
      }
      case 'curve': {
        const eh = edgeAt(p)
        if (eh) setDrag({ kind: 'curve', piece: eh.piece.id, edge: eh.edge, orig: eh.piece.points })
        return
      }
      case 'addPoint': {
        const eh = edgeAt(p)
        if (eh) updatePiece('Add point', eh.piece.id, (pc) => ({ ...pc, points: splitEdge(pc.points, eh.edge, eh.t) }))
        return
      }
      case 'deletePoint': {
        const hit = pointAt(p)
        if (hit) updatePiece('Delete point', hit.piece.id, (pc) => (pc.points.length > 3 ? { ...pc, points: pc.points.filter((q) => q.id !== hit.point.id) } : pc))
        return
      }
      case 'mirror': {
        const pc = pieceAt(p)
        if (pc) mirrorPiece(pc.id)
        return
      }
      case 'fold': {
        const eh = edgeAt(p)
        if (!eh) return
        const id = eh.piece.points[eh.edge].id
        if (eh.piece.foldEdge === id) unfoldPiece(eh.piece.id)
        else updatePiece('Set fold', eh.piece.id, (pc) => ({ ...pc, foldEdge: id }))
        return
      }
      case 'measure': {
        const hit = pointAt(p)
        const eh = edgeAt(p)
        if (hit && tr.measures.length && tr.measures[tr.measures.length - 1].label === '…') {
          const m = tr.measures[tr.measures.length - 1]
          const b = toTable(hit.piece, hit.point)
          tr.set({ measures: [...tr.measures.slice(0, -1), { ...m, b, label: fmtLen(dist(m.a, b), w.units) }] })
        } else if (hit) {
          const a = toTable(hit.piece, hit.point)
          tr.set({ measures: [...tr.measures.slice(-6), { id: uid(), a, b: a, label: '…' }] })
        } else if (eh) {
          const L = edgeLength(eh.piece.points, eh.edge)
          const [a, , , b] = edgeControls(eh.piece.points, eh.edge)
          tr.set({ measures: [...tr.measures.slice(-6), { id: uid(), a: toTable(eh.piece, a), b: toTable(eh.piece, b), label: fmtLen(L, w.units) }] })
          w.select({ pieces: [eh.piece.id], edge: { piece: eh.piece.id, edge: eh.piece.points[eh.edge].id }, point: null })
        } else tr.set({ measures: [] })
        return
      }
      case 'ruler': case 'cut': case 'grain': {
        setDrag({ kind: 'line', tool: w.tool, start: snapV(p), cur: snapV(p) })
        return
      }
      case 'gather': case 'dart': {
        const eh = edgeAt(p)
        if (eh) setDrag({ kind: 'line', tool: w.tool, start: toTable(eh.piece, eh.local), cur: p, piece: eh.piece.id, edge: eh.edge })
        return
      }
      case 'pleat': case 'tuck': case 'notch': {
        const eh = edgeAt(p)
        if (!eh) return
        const pc = eh.piece
        const edgeId = pc.points[eh.edge].id
        if (w.tool === 'notch') {
          updatePiece('Add notch', pc.id, (x) => ({ ...x, notches: [...x.notches, { id: uid(), edge: edgeId, t: eh.t }] }))
          return
        }
        const { tangent } = pointOnEdge(pc.points, eh.edge, eh.t)
        const inward = inwardNormal(pc, eh.local, tangent)
        const len = w.tool === 'pleat' ? 12 : 6
        updatePiece(w.tool === 'pleat' ? 'Add pleat' : 'Add tuck', pc.id, (x) => ({
          ...x, internals: [...x.internals, { id: uid(), kind: w.tool as 'pleat' | 'tuck', pts: [eh.local, add(eh.local, mul(inward, len))], size: w.tool === 'pleat' ? 2.5 : 1 }],
        }))
        return
      }
      case 'buttonhole': case 'button': {
        const pc = pieceAt(p)
        if (!pc) return
        const l = toLocal(pc, snapV(p))
        updatePiece(w.tool === 'button' ? 'Add button' : 'Add buttonhole', pc.id, (x) => ({
          ...x, internals: [...x.internals, w.tool === 'button'
            ? { id: uid(), kind: 'button', pts: [l], size: 18 }
            : { id: uid(), kind: 'buttonhole', pts: [l, { x: l.x + 1.8, y: l.y }] }],
        }))
        return
      }
      case 'trim': {
        const pc = pieceAt(p)
        if (!pc) return
        const trimId = tr.pendingTrim
        if (!trimId) { toast(t('hint.trim')); return }
        const l = toLocal(pc, p)
        w.edit('Place trim', (s) => ({ ...s, trims: [...s.trims, { id: uid(), trimId, qty: 1, color: null, piece: pc.id, at: l }] }))
        return
      }
      case 'sew': {
        const eh = edgeAt(p)
        if (!eh) { tr.set({ sewFrom: null }); return }
        const ref = { piece: eh.piece.id, edge: eh.piece.points[eh.edge].id }
        const from = tr.sewFrom
        if (!from) { tr.set({ sewFrom: ref }); return }
        if (from.piece === ref.piece && from.edge === ref.edge) { tr.set({ sewFrom: null }); return }
        const id = uid()
        w.edit('Sew edges', (s) => ({ ...s, seams: [...s.seams, { id, a: from, b: ref, stitch: '301' }] }))
        w.select({ seam: id, pieces: [], point: null, edge: null })
        tr.set({ sewFrom: null })
        toast(t('toast.sewn'))
        return
      }
    }
  }

  const onMove = (e: React.PointerEvent) => {
    const p = toCm(e)
    tr.set({ cursor: p })
    if (!drag) {
      if (['sew', 'fold', 'notch', 'pleat', 'tuck', 'addPoint', 'curve', 'measure', 'dart', 'gather'].includes(w.tool)) {
        const eh = edgeAt(p)
        setHoverEdge(eh ? { piece: eh.piece.id, edge: eh.edge } : null)
      } else if (hoverEdge) setHoverEdge(null)
      return
    }
    switch (drag.kind) {
      case 'pan':
        setView({ ...drag.view, tx: drag.view.tx + e.clientX - drag.start.x, ty: drag.view.ty + e.clientY - drag.start.y })
        return
      case 'move': {
        let d = sub(p, drag.start)
        if (w.snap) d = { x: Math.round(d.x * 2) / 2, y: Math.round(d.y * 2) / 2 }
        if (e.shiftKey) { if (Math.abs(d.x) > Math.abs(d.y)) d.y = 0; else d.x = 0 }
        updatePieces('Move', Object.keys(drag.orig), (pc) => ({ ...pc, x: drag.orig[pc.id].x + d.x, y: drag.orig[pc.id].y + d.y }), 'move')
        return
      }
      case 'marquee': setDrag({ ...drag, cur: p }); return
      case 'point': {
        const pc = style!.pieces.find((x) => x.id === drag.piece)!
        let l = toLocal(pc, p)
        if (w.snap) {
          const other = pc.points.find((q) => q.id !== drag.point && dist(q, l) < tol * 1.2)
          l = other ? { x: other.x, y: other.y } : toLocal(pc, snapV(p))
        }
        if (e.shiftKey) { const d0 = sub(l, drag.orig); if (Math.abs(d0.x) > Math.abs(d0.y)) l.y = drag.orig.y; else l.x = drag.orig.x }
        const d = sub(l, drag.orig)
        updatePiece('Move point', pc.id, (x) => ({
          ...x, points: x.points.map((q) => q.id === drag.point ? {
            ...q, x: l.x, y: l.y,
            hin: drag.orig.hin && add(drag.orig.hin, d), hout: drag.orig.hout && add(drag.orig.hout, d),
          } : q),
        }), `pt:${drag.point}`)
        return
      }
      case 'handle': {
        const pc = style!.pieces.find((x) => x.id === drag.piece)!
        const l = toLocal(pc, p)
        updatePiece('Edit curve handle', pc.id, (x) => ({
          ...x, points: x.points.map((q) => {
            if (q.id !== drag.point) return q
            const other = drag.which === 'hin' ? 'hout' : 'hin'
            const next = { ...q, [drag.which]: l }
            // smooth points keep handles colinear (Alt breaks symmetry)
            if (q[other] && !e.altKey) {
              const len = dist(q, q[other]!)
              const dir = sub(q, l)
              const n = Math.hypot(dir.x, dir.y) || 1
              next[other] = add(q, mul(dir, len / n))
            }
            return next
          }),
        }), `h:${drag.point}:${drag.which}`)
        return
      }
      case 'curve': {
        const pc = style!.pieces.find((x) => x.id === drag.piece)!
        updatePiece('Curve edge', pc.id, (x) => ({ ...x, points: bendEdge(drag.orig, drag.edge, toLocal(pc, p)) }), `curve:${drag.piece}:${drag.edge}`)
        return
      }
      case 'line': setDrag({ ...drag, cur: drag.tool === 'gather' || drag.tool === 'dart' ? p : snapV(p) }); return
      case 'pen': {
        if (!pen.length) return
        const last = pen[pen.length - 1]
        const hout = snapV(p)
        if (dist(hout, last) < tol) return
        const hin = sub(mul(last, 2), hout)
        setPen([...pen.slice(0, -1), { ...last, hout, hin }])
        return
      }
    }
  }

  const onUp = () => {
    if (!drag || !style) { setDrag(null); return }
    if (drag.kind === 'marquee') {
      const a = drag.start, b = drag.cur
      if (dist(a, b) > 0.5) {
        const box = { minX: Math.min(a.x, b.x), maxX: Math.max(a.x, b.x), minY: Math.min(a.y, b.y), maxY: Math.max(a.y, b.y) }
        const ids = pieces.filter((pc) => {
          const bb = bbox(flatten(pc.points, 4).map((v) => toTable(pc, v)))
          return bb.maxX > box.minX && bb.minX < box.maxX && bb.maxY > box.minY && bb.minY < box.maxY
        }).map((pc) => pc.id)
        w.select({ pieces: withGroups([...new Set([...w.sel.pieces, ...ids])]) })
      }
    }
    if (drag.kind === 'line') finishLine(drag)
    setDrag(null)
  }

  function finishLine(d: Extract<Drag, { kind: 'line' }>) {
    const { start: a, cur: b } = d
    if (d.tool === 'ruler') {
      if (dist(a, b) > 0.2) tr.set({ measures: [...tr.measures.slice(-6), { id: uid(), a, b, label: fmtLen(dist(a, b), w.units) }] })
      return
    }
    if (d.tool === 'cut') {
      if (dist(a, b) < 1) return
      const targets = (w.sel.pieces.length ? style!.pieces.filter((x) => w.sel.pieces.includes(x.id)) : style!.pieces).filter((x) => x.visible && !x.locked)
      let did = false
      w.edit('Cut', (s) => {
        const out: PatternPiece[] = []
        for (const pc of s.pieces) {
          if (!targets.find((x) => x.id === pc.id)) { out.push(pc); continue }
          const res = cutPolygon(pc.points, toLocal(pc, a), toLocal(pc, b))
          if (!res) { out.push(pc); continue }
          did = true
          res.forEach((pts, i) => out.push({
            ...pc, id: uid(), points: pts, foldEdge: null, edgeTags: {}, edgeSA: {}, notches: [], topstitch: [],
            name: { ...pc.name, en: `${pc.name.en} ${i ? 'B' : 'A'}`, ar: pc.name.ar ? `${pc.name.ar} ${i ? 'ب' : 'أ'}` : undefined },
            internals: pc.internals.filter((it) => insidePoly(pts, it.pts[0])), x: pc.x + (i ? 2 : 0), y: pc.y + (i ? 2 : 0),
          }))
        }
        return { ...s, pieces: out, seams: did ? s.seams.filter((x) => !targets.some((tp) => tp.id === x.a.piece || tp.id === x.b.piece)) : s.seams }
      })
      if (!did) toast(t('toast.cutFail'))
      return
    }
    if (d.tool === 'grain') {
      const pc = pieceAt(a) ?? (w.sel.pieces[0] ? style!.pieces.find((x) => x.id === w.sel.pieces[0]) : null)
      if (pc && dist(a, b) > 2) updatePiece('Set grainline', pc.id, (x) => ({ ...x, grain: [toLocal(x, a), toLocal(x, b)] }))
      return
    }
    const pc = style!.pieces.find((x) => x.id === d.piece)
    if (!pc) return
    if (d.tool === 'dart') {
      const la = toLocal(pc, a)
      const apex = toLocal(pc, b)
      if (dist(la, apex) < 2) return
      const n = nearestOnOutline(pc.points, la)
      const { tangent } = pointOnEdge(pc.points, n.edge, n.t)
      const wdt = 2
      updatePiece('Add dart', pc.id, (x) => ({
        ...x, internals: [...x.internals, { id: uid(), kind: 'dart', pts: [add(n.point, mul(tangent, -wdt / 2)), apex, add(n.point, mul(tangent, wdt / 2))] }],
      }))
    }
    if (d.tool === 'gather') {
      const la = nearestOnOutline(pc.points, toLocal(pc, a)).point
      const lb = nearestOnOutline(pc.points, toLocal(pc, b)).point
      if (dist(la, lb) > 1) updatePiece('Add gathers', pc.id, (x) => ({ ...x, internals: [...x.internals, { id: uid(), kind: 'gather', pts: [la, lb], size: 1.6 }] }))
    }
  }

  function closePen() {
    if (pen.length < 3) return
    const id = uid()
    w.edit('New piece (pen)', (s) => ({
      ...s,
      pieces: [...s.pieces, {
        id, name: { en: `Piece ${s.pieces.length + 1}`, ar: `قطعة ${s.pieces.length + 1}` }, role: 'other', points: pen,
        x: 0, y: 0, rotation: 0, flipped: false, foldEdge: null, cut: 1, seamAllowance: 1, edgeSA: {}, edgeTags: {}, topstitch: [],
        grain: (() => { const b = bbox(pen); return [{ x: b.cx, y: b.minY + b.h * 0.2 }, { x: b.cx, y: b.minY + b.h * 0.8 }] as [Vec, Vec] })(),
        notches: [], internals: [], marks: {}, layer: 'shell', material: s.pieces[0]?.material ?? defaultMaterial('fab-cotton-poplin'),
        gradeX: 0.1, gradeY: 0.5, visible: true, locked: false, group: null,
      }],
    }))
    setPen([])
    w.select({ pieces: [id] })
    w.set({ tool: 'select' })
  }

  function toggleSmooth(pc: PatternPiece, q: PPoint) {
    updatePiece('Toggle smooth', pc.id, (x) => {
      const i = x.points.findIndex((v) => v.id === q.id)
      const prev = x.points[(i - 1 + x.points.length) % x.points.length]
      const next = x.points[(i + 1) % x.points.length]
      const pts = x.points.map((v) => ({ ...v }))
      if (q.hin || q.hout) { pts[i].hin = null; pts[i].hout = null }
      else {
        const dir = sub(next, prev)
        const L = Math.hypot(dir.x, dir.y) || 1
        const u = mul(dir, 1 / L)
        pts[i].hin = sub(q, mul(u, dist(q, prev) / 3))
        pts[i].hout = add(q, mul(u, dist(q, next) / 3))
      }
      return { ...x, points: pts }
    })
  }

  function internalAt(p: Vec) {
    for (const pc of pieces) {
      const l = toLocal(pc, p)
      for (const it of pc.internals) {
        for (let i = 0; i < it.pts.length; i++) {
          const a = it.pts[i], b = it.pts[Math.min(i + 1, it.pts.length - 1)]
          if (segDist(l, a, b) < tol) return { piece: pc.id, id: it.id }
        }
      }
    }
    return null
  }

  const onWheel = (e: React.WheelEvent) => {
    const r = svgRef.current!.getBoundingClientRect()
    const mx = e.clientX - r.left, my = e.clientY - r.top
    const f = Math.exp(-e.deltaY * 0.0015)
    const k = Math.min(60, Math.max(0.4, view.k * f))
    setView({ k, tx: mx - ((mx - view.tx) * k) / view.k, ty: my - ((my - view.ty) * k) / view.k })
  }

  /* ---------- drag & drop from the moodboard ---------- */
  const onDrop = (e: React.DragEvent) => {
    const raw = e.dataTransfer.getData('application/x-naseej')
    if (!raw) return
    e.preventDefault()
    const data = JSON.parse(raw) as { type: 'fabric' | 'color'; fabricId?: string; color?: string | null }
    const pc = pieceAt(toCm(e))
    if (!pc) return
    updatePiece(data.type === 'fabric' ? 'Apply fabric' : 'Apply colour', pc.id, (x) => ({
      ...x, material: data.type === 'fabric' ? { ...x.material, fabricId: data.fabricId!, color: data.color ?? null } : { ...x.material, color: data.color ?? null },
    }))
  }

  if (!style) return null
  const sw = 1 / view.k // 1 screen px in cm
  const gridStep = w.units === 'in' ? 2.54 : 1
  const major = gridStep * 10
  const cursor = { select: 'default', hand: drag?.kind === 'pan' ? 'grabbing' : 'grab', pen: 'crosshair', cut: 'crosshair', ruler: 'crosshair', grain: 'crosshair' } as Record<string, string>

  return (
    <div className="relative h-full w-full bg-canvas" onDragOver={(e) => e.preventDefault()} onDrop={onDrop}>
      <svg
        ref={svgRef}
        className="h-full w-full touch-none select-none"
        style={{ cursor: cursor[w.tool] ?? 'crosshair' }}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerLeave={() => tr.set({ cursor: null })}
        onWheel={onWheel}
        onDoubleClick={() => { if (w.tool === 'pen' && pen.length >= 3) closePen() }}
        role="application"
        aria-label={t('pane.pattern')}
      >
        <defs>
          <pattern id="grid-minor" patternUnits="userSpaceOnUse" width={gridStep} height={gridStep}>
            <path d={`M${gridStep} 0 L0 0 0 ${gridStep}`} fill="none" stroke="var(--grid)" strokeWidth={sw} />
          </pattern>
          <pattern id="grid-major" patternUnits="userSpaceOnUse" width={major} height={major}>
            <rect width={major} height={major} fill="url(#grid-minor)" />
            <path d={`M${major} 0 L0 0 0 ${major}`} fill="none" stroke="var(--grid-strong)" strokeWidth={sw} />
          </pattern>
          {pieces.map((pc) => {
            const m = effectiveMaterial(style, pc)
            const tile = materialTile(m, style.artworks)
            const size = tileCm(m, style.artworks)
            return (
              <pattern key={pc.id} id={`fab-${pc.id}`} patternUnits="userSpaceOnUse" width={size} height={size * tile.aspect}
                patternTransform={`rotate(${m.rotation})`}>
                <image href={tile.url} width={size} height={size * tile.aspect} preserveAspectRatio="none" />
              </pattern>
            )
          })}
        </defs>
        <g transform={`translate(${view.tx} ${view.ty}) scale(${view.k})`}>
          {w.showGrid && <rect x={-2000} y={-2000} width={4000} height={4000} fill="url(#grid-major)" />}

          {/* nest view: every size outlined */}
          {w.nest && style.pieces.map((pc) => SIZES.map((sz, i) => {
            const g = gradePiece(pc, gradeDelta(style.sizeSystem, style.baseSize, sz, isFullLength(style)))
            return <path key={pc.id + sz} d={pathD(g.points)} transform={pieceTransform(g)} fill="none" vectorEffect="non-scaling-stroke"
              stroke={NEST[i]} strokeWidth={sz === style.baseSize ? 1.4 : 0.8} opacity={0.85} />
          }))}

          {pieces.map((pc) => (
            <PieceView key={pc.id} pc={pc} style={style} sw={sw} selected={w.sel.pieces.includes(pc.id)}
              showSA={w.showSA} showPoints={w.tool === 'point' || w.tool === 'deletePoint' || w.tool === 'addPoint'}
              selPoint={w.sel.point?.piece === pc.id ? w.sel.point.point : null}
              selEdge={w.sel.edge?.piece === pc.id ? w.sel.edge.edge : null}
              hoverEdge={hoverEdge?.piece === pc.id ? hoverEdge.edge : null}
              sewFrom={tr.sewFrom?.piece === pc.id ? tr.sewFrom.edge : null}
              selInternal={w.sel.internal?.piece === pc.id ? w.sel.internal.id : null}
              units={w.units} lang={lang} />
          ))}

          {/* sewing lines between linked edges */}
          {style.seams.map((s, i) => <SeamLink key={s.id} seam={s} pieces={pieces} i={i} sw={sw} selected={w.sel.seam === s.id}
            onSelect={() => w.select({ seam: s.id, pieces: [], point: null, edge: null })} units={w.units} />)}

          {/* pen preview */}
          {pen.length > 0 && (
            <g pointerEvents="none">
              <path d={pathD(pen, false)} fill="none" stroke="var(--accent)" strokeWidth={1.5 * sw} />
              {pen.map((q, i) => <circle key={q.id} cx={q.x} cy={q.y} r={(i === 0 ? 5 : 3.5) * sw} fill={i === 0 ? 'var(--accent)' : 'var(--surface)'} stroke="var(--accent)" strokeWidth={sw} />)}
            </g>
          )}

          {/* drag previews */}
          {drag?.kind === 'marquee' && (
            <rect x={Math.min(drag.start.x, drag.cur.x)} y={Math.min(drag.start.y, drag.cur.y)} width={Math.abs(drag.cur.x - drag.start.x)} height={Math.abs(drag.cur.y - drag.start.y)}
              fill="var(--accent)" fillOpacity={0.06} stroke="var(--accent)" strokeWidth={sw} strokeDasharray={`${4 * sw} ${3 * sw}`} />
          )}
          {drag?.kind === 'line' && (
            <g pointerEvents="none">
              <line x1={drag.start.x} y1={drag.start.y} x2={drag.cur.x} y2={drag.cur.y} stroke={drag.tool === 'cut' ? '#b03a2e' : 'var(--accent)'} strokeWidth={1.5 * sw} strokeDasharray={drag.tool === 'cut' ? `${6 * sw} ${4 * sw}` : undefined} />
              <Label at={lerpMid(drag.start, drag.cur)} sw={sw} text={fmtLen(dist(drag.start, drag.cur), w.units)} />
            </g>
          )}

          {/* measurements */}
          {tr.measures.map((m) => (
            <g key={m.id} pointerEvents="none">
              <line x1={m.a.x} y1={m.a.y} x2={m.b.x} y2={m.b.y} stroke="var(--accent-ink)" strokeWidth={sw} />
              <circle cx={m.a.x} cy={m.a.y} r={2.5 * sw} fill="var(--accent-ink)" />
              <circle cx={m.b.x} cy={m.b.y} r={2.5 * sw} fill="var(--accent-ink)" />
              <Label at={lerpMid(m.a, m.b)} sw={sw} text={m.label} />
            </g>
          ))}
        </g>
      </svg>
      <Rulers view={view} units={w.units} />
      <MoodTray />
      {!editable && (
        <div className="absolute bottom-3 start-1/2 -translate-x-1/2 rounded bg-foreground px-3 py-1 text-[11px] text-background rtl:translate-x-1/2">
          {w.viewSize} · {style.sizeSystem} — {t('insp.grading')} ({t('insp.base')}: {style.baseSize})
        </div>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Piece rendering                                                    */
/* ------------------------------------------------------------------ */
const NEST = ['#6b8fb0', '#5b9a8b', '#1a1a1a', '#b08d57', '#c07a4a', '#b0566b', '#7d5aa0']

function PieceView({
  pc, style, sw, selected, showSA, showPoints, selPoint, selEdge, hoverEdge, sewFrom, selInternal, units, lang,
}: {
  pc: PatternPiece; style: Style; sw: number; selected: boolean; showSA: boolean; showPoints: boolean
  selPoint: string | null; selEdge: string | null; hoverEdge: number | null; sewFrom: string | null; selInternal: string | null
  units: 'cm' | 'in'; lang: string
}) {
  const sa = useMemo(() => (showSA ? seamAllowanceOutline(pc) : []), [pc, showSA])
  if (!pc.visible) return null
  const b = bbox(pc.points)
  const isLining = pc.layer === 'lining' || pc.layer === 'interfacing'
  const m = effectiveMaterial(style, pc)
  const art = m.artworkId && m.repeat === 'placement' ? style.artworks.find((a) => a.id === m.artworkId) : null
  const label = pc.name[lang] ?? pc.name.en
  const fold = pc.foldEdge ? pc.points.findIndex((q) => q.id === pc.foldEdge) : -1
  return (
    <g transform={pieceTransform(pc)}>
      {sa.length > 0 && <path d={polyD(sa)} fill={isLining ? 'none' : 'var(--surface)'} fillOpacity={0.6} stroke="#1a1a1a" strokeOpacity={0.55} strokeWidth={sw} />}
      <path d={pathD(pc.points)} fill={isLining ? 'none' : `url(#fab-${pc.id})`} fillOpacity={0.92} />
      {art && <image href={art.dataUrl} x={b.cx - (art.widthCm * m.scale) / 2} y={b.minY + b.h * 0.25} width={art.widthCm * m.scale} opacity={0.95} />}
      <path d={pathD(pc.points)} fill="none" stroke={selected ? 'var(--accent)' : '#1a1a1a'} strokeWidth={(selected ? 2 : 1.1) * sw}
        strokeDasharray={isLining ? `${5 * sw} ${3 * sw}` : undefined} />
      {/* fold line */}
      {fold >= 0 && (() => {
        const [a, , , c] = edgeControls(pc.points, fold)
        const mid = lerpMid(a, c)
        return (
          <g>
            <line x1={a.x} y1={a.y} x2={c.x} y2={c.y} stroke="var(--accent-ink)" strokeWidth={2 * sw} strokeDasharray={`${10 * sw} ${3 * sw} ${2 * sw} ${3 * sw}`} />
            <text x={mid.x} y={mid.y} fontSize={9 * sw} fill="var(--accent-ink)" transform={`rotate(-90 ${mid.x} ${mid.y})`} textAnchor="middle" dy={-4 * sw}>FOLD</text>
          </g>
        )
      })()}
      {/* topstitching */}
      {pc.topstitch.map((eid) => {
        const i = pc.points.findIndex((q) => q.id === eid)
        if (i < 0) return null
        return <path key={eid} d={edgeD(pc.points, i)} fill="none" stroke="#1a1a1a" strokeOpacity={0.7} strokeWidth={sw} strokeDasharray={`${3 * sw} ${2 * sw}`} transform={insetTransform(pc, i)} />
      })}
      {/* selected / hovered / sew-pending edges */}
      {[selEdge && pc.points.findIndex((q) => q.id === selEdge), hoverEdge, sewFrom && pc.points.findIndex((q) => q.id === sewFrom)].map((i, k) =>
        typeof i === 'number' && i >= 0 ? <path key={k} d={edgeD(pc.points, i)} fill="none" stroke={k === 2 ? '#3f9a62' : 'var(--accent)'} strokeWidth={(k === 1 ? 3 : 4) * sw} strokeOpacity={k === 1 ? 0.55 : 1} /> : null)}
      {/* grainline */}
      <GrainArrow a={pc.grain[0]} b={pc.grain[1]} sw={sw} />
      {/* notches: short ticks through the seam allowance */}
      {pc.notches.map((n) => {
        const i = pc.points.findIndex((q) => q.id === n.edge)
        if (i < 0) return null
        const { p, tangent } = pointOnEdge(pc.points, i, n.t)
        const out = mul({ x: -inwardNormal(pc, p, tangent).x, y: -inwardNormal(pc, p, tangent).y }, pc.edgeSA[n.edge] ?? pc.seamAllowance)
        return <line key={n.id} x1={p.x} y1={p.y} x2={p.x + out.x} y2={p.y + out.y} stroke="#1a1a1a" strokeWidth={1.6 * sw} />
      })}
      {/* internals */}
      {pc.internals.map((it) => <InternalView key={it.id} it={it} sw={sw} selected={selInternal === it.id} />)}
      {/* trims placed on this piece */}
      {style.trims.filter((u) => u.piece === pc.id && u.at).map((u) => {
        const def = trimById(u.trimId)
        return <g key={u.id}><circle cx={u.at!.x} cy={u.at!.y} r={def?.cat === 'button' ? 0.8 : 1.2} fill={u.color ?? def?.color ?? '#b08d57'} stroke="#1a1a1a" strokeWidth={sw} /></g>
      })}
      {/* label */}
      <g pointerEvents="none" transform={`translate(${b.cx} ${b.cy})`}>
        <text textAnchor="middle" fontSize={Math.max(1.6, Math.min(3, b.w / 10))} fill="#1a1a1a" fontFamily="var(--font-sans)" style={{ fontWeight: 500 }}>{label}</text>
        <text textAnchor="middle" y={Math.min(3, b.w / 10) * 1.3} fontSize={Math.max(1.2, Math.min(2.2, b.w / 14))} fill="#6e6a63" fontFamily="var(--font-sans)">
          {pc.foldEdge ? 'CUT 1 ON FOLD' : `CUT ${pc.cut}`} · {style.baseSize} · SA {fmtLen(pc.seamAllowance, units)}
        </text>
      </g>
      {/* points & handles */}
      {(showPoints || selPoint) && pc.points.map((q) => {
        const sel = q.id === selPoint
        return (
          <g key={q.id}>
            {sel && q.hin && <><line x1={q.x} y1={q.y} x2={q.hin.x} y2={q.hin.y} stroke="var(--accent)" strokeWidth={sw} /><circle cx={q.hin.x} cy={q.hin.y} r={3 * sw} fill="var(--accent)" /></>}
            {sel && q.hout && <><line x1={q.x} y1={q.y} x2={q.hout.x} y2={q.hout.y} stroke="var(--accent)" strokeWidth={sw} /><circle cx={q.hout.x} cy={q.hout.y} r={3 * sw} fill="var(--accent)" /></>}
            {q.hin || q.hout
              ? <circle cx={q.x} cy={q.y} r={(sel ? 4.5 : 3.5) * sw} fill={sel ? 'var(--accent)' : 'var(--surface)'} stroke="#1a1a1a" strokeWidth={sw} />
              : <rect x={q.x - (sel ? 4.5 : 3.5) * sw} y={q.y - (sel ? 4.5 : 3.5) * sw} width={(sel ? 9 : 7) * sw} height={(sel ? 9 : 7) * sw} fill={sel ? 'var(--accent)' : 'var(--surface)'} stroke="#1a1a1a" strokeWidth={sw} />}
          </g>
        )
      })}
    </g>
  )
}

function InternalView({ it, sw, selected }: { it: PatternPiece['internals'][number]; sw: number; selected: boolean }) {
  const stroke = selected ? 'var(--accent)' : '#1a1a1a'
  const w = (selected ? 2 : 1.1) * sw
  const p = it.pts
  switch (it.kind) {
    case 'dart': return <path d={`M${p[0].x} ${p[0].y} L${p[1].x} ${p[1].y} L${p[2].x} ${p[2].y}`} fill="none" stroke={stroke} strokeWidth={w} />
    case 'pleat': case 'tuck': {
      const d = sub(p[1], p[0])
      const L = Math.hypot(d.x, d.y) || 1
      const n = { x: -d.y / L, y: d.x / L }
      const off = mul(n, it.size ?? 2)
      return (
        <g>
          <line x1={p[0].x} y1={p[0].y} x2={p[1].x} y2={p[1].y} stroke={stroke} strokeWidth={w} strokeDasharray={it.kind === 'tuck' ? `${2 * sw} ${2 * sw}` : undefined} />
          <line x1={p[0].x + off.x} y1={p[0].y + off.y} x2={p[1].x + off.x} y2={p[1].y + off.y} stroke={stroke} strokeWidth={w} strokeDasharray={`${4 * sw} ${2 * sw}`} />
          <path d={`M${p[0].x + off.x * 0.2} ${p[0].y + off.y * 0.2 + 2} l${off.x * 0.6} 0`} stroke={stroke} strokeWidth={w} markerEnd="" />
        </g>
      )
    }
    case 'gather': {
      const segs = 14
      let d = `M${p[0].x} ${p[0].y}`
      for (let i = 1; i <= segs; i++) {
        const q = { x: p[0].x + (p[1].x - p[0].x) * (i / segs), y: p[0].y + (p[1].y - p[0].y) * (i / segs) }
        d += ` Q${q.x - (p[1].x - p[0].x) / segs / 2} ${q.y + 1.2 * (i % 2 ? 1 : -1)} ${q.x} ${q.y}`
      }
      return <path d={d} fill="none" stroke={stroke} strokeWidth={w} />
    }
    case 'buttonhole': return (
      <g>
        <line x1={p[0].x} y1={p[0].y} x2={p[1].x} y2={p[1].y} stroke={stroke} strokeWidth={w * 1.4} />
        <line x1={p[0].x} y1={p[0].y - 0.3} x2={p[0].x} y2={p[0].y + 0.3} stroke={stroke} strokeWidth={w} />
        <line x1={p[1].x} y1={p[1].y - 0.3} x2={p[1].x} y2={p[1].y + 0.3} stroke={stroke} strokeWidth={w} />
      </g>
    )
    case 'button': return <circle cx={p[0].x} cy={p[0].y} r={(it.size ?? 18) / 20} fill="none" stroke={stroke} strokeWidth={w} />
    default: return <polyline points={p.map((v) => `${v.x},${v.y}`).join(' ')} fill="none" stroke={stroke} strokeWidth={w} />
  }
}

function GrainArrow({ a, b, sw }: { a: Vec; b: Vec; sw: number }) {
  const d = sub(b, a)
  const L = Math.hypot(d.x, d.y) || 1
  const u = mul(d, 1 / L), n = { x: -u.y, y: u.x }
  const head = (p: Vec, dir: number) => {
    const back = add(p, mul(u, -dir * 1.6))
    return `M${back.x + n.x * 0.7} ${back.y + n.y * 0.7} L${p.x} ${p.y} L${back.x - n.x * 0.7} ${back.y - n.y * 0.7}`
  }
  return (
    <g pointerEvents="none" stroke="#1a1a1a" strokeOpacity={0.7} fill="none">
      <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} strokeWidth={sw} />
      <path d={head(b, 1)} strokeWidth={sw} />
      <path d={head(a, -1)} strokeWidth={sw} />
    </g>
  )
}

function SeamLink({ seam, pieces, i, sw, selected, onSelect, units }: {
  seam: Style['seams'][number]; pieces: PatternPiece[]; i: number; sw: number; selected: boolean; onSelect: () => void; units: 'cm' | 'in'
}) {
  const end = (r: { piece: string; edge: string }) => {
    const pc = pieces.find((p) => p.id === r.piece)
    if (!pc) return null
    const idx = pc.points.findIndex((q) => q.id === r.edge)
    if (idx < 0) return null
    const { p } = pointOnEdge(pc.points, idx, 0.5)
    return { pc, idx, mid: toTable(pc, p), len: sewnLength(pc, idx) }
  }
  const a = end(seam.a), b = end(seam.b)
  if (!a || !b) return null
  const color = SEAM_COLORS[i % SEAM_COLORS.length]
  const mismatch = Math.abs(a.len - b.len)
  const ok = mismatch < 0.3
  return (
    <g>
      {[a, b].map((e, k) => (
        <path key={k} d={edgeD(e.pc.points, e.idx)} transform={pieceTransform(e.pc)} fill="none" stroke={color} strokeWidth={(selected ? 4 : 2.6) * sw} strokeOpacity={0.85} />
      ))}
      <line x1={a.mid.x} y1={a.mid.y} x2={b.mid.x} y2={b.mid.y} stroke={color} strokeWidth={(selected ? 1.6 : 0.9) * sw} strokeDasharray={`${4 * sw} ${3 * sw}`} onClick={onSelect} style={{ cursor: 'pointer' }} />
      <Label at={lerpMid(a.mid, b.mid)} sw={sw} text={`${i + 1}${ok ? '' : ` Δ${fmtLen(mismatch, units)}`}`} color={ok ? color : '#b03a2e'} onClick={onSelect} />
    </g>
  )
}

function Label({ at, sw, text, color, onClick }: { at: Vec; sw: number; text: string; color?: string; onClick?: () => void }) {
  const fs = 10 * sw
  const w = text.length * fs * 0.58 + 6 * sw
  return (
    <g transform={`translate(${at.x} ${at.y})`} onClick={onClick} style={onClick ? { cursor: 'pointer' } : undefined}>
      <rect x={-w / 2} y={-fs * 0.85} width={w} height={fs * 1.45} rx={2 * sw} fill="var(--surface)" stroke={color ?? 'var(--accent-ink)'} strokeWidth={sw} />
      <text textAnchor="middle" fontSize={fs} y={fs * 0.25} fill={color ?? 'var(--accent-ink)'} fontFamily="var(--font-sans)" style={{ fontVariantNumeric: 'tabular-nums' }}>{text}</text>
    </g>
  )
}

/* Rulers along the top and start edges, in cm or inches */
function Rulers({ view, units }: { view: View; units: 'cm' | 'in' }) {
  const ref = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ w: 0, h: 0 })
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => setSize({ w: e.contentRect.width, h: e.contentRect.height }))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  const unit = units === 'in' ? 2.54 : 1
  const pxPerUnit = view.k * unit
  const step = [1, 2, 5, 10, 20, 50, 100].find((s) => s * pxPerUnit > 48) ?? 100
  const ticks = (len: number, offset: number) => {
    const start = Math.floor(-offset / pxPerUnit / step) * step
    const out: number[] = []
    for (let v = start; v * pxPerUnit + offset < len; v += step) out.push(v)
    return out
  }
  return (
    <div ref={ref} className="pointer-events-none absolute inset-0" aria-hidden>
      <svg className="absolute inset-x-0 top-0 h-4 w-full border-b border-border bg-surface/90" style={{ direction: 'ltr' }}>
        {ticks(size.w, view.tx).map((v) => (
          <g key={v} transform={`translate(${v * pxPerUnit + view.tx} 0)`}>
            <line y1={8} y2={16} stroke="var(--muted-foreground)" strokeWidth={0.6} />
            <text x={2} y={9} fontSize={8} fill="var(--muted-foreground)" style={{ fontVariantNumeric: 'tabular-nums' }}>{v}</text>
          </g>
        ))}
      </svg>
      <svg className="absolute bottom-0 start-0 top-4 w-4 border-e border-border bg-surface/90" style={{ direction: 'ltr' }}>
        {ticks(size.h, view.ty - 16).map((v) => (
          <g key={v} transform={`translate(0 ${v * pxPerUnit + view.ty - 16})`}>
            <line x1={8} x2={16} stroke="var(--muted-foreground)" strokeWidth={0.6} />
            <text x={1} y={10} fontSize={7} fill="var(--muted-foreground)" style={{ fontVariantNumeric: 'tabular-nums' }}>{v}</text>
          </g>
        ))}
      </svg>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* helpers                                                            */
/* ------------------------------------------------------------------ */
const lerpMid = (a: Vec, b: Vec) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 })

function edgeD(points: PPoint[], i: number) {
  const [a, c1, c2, b] = edgeControls(points, i)
  const curved = points[i].hout || points[(i + 1) % points.length].hin
  return curved ? `M${a.x} ${a.y} C${c1.x} ${c1.y} ${c2.x} ${c2.y} ${b.x} ${b.y}` : `M${a.x} ${a.y} L${b.x} ${b.y}`
}

/** Approximate inset for topstitch lines: shift the edge 0.6 cm towards the piece centre. */
function insetTransform(pc: PatternPiece, i: number) {
  const { p, tangent } = pointOnEdge(pc.points, i, 0.5)
  const n = inwardNormal(pc, p, tangent)
  return `translate(${n.x * 0.6} ${n.y * 0.6})`
}

function inwardNormal(pc: PatternPiece, p: Vec, tangent: Vec): Vec {
  const n = { x: -tangent.y, y: tangent.x }
  const probe = add(p, mul(n, 0.3))
  return insidePoly(flatten(pc.points, 8), probe) ? n : { x: -n.x, y: -n.y }
}

export function insidePoly(poly: Vec[], p: Vec) {
  let inside = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i], b = poly[j]
    if ((a.y > p.y) !== (b.y > p.y) && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) inside = !inside
  }
  return inside
}

function segDist(p: Vec, a: Vec, b: Vec) {
  const ab = sub(b, a)
  const L2 = ab.x * ab.x + ab.y * ab.y
  if (L2 < 1e-9) return dist(p, a)
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * ab.x + (p.y - a.y) * ab.y) / L2))
  return dist(p, add(a, mul(ab, t)))
}
