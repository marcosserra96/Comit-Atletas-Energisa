import { ButtonHTMLAttributes, forwardRef } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/cn";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "outline";
type Size = "sm" | "md";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
}

const variantClasses: Record<Variant, string> = {
  primary:
    "bg-primary text-white shadow-sm hover:bg-primary-hover hover:-translate-y-0.5 hover:shadow-[var(--shadow-primary-glow)] disabled:hover:bg-primary disabled:hover:translate-y-0 disabled:hover:shadow-sm",
  secondary:
    "bg-transparent text-text border border-border hover:bg-bg disabled:hover:bg-transparent",
  ghost: "bg-transparent text-text-light hover:text-text hover:bg-bg",
  danger: "bg-danger text-white hover:brightness-95 shadow-sm",
  outline: "bg-transparent border border-primary text-primary hover:bg-primary-subtle",
};

const sizeClasses: Record<Size, string> = {
  sm: "h-9 px-3 text-sm",
  md: "h-11 px-5 text-sm",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    { className, variant = "primary", size = "md", loading, disabled, children, ...props },
    ref,
  ) => {
    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={cn(
          "inline-flex items-center justify-center gap-2 rounded-[var(--radius)] font-semibold transition-all cursor-pointer",
          "disabled:opacity-60 disabled:cursor-not-allowed",
          "focus-visible:outline-none focus-visible:shadow-[var(--ring-primary)]",
          variantClasses[variant],
          sizeClasses[size],
          className,
        )}
        {...props}
      >
        {loading && <Loader2 className="size-4 animate-spin" />}
        {children}
      </button>
    );
  },
);
Button.displayName = "Button";
