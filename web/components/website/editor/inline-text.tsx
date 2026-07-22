"use client";

// Inline-editierbarer Text DIREKT auf der Canvas (wie Figma/Framer: anklicken
// und im Element selbst tippen). contentEditable, speichert beim Tippen in die
// Craft-Node-Prop. Kein Side-Panel-Feld nötig.
import { useEffect, useRef } from "react";

type Tag = "div" | "h1" | "h2" | "h3" | "p" | "span";

export function InlineText({
  value,
  onChange,
  className,
  style,
  as = "div",
  placeholder,
  editable = true,
}: {
  value: string;
  onChange: (next: string) => void;
  className?: string;
  style?: React.CSSProperties;
  as?: Tag;
  placeholder?: string;
  editable?: boolean;
}) {
  const ref = useRef<HTMLElement | null>(null);

  // contentEditable wird NICHT über React-children kontrolliert (sonst springt
  // der Cursor beim Tippen an den Anfang). Den Textinhalt setzen wir nur über das
  // DOM, und nur wenn er vom aktuellen DOM-Inhalt abweicht (externe Änderung,
  // z. B. Inspector-Feld) — und nie während das Feld den Fokus hat.
  useEffect(() => {
    const el = ref.current;
    if (el && document.activeElement !== el && el.textContent !== value) {
      el.textContent = value;
    }
  }, [value]);

  // Initialinhalt einmal beim Mount setzen.
  const setRef = (el: HTMLElement | null) => {
    ref.current = el;
    if (el && el.textContent !== value) el.textContent = value;
  };

  const shared = {
    contentEditable: editable,
    suppressContentEditableWarning: true,
    "data-placeholder": placeholder,
    "data-inline-text": "",
    className,
    style,
    onInput: (e: React.SyntheticEvent<HTMLElement>) =>
      onChange(e.currentTarget.textContent ?? ""),
    onMouseDown: (e: React.MouseEvent) => {
      if (editable) e.stopPropagation();
    },
  };

  // KEINE children — der Inhalt lebt ausschließlich im DOM (siehe oben).
  switch (as) {
    case "h1":
      return <h1 ref={setRef} {...shared} />;
    case "h2":
      return <h2 ref={setRef} {...shared} />;
    case "h3":
      return <h3 ref={setRef} {...shared} />;
    case "p":
      return <p ref={setRef} {...shared} />;
    case "span":
      return <span ref={setRef} {...shared} />;
    default:
      return <div ref={setRef} {...shared} />;
  }
}
