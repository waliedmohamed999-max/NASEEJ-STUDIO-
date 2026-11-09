import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { lt } from '@/lib/utils'
import type { LText } from '@/types'

/** Adds `.is-visible` to `.reveal` children when they scroll into view. */
export function useReveal<T extends HTMLElement = HTMLDivElement>() {
  const ref = useRef<T>(null)
  useEffect(() => {
    const root = ref.current
    if (!root) return
    const els = root.querySelectorAll<HTMLElement>('.reveal')
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => {
        if (e.isIntersecting) { e.target.classList.add('is-visible'); io.unobserve(e.target) }
      }),
      { rootMargin: '0px 0px -8% 0px', threshold: 0.08 },
    )
    els.forEach((el) => io.observe(el))
    return () => io.disconnect()
  }, [])
  return ref
}

/** Current language plus a localiser for LText values. */
export function useLang() {
  const { i18n, t } = useTranslation()
  const lang = (i18n.resolvedLanguage ?? 'en').split('-')[0]
  return { lang, t, l: (x: LText | undefined) => lt(x, lang), isRtl: lang === 'ar' }
}

export function useDocumentTitle(title: string) {
  useEffect(() => {
    document.title = title ? `${title} — NASEEJ STUDIO` : 'NASEEJ STUDIO — From Fiber to Fit'
  }, [title])
}
