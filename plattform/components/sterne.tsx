// Sterne-Anzeige (readonly) und interaktive Sterne-Auswahl (1–5).
"use client";

import { Icon } from "@iconify/react";
import { useState } from "react";

/** Readonly-Darstellung einer Bewertung (volle/leere Sterne). */
export function Sterne({ wert, size = "size-4" }: { wert: number; size?: string }) {
  return (
    <span className="inline-flex items-center gap-0.5 text-accent">
      {[1, 2, 3, 4, 5].map((n) => (
        <Icon
          key={n}
          icon={n <= Math.round(wert) ? "ph:star-fill" : "ph:star"}
          className={size}
        />
      ))}
    </span>
  );
}

/** Interaktive Sterne-Auswahl für das Bewertungsformular. */
export function SterneWahl({
  wert,
  onChange,
}: {
  wert: number;
  onChange: (n: number) => void;
}) {
  const [hover, setHover] = useState(0);
  const anzeige = hover || wert;
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          aria-label={`${n} Sterne`}
          onClick={() => onChange(n)}
          onMouseEnter={() => setHover(n)}
          onMouseLeave={() => setHover(0)}
          className="text-accent transition-transform hover:scale-110"
        >
          <Icon
            icon={n <= anzeige ? "ph:star-fill" : "ph:star"}
            className="size-8"
          />
        </button>
      ))}
    </div>
  );
}
