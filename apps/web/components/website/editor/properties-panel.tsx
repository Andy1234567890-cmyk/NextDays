"use client";

// Rechter Inspektor im Framer-Stil.
//  • Nichts gewählt → „Seite"-Inspektor: Haltepunkt (Position/Größe des Frames),
//    Typography (Basis-Schriftgröße), Stile (Hintergrund).
//  • Block gewählt → Element-Inspektor: Ausrichtung, Form (Position/Größe),
//    Stile (Opazität/Sichtbar/Füllen/Radius/Drehen), + block-spezifische Felder.
// Funktionale Stil-Werte (opacity/visible/fill/radius/rotation) werden echt in
// die Node-Props geschrieben (→ settings), Position/Größe sind bei Block-Layout
// informativ (Blöcke stapeln sich, keine freie Positionierung).
import { useEditor } from "@craftjs/core";
import { Icon } from "@iconify/react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { FONT_CATALOG } from "@/lib/website-fonts";

// --- Layout-Bausteine des Inspektors ----------------------------------------
function Section({
  title,
  action,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <div className="border-b border-border px-4 py-4">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-sm font-semibold">{title}</span>
        {action}
      </div>
      {children ? <div className="flex flex-col gap-3">{children}</div> : null}
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3">
      <Label className="w-16 shrink-0 text-xs text-muted-foreground">{label}</Label>
      <div className="flex flex-1 items-center gap-2">{children}</div>
    </div>
  );
}

// Kleines Eingabefeld mit Einheit rechts (wie Framer: „600  W").
function NumBox({
  value,
  unit,
  onChange,
  disabled,
}: {
  value: number | string;
  unit?: string;
  onChange?: (v: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className={"flex flex-1 items-center rounded-md border border-border bg-background " + (disabled ? "opacity-60" : "")}>
      <input
        value={value}
        disabled={disabled}
        onChange={(e) => onChange?.(e.target.value)}
        className="w-full bg-transparent px-2.5 py-1.5 text-xs outline-none"
      />
      {unit ? <span className="pr-2.5 text-[0.625rem] uppercase text-muted-foreground">{unit}</span> : null}
    </div>
  );
}

function AlignBar() {
  const icons = [
    "ph:align-left-simple", "ph:align-center-horizontal-simple", "ph:align-right-simple",
    "ph:align-top-simple", "ph:align-center-vertical-simple", "ph:align-bottom-simple",
  ];
  return (
    <div className="flex items-center gap-1 border-b border-border px-4 py-3">
      {icons.map((ic) => (
        <button
          key={ic}
          type="button"
          className="flex size-7 items-center justify-center rounded-md text-muted-foreground transition hover:bg-secondary hover:text-foreground"
        >
          <Icon icon={ic} className="size-4" />
        </button>
      ))}
    </div>
  );
}

// --- Tabs-Kopf --------------------------------------------------------------
function InspectorTabs() {
  return (
    <div className="flex items-center justify-center gap-6 border-b border-border py-3">
      <span className="text-sm font-medium text-muted-foreground">Agent</span>
      <span className="border-b-2 border-foreground pb-0.5 text-sm font-semibold">Style</span>
    </div>
  );
}

export function PropertiesPanel() {
  const { activeId } = useEditor((state) => {
    const id = state.events.selected.values().next().value as string | undefined;
    return { activeId: id && id !== "ROOT" ? id : null };
  });

  if (!activeId) return <SeitenInspektor />;
  return <ElementInspektor id={activeId} />;
}

// --- „Seite"-Inspektor (nichts gewählt) -------------------------------------
function SeitenInspektor() {
  return (
    <div className="flex flex-col">
      <InspectorTabs />
      <AlignBar />
      <Section title="Template" action={<PlusBtn />} />
      <Section title="Haltepunkt">
        <Row label="Position">
          <NumBox value={0} unit="x" disabled />
          <NumBox value={0} unit="y" disabled />
        </Row>
        <Row label="Breite">
          <NumBox value={1200} disabled />
          <span className="rounded-md border border-border px-2 py-1.5 text-[0.625rem] text-muted-foreground">Fixed</span>
        </Row>
        <Row label="Höhe">
          <NumBox value="Auto" disabled />
          <span className="rounded-md border border-border px-2 py-1.5 text-[0.625rem] text-muted-foreground">Auto</span>
        </Row>
      </Section>
      <Section title="Layout" action={<PlusBtn />} />
      <Section title="Typography">
        <Row label="Base">
          <NumBox value={16} unit="px" disabled />
        </Row>
      </Section>
      <Section title="Overlays" action={<PlusBtn />} />
      <Section title="Effects" action={<PlusBtn />} />
      <Section title="Stile" action={<PlusBtn />} />
    </div>
  );
}

// --- Element-Inspektor (Block gewählt) --------------------------------------
function ElementInspektor({ id }: { id: string }) {
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
        <Row label="Größe">
          <NumBox value={Math.round(rect?.width ?? 0)} unit="w" disabled />
          <NumBox value={Math.round(rect?.height ?? 0)} unit="h" disabled />
        </Row>
      </Section>

      {/* Stile */}
      <Section title="Stile">
        <Row label="Opazität">
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
          <div className="flex overflow-hidden rounded-md border border-border">
            <button
              type="button"
              onClick={() => set((p) => { p.visible = true; })}
              className={"px-3 py-1 text-xs " + (bool("visible", true) ? "bg-primary text-primary-foreground" : "text-muted-foreground")}
            >
              Yes
            </button>
            <button
              type="button"
              onClick={() => set((p) => { p.visible = false; })}
              className={"px-3 py-1 text-xs " + (!bool("visible", true) ? "bg-primary text-primary-foreground" : "text-muted-foreground")}
            >
              No
            </button>
          </div>
        </Row>
        <Row label="Füllen">
          <label className="flex flex-1 items-center gap-2 rounded-md border border-border bg-background px-2 py-1">
            <input
              type="color"
              value={fill || "#ffffff"}
              onChange={(e) => set((p) => { p.background_color = e.target.value; })}
              className="size-5 shrink-0 cursor-pointer rounded border-0 bg-transparent p-0"
            />
            <span className="text-xs uppercase tracking-wide text-muted-foreground">
              {fill ? fill.replace("#", "") : "—"}
            </span>
            {fill ? (
              <button
                type="button"
                aria-label="Füllung entfernen"
                onClick={() => set((p) => { p.background_color = null; })}
                className="ml-auto text-muted-foreground hover:text-foreground"
              >
                <Icon icon="ph:x" className="size-3.5" />
              </button>
            ) : null}
          </label>
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

function PlusBtn() {
  return (
    <button
      type="button"
      aria-label="hinzufügen"
      className="flex size-5 items-center justify-center rounded text-muted-foreground transition hover:bg-secondary hover:text-foreground"
    >
      <Icon icon="ph:plus" className="size-4" />
    </button>
  );
}

// --- block-spezifische Felder (Variante, Schrift, Bild, Link …) -------------
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

function BlockFelder({
  name,
  props,
  set,
}: {
  name: string;
  props: Record<string, unknown>;
  set: (mut: (p: Record<string, unknown>) => void) => void;
}) {
  const str = (k: string) => (typeof props[k] === "string" ? (props[k] as string) : "");
  const fontPicker = (
    <Row label="Schrift">
      <NativeSelect
        value={str("font_family") || ""}
        onChange={(e) => set((p) => { p.font_family = e.target.value || null; })}
      >
        <option value="">Standard (Marke)</option>
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
            <option value="primary">Gefüllt</option>
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
        <Row label="Größe">
          <NativeSelect value={str("size") || "md"} onChange={(e) => set((p) => { p.size = e.target.value; })}>
            <option value="sm">Klein</option>
            <option value="md">Mittel</option>
            <option value="lg">Groß</option>
            <option value="xl">Sehr groß</option>
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
