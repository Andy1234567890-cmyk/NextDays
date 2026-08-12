"use client";

// Abrechnungsvertrag eines Eigentümers — Historie mit Zeitachse + Pflege.
//
// WARUM HISTORIE UND NICHT „DER AKTUELLE SATZ":
// Ein Statement für den Juli muss mit dem Juli-Vertrag rechnen, egal wann es
// erzeugt wird. Ändert die Agentur den Satz im September, ist der Juli-Satz
// deshalb nicht weg — er ist abgelaufen. Diese Liste zeigt beides, sonst wäre
// eine ältere Abrechnung nicht nachvollziehbar („warum stehen da 15 %?").
//
// Eine Ablösung ist ein NEUER Vertrag ab Datum X, kein Überschreiben des alten.
// Deshalb gibt es hier „Neuer Vertrag" neben „Bearbeiten": Bearbeiten ist für
// den Tippfehler, ein neuer Vertrag für die geänderte Vereinbarung.
import { Icon } from "@iconify/react";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@nextdays/ui/button";
import { Card } from "@nextdays/ui/card";
import { InfoHinweis } from "@nextdays/ui/info-hinweis";
import { Input } from "@nextdays/ui/input";
import { NativeSelect } from "@nextdays/ui/native-select";
import { Textarea } from "@nextdays/ui/textarea";
import { formatCurrency } from "@/lib/currency";
import {
  createOwnerBillingTerms,
  deleteOwnerBillingTerms,
  listOwnerBillingTerms,
  updateOwnerBillingTerms,
  type OwnerBillingTerms,
  type PauschaleBasis,
  type PauschaleZeitpunkt,
} from "@/lib/owner-billing";

type PropOption = { id: string; title: string };

/** Formularzustand — Strings, weil Eingabefelder Strings liefern. */
type FormState = {
  property_id: string;
  gueltig_ab: string;
  gueltig_bis: string;
  provisions_pct: string;
  min_betrag: string;
  min_currency: string;
  pauschale_betrag: string;
  pauschale_currency: string;
  pauschale_basis: PauschaleBasis;
  pauschale_zeitpunkt: PauschaleZeitpunkt;
  notiz: string;
};

function leeresFormular(): FormState {
  return {
    property_id: "",
    gueltig_ab: new Date().toISOString().slice(0, 10),
    gueltig_bis: "",
    // KEIN Vorschlagswert für den Satz: eine vorbelegte Zahl sähe in der
    // Maske aus wie eine Vereinbarung, die niemand getroffen hat (Wurzel 4).
    provisions_pct: "",
    min_betrag: "",
    min_currency: "",
    pauschale_betrag: "",
    pauschale_currency: "",
    pauschale_basis: "je_buchung",
    pauschale_zeitpunkt: "nach_provision",
    notiz: "",
  };
}

function ausVertrag(v: OwnerBillingTerms): FormState {
  return {
    property_id: v.property_id ?? "",
    gueltig_ab: v.gueltig_ab,
    gueltig_bis: v.gueltig_bis ?? "",
    provisions_pct: String(v.provisions_pct),
    min_betrag: v.min_provision_betrag != null ? String(v.min_provision_betrag) : "",
    min_currency: v.min_provision_currency ?? "",
    pauschale_betrag: v.pauschale_betrag != null ? String(v.pauschale_betrag) : "",
    pauschale_currency: v.pauschale_currency ?? "",
    pauschale_basis: v.pauschale_basis ?? "je_buchung",
    pauschale_zeitpunkt: v.pauschale_zeitpunkt ?? "nach_provision",
    notiz: v.notiz ?? "",
  };
}

export function Abrechnungsvertrag({
  ownerId,
  properties,
  onGeltendeVertraege,
}: {
  ownerId: string;
  properties: PropOption[];
  /** Meldet die HEUTE geltenden Verträge nach oben.
   *
   *  Damit können die Stammdaten-Felder darüber anzeigen, dass ihr Satz
   *  gerade überstimmt wird. Ohne diese Rückmeldung stünden auf einer Seite
   *  zwei Provisionsangaben ohne erkennbare Rangfolge — genau der
   *  Widerspruch, an dem Kunden die Seite nicht verstanden haben. Der
   *  Vertrag bleibt die einzige Quelle: die Stammdaten LESEN ihn nur. */
  onGeltendeVertraege?: (vertraege: OwnerBillingTerms[]) => void;
}) {
  const t = useTranslations("ownerBilling");
  const [items, setItems] = useState<OwnerBillingTerms[]>([]);
  const [ladefehler, setLadefehler] = useState<string | null>(null);
  const [laedt, setLaedt] = useState(true);
  const [form, setForm] = useState<FormState | null>(null);
  // Die ID des Vertrags, der gerade bearbeitet wird; null = neuer Vertrag.
  const [editId, setEditId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);

  const laden = useCallback(async () => {
    setLaedt(true);
    const res = await listOwnerBillingTerms(ownerId);
    setLaedt(false);
    if (res.ok) {
      setItems(res.data.items);
      setLadefehler(null);
      return;
    }
    // Kein `?? []`: eine leere Liste wäre die Aussage „es gibt keinen
    // Vertrag" — eine andere Tatsache als „konnte nicht geladen werden".
    setLadefehler(res.error);
  }, [ownerId]);

  useEffect(() => {
    void laden();
  }, [laden]);

  // Die geltenden Verträge nach oben melden — nach JEDEM Laden, also auch nach
  // Anlegen/Bearbeiten/Löschen (alle rufen `laden()`). Sonst behauptete der
  // Hinweis an den Stammdaten weiter einen Vertrag, den es nicht mehr gibt.
  useEffect(() => {
    onGeltendeVertraege?.(items.filter((v) => v.aktuell));
  }, [items, onGeltendeVertraege]);

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => (f ? { ...f, [key]: value } : f));
  }

  async function speichern() {
    if (!form) return;
    const pct = Number(form.provisions_pct);
    if (!form.provisions_pct.trim() || Number.isNaN(pct)) {
      setFehler(t("errorPctRequired"));
      return;
    }
    setBusy(true);
    setFehler(null);

    // Leere Felder werden zu null, nicht zu 0: „keine Pauschale vereinbart"
    // ist etwas anderes als „Pauschale 0,00" (Wurzel 4).
    const zahl = (s: string) => (s.trim() ? Number(s) : null);
    const text = (s: string) => (s.trim() ? s.trim() : null);
    const hatPauschale = Boolean(form.pauschale_betrag.trim());
    const hatMin = Boolean(form.min_betrag.trim());

    const res = editId
      ? await updateOwnerBillingTerms(editId, {
          gueltig_ab: form.gueltig_ab,
          gueltig_bis: form.gueltig_bis || undefined,
          unbefristet: !form.gueltig_bis,
          provisions_pct: pct,
          min_provision_betrag: hatMin ? zahl(form.min_betrag) : undefined,
          min_provision_currency: hatMin ? text(form.min_currency) : undefined,
          ohne_min_provision: !hatMin,
          pauschale_betrag: hatPauschale ? zahl(form.pauschale_betrag) : undefined,
          pauschale_currency: hatPauschale
            ? text(form.pauschale_currency)
            : undefined,
          pauschale_basis: hatPauschale ? form.pauschale_basis : undefined,
          pauschale_zeitpunkt: hatPauschale ? form.pauschale_zeitpunkt : undefined,
          ohne_pauschale: !hatPauschale,
          notiz: text(form.notiz),
        })
      : await createOwnerBillingTerms(ownerId, {
          property_id: form.property_id || null,
          gueltig_ab: form.gueltig_ab,
          gueltig_bis: form.gueltig_bis || null,
          provisions_pct: pct,
          min_provision_betrag: zahl(form.min_betrag),
          min_provision_currency: text(form.min_currency),
          pauschale_betrag: zahl(form.pauschale_betrag),
          pauschale_currency: text(form.pauschale_currency),
          pauschale_basis: hatPauschale ? form.pauschale_basis : null,
          pauschale_zeitpunkt: hatPauschale ? form.pauschale_zeitpunkt : null,
          notiz: text(form.notiz),
        });

    setBusy(false);
    if (!res.ok) {
      setFehler(res.error);
      return;
    }
    toast.success(t("saved"));
    setForm(null);
    setEditId(null);
    await laden();
  }

  async function loeschen(id: string) {
    setBusy(true);
    const res = await deleteOwnerBillingTerms(id);
    setBusy(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success(t("deleted"));
    await laden();
  }

  const objektTitel = (id: string | null) =>
    id ? (properties.find((p) => p.id === id)?.title ?? id) : t("allProperties");

  return (
    <Card className="flex flex-col gap-4 p-6">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex flex-col gap-1">
          <h3 className="font-display text-lg font-extrabold">{t("title")}</h3>
          <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
        </div>
        {form === null && (
          <Button
            variant="outline"
            onClick={() => {
              setForm(leeresFormular());
              setEditId(null);
              setFehler(null);
            }}
          >
            <Icon icon="ph:plus" className="size-4" />
            {t("newTerms")}
          </Button>
        )}
      </div>

      {laedt && (
        <p className="text-sm text-muted-foreground">{t("loading")}</p>
      )}
      {ladefehler && (
        <p className="text-sm text-destructive">{ladefehler}</p>
      )}

      {!laedt && !ladefehler && items.length === 0 && form === null && (
        <div className="flex flex-col gap-1 rounded-(--radius) border border-dashed border-border p-4">
          <p className="text-sm font-medium">{t("emptyTitle")}</p>
          <p className="text-sm text-muted-foreground">{t("emptyHint")}</p>
        </div>
      )}

      {items.length > 0 && (
        <ul className="flex flex-col gap-2">
          {items.map((v) => (
            <li
              key={v.id}
              className="flex flex-wrap items-start justify-between gap-3 rounded-(--radius) border border-border p-3"
            >
              <div className="flex min-w-0 flex-col gap-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold">
                    {t("pctValue", { pct: v.provisions_pct })}
                  </span>
                  {v.aktuell ? (
                    <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                      {t("current")}
                    </span>
                  ) : (
                    <span className="rounded-full bg-secondary px-2 py-0.5 text-xs text-muted-foreground">
                      {t("expired")}
                    </span>
                  )}
                  {v.property_id && (
                    <span className="rounded-full bg-secondary px-2 py-0.5 text-xs text-muted-foreground">
                      {objektTitel(v.property_id)}
                    </span>
                  )}
                </div>
                <span className="text-sm text-muted-foreground">
                  {t("range", {
                    from: v.gueltig_ab,
                    to: v.gueltig_bis ?? t("openEnded"),
                  })}
                </span>
                {v.min_provision_betrag != null && (
                  <span className="text-sm text-muted-foreground">
                    {t("minCommissionLabel")}:{" "}
                    {formatCurrency(
                      v.min_provision_betrag,
                      v.min_provision_currency,
                    )}
                  </span>
                )}
                {v.pauschale_betrag != null && (
                  <span className="text-sm text-muted-foreground">
                    {t("flatFeeLabel")}:{" "}
                    {formatCurrency(v.pauschale_betrag, v.pauschale_currency)} ·{" "}
                    {t(`basis.${v.pauschale_basis ?? "je_buchung"}`)} ·{" "}
                    {t(`timing.${v.pauschale_zeitpunkt ?? "nach_provision"}`)}
                  </span>
                )}
                {v.notiz && (
                  <span className="text-sm text-muted-foreground">{v.notiz}</span>
                )}
              </div>
              <div className="flex shrink-0 gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  disabled={busy}
                  aria-label={t("edit")}
                  onClick={() => {
                    setForm(ausVertrag(v));
                    setEditId(v.id);
                    setFehler(null);
                  }}
                >
                  <Icon icon="ph:pencil-simple" className="size-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  disabled={busy}
                  aria-label={t("delete")}
                  onClick={() => void loeschen(v.id)}
                >
                  <Icon icon="ph:trash" className="size-4" />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {form && (
        <div className="flex flex-col gap-4 rounded-(--radius) border border-border bg-secondary/30 p-4">
          <h4 className="font-semibold">
            {editId ? t("editTerms") : t("newTerms")}
          </h4>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {!editId && (
              <Feld label={t("scope")} hint={t("scopeHint")} ariaLabel={t("infoAria", { feld: t("scope") })}>
                <NativeSelect
                  value={form.property_id}
                  onChange={(e) => set("property_id", e.target.value)}
                >
                  <option value="">{t("allProperties")}</option>
                  {properties.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.title}
                    </option>
                  ))}
                </NativeSelect>
              </Feld>
            )}
            <Feld label={t("commissionPct")} hint={t("commissionPctHint")} ariaLabel={t("infoAria", { feld: t("commissionPct") })}>
              <Input
                type="number"
                min={0}
                max={100}
                step="0.01"
                value={form.provisions_pct}
                onChange={(e) => set("provisions_pct", e.target.value)}
              />
            </Feld>
            <Feld label={t("validFrom")}>
              <Input
                type="date"
                value={form.gueltig_ab}
                onChange={(e) => set("gueltig_ab", e.target.value)}
              />
            </Feld>
            <Feld label={t("validTo")} hint={t("validToHint")} ariaLabel={t("infoAria", { feld: t("validTo") })}>
              <Input
                type="date"
                value={form.gueltig_bis}
                onChange={(e) => set("gueltig_bis", e.target.value)}
              />
            </Feld>
          </div>

          <div className="flex flex-col gap-2">
            <span className="text-sm font-semibold">{t("minCommission")}</span>
            <p className="text-xs text-muted-foreground">
              {t("minCommissionHint")}
            </p>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Feld label={t("amount")}>
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  value={form.min_betrag}
                  onChange={(e) => set("min_betrag", e.target.value)}
                />
              </Feld>
              <Feld label={t("currency")} hint={t("currencyHint")} ariaLabel={t("infoAria", { feld: t("currency") })}>
                <Input
                  value={form.min_currency}
                  maxLength={3}
                  placeholder={t("currencyPlaceholder")}
                  onChange={(e) =>
                    set("min_currency", e.target.value.toUpperCase())
                  }
                />
              </Feld>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <span className="text-sm font-semibold">{t("flatFee")}</span>
            <p className="text-xs text-muted-foreground">{t("flatFeeHint")}</p>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Feld label={t("amount")}>
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  value={form.pauschale_betrag}
                  onChange={(e) => set("pauschale_betrag", e.target.value)}
                />
              </Feld>
              <Feld label={t("currency")} hint={t("currencyHint")} ariaLabel={t("infoAria", { feld: t("currency") })}>
                <Input
                  value={form.pauschale_currency}
                  maxLength={3}
                  placeholder={t("currencyPlaceholder")}
                  onChange={(e) =>
                    set("pauschale_currency", e.target.value.toUpperCase())
                  }
                />
              </Feld>
              <Feld label={t("flatFeeBasis")}>
                <NativeSelect
                  value={form.pauschale_basis}
                  onChange={(e) =>
                    set("pauschale_basis", e.target.value as PauschaleBasis)
                  }
                >
                  <option value="je_buchung">{t("basis.je_buchung")}</option>
                  <option value="je_nacht">{t("basis.je_nacht")}</option>
                </NativeSelect>
              </Feld>
              <Feld label={t("flatFeeTiming")} hint={t("flatFeeTimingHint")} ariaLabel={t("infoAria", { feld: t("flatFeeTiming") })}>
                <NativeSelect
                  value={form.pauschale_zeitpunkt}
                  onChange={(e) =>
                    set(
                      "pauschale_zeitpunkt",
                      e.target.value as PauschaleZeitpunkt,
                    )
                  }
                >
                  <option value="vor_provision">
                    {t("timing.vor_provision")}
                  </option>
                  <option value="nach_provision">
                    {t("timing.nach_provision")}
                  </option>
                </NativeSelect>
              </Feld>
            </div>
          </div>

          <Feld label={t("note")}>
            <Textarea
              rows={2}
              value={form.notiz}
              onChange={(e) => set("notiz", e.target.value)}
            />
          </Feld>

          <div className="flex flex-wrap items-center gap-2">
            {fehler && (
              <span className="mr-auto text-sm text-destructive">{fehler}</span>
            )}
            <Button
              variant="ghost"
              className={fehler ? "" : "ml-auto"}
              disabled={busy}
              onClick={() => {
                setForm(null);
                setEditId(null);
                setFehler(null);
              }}
            >
              {t("cancel")}
            </Button>
            <Button disabled={busy} onClick={() => void speichern()}>
              {busy ? (
                <Icon icon="ph:spinner" className="size-4 animate-spin" />
              ) : (
                <Icon icon="ph:check" className="size-4" />
              )}
              {t("save")}
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}

function Feld({
  label,
  hint,
  ariaLabel,
  children,
}: {
  label: string;
  /** Erklärung zum Feld. Steht als Info-Symbol NEBEN der Beschriftung statt
   *  als Kleingedrucktes darunter: die Maske hat elf Felder, elf Hinweiszeilen
   *  darunter liest niemand mehr. Per Klick geöffnet, damit sie auch auf
   *  Touchgeräten erreichbar ist. */
  hint?: string;
  /** Beschriftung des Info-Knopfes — MUSS aus der Übersetzung kommen. Ein hier
   *  zusammengebauter deutscher Zusatz („… — Erklärung") bliebe in 23 Sprachen
   *  deutsch und wäre für Screenreader die einzige Textquelle. */
  ariaLabel?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
        {label}
        {hint && ariaLabel && <InfoHinweis text={hint} ariaLabel={ariaLabel} />}
      </span>
      {children}
    </label>
  );
}
