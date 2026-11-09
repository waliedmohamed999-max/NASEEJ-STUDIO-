import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Columns3, Plus, Trash2, Check } from 'lucide-react'
import { fabricById } from '@/data/fabrics'
import { cn, uid } from '@/lib/utils'
import { useWorkspace, useActiveStyle } from '../store'
import { effectiveMaterial } from '../render'
import { FlatSketch } from '../panes/FlatSketch'
import { COLOR_CATALOGUE, nearestCatalogue } from '../model/colors'
import type { Style } from '../model/types'

/**
 * Colourways: named variants that override per-piece colour (and optionally fabric)
 * without duplicating the pattern. The active colourway drives 2D, 3D and flats.
 */
export default function ColorwaysPanel({ compare = false }: { compare?: boolean }) {
  const { t, i18n } = useTranslation('ws')
  const lang = (i18n.resolvedLanguage ?? 'en').split('-')[0]
  const style = useActiveStyle()
  const w = useWorkspace()
  const [mode, setMode] = useState<'edit' | 'compare'>(compare ? 'compare' : 'edit')
  const [selected, setSelected] = useState<string | null>(style?.activeColorway ?? style?.colorways[0]?.id ?? null)
  if (!style) return null
  const cw = style.colorways.find((c) => c.id === selected) ?? null

  const create = () => {
    const id = uid()
    const palette = ['#1a1a1a', '#b08d57', '#6e1e2e', '#22314a', '#6b6f4e', '#e9cfc8']
    const hex = palette[style.colorways.length % palette.length]
    w.edit('New colourway', (s) => ({
      ...s,
      colorways: [...s.colorways, {
        id, name: `${t('colorways.item')} ${s.colorways.length + 1}`,
        overrides: Object.fromEntries(s.pieces.filter((p) => p.layer === 'shell').map((p) => [p.id, { color: hex }])),
      }],
      activeColorway: id,
    }))
    setSelected(id)
  }
  const setOverride = (pid: string, color: string) => w.edit('Colourway colour', (s) => ({
    ...s, colorways: s.colorways.map((c) => (c.id === selected ? { ...c, overrides: { ...c.overrides, [pid]: { ...c.overrides[pid], color } } } : c)),
  }), `cw:${selected}:${pid}`)

  const variants: Array<{ id: string | null; name: string; style: Style }> = [
    { id: null, name: t('colorways.base'), style: { ...style, activeColorway: null } },
    ...style.colorways.map((c) => ({ id: c.id, name: c.name, style: { ...style, activeColorway: c.id } })),
  ]

  return (
    <div className="flex h-[74vh] flex-col">
      <div className="flex items-center gap-2 border-b border-border p-3">
        <button className="ws-btn" data-variant={mode === 'edit' ? 'solid' : undefined} onClick={() => setMode('edit')}>{t('colorways.title')}</button>
        <button className="ws-btn" data-variant={mode === 'compare' ? 'solid' : undefined} onClick={() => setMode('compare')}><Columns3 />{t('colorways.compare')}</button>
        <button className="ws-btn ms-auto" onClick={create}><Plus />{t('colorways.add')}</button>
      </div>

      {mode === 'compare' ? (
        <div className="grid min-h-0 flex-1 auto-cols-[minmax(13rem,1fr)] grid-flow-col gap-3 overflow-x-auto p-4 scroll-thin">
          {variants.map((v) => (
            <figure key={v.id ?? 'base'} className={cn('flex flex-col rounded-md border p-2', style.activeColorway === v.id ? 'border-accent' : 'border-border')}>
              <div className="grid min-h-0 flex-1 grid-cols-2 gap-1 bg-canvas p-2">
                <FlatSketch decorative style={v.style} view="front" className="h-full w-full" />
                <FlatSketch decorative style={v.style} view="back" className="h-full w-full" />
              </div>
              <figcaption className="mt-2 flex items-center justify-between gap-2">
                <span className="truncate font-medium">{v.name}</span>
                <button className="ws-btn !h-6 !px-2" onClick={() => w.edit('Activate colourway', (s) => ({ ...s, activeColorway: v.id }))}>
                  {style.activeColorway === v.id ? <Check /> : null}{t('misc.apply')}
                </button>
              </figcaption>
              <div className="mt-1 flex gap-1">
                {style.pieces.filter((p) => p.layer === 'shell').slice(0, 6).map((p) => {
                  const m = effectiveMaterial(style, p, v.id)
                  return <span key={p.id} title={p.name.en} className="size-4 rounded-sm border border-black/10" style={{ background: m.color ?? fabricById(m.fabricId)?.color }} />
                })}
              </div>
            </figure>
          ))}
        </div>
      ) : (
        <div className="grid min-h-0 flex-1 md:grid-cols-[14rem_1fr_16rem]">
          <ul className="space-y-1 overflow-y-auto border-e border-border p-3 scroll-thin">
            <li>
              <button className={cn('w-full rounded px-2 py-1.5 text-start', style.activeColorway === null && 'bg-muted font-medium')} onClick={() => { setSelected(null); w.edit('Activate colourway', (s) => ({ ...s, activeColorway: null })) }}>{t('colorways.base')}</button>
            </li>
            {style.colorways.map((c) => (
              <li key={c.id} className="flex items-center gap-1">
                <button className={cn('min-w-0 flex-1 truncate rounded px-2 py-1.5 text-start', selected === c.id && 'bg-muted font-medium')}
                  onClick={() => { setSelected(c.id); w.edit('Activate colourway', (s) => ({ ...s, activeColorway: c.id })) }}>{c.name}</button>
                <button className="ws-icon-btn !size-6" aria-label={t('misc.remove')} onClick={() => w.edit('Delete colourway', (s) => ({ ...s, colorways: s.colorways.filter((x) => x.id !== c.id), activeColorway: s.activeColorway === c.id ? null : s.activeColorway }))}><Trash2 className="size-3" /></button>
              </li>
            ))}
            {!style.colorways.length && <li className="pt-2 text-muted-foreground">{t('colorways.empty')}</li>}
          </ul>
          <div className="grid min-h-0 grid-cols-2 gap-2 bg-canvas p-4">
            <FlatSketch decorative style={{ ...style, activeColorway: selected }} view="front" className="h-full w-full" />
            <FlatSketch decorative style={{ ...style, activeColorway: selected }} view="back" className="h-full w-full" />
          </div>
          <div className="overflow-y-auto border-s border-border p-3 scroll-thin">
            {cw ? (
              <>
                <label className="ws-label">{t('colorways.name')}</label>
                <input className="ws-input mb-3" value={cw.name} onChange={(e) => w.edit('Rename colourway', (s) => ({ ...s, colorways: s.colorways.map((c) => (c.id === cw.id ? { ...c, name: e.target.value } : c)) }), `cwn:${cw.id}`)} />
                <ul className="space-y-2">
                  {style.pieces.filter((p) => p.layer !== 'interfacing').map((p) => {
                    const m = effectiveMaterial(style, p, cw.id)
                    const hex = m.color ?? fabricById(m.fabricId)?.color ?? '#cccccc'
                    const near = nearestCatalogue(hex)
                    return (
                      <li key={p.id} className="flex items-center gap-2">
                        <input type="color" value={hex} onChange={(e) => setOverride(p.id, e.target.value)} className="h-6 w-8 cursor-pointer rounded border border-border bg-transparent" aria-label={p.name.en} />
                        <div className="min-w-0">
                          <p className="truncate">{p.name[lang] ?? p.name.en}</p>
                          <p className="truncate text-[10px] text-muted-foreground">{near.code} {near.name[lang === 'ar' ? 'ar' : 'en']}</p>
                        </div>
                      </li>
                    )
                  })}
                </ul>
                <h4 className="ws-section-title mt-4">{t('insp.catalogue')}</h4>
                <p className="mb-1 text-[10px] text-muted-foreground">{t('insp.applyAll')}</p>
                <div className="grid grid-cols-8 gap-1">
                  {COLOR_CATALOGUE.map((c) => (
                    <button key={c.code + c.hex} title={`${c.code} · ${c.name.en}`} aria-label={c.name.en} className="aspect-square rounded-sm border border-black/10" style={{ background: c.hex }}
                      onClick={() => w.edit('Colourway colour', (s) => ({ ...s, colorways: s.colorways.map((x) => (x.id === cw.id ? { ...x, overrides: Object.fromEntries(s.pieces.filter((p) => p.layer === 'shell').map((p) => [p.id, { ...x.overrides[p.id], color: c.hex }])) } : x)) }))} />
                  ))}
                </div>
              </>
            ) : <p className="text-muted-foreground">{t('colorways.empty')}</p>}
          </div>
        </div>
      )}
    </div>
  )
}
