// Zweisprachige Doku (DE/EN) für die Storybook-MDX-Seiten.
//
// Der Sprach-Umschalter in der Toolbar (.storybook/preview.tsx) setzt
// data-doc-lang="de|en" am <html>. <De>/<En> rendern beide Blöcke; per CSS wird
// nur der zur aktiven Sprache passende angezeigt. CSS-Schalter statt React-State,
// weil Storybook-Globals in MDX nicht reaktiv verfügbar sind — das Attribut am
// <html> ist die eine Wahrheit.
import type { ReactNode } from "react";

// Einmalig die Sichtbarkeitsregeln einspielen (idempotent — eine <style>-ID).
const STYLE_ID = "doc-lang-style";
const CSS = `
:root[data-doc-lang="en"] [data-doc-lang-block="de"] { display: none; }
:root[data-doc-lang="de"] [data-doc-lang-block="en"] { display: none; }
/* Default ohne Attribut: Deutsch zeigen, Englisch verbergen. */
:root:not([data-doc-lang]) [data-doc-lang-block="en"] { display: none; }
`;

function ensureStyle(): void {
  if (typeof document === "undefined") return;
  if (document.getElementById(STYLE_ID)) return;
  const el = document.createElement("style");
  el.id = STYLE_ID;
  el.textContent = CSS;
  document.head.appendChild(el);
}

export function De({ children }: { children: ReactNode }) {
  ensureStyle();
  return <div data-doc-lang-block="de">{children}</div>;
}

export function En({ children }: { children: ReactNode }) {
  ensureStyle();
  return <div data-doc-lang-block="en">{children}</div>;
}

/** Inline-Variante für kurze Strings: <Lang de="Sprache" en="Language" />. */
export function Lang({ de, en }: { de: ReactNode; en: ReactNode }) {
  ensureStyle();
  return (
    <>
      <span data-doc-lang-block="de">{de}</span>
      <span data-doc-lang-block="en">{en}</span>
    </>
  );
}
