"use client";

// Reiter „Arbeitszeit": Soll/Plan/Ist des laufenden Monats, kommende
// Schichten, Zeiten des Monats mit Nachtrag/Korrektur/Bestätigung (Taskilo
// TimeTrackingTab). Die Stempeluhr selbst bleibt der App — hier plant und
// prüft die Leitung.
import { Icon } from "@iconify/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@nextdays/ui/button";
import { zeitBestaetigen, zeitLoeschen } from "@/lib/personal";
import type { PersonUebersicht, Zeiterfassung, ZeitListe } from "@/lib/personal-typen";
import { stunden } from "@/lib/personal-typen";
import { uhrzeitInZone } from "@/lib/personal-zeit";
import { formatDate } from "@/lib/utils";

import { Leer, ReiterKopf } from "./kartei-helfer";
import { NachtragDialog, ZeitStatus } from "./zeiterfassung";

export function AkteArbeitszeit({
  u,
  zeiten,
  zone,
  objekte,
  kannBestaetigen,
}: {
  u: PersonUebersicht;
  zeiten: ZeitListe;
  zone: string;
  objekte: { id: string; title: string }[];
  kannBestaetigen: boolean;
}) {
  const t = useTranslations("personal");
  const locale = useLocale();
  const router = useRouter();
  const [nachtrag, setNachtrag] = useState(false);

  async function bestaetigen(z: Zeiterfassung) {
    const res = await zeitBestaetigen(z.id);
    if (!res.ok) return void toast.error(res.error);
    router.refresh();
  }
  async function loeschen(z: Zeiterfassung) {
    const grund = window.prompt(t("zeit.loeschGrund"));
    if (!grund || grund.trim().length < 3) return;
    const res = await zeitLoeschen(z.id, grund.trim());
    if (!res.ok) return void toast.error(res.error);
    router.refresh();
  }

  const summe = zeiten.items.reduce((n, z) => n + (z.end_at ? z.netto_minuten : 0), 0);
  const diff = u.monat_soll_minuten === null ? null : u.monat_ist_minuten - u.monat_soll_minuten;

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_22rem]">
      <div className="flex flex-col gap-6">
        <section className="rounded-2xl border bg-card p-4">
          <ReiterKopf titel={t("kartei.planIst")} hint={t("kartei.planIstHint")} />
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Zahl label={t("kartei.soll")} wert={u.monat_soll_minuten === null ? "—" : `${stunden(u.monat_soll_minuten)} h`} />
            <Zahl label={t("kartei.planStunden")} wert={`${stunden(u.monat_plan_minuten)} h`} />
            <Zahl label={t("kartei.ist")} wert={`${stunden(u.monat_ist_minuten)} h`} />
            <Zahl label={t("zeit.planAbweichung")} wert={diff === null ? "—" : `${diff >= 0 ? "+" : ""}${stunden(diff)} h`} ton={diff !== null && diff < 0 ? "warn" : undefined} />
          </div>
        </section>

        <section className="rounded-2xl border bg-card p-4">
          <ReiterKopf titel={t("kartei.zeitenMonat", { summe: stunden(summe) })} onNeu={kannBestaetigen ? () => setNachtrag(true) : undefined} neuLabel={t("zeit.nachtragen")} />
          {zeiten.items.length === 0 ? (
            <Leer text={t("zeit.keine")} />
          ) : (
            <ul className="divide-y text-sm">
              {zeiten.items.map((z) => (
                <li key={z.id} className="flex flex-wrap items-center gap-3 py-2">
                  <span className="w-24 text-muted-foreground">{formatDate(z.start_at, locale)}</span>
                  <span className="w-28">
                    {uhrzeitInZone(z.start_at, zone)}–{z.end_at ? uhrzeitInZone(z.end_at, zone) : "…"}
                  </span>
                  <span className="min-w-0 flex-1 text-xs text-muted-foreground">
                    {z.property_title ?? ""}
                    {z.pause_minuten ? ` · ${t("pauseMin")}: ${z.pause_minuten}` : ""}
                    {z.plan_abweichung_min !== null ? ` · Δ ${z.plan_abweichung_min} min` : ""}
                    {z.korrekturen ? ` · ${t("zeit.korrigiert")} ×${z.korrekturen}` : ""}
                  </span>
                  <span className="w-16 text-right font-medium">{z.end_at ? `${stunden(z.netto_minuten)} h` : ""}</span>
                  <ZeitStatus status={z.status} />
                  {kannBestaetigen && z.status === "abgeschlossen" && (
                    <Button variant="ghost" size="sm" onClick={() => bestaetigen(z)}>{t("zeit.bestaetigen")}</Button>
                  )}
                  {kannBestaetigen && z.status !== "bestaetigt" && (
                    <Button variant="ghost" size="icon" aria-label={t("loeschen")} onClick={() => loeschen(z)}>
                      <Icon icon="ph:trash" className="size-4" />
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          )}
          <p className="mt-3 text-xs text-muted-foreground">
            <Link href="/hr/zeiterfassung" className="underline">{t("zeit.title")}</Link> · {t("kartei.korrekturHinweis")}
          </p>
        </section>
      </div>

      <section className="rounded-2xl border bg-card p-4">
        <ReiterKopf titel={t("kartei.kommendeSchichten")} />
        {u.kommende_schichten.length === 0 ? (
          <Leer text={t("kartei.keineSchichten")} />
        ) : (
          <ul className="divide-y text-sm">
            {u.kommende_schichten.map((s) => (
              <li key={s.id} className="flex items-center gap-3 py-2">
                <span className="w-24 text-muted-foreground">{formatDate(s.datum, locale)}</span>
                <span className="flex-1">
                  {uhrzeitInZone(s.start_at, zone)}–{uhrzeitInZone(s.end_at, zone)}
                  {s.property_title ? <span className="block text-xs text-muted-foreground">{s.property_title}</span> : null}
                </span>
                <span className="rounded-full bg-secondary px-2 py-0.5 text-xs">{t(`schichtStatus.${s.status}`)}</span>
              </li>
            ))}
          </ul>
        )}
        <Link href="/hr/schichtplan" className="mt-3 inline-block text-xs underline">{t("dienstplan.title")}</Link>
      </section>

      {nachtrag && (
        <NachtragDialog
          personen={zeiten.personen.filter((p) => p.user_id === u.user_id)}
          zone={zone}
          objekte={objekte}
          onClose={() => setNachtrag(false)}
          onSaved={() => {
            setNachtrag(false);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

function Zahl({ label, wert, ton }: { label: string; wert: string; ton?: "warn" }) {
  return (
    <div className="rounded-xl bg-secondary/40 p-3 text-center">
      <p className={`font-display text-xl font-extrabold ${ton === "warn" ? "text-destructive" : ""}`}>{wert}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}
