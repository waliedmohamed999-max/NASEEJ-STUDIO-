import { Link } from 'react-router-dom'
import { Box, PenTool, Package, Check, Plus } from 'lucide-react'
import type { Fabric } from '@/types'
import { supplierById } from '@/data/suppliers'
import { Button } from '@/components/ui/button'
import { Badge, DotMeter } from '@/components/ui/primitives'
import { useLang } from '@/hooks'
import { countryName, formatCurrency, formatNumber } from '@/lib/utils'
import { gsmToOz } from '@/lib/textile'
import { toast, useCompare } from '@/stores/ui'
import { FabricSwatch, SustainabilityScore, useCompositionText } from './fabricUi'

/** Full spec list for one fabric — used in the detail dialog and compare table. */
export function useSpecRows() {
  const { t, lang, l } = useLang()
  const comp = useCompositionText()
  const levels = t('fabrics.levels', { returnObjects: true }) as string[]
  const drapes = t('fabrics.drapeLevels', { returnObjects: true }) as string[]
  return (f: Fabric) => [
    { key: 'composition', value: comp(f) },
    { key: 'gsm', value: `${formatNumber(f.gsm, lang)} g/m² · ${formatNumber(gsmToOz(f.gsm), lang, 1)} oz/yd²` },
    { key: 'construction', value: t(`construction.${f.construction}`) },
    { key: 'width', value: `${formatNumber(f.widthCm, lang)} ${t('common.cm')}` },
    { key: 'stretch', value: `${formatNumber(f.stretchPct, lang)}%` },
    { key: 'drape', value: drapes[f.drape - 1], meter: f.drape },
    { key: 'breathability', value: levels[f.breathability - 1], meter: f.breathability },
    { key: 'shrinkage', value: `${formatNumber(f.shrinkagePct, lang)}%` },
    { key: 'care', value: f.care.map((c) => t(`care.${c}`)).join(' · ') },
    { key: 'sustainability', value: `${formatNumber(f.sustainability, lang)} / 100` },
    { key: 'certifications', value: f.certifications.join(' · ') },
    { key: 'origin', value: countryName(f.origin, lang) },
    { key: 'supplier', value: supplierById(f.supplierId)?.name ?? '—' },
    { key: 'seasons', value: f.seasons.map((s) => t(`season.${s}`)).join(' · ') },
    { key: 'price', value: `${formatCurrency(f.pricePerMeter, lang)} ${t('common.perMeter')}` },
    { key: '_desc', value: l(f.description) },
  ] as Array<{ key: string; value: string; meter?: number }>
}

export function FabricDetail({ fabric }: { fabric: Fabric }) {
  const { t, l } = useLang()
  const rows = useSpecRows()(fabric)
  const { ids, toggle } = useCompare()
  const inCompare = ids.includes(fabric.id)
  return (
    <div className="grid gap-0 md:grid-cols-[1fr_1.15fr]">
      <div className="relative">
        <FabricSwatch fabric={fabric} className="h-64 w-full md:h-full md:min-h-[32rem]" tile={220} />
        <div className="absolute bottom-4 start-4 rounded-full bg-background/90 p-1 backdrop-blur">
          <SustainabilityScore value={fabric.sustainability} size={44} />
        </div>
      </div>
      <div className="space-y-6 p-6 md:p-8">
        <div>
          <p className="eyebrow">{t(`construction.${fabric.construction}`)}</p>
          <h2 className="mt-1 text-3xl">{l(fabric.name)}</h2>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{l(fabric.description)}</p>
        </div>
        <dl className="divide-y divide-border border-y border-border text-sm">
          {rows.filter((r) => r.key !== '_desc').map((r) => (
            <div key={r.key} className="grid grid-cols-[8.5rem_1fr] gap-3 py-2.5">
              <dt className="text-muted-foreground">{t(`fabrics.specs.${r.key}`)}</dt>
              <dd className="flex items-center gap-2">
                {r.meter !== undefined && <DotMeter value={r.meter} />}
                <span>{r.value}</span>
              </dd>
            </div>
          ))}
        </dl>
        <div className="flex flex-wrap gap-2">
          <Button asChild size="sm"><Link to={`/studio?fabric=${fabric.id}`}><PenTool />{t('fabrics.useInStudio')}</Link></Button>
          <Button asChild size="sm" variant="outline"><Link to={`/try-on?f=${fabric.id}`}><Box />{t('fabrics.tryOn')}</Link></Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => { if (!toggle(fabric.id)) toast(t('fabrics.compareMax')) }}
            aria-pressed={inCompare}
          >
            {inCompare ? <Check /> : <Plus />}{inCompare ? t('fabrics.inCompare') : t('fabrics.addCompare')}
          </Button>
          <Button size="sm" variant="ghost" onClick={() => toast(t('common.comingSoon'))}><Package />{t('fabrics.requestSample')}</Button>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {fabric.certifications.map((c) => <Badge key={c} tone="outline">{c}</Badge>)}
        </div>
      </div>
    </div>
  )
}
