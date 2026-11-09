import { uid } from '@/lib/utils'
import { fabricById } from '@/data/fabrics'
import { LEGACY_TEMPLATE, TEMPLATES, templateById, type Template } from './templates'
import { draft } from './blocks'
import type { Material, Style } from './types'

export const defaultMaterial = (fabricId: string): Material => ({
  fabricId, color: null, print: 'none', printColor: null, artworkId: null, repeat: 'full', scale: 1, rotation: 0,
})

export function createStyle(template: Template = TEMPLATES[1], name?: string): Style {
  const fabricId = fabricById(template.fabric) ? template.fabric : 'fab-cotton-poplin'
  const { pieces, seams, meta } = draft(template.kind, template.p, defaultMaterial(fabricId))
  const now = Date.now()
  return {
    id: uid(), name: name ?? template.name.en, templateId: template.id, kind: template.kind, category: template.cat,
    sizeSystem: template.cat === 'modest' ? 'GCC' : 'EU', baseSize: 'M',
    pieces, seams, trims: [], colorways: [], activeColorway: null, artworks: [],
    notes: '', status: 'concept', annotations: [], collectionId: null, targetPrice: null, meta,
    createdAt: now, updatedAt: now,
  }
}

/** Convert a project from the original Design Studio (garment + per-piece layers). */
export function migrateLegacyDesign(d: {
  id: string; name: string; garmentId: string; updatedAt: number
  layers: Record<string, { fabricId: string; color: string | null; print: Material['print']; printColor: string | null; scale: number; rotation: number; visible: boolean }>
}): Style {
  const tpl = templateById(LEGACY_TEMPLATE[d.garmentId] ?? 'w-aline')!
  const s = createStyle(tpl, d.name || tpl.name.en)
  const layers = Object.values(d.layers)
  const main = layers[0]
  // Map the largest legacy layer onto body pieces and others by order.
  s.pieces = s.pieces.map((p, i) => {
    const l = layers[Math.min(i, layers.length - 1)] ?? main
    return l ? { ...p, material: { ...p.material, fabricId: l.fabricId, color: l.color, print: l.print, printColor: l.printColor, scale: l.scale, rotation: l.rotation } } : p
  })
  return { ...s, id: `legacy-${d.id}`, updatedAt: d.updatedAt }
}
