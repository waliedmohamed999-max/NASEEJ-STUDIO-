import { useMemo, useState } from 'react'
import { Check, Plus, Search, SlidersHorizontal, X } from 'lucide-react'
import type { Construction, Fabric, Fiber, Season } from '@/types'
import { useFabrics } from '@/services/data/hooks'
import { supplierById } from '@/data/suppliers'
import { Button } from '@/components/ui/button'
import { Badge, Dialog, DialogContent, Input, Label, Segmented, Select, Slider } from '@/components/ui/primitives'
import { useDocumentTitle, useLang } from '@/hooks'
import { cn, formatCurrency, formatNumber } from '@/lib/utils'
import { MAX_COMPARE, toast, useCompare } from '@/stores/ui'
import { FabricSwatch, SustainabilityScore, useCompositionText } from './fabricUi'
import { FabricDetail } from './FabricDetail'
import { FabricCompare } from './FabricCompare'

type WeightBand = 'all' | 'light' | 'medium' | 'heavy'
type Sort = 'featured' | 'priceAsc' | 'priceDesc' | 'gsmAsc' | 'sustainDesc'

interface Filters {
  q: string
  fibers: Fiber[]
  constructions: Construction[]
  seasons: Season[]
  weight: WeightBand
  minSustain: number
  maxPrice: number
}

const PRICE_CAP = 70
const emptyFilters: Filters = { q: '', fibers: [], constructions: [], seasons: [], weight: 'all', minSustain: 0, maxPrice: PRICE_CAP }

const inBand = (gsm: number, b: WeightBand) =>
  b === 'all' || (b === 'light' && gsm < 150) || (b === 'medium' && gsm >= 150 && gsm <= 300) || (b === 'heavy' && gsm > 300)

export default function FabricLibraryPage() {
  const { t, l, lang } = useLang()
  useDocumentTitle(t('nav.fabrics'))
  const fabrics = useFabrics()
  const [f, setF] = useState<Filters>(emptyFilters)
  const [sort, setSort] = useState<Sort>('featured')
  const [openId, setOpenId] = useState<string | null>(null)
  const [compareOpen, setCompareOpen] = useState(false)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const compareIds = useCompare((s) => s.ids)
  const clearCompare = useCompare((s) => s.clear)

  const facets = useMemo(() => ({
    fibers: [...new Set(fabrics.flatMap((x) => Object.keys(x.composition) as Fiber[]))],
    constructions: [...new Set(fabrics.map((x) => x.construction))],
  }), [fabrics])

  const results = useMemo(() => {
    const q = f.q.trim().toLowerCase()
    const list = fabrics.filter((x) => {
      if (q) {
        const hay = [
          x.name.en, x.name.ar, l(x.description), supplierById(x.supplierId)?.name,
          ...Object.keys(x.composition).map((k) => t(`fiber.${k}`)), ...Object.keys(x.composition),
          t(`construction.${x.construction}`), x.construction,
        ].join(' ').toLowerCase()
        if (!hay.includes(q)) return false
      }
      if (f.fibers.length && !f.fibers.some((fi) => (x.composition[fi] ?? 0) > 0)) return false
      if (f.constructions.length && !f.constructions.includes(x.construction)) return false
      if (f.seasons.length && !f.seasons.some((s) => x.seasons.includes(s))) return false
      if (!inBand(x.gsm, f.weight)) return false
      if (x.sustainability < f.minSustain) return false
      if (f.maxPrice < PRICE_CAP && x.pricePerMeter > f.maxPrice) return false
      return true
    })
    const sorters: Record<Sort, (a: Fabric, b: Fabric) => number> = {
      featured: () => 0,
      priceAsc: (a, b) => a.pricePerMeter - b.pricePerMeter,
      priceDesc: (a, b) => b.pricePerMeter - a.pricePerMeter,
      gsmAsc: (a, b) => a.gsm - b.gsm,
      sustainDesc: (a, b) => b.sustainability - a.sustainability,
    }
    return [...list].sort(sorters[sort])
  }, [fabrics, f, sort, l, t])

  const activeCount =
    f.fibers.length + f.constructions.length + f.seasons.length + (f.weight !== 'all' ? 1 : 0) +
    (f.minSustain > 0 ? 1 : 0) + (f.maxPrice < PRICE_CAP ? 1 : 0)
  const open = fabrics.find((x) => x.id === openId)
  const compareFabrics = compareIds.map((id) => fabrics.find((x) => x.id === id)).filter(Boolean) as Fabric[]

  const filterPanel = (
    <FilterPanel f={f} setF={setF} facets={facets} activeCount={activeCount} />
  )

  return (
    <div className="pb-28">
      <section className="border-b border-border">
        <div className="container-x py-12 md:py-16">
          <p className="eyebrow animate-fade-up">{t('fabrics.eyebrow')}</p>
          <h1 className="mt-3 max-w-3xl text-4xl leading-[1.05] md:text-6xl animate-fade-up [animation-delay:80ms]">{t('fabrics.title')}</h1>
          <p className="mt-4 max-w-xl text-muted-foreground animate-fade-up [animation-delay:160ms]">{t('fabrics.subtitle')}</p>
        </div>
      </section>

      <div className="container-x grid gap-8 py-8 lg:grid-cols-[15rem_1fr]">
        <aside className="hidden lg:block">
          <div className="sticky top-24 max-h-[calc(100dvh-7rem)] overflow-auto pe-2 scroll-thin">{filterPanel}</div>
        </aside>

        <div>
          <div className="mb-6 flex flex-wrap items-center gap-3">
            <div className="relative min-w-[14rem] flex-1">
              <Search className="pointer-events-none absolute start-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={f.q}
                onChange={(e) => setF({ ...f, q: e.target.value })}
                placeholder={t('fabrics.searchPlaceholder')}
                className="ps-10"
                aria-label={t('common.search')}
              />
            </div>
            <Button variant="outline" size="md" className="lg:hidden" onClick={() => setFiltersOpen(true)}>
              <SlidersHorizontal />{t('fabrics.filters')}{activeCount > 0 && <Badge tone="accent">{formatNumber(activeCount, lang)}</Badge>}
            </Button>
            <div className="flex items-center gap-2">
              <Label htmlFor="sort" className="sr-only">{t('fabrics.sort')}</Label>
              <Select id="sort" value={sort} onChange={(e) => setSort(e.target.value as Sort)} className="w-auto min-w-[11rem]">
                {(['featured', 'priceAsc', 'priceDesc', 'gsmAsc', 'sustainDesc'] as Sort[]).map((s) => (
                  <option key={s} value={s}>{t(`fabrics.sortOptions.${s}`)}</option>
                ))}
              </Select>
            </div>
            <p className="num w-full text-xs text-muted-foreground sm:w-auto sm:ms-auto" aria-live="polite">
              {t('common.results', { n: formatNumber(results.length, lang) })}
            </p>
          </div>

          {results.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border py-24 text-center">
              <p className="text-muted-foreground">{t('fabrics.noResults')}</p>
              <Button variant="link" onClick={() => setF(emptyFilters)} className="mt-2">{t('common.clear')}</Button>
            </div>
          ) : (
            <ul className="grid grid-cols-1 gap-x-5 gap-y-8 sm:grid-cols-2 xl:grid-cols-3">
              {results.map((fab, i) => (
                <li key={fab.id} className="animate-fade-up" style={{ animationDelay: `${Math.min(i, 9) * 40}ms` }}>
                  <FabricCard fabric={fab} onOpen={() => setOpenId(fab.id)} />
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Compare bar */}
      {compareIds.length > 0 && (
        <div className="fixed inset-x-0 bottom-4 z-30 flex justify-center px-4 animate-fade-up">
          <div className="flex items-center gap-3 rounded-full border border-border bg-background/95 p-2 ps-3 shadow-xl backdrop-blur">
            <div className="flex -space-x-2 rtl:space-x-reverse">
              {compareFabrics.map((cf) => (
                <FabricSwatch key={cf.id} fabric={cf} className="size-8 rounded-full border-2 border-background" tile={60} />
              ))}
              {Array.from({ length: MAX_COMPARE - compareFabrics.length }, (_, i) => (
                <span key={i} className="size-8 rounded-full border-2 border-dashed border-border bg-muted" />
              ))}
            </div>
            <span className="num hidden text-xs text-muted-foreground sm:inline">
              {t('fabrics.compareBar', { count: compareIds.length })}
            </span>
            <Button size="sm" onClick={() => setCompareOpen(true)}>{t('fabrics.compareCta')}</Button>
            <Button size="iconSm" variant="ghost" onClick={clearCompare} aria-label={t('common.clear')}><X /></Button>
          </div>
        </div>
      )}

      <Dialog open={!!open} onOpenChange={(o) => !o && setOpenId(null)}>
        {open && <DialogContent title={l(open.name)}><FabricDetail fabric={open} /></DialogContent>}
      </Dialog>
      <Dialog open={compareOpen} onOpenChange={setCompareOpen}>
        <DialogContent title={t('fabrics.compareTitle')}><FabricCompare fabrics={compareFabrics} /></DialogContent>
      </Dialog>
      <Dialog open={filtersOpen} onOpenChange={setFiltersOpen}>
        <DialogContent side="bottom" title={t('fabrics.filters')}><div className="p-5">{filterPanel}</div></DialogContent>
      </Dialog>
    </div>
  )
}

function FabricCard({ fabric, onOpen }: { fabric: Fabric; onOpen: () => void }) {
  const { t, l, lang } = useLang()
  const comp = useCompositionText()
  const ids = useCompare((s) => s.ids)
  const toggle = useCompare((s) => s.toggle)
  const inCompare = ids.includes(fabric.id)
  const supplier = supplierById(fabric.supplierId)
  return (
    <article className="group">
      <button onClick={onOpen} className="block w-full text-start" aria-label={l(fabric.name)}>
        <div className="relative aspect-[4/3] overflow-hidden rounded-2xl bg-muted">
          <FabricSwatch fabric={fabric} className="absolute inset-0 transition-transform duration-700 ease-out group-hover:scale-110" />
          <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/25 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
          <span className="num absolute start-3 top-3 rounded-full bg-background/90 px-2.5 py-1 text-[0.7rem] font-medium backdrop-blur">
            {formatNumber(fabric.gsm, lang)} g/m²
          </span>
        </div>
      </button>
      <div className="mt-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <button onClick={onOpen} className="text-start">
            <h3 className="text-xl leading-tight transition-colors group-hover:text-accent-ink">{l(fabric.name)}</h3>
          </button>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">{comp(fabric)}</p>
        </div>
        <SustainabilityScore value={fabric.sustainability} />
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        <Badge>{t(`construction.${fabric.construction}`)}</Badge>
        {fabric.stretchPct > 0 && <Badge>{t('fabrics.specs.stretch')} {formatNumber(fabric.stretchPct, lang)}%</Badge>}
        <Badge>{t('fabrics.specs.drape')} {formatNumber(fabric.drape, lang)}/5</Badge>
      </div>
      <div className="mt-3 flex items-center justify-between border-t border-border pt-3">
        <div className="text-xs text-muted-foreground">{supplier?.name}</div>
        <div className="flex items-center gap-2">
          <span className="num text-sm font-medium">{formatCurrency(fabric.pricePerMeter, lang)}<span className="text-muted-foreground"> {t('common.perMeter')}</span></span>
          <Button
            size="iconSm"
            variant={inCompare ? 'primary' : 'outline'}
            aria-pressed={inCompare}
            aria-label={inCompare ? t('fabrics.inCompare') : t('fabrics.addCompare')}
            title={inCompare ? t('fabrics.inCompare') : t('fabrics.addCompare')}
            onClick={() => { if (!toggle(fabric.id)) toast(t('fabrics.compareMax')) }}
          >
            {inCompare ? <Check /> : <Plus />}
          </Button>
        </div>
      </div>
    </article>
  )
}

function FilterPanel({
  f, setF, facets, activeCount,
}: { f: Filters; setF: (f: Filters) => void; facets: { fibers: Fiber[]; constructions: Construction[] }; activeCount: number }) {
  const { t, lang } = useLang()
  const toggleIn = <K extends 'fibers' | 'constructions' | 'seasons'>(key: K, v: Filters[K][number]) => {
    const arr = f[key] as string[]
    setF({ ...f, [key]: arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v] })
  }
  const Chip = ({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) => (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        'h-7 rounded-full border px-3 text-[0.72rem] transition-colors',
        active ? 'border-foreground bg-foreground text-background' : 'border-border text-muted-foreground hover:border-foreground/40 hover:text-foreground',
      )}
    >
      {children}
    </button>
  )
  return (
    <div className="space-y-7">
      <div className="flex items-center justify-between">
        <h2 className="font-sans text-sm font-semibold">{t('fabrics.filters')}</h2>
        {activeCount > 0 && <Button variant="link" size="sm" onClick={() => setF({ ...emptyFilters, q: f.q })}>{t('common.clear')}</Button>}
      </div>
      <FilterGroup title={t('fabrics.fiber')}>
        {facets.fibers.map((x) => <Chip key={x} active={f.fibers.includes(x)} onClick={() => toggleIn('fibers', x)}>{t(`fiber.${x}`)}</Chip>)}
      </FilterGroup>
      <FilterGroup title={t('fabrics.weight')}>
        <Segmented<WeightBand>
          size="sm"
          value={f.weight}
          onChange={(weight) => setF({ ...f, weight: f.weight === weight ? 'all' : weight })}
          options={(['light', 'medium', 'heavy'] as const).map((w) => ({ value: w, label: t(`fabrics.weightBands.${w}`) }))}
        />
      </FilterGroup>
      <FilterGroup title={t('fabrics.construction')}>
        {facets.constructions.map((x) => <Chip key={x} active={f.constructions.includes(x)} onClick={() => toggleIn('constructions', x)}>{t(`construction.${x}`)}</Chip>)}
      </FilterGroup>
      <FilterGroup title={t('fabrics.season')}>
        {(['spring', 'summer', 'autumn', 'winter'] as Season[]).map((x) => <Chip key={x} active={f.seasons.includes(x)} onClick={() => toggleIn('seasons', x)}>{t(`season.${x}`)}</Chip>)}
      </FilterGroup>
      <div className="space-y-3">
        <div className="flex justify-between text-xs"><span className="font-medium">{t('fabrics.sustainability')}</span><span className="num text-muted-foreground">{formatNumber(f.minSustain, lang)}+</span></div>
        <Slider value={[f.minSustain]} min={0} max={90} step={5} onValueChange={([v]) => setF({ ...f, minSustain: v })} aria-label={t('fabrics.sustainability')} />
      </div>
      <div className="space-y-3">
        <div className="flex justify-between text-xs"><span className="font-medium">{t('fabrics.price')}</span><span className="num text-muted-foreground">{f.maxPrice >= PRICE_CAP ? '∞' : formatCurrency(f.maxPrice, lang)}</span></div>
        <Slider value={[f.maxPrice]} min={5} max={PRICE_CAP} step={1} onValueChange={([v]) => setF({ ...f, maxPrice: v })} aria-label={t('fabrics.price')} />
      </div>
    </div>
  )
}

function FilterGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset>
      <legend className="mb-2.5 text-xs font-medium">{title}</legend>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </fieldset>
  )
}
