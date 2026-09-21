import { InputHTMLAttributes, ReactNode, forwardRef, useId, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/cn";

interface TextFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  icon?: ReactNode;
  error?: string;
  action?: ReactNode;
}

export const TextField = forwardRef<HTMLInputElement, TextFieldProps>(
  ({ label, icon, error, action, id, className, type, ...props }, ref) => {
    const autoId = useId();
    const inputId = id ?? autoId;
    const [visible, setVisible] = useState(false);
    const isPassword = type === "password";
    const resolvedType = isPassword ? (visible ? "text" : "password") : type;
    const errorId = `${inputId}-error`;
    const describedBy = props["aria-describedby"];
    const inputDescribedBy = error
      ? [describedBy, errorId].filter(Boolean).join(" ")
      : describedBy;

    return (
      <div className="flex flex-col gap-1.5">
        {(label || action) && (
        <div className="flex items-center justify-between">
          {label && <label htmlFor={inputId} className="text-sm font-medium text-text">
            {label}
          </label>}
          {action}
        </div>
        )}
        <div
          className={cn(
            "group flex items-center gap-2 rounded-[var(--radius)] border border-border bg-bg px-3.5",
            "focus-within:bg-bg-card focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/15 transition-colors",
            error && "border-danger focus-within:border-danger focus-within:ring-danger/15",
          )}
        >
          {icon && (
            <span className="text-text-muted shrink-0 transition-colors group-focus-within:text-primary">
              {icon}
            </span>
          )}
          <input
            ref={ref}
            id={inputId}
            type={resolvedType}
            className={cn(
              "h-11 w-full bg-transparent text-base text-text placeholder:text-text-muted outline-none sm:text-sm",
              className,
            )}
            {...props}
            aria-invalid={error ? true : props["aria-invalid"]}
            aria-describedby={inputDescribedBy}
          />
          {isPassword && (
            <button
              type="button"
              onClick={() => setVisible((v) => !v)}
              aria-label={visible ? "Ocultar senha" : "Mostrar senha"}
              className="-mr-3 flex min-h-11 min-w-11 shrink-0 items-center justify-center text-text-muted transition-colors hover:text-text-light focus-visible:outline-none focus-visible:text-primary"
            >
              {visible ? <EyeOff className="size-[18px]" /> : <Eye className="size-[18px]" />}
            </button>
          )}
        </div>
        {error && (
          <span id={errorId} role="alert" className="text-xs font-medium text-danger">
            {error}
          </span>
        )}
      </div>
    );
  },
);
TextField.displayName = "TextField";
