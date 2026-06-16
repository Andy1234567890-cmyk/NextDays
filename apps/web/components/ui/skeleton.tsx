// Lade-Platzhalter (shadcn-Stil): animate-pulse über semantische Token-Farben.
import type { ComponentProps } from "react";

import { cn } from "@/lib/utils";

// Basis-Skeleton: pulsierender Block in gedämpfter Token-Farbe.
export function Skeleton({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "animate-pulse rounded-(--radius) bg-secondary",
        className,
      )}
      {...props}
    />
  );
}

// Textzeilen-Platzhalter: mehrere Zeilen unterschiedlicher Breite.
type SkeletonTextProps = ComponentProps<"div"> & { lines?: number };

export function SkeletonText({
  className,
  lines = 3,
  ...props
}: SkeletonTextProps) {
  return (
    <div className={cn("flex flex-col gap-2", className)} {...props}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          // Letzte Zeile kürzer, wirkt wie echter Absatz.
          className={cn("h-4", i === lines - 1 ? "w-2/3" : "w-full")}
        />
      ))}
    </div>
  );
}

// Runder Avatar-Platzhalter.
export function SkeletonAvatar({ className, ...props }: ComponentProps<"div">) {
  return (
    <Skeleton className={cn("size-10 rounded-full", className)} {...props} />
  );
}
