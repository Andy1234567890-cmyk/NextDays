"use client";

// Der BEITRAGS-DIALOG — der Item-Editor des Agentur-CMS
// (`CollectionManager.tsx`, Abschnitt „Editor drawer"), übernommen und
// angepasst.
//
//     ✕  [Bearbeiten|Vorschau]   Gespeichert ✓   [Ansehen] [Löschen] [Speichern]
//     ─────────────────────────────────────────────────────────────────────────
//     Adresse   alte-muehle          ihre-seite.de/blog/alte-muehle
//     Status    [ Live ▾ ]
//     Erscheint [ 25.08.2026 ]
//     Titel     [ Die alte Mühle                                            ]
//     …
//     Text      [ Werkzeugleiste ]
//               [ … ]
//     ─────────────────────────────────────────────────────────────────────────
//     Aufrufe: 128 · Geändert: 25.08.2026
//
// WAS BEIM ÜBERNEHMEN GEÄNDERT WURDE
// ==================================
// 1. FESTE FELDER statt `FieldRenderer` über eine Feldliste: ein Blogbeitrag
//    hat keine kundendefinierten Felder. Die Reihenfolge ist die des Vorbilds —
//    was den ZUSTAND beschreibt (Adresse, Status, Datum) steht über dem Inhalt.
// 2. Das Titelbild kommt aus der MEDIATHEK statt aus einem Datei-Dialog.
// 3. Der Text ist HTML und nicht TipTap-JSON (Begründung in 0480).
import { Icon } from "@iconify/react";
import { useFormatter, useTranslations } from "next-intl";
import { useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";

import {
  type Beitrag,
  type EigenesFeld,
  type Page,
  createPage,
  deletePage,
  duplicatePage,
  updatePage,
  updatePost,
  publishPage,
  setPageDraft,
  unpublishPage,
} from "@/lib/site-pages";

import { Switch } from "@nextdays/ui/switch";

import { BildFeld } from "../editor/bild-feld";
import { BeitragVorschau } from "./beitrag-vorschau";
import { SchlagwortEingabe } from "./schlagwort-eingabe";
import type { FeldKonfig } from "./felder";
import { slugSaeubern } from "./slug";

/** Ein noch nicht angelegter Beitrag.
 *
 *  Der Dialog legt ihn erst beim SPEICHERN an — nicht beim Öffnen. Ein Klick
 *  auf „Neu", der sofort eine leere Seite in die Liste schreibt, hinterlässt
 *  bei jedem Abbruch eine Karteileiche, die jemand später wegräumen muss. */
export const LEERER_BEITRAG = {
  id: "",
  slug: "",
  title: "",
  is_published: false,
  is_draft: false,
  published_at: null,
  created_at: null,
  parent_post_id: null,
  view_count: 0,
  // Ein neuer Beitrag ist sichtbar — dieselbe Vorgabe wie die Spalte in der
  // DB (`default true`, 0481). Ein neu angelegter Beitrag, der von selbst aus
  // der Übersicht fiele, wäre eine Überraschung, die niemand sucht.
  show_on_homepage: true,
} as unknown as Page;

export const LEERE_FELDER: Beitrag = {
  id: "",
  slug: "",
  title: "",
  is_published: false,
  published_at: null,
  author: null,
  cover_image_url: null,
  excerpt: null,
  tags: null,
  seo_title: null,
  seo_description: null,
  og_image_url: null,
  og_image_alt: null,
  noindex: null,
  content_html: null,
  parent_post_id: null,
  author_user_id: null,
  is_archived: null,
  view_count: 0,
  show_on_homepage: true,
  // 0483 — leer heisst leer, kein erfundener Vorgabewert (Wurzel 4).
  industry: null,
  client: null,
  full_title: null,
  intro_heading: null,
  intro_body: null,
  button_text: null,
  website_link: null,
  gallery_top: null,
  gallery_left: null,
  gallery_right: null,
  gallery_bottom: null,
  final_heading: null,
  final_body: null,
  show_carousel: false,
  carousel_1: null,
  carousel_2: null,
  carousel_3: null,
  carousel_4: null,
  // 0485: ein neuer Beitrag hat noch keine eigenen Werte. `{}` und nicht
  // `null` — „nichts gesetzt" ist ein leeres Objekt.
  custom: {},
};

type Stand = {
  titel: string;
  slug: string;
  datum: string;
  anriss: string;
  titelbild: string | null;
  autor: string;
  schlagwoerter: string[];
  text: string;
  buch: string;
  seoTitel: string;
  seoBeschreibung: string;
  /** Das Vorschaubild fuer Suchmaschinen und geteilte Links (`og_image`).
   *  NICHT das Titelbild: das eine steht ueber dem Beitrag, das andere in
   *  der Vorschau eines geteilten Links. */
  vorschaubild: string | null;
  // --- Framer-Feldliste (0483) --------------------------------------------
  branche: string;
  kunde: string;
  vollerTitel: string;
  introUeberschrift: string;
  introText: string;
  buttonText: string;
  websiteLink: string;
  /** MEHRERE Bilder — im Vorbild `Gallery` mit Min/Max. */
  galerieOben: string[];
  /** EIN Bild — im Vorbild ausdrücklich `Image`, nicht `Gallery`. */
  galerieLinks: string | null;
  galerieRechts: string | null;
  galerieUnten: string[];
  finalUeberschrift: string;
  finalText: string;
  karussellZeigen: boolean;
  karussell1: string | null;
  karussell2: string | null;
  karussell3: string | null;
  karussell4: string | null;
  aufStartseite: boolean;
  /** Die Werte der EIGENEN Felder (0485). Ein Objekt und keine 30 einzelnen
   *  Zustandsfelder: welche es gibt, weiss der Dialog erst zur Laufzeit. */
  eigene: Record<string, unknown>;
};

function standVon(page: Page, felder: Beitrag): Stand {
  return {
    titel: felder.title || page.title || "",
    slug: felder.slug || page.slug || "",
    datum: felder.published_at ? felder.published_at.slice(0, 10) : "",
    anriss: felder.excerpt ?? "",
    titelbild: felder.cover_image_url,
    autor: felder.author ?? "",
    schlagwoerter: felder.tags ?? [],
    text: felder.content_html ?? "",
    buch: felder.parent_post_id ?? "",
    seoTitel: felder.seo_title ?? "",
    seoBeschreibung: felder.seo_description ?? "",
    vorschaubild: felder.og_image_url,
    eigene: { ...(felder.custom ?? {}) },
    branche: felder.industry ?? "",
    kunde: felder.client ?? "",
    vollerTitel: felder.full_title ?? "",
    introUeberschrift: felder.intro_heading ?? "",
    introText: felder.intro_body ?? "",
    buttonText: felder.button_text ?? "",
    websiteLink: felder.website_link ?? "",
    galerieOben: felder.gallery_top ?? [],
    galerieLinks: felder.gallery_left,
    galerieRechts: felder.gallery_right,
    galerieUnten: felder.gallery_bottom ?? [],
    finalUeberschrift: felder.final_heading ?? "",
    finalText: felder.final_body ?? "",
    karussellZeigen: felder.show_carousel,
    karussell1: felder.carousel_1,
    karussell2: felder.carousel_2,
    karussell3: felder.carousel_3,
    karussell4: felder.carousel_4,
    aufStartseite: felder.show_on_homepage,
  };
}


/** Die Beschriftung EINER Feldzeile — mit `Zurücksetzen`, wenn das Feld eine
 *  Vorgabe hat und der Wert davon abweicht (0486, Framers `Reset`).
 *
 *  WARUM DER KNOPF AN DER BESCHRIFTUNG HÄNGT
 *  =========================================
 *  Im Vorbild steht er rechts NEBEN dem Eingabefeld (bei `Full Project Title`
 *  am 28.08.2026 abgelesen). Bei uns sitzt er links an der Beschriftung, weil
 *  unsere Feldzeile schmaler ist: rechts neben dem Feld würde er die Eingabe
 *  je nach Zustand um seine eigene Breite verschieben, und ein Feld, das beim
 *  Tippen springt, ist unbrauchbar.
 *
 *  Er erscheint NUR bei Abweichung. Ein dauerhaft sichtbarer Reset an einem
 *  Feld, das ohnehin auf der Vorgabe steht, wäre ein Knopf ohne Wirkung. */
function Beschriftung({
  text,
  feld,
  konfig,
  stand,
  onSetzen,
  klasse,
}: {
  text: string;
  /** Der Feldschlüssel — er verbindet die Zeile mit ihrer Konfiguration. */
  feld: string;
  konfig: readonly FeldKonfig[];
  stand: Stand;
  onSetzen: (wert: string) => void;
  klasse: string;
}) {
  const t = useTranslations("website");
  const k = konfig.find((c) => c.feld_key === feld);
  // Die geltende Vorgabe: ein fester Wert ODER der aktuelle Wert des
  // Quellfeldes. Die ABLEITUNG liest den Stand des Formulars und nicht die
  // gespeicherte Zeile — wer den Titel gerade geändert hat, soll auf den
  // NEUEN zurücksetzen können.
  const vorgabe =
    k?.standard_wert ??
    (k?.standard_feld ? standWertVon(stand, k.standard_feld) : null);
  const jetzt = standWertVon(stand, feld) ?? "";
  const abweichend = vorgabe !== null && jetzt !== vorgabe;

  return (
    <span className={`${klasse} flex items-center gap-1.5`}>
      {text}
      {abweichend ? (
        <button
          type="button"
          title={t("blog.feld.aufVorgabe")}
          aria-label={t("blog.feld.aufVorgabe")}
          onClick={() => onSetzen(vorgabe)}
          className="inline-flex size-5 shrink-0 items-center justify-center rounded text-muted-foreground transition hover:bg-secondary hover:text-foreground"
        >
          <Icon icon="ph:arrow-counter-clockwise" className="size-3" />
        </button>
      ) : null}
    </span>
  );
}

/** Der Wert EINES Feldes im Dialogzustand, über seinen Feldschlüssel.
 *
 *  Die Zuordnung steht hier und an genau einer Stelle: der Zustand heißt
 *  deutsch (`branche`), die Konfiguration englisch (`industry`). Zwei Kopien
 *  dieser Tabelle wären die Stelle, an der beim nächsten Feld eine vergessen
 *  wird (Wurzel 2). */
function standWertVon(stand: Stand, feld: string): string | null {
  const karte: Record<string, string | null> = {
    title: stand.titel,
    industry: stand.branche,
    client: stand.kunde,
    full_title: stand.vollerTitel,
    intro_heading: stand.introUeberschrift,
    intro_body: stand.introText,
    button_text: stand.buttonText,
    website_link: stand.websiteLink,
    final_heading: stand.finalUeberschrift,
    final_body: stand.finalText,
    excerpt: stand.anriss,
    author: stand.autor,
    published: stand.datum,
    seo_title: stand.seoTitel,
    seo_description: stand.seoBeschreibung,
  };
  const wert = karte[feld];
  return wert === undefined ? null : wert;
}

export function BeitragDialog({
  page,
  felder,
  eigeneFelder,
  feldKonfig,
  liveDomain,
  onSchliessen,
  onNeuLaden,
}: {
  page: Page;
  felder: Beitrag;
  /** Die EIGENEN Felder dieses Betriebs (0485). Der Dialog zeigt sie hinter
   *  den eingebauten — dieselbe Reihenfolge wie Tabelle und Feldverwaltung. */
  eigeneFelder: readonly EigenesFeld[];
  /** Die Feldkonfiguration (0481/0486). Sie trägt die VORGABEWERTE — ohne sie
   *  gäbe es nichts, worauf `Zurücksetzen` zurückstellt. */
  feldKonfig: readonly FeldKonfig[];
  /** Die verbundene Live-Domain. `null`, solange keine verbunden ist — dann
   *  steht unter dem Slug nur der Pfad. */
  liveDomain: string | null;
  onSchliessen: () => void;
  onNeuLaden: () => void;
}) {
  const t = useTranslations("website");
  const format = useFormatter();
  const [laeuft, start] = useTransition();
  const [reiter, setReiter] = useState<"bearbeiten" | "vorschau">("bearbeiten");
  const [stand, setStand] = useState<Stand>(() => standVon(page, felder));
  const [geaendert, setGeaendert] = useState(false);
  const [menu, setMenu] = useState(false);
  const huelle = useRef<HTMLDivElement>(null);

  const istNeu = !page.id;

  // Wechselt der Dialog auf einen ANDEREN Beitrag, müssen die Felder neu
  // gefüllt werden — sonst zeigte er die Werte des vorherigen, und ein
  // Speichern schriebe sie in den neuen.
  useEffect(() => {
    setStand(standVon(page, felder));
    setGeaendert(false);
  }, [page, felder]);

  useEffect(() => {
    if (!menu) return;
    function aufKlick(e: MouseEvent) {
      if (!huelle.current?.contains(e.target as Node)) setMenu(false);
    }
    document.addEventListener("mousedown", aufKlick);
    return () => document.removeEventListener("mousedown", aufKlick);
  }, [menu]);

  function setzen<K extends keyof Stand>(key: K, wert: Stand[K]) {
    setStand((s) => ({ ...s, [key]: wert }));
    setGeaendert(true);
  }

  function speichern() {
    if (!stand.titel.trim()) {
      toast.error(t("blog.cm.titelFehlt"));
      return;
    }
    start(async () => {
      let id = page.id;
      if (istNeu) {
        const neu = await createPage(stand.titel.trim(), stand.slug, "none", "post");
        if (!neu.ok) {
          toast.error(neu.error);
          return;
        }
        id = neu.data.id;
      } else if (stand.titel.trim() !== page.title || stand.slug !== page.slug) {
        // Titel und Adresse gehören der SEITE, alles andere dem Beitrag. Zwei
        // Aufrufe, weil es zwei Zuständigkeiten sind — nicht, weil es umständlich
        // wäre.
        const seite = await updatePage(id, {
          title: stand.titel.trim(),
          slug: stand.slug,
        });
        if (!seite.ok) {
          toast.error(seite.error);
          return;
        }
      }
      const res = await updatePost(id, {
        // Ein geleertes Datumsfeld sendet ausdrücklich `null` und nicht
        // „heute": der Kunde hat das Datum entfernt, nicht auf heute gesetzt
        // (Wurzel 4).
        published_at: stand.datum ? new Date(stand.datum).toISOString() : null,
        excerpt: stand.anriss.trim() || null,
        cover_image_url: stand.titelbild,
        author: stand.autor.trim() || null,
        tags: stand.schlagwoerter,
        content_html: stand.text || null,
        parent_post_id: stand.buch || null,
        seo_title: stand.seoTitel.trim() || null,
        seo_description: stand.seoBeschreibung.trim() || null,
        og_image_url: stand.vorschaubild,
        // --- Framer-Feldliste (0483) ---------------------------------------
        // Jedes leer gemachte Textfeld sendet `null` und nicht `""`: ein
        // leerer String in der DB ist von „nie gesetzt" nicht zu
        // unterscheiden, und kein Rückfall erkennt ihn (Wurzel 4).
        show_on_homepage: stand.aufStartseite,
        industry: stand.branche.trim() || null,
        client: stand.kunde.trim() || null,
        full_title: stand.vollerTitel.trim() || null,
        intro_heading: stand.introUeberschrift.trim() || null,
        intro_body: stand.introText.trim() || null,
        button_text: stand.buttonText.trim() || null,
        website_link: stand.websiteLink.trim() || null,
        // Eine leere Galerie ist `null` und keine leere Liste — sonst stünde
        // in der DB ein `{}`, das „Galerie vorhanden, aber ohne Bilder"
        // behauptet.
        gallery_top: stand.galerieOben.length ? stand.galerieOben : null,
        gallery_left: stand.galerieLinks,
        gallery_right: stand.galerieRechts,
        gallery_bottom: stand.galerieUnten.length ? stand.galerieUnten : null,
        // 0485: die eigenen Werte, als TEIL-Objekt. Der Server mischt sie in
        // den Bestand — ein Schluessel mit `null` loescht.
        custom: stand.eigene,
        final_heading: stand.finalUeberschrift.trim() || null,
        final_body: stand.finalText.trim() || null,
        show_carousel: stand.karussellZeigen,
        carousel_1: stand.karussell1,
        carousel_2: stand.karussell2,
        carousel_3: stand.karussell3,
        carousel_4: stand.karussell4,
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setGeaendert(false);
      toast.success(t("blog.cm.gespeichert"));
      onNeuLaden();
      if (istNeu) onSchliessen();
    });
  }

  function aktion(lauf: () => Promise<{ ok: boolean; error?: string }>) {
    setMenu(false);
    start(async () => {
      const res = await lauf();
      if (!res.ok) {
        toast.error(res.error ?? t("blog.cm.fehler"));
        return;
      }
      onNeuLaden();
      onSchliessen();
    });
  }


  // Die drei Stilkonstanten des Dialogs — gemessen am Vorbild (Analyse E3
  // und die Bildreihe vom 28.08.2026).
  //
  // WAS SICH GEGENÜBER VORHER ÄNDERT UND WARUM
  // ==========================================
  // 1. LABELSPALTE FEST, Feld nimmt den Rest. Im Vorbild steht die Labelspalte
  //    bei x = 800 mit Breite 140, das Feld läuft von 950 bis 1635. Die Labels
  //    sind linksbündig und werden bei Bedarf gekürzt („Project Thumbnail
  //    T…") — sie brechen NICHT um, sonst wandert die Feldzeile daneben nach
  //    unten und die Zeilenhöhe springt von Feld zu Feld.
  // 2. GRAUE FLÄCHE statt Rahmen. Gemessen `#f3f3f3` (E1: „Eingabefelder,
  //    Sekundärknöpfe"), randlos. Ein Rahmen um jedes Feld erzeugt bei
  //    zwanzig Feldern zwanzig Kästen; die Fläche trägt dasselbe, ohne die
  //    Zeile einzurahmen. Unsere Entsprechung ist `--secondary`, nicht der
  //    Hex-Wert: der wäre eine zwölfte Farbe ohne Dunkelmodus (Wurzel 4).
  // 3. HAARLINIE JE ZEILE als einziger Trenner, kein Abstand dazwischen.
  //
  // Die Feldbreite ist bewusst NICHT auf 685 px festgenagelt: unser Dialog ist
  // in der Breite beweglich (78 % bzw. 74 %), eine feste Pixelzahl würde bei
  // schmalem Fenster überstehen und bei breitem einen leeren Streifen lassen.
  const zeile =
    "flex items-start gap-6 border-b border-border px-6 py-2.5 last:border-b-0";
  const label =
    "w-36 shrink-0 truncate pt-2 text-sm font-medium text-foreground";
  const eingabe =
    "min-w-0 flex-1 rounded-(--radius) border border-transparent bg-secondary px-3 py-1.5 text-sm outline-none transition-colors focus:border-(--brand) focus:bg-background";

  return (
    // DER DIALOG DECKT DIE TABELLE NICHT ZU (Framer-Analyse A und E3).
    //
    // Gemessen im Vorbild: der Editor-Dialog ist 880 breit bei 1920 Fenster
    // und sitzt bei x = 780 — er nimmt also gut die rechten DREI VIERTEL des
    // Panels und lässt die Titelspalte der Tabelle daneben stehen. Genau so
    // sieht man beim Tippen noch, an welchem Beitrag man ist, und ein Klick
    // auf eine andere Zeile wechselt direkt weiter.
    //
    // Vorher stand hier `inset-0`: der Dialog lag über allem, die Tabelle war
    // weg, und der einzige Weg zum nächsten Beitrag führte übers Schließen.
    //
    // `min-w-0` an der Wurzel, weil der Inhalt sonst die Flex-Breite aufbläht
    // und die Tabelle links doch wieder herausdrückt.
    <div className="absolute inset-y-0 right-0 z-30 flex w-full min-w-0 flex-col border-l border-border bg-background shadow-2xl md:w-[78%] lg:w-[74%]">
      {/* Kopf */}
      <div className="flex shrink-0 items-center gap-3 border-b border-border px-4 py-2.5">
        <button
          type="button"
          aria-label={t("blog.cm.close")}
          onClick={onSchliessen}
          className="flex size-8 items-center justify-center rounded-(--radius) text-muted-foreground transition hover:bg-secondary hover:text-foreground"
        >
          <Icon icon="ph:x" className="size-4" />
        </button>

        <div className="flex shrink-0 items-center gap-1 rounded-full bg-secondary p-0.5">
          {(["bearbeiten", "vorschau"] as const).map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setReiter(r)}
              aria-current={r === reiter ? "true" : undefined}
              className={
                "rounded-full px-3 py-1 text-sm transition " +
                (r === reiter
                  ? "bg-background font-medium text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground")
              }
            >
              {t(`blog.cm.${r}`)}
            </button>
          ))}
        </div>

        <span className="min-w-0 flex-1 truncate px-2 text-xs text-muted-foreground">
          {geaendert ? t("blog.cm.ungespeichert") : t("blog.cm.standAktuell")}
        </span>

        {!istNeu && page.is_published && stand.slug ? (
          <a
            href={`/blog/${stand.slug}`}
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 rounded-full border border-border px-3 py-1.5 text-sm transition hover:bg-secondary"
          >
            {t("blog.cm.ansehen")}
          </a>
        ) : null}

        <button
          type="button"
          disabled={laeuft || !geaendert}
          onClick={speichern}
          className="shrink-0 rounded-full bg-(--brand) px-4 py-1.5 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-40"
        >
          {laeuft
            ? t("blog.cm.speichert")
            : istNeu
              ? t("blog.cm.anlegen")
              : t("blog.cm.speichern")}
        </button>

        {!istNeu ? (
          <div ref={huelle} className="relative shrink-0">
            <button
              type="button"
              aria-label={t("blog.zeileMenue")}
              aria-expanded={menu}
              onClick={() => setMenu((o) => !o)}
              className="flex size-8 items-center justify-center rounded-(--radius) text-muted-foreground transition hover:bg-secondary hover:text-foreground"
            >
              <Icon icon="ph:dots-three" className="size-4" />
            </button>
            {menu ? (
              <div className="absolute right-0 top-9 z-40 flex w-52 flex-col rounded-(--radius) border border-border bg-background py-1 shadow-lg">
                <button
                  type="button"
                  onClick={() => aktion(() => duplicatePage(page.id))}
                  className="flex items-center gap-2 px-3 py-2 text-left text-sm transition hover:bg-secondary/60"
                >
                  <Icon icon="ph:copy" className="size-4" />
                  {t("blog.duplizieren")}
                </button>
                <span aria-hidden className="my-1 block h-px bg-border" />
                <button
                  type="button"
                  onClick={() => aktion(() => deletePage(page.id))}
                  className="flex items-center gap-2 px-3 py-2 text-left text-sm text-destructive transition hover:bg-secondary/60"
                >
                  <Icon icon="ph:trash" className="size-4" />
                  {t("blog.loeschen")}
                </button>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-8 py-6">
        {reiter === "vorschau" ? (
          <BeitragVorschau
            titel={stand.titel}
            anriss={stand.anriss}
            titelbild={stand.titelbild}
            schlagwoerter={stand.schlagwoerter}
            text={stand.text}
            datum={stand.datum || null}
            // Die Vorlagenfelder aus dem LAUFENDEN Stand, nicht aus der
            // gespeicherten Zeile: wer etwas tippt und auf „Vorschau" wechselt,
            // will sehen, was er getippt hat.
            felder={{
              branche: stand.branche,
              kunde: stand.kunde,
              vollerTitel: stand.vollerTitel,
              introUeberschrift: stand.introUeberschrift,
              introText: stand.introText,
              buttonText: stand.buttonText,
              websiteLink: stand.websiteLink,
              galerieOben: stand.galerieOben,
              galerieLinks: stand.galerieLinks,
              galerieRechts: stand.galerieRechts,
              galerieUnten: stand.galerieUnten,
              finalUeberschrift: stand.finalUeberschrift,
              finalText: stand.finalText,
              karussellZeigen: stand.karussellZeigen,
              karussell: [
                stand.karussell1,
                stand.karussell2,
                stand.karussell3,
                stand.karussell4,
              ],
              // Die eigenen Felder (0485) mit ihrem NAMEN — der Schlüssel
              // stünde sonst als Überschrift über dem Wert. Versteckte
              // fallen weg: sie stehen auch auf der Website nicht.
              eigene: eigeneFelder
                .filter((f) => !f.versteckt)
                .map((f) => ({
                  name: f.label,
                  wert: stand.eigene[f.feld_key],
                }))
                .filter(
                  (e) =>
                    e.wert !== null &&
                    e.wert !== undefined &&
                    e.wert !== "" &&
                    e.wert !== false &&
                    !(Array.isArray(e.wert) && e.wert.length === 0),
                ),
            }}
          />
        ) : (
          // KEINE mittige Begrenzung mehr (`mx-auto max-w-3xl`). Im Vorbild
          // läuft die Feldspalte über die ganze Dialogbreite; eine zentrierte
          // Säule liesse links und rechts je einen leeren Streifen, und die
          // Labels stünden nicht mehr an der Kante, an der das Auge sie sucht.
          <div className="flex flex-col">
            {/* Die Feldliste der VORLAGE, in ihrer Reihenfolge
                (Bildreihe 28.08.2026, `docs/FRAMER-CMS-ANALYSE.md` C):

                  Project Thumbnail Title · Status ·
                  Main Image / Thumbnail Image · Show on the homepage · Slug
                  ─── Trenner ───
                  Industry · Client · Full Project Title · …

                Was hier NICHT mehr steht: Teaser, Author, Keywords,
                „Belongs to" und die beiden SEO-Felder. Sie kommen in der
                Vorlage nicht vor. Sie standen hier, weil ich die Vorlage
                ERGÄNZT habe statt sie umzusetzen — die Felder blieben oben,
                die neuen hingen hinten dran, und der Dialog zeigte zwei
                Listen übereinander.

                Die Daten dazu bleiben in der Datenbank (`excerpt`, `author`,
                `tags`, `parent_post_id`, `seo_title`, `seo_description`) und
                stehen weiter als SPALTE in der Tabelle — gelöscht wird
                nichts, sie haben in diesem Dialog nur keinen Platz. */}

            <div className={zeile}>
              <span className={label}>{t("blog.titel")} *</span>
              <input
                value={stand.titel}
                onChange={(e) => setzen("titel", e.target.value)}
                className={eingabe}
              />
            </div>

            {/* Status. Im Vorbild an zweiter Stelle und als Klappliste. */}
            <div className={zeile}>
              <span className={label}>{t("blog.status")}</span>
              <div className="min-w-0 flex-1">
                <StatusWahl
                  page={page}
                  disabled={laeuft || istNeu}
                  onAktion={aktion}
                />
              </div>
            </div>

            <div className={zeile}>
              <span className={label}>{t("blog.titelbild")}</span>
              <div className="min-w-0 flex-1">
                <BildFeld
                  kompakt
                  label=""
                  wert={stand.titelbild}
                  onWert={(v) => setzen("titelbild", v)}
                />
              </div>
            </div>

            <div className={zeile}>
              <span className={label}>{t("blog.aufStartseite")}</span>
              <div className="min-w-0 flex-1 pt-1">
                <Switch
                  checked={stand.aufStartseite}
                  onCheckedChange={(v) => setzen("aufStartseite", v)}
                />
              </div>
            </div>

            <div className={zeile}>
              <span className={label}>{t("blog.cm.adresse")}</span>
              <div className="min-w-0 flex-1">
                <input
                  value={stand.slug}
                  onChange={(e) => setzen("slug", e.target.value)}
                  // Beim VERLASSEN säubern, nicht bei jedem Tastendruck: wer
                  // „mein-beitrag" tippt, käme sonst nach dem ersten
                  // Bindestrich nicht weiter, weil ihn die Säuberung als
                  // Randzeichen sofort abschneidet.
                  //
                  // Dieselbe Funktion wie in der Tabellenzelle (`./slug`) —
                  // eine Zelle, die andere Zeichen durchlässt als das Formular
                  // daneben, wäre ein zweiter Begriff von „Adresse".
                  onBlur={(e) => {
                    const sauber = slugSaeubern(e.target.value);
                    if (sauber !== stand.slug) setzen("slug", sauber);
                  }}
                  placeholder={t("blog.cm.adresseAuto")}
                  className={`${eingabe} w-full`}
                />
                {stand.slug ? (
                  // Die GANZE Adresse, wie im Vorbild
                  // (`rotating-organization-714551.framer.app/work/dazzle`).
                  // Ohne verbundene Domain bleibt der Pfad — eine erfundene
                  // Adresse wäre schlimmer als keine (Wurzel 4).
                  <p className="flex items-center gap-1 pt-1 text-xs text-muted-foreground">
                    <Icon icon="ph:globe-simple" className="size-3.5" />
                    {liveDomain ? `${liveDomain}/blog/${stand.slug}` : `/blog/${stand.slug}`}
                  </p>
                ) : null}
              </div>
            </div>

            {/* Der Trenner der Vorlage: eine leere Zeile zwischen den
                Grunddaten und den Inhaltsfeldern (Analyse C, „Divider"). */}
            <div aria-hidden className="h-6 border-b border-border" />

            {/* ================================================================
                DIE FELDER DER VORLAGE (0483)
                ================================================================
                Reihenfolge und Bestand aus der Feldliste des Vorbilds
                (Bildreihe 28.08.2026): Einordnung → Einleitung → Aufforderung
                → Galerien → Abschluss → Karussell.

                Zwei Arten Bildfeld: `Galerie oben`/`unten` tragen MEHRERE
                Bilder, `links`/`rechts` je EINES — die Analyse hält das
                ausdrücklich fest (C, Feld 14/15). */}

            <div className={zeile}>
              <Beschriftung
                text={t("blog.felder.branche")}
                feld="industry"
                konfig={feldKonfig}
                stand={stand}
                onSetzen={(v) => setzen("branche", v)}
                klasse={label}
              />
              <input
                value={stand.branche}
                onChange={(e) => setzen("branche", e.target.value)}
                className={eingabe}
              />
            </div>

            <div className={zeile}>
              <Beschriftung
                text={t("blog.felder.kunde")}
                feld="client"
                konfig={feldKonfig}
                stand={stand}
                onSetzen={(v) => setzen("kunde", v)}
                klasse={label}
              />
              <input
                value={stand.kunde}
                onChange={(e) => setzen("kunde", e.target.value)}
                className={eingabe}
              />
            </div>

            <div className={zeile}>
              <Beschriftung
                text={t("blog.felder.vollerTitel")}
                feld="full_title"
                konfig={feldKonfig}
                stand={stand}
                onSetzen={(v) => setzen("vollerTitel", v)}
                klasse={label}
              />
              <input
                value={stand.vollerTitel}
                onChange={(e) => setzen("vollerTitel", e.target.value)}
                className={eingabe}
              />
            </div>

            <div className={zeile}>
              <Beschriftung
                text={t("blog.felder.introUeberschrift")}
                feld="intro_heading"
                konfig={feldKonfig}
                stand={stand}
                onSetzen={(v) => setzen("introUeberschrift", v)}
                klasse={label}
              />
              <textarea
                rows={2}
                value={stand.introUeberschrift}
                onChange={(e) => setzen("introUeberschrift", e.target.value)}
                className={eingabe}
              />
            </div>

            <div className={zeile}>
              <Beschriftung
                text={t("blog.felder.introText")}
                feld="intro_body"
                konfig={feldKonfig}
                stand={stand}
                onSetzen={(v) => setzen("introText", v)}
                klasse={label}
              />
              <textarea
                rows={5}
                value={stand.introText}
                onChange={(e) => setzen("introText", e.target.value)}
                className={eingabe}
              />
            </div>

            <div className={zeile}>
              <Beschriftung
                text={t("blog.felder.buttonText")}
                feld="button_text"
                konfig={feldKonfig}
                stand={stand}
                onSetzen={(v) => setzen("buttonText", v)}
                klasse={label}
              />
              <input
                value={stand.buttonText}
                onChange={(e) => setzen("buttonText", e.target.value)}
                className={eingabe}
              />
            </div>

            <div className={zeile}>
              <Beschriftung
                text={t("blog.felder.websiteLink")}
                feld="website_link"
                konfig={feldKonfig}
                stand={stand}
                onSetzen={(v) => setzen("websiteLink", v)}
                klasse={label}
              />
              <input
                value={stand.websiteLink}
                onChange={(e) => setzen("websiteLink", e.target.value)}
                className={eingabe}
              />
            </div>

            <div className={zeile}>
              <span className={label}>{t("blog.felder.galerieOben")}</span>
              <div className="min-w-0 flex-1">
                <GalerieFeld
                  wert={stand.galerieOben}
                  onWert={(v) => setzen("galerieOben", v)}
                />
              </div>
            </div>

            <div className={zeile}>
              <span className={label}>{t("blog.felder.galerieLinks")}</span>
              <div className="min-w-0 flex-1">
                <BildFeld
                  kompakt
                  label=""
                  wert={stand.galerieLinks}
                  onWert={(v) => setzen("galerieLinks", v)}
                />
              </div>
            </div>

            <div className={zeile}>
              <span className={label}>{t("blog.felder.galerieRechts")}</span>
              <div className="min-w-0 flex-1">
                <BildFeld
                  kompakt
                  label=""
                  wert={stand.galerieRechts}
                  onWert={(v) => setzen("galerieRechts", v)}
                />
              </div>
            </div>

            <div className={zeile}>
              <span className={label}>{t("blog.felder.galerieUnten")}</span>
              <div className="min-w-0 flex-1">
                <GalerieFeld
                  wert={stand.galerieUnten}
                  onWert={(v) => setzen("galerieUnten", v)}
                />
              </div>
            </div>

            <div className={zeile}>
              <Beschriftung
                text={t("blog.felder.finalUeberschrift")}
                feld="final_heading"
                konfig={feldKonfig}
                stand={stand}
                onSetzen={(v) => setzen("finalUeberschrift", v)}
                klasse={label}
              />
              <textarea
                rows={3}
                value={stand.finalUeberschrift}
                onChange={(e) => setzen("finalUeberschrift", e.target.value)}
                className={eingabe}
              />
            </div>

            <div className={zeile}>
              <Beschriftung
                text={t("blog.felder.finalText")}
                feld="final_body"
                konfig={feldKonfig}
                stand={stand}
                onSetzen={(v) => setzen("finalText", v)}
                klasse={label}
              />
              <textarea
                rows={4}
                value={stand.finalText}
                onChange={(e) => setzen("finalText", e.target.value)}
                className={eingabe}
              />
            </div>

            <div className={zeile}>
              <span className={label}>
                {t("blog.felder.karussellZeigen")}
              </span>
              <div className="min-w-0 flex-1 pt-1">
                <Switch
                  checked={stand.karussellZeigen}
                  onCheckedChange={(v) => setzen("karussellZeigen", v)}
                />
              </div>
            </div>

            {/* Die vier Karussell-Bilder. Sie stehen einzeln und NICHT als
                Galerie: im Vorbild sind es vier eigene Image-Felder mit
                eigenen Namen, weil ihre Position im Karussell festliegt. */}
            {([1, 2, 3, 4] as const).map((n) => {
              const key = `karussell${n}` as
                | "karussell1"
                | "karussell2"
                | "karussell3"
                | "karussell4";
              return (
                <div key={key} className={zeile}>
                  <span className={label}>{t(`blog.felder.${key}`)}</span>
                  <div className="min-w-0 flex-1">
                    <BildFeld
                      kompakt
                      label=""
                      wert={stand[key]}
                      onWert={(v) => setzen(key, v)}
                    />
                  </div>
                </div>
              );
            })}

            {/* ================================================================
                BEITRAGS-SEO
                ================================================================
                Meta-Titel, Meta-Beschreibung und Vorschaubild.

                Sie standen im Dialogzustand und wurden beim Speichern
                mitgeschickt — eine EINGABEZEILE hatten sie nie. Was man nicht
                eingeben kann, wird auch nie gespeichert: die drei Felder waren
                seit ihrer Einfuehrung tot, sichtbar nur als Spalten in der
                Tabelle (gemeldet am 28.08.2026: „Warum hast du SEO Titel und
                seo diskription ausgebaut?"). Sie sind nicht ausgebaut worden —
                sie hatten hier nie eine Zeile.

                Das VORSCHAUBILD ist nicht das Titelbild: das eine steht ueber
                dem Beitrag, das andere in der Vorschau eines geteilten Links.
                Der Renderer faellt vom einen auf das andere zurueck, aber das
                ist ein Rueckfall und keine Gleichsetzung. */}
            <div aria-hidden className="h-6 border-b border-border" />

            <div className={zeile}>
              <span className={label}>{t("blog.cm.seoTitel")}</span>
              <div className="min-w-0 flex-1">
                <input
                  value={stand.seoTitel}
                  onChange={(e) => setzen("seoTitel", e.target.value)}
                  placeholder={stand.titel}
                  className={`${eingabe} w-full`}
                />
                <p className="pt-1 text-xs text-muted-foreground">
                  {t("blog.cm.seoTitelHinweis")}
                </p>
              </div>
            </div>

            <div className={zeile}>
              <span className={label}>{t("blog.cm.seoBeschreibung")}</span>
              <div className="min-w-0 flex-1">
                <textarea
                  rows={3}
                  value={stand.seoBeschreibung}
                  onChange={(e) => setzen("seoBeschreibung", e.target.value)}
                  placeholder={stand.anriss}
                  className={`${eingabe} w-full`}
                />
                <p className="pt-1 text-xs text-muted-foreground">
                  {t("blog.cm.seoBeschreibungHinweis")}
                </p>
              </div>
            </div>

            <div className={zeile}>
              <span className={label}>{t("blog.vorschaubild")}</span>
              <div className="min-w-0 flex-1">
                <BildFeld
                  kompakt
                  label=""
                  wert={stand.vorschaubild}
                  onWert={(v) => setzen("vorschaubild", v)}
                />
              </div>
            </div>

            {/* ================================================================
                DIE EIGENEN FELDER (0485)
                ================================================================
                Sie stehen HINTER den eingebauten und vor der Fußzeile —
                dieselbe Reihenfolge wie in der Tabelle und in der
                Feldverwaltung. Drei verschiedene Reihenfolgen für dieselbe
                Feldliste wären drei Orte, an denen man suchen muss.

                Versteckte Felder fehlen ganz: „versteckt" gilt für den
                Betrieb, nicht nur für die Tabelle. */}
            {eigeneFelder.filter((f) => !f.versteckt).length > 0 ? (
              <div aria-hidden className="h-6 border-b border-border" />
            ) : null}
            {eigeneFelder
              .filter((f) => !f.versteckt)
              .map((feld) => (
                <div key={feld.id} className={zeile}>
                  <span className={label}>
                    {feld.label}
                    {feld.pflicht ? (
                      <span className="text-destructive"> *</span>
                    ) : null}
                  </span>
                  <div className="min-w-0 flex-1">
                    <EigenesFeldEingabe
                      feld={feld}
                      wert={stand.eigene[feld.feld_key] ?? null}
                      onWert={(v) =>
                        setzen("eigene", {
                          ...stand.eigene,
                          [feld.feld_key]: v,
                        })
                      }
                      eingabe={eingabe}
                    />
                    {feld.beschreibung ? (
                      <p className="pt-1 text-xs text-muted-foreground">
                        {feld.beschreibung}
                      </p>
                    ) : null}
                  </div>
                </div>
              ))}

            {/* Fußzeile mit Aufrufen und Zeitstempeln — wie im Vorbild. */}
            {!istNeu ? (
              <p className="pt-4 text-xs text-muted-foreground">
                {t("blog.aufrufe")}: {page.view_count ?? 0}
                {page.created_at
                  ? ` · ${t("blog.erstellt")}: ${format.dateTime(
                      new Date(page.created_at),
                      { day: "2-digit", month: "short", year: "numeric" },
                    )}`
                  : ""}
              </p>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}


/** Die Eingabe EINES eigenen Feldes (0485) — je nach Art.
 *
 *  Eine Komponente und keine acht Zweige an der Anzeigestelle: die Feldliste
 *  ist zur Laufzeit unbekannt, und ein `switch` mitten im Formular wäre acht
 *  Zweige tief in einer `map`.
 *
 *  Jede Art schreibt ihren EIGENEN Typ zurück — Text als Text, Zahl als Zahl,
 *  Schalter als Wahrheitswert. Alles als Text zu speichern und beim Lesen zu
 *  raten wäre genau die Sorte stiller Umdeutung, gegen die der Server prüft
 *  (`werte_pruefen`). */
function EigenesFeldEingabe({
  feld,
  wert,
  onWert,
  eingabe,
}: {
  feld: EigenesFeld;
  wert: unknown;
  onWert: (v: unknown) => void;
  /** Die Klassen der übrigen Eingaben im Dialog — damit ein eigenes Feld
   *  aussieht wie ein eingebautes. */
  eingabe: string;
}) {
  const text = typeof wert === "string" ? wert : "";

  if (feld.art === "schalter") {
    return (
      <div className="pt-1">
        <Switch
          checked={wert === true}
          onCheckedChange={(v) => onWert(v)}
        />
      </div>
    );
  }
  if (feld.art === "bild") {
    return (
      <BildFeld
        kompakt
        label=""
        wert={typeof wert === "string" ? wert : null}
        onWert={(v) => onWert(v)}
      />
    );
  }
  if (feld.art === "galerie") {
    return (
      <GalerieFeld
        wert={Array.isArray(wert) ? (wert as string[]) : []}
        onWert={(neu) => onWert(neu.length ? neu : null)}
      />
    );
  }
  if (feld.art === "liste") {
    return (
      <SchlagwortEingabe
        value={Array.isArray(wert) ? (wert as string[]) : []}
        onChange={(neu) => onWert(neu.length ? neu : null)}
        placeholder={feld.platzhalter ?? undefined}
      />
    );
  }
  if (feld.art === "zahl") {
    return (
      <input
        type="number"
        value={typeof wert === "number" ? String(wert) : ""}
        placeholder={feld.platzhalter ?? ""}
        onChange={(e) => {
          const roh = e.target.value;
          // Ein leeres Feld ist `null` und nicht 0: „nichts eingetragen" und
          // „null" sind verschiedene Aussagen (Wurzel 4).
          if (!roh.trim()) return onWert(null);
          const zahl = Number(roh);
          onWert(Number.isNaN(zahl) ? null : zahl);
        }}
        className={eingabe}
      />
    );
  }
  if (feld.art === "datum") {
    return (
      <input
        type="date"
        value={text.slice(0, 10)}
        onChange={(e) => onWert(e.target.value || null)}
        className={eingabe}
      />
    );
  }
  if (feld.mehrzeilig) {
    return (
      <textarea
        rows={4}
        value={text}
        maxLength={feld.max_zeichen ?? undefined}
        placeholder={feld.platzhalter ?? ""}
        onChange={(e) => onWert(e.target.value || null)}
        className={eingabe}
      />
    );
  }
  return (
    <input
      value={text}
      maxLength={feld.max_zeichen ?? undefined}
      placeholder={
        feld.platzhalter ?? (feld.art === "link" ? "https://…" : "")
      }
      onChange={(e) => onWert(e.target.value || null)}
      className={eingabe}
    />
  );
}


/** Ein Galerie-Feld: MEHRERE Bilder in EINEM Feld (0483).
 *
 *  Ein eigener Typ und keine vier Einzelfelder — die Framer-Analyse hält das
 *  in Abschnitt G ausdrücklich fest: „Ein Mehrfach-Bildfeld ist ein eigener
 *  Typ (`Gallery` mit `Min`/`Max`), keine vier Einzelfelder."
 *
 *  Im Vorbild stehen die Bilder als Kacheln nebeneinander, jede mit einem `×`
 *  zum Entfernen, dahinter eine `+`-Kachel zum Anhängen. Genau so hier.
 *
 *  Der Alternativtext hängt AM BILD in der Mediathek und NICHT an dieser
 *  Kachel (Analyse G, C3) — sonst gäbe es zwei Wahrheiten über dasselbe Bild
 *  (Wurzel 2). Deshalb trägt die Galerie nur Adressen. */
function GalerieFeld({
  wert,
  onWert,
  maxBilder = 24,
}: {
  wert: string[];
  onWert: (neu: string[]) => void;
  /** Dieselbe Grenze wie im Backend (`MAX_GALERIE`). Ohne Deckel wächst eine
   *  Beitragszeile ins Uferlose (Wurzel 8). */
  maxBilder?: number;
}) {
  const t = useTranslations("website");
  const [waehlt, setWaehlt] = useState(false);

  return (
    // Gitter mit 10 px Abstand und Kacheln im Format des Vorbilds: dort ist
    // JEDE Bildkachel 89 × 55 mit Radius 8 — die einzelne im Bildfeld genauso
    // wie die in der Galerie (am 28.08.2026 gemessen). Quadratische 64er
    // schnitten dagegen jedes Querformat mittig ab.
    <div className="flex flex-wrap items-start gap-2.5">
      {wert.map((url, i) => (
        <div
          key={`${url}-${i}`}
          className="group/kachel relative h-14 w-22 overflow-hidden rounded-lg border border-border bg-(--tabelle-bild-platte)"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={url} alt="" className="size-full object-cover" />
          <button
            type="button"
            aria-label={t("blog.felder.bildEntfernen")}
            onClick={() => onWert(wert.filter((_, j) => j !== i))}
            className="absolute right-0.5 top-0.5 inline-flex size-4 items-center justify-center rounded-full bg-foreground/70 text-background opacity-0 transition group-hover/kachel:opacity-100"
          >
            <Icon icon="ph:x" className="size-2.5" />
          </button>
        </div>
      ))}

      {wert.length < maxBilder ? (
        waehlt ? (
          // Der vorhandene Bildwähler im Anhänge-Modus: er liefert EINE
          // Adresse, die hinten angehängt wird. Ein eigener Mehrfach-Wähler
          // wäre ein zweiter Weg in dieselbe Mediathek (Wurzel 2).
          <div className="w-full">
            <BildFeld
              kompakt
              label={t("blog.felder.bildHinzu")}
              wert={null}
              onWert={(v) => {
                if (v) onWert([...wert, v]);
                setWaehlt(false);
              }}
            />
          </div>
        ) : (
          <button
            type="button"
            aria-label={t("blog.felder.bildHinzu")}
            onClick={() => setWaehlt(true)}
            className="inline-flex h-14 w-22 items-center justify-center rounded-lg border border-dashed border-border text-muted-foreground transition hover:bg-secondary hover:text-foreground"
          >
            <Icon icon="ph:plus" className="size-4" />
          </button>
        )
      ) : null}
    </div>
  );
}

/** Der Status als Klappliste — im Vorbild an zweiter Stelle des Dialogs.
 *
 *  Drei Zustände, nicht zwei: „Entwurf" (`is_draft`) ist etwas anderes als
 *  „noch nicht veröffentlicht" (0443). Das Vorbild kennt nur Draft/Live, weil
 *  es die Unterscheidung nicht hat — wir würfen sie sonst weg.
 *
 *  Bei einem NEUEN Beitrag ist sie gesperrt: Veröffentlichen setzt eine
 *  gespeicherte Seite voraus. Ein Schalter, der vor dem ersten Speichern
 *  nichts tut, wäre eine Attrappe. */
function StatusWahl({
  page,
  disabled,
  onAktion,
}: {
  page: Page;
  disabled?: boolean;
  onAktion: (lauf: () => Promise<{ ok: boolean; error?: string }>) => void;
}) {
  const t = useTranslations("website");
  const jetzt: "entwurf" | "bereit" | "live" = page.is_draft
    ? "entwurf"
    : page.is_published
      ? "live"
      : "bereit";
  return (
    <select
      value={jetzt}
      disabled={disabled}
      onChange={(e) => {
        const neu = e.target.value as typeof jetzt;
        if (neu === jetzt) return;
        onAktion(async () => {
          if (neu === "live") return publishPage(page.id);
          if (neu === "entwurf") return setPageDraft(page.id, true);
          const aus = await unpublishPage(page.id);
          if (!aus.ok) return aus;
          return page.is_draft ? setPageDraft(page.id, false) : aus;
        });
      }}
      className="w-40 rounded-(--radius) border border-transparent bg-secondary px-3 py-1.5 text-sm outline-none disabled:opacity-50"
    >
      <option value="entwurf">{t("blog.zustand.entwurf")}</option>
      <option value="bereit">{t("blog.zustand.bereit")}</option>
      <option value="live">{t("blog.zustand.live")}</option>
    </select>
  );
}
