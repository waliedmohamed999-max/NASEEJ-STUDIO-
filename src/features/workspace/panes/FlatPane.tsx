import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { MousePointer2, PenLine, MessageSquareText, Trash2, Palette } from 'lucide-react'
import { uid } from '@/lib/utils'
import { useWorkspace, useActiveStyle } from '../store'
import { FlatSketch, buildFlat } from './FlatSketch'
import type { Annotation, Vec } from '../model/types'

type FlatTool = 'select' | 'line' | 'callout'

/**
 * Technical flats, regenerated live from the pattern, with an editable annotation
 * layer on top (construction lines, detail lines, callouts) — Illustrator-style
 * select/move, pen and text tools.
 */
export function FlatPane() {
  const { t } = useTranslation('ws')
  const style = useActiveStyle()
  const edit = useWorkspace((s) => s.edit)
  const [tool, setTool] = useState<FlatTool>('select')
  const [filled, setFilled] = useState(true)
  const [sel, setSel] = useState<string | null>(null)
  const [draft, setDraft] = useState<{ view: 'front' | 'back'; pts: Vec[] } | null>(null)
  if (!style) return null

  const update = (id: string, patch: Partial<Annotation>, key?: string) =>
    edit('Edit annotation', (s) => ({ ...s, annotations: s.annotations.map((a) => (a.id === id ? { ...a, ...patch } : a)) }), key)

  return (
    <div className="flex h-full flex-col bg-canvas">
      <div className="mt-7 flex items-center gap-0.5 px-2">
        {([['select', MousePointer2], ['line', PenLine], ['callout', MessageSquareText]] as const).map(([id, Icon]) => (
          <button key={id} className="ws-icon-btn" aria-pressed={tool === id} onClick={() => { setTool(id); setDraft(null) }} title={id} aria-label={id}><Icon className="size-3.5" /></button>
        ))}
        <button className="ws-icon-btn" aria-pressed={filled} onClick={() => setFilled((f) => !f)} title={t('insp.color')} aria-label={t('insp.color')}><Palette className="size-3.5" /></button>
        {sel && <button className="ws-icon-btn" onClick={() => { edit('Delete annotation', (s) => ({ ...s, annotations: s.annotations.filter((a) => a.id !== sel) })); setSel(null) }} aria-label={t('misc.remove')}><Trash2 className="size-3.5" /></button>}
        {draft && tool === 'line' && <span className="ms-2 text-[10px] text-muted-foreground">Enter / double-click ✓ · Esc ✕</span>}
      </div>
      <div className="grid min-h-0 flex-1 grid-cols-2 gap-2 p-4">
        {(['front', 'back'] as const).map((view) => (
          <FlatView key={view} view={view} filled={filled} tool={tool} sel={sel} setSel={setSel} draft={draft?.view === view ? draft.pts : null}
            onDraft={(pts) => setDraft(pts ? { view, pts } : null)}
            onCommit={(pts, kind) => {
              edit(kind === 'line' ? 'Draw flat line' : 'Add callout', (s) => ({
                ...s, annotations: [...s.annotations, { id: uid(), view, kind, pts, text: kind === 'callout' ? 'Note' : '' }],
              }))
              setDraft(null)
            }}
            onMove={(id, pts) => update(id, { pts }, `ann:${id}`)}
            onText={(id, text) => update(id, { text }, `annt:${id}`)} />
        ))}
      </div>
    </div>
  )
}

function FlatView({ view, filled, tool, sel, setSel, draft, onDraft, onCommit, onMove, onText }: {
  view: 'front' | 'back'; filled: boolean; tool: FlatTool; sel: string | null; setSel: (id: string | null) => void
  draft: Vec[] | null; onDraft: (pts: Vec[] | null) => void; onCommit: (pts: Vec[], kind: 'line' | 'callout') => void
  onMove: (id: string, pts: Vec[]) => void; onText: (id: string, text: string) => void
}) {
  const { t } = useTranslation('ws')
  const style = useActiveStyle()!
  const wrap = useRef<HTMLDivElement>(null)
  const anns = style.annotations.filter((a) => a.view === view)
  const geom = buildFlat(style, view)
  const pad = 6
  const vb = { x: geom.bounds.minX - pad, y: geom.bounds.minY - pad, w: geom.bounds.maxX - geom.bounds.minX + pad * 2, h: geom.bounds.maxY - geom.bounds.minY + pad * 2 }

  /** client → flat cm, honouring the SVG's preserveAspectRatio (xMidYMid meet) */
  const toCm = (e: { clientX: number; clientY: number }): Vec => {
    const svg = wrap.current!.querySelector('svg')!
    const r = svg.getBoundingClientRect()
    const k = Math.min(r.width / vb.w, r.height / vb.h)
    const ox = r.left + (r.width - vb.w * k) / 2, oy = r.top + (r.height - vb.h * k) / 2
    return { x: (e.clientX - ox) / k + vb.x, y: (e.clientY - oy) / k + vb.y }
  }

  const onDown = (e: React.PointerEvent) => {
    if (tool === 'select') { setSel(null); return }
    const p = toCm(e)
    if (tool === 'callout') { onCommit([p, { x: p.x + 14, y: p.y - 8 }], 'callout'); return }
    onDraft([...(draft ?? []), p])
  }
  const dragAnn = (e: React.PointerEvent, a: Annotation, idx: number | null) => {
    if (tool !== 'select') return
    e.stopPropagation()
    setSel(a.id)
    const start = toCm(e)
    const orig = a.pts
    const move = (ev: PointerEvent) => {
      const p = toCm(ev)
      const d = { x: p.x - start.x, y: p.y - start.y }
      onMove(a.id, orig.map((q, i) => (idx === null || idx === i ? { x: q.x + d.x, y: q.y + d.y } : q)))
    }
    const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up) }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }

  return (
    <figure className="flex min-h-0 flex-col">
      <div ref={wrap} className="relative min-h-0 flex-1"
        onKeyDown={(e) => { if (e.key === 'Enter' && draft && draft.length > 1) onCommit(draft, 'line'); if (e.key === 'Escape') onDraft(null) }} tabIndex={0}>
        <FlatSketch style={style} view={view} filled={filled} className="h-full w-full">
          <rect x={vb.x} y={vb.y} width={vb.w} height={vb.h} fill="transparent" onPointerDown={onDown}
            onDoubleClick={() => { if (draft && draft.length > 1) onCommit(draft, 'line') }} style={{ cursor: tool === 'select' ? 'default' : 'crosshair' }} />
          {anns.map((a) => (
            <g key={a.id}>
              {a.kind === 'line' ? (
                <polyline points={a.pts.map((p) => `${p.x},${p.y}`).join(' ')} fill="none" stroke={sel === a.id ? '#b08d57' : '#1a1a1a'} strokeWidth={0.5} strokeDasharray="1 0.7"
                  onPointerDown={(e) => dragAnn(e, a, null)} style={{ cursor: 'move' }} />
              ) : (
                <g>
                  <line x1={a.pts[0].x} y1={a.pts[0].y} x2={a.pts[1].x} y2={a.pts[1].y} stroke="#b08d57" strokeWidth={0.35} />
                  <circle cx={a.pts[0].x} cy={a.pts[0].y} r={0.9} fill="#b08d57" onPointerDown={(e) => dragAnn(e, a, 0)} style={{ cursor: 'move' }} />
                  <foreignObject x={a.pts[1].x} y={a.pts[1].y - 3} width={34} height={7} onPointerDown={(e) => dragAnn(e, a, 1)}>
                    <input value={a.text} onChange={(e) => onText(a.id, e.target.value)} onPointerDown={(e) => { e.stopPropagation(); setSel(a.id) }}
                      style={{ font: '2.6px var(--font-sans)', width: '100%', background: 'var(--surface)', border: sel === a.id ? '0.2px solid #b08d57' : '0.2px solid #ccc', padding: '0.4px 1px', borderRadius: 0.8, color: '#1a1a1a' }} aria-label="Callout" />
                  </foreignObject>
                </g>
              )}
              {sel === a.id && a.kind === 'line' && a.pts.map((p, i) => (
                <rect key={i} x={p.x - 0.8} y={p.y - 0.8} width={1.6} height={1.6} fill="#fff" stroke="#b08d57" strokeWidth={0.25} onPointerDown={(e) => dragAnn(e, a, i)} style={{ cursor: 'move' }} />
              ))}
            </g>
          ))}
          {draft && <polyline points={draft.map((p) => `${p.x},${p.y}`).join(' ')} fill="none" stroke="#b08d57" strokeWidth={0.5} pointerEvents="none" />}
        </FlatSketch>
      </div>
      <figcaption className="mt-1 text-center text-[10px] uppercase tracking-[0.18em] text-muted-foreground rtl:tracking-normal">{t(`pane.${view}`)}</figcaption>
    </figure>
  )
}
