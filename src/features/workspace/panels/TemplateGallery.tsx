import { lazy, Suspense, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Search } from 'lucide-react'
import { fabricById } from '@/data/fabrics'
import { cn } from '@/lib/utils'
import { useWorkspace } from '../store'
import { useWsUi } from '../actions'
import { CATEGORIES, TEMPLATES, type CategoryId, type Template } from '../model/templates'
import { createStyle } from '../model/style'
import { FlatSketch } from '../panes/FlatSketch'
import { deriveSpec } from '../model/spec'

const TemplatePreview3D = lazy(() => import('./TemplatePreview3D'))

type BlockId = Template['blocks'][number]
const BLOCKS: BlockId[] = ['bodice', 'sleeve', 'skirt', 'trouser', 'collar', 'hood', 'kimono', 'rect']

/** Bare base blocks for "Start from block". */
const BASE_BLOCKS: Array<{ id: string; kind: Template['kind']; block: BlockId }> = [
  { id: 'b-tee', kind: 'top', block: 'bodice' },
  { id: 'w-pencil', kind: 'skirt', block: 'skirt' },
  { id: 't-trouser', kind: 'trousers', block: 'trouser' },
  { id: 'mo-kimono', kind: 'dress', block: 'kimono' },
]

export default function TemplateGallery() {
  const { t, i18n } = useTranslation('ws')
  const lang = (i18n.resolvedLanguage ?? 'en').split('-')[0] === 'ar' ? 'ar' : 'en'
  const [cat, setCat] = useState<CategoryId | 'all'>('all')
  const [block, setBlock] = useState<BlockId | null>(null)
  const [q, setQ] = useState('')
  const [sel, setSel] = useState<Template>(TEMPLATES[1])
  const newStyle = useWorkspace((s) => s.newStyle)
  const close = useWsUi((s) => s.close)

  // Thumbnails are flats generated from each template's real draft (cached once).
  const previews = useMemo(() => new Map(TEMPLATES.map((tp) => [tp.id, createStyle(tp)])), [])
  const list = TEMPLATES.filter((tp) =>
    (cat === 'all' || tp.cat === cat) &&
    (!block || tp.blocks.includes(block)) &&
    (!q || `${tp.name.en} ${tp.name.ar} ${tp.id}`.toLowerCase().includes(q.toLowerCase())))
  const selStyle = previews.get(sel.id)!
  const spec = useMemo(() => deriveSpec(selStyle), [selStyle])
  const start = (tp: Template, name?: string) => { newStyle(tp.id, name); close() }

  return (
    <div className="grid h-[78vh] grid-cols-1 md:grid-cols-[13rem_1fr_20rem]">
      {/* filters */}
      <aside className="border-b border-border p-3 md:border-b-0 md:border-e">
        <div className="relative mb-3">
          <Search className="pointer-events-none absolute start-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <input className="ws-input !h-8 ps-7" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('gallery.search')} aria-label={t('gallery.search')} />
        </div>
        <nav className="flex flex-wrap gap-1 md:flex-col md:gap-0.5" aria-label={t('gallery.title')}>
          {[{ id: 'all' as const, name: { en: t('gallery.all'), ar: t('gallery.all') } }, ...CATEGORIES].map((c) => {
            const n = c.id === 'all' ? TEMPLATES.length : TEMPLATES.filter((tp) => tp.cat === c.id).length
            return (
              <button key={c.id} onClick={() => setCat(c.id)} aria-pressed={cat === c.id}
                className={cn('flex items-center justify-between rounded px-2 py-1.5 text-start', cat === c.id ? 'bg-foreground text-background' : 'hover:bg-muted')}>
                <span>{c.name[lang]}</span><span className="num text-[10px] opacity-60">{n}</span>
              </button>
            )
          })}
        </nav>
        <h3 className="ws-section-title mt-4">{t('gallery.blocks')}</h3>
        <div className="flex flex-wrap gap-1">
          {BLOCKS.map((b) => (
            <button key={b} onClick={() => setBlock(block === b ? null : b)} aria-pressed={block === b}
              className={cn('rounded-full border px-2 py-0.5 text-[10px]', block === b ? 'border-foreground bg-foreground text-background' : 'border-border text-muted-foreground hover:text-foreground')}>
              {t(`gallery.block.${b}`)}
            </button>
          ))}
        </div>
        <h3 className="ws-section-title mt-4">{t('gallery.fromBlock')}</h3>
        <p className="mb-2 text-[11px] text-muted-foreground">{t('gallery.fromBlockBody')}</p>
        <div className="grid grid-cols-2 gap-1">
          {BASE_BLOCKS.map((b) => (
            <button key={b.id} className="ws-btn !h-auto flex-col !py-1.5" onClick={() => start(TEMPLATES.find((x) => x.id === b.id)!, `${t(`gallery.block.${b.block}`)} block`)}>
              {t(`gallery.block.${b.block}`)}
            </button>
          ))}
        </div>
      </aside>

      {/* grid */}
      <div className="min-h-0 overflow-y-auto p-3 scroll-thin">
        <p className="mb-2 text-[11px] text-muted-foreground">{t('gallery.count', { n: list.length })}</p>
        <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
          {list.map((tp) => (
            <li key={tp.id}>
              <button
                onClick={() => setSel(tp)}
                onDoubleClick={() => start(tp)}
                aria-pressed={sel.id === tp.id}
                className={cn('group block w-full overflow-hidden rounded-md border text-start transition-colors', sel.id === tp.id ? 'border-accent ring-1 ring-accent' : 'border-border hover:border-foreground/30')}
              >
                <span className="block aspect-[3/4] bg-canvas p-3">
                  <FlatSketch decorative style={previews.get(tp.id)!} view="front" className="h-full w-full transition-transform duration-500 group-hover:scale-[1.04]" />
                </span>
                <span className="block border-t border-border px-2 py-1.5">
                  <span className="block truncate font-medium">{tp.name[lang]}</span>
                  <span className="block truncate text-[10px] text-muted-foreground">{CATEGORIES.find((c) => c.id === tp.cat)!.name[lang]} · {fabricById(tp.fabric)?.name[lang] ?? ''}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>

      {/* detail with live 3D preview */}
      <aside className="flex min-h-0 flex-col border-t border-border md:border-s md:border-t-0">
        <div className="relative h-72 shrink-0 bg-canvas md:h-[52%]">
          <Suspense fallback={<div className="p-6 text-muted-foreground">…</div>}>
            <TemplatePreview3D style={selStyle} />
          </Suspense>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-3 scroll-thin">
          <h3 className="font-display text-xl">{sel.name[lang]}</h3>
          <p className="text-[11px] text-muted-foreground">{CATEGORIES.find((c) => c.id === sel.cat)!.name[lang]} · {selStyle.pieces.length} pcs · {selStyle.seams.length} seams</p>
          <div className="mt-2 flex flex-wrap gap-1">
            {sel.blocks.map((b) => <span key={b} className="rounded-full border border-border px-2 py-0.5 text-[10px]">{t(`gallery.block.${b}`)}</span>)}
          </div>
          <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1 text-[11px]">
            {spec.body && <><dt className="text-muted-foreground">Bust</dt><dd className="num">{spec.body.bust.toFixed(1)} cm</dd><dt className="text-muted-foreground">Length</dt><dd className="num">{(spec.skirt ? 42 + spec.skirt.length : spec.body.length).toFixed(1)} cm</dd></>}
            {spec.skirt && <><dt className="text-muted-foreground">Hem sweep</dt><dd className="num">{spec.skirt.hem.toFixed(0)} cm</dd></>}
            {spec.trousers && <><dt className="text-muted-foreground">Hip</dt><dd className="num">{spec.trousers.hip.toFixed(1)} cm</dd><dt className="text-muted-foreground">Leg opening</dt><dd className="num">{spec.trousers.hem.toFixed(1)} cm</dd></>}
            {spec.sleeve && <><dt className="text-muted-foreground">Sleeve</dt><dd className="num">{spec.sleeve.length.toFixed(1)} cm</dd></>}
          </dl>
          <ul className="mt-3 space-y-0.5 text-[11px] text-muted-foreground">
            {selStyle.pieces.map((p) => <li key={p.id}>· {p.name[lang] ?? p.name.en} — {p.foldEdge ? 'cut 1 on fold' : `cut ${p.cut}`}</li>)}
          </ul>
        </div>
        <div className="border-t border-border p-3">
          <button className="ws-btn w-full !h-9" data-variant="solid" onClick={() => start(sel)}>{t('gallery.start')}</button>
        </div>
      </aside>
    </div>
  )
}
