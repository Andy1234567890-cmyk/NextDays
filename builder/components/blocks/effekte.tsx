"use client";

// Die LIVE-Skripte der Effekte (Framer „Appear", „Scroll Speed", „Drag",
// „Ticker", „Lightbox", „Scroll Transform", dazu Overlays und die Sprungart
// eines Links — Vollerfassung §8–§10).
//
// Alles, was CSS allein nicht kann, steht HIER und nirgends sonst; alles, was
// CSS kann, steht im `<style>` des Blocks (`stilCss`). Die Trennlinie ist
// nicht Geschmack, sondern die Bedingung dafür, dass eine Gast-Seite ohne
// JavaScript nicht kaputt aussieht.
//
//   · `data-erscheinen`     — sichtbar werden blendet ein; `data-erschienen`
//     schaltet den Übergang, `data-effekt-wiederholen` nimmt ihn beim
//     Verlassen zurück (Framer „Replay").
//   · `data-scroll-tempo`   — Parallax: (tempo − 100) % der Scrollstrecke.
//   · `data-scroll-transform` — Von/Nach-Zustand über den Scrollweg gemischt.
//   · `data-ziehen`         — das Element folgt dem Zeiger („frei", „x", „y");
//     `data-ziehen-zurueck` federt beim Loslassen zurück.
//   · `data-ticker-lauf`    — der Inhalt wird verdoppelt und läuft endlos; die
//     Dauer folgt der gemessenen Breite (`--bk-ticker-dauer`).
//   · `data-lichtkasten`    — Klick auf ein Bild öffnet es groß im `<dialog>`.
//   · `data-overlay-ausloeser` — Klick öffnet/schließt den Overlay-Kasten.
//   · `data-scrollen`       — ein Anker-Link springt sanft oder sofort.
//
// Im Editor-iframe fehlen ALLE diese Attribute (`rahmenAttribute(..., {editor})`),
// dort läuft also nichts davon: der Kunde sieht seine Bausteine immer, an ihrem
// Platz, und nichts zappelt beim Bearbeiten.
//
// Ohne JavaScript bleibt ein Element mit `data-erscheinen` unsichtbar — der
// <noscript>-Stil unten hebt das auf (Wurzel 5: kein stiller Ausfall).
import { useEffect } from "react";

import { EFFEKTE_KEYFRAMES } from "@nextdays/baukasten-stil";

/** Ein Von/Nach-Zustand des Scroll-Transforms, wie ihn `rahmenAttribute`
 *  schreibt. Alles optional — was fehlt, bleibt unverändert. */
type Zustand = {
  opazitaet?: number | null;
  skalierung?: number | null;
  rotation?: number | null;
  versatz_x?: string | null;
  versatz_y?: string | null;
};

/** Zwei Zustände am Fortschritt `p` (0…1) mischen. Fehlt einer der Werte, gilt
 *  der Ruhewert der Eigenschaft — kein erfundener Zwischenwert (Wurzel 4). */
function mischen(von: Zustand | null, nach: Zustand | null, p: number) {
  const wert = (a: number | null | undefined, b: number | null | undefined, ruhe: number) => {
    const v = a ?? ruhe;
    const n = b ?? ruhe;
    return v + (n - v) * p;
  };
  const px = (a: string | null | undefined, b: string | null | undefined) => {
    const zahl = (s: string | null | undefined) => (s ? Number.parseFloat(s) || 0 : 0);
    return zahl(a) + (zahl(b) - zahl(a)) * p;
  };
  return {
    opazitaet: wert(von?.opazitaet, nach?.opazitaet, 1),
    skalierung: wert(von?.skalierung, nach?.skalierung, 1),
    rotation: wert(von?.rotation, nach?.rotation, 0),
    x: px(von?.versatz_x, nach?.versatz_x),
    y: px(von?.versatz_y, nach?.versatz_y),
  };
}

function jsonAus<T>(roh: string | undefined): T | null {
  if (!roh) return null;
  try {
    return JSON.parse(roh) as T;
  } catch {
    // Ein kaputtes Attribut ist ein Datenfehler, kein Grund, die ganze Seite
    // stillzulegen — der Effekt entfällt, der Rest läuft.
    return null;
  }
}

export function Effekte() {
  useEffect(() => {
    const aufräumen: Array<() => void> = [];

    // --- Erscheinen (Framer „Appear") ------------------------------------
    const erscheinende = Array.from(document.querySelectorAll<HTMLElement>("[data-erscheinen]"));
    if (erscheinende.length) {
      const beobachter = new IntersectionObserver(
        (eintraege) => {
          for (const e of eintraege) {
            const el = e.target as HTMLElement;
            if (e.isIntersecting) el.setAttribute("data-erschienen", "");
            else if (el.hasAttribute("data-effekt-wiederholen")) el.removeAttribute("data-erschienen");
          }
        },
        { threshold: 0.15 },
      );
      for (const el of erscheinende) beobachter.observe(el);
      aufräumen.push(() => beobachter.disconnect());
    }

    // --- Ticker (Framer „Ticker") ----------------------------------------
    //
    // Der Inhalt wird EINMAL verdoppelt und die Bahn um die halbe Strecke
    // verschoben — so schließt sich der Kreis ohne Sprung. Die Dauer folgt der
    // gemessenen Breite: 100 % Tempo = 60 px/s, wie im Vorbild.
    for (const el of Array.from(document.querySelectorAll<HTMLElement>("[data-ticker-lauf]"))) {
      const [richtung = "links", tempoRoh = "100", ziehbar = "0"] = (
        el.dataset.tickerLauf ?? ""
      ).split(":");
      if (el.querySelector(":scope > [data-ticker]")) continue;
      const bahn = document.createElement("div");
      bahn.setAttribute("data-ticker", "");
      if (richtung === "oben" || richtung === "unten") {
        bahn.setAttribute("data-ticker-senkrecht", "");
      }
      while (el.firstChild) bahn.appendChild(el.firstChild);
      // Die Kopie ist für Vorlesehilfen ein Duplikat — sie wird versteckt.
      const kopie = bahn.cloneNode(true) as HTMLElement;
      kopie.setAttribute("aria-hidden", "true");
      for (const kind of Array.from(kopie.childNodes)) bahn.appendChild(kind);
      el.appendChild(bahn);
      const strecke =
        richtung === "oben" || richtung === "unten" ? bahn.scrollHeight / 2 : bahn.scrollWidth / 2;
      const tempo = Math.max(10, Number(tempoRoh) || 100);
      const sekunden = strecke / (60 * (tempo / 100));
      if (Number.isFinite(sekunden) && sekunden > 0) {
        el.style.setProperty("--bk-ticker-dauer", `${sekunden.toFixed(2)}s`);
      }
      if (ziehbar === "1") el.setAttribute("data-ziehen", richtung === "oben" || richtung === "unten" ? "y" : "x");
    }

    // --- Ziehen (Framer „Drag") -------------------------------------------
    for (const el of Array.from(document.querySelectorAll<HTMLElement>("[data-ziehen]"))) {
      const achse = el.dataset.ziehen ?? "frei";
      const zurueck = el.hasAttribute("data-ziehen-zurueck");
      let start: { x: number; y: number; dx: number; dy: number } | null = null;
      let dx = 0;
      let dy = 0;
      function runter(e: PointerEvent) {
        start = { x: e.clientX, y: e.clientY, dx, dy };
        el.setAttribute("data-zieht", "");
        el.setPointerCapture(e.pointerId);
      }
      function bewegt(e: PointerEvent) {
        if (!start) return;
        dx = achse === "y" ? start.dx : start.dx + (e.clientX - start.x);
        dy = achse === "x" ? start.dy : start.dy + (e.clientY - start.y);
        el.style.translate = `${dx}px ${dy}px`;
      }
      function hoch(e: PointerEvent) {
        if (!start) return;
        start = null;
        el.removeAttribute("data-zieht");
        el.releasePointerCapture(e.pointerId);
        if (zurueck) {
          dx = 0;
          dy = 0;
          el.style.translate = "0 0";
        }
      }
      el.addEventListener("pointerdown", runter);
      el.addEventListener("pointermove", bewegt);
      el.addEventListener("pointerup", hoch);
      el.addEventListener("pointercancel", hoch);
      aufräumen.push(() => {
        el.removeEventListener("pointerdown", runter);
        el.removeEventListener("pointermove", bewegt);
        el.removeEventListener("pointerup", hoch);
        el.removeEventListener("pointercancel", hoch);
      });
    }

    // --- Lichtkasten (Framer „Lightbox") ----------------------------------
    //
    // EIN `<dialog>` für die ganze Seite, nicht eines je Bild: der Browser
    // bringt Fokusfalle, Escape und die oberste Ebene mit, und ein zweiter
    // Dialog wäre ein zweiter Zustand für dieselbe Frage.
    const lichtElemente = Array.from(
      document.querySelectorAll<HTMLElement>("[data-lichtkasten]"),
    );
    if (lichtElemente.length) {
      const dialog = document.createElement("dialog");
      dialog.setAttribute("data-lichtkasten", "");
      const bild = document.createElement("img");
      dialog.appendChild(bild);
      document.body.appendChild(dialog);
      const aufDialogKlick = (e: MouseEvent) => {
        if (e.target === dialog) dialog.close();
      };
      dialog.addEventListener("click", aufDialogKlick);
      const zuhoerer: Array<[HTMLElement, (e: MouseEvent) => void]> = [];
      for (const el of lichtElemente) {
        const konfig = jsonAus<{ b: number; p: number; z: number; g: string }>(
          el.dataset.lichtkasten,
        );
        const auf = (e: MouseEvent) => {
          const ziel = (e.target as HTMLElement | null)?.closest("img");
          if (!ziel || !(ziel instanceof HTMLImageElement)) return;
          e.preventDefault();
          bild.src = ziel.currentSrc || ziel.src;
          bild.alt = ziel.alt;
          if (konfig) {
            dialog.style.maxWidth = `${konfig.b}px`;
            dialog.style.padding = `${konfig.p}px`;
            dialog.style.zIndex = String(konfig.z);
            dialog.style.setProperty("--bk-lichtkasten-grund", konfig.g);
          }
          dialog.showModal();
        };
        el.addEventListener("click", auf);
        zuhoerer.push([el, auf]);
      }
      aufräumen.push(() => {
        dialog.removeEventListener("click", aufDialogKlick);
        for (const [el, auf] of zuhoerer) el.removeEventListener("click", auf);
        dialog.remove();
      });
    }

    // --- Overlays (Framer „Overlays", Klick-Auslöser) ---------------------
    const overlayElemente = Array.from(
      document.querySelectorAll<HTMLElement>("[data-overlay-ausloeser]"),
    );
    if (overlayElemente.length) {
      const zuhoerer: Array<[HTMLElement, (e: MouseEvent) => void]> = [];
      for (const el of overlayElemente) {
        const auf = (e: MouseEvent) => {
          const kasten = el.querySelector<HTMLElement>(":scope > [data-overlay]");
          if (!kasten) return;
          // Ein Klick IM Kasten schließt nur, wenn „Klick" eingestellt ist —
          // sonst könnte man darin nichts anfassen.
          if (kasten.contains(e.target as Node)) {
            if (el.dataset.overlaySchliessen === "klick") kasten.removeAttribute("data-offen");
            return;
          }
          e.preventDefault();
          kasten.toggleAttribute("data-offen");
        };
        el.addEventListener("click", auf);
        zuhoerer.push([el, auf]);
      }
      // „Auto" heißt: der nächste Klick daneben schließt.
      const daneben = (e: MouseEvent) => {
        for (const el of overlayElemente) {
          if (el.dataset.overlaySchliessen !== "auto") continue;
          if (el.contains(e.target as Node)) continue;
          el.querySelector<HTMLElement>(":scope > [data-overlay]")?.removeAttribute("data-offen");
        }
      };
      document.addEventListener("click", daneben);
      aufräumen.push(() => {
        for (const [el, auf] of zuhoerer) el.removeEventListener("click", auf);
        document.removeEventListener("click", daneben);
      });
    }

    // --- Tracking (Framer „Tracking") -------------------------------------
    //
    // Der Klick meldet ein Ereignis an das Google-Tag der Website (0430). Ist
    // keine Kennung eingetragen, gibt es kein `gtag` — dann passiert nichts,
    // und zwar sichtbar nichts: der Baukasten sagt an der Stelle, an der man
    // den Ereignisnamen tippt, dass es dafür eine Kennung braucht.
    const aufEreignis = (e: MouseEvent) => {
      const link = (e.target as HTMLElement | null)?.closest<HTMLElement>("[data-ereignis]");
      const name = link?.dataset.ereignis;
      if (!name) return;
      const gtag = (window as unknown as { gtag?: (...a: unknown[]) => void }).gtag;
      if (typeof gtag !== "function") return;
      gtag("event", name, {
        link_url: link instanceof HTMLAnchorElement ? link.href : undefined,
        link_text: (link.textContent ?? "").trim().slice(0, 100),
      });
    };
    document.addEventListener("click", aufEreignis);
    aufräumen.push(() => document.removeEventListener("click", aufEreignis));

    // --- Sprungart eines Links (Framer „Scrollen") ------------------------
    const aufSprung = (e: MouseEvent) => {
      const link = (e.target as HTMLElement | null)?.closest<HTMLAnchorElement>("a[data-scrollen]");
      if (!link) return;
      const raute = link.getAttribute("href")?.indexOf("#") ?? -1;
      if (raute < 0) return;
      const anker = link.getAttribute("href")!.slice(raute + 1);
      // Nur der Sprung AUF DIESER Seite; ein Link auf eine andere Seite bleibt
      // ein normaler Link.
      const pfad = link.getAttribute("href")!.slice(0, raute);
      if (pfad && pfad !== window.location.pathname) return;
      const ziel = anker ? document.getElementById(anker) : null;
      if (!ziel) return;
      e.preventDefault();
      ziel.scrollIntoView({
        behavior: link.dataset.scrollen === "sanft" ? "smooth" : "auto",
        block: "start",
      });
      window.history.replaceState(null, "", `#${anker}`);
    };
    document.addEventListener("click", aufSprung);
    aufräumen.push(() => document.removeEventListener("click", aufSprung));

    // --- Scroll: Tempo (Parallax) und Transform ---------------------------
    const tempo = Array.from(document.querySelectorAll<HTMLElement>("[data-scroll-tempo]"));
    const transformElemente = Array.from(
      document.querySelectorAll<HTMLElement>("[data-scroll-transform]"),
    ).map((el) => ({
      el,
      konfig: jsonAus<{ a: string; v: Zustand | null; n: Zustand | null }>(
        el.dataset.scrollTransform,
      ),
    }));
    let raf = 0;
    const zeichne = () => {
      raf = 0;
      const hoehe = window.innerHeight;
      const mitte = hoehe / 2;
      for (const el of tempo) {
        const faktor = (Number(el.dataset.scrollTempo) - 100) / 100;
        if (!Number.isFinite(faktor) || faktor === 0) continue;
        const r = el.getBoundingClientRect();
        const abstand = r.top + r.height / 2 - mitte;
        el.style.setProperty("--bk-parallax", `${(-abstand * faktor).toFixed(1)}px`);
        el.style.translate = `0 var(--bk-parallax)`;
      }
      for (const { el, konfig } of transformElemente) {
        if (!konfig) continue;
        const r = el.getBoundingClientRect();
        // Fortschritt 0…1: 0 = das Element kommt unten ins Bild, 1 = es ist
        // oben hinaus. „ebene_sichtbar" misst dieselbe Strecke, hält aber am
        // Rand an, statt darüber hinaus zu rechnen.
        const roh = (hoehe - r.top) / (hoehe + r.height);
        const p = Math.max(0, Math.min(1, roh));
        const m = mischen(konfig.v ?? null, konfig.n ?? null, p);
        el.style.opacity = String(Number(m.opazitaet.toFixed(3)));
        el.style.translate = `${m.x.toFixed(1)}px ${m.y.toFixed(1)}px`;
        el.style.rotate = `${m.rotation.toFixed(2)}deg`;
        el.style.scale = String(Number(m.skalierung.toFixed(3)));
      }
    };
    const aufScroll = () => {
      if (!raf) raf = window.requestAnimationFrame(zeichne);
    };
    if (tempo.length || transformElemente.length) {
      window.addEventListener("scroll", aufScroll, { passive: true });
      window.addEventListener("resize", aufScroll);
      zeichne();
      aufräumen.push(() => {
        window.removeEventListener("scroll", aufScroll);
        window.removeEventListener("resize", aufScroll);
        if (raf) window.cancelAnimationFrame(raf);
      });
    }

    return () => {
      for (const weg of aufräumen) weg();
    };
  }, []);

  return (
    <>
      <style>{EFFEKTE_KEYFRAMES}</style>
      <noscript>
        <style>{"[data-erscheinen]{opacity:1!important;transform:none!important}"}</style>
      </noscript>
    </>
  );
}
