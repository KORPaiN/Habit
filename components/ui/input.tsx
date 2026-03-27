import type { InputHTMLAttributes } from "react";

import { cn } from "@/lib/utils";

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "w-full rounded-[var(--radius-md)] border border-[color:var(--border)] bg-white/72 px-4 py-3.5 text-sm text-[var(--foreground)] outline-none transition duration-200 placeholder:text-[var(--muted)] focus:border-[color:var(--primary)] focus:bg-white focus:ring-4 focus:ring-[color:var(--accent-soft)]",
        className,
      )}
      {...props}
    />
  );
}
