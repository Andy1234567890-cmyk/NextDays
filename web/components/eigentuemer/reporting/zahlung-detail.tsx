"use client";

// Zahlung-Detail — die Auszahlung an EINEN Empfänger.
//
// Aufbau: KPI-Zeile, die drei Textblöcke des Empfängers (Bankverbindung,
// Konditionen, Rechnungsfußzeile), Aktionen, dann die Posten NACH ABSCHNITT
// gruppiert und zuletzt die Teilzahlungen.
//
// Die Abschnitte werden getrennt ausgewiesen und nicht zu einer Liste
// zusammengezogen: „Unterkunftspreis 43.527" und „Ausgaben −1.200" sind zwei
// verschiedene Aussagen über dasselbe Geld, und der Eigentümer prüft sie
// getrennt.
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
import { DatePicker } from "@nextdays/ui/date-picker";
import { Input } from "@nextdays/ui/input";
import { Label } from "@nextdays/ui/label";
import { Textarea } from "@nextdays/ui/textarea";
import { formatCurrency } from "@/lib/currency";
import {
  type Abschnitt,
  addPaymentPart,
  deletePayment,
  deletePaymentPart,
  markPaymentPaid,
  type PaymentDetail,
  updatePayment,
} from "@/lib/owner-reporting";

const ABSCHNITTE: readonly Abschnitt[] = [
  "unterkunftspreis",
  "gebuehren",
  "steuern",
  "ausgaben",
  "andere",
];

export function ZahlungDetailAnsicht({ zahlung }: { zahlung: PaymentDetail }) {
  const t = useTranslations("ownerReporting.paymentDetail");
  const locale = useLocale();
  const router = useRouter();
  const [teilDialog, setTeilDialog] = useState(false);
  const [loeschDialog, setLoeschDialog] = useState(false);
  const [notiz, setNotiz] = useState(zahlung.notiz ?? "");
  const [busy, setBusy] = useState(false);
  const geld = (v: number) => formatCurrency(v, zahlung.currency, locale);

  async function alsBezahlt() {
    setBusy(true);
    const res = await markPaymentPaid(zahlung.id);
    setBusy(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success(t("markedPaid"));
    router.refresh();
  }

  async function notizSpeichern() {
    setBusy(true);
    const res = await updatePayment(zahlung.id, notiz.trim() || null);
    setBusy(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success(t("noteSaved"));
    router.refresh();
  }

  async function teilLoeschen(partId: string) {
    setBusy(true);
    const res = await deletePaymentPart(partId);
    setBusy(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success(t("partDeleted"));
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Link
          href="/eigentuemer/reporting/zahlungen"
          className="w-fit text-sm text-muted-foreground hover:text-foreground"
        >
          ← {t("back")}
        </Link>
        <h1 className="font-display text-3xl font-extrabold">
          {zahlung.report_name} · {zahlung.owner_name ?? "—"}
        </h1>
        <p className="text-sm text-muted-foreground">
          {t("period", {
            from: zahlung.period_from,
            to: zahlung.period_to,
          })}
        </p>
      </div>

      <Card className="grid grid-cols-2 gap-6 p-6 md:grid-cols-4">
        <Kpi
          icon="ph:currency-circle-dollar"
          label={t("kpi.value")}
          value={geld(zahlung.betrag)}
          zusatz={t("kpi.paidPct", { pct: Math.round(zahlung.bezahlt_pct) })}
        />
        <Kpi
          icon="ph:buildings"
          label={t("kpi.rent")}
          value={geld(zahlung.summe_unterkunftspreis)}
        />
        <Kpi
          icon="ph:tag"
          label={t("kpi.feesTaxes")}
          value={geld(zahlung.summe_gebuehren + zahlung.summe_steuern)}
        />
        <Kpi
          icon="ph:arrow-circle-down"
          label={t("kpi.expenses")}
          value={geld(zahlung.summe_ausgaben)}
        />
      </Card>

      {/* Die drei Textblöcke kommen aus den Eigentümer-Stammdaten und werden
          hier NUR gelesen — die Pflege bleibt an einer Stelle (/eigentuemer).
          Zwei Pflegeorte für dieselbe Bankverbindung liefen auseinander. */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Textblock
          titel={t("blocks.legal")}
          inhalt={zahlung.rechtliche_information}
          leer={t("blocks.emptyLegal")}
        />
        <Textblock
          titel={t("blocks.terms")}
          inhalt={zahlung.empfaenger_information}
          leer={t("blocks.emptyTerms")}
        />
        <Textblock
          titel={t("blocks.footer")}
          inhalt={zahlung.rechnungs_fusszeile}
          leer={t("blocks.emptyFooter")}
        />
      </div>

      <div className="flex flex-wrap justify-end gap-2">
        {zahlung.bezahlt_pct < 100 && (
          <Button variant="outline" disabled={busy} onClick={() => void alsBezahlt()}>
            <Icon icon="ph:check-circle" className="size-4" />
            {t("actions.markPaid")}
          </Button>
        )}
        <Button variant="outline" onClick={() => setTeilDialog(true)}>
          <Icon icon="ph:plus-circle" className="size-4" />
          {t("actions.addPart")}
        </Button>
        <Button variant="outline" asChild>
          <Link href={`/eigentuemer/${zahlung.owner_id}`}>
            <Icon icon="ph:user-gear" className="size-4" />
            {t("actions.recipient")}
          </Link>
        </Button>
        <Button variant="destructive" onClick={() => setLoeschDialog(true)}>
          <Icon icon="ph:trash" className="size-4" />
          {t("actions.delete")}
        </Button>
      </div>

      {ABSCHNITTE.map((abschnitt) => {
        const posten = zahlung.items.filter((i) => i.abschnitt === abschnitt);
        if (posten.length === 0) return null;
        const summe = posten.reduce((s, i) => s + i.betrag, 0);
        return (
          <Card key={abschnitt} className="flex flex-col gap-0 overflow-hidden p-0">
            <div className="border-b border-border px-4 py-3">
              <h2 className="font-display text-base font-extrabold">
                {t(`sections.${abschnitt}`)}
              </h2>
            </div>
            <table className="w-full text-sm">
              <tbody>
                {posten.map((p) => (
                  <tr key={p.id} className="border-b border-border">
                    <td className="px-4 py-2">{p.label}</td>
                    <td className="px-4 py-2 text-right tabular-nums">
                      {geld(p.betrag)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-secondary/60 font-semibold">
                  <td className="px-4 py-2">{t("total")}</td>
                  <td className="px-4 py-2 text-right tabular-nums">
                    {geld(summe)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </Card>
        );
      })}

      <Card className="flex flex-col gap-0 overflow-hidden p-0">
        <div className="border-b border-border px-4 py-3">
          <h2 className="font-display text-base font-extrabold">
            {t("grandTotal")}
          </h2>
        </div>
        <table className="w-full text-sm">
          <tbody>
            <Zeile label={t("sections.unterkunftspreis")} wert={geld(zahlung.summe_unterkunftspreis)} />
            <Zeile label={t("sections.gebuehren")} wert={geld(zahlung.summe_gebuehren)} />
            <Zeile label={t("sections.steuern")} wert={geld(zahlung.summe_steuern)} />
            <Zeile label={t("sections.ausgaben")} wert={geld(zahlung.summe_ausgaben)} />
            <Zeile label={t("sections.andere")} wert={geld(zahlung.summe_andere)} />
          </tbody>
          <tfoot>
            <tr className="bg-secondary/60 font-semibold">
              <td className="px-4 py-2">{t("total")}</td>
              <td className="px-4 py-2 text-right tabular-nums">
                {geld(zahlung.betrag)}
              </td>
            </tr>
          </tfoot>
        </table>
      </Card>

      <Card className="flex flex-col gap-0 overflow-hidden p-0">
        <div className="border-b border-border px-4 py-3">
          <h2 className="font-display text-base font-extrabold">
            {t("parts.title")}
          </h2>
        </div>
        {zahlung.parts.length === 0 ? (
          <p className="px-4 py-6 text-sm text-muted-foreground">
            {t("parts.empty")}
          </p>
        ) : (
          <table className="w-full text-sm">
            <tbody>
              {zahlung.parts.map((p) => (
                <tr key={p.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-2 tabular-nums">{p.bezahlt_am}</td>
                  <td className="px-4 py-2 text-muted-foreground">
                    {p.notiz ?? "—"}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums">
                    {geld(p.betrag)}
                  </td>
                  <td className="w-12 px-4 py-2 text-right">
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={t("parts.delete")}
                      disabled={busy}
                      className="size-8 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                      onClick={() => void teilLoeschen(p.id)}
                    >
                      <Icon icon="ph:trash" className="size-4" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <Card className="flex flex-col gap-2 p-6">
        <Label htmlFor="zahlung-notiz">{t("note")}</Label>
        <Textarea
          id="zahlung-notiz"
          value={notiz}
          onChange={(e) => setNotiz(e.target.value)}
          rows={3}
          placeholder={t("notePlaceholder")}
        />
        <div className="flex justify-end">
          <Button
            variant="outline"
            size="sm"
            disabled={busy || notiz === (zahlung.notiz ?? "")}
            onClick={() => void notizSpeichern()}
          >
            {t("saveNote")}
          </Button>
        </div>
      </Card>

      {teilDialog && (
        <TeilzahlungDialog
          zahlung={zahlung}
          onClose={() => setTeilDialog(false)}
        />
      )}
      {loeschDialog && (
        <ZahlungLoeschenDialog
          zahlung={zahlung}
          onClose={() => setLoeschDialog(false)}
        />
      )}
    </div>
  );
}

function Zeile({ label, wert }: { label: string; wert: string }) {
  return (
    <tr className="border-b border-border">
      <td className="px-4 py-2">{label}</td>
      <td className="px-4 py-2 text-right tabular-nums">{wert}</td>
    </tr>
  );
}

function Kpi({
  icon,
  label,
  value,
  zusatz,
}: {
  icon: string;
  label: string;
  value: string;
  zusatz?: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <Icon icon={icon} className="size-4" />
        {label}
      </span>
      <span className="font-display text-xl font-extrabold tabular-nums">
        {value}
      </span>
      {zusatz && (
        <span className="text-xs text-muted-foreground">{zusatz}</span>
      )}
    </div>
  );
}

/** Ein Stammdaten-Textblock. Leere Blöcke zeigen den GRUND, nicht ein „—":
 *  „Bankverbindung nicht gepflegt" ist eine Aufforderung, „—" ist keine. */
function Textblock({
  titel,
  inhalt,
  leer,
}: {
  titel: string;
  inhalt: string | null;
  leer: string;
}) {
  return (
    <Card className="flex flex-col gap-2 p-5">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {titel}
      </p>
      {inhalt ? (
        <pre className="whitespace-pre-wrap font-mono text-xs leading-relaxed">
          {inhalt}
        </pre>
      ) : (
        <p className="text-xs text-muted-foreground">{leer}</p>
      )}
    </Card>
  );
}

function TeilzahlungDialog({
  zahlung,
  onClose,
}: {
  zahlung: PaymentDetail;
  onClose: () => void;
}) {
  const t = useTranslations("ownerReporting.paymentDetail");
  const router = useRouter();
  const gezahlt = zahlung.parts.reduce((s, p) => s + p.betrag, 0);
  const offen = Math.max(zahlung.betrag - gezahlt, 0);
  const [betrag, setBetrag] = useState(offen > 0 ? `${offen}` : "");
  const [datum, setDatum] = useState(heute());
  const [notiz, setNotiz] = useState("");
  const [busy, setBusy] = useState(false);
  const wert = Number.parseFloat(betrag.replace(",", "."));
  const gueltig = Number.isFinite(wert) && wert > 0 && wert <= offen && datum !== "";

  async function submit() {
    if (!gueltig) return;
    setBusy(true);
    const res = await addPaymentPart(zahlung.id, {
      betrag: wert,
      bezahlt_am: datum,
      notiz: notiz.trim() || null,
    });
    setBusy(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success(t("parts.added"));
    onClose();
    router.refresh();
  }

  return (
    <Dialog open onOpenChange={(open) => !open && !busy && onClose()}>
      <DialogContent className="max-w-md">
        <div className="flex flex-col gap-4">
          <DialogTitle>{t("parts.newTitle")}</DialogTitle>
          <DialogDescription>
            {t("parts.openAmount", {
              amount: formatCurrency(offen, zahlung.currency, "de-DE"),
            })}
          </DialogDescription>
          <div className="flex flex-col gap-1">
            <Label htmlFor="teil-betrag">{t("parts.amount")}</Label>
            <Input
              id="teil-betrag"
              inputMode="decimal"
              value={betrag}
              onChange={(e) => setBetrag(e.target.value)}
              autoFocus
            />
            {betrag !== "" && !gueltig && (
              // Der Server lehnt das ohnehin ab (422) — hier steht der Grund
              // schon vor dem Klick.
              <p className="text-xs text-destructive">{t("parts.tooMuch")}</p>
            )}
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="teil-datum">{t("parts.date")}</Label>
            <DatePicker value={datum} onChange={setDatum} />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="teil-notiz">{t("parts.note")}</Label>
            <Input
              id="teil-notiz"
              value={notiz}
              onChange={(e) => setNotiz(e.target.value)}
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={onClose} disabled={busy}>
              {t("parts.cancel")}
            </Button>
            <Button onClick={() => void submit()} disabled={busy || !gueltig}>
              {t("parts.save")}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ZahlungLoeschenDialog({
  zahlung,
  onClose,
}: {
  zahlung: PaymentDetail;
  onClose: () => void;
}) {
  const t = useTranslations("ownerReporting.paymentDetail");
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    const res = await deletePayment(zahlung.id);
    if (res.ok) {
      toast.success(t("deleted"));
      router.push("/eigentuemer/reporting/zahlungen");
      router.refresh();
      return;
    }
    setBusy(false);
    toast.error(res.error);
  }

  return (
    <Dialog open onOpenChange={(open) => !open && !busy && onClose()}>
      <DialogContent className="max-w-md">
        <div className="flex flex-col gap-4">
          <DialogTitle>{t("actions.delete")}</DialogTitle>
          <DialogDescription>{t("deleteConfirm")}</DialogDescription>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={onClose} disabled={busy}>
              {t("parts.cancel")}
            </Button>
            <Button
              variant="destructive"
              onClick={() => void submit()}
              disabled={busy}
            >
              {t("actions.delete")}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** Lokales ISO-Datum von heute — `toISOString()` wäre UTC und läge in
 *  östlichen Zeitzonen abends bereits einen Tag daneben. */
function heute(): string {
  const d = new Date();
  const m = `${d.getMonth() + 1}`.padStart(2, "0");
  const t = `${d.getDate()}`.padStart(2, "0");
  return `${d.getFullYear()}-${m}-${t}`;
}
