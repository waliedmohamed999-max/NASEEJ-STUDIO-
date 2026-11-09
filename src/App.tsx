import { lazy, Suspense } from 'react'
import { createBrowserRouter, Link, RouterProvider } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { AppLayout } from '@/components/layout/AppLayout'
import { Button } from '@/components/ui/button'
import { SceneFallback } from '@/features/tryon/SceneFallback'

const LandingPage = lazy(() => import('@/features/landing/LandingPage'))
const FabricLibraryPage = lazy(() => import('@/features/fabrics/FabricLibraryPage'))
const Workspace = lazy(() => import('@/features/workspace/Workspace'))
const TryOnPage = lazy(() => import('@/features/tryon/TryOnPage'))
const ModulePreview = lazy(() => import('@/features/placeholder/ModulePreview'))

const page = (el: React.ReactNode) => (
  <Suspense fallback={<div className="flex flex-1 items-center justify-center py-32"><SceneFallback /></div>}>{el}</Suspense>
)

function NotFound() {
  const { t } = useTranslation()
  return (
    <div className="container-x flex flex-1 flex-col items-center justify-center py-32 text-center">
      <p className="font-display text-8xl text-accent-ink">404</p>
      <h1 className="mt-4 text-4xl">{t('notFound.title')}</h1>
      <p className="mt-2 text-muted-foreground">{t('notFound.body')}</p>
      <Button asChild className="mt-8"><Link to="/">{t('notFound.home')}</Link></Button>
    </div>
  )
}

const router = createBrowserRouter([
  // The atelier is a full-screen desktop-style app with its own chrome.
  { path: '/studio', element: page(<Workspace />) },
  {
    element: <AppLayout />,
    children: [
      { path: '/', element: page(<LandingPage />) },
      { path: '/fabrics', element: page(<FabricLibraryPage />) },
      { path: '/try-on', element: page(<TryOnPage />) },
      { path: '/academy', element: page(<ModulePreview module="academy" />) },
      { path: '/marketplace', element: page(<ModulePreview module="marketplace" />) },
      { path: '/community', element: page(<ModulePreview module="community" />) },
      { path: '/dashboard', element: page(<ModulePreview module="dashboard" />) },
      { path: '/try-on-api', element: page(<ModulePreview module="api" />) },
      { path: '*', element: <NotFound /> },
    ],
  },
])

export default function App() {
  return <RouterProvider router={router} />
}
