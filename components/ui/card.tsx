import type { HTMLAttributes, PropsWithChildren } from "react";

import { cn } from "@/lib/utils";

export function Card({ children, className, ...props }: PropsWithChildren<HTMLAttributes<HTMLDivElement>>) {
  return (
    <div
      className={cn(
        "rounded-[28px] border border-[var(--border)] bg-[var(--card)] p-6 shadow-[0_20px_80px_-40px_rgba(15,23,42,0.35)] backdrop-blur",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}
