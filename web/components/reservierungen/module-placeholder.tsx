// Ehrlicher Platzhalter für PM-Modul-Reiter, deren eigene Fläche noch nicht
// existiert. Kein Fake-Inhalt (CLAUDE.md Wurzel 4) — die Seite sagt klar, was
// hier später kommt, und verlinkt ggf. auf eine bestehende Fläche. So stimmt
// „Klick auf den Reiter führt dahin", ohne erfundene Daten.
import { Icon } from "@iconify/react";
import Link from "next/link";

import { Card } from "@nextdays/ui/card";

export function ModulePlaceholder({
  title,
  icon,
  description,
  link,
}: {
  title: string;
  icon: string;
  description: string;
  link?: { href: string; label: string };
}) {
  return (
    <div className="flex flex-col gap-5">
      <h1 className="font-display text-2xl font-extrabold">{title}</h1>
      <Card className="flex flex-col items-center gap-3 p-10 text-center">
        <span className="flex size-12 items-center justify-center rounded-full bg-secondary text-muted-foreground">
          <Icon icon={icon} className="size-6" />
        </span>
        <p className="max-w-md text-sm text-muted-foreground">{description}</p>
        {link && (
          <Link
            href={link.href}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-accent hover:underline"
          >
            <Icon icon="ph:arrow-right" className="size-4" />
            {link.label}
          </Link>
        )}
      </Card>
    </div>
  );
}
