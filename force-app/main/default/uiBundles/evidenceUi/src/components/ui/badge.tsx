import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/**
 * Small status badge on the Evidence semantic tokens. For the categorical,
 * provenance-carrying pills that must stay stable in light and dark (outcome,
 * autonomy, evaluation), prefer the color-driven `Pill` in components/common.
 */
export const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-semibold leading-none whitespace-nowrap",
  {
    variants: {
      variant: {
        default: "border-primary/35 bg-primary/10 text-primary",
        neutral: "border-border-strong bg-muted text-muted-foreground",
        success: "border-success/35 bg-success/10 text-success",
        warning: "border-warning/35 bg-warning/10 text-warning",
        destructive: "border-destructive/35 bg-destructive/10 text-destructive",
        solid: "border-transparent bg-primary text-primary-foreground",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}
