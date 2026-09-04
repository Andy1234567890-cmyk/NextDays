"use client";

// Kopf der Personalakte nach der Taskilo-Kartei: Avatar, Name, Rolle,
// Position, Kontakt, Zugangs-Badge — darunter die Kurzinfo-Karten. Alle Werte
// kommen aus EINER Abfrage (`/mitarbeiter/{id}/uebersicht`); was der Server
// für die Rolle nicht freigibt, kommt als null und wird nicht gezeigt.
import { Icon } from "@iconify/react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";

import { Avatar, AvatarFallback, AvatarImage } from "@nextdays/ui/avatar";
import { formatCurrency } from "@/lib/currency";
import { initialsOf } from "@/lib/initials";
import type { Akte, PersonUebersicht } from "@/lib/personal-typen";
import { stunden } from "@/lib/personal-typen";
import { formatDate } from "@/lib/utils";

export function AkteKopf({
  u,
  akte,
  kannAkte,
}: {
  u: PersonUebersicht;
  akte: Akte;
  kannAkte: boolean;
}) {
  const t = useTranslations("personal");
  const tRoles = useTranslations("account.roles");
  const locale = useLocale();
  const name = u.full_name ?? u.email ?? "—";
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-4">
          <Link href="/hr/mitarbeiter" aria-label={t("mitarbeiter.title")} className="mt-1 flex size-8 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-secondary hover:text-foreground">
            <Icon icon="ph:caret-left" className="size-5" />
          </Link>
          <Avatar className="size-16">
            <AvatarImage src={u.avatar_url ?? undefined} alt="" />
            <AvatarFallback className="text-xl">{initialsOf(name)}</AvatarFallback>
          </Avatar>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="font-display text-3xl font-extrabold">{name}</h1>
              <span className={`rounded-full px-2 py-0.5 text-xs ${u.is_active ? "bg-emerald-100 text-emerald-800" : "bg-destructive/10 text-destructive"}`}>
                {u.is_active ? t("kartei.aktiv") : t("mitarbeiter.gesperrt")}
              </span>
              {u.faellig > 0 && (
                <span className="flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-800">
                  <Icon icon="ph:warning-circle" className="size-3.5" />
                  {t("kartei.faellig", { anzahl: u.faellig })}
                </span>
              )}
            </div>
            <p className="text-sm text-muted-foreground">
              {tRoles(u.role)}
              {akte.position ? ` · ${akte.position}` : ""}
              {akte.beschaeftigungsart ? ` · ${t(`beschaeftigungsart.${akte.beschaeftigungsart}`)}` : ""}
              {akte.firma_name ? ` · ${akte.firma_name}` : ""}
              {akte.employee_number ? ` · #${akte.employee_number}` : ""}
            </p>
            <div className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-sm text-muted-foreground">
              {u.email && (
                <a href={`mailto:${u.email}`} className="flex items-center gap-1 hover:underline">
                  <Icon icon="ph:envelope-simple" className="size-4" />
                  {u.email}
                </a>
              )}
              {u.phone && (
                <a href={`tel:${u.phone}`} className="flex items-center gap-1 hover:underline">
                  <Icon icon="ph:phone" className="size-4" />
                  {u.phone}
                </a>
              )}
            </div>
          </div>
        </div>
        {kannAkte && (
          <Link href={`/konto/nutzer/${u.user_id}`} className="text-sm underline">
            {t("akte.zumKonto")}
          </Link>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Karte icon="ph:calendar-check" label={t("akte.felder.eintritt")} wert={akte.eintritt ? formatDate(akte.eintritt, locale) : "—"} sub={akte.probezeit_bis ? t("kartei.probezeitBis", { datum: formatDate(akte.probezeit_bis, locale) }) : undefined} />
        <Karte
          icon="ph:clock"
          label={t("kartei.monatStunden")}
          wert={`${stunden(u.monat_ist_minuten)} h`}
          sub={
            u.monat_soll_minuten !== null
              ? t("kartei.sollPlan", { soll: stunden(u.monat_soll_minuten), plan: stunden(u.monat_plan_minuten) })
              : t("kartei.plan", { plan: stunden(u.monat_plan_minuten) })
          }
        />
        <Karte
          icon="ph:scales"
          label={t("akte.arbeitszeitkonto")}
          wert={u.azk_saldo_minuten === null ? "—" : `${stunden(u.azk_saldo_minuten)} h`}
          ton={u.azk_saldo_minuten !== null && u.azk_saldo_minuten < 0 ? "warn" : undefined}
        />
        <Karte
          icon="ph:sun-horizon"
          label={t("kartei.urlaub")}
          wert={u.urlaub_rest !== null ? String(u.urlaub_rest) : u.urlaub_anspruch !== null ? String(u.urlaub_anspruch) : "—"}
          sub={u.urlaub_rest !== null ? t("urlaub.rest") : u.urlaub_anspruch !== null ? t("urlaub.anspruch") : undefined}
        />
        <Karte
          icon="ph:calendar-blank"
          label={t("kartei.naechsteSchicht")}
          wert={u.kommende_schichten[0] ? formatDate(u.kommende_schichten[0].datum, locale) : "—"}
          sub={u.kommende_schichten[0]?.property_title ?? (u.offene_antraege > 0 ? t("kartei.offeneAntraege", { anzahl: u.offene_antraege }) : undefined)}
        />
        {kannAkte && (
          <Karte
            icon="ph:coins"
            label={t("kartei.kostenMonat")}
            wert={u.kosten_monat_minor !== null && u.kosten_currency ? formatCurrency(u.kosten_monat_minor / 100, u.kosten_currency, locale) : "—"}
            sub={u.kosten_hinweis ? t(`kartei.kostenHinweis.${u.kosten_hinweis}`) : akte.arbeitgeber_aufschlag_pct !== null ? t("kartei.inklAufschlag", { pct: akte.arbeitgeber_aufschlag_pct }) : undefined}
            ton={u.kosten_hinweis ? "warn" : undefined}
          />
        )}
      </div>
    </div>
  );
}

function Karte({ icon, label, wert, sub, ton }: { icon: string; label: string; wert: string; sub?: string; ton?: "warn" }) {
  return (
    <div className="flex items-start gap-3 rounded-2xl border bg-card p-3">
      <span className={`flex size-9 shrink-0 items-center justify-center rounded-full ${ton === "warn" ? "bg-amber-100 text-amber-800" : "bg-secondary text-muted-foreground"}`}>
        <Icon icon={icon} className="size-5" />
      </span>
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="truncate font-display text-lg font-extrabold">{wert}</p>
        {sub && <p className="truncate text-xs text-muted-foreground">{sub}</p>}
      </div>
    </div>
  );
}
