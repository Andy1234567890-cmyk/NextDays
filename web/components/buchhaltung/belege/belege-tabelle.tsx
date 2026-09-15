"use client";

// Belegliste einer Art mit Aktionen: „Umwandeln in …" (Kette), „Ausstellen"
// (Nummer ziehen), „Wiederkehrend" (Vorlage anlegen / pausieren / fortsetzen).
// Nach jeder Aktion `router.refresh()` — kein Realtime auf Finanztabellen
// (Wurzel 6, `invoices`/`quotes` sind für authenticated gesperrt).
import { Icon } from "@iconify/react";
import { useLocale, useTranslations } from "next-intl";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button } from "@nextdays/ui/button";
import { Card } from "@nextdays/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@nextdays/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@nextdays/ui/dropdown-menu";
import { Input } from "@nextdays/ui/input";
import { Label } from "@nextdays/ui/label";
import { NativeSelect } from "@nextdays/ui/native-select";
import {
  convertBeleg,
  createRecurringVorlage,
  finalizeBeleg,
  updateRecurringVorlage,
} from "@/lib/buchhaltung-belege";
import {
  KETTE,
  type Belegart,
  type BelegListItem,
  type RecurringInterval,
  type Zielart,
} from "@/lib/buchhaltung-belege-typen";
import { formatCurrency } from "@/lib/currency";

const INTERVALLE: readonly RecurringInterval[] = ["weekly", "monthly", "quarterly", "yearly"];

function formatDate(iso: string | null, locale: string): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat(locale).format(new Date(iso));
}

function statusKlasse(status: string): string {
  switch (status) {
    case "draft":
      return "bg-secondary text-secondary-foreground";
    case "finalized":
    case "sent":
      return "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300";
    case "paid":
    case "accepted":
    case "converted":
      return "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300";
    case "overdue":
    case "cancelled":
    case "rejected":
      return "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300";
    default:
      return "bg-muted text-muted-foreground";
  }
}

export function BelegeTabelle({
  art,
  items,
  labels,
}: {
  art: Belegart;
  items: BelegListItem[];
  labels: Record<Belegart, string>;
}) {
  const t = useTranslations("finance");
  const locale = useLocale();
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  const [erfolg, setErfolg] = useState<string | null>(null);
  const [recurringFuer, setRecurringFuer] = useState<BelegListItem | null>(null);
  const [, starten] = useTransition();

  const ziele: readonly Zielart[] = KETTE[art] ?? [];
  const istRecurring = art === "recurring";

  function melden(res: { ok: true } | { ok: false; error: string }, okText: string) {
    if (res.ok) {
      setFehler(null);
      setErfolg(okText);
      starten(() => router.refresh());
    } else {
      setErfolg(null);
      setFehler(res.error);
    }
  }

  async function umwandeln(item: BelegListItem, ziel: Zielart) {
    setBusyId(item.id);
    const res = await convertBeleg(item.id, item.type, ziel);
    setBusyId(null);
    melden(
      res,
      t("belegePage.convertDone", { ziel: labels[ziel] }),
    );
  }

  async function ausstellen(item: BelegListItem) {
    setBusyId(item.id);
    const res = await finalizeBeleg(item.id);
    setBusyId(null);
    melden(
      res,
      res.ok ? t("belegePage.finalizeDone", { nummer: res.data.number ?? "" }) : "",
    );
  }

  async function pausieren(item: BelegListItem, status: "paused" | "active") {
    setBusyId(item.id);
    const res = await updateRecurringVorlage(item.id, { status });
    setBusyId(null);
    melden(res, t(status === "paused" ? "belegePage.pausedDone" : "belegePage.resumedDone"));
  }

  if (items.length === 0) {
    return (
      <Card className="flex flex-col items-center justify-center gap-3 p-12 text-center">
        <span className="flex size-14 items-center justify-center rounded-full bg-secondary">
          <Icon icon="ph:files" className="size-7 text-muted-foreground" />
        </span>
        <div>
          <p className="font-display text-lg font-extrabold">
            {t("belegePage.emptyTitle", { art: labels[art] })}
          </p>
          <p className="text-sm text-muted-foreground">{t("belegePage.emptySubtitle")}</p>
        </div>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {fehler && (
        <Card role="alert" className="p-3 text-sm text-destructive">
          {fehler}
        </Card>
      )}
      {erfolg && (
        <Card role="status" className="p-3 text-sm text-accent">
          {erfolg}
        </Card>
      )}
      <Card className="overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead className="border-b bg-secondary/40 text-left text-xs text-muted-foreground">
            <tr>
              <th className="px-4 py-3 font-medium">{t("belegePage.columnNumber")}</th>
              <th className="px-4 py-3 font-medium">{t("belegePage.columnCustomer")}</th>
              <th className="px-4 py-3 font-medium">{t("belegePage.columnDate")}</th>
              {istRecurring ? (
                <>
                  <th className="px-4 py-3 font-medium">{t("belegePage.columnInterval")}</th>
                  <th className="px-4 py-3 font-medium">{t("belegePage.columnNextAt")}</th>
                </>
              ) : (
                <th className="px-4 py-3 font-medium">{t("belegePage.columnSource")}</th>
              )}
              <th className="px-4 py-3 text-right font-medium">{t("belegePage.columnAmount")}</th>
              <th className="px-4 py-3 font-medium">{t("belegePage.columnStatus")}</th>
              <th className="px-4 py-3 text-right font-medium">
                <span className="sr-only">{t("belegePage.columnActions")}</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {items.map((b) => (
              <BelegZeile
                key={b.id}
                b={b}
                art={art}
                labels={labels}
                locale={locale}
                busy={busyId === b.id}
                ziele={ziele}
                onUmwandeln={umwandeln}
                onAusstellen={ausstellen}
                onPausieren={pausieren}
                onVorlage={setRecurringFuer}
              />
            ))}
          </tbody>
        </table>
      </Card>

      <RecurringDialog
        item={recurringFuer}
        onClose={() => setRecurringFuer(null)}
        onDone={(res) => {
          setRecurringFuer(null);
          melden(res, t("belegePage.recurringCreated"));
        }}
      />
    </div>
  );
}

function RecurringDialog({
  item,
  onClose,
  onDone,
}: {
  item: BelegListItem | null;
  onClose: () => void;
  onDone: (res: { ok: true } | { ok: false; error: string }) => void;
}) {
  const t = useTranslations("finance");
  const [interval, setInterval] = useState<RecurringInterval>("monthly");
  const [startAt, setStartAt] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [endAt, setEndAt] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);

  async function speichern() {
    if (!item) return;
    if (!startAt) {
      setFehler(t("belegePage.recurringStartRequired"));
      return;
    }
    setBusy(true);
    setFehler(null);
    const res = await createRecurringVorlage(item.id, {
      interval,
      startAt,
      endAt: endAt || null,
    });
    setBusy(false);
    if (res.ok) onDone({ ok: true });
    else setFehler(res.error);
  }

  return (
    <Dialog open={item !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogTitle className="font-display text-lg font-extrabold">
          {t("belegePage.recurringDialogTitle")}
        </DialogTitle>
        <DialogDescription>
          {t("belegePage.recurringDialogText", { nummer: item?.number ?? "" })}
        </DialogDescription>
        <div className="grid gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="rec-interval">{t("belegePage.columnInterval")}</Label>
            <NativeSelect
              id="rec-interval"
              value={interval}
              onChange={(e) => setInterval(e.target.value as RecurringInterval)}
            >
              {INTERVALLE.map((i) => (
                <option key={i} value={i}>
                  {t(`belegePage.interval_${i}`)}
                </option>
              ))}
            </NativeSelect>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="rec-start">{t("belegePage.recurringStart")}</Label>
              <Input
                id="rec-start"
                type="date"
                value={startAt}
                onChange={(e) => setStartAt(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="rec-end">{t("belegePage.recurringEnd")}</Label>
              <Input
                id="rec-end"
                type="date"
                value={endAt}
                onChange={(e) => setEndAt(e.target.value)}
              />
            </div>
          </div>
          {fehler && (
            <p role="alert" className="text-sm text-destructive">
              {fehler}
            </p>
          )}
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose} disabled={busy}>
            {t("belegePage.cancel")}
          </Button>
          <Button onClick={speichern} disabled={busy}>
            {busy ? t("belegePage.saving") : t("belegePage.recurringSave")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** Eine Zeile der Belegtabelle samt Aktionsmenü. */
function BelegZeile({
  b,
  art,
  labels,
  locale,
  busy,
  ziele,
  onUmwandeln,
  onAusstellen,
  onPausieren,
  onVorlage,
}: {
  b: BelegListItem;
  art: Belegart;
  labels: Record<Belegart, string>;
  locale: string;
  busy: boolean;
  ziele: readonly Zielart[];
  onUmwandeln: (b: BelegListItem, ziel: Zielart) => void;
  onAusstellen: (b: BelegListItem) => void;
  onPausieren: (b: BelegListItem, status: "active" | "paused") => void;
  onVorlage: (b: BelegListItem) => void;
}) {
  const t = useTranslations("finance");
  const istRecurring = art === "recurring";
  const entwurf = b.status === "draft" && !b.number && !b.isLocked;
  const gross = Number(b.grossAmount);
  return (
  <tr key={b.id} className="transition-colors hover:bg-secondary/30">
    <td className="px-4 py-3 font-medium">
      {b.number || (
        <span className="text-muted-foreground">{t("belegePage.draftLabel")}</span>
      )}
    </td>
    <td className="px-4 py-3 text-muted-foreground">{b.customerName || "—"}</td>
    <td className="px-4 py-3 text-muted-foreground">
      {formatDate(b.issueDate, locale)}
    </td>
    {istRecurring ? (
      <WiederholungsZellen b={b} locale={locale} />
    ) : (
      <HerkunftZelle b={b} labels={labels} />
    )}
    <td className="px-4 py-3 text-right font-medium">
      {formatCurrency(Number.isFinite(gross) ? gross : 0, b.currency)}
    </td>
    <td className="px-4 py-3">
      <span
        className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${statusKlasse(
          istRecurring ? b.recurringStatus ?? b.status : b.status,
        )}`}
      >
        {istRecurring
          ? t(`belegePage.recurring_${b.recurringStatus ?? "active"}`)
          : t.has(`belegePage.status_${b.status}`)
            ? t(`belegePage.status_${b.status}`)
            : b.status}
      </span>
    </td>
    <td className="px-4 py-3 text-right">
      <BelegAktionen
        b={b}
        art={art}
        labels={labels}
        busy={busy}
        ziele={ziele}
        entwurf={entwurf}
        onUmwandeln={onUmwandeln}
        onAusstellen={onAusstellen}
        onPausieren={onPausieren}
        onVorlage={onVorlage}
      />
    </td>
  </tr>
  );
}

/** Das Aktionsmenü einer Belegzeile. Welche Einträge es gibt, hängt an der
 *  Belegart und am Zustand — deshalb hier gebündelt statt in der Zeile. */
/** Welche Menüeinträge dieser Beleg zulässt. Als Funktion, damit die
 *  Komponente nur noch zeichnet und die Regeln an EINER Stelle stehen. */
function aktionsLage(
  b: BelegListItem,
  art: Belegart,
  entwurf: boolean,
  ziele: readonly Zielart[],
) {
  const istRecurring = art === "recurring";
  const kannAusstellen = art !== "quote" && !istRecurring && entwurf;
  const kannVorlage = art === "invoice" && !entwurf;
  const pausen = {
    active: { ziel: "paused" as const, icon: "ph:pause", text: "belegePage.pause" },
    paused: { ziel: "active" as const, icon: "ph:play", text: "belegePage.resume" },
  };
  const pause = istRecurring ? (pausen[b.recurringStatus as keyof typeof pausen] ?? null) : null;
  return {
    kannAusstellen,
    kannVorlage,
    pause,
    leer: ziele.length === 0 && !kannAusstellen && !kannVorlage && !istRecurring,
  };
}

function BelegAktionen({
  b,
  art,
  labels,
  busy,
  ziele,
  entwurf,
  onUmwandeln,
  onAusstellen,
  onPausieren,
  onVorlage,
}: {
  b: BelegListItem;
  art: Belegart;
  labels: Record<Belegart, string>;
  busy: boolean;
  ziele: readonly Zielart[];
  entwurf: boolean;
  onUmwandeln: (b: BelegListItem, ziel: Zielart) => void;
  onAusstellen: (b: BelegListItem) => void;
  onPausieren: (b: BelegListItem, status: "active" | "paused") => void;
  onVorlage: (b: BelegListItem) => void;
}) {
  const t = useTranslations("finance");
  const { kannAusstellen, kannVorlage, pause, leer } = aktionsLage(b, art, entwurf, ziele);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" disabled={busy} aria-label={t("belegePage.columnActions")}>
          <Icon
            icon={busy ? "ph:spinner" : "ph:dots-three-outline"}
            className={`size-5 ${busy ? "animate-spin" : ""}`}
          />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <UmwandelnEintraege b={b} ziele={ziele} labels={labels} onUmwandeln={onUmwandeln} />
        {kannAusstellen && (
          <DropdownMenuItem onSelect={() => onAusstellen(b)}>
            <Icon icon="ph:seal-check" className="mr-2 size-4" />
            {t("belegePage.finalize")}
          </DropdownMenuItem>
        )}
        {kannVorlage && (
          <DropdownMenuItem onSelect={() => onVorlage(b)}>
            <Icon icon="ph:repeat" className="mr-2 size-4" />
            {t("belegePage.makeRecurring")}
          </DropdownMenuItem>
        )}
        {pause && (
          <DropdownMenuItem onSelect={() => onPausieren(b, pause.ziel)}>
            <Icon icon={pause.icon} className="mr-2 size-4" />
            {t(pause.text)}
          </DropdownMenuItem>
        )}
        {leer && <DropdownMenuItem disabled>{t("belegePage.noActions")}</DropdownMenuItem>}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Intervall und nächste Ausführung einer Vorlage. */
function WiederholungsZellen({ b, locale }: { b: BelegListItem; locale: string }) {
  const t = useTranslations("finance");
  return (
    <>
      <td className="px-4 py-3 text-muted-foreground">
        {b.recurringInterval ? t(`belegePage.interval_${b.recurringInterval}`) : "—"}
      </td>
      <td className="px-4 py-3 text-muted-foreground">
        {formatDate(b.recurringNextAt, locale)}
        {b.recurringEndAt && (
          <span className="ml-1 text-xs">
            ({t("belegePage.until")} {formatDate(b.recurringEndAt, locale)})
          </span>
        )}
      </td>
    </>
  );
}

/** Woher der Beleg stammt: Angebot, Vorbeleg oder Vorlage. */
function HerkunftZelle({
  b,
  labels,
}: {
  b: BelegListItem;
  labels: Record<Belegart, string>;
}) {
  const t = useTranslations("finance");
  const quelle = b.sourceQuoteId
    ? { href: "/buchhaltung/belege?type=quote", text: labels.quote }
    : b.recurringTemplateId
      ? { href: "/buchhaltung/belege?type=recurring", text: labels.recurring }
      : null;
  return (
    <td className="px-4 py-3 text-muted-foreground">
      {quelle ? (
        <Link className="underline-offset-2 hover:underline" href={quelle.href}>
          {quelle.text}
        </Link>
      ) : b.sourceDocumentId ? (
        <span>{t("belegePage.fromDocument")}</span>
      ) : (
        "—"
      )}
    </td>
  );
}

/** Die erlaubten Umwandlungen dieses Belegs (Kette aus `KETTE`). */
function UmwandelnEintraege({
  b,
  ziele,
  labels,
  onUmwandeln,
}: {
  b: BelegListItem;
  ziele: readonly Zielart[];
  labels: Record<Belegart, string>;
  onUmwandeln: (b: BelegListItem, ziel: Zielart) => void;
}) {
  const t = useTranslations("finance");
  if (ziele.length === 0) return null;
  return (
    <>
      <DropdownMenuLabel>{t("belegePage.convertTo")}</DropdownMenuLabel>
      {ziele.map((ziel) => (
        <DropdownMenuItem key={ziel} onSelect={() => onUmwandeln(b, ziel)}>
          <Icon icon="ph:arrow-elbow-down-right" className="mr-2 size-4" />
          {labels[ziel]}
        </DropdownMenuItem>
      ))}
      <DropdownMenuSeparator />
    </>
  );
}
