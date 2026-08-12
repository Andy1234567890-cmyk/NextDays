"use client";

// Bericht anlegen und bearbeiten — EIN Formular für beide Wege.
//
// Zwei Formulare wären zwei Wahrheiten darüber, was ein Bericht ausmacht: beim
// Bearbeiten fehlte irgendwann ein Feld, das beim Anlegen längst dazugekommen
// ist. Der Unterschied ist genau einer — die Beschriftung des Absenden-Knopfs.
import { Icon } from "@iconify/react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { Button } from "@nextdays/ui/button";
import { Card } from "@nextdays/ui/card";
import { DatePicker } from "@nextdays/ui/date-picker";
import { Input } from "@nextdays/ui/input";
import { Label } from "@nextdays/ui/label";
import { NativeSelect } from "@nextdays/ui/native-select";
import {
  ObjektMehrfachauswahl,
  type ObjektAuswahlEintrag,
} from "@/components/objekt-mehrfachauswahl";
import {
  createReport,
  type ReportBasis,
  type ReportDetail,
  updateReport,
} from "@/lib/owner-reporting";

/** Buchungsstatus, die sich abrechnen lassen. `pending`/`requested` fehlen
 *  bewusst: eine Anfrage ist keine Einnahme, und sie mitzuzählen ergäbe eine
 *  Auszahlung für Geld, das nie geflossen ist. */
const STATUS = ["confirmed", "completed", "cancelled"] as const;

const BASEN: readonly ReportBasis[] = ["check_in", "check_out", "booked"];

export function BerichtFormular({
  objekte,
  objekteError,
  waehrungen,
  bericht = null,
}: {
  objekte: ObjektAuswahlEintrag[];
  /** Grund, falls die Objektliste nicht geladen werden konnte — angezeigt statt
   *  als leere Liste ausgegeben (Wurzel 4). */
  objekteError: string | null;
  /** Die im Bestand vorkommenden Objektwährungen. Ohne Auswahlmöglichkeit
   *  müsste der Betreiber einen ISO-Code tippen; ohne die ECHTEN Währungen
   *  stünde eine erfundene Liste da. */
  waehrungen: string[];
  /** Gesetzt = Bearbeiten. */
  bericht?: ReportDetail | null;
}) {
  const t = useTranslations("ownerReporting.reportForm");
  const router = useRouter();
  const bearbeiten = bericht !== null;

  const [name, setName] = useState(bericht?.name ?? "");
  const [currency, setCurrency] = useState(
    bericht?.currency ?? waehrungen[0] ?? "",
  );
  const [von, setVon] = useState(bericht?.period_from ?? letzterMonat().von);
  const [bis, setBis] = useState(bericht?.period_to ?? letzterMonat().bis);
  const [basis, setBasis] = useState<ReportBasis>(bericht?.basis ?? "check_in");
  const [statuses, setStatuses] = useState<string[]>(
    bericht?.reservation_statuses ?? ["confirmed", "completed"],
  );
  const [ids, setIds] = useState<string[]>(bericht?.property_ids ?? []);
  const [suche, setSuche] = useState("");
  const [busy, setBusy] = useState(false);

  // Ein Bericht ohne Objekte hat keinen Gegenstand, ohne Währung keine
  // Bezugsgröße. Beides prüft der Server erneut — hier nur, damit der
  // Betreiber nicht erst nach dem Absenden erfährt, was fehlt.
  const gueltig = useMemo(
    () =>
      name.trim().length > 0 &&
      currency.length === 3 &&
      von !== "" &&
      bis !== "" &&
      bis >= von &&
      ids.length > 0,
    [name, currency, von, bis, ids],
  );

  async function submit() {
    if (!gueltig) return;
    setBusy(true);
    const eingabe = {
      name: name.trim(),
      currency,
      period_from: von,
      period_to: bis,
      basis,
      reservation_statuses: statuses,
      property_ids: ids,
    };
    const res = bearbeiten
      ? await updateReport(bericht.id, eingabe)
      : await createReport(eingabe);
    setBusy(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success(bearbeiten ? t("updated") : t("created"));
    router.push(`/eigentuemer/reporting/berichte/${res.data.id}`);
    // Ohne Realtime-Quelle (0365 sperrt die Tabellen für `authenticated`) ist
    // das serverseitige Neu-Rendern der einzige Weg, die Liste zu erneuern.
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-display text-3xl font-extrabold">
        {bearbeiten ? t("editTitle") : t("newTitle")}
      </h1>

      <Card className="flex flex-col gap-6 p-6">
        <div className="flex flex-col gap-1">
          <Label htmlFor="report-name">{t("fields.name")}</Label>
          <Input
            id="report-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t("placeholders.name")}
            autoFocus={!bearbeiten}
          />
          <p className="text-xs text-muted-foreground">{t("hints.name")}</p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1">
            <Label htmlFor="report-from">{t("fields.from")}</Label>
            <DatePicker value={von} onChange={setVon} />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="report-to">{t("fields.to")}</Label>
            <DatePicker value={bis} onChange={setBis} />
          </div>
        </div>
        {bis !== "" && von !== "" && bis < von && (
          <p className="text-sm text-destructive">{t("errors.range")}</p>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1">
            <Label htmlFor="report-basis">{t("fields.basis")}</Label>
            <NativeSelect
              id="report-basis"
              value={basis}
              onChange={(e) => setBasis(e.target.value as ReportBasis)}
            >
              {BASEN.map((b) => (
                <option key={b} value={b}>
                  {t(`basis.${b}`)}
                </option>
              ))}
            </NativeSelect>
            <p className="text-xs text-muted-foreground">
              {t(`basisHint.${basis}`)}
            </p>
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="report-currency">{t("fields.currency")}</Label>
            {waehrungen.length === 0 ? (
              // Keine Objektwährung gepflegt: KEIN Ersatzwert. Ein
              // vorausgewähltes „EUR" sähe aus wie eine Entscheidung des
              // Betriebs und machte bei dänischem Bestand jede Zahl um Faktor
              // 7,45 falsch (Wurzel 4).
              <p className="rounded-(--radius) border border-destructive/40 p-3 text-sm text-destructive">
                {t("errors.noCurrency")}
              </p>
            ) : (
              <NativeSelect
                id="report-currency"
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
              >
                {waehrungen.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </NativeSelect>
            )}
            <p className="text-xs text-muted-foreground">
              {t("hints.currency")}
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium">{t("fields.statuses")}</span>
          <p className="text-xs text-muted-foreground">{t("hints.statuses")}</p>
          <div className="flex flex-wrap gap-4">
            {STATUS.map((s) => (
              <label key={s} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  className="size-4 accent-primary"
                  checked={statuses.includes(s)}
                  onChange={(e) =>
                    setStatuses((prev) =>
                      e.target.checked
                        ? [...prev, s]
                        : prev.filter((x) => x !== s),
                    )
                  }
                />
                {t(`statuses.${s}`)}
              </label>
            ))}
          </div>
        </div>
      </Card>

      <Card className="flex flex-col gap-3 p-6">
        <span className="text-sm font-medium">{t("fields.properties")}</span>
        <p className="text-xs text-muted-foreground">
          {t("hints.properties")}
        </p>
        {objekteError ? (
          <p className="rounded-(--radius) border border-destructive/40 p-4 text-sm text-destructive">
            {objekteError}
          </p>
        ) : (
          <ObjektMehrfachauswahl
            objekte={objekte}
            selected={ids}
            onChange={setIds}
            suche={suche}
            onSucheChange={setSuche}
            disabled={busy}
            emptyText={t("errors.noProperties")}
          />
        )}
      </Card>

      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={() => router.back()} disabled={busy}>
          {t("cancel")}
        </Button>
        <Button onClick={() => void submit()} disabled={busy || !gueltig}>
          {busy ? (
            <Icon icon="ph:spinner" className="size-4 animate-spin" />
          ) : null}
          {bearbeiten ? t("update") : t("create")}
        </Button>
      </div>
    </div>
  );
}

/**
 * Der zuletzt abgeschlossene Monat als Vorbelegung.
 *
 * Der laufende Monat wäre die falsche Vorgabe: eine Abrechnung entsteht über
 * einen ABGESCHLOSSENEN Zeitraum, und der halbe August ergäbe eine Auszahlung,
 * die zwei Wochen später eine andere ist.
 */
function letzterMonat(): { von: string; bis: string } {
  const heute = new Date();
  const von = new Date(heute.getFullYear(), heute.getMonth() - 1, 1);
  const bis = new Date(heute.getFullYear(), heute.getMonth(), 0);
  return { von: iso(von), bis: iso(bis) };
}

/** Lokales ISO-Datum. `toISOString()` wäre UTC und schöbe den Ersten eines
 *  Monats in Zeitzonen östlich von Greenwich auf den Letzten davor. */
function iso(d: Date): string {
  const m = `${d.getMonth() + 1}`.padStart(2, "0");
  const t = `${d.getDate()}`.padStart(2, "0");
  return `${d.getFullYear()}-${m}-${t}`;
}
