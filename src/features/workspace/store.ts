import { create } from 'zustand'
import { createJSONStorage, persist, type StateStorage } from 'zustand/middleware'
import { uid } from '@/lib/utils'
import type { SizeKey, Style, StyleVersion } from './model/types'
import { createStyle, migrateLegacyDesign } from './model/style'
import { templateById } from './model/templates'

/* ------------------------------------------------------------------ */
/* Debounced localStorage: autosave without serialising on every drag */
/* ------------------------------------------------------------------ */
let lastSaved = 0
const listeners = new Set<(t: number) => void>()
export const onAutosave = (fn: (t: number) => void) => { listeners.add(fn); return () => { listeners.delete(fn) } }

function debouncedStorage(ms = 600): StateStorage {
  const timers = new Map<string, ReturnType<typeof setTimeout>>()
  return {
    getItem: (k) => { try { return localStorage.getItem(k) } catch { return null } },
    setItem: (k, v) => {
      clearTimeout(timers.get(k))
      timers.set(k, setTimeout(() => {
        try { localStorage.setItem(k, v); lastSaved = Date.now(); listeners.forEach((l) => l(lastSaved)) }
        catch (e) { console.warn('[autosave] storage full or unavailable', e) }
      }, ms))
    },
    removeItem: (k) => { try { localStorage.removeItem(k) } catch { /* noop */ } },
  }
}
export const getLastSaved = () => lastSaved

/* ------------------------------------------------------------------ */
/* Types                                                              */
/* ------------------------------------------------------------------ */
export type Tool =
  | 'select' | 'point' | 'pen' | 'curve' | 'addPoint' | 'deletePoint' | 'cut' | 'mirror' | 'fold'
  | 'measure' | 'ruler' | 'dart' | 'pleat' | 'tuck' | 'gather' | 'notch' | 'grain' | 'buttonhole' | 'button' | 'sew' | 'trim' | 'hand'

export type PaneId = 'pattern' | '3d' | 'flat'
export type Pose = 'standing' | 'walking' | 'turning' | 'sitting'
export type Lighting = 'studio' | 'daylight' | 'runway' | 'atelier'
export type FitMap = 'off' | 'strain' | 'pressure' | 'ease'

export interface Selection {
  pieces: string[]
  point: { piece: string; point: string } | null
  edge: { piece: string; edge: string } | null
  internal: { piece: string; id: string } | null
  seam: string | null
}
const EMPTY_SEL: Selection = { pieces: [], point: null, edge: null, internal: null, seam: null }

interface HistoryEntry { label: string; style: Style; at: number }

interface WorkspaceState {
  styles: Record<string, Style>
  activeId: string | null
  versions: Record<string, StyleVersion[]>
  past: HistoryEntry[]
  future: HistoryEntry[]
  _key: string
  _at: number

  tool: Tool
  sel: Selection
  panes: PaneId[]
  paneSizes: number[]
  inspector: boolean
  inspectorWidth: number
  units: 'cm' | 'in'
  showSA: boolean
  showGrid: boolean
  snap: boolean
  nest: boolean
  viewSize: SizeKey
  pose: Pose
  lighting: Lighting
  fitMap: FitMap
  skin: string
  hair: 'none' | 'bun' | 'bob' | 'long'
  playing: boolean
  migrated: boolean

  // actions
  active: () => Style | null
  newStyle: (templateId?: string, name?: string) => string
  open: (id: string) => void
  remove: (id: string) => void
  duplicate: (id: string) => string
  /** Apply an edit with a history label. Same `key` within 700 ms coalesces (drags). */
  edit: (label: string, fn: (s: Style) => Style, key?: string) => void
  /** Edit any style (collections, status) without touching history */
  patchStyle: (id: string, patch: Partial<Style>) => void
  undo: () => void
  redo: () => void
  jump: (index: number) => void
  saveVersion: (label?: string) => void
  restoreVersion: (vid: string) => void
  deleteVersion: (vid: string) => void
  set: (patch: Partial<Pick<WorkspaceState,
    'tool' | 'sel' | 'panes' | 'paneSizes' | 'inspector' | 'inspectorWidth' | 'units' | 'showSA' | 'showGrid' | 'snap' | 'nest' |
    'viewSize' | 'pose' | 'lighting' | 'fitMap' | 'skin' | 'hair' | 'playing'>>) => void
  select: (patch: Partial<Selection>) => void
  clearSel: () => void
  importLegacy: (designs: Parameters<typeof migrateLegacyDesign>[0][]) => void
}

const HISTORY_LIMIT = 120

export const useWorkspace = create<WorkspaceState>()(
  persist(
    (set, get) => ({
      styles: {}, activeId: null, versions: {}, past: [], future: [], _key: '', _at: 0,
      tool: 'select', sel: EMPTY_SEL, panes: ['pattern', '3d', 'flat'], paneSizes: [0.42, 0.33, 0.25],
      inspector: true, inspectorWidth: 300, units: 'cm', showSA: true, showGrid: true, snap: true, nest: false,
      viewSize: 'M', pose: 'standing', lighting: 'studio', fitMap: 'off', skin: '#d9cdbf', hair: 'bun', playing: false, migrated: false,

      active: () => { const { styles, activeId } = get(); return activeId ? styles[activeId] ?? null : null },

      newStyle: (templateId, name) => {
        const s = createStyle(templateId ? templateById(templateId) : undefined, name)
        set((st) => ({ styles: { ...st.styles, [s.id]: s }, activeId: s.id, past: [], future: [], sel: EMPTY_SEL, viewSize: s.baseSize }))
        return s.id
      },
      open: (id) => set((st) => (st.styles[id] ? { activeId: id, past: [], future: [], sel: EMPTY_SEL, viewSize: st.styles[id].baseSize } : {})),
      remove: (id) => set((st) => {
        const styles = { ...st.styles }; delete styles[id]
        const versions = { ...st.versions }; delete versions[id]
        return { styles, versions, activeId: st.activeId === id ? Object.keys(styles)[0] ?? null : st.activeId }
      }),
      duplicate: (id) => {
        const src = get().styles[id]
        if (!src) return id
        const copy: Style = { ...structuredClone(src), id: uid(), name: `${src.name} (copy)`, createdAt: Date.now(), updatedAt: Date.now() }
        set((st) => ({ styles: { ...st.styles, [copy.id]: copy } }))
        return copy.id
      },

      edit: (label, fn, key) => {
        const st = get()
        const cur = st.activeId ? st.styles[st.activeId] : null
        if (!cur) return
        const next = { ...fn(cur), updatedAt: Date.now() }
        const now = Date.now()
        const coalesce = !!key && key === st._key && now - st._at < 700
        set({
          styles: { ...st.styles, [cur.id]: next },
          past: coalesce ? st.past : [...st.past, { label, style: cur, at: now }].slice(-HISTORY_LIMIT),
          future: [],
          _key: key ?? '', _at: now,
        })
      },
      patchStyle: (id, patch) => set((st) => (st.styles[id] ? { styles: { ...st.styles, [id]: { ...st.styles[id], ...patch, updatedAt: Date.now() } } } : {})),

      undo: () => {
        const st = get(); const cur = st.active()
        if (!cur || !st.past.length) return
        const prev = st.past[st.past.length - 1]
        set({ styles: { ...st.styles, [cur.id]: prev.style }, past: st.past.slice(0, -1), future: [{ ...prev, style: cur }, ...st.future], _key: '' })
      },
      redo: () => {
        const st = get(); const cur = st.active()
        if (!cur || !st.future.length) return
        const nxt = st.future[0]
        set({ styles: { ...st.styles, [cur.id]: nxt.style }, future: st.future.slice(1), past: [...st.past, { ...nxt, style: cur }], _key: '' })
      },
      /** index into past (0 = oldest); restores the state *before* that entry's edit */
      jump: (index) => {
        const st = get(); const cur = st.active()
        if (!cur || index < 0 || index >= st.past.length) return
        const target = st.past[index]
        const undone = st.past.slice(index)
        // rebuild future so redo walks forward again
        const states = [...undone.map((h) => h.style).slice(1), cur]
        const future = undone.map((h, i) => ({ ...h, style: states[i] }))
        set({ styles: { ...st.styles, [cur.id]: target.style }, past: st.past.slice(0, index), future: [...future, ...st.future], _key: '' })
      },

      saveVersion: (label) => {
        const cur = get().active()
        if (!cur) return
        const list = get().versions[cur.id] ?? []
        const v: StyleVersion = { id: uid(), label: label || `v${list.length + 1}`, at: Date.now(), style: structuredClone(cur) }
        set((st) => ({ versions: { ...st.versions, [cur.id]: [v, ...list].slice(0, 40) } }))
      },
      restoreVersion: (vid) => {
        const cur = get().active()
        if (!cur) return
        const v = (get().versions[cur.id] ?? []).find((x) => x.id === vid)
        if (v) get().edit(`Restore ${v.label}`, () => ({ ...structuredClone(v.style), id: cur.id }))
      },
      deleteVersion: (vid) => {
        const cur = get().active()
        if (!cur) return
        set((st) => ({ versions: { ...st.versions, [cur.id]: (st.versions[cur.id] ?? []).filter((x) => x.id !== vid) } }))
      },

      set: (patch) => set(patch),
      select: (patch) => set((st) => ({ sel: { ...st.sel, ...patch } })),
      clearSel: () => set({ sel: EMPTY_SEL }),
      importLegacy: (designs) => set((st) => {
        if (st.migrated) return {}
        const styles = { ...st.styles }
        for (const d of designs) { const s = migrateLegacyDesign(d); if (!styles[s.id]) styles[s.id] = s }
        return { styles, migrated: true }
      }),
    }),
    {
      name: 'naseej-workspace',
      storage: createJSONStorage(() => debouncedStorage()),
      partialize: (s) => ({
        styles: s.styles, activeId: s.activeId, versions: s.versions, panes: s.panes, paneSizes: s.paneSizes,
        inspector: s.inspector, inspectorWidth: s.inspectorWidth, units: s.units, showSA: s.showSA, showGrid: s.showGrid,
        snap: s.snap, lighting: s.lighting, skin: s.skin, hair: s.hair, migrated: s.migrated,
      }),
    },
  ),
)

export const useActiveStyle = () => useWorkspace((s) => (s.activeId ? s.styles[s.activeId] ?? null : null))

/* ------------------------------------------------------------------ */
/* Moodboard & collections                                            */
/* ------------------------------------------------------------------ */
export type MoodItem =
  | { id: string; type: 'image'; x: number; y: number; w: number; h: number; src: string }
  | { id: string; type: 'fabric'; x: number; y: number; w: number; h: number; fabricId: string; color: string | null }
  | { id: string; type: 'color'; x: number; y: number; w: number; h: number; color: string; code: string }
  | { id: string; type: 'note'; x: number; y: number; w: number; h: number; text: string }

export interface Collection { id: string; name: string; season: string; createdAt: number }

export const useBoards = create<{
  items: MoodItem[]
  collections: Collection[]
  addItem: (i: MoodItem) => void
  updateItem: (id: string, patch: Partial<MoodItem>) => void
  removeItem: (id: string) => void
  addCollection: (name: string, season: string) => string
  removeCollection: (id: string) => void
}>()(
  persist(
    (set) => ({
      items: [],
      collections: [],
      addItem: (i) => set((s) => ({ items: [...s.items, i] })),
      updateItem: (id, patch) => set((s) => ({ items: s.items.map((x) => (x.id === id ? ({ ...x, ...patch } as MoodItem) : x)) })),
      removeItem: (id) => set((s) => ({ items: s.items.filter((x) => x.id !== id) })),
      addCollection: (name, season) => {
        const c = { id: uid(), name, season, createdAt: Date.now() }
        set((s) => ({ collections: [...s.collections, c] }))
        return c.id
      },
      removeCollection: (id) => set((s) => ({ collections: s.collections.filter((c) => c.id !== id) })),
    }),
    { name: 'naseej-boards', storage: createJSONStorage(() => debouncedStorage()) },
  ),
)
