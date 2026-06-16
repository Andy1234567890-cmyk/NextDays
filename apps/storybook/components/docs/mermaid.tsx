// Rendert ein Mermaid-Diagramm aus einem Code-String — für die Architektur-Doku
// im Storybook. Reagiert auf Light/Dark (liest die .dark-Klasse am <html>).
import mermaid from "mermaid";
import { useEffect, useId, useRef, useState } from "react";

type MermaidProps = {
  chart: string;
  /** Optionaler Titel über dem Diagramm. */
  title?: string;
};

export function Mermaid({ chart, title }: MermaidProps) {
  const ref = useRef<HTMLDivElement>(null);
  const id = useId().replace(/:/g, "_");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const isDark = document.documentElement.classList.contains("dark");

    mermaid.initialize({
      startOnLoad: false,
      theme: isDark ? "dark" : "default",
      securityLevel: "loose",
      fontFamily: "system-ui, sans-serif",
    });

    mermaid
      .render(`mmd_${id}`, chart)
      .then(({ svg }) => {
        if (!cancelled && ref.current) {
          ref.current.innerHTML = svg;
          setError(null);
        }
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      });

    return () => {
      cancelled = true;
    };
  }, [chart, id]);

  return (
    <figure style={{ margin: "1.5rem 0" }}>
      {title ? (
        <figcaption
          style={{
            fontWeight: 600,
            marginBottom: "0.5rem",
            color: "var(--foreground)",
          }}
        >
          {title}
        </figcaption>
      ) : null}
      <div
        style={{
          background: "var(--card)",
          border: "1px solid var(--border)",
          borderRadius: "var(--radius)",
          padding: "1.25rem",
          overflowX: "auto",
        }}
      >
        {error ? (
          <pre style={{ color: "var(--destructive)", whiteSpace: "pre-wrap" }}>
            Diagramm-Fehler: {error}
          </pre>
        ) : (
          <div ref={ref} />
        )}
      </div>
    </figure>
  );
}
