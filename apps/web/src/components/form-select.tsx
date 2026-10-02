import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

/** Native select styled like shadcn inputs (keeps forms dependency-free). */
export function Select({ className, ...props }: ComponentProps<"select">) {
  return <select className={cn("border-border h-9 w-full rounded-md border bg-input/30 px-2 text-sm outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50", className)} {...props} />;
}
