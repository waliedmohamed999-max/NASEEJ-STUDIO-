import * as React from 'react'
import * as SliderPrimitive from '@radix-ui/react-slider'
import * as TabsPrimitive from '@radix-ui/react-tabs'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

/* ---------- Badge ---------- */
export function Badge({ className, tone = 'neutral', ...p }: React.HTMLAttributes<HTMLSpanElement> & { tone?: 'neutral' | 'accent' | 'good' | 'outline' }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[0.7rem] font-medium',
        tone === 'neutral' && 'bg-muted text-muted-foreground',
        tone === 'accent' && 'bg-accent-soft text-accent-ink',
        tone === 'good' && 'bg-fit-good/12 text-fit-good',
        tone === 'outline' && 'border border-border text-muted-foreground',
        className,
      )}
      {...p}
    />
  )
}

/* ---------- Input ---------- */
export function Input({ className, ...p }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        'h-10 w-full rounded-full border border-border bg-surface px-4 text-sm placeholder:text-muted-foreground/70 focus:border-foreground/40 focus:outline-none',
        className,
      )}
      {...p}
    />
  )
}

/* ---------- Native select (accessible, RTL-safe) ---------- */
export function Select({ className, children, ...p }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        'h-10 w-full appearance-none rounded-full border border-border bg-surface bg-[length:12px] bg-no-repeat px-4 pe-9 text-sm focus:border-foreground/40 focus:outline-none',
        "bg-[url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 12 12'%3E%3Cpath d='M2 4l4 4 4-4' fill='none' stroke='%23888' stroke-width='1.5'/%3E%3C/svg%3E\")] bg-[position:right_1rem_center] rtl:bg-[position:left_1rem_center]",
        className,
      )}
      {...p}
    >
      {children}
    </select>
  )
}

/* ---------- Label ---------- */
export function Label({ className, ...p }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className={cn('text-xs font-medium text-muted-foreground', className)} {...p} />
}

/* ---------- Slider ---------- */
export function Slider({ className, ...p }: React.ComponentProps<typeof SliderPrimitive.Root>) {
  return (
    <SliderPrimitive.Root className={cn('relative flex h-5 w-full touch-none select-none items-center', className)} {...p}>
      <SliderPrimitive.Track className="relative h-[3px] grow overflow-hidden rounded-full bg-border">
        <SliderPrimitive.Range className="absolute h-full bg-foreground" />
      </SliderPrimitive.Track>
      {(p.value ?? p.defaultValue ?? [0]).map((_, i) => (
        <SliderPrimitive.Thumb
          key={i}
          className="block size-4 rounded-full border-2 border-foreground bg-surface shadow-sm transition-transform hover:scale-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      ))}
    </SliderPrimitive.Root>
  )
}

/* ---------- Tabs ---------- */
export const Tabs = TabsPrimitive.Root
export function TabsList({ className, ...p }: React.ComponentProps<typeof TabsPrimitive.List>) {
  return <TabsPrimitive.List className={cn('inline-flex items-center gap-1 rounded-full border border-border bg-surface p-1', className)} {...p} />
}
export function TabsTrigger({ className, ...p }: React.ComponentProps<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      className={cn(
        'inline-flex h-8 items-center gap-1.5 rounded-full px-4 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground data-[state=active]:bg-foreground data-[state=active]:text-background [&_svg]:size-3.5',
        className,
      )}
      {...p}
    />
  )
}
export const TabsContent = TabsPrimitive.Content

/* ---------- Sheet / Dialog ---------- */
export const Dialog = DialogPrimitive.Root
export const DialogTrigger = DialogPrimitive.Trigger
export const DialogClose = DialogPrimitive.Close

export function DialogContent({
  className, children, side = 'center', title, ...p
}: React.ComponentProps<typeof DialogPrimitive.Content> & { side?: 'center' | 'end' | 'bottom'; title: string }) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/40 backdrop-blur-[2px] animate-fade-in" />
      <DialogPrimitive.Content
        className={cn(
          'fixed z-50 bg-background shadow-2xl focus:outline-none animate-fade-up',
          side === 'center' && 'start-1/2 top-1/2 max-h-[90vh] w-[min(92vw,64rem)] -translate-y-1/2 ltr:-translate-x-1/2 rtl:translate-x-1/2 overflow-auto rounded-2xl',
          side === 'end' && 'inset-y-0 end-0 w-[min(88vw,22rem)] overflow-auto',
          side === 'bottom' && 'inset-x-0 bottom-0 max-h-[85vh] overflow-auto rounded-t-2xl',
          className,
        )}
        {...p}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-background/95 px-5 py-4 backdrop-blur">
          <DialogPrimitive.Title className="font-display text-xl">{title}</DialogPrimitive.Title>
          <DialogPrimitive.Close className="rounded-full p-1.5 hover:bg-foreground/5" aria-label="Close">
            <X className="size-4" />
          </DialogPrimitive.Close>
        </div>
        <DialogPrimitive.Description className="sr-only">{title}</DialogPrimitive.Description>
        {children}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  )
}

/* ---------- Segmented control ---------- */
export function Segmented<T extends string>({
  value, onChange, options, className, size = 'md',
}: { value: T; onChange: (v: T) => void; options: Array<{ value: T; label: React.ReactNode }>; className?: string; size?: 'sm' | 'md' }) {
  return (
    <div role="radiogroup" className={cn('flex flex-wrap gap-1.5', className)}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            'rounded-full border transition-colors',
            size === 'sm' ? 'h-7 px-3 text-[0.72rem]' : 'h-8 px-3.5 text-xs',
            value === o.value
              ? 'border-foreground bg-foreground text-background'
              : 'border-border text-muted-foreground hover:border-foreground/40 hover:text-foreground',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

/* ---------- Meter (1–5 dots) ---------- */
export function DotMeter({ value, max = 5, label }: { value: number; max?: number; label?: string }) {
  return (
    <span className="inline-flex items-center gap-[3px]" role="img" aria-label={label ?? `${value} / ${max}`}>
      {Array.from({ length: max }, (_, i) => (
        <span key={i} className={cn('size-1.5 rounded-full', i < value ? 'bg-foreground' : 'bg-border')} />
      ))}
    </span>
  )
}
