"use client";

// Nachberechnung einer WEBSITE-Buchung (0469): Ein Aufenthalt wurde
// nachträglich teurer — klassisch die manuelle Verlängerung, die den Preis neu
// rechnet — und der Gast soll die Differenz per Karte zahlen.
//
// Der Betrag wird aus der letzten Preis-Neuberechnung vorbelegt, wenn die
// Zeitleiste den vorherigen Betrag kennt; bei Altbestand bleibt das Feld leer
// (kein erfundener Vorschlag). Der Zahlungslink entsteht als Stripe Payment
// Link im verbundenen Konto des Betriebs und ist provisionsfrei — eine Buchung
// über die eigene Website läuft nicht über die Plattform.
//
// Ob dieser Weg für die Buchung offensteht, entscheidet AUSSCHLIESSLICH das
// Backend (Kanal, Storno, offener Betrag) und liefert es als `moeglich` +
// `hinweis`. Die Oberfläche wiederholt diese Regel nicht — sonst gäbe es zwei
// Wahrheiten, die auseinanderlaufen.
import { Icon } from "@iconify/react";
import { useLocale, useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@nextdays/ui/button";
import { Card } from "@nextdays/ui/card";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@nextdays/ui/tooltip";
import { Input } from "@nextdays/ui/input";
import { formatCurrency } from "@/lib/currency";
import {
  createNachberechnung,
  deleteNachberechnung,
  erfasseNachberechnungBezahlt,
  getNachberechnung,
  markNachberechnungBezahlt,
  nimmNachberechnungZurueck,
  sendNachberechnung,
  type NachberechnungStatus,
} from "@/lib/payments";

export function NachberechnungAbschnitt({
  reservationId,
  onChanged,
}: {
  reservationId: string;
  /** Wird nach jeder Änderung gerufen, die den offenen Betrag verschiebt. */
  onChanged?: () => void;
}) {
  const t = useTranslations("reservations.nachberechnung");
  // „Abbrechen" kommt aus `common` — der Text ist in allen 24 Sprachen
  // gepflegt; ein eigener Schlüssel wäre eine zweite Kopie desselben Wortes.
  const tc = useTranslations("common");
  const locale = useLocale();
  const [stand, setStand] = useState<NachberechnungStatus | null>(null);
  const [betrag, setBetrag] = useState("");
  const [grund, setGrund] = useState("");
  const [busy, setBusy] = useState(false);
  // Rücknahme einer manuellen Bezahlt-Markierung: id der Zeile, für die gerade
  // ein Grund eingegeben wird (null = kein Dialog offen). Der Grund ist Pflicht,
  // deshalb ein eigenes Feld statt eines stillen Klicks.
  const [ruecknahmeId, setRuecknahmeId] = useState<string | null>(null);
  const [ruecknahmeGrund, setRuecknahmeGrund] = useState("");

  const laden = useCallback(async () => {
    const res = await getNachberechnung(reservationId);
    if (!res.ok) {
      // Nicht still verschlucken (Wurzel 5): Ein 404 (Route noch nicht
      // deployt) und ein 403 (fehlende Berechtigung) sehen in der Oberfläche
      // beide wie „gibt es hier nicht" aus. Ohne diese Zeile wäre nicht
      // unterscheidbar, ob der Abschnitt zu Recht fehlt oder der Aufruf
      // scheiterte — dasselbe Muster wie im Posteingang.
      console.debug(
        "[Nachberechnung] Laden fehlgeschlagen:",
        res.error,
        res.status ?? "",
      );
      setStand(null);
      return;
    }
    console.debug(
      "[Nachberechnung] geladen",
      {
        moeglich: res.data.moeglich,
        hinweis: res.data.hinweis,
        offen: res.data.offen_amount,
        vorschlag: res.data.vorschlag_amount,
        link: res.data.link?.status ?? null,
      },
    );
    setStand(res.data);
    // Vorbelegung nur, solange der Betrieb nichts eigenes getippt hat.
    setBetrag((bisher) =>
      bisher === "" && res.data.vorschlag_amount != null
        ? String(res.data.vorschlag_amount)
        : bisher,
    );
  }, [reservationId]);

  useEffect(() => {
    void laden();
  }, [laden]);

  const money = (v: number | null | undefined) =>
    v == null ? "—" : formatCurrency(v, stand?.currency ?? "");

  async function kopieren(url: string) {
    try {
      await navigator.clipboard.writeText(url);
      toast.success(t("linkKopiert"));
    } catch {
      // Ohne Zwischenablage-Recht ist der Link nicht verloren — er steht
      // sichtbar daneben.
      toast.message(t("linkKopierenFehlgeschlagen"));
    }
  }

  async function erstellen() {
    const wert = Number(betrag.replace(",", "."));
    if (!Number.isFinite(wert) || wert <= 0) {
      toast.error(t("betragUngueltig"));
      return;
    }
    if (grund.trim().length < 3) {
      toast.error(t("grundFehlt"));
      return;
    }
    setBusy(true);
    const res = await createNachberechnung(reservationId, wert, grund.trim());
    setBusy(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    await laden();
    if (res.data.url) await kopieren(res.data.url);
  }

  async function senden() {
    setBusy(true);
    const res = await sendNachberechnung(reservationId);
    setBusy(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success(t("mailVersandt"));
  }

  async function zurueckziehen() {
    setBusy(true);
    const res = await deleteNachberechnung(reservationId);
    setBusy(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    setBetrag("");
    setGrund("");
    await laden();
    onChanged?.();
    toast.success(t("linkZurueckgezogen"));
  }

  async function alsBezahltMarkieren() {
    setBusy(true);
    const res = await markNachberechnungBezahlt(reservationId);
    setBusy(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    await laden();
    onChanged?.();
    toast.success(t("alsBezahltErfolg"));
  }

  async function bezahltErfassen() {
    const wert = Number(betrag.replace(",", "."));
    if (!Number.isFinite(wert) || wert <= 0) {
      toast.error(t("betragUngueltig"));
      return;
    }
    if (grund.trim().length < 3) {
      toast.error(t("grundFehlt"));
      return;
    }
    setBusy(true);
    const res = await erfasseNachberechnungBezahlt(
      reservationId,
      wert,
      grund.trim(),
    );
    setBusy(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    setBetrag("");
    setGrund("");
    await laden();
    onChanged?.();
    toast.success(t("alsBezahltErfolg"));
  }

  async function ruecknahmeBestaetigen() {
    if (!ruecknahmeId) return;
    if (ruecknahmeGrund.trim().length < 3) {
      toast.error(t("grundFehlt"));
      return;
    }
    setBusy(true);
    const res = await nimmNachberechnungZurueck(
      reservationId,
      ruecknahmeId,
      ruecknahmeGrund.trim(),
    );
    setBusy(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    setRuecknahmeId(null);
    setRuecknahmeGrund("");
    await laden();
    onChanged?.();
    toast.success(t("ruecknahmeErfolg"));
  }

  // Ohne Stand (Ladefehler) und ohne Möglichkeit UND ohne offenen Link gibt es
  // hier nichts zu zeigen: Ein leerer Abschnitt mit Hinweistext auf jeder
  // OTA-Buchung wäre Lärm — dort ist die Nachberechnung Sache des Portals.
  if (!stand || (!stand.moeglich && !stand.link && !stand.bezahlt.length))
    return null;

  const link = stand.link;

  return (
    <Card className="flex flex-col gap-2 p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="flex items-center gap-1.5">
          <h2 className="font-display text-lg font-bold">{t("titel")}</h2>
          {/* Die Erklärung steht am Info-Icon, nicht als Absatz: sie wird
              einmal gelesen und ist danach Rauschen über dem Eingabefeld. */}
          <TooltipProvider delayDuration={150}>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  aria-label={t("erklaerung")}
                  className="text-muted-foreground/70 transition-colors hover:text-foreground"
                >
                  <Icon icon="ph:info" className="size-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent className="max-w-xs text-xs leading-relaxed">
                {t("erklaerung")}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </span>
        {stand.offen_amount != null && (
          <span className="text-xs text-muted-foreground">
            {t("offen", { amount: money(stand.offen_amount) })}
          </span>
        )}
      </div>

      {link ? (
        <>
          <p className="text-sm">
            {t("linkOffen", {
              amount: money(link.amount_cents / 100),
              grund: link.grund,
            })}
          </p>
          {/* Der Buchungsbetrag hat sich nach der Erstellung geändert — der
              Link lautet auf einen veralteten Stand. Nicht still korrigieren:
              was der Gast zahlen soll, entscheidet der Betrieb neu. */}
          {link.betrag_veraltet && (
            <p className="text-xs text-warning">{t("betragVeraltet")}</p>
          )}
          {link.url && (
            <a
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              className="truncate text-xs text-accent hover:underline"
            >
              {link.url}
            </a>
          )}
          <div className="flex flex-wrap gap-2">
            {link.url && (
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => void kopieren(link.url!)}
              >
                <Icon icon="ph:copy" className="size-4" />
                {t("linkKopieren")}
              </Button>
            )}
            <Button
              type="button"
              size="sm"
              onClick={() => void senden()}
              disabled={busy}
            >
              <Icon icon="ph:paper-plane-tilt" className="size-4" />
              {t("perMailSenden")}
            </Button>
            {/* Der Gast hat anders gezahlt (bar, Überweisung, Karte an der
                Rezeption). Der Link wird dabei zuerst bei Stripe geschlossen,
                damit niemand ein zweites Mal zahlen kann. */}
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => void alsBezahltMarkieren()}
              disabled={busy}
            >
              <Icon icon="ph:hand-coins" className="size-4" />
              {t("alsBezahltMarkieren")}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => void zurueckziehen()}
              disabled={busy}
            >
              {t("linkZurueckziehen")}
            </Button>
          </div>
        </>
      ) : (
        <>
          <div className="flex flex-wrap items-end gap-2">
            <label className="flex flex-col gap-1 text-xs text-muted-foreground">
              {t("betragLabel", { currency: stand.currency })}
              <Input
                inputMode="decimal"
                value={betrag}
                onChange={(e) => setBetrag(e.target.value)}
                className="w-32"
                placeholder="0,00"
              />
            </label>
            <label className="flex min-w-48 flex-1 flex-col gap-1 text-xs text-muted-foreground">
              {t("grundLabel")}
              <Input
                value={grund}
                onChange={(e) => setGrund(e.target.value)}
                maxLength={500}
                placeholder={t("grundPlatzhalter")}
              />
            </label>
            <Button
              type="button"
              size="sm"
              onClick={() => void erstellen()}
              disabled={busy}
            >
              <Icon icon="ph:link" className="size-4" />
              {busy ? t("linkErstellenBusy") : t("linkErstellen")}
            </Button>
            {/* Kein Umweg über einen Link, den der Gast nie öffnet: hat er an
                der Rezeption gezahlt, wird die Nachberechnung direkt als
                bezahlt erfasst. Sonst bliebe die Zahlung außerhalb des Systems
                und fehlte in Rechnung und Eigentümer-Abrechnung. */}
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => void bezahltErfassen()}
              disabled={busy}
            >
              <Icon icon="ph:hand-coins" className="size-4" />
              {t("bezahltErfassen")}
            </Button>
          </div>
        </>
      )}

      {/* Bezahlte Nachberechnungen. Ohne diese Liste war nach der Zahlung
          nichts mehr zu sehen — nur ein gestiegenes „Bezahlt" in der
          Zahlungskachel, dem niemand ansieht, wofür es gestiegen ist. */}
      {stand.bezahlt.length > 0 && (
        <div className="mt-1 flex flex-col gap-1.5 border-t pt-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {t("bezahltTitel")}
          </p>
          {stand.bezahlt.map((z) => (
            <div key={z.id} className="flex flex-col gap-1">
              <div className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
                <span className="flex items-center gap-1.5">
                  <Icon
                    icon={
                      z.bezahlt_manuell ? "ph:hand-coins" : "ph:credit-card"
                    }
                    className="size-4 shrink-0 text-success"
                  />
                  <span>{z.grund}</span>
                  <span className="text-xs text-muted-foreground">
                    {z.bezahlt_manuell
                      ? t("herkunftManuell")
                      : t("herkunftKarte")}
                    {z.paid_at
                      ? ` · ${new Date(z.paid_at).toLocaleDateString(locale)}`
                      : ""}
                  </span>
                </span>
                <span className="font-semibold">
                  {money(z.amount_cents / 100)}
                </span>
              </div>
              {/* Rücknahme NUR bei einer manuellen Markierung: eine über Stripe
                  eingegangene Zahlung ist eine Tatsache und wird erstattet,
                  nicht umgedeutet (das entscheidet auch das Backend). */}
              {z.bezahlt_manuell && ruecknahmeId !== z.id && (
                <button
                  type="button"
                  onClick={() => {
                    setRuecknahmeId(z.id);
                    setRuecknahmeGrund("");
                  }}
                  className="self-start text-xs text-muted-foreground underline hover:text-foreground"
                >
                  {t("ruecknahme")}
                </button>
              )}
              {ruecknahmeId === z.id && (
                <div className="flex flex-wrap items-end gap-2">
                  <label className="flex min-w-48 flex-1 flex-col gap-1 text-xs text-muted-foreground">
                    {t("ruecknahmeGrundLabel")}
                    <Input
                      value={ruecknahmeGrund}
                      onChange={(e) => setRuecknahmeGrund(e.target.value)}
                      maxLength={500}
                      placeholder={t("ruecknahmeGrundPlatzhalter")}
                    />
                  </label>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => void ruecknahmeBestaetigen()}
                    disabled={busy}
                  >
                    {t("ruecknahmeBestaetigen")}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => setRuecknahmeId(null)}
                  >
                    {tc("cancel")}
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
