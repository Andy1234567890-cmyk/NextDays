// Übersicht aller Ankündigungen. Bewusst eine reine Server-Component-Liste:
// Ankündigungen ändern sich redaktionell (Minuten bis Tage), nicht im Sekunden-
// takt — und Realtime wäre hier ohnehin nicht möglich (siehe Seite).
import Link from "next/link";

import {
  KATEGORIE_LABEL,
  STATUS_LABEL,
  type Ankuendigung,
} from "@/lib/announcements";

function datum(wert: string | null): string {
  if (!wert) return "—";
  return new Date(wert).toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export function AnkuendigungListe({ items }: { items: Ankuendigung[] }) {
  if (items.length === 0) {
    return (
      <p className="mt-8 text-sm text-muted-foreground">
        Noch keine Ankündigung angelegt.
      </p>
    );
  }

  return (
    <ul className="mt-8 max-w-4xl divide-y divide-border rounded-2xl border border-border">
      {items.map((a) => (
        <li key={a.id}>
          <Link
            href={`/ankuendigungen/${a.id}`}
            className="flex flex-wrap items-center gap-3 px-5 py-4 transition-colors hover:bg-muted/40"
          >
            <span className="min-w-0 flex-1">
              <span className="flex flex-wrap items-center gap-2">
                <span className="truncate text-sm font-medium">{a.titel}</span>
                <span className="rounded-full bg-muted px-2 py-0.5 text-[0.6875rem] text-muted-foreground">
                  {KATEGORIE_LABEL[a.kategorie]}
                </span>
                {a.als_popup && (
                  <span className="rounded-full bg-foreground px-2 py-0.5 text-[0.6875rem] font-medium text-background">
                    Popup
                  </span>
                )}
              </span>
              <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                {a.kurztext || "Kein Kurztext"}
              </span>
            </span>

            <span className="shrink-0 text-right">
              <span className="block text-xs font-medium">
                {STATUS_LABEL[a.status]}
              </span>
              <span className="mt-0.5 block text-xs text-muted-foreground">
                {a.status === "veroeffentlicht"
                  ? `seit ${datum(a.veroeffentlicht_am)}`
                  : `angelegt ${datum(a.created_at)}`}
              </span>
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
