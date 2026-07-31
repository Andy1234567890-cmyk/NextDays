"use client";

// Ziel des Abmeldelinks aus jeder Newsletter-Mail.
//
// Abmelden muss ohne Rückfrage funktionieren — ein Klick, fertig. Deshalb löst
// die Seite den Vorgang direkt aus und zeigt nur das Ergebnis. Der Token ist
// dauerhaft gültig (er steht in jeder Mail), aber nur als Hash gespeichert.
import { useLocale } from "next-intl";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";

import { voranmeldungTexte } from "@/content/voranmeldung";
import { abmelden } from "@/lib/newsletter";

function Inhalt() {
  const locale = useLocale();
  const t = voranmeldungTexte(locale);
  const token = useSearchParams().get("token") ?? "";
  const [meldung, setMeldung] = useState<string | null>(null);
  const gesendet = useRef(false);

  useEffect(() => {
    if (!token || gesendet.current) return;
    gesendet.current = true;
    void (async () => {
      try {
        const res = await abmelden(token);
        setMeldung(res.detail);
      } catch (exc) {
        setMeldung(exc instanceof Error ? exc.message : t.fehlerAllgemein);
      }
    })();
  }, [token, t.fehlerAllgemein]);

  return (
    <div className="w-full max-w-md text-center">
      <h1 className="font-display text-2xl font-semibold tracking-tight">
        {t.abmeldenTitel}
      </h1>
      <p className="mt-3 text-sm text-muted-foreground">
        {!token
          ? t.fehlerAllgemein
          : meldung === null
            ? t.abmeldenLaeuft
            : meldung}
      </p>
      <Link
        href="/"
        className="mt-8 inline-block text-sm font-medium underline underline-offset-4"
      >
        {t.zurueckZurSeite}
      </Link>
    </div>
  );
}

export default function AbmeldenSeite() {
  return (
    <main className="flex min-h-screen items-center justify-center px-6">
      <Suspense>
        <Inhalt />
      </Suspense>
    </main>
  );
}
