// Alert-Primitiv (shadcn-Stil, Tailwind-v4-Tokens, CVA-Varianten).
// Icons via Iconify — niemals lucide-react (PROJECT.md §2).
import { Icon } from "@iconify/react";
import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentProps } from "react";

import { cn } from "@/lib/utils";

const alertVariants = cva(
  "relative flex w-full items-start gap-3 rounded-(--radius) border p-4 text-sm",
  {
    variants: {
      variant: {
        default: "border-border bg-background text-foreground",
        destructive:
          "border-destructive bg-destructive/10 text-destructive [&_[data-slot=alert-icon]]:text-destructive",
        warning:
          "border-amber-500 bg-amber-500/10 text-amber-700 [&_[data-slot=alert-icon]]:text-amber-600",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

// Passendes Icon je Variante (Iconify ph:*).
const variantIcon: Record<NonNullable<VariantProps<typeof alertVariants>["variant"]>, string> = {
  default: "ph:info",
  destructive: "ph:warning-octagon",
  warning: "ph:warning",
};

type AlertProps = ComponentProps<"div"> &
  VariantProps<typeof alertVariants> & {
    // Icon überschreiben oder ausblenden (icon={null}).
    icon?: string | null;
  };

export function Alert({ className, variant = "default", icon, children, ...props }: AlertProps) {
  const resolvedIcon = icon === undefined ? variantIcon[variant ?? "default"] : icon;
  return (
    <div role="alert" className={cn(alertVariants({ variant }), className)} {...props}>
      {resolvedIcon ? (
        <Icon
          icon={resolvedIcon}
          data-slot="alert-icon"
          className="mt-0.5 size-5 shrink-0 text-muted-foreground"
          aria-hidden
        />
      ) : null}
      <div className="flex flex-col gap-1">{children}</div>
    </div>
  );
}

export function AlertTitle({ className, ...props }: ComponentProps<"h5">) {
  return (
    <h5 className={cn("font-medium leading-none tracking-tight", className)} {...props} />
  );
}

export function AlertDescription({ className, ...props }: ComponentProps<"p">) {
  return (
    <p className={cn("text-sm text-muted-foreground [&_p]:leading-relaxed", className)} {...props} />
  );
}

export { alertVariants };
