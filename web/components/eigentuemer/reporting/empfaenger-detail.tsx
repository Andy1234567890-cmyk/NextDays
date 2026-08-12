"use client";

// Empfänger-Detail im Reporting: Kennzahlen, seine Zahlungen und die
// WIEDERKEHRENDEN POSTEN.
//
// Stammdaten (Bankverbindung, Adresse, Sprache) und der Abrechnungsvertrag
// werden hier NICHT gepflegt, sondern verlinkt: sie gehören auf
// `/eigentuemer/{id}`. Zwei Pflegeorte für dieselbe IBAN liefen auseinander,
// und niemand wüsste, welche die Abrechnung benutzt.
import { Icon } from "@iconify/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@nextdays/ui/button";
import { Card } from "@nextdays/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@nextdays/ui/dialog";
import { Input } from "@nextdays/ui/input";
import { Label } from "@nextdays/ui/label";
import { NativeSelect } from "@nextdays/ui/native-select";
import { formatCurrency } from "@/lib/currency";
import {
  type Abschnitt,
  createRecurring,
  deleteRecurring,
  type EmpfaengerZeile,
  type PaymentListItem,
  type RecurringItem,
  type RecurringModus,
  updateRecurring,
} from "@/lib/owner-reporting";

/** `steuern` fehlt bewusst: eine Steuer folgt dem Steuerrecht des Objekts
 *  (`property_taxes`) und nicht einer Absprache zwischen Betrieb und
 *  Eigentümer. Sie hier zuzulassen erzeugte eine zweite, konkurrierende
 *  Steuerquelle — und damit zwei Steuerbeträge für denselben Aufenthalt. */
const ABSCHNITTE: readonly Abschnitt[] = [
  "unterkunftspreis",
  "gebuehren",
  "ausgaben",
  "andere",
];

const MODI: readonly RecurringModus[] = [
  "je_buchung",
  "je_nacht",
  "je_zeitraum",
];

export function EmpfaengerDetail({
  empfaenger,
  posten,
  zahlungen,
  objekte,
  waehrungen,
}: {
  empfaenger: EmpfaengerZeile;
  posten: RecurringItem[];
  zahlungen: PaymentListItem[];
  /** Objekte dieses Empfängers — ein Posten kann auf eines beschränkt werden. */
  objekte: { id: string; title: string }[];
  waehrungen: string[];
}) {
  const t = useTranslations("ownerReporting.recipientDetail");
  const locale = useLocale();
  const router = useRouter();
  const [neu, setNeu] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function umschalten(p: RecurringItem) {
    setBusyId(p.id);
    const res = await updateRecurring(p.id, { aktiv: !p.aktiv });
    setBusyId(null);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    router.refresh();
  }

  async function entfernen(p: RecurringItem) {
    setBusyId(p.id);
    const res = await deleteRecurring(p.id);
    setBusyId(null);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success(t("recurring.deleted"));
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-2">
          <Link
            href="/eigentuemer/reporting/empfaenger"
            className="w-fit text-sm text-muted-foreground hover:text-foreground"
          >
            ← {t("back")}
          </Link>
          <h1 className="font-display text-3xl font-extrabold">
            {empfaenger.name}
          </h1>
          <p className="text-sm text-muted-foreground">
            {empfaenger.email ?? t("noEmail")}
          </p>
        </div>
        <Button variant="outline" asChild>
          <Link href={`/eigentuemer/${empfaenger.owner_id}`}>
            <Icon icon="ph:user-gear" className="size-4" />
            {t("masterData")}
          </Link>
        </Button>
      </div>

      {!empfaenger.hat_vertrag && (
        // Ohne Vertrag am Stichtag ist keine Auszahlung berechenbar. Der
        // Hinweis steht hier, nicht erst als 422 nach dem Klick.
        <Card className="flex flex-wrap items-center justify-between gap-3 border-destructive/40 p-5">
          <p className="flex items-center gap-2 text-sm text-destructive">
            <Icon icon="ph:warning" className="size-4" />
            {t("noTerms")}
          </p>
          <Button variant="outline" size="sm" asChild>
            <Link href={`/eigentuemer/${empfaenger.owner_id}`}>
              {t("addTerms")}
            </Link>
          </Button>
        </Card>
      )}

      <Card className="grid grid-cols-2 gap-6 p-6 md:grid-cols-3">
        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium text-muted-foreground">
            {t("kpi.properties")}
          </span>
          <span className="font-display text-xl font-extrabold tabular-nums">
            {empfaenger.property_count}
          </span>
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium text-muted-foreground">
            {t("kpi.payments")}
          </span>
          <span className="font-display text-xl font-extrabold tabular-nums">
            {empfaenger.payment_count}
          </span>
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium text-muted-foreground">
            {t("kpi.volume")}
          </span>
          {empfaenger.payment_total.length === 0 ? (
            <span className="font-display text-xl font-extrabold">—</span>
          ) : (
            // Je Währung getrennt — nicht addiert (Wurzel 4).
            empfaenger.payment_total.map((w) => (
              <span
                key={w.currency}
                className="font-display text-xl font-extrabold tabular-nums"
              >
                {formatCurrency(w.amount, w.currency, locale)}
              </span>
            ))
          )}
        </div>
      </Card>

      {/* Wiederkehrende Posten */}
      <Card className="flex flex-col gap-0 overflow-hidden p-0">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
          <div className="flex flex-col">
            <h2 className="font-display text-base font-extrabold">
              {t("recurring.title")}
            </h2>
            <p className="text-xs text-muted-foreground">
              {t("recurring.hint")}
            </p>
          </div>
          <Button size="sm" onClick={() => setNeu(true)}>
            <Icon icon="ph:plus" className="size-4" />
            {t("recurring.new")}
          </Button>
        </div>
        {posten.length === 0 ? (
          <p className="px-4 py-6 text-sm text-muted-foreground">
            {t("recurring.empty")}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[42rem] text-sm">
              <thead>
                <tr className="border-b border-border bg-secondary/40 text-left">
                  <th className="px-4 py-2 font-semibold">
                    {t("recurring.cols.label")}
                  </th>
                  <th className="px-4 py-2 font-semibold">
                    {t("recurring.cols.section")}
                  </th>
                  <th className="px-4 py-2 font-semibold">
                    {t("recurring.cols.mode")}
                  </th>
                  <th className="px-4 py-2 font-semibold">
                    {t("recurring.cols.property")}
                  </th>
                  <th className="px-4 py-2 text-right font-semibold">
                    {t("recurring.cols.amount")}
                  </th>
                  <th className="px-4 py-2 text-right font-semibold">
                    {t("recurring.cols.actions")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {posten.map((p) => (
                  <tr
                    key={p.id}
                    className={`border-b border-border last:border-0 ${
                      p.aktiv ? "" : "text-muted-foreground"
                    }`}
                  >
                    <td className="px-4 py-2 font-medium">{p.label}</td>
                    <td className="px-4 py-2">
                      {t(`sections.${p.abschnitt}`)}
                    </td>
                    <td className="px-4 py-2">{t(`modes.${p.modus}`)}</td>
                    <td className="px-4 py-2 text-muted-foreground">
                      {p.property_id
                        ? (objekte.find((o) => o.id === p.property_id)?.title ??
                          p.property_id)
                        : t("recurring.allProperties")}
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums">
                      {/* Ausgaben MINDERN die Auszahlung — das Vorzeichen
                          steht hier, nicht im Betrag (der ist immer positiv). */}
                      {p.abschnitt === "ausgaben" ? "−" : ""}
                      {formatCurrency(p.betrag, p.currency, locale)}
                    </td>
                    <td className="px-4 py-2">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={busyId === p.id}
                          onClick={() => void umschalten(p)}
                        >
                          {p.aktiv
                            ? t("recurring.deactivate")
                            : t("recurring.activate")}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={`${t("recurring.delete")} — ${p.label}`}
                          disabled={busyId === p.id}
                          className="size-8 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                          onClick={() => void entfernen(p)}
                        >
                          <Icon icon="ph:trash" className="size-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Zahlungen dieses Empfängers */}
      <Card className="flex flex-col gap-0 overflow-hidden p-0">
        <div className="border-b border-border px-4 py-3">
          <h2 className="font-display text-base font-extrabold">
            {t("payments.title")}
          </h2>
        </div>
        {zahlungen.length === 0 ? (
          <p className="px-4 py-6 text-sm text-muted-foreground">
            {t("payments.empty")}
          </p>
        ) : (
          <table className="w-full text-sm">
            <tbody>
              {zahlungen.map((z) => (
                <tr key={z.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-2">
                    <Link
                      href={`/eigentuemer/reporting/zahlungen/${z.id}`}
                      className="font-medium hover:underline"
                    >
                      {z.report_name}
                    </Link>
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums">
                    {formatCurrency(z.betrag, z.currency, locale)}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums text-muted-foreground">
                    {Math.round(z.bezahlt_pct)} %
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      {neu && (
        <PostenDialog
          ownerId={empfaenger.owner_id}
          objekte={objekte}
          waehrungen={waehrungen}
          onClose={() => setNeu(false)}
        />
      )}
    </div>
  );
}

function PostenDialog({
  ownerId,
  objekte,
  waehrungen,
  onClose,
}: {
  ownerId: string;
  objekte: { id: string; title: string }[];
  waehrungen: string[];
  onClose: () => void;
}) {
  const t = useTranslations("ownerReporting.recipientDetail");
  const router = useRouter();
  const [label, setLabel] = useState("");
  const [abschnitt, setAbschnitt] = useState<Abschnitt>("gebuehren");
  const [modus, setModus] = useState<RecurringModus>("je_buchung");
  const [betrag, setBetrag] = useState("");
  const [currency, setCurrency] = useState(waehrungen[0] ?? "");
  const [propertyId, setPropertyId] = useState("");
  const [busy, setBusy] = useState(false);
  const wert = Number.parseFloat(betrag.replace(",", "."));
  const gueltig =
    label.trim().length > 0 &&
    Number.isFinite(wert) &&
    wert > 0 &&
    currency.length === 3;

  async function submit() {
    if (!gueltig) return;
    setBusy(true);
    const res = await createRecurring(ownerId, {
      label: label.trim(),
      abschnitt,
      modus,
      betrag: wert,
      currency,
      property_id: propertyId || null,
    });
    setBusy(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success(t("recurring.created"));
    onClose();
    router.refresh();
  }

  return (
    <Dialog open onOpenChange={(open) => !open && !busy && onClose()}>
      <DialogContent className="max-w-md">
        <div className="flex flex-col gap-4">
          <DialogTitle>{t("recurring.newTitle")}</DialogTitle>
          <DialogDescription>{t("recurring.newHint")}</DialogDescription>
          <div className="flex flex-col gap-1">
            <Label htmlFor="posten-label">{t("recurring.cols.label")}</Label>
            <Input
              id="posten-label"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder={t("recurring.labelPlaceholder")}
              autoFocus
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1">
              <Label htmlFor="posten-abschnitt">
                {t("recurring.cols.section")}
              </Label>
              <NativeSelect
                id="posten-abschnitt"
                value={abschnitt}
                onChange={(e) => setAbschnitt(e.target.value as Abschnitt)}
              >
                {ABSCHNITTE.map((a) => (
                  <option key={a} value={a}>
                    {t(`sections.${a}`)}
                  </option>
                ))}
              </NativeSelect>
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="posten-modus">{t("recurring.cols.mode")}</Label>
              <NativeSelect
                id="posten-modus"
                value={modus}
                onChange={(e) => setModus(e.target.value as RecurringModus)}
              >
                {MODI.map((m) => (
                  <option key={m} value={m}>
                    {t(`modes.${m}`)}
                  </option>
                ))}
              </NativeSelect>
            </div>
          </div>
          {abschnitt === "ausgaben" && (
            <p className="text-xs text-muted-foreground">
              {t("recurring.expenseHint")}
            </p>
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1">
              <Label htmlFor="posten-betrag">
                {t("recurring.cols.amount")}
              </Label>
              <Input
                id="posten-betrag"
                inputMode="decimal"
                value={betrag}
                onChange={(e) => setBetrag(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="posten-currency">{t("recurring.currency")}</Label>
              {waehrungen.length === 0 ? (
                <p className="text-xs text-destructive">
                  {t("recurring.noCurrency")}
                </p>
              ) : (
                <NativeSelect
                  id="posten-currency"
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                >
                  {waehrungen.map((w) => (
                    <option key={w} value={w}>
                      {w}
                    </option>
                  ))}
                </NativeSelect>
              )}
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            {t("recurring.currencyHint")}
          </p>
          <div className="flex flex-col gap-1">
            <Label htmlFor="posten-objekt">
              {t("recurring.cols.property")}
            </Label>
            <NativeSelect
              id="posten-objekt"
              value={propertyId}
              onChange={(e) => setPropertyId(e.target.value)}
            >
              <option value="">{t("recurring.allProperties")}</option>
              {objekte.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.title}
                </option>
              ))}
            </NativeSelect>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={onClose} disabled={busy}>
              {t("recurring.cancel")}
            </Button>
            <Button onClick={() => void submit()} disabled={busy || !gueltig}>
              {t("recurring.save")}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
