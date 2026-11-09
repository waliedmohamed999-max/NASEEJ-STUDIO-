import { X } from 'lucide-react'
import type { Fabric } from '@/types'
import { DotMeter } from '@/components/ui/primitives'
import { useLang } from '@/hooks'
import { cn } from '@/lib/utils'
import { useCompare } from '@/stores/ui'
import { FabricSwatch } from './fabricUi'
import { useSpecRows } from './FabricDetail'

/** Which value "wins" per row, for a subtle highlight. */
const best: Partial<Record<string, (f: Fabric) => number>> = {
  sustainability: (f) => f.sustainability,
  price: (f) => -f.pricePerMeter,
  breathability: (f) => f.breathability,
  shrinkage: (f) => -f.shrinkagePct,
}

export function FabricCompare({ fabrics }: { fabrics: Fabric[] }) {
  const { t, l } = useLang()
  const rowsFor = useSpecRows()
  const toggle = useCompare((s) => s.toggle)
  if (!fabrics.length) return <p className="p-8 text-center text-muted-foreground">{t('fabrics.compareEmpty')}</p>
  const table = fabrics.map(rowsFor)
  const keys = table[0].map((r) => r.key).filter((k) => k !== '_desc')

  return (
    <div className="overflow-x-auto p-4 md:p-6 scroll-thin">
      <table className="w-full min-w-[40rem] border-separate border-spacing-0 text-sm">
        <thead>
          <tr>
            <th className="w-36" />
            {fabrics.map((f) => (
              <th key={f.id} className="px-2 pb-4 text-start align-bottom font-normal">
                <div className="relative overflow-hidden rounded-xl">
                  <FabricSwatch fabric={f} className="h-28 w-full" />
                  <button
                    onClick={() => toggle(f.id)}
                    className="absolute end-2 top-2 rounded-full bg-background/90 p-1 hover:bg-background"
                    aria-label={`${t('common.remove')} ${l(f.name)}`}
                  >
                    <X className="size-3.5" />
                  </button>
                </div>
                <p className="mt-2 font-display text-lg leading-tight">{l(f.name)}</p>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {keys.map((key, ri) => {
            const scorer = best[key]
            const top = scorer ? Math.max(...fabrics.map(scorer)) : NaN
            return (
              <tr key={key}>
                <th scope="row" className="border-t border-border py-2.5 pe-3 text-start align-top text-xs font-medium text-muted-foreground">
                  {t(`fabrics.specs.${key}`)}
                </th>
                {table.map((rows, ci) => {
                  const r = rows[ri]
                  return (
                    <td key={ci} className={cn('border-t border-border px-2 py-2.5 align-top', scorer && scorer(fabrics[ci]) === top && fabrics.length > 1 && 'text-fit-good font-medium')}>
                      <span className="flex items-center gap-2">
                        {r.meter !== undefined && <DotMeter value={r.meter} />}
                        {r.value}
                      </span>
                    </td>
                  )
                })}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
