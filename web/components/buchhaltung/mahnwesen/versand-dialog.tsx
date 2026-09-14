"use client";

// Detail + Versand einer Mahnung: Empfänger, Betreff, Text; das PDF entsteht im
// Browser (mahnung-pdf.ts) und geht Base64 an POST /reminders/{id}/send. Bei
// Entwürfen zusätzlich Kopf-/Fußtext editierbar; Statuswechsel (bezahlt,
// storniert), Löschen nur bei Entwürfen — die Regeln prüft der Server, hier
// werden nur die passenden Knöpfe gezeigt.
//
// Aufgeteilt in Eckdaten, Entwurfsfelder, Aktionsleiste und den Hook
// `useMahnungAktionen` (Sichern → PDF → Senden/Status/Löschen): ein Dialog mit
// allem in einer Funktion hatte 260 Zeilen und Komplexität 16.
import { Icon } from "@iconify/react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@nextdays/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@nextdays/ui/dialog";
import { InfoHinweis } from "@nextdays/ui/info-hinweis";
import { Input } from "@nextdays/ui/input";
import { Label } from "@nextdays/ui/label";
import { Textarea } from "@nextdays/ui/textarea";
import { mahnungPdfErzeugen, type MahnungTexte } from "@/components/buchhaltung/mahnwesen/mahnung-pdf";
import {
  deleteReminder,
  sendReminder,
  setReminderStatus,
  updateReminder,
} from "@/lib/buchhaltung-mahnwesen";
import type { FirmaKopf, Reminder } from "@/lib/buchhaltung-mahnwesen-typen";
import { formatCurrency } from "@/lib/currency";

type T = ReturnType<typeof useTranslations<"finance">>;

interface Entwurf {
  kopf: string;
  fuss: string;
  empfaenger: string;
  betreff: string;
  text: string;
}

export function VersandDialog({
  reminder,
  firma,
  open,
  onClose,
}: {
  reminder: Reminder;
  firma: FirmaKopf;
  open: boolean;
  onClose: () => void;
}) {
  const t = useTranslations("finance");
  const locale = useLocale();
  const istEntwurf = reminder.status === "draft";
  const [entwurf, setEntwurf] = useState<Entwurf>(() => ({
    kopf: reminder.textHeader ?? "",
    fuss: reminder.textFooter ?? "",
    empfaenger: reminder.customerEmail ?? "",
    betreff: t("mahnwesenPage.defaultSubject", {
      number: reminder.reminderNumber,
      invoice: reminder.invoiceNumber ?? "",
    }),
    text: t("mahnwesenPage.defaultBody", {
      invoice: reminder.invoiceNumber ?? "",
      total: formatCurrency(Number(reminder.amountTotal), reminder.currency, locale),
      due: new Intl.DateTimeFormat(locale).format(new Date(reminder.dueDate)),
      company: firma.companyName,
    }),
  }));
  const aktionen = useMahnungAktionen({ reminder, firma, entwurf, istEntwurf, onClose });

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogTitle>
          {t("mahnwesenPage.levelLabel", { level: reminder.level })} · {reminder.reminderNumber}
        </DialogTitle>
        <DialogDescription>
          {t("mahnwesenPage.detailSubtitle", {
            invoice: reminder.invoiceNumber ?? "",
            customer: reminder.customerName ?? "—",
          })}
        </DialogDescription>

        <Eckdaten reminder={reminder} t={t} locale={locale} />

        {istEntwurf && (
          <EntwurfFelder
            entwurf={entwurf}
            onChange={(patch) => setEntwurf((alt) => ({ ...alt, ...patch }))}
            t={t}
          />
        )}

        {aktionen.fehler && <p className="mt-3 text-sm text-destructive">{aktionen.fehler}</p>}

        <Aktionsleiste status={reminder.status} pending={aktionen.pending} aktionen={aktionen} t={t} />
      </DialogContent>
    </Dialog>
  );
}

function Eckdaten({ reminder, t, locale }: { reminder: Reminder; t: T; locale: string }) {
  const geld = (b: string) => formatCurrency(Number(b), reminder.currency, locale);
  const datum = (iso: string | null) =>
    iso ? new Intl.DateTimeFormat(locale).format(new Date(iso)) : "—";
  return (
    <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-2 rounded-2xl bg-secondary/40 p-4 text-sm sm:grid-cols-4">
      <Posten label={t("mahnwesenPage.pdfOffen")} wert={geld(reminder.amountOpen)} />
      <Posten label={t("mahnwesenPage.pdfGebuehr")} wert={geld(reminder.fee)} />
      <Posten
        label={`${t("mahnwesenPage.pdfZinsen")} (${reminder.interestRate} %)`}
        wert={geld(reminder.interest)}
      />
      <Posten label={t("mahnwesenPage.pdfGesamt")} wert={geld(reminder.amountTotal)} fett />
      <Posten label={t("mahnwesenPage.pdfMahndatum")} wert={datum(reminder.reminderDate)} />
      <Posten label={t("mahnwesenPage.pdfZahlbarBis")} wert={datum(reminder.dueDate)} />
      <Posten label={t("mahnwesenPage.pdfTage")} wert={String(reminder.daysOverdue)} />
      <Posten
        label={t("mahnwesenPage.colStatus")}
        wert={t(`mahnwesenPage.status${statusKey(reminder.status)}`)}
      />
    </dl>
  );
}

function EntwurfFelder({
  entwurf,
  onChange,
  t,
}: {
  entwurf: Entwurf;
  onChange: (patch: Partial<Entwurf>) => void;
  t: T;
}) {
  return (
    <>
      <div className="mt-4 grid gap-3">
        <div className="flex flex-col gap-1">
          <Label htmlFor="kopf">{t("mahnwesenPage.textHeader")}</Label>
          <Textarea id="kopf" rows={3} maxLength={4000} value={entwurf.kopf} onChange={(e) => onChange({ kopf: e.target.value })} />
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="fuss">{t("mahnwesenPage.textFooter")}</Label>
          <Textarea id="fuss" rows={2} maxLength={4000} value={entwurf.fuss} onChange={(e) => onChange({ fuss: e.target.value })} />
        </div>
      </div>
      <div className="mt-4 grid gap-3">
        <div className="flex flex-col gap-1">
          <Label htmlFor="an" className="flex items-center gap-1">
            {t("mahnwesenPage.recipients")}
            <InfoHinweis
              text={t("mahnwesenPage.recipientsHint")}
              ariaLabel={t("mahnwesenPage.recipientsHintAria")}
            />
          </Label>
          <Input id="an" value={entwurf.empfaenger} onChange={(e) => onChange({ empfaenger: e.target.value })} />
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="betreff">{t("mahnwesenPage.subject")}</Label>
          <Input id="betreff" maxLength={300} value={entwurf.betreff} onChange={(e) => onChange({ betreff: e.target.value })} />
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="text">{t("mahnwesenPage.body")}</Label>
          <Textarea id="text" rows={6} maxLength={20000} value={entwurf.text} onChange={(e) => onChange({ text: e.target.value })} />
        </div>
      </div>
    </>
  );
}

function Aktionsleiste({
  status,
  pending,
  aktionen,
  t,
}: {
  status: Reminder["status"];
  pending: string | null;
  aktionen: ReturnType<typeof useMahnungAktionen>;
  t: T;
}) {
  const istEntwurf = status === "draft";
  const gesperrt = pending !== null;
  return (
    <div className="mt-6 flex flex-wrap items-center justify-between gap-2">
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" onClick={aktionen.pdfAnzeigen} disabled={gesperrt}>
          <Icon icon="ph:file-pdf" className="size-4" />
          {t("mahnwesenPage.showPdf")}
        </Button>
        {istEntwurf && (
          <Button variant="ghost" onClick={aktionen.loeschen} disabled={gesperrt} className="text-destructive">
            <Icon icon="ph:trash" className="size-4" />
            {t("mahnwesenPage.delete")}
          </Button>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        {istEntwurf && (
          <Button variant="outline" onClick={() => aktionen.status("sent")} disabled={gesperrt}>
            {t("mahnwesenPage.markSent")}
          </Button>
        )}
        {status === "sent" && (
          <>
            <Button variant="outline" onClick={() => aktionen.status("cancelled")} disabled={gesperrt}>
              {t("mahnwesenPage.markCancelled")}
            </Button>
            <Button onClick={() => aktionen.status("paid")} disabled={gesperrt}>
              <Icon icon="ph:check" className="size-4" />
              {t("mahnwesenPage.markPaid")}
            </Button>
          </>
        )}
        {istEntwurf && (
          <Button onClick={aktionen.senden} disabled={gesperrt}>
            <Icon icon="ph:paper-plane-tilt" className="size-4" />
            {pending === "send" ? t("mahnwesenPage.sending") : t("mahnwesenPage.send")}
          </Button>
        )}
      </div>
    </div>
  );
}

// Sichern → PDF → Senden/Status/Löschen. Jeder Schritt meldet seinen Fehler in
// `fehler`; `pending` trägt den laufenden Schritt und sperrt die Knöpfe.
function useMahnungAktionen({
  reminder,
  firma,
  entwurf,
  istEntwurf,
  onClose,
}: {
  reminder: Reminder;
  firma: FirmaKopf;
  entwurf: Entwurf;
  istEntwurf: boolean;
  onClose: () => void;
}) {
  const t = useTranslations("finance");
  const locale = useLocale();
  const router = useRouter();
  const [pending, setPending] = useState<string | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);

  // Texte eines Entwurfs erst sichern, damit PDF und Datensatz übereinstimmen.
  async function texteSichern(): Promise<Reminder | null> {
    if (!istEntwurf) return reminder;
    const unveraendert =
      entwurf.kopf === (reminder.textHeader ?? "") && entwurf.fuss === (reminder.textFooter ?? "");
    if (unveraendert) return reminder;
    const res = await updateReminder(reminder.id, { textHeader: entwurf.kopf, textFooter: entwurf.fuss });
    if (!res.ok) {
      setFehler(res.error);
      return null;
    }
    return res.data;
  }

  async function pdfErzeugen() {
    const aktuell = await texteSichern();
    if (!aktuell) return null;
    return mahnungPdfErzeugen(aktuell, firma, pdfTexte(t, reminder), locale);
  }

  async function pdfAnzeigen() {
    setPending("pdf");
    setFehler(null);
    try {
      const pdf = await pdfErzeugen();
      if (!pdf) return;
      const url = URL.createObjectURL(new Blob([new Uint8Array(pdf.bytes)], { type: "application/pdf" }));
      window.open(url, "_blank", "noopener");
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (exc) {
      console.error("mahnung_pdf_fehlgeschlagen", exc);
      setFehler(t("mahnwesenPage.pdfError"));
    } finally {
      setPending(null);
    }
  }

  async function senden() {
    const an = entwurf.empfaenger.split(/[,;\s]+/).map((s) => s.trim()).filter(Boolean);
    if (!an.length) {
      setFehler(t("mahnwesenPage.recipientsMissing"));
      return;
    }
    setPending("send");
    setFehler(null);
    try {
      const pdf = await pdfErzeugen();
      if (!pdf) return;
      const res = await sendReminder(reminder.id, {
        to: an,
        subject: entwurf.betreff,
        text: entwurf.text,
        pdfBase64: pdf.base64,
        filename: `${reminder.reminderNumber}.pdf`,
      });
      abschliessen(res, "mahnwesenPage.sent", "mahnwesenPage.sendError");
    } catch (exc) {
      console.error("mahnung_versand_fehlgeschlagen", exc);
      setFehler(t("mahnwesenPage.pdfError"));
    } finally {
      setPending(null);
    }
  }

  async function status(neu: "sent" | "paid" | "cancelled") {
    setPending(neu);
    setFehler(null);
    const res = await setReminderStatus(reminder.id, neu);
    setPending(null);
    abschliessen(res, "mahnwesenPage.statusChanged", "mahnwesenPage.statusError");
  }

  async function loeschen() {
    setPending("delete");
    setFehler(null);
    const res = await deleteReminder(reminder.id);
    setPending(null);
    abschliessen(res, "mahnwesenPage.deleted", "mahnwesenPage.deleteError");
  }

  function abschliessen(
    res: { ok: true } | { ok: false; error: string },
    erfolg: Parameters<T>[0],
    misserfolg: Parameters<T>[0],
  ) {
    if (!res.ok) {
      setFehler(res.error);
      toast.error(t(misserfolg));
      return;
    }
    toast.success(t(erfolg));
    router.refresh();
    onClose();
  }

  return { pending, fehler, pdfAnzeigen, senden, status, loeschen };
}

function pdfTexte(t: T, reminder: Reminder): MahnungTexte {
  return {
    titel: t("mahnwesenPage.levelLabel", { level: reminder.level }),
    betreff: t("mahnwesenPage.pdfBetreff", {
      number: reminder.reminderNumber,
      invoice: reminder.invoiceNumber ?? "",
    }),
    anrede: t("mahnwesenPage.pdfAnrede"),
    posten: {
      rechnung: t("mahnwesenPage.pdfRechnung"),
      faelligSeit: t("mahnwesenPage.pdfFaelligSeit"),
      tageUeberfaellig: t("mahnwesenPage.pdfTage"),
      offenerBetrag: t("mahnwesenPage.pdfOffen"),
      mahngebuehr: t("mahnwesenPage.pdfGebuehr"),
      verzugszinsen: t("mahnwesenPage.pdfZinsen"),
      gesamt: t("mahnwesenPage.pdfGesamt"),
      zahlbarBis: t("mahnwesenPage.pdfZahlbarBis"),
      mahndatum: t("mahnwesenPage.pdfMahndatum"),
      bank: t("mahnwesenPage.pdfBank"),
    },
  };
}

function Posten({ label, wert, fett }: { label: string; wert: string; fett?: boolean }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className={fett ? "font-semibold" : ""}>{wert}</dd>
    </div>
  );
}

export function statusKey(status: Reminder["status"]): "Draft" | "Sent" | "Paid" | "Cancelled" {
  switch (status) {
    case "draft":
      return "Draft";
    case "sent":
      return "Sent";
    case "paid":
      return "Paid";
    default:
      return "Cancelled";
  }
}
