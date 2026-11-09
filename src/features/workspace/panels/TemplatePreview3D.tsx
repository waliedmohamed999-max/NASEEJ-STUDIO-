import { useMemo } from 'react'
import AvatarScene from '@/features/tryon/AvatarScene'
import { fabricById } from '@/data/fabrics'
import { defaultBody } from '@/stores/tryon'
import type { GarmentTemplate } from '@/types'
import { deriveSpec } from '../model/spec'
import type { Style } from '../model/types'
import { BODY } from '../model/grading'
import { effectiveMaterial } from '../render'
import { FlatSketch } from '../panes/FlatSketch'

/**
 * Lightweight rotating preview for the gallery: reuses the try-on avatar with a
 * garment profile derived from the template's measured pattern (no simulation).
 */
export default function TemplatePreview3D({ style }: { style: Style }) {
  const spec = useMemo(() => deriveSpec(style), [style])
  const upper = style.pieces.find((p) => p.id === spec.materials.upper) ?? style.pieces[0]
  const mat = effectiveMaterial(style, upper)
  const fabric = fabricById(mat.fabricId) ?? fabricById('fab-cotton-poplin')!
  const g = useMemo(() => profileFromSpec(style, spec), [style, spec])
  if (style.kind === 'scarf') return <div className="absolute inset-0 p-8"><FlatSketch style={style} view="front" className="h-full w-full" /></div>
  return (
    <div className="absolute inset-0">
      <AvatarScene body={defaultBody} garment={g} fabric={fabric} color={mat.color} size="M" autoRotate compact />
    </div>
  )
}

/** Map measured pattern girths onto the try-on garment profile. */
function profileFromSpec(style: Style, spec: ReturnType<typeof deriveSpec>): GarmentTemplate {
  const b = BODY.M
  const bust = spec.body?.bust ?? b.bust + 8
  const waist = spec.skirt?.waist ?? spec.trousers?.waist ?? spec.body?.waist ?? b.waist + 8
  const hip = spec.skirt?.hip ?? spec.trousers?.hip ?? spec.body?.hip ?? b.hip + 8
  const hem = spec.skirt?.hem ?? spec.body?.hem ?? hip
  const total = spec.skirt ? (spec.body ? 42 : 0) + spec.skirt.length : spec.body?.length ?? 60
  const id = style.kind === 'trousers' ? 'trousers' : style.kind === 'skirt' ? 'skirt' : style.kind === 'top' ? 'shirt' : 'dress'
  return {
    id, name: { en: style.name }, pieces: [], baseConsumptionM: 1,
    ease: { bust: bust - 90, waist: waist - 72, hips: hip - 96 },
    covers: style.kind === 'trousers' || style.kind === 'skirt' ? ['waist', 'hips'] : ['bust', 'waist', 'hips'],
    measurements: [], defaultFabricId: '',
    flare: Math.min(1, Math.max(0, (hem - hip) / Math.max(40, total * 2))),
    length: total / 168,
    sleeves: spec.sleeve ? (spec.sleeve.length > 30 || spec.sleeve.cutOn ? 'long' : 'short') : 'none',
  } as GarmentTemplate
}
