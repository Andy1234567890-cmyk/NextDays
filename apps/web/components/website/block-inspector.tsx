"use client";

// Inspector: bearbeitet Inhalt + Settings des ausgewählten Blocks. Pro Block-Typ
// ein schlankes Formular. Mehrsprachige Texte werden hier (1b) in der Default-
// Sprache "de" gepflegt; weitere Sprachen folgen. Änderungen werden debounced
// an den Editor gemeldet (onChange), der sie speichert.
import { useEffect, useState } from "react";

import { RichTextEditor } from "@/components/ui/rich-text-editor";
import { Input } from "@/components/ui/input";
import type { Block } from "@/lib/site-pages";

const LOCALE = "de";

function text(field: unknown): string {
  if (typeof field === "string") return field;
  if (field && typeof field === "object") {
    const v = (field as Record<string, unknown>)[LOCALE];
    if (typeof v === "string") return v;
  }
  return "";
}

type Patch = { content?: Record<string, unknown>; settings?: Record<string, unknown> };

export function BlockInspector({
  block,
  onChange,
}: {
  block: Block;
  onChange: (patch: Patch) => void;
}) {
  // Lokaler Entwurf des content-Objekts; debounced nach oben gemeldet.
  const [content, setContent] = useState<Record<string, unknown>>(block.content);

  // Block-Wechsel → lokalen Entwurf neu laden.
  useEffect(() => {
    setContent(block.content);
  }, [block.id]); // eslint-disable-line react-hooks/exhaustive-deps

  function set(key: string, value: unknown) {
    const next = { ...content, [key]: value };
    setContent(next);
    onChange({ content: next });
  }

  function setLocale(key: string, value: string) {
    set(key, { ...(content[key] as object), [LOCALE]: value });
  }

  return (
    <div className="flex flex-col gap-4 p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {block.type}
      </p>
      {renderFields()}
    </div>
  );

  function renderFields() {
    switch (block.type) {
      case "hero":
        return (
          <>
            <Field label="Überschrift">
              <Input
                value={text(content.heading)}
                onChange={(e) => setLocale("heading", e.target.value)}
              />
            </Field>
            <Field label="Unterzeile">
              <Input
                value={text(content.subheading)}
                onChange={(e) => setLocale("subheading", e.target.value)}
              />
            </Field>
            <Field label="Bild-URL">
              <Input
                value={(content.image_url as string) ?? ""}
                onChange={(e) => set("image_url", e.target.value)}
              />
            </Field>
            <Field label="Button-Text">
              <Input
                value={text(content.cta_label)}
                onChange={(e) => setLocale("cta_label", e.target.value)}
              />
            </Field>
            <Field label="Button-Link">
              <Input
                value={(content.cta_href as string) ?? ""}
                onChange={(e) => set("cta_href", e.target.value)}
              />
            </Field>
          </>
        );
      case "rich_text":
        return (
          <Field label="Text">
            <RichTextEditor
              value={text(content.html)}
              onChange={(html) => setLocale("html", html)}
            />
          </Field>
        );
      case "image":
        return (
          <>
            <Field label="Bild-URL">
              <Input
                value={(content.url as string) ?? ""}
                onChange={(e) => set("url", e.target.value)}
              />
            </Field>
            <Field label="Alt-Text">
              <Input
                value={text(content.alt)}
                onChange={(e) => setLocale("alt", e.target.value)}
              />
            </Field>
          </>
        );
      case "button":
        return (
          <>
            <Field label="Beschriftung">
              <Input
                value={text(content.label)}
                onChange={(e) => setLocale("label", e.target.value)}
              />
            </Field>
            <Field label="Link">
              <Input
                value={(content.href as string) ?? ""}
                onChange={(e) => set("href", e.target.value)}
              />
            </Field>
          </>
        );
      case "contact":
        return (
          <>
            <Field label="Überschrift">
              <Input
                value={text(content.headline)}
                onChange={(e) => setLocale("headline", e.target.value)}
              />
            </Field>
            <Field label="E-Mail">
              <Input
                value={(content.email as string) ?? ""}
                onChange={(e) => set("email", e.target.value)}
              />
            </Field>
            <Field label="Telefon">
              <Input
                value={(content.phone as string) ?? ""}
                onChange={(e) => set("phone", e.target.value)}
              />
            </Field>
          </>
        );
      case "search":
        return (
          <Field label="Platzhalter">
            <Input
              value={text(content.placeholder)}
              onChange={(e) => setLocale("placeholder", e.target.value)}
            />
          </Field>
        );
      case "properties_grid":
        return (
          <Field label="Überschrift">
            <Input
              value={text(content.headline)}
              onChange={(e) => setLocale("headline", e.target.value)}
            />
          </Field>
        );
      case "featured_properties":
        return (
          <>
            <Field label="Überschrift">
              <Input
                value={text(content.headline)}
                onChange={(e) => setLocale("headline", e.target.value)}
              />
            </Field>
            <Field label="Objekt-IDs (kommagetrennt)">
              <Input
                value={
                  Array.isArray(content.property_ids)
                    ? (content.property_ids as string[]).join(", ")
                    : ""
                }
                onChange={(e) =>
                  set(
                    "property_ids",
                    e.target.value
                      .split(",")
                      .map((s) => s.trim())
                      .filter(Boolean),
                  )
                }
              />
            </Field>
          </>
        );
      case "spacer":
        return (
          <Field label="Größe (sm/md/lg/xl)">
            <Input
              value={(content.size as string) ?? "md"}
              onChange={(e) => set("size", e.target.value)}
            />
          </Field>
        );
      case "gallery":
        return (
          <p className="text-sm text-muted-foreground">
            Galerie-Bilder werden in einem späteren Schritt verwaltet.
          </p>
        );
      default:
        return null;
    }
  }
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="font-medium">{label}</span>
      {children}
    </label>
  );
}
