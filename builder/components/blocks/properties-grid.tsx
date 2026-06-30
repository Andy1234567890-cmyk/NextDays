// Buchungs-Blöcke: Objekt-Grid + Featured. Laden echte, tenant-gefilterte Objekte
// aus dem booking_engine-Slice (?tenant=) und rendern sie über die vorhandene
// ListingReihe. DAS ist der Buchungs-Vorsprung ggü. reinen Website-Buildern.
import { ListingReihe } from "@/components/listing-reihe";
import { pickText } from "@/lib/i18n";
import { type SuchParams, ladeInserate } from "@/lib/inserate";

/** Objekt-Grid: alle aktiven Objekte des Tenants (optional q/guests gefiltert). */
export async function PropertiesGridBlock({
  content,
  tenantId,
  search,
}: {
  content: Record<string, unknown>;
  tenantId: string;
  search?: SuchParams;
}) {
  const headline = pickText(content.headline);
  const params: SuchParams = {
    q: typeof content.q === "string" ? content.q : search?.q,
    guests:
      typeof content.guests === "number" ? content.guests : search?.guests,
    start: search?.start,
    end: search?.end,
  };
  const listings = await ladeInserate(params, tenantId);
  if (listings.length === 0) {
    return (
      <section className="mx-auto max-w-7xl px-6 py-8">
        {headline ? (
          <h2 className="mb-4 font-display text-2xl font-semibold">{headline}</h2>
        ) : null}
        <p className="text-sm text-muted-foreground">
          Aktuell sind keine Unterkünfte verfügbar.
        </p>
      </section>
    );
  }
  return (
    <section className="mx-auto max-w-7xl px-6 py-4">
      <ListingReihe reihe={{ titel: headline || "Unterkünfte", listings }} />
    </section>
  );
}

/** Featured: nur die im Editor ausgewählten Objekt-IDs. */
export async function FeaturedPropertiesBlock({
  content,
  tenantId,
}: {
  content: Record<string, unknown>;
  tenantId: string;
}) {
  const headline = pickText(content.headline);
  const ids = Array.isArray(content.property_ids)
    ? (content.property_ids as unknown[]).filter(
        (x): x is string => typeof x === "string",
      )
    : [];
  // Ohne Auswahl wird NICHTS gerendert (nicht „alle") — der Block bleibt leer.
  if (ids.length === 0) return null;
  const listings = await ladeInserate({ propertyIds: ids }, tenantId);
  if (listings.length === 0) return null;
  return (
    <section className="mx-auto max-w-7xl px-6 py-4">
      <ListingReihe
        reihe={{ titel: headline || "Empfohlene Unterkünfte", listings }}
      />
    </section>
  );
}
