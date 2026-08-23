// Buchungs-Blöcke: Objekt-Grid + Featured. Laden echte, tenant-gefilterte Objekte
// aus dem booking_engine-Slice und rendern sie als großes, responsives Grid aus
// Premium-Foto-Karten (Hover-Lift). DAS ist der Buchungs-Vorsprung ggü. reinen
// Website-Buildern.
import { ListingCard } from "@/components/listing-card";
import { type EditierModus, NICHT_EDITIERBAR, editierbar } from "@/lib/editier-kontext";
import { pickText } from "@/lib/i18n";
import { type SuchParams, ladeInserate } from "@/lib/inserate";
import type { Listing } from "@/lib/listings";
import { getSiteContext } from "@/lib/site-context";
import { texte } from "@/lib/texte";

/** Höchstzahl an Objekten, die ein Block rendert.
 *
 *  `content.limit` war bisher eine Attrappe: der Editor speicherte den Wert, der
 *  Renderer las ihn nie. Ein Betrieb, der „6 Objekte zeigen" eingestellt hatte,
 *  bekam alle — und hätte den Grund nie gefunden.
 *
 *  Die harte Obergrenze bleibt auch OHNE Einstellung: ein Betrieb mit 400
 *  Objekten würde sonst 400 Karten in eine Seite rendern (Wurzel 8). */
const MAX_KARTEN = 60;

function grenze(roh: unknown): number {
  const n = typeof roh === "number" ? roh : Number.NaN;
  if (!Number.isFinite(n) || n < 1) return MAX_KARTEN;
  return Math.min(Math.floor(n), MAX_KARTEN);
}

function Grid({
  listings,
  sprache,
  preisZeigen,
}: {
  listings: Listing[];
  sprache: string;
  preisZeigen: boolean;
}) {
  return (
    <div className="grid grid-cols-1 gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
      {listings.map((listing) => (
        <ListingCard
          key={listing.id}
          listing={listing}
          sprache={sprache}
          preisZeigen={preisZeigen}
        />
      ))}
    </div>
  );
}

function Section({
  headline,
  children,
  modus = NICHT_EDITIERBAR,
}: {
  headline: string | null;
  children: React.ReactNode;
  modus?: EditierModus;
}) {
  return (
    <section className="mx-auto max-w-7xl px-6 py-16">
      {headline ? (
        <h2
          {...editierbar(modus, "headline")}
          className="mb-8 font-display text-3xl font-semibold tracking-tight md:text-4xl"
        >
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
  modus = NICHT_EDITIERBAR,
}: {
  content: Record<string, unknown>;
  tenantId: string;
  search?: SuchParams;
  /** Editier-Marker nur in der Entwurfs-Vorschau. */
  modus?: EditierModus;
}) {
  const headline = pickText(content.headline, modus.locale);
  const params: SuchParams = {
    q: typeof content.q === "string" ? content.q : search?.q,
    guests:
      typeof content.guests === "number" ? content.guests : search?.guests,
    start: search?.start,
    end: search?.end,
  };
  const { branding } = await getSiteContext();
  // Basispreise nur, wenn der Betrieb es will ODER ein Zeitraum gewählt ist:
  // mit Datum ist der Preis konkret, ohne Datum ist er ein Ungefähr, das manche
  // Betriebe nicht zeigen wollen (0426).
  const preisZeigen =
    branding?.show_base_prices !== false ||
    Boolean(params.start && params.end);
  const alle = await ladeInserate(params, tenantId);
  const listings = alle.slice(0, grenze(content.limit));
  if (listings.length === 0) {
    return (
      <Section headline={headline || null} modus={modus}>
        <p className="text-muted-foreground">
          {texte(modus.locale).keineUnterkuenfte}
        </p>
      </Section>
    );
  }
  return (
    <Section headline={headline || null} modus={modus}>
      <Grid
        listings={listings}
        sprache={modus.locale}
        preisZeigen={preisZeigen}
      />
    </Section>
  );
}

/** Featured: nur die im Editor ausgewählten Objekt-IDs. */
export async function FeaturedPropertiesBlock({
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
  const ids = Array.isArray(content.property_ids)
    ? (content.property_ids as unknown[]).filter(
        (x): x is string => typeof x === "string",
      )
    : [];
  // Ohne Auswahl wird NICHTS gerendert (nicht „alle") — der Block bleibt leer.
  if (ids.length === 0) return null;
  const listings = (await ladeInserate({ propertyIds: ids }, tenantId)).slice(
    0,
    MAX_KARTEN,
  );
  if (listings.length === 0) return null;
  const { branding } = await getSiteContext();
  return (
    <Section headline={headline || null} modus={modus}>
      <Grid
        listings={listings}
        sprache={modus.locale}
        // Der Featured-Block zeigt namentlich gewählte Objekte. Der
        // Preis-Schalter gilt trotzdem: er ist eine Entscheidung über die
        // Preisdarstellung der Website, nicht über diesen einen Block.
        preisZeigen={branding?.show_base_prices !== false}
      />
    </Section>
  );
}
