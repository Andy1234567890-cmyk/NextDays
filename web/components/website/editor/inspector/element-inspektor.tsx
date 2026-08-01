"use client";

// Element-Inspektor (Block gewählt): Ausrichtung, Form (Position/Größe),
// Stile (Opazität/Sichtbar/Füllen/Radius/Drehen) + block-spezifische Felder
// (Hero/Bild/Button/Text/Kontakt/Abstand).
import { useEditor } from "@craftjs/core";
import { useTranslations } from "next-intl";

import { Input } from "@nextdays/ui/input";
import { NativeSelect } from "@nextdays/ui/native-select";
import { FONT_CATALOG } from "@/lib/website-fonts";

import { AlignBar } from "./position";
import {
  FIELD_H,
  InspectorTabs,
  NumBox,
  Row,
  Section,
  Swatch,
} from "./ui";

// --- Element-Inspektor (Block gewählt) --------------------------------------
export function ElementInspektor({ id }: { id: string }) {
  const t = useTranslations("website");
  const { name, props, dom, actions } = useEditor((state) => {
    const node = state.nodes[id];
    return {
      name: node?.data.displayName ?? "",
      props: (node?.data.props ?? {}) as Record<string, unknown>,
      dom: node?.dom ?? null,
    };
  });

  const set = (mut: (p: Record<string, unknown>) => void) => actions.setProp(id, mut);
  const num = (k: string, def: number) => (typeof props[k] === "number" ? (props[k] as number) : def);
  const bool = (k: string, def: boolean) => (typeof props[k] === "boolean" ? (props[k] as boolean) : def);
  const rect = dom?.getBoundingClientRect();
  const fill = typeof props.background_color === "string" ? props.background_color : "";

  return (
    <div className="flex flex-col">
      <InspectorTabs />
      <AlignBar />

      {/* Form */}
      <Section title="Form">
        <Row label="Position">
          <NumBox value={Math.round(rect?.left ?? 0)} unit="x" disabled />
          <NumBox value={Math.round(rect?.top ?? 0)} unit="y" disabled />
        </Row>
        <Row label={t("editor.size")}>
          <NumBox value={Math.round(rect?.width ?? 0)} unit="w" disabled />
          <NumBox value={Math.round(rect?.height ?? 0)} unit="h" disabled />
        </Row>
      </Section>

      {/* Stile */}
      <Section title="Stile">
        <Row label={t("editor.opacity")}>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={num("opacity", 1)}
            onChange={(e) => set((p) => { p.opacity = Number(e.target.value); })}
            className="flex-1 accent-primary"
          />
          <span className="w-8 text-right text-xs tabular-nums">{Math.round(num("opacity", 1) * 100)}</span>
        </Row>
        <Row label="Sichtbar">
          <div className={`flex ${FIELD_H} flex-1 overflow-hidden rounded-md border border-border`}>
            <button
              type="button"
              onClick={() => set((p) => { p.visible = true; })}
              className={"flex-1 text-xs transition " + (bool("visible", true) ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-secondary")}
            >
              Ja
            </button>
            <button
              type="button"
              onClick={() => set((p) => { p.visible = false; })}
              className={"flex-1 border-l border-border text-xs transition " + (!bool("visible", true) ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-secondary")}
            >
              Nein
            </button>
          </div>
        </Row>
        <Row label={t("editor.fill")}>
          <Swatch
            color={fill}
            onColor={(hex) => set((p) => { p.background_color = hex; })}
            onRemove={fill ? () => set((p) => { p.background_color = null; }) : undefined}
          />
        </Row>
        <Row label="Radius">
          <NumBox
            value={num("radius", 0)}
            unit="px"
            onChange={(v) => set((p) => { p.radius = Math.max(0, Number(v) || 0); })}
          />
        </Row>
        <Row label="Drehen">
          <NumBox
            value={num("rotation", 0)}
            unit="°"
            onChange={(v) => set((p) => { p.rotation = Number(v) || 0; })}
          />
        </Row>
      </Section>

      {/* Block-spezifische Felder */}
      <BlockFelder name={name} props={props} set={set} />
    </div>
  );
}

// --- block-spezifische Felder (Variante, Schrift, Bild, Link …) -------------
export function pickDe(m: unknown): string {
  if (typeof m === "string") return m;
  if (m && typeof m === "object") {
    const map = m as Record<string, string>;
    return map.de ?? Object.values(map).find((v) => typeof v === "string") ?? "";
  }
  return "";
}

export function putDe(prev: unknown, text: string): Record<string, string> {
  const base = prev && typeof prev === "object" ? (prev as Record<string, string>) : {};
  return { ...base, de: text };
}

export function BlockFelder({
  name,
  props,
  set,
}: {
  name: string;
  props: Record<string, unknown>;
  set: (mut: (p: Record<string, unknown>) => void) => void;
}) {
  const t = useTranslations("website");
  const str = (k: string) => (typeof props[k] === "string" ? (props[k] as string) : "");
  const fontPicker = (
    <Row label="Schrift">
      <NativeSelect
        value={str("font_family") || ""}
        onChange={(e) => set((p) => { p.font_family = e.target.value || null; })}
      >
        <option value="">{t("editor.brandDefault")}</option>
        {FONT_CATALOG.map((f) => (
          <option key={f.family} value={f.family}>{f.label}</option>
        ))}
      </NativeSelect>
    </Row>
  );

  if (name === "Hero") {
    return (
      <>
        <Section title="Hero">
          <Row label="Variante">
            <NativeSelect value={str("variant") || "fullscreen"} onChange={(e) => set((p) => { p.variant = e.target.value; })}>
              <option value="fullscreen">Vollbild</option>
              <option value="split">Split</option>
              <option value="centered">Zentriert</option>
            </NativeSelect>
          </Row>
          {fontPicker}
          <Row label="Bild">
            <Input value={str("image_url")} placeholder="https://…" onChange={(e) => set((p) => { p.image_url = e.target.value; })} />
          </Row>
          <Row label="Button">
            <Input value={pickDe(props.cta_label)} placeholder="Text" onChange={(e) => set((p) => { p.cta_label = putDe(p.cta_label, e.target.value); })} />
          </Row>
          <Row label="Link">
            <Input value={str("cta_href")} placeholder="/objekte" onChange={(e) => set((p) => { p.cta_href = e.target.value; })} />
          </Row>
        </Section>
      </>
    );
  }
  if (name === "Bild") {
    return (
      <Section title="Bild">
        <Row label="URL">
          <Input value={str("url")} placeholder="https://…" onChange={(e) => set((p) => { p.url = e.target.value; })} />
        </Row>
      </Section>
    );
  }
  if (name === "Button") {
    return (
      <Section title="Button">
        <Row label="Link">
          <Input value={str("href")} placeholder="/objekte" onChange={(e) => set((p) => { p.href = e.target.value; })} />
        </Row>
        <Row label="Stil">
          <NativeSelect value={str("variant") || "primary"} onChange={(e) => set((p) => { p.variant = e.target.value; })}>
            <option value="primary">{t("editor.filled")}</option>
            <option value="secondary">Umrandet</option>
          </NativeSelect>
        </Row>
      </Section>
    );
  }
  if (name === "Text") {
    return (
      <Section title="Text">
        <Row label="Ausrichtung">
          <NativeSelect value={str("align") || "left"} onChange={(e) => set((p) => { p.align = e.target.value; })}>
            <option value="left">Links</option>
            <option value="center">Zentriert</option>
          </NativeSelect>
        </Row>
        {fontPicker}
      </Section>
    );
  }
  if (name === "Kontakt") {
    return (
      <Section title="Kontakt">
        <Row label="E-Mail">
          <Input value={str("email")} onChange={(e) => set((p) => { p.email = e.target.value; })} />
        </Row>
        <Row label="Telefon">
          <Input value={str("phone")} onChange={(e) => set((p) => { p.phone = e.target.value; })} />
        </Row>
      </Section>
    );
  }
  if (name === "Abstand") {
    return (
      <Section title="Abstand">
        <Row label={t("editor.size")}>
          <NativeSelect value={str("size") || "md"} onChange={(e) => set((p) => { p.size = e.target.value; })}>
            <option value="sm">Klein</option>
            <option value="md">Mittel</option>
            <option value="lg">{t("editor.large")}</option>
            <option value="xl">{t("editor.xlarge")}</option>
          </NativeSelect>
        </Row>
      </Section>
    );
  }
  return (
    <Section title={name || "Block"}>
      <p className="text-xs text-muted-foreground">
        Überschrift &amp; Texte direkt auf der Fläche bearbeiten.
      </p>
    </Section>
  );
}
