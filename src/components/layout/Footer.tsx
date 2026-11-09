import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Logo, primaryNav } from './Header'

export function Footer() {
  const { t } = useTranslation()
  const year = new Date().getFullYear()
  return (
    <footer className="mt-auto border-t border-border">
      <div className="container-x grid gap-10 py-14 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
        <div className="space-y-3">
          <Logo />
          <p className="font-display text-lg italic text-muted-foreground">{t('brand.tagline')}</p>
        </div>
        <FooterCol title={t('landing.footer.product')}>
          {primaryNav.map((n) => <FooterLink key={n.to} to={n.to}>{t(n.key)}</FooterLink>)}
          <FooterLink to="/try-on-api">{t('nav.api')}</FooterLink>
        </FooterCol>
        <FooterCol title={t('landing.footer.company')}>
          <FooterLink to="/#pricing">{t('nav.pricing')}</FooterLink>
          <FooterLink to="/">{t('landing.footer.about')}</FooterLink>
          <FooterLink to="/">{t('landing.footer.careers')}</FooterLink>
          <FooterLink to="/">{t('landing.footer.contact')}</FooterLink>
        </FooterCol>
        <FooterCol title={t('landing.footer.legal')}>
          <FooterLink to="/">{t('landing.footer.privacy')}</FooterLink>
          <FooterLink to="/">{t('landing.footer.terms')}</FooterLink>
        </FooterCol>
      </div>
      <div className="border-t border-border">
        <p className="container-x py-5 text-xs text-muted-foreground">
          © {year} NASEEJ STUDIO. {t('landing.footer.rights')}
        </p>
      </div>
    </footer>
  )
}

function FooterCol({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="eyebrow mb-4 font-sans">{title}</h3>
      <ul className="space-y-2.5 text-sm">{children}</ul>
    </div>
  )
}

function FooterLink({ to, children }: { to: string; children: React.ReactNode }) {
  return (
    <li>
      <Link to={to} className="text-foreground/75 transition-colors hover:text-accent-ink">{children}</Link>
    </li>
  )
}
