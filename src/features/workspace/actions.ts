import { create } from 'zustand'
import { uid } from '@/lib/utils'
import { useWorkspace } from './store'
import { mirrorPoints, unfold } from './model/geometry'
import type { PatternPiece } from './model/types'

export type DialogId =
  | 'gallery' | 'open' | 'versions' | 'shortcuts' | 'trims' | 'colorways' | 'colorwayCompare' | 'moodboard' | 'collection' | 'history'
export const useWsUi = create<{ dialog: DialogId | null; open: (d: DialogId) => void; close: () => void }>((set) => ({
  dialog: null,
  open: (dialog) => set({ dialog }),
  close: () => set({ dialog: null }),
}))

const ws = () => useWorkspace.getState()
const selected = () => ws().sel.pieces

export function updatePieces(label: string, ids: string[], fn: (p: PatternPiece) => PatternPiece, key?: string) {
  if (!ids.length) return
  ws().edit(label, (s) => ({ ...s, pieces: s.pieces.map((p) => (ids.includes(p.id) && !p.locked ? fn(p) : p)) }), key)
}

export const updatePiece = (label: string, id: string, fn: (p: PatternPiece) => PatternPiece, key?: string) =>
  updatePieces(label, [id], fn, key)

export function deleteSelection() {
  const { sel } = ws()
  if (sel.internal) {
    const { piece, id } = sel.internal
    updatePiece('Delete marking', piece, (p) => ({ ...p, internals: p.internals.filter((i) => i.id !== id) }))
    ws().select({ internal: null })
    return
  }
  if (sel.seam) {
    ws().edit('Delete seam', (s) => ({ ...s, seams: s.seams.filter((x) => x.id !== sel.seam) }))
    ws().select({ seam: null })
    return
  }
  if (sel.point) {
    const { piece, point } = sel.point
    updatePiece('Delete point', piece, (p) => (p.points.length > 3 ? { ...p, points: p.points.filter((q) => q.id !== point) } : p))
    ws().select({ point: null })
    return
  }
  const ids = selected()
  if (!ids.length) return
  ws().edit('Delete pieces', (s) => ({
    ...s,
    pieces: s.pieces.filter((p) => !ids.includes(p.id) || p.locked),
    seams: s.seams.filter((x) => !ids.includes(x.a.piece) && !ids.includes(x.b.piece)),
  }))
  ws().clearSel()
}

export function duplicateSelection() {
  const ids = selected()
  if (!ids.length) return
  const newIds: string[] = []
  ws().edit('Duplicate', (s) => {
    const copies = s.pieces.filter((p) => ids.includes(p.id)).map((p) => {
      const id = uid()
      newIds.push(id)
      return { ...structuredClone(p), id, x: p.x + 4, y: p.y + 4, name: { ...p.name, en: `${p.name.en} copy` } }
    })
    return { ...s, pieces: [...s.pieces, ...copies] }
  })
  ws().select({ pieces: newIds })
}

export function selectAll() {
  const s = ws().active()
  if (s) ws().select({ pieces: s.pieces.map((p) => p.id), point: null, edge: null })
}

export function groupSelection() {
  const ids = selected()
  if (ids.length < 2) return
  const g = uid()
  updatePieces('Group', ids, (p) => ({ ...p, group: g }))
}
export function ungroupSelection() {
  updatePieces('Ungroup', selected(), (p) => ({ ...p, group: null }))
}

export function rotateSelection(deg = 90) {
  updatePieces('Rotate', selected(), (p) => ({ ...p, rotation: (((p.rotation + deg) % 360) + 360) % 360 }))
}

export function nudgeSelection(dx: number, dy: number) {
  updatePieces('Nudge', selected(), (p) => ({ ...p, x: p.x + dx, y: p.y + dy }), 'nudge')
}

export function mirrorPiece(id: string) {
  updatePiece('Mirror', id, (p) => {
    const xs = p.points.map((q) => q.x)
    const c = Math.min(...xs) + Math.max(...xs)
    return {
      ...p,
      points: mirrorPoints(p.points),
      internals: p.internals.map((it) => ({ ...it, pts: it.pts.map((v) => ({ x: c - v.x, y: v.y })) })),
      grain: [{ x: c - p.grain[0].x, y: p.grain[0].y }, { x: c - p.grain[1].x, y: p.grain[1].y }],
    }
  })
}

export function unfoldPiece(id: string) {
  updatePiece('Unfold', id, (p) => {
    const u = unfold(p)
    return u ? { ...p, ...u, cut: 1 } : p
  })
}

/** Expand a selection to whole groups. */
export function withGroups(ids: string[]) {
  const s = ws().active()
  if (!s) return ids
  const groups = new Set(s.pieces.filter((p) => ids.includes(p.id) && p.group).map((p) => p.group))
  return [...new Set([...ids, ...s.pieces.filter((p) => p.group && groups.has(p.group)).map((p) => p.id)])]
}
