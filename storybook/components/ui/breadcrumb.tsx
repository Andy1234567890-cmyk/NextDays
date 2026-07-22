// Breadcrumb-Navigation (shadcn-Stil, Tailwind-v4-Tokens).
// Icons via Iconify (ph:*) — niemals lucide-react (PROJECT.md §2).
import { Slot } from "@radix-ui/react-slot";
import { Icon } from "@iconify/react";
import type { ComponentProps } from "react";

import { cn } from "@/lib/utils";

// Wurzel: semantisches <nav> mit ARIA-Label.
export function Breadcrumb({ ...props }: ComponentProps<"nav">) {
  return <nav aria-label="Brotkrumen" {...props} />;
}

// Geordnete Liste der Krumen.
export function BreadcrumbList({ className, ...props }: ComponentProps<"ol">) {
  return (
    <ol
      className={cn(
        "flex flex-wrap items-center gap-1.5 break-words text-sm text-muted-foreground sm:gap-2.5",
        className,
      )}
      {...props}
    />
  );
}

// Einzelnes Listenelement.
export function BreadcrumbItem({ className, ...props }: ComponentProps<"li">) {
  return (
    <li
      className={cn("inline-flex items-center gap-1.5", className)}
      {...props}
    />
  );
}

// Verlinkte Krume; via asChild auch mit Router-Link nutzbar.
type BreadcrumbLinkProps = ComponentProps<"a"> & { asChild?: boolean };

export function BreadcrumbLink({
  className,
  asChild = false,
  ...props
}: BreadcrumbLinkProps) {
  const Comp = asChild ? Slot : "a";
  return (
    <Comp
      className={cn(
        "transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-(--radius)",
        className,
      )}
      {...props}
    />
  );
}

// Aktuelle (letzte) Seite — nicht verlinkt.
export function BreadcrumbPage({ className, ...props }: ComponentProps<"span">) {
  return (
    <span
      role="link"
      aria-disabled="true"
      aria-current="page"
      className={cn("font-medium text-foreground", className)}
      {...props}
    />
  );
}

// Separator: standardmäßig Iconify-Chevron, eigener Inhalt via children möglich.
export function BreadcrumbSeparator({
  children,
  className,
  ...props
}: ComponentProps<"li">) {
  return (
    <li
      role="presentation"
      aria-hidden="true"
      className={cn("[&>svg]:size-3.5 text-muted-foreground", className)}
      {...props}
    >
      {children ?? <Icon icon="ph:caret-right" />}
    </li>
  );
}

// Auslassung für gekürzte Pfade.
export function BreadcrumbEllipsis({
  className,
  ...props
}: ComponentProps<"span">) {
  return (
    <span
      role="presentation"
      aria-hidden="true"
      className={cn("flex size-9 items-center justify-center", className)}
      {...props}
    >
      <Icon icon="ph:dots-three" className="size-4" />
      <span className="sr-only">Mehr</span>
    </span>
  );
}
