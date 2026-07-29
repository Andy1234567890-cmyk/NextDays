"use client";

// Steuern, die der Gastgeber dem Gast berechnet (Airbnb-Modell, Artikel 2523).
//
// Was hier NICHT passiert: Wir behalten nichts ein. Die Steuer wird dem Gast
// ZUSÄTZLICH berechnet, an den Gastgeber durchgereicht und von ihm abgeführt.
// Deshalb steht im Kopf ausdrücklich, wer sie abführt — sonst entsteht der
// Eindruck, wir kümmerten uns darum.
//
// Additiv, nie im Preis enthalten — so machen es beide Vorbilder. Airbnb sagt
// ausdrücklich: wer die Steuer vorher im Nachtpreis hatte, muss den Nachtpreis
// danach senken. Eine „inklusive"-Option gibt es dort nicht, und eine hier zu
// erfinden würde die Preisanzeige gegenüber den Portalen auseinanderlaufen
// lassen.
//
// Währung strikt aus den Daten (Wurzel 4): fehlt sie, rendert formatCurrency
// symbollos statt einen €-Ersatzwert zu zeigen.
import { Icon } from "@iconify/react";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { currencySymbol } from "@nextdays/currency";
import { Button } from "@nextdays/ui/button";
import { Input } from "@nextdays/ui/input";

import {
  ABRECHNUNGSART_KEYS,
  BEMESSUNGSGRUNDLAGE_KEYS,
  STEUERART_VORSCHLAEGE_KEYS,
  type ChargeMode,
  type ObjektSteuer,
  type ObjektSteuerInput,
  type TaxableBase,
} from "@/lib/objekt-steuern";
import {
  aendereSteuer,
  legeSteuerAn,
  loescheSteuer,
} from "@/lib/objekt-steuern-actions";

const LEER: ObjektSteuerInput = {
  tax_type: "",
  charge_mode: "percentage_per_booking",
  rate_bps: null,
  amount_minor: null,
  taxable_base: ["base_price"],
  registration_number: "",
  long_stay_exempt_nights: null,
  taxable_first_nights: null,
  max_amount_minor: null,
  active: true,
};

/** Basispunkte lesbar: 500 → „5". */
function bpsZuProzent(bps: number | null): string {
  return bps == null ? "" : String(bps / 100);
}

function prozentZuBps(text: string): number | null {
  const n = Number.parseFloat(text.replace(",", "."));
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) : null;
}

/** Kleinste Einheit → Anzeige: 300 → „3". */
function minorZuBetrag(minor: number | null): string {
  return minor == null ? "" : String(minor / 100);
}

function betragZuMinor(text: string): number | null {
  const n = Number.parseFloat(text.replace(",", "."));
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) : null;
}

function Zeile({
  steuer,
  currency,
  onBearbeiten,
  onEntfernen,
}: {
  steuer: ObjektSteuer;
  currency: string | null;
  onBearbeiten: () => void;
  onEntfernen: () => void;
}) {
  const t = useTranslations("objektEditor");
  const wert =
    steuer.rate_bps != null
      ? `${bpsZuProzent(steuer.rate_bps)} %`
      : `${minorZuBetrag(steuer.amount_minor)} ${currencySymbol(currency)}`.trim();

  return (
    <li className="flex items-start justify-between gap-4 py-4">
      <div className="flex flex-col gap-1">
        <span className="text-[0.9375rem] font-medium">
          {steuer.tax_type}
          {!steuer.active && (
            <span className="ml-2 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
              {t("steuerPausiert")}
            </span>
          )}
        </span>
        <span className="text-sm text-muted-foreground">
          {wert} · {t(ABRECHNUNGSART_KEYS[steuer.charge_mode])}
          {steuer.taxable_base.length > 0 &&
            t("steuerAufGrundlage", {
              grundlagen: steuer.taxable_base
                .map((b) => t(BEMESSUNGSGRUNDLAGE_KEYS[b]))
                .join(", "),
            })}
        </span>
        {(steuer.long_stay_exempt_nights != null ||
          steuer.taxable_first_nights != null) && (
          <span className="text-sm text-muted-foreground">
            {steuer.taxable_first_nights != null &&
              t("steuerNurErsteNaechte", { n: steuer.taxable_first_nights })}
            {steuer.long_stay_exempt_nights != null &&
              `${steuer.taxable_first_nights != null ? " · " : ""}${t(
                "steuerEntfaelltAb",
                { n: steuer.long_stay_exempt_nights },
              )}`}
          </span>
        )}
      </div>
      <div className="flex shrink-0 gap-3">
        <button
          type="button"
          onClick={onBearbeiten}
          className="text-sm font-medium underline underline-offset-4"
        >
          {t("bearbeiten")}
        </button>
        <button
          type="button"
          onClick={onEntfernen}
          className="text-sm text-muted-foreground underline underline-offset-4"
        >
          {t("steuerEntfernen")}
        </button>
      </div>
    </li>
  );
}

export function SteuernPanel({
  propertyId,
  steuern,
  currency,
}: {
  propertyId: string;
  /** null = Ladefehler. Dann KEINE leere Liste zeigen, die „keine Steuern"
   *  behaupten würde (Wurzel 5). */
  steuern: ObjektSteuer[] | null;
  currency: string | null;
}) {
  const t = useTranslations("objektEditor");
  const [liste, setListe] = useState(steuern ?? []);
  const [formular, setFormular] = useState<ObjektSteuerInput | null>(null);
  const [bearbeiteId, setBearbeiteId] = useState<string | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  const [laeuft, setLaeuft] = useState(false);

  if (steuern === null) {
    return (
      <p className="text-sm text-muted-foreground">{t("steuernLadefehler")}</p>
    );
  }

  const istProzent = formular?.charge_mode === "percentage_per_booking";

  function oeffne(steuer?: ObjektSteuer) {
    setFehler(null);
    setBearbeiteId(steuer?.id ?? null);
    setFormular(
      steuer
        ? {
            tax_type: steuer.tax_type,
            charge_mode: steuer.charge_mode,
            rate_bps: steuer.rate_bps,
            amount_minor: steuer.amount_minor,
            taxable_base: steuer.taxable_base,
            registration_number: steuer.registration_number,
            long_stay_exempt_nights: steuer.long_stay_exempt_nights,
            taxable_first_nights: steuer.taxable_first_nights,
            max_amount_minor: steuer.max_amount_minor,
            active: steuer.active,
          }
        : LEER,
    );
  }

  function setzeArt(modus: ChargeMode) {
    // Wechselt die Abrechnungsart, muss der GEGENZUSTAND mitgepflegt werden
    // (Wurzel 1): Prozentsatz und Festbetrag schließen einander aus, und die
    // Bemessungsgrundlage gibt es nur beim Prozentsatz. Bleibt der alte Wert
    // stehen, weist die API die Zeile zu Recht ab.
    setFormular((f) =>
      f == null
        ? f
        : modus === "percentage_per_booking"
          ? {
              ...f,
              charge_mode: modus,
              amount_minor: null,
              taxable_base: f.taxable_base.length ? f.taxable_base : ["base_price"],
            }
          : { ...f, charge_mode: modus, rate_bps: null, taxable_base: [] },
    );
  }

  function schalteBasis(basis: TaxableBase) {
    setFormular((f) =>
      f == null
        ? f
        : {
            ...f,
            taxable_base: f.taxable_base.includes(basis)
              ? f.taxable_base.filter((b) => b !== basis)
              : [...f.taxable_base, basis],
          },
    );
  }

  async function speichern() {
    if (!formular) return;
    setLaeuft(true);
    setFehler(null);
    const res = bearbeiteId
      ? await aendereSteuer(propertyId, bearbeiteId, formular)
      : await legeSteuerAn(propertyId, formular);
    setLaeuft(false);
    if (!res.ok) {
      setFehler(res.error);
      return;
    }
    setListe((l) =>
      bearbeiteId
        ? l.map((s) => (s.id === bearbeiteId ? res.data : s))
        : [...l, res.data],
    );
    setFormular(null);
    setBearbeiteId(null);
  }

  async function entferne(taxId: string) {
    setFehler(null);
    const res = await loescheSteuer(propertyId, taxId);
    if (!res.ok) {
      setFehler(res.error);
      return;
    }
    setListe((l) => l.filter((s) => s.id !== taxId));
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h2 className="font-display text-2xl font-extrabold">
          {t("steuernTitel")}
        </h2>
        <p className="text-sm text-muted-foreground">
          {t.rich("steuernText", {
            hervor: (teile) => <strong>{teile}</strong>,
          })}
        </p>
      </div>

      {fehler && (
        <p className="flex items-center gap-2 text-sm text-destructive">
          <Icon icon="solar:danger-triangle-line-duotone" className="size-4" />
          {fehler}
        </p>
      )}

      {liste.length > 0 && (
        <ul className="flex flex-col divide-y divide-border">
          {liste.map((s) => (
            <Zeile
              key={s.id}
              steuer={s}
              currency={currency}
              onBearbeiten={() => oeffne(s)}
              onEntfernen={() => void entferne(s.id)}
            />
          ))}
        </ul>
      )}

      {formular ? (
        <div className="flex flex-col gap-5 rounded-2xl border border-border p-5">
          <label className="flex flex-col gap-2">
            <span className="text-sm font-medium">{t("steuerArt")}</span>
            <Input
              list="steuerart-vorschlaege"
              value={formular.tax_type}
              onChange={(e) =>
                setFormular({ ...formular, tax_type: e.target.value })
              }
              placeholder={t("steuerArtPlatzhalter")}
            />
            {/* Vorschlagsliste statt fester Auswahl: welche Steuern es gibt,
                hängt von der Gemeinde ab — eine geschlossene Liste wäre
                geraten (Wurzel 4). */}
            <datalist id="steuerart-vorschlaege">
              {STEUERART_VORSCHLAEGE_KEYS.map((v) => (
                <option key={v} value={t(v)} />
              ))}
            </datalist>
          </label>

          <label className="flex flex-col gap-2">
            <span className="text-sm font-medium">
              {t("steuerAbrechnungsart")}
            </span>
            <select
              value={formular.charge_mode}
              onChange={(e) => setzeArt(e.target.value as ChargeMode)}
              className="h-12 rounded-xl border border-border bg-background pl-3 pr-10 text-[0.9375rem]"
            >
              {(
                Object.entries(ABRECHNUNGSART_KEYS) as [ChargeMode, string][]
              ).map(([k, labelKey]) => (
                <option key={k} value={k}>
                  {t(labelKey)}
                </option>
              ))}
            </select>
          </label>

          {istProzent ? (
            <>
              <label className="flex flex-col gap-2">
                <span className="text-sm font-medium">
                  {t("steuerProzentsatz")}
                </span>
                <Input
                  inputMode="decimal"
                  value={bpsZuProzent(formular.rate_bps)}
                  onChange={(e) =>
                    setFormular({
                      ...formular,
                      rate_bps: prozentZuBps(e.target.value),
                    })
                  }
                  placeholder={t("steuerProzentsatzPlatzhalter")}
                />
              </label>
              <fieldset className="flex flex-col gap-2">
                <legend className="text-sm font-medium">
                  {t("steuerWorauf")}
                </legend>
                <div className="flex flex-wrap gap-2">
                  {(
                    Object.entries(BEMESSUNGSGRUNDLAGE_KEYS) as [
                      TaxableBase,
                      string,
                    ][]
                  ).map(([k, labelKey]) => (
                    <button
                      key={k}
                      type="button"
                      onClick={() => schalteBasis(k)}
                      className={`rounded-full px-4 py-2 text-sm transition-colors ${
                        formular.taxable_base.includes(k)
                          ? "border border-foreground font-medium"
                          : "border border-border text-muted-foreground hover:bg-muted"
                      }`}
                    >
                      {t(labelKey)}
                    </button>
                  ))}
                </div>
              </fieldset>
            </>
          ) : (
            <label className="flex flex-col gap-2">
              {/* Ohne Währung im Datensatz nur „Betrag" — kein erfundenes
                  Symbol (Wurzel 4). */}
              <span className="text-sm font-medium">
                {currencySymbol(currency)
                  ? t("steuerBetragMitWaehrung", {
                      symbol: currencySymbol(currency),
                    })
                  : t("steuerBetrag")}
              </span>
              <Input
                inputMode="decimal"
                value={minorZuBetrag(formular.amount_minor)}
                onChange={(e) =>
                  setFormular({
                    ...formular,
                    amount_minor: betragZuMinor(e.target.value),
                  })
                }
                placeholder={t("steuerBetragPlatzhalter")}
              />
            </label>
          )}

          <label className="flex flex-col gap-2">
            <span className="text-sm font-medium">
              {t("steuerRegistrierungsnummer")}
            </span>
            <Input
              value={formular.registration_number}
              onChange={(e) =>
                setFormular({
                  ...formular,
                  registration_number: e.target.value,
                })
              }
              placeholder={t("steuerRegistrierungsnummerPlatzhalter")}
            />
            <span className="text-xs text-muted-foreground">
              {t("steuerRegistrierungsnummerHint")}
            </span>
          </label>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="flex flex-col gap-2">
              <span className="text-sm font-medium">
                {t("steuerNurErsteNaechteLabel")}
              </span>
              <Input
                inputMode="numeric"
                value={formular.taxable_first_nights ?? ""}
                onChange={(e) =>
                  setFormular({
                    ...formular,
                    taxable_first_nights:
                      Number.parseInt(e.target.value, 10) || null,
                  })
                }
                placeholder={t("steuerOptional")}
              />
            </label>
            <label className="flex flex-col gap-2">
              <span className="text-sm font-medium">
                {t("steuerEntfaelltAbLabel")}
              </span>
              <Input
                inputMode="numeric"
                value={formular.long_stay_exempt_nights ?? ""}
                onChange={(e) =>
                  setFormular({
                    ...formular,
                    long_stay_exempt_nights:
                      Number.parseInt(e.target.value, 10) || null,
                  })
                }
                placeholder={t("steuerOptional")}
              />
            </label>
          </div>

          <label className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={formular.active}
              onChange={(e) =>
                setFormular({ ...formular, active: e.target.checked })
              }
              className="size-4"
            />
            <span className="text-sm">{t("steuerAktiv")}</span>
          </label>

          <div className="flex gap-3">
            <Button onClick={() => void speichern()} disabled={laeuft}>
              {laeuft ? t("wirdGespeichert") : t("speichern")}
            </Button>
            <Button variant="outline" onClick={() => setFormular(null)}>
              {t("abbrechen")}
            </Button>
          </div>
        </div>
      ) : (
        <Button className="self-start" onClick={() => oeffne()}>
          {t("steuerHinzufuegen")}
        </Button>
      )}
    </div>
  );
}
