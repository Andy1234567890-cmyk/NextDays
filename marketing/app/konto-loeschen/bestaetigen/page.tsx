"use client";

// Ziel des Bestätigungslinks aus der Löschantrag-Mail (0413).
//
// Hier wird der Postfach-Besitz nachgewiesen — der Klick ist der eigentliche
// Schutz des ganzen Vorgangs. Erst danach liegt der Antrag dem Backoffice vor.
//
// Der Aufruf läuft EINMAL (`gesendet`-Ref): Mail-Clients holen Links zur
// Vorschau, Virenscanner ebenso, und der Nutzer klickt gelegentlich zweimal.
// Der Server ist dagegen abgesichert (Token wird verbraucht, zweiter Klick
// antwortet freundlich) — das hier verhindert, dass die Seite bei einem
// Doppelklick einen Fehler zeigt, den es nicht gibt (Wurzel 2).
import { useLocale } from "next-intl";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";

import { MarketingFooter } from "@/components/marketing/marketing-footer";
import { MarketingNav } from "@/components/marketing/marketing-nav";
import { kontoLoeschungTexte } from "@/content/konto-loeschung";
import { loeschantragBestaetigen } from "@/lib/konto-loeschung";

function Inhalt() {
  const locale = useLocale();
  const t = kontoLoeschungTexte(locale);
  const token = useSearchParams().get("token") ?? "";
  const [meldung, setMeldung] = useState<string | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  const gesendet = useRef(false);

  useEffect(() => {
    if (!token || gesendet.current) return;
    gesendet.current = true;
    void (async () => {
      try {
        const res = await loeschantragBestaetigen(token);
        setMeldung(res.detail);
      } catch (exc) {
        setFehler(exc instanceof Error ? exc.message : t.fehlerAllgemein);
      }
    })();
  }, [token, t.fehlerAllgemein]);

  const laeuft = !meldung && !fehler && Boolean(token);

  return (
    <div className="flex min-h-screen flex-col bg-background font-sans text-foreground">
      <MarketingNav />
      <main className="mx-auto w-full max-w-[36rem] flex-1 px-4 py-20">
        <h1 className="text-2xl font-semibold tracking-tight">
          {meldung ? t.bestaetigtTitel : t.bestaetigenTitel}
        </h1>

        <div aria-live="polite" className="mt-6">
          {laeuft && (
            <p className="text-base text-neutral-600 dark:text-neutral-300">
              {t.bestaetigenLaeuft}
            </p>
          )}
          {meldung && (
            <p className="rounded-2xl bg-emerald-50 p-4 text-sm leading-relaxed text-emerald-900 dark:bg-emerald-950 dark:text-emerald-100">
              {meldung}
            </p>
          )}
          {/* Ohne Token ist der Link unbrauchbar — dann dasselbe zeigen wie bei
            einem ungültigen Token, statt eine leere Seite. */}
          {(fehler || !token) && (
            <p className="rounded-2xl bg-red-50 p-4 text-sm leading-relaxed text-red-900 dark:bg-red-950 dark:text-red-100">
              {fehler ?? t.fehlerAllgemein}
            </p>
          )}
        </div>

        <Link
          href="/"
          className="mt-8 inline-block text-sm underline underline-offset-4"
        >
          {t.zurueckZurSeite}
        </Link>
      </main>
      <MarketingFooter />
    </div>
  );
}

export default function LoeschantragBestaetigenSeite() {
  // useSearchParams verlangt eine Suspense-Grenze (Next 15).
  return (
    <Suspense fallback={null}>
      <Inhalt />
    </Suspense>
  );
}
