// DER Erweiterungssatz des Beitrags-Editors.
//
// Übernommen aus dem Agentur-CMS (`cms/apps/admin/src/lib/tiptapExtensions.ts`)
// und an EINE Bedingung angepasst, die es dort nicht gibt: unser Server säubert
// den Text beim Speichern mit `nh3` gegen eine Allowlist
// (`site_config/basis._RICH_TEXT_TAGS`). Ein Knopf, dessen Ergebnis dabei
// wegfällt, ist stiller Datenverlust — der Redakteur sieht sein Werk im Editor,
// speichert, und es ist weg, ohne dass irgendwo etwas stand.
//
// Deshalb sind gegenüber dem Vorbild ZWEI Erweiterungen entfernt:
//
//   · YouTube — erzeugt ein `<iframe>`. Ein Iframe aus einem Textfeld in eine
//     Gast-Seite zu lassen, hieße, fremden Code auf der Kundenwebsite
//     auszuführen. Für Videos gibt es den Video-Baustein.
//   · Aufgabenliste — erzeugt `<input type="checkbox">`. Ein Eingabefeld in
//     einem Beitrag ist für den Gast bedeutungslos (es speichert nichts) und
//     in gast-sichtbarem HTML nichts, was dort hingehört.
//
// Alles andere bleibt, und die Allowlist trägt es (0480).
//
// SCHWESTERSTELLE: `apps/api/src/features/site_config/basis.py`
// (`_RICH_TEXT_TAGS`/`_RICH_TEXT_ATTRS`). Wer hier eine Erweiterung ergänzt,
// ergänzt dort ihr Tag — sonst ist der neue Knopf eine Attrappe.
import { Color } from "@tiptap/extension-color";
import Highlight from "@tiptap/extension-highlight";
import Image from "@tiptap/extension-image";
import Subscript from "@tiptap/extension-subscript";
import Superscript from "@tiptap/extension-superscript";
import { Table } from "@tiptap/extension-table";
import TableCell from "@tiptap/extension-table-cell";
import TableHeader from "@tiptap/extension-table-header";
import TableRow from "@tiptap/extension-table-row";
import TextAlign from "@tiptap/extension-text-align";
import { TextStyle } from "@tiptap/extension-text-style";
import Underline from "@tiptap/extension-underline";
import StarterKit from "@tiptap/starter-kit";

export const basisErweiterungen = [
  // Link und Underline kommen seit TipTap 3 AUS dem StarterKit. Sie zusätzlich
  // zu registrieren wäre „Duplicate extension names" — zwei Instanzen desselben
  // Marks, deren Reihenfolge entscheidet, welche gewinnt.
  StarterKit.configure({ link: { openOnClick: false }, underline: false }),
  Underline,
  // `allowBase64: false` ist Pflicht, nicht Geschmack: sonst schmuggelt ein
  // Einfügen aus der Zwischenablage ein mehrere MB großes `data:`-URI in die
  // HTML-Spalte, das nie ein Upload-Limit passiert hat.
  Image.configure({ inline: false, allowBase64: false }),
  TextAlign.configure({ types: ["heading", "paragraph"] }),
  TextStyle,
  Color,
  Highlight.configure({ multicolor: true }),
  Subscript,
  Superscript,
  Table.configure({ resizable: true }),
  TableRow,
  TableHeader,
  TableCell,
];
