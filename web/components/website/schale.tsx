"use client";

// Grundraster des Baukastens — 1:1 nach den Fotos in `docs/UI` (Hostaways
// „Booking Website Pro"-Editor, als Storylane-Demo abfotografiert am
// 25.08.2026). Was hier steht, ist GESEHEN, nicht aus Fließtext abgeleitet.
//
//   ┌──────────────────────────────────────────────────────────────────────┐
//   │ ≡ Logo │ Seite ⌄ │ 🏳⌄ ║   🖥 ▭ ▯   ║ ↺ ↻ ✓ ⤴ Vorschau [Publish] ⌂ │
//   ├────┬──────────┬──────────────────────────────────┬──────────────────┤
//   │ ▤  │ MENÜ-    │                                  │ INSPEKTOR        │
//   │ ▤  │ SPALTE   │        Arbeitsfläche             │ (rechts,         │
//   │ ▤  │          │                                  │  angedockt)      │
//   │ ▤  │  PANEL   │                                  │                  │
//   └────┴──────────┴──────────────────────────────────┴──────────────────┘
//     60px   140px        Fläche rückt zusammen              320px
//
// VIER SPALTEN, und die vierte ist der Punkt. Der Inspektor lag bisher LINKS,
// im selben Panel wie die Liste — wer einen Baustein bearbeitete, verlor damit
// die Liste, aus der er kam, und sah in einer 20-rem-Spalte weder, WAS er
// gerade anfasst, noch wo es steht. Im Vorbild sitzt er rechts, die Fläche
// RÜCKT ZUSAMMEN (kein Overlay), und über ihm steht ein Breadcrumb, der die
// Verschachtelung zeigt.
//
// Der Kunde stellt links etwas ein, sieht in der Mitte sofort die Folge und
// bearbeitet rechts, was er in der Mitte angeklickt hat.
import { Icon } from "@iconify/react";
import Link from "next/link";
import { type ReactNode, useEffect, useRef, useState } from "react";

import { HILFE_URL } from "@/lib/marketing-url";

import { KiProvider } from "./ki/ki-context";
import { MenueSpalte } from "./menue-spalte";
import { LEISTE_GRUPPEN, REITER_MENUE, type ReiterId } from "./reiter";

/** Ein Eintrag der senkrechten Bereichsleiste. */
export type Reiter = { id: string; label: string; href: string; icon: string };

/** Beschriftungen, die die Schale selbst braucht. */
export type SchalenTexte = {
  panelEinklappen: string;
  panelAusklappen: string;
  panelBreite: string;
  panelHilfe: string;
  /** Aria-Label des Zurück-Pfeils vor dem Titel — nur sichtbar, wenn eine
   *  Route `panelZurueckHref` mitgibt (0468: Hostaway-Unterseiten). */
  panelZurueck: string;
};

/** Zustand des Autospeicherns — wird oben rechts angezeigt, wie im Markt üblich.
 *  Es gibt bewusst KEINEN Speichern-Knopf: ein Kunde, der eine Farbe wählt und
 *  wegklickt, hat gespeichert. */
export type SpeicherStand = "ruht" | "speichert" | "gespeichert" | "fehler";

/**
 * Höhe der Schale: vom eigenen Oberrand bis zum Fensterboden, minus dem unteren
 * Innenabstand des Dashboard-Inhaltsbereichs.
 *
 * Warum gemessen und nicht gerechnet: der Abstand nach oben hängt davon ab, was
 * über der Seite steht — Topbar immer, dazu je nach Konto ein Demo-Band oder ein
 * 2FA-Hinweis. Eine feste Zahl wie `calc(100dvh - 7rem)` wäre für den einen Fall
 * richtig und für die anderen falsch, und niemand würde es merken, weil es nur
 * ein paar Pixel schief aussieht.
 *
 * Nötig ist das, weil der Sidebar-Wrapper des Dashboards nur `min-h-svh` setzt
 * (also eine Untergrenze, keine Obergrenze) und deshalb mit dem Inhalt wächst.
 * Eine Seite, die INNEN scrollen soll, muss ihre Höhe daher selbst kennen.
 */
const UNTERER_ABSTAND_PX = 24; // entspricht md:p-6 des Inhaltsbereichs

function useSchalenHoehe() {
  const ref = useRef<HTMLDivElement>(null);
  const [hoehe, setHoehe] = useState<number | null>(null);

  useEffect(() => {
    function messen() {
      const el = ref.current;
      if (!el) return;
      const oben = el.getBoundingClientRect().top;
      setHoehe(Math.max(320, window.innerHeight - oben - UNTERER_ABSTAND_PX));
    }
    messen();
    window.addEventListener("resize", messen);
    // Der Oberrand verschiebt sich auch ohne Fenster-Resize (ein Hinweisband
    // erscheint, die Topbar klappt um) — deshalb den Vorfahren beobachten.
    const beobachter = new ResizeObserver(messen);
    if (ref.current?.parentElement) beobachter.observe(ref.current.parentElement);
    return () => {
      window.removeEventListener("resize", messen);
      beobachter.disconnect();
    };
  }, []);

  return { ref, hoehe };
}

export function BaukastenSchale({
  reiter,
  texte,
  aktiverReiter,
  onReiter,
  vorNavigation,
  kopfLinks,
  kopfMitte,
  kopfAktionen,
  panelTitel,
  panelZurueckHref,
  onPanelZurueck,
  seitenleiste,
  inhalt,
  inspektor,
  grossPanel,
  grossPanelTitel,
  onGrossPanelZu,
  menueAktiv,
  menueBeschriften,
  onMenue,
  breit = false,
  panelBereiche,
}: {
  /** Die Bereiche mit ihrer ROUTE. Kein `onReiter`-Rückruf: ein Bereich ist
   *  eine Adresse, kein Zustand. Vorher stand der aktive Bereich in
   *  `?reiter=design`, womit ein Unterpunkt wie das Logo-Panel überhaupt keine
   *  Adresse hatte — man konnte niemandem einen Link darauf schicken, und der
   *  Zurück-Knopf sprang aus dem Baukasten heraus statt eine Ebene hoch. */
  reiter: Reiter[];
  /** Beschriftungen des Panel-Kopfes. Als Prop und nicht per `useTranslations`:
   *  die Schale ist ein Grundraster und soll ohne i18n-Kontext benutzbar
   *  bleiben (die Storybook-Geschichten rendern sie ohne Provider). */
  texte: SchalenTexte;
  /** Bereichs-Klick abfangen. Gibt `true` zurück, wenn die Seite den Bereich
   *  selbst zeigt — dann wird NICHT navigiert. */
  onReiter?: (id: string) => boolean;
  aktiverReiter: string;
  /** Läuft bei einem Bereichs-Klick, BEVOR die Navigation stattfindet. Der
   *  Abschnitts-Editor schreibt darin seinen offenen Stand weg — der Request
   *  überlebt die Soft-Navigation, ein Hard-Reload hätte den laufenden
   *  Entprellungs-Timer und damit die letzte Eingabe verworfen. */
  vorNavigation?: () => void;
  /** Linke Seite der Kopfzeile: Seitenwahl und Sprache. */
  kopfLinks?: ReactNode;
  /** MITTE der Kopfzeile — dort steht im Vorbild der Geräte-Umschalter, und nur
   *  er. Er ist keine Aktion (er ändert nichts an der Seite) und kein Kontext
   *  (er sagt nicht, WO man ist), sondern die Brille, durch die man schaut;
   *  deshalb hat er eine eigene Zone und wandert nicht mit der Breite der
   *  beiden anderen. Vorher hing er hinten an `kopfLinks` und sprang bei jedem
   *  längeren Seitentitel um mehrere Zentimeter. */
  kopfMitte?: ReactNode;
  kopfAktionen?: ReactNode;
  /** Überschrift im Panel-Kopf. Fehlt sie, hat das Panel keinen Kopf. */
  panelTitel?: string;
  /** Adresse EINE Ebene höher. Gesetzt = das Panel zeigt gerade eine
   *  Hostaway-Unterseite (Design → Text, → Farben, …) und der Kopf bekommt
   *  einen Zurück-Pfeil VOR dem Titel — `‹ TEXT` statt nur `TEXT`. Fehlt sie,
   *  ist das Panel auf seiner obersten Ebene und es gibt nichts, wohin der
   *  Pfeil führen könnte (0468). */
  panelZurueckHref?: string;
  /** Rückweg als Rückruf statt als Adresse — für den Editor, wo die
   *  Unterseite ein Panel-Zustand ist. Hat Vorrang vor `panelZurueckHref`. */
  onPanelZurueck?: () => void;
  /** Einstellungen links. Fehlt sie, füllt `inhalt` die ganze Breite. */
  seitenleiste?: ReactNode;
  inhalt: ReactNode;
  /** Der Inspektor RECHTS (Hostaway: das Design-Panel).
   *
   *  Er sitzt rechts und nicht links, und die Arbeitsfläche RÜCKT ZUSAMMEN,
   *  statt überdeckt zu werden — beides live abgelesen
   *  (`docs/HOSTAWAY-EDITOR-UI.md` §5). Bei uns lag der Inspektor bisher
   *  links im selben Panel wie die Liste, weshalb man beim Bearbeiten nicht
   *  mehr sah, WAS man bearbeitet. */
  inspektor?: ReactNode;
  /** Ein GROSSES Panel, das von LINKS über die Arbeitsfläche fährt und etwa
   *  drei Viertel der Breite einnimmt — im Vorbild das Blog-CMS
   *  (`docs/UI`, Foto 19.04.33).
   *
   *  Warum es keine weitere Spalte ist: eine Beitragsliste braucht Platz für
   *  Vorschaubild, Titel, Autor, Status und Datum nebeneinander. In den 20 rem
   *  des normalen Panels bliebe davon der Titel übrig, und aus dem CMS würde
   *  wieder die Liste, die es ersetzen soll.
   *
   *  Warum es die Fläche nicht ganz bedeckt: der Streifen Vorschau, der rechts
   *  stehen bleibt, ist die Erinnerung daran, dass man noch im Editor ist und
   *  wohin das Schließen zurückführt. Ein Vollbild-Übernehmer wäre eine zweite
   *  Anwendung, aus der man den Rückweg suchen muss. */
  grossPanel?: ReactNode;
  /** Überschrift im Kopf des Großpanels (versal, wie beim normalen Panel). */
  grossPanelTitel?: string;
  /** Wird beim ✕ und bei Escape gerufen. Ohne diesen Rückruf gäbe es keinen
   *  Weg heraus — deshalb wird das Großpanel ohne ihn gar nicht erst
   *  gezeigt. */
  onGrossPanelZu?: () => void;
  /** Gewählter Eintrag der Menüspalte. `null` = keiner. */
  menueAktiv?: string | null;
  /** Kennung → Beschriftung für die Menüspalte. Fehlt sie, gibt es keine
   *  Menüspalte — dann rückt das Panel direkt an die Leiste (wie bei „Ebenen"
   *  und „Design", die keine Unterpunkte haben). */
  menueBeschriften?: (id: string) => string;
  onMenue?: (id: string) => void;
  /** true = keine Vorschau, Inhalt über die volle Breite (wie „Einstellungen"). */
  breit?: boolean;
  /** Die Schale steht IM Editor, und das sind die Bereiche, die er als PANEL
   *  bedient (`onMenue` nimmt ihre Einträge an). NUR deren Einträge verlieren
   *  ihr `href` und wechseln das Panel statt zu navigieren (C4). Alle anderen
   *  — „Mehr" mit Objekte/Regeln/Anfragen/Widgets/Einstellungen — sind echte
   *  Routen und bleiben Links.
   *
   *  Bis 05.09.2026 war das ein Schalter `imEditor`, der JEDES `href` strich;
   *  der Editor-Handler kannte die „Mehr"-Ziele nicht, und der Klick fiel
   *  stumm ins Protokoll („das lässt sich nicht klicken"). Ein Schalter plus
   *  Liste mit Ersatzwert „alle" hätte denselben Fehler wieder zugelassen
   *  (Wurzel 4) — deshalb ist die Liste selbst der Schalter: ohne Liste
   *  navigiert jeder Eintrag. */
  panelBereiche?: readonly string[];
}) {
  const { ref, hoehe } = useSchalenHoehe();
  // Das Panel lässt sich zuklappen. Der Zustand lebt hier und nicht in der
  // Route: er ist eine Sicht-Einstellung für den Moment, kein Ort, auf den man
  // jemanden verlinkt.
  const [panelOffen, setPanelOffen] = useState(true);
  // Breites Panel: für Listen, die in 20 rem eng stehen (Bausteine, Ebenen).
  // Absichtlich NICHT gespeichert — es ist eine Handbewegung für den Moment,
  // keine Einstellung, die man später wiederfinden muss.
  const [panelBreit, setPanelBreit] = useState(false);
  // Der Inspektor lässt sich ebenfalls zuklappen; eingeklappt bleibt am rechten
  // Fensterrand ein Griff `‹` stehen. Genau so im Vorbild — ohne ihn wäre der
  // Inspektor weg und der Weg zurück nur durch erneutes Anklicken des schon
  // gewählten Bausteins zu erraten.
  const [inspektorOffen, setInspektorOffen] = useState(true);
  // Breiter Inspektor — für Bausteine mit vielen Feldern (Formular, Galerie).
  // Wie beim Panel absichtlich NICHT gespeichert: eine Handbewegung für den
  // Moment, keine Einstellung, die man später wiederfinden muss.
  const [inspektorBreit, setInspektorBreit] = useState(false);
  // Die Unterpunkte des AKTIVEN Bereichs. Sie stehen in `REITER_MENUE` und
  // nicht hier: die Zugehörigkeit ist eine Struktur-Entscheidung, keine
  // Darstellungsfrage.
  const roheEintraege = REITER_MENUE[aktiverReiter as ReiterId] ?? [];
  /** Die Einträge der Menüspalte — im Editor OHNE `href`.
   *
   *  Ein Eintrag ohne `href` wird nicht navigiert, sondern gemeldet
   *  (`menue-spalte.tsx`): dann wechselt nur das Panel und die Seite bleibt
   *  stehen. Genau das war C4 — die sieben Theme-Unterpunkte trugen alle ein
   *  `href`, und ein Klick auf „Farben" im Editor lud die ganze Seite auf
   *  `/website/design/farben` neu: Logo, Seitenwahl, Sprachwähler und der
   *  Abschnitts-Kontext weg, die Vorschau acht Sekunden lang leer.
   *
   *  Außerhalb des Editors bleiben die `href` — dort IST der Unterpunkt eine
   *  eigene Seite, und ein verschickbarer Link ist der Grund, warum die
   *  Reiter überhaupt Pfade sind. */
  const alsPanel = panelBereiche?.includes(aktiverReiter) ?? false;
  const menueEintraege = alsPanel
    ? roheEintraege.map((e) =>
        e.art === "gruppe"
          ? { ...e, kinder: e.kinder.map((k) => ({ ...k, href: undefined })) }
          : { ...e, href: undefined },
      )
    : roheEintraege;
  /** Gibt es Unterpunkte für die Menüspalte?
   *
   *  Sie hängt AUSSCHLIESSLICH daran — nicht mehr an `breit`. Das war C2:
   *  `breit` heißt „keine Vorschau, volle Breite", und weil beides an
   *  demselben Schalter hing, verschwand mit der Vorschau auch der Weg zu den
   *  Geschwister-Bereichen. */
  const hatMenue = Boolean(menueBeschriften) && menueEintraege.length > 0;
  // Die Reiter in ihre Gruppen einsortieren — Reihenfolge und Zugehörigkeit
  // stehen in `LEISTE_GRUPPEN`, nicht hier. Reiter, die dort nicht vorkommen
  // (eine neue Kennung, die jemand zu ergänzen vergaß), landen in einer letzten
  // Gruppe statt zu verschwinden: unsortiert ist besser als unsichtbar.
  const bekannt = new Set(LEISTE_GRUPPEN.flat() as string[]);
  const gruppen = [
    ...LEISTE_GRUPPEN.map((g) =>
      g.map((id) => reiter.find((r) => r.id === id)).filter(
        (r): r is Reiter => Boolean(r),
      ),
    ),
    reiter.filter((r) => !bekannt.has(r.id)),
  ].filter((g) => g.length > 0);

  return (
    // Der KI-Kontext sitzt HIER und nicht in `BaukastenRahmen`: der
    // Abschnitts-Editor (`AbschnittsEditor`) nutzt diese Schale direkt, ohne
    // den Rahmen dazwischen. Ein Provider dort oben hätte den Editor nicht
    // erreicht — genau die Oberfläche, in der der Texteditor-Assistent sitzt.
    <KiProvider>
      <div
        ref={ref}
        // Vor der ersten Messung eine Näherung, damit es beim ersten Bild nicht
        // springt; danach gilt der gemessene Wert.
        style={{ height: hoehe ?? "calc(100dvh - 7rem)" }}
        className="flex min-h-0 flex-col overflow-hidden rounded-(--radius) border border-border bg-background"
      >
        {/* Kopfzeile — DREI Zonen: Kontext links, Brille in der Mitte, Aktionen
            rechts. Die Mitte ist echt mittig und nicht „was nach links übrig
            bleibt": beide Außenzonen sind gleich breit gewichtet (`flex-1`),
            der Umschalter steht dazwischen. */}
        <div className="flex shrink-0 items-center gap-3 border-b border-border px-3 py-2">
          <div className="flex min-w-0 flex-1 items-center gap-2">
            {kopfLinks}
          </div>
          {kopfMitte ? (
            <div className="flex shrink-0 items-center">{kopfMitte}</div>
          ) : null}
          <div className="flex min-w-0 flex-1 items-center justify-end gap-1.5">
            {kopfAktionen}
          </div>
        </div>

        <div className="relative flex min-h-0 flex-1">
          {/* Senkrechte Bereichsleiste */}
          <nav
            aria-label={panelTitel}
            // `select-none`: die Leiste ist ein Werkzeug. Ohne das ließen sich
            // die Beschriftungen markieren, und ein Zug mit der Maus färbte
            // halbe Wörter blau.
            className="flex w-[3.75rem] shrink-0 select-none flex-col items-center gap-0.5 overflow-y-auto border-r border-border py-2"
          >
            {/* Gruppen mit WEISSRAUM dazwischen, keine Haarlinie: eine Linie
                zwischen zwei Symbolen liest sich als Abgrenzung, ein Abstand
                als Gruppierung. Eine Gruppe ohne Einträge erzeugt keinen
                Abstand — sonst klaffte eine Lücke über nichts. */}
            {gruppen.map((gruppe, gi) => (
              <div
                key={gruppe.map((r) => r.id).join("-")}
                className={
                  "flex w-full flex-col items-center gap-0.5 " +
                  (gi > 0 ? "mt-4" : "")
                }
              >
                {gruppe.map((r) => {
                  const aktiv = r.id === aktiverReiter;
                  // Jeder Eintrag navigiert — auch „Mehr". Seine sechs
                  // Bereiche stehen danach in der MENÜSPALTE daneben, die
                  // genau dafür da ist.
                  //
                  // Hier klappte bis eben eine Schublade auf. Das war der
                  // falsche Ort: die Menüspalte zeigt dieselben Einträge schon,
                  // also standen sie doppelt, und in der 3.75-rem-Leiste
                  // sprengten sechs zusätzliche Einträge die Höhe (Scrollbalken).
                  // Ein Untermenü-Muster im Produkt, nicht zwei.
                  return (
                    <Link
                      key={r.id}
                      href={r.href}
                      onClick={(e) => {
                        // Ein Bereich, den die Seite SELBST bedienen kann, wird
                        // hier abgefangen — dann wechselt nur das Panel und die
                        // Seite bleibt stehen.
                        //
                        // Das war der Fehler: wer im Abschnitts-Editor auf
                        // „Hinzufügen" klickte, landete auf einer anderen
                        // Route, mit ungespeicherten Eingaben im Rücken und
                        // ohne den Abschnitt, an dem er gerade arbeitete. Im
                        // Vorbild gibt es EINEN Editor; die Leiste wechselt das
                        // Panel, nicht die Seite.
                        if (onReiter?.(r.id)) {
                          e.preventDefault();
                          setPanelOffen(true);
                          return;
                        }
                        if (!aktiv) vorNavigation?.();
                        else setPanelOffen(true);
                      }}
                      aria-current={aktiv ? "page" : undefined}
                      title={r.label}
                      className="group/reiter flex w-full flex-col items-center gap-1 px-1 py-1.5 text-center text-muted-foreground transition hover:text-foreground"
                    >
                      {/* Aktiv = hellgraues abgerundetes Quadrat HINTER dem
                          Symbol. Keine Markenfarbe, kein Balken, keine
                          Fettschrift — im Vorbild ist die ganze Leiste
                          einfarbig, und der Zustand steckt allein in dieser
                          Fläche. */}
                      <span
                        className={
                          "flex size-8 items-center justify-center rounded-(--radius) transition " +
                          (aktiv
                            ? "bg-secondary text-foreground"
                            : "group-hover/reiter:bg-secondary/60")
                        }
                      >
                        <Icon icon={r.icon} className="size-5" />
                      </span>
                      {/* Die Beschriftung darf umbrechen statt abzuschneiden:
                          „Einstellungen" passt in 3.75rem nur zweizeilig, und
                          ein abgeschnittenes „Einstell…" nennt den Bereich
                          nicht. */}
                      <span
                        className={
                          "text-[0.625rem] leading-tight " +
                          (aktiv ? "text-foreground" : "")
                        }
                      >
                        {r.label}
                      </span>
                    </Link>
                  );
                })}
              </div>
            ))}
          </nav>

          {/* Arbeitsfläche */}
          {/* `breit` heißt „keine Vorschau, Inhalt über die volle Breite" — es
              hieß NICHT „keine Menüspalte". Bis 27.08.2026 stand beides an
              diesem einen Schalter, und damit war „Mehr" auf fünf von sechs
              Bereichen eine Sackgasse: die Leiste zeigte auf „Mehr", die
              versprochene Spalte mit den sechs Geschwistern fehlte, und die
              Leiste selbst hat für Regeln/Anfragen/Widgets/Vorlagen keine
              eigenen Einträge — es führte also kein sichtbarer Weg dorthin
              (Prüfbericht C2). Die Spalte hängt jetzt allein daran, ob es
              Unterpunkte GIBT. */}
          {hatMenue || seitenleiste ? (
            <div className="flex min-h-0 flex-1">
              {/* MENÜSPALTE — die Unterpunkte des aktiven Bereichs, zwischen
                  Leiste und Panel. Bereiche ohne Unterpunkte haben keine, dann
                  rückt das Panel an die Leiste (wie „Ebenen" und „Design"). */}
              {hatMenue ? (
                <MenueSpalte
                  titel={panelTitel ?? ""}
                  eintraege={menueEintraege}
                  aktiv={menueAktiv ?? null}
                  beschriften={menueBeschriften!}
                  onWaehle={(id) => onMenue?.(id)}
                  vorNavigation={vorNavigation}
                />
              ) : null}
              {/* Das PANEL nur, wenn es eines gibt. Eine Route wie
                  `/website/objekte` bringt ihren ganzen Inhalt in `inhalt`
                  und gar keine `seitenleiste` — ein Panel dafür zu zeichnen
                  wäre eine leere Spalte neben dem Inhalt. */}
              {seitenleiste && panelOffen ? (
                <aside
                  className={
                    "flex shrink-0 flex-col border-r border-border " +
                    (panelBreit ? "w-[28rem]" : "w-80")
                  }
                >
                  {panelTitel ? (
                    // Panel-Kopf, Reihenfolge wie im Vorbild:
                    //
                    //     [‹]  TITEL                        ▣  ✕
                    //
                    // Titel klein und versal in Grau, rechts Breite und
                    // Schließen. GENAU EIN Knopf je Zielzustand: `▣` schaltet
                    // die Breite, `✕` klappt zu, und der `‹` davor führt eine
                    // Ebene hoch — er erscheint nur, wenn es diese Ebene gibt.
                    //
                    // Das Vorbild trägt links zusätzlich ein `«`, das auf die
                    // Menüspalte zurückklappt. Bei uns steht die Menüspalte
                    // ohnehin dauerhaft daneben, also hätte dieser Knopf kein
                    // Ziel — und ein zweiter Knopf, der dasselbe tut wie das
                    // `✕`, ist keine Treue zum Vorbild, sondern eine Attrappe.
                    //
                    // Auf einer Unterseite (`panelZurueckHref`) tritt der
                    // Zurück-Pfeil vor den Titel: `‹ TEXT ▣ ✕`. Das ist
                    // dieselbe Zeile, keine zweite darunter — vorher stand der
                    // Rückweg als eigener Link IM Inhalt unter dem immer
                    // gleichen Kopf „DESIGN", also zwei Überschriften für einen
                    // Ort (0468).
                    <div className="flex shrink-0 items-center gap-1 border-b border-border px-2 py-2.5">
                      {/* Im Editor ist der Rückweg ein KNOPF, keine Adresse:
                          dort ist die Unterseite ein Panel-Zustand, und ein
                          Link würde die ganze Seite samt Vorschau neu laden —
                          genau das, was C4 abgeschafft hat. */}
                      {onPanelZurueck ? (
                        <button
                          type="button"
                          onClick={onPanelZurueck}
                          aria-label={texte.panelZurueck}
                          title={texte.panelZurueck}
                          className="shrink-0 rounded-(--radius) p-1 text-muted-foreground transition hover:bg-secondary hover:text-foreground"
                        >
                          <Icon icon="ph:caret-left" className="size-4" />
                        </button>
                      ) : panelZurueckHref ? (
                        <Link
                          href={panelZurueckHref}
                          aria-label={texte.panelZurueck}
                          title={texte.panelZurueck}
                          className="shrink-0 rounded-(--radius) p-1 text-muted-foreground transition hover:bg-secondary hover:text-foreground"
                        >
                          <Icon icon="ph:caret-left" className="size-4" />
                        </Link>
                      ) : null}
                      <h2 className="min-w-0 flex-1 truncate text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        {panelTitel}
                      </h2>
                      <button
                        type="button"
                        onClick={() => setPanelBreit((b) => !b)}
                        aria-pressed={panelBreit}
                        aria-label={texte.panelBreite}
                        title={texte.panelBreite}
                        className={
                          "shrink-0 rounded-(--radius) p-1 transition hover:bg-secondary " +
                          (panelBreit
                            ? "text-foreground"
                            : "text-muted-foreground hover:text-foreground")
                        }
                      >
                        <Icon icon="ph:square-split-horizontal" className="size-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setPanelOffen(false)}
                        aria-label={texte.panelEinklappen}
                        title={texte.panelEinklappen}
                        className="shrink-0 rounded-(--radius) p-1 text-muted-foreground transition hover:bg-secondary hover:text-foreground"
                      >
                        <Icon icon="ph:x" className="size-4" />
                      </button>
                    </div>
                  ) : null}
                  <div className="min-h-0 flex-1 overflow-y-auto">
                    {seitenleiste}
                  </div>
                </aside>
              ) : seitenleiste ? (
                // Zugeklappt bleibt ein schmaler Griff stehen. Ohne ihn wäre das
                // Panel weg und der Weg zurück nur über einen erneuten Klick auf
                // den schon aktiven Bereich zu erraten.
                <button
                  type="button"
                  onClick={() => setPanelOffen(true)}
                  aria-label={texte.panelAusklappen}
                  title={texte.panelAusklappen}
                  className="flex w-6 shrink-0 items-center justify-center border-r border-border text-muted-foreground transition hover:bg-secondary hover:text-foreground"
                >
                  <Icon icon="ph:caret-right" className="size-4" />
                </button>
              ) : null}
              {/* `overflow-hidden` gilt für die VORSCHAU (sie scrollt in
                  ihrem iframe). Eine `breit`-Route bringt hier ihre eigene
                  lange Liste — die braucht den Scroll an dieser Stelle, sonst
                  ist ihr unteres Ende unerreichbar. */}
              <div
                className={`min-w-0 flex-1 bg-secondary/20 ${
                  breit ? "overflow-y-auto" : "overflow-hidden"
                }`}
              >
                {inhalt}
              </div>
              {/* Der Inspektor rechts. Er ist eine eigene SPALTE, kein Overlay:
                  die Fläche daneben wird schmaler, das Element bleibt sichtbar.
                  Eingeklappt bleibt der Griff `‹` am Fensterrand — genau wie im
                  Vorbild. */}
              {inspektor ? (
                inspektorOffen ? (
                  <aside
                    className={
                      "flex shrink-0 flex-col overflow-hidden border-l border-border " +
                      (inspektorBreit ? "w-[26rem]" : "w-80")
                    }
                  >
                    {/* Die Kopfzeile des Inspektors gehört zur SCHALE und nicht
                        zu seinem Inhalt: Einklappen und Hilfe sind an jedem
                        Inspektor dieselben Handgriffe, und ihr Ort darf nicht
                        davon abhängen, welcher Baustein gerade gewählt ist. */}
                    <div className="flex shrink-0 items-center gap-1 px-2 py-2">
                      <button
                        type="button"
                        onClick={() => setInspektorBreit((b) => !b)}
                        aria-pressed={inspektorBreit}
                        aria-label={texte.panelBreite}
                        title={texte.panelBreite}
                        className={
                          "shrink-0 rounded-(--radius) p-1 transition hover:bg-secondary " +
                          (inspektorBreit
                            ? "text-foreground"
                            : "text-muted-foreground hover:text-foreground")
                        }
                      >
                        <Icon icon="ph:square-split-horizontal" className="size-4" />
                      </button>
                      <span className="flex-1" />
                      <button
                        type="button"
                        onClick={() => setInspektorOffen(false)}
                        aria-label={texte.panelEinklappen}
                        title={texte.panelEinklappen}
                        className="shrink-0 rounded-(--radius) p-1 text-muted-foreground transition hover:bg-secondary hover:text-foreground"
                      >
                        <Icon icon="ph:x" className="size-4" />
                      </button>
                    </div>
                    <div className="min-h-0 flex-1 overflow-y-auto">
                      {inspektor}
                    </div>
                  </aside>
                ) : (
                  <button
                    type="button"
                    onClick={() => setInspektorOffen(true)}
                    aria-label={texte.panelAusklappen}
                    title={texte.panelAusklappen}
                    className="flex w-6 shrink-0 items-center justify-center border-l border-border text-muted-foreground transition hover:bg-secondary hover:text-foreground"
                  >
                    <Icon icon="ph:caret-left" className="size-4" />
                  </button>
                )
              ) : null}
            </div>
          ) : (
            // Weder Menüspalte noch Panel: der Inhalt allein über die volle
            // Breite (z. B. `/website/regeln`).
            <div className="min-h-0 flex-1 overflow-y-auto">{inhalt}</div>
          )}

          {/* DAS GROSSPANEL — fährt von links ein und bedeckt drei Viertel.
              Es liegt ÜBER Menüspalte, Panel und Fläche, aber NICHT über der
              Leiste: die bleibt bedienbar, sonst wäre der Bereichswechsel von
              hier aus verstellt. */}
          {grossPanel && onGrossPanelZu ? (
            <GrossPanel titel={grossPanelTitel} onZu={onGrossPanelZu} texte={texte}>
              {grossPanel}
            </GrossPanel>
          ) : null}
        </div>
      </div>
    </KiProvider>
  );
}

/**
 * Das eingeschobene Großpanel.
 *
 * Es fährt beim Öffnen von links herein statt einfach dazustehen. Das ist keine
 * Verzierung: die Bewegung sagt, WOHER es kommt und wohin es beim Schließen
 * zurückgeht — nämlich hinter die Leiste, aus der man es geöffnet hat. Ein
 * Panel, das ohne Übergang erscheint, sieht aus wie ein Seitenwechsel, und
 * danach sucht man den Zurück-Knopf des Browsers.
 *
 * `useEffect` statt einer Startklasse im Markup: React setzt beide Klassen im
 * selben Bild, wenn sie im selben Render stehen, und der Browser überspringt
 * den Übergang. Erst ein zweites Bild lässt ihn laufen.
 */
export function GrossPanel({
  titel,
  onZu,
  texte,
  children,
}: {
  titel?: string;
  onZu: () => void;
  texte: SchalenTexte;
  children: ReactNode;
}) {
  const [drin, setDrin] = useState(false);

  // Einfahren, sobald das erste Bild stand.
  //
  // ZU D7 (Nachprüfung 27.08.2026): Kommt man über die Route `/website/blog`
  // — ein echter Dokumentwechsel, der in den Editor umleitet —, steht beim
  // ersten Frame das Raster noch nicht, und das Panel sitzt für 1–2 Sekunden
  // bei x = 0 statt an der Kante der Bereichsleiste. Sein Titel und die erste
  // Spalte stehen dabei links außerhalb des Bildes.
  //
  // Das ist NICHT hier zu beheben, und ein Versuch hat es schlimmer gemacht:
  // eine Bedingung, die auf das fertige Raster wartet und das Panel bis dahin
  // `invisible` hält, hat bei einer falsch gerechneten Schwelle das komplette
  // Blog-CMS dauerhaft versteckt. Ein Panel, das seinen Inhalt verbirgt, wenn
  // eine Messung nicht aufgeht, ist schlechter als eines, das kurz an der
  // falschen Stelle steht — der Fehlerfall ist „Funktion weg" statt
  // „Funktion sieht eine Sekunde schief aus".
  //
  // Die eigentliche Wurzel ist die UMLEITUNG: `/website/blog` lädt das
  // Dokument neu, statt das Panel im stehenden Editor zu öffnen. Wer sie
  // schließen will, muss dort ansetzen, nicht am Einfahren.
  useEffect(() => {
    const bild = requestAnimationFrame(() => setDrin(true));
    return () => cancelAnimationFrame(bild);
  }, []);

  useEffect(() => {
    function aufTaste(e: KeyboardEvent) {
      if (e.key === "Escape") onZu();
    }
    window.addEventListener("keydown", aufTaste);
    return () => window.removeEventListener("keydown", aufTaste);
  }, [onZu]);

  return (
    <div
      // `left-[3.75rem]` ist die Breite der Leiste — das Panel beginnt genau an
      // ihrer Kante.
      //
      // Es füllt den Rest der Fläche und ist nicht mehr `w-3/4` (0480). Grund:
      // die Beitragstabelle ist ein Arbeitsblatt mit angehefteter Titelspalte
      // und sieben weiteren. Bei drei Vierteln der Breite blieb rechts ein
      // Streifen Seitenvorschau stehen, den in diesem Moment niemand ansieht —
      // und die Tabelle musste in den Rest. Der Streifen war die Erinnerung
      // daran, dass die Seite dahinter stehen bleibt; das tut sie weiterhin,
      // man sieht sie nur erst beim Schließen wieder.
      className={
        "absolute inset-y-0 left-[3.75rem] right-0 z-30 flex flex-col border-r border-border bg-background shadow-2xl transition-transform duration-200 ease-out " +
        (drin ? "translate-x-0" : "-translate-x-full")
      }
    >
      <div className="flex shrink-0 items-center gap-1 border-b border-border px-4 py-3">
        <h2 className="min-w-0 flex-1 truncate text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {titel}
        </h2>
        {/* Im Foto stehen ZWEI Zeichen im Kopf: `?` und `✕`. Das Fragezeichen
            ist kein Zierrat — es ist der Weg in die Hilfe genau zu dem, was
            gerade offen ist. */}
        <a
          // Marketing-App, nicht diese hier — "/hilfe" waere ein 404.
          href={HILFE_URL}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={texte.panelHilfe}
          title={texte.panelHilfe}
          className="shrink-0 rounded-(--radius) p-1 text-muted-foreground transition hover:bg-secondary hover:text-foreground"
        >
          <Icon icon="ph:question" className="size-4" />
        </a>
        <button
          type="button"
          onClick={onZu}
          aria-label={texte.panelEinklappen}
          title={texte.panelEinklappen}
          className="shrink-0 rounded-(--radius) p-1 text-muted-foreground transition hover:bg-secondary hover:text-foreground"
        >
          <Icon icon="ph:x" className="size-4" />
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-hidden">{children}</div>
    </div>
  );
}


/** Abschnittstitel in der Einstellungsspalte. Fett, klein, mit Abstand darüber —
 *  die einzige Gliederungsebene, die es dort gibt. */
export function LeisteTitel({ children }: { children: ReactNode }) {
  return (
    <h3 className="px-4 pb-2 pt-5 font-display text-sm font-extrabold">
      {children}
    </h3>
  );
}

/** Zeile in der Einstellungsspalte: Beschriftung links, Bedienelement rechts.
 *  Das ist die Grundform für Farbrollen und Schalter. */
export function LeisteZeile({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3 px-4 py-2">
      <span className="min-w-0 truncate text-sm">{label}</span>
      <div className="flex shrink-0 items-center">{children}</div>
    </div>
  );
}

/** Zeile, die zu einer Unterseite führt (wie „Logo →"). */
export function LeisteVerweis({
  label,
  href,
  onKlick,
}: {
  label: string;
  /** Ziel, wenn der Verweis navigieren SOLL (eigener Reiter). */
  href?: string;
  /** Wird stattdessen gerufen, wenn die Unterseite im selben Panel geöffnet
   *  wird (im Editor). Dann darf NICHT navigiert werden: ein Seitenwechsel
   *  lädt den iframe neu, holt einen neuen Entwurfs-Token und verwirft die
   *  Auswahl — genau das war die Beschwerde. */
  onKlick?: () => void;
}) {
  const inhalt = (
    <>
      {label}
      <Icon icon="ph:caret-right" className="size-4 text-muted-foreground" />
    </>
  );
  const klasse =
    "flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left text-sm font-medium transition hover:bg-secondary/60";
  if (onKlick) {
    return (
      <button type="button" onClick={onKlick} className={klasse}>
        {inhalt}
      </button>
    );
  }
  return (
    <Link href={href ?? "#"} className={klasse}>
      {inhalt}
    </Link>
  );
}

/** Kopf einer Unterseite der Einstellungsspalte (Zurück-Pfeil + Titel).
 *
 *  Zwei Rückwege, weil es zwei Arten von Unterseite gibt und sie sich echt
 *  unterscheiden:
 *
 *  • `zurueckHref` — die Unterseite hat eine eigene ADRESSE (Design → Logo,
 *    `/website/design/logo`). Der Rückweg ist eine Navigation, also ein Link:
 *    Mittelklick, „in neuem Tab öffnen" und der Zurück-Knopf funktionieren.
 *
 *  • `onZurueck` — die Unterseite ist ein Auswahl-Zustand OHNE Adresse (der
 *    Abschnitts-Inspektor: welcher Abschnitt gerade bearbeitet wird). Dafür
 *    wäre ein Link eine Lüge, denn es gibt keine Seite, auf die er führt.
 *
 *  Der Union-Typ erzwingt genau eines von beiden — nicht keines und nicht
 *  beides, sonst wäre unklar, was der Pfeil tut. */
export function LeisteUnterseite({
  titel,
  children,
  ...rest
}: {
  titel: string;
  children: ReactNode;
} & ({ zurueckHref: string; onZurueck?: never } | { onZurueck: () => void; zurueckHref?: never })) {
  const klasse =
    "flex items-center gap-2 px-4 pt-4 text-sm font-medium text-muted-foreground transition hover:text-foreground";
  return (
    <div className="flex flex-col">
      {rest.zurueckHref ? (
        <Link href={rest.zurueckHref} className={klasse}>
          <Icon icon="ph:arrow-left" className="size-4" />
          {titel}
        </Link>
      ) : (
        <button type="button" onClick={rest.onZurueck} className={klasse}>
          <Icon icon="ph:arrow-left" className="size-4" />
          {titel}
        </button>
      )}
      {children}
    </div>
  );
}

/** Anzeige des Autospeicher-Zustands. Kein Knopf — nur die Wahrheit darüber,
 *  was mit den Eingaben passiert ist.
 *
 *  Die Texte kommen von außen: eine Anzeige-Komponente soll keine Übersetzung
 *  selbst ziehen, sonst hängt sie am Namespace ihres Aufrufers. */
export function SpeicherAnzeige({
  stand,
  texte,
}: {
  stand: SpeicherStand;
  texte: { speichert: string; gespeichert: string; fehler: string };
}) {
  if (stand === "ruht") return null;
  return (
    <span
      data-stand={stand}
      className={
        "text-sm " +
        (stand === "fehler" ? "text-destructive" : "text-muted-foreground")
      }
    >
      {stand === "speichert"
        ? texte.speichert
        : stand === "gespeichert"
          ? texte.gespeichert
          : texte.fehler}
    </span>
  );
}
