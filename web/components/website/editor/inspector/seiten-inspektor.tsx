"use client";

// „Seite"-Inspektor (nichts gewählt): Haltepunkt (Position/Breite/Höhe),
// Typography (Google-Fonts-Picker + Basisgröße), Overlays/Cursor/Effects,
// Stile (Füllen/Überlauf) — deckungsgleich zu Framers Style-Panel.
import { Icon } from "@iconify/react";
import { useTranslations } from "next-intl";
import { useRef, useState } from "react";

import { anyFontStack } from "@/lib/website-fonts";

import { FontPicker } from "../font-picker";
import { useFrame } from "../frame-context";
import { AlignBar } from "./position";
import {
  AnchoredPopover,
  FIELD_BOX,
  FIELD_H,
  HEIGHT_MODES,
  InspectorTabs,
  MinusBtn,
  NumBox,
  Padlock,
  PlusBtn,
  Row,
  Section,
  Select,
  SizeField,
  Stepper,
  Swatch,
  WIDTH_MODES,
} from "./ui";

// --- „Seite"-Inspektor (nichts gewählt) -------------------------------------
// Deckungsgleich zu Framers Style-Panel: Haltepunkt (Position/Breite/Höhe mit
// Modus-Dropdowns + Padlock), Layout, Typography (Stepper), Overlays, Cursor,
// Effects, Stile (Füllen/Überlauf), Selection, Codeüberschreibungen.
export function SeitenInspektor() {
  const t = useTranslations("website");
  const frame = useFrame();
  const [locked, setLocked] = useState(false);
  const [base, setBase] = useState(16);
  const [fill, setFill] = useState("#ffffff");
  const [overflow, setOverflow] = useState("clip");
  const [fontPickerOpen, setFontPickerOpen] = useState(false);
  const fontRowRef = useRef<HTMLDivElement>(null);
  const width = frame?.width ?? 1200;
  const isFixed = frame?.heightMode === "fixed";
  const heightValue = isFixed ? frame?.fixedHeight || 0 : frame?.autoHeight || 0;

  return (
    <div className="flex flex-col">
      <InspectorTabs />
      <AlignBar />

      <Section title="Template" action={<PlusBtn />} />

      <Section title="Haltepunkt">
        <Row label="Position">
          <NumBox value={0} axis="X" disabled />
          <NumBox value={0} axis="Y" disabled />
        </Row>
        {/* Breite/Höhe: führende w-5-Spalte (Padlock bzw. Platzhalter) hält beide
            Größenfelder exakt bündig — wie Framers Aspect-Lock-Gutter. */}
        <Row label="Breite">
          <Padlock locked={locked} onToggle={() => setLocked((v) => !v)} />
          <SizeField
            value={width}
            mode="fixed"
            modes={WIDTH_MODES}
            onValue={(v) => { const n = Number(v); if (n) frame?.setWidth(n); }}
          />
        </Row>
        <Row label={t("editor.height")}>
          <span className="w-5 shrink-0" aria-hidden />
          <SizeField
            value={isFixed ? heightValue : heightValue || "Auto"}
            mode={isFixed ? "fixed" : "auto"}
            modes={HEIGHT_MODES}
            onValue={(v) => {
              const n = Number(v);
              if (n) { frame?.setHeightMode("fixed"); frame?.setFixedHeight(n); }
            }}
            onMode={(m) => frame?.setHeightMode(m === "fixed" ? "fixed" : "auto")}
          />
        </Row>
      </Section>

      <Section title="Layout" action={<PlusBtn />} />

      <Section title="Typography">
        <div ref={fontRowRef} className="relative">
          <Row label="Schrift">
            <button
              type="button"
              onClick={() => setFontPickerOpen((v) => !v)}
              className={`flex ${FIELD_H} min-w-0 flex-1 items-center gap-2 rounded-md border border-border bg-background px-2 text-left text-xs`}
            >
              <Icon icon="ph:text-aa" className="size-3.5 shrink-0 text-muted-foreground" />
              <span className="truncate" style={frame?.fontFamily ? { fontFamily: anyFontStack(frame.fontFamily) ?? undefined } : undefined}>
                {frame?.fontFamily ?? "Standard"}
              </span>
              <Icon icon="ph:caret-down" className="ml-auto size-3 shrink-0 text-muted-foreground" />
            </button>
          </Row>
          {fontPickerOpen ? (
            <AnchoredPopover anchorRef={fontRowRef} onClose={() => setFontPickerOpen(false)} width={256} placement="left">
              <FontPicker
                value={frame?.fontFamily ?? null}
                onChange={(fam) => { frame?.setFontFamily(fam); }}
                onClose={() => setFontPickerOpen(false)}
              />
            </AnchoredPopover>
          ) : null}
        </div>
        <Row label="Base">
          <Stepper value={base} unit="px" onChange={(n) => setBase(Math.max(1, n))} />
        </Row>
      </Section>

      <Section title="Overlays" action={<PlusBtn />} />
      <Section title="Cursor" action={<PlusBtn />} />

      <Section title="Effects">
        <Row label="Seite">
          <span className={`${FIELD_BOX} ${FIELD_H} min-w-0 flex-1 gap-2 px-1.5`}>
            <span className="flex size-4 shrink-0 items-center justify-center rounded bg-primary text-primary-foreground">
              <Icon icon="ph:sparkle" className="size-2.5" />
            </span>
            <span className="truncate">{t("editor.allSides")}</span>
          </span>
        </Row>
      </Section>

      <Section title="Stile" action={<MinusBtn />}>
        <Row label={t("editor.fill")}>
          <Swatch color={fill} onColor={setFill} />
        </Row>
        <Row label={t("editor.overflow")}>
          <Select value={overflow} onChange={setOverflow}>
            <option value="clip">Clip</option>
            <option value="visible">Visible</option>
            <option value="hidden">Hidden</option>
            <option value="auto">Scroll</option>
          </Select>
        </Row>
      </Section>

      <Section title="Selection">
        <Row label="Farben">
          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            <Swatch color="#aaaaaa" opacity={100} />
            <Swatch color="#cccccc" opacity={100} />
            <Swatch color="#ffffff" opacity={100} />
          </div>
        </Row>
      </Section>

      <Section title={t("editor.codeOverrides")} action={<MinusBtn />}>
        <Row label="Datei">
          <Select defaultValue="">
            <option value="" disabled>{t("editor.choose")}</option>
            <option value="examples">Beispiele</option>
            <option value="new">{t("editor.newFile")}</option>
          </Select>
        </Row>
      </Section>
    </div>
  );
}
