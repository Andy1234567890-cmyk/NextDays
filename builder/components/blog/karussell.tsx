"use client";

// Das BILDKARUSSELL eines Beitrags (0483).
//
// WARUM ES DIESE DATEI GIBT
// =========================
// Vorher war das Karussell ein Streifen mit `overflow-x-auto` und
// `snap-mandatory` — ohne eine einzige Bedienung. Auf einem Telefon wischt man
// darüber, am Rechner mit Maus gibt es KEINEN Weg: keine Pfeile, keine Punkte,
// und die Bildlaufleiste war ausgeblendet. Gemessen am 28.08.2026: der
// Rahmen war 912 px breit bei 1 690 px Inhalt, `scrollLeft` liess sich per
// Skript setzen — und `parentElement.querySelectorAll('button').length` war
// **0**. Genau so wurde es gemeldet: „niergends geht das karousell".
//
// Ein Karussell ohne Bedienung ist ein abgeschnittenes Bild. Deshalb hier:
// Pfeile, Punkte, Tastatur und Ziehen mit der Maus.
//
// WARUM KEINE BIBLIOTHEK
// ======================
// Embla, Swiper und Co. bringen 15–40 kB auf JEDE Beitragsseite, für vier
// Bilder. Was hier gebraucht wird, ist `scrollTo` mit `behavior: "smooth"` und
// ein Zähler — das native Scroll-Snapping macht den Rest, inklusive Wischen,
// Schwungscrollen und der Rücksicht auf `prefers-reduced-motion`.
//
// WAS DIE PFEILE NICHT TUN
// ========================
// Sie laufen NICHT im Kreis. Am letzten Bild ist der Rechtspfeil aus, am
// ersten der Linkspfeil. Ein Karussell, das nach dem letzten Bild wieder beim
// ersten anfängt, nimmt dem Betrachter die Antwort auf „habe ich alles
// gesehen?" — bei vier Bildern ist das der häufigere Wunsch als
// Endlosblättern.
import { useCallback, useEffect, useRef, useState } from "react";

export function Karussell({
  bilder,
  /** Beschriftungen für die Vorlesefunktion. Sie kommen von aussen, weil
   *  dieser Baustein in einer Website steht, die 24 Sprachen spricht — ein
   *  deutsches „Vorheriges Bild" im dänischen Blog wäre ein Fremdkörper. */
  texte,
}: {
  bilder: string[];
  texte: { vorheriges: string; naechstes: string; zuBild: string };
}) {
  const spur = useRef<HTMLDivElement>(null);
  const [aktiv, setAktiv] = useState(0);
  //: Wie weit gescrollt ist — entscheidet, ob die Pfeile noch etwas tun.
  const [amAnfang, setAmAnfang] = useState(true);
  const [amEnde, setAmEnde] = useState(false);

  /** Den sichtbaren Stand aus der Spur lesen.
   *
   *  Aus `scrollLeft` und nicht aus einem eigenen Zähler: gewischt wird auch
   *  ohne die Pfeile, und ein Zähler, der das nicht mitbekommt, zeigt danach
   *  auf das falsche Bild. Die Spur ist die Wahrheit. */
  const messen = useCallback(() => {
    const el = spur.current;
    if (!el) return;
    const folie = el.firstElementChild as HTMLElement | null;
    const schritt = folie ? folie.offsetWidth + 16 : el.clientWidth;
    setAktiv(Math.round(el.scrollLeft / schritt));
    setAmAnfang(el.scrollLeft <= 1);
    // 1 px Toleranz: Browser runden `scrollWidth` und `clientWidth`
    // verschieden, und ohne sie bliebe der Rechtspfeil am Ende aktiv.
    setAmEnde(el.scrollLeft + el.clientWidth >= el.scrollWidth - 1);
  }, []);

  useEffect(() => {
    messen();
    const el = spur.current;
    if (!el) return;
    el.addEventListener("scroll", messen, { passive: true });
    // Bei einem Fensterwechsel ändert sich die Folienbreite — und damit,
    // welches Bild das aktive ist.
    globalThis.addEventListener("resize", messen);
    return () => {
      el.removeEventListener("scroll", messen);
      globalThis.removeEventListener("resize", messen);
    };
  }, [messen]);

  const zu = useCallback((i: number) => {
    const el = spur.current;
    if (!el) return;
    const folie = el.children[i] as HTMLElement | undefined;
    if (!folie) return;
    // `scrollTo` auf der Spur und NICHT `scrollIntoView`: das würde die ganze
    // Seite mitziehen, sobald das Karussell nicht vollständig im Bild steht.
    el.scrollTo({ left: folie.offsetLeft - el.offsetLeft, behavior: "smooth" });
  }, []);

  // --- Ziehen mit der Maus --------------------------------------------------
  //
  // Am Rechner ist das die Geste, die man von einem Karussell erwartet. Ohne
  // sie bleiben nur die Pfeile; mit ihr fühlt es sich an wie auf dem Telefon.
  const zieht = useRef<{ x: number; start: number } | null>(null);

  if (bilder.length === 0) return null;

  return (
    <div className="relative mt-10">
      <div
        ref={spur}
        role="group"
        aria-roledescription="carousel"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "ArrowRight") {
            e.preventDefault();
            zu(Math.min(aktiv + 1, bilder.length - 1));
          } else if (e.key === "ArrowLeft") {
            e.preventDefault();
            zu(Math.max(aktiv - 1, 0));
          }
        }}
        onPointerDown={(e) => {
          // Nur die Maus. Auf Touch macht der Browser das Wischen selbst, und
          // zwei Mechaniken übereinander ruckeln.
          if (e.pointerType !== "mouse") return;
          const el = spur.current;
          if (!el) return;
          zieht.current = { x: e.clientX, start: el.scrollLeft };
          el.setPointerCapture(e.pointerId);
        }}
        onPointerMove={(e) => {
          const el = spur.current;
          if (!zieht.current || !el) return;
          el.scrollLeft = zieht.current.start - (e.clientX - zieht.current.x);
        }}
        onPointerUp={(e) => {
          const el = spur.current;
          if (!zieht.current || !el) return;
          zieht.current = null;
          el.releasePointerCapture(e.pointerId);
          // Nach dem Loslassen auf die nächste Folie einrasten. Ohne das
          // bliebe das Karussell zwischen zwei Bildern stehen.
          messen();
        }}
        className="flex cursor-grab snap-x snap-mandatory gap-4 overflow-x-auto pb-2 select-none active:cursor-grabbing focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {bilder.map((url, i) => (
          <figure
            key={`${url}-${i}`}
            aria-label={`${i + 1} / ${bilder.length}`}
            style={{ aspectRatio: "3 / 2" }}
            className="relative w-[85%] shrink-0 snap-center overflow-hidden rounded-2xl bg-secondary sm:w-[60%] lg:w-[45%]"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={url}
              alt=""
              loading="lazy"
              // Sonst zieht der Browser beim Wischen das BILD statt der Spur.
              draggable={false}
              // GANZES Bild, nicht zugeschnitten.
              //
              // Vorher `object-cover`: der Rahmen ist 3:2, und alles, was
              // anders proportioniert war, verlor oben und unten seine Ränder
              // — bei einem Hochformat den halben Inhalt (gemeldet am
              // 28.08.2026: „die bilder sind abgeschnitten").
              //
              // Ein Karussell zeigt, was der Betrieb hochgeladen hat. Es darf
              // seine Bilder nicht beschneiden, weil es selbst ein festes
              // Format braucht — der Rahmen ist unser Problem, nicht seins.
              // Was neben dem Bild bleibt, ist die Platte darunter.
              className="size-full object-contain"
            />
          </figure>
        ))}
      </div>

      {/* Die PFEILE. Sie liegen über der Spur, halbtransparent, damit sie das
          Bild nicht zerschneiden — und sie verschwinden am jeweiligen Ende,
          statt dort wirkungslos zu bleiben. */}
      {!amAnfang ? (
        <button
          type="button"
          aria-label={texte.vorheriges}
          onClick={() => zu(Math.max(aktiv - 1, 0))}
          className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-background/90 p-2 shadow-md ring-1 ring-border transition hover:bg-background"
        >
          <svg viewBox="0 0 24 24" className="size-5" aria-hidden>
            <path
              d="M15 5l-7 7 7 7"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      ) : null}
      {!amEnde ? (
        <button
          type="button"
          aria-label={texte.naechstes}
          onClick={() => zu(Math.min(aktiv + 1, bilder.length - 1))}
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-background/90 p-2 shadow-md ring-1 ring-border transition hover:bg-background"
        >
          <svg viewBox="0 0 24 24" className="size-5" aria-hidden>
            <path
              d="M9 5l7 7-7 7"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      ) : null}

      {/* Die PUNKTE. Sie sind die Antwort auf „wie viele sind es noch" — die
          Pfeile allein beantworten das nicht. Anklickbar, weil ein Punkt, der
          nur anzeigt, an der Stelle sitzt, an der man klicken will. */}
      {bilder.length > 1 ? (
        <div className="mt-3 flex justify-center gap-2">
          {bilder.map((url, i) => (
            <button
              key={`punkt-${url}-${i}`}
              type="button"
              // Der Platzhalter des Renderer-Katalogs heisst `{n}` — nicht
              // `{nr}`. Mit dem falschen Namen stand an jedem Punkt woertlich
              // „Folie {n}", und die Vorlesefunktion las viermal dasselbe.
              aria-label={texte.zuBild.replace("{n}", String(i + 1))}
              aria-current={i === aktiv}
              onClick={() => zu(i)}
              className={
                "h-2 rounded-full transition-all " +
                (i === aktiv
                  ? "w-6 bg-foreground/70"
                  : "w-2 bg-foreground/25 hover:bg-foreground/40")
              }
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}
