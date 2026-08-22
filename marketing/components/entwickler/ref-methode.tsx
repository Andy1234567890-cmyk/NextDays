// Methoden-Abzeichen — die farbige Marke vor jedem Endpunkt.
//
// Farben aus den Design-Tokens, nicht aus der Tailwind-Palette: die Seite hat
// eigene Farben, und ein direktes `emerald-500` wäre eine zweite Palette
// daneben. Die Methode steht IMMER als Text da, nie nur als Farbe — sonst wäre
// die Unterscheidung für farbenblinde Leser weg.
const STIL: Record<string, string> = {
  get: "bg-surface-accent text-accent",
  post: "bg-success/10 text-success",
  put: "bg-warning/15 text-warning",
  patch: "bg-warning/15 text-warning",
  delete: "bg-destructive/10 text-destructive",
};

export function RefMethode({
  methode,
  gross = false,
}: {
  methode: string;
  gross?: boolean;
}) {
  const stil = STIL[methode.toLowerCase()] ?? "bg-surface-warm text-foreground";
  return (
    <span
      className={
        "shrink-0 rounded font-mono font-semibold uppercase " +
        (gross ? "px-2 py-1 text-xs" : "px-1.5 py-0.5 text-[0.625rem]") +
        " " +
        stil
      }
    >
      {methode}
    </span>
  );
}
