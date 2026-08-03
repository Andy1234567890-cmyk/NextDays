"use client";

// Airbnb-Steuererhebung eines Inserats — der Block, der entscheidet, ob eigene
// Steuern überhaupt an Airbnb gehen dürfen.
//
// Aufbau wie im Branchenstandard (live abgelesen 03.08.2026, „Airbnb-Erweiterte
// Einstellungen"): ein Infokasten mit dem Szenario, darunter zwei Schalter
// („Ich bestätige, dass ich das Szenario der Steuererhebung verstehe" und
// „Benutzungssteuern senden").
//
// EIN Unterschied, und der ist unvermeidbar: dort liest die Software das
// Szenario direkt bei Airbnb aus und zeigt es read-only. Unser Aggregator
// liefert dieses Feld nicht (live geprüft: der Airbnb-Kanal deklariert nur
// code/email/min_stay_type/rate_plans_enabled/send_email_notifications/
// booking_amount_settings/cohost_payout_calculations). Deshalb wird es hier
// GEWÄHLT statt gelesen — mit denselben drei Werten. Ein automatisch erratenes
// Szenario wäre ein erfundener Wert (Wurzel 4), und fehlt es, gehen
// vorsichtshalber keine Steuern raus (fail-closed).
import { useEffect, useState, useTransition } from "react";
import { useTranslations } from "next-intl";

import { Card } from "@nextdays/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@nextdays/ui/select";
import { Switch } from "@nextdays/ui/switch";
import {
  type AirbnbTaxScenario,
  type ChannelPropertyDetail,
  setAirbnbTaxSettings,
} from "@/lib/channex";

const KEIN_SZENARIO = "unset";

export function AirbnbSteuererhebung({ detail }: { detail: ChannelPropertyDetail }) {
  const t = useTranslations("channels.airbnbTax");
  const [szenario, setSzenario] = useState<AirbnbTaxScenario | null>(
    detail.airbnb_tax_scenario ?? null,
  );
  const [bestaetigt, setBestaetigt] = useState(detail.airbnb_tax_acknowledged);
  const [senden, setSenden] = useState(detail.airbnb_send_user_taxes);
  const [fehler, setFehler] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // Der optimistische Zustand darf den echten nicht überdauern.
  useEffect(() => {
    setSzenario(detail.airbnb_tax_scenario ?? null);
    setBestaetigt(detail.airbnb_tax_acknowledged);
    setSenden(detail.airbnb_send_user_taxes);
  }, [
    detail.airbnb_tax_scenario,
    detail.airbnb_tax_acknowledged,
    detail.airbnb_send_user_taxes,
  ]);

  // „Nicht berechtigt" heißt: Airbnb erhebt selbst bzw. unterstützt keine
  // Beherbergungssteuern — dann gibt es nichts zu exportieren und beide
  // Schalter sind aus. Der Server erzwingt dasselbe (Wurzel 3).
  const nichtBerechtigt = szenario === "ineligible";

  function speichern(next: {
    scenario: AirbnbTaxScenario | null;
    acknowledged: boolean;
    send: boolean;
  }) {
    const scenario = next.scenario;
    const acknowledged = scenario === "ineligible" ? false : next.acknowledged;
    const send = scenario === "ineligible" || !acknowledged ? false : next.send;
    setSzenario(scenario);
    setBestaetigt(acknowledged);
    setSenden(send);
    setFehler(null);
    startTransition(async () => {
      const res = await setAirbnbTaxSettings(
        detail.property_id,
        detail.portal_code,
        { scenario, acknowledged, send_user_taxes: send },
      );
      if (!res.ok) setFehler(res.error);
    });
  }

  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-sm font-semibold">{t("title")}</h2>
      <Card className="flex flex-col gap-4 p-5">
        <p className="text-sm text-muted-foreground">{t("hint")}</p>

        <div className="flex flex-col gap-1.5">
          <span className="text-xs text-muted-foreground">{t("scenarioLabel")}</span>
          <Select
            value={szenario ?? KEIN_SZENARIO}
            onValueChange={(val) =>
              speichern({
                scenario: val === KEIN_SZENARIO ? null : (val as AirbnbTaxScenario),
                acknowledged: bestaetigt,
                send: senden,
              })
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={KEIN_SZENARIO}>{t("scenarioUnset")}</SelectItem>
              <SelectItem value="ineligible">{t("scenarioIneligible")}</SelectItem>
              <SelectItem value="no_collected">{t("scenarioNoCollected")}</SelectItem>
              <SelectItem value="stacked">{t("scenarioStacked")}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <label className="flex cursor-pointer items-center justify-between gap-4 text-sm">
          <span>{t("acknowledge")}</span>
          <Switch
            checked={bestaetigt}
            disabled={nichtBerechtigt || pending}
            onCheckedChange={(c) =>
              speichern({ scenario: szenario, acknowledged: c, send: senden })
            }
          />
        </label>

        <label className="flex cursor-pointer items-center justify-between gap-4 text-sm">
          <span className="font-medium">{t("sendUserTaxes")}</span>
          <Switch
            checked={senden}
            disabled={nichtBerechtigt || !bestaetigt || pending}
            onCheckedChange={(c) =>
              speichern({ scenario: szenario, acknowledged: bestaetigt, send: c })
            }
          />
        </label>

        {!senden && <p className="text-sm text-muted-foreground">{t("blockedNote")}</p>}
        {fehler && <p className="text-sm text-destructive">{fehler}</p>}
      </Card>
    </section>
  );
}
