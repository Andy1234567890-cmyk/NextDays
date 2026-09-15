"use client";

// Mahnwesen-Übersicht: zwei Reiter — überfällige Rechnungen (mit „Mahnung
// erstellen", Stufe kommt vom Server) und die Mahnungen mit Status-Badges.
// Klick auf eine Mahnung öffnet Detail/Versand. Ohne Einstellungen zeigt die
// Seite den Hinweis und der Anlegen-Knopf führt in den Einstellungs-Dialog
// (der Server würde sonst 422 antworten).
import { Icon } from "@iconify/react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@nextdays/ui/button";
import { Card } from "@nextdays/ui/card";
import { Segmented } from "@nextdays/ui/segmented";
import { EinstellungenDialog } from "@/components/buchhaltung/mahnwesen/einstellungen-dialog";
import { VersandDialog, statusKey } from "@/components/buchhaltung/mahnwesen/versand-dialog";
import { createReminder } from "@/lib/buchhaltung-mahnwesen";
import type {
  FirmaKopf,
  OverdueInvoice,
  Reminder,
  ReminderSettings,
  ReminderStatus,
} from "@/lib/buchhaltung-mahnwesen-typen";
import { formatCurrency } from "@/lib/currency";

const STATUS_CLASSES: Record<ReminderStatus, string> = {
  draft: "bg-secondary text-secondary-foreground",
  sent: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
  paid: "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300",
  cancelled: "bg-muted text-muted-foreground",
};

type Reiter = "overdue" | "reminders";

export function MahnwesenUebersicht({
  overdue,
  reminders,
  settings,
  firma,
}: {
  overdue: OverdueInvoice[];
  reminders: Reminder[];
  settings: ReminderSettings | null;
  firma: FirmaKopf;
}) {
  const t = useTranslations("finance");
  const locale = useLocale();
  const router = useRouter();
  const [reiter, setReiter] = useState<Reiter>("overdue");
  const [einstellungenOffen, setEinstellungenOffen] = useState(false);
  const [detail, setDetail] = useState<Reminder | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const konfiguriert = settings?.configured === true;

  const datum = (iso: string | null) =>
    iso ? new Intl.DateTimeFormat(locale).format(new Date(iso)) : "—";
  const geld = (b: string, w: string) => formatCurrency(Number(b), w, locale);

  async function anlegen(rechnung: OverdueInvoice) {
    if (!konfiguriert) {
      setEinstellungenOffen(true);
      return;
    }
    setPendingId(rechnung.id);
    const res = await createReminder({ invoiceId: rechnung.id });
    setPendingId(null);
    if (!res.ok) {
      toast.error(res.error || t("mahnwesenPage.createError"));
      return;
    }
    toast.success(t("mahnwesenPage.created", { number: res.data.reminderNumber }));
    router.refresh();
    setDetail(res.data);
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-2xl font-extrabold">{t("mahnwesenPage.mahnwesenTitle")}</h2>
          <p className="text-sm text-muted-foreground">{t("mahnwesenPage.subtitle")}</p>
        </div>
        <Button variant="outline" onClick={() => setEinstellungenOffen(true)}>
          <Icon icon="ph:gear" className="size-4" />
          {t("mahnwesenPage.settingsButton")}
        </Button>
      </div>

      {!konfiguriert && (
        <Card className="flex flex-wrap items-center justify-between gap-3 border-amber-300 bg-amber-50 p-4 text-sm dark:border-amber-800 dark:bg-amber-950/40">
          <div className="flex items-start gap-2">
            <Icon icon="ph:warning-circle" className="mt-0.5 size-5 text-amber-600" />
            <div>
              <p className="font-medium">{t("mahnwesenPage.notConfiguredTitle")}</p>
              <p className="text-muted-foreground">{t("mahnwesenPage.notConfiguredText")}</p>
            </div>
          </div>
          <Button size="sm" onClick={() => setEinstellungenOffen(true)}>
            {t("mahnwesenPage.settingsButton")}
          </Button>
        </Card>
      )}

      <Segmented<Reiter>
        value={reiter}
        onChange={setReiter}
        options={[
          { value: "overdue", label: `${t("mahnwesenPage.tabOverdue")} (${overdue.length})` },
          { value: "reminders", label: `${t("mahnwesenPage.tabReminders")} (${reminders.length})` },
        ]}
      />

      {reiter === "overdue" && (
        <UeberfaelligeTabelle
          overdue={overdue}
          pendingId={pendingId}
          datum={datum}
          geld={geld}
          onAnlegen={anlegen}
        />
      )}

      {reiter === "reminders" &&
        (reminders.length === 0 ? (
          <Leer icon="ph:bell-simple" titel={t("mahnwesenPage.remindersEmptyTitle")} text={t("mahnwesenPage.remindersEmptySubtitle")} />
        ) : (
          <Card className="overflow-x-auto p-0">
            <table className="w-full text-sm">
              <thead className="border-b bg-secondary/40 text-left text-xs text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-medium">{t("mahnwesenPage.colNumber")}</th>
                  <th className="px-4 py-3 font-medium">{t("mahnwesenPage.colLevel")}</th>
                  <th className="px-4 py-3 font-medium">{t("mahnwesenPage.colInvoice")}</th>
                  <th className="px-4 py-3 font-medium">{t("mahnwesenPage.colCustomer")}</th>
                  <th className="px-4 py-3 font-medium">{t("mahnwesenPage.colDate")}</th>
                  <th className="px-4 py-3 font-medium">{t("mahnwesenPage.colDueDate")}</th>
                  <th className="px-4 py-3 text-right font-medium">{t("mahnwesenPage.colTotal")}</th>
                  <th className="px-4 py-3 font-medium">{t("mahnwesenPage.colStatus")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {reminders.map((m) => (
                  <tr
                    key={m.id}
                    className="cursor-pointer transition-colors hover:bg-secondary/30"
                    onClick={() => setDetail(m)}
                  >
                    <td className="px-4 py-3 font-medium">{m.reminderNumber}</td>
                    <td className="px-4 py-3">{m.level}</td>
                    <td className="px-4 py-3 text-muted-foreground">{m.invoiceNumber ?? "—"}</td>
                    <td className="px-4 py-3 text-muted-foreground">{m.customerName ?? "—"}</td>
                    <td className="px-4 py-3 text-muted-foreground">{datum(m.reminderDate)}</td>
                    <td className="px-4 py-3 text-muted-foreground">{datum(m.dueDate)}</td>
                    <td className="px-4 py-3 text-right font-medium">{geld(m.amountTotal, m.currency)}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_CLASSES[m.status]}`}>
                        {t(`mahnwesenPage.status${statusKey(m.status)}`)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        ))}

      {einstellungenOffen && (
        <EinstellungenDialog settings={settings} open onClose={() => setEinstellungenOffen(false)} />
      )}
      {detail && <VersandDialog reminder={detail} firma={firma} open onClose={() => setDetail(null)} />}
    </div>
  );
}

function Leer({ icon, titel, text }: { icon: string; titel: string; text: string }) {
  return (
    <Card className="flex flex-col items-center justify-center gap-3 p-12 text-center">
      <span className="flex size-14 items-center justify-center rounded-full bg-secondary">
        <Icon icon={icon} className="size-7 text-muted-foreground" />
      </span>
      <div>
        <p className="font-display text-lg font-extrabold">{titel}</p>
        <p className="text-sm text-muted-foreground">{text}</p>
      </div>
    </Card>
  );
}

/** Die Tabelle der überfälligen Rechnungen samt Knopf für die nächste Stufe. */
function UeberfaelligeTabelle({
  overdue,
  pendingId,
  datum,
  geld,
  onAnlegen,
}: {
  overdue: OverdueInvoice[];
  pendingId: string | null;
  datum: (iso: string) => string;
  geld: (betrag: string, waehrung: string) => string;
  onAnlegen: (r: OverdueInvoice) => void;
}) {
  const t = useTranslations("finance");
  if (overdue.length === 0) {
    return (
      <Leer
        icon="ph:check-circle"
        titel={t("mahnwesenPage.overdueEmptyTitle")}
        text={t("mahnwesenPage.overdueEmptySubtitle")}
      />
    );
  }
  return (
    <Card className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead className="border-b bg-secondary/40 text-left text-xs text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">{t("mahnwesenPage.colInvoice")}</th>
                <th className="px-4 py-3 font-medium">{t("mahnwesenPage.colCustomer")}</th>
                <th className="px-4 py-3 font-medium">{t("mahnwesenPage.colDue")}</th>
                <th className="px-4 py-3 text-right font-medium">{t("mahnwesenPage.colDaysOverdue")}</th>
                <th className="px-4 py-3 text-right font-medium">{t("mahnwesenPage.colOpen")}</th>
                <th className="px-4 py-3 font-medium">{t("mahnwesenPage.colLastLevel")}</th>
                <th className="px-4 py-3 text-right font-medium">{t("mahnwesenPage.colActions")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {overdue.map((r) => (
                <tr key={r.id} className="transition-colors hover:bg-secondary/30">
                  <td className="px-4 py-3 font-medium">{r.invoiceNumber ?? "—"}</td>
                  <td className="px-4 py-3 text-muted-foreground">{r.customerName ?? "—"}</td>
                  <td className="px-4 py-3 text-muted-foreground">{datum(r.dueDate)}</td>
                  <td className="px-4 py-3 text-right">{r.daysOverdue}</td>
                  <td className="px-4 py-3 text-right font-medium">{geld(r.amountOpen, r.currency)}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {r.lastLevel === 0
                      ? t("mahnwesenPage.noReminderYet")
                      : t("mahnwesenPage.levelLabel", { level: r.lastLevel })}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {r.nextLevel === null ? (
                      <span className="text-xs text-muted-foreground">{t("mahnwesenPage.maxLevelReached")}</span>
                    ) : (
                      <Button size="sm" onClick={() => onAnlegen(r)} disabled={pendingId !== null}>
                        {pendingId === r.id ? (
                          <Icon icon="ph:spinner" className="size-4 animate-spin" />
                        ) : (
                          <Icon icon="ph:plus" className="size-4" />
                        )}
                        {t("mahnwesenPage.createReminder", { level: r.nextLevel })}
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
    </Card>
  );
}
