import { lazy, Suspense, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, ArrowUpRight, Box, BookOpen, Check, Layers, PenTool, Store, Users, Quote } from 'lucide-react'
import { fabrics, fabricById } from '@/data/fabrics'
import { garmentById, garments } from '@/data/garments'
import { suppliers } from '@/data/suppliers'
import { defaultBody } from '@/stores/tryon'
import { Button } from '@/components/ui/button'
import { useDocumentTitle, useLang, useReveal } from '@/hooks'
import { cn, formatNumber } from '@/lib/utils'
import { gsmToOz } from '@/lib/textile'
import { FabricSwatch, useCompositionText } from '@/features/fabrics/fabricUi'
import { SceneFallback } from '@/features/tryon/SceneFallback'

const AvatarScene = lazy(() => import('@/features/tryon/AvatarScene'))

/** Render "text <em>accent</em> text" from a translation without dangerouslySetInnerHTML. */
function withEm(s: string) {
  const parts = s.split(/<em>(.*?)<\/em>/)
  return parts.map((p, i) => (i % 2 ? <em key={i} className="text-accent-ink">{p}</em> : p))
}

const DEMO = [
  { garment: 'dress', fabric: 'fab-silk-charmeuse' },
  { garment: 'abaya', fabric: 'fab-nida' },
  { garment: 'jacket', fabric: 'fab-wool-tweed' },
  { garment: 'skirt', fabric: 'fab-duchess-satin' },
] as const

export default function LandingPage() {
  const { t } = useLang()
  useDocumentTitle('')
  const ref = useReveal<HTMLDivElement>()
  return (
    <div ref={ref}>
      <Hero />
      <Stats />
      <Modules />
      <Engineering />
      <Pricing />
      <Testimonials />
      <section className="container-x py-24 md:py-32">
        <div className="reveal relative overflow-hidden rounded-[2rem] bg-foreground px-6 py-16 text-center text-background md:py-24">
          <div className="absolute inset-0 opacity-[0.12]">
            <FabricSwatch fabric={fabricById('fab-jacquard')!} className="size-full" tile={200} />
          </div>
          <div className="relative">
            <h2 className="mx-auto max-w-2xl text-4xl leading-tight md:text-6xl">{t('landing.ctaTitle')}</h2>
            <p className="mt-4 text-background/70">{t('landing.ctaBody')}</p>
            <Button asChild size="lg" variant="accent" className="mt-8">
              <Link to="/studio">{t('nav.startFree')}<ArrowRight className="rtl:-scale-x-100" /></Link>
            </Button>
          </div>
        </div>
      </section>
    </div>
  )
}

function Hero() {
  const { t, l } = useLang()
  const [i, setI] = useState(0)
  const demo = DEMO[i]
  const fabric = fabricById(demo.fabric)!
  return (
    <section className="relative overflow-hidden">
      <div className="container-x grid items-center gap-10 pb-16 pt-10 md:pt-16 lg:grid-cols-[1.05fr_1fr] lg:gap-16 lg:pb-24">
        <div>
          <p className="eyebrow animate-fade-up">{t('landing.heroEyebrow')}</p>
          <h1 className="mt-5 text-[2.9rem] leading-[0.98] sm:text-6xl lg:text-[5.4rem] animate-fade-up [animation-delay:80ms]">
            {withEm(t('landing.heroTitle'))}
          </h1>
          <p className="mt-6 max-w-lg text-lg leading-relaxed text-muted-foreground animate-fade-up [animation-delay:160ms]">
            {t('landing.heroBody')}
          </p>
          <div className="mt-9 flex flex-wrap gap-3 animate-fade-up [animation-delay:240ms]">
            <Button asChild size="lg"><Link to="/studio">{t('landing.heroCta')}<ArrowRight className="rtl:-scale-x-100" /></Link></Button>
            <Button asChild size="lg" variant="outline"><Link to="/fabrics">{t('landing.heroSecondary')}</Link></Button>
          </div>
        </div>

        <div className="relative animate-fade-in [animation-delay:200ms]">
          <div className="relative aspect-[4/5] overflow-hidden rounded-[2rem] border border-border bg-gradient-to-b from-surface via-background to-muted">
            <Suspense fallback={<SceneFallback />}>
              <AvatarScene
                body={defaultBody}
                garment={garmentById(demo.garment)!}
                fabric={fabric}
                size="M"
                autoRotate
                compact
              />
            </Suspense>
            <span className="absolute start-5 top-5 flex items-center gap-2 rounded-full bg-background/85 px-3 py-1.5 text-xs backdrop-blur">
              <span className="size-1.5 animate-pulse rounded-full bg-accent" />{t('landing.demoLabel')}
            </span>
            <span className="pointer-events-none absolute bottom-24 end-5 text-[0.7rem] text-muted-foreground">{t('landing.demoHint')}</span>
            <div className="absolute inset-x-4 bottom-4 flex items-center gap-3 rounded-2xl bg-background/90 p-2.5 backdrop-blur">
              <div className="flex gap-1.5" role="radiogroup" aria-label={t('landing.demoFabric')}>
                {DEMO.map((d, k) => {
                  const f = fabricById(d.fabric)!
                  return (
                    <button
                      key={d.fabric}
                      role="radio"
                      aria-checked={k === i}
                      aria-label={l(f.name)}
                      onClick={() => setI(k)}
                      className={cn('size-10 overflow-hidden rounded-xl border-2 transition-transform hover:scale-105', k === i ? 'border-accent' : 'border-transparent')}
                    >
                      <FabricSwatch fabric={f} className="size-full" tile={50} />
                    </button>
                  )
                })}
              </div>
              <div className="min-w-0 text-xs">
                <p className="truncate font-medium">{l(garmentById(demo.garment)!.name)}</p>
                <p className="truncate text-muted-foreground">{l(fabric.name)} · {t('fabrics.specs.drape')} {fabric.drape}/5</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

function Stats() {
  const { t, lang } = useLang()
  const stats = [
    { n: fabrics.length, k: 'fabrics' },
    { n: suppliers.length, k: 'suppliers' },
    { n: garments.length, k: 'garments' },
    { n: 5, k: 'calculators' },
  ]
  return (
    <section className="border-y border-border">
      <div className="container-x py-10">
        <p className="reveal text-center text-sm text-muted-foreground">{t('landing.trustedBy')}</p>
        <dl className="mt-8 grid grid-cols-2 gap-6 md:grid-cols-4">
          {stats.map((s, i) => (
            <div key={s.k} className="reveal flex flex-col-reverse text-center" style={{ transitionDelay: `${i * 80}ms` }}>
              <dt className="text-xs text-muted-foreground">{t(`landing.stats.${s.k}`)}</dt>
              <dd className="num font-display text-5xl">{formatNumber(s.n, lang)}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  )
}

const MODULES = [
  { k: 'studio', to: '/studio', icon: PenTool },
  { k: 'fabrics', to: '/fabrics', icon: Layers },
  { k: 'tryon', to: '/try-on', icon: Box },
  { k: 'academy', to: '/academy', icon: BookOpen },
  { k: 'marketplace', to: '/marketplace', icon: Store },
  { k: 'community', to: '/community', icon: Users },
] as const

function Modules() {
  const { t, lang } = useLang()
  return (
    <section className="container-x py-24 md:py-32">
      <div className="reveal max-w-2xl">
        <p className="eyebrow">{t('landing.modulesEyebrow')}</p>
        <h2 className="mt-3 text-4xl md:text-6xl">{t('landing.modulesTitle')}</h2>
      </div>
      <ul className="mt-14 grid border-t border-border sm:grid-cols-2 lg:grid-cols-3">
        {MODULES.map((m, i) => (
          <li key={m.k} className="reveal border-b border-border sm:odd:border-e lg:border-e lg:[&:nth-child(3n)]:border-e-0" style={{ transitionDelay: `${(i % 3) * 90}ms` }}>
            <Link to={m.to} className="group flex h-full flex-col gap-6 p-7 transition-colors hover:bg-surface md:p-9">
              <div className="flex items-center justify-between">
                <span className="num font-display text-sm text-muted-foreground">{formatNumber(i + 1, lang).padStart(2, lang === 'ar' ? '٠' : '0')}</span>
                <m.icon className="size-5 text-muted-foreground transition-colors group-hover:text-accent-ink" />
              </div>
              <div>
                <h3 className="flex items-center gap-2 text-3xl">
                  {t(`landing.modules.${m.k}.title`)}
                  <ArrowUpRight className="size-5 opacity-0 transition-all group-hover:opacity-100 rtl:-scale-x-100" />
                </h3>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{t(`landing.modules.${m.k}.body`)}</p>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}

function Engineering() {
  const { t, l, lang } = useLang()
  const comp = useCompositionText()
  const mosaic = ['fab-silk-charmeuse', 'fab-raw-denim', 'fab-wool-tweed', 'fab-linen', 'fab-cotton-velvet', 'fab-jacquard', 'fab-modal-rib', 'fab-silk-chiffon', 'fab-cotton-twill'].map((id) => fabricById(id)!)
  const f = fabricById('fab-silk-charmeuse')!
  const rows: Array<[string, ReactNode]> = [
    [t('fabrics.specs.composition'), comp(f)],
    [t('fabrics.specs.gsm'), `${formatNumber(f.gsm, lang)} g/m² · ${formatNumber(gsmToOz(f.gsm), lang, 1)} oz/yd²`],
    [t('fabrics.specs.construction'), t(`construction.${f.construction}`)],
    [t('fabrics.specs.drape'), `${formatNumber(f.drape, lang)} / 5`],
    [t('fabrics.specs.shrinkage'), `${formatNumber(f.shrinkagePct, lang)}%`],
  ]
  return (
    <section className="bg-surface">
      <div className="container-x grid items-center gap-12 py-24 md:py-32 lg:grid-cols-2">
        <div className="reveal relative">
          <div className="grid grid-cols-3 gap-2">
            {mosaic.map((m) => (
              <Link to="/fabrics" key={m.id} className="group relative aspect-square overflow-hidden rounded-xl" aria-label={l(m.name)}>
                <FabricSwatch fabric={m} className="absolute inset-0 transition-transform duration-700 group-hover:scale-110" />
                <span className="absolute inset-x-2 bottom-2 truncate rounded-full bg-background/85 px-2 py-0.5 text-[0.62rem] opacity-0 backdrop-blur transition-opacity group-hover:opacity-100">{l(m.name)}</span>
              </Link>
            ))}
          </div>
          <div className="absolute -bottom-8 end-4 w-64 rounded-2xl border border-border bg-background p-4 shadow-xl md:end-[-1.5rem]">
            <p className="font-display text-lg">{l(f.name)}</p>
            <dl className="mt-2 space-y-1 text-xs">
              {rows.map(([k, v]) => (
                <div key={k} className="flex justify-between gap-3"><dt className="text-muted-foreground">{k}</dt><dd className="num text-end">{v}</dd></div>
              ))}
            </dl>
          </div>
        </div>
        <div className="reveal mt-10 lg:mt-0">
          <p className="eyebrow">{t('landing.techEyebrow')}</p>
          <h2 className="mt-3 text-4xl md:text-5xl">{t('landing.techTitle')}</h2>
          <p className="mt-5 max-w-lg leading-relaxed text-muted-foreground">{t('landing.techBody')}</p>
          <Button asChild variant="outline" className="mt-8"><Link to="/fabrics">{t('landing.heroSecondary')}<ArrowRight className="rtl:-scale-x-100" /></Link></Button>
        </div>
      </div>
    </section>
  )
}

function Pricing() {
  const { t } = useLang()
  const plans = ['free', 'pro', 'studio'] as const
  return (
    <section id="pricing" className="container-x scroll-mt-20 py-24 md:py-32">
      <div className="reveal mx-auto max-w-2xl text-center">
        <p className="eyebrow">{t('landing.pricingEyebrow')}</p>
        <h2 className="mt-3 text-4xl md:text-6xl">{t('landing.pricingTitle')}</h2>
      </div>
      <div className="mt-14 grid gap-5 md:grid-cols-3">
        {plans.map((p, i) => {
          const featured = p === 'pro'
          const features = t(`landing.plans.${p}.features`, { returnObjects: true }) as string[]
          return (
            <div
              key={p}
              className={cn('reveal relative flex flex-col rounded-3xl border p-8', featured ? 'border-foreground bg-foreground text-background' : 'border-border bg-surface')}
              style={{ transitionDelay: `${i * 90}ms` }}
            >
              {featured && <span className="absolute end-6 top-6 rounded-full bg-accent px-3 py-1 text-[0.65rem] font-medium text-accent-foreground">{t('landing.popular')}</span>}
              <p className={cn('eyebrow', featured && 'text-background/60')}>{t(`landing.plans.${p}.for`)}</p>
              <h3 className="mt-2 text-3xl">{t(`landing.plans.${p}.name`)}</h3>
              <p className="mt-6 flex items-baseline gap-1">
                <span className="font-display text-6xl">{t(`landing.plans.${p}.price`)}</span>
                <span className={cn('text-sm', featured ? 'text-background/60' : 'text-muted-foreground')}>{t('landing.monthly')}</span>
              </p>
              <ul className="mt-8 flex-1 space-y-3 text-sm">
                {features.map((f) => (
                  <li key={f} className="flex gap-2.5"><Check className={cn('mt-0.5 size-4 shrink-0', featured ? 'text-accent-ink' : 'text-fit-good')} />{f}</li>
                ))}
              </ul>
              <Button asChild variant={featured ? 'accent' : 'outline'} className="mt-8 w-full">
                <Link to="/studio">{t(`landing.plans.${p}.cta`)}</Link>
              </Button>
            </div>
          )
        })}
      </div>
      <div className="reveal mt-6 flex flex-col items-start justify-between gap-6 rounded-3xl border border-border p-8 md:flex-row md:items-center">
        <div>
          <h3 className="text-2xl">{t('landing.apiTitle')}</h3>
          <p className="mt-2 max-w-xl text-sm text-muted-foreground">{t('landing.apiBody')}</p>
        </div>
        <Button asChild variant="primary"><Link to="/try-on-api">{t('landing.apiCta')}<ArrowRight className="rtl:-scale-x-100" /></Link></Button>
      </div>
    </section>
  )
}

function Testimonials() {
  const { t } = useLang()
  const items = t('landing.testimonials', { returnObjects: true }) as Array<{ quote: string; name: string; role: string }>
  return (
    <section className="border-t border-border bg-surface">
      <div className="container-x py-24 md:py-32">
        <div className="reveal">
          <p className="eyebrow">{t('landing.testimonialsEyebrow')}</p>
          <h2 className="mt-3 text-4xl md:text-5xl">{t('landing.testimonialsTitle')}</h2>
        </div>
        <div className="mt-12 grid gap-10 md:grid-cols-3">
          {items.map((it, i) => (
            <figure key={it.name} className="reveal flex flex-col" style={{ transitionDelay: `${i * 90}ms` }}>
              <Quote className="size-6 text-accent-ink rtl:-scale-x-100" aria-hidden />
              <blockquote className="mt-4 flex-1 font-display text-xl leading-snug md:text-2xl">{it.quote}</blockquote>
              <figcaption className="mt-6 border-t border-border pt-4 text-sm">
                <span className="block font-medium">{it.name}</span>
                <span className="text-muted-foreground">{it.role}</span>
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  )
}
