// Schlanker, neutraler Footer der white-label Agentur-Site. Zeigt den Marken-
// namen der Agentur (aus dem Branding) — KEIN myBestDays-Marktplatz-Inhalt,
// keine festen Reiseziele. Inhalte gehören in einen Kontakt-/Text-Block der Seite.
export function SiteFooter({ siteName }: { siteName?: string | null }) {
  const year = 2026;
  return (
    <footer className="border-t border-border bg-secondary/30">
      <div className="mx-auto flex max-w-7xl flex-col items-center gap-1 px-6 py-8 text-center text-sm text-muted-foreground">
        <p>
          © {year} {siteName ?? ""}
        </p>
        <p className="text-xs">Powered by myNextDays</p>
      </div>
    </footer>
  );
}
