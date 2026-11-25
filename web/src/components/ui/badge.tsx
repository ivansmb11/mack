import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"
import { Slot } from "radix-ui"

/** Geist badge: solid 700 fills, or subtle 200 fill + 900 text. */
const badgeVariants = cva(
  "inline-flex h-6 w-fit shrink-0 items-center justify-center gap-1 overflow-hidden rounded-full px-2.5 text-label-12 font-medium whitespace-nowrap transition-[color,box-shadow] focus-visible:shadow-focus [&>svg]:pointer-events-none [&>svg]:size-3",
  {
    variants: {
      variant: {
        default: "bg-gray-1000 text-background-100",
        secondary: "bg-gray-200 text-gray-1000",
        destructive: "bg-red-700 text-white",
        outline: "text-gray-1000 shadow-[inset_0_0_0_1px_var(--ds-gray-alpha-400)]",
        ghost: "[a&]:hover:bg-gray-alpha-200",
        link: "text-blue-900 underline-offset-4 [a&]:hover:underline",
        gray: "bg-gray-200 text-gray-1000",
        blue: "bg-blue-200 text-blue-900",
        green: "bg-green-200 text-green-900",
        amber: "bg-amber-200 text-amber-900",
        red: "bg-red-200 text-red-900",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Badge({
  className,
  variant = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"span"> &
  VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot.Root : "span"

  return (
    <Comp
      data-slot="badge"
      data-variant={variant}
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  )
}

export { Badge, badgeVariants }
