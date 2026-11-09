import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Copy, EyeOff, Eye, FlipHorizontal2, Lock, Trash2, Unlock, Upload, X } from 'lucide-react'
import { useFabrics } from '@/services/data/hooks'
import { fabricById } from '@/data/fabrics'
import { cn, lt, uid } from '@/lib/utils'
import type { PrintPattern } from '@/types'
import { useWorkspace, useActiveStyle } from './store'
import { fmtLen, toUnit, fromUnit } from './render'
import { updatePiece, updatePieces, mirrorPiece, unfoldPiece, duplicateSelection, deleteSelection, useWsUi } from './actions'
import { edgeLength, sewnLength, flatten, area, bbox, dist, widthAtY, dartIntakeAtY } from './model/geometry'
import { GRADE_RULES, gradeStyle, sizeLabel } from './model/grading'
import { deriveSpec } from './model/spec'
import { fabricPhysics } from './model/physics'
import { COLOR_CATALOGUE, nearestCatalogue } from './model/colors'
import { trimById } from './model/trims'
import {
  SIZES, type EdgeTag, type FabricLayer, type Material, type PatternPiece, type PieceRole, type RepeatType, type SizeSystem, type StitchType, type Style, type StyleStatus,
} from './model/types'
import { FabricSwatch } from '@/features/fabrics/fabricUi'

/* ------------------------------------------------------------------ */
/* Controls                                                           */
/* ------------------------------------------------------------------ */
export function NumField({
  value, onChange, step = 0.1, min, max, suffix, label, digits = 2, length = false, id,
}: { value: number; onChange: (v: number) => void; step?: number; min?: number; max?: number; suffix?: string; label?: string; digits?: number; length?: boolean; id?: string }) {
  const units = useWorkspace((s) => s.units)
  const shown = length ? toUnit(value, units) : value
  const [txt, setTxt] = useState(shown.toFixed(digits))
  const focused = useRef(false)
  useEffect(() => { if (!focused.current) setTxt((+shown.toFixed(digits)).toString()) }, [shown, digits])
  const commit = (raw: string) => {
    let v = Number(raw.replace(',', '.'))
    if (!Number.isFinite(v)) return
    if (length) v = fromUnit(v, units)
    if (min !== undefined) v = Math.max(min, v)
    if (max !== undefined) v = Math.min(max, v)
    onChange(v)
  }
  const sfx = suffix ?? (length ? (units === 'in' ? 'in' : 'cm') : '')
  return (
    <label className="flex min-w-0 items-center gap-1.5">
      {label && <span className="ws-label w-4 shrink-0 text-center">{label}</span>}
      <span className="relative min-w-0 flex-1">
        <input
          id={id}
          className="ws-input pe-7 text-end"
          inputMode="decimal"
          dir="ltr"
          value={txt}
          onFocus={() => { focused.current = true }}
          onBlur={() => { focused.current = false; commit(txt) }}
          onChange={(e) => { setTxt(e.target.value); commit(e.target.value) }}
          onKeyDown={(e) => {
            if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
              e.preventDefault()
              const s = (e.shiftKey ? 10 : 1) * step * (e.key === 'ArrowUp' ? 1 : -1)
              const nv = +(Number(txt) + s).toFixed(4)
              setTxt(String(nv)); commit(String(nv))
            }
            if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
          }}
          aria-label={label}
        />
        {sfx && <span className="pointer-events-none absolute end-1.5 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">{sfx}</span>}
      </span>
    </label>
  )
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[6.5rem_1fr] items-center gap-2 py-[3px]">
      <span className="ws-label truncate">{label}</span>
      <div className="min-w-0">{children}</div>
    </div>
  )
}

function Section({ title, children, action }: { title: string; children: ReactNode; action?: ReactNode }) {
  return (
    <section className="ws-section">
      <h3 className="ws-section-title">{title}{action}</h3>
      {children}
    </section>
  )
}

function Sel<T extends string>({ value, onChange, options, label }: { value: T; onChange: (v: T) => void; options: Array<{ value: T; label: string }>; label?: string }) {
  return (
    <select className="ws-input" value={value} onChange={(e) => onChange(e.target.value as T)} aria-label={label}>
      {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  )
}

/* ------------------------------------------------------------------ */

export function Inspector() {
  const { t } = useTranslation('ws')
  const style = useActiveStyle()
  const sel = useWorkspace((s) => s.sel)
  if (!style) return null
  const pieces = style.pieces.filter((p) => sel.pieces.includes(p.id))
  const seam = sel.seam ? style.seams.find((s) => s.id === sel.seam) : null
  const internalPiece = sel.internal ? style.pieces.find((p) => p.id === sel.internal!.piece) : null
  const internal = internalPiece?.internals.find((i) => i.id === sel.internal!.id)

  return (
    <div>
      {seam && <SeamSection style={style} seamId={seam.id} />}
      {internal && internalPiece && <InternalSection piece={internalPiece} id={internal.id} />}
      {pieces.length === 1 && sel.edge && <EdgeSection piece={pieces[0]} edgeId={sel.edge.edge} />}
      {pieces.length === 1 && sel.point && <PointSection piece={pieces[0]} pointId={sel.point.point} />}
      {pieces.length === 1 && <PieceSection piece={pieces[0]} />}
      {pieces.length > 1 && (
        <Section title={t('insp.pieces', { n: pieces.length })}>
          <div className="flex flex-wrap gap-1.5">
            <button className="ws-btn" onClick={duplicateSelection}><Copy />{t('insp.duplicate')}</button>
            <button className="ws-btn" onClick={deleteSelection}><Trash2 />{t('insp.delete')}</button>
          </div>
        </Section>
      )}
      {pieces.length > 0 && <MaterialSection style={style} pieces={pieces} />}
      {pieces.length === 0 && !seam && !internal && <StyleSection style={style} />}
    </div>
  )
}

/* ---------------- seam ---------------- */
function SeamSection({ style, seamId }: { style: Style; seamId: string }) {
  const { t, i18n } = useTranslation('ws')
  const w = useWorkspace()
  const units = w.units
  const s = style.seams.find((x) => x.id === seamId)!
  const lang = (i18n.resolvedLanguage ?? 'en').split('-')[0]
  const side = (r: { piece: string; edge: string }) => {
    const p = style.pieces.find((x) => x.id === r.piece)
    const i = p ? p.points.findIndex((q) => q.id === r.edge) : -1
    return p && i >= 0 ? { name: p.name[lang] ?? p.name.en, tag: p.edgeTags[r.edge], len: sewnLength(p, i) } : null
  }
  const a = side(s.a), b = side(s.b)
  const diff = a && b ? a.len - b.len : 0
  return (
    <Section title={`${t('insp.seams')} ${style.seams.indexOf(s) + 1}`}>
      {[a, b].map((x, i) => x && (
        <Row key={i} label={x.name}><span className="num">{x.tag ? t(`edgeTag.${x.tag}`) + ' · ' : ''}{fmtLen(x.len, units)}</span></Row>
      ))}
      <Row label={t('insp.mismatch')}>
        <span className={cn('num', Math.abs(diff) < 0.3 ? 'text-fit-good' : 'text-fit-tight')}>{diff > 0 ? '+' : ''}{fmtLen(diff, units)}</span>
      </Row>
      <Row label={t('insp.stitch')}>
        <Sel<StitchType> value={s.stitch} onChange={(v) => w.edit('Stitch type', (st) => ({ ...st, seams: st.seams.map((x) => (x.id === s.id ? { ...x, stitch: v } : x)) }))}
          options={(['301', '401', '504', '514', '406', 'topstitch1', 'topstitch2', 'blind'] as StitchType[]).map((v) => ({ value: v, label: t(`stitch.${v}`) }))} />
      </Row>
      <button className="ws-btn mt-2" onClick={deleteSelection}><Trash2 />{t('insp.delete')}</button>
    </Section>
  )
}

/* ---------------- internal marking ---------------- */
function InternalSection({ piece, id }: { piece: PatternPiece; id: string }) {
  const { t } = useTranslation('ws')
  const it = piece.internals.find((x) => x.id === id)!
  const set = (patch: Partial<typeof it>) => updatePiece('Edit marking', piece.id, (p) => ({ ...p, internals: p.internals.map((x) => (x.id === id ? { ...x, ...patch } : x)) }), `int:${id}`)
  const dartW = it.kind === 'dart' ? dist(it.pts[0], it.pts[2]) : 0
  const dartL = it.kind === 'dart' ? dist({ x: (it.pts[0].x + it.pts[2].x) / 2, y: (it.pts[0].y + it.pts[2].y) / 2 }, it.pts[1]) : 0
  return (
    <Section title={`${t('insp.internal')} · ${t(`tool.${it.kind === 'line' ? 'ruler' : it.kind}`)}`}>
      {it.kind === 'dart' && (
        <>
          <Row label={t('insp.depth')}>
            <NumField length value={dartW} step={0.1} min={0.2} onChange={(v) => {
              const [a, apex, b] = it.pts
              const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
              const u = { x: (b.x - a.x) / (dartW || 1), y: (b.y - a.y) / (dartW || 1) }
              set({ pts: [{ x: mid.x - u.x * v / 2, y: mid.y - u.y * v / 2 }, apex, { x: mid.x + u.x * v / 2, y: mid.y + u.y * v / 2 }] })
            }} />
          </Row>
          <Row label={t('insp.length')}><span className="num">{dartL.toFixed(1)} cm</span></Row>
        </>
      )}
      {(it.kind === 'pleat' || it.kind === 'tuck' || it.kind === 'gather' || it.kind === 'button') && (
        <Row label={it.kind === 'gather' ? 'Ratio' : it.kind === 'button' ? 'Ø mm' : t('insp.depth')}>
          <NumField value={it.size ?? 1} step={it.kind === 'button' ? 1 : 0.1} min={0.1} length={it.kind === 'pleat' || it.kind === 'tuck'} onChange={(v) => set({ size: v })} />
        </Row>
      )}
      <button className="ws-btn mt-2" onClick={deleteSelection}><Trash2 />{t('insp.delete')}</button>
    </Section>
  )
}

/* ---------------- edge ---------------- */
function EdgeSection({ piece, edgeId }: { piece: PatternPiece; edgeId: string }) {
  const { t } = useTranslation('ws')
  const units = useWorkspace((s) => s.units)
  const i = piece.points.findIndex((q) => q.id === edgeId)
  if (i < 0) return null
  const len = edgeLength(piece.points, i)
  const tag = piece.edgeTags[edgeId] ?? 'other'
  const ts = piece.topstitch.includes(edgeId)
  return (
    <Section title={t('insp.edge')}>
      <Row label={t('insp.length')}><span className="num">{fmtLen(len, units, 2)}</span></Row>
      <Row label={t('insp.tag')}>
        <Sel<EdgeTag> value={tag} onChange={(v) => updatePiece('Edge type', piece.id, (p) => ({ ...p, edgeTags: { ...p.edgeTags, [edgeId]: v } }))}
          options={(['neck', 'shoulder', 'armhole', 'side', 'hem', 'cf', 'cb', 'waist', 'cap', 'underarm', 'inseam', 'crotch', 'opening', 'band', 'other'] as EdgeTag[]).map((v) => ({ value: v, label: t(`edgeTag.${v}`) }))} />
      </Row>
      <Row label={t('insp.edgeSA')}>
        <NumField length value={piece.foldEdge === edgeId ? 0 : piece.edgeSA[edgeId] ?? piece.seamAllowance} min={0} max={8} step={0.1}
          onChange={(v) => updatePiece('Edge seam allowance', piece.id, (p) => ({ ...p, edgeSA: { ...p.edgeSA, [edgeId]: v } }), `esa:${edgeId}`)} />
      </Row>
      <Row label={t('insp.topstitch')}>
        <input type="checkbox" checked={ts} className="accent-[var(--accent)]"
          onChange={() => updatePiece('Topstitch', piece.id, (p) => ({ ...p, topstitch: ts ? p.topstitch.filter((x) => x !== edgeId) : [...p.topstitch, edgeId] }))} />
      </Row>
      <Row label={t('insp.onFold')}>
        <input type="checkbox" checked={piece.foldEdge === edgeId} className="accent-[var(--accent)]"
          onChange={() => (piece.foldEdge === edgeId ? updatePiece('Clear fold', piece.id, (p) => ({ ...p, foldEdge: null })) : updatePiece('Set fold', piece.id, (p) => ({ ...p, foldEdge: edgeId })))} />
      </Row>
    </Section>
  )
}

/* ---------------- point ---------------- */
function PointSection({ piece, pointId }: { piece: PatternPiece; pointId: string }) {
  const { t } = useTranslation('ws')
  const q = piece.points.find((x) => x.id === pointId)
  if (!q) return null
  const move = (dx: number, dy: number) => updatePiece('Move point', piece.id, (p) => ({
    ...p, points: p.points.map((v) => v.id === pointId ? {
      ...v, x: v.x + dx, y: v.y + dy,
      hin: v.hin && { x: v.hin.x + dx, y: v.hin.y + dy }, hout: v.hout && { x: v.hout.x + dx, y: v.hout.y + dy },
    } : v),
  }), `pt:${pointId}`)
  const smooth = !!(q.hin || q.hout)
  return (
    <Section title={t('insp.point')}>
      <div className="grid grid-cols-2 gap-2">
        <NumField label="x" length value={q.x} onChange={(v) => move(v - q.x, 0)} />
        <NumField label="y" length value={q.y} onChange={(v) => move(0, v - q.y)} />
      </div>
      <div className="mt-2 flex gap-1.5">
        <button className="ws-btn" data-variant={smooth ? 'solid' : undefined} onClick={() => !smooth && toggleSmooth(piece, pointId)}>{t('insp.smooth')}</button>
        <button className="ws-btn" data-variant={!smooth ? 'solid' : undefined} onClick={() => smooth && toggleSmooth(piece, pointId)}>{t('insp.corner')}</button>
      </div>
    </Section>
  )
}
function toggleSmooth(piece: PatternPiece, pointId: string) {
  updatePiece('Toggle smooth', piece.id, (p) => {
    const i = p.points.findIndex((v) => v.id === pointId)
    const q = p.points[i]
    const prev = p.points[(i - 1 + p.points.length) % p.points.length], next = p.points[(i + 1) % p.points.length]
    const pts = p.points.map((v) => ({ ...v }))
    if (q.hin || q.hout) { pts[i].hin = null; pts[i].hout = null } else {
      const dx = next.x - prev.x, dy = next.y - prev.y, L = Math.hypot(dx, dy) || 1
      pts[i].hin = { x: q.x - (dx / L) * dist(q, prev) / 3, y: q.y - (dy / L) * dist(q, prev) / 3 }
      pts[i].hout = { x: q.x + (dx / L) * dist(q, next) / 3, y: q.y + (dy / L) * dist(q, next) / 3 }
    }
    return { ...p, points: pts }
  })
}

/* ---------------- piece ---------------- */
function PieceSection({ piece }: { piece: PatternPiece }) {
  const { t, i18n } = useTranslation('ws')
  const units = useWorkspace((s) => s.units)
  const lang = (i18n.resolvedLanguage ?? 'en').split('-')[0]
  const set = (label: string, patch: Partial<PatternPiece>, key?: string) => updatePiece(label, piece.id, (p) => ({ ...p, ...patch }), key)
  const flat = useMemo(() => flatten(piece.points, 10), [piece.points])
  const b = bbox(flat)
  let per = 0
  for (let i = 0; i < piece.points.length; i++) per += edgeLength(piece.points, i)
  return (
    <Section title={t('insp.piece')} action={
      <span className="flex gap-0.5">
        <button className="ws-icon-btn !size-6" onClick={() => set(piece.locked ? 'Unlock' : 'Lock', { locked: !piece.locked })} aria-label={t('insp.lock')} title={t('insp.lock')} aria-pressed={piece.locked}>{piece.locked ? <Lock className="size-3" /> : <Unlock className="size-3" />}</button>
        <button className="ws-icon-btn !size-6" onClick={() => set('Hide', { visible: !piece.visible })} aria-label={t('insp.hide')} title={t('insp.hide')}>{piece.visible ? <Eye className="size-3" /> : <EyeOff className="size-3" />}</button>
      </span>
    }>
      <Row label={t('insp.name')}>
        <input className="ws-input" value={piece.name[lang] ?? piece.name.en} onChange={(e) => set('Rename piece', { name: { ...piece.name, [lang]: e.target.value } }, `name:${piece.id}`)} />
      </Row>
      <Row label={t('insp.role')}>
        <Sel<PieceRole> value={piece.role} onChange={(v) => set('Piece role', { role: v })}
          options={(['front', 'back', 'sleeve', 'collar', 'cuff', 'skirtFront', 'skirtBack', 'trouserFront', 'trouserBack', 'waistband', 'hood', 'pocket', 'facing', 'yoke', 'scarf', 'other'] as PieceRole[]).map((v) => ({ value: v, label: t(`role.${v}`) }))} />
      </Row>
      <Row label={t('insp.layer')}>
        <Sel<FabricLayer> value={piece.layer} onChange={(v) => set('Fabric layer', { layer: v })}
          options={(['shell', 'lining', 'interfacing', 'contrast'] as FabricLayer[]).map((v) => ({ value: v, label: t(`layer.${v}`) }))} />
      </Row>
      <Row label={t('insp.cut')}>
        <div className="flex items-center gap-2">
          <NumField value={piece.cut} step={1} min={1} max={12} digits={0} suffix="×" onChange={(v) => set('Cut quantity', { cut: Math.round(v) })} />
          {piece.foldEdge && <button className="ws-btn shrink-0" onClick={() => unfoldPiece(piece.id)}>{t('insp.unfold')}</button>}
        </div>
      </Row>
      <Row label={t('insp.position')}>
        <div className="grid grid-cols-2 gap-1.5">
          <NumField label="x" length value={piece.x} onChange={(v) => set('Move', { x: v }, 'move')} />
          <NumField label="y" length value={piece.y} onChange={(v) => set('Move', { y: v }, 'move')} />
        </div>
      </Row>
      <Row label={t('insp.rotation')}>
        <NumField value={piece.rotation} step={1} digits={1} suffix="°" onChange={(v) => set('Rotate', { rotation: ((v % 360) + 360) % 360 }, `rot:${piece.id}`)} />
      </Row>
      <Row label={t('insp.sa')}>
        <NumField length value={piece.seamAllowance} min={0} max={8} step={0.1} onChange={(v) => set('Seam allowance', { seamAllowance: v }, `sa:${piece.id}`)} />
      </Row>
      <dl className="mt-2 grid grid-cols-3 gap-2 rounded bg-muted/60 p-2 text-[10px]">
        <div><dt className="text-muted-foreground">W × H</dt><dd className="num">{toUnit(b.w, units).toFixed(1)} × {toUnit(b.h, units).toFixed(1)}</dd></div>
        <div><dt className="text-muted-foreground">{t('insp.area')}</dt><dd className="num">{(area(flat) / 10000).toFixed(3)} m²</dd></div>
        <div><dt className="text-muted-foreground">⟂</dt><dd className="num">{fmtLen(per, units)}</dd></div>
        {Object.entries(piece.marks).map(([k, y]) => (
          <div key={k}><dt className="text-muted-foreground">{k}</dt><dd className="num">{fmtLen(widthAtY(flat, y!) - dartIntakeAtY(piece.internals, y!), units)}</dd></div>
        ))}
      </dl>
      <div className="mt-2 flex flex-wrap gap-1.5">
        <button className="ws-btn" onClick={() => mirrorPiece(piece.id)}><FlipHorizontal2 />{t('insp.mirror')}</button>
        <button className="ws-btn" onClick={duplicateSelection}><Copy />{t('insp.duplicate')}</button>
        <button className="ws-btn" onClick={deleteSelection}><Trash2 />{t('insp.delete')}</button>
      </div>
    </Section>
  )
}

/* ---------------- material ---------------- */
function MaterialSection({ style, pieces }: { style: Style; pieces: PatternPiece[] }) {
  const { t, i18n } = useTranslation('ws')
  const fabrics = useFabrics()
  const lang = (i18n.resolvedLanguage ?? 'en').split('-')[0]
  const p0 = pieces[0]
  const m = p0.material
  const ids = pieces.map((p) => p.id)
  const fileRef = useRef<HTMLInputElement>(null)
  const setM = (label: string, patch: Partial<Material>, key?: string) => updatePieces(label, ids, (p) => ({ ...p, material: { ...p.material, ...patch } }), key)
  const fabric = fabricById(m.fabricId)
  const phys = fabric ? fabricPhysics(fabric) : null
  const color = m.color ?? fabric?.color ?? '#cccccc'
  const nearest = nearestCatalogue(color)
  const [catOpen, setCatOpen] = useState(false)

  const upload = (file: File) => {
    const reader = new FileReader()
    reader.onload = () => {
      const id = uid()
      useWorkspace.getState().edit('Upload artwork', (s) => ({
        ...s,
        artworks: [...s.artworks, { id, name: file.name, dataUrl: String(reader.result), widthCm: 24 }],
        pieces: s.pieces.map((p) => (ids.includes(p.id) ? { ...p, material: { ...p.material, artworkId: id } } : p)),
      }))
    }
    reader.readAsDataURL(file)
  }

  return (
    <>
      <Section title={t('insp.material')}>
        <div className="grid max-h-36 grid-cols-7 gap-1 overflow-auto p-0.5 scroll-thin">
          {fabrics.map((f) => (
            <button key={f.id} title={f.name[lang] ?? f.name.en} aria-label={f.name[lang] ?? f.name.en} aria-pressed={f.id === m.fabricId}
              onClick={() => setM('Apply fabric', { fabricId: f.id, color: null })}
              className={cn('aspect-square overflow-hidden rounded-sm border', f.id === m.fabricId ? 'border-accent ring-1 ring-accent' : 'border-border')}>
              <FabricSwatch fabric={f} className="size-full" tile={36} />
            </button>
          ))}
        </div>
        <p className="mt-1.5 truncate text-[11px]">{fabric?.name[lang] ?? fabric?.name.en}</p>

        <Row label={t('insp.color')}>
          <div className="flex items-center gap-1.5">
            <input type="color" value={color} onChange={(e) => setM('Colour', { color: e.target.value }, 'color')} className="h-6 w-8 cursor-pointer rounded border border-border bg-transparent" aria-label={t('insp.color')} />
            <button className="ws-btn min-w-0 flex-1 justify-start !px-1.5" onClick={() => setCatOpen((o) => !o)} title={t('insp.catalogue')}>
              <span className="size-3 shrink-0 rounded-sm border border-black/10" style={{ background: nearest.hex }} />
              <span className="truncate text-[10px]">{nearest.code} {nearest.name[lang === 'ar' ? 'ar' : 'en']}</span>
            </button>
            {m.color && <button className="ws-icon-btn !size-6" onClick={() => setM('Reset colour', { color: null })} aria-label="Reset"><X className="size-3" /></button>}
          </div>
        </Row>
        {catOpen && (
          <div className="mt-1 grid max-h-40 grid-cols-8 gap-1 overflow-auto rounded border border-border p-1.5 scroll-thin">
            {COLOR_CATALOGUE.map((c) => (
              <button key={c.code + c.hex} title={`${c.code} · ${c.name[lang === 'ar' ? 'ar' : 'en']}`} aria-label={c.name.en}
                className={cn('aspect-square rounded-sm border border-black/10', c.hex.toLowerCase() === color.toLowerCase() && 'ring-2 ring-accent')}
                style={{ background: c.hex }} onClick={() => setM('Colour', { color: c.hex })} />
            ))}
          </div>
        )}
        <Row label={t('insp.print')}>
          <Sel<PrintPattern> value={m.print} onChange={(v) => setM('Print', { print: v, artworkId: null })}
            options={(['none', 'stripes', 'checks', 'dots', 'houndstooth', 'floral', 'geometric'] as PrintPattern[]).map((v) => ({ value: v, label: i18n.t(`print.${v}`) }))} />
        </Row>
        {m.print !== 'none' && !m.artworkId && (
          <Row label={t('insp.printColor')}>
            <input type="color" value={m.printColor ?? '#1a1a1a'} onChange={(e) => setM('Print colour', { printColor: e.target.value }, 'pcolor')} className="h-6 w-8 cursor-pointer rounded border border-border bg-transparent" />
          </Row>
        )}
        <Row label={t('insp.artwork')}>
          <div className="flex gap-1.5">
            {m.artworkId ? (
              <>
                <select className="ws-input" value={m.artworkId} onChange={(e) => setM('Artwork', { artworkId: e.target.value })}>
                  {style.artworks.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
                <button className="ws-icon-btn !size-6 shrink-0" onClick={() => setM('Remove artwork', { artworkId: null })} aria-label={t('insp.removeArtwork')}><X className="size-3" /></button>
              </>
            ) : (
              <button className="ws-btn w-full" onClick={() => fileRef.current?.click()}><Upload />{t('insp.upload')}</button>
            )}
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); e.target.value = '' }} />
          </div>
        </Row>
        {m.artworkId && (
          <>
            <Row label={t('insp.repeat')}>
              <Sel<RepeatType> value={m.repeat} onChange={(v) => setM('Repeat', { repeat: v })}
                options={(['full', 'halfDrop', 'mirror', 'placement'] as RepeatType[]).map((v) => ({ value: v, label: t(`repeat.${v}`) }))} />
            </Row>
            <Row label="Artwork W">
              <NumField length value={style.artworks.find((a) => a.id === m.artworkId)?.widthCm ?? 24} min={1} step={0.5}
                onChange={(v) => useWorkspace.getState().edit('Artwork size', (s) => ({ ...s, artworks: s.artworks.map((a) => (a.id === m.artworkId ? { ...a, widthCm: v } : a)) }), 'artw')} />
            </Row>
          </>
        )}
        <Row label={t('insp.scale')}><NumField value={m.scale} min={0.1} max={8} step={0.05} suffix="×" onChange={(v) => setM('Pattern scale', { scale: v }, 'mscale')} /></Row>
        <Row label={t('insp.rotation')}><NumField value={m.rotation} step={1} digits={0} suffix="°" onChange={(v) => setM('Pattern rotation', { rotation: v }, 'mrot')} /></Row>
        <button className="ws-btn mt-2 w-full" onClick={() => {
          const src = p0.material
          useWorkspace.getState().edit('Apply material to all', (s) => ({ ...s, pieces: s.pieces.map((p) => (p.layer === 'shell' ? { ...p, material: { ...src } } : p)) }))
        }}>{t('insp.applyAll')}</button>
      </Section>

      {phys && (
        <Section title={t('insp.physics')}>
          <dl className="grid grid-cols-2 gap-x-3 gap-y-1">
            {([
              ['bending', `${phys.bending} µN·m`], ['weight', `${phys.weight} g/m²`], ['stretchWarp', `${phys.stretchWarp}%`],
              ['stretchWeft', `${phys.stretchWeft}%`], ['shear', `${phys.shear} N/m`], ['friction', `μ ${phys.friction}`], ['thickness', `${phys.thickness} mm`],
            ] as const).map(([k, v]) => (
              <div key={k} className="flex justify-between gap-2"><dt className="ws-label">{t(`insp.${k}`)}</dt><dd className="num text-[11px]">{v}</dd></div>
            ))}
          </dl>
        </Section>
      )}
    </>
  )
}

/* ---------------- style (nothing selected) ---------------- */
function StyleSection({ style }: { style: Style }) {
  const { t, i18n } = useTranslation('ws')
  const lang = (i18n.resolvedLanguage ?? 'en').split('-')[0]
  const L = (en: string, ar: string) => (lang === 'ar' ? ar : en)
  const w = useWorkspace()
  const ui = useWsUi()
  const units = w.units
  const rules = GRADE_RULES[style.sizeSystem]
  const specs = useMemo(() => SIZES.map((s) => ({ s, spec: deriveSpec(gradeStyle(style, s)) })), [style])
  const rowsFor = (sp: ReturnType<typeof deriveSpec>) => {
    const r: Array<[string, number]> = []
    if (sp.body) r.push([L('Bust', 'الصدر'), sp.body.bust], [L('Waist', 'الخصر'), sp.body.waist], [L('Hip', 'الأرداف'), sp.body.hip], [L('Hem', 'الذيل'), sp.body.hem], [L('Length', 'الطول'), sp.body.length])
    if (sp.skirt) r.push([L('Skirt waist', 'خصر التنورة'), sp.skirt.waist], [L('Skirt hem', 'ذيل التنورة'), sp.skirt.hem], [L('Skirt length', 'طول التنورة'), sp.skirt.length])
    if (sp.trousers) r.push([L('Waist', 'الخصر'), sp.trousers.waist], [L('Hip', 'الأرداف'), sp.trousers.hip], [L('Thigh', 'الفخذ'), sp.trousers.thigh], [L('Leg opening', 'فتحة الساق'), sp.trousers.hem], [L('Outseam', 'الطول الخارجي'), sp.trousers.length])
    if (sp.sleeve) r.push([L('Sleeve', 'الكم'), sp.sleeve.length], [L('Bicep', 'العضد'), sp.sleeve.bicep])
    return r
  }
  const base = rowsFor(specs.find((x) => x.s === style.baseSize)!.spec)
  return (
    <>
      <Section title={t('insp.style')}>
        <p className="mb-2 text-[11px] text-muted-foreground">{t('insp.noSelection')}</p>
        <Row label={t('insp.name')}><input className="ws-input" value={style.name} onChange={(e) => w.edit('Rename style', (s) => ({ ...s, name: e.target.value }), 'stylename')} /></Row>
        <Row label={t('insp.status')}>
          <Sel<StyleStatus> value={style.status} onChange={(v) => w.edit('Status', (s) => ({ ...s, status: v }))}
            options={(['concept', 'sampling', 'approved'] as StyleStatus[]).map((v) => ({ value: v, label: t(`status.${v}`) }))} />
        </Row>
        <Row label={t('insp.price')}><NumField value={style.targetPrice ?? 0} min={0} step={1} digits={0} suffix="$" onChange={(v) => w.edit('Target price', (s) => ({ ...s, targetPrice: v }), 'price')} /></Row>
      </Section>
      <Section title={t('insp.grading')}>
        <Row label={t('insp.system')}>
          <Sel<SizeSystem> value={style.sizeSystem} onChange={(v) => w.edit('Size system', (s) => ({ ...s, sizeSystem: v }))}
            options={(['EU', 'US', 'UK', 'GCC'] as SizeSystem[]).map((v) => ({ value: v, label: v }))} />
        </Row>
        <Row label={t('insp.base')}>
          <Sel value={style.baseSize} onChange={(v) => { w.edit('Base size', (s) => ({ ...s, baseSize: v })); w.set({ viewSize: v }) }}
            options={SIZES.map((s) => ({ value: s, label: `${s} · ${sizeLabel(style.sizeSystem, s)}` }))} />
        </Row>
        <Row label={t('menu.nest')}><input type="checkbox" checked={w.nest} onChange={() => w.set({ nest: !w.nest })} className="accent-[var(--accent)]" /></Row>
        <p className="mb-1 mt-2 ws-label">{t('insp.rules')}{lang === 'ar' ? '' : ` — ${rules.note}`}</p>
        <div className="overflow-x-auto scroll-thin">
          <table className="w-full text-[10px] num">
            <thead><tr className="text-muted-foreground"><th className="text-start font-normal" />{SIZES.slice(1).map((s, i) => <th key={s} className="font-normal">{SIZES[i]}→{s}</th>)}</tr></thead>
            <tbody>
              <tr><td className="text-muted-foreground">Girth</td>{rules.girth.map((g, i) => <td key={i} className="text-center">{toUnit(g, units).toFixed(1)}</td>)}</tr>
              <tr><td className="text-muted-foreground">Length</td>{rules.length.map((g, i) => <td key={i} className="text-center">{toUnit(g, units).toFixed(1)}</td>)}</tr>
            </tbody>
          </table>
        </div>
      </Section>
      <Section title={`${t('insp.measurements')} (${units})`}>
        <div className="overflow-x-auto scroll-thin">
          <table className="w-full text-[10px] num">
            <thead>
              <tr className="text-muted-foreground">
                <th className="text-start font-normal" />
                {SIZES.map((s) => <th key={s} className={cn('px-0.5 font-normal', s === style.baseSize && 'text-accent-ink')}>{sizeLabel(style.sizeSystem, s)}</th>)}
              </tr>
            </thead>
            <tbody>
              {base.map(([label], ri) => (
                <tr key={label + ri} className="border-t border-border">
                  <td className="py-0.5 text-muted-foreground">{label}</td>
                  {specs.map(({ s, spec }) => <td key={s} className={cn('px-0.5 text-center', s === style.baseSize && 'font-semibold')}>{toUnit(rowsFor(spec)[ri]?.[1] ?? 0, units).toFixed(1)}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>
      <Section title={t('insp.seams')}>
        <ul className="space-y-1">
          {style.seams.map((s, i) => (
            <li key={s.id}>
              <button className="flex w-full items-center justify-between rounded px-1 py-0.5 text-start hover:bg-muted" onClick={() => w.select({ seam: s.id })}>
                <span>{i + 1}. {lt(style.pieces.find((p) => p.id === s.a.piece)?.name, lang)} ↔ {lt(style.pieces.find((p) => p.id === s.b.piece)?.name, lang)}</span>
                <span className="text-[10px] text-muted-foreground">{s.stitch}</span>
              </button>
            </li>
          ))}
        </ul>
      </Section>
      <Section title={t('insp.trims')} action={<button className="text-[10px] normal-case tracking-normal text-accent-ink hover:underline" onClick={() => ui.open('trims')}>{t('menu.trims')}</button>}>
        {style.trims.length === 0 ? <p className="text-muted-foreground">{t('trims.empty')}</p> : (
          <ul className="space-y-1">{style.trims.map((u) => <li key={u.id} className="flex justify-between"><span>{lt(trimById(u.trimId)?.name, lang)}</span><span className="num">×{u.qty}</span></li>)}</ul>
        )}
      </Section>
      <Section title={t('insp.notes')}>
        <textarea className="ws-input !h-24 resize-y py-1" value={style.notes} onChange={(e) => w.edit('Notes', (s) => ({ ...s, notes: e.target.value }), 'notes')} />
      </Section>
    </>
  )
}


