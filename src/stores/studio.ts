import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { GarmentType, PrintPattern } from '@/types'
import { garmentById } from '@/data/garments'
import type { SizeCode } from '@/data/garments'
import { uid } from '@/lib/utils'

export interface LayerState {
  fabricId: string
  /** null → use the fabric's own colour */
  color: string | null
  print: PrintPattern
  printColor: string | null
  /** pattern scale multiplier, 0.25 – 3 */
  scale: number
  /** degrees */
  rotation: number
  visible: boolean
}

export interface Design {
  id: string
  name: string
  garmentId: GarmentType
  size: SizeCode
  layers: Record<string, LayerState>
  updatedAt: number
}

export const defaultLayer = (fabricId: string): LayerState => ({
  fabricId, color: null, print: 'none', printColor: null, scale: 1, rotation: 0, visible: true,
})

export function newDesign(garmentId: GarmentType = 'dress', name = ''): Design {
  const g = garmentById(garmentId)!
  return {
    id: uid(), name, garmentId, size: 'M', updatedAt: Date.now(),
    layers: Object.fromEntries(g.pieces.map((p) => [p.id, defaultLayer(g.defaultFabricId)])),
  }
}

interface StudioState {
  design: Design
  past: Design[]
  future: Design[]
  selectedPiece: string | null
  showDetails: boolean
  /** coalesces rapid edits (slider drags) into one history step */
  _lastKey: string
  _lastAt: number

  setGarment: (g: GarmentType) => void
  setSize: (s: SizeCode) => void
  rename: (name: string) => void
  updateLayer: (pieceId: string, patch: Partial<LayerState>) => void
  applyToAll: (pieceId: string) => void
  select: (pieceId: string | null) => void
  toggleDetails: () => void
  undo: () => void
  redo: () => void
  load: (d: Design) => void
  reset: () => void
}

const HISTORY_LIMIT = 80

export const useStudio = create<StudioState>()(
  persist(
    (set, get) => {
      /** Apply a change, recording history unless it continues the previous edit. */
      const commit = (next: Design, key: string) => {
        const { design, past, _lastKey, _lastAt } = get()
        const now = Date.now()
        const coalesce = key === _lastKey && now - _lastAt < 600
        set({
          design: { ...next, updatedAt: now },
          past: coalesce ? past : [...past, design].slice(-HISTORY_LIMIT),
          future: [],
          _lastKey: key,
          _lastAt: now,
        })
      }

      return {
        design: newDesign('dress'),
        past: [], future: [], selectedPiece: 'bodice', showDetails: true, _lastKey: '', _lastAt: 0,

        setGarment: (garmentId) => {
          const { design } = get()
          if (design.garmentId === garmentId) return
          const fresh = newDesign(garmentId, design.name)
          commit({ ...fresh, id: design.id, size: design.size }, 'garment')
          set({ selectedPiece: garmentById(garmentId)!.pieces[0].id })
        },
        setSize: (size) => commit({ ...get().design, size }, 'size'),
        rename: (name) => set((s) => ({ design: { ...s.design, name } })),
        updateLayer: (pieceId, patch) => {
          const { design } = get()
          const layer = design.layers[pieceId]
          if (!layer) return
          const key = `${pieceId}:${Object.keys(patch).sort().join(',')}`
          commit({ ...design, layers: { ...design.layers, [pieceId]: { ...layer, ...patch } } }, key)
        },
        applyToAll: (pieceId) => {
          const { design } = get()
          const src = design.layers[pieceId]
          if (!src) return
          const layers = Object.fromEntries(
            Object.entries(design.layers).map(([id, l]) => [id, { ...src, visible: l.visible }]),
          )
          commit({ ...design, layers }, `all:${Date.now()}`)
        },
        select: (selectedPiece) => set({ selectedPiece }),
        toggleDetails: () => set((s) => ({ showDetails: !s.showDetails })),
        undo: () => {
          const { past, design, future } = get()
          if (!past.length) return
          set({ design: past[past.length - 1], past: past.slice(0, -1), future: [design, ...future], _lastKey: '' })
        },
        redo: () => {
          const { past, design, future } = get()
          if (!future.length) return
          set({ design: future[0], future: future.slice(1), past: [...past, design], _lastKey: '' })
        },
        load: (d) => set({ design: d, past: [], future: [], selectedPiece: garmentById(d.garmentId)!.pieces[0].id, _lastKey: '' }),
        reset: () => set({ design: newDesign('dress'), past: [], future: [], selectedPiece: 'bodice', _lastKey: '' }),
      }
    },
    {
      name: 'naseej-studio',
      partialize: (s) => ({ design: s.design, showDetails: s.showDetails }),
    },
  ),
)

/* ---------- Saved projects (local; Supabase `projects` table when signed in) ---------- */

export const useProjects = create<{
  projects: Design[]
  save: (d: Design) => void
  remove: (id: string) => void
}>()(
  persist(
    (set) => ({
      projects: [],
      save: (d) => set((s) => ({ projects: [{ ...d, updatedAt: Date.now() }, ...s.projects.filter((p) => p.id !== d.id)] })),
      remove: (id) => set((s) => ({ projects: s.projects.filter((p) => p.id !== id) })),
    }),
    { name: 'naseej-projects' },
  ),
)
