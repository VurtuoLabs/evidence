import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Lightweight scroll container. `@radix-ui/react-scroll-area` is intentionally
 * not a dependency of this bundle, so this is a styled native-overflow region
 * with a thin themed scrollbar rather than a custom-rendered one.
 */
export const ScrollArea = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & { viewportClassName?: string }
>(({ className, viewportClassName, children, ...props }, ref) => (
  <div ref={ref} className={cn("relative overflow-hidden", className)} {...props}>
    <div className={cn("h-full w-full overflow-auto evidence-scroll", viewportClassName)}>
      {children}
    </div>
  </div>
));
ScrollArea.displayName = "ScrollArea";
