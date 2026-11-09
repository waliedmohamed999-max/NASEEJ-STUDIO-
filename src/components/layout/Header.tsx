import { useEffect, useState } from 'react'
import { Link, NavLink, useLocation } from 'react-router-dom'
import { Menu, Moon, Sun, Languages } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { languages } from '@/i18n'
import { useTheme } from '@/stores/ui'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/primitives'
import { cn } from '@/lib/utils'

export const primaryNav = [
  { to: '/studio', key: 'nav.studio' },
  { to: '/fabrics', key: 'nav.fabrics' },
  { to: '/try-on', key: 'nav.tryon' },
  { to: '/academy', key: 'nav.academy' },
  { to: '/marketplace', key: 'nav.marketplace' },
  { to: '/community', key: 'nav.community' },
] as const

export function Logo({ className }: { className?: string }) {
  const { t } = useTranslation()
  return (
    <Link to="/" className={cn('group flex items-baseline gap-2', className)} aria-label={t('brand.name')}>
      <span className="font-display text-[1.35rem] font-semibold tracking-[0.18em] rtl:tracking-normal">NASEEJ</span>
      <span className="text-[0.62rem] font-medium tracking-[0.3em] text-muted-foreground transition-colors group-hover:text-accent-ink">STUDIO</span>
    </Link>
  )
}

export function LanguageSwitcher() {
  const { i18n, t } = useTranslation()
  const current = (i18n.resolvedLanguage ?? 'en').split('-')[0]
  // With two languages a toggle is fastest; with more it cycles in order.
  const next = languages[(languages.findIndex((l) => l.code === current) + 1) % languages.length]
  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => i18n.changeLanguage(next.code)}
      aria-label={`${t('nav.language')}: ${next.label}`}
      title={`${t('nav.language')}: ${next.label}`}
      className="gap-1.5"
    >
      <Languages />
      <span lang={next.code}>{next.label}</span>
    </Button>
  )
}

export function ThemeToggle() {
  const { theme, toggle } = useTheme()
  const { t } = useTranslation()
  return (
    <Button variant="ghost" size="iconSm" onClick={toggle} aria-label={t('nav.theme')} title={t('nav.theme')}>
      {theme === 'dark' ? <Sun /> : <Moon />}
    </Button>
  )
}

export function Header() {
  const { t } = useTranslation()
  const [scrolled, setScrolled] = useState(false)
  const [open, setOpen] = useState(false)
  const { pathname } = useLocation()
  const isLanding = pathname === '/'

  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 8)
    on()
    window.addEventListener('scroll', on, { passive: true })
    return () => window.removeEventListener('scroll', on)
  }, [])
  useEffect(() => setOpen(false), [pathname])

  return (
    <header
      className={cn(
        'sticky top-0 z-40 transition-[background,border-color] duration-300',
        scrolled || !isLanding ? 'border-b border-border bg-background/85 backdrop-blur-md' : 'border-b border-transparent',
      )}
    >
      <div className="container-x flex h-16 items-center justify-between gap-4">
        <Logo />
        <nav className="hidden items-center gap-1 lg:flex" aria-label="Primary">
          {primaryNav.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              className={({ isActive }) =>
                cn(
                  'relative rounded-full px-3 py-1.5 text-[0.82rem] transition-colors',
                  isActive ? 'text-foreground' : 'text-muted-foreground hover:text-foreground',
                  isActive && 'after:absolute after:inset-x-3 after:-bottom-[1px] after:h-px after:bg-accent',
                )
              }
            >
              {t(n.key)}
            </NavLink>
          ))}
        </nav>
        <div className="flex items-center gap-1">
          <LanguageSwitcher />
          <ThemeToggle />
          <Button asChild size="sm" className="ms-1 hidden sm:inline-flex">
            <Link to="/studio">{t('nav.startFree')}</Link>
          </Button>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button variant="ghost" size="iconSm" className="lg:hidden" aria-label={t('nav.menu')}>
                <Menu />
              </Button>
            </DialogTrigger>
            <DialogContent side="end" title={t('nav.menu')}>
              <nav className="flex flex-col p-3" aria-label="Mobile">
                {[...primaryNav, { to: '/dashboard', key: 'nav.dashboard' } as const, { to: '/try-on-api', key: 'nav.api' } as const].map((n) => (
                  <NavLink
                    key={n.to}
                    to={n.to}
                    className={({ isActive }) =>
                      cn('rounded-xl px-4 py-3 font-display text-xl', isActive ? 'bg-muted text-foreground' : 'text-foreground/80 hover:bg-muted')
                    }
                  >
                    {t(n.key)}
                  </NavLink>
                ))}
                <Button asChild className="mx-4 mt-4">
                  <Link to="/studio">{t('nav.startFree')}</Link>
                </Button>
              </nav>
            </DialogContent>
          </Dialog>
        </div>
      </div>
    </header>
  )
}
