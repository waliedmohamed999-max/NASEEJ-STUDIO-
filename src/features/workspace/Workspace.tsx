import { lazy, Suspense, useCallback, useEffect, useRef, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router-dom'
import { fabricById } from '@/data/fabrics'
import { DirectionProvider } from '@radix-ui/react-direction'
import { PanelRightClose, PanelRightOpen, Columns2, Columns3, Square } from 'lucide-react'
import { dirFor } from '@/i18n'
import { useDocumentTitle } from '@/hooks'
import { useProjects } from '@/stores/studio'
import { useToasts } from '@/stores/ui'
import { cn } from '@/lib/utils'
import './i18n'
import { useWorkspace, useActiveStyle, type PaneId } from './store'
import { MenuBar } from './MenuBar'
import { TOOLS } from './tools'
import {
  useWsUi, deleteSelection, duplicateSelection, selectAll, groupSelection, ungroupSelection, rotateSelection, nudgeSelection,
} from './actions'
import { StatusBar } from './StatusBar'
import { Inspector } from './Inspector'
import { Dialogs } from './Dialogs'
import { PatternPane } from './panes/PatternPane'
import { FlatPane } from './panes/FlatPane'
import { simApi } from './viewport/simApi'
import { PrintViews } from './output/PrintViews'

const Viewport3D = lazy(() => import('./viewport/Viewport3D'))

export default function Workspace() {
  const { i18n } = useTranslation('ws')
  const style = useActiveStyle()
  useDocumentTitle(style ? `${style.name} · Atelier` : 'Atelier')
  const dir = dirFor((i18n.resolvedLanguage ?? 'en').split('-')[0])
  useBootstrap()
  useShortcuts()

  return (
    <DirectionProvider dir={dir}>
      <div className="flex h-dvh flex-col overflow-hidden bg-background text-[12px] text-foreground">
        <MenuBar right={<PaneSwitch />} />
        <div className="flex min-h-0 flex-1">
          <ToolRail />
          <main className="min-w-0 flex-1" aria-label="Workspace">{style ? <PaneArea /> : null}</main>
          <InspectorDock />
        </div>
        <StatusBar />
        <Dialogs />
        <PrintViews />
        <Toasts />
      </div>
    </DirectionProvider>
  )
}

/** First run: migrate projects from the original studio, else start from a template. */
function useBootstrap() {
  const { styles, activeId, migrated, importLegacy, newStyle, open, edit } = useWorkspace()
  const [params, setParams] = useSearchParams()
  // Deep link from the fabric library: /studio?fabric=<id> applies it to every shell piece.
  useEffect(() => {
    const fid = params.get('fabric')
    if (!fid || !activeId || !fabricById(fid)) return
    edit('Apply fabric', (st) => ({ ...st, pieces: st.pieces.map((p) => (p.layer === 'shell' ? { ...p, material: { ...p.material, fabricId: fid, color: null } } : p)) }))
    params.delete('fabric')
    setParams(params, { replace: true })
  }, [params, activeId, edit, setParams])
  const legacy = useProjects((s) => s.projects)
  useEffect(() => {
    if (!migrated && legacy.length) importLegacy(legacy)
  }, [migrated, legacy, importLegacy])
  useEffect(() => {
    if (activeId && styles[activeId]) return
    const first = Object.values(styles).sort((a, b) => b.updatedAt - a.updatedAt)[0]
    if (first) open(first.id)
    else newStyle('w-aline')
  }, [activeId, styles, open, newStyle])
}

function useShortcuts() {
  const ui = useWsUi()
  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement
      if (el.closest('input, textarea, select, [contenteditable="true"]')) return
      const w = useWorkspace.getState()
      const mod = e.metaKey || e.ctrlKey
      const k = e.key
      if (mod) {
        const lk = k.toLowerCase()
        const map: Record<string, () => void> = {
          z: () => (e.shiftKey ? w.redo() : w.undo()), y: w.redo, s: () => w.saveVersion(), d: duplicateSelection, a: selectAll,
          g: () => (e.shiftKey ? ungroupSelection() : groupSelection()), n: () => ui.open('gallery'), o: () => ui.open('open'),
          enter: () => simApi.run(),
        }
        if (map[lk]) { e.preventDefault(); map[lk]() }
        return
      }
      if (e.altKey && ['1', '2', '3'].includes(k)) {
        e.preventDefault()
        const panes: PaneId[][] = [['pattern'], ['pattern', '3d'], ['pattern', '3d', 'flat']]
        const p = panes[Number(k) - 1]
        w.set({ panes: p, paneSizes: p.map(() => 1 / p.length) })
        return
      }
      if (k === '?') { ui.open('shortcuts'); return }
      if (k === 'Tab') { e.preventDefault(); w.set({ inspector: !w.inspector }); return }
      if (k === 'Delete' || k === 'Backspace') { e.preventDefault(); deleteSelection(); return }
      if (k === 'Escape') { w.clearSel(); return }
      if (k === 'r' || k === 'R') { rotateSelection(e.shiftKey ? -90 : 90); return }
      const step = e.shiftKey ? 1 : 0.1
      const arrows: Record<string, [number, number]> = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }
      if (arrows[k] && w.sel.pieces.length) { e.preventDefault(); nudgeSelection(...arrows[k]); return }
      const tool = TOOLS.find((x) => x.key.toLowerCase() === k.toLowerCase())
      if (tool) w.set({ tool: tool.id })
    }
    window.addEventListener('keydown', on)
    return () => window.removeEventListener('keydown', on)
  }, [ui])
}

/* ------------------------------------------------------------------ */

function PaneSwitch() {
  const { t } = useTranslation('ws')
  const { panes, set } = useWorkspace()
  const opts: Array<{ n: number; icon: ReactNode; p: PaneId[]; label: string }> = [
    { n: 1, icon: <Square className="size-3.5" />, p: [panes[0] ?? 'pattern'], label: t('menu.panes1') },
    { n: 2, icon: <Columns2 className="size-3.5" />, p: ['pattern', '3d'], label: t('menu.panes2') },
    { n: 3, icon: <Columns3 className="size-3.5" />, p: ['pattern', '3d', 'flat'], label: t('menu.panes3') },
  ]
  return (
    <div className="me-2 flex items-center gap-0.5 border-e border-border pe-2" role="radiogroup" aria-label={t('menu.view')}>
      {opts.map((o) => (
        <button key={o.n} role="radio" aria-checked={panes.length === o.n} data-active={panes.length === o.n} className="ws-icon-btn"
          title={`${o.label} (Alt ${o.n})`} aria-label={o.label}
          onClick={() => set({ panes: o.p, paneSizes: o.p.map(() => 1 / o.p.length) })}>
          {o.icon}
        </button>
      ))}
    </div>
  )
}

function ToolRail() {
  const { t } = useTranslation('ws')
  const tool = useWorkspace((s) => s.tool)
  const set = useWorkspace((s) => s.set)
  let lastGroup = ''
  return (
    <nav className="flex w-11 shrink-0 flex-col items-center gap-0.5 overflow-y-auto border-e border-border bg-surface py-2 scroll-thin" aria-label={t('menu.tools')}>
      {TOOLS.map((x) => {
        const sep = lastGroup && lastGroup !== x.group
        lastGroup = x.group
        return (
          <div key={x.id} className="contents">
            {sep && <div className="my-1 h-px w-6 bg-border" />}
            <button
              className="ws-icon-btn"
              aria-pressed={tool === x.id}
              onClick={() => set({ tool: x.id })}
              title={`${t(`tool.${x.id}`)} (${x.key})`}
              aria-label={`${t(`tool.${x.id}`)} (${x.key})`}
            >
              <x.icon className="size-[15px]" strokeWidth={1.5} />
            </button>
          </div>
        )
      })}
    </nav>
  )
}

function PaneArea() {
  const { t, i18n } = useTranslation('ws')
  const { panes, paneSizes, set } = useWorkspace()
  const ref = useRef<HTMLDivElement>(null)
  const rtl = dirFor((i18n.resolvedLanguage ?? 'en').split('-')[0]) === 'rtl'
  const sizes = paneSizes.length === panes.length ? paneSizes : panes.map(() => 1 / panes.length)

  const startDrag = useCallback((i: number, e: React.PointerEvent) => {
    e.preventDefault()
    const el = ref.current
    if (!el) return
    const W = el.getBoundingClientRect().width
    const x0 = e.clientX
    const s0 = [...sizes]
    const move = (ev: PointerEvent) => {
      const d = ((ev.clientX - x0) / W) * (rtl ? -1 : 1)
      const a = Math.max(0.12, s0[i] + d), b = Math.max(0.12, s0[i + 1] - d)
      const next = [...s0]
      const total = s0[i] + s0[i + 1]
      next[i] = (a / (a + b)) * total
      next[i + 1] = (b / (a + b)) * total
      set({ paneSizes: next })
    }
    const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up) }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }, [sizes, set, rtl])

  const render = (p: PaneId) => {
    if (p === 'pattern') return <PatternPane />
    if (p === 'flat') return <FlatPane />
    return (
      <Suspense fallback={<div className="flex h-full items-center justify-center text-muted-foreground">…</div>}>
        <Viewport3D />
      </Suspense>
    )
  }

  return (
    <div ref={ref} className="flex h-full min-w-0">
      {panes.map((p, i) => (
        <div key={p} className="relative flex min-w-0" style={{ flex: `${sizes[i]} 1 0` }}>
          <section className="relative min-w-0 flex-1 overflow-hidden" aria-label={t(`pane.${p}`)}>
            <span className="ws-pane-title">{t(`pane.${p}`)}</span>
            {render(p)}
          </section>
          {i < panes.length - 1 && (
            <div
              role="separator"
              aria-orientation="vertical"
              tabIndex={0}
              onPointerDown={(e) => startDrag(i, e)}
              className="group relative z-10 w-px shrink-0 cursor-col-resize bg-border"
            >
              <span className="absolute inset-y-0 -start-1.5 -end-1.5 group-hover:bg-accent/30" />
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

function InspectorDock() {
  const { t, i18n } = useTranslation('ws')
  const { inspector, inspectorWidth, set } = useWorkspace()
  const rtl = dirFor((i18n.resolvedLanguage ?? 'en').split('-')[0]) === 'rtl'
  const startResize = (e: React.PointerEvent) => {
    e.preventDefault()
    const x0 = e.clientX, w0 = inspectorWidth
    const move = (ev: PointerEvent) => set({ inspectorWidth: Math.min(480, Math.max(240, w0 - (ev.clientX - x0) * (rtl ? -1 : 1))) })
    const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up) }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }
  if (!inspector) {
    return (
      <div className="flex w-8 shrink-0 flex-col items-center border-s border-border bg-surface pt-2">
        <button className="ws-icon-btn" onClick={() => set({ inspector: true })} title={`${t('menu.inspector')} (Tab)`} aria-label={t('menu.inspector')}>
          <PanelRightOpen className="size-3.5 rtl:-scale-x-100" />
        </button>
      </div>
    )
  }
  return (
    <aside className="relative flex shrink-0 flex-col border-s border-border bg-surface" style={{ width: inspectorWidth }} aria-label={t('menu.inspector')}>
      <div role="separator" aria-orientation="vertical" onPointerDown={startResize} className="absolute inset-y-0 -start-1 z-10 w-2 cursor-col-resize hover:bg-accent/20" />
      <div className="flex h-8 shrink-0 items-center justify-between border-b border-border ps-3.5 pe-1">
        <span className="ws-section-title !mb-0">{t('menu.inspector')}</span>
        <button className="ws-icon-btn" onClick={() => set({ inspector: false })} title={`${t('menu.inspector')} (Tab)`} aria-label={t('menu.inspector')}>
          <PanelRightClose className="size-3.5 rtl:-scale-x-100" />
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto scroll-thin"><Inspector /></div>
    </aside>
  )
}

function Toasts() {
  const toasts = useToasts((s) => s.toasts)
  return (
    <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-10 z-[80] flex flex-col items-center gap-2">
      {toasts.map((x) => (
        <div key={x.id} className={cn('animate-fade-up rounded-md bg-foreground px-4 py-2 text-[12px] text-background shadow-lg')}>{x.message}</div>
      ))}
    </div>
  )
}
