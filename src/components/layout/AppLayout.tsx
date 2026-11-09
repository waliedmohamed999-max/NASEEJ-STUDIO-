import { Outlet, useLocation } from 'react-router-dom'
import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { DirectionProvider } from '@radix-ui/react-direction'
import { Header } from './Header'
import { Footer } from './Footer'
import { useToasts } from '@/stores/ui'
import { dirFor } from '@/i18n'

/** Routes that are full-height workspaces render without the footer. */
const WORKSPACES = ['/studio', '/try-on']

export function AppLayout() {
  const { pathname, hash } = useLocation()
  const { i18n } = useTranslation()
  const dir = dirFor((i18n.resolvedLanguage ?? 'en').split('-')[0])
  const isWorkspace = WORKSPACES.some((w) => pathname.startsWith(w))

  useEffect(() => {
    if (hash) document.getElementById(hash.slice(1))?.scrollIntoView({ behavior: 'smooth' })
    else window.scrollTo({ top: 0 })
  }, [pathname, hash])

  return (
    <DirectionProvider dir={dir}>
      <div className="flex min-h-dvh flex-col">
        <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:start-4 focus:top-4 focus:z-50 focus:rounded-full focus:bg-foreground focus:px-4 focus:py-2 focus:text-background">
          Skip to content
        </a>
        <Header />
        <main id="main" className="flex flex-1 flex-col">
          <Outlet />
        </main>
        {!isWorkspace && <Footer />}
        <Toaster />
      </div>
    </DirectionProvider>
  )
}

function Toaster() {
  const toasts = useToasts((s) => s.toasts)
  return (
    <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-6 z-[60] flex flex-col items-center gap-2 px-4">
      {toasts.map((t) => (
        <div key={t.id} className="animate-fade-up rounded-full bg-foreground px-5 py-2.5 text-sm text-background shadow-lg">
          {t.message}
        </div>
      ))}
    </div>
  )
}
