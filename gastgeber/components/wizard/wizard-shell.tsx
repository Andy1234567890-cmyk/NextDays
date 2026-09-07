"use client";

// Wizard-Chrome (Airbnb-„Become a Host"-Referenz). Trägt alle Schritte: oben
// Logo + Save&Exit + Questions?, unten Fortschrittsbalken + Back/Next. Der
// Schritt-Inhalt kommt als children; Navigation/Progress steuert dieser Shell.
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { Logo } from "@/components/logo";

export function WizardShell({
  step,
  total,
  canNext,
  onBack,
  onNext,
  nextLabel,
  saving,
  breit,
  children,
}: {
  step: number; // 1-basiert
  total: number;
  canNext: boolean;
  onBack: () => void;
  onNext: () => void;
  nextLabel?: string;
  saving?: boolean;
  // Breiterer Inhalt fuer Schritte mit Seitenspalte (Ausstattung). Die uebrigen
  // Schritte bleiben schmal — ein Wizard lebt vom einen Fokus je Seite.
  breit?: boolean;
  children: React.ReactNode;
}) {
  const t = useTranslations("wizard");
  const router = useRouter();
  const pct = Math.round((step / total) * 100);

  return (
    <div className="flex min-h-screen flex-col">
      {/* Kopf: Logo + Save&Exit / Questions? */}
      <header className="flex items-center justify-between px-6 py-5 sm:px-10">
        <Link href="/" aria-label="myBestDays">
          <Logo heightRem={1.75} />
        </Link>
        <div className="flex items-center gap-2">
          {/* Fuehrt in die Hilfe. Vorher war das ein Knopf ganz ohne Handler —
              er sah bedienbar aus und tat nichts. Neuer Tab, damit ein
              angefangener Entwurf im Assistenten stehen bleibt. */}
          <a
            href="/hilfe"
            target="_blank"
            rel="noreferrer"
            className="rounded-full border border-border px-4 py-2 text-sm font-medium transition-colors hover:border-foreground"
          >
            {t("hilfe")}
          </a>
          <button
            type="button"
            onClick={() => router.push("/objekte")}
            className="rounded-full border border-border px-4 py-2 text-sm font-medium"
          >
            {t("speichernBeenden")}
          </button>
        </div>
      </header>

      {/* Schritt-Inhalt (ein Fokus, großzügiger Weißraum) */}
      <main
        className={`mx-auto flex w-full flex-1 flex-col justify-center px-6 py-8 ${
          breit ? "max-w-4xl" : "max-w-2xl"
        }`}
      >
        {children}
      </main>

      {/* Fuß: Fortschrittsbalken + Back/Next */}
      <div className="sticky bottom-0 border-t border-border bg-background">
        <div className="h-1 w-full bg-muted">
          <div
            className="h-full bg-foreground transition-all duration-300"
            style={{ width: `${pct}%` }}
          />
        </div>
        <div className="flex items-center justify-between px-6 py-4 sm:px-10">
          <button
            type="button"
            onClick={onBack}
            className="text-sm font-medium underline underline-offset-4"
          >
            {t("zurueck")}
          </button>
          <button
            type="button"
            onClick={onNext}
            disabled={!canNext || saving}
            className="rounded-lg bg-foreground px-6 py-3 text-sm font-medium text-background disabled:opacity-40"
          >
            {saving ? t("speichert") : (nextLabel ?? t("weiter"))}
          </button>
        </div>
      </div>
    </div>
  );
}
