"use client";

// Die Seiten der Website in der schmalen linken Leiste, gruppiert nach
// Navigationsbereich: Kopfzeile · Fußzeile · nicht verlinkt.
//
// Die Gruppierung IST die Struktur. Vorher war es eine flache Liste ohne Aussage
// darüber, wo eine Seite auftaucht — und der Renderer zeigte überhaupt kein Menü,
// also war jede angelegte Unterseite für Gäste unerreichbar.
//
// Jede Gruppe hat ein „+" in der Kopfzeile; jede Zeile ein „…"-Menü mit
// Bearbeiten · Einstellungen · Duplizieren · Löschen. Die Startseite trägt ein
// Haus-Symbol und lässt sich nicht löschen.
//
// Aussehen seit 05.09.2026 nach Framers „Pages"-Panel (DOM-Lesung,
// `docs/FRAMER-STYLE-PANEL-LIVE-2026-09-05.md` §9): oben ein Suchfeld mit
// 10 px Rand, darunter Abschnittsköpfe im SELBEN Stil wie die rechte Leiste
// (40 px, 13 px/600, „+" rechts), Zeilen 30 px mit 12-px-Symbol, Name, drei
// Punkte beim Überfahren; die geöffnete Seite steht markiert. Der gefüllte
// „Neue Seite"-Knopf von Hostaway ist weg — das „+" am Kopf ist der Weg.
import { Icon } from "@iconify/react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  type MouseEvent as ReactMouseEvent,
  useEffect,
  useState,
  useTransition,
} from "react";
import { toast } from "sonner";

import {
  type NavArea,
  type Page,
  type PageType,
  type Strecke,
  createPage,
  deletePage,
  duplicatePage,
  publishPage,
  listStrecken,
  reorderPages,
  setHomePage,
  setPageDraft,
  unpublishPage,
  updatePage,
} from "@/lib/site-pages";

import { NeueSeite, TYP_SYMBOL } from "./neue-seite";
import { SeitenEinstellungen } from "./seiten-einstellungen";
import { StreckenWahl } from "./strecken-wahl";

/** Erscheint diese Seite in der gerenderten Navigation?
 *
 *  DIESELBE Regel wie im Renderer (`seiten.py:_public_nav`): die 404-Seite und
 *  Pop-ups stehen in keiner Navigation, und ein Ordner ohne veröffentlichte
 *  Kinder fällt heraus — er wäre ein Menüpunkt, der sich aufklappt und nichts
 *  zeigt. Der Editor listete beide bis 27.08.2026 stumm unter „Kopfzeile" mit,
 *  also fünf Einträge dort und drei in der Vorschau (Prüfbericht B8).
 *
 *  Der leere Ordner ist hier nur mit den Seiten entscheidbar, die die Liste
 *  ohnehin hat — deshalb nimmt der Helfer sie als zweiten Wert. */
function imMenue(seite: Page, alle: Page[] = []): boolean {
  if (seite.page_type === "error404" || seite.page_type === "popup")
    return false;
  if (seite.page_type === "folder") {
    return alle.some((k) => k.parent_id === seite.id && k.is_published);
  }
  return true;
}

const BEREICHE: NavArea[] = ["header", "footer", "none"];

export function SeitenLeiste({
  pages,
  aktiveId = null,
  websiteSprachen = [],
  websiteSprache,
  domain = null,
}: {
  pages: Page[];
  /** Die im Editor geöffnete Seite — ihre Zeile steht markiert. */
  aktiveId?: string | null;
  /** Sprachen, die die Website führt — für den Sprachen-Reiter des Dialogs. */
  websiteSprachen?: string[];
  /** Standardsprache der WEBSITE (0474). Sie bestimmt, in welcher Sprache die
   *  Vorschau der Buchungsstrecke rendert — die Sprache des Bedieners wäre die
   *  falsche Auskunft darüber, was der Gast sieht. */
  websiteSprache?: string;
  /** Aktive Domain für die Adress-Vorschau im Dialog. */
  domain?: string | null;
}) {
  const t = useTranslations("website");
  const router = useRouter();
  const [pending, start] = useTransition();
  // Nur WELCHER Bereich seinen Dialog offen hat. Den eingetippten Titel führt
  // der Dialog `NeueSeite` selbst — hier lag er zusätzlich, wurde gesetzt und
  // nie gelesen. Ein zweiter Halter für denselben Wert ist keine Vorsicht,
  // sondern die Stelle, an der beide auseinanderlaufen.
  const [neuIn, setNeuIn] = useState<NavArea | null>(null);
  // Framers „Pages +"-Menü (Vollerfassung §14): Neue Seite · Alphabetisch
  // sortieren. Welcher Bereich sein Menü offen hat.
  const [plusMenue, setPlusMenue] = useState<NavArea | null>(null);
  // Die Wahl der Buchungsstrecke (0474). Die Liste wird erst beim ÖFFNEN geholt:
  // sie ist ein fester Katalog von drei Einträgen, und ihn bei jedem Aufbau der
  // Seitenleiste mitzuladen wäre eine Anfrage für einen Knopf, den die meisten
  // nie drücken.
  const [streckenWahl, setStreckenWahl] = useState(false);
  const [strecken, setStrecken] = useState<Strecke[]>([]);
  // Framers Suchfeld: filtert die Liste nach Titel oder Pfad, ohne Anfrage.
  const [suche, setSuche] = useState("");
  const treffer = (p: Page) => {
    const q = suche.trim().toLowerCase();
    if (!q) return true;
    return p.title.toLowerCase().includes(q) || `/${p.slug}`.toLowerCase().includes(q);
  };

  // Die Strecken holen, sobald das Fenster zum ersten Mal geöffnet wird.
  // Danach bleiben sie: der Katalog ändert sich nur mit einer neuen Fassung der
  // Anwendung, nicht mit den Daten des Betriebs.
  useEffect(() => {
    if (!streckenWahl || strecken.length > 0) return;
    let abgebrochen = false;
    void (async () => {
      const res = await listStrecken();
      if (abgebrochen) return;
      if (res.ok) setStrecken(res.data.strecken);
      // Ein Fehlschlag wird LAUT gemeldet und nicht mit einem leeren Fenster
      // beantwortet: „keine Vorlagen vorhanden" wäre eine Falschaussage über
      // einen Katalog, der im Quellcode steht (Wurzel 5).
      else toast.error(res.error);
    })();
    return () => {
      abgebrochen = true;
    };
  }, [streckenWahl, strecken.length]);
  // Welche Seite ihre Einstellungen offen hat. Als ID und nicht als Objekt: nach
  // einem `router.refresh()` ist das Page-Objekt ein neues, und ein
  // festgehaltenes wäre der Stand von vorher.
  const [einstellungenVon, setEinstellungenVon] = useState<string | null>(null);
  const offeneSeite = pages.find((p) => p.id === einstellungenVon) ?? null;

  function fuehreAus(aktion: () => Promise<{ ok: boolean; error?: string }>) {
    start(async () => {
      const res = await aktion();
      if (!res.ok) toast.error(res.error ?? t("seiten.fehlgeschlagen"));
      else router.refresh();
    });
  }

  function anlegen(
    bereich: NavArea,
    name: string,
    typ: PageType,
    externalUrl: string | null,
    parentId: string | null,
    popup: Parameters<typeof createPage>[6],
    template: string | null,
  ) {
    setNeuIn(null);
    fuehreAus(() =>
      createPage(
        name,
        "",
        bereich,
        typ,
        externalUrl,
        parentId,
        popup,
        template,
      ),
    );
  }

  /** Framer „Sort Alphabetically": die Reihenfolge des Bereichs nach Titel
   *  (Sprache des Bedieners), gespeichert über denselben Weg wie das
   *  Verschieben — EIN Request mit allen IDs. */
  function sortiereAlphabetisch(bereich: NavArea) {
    const ids = pages
      .filter((p) => p.nav_area === bereich && !p.system_key && !p.dynamic_source)
      .sort((a, b) => a.title.localeCompare(b.title, undefined, { sensitivity: "base" }))
      .map((p) => p.id);
    if (ids.length < 2) return;
    fuehreAus(() => reorderPages(bereich, ids));
  }

  function verschiebe(seite: Page, richtung: -1 | 1) {
    const inBereich = pages
      .filter((p) => p.nav_area === seite.nav_area)
      .sort((a, b) => a.nav_order - b.nav_order);
    const i = inBereich.findIndex((p) => p.id === seite.id);
    const j = i + richtung;
    if (i < 0 || j < 0 || j >= inBereich.length) return;
    const ids = inBereich.map((p) => p.id);
    [ids[i], ids[j]] = [ids[j]!, ids[i]!];
    fuehreAus(() => reorderPages(seite.nav_area, ids));
  }

  // Leeres Konto: der Weg führt in den Vorlagen-Reiter statt in eine zweite,
  // hier eingebaute Vorlagenliste. Die stand vorher an dieser Stelle und zählte
  // die Vorlagen-IDs selbst auf — als das Backend sie umbenannte, lief jeder
  // Klick in ein 404, sichtbar nur als Toast.
  if (pages.length === 0) {
    return (
      <div className="flex flex-col items-start gap-2 p-4">
        <h3 className="font-display text-sm font-extrabold">
          {t("seiten.leerTitel")}
        </h3>
        <p className="text-xs leading-snug text-muted-foreground">
          {t("seiten.leerHinweis")}
        </p>
        <Link
          href="/website/vorlagen"
          className="mt-1 inline-flex items-center gap-1.5 rounded-full bg-foreground px-3 py-1.5 text-xs font-medium text-background transition hover:opacity-90"
        >
          <Icon icon="ph:squares-four" className="size-4" />
          {t("seiten.leerKnopf")}
        </Link>
        <button
          type="button"
          onClick={() => setNeuIn("header")}
          className="text-xs text-muted-foreground underline-offset-2 transition hover:text-foreground hover:underline"
        >
          {t("seiten.leerLeereSeite")}
        </button>
        {neuIn ? (
          <NeueSeite
            bereich={neuIn}
            pages={pages}
            pending={pending}
            onAnlegen={(name, typ, url, parent, popup, template) =>
              anlegen(neuIn, name, typ, url, parent, popup, template)
            }
            onAbbrechen={() => setNeuIn(null)}
          />
        ) : null}
      </div>
    );
  }

  return (
    <div className="flex flex-col pb-8">
      {/* Suchfeld (Framer: `content-panel-search-bar`, Lupe 12 px, Rand 10 px). */}
      <div className="px-2.5 pb-2.5">
        <label className="flex h-[30px] items-center gap-2 rounded-md bg-secondary px-2 text-xs">
          <Icon icon="ph:magnifying-glass" className="size-3 shrink-0 text-muted-foreground" aria-hidden />
          <input
            type="search"
            value={suche}
            onChange={(e) => setSuche(e.target.value)}
            placeholder={t("stil.suchen")}
            aria-label={t("stil.suchen")}
            className="min-w-0 flex-1 bg-transparent outline-none placeholder:text-muted-foreground"
          />
        </label>
      </div>
      {BEREICHE.map((bereich) => {
        const imBereich = pages
          // Systemseiten gehören NICHT in „Nicht verlinkt". Sie sind nicht
          // „vergessen zu verlinken", sondern die Buchungsstrecke — sie stehen
          // in einer eigenen Gruppe darunter, mit eigener Erklärung.
          .filter(
            (p) => p.nav_area === bereich && !p.system_key && !p.dynamic_source,
          )
          .filter(treffer)
          .sort((a, b) => a.nav_order - b.nav_order);
        if (suche && imBereich.length === 0) return null;
        return (
          <section
            key={bereich}
            className="border-b border-border pb-1.5 last:border-0"
          >
            {/* Kopf wie rechts: 40 px, 13 px/600, „+" rechts (Framer `.h10l6u5c`). */}
            <div className="flex h-10 items-center gap-2 px-2.5">
              <h3 className="min-w-0 flex-1 truncate font-sans text-[0.8125rem] font-semibold">
                {t(`seiten.bereichTitel.${bereich}`)}
              </h3>
              <div className="relative shrink-0">
                <button
                  type="button"
                  aria-label={t("seiten.neueSeite")}
                  title={t("seiten.neueSeite")}
                  aria-haspopup="menu"
                  aria-expanded={plusMenue === bereich}
                  onClick={() => setPlusMenue((m) => (m === bereich ? null : bereich))}
                  className="rounded p-1 text-muted-foreground transition hover:bg-secondary hover:text-foreground"
                >
                  <Icon icon="ph:plus" className="size-3.5" />
                </button>
                {plusMenue === bereich ? (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setPlusMenue(null)} />
                    <div
                      role="menu"
                      className="absolute right-0 top-7 z-50 flex w-48 flex-col rounded-(--radius) border border-border bg-popover py-1 text-xs shadow-lg"
                    >
                      <MenuePunkt
                        icon="ph:file-plus"
                        label={t("seiten.neueSeite")}
                        onClick={() => {
                          setPlusMenue(null);
                          setNeuIn(bereich);
                        }}
                      />
                      <MenuePunkt
                        icon="ph:sort-ascending"
                        label={t("seiten.sortierenAlphabetisch")}
                        disabled={pending || imBereich.length < 2}
                        onClick={() => {
                          setPlusMenue(null);
                          sortiereAlphabetisch(bereich);
                        }}
                      />
                    </div>
                  </>
                ) : null}
              </div>
            </div>

            {neuIn === bereich ? (
              <NeueSeite
                bereich={bereich}
                pages={pages}
                pending={pending}
                onAnlegen={(name, typ, url, parent, popup, template) =>
                  anlegen(bereich, name, typ, url, parent, popup, template)
                }
                onAbbrechen={() => setNeuIn(null)}
              />
            ) : null}

            {imBereich.length === 0 ? (
              <p className="px-2.5 pb-2 text-xs text-muted-foreground">
                {t(`seiten.bereichLeer.${bereich}`)}
              </p>
            ) : (
              <ul>
                {imBereich.map((p, i) => (
                  <SeitenZeile
                    key={p.id}
                    seite={p}
                    aktiv={p.id === aktiveId}
                    alleSeiten={pages}
                    erste={i === 0}
                    letzte={i === imBereich.length - 1}
                    pending={pending}
                    onVerschiebe={verschiebe}
                    onAktion={fuehreAus}
                    onEinstellungen={(s) => setEinstellungenVon(s.id)}
                  />
                ))}
              </ul>
            )}
          </section>
        );
      })}

      <Systemgruppe
        // Die dynamische Objektseite steht VORNE: sie ist der Anfang der
        // Strecke — der Gast sieht ein Objekt an, bevor er bucht. Danach
        // Buchung und Bestätigung in der Reihenfolge, die der Server liefert.
        //
        // Der BLOG steht hier NICHT mehr (0474). Er lag in dieser Gruppe, weil
        // sie alles aufnahm, was `page_type='system'` ist — die Gruppe hieß also
        // nach ihrem häufigsten Fall, nicht nach ihrem Inhalt. Der Blog ist
        // aber ein eigener Bereich mit eigenem CMS (`/website/blog`), dessen
        // Menüpunkt „Layouts" bereits auf seine Übersichtsseite zeigt. Ihn in
        // der Buchungsstrecke zu führen hieß, dass eine Wahl dort das Aussehen
        // des Blogs mitändert — zwei Orte für dieselbe Entscheidung.
        seiten={[
          ...pages.filter((p) => p.dynamic_source),
          ...pages.filter((p) => p.system_key && p.system_key !== "blog"),
        ].filter(treffer)}
        aktiveId={aktiveId}
        onEinstellungen={(id) => setEinstellungenVon(id)}
        onVorlagen={() => setStreckenWahl(true)}
      />

      {streckenWahl ? (
        <StreckenWahl
          strecken={strecken}
          sprache={websiteSprache}
          onSchliesse={() => setStreckenWahl(false)}
        />
      ) : null}

      {offeneSeite ? (
        <SeitenEinstellungen
          seite={offeneSeite}
          websiteSprachen={websiteSprachen}
          domain={domain}
          onSchliessen={() => {
            setEinstellungenVon(null);
            // Nach dem Schließen neu laden: der Dialog hat Titel, Slug oder
            // Sprachen geändert, und die Liste zeigt sie.
            router.refresh();
          }}
        />
      ) : null}
    </div>
  );
}

/** Die Buchungsstrecke: Seiten, die der Renderer ausliefert, ohne dass sie
 *  jemand angelegt hat (0466).
 *
 *  Eigene Gruppe und nicht unter „Nicht verlinkt": dort stünden sie neben
 *  Seiten, die man vergessen hat zu verlinken — und der erste Reflex wäre, sie
 *  zu verlinken oder zu löschen. Beides ist falsch. Sie werden erreicht, indem
 *  der Gast ein Objekt anklickt oder bucht.
 *
 *  Kein Löschen, kein Verschieben, kein Umbenennen: es gibt nichts zu löschen
 *  (die Route antwortet weiter) und nichts umzubenennen (der Slug ist das Muster
 *  der Route). Was es gibt, ist ihre Auffindbarkeit — deshalb führt der Klick in
 *  dieselben Einstellungen wie bei jeder Seite, nur mit gesperrten Feldern. */
function Systemgruppe({
  seiten,
  aktiveId,
  onEinstellungen,
  onVorlagen,
}: {
  seiten: Page[];
  aktiveId: string | null;
  onEinstellungen: (id: string) => void;
  /** Öffnet die Wahl der Buchungsstrecke (0474). */
  onVorlagen: () => void;
}) {
  const t = useTranslations("website");
  const router = useRouter();
  if (seiten.length === 0) return null;
  return (
    <section className="border-b border-border pb-1.5 last:border-0">
      <div className="px-2.5">
        <div className="flex h-10 items-center gap-2">
          <h3 className="min-w-0 flex-1 truncate font-sans text-[0.8125rem] font-semibold">
            {t("seiten.systemgruppe")}
          </h3>
          {/* Der Weg zu den drei Formen (0474). Er steht an der GRUPPE und nicht
              an einer der Seiten, weil eine Wahl alle drei setzt — sie sind ein
              Weg, den der Gast hintereinander durchläuft. */}
          <button
            type="button"
            onClick={() => onVorlagen()}
            title={t("strecke.titel")}
            className="shrink-0 rounded-full px-2 py-0.5 text-xs font-medium text-muted-foreground transition hover:bg-secondary hover:text-foreground"
          >
            {t("strecke.waehlen")}
          </button>
        </div>
        <p className="pb-1 text-[0.6875rem] leading-snug text-muted-foreground">
          {t("seiten.systemgruppeHinweis")}
        </p>
      </div>
      <ul>
        {seiten.map((p) => (
          <li key={p.id}>
            <button
              type="button"
              // Die dynamische Objektseite ist eine VORLAGE — sie wird
              // gestaltet, also führt der Klick in den Editor. Die Systemseiten
              // haben nichts zu gestalten; dort öffnen die Einstellungen, wo
              // ihre SEO-Angaben stehen.
              onClick={() =>
                p.dynamic_source
                  ? router.push(`/website/seiten/${p.id}`)
                  : onEinstellungen(p.id)
              }
              aria-selected={p.id === aktiveId}
              className={
                "flex h-[30px] w-full items-center gap-2 px-2.5 text-left text-xs transition hover:bg-secondary " +
                (p.id === aktiveId ? "bg-secondary" : "")
              }
            >
              {/* Die dynamische Seite trägt ein anderes Symbol: sie ist nicht
                  gesperrt, sondern eine VORLAGE — man kann sie gestalten, nur
                  nicht umbenennen oder löschen. */}
              <Icon
                icon={p.dynamic_source ? "ph:stack-simple" : "ph:lock-simple"}
                className="size-3 shrink-0 text-muted-foreground"
              />
              <span className="min-w-0 flex-1 truncate">
                {/* Der Titel steht NICHT in der DB — er stünde dort in einer
                    Sprache. Übersetzt wird über die Kennung. */}
                {p.dynamic_source
                  ? t(`seiten.dynamischeSeiten.${p.dynamic_source}`)
                  : t(`seiten.systemseiten.${p.system_key}`)}
              </span>
              <span className="shrink-0 font-mono text-[0.6875rem] text-muted-foreground">
                /{p.slug}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Höchste Menühöhe (alle Punkte sichtbar) — für das Hochklappen am Fensterrand. */
const MENUE_HOEHE = 360;

function SeitenZeile({
  seite,
  aktiv,
  alleSeiten,
  erste,
  letzte,
  pending,
  onVerschiebe,
  onAktion,
  onEinstellungen,
}: {
  seite: Page;
  /** Die im Editor geöffnete Seite (Framer: `aria-selected`). */
  aktiv: boolean;
  /** Alle Seiten — nötig, um einen LEEREN Ordner zu erkennen (`imMenue`). */
  alleSeiten: Page[];
  erste: boolean;
  letzte: boolean;
  pending: boolean;
  onVerschiebe: (s: Page, r: -1 | 1) => void;
  onAktion: (a: () => Promise<{ ok: boolean; error?: string }>) => void;
  onEinstellungen: (s: Page) => void;
}) {
  const t = useTranslations("website");
  const router = useRouter();
  /**
   * Das Menü steht als `fixed` im Fenster, nicht `absolute` in der Zeile.
   * Die Seitenliste liegt in einem Scroll-Panel (`schale.tsx`,
   * `overflow-y-auto`); ein absolut positioniertes Menü wurde darin am
   * unteren Rand abgeschnitten — und der LETZTE Punkt ist „Löschen". Gemeldet
   * am 05.09.2026: „hier müssen wir auch seiten löschen können", obwohl der
   * Punkt im Code stand. Dasselbe Muster wie in `ebenen-liste.tsx`.
   */
  const [menue, setMenue] = useState<{ x: number; y: number } | null>(null);
  /** Erscheint diese Seite in der gerenderten Navigation? */
  const steht = imMenue(seite, alleSeiten);

  useEffect(() => {
    if (!menue) return;
    // Beim Scrollen des Panels würde das Menü von seiner Zeile weglaufen.
    const zu = () => setMenue(null);
    window.addEventListener("scroll", zu, true);
    window.addEventListener("resize", zu);
    return () => {
      window.removeEventListener("scroll", zu, true);
      window.removeEventListener("resize", zu);
    };
  }, [menue]);

  function menueOeffnen(e: ReactMouseEvent<HTMLButtonElement>) {
    if (menue) {
      setMenue(null);
      return;
    }
    const r = e.currentTarget.getBoundingClientRect();
    setMenue({ x: r.right, y: r.bottom + 4 });
  }

  return (
    <li className="relative" aria-selected={aktiv}>
      <div
        className={
          "group flex h-[30px] items-center gap-2 px-2.5 transition hover:bg-secondary/60 " +
          (aktiv ? "bg-secondary" : "")
        }
      >
        {/* Das Symbol NACH TYP, aus derselben Tabelle wie die Auswahl beim
            Anlegen. Vorher war jede Seite außer der Startseite ein Blatt —
            Ordner, Pop-up, externer Link und 404 sahen gleich aus, obwohl die
            Renderer die Hälfte davon nie ins Menü nimmt (Prüfbericht B8). */}
        <span
          // Der Tooltip sitzt am `span` und nicht am `Icon`: dessen Props
          // kennen kein `title`.
          title={steht ? undefined : t("seiten.nichtImMenue")}
          className="flex shrink-0 items-center"
        >
          <Icon
            icon={
              seite.is_home
                ? "ph:house-fill"
                : (TYP_SYMBOL[seite.page_type] ?? "ph:file")
            }
            className={`size-3 ${
              steht ? "text-muted-foreground" : "text-muted-foreground/50"
            }`}
          />
        </span>
        <button
          type="button"
          onClick={() => router.push(`/website/seiten/${seite.id}`)}
          className="min-w-0 flex-1 truncate text-left text-xs"
          title={seite.title}
        >
          {seite.title}
          {/* Zwei verschiedene Zustände, zwei verschiedene Etiketten (0443):
              „nicht live" heißt, die Seite ist noch nicht veröffentlicht;
              „Entwurf" heißt, sie wird beim Veröffentlichen ABSICHTLICH
              übersprungen. Beides gleich zu beschriften hieße, dem Kunden zu
              verschweigen, warum eine Seite nicht mitkommt. */}
          {seite.is_draft ? (
            <span className="ml-1 text-[0.6875rem] font-medium text-muted-foreground">
              · {t("seiten.entwurfGehalten")}
            </span>
          ) : !seite.is_published ? (
            <span className="ml-1 text-[0.6875rem] text-muted-foreground">
              · {t("seiten.entwurf")}
            </span>
          ) : null}
        </button>
        <button
          type="button"
          aria-label={t("seiten.menue")}
          aria-expanded={menue !== null}
          onClick={menueOeffnen}
          className="shrink-0 rounded p-0.5 text-muted-foreground opacity-0 transition group-hover:opacity-100 group-focus-within:opacity-100 aria-expanded:opacity-100"
        >
          <Icon icon="ph:dots-three" className="size-3.5" />
        </button>
      </div>

      {menue ? (
        <>
          {/* Fangfläche: Klick daneben schließt. */}
          <div className="fixed inset-0 z-40" onClick={() => setMenue(null)} />
          <div
            role="menu"
            className="fixed z-50 flex w-44 flex-col rounded-(--radius) border border-border bg-background py-1 text-sm shadow-lg"
            style={{
              left: Math.max(
                8,
                Math.min(menue.x - 176, window.innerWidth - 184),
              ),
              // Unten am Fenster nach oben klappen, damit „Löschen" nie
              // außerhalb steht.
              top: Math.min(menue.y, window.innerHeight - MENUE_HOEHE),
            }}
          >
            <MenuePunkt
              icon="ph:pencil-simple"
              label={t("seiten.bearbeiten")}
              onClick={() => router.push(`/website/seiten/${seite.id}`)}
            />
            <MenuePunkt
              icon="ph:gear"
              label={t("seiten.einstellungen")}
              onClick={() => {
                onEinstellungen(seite);
                setMenue(null);
              }}
            />
            {!erste ? (
              <MenuePunkt
                icon="ph:arrow-up"
                label={t("seiten.nachOben")}
                disabled={pending}
                onClick={() => {
                  onVerschiebe(seite, -1);
                  setMenue(null);
                }}
              />
            ) : null}
            {!letzte ? (
              <MenuePunkt
                icon="ph:arrow-down"
                label={t("seiten.nachUnten")}
                disabled={pending}
                onClick={() => {
                  onVerschiebe(seite, 1);
                  setMenue(null);
                }}
              />
            ) : null}

            <div className="my-1 border-t border-border" />

            {/* Bereich wechseln. Die Positionsnummer im Zielbereich setzt das
              Backend selbst neu (Gegenzustand, Wurzel 1). */}
            {BEREICHE.filter((b) => b !== seite.nav_area).map((b) => (
              <MenuePunkt
                key={b}
                icon="ph:arrows-left-right"
                label={t(`seiten.verschiebeNach.${b}`)}
                disabled={pending}
                onClick={() => {
                  onAktion(() => updatePage(seite.id, { nav_area: b }));
                  setMenue(null);
                }}
              />
            ))}

            {!seite.is_home ? (
              <MenuePunkt
                icon="ph:house"
                label={t("seiten.alsStartseite")}
                disabled={pending}
                onClick={() => {
                  onAktion(() => setHomePage(seite.id));
                  setMenue(null);
                }}
              />
            ) : null}

            <div className="my-1 border-t border-border" />

            {/* Als Entwurf halten gibt es nur für Seiten mit Inhalt und nicht
              für die Startseite — eine Website ohne Eingang wäre keine. Die
              Datenbank lehnt es ohnehin ab (CHECK aus 0443); der Punkt hier
              gar nicht erst zu zeigen ist die freundlichere Fassung
              derselben Regel. */}
            {!seite.is_home &&
            seite.page_type !== "external" &&
            seite.page_type !== "folder" ? (
              <MenuePunkt
                icon={
                  seite.is_draft
                    ? "ph:arrow-counter-clockwise"
                    : "ph:pencil-simple-slash"
                }
                label={
                  seite.is_draft
                    ? t("seiten.entwurfFreigeben")
                    : t("seiten.entwurfHalten")
                }
                disabled={pending}
                onClick={() => {
                  onAktion(() => setPageDraft(seite.id, !seite.is_draft));
                  setMenue(null);
                }}
              />
            ) : null}

            <MenuePunkt
              icon={seite.is_published ? "ph:eye-slash" : "ph:globe"}
              label={
                seite.is_published
                  ? t("seiten.zurueckziehen")
                  : t("seiten.veroeffentlichen")
              }
              disabled={pending}
              onClick={() => {
                onAktion(() =>
                  seite.is_published
                    ? unpublishPage(seite.id)
                    : publishPage(seite.id),
                );
                setMenue(null);
              }}
            />

            {/* Duplizieren gibt es nur für Seiten mit Inhalt (0433): einen Ordner
              zu kopieren hieße eine leere Gruppe zu erzeugen, und einen externen
              Menüpunkt einen zweiten Link auf dasselbe Ziel.

              Die Kopie ist immer ein ENTWURF und ohne die SEO-Felder des
              Originals — sonst stünden zwei Seiten mit demselben Meta-Titel
              live, also genau der Befund, den die SEO-Prüfung meldet. */}
            {seite.page_type === "normal" ? (
              <MenuePunkt
                icon="ph:copy"
                label={t("seiten.duplizieren")}
                disabled={pending}
                onClick={() => {
                  onAktion(() => duplicatePage(seite.id));
                  setMenue(null);
                }}
              />
            ) : null}
            {/* Auf der Startseite steht der Punkt DEAKTIVIERT mit Hinweis,
                statt zu fehlen: ein fehlender Punkt liest sich als „geht
                nicht" ohne Warum (gemeldet 05.09.2026: „immer noch kein
                löschen button"). Der Weg: andere Seite zur Startseite machen,
                dann löschen. Den Riegel setzt das Backend (422). */}
            <MenuePunkt
              icon="ph:trash"
              label={t("seiten.loeschen")}
              disabled={pending || seite.is_home}
              title={
                seite.is_home ? t("seiten.startseiteNichtLoeschbar") : undefined
              }
              gefahr
              onClick={() => {
                setMenue(null);
                // Rückfrage: eine Seite samt Abschnitten ist nach dem Klick
                // weg, einen Rückweg gibt es nicht.
                if (
                  !window.confirm(
                    t("seiten.loeschenFrage", { titel: seite.title }),
                  )
                )
                  return;
                onAktion(() => deletePage(seite.id));
              }}
            />
          </div>
        </>
      ) : null}
    </li>
  );
}

function MenuePunkt({
  icon,
  label,
  onClick,
  disabled,
  gefahr,
  title,
}: {
  icon: string;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  gefahr?: boolean;
  title?: string;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      title={title}
      onClick={onClick}
      className={
        "flex items-center gap-2 px-3 py-1.5 text-left transition disabled:opacity-40 " +
        (gefahr
          ? "text-destructive hover:bg-destructive/10"
          : "hover:bg-secondary")
      }
    >
      <Icon icon={icon} className="size-4 shrink-0" />
      {label}
    </button>
  );
}
