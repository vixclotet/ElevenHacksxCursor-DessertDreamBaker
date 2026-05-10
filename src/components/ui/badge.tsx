import * as React from "react";
import { cn } from "@/lib/cn";

export function Badge({
  className,
  ...props
}: React.HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border border-[color:var(--border)] bg-white/60 px-3 py-1 text-xs font-medium text-[color:var(--foreground)] shadow-sm backdrop-blur dark:bg-white/5",
        className,
      )}
      {...props}
    />
  );
}

