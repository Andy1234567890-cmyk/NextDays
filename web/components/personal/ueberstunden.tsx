"use client";

// Ueberstundenantraege (Vertrag §3.5): Liste, eigener Antrag, Entscheidung mit
// Kommentar. Der AZK-Hinweis steht VOR dem Klick — die Genehmigung bucht die
// Minuten als Korrektur auf das Arbeitszeitkonto, und das muss man wissen,
// bevor man genehmigt (nicht danach).
//
// Live ueber useRealtime auf `personal_ueberstunden_antraege` (die Tabelle hat
// laut Vertrag §0 einen Grant; Finanztabellen haben keinen und werden
// nachgeladen statt abonniert).
import { Icon } from "@iconify/react";
import { useLocale, useTranslations } from "next-intl";
import { useCallback, useState } from "react";
import { toast } from "sonner";

import { Button } from "@nextdays/ui/button";
import { DatePicker } from "@nextdays/ui/date-picker";
import { Input } from "@nextdays/ui/input";
import { NativeSelect } from "@nextdays/ui/native-select";
import { Textarea } from "@nextdays/ui/textarea";
import {
  listUeberstunden,
  ueberstundenBeantragen,
  ueberstundenEntscheiden,
} from "@/lib/personal-betrieb";
import {
  minutenAlsStunden,
  type Ueberstundenantrag,
  type UeberstundenStatus,
} from "@/lib/personal-betrieb-typen";
import { heuteIso } from "@/lib/personal-typen";
import { useRealtime } from "@/lib/use-realtime";
import { formatDate, formatDateTime } from "@/lib/utils";

const STATUS: readonly UeberstundenStatus[] = ["beantragt", "genehmigt", "abgelehnt"];

export function UeberstundenListe({
  initial,
  von,
  bis,
  kannEntscheiden,
  /** Own-Sicht: nur die eigenen Antraege, kein Personenfilter, „Antrag stellen"
   *  ist die Hauptaktion. */
  eigenesich = false,
}: {
  initial: Ueberstundenantrag[];
  von?: string;
  bis?: string;
  kannEntscheiden: boolean;
  eigenesich?: boolean;
}) {
  const t = useTranslations("personal");
  const locale = useLocale();
  const [liste, setListe] = useState(initial);
  const [status, setStatus] = useState<"" | UeberstundenStatus>("");
  const [neu, setNeu] = useState(false);
  const [entscheidung, setEntscheidung] = useState<Ueberstundenantrag | null>(null);

  const nachladen = useCallback(async () => {
    const res = await listUeberstunden(von, bis, status || undefined);
    if (res.ok) setListe(res.data);
  }, [von, bis, status]);
  useRealtime({ table: "personal_ueberstunden_antraege", onChange: nachladen });

  const gefiltert = status ? liste.filter((a) => a.status === status) : liste;

  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-extrabold">{t("ueberstunden.titel")}</h2>
          <p className="text-sm text-muted-foreground">{t("ueberstunden.hint")}</p>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-xs text-muted-foreground">{t("ueberstunden.filterStatus")}</span>
            <NativeSelect
              value={status}
              className="w-40"
              onChange={(e) => {
                setStatus(e.target.value as "" | UeberstundenStatus);
                void nachladen();
              }}
            >
              <option value="">{t("ueberstunden.alleStatus")}</option>
              {STATUS.map((s) => (
                <option key={s} value={s}>
                  {t(`ueberstunden.status.${s}`)}
                </option>
              ))}
            </NativeSelect>
          </label>
          <Button className="rounded-full" onClick={() => setNeu(true)}>
            <Icon icon="ph:plus" className="mr-1 size-4" />
            {t("ueberstunden.neu")}
          </Button>
        </div>
      </div>

      <ul className="divide-y overflow-hidden rounded-2xl border bg-card">
        {gefiltert.length === 0 && (
          <li className="p-6 text-center text-sm text-muted-foreground">{t("ueberstunden.keine")}</li>
        )}
        {gefiltert.map((a) => (
          <li key={a.id} className="flex flex-wrap items-center gap-3 px-4 py-3 text-sm">
            <StatusBadge status={a.status} />
            <div className="min-w-0 flex-1">
              <div className="font-medium">
                {eigenesich ? formatDate(a.datum, locale) : `${a.full_name ?? "—"} · ${formatDate(a.datum, locale)}`}
                {" · "}
                <span className="tabular-nums">{minutenAlsStunden(a.minuten)} h</span>
              </div>
              <div className="text-xs text-muted-foreground">
                {a.grund}
                {a.kommentar ? ` · ${t("ueberstunden.kommentar")}: ${a.kommentar}` : ""}
                {a.entschieden_am
                  ? ` · ${t("ueberstunden.entschiedenVon", {
                      name: a.entschieden_von ?? "—",
                      datum: formatDateTime(a.entschieden_am, locale),
                    })}`
                  : ""}
              </div>
            </div>
            {kannEntscheiden && a.status === "beantragt" && (
              <Button size="sm" className="rounded-full" onClick={() => setEntscheidung(a)}>
                {t("ueberstunden.entscheiden")}
              </Button>
            )}
          </li>
        ))}
      </ul>

      {neu && (
        <AntragDialog
          onClose={() => setNeu(false)}
          onSaved={() => {
            setNeu(false);
            void nachladen();
          }}
        />
      )}
      {entscheidung && (
        <EntscheidungDialog
          antrag={entscheidung}
          onClose={() => setEntscheidung(null)}
          onSaved={() => {
            setEntscheidung(null);
            void nachladen();
          }}
        />
      )}
    </section>
  );
}

export function StatusBadge({ status }: { status: UeberstundenStatus }) {
  const t = useTranslations("personal");
  const farbe: Record<UeberstundenStatus, string> = {
    beantragt: "bg-amber-100 text-amber-800",
    genehmigt: "bg-emerald-100 text-emerald-800",
    abgelehnt: "bg-destructive/10 text-destructive",
  };
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs ${farbe[status]}`}>
      {t(`ueberstunden.status.${status}`)}
    </span>
  );
}

function AntragDialog({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const t = useTranslations("personal");
  const [datum, setDatum] = useState(heuteIso());
  const [minuten, setMinuten] = useState("60");
  const [grund, setGrund] = useState("");
  const [busy, setBusy] = useState(false);

  const min = Number(minuten) || 0;
  const gueltig = datum !== "" && min >= 1 && min <= 720 && grund.trim().length >= 3;

  async function absenden(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const res = await ueberstundenBeantragen({ datum, minuten: min, grund: grund.trim() });
    setBusy(false);
    if (!res.ok) {
      const code = res.details?.code;
      const schluessel = typeof code === "string" ? `fehlercode.${code}` : "";
      toast.error(schluessel && t.has(schluessel) ? t(schluessel) : res.error);
      return;
    }
    toast.success(t("ueberstunden.beantragt"));
    onSaved();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <form
        onSubmit={absenden}
        className="w-full max-w-md rounded-2xl bg-card p-4 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="mb-3 font-display text-lg font-extrabold">{t("ueberstunden.neu")}</h2>
        <div className="flex flex-col gap-3 text-sm">
          <label className="flex flex-col gap-1">
            <span className="font-medium">{t("ueberstunden.datum")}</span>
            <DatePicker value={datum} onChange={setDatum} />
          </label>
          <label className="flex flex-col gap-1">
            <span className="font-medium">{t("ueberstunden.minuten")}</span>
            <Input inputMode="numeric" value={minuten} onChange={(e) => setMinuten(e.target.value)} />
            <span className="text-xs text-muted-foreground">
              {t("ueberstunden.minutenHint")}
              {min > 0 ? ` · ${minutenAlsStunden(min)} h` : ""}
            </span>
          </label>
          <label className="flex flex-col gap-1">
            <span className="font-medium">{t("ueberstunden.grundPflicht")}</span>
            <Textarea rows={3} value={grund} onChange={(e) => setGrund(e.target.value)} required minLength={3} />
          </label>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <Button type="button" variant="outline" className="rounded-full" onClick={onClose}>
            {t("abbrechen")}
          </Button>
          <Button type="submit" disabled={busy || !gueltig} className="rounded-full">
            {t("abwesenheit.absenden")}
          </Button>
        </div>
      </form>
    </div>
  );
}

function EntscheidungDialog({
  antrag,
  onClose,
  onSaved,
}: {
  antrag: Ueberstundenantrag;
  onClose: () => void;
  onSaved: () => void;
}) {
  const t = useTranslations("personal");
  const locale = useLocale();
  const [kommentar, setKommentar] = useState("");
  const [busy, setBusy] = useState(false);

  async function entscheiden(genehmigen: boolean) {
    setBusy(true);
    const res = await ueberstundenEntscheiden(antrag.id, genehmigen, kommentar);
    setBusy(false);
    if (!res.ok) {
      const code = res.details?.code;
      const schluessel = typeof code === "string" ? `fehlercode.${code}` : "";
      toast.error(schluessel && t.has(schluessel) ? t(schluessel) : res.error);
      return;
    }
    toast.success(genehmigen ? t("ueberstunden.genehmigtMeldung") : t("ueberstunden.abgelehntMeldung"));
    onSaved();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="w-full max-w-md rounded-2xl bg-card p-4 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="mb-1 font-display text-lg font-extrabold">{t("ueberstunden.entscheiden")}</h2>
        <p className="mb-3 text-sm text-muted-foreground">
          {antrag.full_name ?? "—"} · {formatDate(antrag.datum, locale)} ·{" "}
          <span className="tabular-nums">{minutenAlsStunden(antrag.minuten)} h</span>
        </p>
        <p className="mb-3 rounded-xl bg-secondary/40 p-3 text-sm">{antrag.grund}</p>
        <p className="mb-3 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
          <Icon icon="ph:info" className="mr-1 inline size-4" />
          {t("ueberstunden.azkHinweis", { minuten: antrag.minuten })}
        </p>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">{t("ueberstunden.kommentar")}</span>
          <Textarea rows={2} value={kommentar} onChange={(e) => setKommentar(e.target.value)} />
        </label>
        <div className="mt-4 flex flex-wrap justify-end gap-2">
          <Button type="button" variant="outline" className="rounded-full" onClick={onClose}>
            {t("abbrechen")}
          </Button>
          <Button
            type="button"
            variant="outline"
            className="rounded-full"
            disabled={busy}
            onClick={() => entscheiden(false)}
          >
            {t("ueberstunden.ablehnen")}
          </Button>
          <Button type="button" className="rounded-full" disabled={busy} onClick={() => entscheiden(true)}>
            {t("ueberstunden.genehmigen")}
          </Button>
        </div>
      </div>
    </div>
  );
}
