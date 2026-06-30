// Buchungs-Blöcke: Objekt-Grid + Featured. Laden echte, tenant-gefilterte Objekte
// aus dem booking_engine-Slice und rendern sie als großes, responsives Grid aus
// Premium-Foto-Karten (Hover-Lift). DAS ist der Buchungs-Vorsprung ggü. reinen
// Website-Buildern.
import { ListingCard } from "@/components/listing-card";
import { pickText } from "@/lib/i18n";
import { type SuchParams, ladeInserate } from "@/lib/inserate";
import type { Listing } from "@/lib/listings";

function Grid({ listings }: { listings: Listing[] }) {
  return (
    <div className="grid grid-cols-1 gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
      {listings.map((listing) => (
        <ListingCard key={listing.id} listing={listing} />
      ))}
    </div>
  );
}

function Section({
  headline,
  children,
}: {
  headline: string | null;
  children: React.ReactNode;
}) {
  return (
    <section className="mx-auto max-w-7xl px-6 py-16">
      {headline ? (
        <h2 className="mb-8 font-display text-3xl font-semibold tracking-tight md:text-4xl">
          {headline}
        </h2>
      ) : null}
      {children}
    </section>
  );
}

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
      <Section headline={headline || "Unterkünfte"}>
        <p className="text-muted-foreground">
          Aktuell sind keine Unterkünfte verfügbar.
        </p>
      </Section>
    );
  }
  return (
    <Section headline={headline || "Unsere Unterkünfte"}>
      <Grid listings={listings} />
    </Section>
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
    <Section headline={headline || "Empfohlene Unterkünfte"}>
      <Grid listings={listings} />
    </Section>
  );
}
