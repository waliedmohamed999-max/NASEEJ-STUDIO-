import type { CSSProperties } from 'react'
import { Leaf } from 'lucide-react'
import type { Fabric, Fiber } from '@/types'
import { fabricTexture } from '@/lib/textures'
import { cn, formatNumber } from '@/lib/utils'
import { useLang } from '@/hooks'

export function FabricSwatch({
  fabric, color, className, style, tile = 160,
}: { fabric: Fabric; color?: string | null; className?: string; style?: CSSProperties; tile?: number }) {
  return (
    <div
      role="img"
      aria-label={fabric.name.en}
      className={cn('bg-repeat', className)}
      style={{ backgroundImage: `url(${fabricTexture(fabric, { color: color ?? undefined })})`, backgroundSize: `${tile}px`, ...style }}
    />
  )
}

export function useCompositionText() {
  const { t, lang } = useLang()
  return (f: Fabric) =>
    Object.entries(f.composition)
      .sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0))
      .map(([fiber, pct]) => `${formatNumber(pct ?? 0, lang)}% ${t(`fiber.${fiber as Fiber}`)}`)
      .join(' · ')
}

/** Circular 0–100 score. Colour shifts from muted to green with the score. */
export function SustainabilityScore({ value, size = 36 }: { value: number; size?: number }) {
  const { lang, t } = useLang()
  const r = size / 2 - 3
  const c = 2 * Math.PI * r
  const tone = value >= 75 ? 'var(--fit-good)' : value >= 50 ? 'var(--accent)' : 'var(--muted-foreground)'
  return (
    <span className="relative inline-flex items-center justify-center" title={`${t('fabrics.specs.sustainability')}: ${value}/100`}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--border)" strokeWidth="2.5" />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={tone} strokeWidth="2.5" strokeDasharray={`${(value / 100) * c} ${c}`} strokeLinecap="round" />
      </svg>
      <span className="num absolute text-[0.62rem] font-semibold" style={{ color: tone }}>{formatNumber(value, lang)}</span>
      <span className="sr-only">{t('fabrics.specs.sustainability')}</span>
      {value >= 85 && <Leaf className="absolute -end-1 -top-1 size-3 text-fit-good" aria-hidden />}
    </span>
  )
}
