import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import * as DM from '@radix-ui/react-dropdown-menu'
import { Check, ChevronRight, Moon, Sun, Languages } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { languages } from '@/i18n'
import { useTheme } from '@/stores/ui'
import { cn } from '@/lib/utils'
import { useWorkspace, type PaneId } from './store'
import { useWsUi, deleteSelection, duplicateSelection, selectAll, groupSelection, ungroupSelection } from './actions'
import { TOOLS } from './tools'
import { runExport, type ExportKind } from './output/exports'
import { simApi } from './viewport/simApi'
import { toast } from '@/stores/ui'

export interface MenuItem {
  label: string
  shortcut?: string
  onSelect?: () => void
  checked?: boolean
  disabled?: boolean
  sub?: MenuItem[]
  separator?: boolean
}

function Items({ items }: { items: MenuItem[] }) {
  return (
    <>
      {items.map((it, i) =>
        it.separator ? (
          <DM.Separator key={i} className="my-1 h-px bg-border" />
        ) : it.sub ? (
          <DM.Sub key={i}>
            <DM.SubTrigger className="menu-item">
              <span className="flex-1">{it.label}</span>
              <ChevronRight className="size-3.5 opacity-60 rtl:-scale-x-100" />
            </DM.SubTrigger>
            <DM.Portal>
              <DM.SubContent className="menu-panel" sideOffset={2} alignOffset={-4}>
                <Items items={it.sub} />
              </DM.SubContent>
            </DM.Portal>
          </DM.Sub>
        ) : (
          <DM.Item key={i} className="menu-item" disabled={it.disabled} onSelect={it.onSelect}>
            <span className="w-4">{it.checked && <Check className="size-3.5" />}</span>
            <span className="flex-1">{it.label}</span>
            {it.shortcut && <kbd className="ms-6 font-sans text-[10px] tracking-wide text-muted-foreground">{it.shortcut}</kbd>}
          </DM.Item>
        ),
      )}
    </>
  )
}

function Menu({ label, items }: { label: string; items: MenuItem[] }) {
  return (
    <DM.Root modal={false}>
      <DM.Trigger className="rounded px-2.5 py-1 text-[12px] text-foreground/80 outline-none hover:bg-foreground/[0.06] data-[state=open]:bg-foreground/[0.08] focus-visible:ring-1 focus-visible:ring-ring">
        {label}
      </DM.Trigger>
      <DM.Portal>
        <DM.Content className="menu-panel" align="start" sideOffset={4}>
          <Items items={items} />
        </DM.Content>
      </DM.Portal>
    </DM.Root>
  )
}

export function MenuBar({ right }: { right?: ReactNode }) {
  const { t, i18n } = useTranslation('ws')
  const w = useWorkspace()
  const ui = useWsUi()
  const theme = useTheme()
  const lang = (i18n.resolvedLanguage ?? 'en').split('-')[0]
  const nextLang = languages[(languages.findIndex((l) => l.code === lang) + 1) % languages.length]
  const setPanes = (panes: PaneId[]) => w.set({ panes, paneSizes: panes.map(() => 1 / panes.length) })
  const exp = (k: ExportKind) => () => runExport(k).catch((e) => toast(String(e?.message ?? e)))

  const menus: Array<{ label: string; items: MenuItem[] }> = [
    {
      label: t('menu.file'),
      items: [
        { label: t('menu.newFromTemplate'), shortcut: 'Ctrl N', onSelect: () => ui.open('gallery') },
        { label: t('menu.open'), shortcut: 'Ctrl O', onSelect: () => ui.open('open') },
        { separator: true, label: '' },
        { label: t('menu.saveVersion'), shortcut: 'Ctrl S', onSelect: () => { w.saveVersion(); toast(t('toast.versionSaved')) } },
        { label: t('menu.versions'), onSelect: () => ui.open('versions') },
        { separator: true, label: '' },
        {
          label: t('menu.export'),
          sub: [
            { label: t('menu.exportTechPack'), onSelect: exp('techpack') },
            { label: t('menu.exportLookbook'), onSelect: exp('lookbook') },
            { separator: true, label: '' },
            { label: t('menu.exportDxf'), onSelect: exp('dxf') },
            { label: t('menu.exportTiled'), onSelect: exp('tiled') },
            { separator: true, label: '' },
            { label: t('menu.exportPng'), onSelect: exp('png') },
            { label: t('menu.export4k'), onSelect: exp('png4k') },
            { label: t('menu.exportTurntable'), onSelect: exp('turntable') },
          ],
        },
      ],
    },
    {
      label: t('menu.edit'),
      items: [
        { label: t('menu.undo'), shortcut: 'Ctrl Z', onSelect: w.undo, disabled: !w.past.length },
        { label: t('menu.redo'), shortcut: 'Ctrl ⇧ Z', onSelect: w.redo, disabled: !w.future.length },
        { label: t('menu.history'), onSelect: () => ui.open('history') },
        { separator: true, label: '' },
        { label: t('menu.duplicate'), shortcut: 'Ctrl D', onSelect: duplicateSelection },
        { label: t('menu.delete'), shortcut: 'Del', onSelect: deleteSelection },
        { label: t('menu.selectAll'), shortcut: 'Ctrl A', onSelect: selectAll },
        { label: t('menu.group'), shortcut: 'Ctrl G', onSelect: groupSelection },
        { label: t('menu.ungroup'), shortcut: 'Ctrl ⇧ G', onSelect: ungroupSelection },
      ],
    },
    {
      label: t('menu.view'),
      items: [
        { label: t('menu.panes1'), shortcut: 'Alt 1', checked: w.panes.length === 1, onSelect: () => setPanes([w.panes[0] ?? 'pattern']) },
        { label: t('menu.panes2'), shortcut: 'Alt 2', checked: w.panes.length === 2, onSelect: () => setPanes(['pattern', '3d']) },
        { label: t('menu.panes3'), shortcut: 'Alt 3', checked: w.panes.length === 3, onSelect: () => setPanes(['pattern', '3d', 'flat']) },
        {
          label: t('pane.pattern') + ' / ' + t('pane.3d') + ' / ' + t('pane.flat'),
          sub: (['pattern', '3d', 'flat'] as PaneId[]).map((p) => ({
            label: t(`pane.${p}`), checked: w.panes.includes(p),
            onSelect: () => {
              const next = w.panes.includes(p) ? w.panes.filter((x) => x !== p) : [...w.panes, p]
              if (next.length) setPanes((['pattern', '3d', 'flat'] as PaneId[]).filter((x) => next.includes(x)))
            },
          })),
        },
        { separator: true, label: '' },
        { label: t('menu.inspector'), shortcut: 'Tab', checked: w.inspector, onSelect: () => w.set({ inspector: !w.inspector }) },
        { label: t('menu.grid'), checked: w.showGrid, onSelect: () => w.set({ showGrid: !w.showGrid }) },
        { label: t('menu.sa'), checked: w.showSA, onSelect: () => w.set({ showSA: !w.showSA }) },
        { label: t('menu.nest'), checked: w.nest, onSelect: () => w.set({ nest: !w.nest }) },
        { label: t('menu.snap'), checked: w.snap, onSelect: () => w.set({ snap: !w.snap }) },
        { label: t('menu.units'), sub: [
          { label: 'cm', checked: w.units === 'cm', onSelect: () => w.set({ units: 'cm' }) },
          { label: 'inch', checked: w.units === 'in', onSelect: () => w.set({ units: 'in' }) },
        ] },
        { separator: true, label: '' },
        { label: t('menu.theme'), checked: theme.theme === 'dark', onSelect: theme.toggle },
      ],
    },
    {
      label: t('menu.tools'),
      items: TOOLS.map((tool) => ({ label: t(`tool.${tool.id}`), shortcut: tool.key, checked: w.tool === tool.id, onSelect: () => w.set({ tool: tool.id }) })),
    },
    {
      label: t('menu.simulate'),
      items: [
        { label: t('menu.runSim'), shortcut: 'Ctrl ↵', onSelect: () => simApi.run() },
        { label: t('menu.resetSim'), onSelect: () => simApi.reset() },
        { separator: true, label: '' },
        ...(['standing', 'walking', 'turning', 'sitting'] as const).map((p) => ({ label: t(`sim.poses.${p}`), checked: w.pose === p, onSelect: () => w.set({ pose: p, playing: p === 'walking' }) })),
      ],
    },
    {
      label: t('menu.window'),
      items: [
        { label: t('menu.gallery'), onSelect: () => ui.open('gallery') },
        { label: t('menu.trims'), onSelect: () => ui.open('trims') },
        { label: t('menu.colorways'), onSelect: () => ui.open('colorways') },
        { label: t('menu.moodboard'), onSelect: () => ui.open('moodboard') },
        { label: t('menu.collection'), onSelect: () => ui.open('collection') },
        { label: t('menu.history'), onSelect: () => ui.open('history') },
      ],
    },
    {
      label: t('menu.help'),
      items: [{ label: t('menu.shortcuts'), shortcut: '?', onSelect: () => ui.open('shortcuts') }],
    },
  ]

  return (
    <div className="flex h-9 shrink-0 items-center gap-1 border-b border-border bg-surface px-2">
      <Link to="/" className="me-2 flex items-baseline gap-1.5 px-1.5" title={t('menu.backToSite')}>
        <span className="font-display text-[15px] font-semibold tracking-[0.16em] rtl:tracking-normal">NASEEJ</span>
        <span className="text-[8px] tracking-[0.3em] text-muted-foreground">ATELIER</span>
      </Link>
      <nav className="flex items-center" aria-label="Application menu">
        {menus.map((m) => <Menu key={m.label} {...m} />)}
      </nav>
      <div className="ms-auto flex items-center gap-1">
        {right}
        <button className={cn('ws-icon-btn')} onClick={() => i18n.changeLanguage(nextLang.code)} title={nextLang.label} aria-label={nextLang.label}>
          <Languages className="size-3.5" />
        </button>
        <button className="ws-icon-btn" onClick={theme.toggle} aria-label={t('menu.theme')} title={t('menu.theme')}>
          {theme.theme === 'dark' ? <Sun className="size-3.5" /> : <Moon className="size-3.5" />}
        </button>
      </div>
    </div>
  )
}
