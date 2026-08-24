// Referenz-Komponente (shadcn-Stil, Tailwind-v4-Tokens, CVA-Varianten).
// Icons via Iconify — niemals lucide-react (PROJECT.md §2).
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentProps } from "react";

import { cn } from "@/lib/utils";

// KEIN `whitespace-nowrap`, und die Größen setzen `min-h-*` statt `h-*`.
//
// Grund: die Beschriftungen kommen aus 24 Sprachdateien. „Explore all
// features" ist auf Dänisch „Udforsk alle funktioner i den gratis
// prøveperiode" — mit `whitespace-nowrap` wurde dieser Knopf 393 px breit und
// hat bei 320 px Bildschirmbreite die ganze Startseite quer scrollen lassen
// (live gemessen, da @ 320 px). Ein Knopf, der nicht umbrechen darf, ist eine
// versteckte Breitenannahme über 24 Sprachen — dieselbe Klasse Fehler wie
// die fehlende Silbentrennung an den Überschriften (globals.css).
//
// `min-h-*` statt `h-*`, weil eine feste Höhe die zweite Zeile abschneiden
// würde. Bei einzeiligen Beschriftungen — dem Normalfall — ist die
// Darstellung unverändert: die Mindesthöhe IST dann die Höhe.
// `icon` behält die feste Größe, ein Icon-Knopf muss quadratisch bleiben.
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 rounded-full text-center text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:opacity-90",
        accent: "bg-accent text-accent-foreground hover:opacity-90",
        outline: "border border-border bg-background hover:bg-secondary",
        ghost: "hover:bg-secondary",
        destructive: "bg-destructive text-destructive-foreground hover:opacity-90",
      },
      size: {
        default: "min-h-10 px-4 py-2",
        sm: "min-h-9 px-3 py-1.5",
        lg: "min-h-11 px-6 py-2.5",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);

type ButtonProps = ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & { asChild?: boolean };

export function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: ButtonProps) {
  const Comp = asChild ? Slot : "button";
  return (
    <Comp
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    />
  );
}

export { buttonVariants };
