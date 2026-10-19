import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** 390px mobile-first app shell, centered on larger screens. */
export function PhoneFrame({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className="min-h-dvh bg-canvas text-ink">
      <div
        className={cn(
          "relative mx-auto flex min-h-dvh w-full max-w-[390px] flex-col overflow-hidden bg-canvas",
          className
        )}
      >
        {children}
      </div>
    </div>
  );
}
