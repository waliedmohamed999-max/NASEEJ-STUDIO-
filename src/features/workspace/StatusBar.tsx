import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { History, Cloud, CloudOff } from 'lucide-react'
import { useWorkspace, useActiveStyle, onAutosave, getLastSaved } from './store'
import { useTransient, fmtLen } from './render'
import { useWsUi } from './actions'
import { SIZES, type SizeKey } from './model/types'
import { sizeLabel } from './model/grading'

export function StatusBar() {
  const { t, i18n } = useTranslation('ws')
  const w = useWorkspace()
  const style = useActiveStyle()
  const { cursor, zoom, simStatus, simProgress } = useTransient()
  const ui = useWsUi()
  const [saved, setSaved] = useState(getLastSaved())
  useEffect(() => onAutosave(setSaved), [])
  const dirty = !!style && style.updatedAt > saved + 50
  const lang = i18n.resolvedLanguage ?? 'en'
  const savedText = saved ? new Date(saved).toLocaleTimeString(lang, { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '—'

  return (
    <footer className="flex h-7 shrink-0 items-center gap-4 border-t border-border bg-surface px-3 text-[11px] text-muted-foreground">
      <span className="min-w-0 flex-1 truncate" aria-live="polite">{t(`hint.${w.tool}`)}</span>
      {simStatus === 'running' && <span className="num text-accent-ink">{t('sim.simulating', { p: Math.round(simProgress * 100) })}</span>}
      <span className="num w-36 text-end" dir="ltr">
        {cursor ? `x ${fmtLen(cursor.x, w.units)}  y ${fmtLen(cursor.y, w.units)}` : ''}
      </span>
      <span className="num">{t('status_bar.zoom')} {Math.round(zoom * 100)}%</span>
      {style && (
        <label className="flex items-center gap-1.5">
          {t('status_bar.size')}
          <select
            value={w.viewSize}
            onChange={(e) => w.set({ viewSize: e.target.value as SizeKey })}
            className="h-5 rounded border border-border bg-background px-1 text-[11px] text-foreground"
          >
            {SIZES.map((s) => (
              <option key={s} value={s}>{s} · {style.sizeSystem} {sizeLabel(style.sizeSystem, s)}{s === style.baseSize ? ' ●' : ''}</option>
            ))}
          </select>
        </label>
      )}
      <button className="flex items-center gap-1 hover:text-foreground" onClick={() => ui.open('history')} title={t('menu.history')}>
        <History className="size-3" /> <span className="num">{w.past.length}</span>
      </button>
      <span className="flex items-center gap-1" title={dirty ? t('status_bar.saving') : t('status_bar.saved', { t: savedText })}>
        {dirty ? <CloudOff className="size-3" /> : <Cloud className="size-3 text-accent-ink" />}
        <span className="hidden sm:inline">{dirty ? t('status_bar.saving') : t('status_bar.saved', { t: savedText })}</span>
      </span>
    </footer>
  )
}
