import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ImagePlus, Palette, StickyNote, Layers, X } from 'lucide-react'
import { useFabrics } from '@/services/data/hooks'
import { fabricById } from '@/data/fabrics'
import { uid } from '@/lib/utils'
import { FabricSwatch } from '@/features/fabrics/fabricUi'
import { useBoards, type MoodItem } from '../store'
import { COLOR_CATALOGUE } from '../model/colors'

/** Free-form moodboard. Swatches and colour chips also appear in the pattern pane's tray for drag-and-drop. */
export default function Moodboard() {
  const { t, i18n } = useTranslation('ws')
  const lang = (i18n.resolvedLanguage ?? 'en').split('-')[0] === 'ar' ? 'ar' : 'en'
  const { items, addItem, updateItem, removeItem } = useBoards()
  const fabrics = useFabrics()
  const fileRef = useRef<HTMLInputElement>(null)
  const [picker, setPicker] = useState<'fabric' | 'color' | null>(null)
  const boardRef = useRef<HTMLDivElement>(null)
  const nextPos = () => ({ x: 24 + (items.length % 6) * 150, y: 24 + Math.floor(items.length / 6) * 150 })

  const startDrag = (e: React.PointerEvent, it: MoodItem, mode: 'move' | 'resize') => {
    e.preventDefault(); e.stopPropagation()
    const x0 = e.clientX, y0 = e.clientY
    const o = { x: it.x, y: it.y, w: it.w, h: it.h }
    const move = (ev: PointerEvent) => {
      const dx = ev.clientX - x0, dy = ev.clientY - y0
      if (mode === 'move') updateItem(it.id, { x: Math.max(0, o.x + dx), y: Math.max(0, o.y + dy) })
      else updateItem(it.id, { w: Math.max(60, o.w + dx), h: Math.max(40, o.h + dy) })
    }
    const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up) }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }

  return (
    <div className="flex h-[78vh] flex-col">
      <div className="flex flex-wrap items-center gap-1.5 border-b border-border p-3">
        <button className="ws-btn" onClick={() => fileRef.current?.click()}><ImagePlus />{t('mood.image')}</button>
        <button className="ws-btn" data-variant={picker === 'fabric' ? 'solid' : undefined} onClick={() => setPicker(picker === 'fabric' ? null : 'fabric')}><Layers />{t('mood.swatch')}</button>
        <button className="ws-btn" data-variant={picker === 'color' ? 'solid' : undefined} onClick={() => setPicker(picker === 'color' ? null : 'color')}><Palette />{t('mood.chip')}</button>
        <button className="ws-btn" onClick={() => addItem({ id: uid(), type: 'note', ...nextPos(), w: 200, h: 120, text: '' })}><StickyNote />{t('mood.note')}</button>
        <span className="ms-auto text-[11px] text-muted-foreground">{t('mood.drag')}</span>
        <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => {
          for (const f of Array.from(e.target.files ?? [])) {
            const r = new FileReader()
            r.onload = () => {
              const img = new Image()
              img.onload = () => {
                // downscale to keep the board within storage limits
                const k = Math.min(1, 900 / Math.max(img.width, img.height))
                const c = document.createElement('canvas')
                c.width = img.width * k; c.height = img.height * k
                c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height)
                addItem({ id: uid(), type: 'image', ...nextPos(), w: 240, h: Math.round(240 * (c.height / c.width)), src: c.toDataURL('image/jpeg', 0.82) })
              }
              img.src = String(r.result)
            }
            r.readAsDataURL(f)
          }
          e.target.value = ''
        }} />
      </div>
      {picker && (
        <div className="grid max-h-32 grid-cols-[repeat(auto-fill,minmax(2.25rem,1fr))] gap-1 overflow-y-auto border-b border-border p-2 scroll-thin">
          {picker === 'fabric'
            ? fabrics.map((f) => (
              <button key={f.id} title={f.name[lang] ?? f.name.en} aria-label={f.name.en} className="aspect-square overflow-hidden rounded-sm border border-border"
                onClick={() => addItem({ id: uid(), type: 'fabric', ...nextPos(), w: 140, h: 140, fabricId: f.id, color: null })}>
                <FabricSwatch fabric={f} className="size-full" tile={36} />
              </button>
            ))
            : COLOR_CATALOGUE.map((c) => (
              <button key={c.code + c.hex} title={`${c.code} ${c.name[lang]}`} aria-label={c.name.en} className="aspect-square rounded-sm border border-black/10" style={{ background: c.hex }}
                onClick={() => addItem({ id: uid(), type: 'color', ...nextPos(), w: 110, h: 140, color: c.hex, code: c.code })} />
            ))}
        </div>
      )}
      <div ref={boardRef} className="relative min-h-0 flex-1 overflow-auto bg-canvas scroll-thin"
        style={{ backgroundImage: 'radial-gradient(var(--grid-strong) 1px, transparent 1px)', backgroundSize: '20px 20px' }}>
        {!items.length && <p className="absolute inset-0 flex items-center justify-center text-muted-foreground">{t('mood.empty')}</p>}
        <div className="relative" style={{ width: 1800, height: 1200 }}>
          {items.map((it) => (
            <div key={it.id} className="group absolute rounded-sm bg-surface shadow-[0_6px_20px_-8px_rgba(0,0,0,.35)]"
              style={{ left: it.x, top: it.y, width: it.w, height: it.h }}
              onPointerDown={(e) => it.type !== 'note' || (e.target as HTMLElement).tagName !== 'TEXTAREA' ? startDrag(e, it, 'move') : undefined}>
              {it.type === 'image' && <img src={it.src} alt="" className="size-full rounded-sm object-cover" draggable={false} />}
              {it.type === 'fabric' && (() => {
                const f = fabricById(it.fabricId)
                return f ? (
                  <div className="flex size-full flex-col">
                    <FabricSwatch fabric={f} color={it.color} className="flex-1 rounded-t-sm" tile={90} />
                    <span className="truncate px-1.5 py-1 text-[10px]">{f.name[lang] ?? f.name.en}</span>
                  </div>
                ) : null
              })()}
              {it.type === 'color' && (
                <div className="flex size-full flex-col">
                  <div className="flex-1 rounded-t-sm" style={{ background: it.color }} />
                  <span className="px-1.5 py-1 font-mono text-[10px]">{it.code}</span>
                </div>
              )}
              {it.type === 'note' && (
                <textarea className="size-full resize-none rounded-sm bg-accent-soft p-2 text-[12px] outline-none" value={it.text} placeholder={t('mood.placeholder')}
                  onPointerDown={(e) => e.stopPropagation()} onChange={(e) => updateItem(it.id, { text: e.target.value })} />
              )}
              <button className="absolute -end-2 -top-2 hidden size-5 items-center justify-center rounded-full bg-foreground text-background group-hover:flex"
                onPointerDown={(e) => e.stopPropagation()} onClick={() => removeItem(it.id)} aria-label={t('misc.remove')}><X className="size-3" /></button>
              <span className="absolute -bottom-1 -end-1 hidden size-3 cursor-nwse-resize rounded-sm bg-accent group-hover:block" onPointerDown={(e) => startDrag(e, it, 'resize')} />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

/** Compact draggable strip of moodboard swatches & chips (HTML5 drag → pattern pane). */
export function MoodTray() {
  const items = useBoards((s) => s.items).filter((i) => i.type === 'fabric' || i.type === 'color')
  if (!items.length) return null
  return (
    <div className="absolute bottom-3 start-6 z-10 flex max-w-[70%] gap-1 overflow-x-auto rounded border border-border bg-surface/95 p-1 shadow-sm scroll-thin">
      {items.map((it) => (
        <div key={it.id} draggable title={it.type === 'color' ? it.code : it.fabricId}
          onDragStart={(e) => e.dataTransfer.setData('application/x-naseej', JSON.stringify(it.type === 'fabric' ? { type: 'fabric', fabricId: it.fabricId, color: it.color } : { type: 'color', color: it.color }))}
          className="size-7 shrink-0 cursor-grab overflow-hidden rounded-sm border border-black/10"
          style={it.type === 'color' ? { background: it.color } : undefined}>
          {it.type === 'fabric' && fabricById(it.fabricId) && <FabricSwatch fabric={fabricById(it.fabricId)!} className="size-full" tile={28} />}
        </div>
      ))}
    </div>
  )
}
