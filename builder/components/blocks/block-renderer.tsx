// Zentraler Block-Renderer: dispatcht den Block-Baum einer Seite auf die
// jeweiligen Render-Komponenten. DER einzige Renderer der white-label Sites —
// der Editor-Canvas in apps/web bettet diese Ausgabe per iframe ein (kein
// Doppel-Renderer).
import { type BildLaden, bildLaden } from "@/lib/bilder";
import type { Block } from "@/lib/site";
import { type EditierModus, NICHT_EDITIERBAR } from "@/lib/editier-kontext";
import type { SuchParams } from "@/lib/inserate";

import { BewertungenBlock } from "./bewertungen";
import { BeitraegeBlock } from "./beitraege";
import { FaqBlock } from "./faq";
import { FormularBlock } from "./formular";
import { KarteBlock } from "./karte";
import { MerkmaleBlock } from "./merkmale";
import { StimmenBlock } from "./stimmen";
import { ButtonBlock, ContactBlock, GalleryBlock, ImageBlock, SpacerBlock } from "./simple-blocks";
import { FeaturedPropertiesBlock, PropertiesGridBlock } from "./properties-grid";
import { HeroBlock } from "./hero";
import { RichTextBlock } from "./rich-text";
import { type SiteBranding, getSiteContext } from "@/lib/site-context";

import { SearchBlock } from "./search-block";

/** Hintergrund eines Abschnitts: Farbe, Bild und dunkle Auflage (0432).
 *
 *  Die Auflage ist ein `linear-gradient` über dem Bild und keine zweite Ebene
 *  mit `::before`: als Teil derselben `background-image`-Angabe braucht sie kein
 *  zusätzliches Element und kann den Inhalt nicht verdecken.
 *
 *  Ein Bild ohne Auflage bleibt möglich (`background_overlay = 0`) — der Kunde
 *  entscheidet. Aber der Regler existiert, weil ein Hintergrundbild ohne ihn in
 *  der Praxis unbenutzbar ist: heller Text auf hellem Himmel. */
function bgStyle(settings: Record<string, unknown>): React.CSSProperties {
  const stil: React.CSSProperties = {};
  const bg = settings.background_color;
  if (typeof bg === "string") stil.backgroundColor = bg;

  const bild = settings.background_image_url;
  if (typeof bild === "string" && bild) {
    const roh = settings.background_overlay;
    const deckung =
      typeof roh === "number" && roh > 0 && roh <= 0.9 ? roh : 0;
    // `CSS.escape` gibt es serverseitig nicht; die Adresse ist beim Speichern
    // gegen die href-Allowlist geprüft (nur http(s)/relativ). Ein `"` darin
    // wäre trotzdem ein Ausbruch aus dem url() — deshalb wird es entfernt.
    const sicher = bild.replace(/["'\\()]/g, "");
    const auflage = deckung
      ? `linear-gradient(rgba(0,0,0,${deckung}), rgba(0,0,0,${deckung})), `
      : "";
    stil.backgroundImage = `${auflage}url("${sicher}")`;
    stil.backgroundSize = "cover";
    stil.backgroundPosition = "center";
  }
  return stil;
}

/** ZUSÄTZLICHER vertikaler Abstand eines Abschnitts (0432).
 *
 *  „Zusätzlich" ist der Kern: jeder Abschnitt setzt sein eigenes `py-*` (der
 *  Hero anders als eine Galerie), und dieser Wert kommt OBEN DRAUF. Er ersetzt
 *  es nicht — sonst müsste der Kunde für jeden Abschnittstyp den richtigen Wert
 *  raten, damit es aussieht wie vorher.
 *
 *  Deshalb bedeutet `md` — der Default des Schemas und der Wert JEDES
 *  bestehenden Blocks — genau NULL Zusatz. Ein neues Feld darf das Aussehen
 *  bestehender Kundenseiten nicht verändern (Wurzel 1); es kann nur mehr Luft
 *  geben (`lg`) oder den Abschnitt engmachen (`none`, `sm` ziehen zusammen).
 *
 *  Feste Klassennamen und keine Zusammensetzung: Tailwind erkennt
 *  `py-${n}` beim Bauen nicht, und die Klasse fehlt dann im CSS. */
function abstandKlasse(settings: Record<string, unknown>): string {
  switch (settings.padding) {
    case "none":
      // Zieht das eigene `py` des Abschnitts zusammen. Für zwei Abschnitte, die
      // als eine Fläche wirken sollen (Bild direkt unter der Überschrift).
      return "[&>*]:py-0";
    case "sm":
      return "[&>*]:py-6";
    case "lg":
      return "py-12";
    default:
      // `md` und alles Unbekannte: unverändert wie bisher.
      return "";
  }
}

async function renderBlock(
  block: Block,
  tenantId: string,
  modus: EditierModus,
  search?: SuchParams,
  aufgeschluesselt = false,
  /** Wie die Bilder DIESES Blocks laden (0430). Hängt an seiner Position: der
   *  erste Abschnitt lädt immer sofort, alles darunter folgt der Einstellung. */
  laden: BildLaden = "lazy",
  /** Site-Branding. Der FAQ-Block braucht den Schema-Schalter (0431); der
   *  Renderer hat es ohnehin geladen. */
  branding: SiteBranding | null = null,
  /** Die DB-ID dieses Blocks. Nur der Formular-Abschnitt braucht sie (zum
   *  Absenden); alle anderen kommen ohne aus, weshalb der öffentliche Resolver
   *  sie normalerweise nicht mitliefert. */
  blockId: string | null = null,
): Promise<React.ReactNode> {
  switch (block.type) {
    case "hero":
      return <HeroBlock content={block.content} modus={modus} />;
    case "rich_text":
      return <RichTextBlock content={block.content} modus={modus} />;
    case "image":
      return (
        <ImageBlock content={block.content} modus={modus} laden={laden} />
      );
    case "gallery":
      return (
        <GalleryBlock content={block.content} modus={modus} laden={laden} />
      );
    case "button":
      return <ButtonBlock content={block.content} modus={modus} />;
    case "spacer":
      return <SpacerBlock content={block.content} />;
    case "contact":
      return <ContactBlock content={block.content} modus={modus} />;
    case "search":
      return (
        <SearchBlock
          content={block.content}
          modus={modus}
          aufgeschluesselt={aufgeschluesselt}
        />
      );
    case "properties_grid":
      return (
        <PropertiesGridBlock
          content={block.content}
          tenantId={tenantId}
          search={search}
          modus={modus}
          laden={laden}
        />
      );
    case "featured_properties":
      return (
        <FeaturedPropertiesBlock
          content={block.content}
          tenantId={tenantId}
          modus={modus}
          laden={laden}
        />
      );
    case "reviews":
      return (
        <BewertungenBlock
          content={block.content}
          tenantId={tenantId}
          modus={modus}
        />
      );
    case "posts":
      return <BeitraegeBlock content={block.content} modus={modus} />;
    case "form":
      // Der Block braucht seine eigene ID, um absenden zu können — und die
      // steckt nicht im `content`. Sie wird hier hineingelegt: der öffentliche
      // Resolver liefert Blöcke ohne ID (nur type/content/settings), weil keine
      // andere Stelle sie braucht.
      return (
        <FormularBlock
          content={{ ...block.content, __block_id: blockId }}
          modus={modus}
          branding={branding}
        />
      );
    case "map":
      return (
        <KarteBlock
          content={block.content}
          modus={modus}
          branding={branding}
        />
      );
    case "testimonials":
      return <StimmenBlock content={block.content} modus={modus} />;
    case "features":
      return <MerkmaleBlock content={block.content} modus={modus} />;
    case "faq":
      // `branding` reicht der Aufrufer durch: der Block braucht es für den
      // Schema-Schalter, und es einmal im Renderer zu holen ist billiger als
      // ein zweiter Aufruf im Block.
      return (
        <FaqBlock
          content={block.content}
          modus={modus}
          branding={branding}
        />
      );
    default:
      return null;
  }
}

export async function BlockRenderer({
  blocks,
  tenantId,
  search,
  modus = NICHT_EDITIERBAR,
}: {
  blocks: Block[];
  tenantId: string;
  search?: SuchParams;
  /** Editier-Marker nur in der Entwurfs-Vorschau; live bleibt es beim Default. */
  modus?: EditierModus;
}) {
  // Die Anzeige-Einstellung der Website gilt für ALLE Blöcke — sie ist eine
  // Entscheidung über die Seite, nicht über einen Abschnitt. Deshalb einmal hier
  // geholt und nicht in jedem Block noch einmal (ein Fetch pro Block wäre
  // derselbe Wert N-mal).
  const { branding } = await getSiteContext();
  const aufgeschluesselt = branding?.show_guest_breakdown === true;
  const rendered = await Promise.all(
    blocks.map((b, i) =>
      renderBlock(
        b,
        tenantId,
        modus,
        search,
        aufgeschluesselt,
        bildLaden(branding, i),
        branding ?? null,
        b.id ?? null,
      ),
    ),
  );
  return (
    <>
      {blocks.map((block, i) => (
        <div
          key={i}
          data-block-index={i}
          className={abstandKlasse(block.settings)}
          style={bgStyle(block.settings)}
        >
          {rendered[i]}
        </div>
      ))}
    </>
  );
}
