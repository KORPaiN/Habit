import type { ButtonHTMLAttributes, PropsWithChildren } from "react";

import { cn } from "@/lib/utils";

type ButtonProps = PropsWithChildren<
  ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: "primary" | "secondary" | "ghost";
    size?: "default" | "sm" | "lg";
    fullWidth?: boolean;
  }
>;

export function Button({
  children,
  className,
  variant = "primary",
  size = "default",
  fullWidth = false,
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-full border text-sm font-semibold transition duration-200 ease-out focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[color:var(--accent-soft)] disabled:cursor-not-allowed disabled:opacity-60",
        size === "sm" && "min-h-10 px-4 py-2.5 text-sm",
        size === "default" && "min-h-11 px-5 py-3",
        size === "lg" && "min-h-12 px-6 py-3.5 text-[15px]",
        variant === "primary" &&
          "border-[color:var(--primary)] bg-[var(--primary)] text-white shadow-[var(--shadow-sm)] hover:-translate-y-0.5 hover:bg-[var(--primary-strong)]",
        variant === "secondary" &&
          "border-transparent bg-[var(--primary-soft)] text-[var(--primary)] hover:-translate-y-0.5 hover:bg-[color:var(--success-soft)]",
        variant === "ghost" &&
          "border-[color:var(--border)] bg-white/58 text-[var(--foreground)] backdrop-blur hover:-translate-y-0.5 hover:border-[color:var(--border-strong)] hover:bg-white/78",
        fullWidth && "w-full",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}
