"use client";

// Ziel des Abmeldelinks aus jeder Newsletter-Mail.
//
// Abmelden muss ohne Rückfrage funktionieren — ein Klick, fertig. Deshalb löst
// die Seite den Vorgang direkt aus und zeigt nur das Ergebnis. Der Token ist
// dauerhaft gültig (er steht in jeder Mail), aber nur als Hash gespeichert.
import { useLocale } from "next-intl";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";

import {
  IllustrationAbgemeldet,
  IllustrationWartet,
  NewsletterStatus,
} from "@/components/newsletter-status";
import { voranmeldungTexte } from "@/content/voranmeldung";
import { abmelden } from "@/lib/newsletter";

function Inhalt() {
  const locale = useLocale();
  const t = voranmeldungTexte(locale);
  const token = useSearchParams().get("token") ?? "";
  const [meldung, setMeldung] = useState<string | null>(null);
  const [fertig, setFertig] = useState(false);
  const gesendet = useRef(false);

  useEffect(() => {
    if (!token || gesendet.current) return;
    gesendet.current = true;
    void (async () => {
      try {
        const res = await abmelden(token);
        setMeldung(res.detail);
        setFertig(res.ok);
      } catch (exc) {
        setMeldung(exc instanceof Error ? exc.message : t.fehlerAllgemein);
      }
    })();
  }, [token, t.fehlerAllgemein]);

  const laeuft = !!token && meldung === null;

  return (
    <NewsletterStatus
      titel={t.abmeldenTitel}
      text={!token ? t.fehlerAllgemein : laeuft ? t.abmeldenLaeuft : meldung!}
      illustration={
        fertig ? (
          <IllustrationAbgemeldet className="size-16" />
        ) : (
          <IllustrationWartet className="size-16" />
        )
      }
      zurueckLabel={t.zurueckZurSeite}
      hinweis={fertig ? t.abgemeldetHinweis : undefined}
    />
  );
}

export default function AbmeldenSeite() {
  return (
    <Suspense>
      <Inhalt />
    </Suspense>
  );
}
