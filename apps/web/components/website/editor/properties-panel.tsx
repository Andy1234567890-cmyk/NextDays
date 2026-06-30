"use client";

// Eigenschaften-Panel (rechts) — kontextuell zum ausgewählten Block. Liest die
// Props des selektierten Craft-Node über die Editor-Query (das Panel liegt
// außerhalb der Canvas, hat also keinen Node-Context) und schreibt LIVE zurück
// (setProp → Canvas aktualisiert sofort). Steuert, was NICHT inline auf der
// Fläche geht: Variante, Schrift (Font-Katalog), Bild, Link, Größe.
import { useEditor } from "@craftjs/core";
import { Icon } from "@iconify/react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { FONT_CATALOG } from "@/lib/website-fonts";

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border-b border-border px-4 py-4">
      <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </p>
      <div className="flex flex-col gap-3">{children}</div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <Label className="text-xs">{label}</Label>
      {children}
    </label>
  );
}

// Locale-Map de lesen/schreiben (Panel-Felder, die Text setzen).
function pickDe(m: unknown): string {
  if (typeof m === "string") return m;
  if (m && typeof m === "object") {
    const map = m as Record<string, string>;
    return map.de ?? Object.values(map).find((v) => typeof v === "string") ?? "";
  }
  return "";
}
function putDe(prev: unknown, text: string): Record<string, string> {
  const base = prev && typeof prev === "object" ? (prev as Record<string, string>) : {};
  return { ...base, de: text };
}

export function PropertiesPanel() {
  const { active } = useEditor((state) => {
    const id = state.events.selected.values().next().value as string | undefined;
    return { active: id && id !== "ROOT" ? id : null };
  });

  if (!active) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 px-6 text-center text-sm text-muted-foreground">
        <Icon icon="ph:cursor-click" className="size-6" />
        <p>Klicken Sie einen Block auf der Seite an, um ihn zu bearbeiten.</p>
      </div>
    );
  }

  return <PanelForId id={active} />;
}

// Panel-Inhalt für eine konkrete Node-ID: lesen/schreiben über useEditor.
function PanelForId({ id }: { id: string }) {
  const { name, props, actions } = useEditor((state) => {
    const node = state.nodes[id];
    return {
      name: node?.data.displayName ?? "",
      props: (node?.data.props ?? {}) as Record<string, unknown>,
    };
  });

  const set = (mut: (p: Record<string, unknown>) => void) => actions.setProp(id, mut);
  const str = (k: string) => (typeof props[k] === "string" ? (props[k] as string) : "");

  const fontPicker = (
    <Field label="Schrift">
      <NativeSelect
        value={str("font_family") || ""}
        onChange={(e) => set((p) => { p.font_family = e.target.value || null; })}
      >
        <option value="">Standard (Marken-Schrift)</option>
        {FONT_CATALOG.map((f) => (
          <option key={f.family} value={f.family}>{f.label}</option>
        ))}
      </NativeSelect>
    </Field>
  );

  if (name === "Hero") {
    return (
      <div className="flex flex-col">
        <Group title="Layout">
          <Field label="Variante">
            <NativeSelect value={str("variant") || "fullscreen"} onChange={(e) => set((p) => { p.variant = e.target.value; })}>
              <option value="fullscreen">Vollbild</option>
              <option value="split">Split (Bild/Text)</option>
              <option value="centered">Zentriert</option>
            </NativeSelect>
          </Field>
          {fontPicker}
        </Group>
        <Group title="Bild">
          <Field label="Bild-URL">
            <Input value={str("image_url")} placeholder="https://…" onChange={(e) => set((p) => { p.image_url = e.target.value; })} />
          </Field>
        </Group>
        <Group title="Button">
          <Field label="Button-Text">
            <Input value={pickDe(props.cta_label)} placeholder="z. B. Jetzt buchen" onChange={(e) => set((p) => { p.cta_label = putDe(p.cta_label, e.target.value); })} />
          </Field>
          <Field label="Button-Link">
            <Input value={str("cta_href")} placeholder="/objekte" onChange={(e) => set((p) => { p.cta_href = e.target.value; })} />
          </Field>
        </Group>
      </div>
    );
  }
  if (name === "Bild") {
    return (
      <Group title="Bild">
        <Field label="Bild-URL">
          <Input value={str("url")} placeholder="https://…" onChange={(e) => set((p) => { p.url = e.target.value; })} />
        </Field>
      </Group>
    );
  }
  if (name === "Button") {
    return (
      <Group title="Button">
        <Field label="Link">
          <Input value={str("href")} placeholder="/objekte" onChange={(e) => set((p) => { p.href = e.target.value; })} />
        </Field>
        <Field label="Stil">
          <NativeSelect value={str("variant") || "primary"} onChange={(e) => set((p) => { p.variant = e.target.value; })}>
            <option value="primary">Gefüllt</option>
            <option value="secondary">Umrandet</option>
          </NativeSelect>
        </Field>
      </Group>
    );
  }
  if (name === "Text") {
    return (
      <Group title="Text">
        <Field label="Ausrichtung">
          <NativeSelect value={str("align") || "left"} onChange={(e) => set((p) => { p.align = e.target.value; })}>
            <option value="left">Links</option>
            <option value="center">Zentriert</option>
          </NativeSelect>
        </Field>
      </Group>
    );
  }
  if (name === "Kontakt") {
    return (
      <Group title="Kontakt">
        <Field label="E-Mail">
          <Input value={str("email")} onChange={(e) => set((p) => { p.email = e.target.value; })} />
        </Field>
        <Field label="Telefon">
          <Input value={str("phone")} onChange={(e) => set((p) => { p.phone = e.target.value; })} />
        </Field>
      </Group>
    );
  }
  if (name === "Abstand") {
    return (
      <Group title="Abstand">
        <Field label="Größe">
          <NativeSelect value={str("size") || "md"} onChange={(e) => set((p) => { p.size = e.target.value; })}>
            <option value="sm">Klein</option>
            <option value="md">Mittel</option>
            <option value="lg">Groß</option>
            <option value="xl">Sehr groß</option>
          </NativeSelect>
        </Field>
      </Group>
    );
  }
  return (
    <Group title={name || "Block"}>
      <p className="text-sm text-muted-foreground">
        Überschrift &amp; Texte direkt auf der Fläche bearbeiten.
      </p>
    </Group>
  );
}
