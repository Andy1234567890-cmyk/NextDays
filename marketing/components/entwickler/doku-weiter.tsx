// Der Fuß jeder Leitfaden-Seite: „Nächste Seite · <Titel>".
//
// Referenz-UX: docs.lodgify.com setzt unter jede Doku-Seite genau diesen Link.
// Er macht aus einer Sammlung von Kapiteln einen Leseweg — ohne ihn muss man
// nach jedem Kapitel in die Sidebar zurück und selbst herausfinden, was folgt.
import Link from "next/link";

import { Icon } from "@/components/ui/icon";

export function DokuWeiter({
  label,
  titel,
  href,
}: {
  label: string;
  titel: string;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="group mt-10 flex max-w-3xl items-center justify-between gap-4 rounded-xl border border-border px-5 py-4 transition-colors hover:border-accent hover:bg-surface-warm/50"
    >
      <span>
        <span className="block text-[0.6875rem] font-semibold uppercase tracking-wider text-muted-foreground">
          {label}
        </span>
        <span className="mt-0.5 block font-medium">{titel}</span>
      </span>
      <Icon
        icon="ph:arrow-right"
        className="size-5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5"
      />
    </Link>
  );
}
