"use client";

// Segmentierter Pill-Umschalter (Kalender-Optik), generisch über
// string- oder number-Werte.
//
// `variant="solid"` füllt das aktive Segment kontrastreich (dunkel auf hell)
// statt es nur abzuheben — für Formulare, in denen die Wahl den restlichen
// Feldsatz umschaltet und deshalb sofort ablesbar sein muss.
// `block` streckt die Pille auf die volle Breite mit gleich großen Segmenten.
export function Segmented<T extends string | number>({
  value,
  options,
  onChange,
  variant = "subtle",
  block = false,
}: {
  value: T;
  options: readonly { value: T; label: string }[];
  onChange: (v: T) => void;
  variant?: "subtle" | "solid";
  block?: boolean;
}) {
  const solid = variant === "solid";
  return (
    <div
      className={`${block ? "flex w-full" : "inline-flex"} rounded-full border bg-secondary p-0.5 text-sm`}
    >
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={`rounded-full px-3 py-1.5 font-medium transition-colors ${
            block ? "flex-1" : ""
          } ${
            value === o.value
              ? solid
                ? "bg-foreground text-background"
                : "bg-card text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
