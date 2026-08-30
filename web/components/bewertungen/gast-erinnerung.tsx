"use client";

// Erinnerung an den Gast, seinen Aufenthalt zu bewerten.
//
// Steht getrennt von den Auto-Bewertungs-Vorlagen, weil es etwas anderes ist:
// die Vorlagen sind Texte, die WIR über den Gast schreiben, das hier ist eine
// Mail AN den Gast. Sie hängt am Betrieb, nicht am Objekt, und braucht keine
// Textvarianten — eine Mail an eine Person ist keine öffentliche Bewertung,
// die ein Portal auf Duplikate prüft.
//
// Nur myBestDays: die Portale laden selbst ein (Booking.com ~48 h nach
// Abreise). Eine zweite Einladung von uns wäre für den Gast Spam.
//
// Herausgelöst aus `automatik-form.tsx`, als die Auto-Bewertung zu Vorlagen
// wurde (0503). Die alte Datei bleibt bestehen, solange die Vorlagen nicht
// jeden Betrieb erreicht haben — sie schreibt weiter dieselben Spalten.
import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";

import { Button } from "@nextdays/ui/button";
import { Card } from "@nextdays/ui/card";
import { Input } from "@nextdays/ui/input";
import { Switch } from "@nextdays/ui/switch";
import { type AutomationConfig, saveReviewAutomation } from "@/lib/reviews";

export function GastErinnerung({
  initial,
  readOnly,
}: {
  initial: AutomationConfig;
  readOnly: boolean;
}) {
  const t = useTranslations("reviews");
  const [cfg, setCfg] = useState(initial);
  const [gespeichert, setGespeichert] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  const [pending, starte] = useTransition();

  function feld<K extends keyof AutomationConfig>(
    key: K,
    value: AutomationConfig[K],
  ) {
    setGespeichert(false);
    setCfg((alt) => ({ ...alt, [key]: value }));
  }

  function speichern() {
    setFehler(null);
    starte(async () => {
      // Die ganze Konfiguration wird geschickt, nicht nur die zwei Felder:
      // der Endpunkt ist ein PUT auf die Zeile. Würde hier ein Teilobjekt
      // gehen, überschriebe es die Auto-Bewertungs-Felder mit Vorgabewerten
      // — und der Rückfall für Betriebe ohne Vorlage wäre still weg
      // (Wurzel 1).
      const res = await saveReviewAutomation(cfg);
      if (res.ok) {
        setCfg(res.data);
        setGespeichert(true);
      } else {
        setFehler(res.error);
      }
    });
  }

  return (
    <section className="flex w-full max-w-3xl flex-col gap-4">
      <header className="flex flex-col gap-1">
        <h2 className="text-lg font-semibold">{t("guestReminder")}</h2>
        <p className="text-sm text-muted-foreground">{t("guestReminderHint")}</p>
      </header>

      <Card className="flex flex-col gap-4 p-5">
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm font-medium">{t("guestReminderSwitch")}</span>
          <Switch
            checked={cfg.guest_reminder_active}
            disabled={readOnly}
            onCheckedChange={(v) => feld("guest_reminder_active", v)}
          />
        </div>
        {cfg.guest_reminder_active && (
          <label className="flex max-w-40 flex-col gap-1 border-t border-border pt-4">
            <span className="text-xs font-medium text-muted-foreground">
              {t("afterDays")}
            </span>
            <Input
              type="number"
              min={0}
              max={30}
              value={cfg.guest_reminder_after_days}
              disabled={readOnly}
              onChange={(e) =>
                feld("guest_reminder_after_days", Number(e.target.value))
              }
            />
          </label>
        )}
      </Card>

      {fehler && <Card className="p-4 text-sm text-destructive">{fehler}</Card>}

      {!readOnly && (
        <div className="flex items-center gap-3">
          <Button onClick={speichern} disabled={pending}>
            {t("save")}
          </Button>
          {gespeichert && (
            <span className="text-sm text-muted-foreground">{t("saved")}</span>
          )}
        </div>
      )}
    </section>
  );
}
