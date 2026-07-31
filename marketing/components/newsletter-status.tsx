// Gemeinsame Hülle der beiden Newsletter-Seiten (Bestätigung, Abmeldung).
//
// Beide Seiten sind Ziel eines Links aus einer E-Mail — der erste Eindruck der
// Marke für jemanden, der uns noch gar nicht kennt. Deshalb dieselbe Umgebung
// wie überall sonst: Kopfzeile, Fußzeile und eine gezeichnete Illustration im
// getönten Kreis (Muster aus marketing-benefits), statt nackter Systemtext.
//
// Die Illustrationen liegen hier und nicht in components/marketing/
// illustrations.tsx, damit die Newsletter-Strecke unabhängig bleibt.
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { MarketingFooter } from "@/components/marketing/marketing-footer";
import { MarketingNav } from "@/components/marketing/marketing-nav";

const STROKE = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2.5,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

/** Bestätigt: Briefumschlag mit Haken. */
export function IllustrationBestaetigt({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 96 96" className={className} aria-hidden>
      <path d="M14 28h56v40H14z" {...STROKE} />
      <path d="M14 30l28 20 28-20" {...STROKE} opacity="0.55" />
      <circle cx="72" cy="66" r="16" {...STROKE} />
      <path d="M64 66l6 6 12-13" {...STROKE} />
      <path d="M22 18l4 6M42 14v7M62 18l-4 6" {...STROKE} opacity="0.3" />
    </svg>
  );
}

/** Wartet auf Bestätigung: Briefumschlag mit Uhr. */
export function IllustrationWartet({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 96 96" className={className} aria-hidden>
      <path d="M14 28h56v40H14z" {...STROKE} />
      <path d="M14 30l28 20 28-20" {...STROKE} opacity="0.55" />
      <circle cx="72" cy="66" r="16" {...STROKE} />
      <path d="M72 58v8l6 4" {...STROKE} />
    </svg>
  );
}

/** Abgemeldet: Briefumschlag mit offener Schlaufe (Verbindung gelöst). */
export function IllustrationAbgemeldet({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 96 96" className={className} aria-hidden>
      <path d="M14 28h56v40H14z" {...STROKE} />
      <path d="M14 30l28 20 28-20" {...STROKE} opacity="0.55" />
      <circle cx="72" cy="66" r="16" {...STROKE} />
      <path d="M66 60l12 12M78 60L66 72" {...STROKE} />
    </svg>
  );
}

export function NewsletterStatus({
  titel,
  text,
  illustration,
  zurueckLabel,
  hinweis,
}: {
  titel: string;
  text: string;
  illustration: React.ReactNode;
  zurueckLabel: string;
  /** Kleingedruckter Zusatz unter dem Knopf (optional). */
  hinweis?: string;
}) {
  return (
    <div className="flex min-h-screen flex-col bg-background font-sans text-foreground">
      <MarketingNav />
      <main className="flex flex-1 items-center justify-center px-6 py-20">
        <div className="w-full max-w-lg text-center">
          <span className="mx-auto flex size-28 items-center justify-center rounded-full bg-surface-accent text-accent">
            {illustration}
          </span>
          <h1 className="mt-8 font-display text-3xl font-semibold tracking-tight">
            {titel}
          </h1>
          <p className="mx-auto mt-3 max-w-md text-[0.9375rem] leading-relaxed text-muted-foreground">
            {text}
          </p>
          <Button asChild variant="accent" className="mt-8">
            <Link href="/">{zurueckLabel}</Link>
          </Button>
          {hinweis && (
            <p className="mt-6 text-xs text-muted-foreground">{hinweis}</p>
          )}
        </div>
      </main>
      <MarketingFooter />
    </div>
  );
}
