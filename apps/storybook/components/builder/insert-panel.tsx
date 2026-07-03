"use client";

// Insert-Modus des Page-Builders — Werkstatt-Nachbau. Im Produkt wechselt
// „+" die linke Sidebar in diesen Modus: links Kategorien (Elements/CMS),
// rechts ein Kachel-Grid der Bausteine; Klick fügt den Block auf der Canvas
// ein. Hier meldet der Klick nur das Label nach oben (props-getrieben, ohne
// craft.js). Buchungs-Bausteine sind grün markiert — das ist der Vorsprung
// gegenüber reinen Website-Buildern: die Buchungs-Engine ist ein Block.
import { Icon } from "@iconify/react";
import { useState } from "react";

type Baustein = { label: string; icon: string; booking?: boolean };

type Kategorie = {
  id: string;
  label: string;
  icon: string;
  gruppe: "elements" | "cms";
  bausteine: Baustein[];
};

// Identisch zum echten Editor (Kategorien Layout/Inhalt/Medien/Buchung).
export const KATEGORIEN: Kategorie[] = [
  {
    id: "layout",
    label: "Layout",
    icon: "ph:layout",
    gruppe: "elements",
    bausteine: [
      { label: "Hero", icon: "ph:image-square" },
      { label: "Abstand", icon: "ph:arrows-out-line-vertical" },
    ],
  },
  {
    id: "inhalt",
    label: "Inhalt",
    icon: "ph:text-aa",
    gruppe: "elements",
    bausteine: [
      { label: "Text", icon: "ph:text-aa" },
      { label: "Button", icon: "ph:cursor-click" },
      { label: "Kontakt", icon: "ph:envelope" },
    ],
  },
  {
    id: "medien",
    label: "Medien",
    icon: "ph:image",
    gruppe: "elements",
    bausteine: [
      { label: "Bild", icon: "ph:image" },
      { label: "Galerie", icon: "ph:images" },
    ],
  },
  {
    id: "buchung",
    label: "Buchung",
    icon: "ph:calendar-check",
    gruppe: "cms",
    bausteine: [
      { label: "Suche", icon: "ph:magnifying-glass", booking: true },
      { label: "Objekt-Grid", icon: "ph:grid-four", booking: true },
    ],
  },
];

export function InsertPanel({
  onInsert,
}: {
  /** Wird beim Klick auf eine Baustein-Kachel mit dem Label aufgerufen. */
  onInsert?: (label: string) => void;
}) {
  const [aktiv, setAktiv] = useState(KATEGORIEN[0].id);
  const [q, setQ] = useState("");

  const kategorie = KATEGORIEN.find((k) => k.id === aktiv) ?? KATEGORIEN[0];
  const suche = q.trim().toLowerCase();
  const bausteine = suche
    ? KATEGORIEN.flatMap((k) => k.bausteine).filter((b) =>
        b.label.toLowerCase().includes(suche),
      )
    : kategorie.bausteine;

  const elements = KATEGORIEN.filter((k) => k.gruppe === "elements");
  const cms = KATEGORIEN.filter((k) => k.gruppe === "cms");

  return (
    <div className="flex h-96 w-136 overflow-hidden rounded-xl border border-border bg-card">
      {/* Linke Spalte: Suche + Kategorien */}
      <div className="flex w-56 shrink-0 flex-col overflow-y-auto border-r border-border">
        <div className="p-3">
          <div className="flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2">
            <Icon icon="ph:magnifying-glass" className="size-4 text-muted-foreground" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search..."
              className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
          </div>
        </div>
        <Gruppe title="Elements" items={elements} aktiv={aktiv} suche={!!suche} onPick={setAktiv} />
        <Gruppe title="CMS" items={cms} aktiv={aktiv} suche={!!suche} onPick={setAktiv} />
      </div>

      {/* Rechte Spalte: Kachel-Grid der Bausteine */}
      <div className="h-full flex-1 overflow-y-auto p-3">
        <div className="grid grid-cols-2 gap-2.5">
          {bausteine.map((b) => (
            <button
              key={b.label}
              type="button"
              onClick={() => onInsert?.(b.label)}
              className="group flex h-30 flex-col items-center justify-center gap-2.5 rounded-xl bg-secondary/60 transition hover:bg-secondary hover:ring-2 hover:ring-primary/30"
            >
              <Icon
                icon={b.icon}
                className={"size-7 " + (b.booking ? "text-emerald-600" : "text-foreground/70")}
              />
              <span className="flex items-center gap-1 text-xs font-medium">
                {b.label}
                {b.booking ? (
                  <span className="rounded-full bg-emerald-100 px-1 py-0.5 text-[0.5rem] font-semibold text-emerald-700">
                    Buchung
                  </span>
                ) : null}
              </span>
            </button>
          ))}
          {bausteine.length === 0 ? (
            <p className="col-span-2 py-8 text-center text-sm text-muted-foreground">
              Keine Bausteine gefunden
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function Gruppe({
  title,
  items,
  aktiv,
  suche,
  onPick,
}: {
  title: string;
  items: Kategorie[];
  aktiv: string;
  suche: boolean;
  onPick: (id: string) => void;
}) {
  return (
    <div className="px-2 pb-2">
      <p className="px-2 py-1.5 text-[0.6875rem] font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </p>
      <div className="flex flex-col gap-0.5">
        {items.map((k) => (
          <button
            key={k.id}
            type="button"
            onClick={() => onPick(k.id)}
            className={
              "flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-sm transition " +
              (aktiv === k.id && !suche
                ? "bg-secondary font-medium text-foreground"
                : "text-foreground hover:bg-secondary/60")
            }
          >
            <Icon icon={k.icon} className="size-4 text-muted-foreground" />
            {k.label}
            <Icon icon="ph:caret-right" className="ml-auto size-3.5 text-muted-foreground/50" />
          </button>
        ))}
      </div>
    </div>
  );
}
