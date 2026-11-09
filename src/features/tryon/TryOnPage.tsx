import { lazy, Suspense, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Box, Camera, Columns2, Image as ImageIcon, Link2, RotateCw, Save, Thermometer, Trash2, Upload } from 'lucide-react'
import type { Body, GarmentType } from '@/types'
import { garments, garmentById, sizeChart, type SizeCode } from '@/data/garments'
import { fabricById } from '@/data/fabrics'
import { useFabrics } from '@/services/data/hooks'
import { getTryOnProvider } from '@/services/tryon'
import { useTryOn, type Look } from '@/stores/tryon'
import { toast } from '@/stores/ui'
import { recommendSize, zoneFits } from '@/lib/textile'
import { Button } from '@/components/ui/button'
import { Badge, Dialog, DialogContent, Label, Segmented, Select, Slider, Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/primitives'
import { useDocumentTitle, useLang } from '@/hooks'
import { cn, formatNumber } from '@/lib/utils'
import { FabricSwatch } from '@/features/fabrics/fabricUi'
import { fabricBehaviour } from './avatarModel'
import { SceneFallback } from './SceneFallback'

const AvatarScene = lazy(() => import('./AvatarScene'))

export default function TryOnPage() {
  const { t } = useLang()
  useDocumentTitle(t('tryon.title'))
  const [params, setParams] = useSearchParams()
  const store = useTryOn()

  // Deep links: ?g=dress&f=fab-id&c=%23hex&s=M
  useEffect(() => {
    const g = params.get('g') as GarmentType | null
    const f = params.get('f')
    const c = params.get('c')
    const s = params.get('s') as SizeCode | null
    if (!g && !f && !c && !s) return
    const patch: Parameters<typeof store.set>[0] = {}
    if (g && garmentById(g)) patch.garmentId = g
    if (f && fabricById(f)) { patch.fabricId = f; patch.color = c && /^#[0-9a-f]{3,8}$/i.test(c) ? c : null }
    if (s && sizeChart.some((x) => x.size === s)) { patch.size = s; patch.sizeLocked = true }
    store.set(patch)
    setParams({}, { replace: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="flex flex-1 flex-col">
      <div className="border-b border-border">
        <div className="container-x flex flex-wrap items-end justify-between gap-4 py-6">
          <div>
            <h1 className="text-3xl md:text-4xl">{t('tryon.title')}</h1>
            <p className="mt-1 text-sm text-muted-foreground">{t('tryon.subtitle')}</p>
          </div>
        </div>
      </div>
      <Tabs defaultValue="avatar" className="flex flex-1 flex-col">
        <div className="container-x pt-4">
          <TabsList>
            <TabsTrigger value="avatar"><Box />{t('tryon.modes.avatar')}</TabsTrigger>
            <TabsTrigger value="photo"><ImageIcon />{t('tryon.modes.photo')}</TabsTrigger>
            <TabsTrigger value="ar"><Camera />{t('tryon.modes.ar')}</TabsTrigger>
          </TabsList>
        </div>
        <TabsContent value="avatar" className="flex-1"><AvatarMode /></TabsContent>
        <TabsContent value="photo" className="flex-1"><PhotoMode /></TabsContent>
        <TabsContent value="ar" className="flex-1"><ArMode /></TabsContent>
      </Tabs>
    </div>
  )
}

/* ------------------------------ Avatar mode ------------------------------ */

function AvatarMode() {
  const { t, l, lang } = useLang()
  const s = useTryOn()
  const fabrics = useFabrics()
  const garment = garmentById(s.garmentId)!
  const fabric = fabricById(s.fabricId) ?? fabrics[0]
  const recommended = useMemo(() => recommendSize(s.body, garment, fabric), [s.body, garment, fabric])
  const size = s.sizeLocked ? s.size : recommended
  const fits = useMemo(() => zoneFits(s.body, garment, fabric, size), [s.body, garment, fabric, size])
  const beh = fabricBehaviour(fabric)
  const [compare, setCompare] = useState<Look | null>(null)
  const [compareOpen, setCompareOpen] = useState(false)

  function share() {
    const url = new URL(window.location.origin + '/try-on')
    url.searchParams.set('g', s.garmentId)
    url.searchParams.set('f', s.fabricId)
    if (s.color) url.searchParams.set('c', s.color)
    url.searchParams.set('s', size)
    navigator.clipboard?.writeText(url.toString()).then(() => toast(t('tryon.linkCopied')), () => toast(url.toString()))
  }

  return (
    <div className="container-x grid gap-6 py-6 lg:grid-cols-[17rem_1fr_19rem]">
      {/* Body */}
      <aside className="order-2 space-y-5 lg:order-1">
        <h2 className="eyebrow font-sans">{t('tryon.body')}</h2>
        <BodySlider k="heightCm" label={t('tryon.height')} unit={t('common.cm')} min={145} max={200} />
        <BodySlider k="weightKg" label={t('tryon.weight')} unit={t('common.kg')} min={40} max={130} />
        <BodySlider k="bustCm" label={t('tryon.bust')} unit={t('common.cm')} min={72} max={130} />
        <BodySlider k="waistCm" label={t('tryon.waist')} unit={t('common.cm')} min={55} max={125} />
        <BodySlider k="hipsCm" label={t('tryon.hips')} unit={t('common.cm')} min={78} max={140} />
        <div>
          <p className="mb-2 text-xs font-medium">{t('tryon.shape')}</p>
          <Segmented<Body['shape']>
            size="sm"
            value={s.body.shape}
            onChange={(shape) => s.setBody({ shape })}
            options={(['hourglass', 'pear', 'apple', 'rectangle', 'invertedTriangle'] as const).map((v) => ({ value: v, label: t(`tryon.shapes.${v}`) }))}
          />
        </div>
      </aside>

      {/* Stage */}
      <section className="order-1 lg:order-2">
        <div className="relative h-[68vh] min-h-[28rem] overflow-hidden rounded-3xl border border-border bg-gradient-to-b from-surface to-muted">
          <Suspense fallback={<SceneFallback />}>
            <AvatarScene body={s.body} garment={garment} fabric={fabric} color={s.color} size={size} heatmap={s.heatmap} autoRotate={s.autoRotate} />
          </Suspense>
          <div className="absolute start-4 top-4 flex flex-wrap gap-2">
            <Button size="sm" variant={s.heatmap ? 'primary' : 'outline'} className="bg-background/80 backdrop-blur data-[on=true]:bg-foreground" data-on={s.heatmap} onClick={() => s.set({ heatmap: !s.heatmap })} aria-pressed={s.heatmap}>
              <Thermometer />{t('tryon.heatmap')}
            </Button>
            <Button size="sm" variant="outline" className={cn('backdrop-blur', s.autoRotate ? 'bg-foreground text-background hover:bg-foreground/85' : 'bg-background/80')} onClick={() => s.set({ autoRotate: !s.autoRotate })} aria-pressed={s.autoRotate}>
              <RotateCw />{t('tryon.autoRotate')}
            </Button>
          </div>
          {s.heatmap && (
            <div className="absolute bottom-4 start-4 flex gap-3 rounded-full bg-background/85 px-4 py-2 text-xs backdrop-blur animate-fade-in">
              {(['tight', 'good', 'loose'] as const).map((k) => (
                <span key={k} className="flex items-center gap-1.5">
                  <span className={cn('size-2.5 rounded-full', k === 'tight' ? 'bg-fit-tight' : k === 'good' ? 'bg-fit-good' : 'bg-fit-loose')} />
                  {t(`tryon.fit.${k}`)}
                </span>
              ))}
            </div>
          )}
          <p className="pointer-events-none absolute bottom-4 end-4 text-[0.7rem] text-muted-foreground">{t('tryon.dragHint')}</p>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button size="sm" onClick={() => { s.saveLook(`${l(garment.name)} · ${l(fabric.name)}`); toast(t('tryon.lookSaved')) }}><Save />{t('tryon.saveLook')}</Button>
          <Button size="sm" variant="outline" onClick={share}><Link2 />{t('tryon.share')}</Button>
          <Button size="sm" variant="outline" onClick={() => setCompareOpen(true)}><Columns2 />{t('tryon.compare')}</Button>
        </div>
        <SavedLooks onCompare={(look) => { setCompare(look); setCompareOpen(true) }} />
      </section>

      {/* Garment, fabric, fit */}
      <aside className="order-3 space-y-6">
        <div>
          <Label htmlFor="garment" className="mb-2 block">{t('tryon.garment')}</Label>
          <Select id="garment" value={s.garmentId} onChange={(e) => s.set({ garmentId: e.target.value as GarmentType })}>
            {garments.map((g) => <option key={g.id} value={g.id}>{l(g.name)}</option>)}
          </Select>
        </div>
        <div>
          <p className="mb-2 text-xs font-medium text-muted-foreground">{t('tryon.fabric')}</p>
          <div className="grid max-h-44 grid-cols-6 gap-1.5 overflow-auto p-0.5 scroll-thin">
            {fabrics.map((f) => (
              <button
                key={f.id}
                onClick={() => s.set({ fabricId: f.id, color: null })}
                title={l(f.name)}
                aria-label={l(f.name)}
                aria-pressed={f.id === fabric.id}
                className={cn('aspect-square overflow-hidden rounded-md border-2', f.id === fabric.id ? 'border-accent' : 'border-transparent')}
              >
                <FabricSwatch fabric={f} className="size-full" tile={40} />
              </button>
            ))}
          </div>
          <div className="mt-3 rounded-xl bg-muted/60 p-3 text-xs">
            <p className="font-medium">{t('tryon.fabricBehaviour')}</p>
            <p className="mt-1 text-muted-foreground">
              {t('tryon.drapeNote', { fabric: l(fabric.name), drape: formatNumber(fabric.drape, lang), stretch: formatNumber(fabric.stretchPct, lang) })}
            </p>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-border">
              <div className="h-full rounded-full bg-foreground transition-all" style={{ width: `${(1 - beh.stiffness) * 100}%` }} />
            </div>
            <div className="mt-1 flex justify-between text-[0.65rem] text-muted-foreground">
              <span>{(t('fabrics.drapeLevels', { returnObjects: true }) as string[])[0]}</span>
              <span>{(t('fabrics.drapeLevels', { returnObjects: true }) as string[])[4]}</span>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-border p-4">
          <p className="eyebrow">{t('tryon.recommended')}</p>
          <p className="mt-1 font-display text-5xl">{recommended}</p>
          <p className="mt-1 text-xs text-muted-foreground">{t('tryon.recommendedBody')}</p>
          <div className="mt-4">
            <p className="mb-2 text-xs font-medium">{t('tryon.size')}</p>
            <Segmented<SizeCode>
              size="sm"
              value={size}
              onChange={(v) => s.set({ size: v, sizeLocked: v !== recommended })}
              options={sizeChart.map((x) => ({ value: x.size, label: x.size }))}
            />
          </div>
          <ul className="mt-4 space-y-2">
            {fits.map((f) => (
              <li key={f.zone} className="flex items-center justify-between text-sm">
                <span>{t(`tryon.zones.${f.zone}`)}</span>
                <span className="flex items-center gap-2">
                  <span className="num text-xs text-muted-foreground">{t('tryon.ease')} {f.ease > 0 ? '+' : ''}{formatNumber(f.ease, lang, 1)} {t('common.cm')}</span>
                  <FitBadge status={f.status} />
                </span>
              </li>
            ))}
          </ul>
        </div>
      </aside>

      <Dialog open={compareOpen} onOpenChange={(o) => { setCompareOpen(o); if (!o) setCompare(null) }}>
        <DialogContent title={t('tryon.compare')}>
          <CompareLooks initialB={compare} currentSize={size} />
        </DialogContent>
      </Dialog>
    </div>
  )
}

function FitBadge({ status }: { status: 'tight' | 'good' | 'loose' }) {
  const { t } = useLang()
  return (
    <Badge className={cn(status === 'tight' && 'bg-fit-tight/12 text-fit-tight', status === 'good' && 'bg-fit-good/12 text-fit-good', status === 'loose' && 'bg-fit-loose/12 text-fit-loose')}>
      {t(`tryon.fit.${status}`)}
    </Badge>
  )
}

function BodySlider({ k, label, unit, min, max }: { k: 'heightCm' | 'weightKg' | 'bustCm' | 'waistCm' | 'hipsCm'; label: string; unit: string; min: number; max: number }) {
  const value = useTryOn((s) => s.body[k])
  const setBody = useTryOn((s) => s.setBody)
  // Slider updates locally while dragging and commits on release, so the 3D mesh rebuilds once.
  const [local, setLocal] = useState(value)
  useEffect(() => setLocal(value), [value])
  return (
    <div>
      <div className="mb-2 flex items-center justify-between text-xs">
        <span className="font-medium">{label}</span>
        <span className="flex items-center gap-1">
          <input
            type="text"
            inputMode="numeric"
            value={String(local)}
            onChange={(e) => { const v = Number(e.target.value.replace(/[^0-9]/g, '')); if (!Number.isNaN(v)) setLocal(v) }}
            onBlur={() => setBody({ [k]: Math.min(max, Math.max(min, local || min)) })}
            onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
            className="num w-14 rounded-md border border-transparent bg-transparent px-1 text-end hover:border-border focus:border-foreground/40 focus:outline-none"
            aria-label={label}
            dir="ltr"
          />
          <span className="text-muted-foreground">{unit}</span>
        </span>
      </div>
      <Slider value={[local]} min={min} max={max} step={1} onValueChange={([v]) => setLocal(v)} onValueCommit={([v]) => setBody({ [k]: v })} aria-label={label} />
    </div>
  )
}

function SavedLooks({ onCompare }: { onCompare: (l: Look) => void }) {
  const { t, l } = useLang()
  const { looks, removeLook, applyLook } = useTryOn()
  return (
    <div className="mt-6">
      <h2 className="eyebrow mb-3 font-sans">{t('tryon.savedLooks')}</h2>
      {looks.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('tryon.noLooks')}</p>
      ) : (
        <ul className="flex gap-3 overflow-x-auto pb-2 scroll-thin">
          {looks.map((look) => {
            const f = fabricById(look.fabricId)
            const g = garmentById(look.garmentId)
            if (!f || !g) return null
            return (
              <li key={look.id} className="w-40 shrink-0 overflow-hidden rounded-2xl border border-border">
                <button onClick={() => applyLook(look)} className="block w-full text-start" aria-label={look.name}>
                  <FabricSwatch fabric={f} color={look.color} className="h-20 w-full" tile={70} />
                  <span className="block px-3 pt-2 text-sm leading-tight">{l(g.name)}</span>
                  <span className="block truncate px-3 text-xs text-muted-foreground">{l(f.name)} · {look.size}</span>
                </button>
                <div className="flex justify-between px-1.5 pb-1.5">
                  <Button size="sm" variant="ghost" className="text-xs" onClick={() => onCompare(look)}><Columns2 />{t('common.compare')}</Button>
                  <Button size="iconSm" variant="ghost" onClick={() => removeLook(look.id)} aria-label={t('common.delete')}><Trash2 /></Button>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

function CompareLooks({ initialB, currentSize }: { initialB: Look | null; currentSize: SizeCode }) {
  const { t, l } = useLang()
  const s = useTryOn()
  const fabrics = useFabrics()
  const [b, setB] = useState<{ garmentId: GarmentType; fabricId: string; color: string | null; size: SizeCode }>(
    initialB ?? { garmentId: s.garmentId, fabricId: fabrics.find((f) => f.id !== s.fabricId)!.id, color: null, size: currentSize },
  )
  const a = { garmentId: s.garmentId, fabricId: s.fabricId, color: s.color, size: currentSize }
  const col = (look: typeof a, title: string, editable: boolean) => {
    const g = garmentById(look.garmentId)!
    const f = fabricById(look.fabricId)!
    return (
      <div className="flex flex-col">
        <div className="mb-2 flex items-baseline justify-between gap-2">
          <p className="eyebrow">{title}</p>
          <p className="truncate text-sm">{l(g.name)} · {l(f.name)} · {look.size}</p>
        </div>
        <div className="h-[52vh] overflow-hidden rounded-2xl border border-border bg-gradient-to-b from-surface to-muted">
          <Suspense fallback={<SceneFallback />}>
            <AvatarScene body={s.body} garment={g} fabric={f} color={look.color} size={look.size} heatmap={s.heatmap} autoRotate compact />
          </Suspense>
        </div>
        {editable && (
          <div className="mt-3 grid grid-cols-2 gap-2">
            <Select value={b.garmentId} onChange={(e) => setB({ ...b, garmentId: e.target.value as GarmentType })} aria-label={t('tryon.garment')}>
              {garments.map((x) => <option key={x.id} value={x.id}>{l(x.name)}</option>)}
            </Select>
            <Select value={b.fabricId} onChange={(e) => setB({ ...b, fabricId: e.target.value, color: null })} aria-label={t('tryon.fabric')}>
              {fabrics.map((x) => <option key={x.id} value={x.id}>{l(x.name)}</option>)}
            </Select>
          </div>
        )}
      </div>
    )
  }
  return (
    <div className="grid gap-5 p-5 md:grid-cols-2">
      {col(a, t('tryon.compareA'), false)}
      {col(b, t('tryon.compareB'), true)}
    </div>
  )
}

/* ------------------------------ Photo mode ------------------------------ */

function PhotoMode() {
  const { t, l } = useLang()
  const s = useTryOn()
  const fabrics = useFabrics()
  const provider = useMemo(() => getTryOnProvider(), [])
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [result, setResult] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const abort = useRef<AbortController | null>(null)

  useEffect(() => () => { abort.current?.abort(); if (preview) URL.revokeObjectURL(preview); if (result) URL.revokeObjectURL(result) }, [preview, result])

  async function run() {
    if (!file) return
    abort.current?.abort()
    abort.current = new AbortController()
    setLoading(true); setError(null)
    try {
      const res = await provider.photoTryOn({ personImage: file, garment: s.garmentId, fabric: fabricById(s.fabricId)!, color: s.color ?? undefined }, abort.current.signal)
      setResult(res.imageUrl)
    } catch (e) {
      if ((e as Error).name !== 'AbortError') setError((e as Error).message)
    } finally { setLoading(false) }
  }

  return (
    <div className="container-x grid gap-6 py-6 lg:grid-cols-[20rem_1fr]">
      <aside className="space-y-5">
        <div>
          <h2 className="text-2xl">{t('tryon.photo.title')}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{t('tryon.photo.body')}</p>
        </div>
        <label className="flex cursor-pointer flex-col items-center gap-2 rounded-2xl border border-dashed border-border p-6 text-center text-sm transition-colors hover:border-foreground/40">
          <Upload className="size-5 text-muted-foreground" />
          {file ? file.name : t('tryon.photo.upload')}
          <input
            type="file"
            accept="image/*"
            className="sr-only"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (!f) return
              setFile(f); setResult(null)
              setPreview(URL.createObjectURL(f))
            }}
          />
        </label>
        <div>
          <Label htmlFor="pg" className="mb-2 block">{t('tryon.garment')}</Label>
          <Select id="pg" value={s.garmentId} onChange={(e) => s.set({ garmentId: e.target.value as GarmentType })}>
            {garments.map((g) => <option key={g.id} value={g.id}>{l(g.name)}</option>)}
          </Select>
        </div>
        <div>
          <Label htmlFor="pf" className="mb-2 block">{t('tryon.fabric')}</Label>
          <Select id="pf" value={s.fabricId} onChange={(e) => s.set({ fabricId: e.target.value, color: null })}>
            {fabrics.map((f) => <option key={f.id} value={f.id}>{l(f.name)}</option>)}
          </Select>
        </div>
        <Button className="w-full" onClick={run} disabled={!file || loading}>{loading ? t('tryon.photo.generating') : t('tryon.photo.generate')}</Button>
        {!provider.isRealModel && <p className="rounded-xl bg-accent-soft p-3 text-xs text-foreground/80">{t('tryon.photo.mockNote')} {t('tryon.photo.privacy')}</p>}
        {error && <p className="text-sm text-fit-tight">{error}</p>}
      </aside>
      <div className="grid min-h-[28rem] gap-4 sm:grid-cols-2">
        <PhotoFrame src={preview} />
        <PhotoFrame src={result} loading={loading} />
      </div>
    </div>
  )
}

function PhotoFrame({ src, loading }: { src: string | null; loading?: boolean }) {
  return (
    <div className="relative flex items-center justify-center overflow-hidden rounded-3xl border border-border bg-muted/50">
      {src ? <img src={src} alt="" className="max-h-[70vh] w-full object-contain" /> : <ImageIcon className="size-8 text-border" />}
      {loading && <div className="absolute inset-0 flex items-center justify-center bg-background/60 backdrop-blur-sm"><SceneFallback /></div>}
    </div>
  )
}

/* ------------------------------ AR mode ------------------------------ */

function ArMode() {
  const { t } = useLang()
  const video = useRef<HTMLVideoElement>(null)
  const [stream, setStream] = useState<MediaStream | null>(null)
  const [error, setError] = useState(false)
  const s = useTryOn()
  const fabric = fabricById(s.fabricId)!

  useEffect(() => () => stream?.getTracks().forEach((tr) => tr.stop()), [stream])

  async function start() {
    try {
      setError(false)
      const ms = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: 1280, height: 720 }, audio: false })
      setStream(ms)
      if (video.current) { video.current.srcObject = ms; await video.current.play() }
    } catch { setError(true) }
  }
  function stop() {
    stream?.getTracks().forEach((tr) => tr.stop())
    setStream(null)
  }

  return (
    <div className="container-x grid gap-6 py-6 lg:grid-cols-[20rem_1fr]">
      <aside className="space-y-4">
        <h2 className="text-2xl">{t('tryon.ar.title')}</h2>
        <p className="text-sm text-muted-foreground">{t('tryon.ar.body')}</p>
        {stream ? <Button variant="outline" onClick={stop}>{t('tryon.ar.stop')}</Button> : <Button onClick={start}><Camera />{t('tryon.ar.start')}</Button>}
        {error && <p className="text-sm text-fit-tight">{t('tryon.ar.denied')}</p>}
        <p className="rounded-xl bg-accent-soft p-3 text-xs text-foreground/80">{t('tryon.ar.note')}</p>
      </aside>
      <div className="relative aspect-video overflow-hidden rounded-3xl border border-border bg-foreground/90">
        <video ref={video} playsInline muted className="size-full -scale-x-100 object-cover" />
        {stream && (
          <ArOverlay>
            <FabricSwatch fabric={fabric} color={s.color} className="size-full opacity-80 mix-blend-multiply" tile={90} />
          </ArOverlay>
        )}
      </div>
    </div>
  )
}

/** Static torso-anchored overlay until MediaPipe pose landmarks drive it. */
function ArOverlay({ children }: { children: ReactNode }) {
  return (
    <div
      className="pointer-events-none absolute start-1/2 top-[38%] h-[55%] w-[26%] -translate-x-1/2 rtl:translate-x-1/2"
      style={{ clipPath: 'polygon(22% 0, 78% 0, 100% 100%, 0 100%)' }}
    >
      {children}
    </div>
  )
}
