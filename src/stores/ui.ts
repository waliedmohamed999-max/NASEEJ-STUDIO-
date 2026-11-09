import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { uid } from '@/lib/utils'

/* ---------- Theme ---------- */

type Theme = 'light' | 'dark'
const initialTheme = (): Theme => (document.documentElement.classList.contains('dark') ? 'dark' : 'light')

export const useTheme = create<{ theme: Theme; toggle: () => void }>((set, get) => ({
  theme: initialTheme(),
  toggle: () => {
    const next = get().theme === 'dark' ? 'light' : 'dark'
    document.documentElement.classList.toggle('dark', next === 'dark')
    try { localStorage.setItem('naseej-theme', next) } catch { /* storage unavailable */ }
    set({ theme: next })
  },
}))

/* ---------- Toasts ---------- */

interface Toast { id: string; message: string }
export const useToasts = create<{ toasts: Toast[]; push: (m: string) => void; dismiss: (id: string) => void }>((set) => ({
  toasts: [],
  push: (message) => {
    const id = uid()
    set((s) => ({ toasts: [...s.toasts, { id, message }] }))
    setTimeout(() => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })), 2600)
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}))
export const toast = (m: string) => useToasts.getState().push(m)

/* ---------- Fabric compare ---------- */

export const MAX_COMPARE = 4
export const useCompare = create<{ ids: string[]; toggle: (id: string) => boolean; clear: () => void }>()(
  persist(
    (set, get) => ({
      ids: [],
      toggle: (id) => {
        const { ids } = get()
        if (ids.includes(id)) { set({ ids: ids.filter((x) => x !== id) }); return true }
        if (ids.length >= MAX_COMPARE) return false
        set({ ids: [...ids, id] })
        return true
      },
      clear: () => set({ ids: [] }),
    }),
    { name: 'naseej-compare' },
  ),
)
