"use client";

// Font-Picker des Page-Builders (Framer-artig) — Werkstatt-Nachbau.
// Suchfeld + Kategorie-Filter + Schriftenliste mit Live-Vorschau. Im Produkt
// kommt der volle Google-Fonts-Katalog über den Proxy /api/google-fonts und
// die Familien werden zur Laufzeit per <link> geladen; hier kommt der Katalog
// als Prop (Vorschau über lokal verfügbare/ähnliche Familien).
import { Icon } from "@iconify/react";
import { useMemo, useState } from "react";

export type FontEntry = {
  family: string;
  category: "sans-serif" | "serif" | "display" | "handwriting" | "monospace";
};

const CATEGORIES: { id: string; label: string }[] = [
  { id: "all", label: "Alle" },
  { id: "sans-serif", label: "Sans" },
  { id: "serif", label: "Serif" },
  { id: "display", label: "Display" },
  { id: "handwriting", label: "Schreib" },
  { id: "monospace", label: "Mono" },
];

export function FontPicker({
  fonts,
  value,
  onChange,
  onClose,
}: {
  /** Katalog (im Produkt: Google-Fonts-Liste, nach Popularität sortiert). */
  fonts: FontEntry[];
  /** Aktuell gewählte Familie (Häkchen). */
  value?: string | null;
  onChange?: (family: string) => void;
  onClose?: () => void;
}) {
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("all");

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return fonts.filter((f) => {
      if (cat !== "all" && f.category !== cat) return false;
      if (needle && !f.family.toLowerCase().includes(needle)) return false;
      return true;
    });
  }, [fonts, q, cat]);

  return (
    <div className="flex max-h-104 w-64 flex-col overflow-hidden rounded-xl border border-border bg-card shadow-2xl shadow-black/20">
      <div className="flex items-center gap-2 border-b border-border px-3 py-2">
        <Icon icon="ph:magnifying-glass" className="size-3.5 shrink-0 text-muted-foreground" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Schrift suchen …"
          className="w-full bg-transparent text-xs outline-none placeholder:text-muted-foreground"
        />
        <button
          type="button"
          aria-label="schließen"
          onClick={onClose}
          className="flex size-5 items-center justify-center rounded text-muted-foreground transition hover:bg-secondary hover:text-foreground"
        >
          <Icon icon="ph:x" className="size-3.5" />
        </button>
      </div>
      <div className="flex gap-1 border-b border-border px-2 py-1.5">
        {CATEGORIES.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => setCat(c.id)}
            className={
              "rounded-full px-2 py-0.5 text-[0.6875rem] transition " +
              (cat === c.id
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-secondary")
            }
          >
            {c.label}
          </button>
        ))}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-1">
        {filtered.length === 0 ? (
          <p className="px-2 py-6 text-center text-xs text-muted-foreground">Keine Treffer</p>
        ) : (
          filtered.map((f) => {
            const on = f.family === value;
            return (
              <button
                key={f.family}
                type="button"
                onClick={() => onChange?.(f.family)}
                className={
                  "flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left transition hover:bg-secondary " +
                  (on ? "bg-secondary" : "")
                }
                style={{
                  fontFamily: `'${f.family}', ${
                    f.category === "serif"
                      ? "serif"
                      : f.category === "monospace"
                        ? "monospace"
                        : f.category === "handwriting"
                          ? "cursive"
                          : "sans-serif"
                  }`,
                }}
              >
                <span className="flex w-3.5 shrink-0 justify-center text-primary">
                  {on ? <Icon icon="ph:check" className="size-3.5" /> : null}
                </span>
                <span className="flex-1 truncate text-sm">{f.family}</span>
                <span className="shrink-0 text-[0.625rem] uppercase text-muted-foreground/60">
                  {f.category.replace("-serif", "")}
                </span>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
