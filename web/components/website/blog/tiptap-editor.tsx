"use client";

// Der Beitrags-Editor — übernommen aus dem Agentur-CMS
// (`cms/apps/admin/src/components/TiptapEditor.tsx`) und angepasst.
//
// WAS BEIM ÜBERNEHMEN GEÄNDERT WURDE UND WARUM
// ============================================
// 1. Die Symbole kommen aus Iconify (`ph:`) statt aus `lucide-react`. Das ist
//    die Bibliothek, die dieses Dashboard überall benutzt; eine zweite nur für
//    diese Leiste wären 300 kB für vierzig Glyphen.
// 2. Die Beschriftungen kommen aus `next-intl` statt aus dem eigenen
//    i18n-Modul des Agentur-CMS. Dieses Dashboard spricht 24 Sprachen, jenes
//    drei.
// 3. Bilder kommen aus der MEDIATHEK und nicht aus einem Datei-Dialog: der
//    Vermieter hat seine Fotos dort, mit Alt-Text und Verwendungsnachweis.
// 4. YouTube und Aufgabenliste sind entfernt. Ihr HTML (`iframe`, `input`)
//    fällt beim Speichern durch die `nh3`-Allowlist — die Knöpfe wären
//    Attrappen. Begründung steht in `tiptap-erweiterungen.ts`.
import { Icon } from "@iconify/react";
import { Placeholder } from "@tiptap/extensions";
import { EditorContent, type Editor, useEditor } from "@tiptap/react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";

import { Mediathek } from "../mediathek";
import { basisErweiterungen } from "./tiptap-erweiterungen";

/** Die Symbole der Leiste — EIN Ort für die Zuordnung Name → Iconify-Glyphe.
 *  So bleibt der Rumpf des Editors so, wie er im Vorbild steht. */
const G = {
  Bold: "ph:text-b",
  Italic: "ph:text-italic",
  Underline: "ph:text-underline",
  Strikethrough: "ph:text-strikethrough",
  Code: "ph:code",
  Heading1: "ph:text-h-one",
  Heading2: "ph:text-h-two",
  Heading3: "ph:text-h-three",
  List: "ph:list-bullets",
  ListOrdered: "ph:list-numbers",
  Quote: "ph:quotes",
  Code2: "ph:brackets-curly",
  Minus: "ph:minus",
  Link: "ph:link",
  Unlink: "ph:link-break",
  Image: "ph:image",
  Table: "ph:table",
  AlignLeft: "ph:text-align-left",
  AlignCenter: "ph:text-align-center",
  AlignRight: "ph:text-align-right",
  AlignJustify: "ph:text-align-justify",
  Highlighter: "ph:highlighter",
  Sub: "ph:text-subscript",
  Sup: "ph:text-superscript",
  Undo2: "ph:arrow-counter-clockwise",
  Redo2: "ph:arrow-clockwise",
  Trash2: "ph:trash",
  Columns: "ph:columns-plus-right",
  Rows: "ph:rows-plus-bottom",
} as const;

type Props = {
  /** Der Beitragstext als HTML. Nicht TipTap-JSON: unsere Seiten werden
   *  serverseitig gerendert und müssen ohne JavaScript stehen — JSON müsste
   *  dafür im Renderer erst zu HTML werden, mit einem zweiten
   *  Erweiterungssatz, der auseinanderläuft. (Genau das ist im Vorbild
   *  passiert: Editor 18 Erweiterungen, Vorschau 3.) */
  value: string;
  onWertWechsel: (html: string) => void;
};

function ToolbarButton({
  active,
  disabled,
  onClick,
  title,
  children,
}: {
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      aria-pressed={active}
      disabled={disabled}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={
        "inline-flex h-8 min-w-8 items-center justify-center rounded-(--radius) px-1.5 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40 " +
        (active
          ? "bg-secondary text-foreground"
          : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground")
      }
    >
      {children}
    </button>
  );
}

function Divider() {
  return <span className="mx-1 h-5 w-px bg-border" />;
}

const ICON = 'h-4 w-4';

// Eine kleine Palette für Textfarbe und Highlight.
const TEXT_COLORS = ['#000000', '#0b28b6', '#a575e1', '#dc2626', '#16a34a', '#d97706'];
const HIGHLIGHTS = ['#fef08a', '#bbf7d0', '#bfdbfe', '#fbcfe8', '#e9d5ff'];

export function BeitragsEditor({ value, onWertWechsel }: Props) {
  const t = useTranslations("website");
  const [mediathekOffen, setMediathekOffen] = useState(false);
  const editor = useEditor({
    immediatelyRender: false, // kein SSR-Render → kein Hydration-Mismatch
    extensions: [
      ...basisErweiterungen,
      Placeholder.configure({ placeholder: t("blog.ed.placeholder") }),
    ],
    content: value,
    // Ein leeres Dokument gibt „<p></p>" zurück. Das ist KEIN Inhalt — es als
    // solchen zu speichern hieße, ein Pflichtfeld sei gefüllt (Wurzel 4).
    onUpdate: ({ editor }) =>
      onWertWechsel(editor.isEmpty ? "" : editor.getHTML()),
    editorProps: {
      attributes: {
        class: "tiptap min-h-96 px-4 py-3 text-sm leading-relaxed focus:outline-none",
      },
    },
  });

  // Wechselt der Dialog auf einen ANDEREN Beitrag, steht im Editor noch der
  // alte Text: `content` wird nur beim Erzeugen gelesen. Ohne diesen Abgleich
  // schriebe das nächste Speichern den vorherigen Inhalt in den neuen Beitrag.
  useEffect(() => {
    if (!editor) return;
    const jetzt = editor.isEmpty ? "" : editor.getHTML();
    if (jetzt !== value) editor.commands.setContent(value, { emitUpdate: false });
  }, [editor, value]);

  if (!editor) return null;
  const ed = editor as Editor;

  // Das Bild kommt aus der MEDIATHEK und nicht aus einem Datei-Dialog: dort
  // liegen die Fotos des Betriebs samt Alt-Text und Verwendungsnachweis. Ein
  // zweiter Upload-Weg wäre ein zweiter Bestand.
  const bildEinsetzen = (url: string) => {
    ed.chain().focus().setImage({ src: url }).run();
    setMediathekOffen(false);
  };

  const addLink = () => {
    const prev = ed.getAttributes('link').href as string | undefined;
    const url = window.prompt(t("blog.ed.linkUrl"), prev ?? 'https://');
    if (url === null) return;
    if (url === '') ed.chain().focus().unsetLink().run();
    else ed.chain().focus().setLink({ href: url }).run();
  };

  const inTable = ed.isActive('table');

  return (
    <div className="w-full overflow-hidden rounded-(--radius) border border-border bg-background">
      <div className="flex flex-wrap items-center gap-0.5 border-b border-border bg-secondary/40 p-1.5">
        {/* Verlauf */}
        <ToolbarButton title={t("blog.ed.undo")} disabled={!ed.can().undo()} onClick={() => ed.chain().focus().undo().run()}>
          <Icon icon={G.Undo2} className={ICON} />
        </ToolbarButton>
        <ToolbarButton title={t("blog.ed.redo")} disabled={!ed.can().redo()} onClick={() => ed.chain().focus().redo().run()}>
          <Icon icon={G.Redo2} className={ICON} />
        </ToolbarButton>
        <Divider />

        {/* Überschriften */}
        <ToolbarButton title={t("blog.ed.h1")} active={ed.isActive('heading', { level: 1 })} onClick={() => ed.chain().focus().toggleHeading({ level: 1 }).run()}>
          <Icon icon={G.Heading1} className={ICON} />
        </ToolbarButton>
        <ToolbarButton title={t("blog.ed.h2")} active={ed.isActive('heading', { level: 2 })} onClick={() => ed.chain().focus().toggleHeading({ level: 2 }).run()}>
          <Icon icon={G.Heading2} className={ICON} />
        </ToolbarButton>
        <ToolbarButton title={t("blog.ed.h3")} active={ed.isActive('heading', { level: 3 })} onClick={() => ed.chain().focus().toggleHeading({ level: 3 }).run()}>
          <Icon icon={G.Heading3} className={ICON} />
        </ToolbarButton>
        <Divider />

        {/* Inline-Marks */}
        <ToolbarButton title={t("blog.ed.bold")} active={ed.isActive('bold')} onClick={() => ed.chain().focus().toggleBold().run()}>
          <Icon icon={G.Bold} className={ICON} />
        </ToolbarButton>
        <ToolbarButton title={t("blog.ed.italic")} active={ed.isActive('italic')} onClick={() => ed.chain().focus().toggleItalic().run()}>
          <Icon icon={G.Italic} className={ICON} />
        </ToolbarButton>
        <ToolbarButton title={t("blog.ed.underline")} active={ed.isActive('underline')} onClick={() => ed.chain().focus().toggleUnderline().run()}>
          <Icon icon={G.Underline} className={ICON} />
        </ToolbarButton>
        <ToolbarButton title={t("blog.ed.strike")} active={ed.isActive('strike')} onClick={() => ed.chain().focus().toggleStrike().run()}>
          <Icon icon={G.Strikethrough} className={ICON} />
        </ToolbarButton>
        <ToolbarButton title={t("blog.ed.code")} active={ed.isActive('code')} onClick={() => ed.chain().focus().toggleCode().run()}>
          <Icon icon={G.Code} className={ICON} />
        </ToolbarButton>
        <ToolbarButton title={t("blog.ed.subscript")} active={ed.isActive('subscript')} onClick={() => ed.chain().focus().toggleSubscript().run()}>
          <Icon icon={G.Sub} className={ICON} />
        </ToolbarButton>
        <ToolbarButton title={t("blog.ed.superscript")} active={ed.isActive('superscript')} onClick={() => ed.chain().focus().toggleSuperscript().run()}>
          <Icon icon={G.Sup} className={ICON} />
        </ToolbarButton>
        <Divider />

        {/* Textfarbe */}
        <span className="flex items-center gap-0.5" title={t("blog.ed.textColor")}>
          {TEXT_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              title={`${t("blog.ed.textColor")} ${c}`}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => ed.chain().focus().setColor(c).run()}
              className="h-5 w-5 rounded-full border border-border"
              style={{ backgroundColor: c }}
            />
          ))}
          <ToolbarButton title={t("blog.ed.resetColor")} onClick={() => ed.chain().focus().unsetColor().run()}>
            <span className="text-xs">×</span>
          </ToolbarButton>
        </span>
        <Divider />

        {/* Highlight */}
        <Icon icon={G.Highlighter} className={`${ICON} text-muted-foreground`} />
        {HIGHLIGHTS.map((c) => (
          <button
            key={c}
            type="button"
            title={`${t("blog.ed.highlight")} ${c}`}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => ed.chain().focus().toggleHighlight({ color: c }).run()}
            className="h-5 w-5 rounded border border-border"
            style={{ backgroundColor: c }}
          />
        ))}
        <Divider />

        {/* Ausrichtung */}
        <ToolbarButton title={t("blog.ed.alignLeft")} active={ed.isActive({ textAlign: 'left' })} onClick={() => ed.chain().focus().setTextAlign('left').run()}>
          <Icon icon={G.AlignLeft} className={ICON} />
        </ToolbarButton>
        <ToolbarButton title={t("blog.ed.alignCenter")} active={ed.isActive({ textAlign: 'center' })} onClick={() => ed.chain().focus().setTextAlign('center').run()}>
          <Icon icon={G.AlignCenter} className={ICON} />
        </ToolbarButton>
        <ToolbarButton title={t("blog.ed.alignRight")} active={ed.isActive({ textAlign: 'right' })} onClick={() => ed.chain().focus().setTextAlign('right').run()}>
          <Icon icon={G.AlignRight} className={ICON} />
        </ToolbarButton>
        <ToolbarButton title={t("blog.ed.alignJustify")} active={ed.isActive({ textAlign: 'justify' })} onClick={() => ed.chain().focus().setTextAlign('justify').run()}>
          <Icon icon={G.AlignJustify} className={ICON} />
        </ToolbarButton>
        <Divider />

        {/* Blöcke */}
        <ToolbarButton title={t("blog.ed.bulletList")} active={ed.isActive('bulletList')} onClick={() => ed.chain().focus().toggleBulletList().run()}>
          <Icon icon={G.List} className={ICON} />
        </ToolbarButton>
        <ToolbarButton title={t("blog.ed.orderedList")} active={ed.isActive('orderedList')} onClick={() => ed.chain().focus().toggleOrderedList().run()}>
          <Icon icon={G.ListOrdered} className={ICON} />
        </ToolbarButton>
        <ToolbarButton title={t("blog.ed.quote")} active={ed.isActive('blockquote')} onClick={() => ed.chain().focus().toggleBlockquote().run()}>
          <Icon icon={G.Quote} className={ICON} />
        </ToolbarButton>
        <ToolbarButton title={t("blog.ed.codeBlock")} active={ed.isActive('codeBlock')} onClick={() => ed.chain().focus().toggleCodeBlock().run()}>
          <Icon icon={G.Code2} className={ICON} />
        </ToolbarButton>
        <ToolbarButton title={t("blog.ed.hr")} onClick={() => ed.chain().focus().setHorizontalRule().run()}>
          <Icon icon={G.Minus} className={ICON} />
        </ToolbarButton>
        <Divider />

        {/* Einfügen */}
        <ToolbarButton title={t("blog.ed.link")} active={ed.isActive('link')} onClick={addLink}>
          <Icon icon={G.Link} className={ICON} />
        </ToolbarButton>
        <ToolbarButton title={t("blog.ed.unlink")} disabled={!ed.isActive('link')} onClick={() => ed.chain().focus().unsetLink().run()}>
          <Icon icon={G.Unlink} className={ICON} />
        </ToolbarButton>
        <ToolbarButton title={t("blog.ed.image")} onClick={() => setMediathekOffen(true)}>
          <Icon icon={G.Image} className={ICON} />
        </ToolbarButton>
        <ToolbarButton title={t("blog.ed.table")} onClick={() => ed.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}>
          <Icon icon={G.Table} className={ICON} />
        </ToolbarButton>

        {/* Tabellen-Aktionen — nur sichtbar in einer Tabelle */}
        {inTable && (
          <>
            <Divider />
            <ToolbarButton title={t("blog.ed.addColumn")} onClick={() => ed.chain().focus().addColumnAfter().run()}>
              <Icon icon={G.Columns} className={ICON} />
            </ToolbarButton>
            <ToolbarButton title={t("blog.ed.addRow")} onClick={() => ed.chain().focus().addRowAfter().run()}>
              <Icon icon={G.Rows} className={ICON} />
            </ToolbarButton>
            <ToolbarButton title={t("blog.ed.deleteTable")} onClick={() => ed.chain().focus().deleteTable().run()}>
              <Icon icon={G.Trash2} className={ICON} />
            </ToolbarButton>
          </>
        )}
      </div>

      <EditorContent
        editor={editor}
        className="cursor-text"
        onClick={() => {
          if (!ed.isFocused) ed.commands.focus("end");
        }}
      />

      {mediathekOffen ? (
        <Mediathek
          onWaehle={bildEinsetzen}
          onSchliesse={() => setMediathekOffen(false)}
        />
      ) : null}
    </div>
  );
}
