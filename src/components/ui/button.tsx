import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cn } from "@/lib/cn";

type ButtonVariant = "primary" | "secondary" | "ghost";
type ButtonSize = "sm" | "md" | "lg" | "icon";

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  asChild?: boolean;
  variant?: ButtonVariant;
  size?: ButtonSize;
}

const base =
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-2xl text-sm font-medium transition will-change-transform active:scale-[0.99] disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-none";

const variants: Record<ButtonVariant, string> = {
  primary:
    "bg-[color:var(--primary)] text-[color:var(--primary-foreground)] shadow-sm hover:opacity-95",
  secondary:
    "bg-[color:var(--muted)] text-[color:var(--foreground)] border border-[color:var(--border)] hover:bg-white/70 dark:hover:bg-white/5",
  ghost:
    "bg-transparent text-[color:var(--foreground)] hover:bg-black/5 dark:hover:bg-white/10",
};

const sizes: Record<ButtonSize, string> = {
  sm: "h-9 px-3",
  md: "h-10 px-4",
  lg: "h-12 px-6 text-base",
  icon: "h-10 w-10",
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", asChild, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        ref={ref}
        className={cn(base, variants[variant], sizes[size], className)}
        {...props}
      />
    );
  },
);
Button.displayName = "Button";

