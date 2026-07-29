import * as React from "react";
import { cn } from "@/lib/utils";

export interface SwitchProps {
  checked?: boolean;
  defaultChecked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  disabled?: boolean;
  id?: string;
  "aria-label"?: string;
  className?: string;
}

/**
 * Accessible toggle. `@radix-ui/react-switch` is not a dependency of this
 * bundle, so this is a controlled/uncontrolled `role="switch"` button on the
 * Evidence tokens (violet when on).
 */
export const Switch = React.forwardRef<HTMLButtonElement, SwitchProps>(
  ({ checked, defaultChecked = false, onCheckedChange, disabled, className, ...props }, ref) => {
    const [internal, setInternal] = React.useState(defaultChecked);
    const isControlled = checked !== undefined;
    const on = isControlled ? checked : internal;

    return (
      <button
        ref={ref}
        type="button"
        role="switch"
        aria-checked={on}
        disabled={disabled}
        onClick={() => {
          if (!isControlled) setInternal((v) => !v);
          onCheckedChange?.(!on);
        }}
        className={cn(
          "peer inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50",
          on ? "bg-primary" : "bg-border-strong",
          className,
        )}
        {...props}
      >
        <span
          className={cn(
            "pointer-events-none block h-4 w-4 rounded-full bg-card shadow-sm ring-0 transition-transform",
            on ? "translate-x-4" : "translate-x-0",
          )}
        />
      </button>
    );
  },
);
Switch.displayName = "Switch";
