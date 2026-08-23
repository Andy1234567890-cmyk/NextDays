// Bewertungs-Block der white-label Website. Zeigt AUSSCHLIESSLICH eigene,
// verifizierte myBestDays-Bewertungen — Portal-Bewertungen (Booking.com/Airbnb)
// gehören nicht hierher, deren Bedingungen erlauben das Weiterveröffentlichen
// nur eingeschränkt.
//
// Ohne `property_id` kommen die Bewertungen aller Objekte des Betriebs. Gibt es
// keine veröffentlichte Bewertung, rendert der Block NICHTS — eine leere
// Sternreihe wäre eine Null-Bewertung (Wurzel 4).
import { type EditierModus, NICHT_EDITIERBAR, editierbar } from "@/lib/editier-kontext";
import { pickText } from "@/lib/i18n";
import {
  KATEGORIEN,
  ladeBewertungen,
  type ObjektBewertungen,
} from "@/lib/bewertungen";

function Sterne({ wert }: { wert: number }) {
  const voll = Math.round(wert);
  return (
    <span className="inline-flex items-center gap-0.5 text-amber-500">
      {[1, 2, 3, 4, 5].map((n) => (
        <svg key={n} viewBox="0 0 24 24" className="size-4" aria-hidden="true">
          <path
            d="M12 3.2l2.6 5.3 5.8.8-4.2 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8L3.4 9.3l5.8-.8z"
            fill={n <= voll ? "currentColor" : "none"}
            stroke="currentColor"
            strokeWidth={n <= voll ? 0 : 1.4}
          />
        </svg>
      ))}
    </span>
  );
}

export async function BewertungenBlock({
  content,
  tenantId,
  modus = NICHT_EDITIERBAR,
}: {
  content: Record<string, unknown>;
  tenantId: string;
  /** Editier-Marker nur in der Entwurfs-Vorschau. */
  modus?: EditierModus;
}) {
  const headline = pickText(content.headline, modus.locale);
  const propertyId =
    typeof content.property_id === "string" && content.property_id
      ? content.property_id
      : null;
  const limit = typeof content.limit === "number" ? content.limit : 6;
  const zeigeKategorien = content.show_categories !== false;

  const daten: ObjektBewertungen | null = await ladeBewertungen(
    { tenantId, propertyId },
    limit,
  );
  if (!daten || daten.count === 0 || daten.average == null) return null;

  return (
    <section className="mx-auto max-w-7xl px-6 py-16">
      <div className="flex flex-wrap items-baseline gap-3">
        {headline ? (
          <h2
            {...editierbar(modus, "headline")}
            className="font-display text-3xl font-semibold tracking-tight md:text-4xl"
          >
            {headline}
          </h2>
        ) : null}
        <span className="flex items-center gap-2 text-lg">
          <Sterne wert={daten.average} />
          <span className="font-semibold">
            {daten.average.toLocaleString("de-DE")}
          </span>
          <span className="text-muted-foreground">
            · {daten.count} {daten.count === 1 ? "Bewertung" : "Bewertungen"}
          </span>
        </span>
      </div>

      {zeigeKategorien && daten.category_averages ? (
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {KATEGORIEN.map((k) => {
            const wert = daten.category_averages?.[k.key];
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
      ) : null}

      <div className="mt-10 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
        {daten.reviews.map((r) => (
          <figure key={r.id} className="flex flex-col gap-3">
            <Sterne wert={r.rating} />
            {r.text ? (
              <blockquote className="text-sm whitespace-pre-line">
                {r.text}
              </blockquote>
            ) : null}
            <figcaption className="text-sm text-muted-foreground">
              {r.author ?? "Gast"}
            </figcaption>
            {r.host_reply ? (
              <p className="rounded-xl bg-secondary p-3 text-sm">
                {r.host_reply}
              </p>
            ) : null}
          </figure>
        ))}
      </div>
    </section>
  );
}
