import * as React from "react";
import * as SwitchPrimitives from "@radix-ui/react-switch";
import { cn } from "@/lib/cn";

export const Switch = React.forwardRef<
  React.ElementRef<typeof SwitchPrimitives.Root>,
  React.ComponentPropsWithoutRef<typeof SwitchPrimitives.Root>
>(({ className, ...props }, ref) => (
  <SwitchPrimitives.Root
    className={cn(
      "peer inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border border-[color:var(--border)] bg-black/10 transition data-[state=checked]:bg-[color:var(--sage)] dark:bg-white/10",
      className,
    )}
    {...props}
    ref={ref}
  >
    <SwitchPrimitives.Thumb
      className={cn(
        "pointer-events-none block h-5 w-5 translate-x-0 rounded-full bg-white shadow-sm transition-transform data-[state=checked]:translate-x-5 dark:bg-zinc-100",
      )}
    />
  </SwitchPrimitives.Root>
));
Switch.displayName = "Switch";

