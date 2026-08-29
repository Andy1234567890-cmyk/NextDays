"use client";

// Vollbild-Schale für den Setup-Assistenten: Inhalt links, Foto rechts.
//
// WARUM VOLLBILD UND NICHT IM DASHBOARD: der Assistent lief bisher als schmale
// Karte MITTEN im Dashboard — mit Sidebar, Topbar und Kennzahlen-Kacheln
// daneben. Ein Betrieb, der noch kein einziges Objekt hat, sieht dort ein
// Menü mit fünfzehn Einträgen, von denen keiner funktioniert, und daneben ein
// Formular. Der erste Eindruck ist damit „viel, aber nichts geht" statt „drei
// Fragen, dann bist du drin".
//
// Das Muster ist NICHT neu erfunden: `components/auth/auth-schale.tsx` baut
// Anmeldung, Einladung und Passwort-Vergessen längst so (Inhalt links, dasselbe
// Foto rechts). Der Assistent erbt es, damit der Übergang von der Registrierung
// nicht wie ein Sprung in eine fremde Anwendung wirkt.
//
// Eigen ist hier nur, was der Anmeldung fehlt: der Fortschritt unten, das
// „Später einrichten" oben rechts — und der Claim auf dem Foto, der sagt, wofür
// die nächsten Minuten gut sind.
import type { ReactNode } from "react";
import Image from "next/image";
import { useTranslations } from "next-intl";

import { LanguageToggle } from "@/components/language-toggle";
import { Logo } from "@/components/logo";
import { UspKarten } from "@/components/onboarding/usp-karten";
import { ThemeToggle } from "@/components/theme-toggle";

/** Ein Bild je Abschnitt des Assistenten, damit die rechte Spalte etwas über den
 *  aktuellen Schritt sagt statt dreimal dieselbe Stimmung zu zeigen.
 *
 *  Reihum statt starr je Schrittnummer: die Zahl der Schritte hängt am Zweig
 *  (Neukunde/Wechselkunde), ein fest verdrahtetes Bild je Nummer liefe bei einer
 *  Änderung der Schrittfolge ins Leere. */
const BILDER = [
  { datei: "/onboarding/wizard-1.webp", claimKey: "claim1" },
  { datei: "/onboarding/wizard-2.webp", claimKey: "claim2" },
  { datei: "/onboarding/wizard-3.webp", claimKey: "claim3" },
] as const;

export function OnboardingSchale({
  children,
  /** 1-basiert. */
  schritt,
  gesamt,
  /** Fehlt der Aussteig, wird oben rechts nichts angezeigt (Schluss-Schritt). */
  onUeberspringen,
}: {
  children: ReactNode;
  schritt: number;
  gesamt: number;
  onUeberspringen?: () => void;
}) {
  const t = useTranslations("onboarding");
  const bild = BILDER[(Math.max(schritt, 1) - 1) % BILDER.length];

  return (
    <main className="grid min-h-screen lg:grid-cols-2">
      <div className="flex flex-col px-6 py-8 lg:px-16">
        {/* Sprache und Design gehören auch hier hin: der Assistent liegt außerhalb
            des Dashboards und damit außerhalb der Topbar, die beide Schalter sonst
            trägt. Ohne sie säße ein Betrieb, dessen Browser auf Englisch steht,
            im ersten Kontakt in der falschen Sprache fest — und im Dunkelmodus
            gäbe es keinen Weg zurück ins Helle. */}
        <div className="flex items-center justify-between gap-4">
          <Logo heightRem={1.75} />
          <div className="flex items-center gap-1">
            {onUeberspringen ? (
              <button
                type="button"
                onClick={onUeberspringen}
                className="rounded-full px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {t("spaeterEinrichten")}
              </button>
            ) : null}
            <LanguageToggle />
            <ThemeToggle />
          </div>
        </div>

        <div className="flex flex-1 items-center justify-center py-8">
          <div className="w-full max-w-lg">{children}</div>
        </div>

        <Fortschritt schritt={schritt} gesamt={gesamt} />
      </div>

      {/* Rechte Spalte: dasselbe Foto wie in der Anmeldung — auf Mobil aus, dort
          zählt der Platz für das Formular. */}
      <div className="hidden p-3 lg:block">
        <div className="relative h-full w-full overflow-hidden rounded-2xl">
          <Image
            src={bild.datei}
            alt=""
            aria-hidden
            fill
            priority
            sizes="50vw"
            className="object-cover"
          />
          {/* Die USP-Karten schweben über dem ganzen Foto — eigene Ebene, damit
              sie über der Bildfläche liegen und ihre Positionen sich auf diese
              beziehen. `pointer-events-none`, weil hier nichts anklickbar ist:
              sonst schluckt die Ebene Klicks, die dem Bild gelten. */}
          <div className="pointer-events-none absolute inset-0">
            <UspKarten schritt={schritt} className="absolute inset-0" />
          </div>

          {/* Verlauf, nicht Vollton: der Claim braucht Kontrast, das Bild soll
              aber nicht abgedunkelt wirken. */}
          <div className="absolute inset-x-0 bottom-0 bg-linear-to-t from-black/70 to-transparent p-8 pt-24">
            <p className="font-display text-2xl font-extrabold text-balance text-white">
              {t(bild.claimKey)}
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}

/** Segmentbalken: ein Strich je Schritt, nicht ein durchgehender Balken.
 *
 *  Der Unterschied ist nicht kosmetisch — Segmente sagen „noch drei Fragen",
 *  ein Prozentbalken sagt „62 %", und niemand weiß, wie lang die restlichen
 *  38 % dauern. */
function Fortschritt({ schritt, gesamt }: { schritt: number; gesamt: number }) {
  const t = useTranslations("onboarding");
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="flex gap-1.5" aria-hidden>
        {Array.from({ length: gesamt }, (_, i) => (
          <span
            key={i}
            className={
              i < schritt - 1
                ? "h-1 w-10 rounded-full bg-primary"
                : i === schritt - 1
                  ? "h-1 w-10 rounded-full bg-accent"
                  : "h-1 w-10 rounded-full bg-secondary"
            }
          />
        ))}
      </div>
      <p className="text-xs text-muted-foreground">
        {t("schrittVon", { aktuell: schritt, gesamt })}
      </p>
    </div>
  );
}
