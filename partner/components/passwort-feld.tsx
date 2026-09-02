"use client";

// Passwortfeld mit Sichtbarkeits-Schalter.
//
// Warum als eigene Komponente und nicht dreimal per Hand: es gibt drei
// Passwortfelder (Anmelden, Bewerbung, Steuerdaten). Ein Schalter, der nur an
// einem davon hängt, ist genau die Art Ungleichheit, die später niemandem
// auffällt — und ein falsch getipptes Passwort im Steuerdaten-Formular kostet
// den Partner einen 401, ohne dass er sieht, warum.
//
// Der Schalter ist ein `button` mit `aria-pressed` und `aria-label`, nicht ein
// klickbares Symbol: sonst erreicht ihn die Tastatur nicht und ein
// Screenreader liest ihn gar nicht vor.
import { Icon } from "@iconify/react";
import { useTranslations } from "next-intl";
import { useId, useState } from "react";

export function PasswortFeld({
  wert,
  setzen,
  label,
  autoComplete = "current-password",
  required = true,
  hinweis,
}: {
  wert: string;
  setzen: (v: string) => void;
  label: string;
  autoComplete?: string;
  required?: boolean;
  hinweis?: string;
}) {
  const t = useTranslations("passwort");
  const [sichtbar, setSichtbar] = useState(false);
  const id = useId();

  return (
    <label className="flex flex-col gap-1" htmlFor={id}>
      <span className="font-medium">{label}</span>
      <span className="relative block">
        <input
          id={id}
          value={wert}
          onChange={(e) => setzen(e.target.value)}
          type={sichtbar ? "text" : "password"}
          required={required}
          autoComplete={autoComplete}
          className="w-full rounded-full border border-border bg-transparent py-2 pl-4 pr-12 outline-none focus-visible:border-foreground"
        />
        <button
          type="button"
          onClick={() => setSichtbar((s) => !s)}
          aria-pressed={sichtbar}
          aria-label={sichtbar ? t("verbergen") : t("anzeigen")}
          title={sichtbar ? t("verbergen") : t("anzeigen")}
          className="absolute right-1 top-1/2 -translate-y-1/2 rounded-full p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <Icon icon={sichtbar ? "ph:eye-slash" : "ph:eye"} className="size-5" />
        </button>
      </span>
      {hinweis && <span className="text-xs text-muted-foreground">{hinweis}</span>}
    </label>
  );
}
