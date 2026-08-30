"use client";

// Statement-Editor — Layout 1:1 nach Hostaway „Owner Statements → Create & Edit":
// Aktionsleiste (New/Save/Download/Select/More) · Filters-Button + Chip-Reihe ·
// flache, einklappbare Sektionen (Data / Summary / Rental activity / Expenses &
// extras / Attachments / Grand total). Daten echt aus dem Backend.
import { Icon } from "@iconify/react";
import { useTranslations, useLocale } from "next-intl";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@nextdays/ui/button";
import { StatementFinalizeDialog } from "@/components/owner-statements/statement-finalize-dialog";
import { StatementPreviewModal } from "@/components/owner-statements/statement-preview-modal";
import { DatePicker } from "@nextdays/ui/date-picker";
import { InfoHinweis } from "@nextdays/ui/info-hinweis";
import { Input } from "@nextdays/ui/input";
import { MultiSelect } from "@nextdays/ui/multi-select";
import { NativeSelect } from "@nextdays/ui/native-select";
import { Textarea } from "@nextdays/ui/textarea";
import { formatCurrency } from "@/lib/currency";

/** Backend-Grund (`payout_unbekannt`) → i18n-Key mit dem passenden Handgriff.
 *
 *  Explizite Karte und kein `t(\`…${grund}\`)`: ein neuer Backend-Grund würde
 *  sonst als `MISSING_MESSAGE` in der Oberfläche landen. Fehlt ein Grund hier,
 *  greift der allgemeine Satz — sichtbar unvollständig, aber nie kaputt.
 *
 *  Je Grund ein EIGENER Satz, weil jeder einen anderen Handgriff verlangt: ein
 *  fehlender Portal-Abzugssatz und eine nicht zugeordnete Gebührenart werden
 *  beide unter „Buchhaltung → Abrechnungsregeln" gepflegt, ein fehlender
 *  Provisionssatz aber beim Eigentümer. Bis 11.08.2026 prüfte die Oberfläche nur
 *  auf `provision` — die anderen Gründe blieben stumm und die Zelle zeigte „—"
 *  ohne jede Erklärung. */
const GRUND_KEYS: Record<string, string> = {
  provision: "summary.commissionMissing",
  provision_ungueltig: "summary.commissionInvalid",
  portal_abzug: "summary.portalRateMissing",
  portal_abzug_ungueltig: "summary.portalRateInvalid",
  gebuehr_nicht_zugeordnet: "summary.feeUnassigned",
  gebuehr_nicht_berechenbar: "summary.feeNotComputable",
  waehrung_vertrag: "summary.contractCurrency",
};

/** Backend-Grund (`gebuehren_grund`) → i18n-Key. Dieselbe explizite Karte wie
 *  `GRUND_KEYS` und aus demselben Grund: ein neuer Backend-Wert soll den Satz
 *  nicht zu `MISSING_MESSAGE` machen. */
const GEBUEHREN_GRUND_KEYS: Record<string, string> = {
  channex_import: "rental.feeSource.channexImport",
  portal_meldet_keine: "rental.feeSource.portalReportsNone",
  kein_payload: "rental.feeSource.noPayload",
};

/** Betrag ODER „—", wenn er maskiert ist.
 *
 *  `null` heisst hier NICHT „null Euro", sondern „dieser Nutzer darf die Zahl
 *  nicht sehen" (Daten-Split §4.2: der Eigentuemer bekommt weder den
 *  Gast-Bruttopreis noch den Ertrag der Verwaltung). Als 0,00 zu rendern waere
 *  eine glatte Falschaussage, deshalb der Gedankenstrich (Wurzel 4). */
function betragOderStrich(
  wert: number | null | undefined,
  waehrung: string,
  locale?: string,
): string {
  return wert == null ? "—" : formatCurrency(wert, waehrung, locale);
}
import { downloadStatementPdf } from "@/lib/statement-pdf";
import {
  addExpense,
  cancelStatement,
  deleteExpense,
  deleteStatement,
  expenseReceiptUrl,
  finalizeStatement,
  generateStatement,
  getStatement,
  updateExpense,
  updateStatement,
  uploadExpenseReceipt,
  type Expense,
  type ExpenseDirection,
  type RentalRow,
  type Statement,
  type StatementHeader,
  type StatementListItem,
} from "@/lib/owner-statements";

export type PropOption = { id: string; title: string };

const STATUS_OPTIONS = ["pending", "confirmed", "cancelled", "completed"];

/** Ausgangszustand der Filter — derselbe, mit dem die Seite eine neue
 *  Abrechnung öffnet (`owner-statements-for-owner.tsx`).
 *
 *  „Zurücksetzen" heisst hier bewusst NICHT „kein Filter": ein Zeitraum ist
 *  Pflicht (ohne ihn gäbe es keine Abrechnung), und „alle Reservierungs-Status"
 *  würde Stornos mitrechnen. Der ehrliche Ausgangszustand ist deshalb der
 *  laufende Monat mit den abrechenbaren Status — genau das, was der Nutzer beim
 *  Öffnen sieht. Ein leerer Zeitraum wäre ein erfundener Zustand, den die
 *  Abrechnung gar nicht kennt (Wurzel 4). */
const STANDARD_BASIS = "check_in" as const;
const STANDARD_STATUS = ["confirmed", "completed"] as const;

/** Mengenvergleich ohne Rücksicht auf die Reihenfolge — die Auswahl-Reihenfolge
 *  ist keine Information, „confirmed,completed" und „completed,confirmed" sind
 *  derselbe Filter. */
function gleicheMenge(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && [...a].sort().join() === [...b].sort().join();
}
const EXPENSE_CATEGORIES = ["Cleaning", "Utilities", "Maintenance", "TV", "Goods", "Other"];
const CHANNEL_DOT: Record<string, string> = {
  direct: "bg-emerald-500",
  portal: "bg-sky-500",
  booking: "bg-blue-600",
  airbnb: "bg-rose-500",
  vrbo: "bg-indigo-500",
};

export function StatementEditor({
  statement,
  properties,
  onChange,
  onListChange,
  onReprice,
}: {
  statement: Statement;
  properties: PropOption[];
  onChange: (s: Statement) => void;
  onListChange: (fn: (prev: StatementListItem[]) => StatementListItem[]) => void;
  // Vorschau-Modus (noch nicht gespeichert): bei Zeitraum-/Filter-Änderung wird
  // die Live-Auswertung neu berechnet statt ans Backend gepatcht.
  onReprice?: (opts: {
    period_from?: string;
    period_to?: string;
    basis?: Statement["basis"];
    reservation_statuses?: string[];
    commission_pct?: number;
  }) => void;
}) {
  const t = useTranslations("ownerStatements");
  const locale = useLocale();
  const [st, setSt] = useState<Statement>(statement);
  const [busy, setBusy] = useState(false);
  // Doppelbestätigung vor dem Festschreiben (unumkehrbar + für den
  // Eigentümer sichtbar).
  const [finalizeOffen, setFinalizeOffen] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  // Hat der Nutzer die Provision manuell überschrieben? Nur dann wird sie als
  // statement-weiter Override gesendet; sonst rechnet das Backend je Objekt aus
  // den Stammdaten (commission_pct = null).
  const [commissionTouched, setCommissionTouched] = useState(false);

  // Wenn der Parent ein neues Statement liefert (z. B. neu geladene Vorschau),
  // den lokalen Zustand übernehmen (und den manuellen Override-Marker lösen).
  useEffect(() => {
    setSt(statement);
    setCommissionTouched(false);
  }, [statement]);
  const finalized = st.status === "finalized" || st.status === "cancelled";
  const isCancellation = st.kind === "cancellation";
  const isCancelled = st.status === "cancelled";
  const cur = st.summary.currency;
  // Owner-Auszahlung steht in der Owner-Zielwährung (aus dem Herkunftsland).
  const ownerCur = st.summary.owner_currency || cur;

  function patchHeader<K extends keyof StatementHeader>(key: K, value: StatementHeader[K]) {
    setSt((s) => ({ ...s, header: { ...s.header, [key]: value } }));
  }

  // Noch nicht gespeicherter Entwurf (kein DB-Datensatz): erkennbar an leerer id.
  const isNew = !st.id;

  async function persist(patch: Parameters<typeof updateStatement>[1]) {
    // Vorschau-Modus (noch nicht gespeichert): nicht patchen, sondern die Live-
    // Auswertung mit den neuen Zeitraum-/Filter-Werten neu berechnen.
    if (isNew) {
      onReprice?.({
        period_from: patch.period_from,
        period_to: patch.period_to,
        basis: patch.basis,
        reservation_statuses: patch.reservation_statuses,
        // Override nur durchreichen, wenn der Nutzer ihn manuell gesetzt hat.
        commission_pct:
          patch.commission_pct ??
          (commissionTouched ? st.commission_pct ?? undefined : undefined),
      });
      return;
    }
    const res = await updateStatement(st.id, patch);
    if (res.ok) {
      setSt(res.data);
      onChange(res.data);
    } else toast.error(res.error);
  }

  async function refresh() {
    if (isNew) return;
    const res = await getStatement(st.id);
    if (res.ok) {
      setSt(res.data);
      onChange(res.data);
    }
  }

  async function save() {
    setBusy(true);
    // Neuer Entwurf → Abrechnung erst jetzt im Backend erzeugen.
    const res = isNew
      ? await generateStatement({
          owner_id: st.owner_id,
          period_from: st.period_from,
          period_to: st.period_to,
          basis: st.basis,
          reservation_statuses: st.reservation_statuses,
          // Kein manueller Override → null, Backend rechnet je Objekt.
          commission_pct: commissionTouched ? st.commission_pct : null,
        })
      : await updateStatement(st.id, {
          header: st.header,
          commission_pct: st.commission_pct,
          basis: st.basis,
          reservation_statuses: st.reservation_statuses,
          period_from: st.period_from,
          period_to: st.period_to,
        });
    setBusy(false);
    if (res.ok) {
      setSt(res.data);
      onChange(res.data);
      // Neu angelegte Abrechnung in die Liste aufnehmen.
      if (isNew) {
        const d = res.data;
        onListChange((prev) => [
          {
            id: d.id,
            owner_id: d.owner_id,
            owner_name: d.header.owner_name,
            period_from: d.period_from,
            period_to: d.period_to,
            status: d.status,
            owner_payout: d.summary.owner_payout,
            pm_payout: d.summary.pm_payout,
            currency: d.summary.currency,
            invoice_number: d.header.invoice_number,
            created_at: d.created_at,
          },
          ...prev,
        ]);
      }
      toast.success(t("saved"));
    } else toast.error(res.error);
  }

  async function finalize(betrag: number, waehrung: string) {
    setBusy(true);
    // Der bestätigte Betrag geht mit — der Server lehnt ab (409), falls sich
    // die Abrechnung seit dem Anzeigen geändert hat. Dann steht in res.error
    // der neue Stand, und der Nutzer bestätigt bewusst erneut.
    const res = await finalizeStatement(st.id, {
      bestaetigte_auszahlung: betrag,
      bestaetigte_waehrung: waehrung,
    });
    setBusy(false);
    if (res.ok) {
      setFinalizeOffen(false);
      setSt(res.data);
      onChange(res.data);
      toast.success(t("finalized"));
    } else {
      // Dialog bleibt OFFEN: bei einer Abweichung soll der Nutzer die Meldung
      // im Zusammenhang sehen, nicht auf einer Seite ohne Kontext.
      toast.error(res.error);
    }
  }

  async function remove() {
    if (!window.confirm(t("deleteConfirm"))) return;
    const res = await deleteStatement(st.id);
    if (res.ok) {
      onListChange((prev) => prev.filter((i) => i.id !== st.id));
      toast.success(t("deleted"));
      window.location.reload();
    } else toast.error(res.error);
  }

  async function cancel() {
    if (!window.confirm(t("cancelConfirm"))) return;
    setBusy(true);
    const res = await cancelStatement(st.id);
    setBusy(false);
    if (res.ok) {
      // Antwort ist die NEUE Stornorechnung; sie wird angezeigt.
      setSt(res.data);
      onChange(res.data);
      toast.success(t("cancelled"));
    } else toast.error(res.error);
  }

  // Ausgangs-Zeitraum: laufender Monat — dieselbe Rechnung wie beim Öffnen der
  // Seite. Bewusst aus dem heutigen Datum abgeleitet und nicht aus dem
  // Statement: „zurücksetzen" soll dorthin führen, wo man ohne Zutun landet.
  const heute = new Date();
  const monatsAnfang = new Date(heute.getFullYear(), heute.getMonth(), 1)
    .toISOString()
    .slice(0, 10);
  const monatsEnde = new Date(heute.getFullYear(), heute.getMonth() + 1, 0)
    .toISOString()
    .slice(0, 10);

  // Wie viele Filter weichen vom Ausgangszustand ab? Das ist die Zahl, die der
  // Knopf trägt — und die nach dem Zurücksetzen 0 sein MUSS.
  const aktiveFilter =
    (st.period_from !== monatsAnfang ? 1 : 0) +
    (st.period_to !== monatsEnde ? 1 : 0) +
    (st.basis !== STANDARD_BASIS ? 1 : 0) +
    (gleicheMenge(st.reservation_statuses, STANDARD_STATUS) ? 0 : 1);

  /** Einen einzelnen Filter auf seinen Ausgangswert bringen. Der lokale Zustand
   *  wird sofort gesetzt (die Chips sollen ohne Verzögerung stimmen), das
   *  Neuberechnen übernimmt `persist` wie bei jeder anderen Filteränderung. */
  async function filterZuruecksetzen(patch: {
    period_from?: string;
    period_to?: string;
    basis?: Statement["basis"];
    reservation_statuses?: string[];
  }) {
    setSt((s) => ({ ...s, ...patch }));
    await persist(patch);
  }

  async function alleFilterZuruecksetzen() {
    await filterZuruecksetzen({
      period_from: monatsAnfang,
      period_to: monatsEnde,
      basis: STANDARD_BASIS,
      reservation_statuses: [...STANDARD_STATUS],
    });
  }

  const expensesTotal = st.summary.expenses_total;
  // Ohne sichtbaren Gastpreis gibt es keine Gesamtsumme — sie waere sonst
  // „0 + Ausgaben" und damit erfunden.
  const grandTotal =
    st.summary.total_price == null ? null : st.summary.total_price + expensesTotal;

  return (
    <div className="flex flex-col gap-5">
      {/* Aktionsleiste: Titel links, Hostaway-Buttons rechts */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-extrabold">{t("title")}</h1>
        <div className="flex flex-wrap items-center gap-2">
          {!finalized && (
            <Button onClick={() => void save()} disabled={busy}>
              {busy ? t("saving") : t("save")}
            </Button>
          )}
          <Button variant="outline" onClick={() => setShowPreview(true)}>
            <Icon icon="ph:eye" className="size-4" />
            {t("preview")}
          </Button>
          <Button
            variant="outline"
            disabled={busy}
            onClick={() => {
              setBusy(true);
              void downloadStatementPdf(st, locale)
                .catch(() => toast.error(t("downloadFailed")))
                .finally(() => setBusy(false));
            }}
          >
            <Icon icon="ph:download-simple" className="size-4" />
            {t("download")}
          </Button>
          {!finalized && !isNew && (
            <span className="flex items-center gap-1.5">
              <Button variant="outline" onClick={() => setFinalizeOffen(true)}>
                {t("finalize")}
              </Button>
              {/* Finalisieren vergibt die Rechnungsnummer und friert die
                  Summen ein — rückgängig geht danach nur noch über eine
                  Stornorechnung. Das MUSS vor dem Klick dastehen. */}
              <InfoHinweis
                titel={t("info.finalize.title")}
                text={[t("info.finalize.what"), t("info.finalize.irreversible")]}
                ariaLabel={t("info.aria", { feld: t("finalize") })}
              />
            </span>
          )}
          {/* Storno: nur bei finalisierter, normaler, noch nicht stornierter
              Rechnung. Eine Stornorechnung selbst lässt sich nicht stornieren. */}
          {st.status === "finalized" && !isCancellation && !isCancelled && (
            <Button variant="outline" onClick={() => void cancel()} disabled={busy}>
              <Icon icon="ph:arrow-u-up-left" className="size-4" />
              {t("storno")}
            </Button>
          )}
          {!finalized && (
            <Button variant="ghost" size="icon" onClick={() => void remove()} aria-label={t("delete")}>
              <Icon icon="ph:dots-three-vertical" className="size-5" />
            </Button>
          )}
        </div>
      </div>

      {/* Status-/Storno-Banner */}
      {isCancellation && (
        <div className="rounded-(--radius) border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-200">
          {st.header.notes ?? t("stornoBanner")}
        </div>
      )}
      {isCancelled && (
        <div className="rounded-(--radius) border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {t("cancelledBanner")}
        </div>
      )}

      {/* Filters-Button + Chip-Reihe */}
      <div className="flex flex-col gap-2">
        <button
          type="button"
          onClick={() => setShowFilters((v) => !v)}
          className="flex w-fit items-center gap-2 rounded-full border border-border px-3 py-1.5 text-sm font-medium"
        >
          <Icon icon="ph:funnel" className="size-4" />
          {t("filters.title")}
          {/* Gezählt wird, WIE VIELE Filter vom Ausgangszustand abweichen —
              nicht wie viele Filterfelder es gibt. Vorher stand hier fest
              `2 + … + 1`: die Zahl war praktisch immer 4, egal was eingestellt
              war, und sagte damit nichts (Wurzel 4). Der Status-Filter zählt
              als EIN Filter, auch wenn er zwei Werte trägt. */}
          {aktiveFilter > 0 && (
            <span className="flex size-5 items-center justify-center rounded-full bg-accent text-xs text-accent-foreground">
              {aktiveFilter}
            </span>
          )}
        </button>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          {/* Die Chips zeigen die aktiven Filter UND entfernen sie. Vorher
              waren sie reine Anzeige ohne Klickziel — man sah, dass gefiltert
              wird, hatte aber keinen Weg zurück (Wurzel 5). Nur abweichende
              Werte bekommen ein „x": den Zeitraum kann man nicht „leeren", er
              geht auf den laufenden Monat zurück. */}
          <ChipEntfernbar
            label={`${t("filters.from")}: ${st.period_from}`}
            onRemove={
              st.period_from !== monatsAnfang
                ? () => void filterZuruecksetzen({ period_from: monatsAnfang })
                : undefined
            }
            entfernenLabel={t("filters.remove", { feld: t("filters.from") })}
            disabled={finalized}
          />
          <ChipEntfernbar
            label={`${t("filters.to")}: ${st.period_to}`}
            onRemove={
              st.period_to !== monatsEnde
                ? () => void filterZuruecksetzen({ period_to: monatsEnde })
                : undefined
            }
            entfernenLabel={t("filters.remove", { feld: t("filters.to") })}
            disabled={finalized}
          />
          <ChipEntfernbar
            label={st.basis === "check_in" ? t("filters.checkIn") : t("filters.checkOut")}
            onRemove={
              st.basis !== STANDARD_BASIS
                ? () => void filterZuruecksetzen({ basis: STANDARD_BASIS })
                : undefined
            }
            entfernenLabel={t("filters.remove", { feld: t("filters.basis") })}
            disabled={finalized}
          />
          <ChipEntfernbar
            label={t("filters.statusCount", { count: st.reservation_statuses.length })}
            onRemove={
              !gleicheMenge(st.reservation_statuses, STANDARD_STATUS)
                ? () =>
                    void filterZuruecksetzen({
                      reservation_statuses: [...STANDARD_STATUS],
                    })
                : undefined
            }
            entfernenLabel={t("filters.remove", { feld: t("filters.statuses") })}
            disabled={finalized}
          />
          {aktiveFilter > 0 && !finalized && (
            <button
              type="button"
              onClick={() => void alleFilterZuruecksetzen()}
              className="rounded-full px-2.5 py-1 font-medium text-accent underline-offset-4 hover:underline"
            >
              {t("filters.resetAll")}
            </button>
          )}
          {finalized && (
            <span className="rounded-full bg-foreground px-2.5 py-1 font-medium text-background">
              {t("status.finalized")}
            </span>
          )}
        </div>
      </div>

      {showFilters && !finalized && (
        <div className="grid grid-cols-1 gap-4 rounded-(--radius) border border-border p-4 sm:grid-cols-4">
          <Labeled label={t("filters.from")}>
            <DatePicker
              value={st.period_from}
              onChange={(v) => setSt((s) => ({ ...s, period_from: v }))}
              onCommit={(v) => void persist({ period_from: v })}
            />
          </Labeled>
          <Labeled label={t("filters.to")}>
            <DatePicker
              value={st.period_to}
              onChange={(v) => setSt((s) => ({ ...s, period_to: v }))}
              onCommit={(v) => void persist({ period_to: v })}
            />
          </Labeled>
          <Labeled
            label={t("filters.basis")}
            info={t("info.basis")}
            infoAria={t("info.aria", { feld: t("filters.basis") })}
          >
            <NativeSelect
              value={st.basis}
              onChange={(e) => {
                const basis = e.target.value as Statement["basis"];
                setSt((s) => ({ ...s, basis }));
                void persist({ basis });
              }}
            >
              <option value="check_in">{t("filters.checkIn")}</option>
              <option value="check_out">{t("filters.checkOut")}</option>
            </NativeSelect>
          </Labeled>
          {/* Mehrfach-Auswahlfeld statt vier loser Schaltflächen: die brachen
              in eine zweite Zeile um und liessen die Spalte höher werden als
              ihre Nachbarn. Die MEHRFACHauswahl bleibt erhalten (mehrere Status
              gleichzeitig) — ein einfaches Auswahlfeld wäre ein
              Funktionsverlust. `MultiSelect` ist dieselbe Komponente wie in den
              übrigen Filtern des Projekts, inkl. Tastatur- und
              Touch-Bedienung. */}
          <Labeled
            label={t("filters.statuses")}
            info={t("info.statuses")}
            infoAria={t("info.aria", { feld: t("filters.statuses") })}
          >
            <MultiSelect
              options={STATUS_OPTIONS.map((s) => ({
                value: s,
                label: t(`reservationStatus.${s}`),
              }))}
              selected={st.reservation_statuses}
              onChange={(next) => {
                setSt((prev) => ({ ...prev, reservation_statuses: next }));
                void persist({ reservation_statuses: next });
              }}
              placeholder={t("filters.statusesNone")}
              searchPlaceholder={t("filters.statusesSearch")}
              emptyHint={t("filters.statusesNoMatch")}
              selectAllLabel={t("filters.statusesSelectAll")}
              countLabel={(n, m) => t("filters.statusesCount", { count: n, total: m })}
            />
          </Labeled>
        </div>
      )}

      {/* Data */}
      <Section title={t("sections.data")} defaultOpen>
        <div className="grid grid-cols-1 gap-x-10 gap-y-3 lg:grid-cols-2">
          <HeaderField label={t("pm.name")} value={st.header.pm_name} onChange={(v) => patchHeader("pm_name", v)} disabled emptyHint={t("pm.fromMaster")} />
          <HeaderField label={t("owner.name")} value={st.header.owner_name} onChange={(v) => patchHeader("owner_name", v)} disabled emptyHint={t("owner.fromMaster")} />
          <HeaderField label={t("pm.email")} value={st.header.pm_email} onChange={(v) => patchHeader("pm_email", v)} disabled emptyHint={t("pm.fromMaster")} />
          <HeaderField label={t("owner.email")} value={st.header.owner_email} onChange={(v) => patchHeader("owner_email", v)} disabled emptyHint={t("owner.fromMaster")} />
          <HeaderField label={t("pm.phone")} value={st.header.pm_phone} onChange={(v) => patchHeader("pm_phone", v)} disabled emptyHint={t("pm.fromMaster")} />
          <HeaderField label={t("owner.phone")} value={st.header.owner_phone} onChange={(v) => patchHeader("owner_phone", v)} disabled emptyHint={t("owner.fromMaster")} />
          <HeaderField label={t("pm.address")} value={st.header.pm_address} onChange={(v) => patchHeader("pm_address", v)} disabled emptyHint={t("pm.fromMaster")} />
          <HeaderField label={t("owner.address")} value={st.header.owner_address} onChange={(v) => patchHeader("owner_address", v)} disabled emptyHint={t("owner.fromMaster")} />
          <HeaderField label={t("pm.taxId")} value={st.header.pm_tax_id} onChange={(v) => patchHeader("pm_tax_id", v)} disabled emptyHint={t("pm.fromMaster")} />
          <HeaderField label={t("owner.taxId")} value={st.header.owner_tax_id} onChange={(v) => patchHeader("owner_tax_id", v)} disabled emptyHint={t("owner.fromMaster")} />
          <HeaderField label={t("invoiceNumber")} value={st.header.invoice_number} onChange={(v) => patchHeader("invoice_number", v)} disabled={finalized} />
        </div>
        <Labeled label={t("notes")} className="mt-3">
          <Textarea value={st.header.notes ?? ""} disabled={finalized} onChange={(e) => patchHeader("notes", e.target.value || null)} />
        </Labeled>
      </Section>

      {/* Summary */}
      <Section
        title={t("sections.summary")}
        defaultOpen
        right={
          !finalized ? (
            <button type="button" onClick={() => setShowFilters(true)} className="flex items-center gap-1 text-sm text-accent">
              <Icon icon="ph:pencil-simple" className="size-4" />
              {t("edit")}
            </button>
          ) : undefined
        }
      >
        <p className="mb-3 text-sm text-muted-foreground">
          {t("summaryPeriod", { from: st.period_from, to: st.period_to, count: st.summary.booking_count })}
        </p>
        {/* Ein „—" allein sagt nur, DASS etwas fehlt. Diese Zeile sagt, WAS zu
            tun ist (Wurzel 5) — sonst sucht der Betreiber die Ursache einer
            leeren Auszahlung in den Buchungen statt in den Stammdaten.
            Je GRUND ein eigener Satz: ein fehlender Portal-Abzugssatz verlangt
            einen anderen Handgriff als ein fehlender Provisionssatz, und beides
            „Provision fehlt" zu nennen schickte den Betrieb an die falsche
            Maske. Bis 11.08.2026 wurde nur `provision` erkannt — die neuen
            Gründe blieben stumm, und die Zelle zeigte „—" ohne Erklärung. */}
        {st.summary.payout_unbekannt && (
          <p
            role="alert"
            className="mb-3 rounded-(--radius) border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive"
          >
            {t(GRUND_KEYS[st.summary.payout_unbekannt] ?? "summary.payoutUnknown")}
          </p>
        )}
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          <SummaryCell
            icon="ph:money"
            label={t("summary.totalPrice")}
            value={betragOderStrich(st.summary.total_price, cur)}
            info={t("info.totalPrice")}
            infoAria={t("info.aria", { feld: t("summary.totalPrice") })}
          />
          <SummaryCell
            icon="ph:diamond"
            label={t("summary.totalPayout")}
            value={formatCurrency(st.summary.total_payout, cur)}
            info={t("info.totalPayout")}
            infoAria={t("info.aria", { feld: t("summary.totalPayout") })}
          />
          <SummaryCell
            icon="ph:coins"
            label={t("summary.ownerPayout")}
            value={betragOderStrich(st.summary.owner_payout, ownerCur)}
            info={t("info.ownerPayout")}
            infoAria={t("info.aria", { feld: t("summary.ownerPayout") })}
          />
          <SummaryCell
            icon="ph:buildings"
            label={t("summary.pmPayout")}
            value={betragOderStrich(st.summary.pm_payout, cur)}
            info={t("info.pmPayout")}
            infoAria={t("info.aria", { feld: t("summary.pmPayout") })}
          />
        </div>
        {/* Steht irgendwo ein „—", MUSS erklärt sein, dass das „nicht erfasst"
            heißt und nicht „null". Der Unterschied entscheidet, ob der
            Betreiber einen Datenfehler sucht oder eine 0 für bare Münze
            nimmt (Wurzel 4). */}
        {(st.summary.total_price == null ||
          st.summary.owner_payout == null ||
          st.summary.pm_payout == null) && (
          <p className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
            <InfoHinweis
              titel={t("info.dash.title")}
              text={[t("info.dash.meaning"), t("info.dash.whereToFix")]}
              ariaLabel={t("info.dash.aria")}
            />
            {t("info.dash.inline")}
          </p>
        )}
      </Section>

      {/* Rental activity */}
      <RentalActivity statement={st} t={t} currency={cur} />

      {/* Expenses & extras */}
      {/* Verrechnungsposten hängen an einer gespeicherten Abrechnung
          (`statement_id`) — im Vorschau-Modus gibt es die noch nicht. Früher
          wurde der Bereich deshalb einfach im gesperrten Zustand gezeigt: keine
          Knöpfe, kein Hinweis. Der Nutzer sah eine leere Tabelle „Noch keine
          Ausgaben" und KEINEN Weg, welche anzulegen — der Bereich sah kaputt
          aus, nicht ungespeichert (Wurzel 5: kein stiller Fehlschlag). Jetzt
          sagt der Bereich, WARUM er noch nicht bedienbar ist und WAS zu tun
          ist, und der Hinweis führt direkt zum Speichern. */}
      <ExpensesSection
        statement={st}
        properties={properties}
        finalized={finalized || isNew}
        gesperrtWeilUngespeichert={isNew && !finalized}
        onSave={() => void save()}
        busy={busy}
        currency={cur}
        onRefresh={refresh}
        t={t}
      />

      {/* Attachments — bewusst KEINE Ablagefläche.
          Hier stand eine gestrichelte „Dateien zum Hochladen ablegen oder
          durchsuchen"-Fläche OHNE Datei-Feld und ohne Handler: Klicken tat
          nichts, Ziehen tat nichts. Eine Oberfläche, die eine Funktion
          verspricht, die es nicht gibt, ist schlimmer als keine — der Nutzer
          hält sein Ablegen für gescheitert und sucht den Fehler bei sich
          (Wurzel 5). Belege hängen an der EINZELNEN Zeile in „Ausgaben &
          Extras" (Spalte Beleg) — dorthin verweist dieser Text. */}
      <Section title={t("sections.attachments")} defaultOpen>
        <p className="text-sm text-muted-foreground">
          {t("attachments.viaExpenses")}
        </p>
      </Section>

      {/* Grand total */}
      <Section title={t("sections.grandTotal")} defaultOpen>
        <div className="flex flex-col gap-3">
          {/* Beschriftung, KEIN Auswahlfeld.
              Hier stand ein dauerhaft `disabled` Auswahlfeld mit genau EINER
              Option („Mieteinnahmen"). Es sah nach einer Wahl aus, bot keine
              und bewirkte nichts — dieselbe Attrappe wie die frühere
              Anhänge-Ablagefläche. Geprüft: weder `Statement` noch das
              Pydantic-Schema kennen ein Feld für eine Bemessungsgrundlage oder
              eine zweite Einnahmeart; hinter dem Feld steckt also keine
              unfertige Funktion, sondern nur Zierrat. Die Zeile ist jetzt
              aufgebaut wie die „Ausgaben & Extras"-Zeile darunter. */}
          <div className="flex items-center gap-4">
            <span className="min-w-44 text-sm text-muted-foreground">
              {t("grand.rentalRevenue")}
            </span>
            <span className="text-sm">{betragOderStrich(st.summary.total_price, cur)}</span>
          </div>
          <div className="flex items-center gap-4">
            <span className="min-w-44 text-sm text-muted-foreground">{t("grand.expenses")}</span>
            <span className={`text-sm ${expensesTotal < 0 ? "text-destructive" : ""}`}>
              {formatCurrency(expensesTotal, cur)}
            </span>
          </div>
          <div className="h-px bg-border" />
          <div className="flex items-center justify-between">
            <span className="font-bold">{t("grand.total")}</span>
            <span className="font-display text-xl font-extrabold">{betragOderStrich(grandTotal, cur)}</span>
          </div>

          {/* Steueraufschlüsselung (EN 16931) — erst nach Finalisierung gesetzt. */}
          {finalized && (
            <div className="mt-2 flex flex-col gap-2 rounded-(--radius) border border-border p-4">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{t("tax.net")}</span>
                <span>{formatCurrency(st.tax.net, cur)}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">
                  {t("tax.vat")} ({st.tax.rate}% · {t(`tax.category.${st.tax.category}`)})
                </span>
                <span>{formatCurrency(st.tax.tax, cur)}</span>
              </div>
              <div className="flex items-center justify-between font-bold">
                <span>{t("tax.gross")}</span>
                <span>{formatCurrency(st.tax.gross, cur)}</span>
              </div>
              {st.tax.exemption_reason && (
                <p className="text-xs text-muted-foreground">{st.tax.exemption_reason}</p>
              )}
            </div>
          )}
          {!finalized && (
            <div className="mt-2 flex flex-wrap items-end gap-3">
              {/* `w-44`, weil neben dem Label noch das Info-Symbol steht und
                  die längste Übersetzung („Komisjonitasu (%)") sonst umbricht —
                  dann stünde das Eingabefeld tiefer als die beiden Kennzahlen
                  daneben. */}
              <Labeled
                label={t("grand.deductPercentage")}
                className="w-44"
                info={t("info.deductPercentage")}
                infoAria={t("info.aria", { feld: t("grand.deductPercentage") })}
              >
                <Input
                  type="number"
                  min={0}
                  max={100}
                  step={0.5}
                  // Kein Satz vereinbart -> leeres Feld. Eine 0 haette
                  // behauptet, 0 % seien vereinbart (Wurzel 4).
                  value={st.commission_pct ?? ""}
                  onChange={(e) => {
                    setCommissionTouched(true);
                    const roh = e.target.value.trim();
                    setSt((s) => ({
                      ...s,
                      commission_pct: roh === "" ? null : Number(roh),
                    }));
                  }}
                  onBlur={() => void persist({ commission_pct: st.commission_pct })}
                />
              </Labeled>
              <Stat label={t("summary.ownerPayout")} value={betragOderStrich(st.summary.owner_payout, ownerCur)} />
              <Stat label={t("summary.pmPayout")} value={betragOderStrich(st.summary.pm_payout, cur)} />
            </div>
          )}
        </div>
      </Section>

      <StatementPreviewModal
        statement={st}
        open={showPreview}
        onOpenChange={setShowPreview}
      />
      {/* Ohne Auszahlung gibt es nichts zu bestätigen — der Knopf ist in dem
          Fall ohnehin gesperrt (siehe `disabled` oben). */}
      {st.summary.owner_payout != null && (
        <StatementFinalizeDialog
          open={finalizeOffen}
          onOpenChange={setFinalizeOffen}
          betrag={st.summary.owner_payout}
          waehrung={ownerCur}
          ownerName={st.header.owner_name ?? null}
          busy={busy}
          onBestaetigt={(betrag, waehrung) => void finalize(betrag, waehrung)}
        />
      )}
    </div>
  );
}

// --- Rental activity ---------------------------------------------------------

function RentalActivity({
  statement,
  t,
  currency,
}: {
  statement: Statement;
  t: ReturnType<typeof useTranslations>;
  currency: string;
}) {
  const [view, setView] = useState<"reservation" | "listing">("reservation");
  const totalNights =
    view === "reservation"
      ? statement.rental_rows.reduce((a, r) => a + r.nights, 0)
      : statement.listing_rows.reduce((a, r) => a + r.nights, 0);

  return (
    <Section
      title={t("sections.rentalActivity")}
      defaultOpen
      right={
        <div className="flex rounded-md bg-secondary p-0.5 text-sm">
          <button
            type="button"
            onClick={() => setView("reservation")}
            className={`rounded px-3 py-1 font-medium transition-colors ${view === "reservation" ? "bg-foreground text-background" : "text-muted-foreground"}`}
          >
            {t("rental.perReservation")}
          </button>
          <button
            type="button"
            onClick={() => setView("listing")}
            className={`rounded px-3 py-1 font-medium transition-colors ${view === "listing" ? "bg-foreground text-background" : "text-muted-foreground"}`}
          >
            {t("rental.perListing")}
          </button>
        </div>
      }
    >
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs uppercase text-muted-foreground">
              {view === "reservation" ? (
                <>
                  <th className="py-2 pr-4 font-medium">{t("rental.guest")}</th>
                  <th className="py-2 pr-4 font-medium">{t("rental.nights")}</th>
                  <th className="py-2 pr-4 font-medium">{t("rental.listing")}</th>
                  <th className="py-2 pr-4 font-medium">{t("rental.channel")}</th>
                  <th className="py-2 pr-4 text-right font-medium">
                    <span className="flex items-center justify-end gap-1.5">
                      {t("rental.totalPrice")}
                      <InfoHinweis
                        text={t("info.totalPrice")}
                        ariaLabel={t("info.aria", { feld: t("rental.totalPrice") })}
                      />
                    </span>
                  </th>
                  <th className="py-2 text-right font-medium">
                    <span className="flex items-center justify-end gap-1.5">
                      {t("rental.totalPayout")}
                      <InfoHinweis
                        text={t("info.totalPayout")}
                        ariaLabel={t("info.aria", { feld: t("rental.totalPayout") })}
                      />
                    </span>
                  </th>
                </>
              ) : (
                <>
                  <th className="py-2 pr-4 font-medium">{t("rental.listing")}</th>
                  <th className="py-2 pr-4 font-medium">{t("rental.reservations")}</th>
                  <th className="py-2 pr-4 font-medium">{t("rental.nights")}</th>
                  <th className="py-2 pr-4 text-right font-medium">{t("rental.totalPrice")}</th>
                  <th className="py-2 text-right font-medium">{t("rental.totalPayout")}</th>
                </>
              )}
            </tr>
          </thead>
          <tbody>
            {view === "reservation"
              ? statement.rental_rows.map((r) => (
                  <tr key={r.reservation_id} className="border-b border-border">
                    <td className="py-2 pr-4 text-accent">{r.guest ?? "—"}</td>
                    <td className="py-2 pr-4">{r.nights}</td>
                    <td className="py-2 pr-4 text-accent">{r.listing ?? "—"}</td>
                    <td className="py-2 pr-4">
                      <span className="flex items-center gap-1.5 capitalize">
                        <span className={`size-2 rounded-full ${CHANNEL_DOT[r.channel] ?? "bg-muted-foreground"}`} />
                        {r.channel}
                      </span>
                    </td>
                    <td className="py-2 pr-4 text-right">
                      <span className="inline-flex items-center justify-end gap-1.5">
                        {betragOderStrich(r.total_price, currency)}
                        <GebuehrenHerkunft zeile={r} />
                      </span>
                    </td>
                    <td className="py-2 text-right">
                      {formatCurrency(r.total_payout, currency)}
                      <AuszahlungsKette zeile={r} waehrung={currency} />
                    </td>
                  </tr>
                ))
              : statement.listing_rows.map((r) => (
                  <tr key={r.listing_id} className="border-b border-border">
                    <td className="py-2 pr-4 text-accent">{r.listing ?? "—"}</td>
                    <td className="py-2 pr-4">{r.reservations}</td>
                    <td className="py-2 pr-4">{r.nights}</td>
                    <td className="py-2 pr-4 text-right">{betragOderStrich(r.total_price, currency)}</td>
                    <td className="py-2 text-right">{formatCurrency(r.total_payout, currency)}</td>
                  </tr>
                ))}
            <tr className="font-bold">
              <td className="py-2 pr-4">{t("rental.totals")}</td>
              <td className="py-2 pr-4">{totalNights}</td>
              <td className="py-2 pr-4" />
              {view === "reservation" && <td className="py-2 pr-4" />}
              <td className="py-2 pr-4 text-right">{betragOderStrich(statement.summary.total_price, currency)}</td>
              <td className="py-2 text-right">{formatCurrency(statement.summary.total_payout, currency)}</td>
            </tr>
          </tbody>
        </table>
        {statement.rental_rows.length === 0 && (
          <p className="py-4 text-sm text-muted-foreground">{t("rental.empty")}</p>
        )}
      </div>
    </Section>
  );
}

// --- Expenses & extras -------------------------------------------------------

function ExpensesSection({
  statement,
  properties,
  finalized,
  gesperrtWeilUngespeichert,
  onSave,
  busy,
  currency,
  onRefresh,
  t,
}: {
  statement: Statement;
  properties: PropOption[];
  finalized: boolean;
  /** Nur der Vorschau-Fall: noch nicht gespeichert (≠ finalisiert). */
  gesperrtWeilUngespeichert: boolean;
  onSave: () => void;
  busy: boolean;
  currency: string;
  onRefresh: () => Promise<void>;
  t: ReturnType<typeof useTranslations>;
}) {
  const titleById = new Map(properties.map((p) => [p.id, p.title]));
  const guestByRes = new Map(statement.rental_rows.map((r) => [r.reservation_id, r.guest]));
  const [adding, setAdding] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function add(form: AddExpenseValues) {
    const res = await addExpense({
      statement_id: statement.id,
      concept: form.concept,
      date: form.date,
      direction: form.direction,
      category: form.category || null,
      listing_id: form.listing_id || null,
      reservation_id: form.reservation_id || null,
      owner_id: form.assign_owner ? statement.owner_id : null,
      amount: form.amount,
    });
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    // Beleg im zweiten Schritt: er hängt an der ID, die es erst nach dem
    // Anlegen gibt. Schlägt nur der Upload fehl, bleibt der Posten bestehen —
    // der Nutzer bekommt das gesagt und kann den Beleg nachreichen.
    if (form.receipt) {
      const up = await uploadExpenseReceipt(res.data.id, form.receipt);
      if (!up.ok) toast.error(up.error);
    }
    setAdding(false);
    await onRefresh();
    toast.success(t("expenses.added"));
  }

  async function toggleHidden(e: Expense) {
    const res = await updateExpense(e.id, { hidden_from_owner: !e.hidden_from_owner });
    if (res.ok) await onRefresh();
    else toast.error(res.error);
  }

  async function remove(e: Expense) {
    const res = await deleteExpense(e.id);
    if (res.ok) await onRefresh();
    else toast.error(res.error);
  }

  /** Beleg öffnen: die URL ist signiert und läuft ab, darum wird sie bei jedem
   *  Klick frisch geholt statt im Zustand gehalten. */
  async function openReceipt(e: Expense) {
    setBusyId(e.id);
    const res = await expenseReceiptUrl(e.id);
    setBusyId(null);
    if (res.ok) window.open(res.data.url, "_blank", "noopener,noreferrer");
    else toast.error(res.error);
  }

  async function hideAll() {
    await Promise.all(
      statement.expenses
        // Ein Posten ZULASTEN muss sichtbar bleiben (Backend lehnt ihn mit 422
        // ab). Ihn hier erst gar nicht mitzuschicken erspart dem Nutzer eine
        // Fehlermeldung für etwas, das er nicht gemeint hat.
        .filter((e) => !e.hidden_from_owner && e.direction !== "from_owner")
        .map((e) => updateExpense(e.id, { hidden_from_owner: true })),
    );
    await onRefresh();
  }

  const versteckbar = statement.expenses.some(
    (e) => !e.hidden_from_owner && e.direction !== "from_owner",
  );

  // Die beiden Richtungssummen werden aus den ANGEZEIGTEN Posten abgeleitet,
  // nicht aus `summary.expenses_to_owner/_from_owner` gelesen. Grund: auf dem
  // Snapshot-Pfad (finalisiert/storniert) baut das Backend die Summary aus der
  // gespeicherten Zeile neu auf und setzt nur `expenses_total` — die beiden
  // Richtungsfelder fallen dort auf ihren Schema-Default 0.0 zurück. Aus einer
  // gelieferten 0 lässt sich „es gab keine" und „das Feld wurde nicht gefüllt"
  // nicht unterscheiden; genau daran verschwänden bei einer finalisierten
  // Abrechnung beide Zeilen, obwohl Posten da sind (Wurzel 4).
  // Aus den Zeilen gerechnet stimmt es auf BEIDEN Pfaden und passt immer zu
  // dem, was direkt darüber in der Tabelle steht.
  const summeZugunsten = statement.expenses
    .filter((e) => e.direction !== "from_owner")
    .reduce((s, e) => s + Math.abs(e.amount), 0);
  const summeZulasten = statement.expenses
    .filter((e) => e.direction === "from_owner")
    .reduce((s, e) => s + Math.abs(e.amount), 0);

  return (
    <Section
      title={t("sections.expenses")}
      defaultOpen
      info={
        <InfoHinweis
          titel={t("info.expenses.title")}
          text={[
            t("info.expenses.direction"),
            t("info.expenses.noCommission"),
          ]}
          ariaLabel={t("info.expenses.aria")}
        />
      }
    >
      <p className="pb-3 text-sm text-muted-foreground">{t("expenses.intro")}</p>
      {/* Der Bereich ist im Vorschau-Modus nicht bedienbar. Das MUSS dastehen:
          eine leere Tabelle ohne Knöpfe ist von „kaputt" nicht zu
          unterscheiden. */}
      {gesperrtWeilUngespeichert && (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3 rounded-(--radius) border border-border bg-secondary p-3">
          <p className="text-sm text-muted-foreground">
            {t("expenses.saveFirst")}
          </p>
          <Button size="sm" onClick={onSave} disabled={busy}>
            {busy ? t("saving") : t("save")}
          </Button>
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs uppercase text-muted-foreground">
              <th className="py-2 pr-4 font-medium">{t("expenses.concept")}</th>
              <th className="py-2 pr-4 font-medium">{t("expenses.direction")}</th>
              <th className="py-2 pr-4 font-medium">{t("expenses.date")}</th>
              <th className="py-2 pr-4 font-medium">{t("expenses.category")}</th>
              <th className="py-2 pr-4 font-medium">{t("expenses.listing")}</th>
              <th className="py-2 pr-4 font-medium">{t("expenses.reservation")}</th>
              <th className="py-2 pr-4 font-medium">{t("expenses.owner")}</th>
              <th className="py-2 pr-4 text-right font-medium">{t("expenses.amount")}</th>
              <th className="py-2 font-medium" />
            </tr>
          </thead>
          <tbody>
            {statement.expenses.map((e) => {
              const zulasten = e.direction === "from_owner";
              return (
                <tr key={e.id} className="border-b border-border">
                  <td className="py-2 pr-4">
                    <span>{e.concept}</span>
                    {/* Wer hat den Posten wann erfasst — die Abrechnung muss
                        nachvollziehbar sein, nicht nur rechnerisch stimmen. */}
                    {e.created_by_name && (
                      <span className="block text-xs text-muted-foreground">
                        {t("expenses.createdBy", { name: e.created_by_name })}
                      </span>
                    )}
                  </td>
                  <td className="py-2 pr-4">
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs ${
                        zulasten
                          ? "bg-destructive/10 text-destructive"
                          : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                      }`}
                    >
                      {zulasten ? t("expenses.fromOwnerShort") : t("expenses.toOwnerShort")}
                    </span>
                  </td>
                  <td className="py-2 pr-4">{e.date}</td>
                  <td className="py-2 pr-4">{e.category ?? "—"}</td>
                  <td className="py-2 pr-4 text-accent">{e.listing_id ? titleById.get(e.listing_id) ?? "—" : "—"}</td>
                  <td className="py-2 pr-4 text-accent">
                    {e.reservation_id ? guestByRes.get(e.reservation_id) ?? "—" : "—"}
                  </td>
                  <td className="py-2 pr-4">{e.owner_id ? statement.header.owner_name ?? "—" : "—"}</td>
                  {/* Währung des POSTENS, nicht die der Abrechnung: ein DKK-
                      Objekt unter einem EUR-Betrieb behält seine Währung. Fehlt
                      sie, rendert formatCurrency symbollos (Wurzel 4). */}
                  <td className={`py-2 pr-4 text-right font-medium ${zulasten ? "text-destructive" : ""}`}>
                    {formatCurrency(e.signed_amount, e.currency ?? currency)}
                  </td>
                  <td className="py-2">
                    <div className="flex items-center justify-end gap-2 text-muted-foreground">
                      {e.has_receipt && (
                        <button
                          type="button"
                          onClick={() => void openReceipt(e)}
                          disabled={busyId === e.id}
                          aria-label={t("expenses.openReceipt")}
                          title={e.file_name ?? t("expenses.openReceipt")}
                          className="hover:text-foreground disabled:opacity-50"
                        >
                          <Icon icon="ph:paperclip" className="size-4" />
                        </button>
                      )}
                      {!finalized && (
                        <>
                          {/* Ein Abzug darf nicht ausgeblendet werden — der
                              Schalter erscheint für ihn gar nicht erst. */}
                          {!zulasten && (
                            <button type="button" onClick={() => void toggleHidden(e)} aria-label={t("expenses.toggleHidden")} title={e.hidden_from_owner ? t("expenses.hidden") : t("expenses.visible")} className="hover:text-foreground">
                              <Icon icon={e.hidden_from_owner ? "ph:eye-slash" : "ph:eye"} className="size-4" />
                            </button>
                          )}
                          <button type="button" onClick={() => void remove(e)} aria-label={t("delete")} className="hover:text-destructive">
                            <Icon icon="ph:trash" className="size-4" />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
            {statement.expenses.length > 0 && (
              <tr className="font-bold">
                <td className="py-2 pr-4" colSpan={7}>{t("expenses.total")}</td>
                <td
                  className={`py-2 pr-4 text-right ${
                    statement.summary.expenses_total < 0 ? "text-destructive" : ""
                  }`}
                >
                  {formatCurrency(statement.summary.expenses_total, currency)}
                </td>
                <td />
              </tr>
            )}
          </tbody>
        </table>
        {statement.expenses.length === 0 && (
          <p className="py-4 text-sm text-muted-foreground">{t("expenses.empty")}</p>
        )}
      </div>

      {/* Beide Richtungen EINZELN: eine Nettozahl allein verbirgt, dass z. B.
          500 Kompensation und 500 Material gegeneinander stehen. */}
      {statement.expenses.length > 0 && (
        <div className="mt-3 flex flex-wrap justify-end gap-x-6 gap-y-1 text-sm">
          <span className="text-muted-foreground">
            {t("expenses.sumToOwner")}{" "}
            <span className="font-medium text-foreground">
              {formatCurrency(summeZugunsten, currency)}
            </span>
          </span>
          <span className="text-muted-foreground">
            {t("expenses.sumFromOwner")}{" "}
            <span className="font-medium text-foreground">
              {formatCurrency(summeZulasten, currency)}
            </span>
          </span>
        </div>
      )}

      {!finalized && (
        <div className="mt-3 flex items-center justify-end gap-4 text-sm">
          {versteckbar && (
            <button type="button" onClick={() => void hideAll()} className="text-accent">
              {t("expenses.hideAll")}
            </button>
          )}
          <Button variant="outline" size="sm" onClick={() => setAdding((v) => !v)}>
            <Icon icon="ph:plus" className="size-4" />
            {t("expenses.add")}
          </Button>
        </div>
      )}

      {adding && (
        <AddExpenseForm
          properties={properties}
          reservations={statement.rental_rows.map((r) => ({ id: r.reservation_id, label: r.guest ?? r.reservation_id }))}
          onAdd={add}
          onCancel={() => setAdding(false)}
          t={t}
        />
      )}
    </Section>
  );
}

type AddExpenseValues = {
  concept: string;
  date: string;
  direction: ExpenseDirection;
  category: string;
  listing_id: string;
  reservation_id: string;
  assign_owner: boolean;
  amount: number;
  receipt: File | null;
};

function AddExpenseForm({
  properties,
  reservations,
  onAdd,
  onCancel,
  t,
}: {
  properties: PropOption[];
  reservations: { id: string; label: string }[];
  onAdd: (f: AddExpenseValues) => void;
  onCancel: () => void;
  t: ReturnType<typeof useTranslations>;
}) {
  const [concept, setConcept] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  // Kein vorbelegter Standard: der Nutzer soll die Richtung BEWUSST wählen.
  // Eine Vorauswahl wäre der Nachfolger des alten „-0" im Betragsfeld — man
  // übersieht sie und bucht in die falsche Richtung.
  const [direction, setDirection] = useState<ExpenseDirection | "">("");
  const [category, setCategory] = useState("Cleaning");
  const [listingId, setListingId] = useState("");
  const [reservationId, setReservationId] = useState("");
  const [assignOwner, setAssignOwner] = useState(false);
  const [amount, setAmount] = useState("");
  const [receipt, setReceipt] = useState<File | null>(null);

  const betrag = Number(amount);
  // Welche Pflichtangabe fehlt — EINZELN, nicht als ein Ja/Nein. Vorher war der
  // Knopf nur `disabled`: der Nutzer klickte, nichts passierte, und nichts
  // sagte ihm warum (genau der stille Fehlschlag, den Wurzel 5 verbietet).
  // Jetzt wird der Versuch zugelassen und benennt beim Absenden die Lücke.
  const fehltRichtung = direction === "";
  const fehltKonzept = concept.trim() === "";
  const fehltBetrag = !(betrag > 0);
  const gueltig = !fehltRichtung && !fehltKonzept && !fehltBetrag;
  // Erst nach einem Absende-Versuch markieren — sonst leuchtet das Formular
  // rot, bevor der Nutzer überhaupt getippt hat.
  const [versucht, setVersucht] = useState(false);
  const zeigeFehler = versucht && !gueltig;

  const fehlend = [
    fehltRichtung ? t("expenses.direction") : null,
    fehltKonzept ? t("expenses.concept") : null,
    fehltBetrag ? t("expenses.amount") : null,
  ].filter((x): x is string => x !== null);

  return (
    <div className="mt-3 grid grid-cols-1 gap-3 rounded-(--radius) border border-border p-4 sm:grid-cols-6">
      {/* Die Richtung ist die erste und wichtigste Frage — nicht ein Vorzeichen
          im Betragsfeld, das man beim Eintippen vergisst. */}
      <fieldset className="sm:col-span-6">
        <legend
          className={`flex items-center gap-1.5 pb-2 text-sm font-medium ${
            zeigeFehler && fehltRichtung ? "text-destructive" : "text-muted-foreground"
          }`}
        >
          {t("expenses.direction")}
          <InfoHinweis
            titel={t("info.expenses.title")}
            text={[t("info.expenses.direction"), t("info.expenses.noCommission")]}
            ariaLabel={t("info.expenses.aria")}
          />
        </legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {(
            [
              ["to_owner", "expenses.toOwner", "expenses.toOwnerHint", "ph:arrow-up-right"],
              ["from_owner", "expenses.fromOwner", "expenses.fromOwnerHint", "ph:arrow-down-left"],
            ] as const
          ).map(([wert, label, hint, icon]) => (
            <button
              key={wert}
              type="button"
              onClick={() => setDirection(wert)}
              aria-pressed={direction === wert}
              className={`flex items-start gap-3 rounded-(--radius) border p-3 text-left transition-colors ${
                direction === wert
                  ? "border-accent bg-accent/5"
                  : "border-border hover:border-accent/50"
              }`}
            >
              <Icon icon={icon} className="mt-0.5 size-5 shrink-0 text-accent" />
              <span>
                <span className="block text-sm font-medium">{t(label)}</span>
                <span className="block text-xs text-muted-foreground">{t(hint)}</span>
              </span>
            </button>
          ))}
        </div>
      </fieldset>

      <Labeled label={t("expenses.concept")} className="sm:col-span-2">
        <Input
          value={concept}
          aria-invalid={zeigeFehler && fehltKonzept}
          className={zeigeFehler && fehltKonzept ? "border-destructive" : undefined}
          onChange={(e) => setConcept(e.target.value)}
        />
      </Labeled>
      <Labeled label={t("expenses.date")}>
        <DatePicker value={date} onChange={setDate} />
      </Labeled>
      <Labeled label={t("expenses.category")}>
        <NativeSelect value={category} onChange={(e) => setCategory(e.target.value)}>
          {EXPENSE_CATEGORIES.map((c) => (<option key={c} value={c}>{c}</option>))}
        </NativeSelect>
      </Labeled>
      <Labeled label={t("expenses.listing")}>
        <NativeSelect value={listingId} onChange={(e) => setListingId(e.target.value)}>
          <option value="">—</option>
          {properties.map((p) => (<option key={p.id} value={p.id}>{p.title}</option>))}
        </NativeSelect>
      </Labeled>
      {/* Immer POSITIV — die Richtung steht oben. min=0 verhindert schon in der
          Eingabe, dass jemand das alte Minuszeichen wiederbelebt. */}
      <Labeled label={t("expenses.amount")}>
        <Input
          type="number"
          step={0.01}
          min={0}
          value={amount}
          aria-invalid={zeigeFehler && fehltBetrag}
          className={zeigeFehler && fehltBetrag ? "border-destructive" : undefined}
          onChange={(e) => setAmount(e.target.value)}
        />
      </Labeled>
      <Labeled label={t("expenses.reservation")}>
        <NativeSelect value={reservationId} onChange={(e) => setReservationId(e.target.value)}>
          <option value="">—</option>
          {reservations.map((r) => (<option key={r.id} value={r.id}>{r.label}</option>))}
        </NativeSelect>
      </Labeled>
      <Labeled label={t("expenses.receipt")} className="sm:col-span-2">
        <Input
          type="file"
          accept="application/pdf,image/jpeg,image/png,image/webp"
          onChange={(e) => setReceipt(e.target.files?.[0] ?? null)}
        />
      </Labeled>
      <label className="flex items-end gap-2 pb-2 text-sm">
        <input type="checkbox" checked={assignOwner} onChange={(e) => setAssignOwner(e.target.checked)} />
        {t("expenses.assignOwner")}
      </label>
      {/* Sagt beim Absende-Versuch, WAS fehlt. `role="alert"` liest der
          Screenreader sofort vor — der Knopf allein könnte es nicht. */}
      {zeigeFehler && (
        <p
          role="alert"
          className="rounded-(--radius) border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive sm:col-span-6"
        >
          {t("expenses.missingFields", { felder: fehlend.join(", ") })}
        </p>
      )}
      <div className="flex items-end gap-2 sm:col-span-6">
        {/* NICHT `disabled`: ein toter Knopf sagt nicht, was fehlt. Der Klick
            wird angenommen und beantwortet — entweder mit dem Posten oder mit
            der Liste der fehlenden Angaben. `aria-disabled` hält die
            Information für Screenreader erhalten, ohne den Klick zu
            verschlucken. */}
        <Button
          size="sm"
          aria-disabled={!gueltig}
          onClick={() => {
            setVersucht(true);
            // `gueltig` schliesst `direction === ""` bereits ein und verengt
            // den Typ — ein zweiter Vergleich waere toter Code.
            if (!gueltig) return;
            onAdd({
              concept,
              date,
              direction,
              category,
              listing_id: listingId,
              reservation_id: reservationId,
              assign_owner: assignOwner,
              amount: betrag,
              receipt,
            });
          }}
        >
          {t("expenses.add")}
        </Button>
        <Button size="sm" variant="ghost" onClick={onCancel}>{t("cancel")}</Button>
      </div>
    </div>
  );
}

// --- Bausteine ---------------------------------------------------------------

function Section({
  title,
  children,
  right,
  info,
  defaultOpen = false,
}: {
  title: string;
  children: React.ReactNode;
  right?: React.ReactNode;
  /** Info-Symbol neben der Überschrift. Steht BEWUSST außerhalb des
   *  Auf-/Zuklapp-Knopfes: verschachtelte Knöpfe sind ungültiges HTML und der
   *  Klick auf das „i" würde sonst zusätzlich die Sektion zuklappen. */
  info?: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="border-b border-border pb-5">
      <div className="flex items-center justify-between gap-4 py-3">
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => setOpen((v) => !v)} className="flex items-center gap-2">
            <h2 className="font-display text-lg font-extrabold">{title}</h2>
            <Icon icon={open ? "ph:caret-up" : "ph:caret-down"} className="size-4 text-muted-foreground" />
          </button>
          {info}
        </div>
        {right}
      </div>
      {open && children}
    </section>
  );
}

/** Filter-Chip, der seinen Filter auch ENTFERNT.
 *
 *  Ersetzt den früheren reinen Anzeige-`Chip` — den gibt es nicht mehr, weil
 *  jeder Chip dieser Reihe einen Filter darstellt und ihn deshalb auch
 *  zurücksetzen können muss.
 *
 *  Ohne `onRemove` (Wert entspricht dem Ausgangszustand) bleibt es ein reiner
 *  Anzeige-Chip ohne „x" — ein Entfernen-Knopf, der nichts zu entfernen hat,
 *  wäre die nächste Attrappe. `whitespace-nowrap` ist hier richtig und nicht
 *  die verbotene Abkürzung: der Chip ist ein umflossenes Element in einer
 *  `flex-wrap`-Reihe, er weicht bei Platzmangel in die nächste ZEILE aus statt
 *  seinen eigenen Text zu brechen. */
function ChipEntfernbar({
  label,
  onRemove,
  entfernenLabel,
  disabled,
}: {
  label: string;
  onRemove?: () => void;
  entfernenLabel: string;
  disabled?: boolean;
}) {
  return (
    <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-secondary px-2.5 py-1 text-muted-foreground">
      {label}
      {onRemove && !disabled && (
        <button
          type="button"
          onClick={onRemove}
          aria-label={entfernenLabel}
          title={entfernenLabel}
          className="rounded-full text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Icon icon="ph:x" className="size-3" />
        </button>
      )}
    </span>
  );
}

function Labeled({
  label,
  className,
  info,
  infoAria,
  children,
}: {
  label: string;
  className?: string;
  /** Erklärtext hinter einem „i" — für Felder, deren Wirkung man nicht rät. */
  info?: string;
  infoAria?: string;
  children: React.ReactNode;
}) {
  return (
    <label className={`flex flex-col gap-1 ${className ?? ""}`}>
      {/* Siehe `Field` in owner-detail.tsx: `truncate` statt Umbruch, damit ein
          langes Label das Info-Symbol nicht in eine zweite Zeile schiebt. */}
      <span className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
        <span className="min-w-0 truncate" title={label}>
          {label}
        </span>
        {info && infoAria && <InfoHinweis text={info} ariaLabel={infoAria} />}
      </span>
      {children}
    </label>
  );
}

function HeaderField({
  label,
  value,
  onChange,
  disabled,
  emptyHint,
}: {
  label: string;
  value: string | null;
  onChange: (v: string | null) => void;
  disabled: boolean;
  // Hinweis im Platzhalter, wenn ein schreibgeschütztes Feld leer ist (Daten
  // stammen aus den Stammdaten – dort pflegen, nicht hier).
  emptyHint?: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="w-40 shrink-0 text-sm text-muted-foreground">{label}</span>
      <Input
        value={value ?? ""}
        disabled={disabled}
        placeholder={disabled && !value ? emptyHint : undefined}
        onChange={(e) => onChange(e.target.value || null)}
      />
    </div>
  );
}

function SummaryCell({
  icon,
  label,
  value,
  info,
  infoAria,
}: {
  icon: string;
  label: string;
  value: string;
  /** Erklärt, WAS diese Kennzahl ist — die vier unterscheiden sich nur im
   *  Namen, und „Gesamt-Auszahlung" vs. „Eigentümer-Auszahlung" errät niemand. */
  info?: string;
  infoAria?: string;
}) {
  return (
    <div className="flex flex-col items-center gap-1 text-center">
      <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
        <Icon icon={icon} className="size-4 text-accent" />
        {label}
        {info && infoAria && <InfoHinweis text={info} ariaLabel={infoAria} />}
      </span>
      <span className="font-display text-2xl font-extrabold">{value}</span>
    </div>
  );
}

/** Hinweis an einer Zeile, deren Gebühren das Portal nicht gemeldet hat.
 *
 *  WARUM DAS AN DIE ZEILE GEHÖRT: Bei einer solchen Buchung setzt die
 *  Abrechnung KEINE Gebühren an — nicht gemeldet heißt nicht gezahlt. Der
 *  Gastpreis liegt damit unter dem, was der Betrieb erwartet, und ohne
 *  Erklärung sieht das wie ein Rechenfehler aus. Am 11.08.2026 kostete genau
 *  diese Frage („warum steht bei dieser Buchung keine Reinigung?") einen halben
 *  Tag Suche beim Channex-Mapping, beim Tax Set und im Rechencode; die Antwort
 *  lag im Eingangsweg der Buchung.
 *
 *  Nur bei `ota_ohne_aufstellung` sichtbar: `ota` ist der Normalfall und
 *  `stammdaten` bei einer Direktbuchung ebenfalls richtig — ein Hinweis an jeder
 *  Zeile wäre Rauschen, das den echten Fall verdeckt. */
function GebuehrenHerkunft({ zeile }: { zeile: RentalRow }) {
  const t = useTranslations("ownerStatements");
  if (zeile.gebuehren_quelle !== "ota_ohne_aufstellung") return null;
  const grundKey = zeile.gebuehren_grund
    ? GEBUEHREN_GRUND_KEYS[zeile.gebuehren_grund]
    : undefined;
  return (
    <InfoHinweis
      titel={t("rental.feeSource.title")}
      text={[
        t("rental.feeSource.what"),
        t(grundKey ?? "rental.feeSource.unknownReason"),
      ]}
      ariaLabel={t("info.aria", { feld: t("rental.feeSource.title") })}
      className="text-warning"
    />
  );
}

/** Die Kette unter dem Auszahlungsbetrag: WIE er entsteht.
 *
 *  WARUM DAS AN DIE ZEILE GEHÖRT: Ohne sie ist der Betrag eine Zahl ohne
 *  Herkunft. Gemeldet am 20.08.2026 von der Betreiberin — sie fand die im
 *  Eigentümervertrag hinterlegte Pauschale von 50 kr in der Abrechnung nicht
 *  und legte sie deshalb je Buchung als Ausgabe NOCH EINMAL an. Die Pauschale
 *  war längst abgezogen; der Eigentümerin wurde sie damit zweimal berechnet
 *  (zwei Posten „Indflytning-gebyr", Juli 2026, live gefunden). Der Rechenweg
 *  war korrekt — nur unsichtbar.
 *
 *  Nur was FESTSTEHT: `null` und 0 werden weggelassen, nie als „0,00" gezeigt
 *  (Wurzel 4). Bei maskierten Zeilen (§4.2) fehlt die Portal-Provision
 *  ohnehin — dann beginnt die Kette bei der Verwaltungsprovision. */
function AuszahlungsKette({
  zeile,
  waehrung,
}: {
  zeile: RentalRow;
  waehrung: string;
}) {
  const t = useTranslations("ownerStatements");
  const glieder: string[] = [];
  const glied = (label: string, wert: number | null, minus = true) => {
    if (wert === null || wert === 0) return;
    glieder.push(
      `${label} ${minus ? "−" : "+"}${formatCurrency(Math.abs(wert), waehrung)}`,
    );
  };
  glied(t("rental.chain.portal"), zeile.portal_provision);
  glied(t("rental.chain.management"), zeile.verwaltungsprovision);
  glied(t("rental.chain.flatFee"), zeile.pauschale);
  glied(t("rental.chain.fees"), zeile.gebuehren_an_eigentuemer, false);
  if (glieder.length === 0) return null;
  return (
    <span className="mt-0.5 block text-xs font-normal text-muted-foreground">
      {glieder.join(" · ")}
    </span>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-lg font-bold">{value}</span>
    </div>
  );
}
