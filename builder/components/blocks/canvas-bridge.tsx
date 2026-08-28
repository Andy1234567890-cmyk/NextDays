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
  /** DB-ID des Blocks — siehe `Rechteck.id`. */
  id?: string;
  feld: string;
  wert: string;
};

/** Das Rechteck eines Abschnitts, wie der Editor es zum Zeichnen braucht.
 *
 *  Die Werte sind RELATIV ZUM SICHTFENSTER DIESES iframes
 *  (`getBoundingClientRect`), nicht zum Dokument. Genau das will die
 *  Gegenseite: ihre Überlagerung liegt deckungsgleich auf dem iframe-Element,
 *  also ist „12 px unter der iframe-Oberkante" dort dieselbe Zahl. Beim
 *  Scrollen IM iframe ändern sich die Werte — deshalb wird beim Scrollen neu
 *  gemeldet, statt die Gegenseite rechnen zu lassen. */
type Rechteck = {
  index: number;
  /** DB-ID des Blocks. Die eindeutige Zuordnung zum Editor — der `index` zählt
   *  auch Abschnitte und Spalten mit, die der Editor gar nicht kennt. */
  id?: string;
  /** Was der Knoten IST: `section` · `column` · `inner_column` · `widget`.
   *
   *  Der Editor unterscheidet daran, ob ein Rechteck ein Baustein (auswählbar,
   *  hat eine Zeile in seinem Modell) oder ein leerer Container ist
   *  (Abwurfziel, hat keine Zeile). */
  kind?: string;
  top: number;
  left: number;
  width: number;
  height: number;
};

export function CanvasBridge({
  /** true = Textstellen sind bearbeitbar (nur in der Entwurfs-Vorschau). */
  editierbar = false,
}: {
  editierbar?: boolean;
}) {
  useEffect(() => {
    let elternOrigin: string | null = null;

    // Diagnose. Ein Handschlag, der nicht zustande kommt, ist von außen NICHT
    // zu sehen: die Vorschau lädt, sieht richtig aus und reagiert nur nicht.
    // Genau deshalb loggt die Brücke ihren Zustand laut, statt still zu bleiben
    // (Wurzel 5). In Produktion ist das aus; auf Staging und lokal per
    // `NEXT_PUBLIC_CANVAS_DEBUG=1` an.
    const laut = process.env.NEXT_PUBLIC_CANVAS_DEBUG === "1";
    function protokoll(was: string, mehr?: unknown) {
      if (!laut) return;
      // eslint-disable-next-line no-console
      console.log(`[canvas] ${was}`, mehr ?? "");
    }

    function senden(type: string, payload: Record<string, unknown>) {
      if (!elternOrigin) {
        // Der häufigste stille Fehler: gemessen wird, aber niemand hört zu.
        protokoll(`${type} verworfen — kein Eltern-Origin (Handschlag offen)`);
        return;
      }
      window.parent.postMessage(
        { source: "builder-canvas", type, ...payload },
        elternOrigin,
      );
    }

    /** Abschnitts-Index eines Elements: nach oben laufen, bis ein Abschnitt
     *  gefunden ist. */
    function abschnittsIndex(ziel: EventTarget | null): number | null {
      let el = ziel as HTMLElement | null;
      // Der Index des BAUSTEINS, aus demselben Grund wie bei `abschnittsId`
      // und vom SELBEN Element: liefe der Index von der Spalte und die ID vom
      // Baustein, beschrieben die beiden Felder einer Meldung verschiedene
      // Knoten — die Gegenseite waehlt dann ueber die ID richtig aus und
      // zeichnet ueber den Index den Rahmen woanders.
      while (el && el !== document.body) {
        const idx = el.getAttribute?.("data-block-index");
        const art = el.getAttribute?.("data-block-kind");
        if (idx != null && (art == null || art === "widget")) {
          return Number(idx);
        }
        el = el.parentElement;
      }
      return null;
    }

    /** Die DB-ID des Blocks unter einem Element.
     *
     *  Nach oben laufen bis zum ersten Knoten MIT ID: ein Klick landet meist
     *  auf einem Kindelement (Überschrift, Bild), und die Container darüber
     *  tragen zwar einen Index, aber der Editor kennt nur Bausteine. Über die
     *  ID trifft die Auswahl deshalb, was der Nutzer angeklickt hat — der
     *  Index allein zeigte auf den falschen Abschnitt. */
    function abschnittsId(ziel: EventTarget | null): string | null {
      let el = ziel as HTMLElement | null;
      // Nur die ID eines BAUSTEINS zaehlt. Container (Abschnitt, Spalte,
      // innere Spalte) tragen ebenfalls eine `data-block-id`, stehen aber
      // nicht in der Liste des Editors — `list_blocks` filtert sie heraus.
      // Vorher nahm diese Schleife die erste ID, die sie fand: bei einem Klick
      // auf einen Inhalt war das die Spalte darueber. Der Editor fand sie
      // nicht, fiel auf den Index zurueck, und der zaehlt im Renderer-Raum
      // (0..17) statt im Editor-Raum (0..5) — die Auswahl landete auf einem
      // fremden Abschnitt.
      while (el && el !== document.body) {
        const id = el.getAttribute?.("data-block-id");
        const art = el.getAttribute?.("data-block-kind");
        if (id && (art == null || art === "widget")) return id;
        el = el.parentElement;
      }
      return null;
    }

    /** Der nächste CONTAINER über einem Element: Abschnitt, Spalte, innere
     *  Spalte — mit seiner DB-ID und seiner Art.
     *
     *  Er wandert seit 0479 bei jeder Auswahl MIT hinaus. Vorher meldete die
     *  Brücke ausschließlich Bausteine, und damit war im Editor kein Container
     *  anfassbar: ein Klick auf einen leeren Abschnitt oder auf den Rand einer
     *  Spalte meldete gar nichts. „Abschnitt auswählen, Hintergrund setzen,
     *  Spaltenbreite ändern" war deshalb nicht bedienbar, obwohl Datenmodell
     *  und Renderer die Ebenen kennen.
     *
     *  Gemeldet wird der INNERSTE Container: bei einem Klick in eine Spalte ist
     *  die Spalte gemeint, nicht der Abschnitt darüber. Der Weg nach oben
     *  („Elternteil auswählen") gehört in den Editor, der den Baum hat. */
    function containerVon(
      ziel: EventTarget | null,
    ): { id: string; kind: string } | null {
      let el = ziel as HTMLElement | null;
      while (el && el !== document.body) {
        const id = el.getAttribute?.("data-block-id");
        const art = el.getAttribute?.("data-block-kind");
        if (
          id &&
          (art === "section" || art === "column" || art === "inner_column")
        ) {
          return { id, kind: art };
        }
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

    /** Alle Abschnitts-Rechtecke messen und melden.
     *
     *  Ein Aufruf misst ALLE Abschnitte, nicht nur den ausgewählten: die
     *  Gegenseite zeichnet auch den Rahmen unter dem Mauszeiger, und ein
     *  zweiter Weg für „nur dieses eine" wäre eine zweite Wahrheit über
     *  dieselbe Geometrie.
     *
     *  Gedrosselt über einen Frame: `scroll` feuert bei flüssigem Scrollen
     *  dutzende Male je Sekunde, und jede Messung ist ein erzwungenes Layout.
     *  Ein Frame ist genau die Taktrate, in der die Gegenseite ohnehin neu
     *  zeichnet. */
    let messUhr = 0;
    function messen(grund: "hallo" | "layout" | "scroll" = "layout") {
      const knoten = document.querySelectorAll<HTMLElement>("[data-block-index]");
      const rechtecke: Rechteck[] = [];
      for (const el of knoten) {
        const idx = Number(el.getAttribute("data-block-index"));
        if (!Number.isInteger(idx)) continue;
        const r = el.getBoundingClientRect();
        // Abschnitte ohne Ausdehnung überspringen: ein per CSS auf dem
        // aktuellen Breakpoint ausgeblendeter Abschnitt hat 0×0, und ein
        // Rahmen der Größe null am Seitenanfang sieht aus wie ein Fehler.
        if (r.width <= 0 || r.height <= 0) continue;
        rechtecke.push({
          index: idx,
          id: el.getAttribute("data-block-id") ?? undefined,
          // Die ART wandert mit. Der Editor braucht sie, um eine LEERE Spalte
          // als Abwurfziel zu erkennen: sie hat keine Zeile in seinem Modell
          // (das führt nur Bausteine), aber sie ist der Ort, an dem der
          // nächste Baustein landen soll.
          //
          // Ohne das war ein frisch angelegtes Spaltenlayout unbenutzbar: die
          // Spalten waren da, der Editor sah nur Baustein-Nähte, und es gab
          // keinen Weg, etwas hineinzuziehen.
          kind: el.getAttribute("data-block-kind") ?? undefined,
          top: r.top,
          left: r.left,
          width: r.width,
          height: r.height,
        });
      }
      protokoll(`${rechtecke.length} Rechteck(e) gemessen`, grund);
      senden("rects", { rechtecke, grund });
    }
    /** Gedrosselte Messung. Der GRUND wandert mit: der Editor schließt ein
     *  offenes Kontextmenü nur beim Scrollen — dabei wandert der Abschnitt
     *  darunter weg. Bei einem nachgeladenen Bild bleibt er stehen, und ein
     *  Menü, das dabei zuklappt, wirkt wie ein Fehlklick. */
    function messenBald(grund: "layout" | "scroll" = "layout") {
      if (messUhr) return;
      messUhr = requestAnimationFrame(() => {
        messUhr = 0;
        messen(grund);
      });
    }
    const beiScroll = () => messenBald("scroll");
    const beiLayout = () => messenBald("layout");

    /** Überfahren: nur der INDEX geht hinaus. Das Rechteck dazu hat die
     *  Gegenseite schon aus `rects` — es zweimal zu schicken wäre eine zweite
     *  Quelle für dieselbe Zahl, die beim Scrollen auseinanderlaufen kann. */
    let zuletztUeberfahren: number | null = null;
    let zeigerUhr = 0;
    function aufBewegung(e: MouseEvent) {
      const idx = abschnittsIndex(e.target);
      if (idx !== zuletztUeberfahren) {
        zuletztUeberfahren = idx;
        senden("hover", { index: idx, id: abschnittsId(e.target) });
      }
      // Die ZEIGERPOSITION geht getrennt hinaus, gedrosselt auf einen Frame.
      //
      // Der Editor braucht sie, um das „+" an der Naht zu zeigen, der man sich
      // gerade nähert. Über den Abschnitts-Index allein ginge das nicht: der
      // sagt, IN welchem Abschnitt der Zeiger steht, nicht wie nah er an dessen
      // Kante ist — und genau das ist die Frage bei „hier etwas dazwischen".
      const x = e.clientX;
      const y = e.clientY;
      if (zeigerUhr) return;
      zeigerUhr = requestAnimationFrame(() => {
        zeigerUhr = 0;
        senden("zeiger", { x, y });
      });
    }
    function aufVerlassen() {
      if (zuletztUeberfahren === null) return;
      zuletztUeberfahren = null;
      senden("hover", { index: null });
      // Ohne diese Meldung bliebe das „+" an der zuletzt gestreiften Naht
      // stehen, während der Zeiger längst im Dashboard ist.
      senden("zeiger", { x: null, y: null });
    }

    /** Rechtsklick auf einen Abschnitt öffnet das Kontextmenü des Editors.
     *
     *  Das Browsermenü wird dabei unterdrückt — es stünde sonst darüber und
     *  böte „Bild speichern"/„Frame neu laden" an, was in einer Entwurfsansicht
     *  nichts zu suchen hat. Außerhalb eines Abschnitts bleibt es erlaubt. */
    function aufKontextmenue(e: MouseEvent) {
      const idx = abschnittsIndex(e.target);
      const behaelter = containerVon(e.target);
      // Kein Baustein UND kein Container: außerhalb der Seite. Dort bleibt das
      // Browsermenü erlaubt. Ein Container allein reicht dagegen — auf einem
      // leeren Abschnitt gehört „duplizieren/löschen" ins Menü, gerade dort.
      if (idx == null && !behaelter) return;
      e.preventDefault();
      senden("contextmenu", {
        index: idx,
        id: abschnittsId(e.target),
        containerId: behaelter?.id,
        containerKind: behaelter?.kind,
        x: e.clientX,
        y: e.clientY,
      });
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
        // BEDIENELEMENTE behalten ihre eigene Wirkung.
        //
        // Hier stand ein `e.preventDefault()` für jeden Klick in einem
        // Abschnitt. Der Grund dafür ist die Navigation — die ist aber eine
        // Zeile höher schon abgefangen, gezielt am `<a>`. Alles andere traf es
        // als Kollateralschaden: im Kontaktformular ließ sich das
        // Zustimmungshäkchen nicht setzen, weder per Klick auf die Box noch auf
        // den Text noch per `element.click()` — der Betrieb konnte sein eigenes
        // Formular nicht ausprobieren (Nachprüfung B4, Randbefund).
        //
        // Die Auswahl braucht das `preventDefault` nicht: sie ist eine
        // Meldung, kein Standardverhalten, das man unterdrücken müsste. Was
        // wirklich verhindert werden muss, ist ABSENDEN — ein `submit` würde
        // die Vorschau verlassen wie ein Link. Das steht unten am `submit`.
        const bedienelement = (e.target as HTMLElement)?.closest?.(
          "input, select, textarea, label, button",
        );
        if (!bedienelement) e.preventDefault();
        const behaelter = containerVon(e.target);
        senden("select", {
          index: idx,
          id: abschnittsId(e.target),
          containerId: behaelter?.id,
          containerKind: behaelter?.kind,
        });
        return;
      }

      // KEIN Baustein getroffen, aber ein Container: die leere Spalte, der
      // leere Abschnitt, der Rand zwischen zwei Spalten. Vorher endete der
      // Klick hier ohne Meldung — ein leerer Abschnitt war anklickbar wie eine
      // Wand: es passierte nichts, und es gab keinen Weg, ihn wieder
      // loszuwerden.
      const behaelter = containerVon(e.target);
      if (behaelter) {
        senden("select", {
          index: null,
          id: null,
          containerId: behaelter.id,
          containerKind: behaelter.kind,
        });
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
        id: abschnittsId(treffer.el) ?? undefined,
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
      const data = e.data as {
        source?: string;
        type?: string;
        index?: number;
        id?: string;
      } | null;
      if (data?.source === "builder-editor" && data.type === "scrollTo") {
        // Der Editor hat einen Abschnitt AUSSERHALB der Vorschau ausgewählt
        // (Ebenen-Baum, Abschnittsliste). Ohne diesen Befehl markierte er ihn
        // korrekt, die Vorschau blieb aber stehen — der markierte Abschnitt
        // war nicht im Bild (Prüfbericht D4).
        //
        // Gesucht wird über die DB-ID und NUR im Notfall über den Index: der
        // Renderer nummeriert jeden Baumknoten (Abschnitt · Spalte ·
        // Baustein), der Editor kennt nur die Bausteine. Genau diese
        // Verwechslung hat am 26.08.2026 die Auswahl auf den falschen
        // Abschnitt gesetzt.
        //
        // Ein Ziel, das es nicht gibt, wird still übergangen: die Vorschau
        // kann eine Stelle noch nicht gerendert haben, und ein Sprung auf
        // Verdacht wäre schlimmer als keiner.
        const ziel =
          (data.id
            ? document.querySelector<HTMLElement>(
                `[data-block-id="${data.id}"]`,
              )
            : null) ??
          (data.index != null
            ? document.querySelector<HTMLElement>(
                `[data-block-index="${data.index}"]`,
              )
            : null);
        if (!ziel) return;
        // `nearest`: steht der Abschnitt schon im Bild, bewegt sich nichts.
        // `center` würde bei jeder Auswahl springen, auch bei der sichtbaren.
        //
        // WARUM SELBST GERECHNET und nicht nur `scrollIntoView`:
        // Der Sprung war unzuverlässig — in 2 von 5 Durchläufen bewegte sich
        // nichts, obwohl die Nachricht mit der richtigen ID nachweislich
        // ankam, und betroffen war beide Male der Sprung NACH OBEN über die
        // ganze Seite (Nachprüfung D4). Ein laufender Smooth-Scroll wird in
        // Chrome von einem neuen verworfen, und die Vorschau scrollt aus
        // eigenem Antrieb mit (`messen("scroll")` beim Auswahlwechsel). Wer
        // dann in dasselbe Fenster einen zweiten Smooth-Scroll schickt,
        // bekommt keinen — und keine Fehlermeldung.
        //
        // Deshalb: erst prüfen, ob überhaupt gescrollt werden MUSS
        // (`nearest`-Semantik von Hand), und nur dann einen Scroll auslösen.
        // Das spart den Konflikt in genau dem Fall, in dem er auftrat.
        const r = ziel.getBoundingClientRect();
        const sicht = document.documentElement.clientHeight;
        // Überlappt der Abschnitt das Sichtfeld, bleibt alles stehen — das ist
        // `block: "nearest"`, nur nachgerechnet.
        if (r.bottom > 0 && r.top < sicht) return;
        // Sonst an die nähere Kante, wie `nearest` es täte.
        const ziel_y =
          r.top < 0
            ? window.scrollY + r.top
            : window.scrollY + r.bottom - sicht;
        window.scrollTo({ top: Math.max(0, ziel_y), behavior: "smooth" });
        return;
      }
      if (data?.source === "builder-editor" && data.type === "hello") {
        // Der Editor stellt sich vor → ab jetzt kennen wir sein Ziel.
        elternOrigin = e.origin;
        protokoll("Handschlag steht mit", e.origin);
        senden("ready", { editierbar });
        // Sofort messen: der Editor kann erst zeichnen, wenn er Rechtecke hat,
        // und der Handschlag ist der erste Moment, in dem wir sie loswerden.
        messen("hallo");
      }
    }

    // Markierte Stellen bearbeitbar machen.
    const stellen = editierbar
      ? [...document.querySelectorAll<HTMLElement>("[data-feld]")]
      : [];
    protokoll(
      `${document.querySelectorAll("[data-block-index]").length} Abschnitt(e), ` +
        `${stellen.length} bearbeitbare Textstelle(n)`,
      { editierbar },
    );
    for (const el of stellen) {
      el.contentEditable = "true";
      // Der Browser soll nur Text einfügen, kein Markup aus der Zwischenablage.
      el.setAttribute("data-editierbar", "1");
      el.style.outline = "none";
      el.style.cursor = "text";
    }

    /** Absenden in der Vorschau: NICHT.
     *
     *  Nötig, seit `aufKlick` Bedienelemente durchlässt (damit das
     *  Zustimmungshäkchen gesetzt werden kann). Ohne diesen Riegel würde ein
     *  Klick auf „Nachricht senden" das Formular wirklich abschicken — aus dem
     *  Entwurf, also mit einer Einsendung, die niemand bestellt hat, und die
     *  Vorschau verlöre ihren Token.
     *
     *  Der Betrieb kann sein Formular damit ausfüllen und ansehen, aber nicht
     *  aus der Vorschau heraus absenden. Ein Formular, das echte Anfragen aus
     *  dem Entwurf erzeugt, wäre die schlechtere Hälfte der beiden Fehler.
     *
     *  In der Capture-Phase, damit kein `onSubmit` des Renderers vorher läuft. */
    function aufAbsenden(e: Event) {
      if (!(e.target as HTMLElement)?.closest?.("[data-block-index]")) return;
      e.preventDefault();
      e.stopPropagation();
    }

    document.addEventListener("submit", aufAbsenden, true);
    document.addEventListener("click", aufKlick, true);
    document.addEventListener("blur", aufBlur, true);
    document.addEventListener("keydown", aufTaste, true);
    document.addEventListener("mousemove", aufBewegung, true);
    document.addEventListener("mouseleave", aufVerlassen, true);
    document.addEventListener("contextmenu", aufKontextmenue, true);
    window.addEventListener("message", aufNachricht);
    // `scroll` mit `capture`, weil nicht das Fenster scrollen muss: liegt der
    // Inhalt in einem eigenen Scroll-Container, blubbert sein Ereignis nicht
    // bis zum Fenster hoch, und die Rahmen wären beim Scrollen stehen
    // geblieben.
    window.addEventListener("scroll", beiScroll, true);
    window.addEventListener("resize", beiLayout);

    // Der Inhalt selbst ändert seine Höhe, ohne dass jemand scrollt oder das
    // Fenster zieht: ein Bild lädt nach, eine Schrift ersetzt die Ersatzschrift,
    // ein Abschnitt klappt auf. Ohne diesen Beobachter säßen die Rahmen danach
    // an der alten Stelle, und niemand fände den Grund.
    //
    // JEDER Abschnitt wird beobachtet, nicht nur `document.body`. Ein Bild, das
    // in einem Abschnitt nachlädt, ändert dessen Höhe — die des Dokuments aber
    // nur, wenn kein anderer Abschnitt gleichzeitig schrumpft und wenn der
    // Inhalt nicht in einem eigenen Scroll-Container liegt. Live sichtbar war
    // genau das: die Unterkante eines Abschnitts wurde vor dem Laden der Bilder
    // gemessen, und die Naht mit dem „+" saß danach mitten im Foto statt an der
    // Grenze.
    const beobachter = new ResizeObserver(beiLayout);
    beobachter.observe(document.body);
    for (const el of document.querySelectorAll("[data-block-index]")) {
      beobachter.observe(el);
    }

    // Bilder ohne feste Maße melden ihre Größe erst mit `load`. Der
    // ResizeObserver oben fängt das, sobald der Abschnitt dadurch wächst — aber
    // nicht, wenn das Bild in einen bereits reservierten Platz rutscht und nur
    // die UMGEBUNG verschiebt. Deshalb zusätzlich direkt am Ereignis hängen.
    const bilder = [...document.querySelectorAll("img")].filter(
      (b) => !b.complete,
    );
    for (const b of bilder) b.addEventListener("load", beiLayout, { once: true });

    // Schriften kommen asynchron. `document.fonts.ready` ist der Moment, in dem
    // die endgültigen Zeilenumbrüche stehen — davor gemessene Höhen sind die
    // der Ersatzschrift.
    void document.fonts?.ready?.then(beiLayout);

    return () => {
      document.removeEventListener("submit", aufAbsenden, true);
      document.removeEventListener("click", aufKlick, true);
      document.removeEventListener("blur", aufBlur, true);
      document.removeEventListener("keydown", aufTaste, true);
      document.removeEventListener("mousemove", aufBewegung, true);
      document.removeEventListener("mouseleave", aufVerlassen, true);
      document.removeEventListener("contextmenu", aufKontextmenue, true);
      window.removeEventListener("message", aufNachricht);
      window.removeEventListener("scroll", beiScroll, true);
      window.removeEventListener("resize", beiLayout);
      beobachter.disconnect();
      for (const b of bilder) b.removeEventListener("load", beiLayout);
      if (messUhr) cancelAnimationFrame(messUhr);
      if (zeigerUhr) cancelAnimationFrame(zeigerUhr);
      for (const el of stellen) el.removeAttribute("contenteditable");
    };
  }, [editierbar]);

  return null;
}
