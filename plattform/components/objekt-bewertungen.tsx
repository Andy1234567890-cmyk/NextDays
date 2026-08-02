// Bewertungsabschnitt der Inserat-Detailseite: Gesamtnote, Kategorie-Balken und
// die Bewertungen selbst (mit Antwort des Gastgebers).
//
// Gezeigt wird ausschließlich, was das Backend geliefert hat: fehlt ein
// Kategorie-Durchschnitt, entfällt der Balken — es wird keine Null gezeichnet.
// Nur eigene, verifizierte myBestDays-Bewertungen; Portal-Bewertungen erscheinen
// hier bewusst nicht.
import { Icon } from "@iconify/react";

import { Sterne } from "@/components/sterne";
import { KATEGORIEN, type PropertyReviews } from "@/lib/guest-reviews";
import { formatDate } from "@/lib/format";

export function ObjektBewertungen({ daten }: { daten: PropertyReviews }) {
  if (daten.count === 0 || daten.average == null) return null;
  const schnitt = daten.category_averages;

  return (
    <div className="border-t border-border py-6">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="font-display text-xl font-semibold">
          <Icon icon="ph:star-fill" className="mb-1 inline size-5 text-accent" />{" "}
          {daten.average.toLocaleString("de-DE")}
        </h2>
        <span className="text-sm text-muted-foreground">
          · {daten.count} {daten.count === 1 ? "Bewertung" : "Bewertungen"}
        </span>
      </div>

      {schnitt && (
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          {KATEGORIEN.map((k) => {
            const wert = schnitt[k.key];
            if (wert == null) return null;
            return (
              <div key={k.key} className="flex items-center gap-3">
                <span className="w-32 shrink-0 text-sm text-muted-foreground">
                  {k.label}
                </span>
                <span className="h-1 flex-1 overflow-hidden rounded-full bg-secondary">
                  <span
                    className="block h-full rounded-full bg-foreground"
                    style={{ width: `${(wert / 5) * 100}%` }}
                  />
                </span>
                <span className="w-10 shrink-0 text-right text-sm">
                  {wert.toLocaleString("de-DE")}
                </span>
              </div>
            );
          })}
        </div>
      )}

      <div className="mt-6 grid gap-5 sm:grid-cols-2">
        {daten.reviews.map((r) => (
          <div key={r.id} className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <span className="flex size-9 items-center justify-center rounded-full bg-secondary text-sm font-semibold">
                {(r.author ?? "G").slice(0, 1).toUpperCase()}
              </span>
              <div className="flex flex-col">
                <span className="text-sm font-medium">{r.author ?? "Gast"}</span>
                <span className="text-xs text-muted-foreground">
                  {formatDate(r.created_at)}
                </span>
              </div>
            </div>
            <Sterne wert={r.rating} />
            {r.text && (
              <p className="whitespace-pre-line text-sm text-foreground">{r.text}</p>
            )}
            {r.host_reply && (
              <div className="rounded-xl bg-secondary p-3">
                <p className="text-xs font-semibold text-muted-foreground">
                  Antwort des Gastgebers
                  {r.host_reply_at ? ` · ${formatDate(r.host_reply_at)}` : ""}
                </p>
                <p className="mt-1 text-sm">{r.host_reply}</p>
              </div>
            )}
          </div>
        ))}
      </div>

      {daten.count > daten.reviews.length && (
        <p className="mt-4 text-sm text-muted-foreground">
          {daten.reviews.length} von {daten.count} Bewertungen
        </p>
      )}
    </div>
  );
}
