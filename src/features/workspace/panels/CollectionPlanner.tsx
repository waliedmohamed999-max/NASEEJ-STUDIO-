import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Plus, Trash2, ExternalLink } from 'lucide-react'
import { fabricById } from '@/data/fabrics'
import { cn } from '@/lib/utils'
import { useBoards, useWorkspace } from '../store'
import { useWsUi } from '../actions'
import { FlatSketch } from '../panes/FlatSketch'
import { effectiveMaterial } from '../render'
import type { Style, StyleStatus } from '../model/types'

const STATUSES: StyleStatus[] = ['concept', 'sampling', 'approved']

export default function CollectionPlanner() {
  const { t, i18n } = useTranslation('ws')
  const lang = (i18n.resolvedLanguage ?? 'en').split('-')[0]
  const { collections, addCollection, removeCollection } = useBoards()
  const { styles, patchStyle, open } = useWorkspace()
  const ui = useWsUi()
  const [cid, setCid] = useState<string | null>(collections[0]?.id ?? null)
  const [view, setView] = useState<'sheet' | 'board'>('sheet')
  const [name, setName] = useState('')
  const [season, setSeason] = useState('SS27')
  const coll = collections.find((c) => c.id === cid) ?? null
  const all = Object.values(styles)
  const inColl = all.filter((s) => s.collectionId === cid)
  const unassigned = all.filter((s) => !s.collectionId)

  const openStyle = (s: Style) => { open(s.id); ui.close() }

  return (
    <div className="grid h-[78vh] md:grid-cols-[15rem_1fr]">
      <aside className="flex min-h-0 flex-col border-b border-border md:border-b-0 md:border-e">
        <form className="space-y-1.5 border-b border-border p-3" onSubmit={(e) => { e.preventDefault(); if (!name.trim()) return; setCid(addCollection(name.trim(), season.trim())); setName('') }}>
          <input className="ws-input" value={name} onChange={(e) => setName(e.target.value)} placeholder={t('coll.name')} aria-label={t('coll.name')} />
          <div className="flex gap-1.5">
            <input className="ws-input" value={season} onChange={(e) => setSeason(e.target.value)} placeholder={t('coll.season')} aria-label={t('coll.season')} />
            <button className="ws-btn shrink-0" data-variant="solid" type="submit"><Plus />{t('coll.new')}</button>
          </div>
        </form>
        <ul className="min-h-0 flex-1 overflow-y-auto p-2 scroll-thin">
          {collections.map((c) => (
            <li key={c.id} className="flex items-center gap-1">
              <button className={cn('min-w-0 flex-1 rounded px-2 py-1.5 text-start', cid === c.id ? 'bg-foreground text-background' : 'hover:bg-muted')} onClick={() => setCid(c.id)}>
                <span className="block truncate font-medium">{c.name}</span>
                <span className="block text-[10px] opacity-70">{c.season} · {all.filter((s) => s.collectionId === c.id).length}</span>
              </button>
              <button className="ws-icon-btn !size-6" aria-label={t('misc.remove')} onClick={() => { all.filter((s) => s.collectionId === c.id).forEach((s) => patchStyle(s.id, { collectionId: null })); removeCollection(c.id); if (cid === c.id) setCid(null) }}><Trash2 className="size-3" /></button>
            </li>
          ))}
          {!collections.length && <li className="p-2 text-muted-foreground">{t('coll.empty')}</li>}
        </ul>
      </aside>

      <section className="flex min-h-0 flex-col">
        {coll ? (
          <>
            <header className="flex flex-wrap items-center gap-2 border-b border-border p-3">
              <div>
                <h3 className="font-display text-2xl leading-none">{coll.name}</h3>
                <p className="text-[11px] text-muted-foreground">{coll.season} · {inColl.length} styles · {STATUSES.map((s) => `${inColl.filter((x) => x.status === s).length} ${t(`status.${s}`)}`).join(' · ')}</p>
              </div>
              <div className="ms-auto flex gap-1">
                <button className="ws-btn" data-variant={view === 'sheet' ? 'solid' : undefined} onClick={() => setView('sheet')}>{t('coll.lineSheet')}</button>
                <button className="ws-btn" data-variant={view === 'board' ? 'solid' : undefined} onClick={() => setView('board')}>{t('coll.board')}</button>
              </div>
            </header>
            <div className="min-h-0 flex-1 overflow-y-auto p-3 scroll-thin">
              {view === 'sheet' ? (
                <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                  {inColl.map((s, i) => <LineCard key={s.id} s={s} n={i + 1} lang={lang} onOpen={() => openStyle(s)} onRemove={() => patchStyle(s.id, { collectionId: null })} />)}
                </ul>
              ) : (
                <div className="grid gap-3 md:grid-cols-3">
                  {STATUSES.map((st) => (
                    <div key={st} className="rounded-md bg-muted/60 p-2"
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={(e) => { const id = e.dataTransfer.getData('text/style'); if (id) patchStyle(id, { status: st }) }}>
                      <h4 className="ws-section-title px-1">{t(`status.${st}`)} <span className="num">{inColl.filter((s) => s.status === st).length}</span></h4>
                      <ul className="space-y-2">
                        {inColl.filter((s) => s.status === st).map((s) => (
                          <li key={s.id} draggable onDragStart={(e) => e.dataTransfer.setData('text/style', s.id)} className="flex cursor-grab gap-2 rounded border border-border bg-surface p-2">
                            <span className="h-14 w-10 shrink-0 rounded bg-canvas"><FlatSketch decorative style={s} view="front" className="h-full w-full" /></span>
                            <span className="min-w-0 flex-1">
                              <span className="block truncate font-medium">{s.name}</span>
                              <select className="ws-input mt-1 !h-6" value={s.status} onChange={(e) => patchStyle(s.id, { status: e.target.value as StyleStatus })} aria-label={t('insp.status')}>
                                {STATUSES.map((x) => <option key={x} value={x}>{t(`status.${x}`)}</option>)}
                              </select>
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              )}
              {unassigned.length > 0 && (
                <div className="mt-6">
                  <h4 className="ws-section-title">{t('coll.unassigned')}</h4>
                  <ul className="flex flex-wrap gap-2">
                    {unassigned.map((s) => (
                      <li key={s.id}>
                        <button className="ws-btn" onClick={() => patchStyle(s.id, { collectionId: coll.id })}><Plus />{s.name}</button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </>
        ) : <p className="m-auto text-muted-foreground">{t('coll.empty')}</p>}
      </section>
    </div>
  )
}

function LineCard({ s, n, lang, onOpen, onRemove }: { s: Style; n: number; lang: string; onOpen: () => void; onRemove: () => void }) {
  const { t } = useTranslation('ws')
  const main = s.pieces[0]
  const mat = main ? effectiveMaterial(s, main) : null
  const fab = mat ? fabricById(mat.fabricId) : null
  return (
    <li className="overflow-hidden rounded-md border border-border bg-surface">
      <div className="relative aspect-[3/4] bg-canvas p-3">
        <FlatSketch decorative style={s} view="front" className="h-full w-full" />
        <span className="num absolute start-2 top-2 text-[10px] text-muted-foreground">{String(n).padStart(2, '0')}</span>
        <span className={cn('absolute end-2 top-2 rounded-full px-1.5 py-0.5 text-[9px]', s.status === 'approved' ? 'bg-fit-good/15 text-fit-good' : s.status === 'sampling' ? 'bg-accent-soft text-accent-ink' : 'bg-muted text-muted-foreground')}>{t(`status.${s.status}`)}</span>
      </div>
      <div className="space-y-0.5 border-t border-border p-2">
        <p className="truncate font-medium">{s.name}</p>
        <p className="truncate text-[10px] text-muted-foreground">{fab?.name[lang] ?? fab?.name.en} · {s.sizeSystem}</p>
        <div className="flex items-center gap-1">
          {[null, ...s.colorways.map((c) => c.id)].slice(0, 6).map((cw) => {
            const m = main ? effectiveMaterial(s, main, cw) : null
            return <span key={cw ?? 'b'} className="size-3 rounded-full border border-black/10" style={{ background: m?.color ?? fabricById(m?.fabricId ?? '')?.color }} />
          })}
          <span className="num ms-auto text-[11px]">{s.targetPrice ? `$${s.targetPrice}` : ''}</span>
        </div>
        <div className="flex gap-1 pt-1">
          <button className="ws-btn !h-6 flex-1 !px-1.5" onClick={onOpen}><ExternalLink />{t('menu.open').replace('…', '')}</button>
          <button className="ws-icon-btn !size-6" onClick={onRemove} aria-label={t('misc.remove')}><Trash2 className="size-3" /></button>
        </div>
      </div>
    </li>
  )
}
