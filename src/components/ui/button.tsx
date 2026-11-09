import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

export const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap font-medium transition-[background,color,border,transform,box-shadow] duration-200 disabled:pointer-events-none disabled:opacity-45 active:scale-[0.98] [&_svg]:size-4 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        primary: 'bg-foreground text-background hover:bg-foreground/85',
        accent: 'bg-accent text-accent-foreground hover:brightness-110',
        outline: 'border border-foreground/20 bg-transparent hover:border-foreground/60 hover:bg-foreground/[0.03]',
        ghost: 'hover:bg-foreground/[0.06]',
        link: 'underline-offset-4 hover:underline px-0 h-auto',
      },
      size: {
        sm: 'h-8 px-3 text-xs rounded-full',
        md: 'h-10 px-5 text-sm rounded-full',
        lg: 'h-12 px-7 text-[0.95rem] rounded-full',
        icon: 'size-9 rounded-full',
        iconSm: 'size-8 rounded-full',
      },
    },
    defaultVariants: { variant: 'primary', size: 'md' },
  },
)

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

export function Button({ className, variant, size, asChild, ...props }: ButtonProps) {
  const Comp = asChild ? Slot : 'button'
  return <Comp className={cn(buttonVariants({ variant, size }), className)} {...props} />
}
