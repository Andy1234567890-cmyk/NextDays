"use client";

// Formatierbares Eingabefeld des Posteingang-Chats (TipTap).
//
// WARUM NICHT `RichTextEditor` aus packages/ui: der ist ein FORMULAR-Feld
// (feste Mindesthöhe, große Leiste, Enter macht einen Absatz). Ein Chat-Feld
// muss das Gegenteil: mit dem Text mitwachsen, Enter sendet, Umschalt+Enter
// bricht die Zeile um. Gleiche Bibliothek, andere Bedienung.
//
// ZWEI BETRIEBSARTEN, `format`:
//
// `format="text"` (Standard, DER CHAT): was rausgeht, ist Klartext. Airbnb und
// Booking.com übertragen im Gast-Chat keinen Rich-Text — die Formatierung ist
// eine SCHREIBHILFE, die beim Senden in Zeichen übersetzt wird (Aufzählung →
// „- ", Absatz → Leerzeile). Deshalb liefert `onChange` dort den fertigen
// Klartext und nicht `editor.getHTML()`: derselbe Weg, den
// `felder.html_zu_text` serverseitig für die Objekt-Texte geht.
//
// `format="html"` (DER VORLAGEN-EDITOR): HTML ist das AUTORENFORMAT. Der
// Vorlagen-Editor speichert `body_html`; den Klartext für den Versand leitet
// der SERVER daraus ab (`body` bleibt die Versandquelle). Der Grund für den
// Unterschied ist nicht Bequemlichkeit, sondern ein live belegter Befund:
// die GLIEDERUNG kommt beim Gast an (nummerierte Listen, Aufzählungen,
// Absätze, Links — als Zeichen im Klartext), die ZEICHENAUSZEICHNUNG nicht
// (fett/kursiv/unterstrichen gehen serverseitig ersatzlos verloren). Damit die
// Gliederung eines langen Anreise-Textes beim Bearbeiten nicht bei jedem
// Speichern durch die verlustbehaftete Klartext-Runde gedreht wird, führt der
// Vorlagen-Editor das HTML selbst.
//
// Was NICHT passieren darf: ein Bedienelement, dessen Wirkung serverseitig
// wegfällt. Deshalb gibt es hier KEINEN Ausrichten-Knopf mehr (`text-align`
// ist ein style-Attribut, das die nh3-Allowlist und die Klartext-Ableitung
// beide verwerfen). Fett/Kursiv/Unterstrichen bleiben bewusst: sie sind als
// Schreibhilfe im Editor gewollt und verschwinden sauber, ohne Ersatzzeichen.
import { Icon } from "@iconify/react";
import { Placeholder } from "@tiptap/extensions";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import { Plugin, PluginKey, type Transaction } from "@tiptap/pm/state";
import { Extension, EditorContent, useEditor, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { useCallback, useEffect, useRef, useState } from "react";

// Höhe des Schreibfelds in Pixeln (der Griff arbeitet mit Zeigerkoordinaten,
// die es nur in px gibt — die einzige Stelle, an der px hier richtig ist).
const HOEHE_MIN = 60;
const HOEHE_MAX = 600;
const HOEHE_STANDARD = 96;
const HOEHE_SCHLUESSEL = "inbox.composer.hoehe";

/** Absatztext eines Knotens — Links werden zur sichtbaren URL.
 *
 * Ein Link, dessen Ziel nur im `href` steht („schreib uns **hier**"), wäre im
 * Portal-Chat verloren: der Gast liest „hier" und kann nichts anklicken.
 * Deshalb wandert das Ziel in Klammern hinter den Text — außer der Text IST
 * schon die URL, dann bliebe sie doppelt stehen.
 */
function knotenText(knoten: ProseMirrorNode): string {
  let out = "";
  knoten.descendants((kind) => {
    // Harter Umbruch (Umschalt+Enter). Er ist KEIN Textknoten — ohne diesen
    // Zweig verschmolzen „Zeile A" und „Zeile B" beim Auslesen zu einem Wort.
    if (kind.type.name === "hardBreak") {
      out += "\n";
      return;
    }
    if (!kind.isText) return;
    const text = kind.text ?? "";
    const link = kind.marks.find((m) => m.type.name === "link");
    const ziel = link ? String(link.attrs.href ?? "") : "";
    out += ziel && ziel !== text ? `${text} (${ziel})` : text;
  });
  return out;
}

/** Editor-Inhalt → Klartext, so wie der Gast ihn im Portal liest. */
export function editorZuText(editor: Editor): string {
  return dokumentZuText(editor.state.doc);
}

/** Ist dieses Editor-HTML als NACHRICHT leer?
 *
 * `"<p></p>"` ist als Zeichenkette nicht leer, als Nachricht schon — ein
 * `.trim()` auf dem HTML ließe die Vorlage „leer" speichern und der Gast bekäme
 * nichts. Bewusst KEINE zweite HTML→Klartext-Umwandlung: der Klartext entsteht
 * serverseitig (`felder.html_zu_text`), hier wird nur EINE Frage beantwortet.
 * Ein Bild/`<hr>` gäbe es in diesem Editor nicht, deshalb reicht „bleibt nach
 * dem Entfernen aller Tags noch ein Zeichen übrig".
 */
export function htmlIstLeer(html: string): boolean {
  return (
    html
      .replace(/<[^>]*>/g, "")
      .replace(/&nbsp;/g, " ")
      .trim() === ""
  );
}

/** Klartext → Editor-HTML.
 *
 * EIN ABSATZ IST EIN ABSATZ. Zuvor wurde jede Zeile zu einem eigenen `<p>`
 * und eine Leerzeile zu `<p><br></p>`. Aus der EINEN Leerzeile der Vorlage
 * wurden dadurch ZWEI sichtbare: der leere Absatz selbst plus der
 * Absatzabstand aus dem CSS. Der eingefügte Text sah anders aus als die
 * gespeicherte Vorlage — und beim Zurücklesen wuchs er weiter.
 *
 * Richtig ist die Umkehrung von `dokumentZuText`: „\n\n" trennt Absätze,
 * ein einzelnes „\n" bricht INNERHALB eines Absatzes um (`<br>`).
 */
export function textZuHtml(wert: string): string {
  if (!wert) return "";
  return wert
    .split(/\n{2,}/)
    .map((absatz) => {
      const zeilen = absatz.split("\n").map(escapeHtml);
      // Aufzählungen, die als Klartext ankommen („- …" / „1. …"), werden
      // wieder zu echten Listen — sonst verlöre ein eingefügter Vorlagentext
      // seine Gliederung und ließe sich im Editor nicht weiterführen.
      if (zeilen.every((z) => /^-\s+/.test(z))) {
        return `<ul>${zeilen.map((z) => `<li>${z.replace(/^-\s+/, "")}</li>`).join("")}</ul>`;
      }
      if (zeilen.every((z) => /^\d+\.\s+/.test(z))) {
        return `<ol>${zeilen.map((z) => `<li>${z.replace(/^\d+\.\s+/, "")}</li>`).join("")}</ol>`;
      }
      return `<p>${zeilen.join("<br>") || "<br>"}</p>`;
    })
    .join("");
}

function dokumentZuText(doc: ProseMirrorNode): string {
  const bloecke: string[] = [];
  doc.forEach((knoten) => {
    if (knoten.type.name === "bulletList" || knoten.type.name === "orderedList") {
      const zeilen: string[] = [];
      knoten.forEach((eintrag, _versatz, index) => {
        const marke =
          knoten.type.name === "orderedList" ? `${index + 1}. ` : "- ";
        zeilen.push(marke + knotenText(eintrag));
      });
      bloecke.push(zeilen.join("\n"));
      return;
    }
    bloecke.push(knotenText(knoten));
  });
  // Absätze werden durch eine LEERZEILE getrennt — die Umkehrung von
  // `textZuHtml`. Beide Richtungen müssen zueinander passen, sonst wächst der
  // Text bei jedem Einfügen/Auslesen (genau der gemeldete Fehler).
  return bloecke.join("\n\n").replace(/^\s+|\s+$/g, "");
}

/** Platzhalter `{{feld}}` — dieselbe Form, die `felder.MUSTER` serverseitig
 *  erkennt (auch Groß-/Binnenschreibung, siehe `_ALTNAMEN` dort). */
const PLATZHALTER_MUSTER = /\{\{\s*[A-Za-z0-9_]+\s*\}\}/g;

/** Hält Platzhalter unteilbar: keine Marks INNERHALB von `{{…}}`.
 *
 * DER ANLASS: markiert der Autor einen Satz und macht ihn fett, zieht TipTap
 * die Marke über alles Markierte — auch mitten durch einen Platzhalter. Zwei
 * Schadensbilder, eines davon nicht heilbar:
 *
 *   `{{guest<strong>_name}}</strong>`   → heilt serverseitig, weil
 *     `html_zu_text` die Tags entfernt und `{{guest_name}}` übrig bleibt.
 *   `<p>Hallo {{guest</p><p>_name}}</p>` → Blockgrenze. Der Klartext bekommt
 *     dazwischen eine Leerzeile, der Name ist zerrissen, kein Feld greift mehr.
 *     Der Gast liest wörtlich „{{guest".
 *
 * Vorbeugen ist deshalb zuverlässiger als reparieren: dieses Plugin räumt nach
 * JEDER Änderung alle Marks aus den `{{…}}`-Bereichen. Der Autor sieht sofort,
 * dass sein Platzhalter unformatiert bleibt, statt es erst beim Gast zu merken.
 *
 * GESUCHT WIRD JE BLOCK, NICHT JE TEXTKNOTEN. Das ist der Punkt, an dem die
 * naheliegende Fassung falsch war (in der Probe gefunden): formatiert der Autor
 * eine Auswahl, die MITTEN im Platzhalter beginnt, zerlegt TipTap den Text
 * sofort in `{{` + `guest_n` (fett) + `ame}}`. Kein einzelner Textknoten
 * enthält dann noch `{{…}}` — eine knotenweise Suche fände nichts und ließe
 * genau den Fall stehen, gegen den das Plugin gebaut ist. Über den
 * zusammengesetzten Blocktext greift der Treffer weiterhin.
 *
 * Die Blockgrenze bleibt die Grenze: ein über zwei Absätze verteilter Rest
 * wird gar nicht erst als Platzhalter behandelt — dort sieht der Autor die
 * kaputte Klammer im Klartext. Das Backend normalisiert zusätzlich; darauf
 * verlässt sich diese Seite aber NICHT.
 */
const PlatzhalterSchutz = Extension.create({
  name: "platzhalterSchutz",
  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey("platzhalterSchutz"),
        // `appendTransaction` hängt sich HINTER jede Änderung: der Autor darf
        // erst formatieren, das Ergebnis wird sofort danach bereinigt. Ein
        // `filterTransaction`, das die Formatierung verböte, wäre das falsche
        // Mittel — es blockierte dann auch den umgebenden Satz.
        appendTransaction: (_aenderungen, _alt, neu) => {
          // Erst SAMMELN, dann in EINER Transaktion räumen. Das Sammeln in
          // einem eigenen Durchgang hält die Positionen gültig: würde man
          // während `descendants` schon schreiben, verschöben spätere Treffer.
          const bereiche: { von: number; bis: number }[] = [];
          neu.doc.descendants((block, blockPos) => {
            if (!block.isTextblock) return;
            // Der zusammengesetzte Text des Blocks — über Knotengrenzen
            // hinweg. `textBetween` zählt genauso, wie ProseMirror Positionen
            // zählt, deshalb ist `blockPos + 1 + index` die echte Position.
            const text = block.textBetween(0, block.content.size, undefined, "￼");
            PLATZHALTER_MUSTER.lastIndex = 0;
            let treffer: RegExpExecArray | null = PLATZHALTER_MUSTER.exec(text);
            while (treffer !== null) {
              const von = blockPos + 1 + treffer.index;
              const bis = von + treffer[0].length;
              // Nur anfassen, was wirklich ausgezeichnet ist — sonst schriebe
              // das Plugin bei JEDEM Tastendruck eine Transaktion, obwohl es
              // nichts zu tun gibt.
              let markiert = false;
              neu.doc.nodesBetween(von, bis, (k) => {
                if (k.isText && k.marks.length > 0) markiert = true;
              });
              if (markiert) bereiche.push({ von, bis });
              treffer = PLATZHALTER_MUSTER.exec(text);
            }
            // Textblöcke schachteln sich nicht — nicht weiter absteigen, sonst
            // liefen die Textknoten darin ein zweites Mal durch.
            return false;
          });
          if (bereiche.length === 0) return null;
          const tr: Transaction = neu.tr;
          for (const { von, bis } of bereiche) {
            // `removeMark` ohne Markentyp räumt ALLE Marken des Bereichs —
            // auch solche, die dieser Editor gar nicht anbietet (eingefügtes
            // Fremd-HTML).
            tr.removeMark(von, bis);
          }
          // Kein Verlauf-Eintrag: sonst müsste man das Entfernen einzeln
          // zurücknehmen und käme per Strg+Z nie an den Stand davor.
          return tr.setMeta("addToHistory", false);
        },
      }),
    ];
  },
});

/** Fernsteuerung von außen — für den Platzhalter-Picker. */
export type ComposerGriff = {
  /** Text an der Cursorposition einsetzen (nicht am Ende anhängen). */
  einfuegen: (text: string) => void;
};

export function ComposerEditor({
  wert,
  onChange,
  onSenden,
  platzhalter,
  etiketten,
  griff,
  format = "text",
  hoeheSchluessel = HOEHE_SCHLUESSEL,
  griffSeite = "oben",
  leisteSeite = "oben",
  testId = "inbox-composer-textarea",
}: {
  wert: string;
  onChange: (text: string) => void;
  /** Was `wert`/`onChange` transportieren — siehe Kopfkommentar.
   *  `"text"` (Standard): Klartext, so wie der Gast ihn im Portal liest.
   *  `"html"`: das HTML des Editors (Vorlagen; Klartext leitet der Server ab). */
  format?: "text" | "html";
  /** Enter im Feld sendet. Ohne diesen Rückruf macht Enter einen Absatz —
   *  richtig für einen Vorlagen-Editor, in dem nichts zu senden ist. */
  onSenden?: (text: string) => void;
  platzhalter: string;
  /** Wird gesetzt, damit der Platzhalter-Picker an den Cursor schreiben kann. */
  griff?: React.RefObject<ComposerGriff | null>;
  /** Eigener Speicherplatz für die Höhe — je Einsatzort eine eigene. */
  hoeheSchluessel?: string;
  /** Wo der Ziehgriff sitzt. Im Chat OBEN (das Feld klebt unten und wächst
   *  nach oben), in einem Formular UNTEN — dort ist der Platz darunter. */
  griffSeite?: "oben" | "unten";
  /** Wo die Werkzeugleiste sitzt. Standardmäßig unten am Feld — dort, wo
   *  auch die übrigen Bedienelemente des Formulars liegen. */
  leisteSeite?: "oben" | "unten";
  testId?: string;
  etiketten: {
    bold: string;
    italic: string;
    underline: string;
    bulletList: string;
    orderedList: string;
    link: string;
    code: string;
    linkPrompt: string;
    resize: string;
  };
}) {
  // `handleKeyDown` wird von TipTap EINMAL gebaut und behält den Stand des
  // ersten Renders. Ein `onSenden`, das über die Closure auf den Text zugreift,
  // schickte dauerhaft den leeren Anfangswert — Enter täte scheinbar nichts.
  // Deshalb kommt der Text unten aus dem Editor selbst, und der Rückruf liegt
  // in einer Ref, die jeder Render aktualisiert.
  const senden = useRef(onSenden);
  senden.current = onSenden;

  // Zuletzt aus dem Editor herausgegebener Wert (Klartext bzw. HTML, je nach
  // `format`) — siehe der Effekt unten, der fremde Setzungen von unserem
  // eigenen Echo unterscheidet.
  const letzterText = useRef<string | null>(null);
  // `format` ist an jeder Einsatzstelle ein fester Wert und wechselt zur
  // Laufzeit nie; deshalb darf die `onUpdate`-Closure ihn direkt lesen (anders
  // als `onSenden`, das oben in einer Ref liegen MUSS).

  // Quelltext-Ansicht: zeigt das HTML, das der Editor wirklich führt. Ohne
  // sie lässt sich nicht nachsehen, ob eine eingefügte Vorlage die Absätze
  // trägt, die man auf dem Bildschirm zu sehen glaubt.
  const [quelltext, setQuelltext] = useState(false);

  // Höhe des Schreibfelds, per Griff verstellbar. Eine lange Vorlage ist in
  // 2,5rem nicht zu überblicken; die eingestellte Höhe überlebt den
  // Thread-Wechsel und den Seiten-Neuaufbau (localStorage), sonst müsste man
  // sie bei jeder Nachricht neu ziehen.
  const [hoehe, setHoehe] = useState(HOEHE_STANDARD);
  useEffect(() => {
    const gemerkt = Number(window.localStorage.getItem(hoeheSchluessel));
    if (gemerkt >= HOEHE_MIN && gemerkt <= HOEHE_MAX) setHoehe(gemerkt);
  }, [hoeheSchluessel]);

  const ziehen = useCallback(
    (start: React.PointerEvent) => {
      start.preventDefault();
      const startY = start.clientY;
      const startHoehe = Number(
        (start.currentTarget as HTMLElement).dataset.hoehe ?? HOEHE_STANDARD,
      );
      // Der Griff folgt dem Zeiger: sitzt er OBEN, vergrößert Ziehen nach
      // oben; sitzt er UNTEN, vergrößert Ziehen nach unten. Andersherum
      // liefe das Feld dem Finger davon.
      const richtung =
        (start.currentTarget as HTMLElement).dataset.richtung === "oben"
          ? -1
          : 1;
      const bewegen = (e: PointerEvent) => {
        const neu = Math.min(
          HOEHE_MAX,
          Math.max(HOEHE_MIN, startHoehe + richtung * (e.clientY - startY)),
        );
        setHoehe(neu);
      };
      const loslassen = () => {
        window.removeEventListener("pointermove", bewegen);
        window.removeEventListener("pointerup", loslassen);
        // Erst beim Loslassen schreiben — nicht bei jedem Pixel.
        setHoehe((h) => {
          window.localStorage.setItem(hoeheSchluessel, String(h));
          return h;
        });
      };
      window.addEventListener("pointermove", bewegen);
      window.addEventListener("pointerup", loslassen);
    },
    [hoeheSchluessel],
  );

  const editor = useEditor({
    immediatelyRender: false, // kein SSR-Render → kein Hydration-Mismatch
    extensions: [
      StarterKit.configure({
        // Im Chat gibt es keine Überschriften, Zitate oder Trennlinien —
        // sie wären beim Gast ohnehin nur Klartext ohne Wirkung.
        heading: false,
        blockquote: false,
        horizontalRule: false,
        codeBlock: false,
        // Beide stecken seit TipTap 3 IM StarterKit. Sie zusätzlich zu
        // registrieren erzeugt „Duplicate extension names" — zwei Marks
        // gleichen Namens, deren Reihenfolge entscheidet, welcher gewinnt.
        // Darum hier konfigurieren statt doppeln (wie in `RichTextEditor`).
        link: { openOnClick: false },
      }),
      // KEIN `TextAlign`: der Knopf schriebe ein `style`-Attribut auf den
      // Absatz, das serverseitig zweimal wegfällt (nh3-Allowlist und die
      // Klartext-Ableitung). Ein Bedienelement ohne Wirkung ist derselbe
      // Fehler, den der Kunde gemeldet hat, nur in neuer Form.
      PlatzhalterSchutz,
      Placeholder.configure({ placeholder: platzhalter }),
    ],
    content: "",
    editorProps: {
      attributes: {
        // Höhe kommt vom Griff (inline gesetzt), nicht aus einer Klasse.
        class:
          "tiptap tiptap-composer h-full overflow-y-auto px-3 pt-2.5 pb-1 text-sm outline-none",
      },
      handleKeyDown: (sicht, ereignis) => {
        // Enter sendet, Umschalt+Enter bricht um — Messenger-Konvention.
        // Bei offener Autovervollständigung (IME) NICHT abfangen, sonst
        // verschickt eine japanische/chinesische Eingabe den Zwischenstand.
        // Ohne `onSenden` (Vorlagen-Editor) macht Enter einen Absatz.
        if (
          !senden.current ||
          ereignis.key !== "Enter" ||
          ereignis.shiftKey ||
          ereignis.isComposing
        ) {
          return false;
        }
        // In einer Liste macht Enter einen neuen Punkt — dort NICHT senden,
        // sonst ließe sich eine Aufzählung nie zu Ende schreiben.
        if (
          sicht.state.selection.$from.node(-1)?.type.name === "listItem"
        ) {
          return false;
        }
        ereignis.preventDefault();
        senden.current(dokumentZuText(sicht.state.doc));
        return true;
      },
    },
    onUpdate: ({ editor }) => {
      // Im HTML-Modus geht das Autorenformat nach außen, im Textmodus der
      // Klartext. `letzterText` merkt sich beide Male GENAU DAS, was
      // herausgegangen ist — der Echo-Vergleich unten hängt daran.
      const wertNeu = format === "html" ? editor.getHTML() : editorZuText(editor);
      letzterText.current = wertNeu;
      onChange(wertNeu);
    },
  });

  // Von außen gesetzter Text (Vorlage, KI-Entwurf, geleert nach dem Senden,
  // Sprachassistent).
  //
  // WARUM NICHT `editorZuText(editor) === wert` ALS VERGLEICH: der Klartext ist
  // eine VERLUSTBEHAFTETE Sicht auf das Dokument. Fett/Kursiv/Unterstrichen
  // ändern ihn NICHT, und ein leerer Absatz am Ende wird weggetrimmt. Jede
  // solche Eingabe sah damit nach „unverändert" aus — und beim nächsten
  // Tastendruck, der den Klartext doch bewegte, baute `setContent` das
  // Dokument aus `textZuHtml(wert)` neu auf und warf alle Marks weg. Genau die
  // zwei gemeldeten Fehler: Enter wirkte wie ein Sprung ins Nichts, Fett hielt
  // keinen Anschlag.
  //
  // Richtig ist, den Editor SELBST die Wahrheit führen zu lassen und nur
  // fremde Setzungen zu übernehmen. `letzterText` merkt, was zuletzt aus dem
  // Editor herausgegangen ist; kommt `wert` unverändert zurück, ist es unser
  // eigenes Echo und wird ignoriert.
  //
  // Im HTML-Modus ist `wert` bereits das Dokument — dann wird er direkt
  // gesetzt. Ihn dort durch `textZuHtml` zu schicken, würde die Auszeichnung
  // beim ersten fremden Setzen (Vorlage zum Bearbeiten laden) wegwerfen.
  useEffect(() => {
    if (!editor) return;
    if (letzterText.current === wert) return;
    letzterText.current = wert;
    editor.commands.setContent(format === "html" ? wert : textZuHtml(wert), {
      emitUpdate: false,
    });
  }, [wert, editor, format]);

  // Der Platzhalter-Picker setzt AN DEN CURSOR ein, nicht ans Ende: ein
  // Platzhalter steht fast immer mitten im Satz („Hallo {{guest_name}},").
  // Bei einem `<textarea>` ging das über `selectionStart`; im Editor gibt es
  // das nicht — deshalb dieser Griff.
  useEffect(() => {
    if (!griff) return;
    griff.current = editor
      ? { einfuegen: (text) => editor.chain().focus().insertContent(text).run() }
      : null;
    return () => {
      griff.current = null;
    };
  }, [griff, editor]);

  // Link setzen/entfernen. Leere Eingabe hebt ihn auf — sonst käme man an
  // einen falsch gesetzten Link nicht mehr heran.
  const linkSetzen = useCallback(() => {
    if (!editor) return;
    const vorher = editor.getAttributes("link").href as string | undefined;
    const url = window.prompt(etiketten.linkPrompt, vorher ?? "https://");
    if (url === null) return; // abgebrochen
    if (url === "") {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
  }, [editor, etiketten.linkPrompt]);

  if (!editor) return null;

  // Ziehgriff. Nach OBEN ziehen macht das Feld immer größer — auch wenn der
  // Griff unten sitzt, denn dort wäre die umgekehrte Richtung gemeint.
  const zieher = (
    <div
      role="separator"
      aria-orientation="horizontal"
      aria-label={etiketten.resize}
      title={etiketten.resize}
      data-hoehe={hoehe}
      data-richtung={griffSeite}
      onPointerDown={ziehen}
      onDoubleClick={() => {
        setHoehe(HOEHE_STANDARD);
        window.localStorage.setItem(hoeheSchluessel, String(HOEHE_STANDARD));
      }}
      className={
        "group flex h-3 cursor-ns-resize items-center justify-center hover:bg-muted/60 " +
        (griffSeite === "oben" ? "rounded-t-2xl" : "rounded-b-2xl") +
        // Eigener Trennstrich nur, wenn nicht schon die Leiste einen zieht —
        // sonst stünden zwei Linien direkt untereinander.
        (griffSeite === "unten" && leisteSeite !== "unten"
          ? " border-t border-border"
          : "")
      }
    >
      <span className="h-0.5 w-8 rounded-full bg-border group-hover:bg-muted-foreground" />
    </div>
  );

  // Werkzeugleiste. Der Trennstrich zeigt zum Textfeld hin, damit die Leiste
  // optisch an ihm hängt und nicht frei über/unter der Karte schwebt.
  const leiste = (
    <div
      className={
        "flex items-center gap-0.5 px-2 py-1 " +
        (leisteSeite === "oben"
          ? "border-b border-border"
          : "border-t border-border")
      }
    >
        <LeistenKnopf
          icon="ph:text-b"
          label={etiketten.bold}
          aktiv={editor.isActive("bold")}
          onClick={() => editor.chain().focus().toggleBold().run()}
        />
        <LeistenKnopf
          icon="ph:text-italic"
          label={etiketten.italic}
          aktiv={editor.isActive("italic")}
          onClick={() => editor.chain().focus().toggleItalic().run()}
        />
        <LeistenKnopf
          icon="ph:text-underline"
          label={etiketten.underline}
          aktiv={editor.isActive("underline")}
          onClick={() => editor.chain().focus().toggleUnderline().run()}
        />
        <Trenner />
        <LeistenKnopf
          icon="ph:list-bullets"
          label={etiketten.bulletList}
          aktiv={editor.isActive("bulletList")}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
        />
        <LeistenKnopf
          icon="ph:list-numbers"
          label={etiketten.orderedList}
          aktiv={editor.isActive("orderedList")}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
        />
        <Trenner />
        <LeistenKnopf
          icon="ph:link-simple"
          label={etiketten.link}
          aktiv={editor.isActive("link")}
          onClick={linkSetzen}
        />
      <LeistenKnopf
        icon="ph:code"
        label={etiketten.code}
        aktiv={quelltext}
        onClick={() => setQuelltext((v) => !v)}
      />
    </div>
  );

  return (
    <>
      {griffSeite === "oben" && zieher}
      {leisteSeite === "oben" && leiste}
      <div style={{ height: `${hoehe}px` }} className="overflow-hidden">
        {quelltext ? (
          // Nur ANSEHEN, nicht bearbeiten: der Editor bleibt die Quelle der
          // Wahrheit. Ein zweiter beschreibbarer Eingang müsste bei jedem
          // Tastendruck zurückgeparst werden und würde Formatierung verlieren.
          <pre className="h-full overflow-auto px-3 py-2 font-mono text-xs whitespace-pre-wrap text-muted-foreground">
            {editor.getHTML()}
          </pre>
        ) : (
          <EditorContent editor={editor} className="h-full" />
        )}
      </div>
      {leisteSeite === "unten" && leiste}
      {griffSeite === "unten" && zieher}
      {/* Verstecktes Spiegelfeld: der Sprachassistent (und Tests) schreiben
          per DOM in `[data-testid="inbox-composer-textarea"]`. Ohne diesen
          Anker wäre das Diktat im Posteingang still kaputtgegangen.

          HIER STEHT IMMER KLARTEXT, auch im HTML-Modus. Spiegelte das Feld
          dort das Markup, würde der Sprachassistent auf `<p>Hallo</p>`
          aufsetzen und sein Diktat mitten ins Markup schreiben — der Autor
          bekäme sichtbare Tags in die Vorlage. Was von dort ZURÜCK kommt, ist
          entsprechend Klartext und wird vor dem Herausgeben wieder zum
          Dokument gemacht. */}
      <textarea
        data-testid={testId}
        value={format === "html" ? editorZuText(editor) : wert}
        onChange={(e) =>
          onChange(
            format === "html" ? textZuHtml(e.target.value) : e.target.value,
          )
        }
        tabIndex={-1}
        aria-hidden="true"
        className="sr-only"
      />
    </>
  );
}

function Trenner() {
  return <span className="mx-1 h-4 w-px bg-border" />;
}

function escapeHtml(roh: string): string {
  return roh
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function LeistenKnopf({
  icon,
  label,
  aktiv,
  onClick,
}: {
  icon: string;
  label: string;
  aktiv?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={aktiv}
      title={label}
      onClick={onClick}
      className={
        "flex size-7 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground " +
        (aktiv ? "bg-secondary text-foreground" : "")
      }
    >
      <Icon icon={icon} className="size-4" />
    </button>
  );
}
