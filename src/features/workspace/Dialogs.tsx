import { lazy, Suspense, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Copy, Plus, RotateCcw, Trash2 } from 'lucide-react'
import { Dialog, DialogContent } from '@/components/ui/primitives'
import { cn } from '@/lib/utils'
import { toast } from '@/stores/ui'
import { useWorkspace, useActiveStyle } from './store'
import { useWsUi, type DialogId } from './actions'
import { SHORTCUTS } from './tools'
import { FlatSketch } from './panes/FlatSketch'
import { templateById } from './model/templates'

const TemplateGallery = lazy(() => import('./panels/TemplateGallery'))
const TrimsPanel = lazy(() => import('./panels/TrimsPanel'))
const ColorwaysPanel = lazy(() => import('./panels/ColorwaysPanel'))
const Moodboard = lazy(() => import('./panels/Moodboard'))
const CollectionPlanner = lazy(() => import('./panels/CollectionPlanner'))

const titles: Record<DialogId, string> = {
  gallery: 'gallery.title', open: 'open.title', versions: 'versions.title', shortcuts: 'shortcuts.title', trims: 'trims.title',
  colorways: 'colorways.title', colorwayCompare: 'colorways.compare', moodboard: 'mood.title', collection: 'coll.title', history: 'menu.history',
}
const wide: DialogId[] = ['gallery', 'moodboard', 'collection', 'colorways', 'colorwayCompare', 'trims']

export function Dialogs() {
  const { t } = useTranslation('ws')
  const { dialog, close } = useWsUi()
  return (
    <Dialog open={!!dialog} onOpenChange={(o) => !o && close()}>
      {dialog && (
        <DialogContent title={t(titles[dialog])} className={cn(wide.includes(dialog) ? 'w-[min(96vw,84rem)]' : 'w-[min(94vw,40rem)]', 'text-[12px]')}>
          <Suspense fallback={<div className="p-10 text-center text-muted-foreground">…</div>}>
            {dialog === 'shortcuts' && <Shortcuts />}
            {dialog === 'open' && <OpenStyle />}
            {dialog === 'versions' && <Versions />}
            {dialog === 'history' && <HistoryList />}
            {dialog === 'gallery' && <TemplateGallery />}
            {dialog === 'trims' && <TrimsPanel />}
            {(dialog === 'colorways' || dialog === 'colorwayCompare') && <ColorwaysPanel compare={dialog === 'colorwayCompare'} />}
            {dialog === 'moodboard' && <Moodboard />}
            {dialog === 'collection' && <CollectionPlanner />}
          </Suspense>
        </DialogContent>
      )}
    </Dialog>
  )
}

function Shortcuts() {
  const { t } = useTranslation('ws')
  return (
    <div className="grid gap-6 p-5 sm:grid-cols-3">
      {(['tools', 'edit', 'view'] as const).map((g) => (
        <section key={g}>
          <h3 className="ws-section-title">{t(`shortcuts.${g}`)}</h3>
          <dl className="space-y-1.5">
            {SHORTCUTS.filter((s) => s.group === g).map((s) => (
              <div key={s.keys + s.label} className="flex items-center justify-between gap-3">
                <dt className="truncate">{t(s.label)}</dt>
                <dd className="flex shrink-0 gap-1" dir="ltr">
                  {s.keys.split(' ').map((k, ki) => <kbd key={ki}className="rounded border border-border bg-muted px-1.5 py-0.5 font-sans text-[10px]">{k}</kbd>)}
                </dd>
              </div>
            ))}
          </dl>
        </section>
      ))}
    </div>
  )
}

function OpenStyle() {
  const { t, i18n } = useTranslation('ws')
  const { styles, activeId, open, remove, duplicate } = useWorkspace()
  const ui = useWsUi()
  const list = Object.values(styles).sort((a, b) => b.updatedAt - a.updatedAt)
  const lang = i18n.resolvedLanguage ?? 'en'
  return (
    <div className="p-4">
      <button className="ws-btn mb-4" data-variant="solid" onClick={() => ui.open('gallery')}><Plus />{t('open.new')}</button>
      {!list.length && <p className="py-8 text-center text-muted-foreground">{t('open.empty')}</p>}
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {list.map((s) => (
          <li key={s.id} className={cn('overflow-hidden rounded-md border', s.id === activeId ? 'border-accent' : 'border-border')}>
            <button className="block h-40 w-full bg-canvas p-2" onClick={() => { open(s.id); ui.close() }} aria-label={s.name}>
              <FlatSketch decorative style={s} view="front" className="h-full w-full" />
            </button>
            <div className="flex items-center gap-1 border-t border-border p-2">
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{s.name}</p>
                <p className="truncate text-[10px] text-muted-foreground">{templateById(s.templateId)?.name[lang === 'ar' ? 'ar' : 'en'] ?? ''} · {new Date(s.updatedAt).toLocaleDateString(lang)}</p>
              </div>
              <button className="ws-icon-btn" onClick={() => duplicate(s.id)} aria-label={t('insp.duplicate')} title={t('insp.duplicate')}><Copy className="size-3.5" /></button>
              <button className="ws-icon-btn" onClick={() => remove(s.id)} aria-label={t('insp.delete')} title={t('insp.delete')}><Trash2 className="size-3.5" /></button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}

function Versions() {
  const { t, i18n } = useTranslation('ws')
  const style = useActiveStyle()
  const { versions, saveVersion, restoreVersion, deleteVersion } = useWorkspace()
  const [label, setLabel] = useState('')
  if (!style) return null
  const list = versions[style.id] ?? []
  const lang = i18n.resolvedLanguage ?? 'en'
  return (
    <div className="p-4">
      <form className="mb-4 flex gap-2" onSubmit={(e) => { e.preventDefault(); saveVersion(label); setLabel(''); toast(t('toast.versionSaved')) }}>
        <input className="ws-input !h-8" value={label} onChange={(e) => setLabel(e.target.value)} placeholder={t('versions.label')} aria-label={t('versions.label')} />
        <button className="ws-btn !h-8" data-variant="solid" type="submit">{t('versions.save')}</button>
      </form>
      {!list.length && <p className="py-6 text-center text-muted-foreground">{t('versions.empty')}</p>}
      <ul className="divide-y divide-border border-y border-border">
        {list.map((v) => (
          <li key={v.id} className="flex items-center gap-3 py-2">
            <div className="h-14 w-10 shrink-0 rounded bg-canvas"><FlatSketch decorative style={v.style} view="front" className="h-full w-full" /></div>
            <div className="min-w-0 flex-1">
              <p className="font-medium">{v.label}</p>
              <p className="text-[10px] text-muted-foreground">{new Date(v.at).toLocaleString(lang)} · {v.style.pieces.length} pcs</p>
            </div>
            <button className="ws-btn" onClick={() => restoreVersion(v.id)}><RotateCcw />{t('versions.restore')}</button>
            <button className="ws-icon-btn" onClick={() => deleteVersion(v.id)} aria-label={t('misc.remove')}><Trash2 className="size-3.5" /></button>
          </li>
        ))}
      </ul>
    </div>
  )
}

function HistoryList() {
  const { t, i18n } = useTranslation('ws')
  const { past, future, jump, redo } = useWorkspace()
  const lang = i18n.resolvedLanguage ?? 'en'
  const time = (at: number) => new Date(at).toLocaleTimeString(lang, { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  return (
    <ol className="max-h-[60vh] overflow-auto p-3 scroll-thin">
      {past.map((h, i) => (
        <li key={i}>
          <button className="flex w-full items-center justify-between rounded px-2 py-1.5 text-start hover:bg-muted" onClick={() => jump(i)}>
            <span>{h.label}</span><span className="num text-[10px] text-muted-foreground">{time(h.at)}</span>
          </button>
        </li>
      ))}
      <li className="flex items-center gap-2 rounded bg-accent-soft px-2 py-1.5 font-medium">● {t('misc.ok')}</li>
      {future.map((h, i) => (
        <li key={`f${i}`}>
          <button className="flex w-full items-center justify-between rounded px-2 py-1.5 text-start text-muted-foreground hover:bg-muted" onClick={() => { for (let k = 0; k <= i; k++) redo() }}>
            <span>{h.label}</span><span className="num text-[10px]">{time(h.at)}</span>
          </button>
        </li>
      ))}
    </ol>
  )
}
