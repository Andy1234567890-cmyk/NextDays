"use client";

// Brücke zwischen der Entwurfs-Vorschau (dieser iframe) und dem Editor im
// Dashboard. Zwei Richtungen:
//
//   Klick auf einen Abschnitt  → der Editor wählt ihn links aus.
//   Text im Abschnitt ändern   → der Editor übernimmt den neuen Wert.
//
// Warum die Texte HIER bearbeitet werden und nicht nur im Formular links: der
// Kunde sieht die Stelle, die er ändert. Ein Formularfeld „Untertitel" verlangt,
// dass er sich merkt, welcher der drei Texte im Bild das ist.
//
// Sicherheit: Nachrichten gehen NUR an den Origin, der sich vorgestellt hat
// („canvas:hello"), niemals an "*". Und es gehen nur Feldwerte hinaus, die an
// einem markierten Element hängen — der iframe schickt keine beliebigen Daten.
import { useEffect } from "react";

/** Was an einer Textstelle gemeldet wird. Die Zuordnung geschieht über den
 *  Abschnitts-INDEX (Reihenfolge auf der Seite) und den Feldschlüssel — nicht
 *  über eine DB-ID, denn ein noch nicht gespeicherter Abschnitt hat keine. */
type TextMeldung = {
  index: number;
  feld: string;
  wert: string;
};

export function CanvasBridge({
  /** true = Textstellen sind bearbeitbar (nur in der Entwurfs-Vorschau). */
  editierbar = false,
}: {
  editierbar?: boolean;
}) {
  useEffect(() => {
    let elternOrigin: string | null = null;

    function senden(type: string, payload: Record<string, unknown>) {
      if (!elternOrigin) return;
      window.parent.postMessage(
        { source: "builder-canvas", type, ...payload },
        elternOrigin,
      );
    }

    /** Abschnitts-Index eines Elements: nach oben laufen, bis ein Abschnitt
     *  gefunden ist. */
    function abschnittsIndex(ziel: EventTarget | null): number | null {
      let el = ziel as HTMLElement | null;
      while (el && el !== document.body) {
        const idx = el.getAttribute?.("data-block-index");
        if (idx != null) return Number(idx);
        el = el.parentElement;
      }
      return null;
    }

    /** Feldschlüssel des nächstgelegenen markierten Elements. */
    function feldVon(ziel: EventTarget | null): {
      el: HTMLElement;
      feld: string;
    } | null {
      let el = ziel as HTMLElement | null;
      while (el && el !== document.body) {
        const feld = el.getAttribute?.("data-feld");
        if (feld) return { el, feld };
        el = el.parentElement;
      }
      return null;
    }

    function aufKlick(e: MouseEvent) {
      const treffer = editierbar ? feldVon(e.target) : null;
      // Klick auf eine editierbare Stelle: NICHT dem Editor melden und den
      // Cursor dort landen lassen, wo geklickt wurde. Ist die Stelle selbst ein
      // Link (die Knopf-Beschriftung im Titelbild), muss die Navigation
      // trotzdem unterbleiben — sonst verlässt der iframe die Vorschau.
      if (treffer) {
        if ((e.target as HTMLElement)?.closest?.("a")) e.preventDefault();
        return;
      }

      // JEDER Link in der Vorschau bleibt stehen: eine Navigation würde die
      // Entwurfsansicht verlassen und den Token aus der Adresse verlieren —
      // danach zeigt der iframe eine 404 und der Kunde denkt, etwas sei kaputt.
      // Betrifft auch die Menüpunkte in der Kopfzeile und die Objekt-Karten.
      const link = (e.target as HTMLElement)?.closest?.("a");
      if (link) e.preventDefault();

      const idx = abschnittsIndex(e.target);
      if (idx != null) {
        e.preventDefault();
        senden("select", { index: idx });
      }
    }

    /** Text übernehmen, wenn die Stelle den Fokus verliert.
     *
     *  Bewusst bei `blur` und nicht bei jedem Tastendruck: der Editor speichert
     *  entprellt, und ein Wert pro Anschlag wäre eine Flut von Meldungen, bei
     *  der jede den lokalen Stand des Editors überschreibt, während der Nutzer
     *  noch tippt. */
    function aufBlur(e: FocusEvent) {
      const treffer = feldVon(e.target);
      if (!treffer) return;
      const index = abschnittsIndex(treffer.el);
      if (index == null) return;
      const meldung: TextMeldung = {
        index,
        feld: treffer.feld,
        // textContent, nicht innerHTML: an dieser Stelle steht reiner Text, und
        // was der Browser beim Einfügen an Markup mitbringt, hat in der DB
        // nichts zu suchen.
        wert: (treffer.el.textContent ?? "").trim(),
      };
      senden("text", meldung);
    }

    /** Zeilenumbrüche verhindern: die markierten Stellen sind einzeilige Texte
     *  (Überschrift, Beschriftung). Ein <br> oder <div> darin wäre Markup in
     *  einem Feld, das reinen Text erwartet. */
    function aufTaste(e: KeyboardEvent) {
      if (e.key !== "Enter") return;
      if (!feldVon(e.target)) return;
      e.preventDefault();
      (e.target as HTMLElement)?.blur();
    }

    function aufNachricht(e: MessageEvent) {
      const data = e.data as { source?: string; type?: string } | null;
      if (data?.source === "builder-editor" && data.type === "hello") {
        // Der Editor stellt sich vor → ab jetzt kennen wir sein Ziel.
        elternOrigin = e.origin;
        senden("ready", { editierbar });
      }
    }

    // Markierte Stellen bearbeitbar machen.
    const stellen = editierbar
      ? [...document.querySelectorAll<HTMLElement>("[data-feld]")]
      : [];
    for (const el of stellen) {
      el.contentEditable = "true";
      // Der Browser soll nur Text einfügen, kein Markup aus der Zwischenablage.
      el.setAttribute("data-editierbar", "1");
      el.style.outline = "none";
      el.style.cursor = "text";
    }

    document.addEventListener("click", aufKlick, true);
    document.addEventListener("blur", aufBlur, true);
    document.addEventListener("keydown", aufTaste, true);
    window.addEventListener("message", aufNachricht);
    return () => {
      document.removeEventListener("click", aufKlick, true);
      document.removeEventListener("blur", aufBlur, true);
      document.removeEventListener("keydown", aufTaste, true);
      window.removeEventListener("message", aufNachricht);
      for (const el of stellen) el.removeAttribute("contenteditable");
    };
  }, [editierbar]);

  return null;
}
