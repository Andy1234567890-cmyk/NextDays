"use client";

// Bewertungs-Automatik: Gast nach der Abreise automatisch bewerten und/oder ihn
// an seine eigene Bewertung erinnern.
//
// Warum das überhaupt automatisch läuft: Airbnb veröffentlicht die Bewertung des
// Gasts erst, wenn beide Seiten abgegeben haben oder die 14-Tage-Frist abläuft.
// Wer von Hand bewertet, verpasst dieses Fenster regelmäßig.
import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";

import { Button } from "@nextdays/ui/button";
import { Card } from "@nextdays/ui/card";
import { Input } from "@nextdays/ui/input";
import { NativeSelect } from "@nextdays/ui/native-select";
import { Switch } from "@nextdays/ui/switch";
import { Textarea } from "@nextdays/ui/textarea";
import { type AutomationConfig, saveReviewAutomation } from "@/lib/reviews";

export function AutomatikForm({
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
  const [pending, startTransition] = useTransition();

  function feld<K extends keyof AutomationConfig>(
    key: K,
    value: AutomationConfig[K],
  ) {
    setGespeichert(false);
    setCfg((alt) => ({ ...alt, [key]: value }));
  }

  function speichern() {
    setFehler(null);
    startTransition(async () => {
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
    <div className="flex w-full max-w-3xl flex-col gap-4">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">{t("automationTitle")}</h1>
        <p className="text-sm text-muted-foreground">{t("automationSubtitle")}</p>
      </header>

      <Card className="flex flex-col gap-4 p-5">
        <div className="flex items-center justify-between gap-3">
          <div className="flex flex-col">
            <span className="text-sm font-medium">{t("autoReview")}</span>
            <span className="text-xs text-muted-foreground">
              {t("autoReviewHint")}
            </span>
          </div>
          <Switch
            checked={cfg.auto_review_active}
            disabled={readOnly}
            onCheckedChange={(v) => feld("auto_review_active", v)}
          />
        </div>

        {cfg.auto_review_active && (
          <div className="flex flex-col gap-4 border-t border-border pt-4">
            <div className="grid gap-4 sm:grid-cols-3">
              <label className="flex flex-col gap-1">
                <span className="text-xs font-medium text-muted-foreground">
                  {t("afterDays")}
                </span>
                <Input
                  type="number"
                  min={0}
                  max={30}
                  value={cfg.auto_review_after_days}
                  disabled={readOnly}
                  onChange={(e) =>
                    feld("auto_review_after_days", Number(e.target.value))
                  }
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-xs font-medium text-muted-foreground">
                  {t("autoRating")}
                </span>
                <NativeSelect
                  value={String(cfg.auto_review_rating)}
                  disabled={readOnly}
                  onChange={(e) =>
                    feld("auto_review_rating", Number(e.target.value))
                  }
                >
                  {[1, 2, 3, 4, 5].map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </NativeSelect>
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-xs font-medium text-muted-foreground">
                  {t("minRating")}
                </span>
                <NativeSelect
                  value={cfg.auto_review_min_rating == null ? "" : String(cfg.auto_review_min_rating)}
                  disabled={readOnly}
                  onChange={(e) =>
                    feld(
                      "auto_review_min_rating",
                      e.target.value === "" ? null : Number(e.target.value),
                    )
                  }
                >
                  <option value="">{t("minRatingAlways")}</option>
                  {[1, 2, 3, 4, 5].map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </NativeSelect>
                <span className="text-xs text-muted-foreground">
                  {t("minRatingHint")}
                </span>
              </label>
            </div>

            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-muted-foreground">
                {t("publicText")}
              </span>
              <Textarea
                rows={3}
                value={cfg.auto_review_public ?? ""}
                disabled={readOnly}
                onChange={(e) => feld("auto_review_public", e.target.value)}
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-muted-foreground">
                {t("privateText")}
              </span>
              <Textarea
                rows={2}
                value={cfg.auto_review_private ?? ""}
                disabled={readOnly}
                onChange={(e) => feld("auto_review_private", e.target.value)}
              />
            </label>
          </div>
        )}
      </Card>

      <Card className="flex flex-col gap-4 p-5">
        <div className="flex items-center justify-between gap-3">
          <div className="flex flex-col">
            <span className="text-sm font-medium">{t("guestReminder")}</span>
            <span className="text-xs text-muted-foreground">
              {t("guestReminderHint")}
            </span>
          </div>
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
    </div>
  );
}
