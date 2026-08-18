"use client";

// Die geführte Vorführung (0409).
//
// Warum es sie braucht: Ein Besucher, der in einem fremden PMS landet, sieht
// zwölf Menüpunkte und weiß nicht, was davon seine Arbeit ist. Ohne Führung
// klickt er zwei Seiten an und geht wieder. Die Führung erzählt in neun
// Schritten die Reihenfolge, in der ein Betrieb tatsächlich arbeitet:
// Übersicht → Belegung → Nachrichten → Buchungen → Objekte → Preise →
// Portale → Vertrieb → eigener Zugang.
//
// Warum Sprechblasen am Element und kein Video: der Besucher soll IN der
// Anwendung sein, nicht daneben. Er kann jederzeit abbrechen und selbst
// weiterklicken — das ist der Unterschied zu einer Aufzeichnung und der Grund,
// warum wir die echte Anwendung zeigen und keinen Schnappschuss.
//
// Die Führung ÖFFNET die Seiten. Eine Vorführung, die nur auf Menüpunkte
// zeigt, zeigt das Menü — nicht das Produkt: der Besucher liest, dass es einen
// Belegungsplan gibt, sieht ihn aber nie. Jeder Schritt mit `pfad` navigiert
// deshalb dorthin, bevor seine Sprechblase erscheint.
//
// Zwei Schritte navigieren NICHT: „Preise" und „Portale" liegen in Bereichen,
// die die Vorführung sperrt (`lib/demo-sperre`, Backend-Riegel `demo_gate`).
// Dorthin zu springen brächte eine Fehlerseite mitten in der Führung. Sie
// erklären am Menüpunkt und sagen, dass er im eigenen Betrieb offen ist.
import { Icon } from "@iconify/react";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

// Abgeschlossen/abgebrochen wird lokal vermerkt. Kein Server-Zustand: alle
// Besucher teilen denselben Demo-Nutzer, ein serverseitiges "gesehen" hätte
// die Führung nach dem ersten Besucher für alle abgeschaltet.
export const SCHLUESSEL = "nd_demo_fuehrung_v1";

// Der LAUFENDE Schritt, ebenfalls lokal. Nötig, weil die Führung Seiten öffnet:
// bei jedem Routenwechsel baut React diese Komponente neu auf, und ein Zustand
// im Speicher wäre dabei weg — die Führung brach nach dem ersten „Weiter" ab
// und liess sich auch nicht neu starten, weil der Neustart-Klick sofort
// navigierte und sich damit selbst zuruecksetzte.
export const LAUF = "nd_demo_fuehrung_schritt";

type Schritt = {
  /** `data-tour`-Wert des Elements, an dem die Blase hängt. Fehlt es, wird der
   *  Schritt mittig gezeigt statt übersprungen — ein stiller Sprung wäre für
   *  den Besucher ein Loch in der Zählung. */
  ziel?: string;
  /** Seite, die dieser Schritt öffnet. Fehlt sie, bleibt die Führung stehen —
   *  entweder weil der Schritt nichts zu zeigen hat (Begrüßung, Schluss) oder
   *  weil der Bereich in der Vorführung gesperrt ist. */
  pfad?: string;
  titel: string;
  text: string;
};

const SCHRITTE: readonly Schritt[] = [
  {
    titel: "Willkommen in der Vorführung",
    text:
      "Sie sehen einen echten Ferienvermieter mit acht Objekten und einem " +
      "Jahr Buchungen — dieselbe Anwendung, die unsere Kunden benutzen. " +
      "Ansehen können Sie alles, gespeichert wird nichts. Neun kurze Schritte.",
  },
  {
    ziel: "dashboard",
    pfad: "/",
    titel: "Die Übersicht",
    text:
      "Anreisen und Abreisen des Tages, offene Freigaben, anstehende " +
      "Reservierungen. Der Blick, mit dem der Tag anfängt.",
  },
  {
    ziel: "calendar",
    pfad: "/kalender",
    titel: "Der Belegungsplan",
    text:
      "Alle Objekte in einer Zeitachse: wer kommt, wer bleibt, wo ist frei. " +
      "Preise und Mindestaufenthalte stehen in derselben Zelle — gepflegt " +
      "wird dort, wo man es sieht.",
  },
  {
    ziel: "inbox",
    pfad: "/posteingang",
    titel: "Ein Posteingang für alle Portale",
    text:
      "Booking.com, Airbnb und der eigene Marktplatz laufen in EINEN " +
      "Verlauf. Keine sechs Anmeldungen, keine Frage, die zwei Tage liegt.",
  },
  {
    ziel: "bookings",
    pfad: "/reservierungen",
    titel: "Buchungen",
    text:
      "Jede Reservierung mit Gast, Zahlungen, Zusatzleistungen und ihrer " +
      "vollständigen Zeitleiste — von der Anfrage bis zur Abreise.",
  },
  {
    ziel: "properties",
    pfad: "/objekte",
    titel: "Objekte und Einheiten",
    text:
      "Ein Objekt ist ein Typ mit einer oder mehreren gleichen Einheiten — " +
      "so, wie die Portale es erwarten. Fotos, Ausstattung und Texte an " +
      "einer Stelle, für alle Kanäle.",
  },
  {
    // `dynamicPricing` und nicht ein Preis-Menuepunkt: die Preispflege liegt
    // unter den Objekten, in der Sidebar sichtbar ist nur die dynamische
    // Steuerung. Der Schritt zeigt dorthin, wo der Besucher etwas findet.
    ziel: "dynamicPricing",
    titel: "Preise, die sich selbst nachziehen",
    text:
      "Saisons, Wochenendaufschläge und Rabatte nach Aufenthaltsdauer liegen " +
      "am Objekt; die dynamische Steuerung passt Tagespreise nach Auslastung " +
      "und Vorlauf an. Was hier steht, geht an alle Portale. In der Vorführung " +
      "ist dieser Bereich zu — im eigenen Betrieb steht er offen.",
  },
  {
    ziel: "channelManager",
    titel: "Die Portale",
    text:
      "Verfügbarkeit, Preise und Restriktionen gehen an Booking.com, Airbnb, " +
      "Expedia und die übrigen. Eine Sperre hier sperrt überall — " +
      "Doppelbuchungen entstehen genau dort, wo das nicht so ist. Auch dieser " +
      "Bereich bleibt in der Vorführung geschlossen.",
  },
  {
    // Zurueck auf die Uebersicht: der Besucher soll die Fuehrung dort verlassen,
    // wo er sie begonnen hat, und nicht auf der letzten Unterseite stehen.
    pfad: "/",
    titel: "Das war die Runde",
    text:
      "Schauen Sie sich in Ruhe weiter um — Sie können nichts kaputt machen. " +
      "Wenn Sie das für Ihren Betrieb wollen: Zugang vormerken, wir melden " +
      "uns zum Start.",
  },
];

/** Laufenden Schritt lesen; `null`, wenn keine Führung aktiv ist.
 *
 * Ein Wert ausserhalb der Liste wird verworfen statt gezeigt: nach einer
 * Änderung an den Schritten läge im Browser eines wiederkehrenden Besuchers
 * sonst eine Nummer, die es nicht mehr gibt — die Blase wäre leer.
 */
function laufLesen(): number | null {
  const wert = window.localStorage.getItem(LAUF);
  if (wert === null) return null;
  const nr = Number.parseInt(wert, 10);
  if (Number.isNaN(nr) || nr < 0 || nr >= SCHRITTE.length) return null;
  return nr;
}

/** Den Fuehrungs-Zustand loeschen, damit sie beim naechsten Aufruf neu startet.
 *
 * Fuer den Einstieg ueber `/demo`: wer von der Marketing-Seite auf „Demo
 * ansehen" klickt, beginnt einen NEUEN Besuch — die Marke aus einem frueheren
 * Durchlauf darf den Start dann nicht verhindern. Ohne dieses Zuruecksetzen
 * sah ein wiederkehrender Besucher die Fuehrung nie wieder, obwohl er
 * ausdruecklich neu eingestiegen ist.
 */
export function fuehrungZuruecksetzen(): void {
  window.localStorage.removeItem(SCHLUESSEL);
  window.localStorage.removeItem(LAUF);
}

type Kasten = { top: number; left: number; width: number; height: number };

export function DemoFuehrung({ voranmeldungUrl }: { voranmeldungUrl: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const [offen, setOffen] = useState(false);
  const [nr, setNr] = useState(0);
  const [kasten, setKasten] = useState<Kasten | null>(null);

  // Fortsetzen oder erstmals starten. `useEffect` statt Rendern-mit-
  // localStorage: der Wert existiert auf dem Server nicht, und ein Zugriff im
  // Render bräche die Hydration.
  //
  // Der Fortsetz-Zweig deckt den Fall ab, dass ein Seitenwechsel diese
  // Komponente neu montiert — dann ist der Zustand im Speicher weg, und ohne
  // ihn wäre die Führung nach dem ersten „Weiter" beendet und liesse sich auch
  // nicht neu starten (der Neustart-Klick navigierte und setzte sich selbst
  // zurück). Bleibt die Komponente montiert, trägt der State ohnehin.
  useEffect(() => {
    const lauf = laufLesen();
    if (lauf !== null) {
      setNr(lauf);
      setOffen(true);
      return;
    }
    if (window.localStorage.getItem(SCHLUESSEL)) return;
    // Kleine Verzögerung beim ERSTEN Aufruf: die Sidebar muss gerendert sein,
    // sonst findet der erste Schritt sein Ziel nicht und die Blase springt
    // sichtbar nach. Beim Fortsetzen entfällt sie — dort steht das Layout schon.
    const t = window.setTimeout(() => {
      window.localStorage.setItem(LAUF, "0");
      setOffen(true);
    }, 900);
    return () => window.clearTimeout(t);
  }, []);

  // Die Seite des Schritts öffnen. `router.push` und kein `<Link>`: der
  // Wechsel gehört zum Weiter-Klick, nicht zu einem eigenen Bedienelement.
  //
  // Nur wenn der Pfad wirklich abweicht — ein `push` auf die Seite, auf der man
  // schon steht, setzt bei Next.js den Scroll zurück und ließe die Blase
  // sichtbar hüpfen.
  useEffect(() => {
    if (!offen) return;
    const pfad = SCHRITTE[nr]?.pfad;
    if (pfad && pfad !== pathname) router.push(pfad);
  }, [offen, nr, pathname, router]);

  // Position des aktuellen Ziels messen — bei jedem Schritt, nach jedem
  // Seitenwechsel, bei Größenänderung und beim Scrollen.
  const messen = useCallback(() => {
    const ziel = SCHRITTE[nr]?.ziel;
    if (!ziel) {
      setKasten(null);
      return;
    }
    const el = document.querySelector(`[data-tour="${ziel}"]`);
    if (!el) {
      setKasten(null);
      return;
    }
    const r = el.getBoundingClientRect();
    setKasten({ top: r.top, left: r.left, width: r.width, height: r.height });
  }, [nr]);

  // `pathname` in den Abhängigkeiten: nach einer Navigation baut sich das
  // Layout neu auf, und ohne erneutes Messen stünde die Blase an der Position
  // der alten Seite.
  useEffect(() => {
    if (!offen) return;
    messen();
    // Zweiter Versuch nach kurzer Frist: die neue Seite rendert asynchron, und
    // die erste Messung trifft mitunter noch das Layout von davor. Billiger und
    // robuster als auf ein Fertig-Signal von Next.js zu warten, das es für
    // Client-Navigation nicht gibt.
    const nachmessen = window.setTimeout(messen, 350);
    window.addEventListener("resize", messen);
    window.addEventListener("scroll", messen, true);
    return () => {
      window.clearTimeout(nachmessen);
      window.removeEventListener("resize", messen);
      window.removeEventListener("scroll", messen, true);
    };
  }, [offen, messen, pathname]);

  /** Schritt wechseln — Zustand mitschreiben, damit er die Navigation übersteht. */
  const gehe = useCallback((ziel: number) => {
    setNr(ziel);
    window.localStorage.setItem(LAUF, String(ziel));
  }, []);

  const beenden = useCallback(() => {
    setOffen(false);
    setNr(0);
    // Beide Marken: `LAUF` beendet den Durchlauf, `SCHLUESSEL` verhindert den
    // automatischen Neustart beim nächsten Seitenaufruf.
    window.localStorage.removeItem(LAUF);
    window.localStorage.setItem(SCHLUESSEL, "1");
  }, []);

  // Escape beendet — eine Führung, die man nicht loswird, ist eine Falle.
  useEffect(() => {
    if (!offen) return;
    const beiTaste = (e: KeyboardEvent) => {
      if (e.key === "Escape") beenden();
    };
    window.addEventListener("keydown", beiTaste);
    return () => window.removeEventListener("keydown", beiTaste);
  }, [offen, beenden]);

  if (!offen) {
    return (
      <button
        type="button"
        onClick={() => {
          window.localStorage.setItem(LAUF, "0");
          setNr(0);
          setOffen(true);
        }}
        className="inline-flex items-center gap-1.5 font-semibold underline underline-offset-4"
      >
        <Icon icon="ph:play-circle" className="size-4" aria-hidden="true" />
        Führung starten
      </button>
    );
  }

  const schritt = SCHRITTE[nr];
  const letzter = nr === SCHRITTE.length - 1;

  return (
    <>
      {/* Abdunkelung. `pointer-events-none` auf dem Loch-Rahmen wäre aufwendig;
          stattdessen schließt ein Klick daneben die Führung — dasselbe
          Verhalten, das Besucher von Dialogen kennen. */}
      <div
        onClick={beenden}
        className="fixed inset-0 z-40 bg-black/50"
        aria-hidden="true"
      />

      {/* Der Rahmen um das erklärte Element. Nur ein Rahmen, kein Ausschnitt:
          das Element bleibt sichtbar, weil die Abdunkelung halbtransparent
          ist — ein echter Ausschnitt (clip-path) bricht bei jedem Layout-Wechsel
          an einer anderen Stelle. */}
      {kasten && (
        <div
          aria-hidden="true"
          style={{
            top: kasten.top - 4,
            left: kasten.left - 4,
            width: kasten.width + 8,
            height: kasten.height + 8,
          }}
          className="pointer-events-none fixed z-40 rounded-(--radius) ring-2 ring-sky-400 ring-offset-2 ring-offset-transparent"
        />
      )}

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="fuehrung-titel"
        // Neben dem Ziel, wenn eines gemessen wurde — sonst mittig. Der
        // Deckel bei 78 % Fensterhöhe hält die Blase im Bild, wenn das Ziel
        // weit unten in der Sidebar steht.
        style={
          kasten
            ? {
                top: Math.min(kasten.top, window.innerHeight * 0.78),
                left: kasten.left + kasten.width + 16,
              }
            : undefined
        }
        className={
          "fixed z-50 w-[min(22rem,calc(100vw-2rem))] rounded-2xl border border-border bg-card p-5 shadow-2xl " +
          (kasten ? "" : "top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2")
        }
      >
        <button
          type="button"
          onClick={beenden}
          aria-label="Führung beenden"
          className="absolute top-3 right-3 rounded-full p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <Icon icon="ph:x" className="size-4" />
        </button>

        <h2 id="fuehrung-titel" className="font-display text-lg font-bold">
          {schritt.titel}
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">{schritt.text}</p>

        <div className="mt-5 flex items-center gap-3">
          {nr > 0 && (
            <button
              type="button"
              onClick={() => gehe(nr - 1)}
              aria-label="Vorheriger Schritt"
              className="rounded-full p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <Icon icon="ph:arrow-left" className="size-4" />
            </button>
          )}

          {letzter ? (
            // IM SELBEN Tab zurueck auf die Marketing-Seite. Vorher stand hier
            // `target="_blank"`: der Besucher blieb in der Vorfuehrung stehen und
            // bekam die Voranmeldung in einem zweiten Tab — zwei offene Fenster,
            // und der Weg nach vorn lag im hinteren. Am ENDE der Fuehrung ist die
            // Vorfuehrung erledigt; hier gehoert der Besucher zurueck dorthin, wo
            // er sich vormerken kann.
            <a
              href={voranmeldungUrl}
              onClick={beenden}
              className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
            >
              Zugang vormerken
            </a>
          ) : (
            <button
              type="button"
              onClick={() => gehe(nr + 1)}
              className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
            >
              Weiter
            </button>
          )}

          <span className="ml-auto text-xs text-muted-foreground">
            {nr + 1}/{SCHRITTE.length}
          </span>
        </div>
      </div>
    </>
  );
}
