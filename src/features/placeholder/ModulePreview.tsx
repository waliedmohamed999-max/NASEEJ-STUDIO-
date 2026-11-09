import { Link } from 'react-router-dom'
import { BadgeCheck, Clock, MapPin, Star } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/primitives'
import { useCourses, useSuppliers } from '@/services/data/hooks'
import { useDocumentTitle, useLang } from '@/hooks'
import { countryName, formatNumber } from '@/lib/utils'

type Module = 'academy' | 'marketplace' | 'community' | 'dashboard' | 'api'

const titleKey: Record<Module, string> = {
  academy: 'nav.academy', marketplace: 'nav.marketplace', community: 'nav.community', dashboard: 'nav.dashboard', api: 'nav.api',
}

/**
 * Phase-two modules. Each shows its scope and a preview built from real seed data
 * so routes, navigation and data wiring are exercised before the full build.
 */
export default function ModulePreview({ module }: { module: Module }) {
  const { t } = useLang()
  useDocumentTitle(t(titleKey[module]))
  return (
    <div className="container-x py-14 md:py-20">
      <Badge tone="accent">{t('common.comingSoon')}</Badge>
      <h1 className="mt-4 text-4xl md:text-6xl">{t(titleKey[module])}</h1>
      <p className="mt-4 max-w-2xl text-muted-foreground">{t(`placeholder.${module}`)}</p>
      {module === 'academy' && <AcademyPreview />}
      {module === 'marketplace' && <MarketplacePreview />}
      {(module === 'community' || module === 'dashboard' || module === 'api') && (
        <div className="mt-10 flex gap-3">
          <Button asChild><Link to="/studio">{t('nav.studio')}</Link></Button>
          <Button asChild variant="outline"><Link to="/try-on">{t('nav.tryon')}</Link></Button>
        </div>
      )}
    </div>
  )
}

function AcademyPreview() {
  const { t, l, lang } = useLang()
  const courses = useCourses()
  return (
    <section className="mt-12">
      <p className="eyebrow mb-4">{t('placeholder.preview')}</p>
      <ul className="grid gap-5 md:grid-cols-3">
        {courses.map((c) => (
          <li key={c.id} className="flex flex-col rounded-3xl border border-border bg-surface p-6">
            <Badge tone="outline" className="self-start capitalize">{c.level}</Badge>
            <h2 className="mt-4 text-2xl">{l(c.title)}</h2>
            <p className="mt-2 flex-1 text-sm text-muted-foreground">{l(c.summary)}</p>
            <ol className="mt-5 space-y-1.5 border-t border-border pt-4 text-sm">
              {c.lessons.map((ls, i) => (
                <li key={i} className="flex justify-between gap-3">
                  <span>{l(ls.title)}</span>
                  <span className="num shrink-0 text-xs text-muted-foreground">{formatNumber(ls.minutes, lang)}′</span>
                </li>
              ))}
            </ol>
            <p className="mt-4 flex items-center gap-1.5 text-xs text-muted-foreground"><Clock className="size-3.5" />{t('placeholder.lessons', { count: c.lessons.length })}</p>
          </li>
        ))}
      </ul>
    </section>
  )
}

function MarketplacePreview() {
  const { t, l, lang } = useLang()
  const suppliers = useSuppliers()
  return (
    <section className="mt-12">
      <p className="eyebrow mb-4">{t('placeholder.preview')}</p>
      <ul className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
        {suppliers.map((s) => (
          <li key={s.id} className="rounded-3xl border border-border bg-surface p-6">
            <div className="flex items-start justify-between gap-3">
              <h2 className="text-2xl">{s.name}</h2>
              <span className="num flex items-center gap-1 text-sm"><Star className="size-3.5 fill-accent text-accent-ink" />{formatNumber(s.rating, lang, 1)}</span>
            </div>
            <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground"><MapPin className="size-3.5" />{s.city}, {countryName(s.country, lang)}</p>
            <p className="mt-3 text-sm text-muted-foreground">{l(s.description)}</p>
            <div className="mt-4 flex flex-wrap gap-1.5">{s.specialties.map((sp, i) => <Badge key={i}>{l(sp)}</Badge>)}</div>
            <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1 border-t border-border pt-4 text-xs text-muted-foreground">
              <span>{t('placeholder.moq', { count: s.moqMeters })}</span>
              <span>{t('placeholder.lead', { count: s.leadTimeDays })}</span>
            </div>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {s.certifications.map((c) => <Badge key={c} tone="good"><BadgeCheck className="size-3" />{c}</Badge>)}
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}
