import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Color-driven pill for the categorical, provenance-carrying marks (outcome,
 * autonomy, evaluation, bundle state). Takes a literal hex from the Evidence
 * palette (`@/domain` `PALETTE`) so the mark stays stable in light and dark
 * alike, rather than resolving through a theme token. For neutral status
 * chrome on semantic tokens, use `components/ui/badge`.
 */
export interface PillProps extends React.HTMLAttributes<HTMLSpanElement> {
  color: string;
  solid?: boolean;
  mono?: boolean;
}

export function Pill({ color, solid = false, mono = false, className, style, children, ...props }: PillProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-[11px] font-semibold leading-none whitespace-nowrap",
        mono && "font-mono",
        className,
      )}
      style={{
        color: solid ? "#fff" : color,
        background: solid ? color : `${color}1A`,
        border: solid ? "1px solid transparent" : `1px solid ${color}59`,
        ...style,
      }}
      {...props}
    >
      {children}
    </span>
  );
}
