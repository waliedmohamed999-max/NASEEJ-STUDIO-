import { useMemo, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import i18n from '@/i18n'
import { Printer, X } from 'lucide-react'
import { fabricById } from '@/data/fabrics'
import { countryName, lt } from '@/lib/utils'
import type { Fiber } from '@/types'
import { useActiveStyle, useBoards } from '../store'
import { FlatSketch } from '../panes/FlatSketch'
import { effectiveMaterial } from '../render'
import { deriveSpec, fabricUsage } from '../model/spec'
import { gradeStyle, GRADE_RULES, sizeLabel } from '../model/grading'
import { bbox, flatten, polyD, seamAllowanceOutline, pointOnEdge, edgeLength, pathD } from '../model/geometry'
import { trimById } from '../model/trims'
import { nearestCatalogue } from '../model/colors'
import { SIZES, type Style } from '../model/types'
import { useOutput } from './exports'

type Lang = 'en' | 'ar'

export function PrintViews() {
  const { mode, renders, close } = useOutput()
  const style = useActiveStyle()
  const [lang, setLang] = useState<Lang>(((i18n.resolvedLanguage ?? 'en').split('-')[0] === 'ar' ? 'ar' : 'en'))
  if (!mode || !style) return null
  const t = i18n.getFixedT(lang, 'ws')
  return createPortal(
    <div className="print-root fixed inset-0 z-[90] overflow-auto bg-[#d9d4ca]" dir={lang === 'ar' ? 'rtl' : 'ltr'} lang={lang}
      style={{ fontFamily: lang === 'ar' ? '"IBM Plex Sans Arabic", Inter, sans-serif' : 'Inter, "IBM Plex Sans Arabic", sans-serif' }}>
      <div className="no-print sticky top-0 z-10 flex items-center gap-2 border-b border-black/10 bg-[#f7f4ee] px-4 py-2 text-[12px] text-[#1a1a1a]">
        <strong className="font-display text-lg">{t(`out.${mode}`)}</strong>
        <span className="ms-4">{t('out.language')}</span>
        {(['en', 'ar'] as const).map((l) => (
          <button key={l} className="ws-btn" data-variant={lang === l ? 'solid' : undefined} onClick={() => setLang(l)}>{l === 'en' ? 'English' : 'العربية'}</button>
        ))}
        <button className="ws-btn ms-auto" data-variant="solid" onClick={() => window.print()}><Printer />{t('out.print')}</button>
        <button className="ws-icon-btn" onClick={close} aria-label={t('out.close')}><X className="size-4" /></button>
      </div>
      <div className="flex flex-col items-center gap-6 py-6">
        {mode === 'techpack' ? <TechPack style={style} renders={renders} lang={lang} /> : <Lookbook style={style} renders={renders} lang={lang} />}
      </div>
    </div>,
    document.body,
  )
}

/* ------------------------------------------------------------------ */
/* Shared                                                             */
/* ------------------------------------------------------------------ */
function Page({ children, n, total, title, style, lang, bleed = false }: { children: ReactNode; n: number; total: number; title?: string; style: Style; lang: Lang; bleed?: boolean }) {
  const t = i18n.getFixedT(lang, 'ws')
  return (
    <section className="print-page relative flex flex-col bg-white text-[#1a1a1a] shadow-xl" style={{ width: '297mm', height: '210mm', padding: bleed ? 0 : '12mm 14mm 10mm' }}>
      {!bleed && (
        <header className="mb-4 flex items-end justify-between border-b border-[#1a1a1a] pb-2">
          <div>
            <p className="text-[8pt] tracking-[0.3em] text-[#6e6a63] rtl:tracking-normal">NASEEJ STUDIO · {t('out.designer').toUpperCase()}</p>
            <h2 className="font-display text-[20pt] leading-tight">{title}</h2>
          </div>
          <div className="text-end text-[8pt] text-[#6e6a63]">
            <p className="font-medium text-[#1a1a1a]">{style.name}</p>
            <p>{style.sizeSystem} · {t('out.baseSize')} {style.baseSize} ({sizeLabel(style.sizeSystem, style.baseSize)}) · {new Date().toLocaleDateString(lang === 'ar' ? 'ar-EG' : 'en-GB')}</p>
          </div>
        </header>
      )}
      <div className="min-h-0 flex-1">{children}</div>
      {!bleed && <footer className="mt-2 flex justify-between text-[7pt] text-[#6e6a63]"><span>{style.id.toUpperCase()}</span><span>{t('out.page')} {n} / {total}</span></footer>}
    </section>
  )
}

const comp = (f: ReturnType<typeof fabricById>, lang: Lang) =>
  f ? Object.entries(f.composition).map(([k, v]) => `${v}% ${i18n.getFixedT(lang)(`fiber.${k as Fiber}`)}`).join(' · ') : ''

function measureRows(spec: ReturnType<typeof deriveSpec>, lang: Lang): Array<[string, number]> {
  const L = (en: string, ar: string) => (lang === 'ar' ? ar : en)
  const r: Array<[string, number]> = []
  if (spec.body) r.push([L('Bust (1/2 = flat)', 'الصدر'), spec.body.bust], [L('Waist', 'الخصر'), spec.body.waist], [L('Hip', 'الأرداف'), spec.body.hip], [L('Hem sweep', 'محيط الذيل'), spec.body.hem], [L('Length from HPS', 'الطول من الكتف'), spec.body.length])
  if (spec.skirt) r.push([L('Skirt waist', 'خصر التنورة'), spec.skirt.waist], [L('Skirt hip', 'أرداف التنورة'), spec.skirt.hip], [L('Skirt hem sweep', 'ذيل التنورة'), spec.skirt.hem], [L('Skirt length', 'طول التنورة'), spec.skirt.length])
  if (spec.trousers) r.push([L('Waist', 'الخصر'), spec.trousers.waist], [L('Hip', 'الأرداف'), spec.trousers.hip], [L('Thigh', 'الفخذ'), spec.trousers.thigh], [L('Leg opening', 'فتحة الساق'), spec.trousers.hem], [L('Front rise', 'الارتفاع'), spec.trousers.rise], [L('Outseam', 'الطول الخارجي'), spec.trousers.length])
  if (spec.sleeve) r.push([L('Sleeve length', 'طول الكم'), spec.sleeve.length], [L('Bicep', 'العضد'), spec.sleeve.bicep], [L('Sleeve opening', 'فتحة الكم'), spec.sleeve.opening])
  return r
}

/* ------------------------------------------------------------------ */
/* Tech pack                                                          */
/* ------------------------------------------------------------------ */
function TechPack({ style, renders, lang }: { style: Style; renders: string[]; lang: Lang }) {
  const t = i18n.getFixedT(lang, 'ws')
  const coll = useBoards((s) => s.collections.find((c) => c.id === style.collectionId))
  const specs = useMemo(() => SIZES.map((s) => ({ s, spec: deriveSpec(gradeStyle(style, s)) })), [style])
  const baseRows = measureRows(specs.find((x) => x.s === style.baseSize)!.spec, lang)
  const usage = fabricUsage(style, (id) => fabricById(id)?.widthCm ?? 145)
  const fabricCost = usage.reduce((a, u) => a + u.meters * (fabricById(u.fabricId)?.pricePerMeter ?? 0), 0)
  const trimCost = style.trims.reduce((a, u) => a + u.qty * (trimById(u.trimId)?.cost ?? 0), 0)
  const total = fabricCost + trimCost
  const pieceName = (id: string) => { const p = style.pieces.find((x) => x.id === id); return p ? lt(p.name, lang) : '' }
  const edgeName = (pid: string, eid: string) => { const p = style.pieces.find((x) => x.id === pid); const tag = p?.edgeTags[eid]; return tag ? t(`edgeTag.${tag}`) : '' }
  const N = 7

  return (
    <>
      {/* 1. Cover */}
      <Page n={1} total={N} title={t('out.cover')} style={style} lang={lang}>
        <div className="grid h-full grid-cols-[1.1fr_1fr] gap-8">
          <div className="flex items-center justify-center rounded bg-[#f7f4ee]">
            {renders[0] ? <img src={renders[0]} alt="" className="max-h-full object-contain" /> : <FlatSketch style={style} view="front" className="h-[85%] w-full" />}
          </div>
          <div className="flex flex-col justify-center gap-5">
            <h1 className="font-display text-[34pt] leading-none">{style.name}</h1>
            <dl className="grid grid-cols-[9rem_1fr] gap-y-2 text-[10pt]">
              <dt className="text-[#6e6a63]">{t('out.collection')}</dt><dd>{coll ? `${coll.name} · ${coll.season}` : '—'}</dd>
              <dt className="text-[#6e6a63]">{t('out.status')}</dt><dd>{t(`status.${style.status}`)}</dd>
              <dt className="text-[#6e6a63]">{t('out.sizeSystem')}</dt><dd>{style.sizeSystem} — {GRADE_RULES[style.sizeSystem].note}</dd>
              <dt className="text-[#6e6a63]">{t('out.baseSize')}</dt><dd>{style.baseSize} ({sizeLabel(style.sizeSystem, style.baseSize)})</dd>
              <dt className="text-[#6e6a63]">{t('out.pieces')}</dt><dd>{style.pieces.filter((p) => p.visible).length}</dd>
              <dt className="text-[#6e6a63]">{t('out.totalCost')}</dt><dd className="num">${total.toFixed(2)}</dd>
              {style.targetPrice ? <><dt className="text-[#6e6a63]">{t('out.target')}</dt><dd className="num">${style.targetPrice} · {t('out.margin')} {Math.round((1 - total / style.targetPrice) * 100)}%</dd></> : null}
            </dl>
            <div className="grid h-40 grid-cols-2 gap-2">
              <FlatSketch style={style} view="front" className="h-full w-full" />
              <FlatSketch style={style} view="back" className="h-full w-full" />
            </div>
          </div>
        </div>
      </Page>

      {/* 2. Flats */}
      <Page n={2} total={N} title={t('out.flats')} style={style} lang={lang}>
        <div className="grid h-full grid-cols-2 gap-8">
          {(['front', 'back'] as const).map((v) => (
            <figure key={v} className="flex flex-col">
              <FlatSketch style={style} view={v} filled={false} className="min-h-0 w-full flex-1">
                {style.annotations.filter((a) => a.view === v).map((a) => a.kind === 'line'
                  ? <polyline key={a.id} points={a.pts.map((p) => `${p.x},${p.y}`).join(' ')} fill="none" stroke="#1a1a1a" strokeWidth={0.45} strokeDasharray="1 0.7" />
                  : <g key={a.id}><line x1={a.pts[0].x} y1={a.pts[0].y} x2={a.pts[1].x} y2={a.pts[1].y} stroke="#b08d57" strokeWidth={0.3} /><text x={a.pts[1].x + 0.5} y={a.pts[1].y} fontSize={2.6}>{a.text}</text></g>)}
              </FlatSketch>
              <figcaption className="mt-1 text-center text-[8pt] uppercase tracking-widest text-[#6e6a63]">{t(`pane.${v}`)}</figcaption>
            </figure>
          ))}
        </div>
      </Page>

      {/* 3. Pattern pieces */}
      <Page n={3} total={N} title={t('out.pieces')} style={style} lang={lang}>
        <div className="grid h-full grid-cols-4 gap-3">
          {style.pieces.filter((p) => p.visible).map((p) => {
            const sa = seamAllowanceOutline(p)
            const b = bbox(sa.length ? sa : flatten(p.points, 8))
            return (
              <figure key={p.id} className="flex min-h-0 flex-col rounded border border-[#e3ddd2] p-2">
                <svg viewBox={`${b.minX - 2} ${b.minY - 2} ${b.w + 4} ${b.h + 4}`} className="min-h-0 w-full flex-1">
                  {sa.length > 0 && <path d={polyD(sa)} fill="none" stroke="#1a1a1a" strokeWidth={b.w / 220} />}
                  <path d={pathD(p.points)} fill="#f7f4ee" stroke="#1a1a1a" strokeWidth={b.w / 300} strokeDasharray={`${b.w / 80} ${b.w / 140}`} />
                  <line x1={p.grain[0].x} y1={p.grain[0].y} x2={p.grain[1].x} y2={p.grain[1].y} stroke="#1a1a1a" strokeWidth={b.w / 300} />
                  {p.notches.map((n) => { const i = p.points.findIndex((q) => q.id === n.edge); if (i < 0) return null; const { p: at, tangent } = pointOnEdge(p.points, i, n.t); return <line key={n.id} x1={at.x} y1={at.y} x2={at.x + tangent.y} y2={at.y - tangent.x} stroke="#1a1a1a" strokeWidth={b.w / 200} /> })}
                  {p.internals.map((it) => <polyline key={it.id} points={it.pts.map((v) => `${v.x},${v.y}`).join(' ')} fill="none" stroke="#6e6a63" strokeWidth={b.w / 300} />)}
                </svg>
                <figcaption className="mt-1 text-[7.5pt]">
                  <strong>{lt(p.name, lang)}</strong> · {t('out.cut')} {p.foldEdge ? `1 ${t('out.onFold')}` : p.cut} · {t('out.sa')} {p.seamAllowance} cm
                  <br /><span className="text-[#6e6a63]">{lt(fabricById(effectiveMaterial(style, p).fabricId)?.name, lang)} · {t(`layer.${p.layer}`)}</span>
                </figcaption>
              </figure>
            )
          })}
        </div>
      </Page>

      {/* 4. Measurements & grading */}
      <Page n={4} total={N} title={t('out.measurements')} style={style} lang={lang}>
        <table className="w-full border-collapse text-[9pt]">
          <thead>
            <tr className="border-b-2 border-[#1a1a1a]">
              <th className="py-1 text-start">{t('out.point')} (cm)</th>
              {SIZES.map((s) => <th key={s} className={s === style.baseSize ? 'bg-[#efe6d6]' : ''}>{s}<br /><span className="text-[7pt] font-normal text-[#6e6a63]">{style.sizeSystem} {sizeLabel(style.sizeSystem, s)}</span></th>)}
              <th>{t('out.tolerance')}</th>
            </tr>
          </thead>
          <tbody>
            {baseRows.map(([label], ri) => (
              <tr key={label + ri} className="border-b border-[#e3ddd2]">
                <td className="py-1">{label}</td>
                {specs.map(({ s, spec }) => <td key={s} className={`text-center num ${s === style.baseSize ? 'bg-[#efe6d6] font-semibold' : ''}`}>{(measureRows(spec, lang)[ri]?.[1] ?? 0).toFixed(1)}</td>)}
                <td className="text-center">± {ri < 3 ? '1.0' : '0.5'}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <h3 className="mt-5 text-[10pt] font-semibold">{t('out.rules')} — {style.sizeSystem}</h3>
        <table className="mt-1 text-[8.5pt]">
          <tbody>
            <tr><td className="pe-4 text-[#6e6a63]">Girth</td>{GRADE_RULES[style.sizeSystem].girth.map((g, i) => <td key={i} className="px-2 num">{SIZES[i]}→{SIZES[i + 1]} {g.toFixed(1)}</td>)}</tr>
            <tr><td className="pe-4 text-[#6e6a63]">Length</td>{GRADE_RULES[style.sizeSystem].length.map((g, i) => <td key={i} className="px-2 num">{g.toFixed(2)}</td>)}</tr>
          </tbody>
        </table>
      </Page>

      {/* 5. BOM */}
      <Page n={5} total={N} title={t('out.bom')} style={style} lang={lang}>
        <table className="w-full border-collapse text-[9pt]">
          <thead><tr className="border-b-2 border-[#1a1a1a] text-start">
            <th className="py-1 text-start">{t('out.fabric')}</th><th className="text-start">{t('out.composition')}</th><th>GSM</th><th>{t('out.width')}</th><th>{t('out.consumption')}</th><th>{t('out.unitPrice')}</th><th>{t('out.cost')}</th>
          </tr></thead>
          <tbody>
            {usage.map((u) => {
              const f = fabricById(u.fabricId)
              return (
                <tr key={u.fabricId} className="border-b border-[#e3ddd2]">
                  <td className="py-1">{lt(f?.name, lang)}<br /><span className="text-[7.5pt] text-[#6e6a63]">{f ? countryName(f.origin, lang) : ''}</span></td>
                  <td>{comp(f, lang)}</td><td className="text-center num">{f?.gsm}</td><td className="text-center num" dir="ltr">{f?.widthCm} cm</td>
                  <td className="text-center num" dir="ltr">{u.meters.toFixed(2)} m<br /><span className="text-[7pt] text-[#6e6a63]">{Math.round(u.efficiency * 100)}%</span></td><td className="text-center num">${f?.pricePerMeter.toFixed(2)}</td>
                  <td className="text-center num">${((f?.pricePerMeter ?? 0) * u.meters).toFixed(2)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
        <table className="mt-5 w-full border-collapse text-[9pt]">
          <thead><tr className="border-b-2 border-[#1a1a1a]"><th className="py-1 text-start">{t('out.trims')}</th><th className="text-start">{t('out.spec')}</th><th>{t('out.qty')}</th><th>{t('out.unitPrice')}</th><th>{t('out.cost')}</th></tr></thead>
          <tbody>
            {style.trims.map((u) => { const d = trimById(u.trimId); return d && (
              <tr key={u.id} className="border-b border-[#e3ddd2]"><td className="py-1">{lt(d.name, lang)}</td><td>{d.spec} · {d.material}</td><td className="text-center num">{u.qty} {d.unit}</td><td className="text-center num">${d.cost.toFixed(2)}</td><td className="text-center num">${(d.cost * u.qty).toFixed(2)}</td></tr>
            ) })}
            {!style.trims.length && <tr><td className="py-1 text-[#6e6a63]" colSpan={5}>—</td></tr>}
          </tbody>
        </table>
        <div className="mt-5 flex justify-end gap-10 text-[10pt]">
          <span>{t('out.totalCost')}: <strong className="num">${total.toFixed(2)}</strong></span>
          {style.targetPrice ? <span>{t('out.target')}: <strong className="num">${style.targetPrice}</strong> · {t('out.margin')} <strong>{Math.round((1 - total / style.targetPrice) * 100)}%</strong></span> : null}
        </div>
        <p className="mt-3 text-[7.5pt] text-[#6e6a63]">{t('out.markerNote')}</p>
      </Page>

      {/* 6. Construction */}
      <Page n={6} total={N} title={t('out.construction')} style={style} lang={lang}>
        <ol className="columns-2 gap-10 text-[9pt] leading-relaxed">
          {style.seams.map((s, i) => {
            const pa = style.pieces.find((p) => p.id === s.a.piece), pb = style.pieces.find((p) => p.id === s.b.piece)
            const ia = pa?.points.findIndex((q) => q.id === s.a.edge) ?? -1
            const len = pa && ia >= 0 ? edgeLength(pa.points, ia) : 0
            return (
              <li key={s.id} className="mb-1.5 break-inside-avoid">
                <strong>{i + 1}.</strong> {t('out.join', { a: `${pieceName(s.a.piece)} (${edgeName(s.a.piece, s.a.edge)})`, b: `${pieceName(s.b.piece)} (${edgeName(s.b.piece, s.b.edge)})` })}
                {' — '}{t(`stitch.${s.stitch}`)}, {t('out.sa')} {pa?.edgeSA[s.a.edge] ?? pa?.seamAllowance ?? 1} cm, {len.toFixed(1)} cm{pb ? '' : ''}
              </li>
            )
          })}
          {style.pieces.flatMap((p) => p.topstitch.map((e) => <li key={p.id + e} className="mb-1.5">● {t('out.topstitchNote', { piece: lt(p.name, lang), edge: p.edgeTags[e] ? t(`edgeTag.${p.edgeTags[e]}`) : '' })}</li>))}
        </ol>
        {style.notes && <><h3 className="mt-4 text-[10pt] font-semibold">{t('out.notes')}</h3><p className="whitespace-pre-wrap text-[9pt]">{style.notes}</p></>}
      </Page>

      {/* 7. Colourways */}
      <Page n={7} total={N} title={t('out.colorways')} style={style} lang={lang}>
        <div className="grid h-full grid-cols-4 gap-4">
          {[null, ...style.colorways.map((c) => c.id)].slice(0, 8).map((cw) => {
            const v = { ...style, activeColorway: cw }
            return (
              <figure key={cw ?? 'base'} className="flex min-h-0 flex-col">
                <FlatSketch style={v} view="front" className="min-h-0 w-full flex-1" />
                <figcaption className="mt-1 text-[8pt]">
                  <strong>{cw ? style.colorways.find((c) => c.id === cw)!.name : t('colorways.base')}</strong>
                  {style.pieces.filter((p) => p.layer === 'shell').slice(0, 3).map((p) => {
                    const m = effectiveMaterial(style, p, cw)
                    const hex = m.color ?? fabricById(m.fabricId)?.color ?? '#ccc'
                    const c = nearestCatalogue(hex)
                    return <span key={p.id} className="flex items-center gap-1 text-[7pt] text-[#6e6a63]"><i className="inline-block size-2 rounded-sm" style={{ background: hex }} />{lt(p.name, lang)}: {c.code} {lt(c.name, lang)}</span>
                  })}
                </figcaption>
              </figure>
            )
          })}
        </div>
      </Page>
    </>
  )
}

/* ------------------------------------------------------------------ */
/* Lookbook (editorial)                                               */
/* ------------------------------------------------------------------ */
function Lookbook({ style, renders, lang }: { style: Style; renders: string[]; lang: Lang }) {
  const t = i18n.getFixedT(lang, 'ws')
  const coll = useBoards((s) => s.collections.find((c) => c.id === style.collectionId))
  const upper = style.pieces[0]
  const fab = upper ? fabricById(effectiveMaterial(style, upper).fabricId) : undefined
  const views = renders.length ? renders : []
  const N = 3 + Math.max(0, views.length - 1)
  return (
    <>
      <Page n={1} total={N} style={style} lang={lang} bleed>
        <div className="relative grid h-full grid-cols-[1.25fr_1fr]">
          <div className="flex items-center justify-center bg-[#ece6dc]">
            {views[0] ? <img src={views[0]} alt="" className="h-full w-full object-cover" /> : <FlatSketch style={style} view="front" className="h-4/5 w-full" />}
          </div>
          <div className="flex flex-col justify-between bg-[#1a1a1a] p-[14mm] text-[#f7f4ee]">
            <p className="text-[8pt] tracking-[0.4em] text-[#b08d57] rtl:tracking-normal">NASEEJ STUDIO · {coll?.season ?? new Date().getFullYear()}</p>
            <div>
              <p className="text-[9pt] uppercase tracking-[0.3em] text-[#9d968c] rtl:tracking-normal">{coll?.name ?? t('out.lookbook')}</p>
              <h1 className="mt-2 font-display text-[44pt] italic leading-[0.95]">{style.name}</h1>
              <p className="mt-6 max-w-[80mm] text-[10pt] leading-relaxed text-[#d8d1c5]">{lt(fab?.description, lang)}</p>
            </div>
            <p className="text-[8pt] text-[#9d968c]">{lt(fab?.name, lang)} — {comp(fab, lang)}</p>
          </div>
        </div>
      </Page>
      {views.slice(1).map((src, i) => (
        <Page key={i} n={i + 2} total={N} style={style} lang={lang} bleed>
          <div className="grid h-full grid-cols-[1fr_1.4fr]">
            <div className="flex flex-col justify-end p-[14mm]">
              <p className="font-display text-[60pt] leading-none text-[#e3ddd2]">{String(i + 2).padStart(2, '0')}</p>
              <p className="mt-3 text-[8pt] uppercase tracking-[0.3em] text-[#6e6a63] rtl:tracking-normal">{t('out.look')} {i + 2}</p>
              <p className="mt-2 font-display text-[18pt]">{style.name}</p>
            </div>
            <img src={src} alt="" className="h-full w-full bg-[#ece6dc] object-cover" />
          </div>
        </Page>
      ))}
      <Page n={N - 1} total={N} title={t('out.colorways')} style={style} lang={lang}>
        <div className="grid h-full grid-cols-4 gap-6">
          {[null, ...style.colorways.map((c) => c.id)].slice(0, 8).map((cw) => (
            <figure key={cw ?? 'base'} className="flex min-h-0 flex-col">
              <FlatSketch style={{ ...style, activeColorway: cw }} view="front" className="min-h-0 w-full flex-1" />
              <figcaption className="mt-2 text-center font-display text-[12pt] italic">{cw ? style.colorways.find((c) => c.id === cw)!.name : t('colorways.base')}</figcaption>
            </figure>
          ))}
        </div>
      </Page>
      <Page n={N} total={N} style={style} lang={lang} bleed>
        <div className="flex h-full flex-col items-center justify-center bg-[#f7f4ee]">
          <p className="font-display text-[30pt] tracking-[0.3em] rtl:tracking-normal">NASEEJ</p>
          <p className="mt-1 text-[8pt] tracking-[0.5em] text-[#6e6a63] rtl:tracking-normal">FROM FIBER TO FIT</p>
          <div className="mt-10 grid h-[80mm] w-[150mm] grid-cols-2 gap-4">
            <FlatSketch style={style} view="front" filled={false} className="h-full w-full" />
            <FlatSketch style={style} view="back" filled={false} className="h-full w-full" />
          </div>
        </div>
      </Page>
    </>
  )
}
