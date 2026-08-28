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
import { Icon } from "@iconify/react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
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
  if (seite.page_type === "error404" || seite.page_type === "popup") return false;
  if (seite.page_type === "folder") {
    return alle.some((k) => k.parent_id === seite.id && k.is_published);
  }
  return true;
}

const BEREICHE: NavArea[] = ["header", "footer", "none"];

export function SeitenLeiste({
  pages,
  websiteSprachen = [],
  websiteSprache,
  domain = null,
}: {
  pages: Page[];
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
  // Die Wahl der Buchungsstrecke (0474). Die Liste wird erst beim ÖFFNEN geholt:
  // sie ist ein fester Katalog von drei Einträgen, und ihn bei jedem Aufbau der
  // Seitenleiste mitzuladen wäre eine Anfrage für einen Knopf, den die meisten
  // nie drücken.
  const [streckenWahl, setStreckenWahl] = useState(false);
  const [strecken, setStrecken] = useState<Strecke[]>([]);

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
  const offeneSeite =
    pages.find((p) => p.id === einstellungenVon) ?? null;

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
      {/* Der primäre Weg, oben und gefüllt — wie Hostaways „+ Add Page".
          Die kleinen „+" an den Gruppen bleiben für den Fall, dass jemand
          gezielt in die Fußzeile anlegt. */}
      <div className="border-b border-border p-3">
        <button
          type="button"
          onClick={() => setNeuIn(neuIn === "header" ? null : "header")}
          aria-expanded={neuIn === "header"}
          className="flex w-full items-center justify-center gap-1.5 rounded-full bg-foreground px-3 py-2 text-sm font-medium text-background transition hover:opacity-90"
        >
          <Icon icon="ph:plus" className="size-4" />
          {t("seiten.neueSeite")}
        </button>
      </div>
      {BEREICHE.map((bereich) => {
        const imBereich = pages
          // Systemseiten gehören NICHT in „Nicht verlinkt". Sie sind nicht
          // „vergessen zu verlinken", sondern die Buchungsstrecke — sie stehen
          // in einer eigenen Gruppe darunter, mit eigener Erklärung.
          .filter(
            (p) => p.nav_area === bereich && !p.system_key && !p.dynamic_source,
          )
          .sort((a, b) => a.nav_order - b.nav_order);
        return (
          <section key={bereich} className="border-b border-border pb-2 last:border-0">
            <div className="flex items-center justify-between gap-2 px-4 pb-1 pt-4">
              <h3 className="font-display text-sm font-extrabold">
                {t(`seiten.bereichTitel.${bereich}`)}
              </h3>
              <button
                type="button"
                aria-label={t("seiten.neueSeite")}
                title={t("seiten.neueSeite")}
                onClick={() => setNeuIn(bereich)}
                className="text-muted-foreground transition hover:text-foreground"
              >
                <Icon icon="ph:plus" className="size-4" />
              </button>
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
              <p className="px-4 pb-2 text-xs text-muted-foreground">
                {t(`seiten.bereichLeer.${bereich}`)}
              </p>
            ) : (
              <ul>
                {imBereich.map((p, i) => (
                  <SeitenZeile
                    key={p.id}
                    seite={p}
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
        ]}
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
  onEinstellungen,
  onVorlagen,
}: {
  seiten: Page[];
  onEinstellungen: (id: string) => void;
  /** Öffnet die Wahl der Buchungsstrecke (0474). */
  onVorlagen: () => void;
}) {
  const t = useTranslations("website");
  const router = useRouter();
  if (seiten.length === 0) return null;
  return (
    <section className="border-b border-border pb-2 last:border-0">
      <div className="px-4 pb-1 pt-4">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-display text-sm font-extrabold">
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
        <p className="pt-0.5 text-xs text-muted-foreground">
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
              className="flex w-full items-center gap-2 px-4 py-1.5 text-left text-sm transition hover:bg-secondary"
            >
              {/* Die dynamische Seite trägt ein anderes Symbol: sie ist nicht
                  gesperrt, sondern eine VORLAGE — man kann sie gestalten, nur
                  nicht umbenennen oder löschen. */}
              <Icon
                icon={p.dynamic_source ? "ph:stack-simple" : "ph:lock-simple"}
                className="size-4 shrink-0 text-muted-foreground"
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

function SeitenZeile({
  seite,
  alleSeiten,
  erste,
  letzte,
  pending,
  onVerschiebe,
  onAktion,
  onEinstellungen,
}: {
  seite: Page;
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
  const [menue, setMenue] = useState(false);
  /** Erscheint diese Seite in der gerenderten Navigation? */
  const steht = imMenue(seite, alleSeiten);
  const huelle = useRef<HTMLLIElement>(null);

  useEffect(() => {
    if (!menue) return;
    function aufKlick(e: MouseEvent) {
      if (!huelle.current?.contains(e.target as Node)) setMenue(false);
    }
    document.addEventListener("mousedown", aufKlick);
    return () => document.removeEventListener("mousedown", aufKlick);
  }, [menue]);

  return (
    <li ref={huelle} className="relative">
      <div className="group flex items-center gap-1.5 px-4 py-1.5 transition hover:bg-secondary/60">
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
                : TYP_SYMBOL[seite.page_type] ?? "ph:file"
            }
            className={`size-4 ${
              steht ? "text-muted-foreground" : "text-muted-foreground/50"
            }`}
          />
        </span>
        <button
          type="button"
          onClick={() => router.push(`/website/seiten/${seite.id}`)}
          className="min-w-0 flex-1 truncate text-left text-sm"
          title={seite.title}
        >
          {seite.title}
          {/* Zwei verschiedene Zustände, zwei verschiedene Etiketten (0443):
              „nicht live" heißt, die Seite ist noch nicht veröffentlicht;
              „Entwurf" heißt, sie wird beim Veröffentlichen ABSICHTLICH
              übersprungen. Beides gleich zu beschriften hieße, dem Kunden zu
              verschweigen, warum eine Seite nicht mitkommt. */}
          {seite.is_draft ? (
            <span className="ml-1 text-xs font-medium text-muted-foreground">
              · {t("seiten.entwurfGehalten")}
            </span>
          ) : !seite.is_published ? (
            <span className="ml-1 text-xs text-muted-foreground">
              · {t("seiten.entwurf")}
            </span>
          ) : null}
        </button>
        <button
          type="button"
          aria-label={t("seiten.menue")}
          aria-expanded={menue}
          onClick={() => setMenue((m) => !m)}
          className="shrink-0 text-muted-foreground opacity-0 transition group-hover:opacity-100 group-focus-within:opacity-100 aria-expanded:opacity-100"
        >
          <Icon icon="ph:dots-three" className="size-4" />
        </button>
      </div>

      {menue ? (
        <div className="absolute right-2 top-8 z-30 flex w-44 flex-col rounded-(--radius) border border-border bg-background py-1 text-sm shadow-lg">
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
              setMenue(false);
            }}
          />
          {!erste ? (
            <MenuePunkt
              icon="ph:arrow-up"
              label={t("seiten.nachOben")}
              disabled={pending}
              onClick={() => {
                onVerschiebe(seite, -1);
                setMenue(false);
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
                setMenue(false);
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
                setMenue(false);
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
                setMenue(false);
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
              icon={seite.is_draft ? "ph:arrow-counter-clockwise" : "ph:pencil-simple-slash"}
              label={
                seite.is_draft
                  ? t("seiten.entwurfFreigeben")
                  : t("seiten.entwurfHalten")
              }
              disabled={pending}
              onClick={() => {
                onAktion(() => setPageDraft(seite.id, !seite.is_draft));
                setMenue(false);
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
              setMenue(false);
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
                setMenue(false);
              }}
            />
          ) : null}

          {/* Die Startseite ist nicht löschbar: ohne sie liefert die Domain
              nichts. Das Backend hat dafür einen eigenen Riegel (genau eine Home
              pro Konto), hier wird der Punkt gar nicht angeboten. */}
          {!seite.is_home ? (
            <MenuePunkt
              icon="ph:trash"
              label={t("seiten.loeschen")}
              disabled={pending}
              gefahr
              onClick={() => {
                onAktion(() => deletePage(seite.id));
                setMenue(false);
              }}
            />
          ) : null}
        </div>
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
}: {
  icon: string;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  gefahr?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
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
