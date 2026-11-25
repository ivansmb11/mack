import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"
import { Slot } from "radix-ui"

/** Geist button: small 32 px, medium 40 px, large 48 px; 6 px radius; 150 ms colour transitions. */
const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-2 rounded-md text-button-14 whitespace-nowrap transition-[color,background-color,box-shadow] duration-150 ease-out outline-none focus-visible:shadow-focus disabled:pointer-events-none disabled:bg-gray-100 disabled:text-gray-700 disabled:shadow-none aria-invalid:shadow-[0_0_0_1px_var(--ds-red-800)] [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "bg-gray-1000 text-background-100 hover:bg-[color-mix(in_oklab,var(--ds-gray-1000)_85%,var(--ds-background-100))]",
        destructive: "bg-red-800 text-white hover:bg-red-900",
        outline: "bg-background-100 text-gray-1000 shadow-[0_0_0_1px_var(--ds-gray-alpha-400)] hover:bg-gray-alpha-200",
        secondary: "bg-background-100 text-gray-1000 shadow-[0_0_0_1px_var(--ds-gray-alpha-400)] hover:bg-gray-alpha-200",
        ghost: "text-gray-1000 hover:bg-gray-alpha-200",
        link: "text-blue-900 underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-3 has-[>svg]:px-2.5",
        xs: "h-6 gap-1 rounded-sm px-1.5 text-button-12 [&_svg:not([class*='size-'])]:size-3",
        sm: "h-8 gap-1.5 px-2.5 has-[>svg]:px-2",
        lg: "h-12 rounded-lg px-4 text-button-16 has-[>svg]:px-3.5",
        icon: "size-10",
        "icon-xs": "size-6 rounded-sm [&_svg:not([class*='size-'])]:size-3",
        "icon-sm": "size-8",
        "icon-lg": "size-12 rounded-lg",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot.Root : "button"

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
