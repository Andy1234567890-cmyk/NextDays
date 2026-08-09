"use client";

// Rich-Text-Editor auf TipTap-Basis (für Beschreibungstexte).
// Toolbar mit Fett/Kursiv/Durchstreichen/Listen/Link. Icons via Iconify (ph:*).
// Styling über semantische Tokens — fügt sich ins Formular ein.
import { Icon } from "@iconify/react";
import Image from "@tiptap/extension-image";
import { Placeholder } from "@tiptap/extensions";
import { EditorContent, useEditor, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { useCallback, useRef, useState } from "react";

import { cn } from "./utils";

type RichTextEditorProps = {
  value?: string;
  onChange?: (html: string) => void;
  placeholder?: string;
  /**
   * Optionaler Bild-Upload. Bekommt die gewählte Datei, gibt die fertige URL
   * zurück — der Editor lädt selbst nichts hoch und kennt keinen Endpunkt.
   *
   * OHNE diese Prop verhält sich der Editor exakt wie vorher: kein Bild-Knopf,
   * keine Bild-Extension im Schema. Die sechs bestehenden Nutzer in web/
   * bleiben dadurch unberührt.
   */
  bildUpload?: (datei: File) => Promise<string>;
  /** `accept` des versteckten Datei-Feldes. Standard: nur PNG und WebP. */
  bildAccept?: string;
};

export function RichTextEditor({
  value = "",
  onChange,
  placeholder,
  bildUpload,
  bildAccept = "image/png,image/webp",
}: RichTextEditorProps) {
  // Die Prop kann sich zur Laufzeit nicht sinnvoll umdrehen (der Editor wird je
  // Einsatzort einmal gemountet) — deshalb reicht die Auswertung beim Bau der
  // Extension-Liste. Ohne Upload-Funktion existiert `image` gar nicht erst im
  // Schema, ein eingefügtes <img> wird also weiterhin verworfen wie bisher.
  const mitBildern = Boolean(bildUpload);

  const editor = useEditor({
    immediatelyRender: false, // kein SSR-Render → kein Hydration-Mismatch
    extensions: [
      // Link kommt seit TipTap 3 AUS dem StarterKit. Ihn zusätzlich als eigene
      // Extension zu registrieren erzeugte „Duplicate extension names: ['link']"
      // — zwei Instanzen desselben Marks mit eigenen Optionen, deren Reihenfolge
      // entscheidet, welche gewinnt. Darum hier konfigurieren, nicht doppeln.
      StarterKit.configure({ link: { openOnClick: false } }),
      Placeholder.configure({ placeholder: placeholder ?? "" }),
      // allowBase64: false ist Pflicht, nicht Geschmack: sonst schmuggelt ein
      // Copy-Paste aus der Zwischenablage ein mehrere MB großes data:-URI in
      // die HTML-Spalte, das nie ein Upload-Limit passiert hat.
      ...(mitBildern ? [Image.configure({ inline: false, allowBase64: false })] : []),
    ],
    content: value,
    editorProps: {
      attributes: {
        class: "tiptap min-h-32 px-3 py-2 text-sm outline-none",
        "data-placeholder": placeholder ?? "",
      },
    },
    onUpdate: ({ editor }) => onChange?.(editor.getHTML()),
  });

  if (!editor) return null;

  return (
    <div className="rounded-(--radius) border border-input bg-background focus-within:ring-2 focus-within:ring-ring">
      <Toolbar editor={editor} bildUpload={bildUpload} bildAccept={bildAccept} />
      <EditorContent editor={editor} />
    </div>
  );
}

function Toolbar({
  editor,
  bildUpload,
  bildAccept,
}: {
  editor: Editor;
  bildUpload?: (datei: File) => Promise<string>;
  bildAccept: string;
}) {
  const dateiFeld = useRef<HTMLInputElement>(null);
  const [laedt, setLaedt] = useState(false);

  const setLink = useCallback(() => {
    const previous = editor.getAttributes("link").href as string | undefined;
    const url = window.prompt("Link-URL", previous ?? "https://");
    if (url === null) return; // abgebrochen
    if (url === "") {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
  }, [editor]);

  const bildWaehlen = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const datei = e.target.files?.[0];
      // Das Feld sofort leeren: sonst löst dieselbe Datei beim zweiten Mal kein
      // change-Event aus und der Nutzer glaubt, der Knopf sei kaputt.
      e.target.value = "";
      if (!datei || !bildUpload) return;
      setLaedt(true);
      try {
        const url = await bildUpload(datei);
        editor.chain().focus().setImage({ src: url }).run();
      } finally {
        // Fehler meldet der Aufrufer (er kennt den Kontext); hier zählt nur,
        // dass der Knopf nicht dauerhaft im Ladezustand hängen bleibt.
        setLaedt(false);
      }
    },
    [editor, bildUpload],
  );

  return (
    <div className="flex flex-wrap items-center gap-0.5 border-b border-input p-1">
      <ToolbarButton
        icon="ph:text-b"
        label="Fett"
        active={editor.isActive("bold")}
        onClick={() => editor.chain().focus().toggleBold().run()}
      />
      <ToolbarButton
        icon="ph:text-italic"
        label="Kursiv"
        active={editor.isActive("italic")}
        onClick={() => editor.chain().focus().toggleItalic().run()}
      />
      <ToolbarButton
        icon="ph:text-strikethrough"
        label="Durchgestrichen"
        active={editor.isActive("strike")}
        onClick={() => editor.chain().focus().toggleStrike().run()}
      />

      <Divider />

      <ToolbarButton
        icon="ph:list-bullets"
        label="Aufzählung"
        active={editor.isActive("bulletList")}
        onClick={() => editor.chain().focus().toggleBulletList().run()}
      />
      <ToolbarButton
        icon="ph:list-numbers"
        label="Nummerierte Liste"
        active={editor.isActive("orderedList")}
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
      />
      <ToolbarButton
        icon="ph:quotes"
        label="Zitat"
        active={editor.isActive("blockquote")}
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
      />

      <Divider />

      <ToolbarButton
        icon="ph:link"
        label="Link"
        active={editor.isActive("link")}
        onClick={setLink}
      />
      <ToolbarButton
        icon="ph:minus"
        label="Trennlinie"
        onClick={() => editor.chain().focus().setHorizontalRule().run()}
      />

      {bildUpload && (
        <>
          <Divider />
          <ToolbarButton
            icon={laedt ? "ph:spinner" : "ph:image"}
            label={laedt ? "Bild wird hochgeladen" : "Bild einfügen"}
            disabled={laedt}
            onClick={() => dateiFeld.current?.click()}
          />
          <input
            ref={dateiFeld}
            type="file"
            accept={bildAccept}
            className="hidden"
            onChange={(e) => void bildWaehlen(e)}
          />
        </>
      )}
    </div>
  );
}

function ToolbarButton({
  icon,
  label,
  active,
  disabled,
  onClick,
}: {
  icon: string;
  label: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={active}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "flex size-8 items-center justify-center rounded-(--radius) text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground disabled:opacity-50",
        active && "bg-secondary text-foreground",
      )}
    >
      <Icon icon={icon} className="size-4" />
    </button>
  );
}

function Divider() {
  return <span className="mx-1 h-5 w-px bg-border" />;
}
