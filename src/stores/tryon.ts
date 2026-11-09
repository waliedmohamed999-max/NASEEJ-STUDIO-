import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Body, GarmentType } from '@/types'
import type { SizeCode } from '@/data/garments'
import { uid } from '@/lib/utils'

export interface Look {
  id: string
  name: string
  garmentId: GarmentType
  fabricId: string
  color: string | null
  size: SizeCode
  createdAt: number
}

interface TryOnState {
  body: Body
  garmentId: GarmentType
  fabricId: string
  color: string | null
  size: SizeCode
  /** user picked a size manually (otherwise follow the recommendation) */
  sizeLocked: boolean
  heatmap: boolean
  autoRotate: boolean
  looks: Look[]
  setBody: (patch: Partial<Body>) => void
  set: (patch: Partial<Pick<TryOnState, 'garmentId' | 'fabricId' | 'color' | 'size' | 'sizeLocked' | 'heatmap' | 'autoRotate'>>) => void
  saveLook: (name: string) => Look
  removeLook: (id: string) => void
  applyLook: (l: Look) => void
}

export const defaultBody: Body = { heightCm: 168, weightKg: 62, bustCm: 90, waistCm: 72, hipsCm: 97, shape: 'hourglass' }

export const useTryOn = create<TryOnState>()(
  persist(
    (set, get) => ({
      body: defaultBody,
      garmentId: 'dress',
      fabricId: 'fab-viscose-crepe',
      color: null,
      size: 'M',
      sizeLocked: false,
      heatmap: false,
      autoRotate: true,
      looks: [],
      setBody: (patch) => set((s) => ({ body: { ...s.body, ...patch } })),
      set: (patch) => set(patch),
      saveLook: (name) => {
        const { garmentId, fabricId, color, size } = get()
        const look: Look = { id: uid(), name, garmentId, fabricId, color, size, createdAt: Date.now() }
        set((s) => ({ looks: [look, ...s.looks].slice(0, 30) }))
        return look
      },
      removeLook: (id) => set((s) => ({ looks: s.looks.filter((l) => l.id !== id) })),
      applyLook: (l) => set({ garmentId: l.garmentId, fabricId: l.fabricId, color: l.color, size: l.size, sizeLocked: true }),
    }),
    { name: 'naseej-tryon', partialize: ({ looks, body, garmentId, fabricId, color, size, sizeLocked, heatmap }) => ({ looks, body, garmentId, fabricId, color, size, sizeLocked, heatmap }) },
  ),
)
