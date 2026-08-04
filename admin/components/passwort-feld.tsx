"use client";

// Passwort-Eingabe mit Sichtbarkeits-Schalter (Auge).
//
// Eine Komponente für alle drei Stellen des Backoffice (Anmeldung, Einladung,
// neues Passwort) — sonst driften Beschriftung, Fokus-Ring und Verhalten des
// Auges auseinander.
//
// Der Schalter kippt nur `type`; der Wert bleibt im Formular-State. Das Feld
// bekommt bewusst KEIN `autoCorrect`/`spellCheck`, und der Knopf sitzt
// ausserhalb des Tab-Flusses des Passworts nicht — er ist erreichbar, trägt
// aber ein sprechendes `aria-label` und `aria-pressed`, damit ein Screenreader
// den Zustand vorliest.
import { Icon } from "@iconify/react";
import { useId, useState } from "react";

export function PasswortFeld({
  label,
  value,
  onChange,
  autoComplete,
  minLength,
  hinweis,
}: {
  label: string;
  value: string;
  onChange: (wert: string) => void;
  autoComplete: "current-password" | "new-password";
  minLength?: number;
  hinweis?: string;
}) {
  const [sichtbar, setSichtbar] = useState(false);
  const id = useId();

  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm text-muted-foreground">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          type={sichtbar ? "text" : "password"}
          required
          minLength={minLength}
          autoComplete={autoComplete}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          // pr-12: Platz für den Knopf, damit lange Passwörter nicht darunter
          // laufen.
          className="w-full rounded-xl border border-border bg-transparent px-4 py-2.5 pr-12 outline-none focus-visible:border-foreground"
        />
        <button
          type="button"
          onClick={() => setSichtbar((s) => !s)}
          aria-label={sichtbar ? "Passwort verbergen" : "Passwort anzeigen"}
          aria-pressed={sichtbar}
          className="absolute inset-y-0 right-0 flex w-12 items-center justify-center rounded-r-xl text-muted-foreground transition-colors hover:text-foreground focus-visible:text-foreground focus-visible:outline-none"
        >
          <Icon
            icon={sichtbar ? "ph:eye-slash" : "ph:eye"}
            className="size-5"
            aria-hidden
          />
        </button>
      </div>
      {hinweis && (
        <p className="mt-1.5 text-xs text-muted-foreground">{hinweis}</p>
      )}
    </div>
  );
}
