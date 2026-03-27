import type { HTMLAttributes, PropsWithChildren } from "react";

import { cn } from "@/lib/utils";

export function Card({ children, className, ...props }: PropsWithChildren<HTMLAttributes<HTMLDivElement>>) {
  return (
    <div
      className={cn(
        "rounded-[var(--radius-lg)] border border-[color:var(--border)] bg-[var(--surface)] p-5 shadow-[var(--shadow-md)] backdrop-blur-sm sm:p-6",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}
