"use client";

// Font-Picker (Framer-artig): Suchfeld + Kategorie-Filter + Liste des vollen
// Google-Fonts-Katalogs (über /api/google-fonts). Bei Auswahl wird die Familie
// zur Laufzeit geladen (ensureGoogleFontLoaded) und der Wert nach oben gemeldet.
// Wird sowohl global (Typography) als auch je Element (FrameInspektor) genutzt.
import { Icon } from "@iconify/react";
import { useEffect, useMemo, useRef, useState } from "react";

import {
  ensureGoogleFontLoaded,
  type GoogleFontEntry,
  loadGoogleFontCatalog,
} from "@/lib/website-fonts";

const CATEGORIES: { id: string; label: string }[] = [
  { id: "all", label: "Alle" },
  { id: "sans-serif", label: "Sans" },
  { id: "serif", label: "Serif" },
  { id: "display", label: "Display" },
  { id: "handwriting", label: "Schreib" },
  { id: "monospace", label: "Mono" },
];

export function FontPicker({
  value,
  onChange,
  onClose,
}: {
  value: string | null;
  onChange: (family: string) => void;
  onClose: () => void;
}) {
  const [catalog, setCatalog] = useState<GoogleFontEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("all");
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let alive = true;
    loadGoogleFontCatalog()
      .then((items) => { if (alive) setCatalog(items); })
      .catch(() => { if (alive) setError("Katalog nicht verfügbar (API-Key prüfen)."); });
    return () => { alive = false; };
  }, []);

  const filtered = useMemo(() => {
    if (!catalog) return [];
    const needle = q.trim().toLowerCase();
    return catalog.filter((f) => {
      if (cat !== "all" && f.category !== cat) return false;
      if (needle && !f.family.toLowerCase().includes(needle)) return false;
      return true;
    });
  }, [catalog, q, cat]);

  // Sichtbare Fonts vorab laden, damit die Vorschau in der Liste wirkt
  // (nur die ersten ~40 gefilterten — sonst zu viele <link>).
  useEffect(() => {
    for (const f of filtered.slice(0, 40)) ensureGoogleFontLoaded(f.family);
  }, [filtered]);

  return (
    <div className="flex max-h-[26rem] w-64 flex-col overflow-hidden rounded-xl border border-border bg-card shadow-2xl shadow-black/20">
      <div className="flex items-center gap-2 border-b border-border px-3 py-2">
        <Icon icon="ph:magnifying-glass" className="size-3.5 shrink-0 text-muted-foreground" />
        <input
          autoFocus
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Schrift suchen …"
          className="w-full bg-transparent text-xs outline-none placeholder:text-muted-foreground"
        />
        <button type="button" aria-label="schließen" onClick={onClose} className="flex size-5 items-center justify-center rounded text-muted-foreground transition hover:bg-secondary hover:text-foreground">
          <Icon icon="ph:x" className="size-3.5" />
        </button>
      </div>
      <div className="flex gap-1 border-b border-border px-2 py-1.5">
        {CATEGORIES.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => setCat(c.id)}
            className={"rounded-full px-2 py-0.5 text-[0.6875rem] transition " + (cat === c.id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-secondary")}
          >
            {c.label}
          </button>
        ))}
      </div>
      <div ref={listRef} className="min-h-0 flex-1 overflow-y-auto p-1">
        {error ? (
          <p className="px-2 py-6 text-center text-xs text-muted-foreground">{error}</p>
        ) : !catalog ? (
          <p className="px-2 py-6 text-center text-xs text-muted-foreground">Lade Katalog …</p>
        ) : filtered.length === 0 ? (
          <p className="px-2 py-6 text-center text-xs text-muted-foreground">Keine Treffer</p>
        ) : (
          filtered.map((f) => {
            const on = f.family === value;
            return (
              <button
                key={f.family}
                type="button"
                onClick={() => { ensureGoogleFontLoaded(f.family); onChange(f.family); }}
                className={"flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left transition hover:bg-secondary " + (on ? "bg-secondary" : "")}
                style={{ fontFamily: `'${f.family}', ${f.category === "serif" ? "serif" : f.category === "monospace" ? "monospace" : "sans-serif"}` }}
              >
                <span className="flex w-3.5 shrink-0 justify-center text-primary">
                  {on ? <Icon icon="ph:check" className="size-3.5" /> : null}
                </span>
                <span className="flex-1 truncate text-sm">{f.family}</span>
                <span className="shrink-0 text-[0.625rem] uppercase text-muted-foreground/60">{f.category.replace("-serif", "")}</span>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
