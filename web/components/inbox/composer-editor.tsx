"use client";

// Formatierbares Eingabefeld des Posteingang-Chats (TipTap).
//
// WARUM NICHT `RichTextEditor` aus packages/ui: der ist ein FORMULAR-Feld
// (feste Mindesthöhe, große Leiste, Enter macht einen Absatz). Ein Chat-Feld
// muss das Gegenteil: mit dem Text mitwachsen, Enter sendet, Umschalt+Enter
// bricht die Zeile um. Gleiche Bibliothek, andere Bedienung.
//
// WAS RAUSGEHT, IST KLARTEXT. Airbnb und Booking.com übertragen im Gast-Chat
// keinen Rich-Text — die Formatierung ist eine SCHREIBHILFE, die beim Senden
// in Zeichen übersetzt wird (Aufzählung → „- ", Absatz → Leerzeile). Deshalb
// liefert `onChange` den fertigen Klartext und nicht `editor.getHTML()`:
// derselbe Weg, den `felder.html_zu_text` serverseitig für die Objekt-Texte
// geht. Ein Editor, dessen Fettschrift beim Gast als „<strong>" ankäme, wäre
// schlimmer als gar keiner.
import { Icon } from "@iconify/react";
import TextAlign from "@tiptap/extension-text-align";
import { Placeholder } from "@tiptap/extensions";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import { EditorContent, useEditor, type Editor } from "@tiptap/react";
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
function textZuHtml(wert: string): string {
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
  hoeheSchluessel = HOEHE_SCHLUESSEL,
  griffSeite = "oben",
  leisteSeite = "oben",
  testId = "inbox-composer-textarea",
}: {
  wert: string;
  onChange: (text: string) => void;
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
    align: string;
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

  // Zuletzt aus dem Editor herausgegebener Klartext — siehe der Effekt unten,
  // der fremde Setzungen von unserem eigenen Echo unterscheidet.
  const letzterText = useRef<string | null>(null);

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
      TextAlign.configure({ types: ["paragraph"] }),
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
      const text = editorZuText(editor);
      letzterText.current = text;
      onChange(text);
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
  useEffect(() => {
    if (!editor) return;
    if (letzterText.current === wert) return;
    letzterText.current = wert;
    editor.commands.setContent(textZuHtml(wert), { emitUpdate: false });
  }, [wert, editor]);

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

  // Ausrichtung reihum: links → mitte → rechts. Ein einzelner Knopf statt
  // dreier, wie auf der Vorlage.
  const ausrichtung = editor.isActive({ textAlign: "center" })
    ? "center"
    : editor.isActive({ textAlign: "right" })
      ? "right"
      : "left";
  const naechsteAusrichtung = { left: "center", center: "right", right: "left" }[
    ausrichtung
  ] as "left" | "center" | "right";

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
        <LeistenKnopf
          icon={
            ausrichtung === "center"
              ? "ph:text-align-center"
              : ausrichtung === "right"
                ? "ph:text-align-right"
                : "ph:text-align-left"
          }
          label={etiketten.align}
          aktiv={ausrichtung !== "left"}
          onClick={() =>
            editor.chain().focus().setTextAlign(naechsteAusrichtung).run()
          }
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
          Anker wäre das Diktat im Posteingang still kaputtgegangen. */}
      <textarea
        data-testid={testId}
        value={wert}
        onChange={(e) => onChange(e.target.value)}
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
