// Zentraler Block-Renderer: dispatcht den Block-Baum einer Seite auf die
// jeweiligen Render-Komponenten. DER einzige Renderer der white-label Sites —
// der Editor-Canvas in apps/web bettet diese Ausgabe per iframe ein (kein
// Doppel-Renderer).
import { type BildLaden, bildLaden } from "@/lib/bilder";
import { alleBildnachweise, bildnachweisAusListe } from "@/lib/bildnachweis";
import { type Block, type PageMeta, versteckteGeraete } from "@/lib/site";
import { type EditierModus, NICHT_EDITIERBAR } from "@/lib/editier-kontext";
import type { SuchParams } from "@/lib/inserate";
import type { Listing } from "@/lib/listings";

import {
  AccordionBlock,
  BrotkrumenBlock,
  CopyrightBlock,
  DateienBlock,
  ListeBlock,
  TabelleBlock,
} from "./basis-blocks";
import { CountdownBlock } from "./countdown";
import { ReiterBlock } from "./reiter";
import { BewertungenBlock } from "./bewertungen";
import { BeitraegeBlock } from "./beitraege";
import { BeitragslisteBlock } from "./beitragsliste";
import {
  CheckoutFormBlock,
  CheckoutResultBlock,
  CheckoutSummaryBlock,
} from "./checkout-blocks";
import { BeitragssucheBlock } from "./beitragssuche";
import { FaqBlock } from "./faq";
import { FormularBlock } from "./formular";
import { KarteBlock } from "./karte";
import { MerkmaleBlock } from "./merkmale";
import { StimmenBlock } from "./stimmen";
import { ButtonBlock, ContactBlock, ImageBlock, SpacerBlock } from "./simple-blocks";
import { GalerieBlock } from "./galerie";
import { AudioBlock, FormBlock, VideoBlock } from "./medien-blocks";
import {
  AnrufBlock,
  EmailBlock,
  OeffnungszeitenBlock,
  StandorteBlock,
} from "./business-blocks";
import {
  FacebookFeedBlock,
  HtmlWidgetBlock,
  RssFeedBlock,
  SocialIconsBlock,
  WhatsappChatBlock,
} from "./social-blocks";
import { ShareButtonBlock } from "./share-button";
import {
  BuchungsBlock,
  ObjektAusstattungBlock,
  ObjektBeschreibungBlock,
  ObjektKarteBlock,
} from "./objekt-blocks";
// Eigene Datei, weil Client-Komponente: die Lightbox ist Zustand im Browser
// (0474). Die übrigen Objekt-Bausteine bleiben serverseitig.
import { ObjektGalerieBlock } from "./objekt-galerie";
import { SliderBlock, VorherNachherBlock } from "./slider";
import { FeaturedPropertiesBlock, PropertiesGridBlock } from "./properties-grid";
import { HeroBlock } from "./hero";
import { RichTextBlock } from "./rich-text";
import { type SiteBranding, getSiteContext } from "@/lib/site-context";

import { BildNachweis, BildnachweisBereich } from "./bildnachweis";
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

/** Sichtbarkeit je Gerät (0449) — die Klasse für den Abschnitts-Rahmen.
 *
 *  DREI Bereiche, weil der Geräte-Umschalter drei Knöpfe hat und jeder eine
 *  eigene Vorschaubreite: `mobil` ist die Basis (unter 768 px, Bühne 390),
 *  `tablet` beginnt bei `md` (768 px, Bühne 820), `desktop` bei `lg`
 *  (1024 px, Bühne voll). Die Bühnenbreiten liegen absichtlich MITTEN in ihrem
 *  Bereich und nicht auf der Kante — sonst entschiede ein Pixel Scrollbalken
 *  darüber, welchen Zustand die Vorschau zeigt.
 *
 *  ZWEI verschiedene Antworten, und das ist der Kern:
 *
 *  * **Live** wird wirklich ausgeblendet.
 *  * **Im Editor** wird NICHTS ausgeblendet, sondern nur durchscheinend
 *    gezeigt. Ein Abschnitt, der beim Ausblenden aus der Arbeitsfläche
 *    verschwindet, hat keinen Rückweg mehr — genau das ist bei Hostaway der
 *    Fall, und deshalb braucht es dort ein Ebenen-Panel, um ihn zurückzuholen.
 *    Bei uns bleibt er stehen; und weil die Durchsichtigkeit AM BREAKPOINT
 *    hängt, sieht der Kunde beim Umschalten der Gerätebreite genau, auf welchem
 *    Gerät der Abschnitt fehlen wird.
 *
 *  Gebaut wird die Klasse aus den drei Sichtbarkeiten und nicht aus einer
 *  Fallunterscheidung: bei drei Geräten sind es acht Fälle, und eine
 *  ausgeschriebene Kette davon ist die Stelle, an der beim vierten Gerät einer
 *  fehlt. Eine Stufe wird nur gesetzt, wenn sie sich von der darunter
 *  UNTERSCHEIDET — sonst stünden überflüssige Klassen im Markup, die einander
 *  überschreiben.
 */
function sichtbarkeitKlasse(
  settings: Record<string, unknown>,
  editierbar: boolean,
): string {
  const aus = versteckteGeraete(settings);
  if (aus.length === 0) return "";
  // Von schmal nach breit — genau die Richtung, in der Tailwind stapelt.
  const an = {
    mobil: !aus.includes("mobil"),
    tablet: !aus.includes("tablet"),
    desktop: !aus.includes("desktop"),
  };
  const klassen: string[] = [];
  if (editierbar) {
    klassen.push(an.mobil ? "opacity-100" : "opacity-40");
    if (an.tablet !== an.mobil) {
      klassen.push(an.tablet ? "md:opacity-100" : "md:opacity-40");
    }
    if (an.desktop !== an.tablet) {
      klassen.push(an.desktop ? "lg:opacity-100" : "lg:opacity-40");
    }
    return klassen.join(" ");
  }
  klassen.push(an.mobil ? "block" : "hidden");
  if (an.tablet !== an.mobil) klassen.push(an.tablet ? "md:block" : "md:hidden");
  if (an.desktop !== an.tablet) {
    klassen.push(an.desktop ? "lg:block" : "lg:hidden");
  }
  return klassen.join(" ");
}

/** Ein einzelner Abstandswert: Zahl + Einheit (`24px`, `5%`, `10vh`, `4vw`).
 *  Der Außenabstand darf negativ sein (überlappende Abschnitte), der
 *  Innenabstand nicht — negatives Padding gibt es in CSS nicht. */
const AUSSEN_RE = /^-?\d{1,4}(px|%|vh|vw)$/;
const INNEN_RE = /^\d{1,4}(px|%|vh|vw)$/;

/** Die acht Abstandsfelder in CSS-Schreibweise, mit ihrem erlaubten Muster. */
const ABSTAENDE = [
  ["margin_top", "marginTop", AUSSEN_RE],
  ["margin_right", "marginRight", AUSSEN_RE],
  ["margin_bottom", "marginBottom", AUSSEN_RE],
  ["margin_left", "marginLeft", AUSSEN_RE],
  ["padding_top", "paddingTop", INNEN_RE],
  ["padding_right", "paddingRight", INNEN_RE],
  ["padding_bottom", "paddingBottom", INNEN_RE],
  ["padding_left", "paddingLeft", INNEN_RE],
] as const;

/** Äußere und innere Abstände eines Abschnitts.
 *
 *  Nur GESETZTE Werte wandern in den Stil. Ein fehlender Wert ist nicht `0`,
 *  sondern „der Abschnitt behält seinen eigenen": ein pauschales 0 würde jede
 *  bestehende Kundenseite flach ziehen (Wurzel 1).
 *
 *  Die Werte werden hier erneut gegen das Muster geprüft, obwohl das Backend
 *  sie beim Speichern prüft. In der Datenbank stehen Zeilen, die älter sind als
 *  diese Prüfung, und `settings` ist ein offenes jsonb — was von dort kommt,
 *  landet ungefiltert in einem `style`-Attribut (Wurzel 8). */
function abstandStil(settings: Record<string, unknown>): React.CSSProperties {
  const stil: Record<string, string> = {};
  for (const [feld, css, muster] of ABSTAENDE) {
    const wert = settings[feld];
    if (typeof wert === "string" && muster.test(wert)) stil[css] = wert;
  }
  return stil as React.CSSProperties;
}

/** Größe eines Containers: Mindesthöhe und größte Breite (28.08.2026).
 *
 *  Beides als Inline-Stil und nicht als Klasse: die Werte sind frei wählbar
 *  (`min_hoehe: 420`), und eine zur Laufzeit zusammengesetzte Tailwind-Klasse
 *  findet der Scanner im Build nicht — sie fehlte dann in der Ausgabe. */
function groessenStil(settings: Record<string, unknown>): React.CSSProperties {
  const stil: React.CSSProperties = {};
  const hoehe = settings.min_hoehe;
  if (typeof hoehe === "number" && hoehe > 0) stil.minHeight = `${hoehe}px`;
  const breite = settings.max_breite;
  if (typeof breite === "number" && breite > 0) {
    stil.maxWidth = `${breite}px`;
    // Ohne die Zentrierung klebte eine begrenzte Spur am linken Rand — in
    // jedem Baukasten meint „max. Breite" die mittige Spur.
    stil.marginInline = "auto";
  }
  return stil;
}

/** Das Flex-Layout eines Containers aus seinen Einstellungen.
 *
 *  Gibt es keine Angaben, kommt ein leeres Objekt zurück und der Renderer
 *  bleibt bei seinem bisherigen Verhalten — eine bestehende Kundenseite darf
 *  sich durch ein neues Feld nicht verändern (Wurzel 1). */
function layoutStil(settings: Record<string, unknown>): React.CSSProperties {
  const stil: React.CSSProperties = {};
  const richtung = settings.layout_richtung;
  if (richtung === "zeile") stil.flexDirection = "row";
  else if (richtung === "spalte") stil.flexDirection = "column";

  const verteilen = settings.layout_verteilen;
  const JUSTIFY: Record<string, string> = {
    start: "flex-start",
    mitte: "center",
    ende: "flex-end",
    zwischen: "space-between",
    umgeben: "space-around",
  };
  if (typeof verteilen === "string" && JUSTIFY[verteilen]) {
    stil.justifyContent = JUSTIFY[verteilen];
  }

  const ausrichten = settings.layout_ausrichten;
  const ALIGN: Record<string, string> = {
    start: "flex-start",
    mitte: "center",
    ende: "flex-end",
    strecken: "stretch",
  };
  if (typeof ausrichten === "string" && ALIGN[ausrichten]) {
    stil.alignItems = ALIGN[ausrichten];
  }

  if (settings.layout_umbruch === true) stil.flexWrap = "wrap";
  else if (settings.layout_umbruch === false) stil.flexWrap = "nowrap";

  const abstand = settings.layout_abstand;
  if (typeof abstand === "number" && abstand >= 0) stil.gap = `${abstand}px`;
  return stil;
}

/** Hat der Container überhaupt eine Layout-Angabe? Nur dann wird aus seiner
 *  Kinderreihe ein Flex-Container — sonst bliebe eine einspaltige Reihe eine
 *  Reihe, und genau das ist der bisherige (richtige) Zustand. */
function hatLayout(settings: Record<string, unknown>): boolean {
  return (
    settings.layout_richtung != null ||
    settings.layout_verteilen != null ||
    settings.layout_ausrichten != null ||
    settings.layout_umbruch != null ||
    settings.layout_abstand != null
  );
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
  /** Die Seite, auf der der Block steht. Nur der Brotkrumen-Abschnitt (0450)
   *  braucht sie: sein Pfad kommt aus der SEITENHIERARCHIE und nicht aus dem
   *  `content`. `null` heißt „keine Seite bekannt" — in einem Pop-up, einer
   *  Regel-Fläche oder einer Vorlagen-Vorschau gibt es keine, und der
   *  Abschnitt zeigt dann nichts statt eines erfundenen Pfads. */
  seite: PageMeta | null = null,
  /** Das Objekt, dessen Seite gerade gerendert wird (0468).
   *
   *  Nur auf der dynamischen Objektseite gesetzt. `null` überall sonst — dann
   *  zeigen die Objekt-Bausteine ihren Leer-Zustand, statt Daten eines
   *  beliebigen Objekts zu erfinden (Wurzel 4). Einzige Ausnahme ist der
   *  Buchungs-Block: er darf sein Objekt selbst benennen. */
  objekt: Listing | null = null,
): Promise<React.ReactNode> {
  switch (block.type) {
    case "hero":
      // `themeImageUrl` (0468): Branding trug `hero_image_url` seit 0426, ohne
      // dass ein Hero-Abschnitt ihn je gelesen hätte — ein Feld, das durch die
      // ganze Kette (DB → API → Typ) reicht und im Renderer nirgends ankommt.
      return (
        <HeroBlock
          content={block.content}
          modus={modus}
          themeImageUrl={branding?.hero_image_url ?? null}
        />
      );
    case "rich_text":
      return <RichTextBlock content={block.content} modus={modus} />;
    case "image":
      return (
        <ImageBlock content={block.content} modus={modus} laden={laden} />
      );
    case "gallery":
      return (
        // Seit 0451 mit Lightbox, Beschriftungen und Spaltenzahl — deshalb
        // eine Client-Komponente. Die alte Server-Fassung in `simple-blocks`
        // ist ENTFERNT und nicht daneben stehen geblieben: zwei Galerien wären
        // eine zweite Wahrheit über dieselben Daten.
        <GalerieBlock content={block.content} modus={modus} laden={laden} />
      );
    case "button":
      return <ButtonBlock content={block.content} modus={modus} />;
    case "spacer":
      return <SpacerBlock content={block.content} />;
    case "contact":
      // `__block_id` wie beim Formular-Abschnitt: der Kontakt-Abschnitt kann
      // ein Formular zeigen (`show_form`), und zum Absenden braucht es die
      // Block-ID. Ohne sie war der Schalter eine Attrappe (Prüfbericht B4).
      return (
        <ContactBlock
          content={{ ...block.content, __block_id: blockId }}
          modus={modus}
          branding={branding}
        />
      );
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
    case "search_posts":
      return <BeitragssucheBlock content={block.content} modus={modus} />;
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
    // --- 0451: Medien-Widgets --------------------------------------------
    case "media_slider":
      return <SliderBlock content={block.content} modus={modus} />;
    case "video":
      return <VideoBlock content={block.content} modus={modus} />;
    case "audio":
      return <AudioBlock content={block.content} modus={modus} />;
    case "before_after":
      return <VorherNachherBlock content={block.content} modus={modus} />;
    case "shape":
      return <FormBlock content={block.content} modus={modus} />;
    // --- 0450: Basis-Widgets ---------------------------------------------
    case "accordion":
      return <AccordionBlock content={block.content} modus={modus} />;
    case "tabs":
      return <ReiterBlock content={block.content} modus={modus} />;
    case "countdown":
      return <CountdownBlock content={block.content} modus={modus} />;
    case "table":
      return <TabelleBlock content={block.content} modus={modus} />;
    case "list":
      return (
        <ListeBlock content={block.content} modus={modus} laden={laden} />
      );
    case "file":
      return <DateienBlock content={block.content} modus={modus} />;
    case "copyright":
      return <CopyrightBlock content={block.content} modus={modus} />;
    case "breadcrumbs":
      return (
        <BrotkrumenBlock
          content={block.content}
          modus={modus}
          trail={seite?.trail ?? []}
          aktuellerTitel={seite?.title ?? ""}
        />
      );
    // --- Business-Widgets (0452) -------------------------------------------
    // Die Komponenten lagen fertig in `business-blocks.tsx`, waren hier aber
    // nie angeschlossen — der Vorgänger wurde vor diesem Schritt unterbrochen.
    case "business_hours":
      return <OeffnungszeitenBlock content={block.content} modus={modus} />;
    case "click_to_call":
      return (
        <AnrufBlock
          content={block.content}
          modus={modus}
          branding={branding}
        />
      );
    case "click_to_email":
      return (
        <EmailBlock
          content={block.content}
          modus={modus}
          branding={branding}
        />
      );
    case "multi_location":
      return <StandorteBlock content={block.content} modus={modus} />;

    // --- Social-/Sonstiges-Widgets (0471) -----------------------------------
    case "social_icons":
      return (
        <SocialIconsBlock
          content={block.content}
          modus={modus}
          branding={branding}
        />
      );
    case "share_button":
      return <ShareButtonBlock content={block.content} modus={modus} />;
    case "whatsapp_chat":
      return <WhatsappChatBlock content={block.content} modus={modus} />;
    case "rss_feed":
      return <RssFeedBlock content={block.content} modus={modus} />;
    case "facebook_feed":
      return <FacebookFeedBlock content={block.content} modus={modus} />;
    case "html_widget":
      return <HtmlWidgetBlock content={block.content} modus={modus} />;

    // --- Buchungsstrecke (0474) --------------------------------------------
    // Alle vier ziehen ihren Kontext aus der ADRESSE (Zeitraum, Gäste) und dem
    // Objekt der Seite — nicht aus dem Block. Der Block bestimmt Text und
    // Anordnung; was gebucht und was berechnet wird, entscheidet der Server.
    case "checkout_form":
      return (
        <CheckoutFormBlock
          content={block.content}
          modus={modus}
          objekt={objekt}
        />
      );
    case "checkout_summary":
      return (
        <CheckoutSummaryBlock
          content={block.content}
          modus={modus}
          objekt={objekt}
        />
      );
    case "checkout_result":
      return <CheckoutResultBlock content={block.content} modus={modus} />;
    case "post_list":
      // Server-Component: sie holt ihre Beiträge selbst (wie `posts`). Die
      // Seitennummer kommt aus der Adresse und nicht von hier — der Renderer
      // kennt sie nicht, die Route darunter schon.
      return <BeitragslisteBlock content={block.content} modus={modus} />;

    // --- Objektseite (0468) ------------------------------------------------
    case "property_book_form":
      return (
        <BuchungsBlock content={block.content} modus={modus} objekt={objekt} />
      );
    case "property_gallery":
      return (
        <ObjektGalerieBlock
          content={block.content}
          modus={modus}
          objekt={objekt}
        />
      );
    case "property_description":
      return (
        <ObjektBeschreibungBlock
          content={block.content}
          modus={modus}
          objekt={objekt}
        />
      );
    case "property_amenities":
      return (
        <ObjektAusstattungBlock
          content={block.content}
          modus={modus}
          objekt={objekt}
        />
      );
    case "property_map":
      return (
        <ObjektKarteBlock
          content={block.content}
          modus={modus}
          objekt={objekt}
        />
      );
    // --- Container (0472) --------------------------------------------------
    // Ein Abschnitt oder eine Spalte trägt keinen Inhalt. Sie werden NICHT
    // hier gerendert, sondern in `Knoten` — dort steht die Struktur, hier die
    // Bausteine. Ein `case` gibt es trotzdem: ohne ihn liefe ein Container in
    // `default` und wäre stillschweigend nichts.
    case "container":
      return null;
    default:
      return null;
  }
}

export async function BlockRenderer({
  blocks,
  tenantId,
  search,
  modus = NICHT_EDITIERBAR,
  seite = null,
  objekt = null,
}: {
  blocks: Block[];
  tenantId: string;
  search?: SuchParams;
  /** Editier-Marker nur in der Entwurfs-Vorschau; live bleibt es beim Default. */
  modus?: EditierModus;
  /** Die Seite, deren Abschnitte hier stehen. Nur der Brotkrumen-Abschnitt
   *  (0450) braucht sie. Wer keine hat (Pop-up, Regel-Fläche,
   *  Vorlagen-Vorschau), lässt sie weg — dann gibt es keinen Pfad, und der
   *  Abschnitt zeigt nichts statt eines erfundenen. */
  seite?: PageMeta | null;
  /** Das Objekt der dynamischen Objektseite (0468). Nur dort gesetzt. */
  objekt?: Listing | null;
}) {
  // Die Anzeige-Einstellung der Website gilt für ALLE Blöcke — sie ist eine
  // Entscheidung über die Seite, nicht über einen Abschnitt. Deshalb einmal hier
  // geholt und nicht in jedem Block noch einmal (ein Fetch pro Block wäre
  // derselbe Wert N-mal).
  const { branding } = await getSiteContext();
  const aufgeschluesselt = branding?.show_guest_breakdown === true;
  const nachweise = alleBildnachweise(branding);

  // Der Baum wird in EINEM Durchlauf gerendert (0472).
  //
  // Vorher war es eine flache Liste mit `blocks.map`. Seit die Seite aus
  // Abschnitt → Spalte → Baustein besteht, reicht das nicht: die Bausteine
  // liegen in `children`, und eine flache Schleife sähe nur die Abschnitte —
  // genau das war live zu sehen, eine vollständig leere Seite.
  //
  // `zaehler` läuft über den GANZEN Baum, nicht je Ebene: `data-block-index`
  // ist die Kennung, über die die Editor-Brücke Rechtecke meldet, und sie muss
  // eindeutig sein.
  const zaehler = { n: 0 };

  async function knoten(block: Block): Promise<React.ReactNode> {
    const i = zaehler.n;
    zaehler.n += 1;
    const versteckt = versteckteGeraete(block.settings);
    const bgBild =
      typeof block.settings.background_image_url === "string"
        ? block.settings.background_image_url
        : null;
    const bgNachweis = bildnachweisAusListe(nachweise, bgBild);
    const kinder = block.children ?? [];

    const inhalt =
      block.kind === "section" || block.kind === "column" ||
      block.kind === "inner_column"
        ? // Ein Container zeigt seine Kinder. Spalten NEBENEINANDER, ein
          // Abschnitt untereinander — das ist der ganze Unterschied zwischen
          // den beiden, und er steht hier und nicht im Block-Renderer.
          await kinderRendern(kinder, block.kind, block.settings)
        : await renderBlock(
            block,
            tenantId,
            modus,
            search,
            aufgeschluesselt,
            bildLaden(branding, i),
            branding ?? null,
            block.id ?? null,
            seite,
            objekt,
          );

    return (
      <div
        key={block.id ?? i}
        data-block-index={i}
        // Die DB-ID des Blocks — die EINDEUTIGE Zuordnung zum Editor.
        //
        // `data-block-index` allein reicht dafür nicht: der Zähler läuft über
        // den ganzen Baum (Abschnitt, Spalte, Baustein), der Editor bekommt
        // über `list_blocks` aber NUR die Bausteine. Bei sechs Bausteinen
        // meldet der Renderer die Indizes 0,1,2 / 3,4,5 / … und der Editor
        // erwartet 0,1,2 — jeder Klick trifft daneben. Live zu sehen am
        // 26.08.2026: Klick auf „Bild" markierte „Kontakt".
        //
        // Der Index bleibt daneben stehen, weil die Brücke ihn für die
        // Reihenfolge der Rechtecke braucht; die ZUORDNUNG läuft über die ID.
        data-block-id={block.id ?? undefined}
        // Die ART des Knotens — nur im Editor.
        //
        // Die Brücke sucht zu einem Klick die ID des BAUSTEINS, denn nur
        // Bausteine kennt der Editor (`list_blocks` filtert Container). Ohne
        // dieses Attribut nahm sie die erste ID, die sie beim Hochlaufen fand
        // — und das ist bei einem Klick auf einen Inhalt die Spalte oder der
        // Abschnitt darüber. Der Editor fand diese ID in seiner Liste nicht,
        // fiel auf den Index zurück, und der zählt im Renderer-Raum (0..17)
        // statt im Editor-Raum (0..5): die Auswahl landete auf einem fremden
        // Abschnitt (live 26.08.2026, Inspektor „Kontakt" bei markiertem Bild).
        data-block-kind={modus.aktiv ? (block.kind ?? "widget") : undefined}
        // Im Editor steht hier, auf welchen Geräten der Abschnitt fehlt.
        // Live steht das Attribut NICHT da: eine Gast-Seite trägt keine
        // Editor-Marker (dieselbe Regel wie bei `data-feld`).
        data-versteckt={
          modus.aktiv && versteckt.length > 0 ? versteckt.join(" ") : undefined
        }
        // Die Breite einer Spalte in Zwölfteln. Sie steht als Inline-Stil und
        // nicht als Tailwind-Klasse: `w-5/12` müsste für jede der zwölf
        // Möglichkeiten im Build vorkommen, und eine zur Laufzeit
        // zusammengesetzte Klasse findet der Tailwind-Scanner nicht.
        style={{
          ...bgStyle(block.settings),
          ...abstandStil(block.settings),
          ...groessenStil(block.settings),
          ...(block.span != null && block.kind !== "section"
            ? { flexBasis: `${(block.span / 12) * 100}%` }
            : {}),
        }}
        className={[
          bgNachweis ? "relative" : "",
          abstandKlasse(block.settings),
          sichtbarkeitKlasse(block.settings, modus.aktiv),
          // Eine Spalte ist ein Flex-Kind mit fester Grundbreite und darf
          // schrumpfen; `min-w-0` verhindert, dass ein langes Wort sie
          // aufbläht (der klassische Flex-Überlauf).
          block.kind === "column" || block.kind === "inner_column"
            ? "min-w-0 grow-0"
            : "",
        ]
          .filter(Boolean)
          .join(" ")}
      >
        {inhalt}
        {/* Der Nachweis des Hintergrundbildes. */}
        <BildNachweis src={bgBild} nachweise={nachweise} />
      </div>
    );
  }

  /** Die Kinder eines Containers rendern.
   *
   *  Spalten stehen NEBENEINANDER und brechen auf schmalen Schirmen um. Das
   *  ist keine Einstellung, sondern die einzige Bauweise, die auf einem Telefon
   *  funktioniert: drei Spalten zu je einem Drittel sind dort drei
   *  unlesbare Streifen. */
  async function kinderRendern(
    kinder: Block[],
    art: "section" | "column" | "inner_column",
    /** Die Einstellungen DIESES Containers — für sein eigenes Layout. */
    eigeneSettings: Record<string, unknown> = {},
  ): Promise<React.ReactNode> {
    const gerendert = [];
    for (const k of kinder) {
      gerendert.push(await knoten(k));
    }
    const spalten = kinder.filter(
      (k) => k.kind === "column" || k.kind === "inner_column",
    );

    // EIN LEERER Container braucht im Editor eine FLÄCHE.
    //
    // Ohne sie ist er 0 px hoch, und dann existiert er für den Editor nicht:
    // die Brücke verwirft jedes Rechteck mit `width <= 0 || height <= 0`
    // (`canvas-bridge.tsx`), das Overlay zeichnet Rahmen, „+"-Nähte und
    // Abwurfziele ausschließlich aus diesen Rechtecken — also kein Rahmen,
    // keine Naht, kein Ziel. Ein Deadlock: um einen Baustein hineinzuziehen
    // bräuchte man eine Klickfläche, und die entstünde erst mit dem Baustein.
    //
    // Genau daran scheiterte das Layout-Einfügen: die Zeilen entstanden in der
    // DB (Backend gegen die laufende API verifiziert), sichtbar war der neue
    // Abschnitt nur im Ebenen-Baum. Für den Kunden sah es aus wie „der Knopf
    // tut nichts".
    //
    // NUR im Editor (`modus.aktiv`). Auf der Gast-Seite hat ein leerer
    // Container nichts zu suchen und darf auch keine Lücke reißen — dort
    // bleibt er 0 px, wie bisher.
    if (modus.aktiv && kinder.length === 0) {
      return (
        <div
          // OHNE Text. Der gestrichelte Rahmen sagt „hier ist Platz" schon
          // selbst, und ein Satz darin bräuchte einen 25. Schlüssel in allen 24
          // Positionslisten von `renderer-texte-erzeugen.py` — Aufwand für eine
          // Aussage, die die Form bereits macht.
          //
          // `min-h-24`: die kleinste Höhe, in der ein Abwurfziel zuverlässig
          // getroffen wird. Der Wert ist die Untergrenze, nicht ein Maß.
          className="min-h-24 rounded-(--radius) border-2 border-dashed border-blue-300/60 bg-blue-50/30"
        />
      );
    }

    // EIGENES LAYOUT, wenn der Kunde eines gesetzt hat (28.08.2026).
    //
    // Es steht VOR der Spalten-Regel unten, weil es sie ausdrücklich
    // überschreibt: wer Richtung, Verteilung oder Abstand einstellt, meint
    // genau diese Reihe — auch wenn nur ein Kind darin steht.
    if (hatLayout(eigeneSettings)) {
      return (
        <div
          className={
            "flex w-full " +
            // Ohne Angabe stehen die Kinder untereinander: das ist das
            // Verhalten, das ein Abschnitt bisher hatte, und ein anderer
            // Standard würde jede bestehende Seite umbauen (Wurzel 1).
            (eigeneSettings.layout_richtung === "zeile"
              ? "flex-col md:flex-row "
              : "flex-col ") +
            (art === "section" ? "mx-auto max-w-6xl px-6" : "")
          }
          style={layoutStil(eigeneSettings)}
        >
          {gerendert}
        </div>
      );
    }

    // EINE Spalte über die volle Breite ist keine Spalte — sie ist die Seite.
    //
    // Sie bekommt deshalb keinen Rahmen: kein Flex, keine Maximalbreite, kein
    // Innenabstand. Jeder Baustein bringt seine eigene Breite mit (das
    // Titelbild randlos, ein Textabschnitt begrenzt), und ein Container darüber
    // würde ihm diese Entscheidung nehmen.
    //
    // Genau das war der Fehler nach 0472: die Migration hat jedem Abschnitt
    // eine 12/12-Spalte gegeben, der Renderer machte daraus eine zentrierte
    // `max-w-6xl`-Spur — und das randlose Titelbild klebte plötzlich als
    // schmaler Streifen in der Mitte. Ein Layout, das sich durch eine reine
    // Datenmigration ändert, ist immer ein Fehler im Renderer (Wurzel 1).
    if (spalten.length <= 1) return gerendert;

    // Erst ab ZWEI Spalten entsteht ein Nebeneinander — und damit die Frage
    // nach Breite und Abstand.
    return (
      <div
        className={
          "flex w-full flex-col gap-4 md:flex-row md:items-start " +
          // Die Spur begrenzt nur der ABSCHNITT. Eine innere Spalte sitzt
          // bereits darin; sie ein zweites Mal zu begrenzen ergäbe einen
          // Rand im Rand.
          (art === "section" ? "mx-auto max-w-6xl px-6" : "")
        }
      >
        {gerendert}
      </div>
    );
  }

  const baum = [];
  for (const b of blocks) {
    baum.push(await knoten(b));
  }

  return <BildnachweisBereich nachweise={nachweise}>{baum}</BildnachweisBereich>;
}
