"use client";

// 2FA-Pflicht für admin/co_admin: führt nach dem Login zur Einrichtung.
//
// Die Erzwingung liegt seit 0341 im BACKEND und ist echt: Nach Ablauf der
// Übergangsfrist antwortet jede Route `401` + `X-MFA-Required: enroll`, und nur
// noch `/auth/mfa/*` und `/auth/account` sind offen. Dieser Hinweis ist deshalb
// kein Ersatz für eine Sperre, sondern die Vorwarnung davor — er nennt die
// Frist, damit klar ist, dass es kein optionaler Vorschlag ist.
//
// Bewusst zurückstellbar (pro Sitzung): Solange die Frist läuft, ist der Nutzer
// arbeitsfähig, und ein nicht schließbares Banner würde ihn nur blockieren,
// ohne die Sicherheit zu erhöhen. Nach Fristablauf übernimmt ohnehin der
// Server — dann trägt kein Frontend-Riegel mehr die Verantwortung.
import { Icon } from "@iconify/react";
import { useLocale, useTranslations } from "next-intl";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import { Button } from "@nextdays/ui/button";

const ZURUECKGESTELLT = "nd_mfa_hinweis_zurueckgestellt";

export function MfaPflichtHinweis({
  /** Ende der Übergangsfrist als ISO-Datum, direkt aus `mfa_grace_until`.
   *  `null` = das Backend nennt keine Frist → es wird KEINE erfunden. */
  fristIso,
}: {
  fristIso: string | null;
}) {
  const t = useTranslations("auth.mfaSetup");
  const locale = useLocale();
  const pfad = usePathname();
  const [zurueckgestellt, setZurueckgestellt] = useState(true);

  // sessionStorage erst nach dem Mount lesen (kein Server/Client-Unterschied).
  // Vorbelegung `true` heißt: im ersten Frame nichts zeigen — lieber einen
  // Wimpernschlag später als ein Aufblitzen bei jedem Seitenwechsel.
  useEffect(() => {
    setZurueckgestellt(window.sessionStorage.getItem(ZURUECKGESTELLT) === "1");
  }, []);

  // Auf der Sicherheits-Seite selbst wäre der Hinweis nur im Weg — dort steht
  // die Einrichtung ohnehin direkt darunter.
  if (zurueckgestellt || pfad === "/konto/sicherheit") return null;

  // Die Frist ist personenbezogen (14 Tage ab der ersten Anmeldung DIESES
  // Kontos, `mfa_service.GRACE_DAUER`) und kommt als ISO-Wert aus
  // `mfa_grace_until`. Hier wird sie nur noch angezeigt — kein Datum wird
  // berechnet, geraten oder ersetzt.
  //
  // Formatiert wird mit der APP-Sprache (`useLocale()`), nicht mit
  // `undefined`: `undefined` nimmt die Sprache des BROWSERS. Wer die Oberfläche
  // auf Deutsch nutzt, aber einen englischen Browser hat, las bisher
  // „August 23, 2026" mitten im deutschen Satz. Dass es meist richtig aussah,
  // war Zufall — Browser- und App-Sprache stimmten überein.
  const frist = fristIso ? new Date(fristIso) : null;
  const fristLesbar =
    frist && !Number.isNaN(frist.getTime())
      ? frist.toLocaleDateString(locale, {
          year: "numeric",
          month: "long",
          day: "numeric",
        })
      : null;

  return (
    <div
      role="region"
      aria-label={t("title")}
      className="mb-4 flex flex-col gap-3 rounded-(--radius) border border-destructive/40 bg-destructive/5 p-4 sm:flex-row sm:items-start sm:justify-between"
    >
      <div className="flex items-start gap-3">
        <Icon
          icon="ph:shield-warning"
          className="mt-0.5 size-5 shrink-0 text-destructive"
          aria-hidden
        />
        <div className="flex flex-col gap-1">
          <p className="text-sm font-semibold">{t("title")}</p>
          <p className="text-sm text-muted-foreground">
            {fristLesbar ? t("introWithDeadline", { date: fristLesbar }) : t("intro")}
          </p>
          <p className="text-sm text-muted-foreground">{t("why")}</p>
        </div>
      </div>
      <div className="flex shrink-0 flex-col gap-2 sm:items-end">
        <Button asChild size="sm">
          <Link href="/konto/sicherheit">{t("goToSettings")}</Link>
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            window.sessionStorage.setItem(ZURUECKGESTELLT, "1");
            setZurueckgestellt(true);
          }}
        >
          {t("later")}
        </Button>
      </div>
    </div>
  );
}
