"use client";

// Passwort-Eingabe für die öffentlichen Auth-Seiten (Einladung annehmen,
// neues Passwort setzen). EINE Komponente für beide Stellen — sonst driften
// Anforderungen, Stärkeanzeige und Verhalten des Auges auseinander.
//
// Warum die Anforderungen sichtbar sind statt nur als Fehler nach dem
// Absenden: der Nutzer soll beim Tippen sehen, was noch fehlt. Erst beim
// Absenden zu meckern ist die Hauptursache für abgebrochene Passwortvergaben.
//
// Barrierefreiheit: `for`/`id`-Kopplung über useId, sprechendes `aria-label` +
// `aria-pressed` am Auge, Anforderungsliste per `aria-describedby` am Feld,
// Statusänderungen in einer `aria-live`-Region. Einfügen ist erlaubt
// (Passwort-Manager) — kein onPaste-Handler.
import { Icon } from "@iconify/react";
import { useTranslations } from "next-intl";
import { useId, useState } from "react";

import { Input } from "@nextdays/ui/input";
import { Label } from "@nextdays/ui/label";
import { cn } from "@/lib/utils";

// Mindestlänge. Bewusst hier zentral, damit Formular und Anzeige nicht
// auseinanderlaufen können.
//
// Der Server verlangt 8 (docs/API.md: `422` bei < 8 Zeichen), wir verlangen in
// der Oberfläche 12. Das ist Absicht und kein Contract-Bruch: strenger als der
// Server ist unbedenklich (jedes hier akzeptierte Passwort besteht auch die
// Serverprüfung), umgekehrt wäre es ein Fehler. Länge ist laut NIST der
// wirksamste Hebel, deshalb führen wir den Nutzer auf den höheren Wert.
// Die verbindliche Prüfung bleibt serverseitig (Wurzel 3) — diese Konstante
// ist Führung, keine Sicherheit.
export const PASSWORT_MIN_LAENGE = 12;

/** Eine Anforderung an das Passwort: Übersetzungs-Schlüssel + Prüfung. */
const ANFORDERUNGEN = [
  { key: "length", erfuellt: (w: string) => w.length >= PASSWORT_MIN_LAENGE },
  { key: "letter", erfuellt: (w: string) => /\p{L}/u.test(w) },
  { key: "digit", erfuellt: (w: string) => /\d/u.test(w) },
] as const;

/** Alle Anforderungen erfüllt? Formulare entscheiden damit über `disabled`. */
export function passwortGenuegt(wert: string): boolean {
  return ANFORDERUNGEN.every((a) => a.erfuellt(wert));
}

/** Stärke 0–4 als reine Anzeigehilfe (NIST empfiehlt eine Rückmeldung).
 *  Bewusst simpel und lokal: Länge trägt am meisten, Zeichenvielfalt ergänzt.
 *  Das ist KEIN Sicherheitsurteil — die harte Grenze sind die Anforderungen. */
function staerke(wert: string): number {
  if (!wert) return 0;
  let punkte = 0;
  if (wert.length >= PASSWORT_MIN_LAENGE) punkte += 1;
  if (wert.length >= 16) punkte += 1;
  const klassen = [/\p{Ll}/u, /\p{Lu}/u, /\d/u, /[^\p{L}\d]/u].filter((r) =>
    r.test(wert),
  ).length;
  if (klassen >= 2) punkte += 1;
  if (klassen >= 3) punkte += 1;
  return Math.min(punkte, 4);
}

export function PasswortFeld({
  label,
  value,
  onChange,
  anforderungenZeigen = false,
  autoFocus = false,
}: {
  label: string;
  value: string;
  onChange: (wert: string) => void;
  /** Anforderungsliste + Stärkeanzeige einblenden (nur am ersten Feld). */
  anforderungenZeigen?: boolean;
  autoFocus?: boolean;
}) {
  const t = useTranslations("auth.password");
  const [sichtbar, setSichtbar] = useState(false);
  const id = useId();
  const hilfeId = `${id}-hilfe`;

  const stufe = staerke(value);
  // Beschriftung der Stärke: 0 wird nie angezeigt (leeres Feld), daher 1..4.
  const staerkeLabel = t(`strength.${Math.max(stufe, 1)}`);

  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>
        {label} <span className="text-destructive">*</span>
      </Label>
      <div className="relative">
        <Input
          id={id}
          type={sichtbar ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          // KEIN `required`/`minLength` am Input: Die Browser-Validierung
          // blockiert `submit` STUMM — kein `onSubmit`, kein Netz-Aufruf, keine
          // Meldung. Genau das war der Live-Fall (14.08.2026): ein Eigentümer
          // setzte sein Passwort, die Seite blieb ohne Erfolg und ohne Fehler
          // stehen. Zusätzlich widersprach `minLength=12` dem Server, der 8
          // genügt — der Browser lehnte damit ab, was der Server annimmt.
          // Geprüft wird stattdessen sichtbar: `passwortGenuegt` steuert die
          // Meldung im Formular, die verbindliche Regel bleibt serverseitig
          // (Wurzel 3).
          aria-required
          autoComplete="new-password"
          autoFocus={autoFocus}
          aria-describedby={anforderungenZeigen ? hilfeId : undefined}
          className="pr-10"
        />
        <button
          type="button"
          onClick={() => setSichtbar((s) => !s)}
          aria-label={sichtbar ? t("hide") : t("show")}
          aria-pressed={sichtbar}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground focus-visible:text-foreground focus-visible:outline-none"
        >
          <Icon
            icon={sichtbar ? "ph:eye-slash" : "ph:eye"}
            className="size-5"
            aria-hidden
          />
        </button>
      </div>

      {anforderungenZeigen && (
        <div id={hilfeId} className="mt-1 flex flex-col gap-2">
          {/* Stärkeanzeige: vier Segmente, gefüllt nach Stufe. */}
          <div className="flex flex-col gap-1">
            <div className="flex gap-1" aria-hidden>
              {[1, 2, 3, 4].map((n) => (
                <span
                  key={n}
                  className={cn(
                    "h-1 flex-1 rounded-full transition-colors",
                    n <= stufe ? "bg-accent" : "bg-border",
                  )}
                />
              ))}
            </div>
            {/* Nur diese Zeile ist live — sonst liest der Screenreader bei
                jedem Tastendruck die ganze Liste erneut vor. */}
            <p className="text-xs text-muted-foreground" aria-live="polite">
              {value ? t("strengthLabel", { level: staerkeLabel }) : " "}
            </p>
          </div>

          <ul className="flex flex-col gap-1">
            {ANFORDERUNGEN.map((a) => {
              const ok = a.erfuellt(value);
              return (
                <li
                  key={a.key}
                  className={cn(
                    "flex items-center gap-1.5 text-xs",
                    ok ? "text-accent" : "text-muted-foreground",
                  )}
                >
                  <Icon
                    icon={ok ? "ph:check-circle-fill" : "ph:circle"}
                    className="size-3.5 shrink-0"
                    aria-hidden
                  />
                  {t(`requirement.${a.key}`, { min: PASSWORT_MIN_LAENGE })}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
