"use client";

// Ziel des Bestätigungslinks aus der Voranmelde-Mail (Double-Opt-in).
//
// Die Bestätigung ist ein POST — ein GET würde von Mail-Clients und
// Link-Scannern schon beim Vorschauen ausgelöst, die Einwilligung wäre dann
// keine Handlung des Menschen mehr. Deshalb: Seite öffnen, Seite schickt den
// POST, Ergebnis anzeigen.
import { useLocale } from "next-intl";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";

import { voranmeldungTexte } from "@/content/voranmeldung";
import { bestaetigen } from "@/lib/newsletter";

function Inhalt() {
  const locale = useLocale();
  const t = voranmeldungTexte(locale);
  const token = useSearchParams().get("token") ?? "";
  const [meldung, setMeldung] = useState<string | null>(null);
  const [ok, setOk] = useState<boolean | null>(null);
  // React ruft Effekte im Entwicklungsmodus doppelt auf; der Token ist
  // einmalig — ohne diese Sperre liefe der zweite Aufruf ins Leere und die
  // Seite zeigte „ungültig", obwohl die Bestätigung geklappt hat.
  const gesendet = useRef(false);

  useEffect(() => {
    if (!token || gesendet.current) return;
    gesendet.current = true;
    void (async () => {
      try {
        const res = await bestaetigen(token);
        setOk(res.ok);
        setMeldung(res.detail);
      } catch (exc) {
        setOk(false);
        setMeldung(exc instanceof Error ? exc.message : t.fehlerAllgemein);
      }
    })();
  }, [token, t.fehlerAllgemein]);

  return (
    <div className="w-full max-w-md text-center">
      <h1 className="font-display text-2xl font-semibold tracking-tight">
        {t.bestaetigenTitel}
      </h1>
      <p className="mt-3 text-sm text-muted-foreground">
        {!token
          ? t.fehlerAllgemein
          : meldung === null
            ? t.bestaetigenLaeuft
            : meldung}
      </p>
      <Link
        href="/"
        className="mt-8 inline-block text-sm font-medium underline underline-offset-4"
      >
        {t.zurueckZurSeite}
      </Link>
      {/* ok wird nur für die Screenreader-Ansage gebraucht. */}
      <span className="sr-only" role="status">
        {ok === null ? "" : ok ? "ok" : "fehler"}
      </span>
    </div>
  );
}

export default function BestaetigenSeite() {
  return (
    <main className="flex min-h-screen items-center justify-center px-6">
      {/* useSearchParams braucht eine Suspense-Grenze (Next 15). */}
      <Suspense>
        <Inhalt />
      </Suspense>
    </main>
  );
}
