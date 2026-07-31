"use client";

// Ziel des Bestätigungslinks aus der Voranmelde-Mail (Double-Opt-in).
//
// Die Bestätigung ist ein POST — ein GET würde von Mail-Clients und
// Link-Scannern schon beim Vorschauen ausgelöst, die Einwilligung wäre dann
// keine Handlung des Menschen mehr. Deshalb: Seite öffnen, Seite schickt den
// POST, Ergebnis anzeigen.
//
// Die Seite ist für viele der erste Kontakt mit der Marke — sie trägt deshalb
// dieselbe Kopf-/Fußzeile und Bildsprache wie die Startseite, nicht nur eine
// Statuszeile.
import { useLocale } from "next-intl";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";

import {
  IllustrationBestaetigt,
  IllustrationWartet,
  NewsletterStatus,
} from "@/components/newsletter-status";
import { voranmeldungTexte } from "@/content/voranmeldung";
import { bestaetigen } from "@/lib/newsletter";

function Inhalt() {
  const locale = useLocale();
  const t = voranmeldungTexte(locale);
  const token = useSearchParams().get("token") ?? "";
  const [meldung, setMeldung] = useState<string | null>(null);
  const [fertig, setFertig] = useState(false);
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
      titel={fertig ? t.bestaetigtTitel : t.bestaetigenTitel}
      text={!token ? t.fehlerAllgemein : laeuft ? t.bestaetigenLaeuft : meldung!}
      illustration={
        fertig ? (
          <IllustrationBestaetigt className="size-16" />
        ) : (
          <IllustrationWartet className="size-16" />
        )
      }
      zurueckLabel={t.zurueckZurSeite}
      hinweis={fertig ? t.bestaetigtHinweis : undefined}
    />
  );
}

export default function BestaetigenSeite() {
  return (
    // useSearchParams braucht eine Suspense-Grenze (Next 15).
    <Suspense>
      <Inhalt />
    </Suspense>
  );
}
