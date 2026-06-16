// Avatar-Primitiv (shadcn-Stil) auf Basis von @radix-ui/react-avatar.
// Bild mit automatischem Initialen-Fallback; nur semantische Token-Klassen.
"use client";

import * as AvatarPrimitive from "@radix-ui/react-avatar";
import type { ComponentProps } from "react";

import { cn } from "@/lib/utils";

// Wurzel-Element: rundes Wrapper-Element fester Größe.
export function Avatar({
  className,
  ...props
}: ComponentProps<typeof AvatarPrimitive.Root>) {
  return (
    <AvatarPrimitive.Root
      className={cn(
        "relative flex h-10 w-10 shrink-0 overflow-hidden rounded-full",
        className,
      )}
      {...props}
    />
  );
}

// Bild: füllt den Avatar; wird bei Ladefehler automatisch ausgeblendet.
export function AvatarImage({
  className,
  ...props
}: ComponentProps<typeof AvatarPrimitive.Image>) {
  return (
    <AvatarPrimitive.Image
      className={cn("aspect-square h-full w-full object-cover", className)}
      {...props}
    />
  );
}

// Fallback: Initialen auf neutralem Token-Hintergrund, wenn kein Bild lädt.
export function AvatarFallback({
  className,
  ...props
}: ComponentProps<typeof AvatarPrimitive.Fallback>) {
  return (
    <AvatarPrimitive.Fallback
      className={cn(
        "flex h-full w-full items-center justify-center rounded-full bg-secondary text-sm font-medium text-muted-foreground",
        className,
      )}
      {...props}
    />
  );
}
