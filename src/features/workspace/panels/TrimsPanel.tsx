import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { MapPin, Plus, Trash2 } from 'lucide-react'
import { cn, uid } from '@/lib/utils'
import { useWorkspace, useActiveStyle } from '../store'
import { useWsUi } from '../actions'
import { useTransient } from '../render'
import { TRIMS, trimById, type TrimCat } from '../model/trims'
import { NumField } from '../Inspector'

const CATS: TrimCat[] = ['button', 'zipper', 'snap', 'rivet', 'lace', 'ribbon', 'piping', 'patch', 'label']

export default function TrimsPanel() {
  const { t, i18n } = useTranslation('ws')
  const lang = (i18n.resolvedLanguage ?? 'en').split('-')[0] === 'ar' ? 'ar' : 'en'
  const style = useActiveStyle()
  const w = useWorkspace()
  const ui = useWsUi()
  const [cat, setCat] = useState<TrimCat | 'all'>('all')
  if (!style) return null
  const list = TRIMS.filter((x) => cat === 'all' || x.cat === cat)
  const add = (trimId: string) => {
    const def = trimById(trimId)!
    w.edit('Add trim', (s) => ({ ...s, trims: [...s.trims, { id: uid(), trimId, qty: def.unit === 'm' ? 1 : def.cat === 'button' ? 6 : 1, color: null, piece: null, at: null }] }))
  }
  const place = (trimId: string) => {
    useTransient.getState().set({ pendingTrim: trimId })
    w.set({ tool: 'trim' })
    ui.close()
  }
  const total = style.trims.reduce((a, u) => a + u.qty * (trimById(u.trimId)?.cost ?? 0), 0)

  return (
    <div className="grid h-[72vh] md:grid-cols-[1fr_22rem]">
      <div className="flex min-h-0 flex-col">
        <div className="flex flex-wrap gap-1 border-b border-border p-3">
          {(['all', ...CATS] as const).map((c) => (
            <button key={c} onClick={() => setCat(c)} aria-pressed={cat === c}
              className={cn('rounded-full border px-2.5 py-0.5 text-[11px]', cat === c ? 'border-foreground bg-foreground text-background' : 'border-border text-muted-foreground hover:text-foreground')}>
              {c === 'all' ? t('misc.all') : t(`trims.cat.${c}`)}
            </button>
          ))}
        </div>
        <ul className="grid min-h-0 flex-1 grid-cols-1 gap-2 overflow-y-auto p-3 sm:grid-cols-2 lg:grid-cols-3 scroll-thin">
          {list.map((x) => (
            <li key={x.id} className="flex gap-3 rounded-md border border-border p-2.5">
              <TrimIcon cat={x.cat} color={x.color} />
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{x.name[lang]}</p>
                <p className="truncate text-[10px] text-muted-foreground">{x.spec} · {x.material}</p>
                <p className="num text-[10px] text-muted-foreground">${x.cost.toFixed(2)} / {x.unit}</p>
                <div className="mt-1.5 flex gap-1">
                  <button className="ws-btn !h-6 !px-2" onClick={() => add(x.id)}><Plus />{t('trims.add')}</button>
                  <button className="ws-btn !h-6 !px-2" onClick={() => place(x.id)} title={t('trims.place')}><MapPin />{t('trims.place')}</button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      </div>
      <aside className="flex min-h-0 flex-col border-t border-border md:border-s md:border-t-0">
        <h3 className="ws-section-title px-3 pt-3">{t('trims.inStyle')}</h3>
        <ul className="min-h-0 flex-1 space-y-1.5 overflow-y-auto px-3 scroll-thin">
          {style.trims.length === 0 && <li className="text-muted-foreground">{t('trims.empty')}</li>}
          {style.trims.map((u) => {
            const d = trimById(u.trimId)
            if (!d) return null
            return (
              <li key={u.id} className="grid grid-cols-[1fr_4.5rem_auto] items-center gap-2 rounded border border-border p-1.5">
                <div className="min-w-0">
                  <p className="truncate">{d.name[lang]}</p>
                  <p className="text-[10px] text-muted-foreground">{u.piece ? `● ${style.pieces.find((p) => p.id === u.piece)?.name[lang] ?? ''}` : d.spec}</p>
                </div>
                <NumField value={u.qty} step={d.unit === 'm' ? 0.1 : 1} min={0} digits={d.unit === 'm' ? 1 : 0} suffix={d.unit}
                  onChange={(v) => w.edit('Trim quantity', (s) => ({ ...s, trims: s.trims.map((x) => (x.id === u.id ? { ...x, qty: v } : x)) }), `tq:${u.id}`)} />
                <button className="ws-icon-btn !size-6" aria-label={t('misc.remove')} onClick={() => w.edit('Remove trim', (s) => ({ ...s, trims: s.trims.filter((x) => x.id !== u.id) }))}><Trash2 className="size-3" /></button>
              </li>
            )
          })}
        </ul>
        <div className="flex justify-between border-t border-border p-3 font-medium">
          <span>{t('trims.total')}</span><span className="num">${total.toFixed(2)}</span>
        </div>
      </aside>
    </div>
  )
}

export function TrimIcon({ cat, color }: { cat: TrimCat; color: string }) {
  return (
    <svg viewBox="0 0 40 40" className="size-10 shrink-0 rounded bg-muted p-1" aria-hidden>
      {cat === 'button' && <><circle cx="20" cy="20" r="13" fill={color} stroke="#1a1a1a" strokeWidth="1" />{[[16, 16], [24, 16], [16, 24], [24, 24]].map(([x, y]) => <circle key={x + '-' + y} cx={x} cy={y} r="1.6" fill="#1a1a1a" />)}</>}
      {cat === 'zipper' && <><rect x="17" y="4" width="6" height="32" fill={color} />{Array.from({ length: 9 }, (_, i) => <rect key={i} x={i % 2 ? 20 : 15} y={5 + i * 3.4} width="5" height="1.6" fill="#9a9a9a" />)}<rect x="15" y="22" width="10" height="7" rx="1.5" fill="#9a9a9a" /></>}
      {(cat === 'snap' || cat === 'rivet') && <><circle cx="20" cy="20" r="10" fill={color} stroke="#1a1a1a" /><circle cx="20" cy="20" r={cat === 'snap' ? 4 : 2} fill="none" stroke="#1a1a1a" /></>}
      {cat === 'lace' && <path d="M2 14 Q8 4 14 14 T26 14 T38 14 V26 H2Z" fill={color} stroke="#1a1a1a" strokeWidth=".8" />}
      {(cat === 'ribbon' || cat === 'piping') && <rect x="2" y={cat === 'ribbon' ? 15 : 18} width="36" height={cat === 'ribbon' ? 10 : 4} rx="2" fill={color} stroke="#1a1a1a" strokeWidth=".6" />}
      {cat === 'patch' && <><rect x="8" y="8" width="24" height="24" rx="4" fill={color} /><rect x="10" y="10" width="20" height="20" rx="3" fill="none" stroke="#fff" strokeDasharray="2 1.5" /></>}
      {cat === 'label' && <><rect x="6" y="13" width="28" height="14" fill={color} stroke="#1a1a1a" strokeWidth=".6" /><path d="M10 20 H30" stroke="#f4f0e8" /></>}
    </svg>
  )
}
