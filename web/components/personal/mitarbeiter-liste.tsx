"use client";

// Personal → Mitarbeitende: Kartei-Übersicht nach der Taskilo-Vorlage —
// Kennzahl-Kacheln (Gesamt, Aktiv, Extern, Fällig, Kosten/Monat je Währung),
// Suche + Filter, Karten-Grid mit Avatar, „Mitarbeiter hinzufügen" (Nutzer-
// Wizard mit Rolle vorbelegt) und CSV-Export.
//
// Die Leitung sieht Personalnummer, Eintritt, Stunden, Kosten und fällige
// Dokumente; die Schichtleitung nur Name, Rolle und Arbeitsbereiche (§4.3) —
// der Server liefert die Felder dann als null.
//
// Kein Realtime: `users` und `personal_akten` sind für authenticated bewusst
// gesperrt (Wurzel 6). Eigene Änderungen laufen über die Akte-Seite zurück.
import { Icon } from "@iconify/react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { useMemo, useState } from "react";

import { Avatar, AvatarFallback, AvatarImage } from "@nextdays/ui/avatar";
import { Button } from "@nextdays/ui/button";
import { EmptyState } from "@nextdays/ui/empty-state";
import { Input } from "@nextdays/ui/input";
import { Segmented } from "@nextdays/ui/segmented";
import { UserWizard } from "@/components/konto/user-wizard";
import { formatCurrency } from "@/lib/currency";
import { initialsOf } from "@/lib/initials";
import type { MitarbeiterListe as Liste, MitarbeiterListItem } from "@/lib/personal-typen";
import { formatDate } from "@/lib/utils";

type Filter = "alle" | "aktiv" | "extern" | "faellig" | "gesperrt";
type Ansicht = "karten" | "liste";

export function MitarbeiterListe({
  daten,
  loadError,
  kannAkte,
  tenantCountry,
}: {
  daten: Liste;
  loadError: string | null;
  /** manage_personal: Akte öffnen, anlegen, exportieren — sonst nur die Liste. */
  kannAkte: boolean;
  tenantCountry: string | null;
}) {
  const t = useTranslations("personal");
  const tRoles = useTranslations("account.roles");
  const locale = useLocale();
  const [suche, setSuche] = useState("");
  const [filter, setFilter] = useState<Filter>("alle");
  const [ansicht, setAnsicht] = useState<Ansicht>("karten");
  const items = daten.items;

  const gefiltert = useMemo(() => {
    const s = suche.trim().toLowerCase();
    return items.filter((m) => {
      if (filter === "aktiv" && !m.is_active) return false;
      if (filter === "gesperrt" && m.is_active) return false;
      if (filter === "extern" && m.beschaeftigungsart !== "extern") return false;
      if (filter === "faellig" && m.dokumente_faellig === 0) return false;
      if (!s) return true;
      return [m.full_name, m.email, m.position, m.employee_number, m.firma_name, ...m.arbeitsbereiche]
        .filter(Boolean)
        .some((w) => String(w).toLowerCase().includes(s));
    });
  }, [items, suche, filter]);

  const faellig = items.reduce((n, m) => n + m.dokumente_faellig, 0);
  const aktiv = items.filter((m) => m.is_active).length;
  const extern = items.filter((m) => m.beschaeftigungsart === "extern").length;

  function exportieren() {
    const kopf = ["Name", "E-Mail", "Telefon", "Rolle", "Position", "Personalnummer", "Beschaeftigungsart", "Fremdfirma", "Eintritt", "Austritt", "Wochenstunden", "Arbeitsbereiche", "Status"];
    const zeilen = gefiltert.map((m) => [
      m.full_name ?? "",
      m.email ?? "",
      m.phone ?? "",
      m.role,
      m.position ?? "",
      m.employee_number ?? "",
      m.beschaeftigungsart ?? "",
      m.firma_name ?? "",
      m.eintritt ?? "",
      m.austritt ?? "",
      m.wochenstunden?.toString() ?? "",
      m.arbeitsbereiche.join("; "),
      m.is_active ? "aktiv" : "gesperrt",
    ]);
    const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;
    const csv = [kopf, ...zeilen].map((z) => z.map(esc).join(";")).join("\r\n");
    const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `mitarbeitende-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="flex flex-1 flex-col gap-4 pb-20">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-extrabold">{t("mitarbeiter.title")}</h1>
          <p className="text-sm text-muted-foreground">{t("mitarbeiter.subtitle", { anzahl: items.length })}</p>
        </div>
        {kannAkte && (
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" className="rounded-full" onClick={exportieren} disabled={gefiltert.length === 0}>
              <Icon icon="ph:download-simple" className="mr-1 size-4" />
              {t("mitarbeiter.exportieren")}
            </Button>
            <UserWizard
              tenantCountry={tenantCountry}
              defaultRole="staff"
              roleOptions={["staff", "cleaner", "shift_lead"]}
              erfolgLink={(id) => ({ href: `/hr/mitarbeiter/${id}`, label: t("mitarbeiter.zurAkte") })}
              trigger={
                <Button className="rounded-full">
                  <Icon icon="ph:user-plus" className="mr-1 size-4" />
                  {t("mitarbeiter.hinzufuegen")}
                </Button>
              }
            />
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-5">
        <Kachel icon="ph:users" label={t("mitarbeiter.kachelGesamt")} wert={String(items.length)} />
        <Kachel icon="ph:user-check" label={t("mitarbeiter.kachelAktiv")} wert={String(aktiv)} />
        <Kachel icon="ph:buildings" label={t("mitarbeiter.kachelExtern")} wert={String(extern)} />
        <Kachel icon="ph:warning-circle" label={t("mitarbeiter.kachelFaellig")} wert={String(faellig)} ton={faellig > 0 ? "warn" : undefined} />
        {kannAkte && (
          <Kachel
            icon="ph:coins"
            label={t("mitarbeiter.kachelKosten")}
            wert={daten.kosten_monat.length === 0 ? "—" : daten.kosten_monat.map((k) => formatCurrency(k.minor / 100, k.currency, locale, 0)).join(" · ")}
            sub={daten.kosten_hinweise.length > 0 ? t("mitarbeiter.kostenOhne", { anzahl: daten.kosten_hinweise.length }) : daten.kosten_monat.length > 0 ? t("mitarbeiter.kostenPersonen", { anzahl: daten.kosten_monat.reduce((n, k) => n + k.personen, 0) }) : undefined}
            ton={daten.kosten_hinweise.length > 0 ? "warn" : undefined}
          />
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <Segmented<Filter>
          value={filter}
          onChange={setFilter}
          options={[
            { value: "alle", label: t("filter.alle") },
            { value: "aktiv", label: t("filter.aktiv") },
            { value: "extern", label: t("filter.extern") },
            { value: "faellig", label: t("filter.faellig", { anzahl: faellig }) },
            { value: "gesperrt", label: t("filter.gesperrt") },
          ]}
        />
        <div className="flex items-center gap-2">
          <Input value={suche} onChange={(e) => setSuche(e.target.value)} placeholder={t("mitarbeiter.suche")} className="w-56 rounded-full" />
          <Segmented<Ansicht>
            value={ansicht}
            onChange={setAnsicht}
            options={[
              { value: "karten", label: t("mitarbeiter.karten") },
              { value: "liste", label: t("mitarbeiter.liste") },
            ]}
          />
        </div>
      </div>

      {loadError && (
        <p className="rounded-2xl border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{loadError}</p>
      )}

      {gefiltert.length === 0 ? (
        <EmptyState icon="ph:identification-badge" titel={t("mitarbeiter.leerTitle")} text={t("mitarbeiter.leerText")} />
      ) : ansicht === "karten" ? (
        <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {gefiltert.map((m) => (
            <li key={m.user_id}>
              <Karte m={m} kannAkte={kannAkte} locale={locale} rolle={tRoles(m.role)} />
            </li>
          ))}
        </ul>
      ) : (
        <ul className="divide-y overflow-hidden rounded-2xl border bg-card">
          {gefiltert.map((m) => (
            <li key={m.user_id}>
              <Zeile m={m} kannAkte={kannAkte} locale={locale} rolle={tRoles(m.role)} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Kachel({ icon, label, wert, sub, ton }: { icon: string; label: string; wert: string; sub?: string; ton?: "warn" }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border bg-card p-3">
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

function Badges({ m, rolle }: { m: MitarbeiterListItem; rolle: string }) {
  const t = useTranslations("personal");
  return (
    <>
      <span className="rounded-full bg-secondary px-2 py-0.5 text-xs">{rolle}</span>
      {m.beschaeftigungsart && (
        <span className="rounded-full border px-2 py-0.5 text-xs text-muted-foreground">
          {t(`beschaeftigungsart.${m.beschaeftigungsart}`)}
          {m.firma_name ? ` · ${m.firma_name}` : ""}
        </span>
      )}
      {!m.is_active && <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-xs text-destructive">{t("mitarbeiter.gesperrt")}</span>}
    </>
  );
}

function Karte({ m, kannAkte, locale, rolle }: { m: MitarbeiterListItem; kannAkte: boolean; locale: string; rolle: string }) {
  const t = useTranslations("personal");
  const inhalt = (
    <div className="flex h-full flex-col gap-3 rounded-2xl border bg-card p-4 transition-shadow hover:shadow-md">
      <div className="flex items-start gap-3">
        <Avatar className="size-12">
          <AvatarImage src={m.avatar_url ?? undefined} alt="" />
          <AvatarFallback>{initialsOf(m.full_name ?? m.email ?? "?")}</AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <div className="truncate font-display text-lg font-extrabold">{m.full_name ?? m.email ?? "—"}</div>
          <div className="truncate text-sm text-muted-foreground">{m.position ?? rolle}</div>
        </div>
        {m.dokumente_faellig > 0 && (
          <span className="flex items-center gap-1 text-xs text-amber-700" title={t("mitarbeiter.dokumenteFaellig", { anzahl: m.dokumente_faellig })}>
            <Icon icon="ph:warning-circle" className="size-4" />
            {m.dokumente_faellig}
          </span>
        )}
      </div>
      <div className="flex flex-wrap gap-1.5">
        <Badges m={m} rolle={rolle} />
      </div>
      <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-sm">
        {m.employee_number && <Paar k={t("akte.felder.employee_number")} v={`#${m.employee_number}`} />}
        {m.eintritt && <Paar k={t("akte.felder.eintritt")} v={formatDate(m.eintritt, locale)} />}
        {m.wochenstunden !== null && <Paar k={t("akte.felder.wochenstunden")} v={`${m.wochenstunden} h`} />}
        {m.kosten_monat_minor !== null && m.kosten_currency && (
          <Paar k={t("mitarbeiter.kachelKosten")} v={formatCurrency(m.kosten_monat_minor / 100, m.kosten_currency, locale, 0)} />
        )}
        {m.arbeitsbereiche.length > 0 && <Paar k={t("arbeitsbereich")} v={m.arbeitsbereiche.join(" · ")} breit />}
      </dl>
      {kannAkte && !m.akte_vorhanden && <p className="text-xs text-muted-foreground">{t("mitarbeiter.ohneAkte")}</p>}
    </div>
  );
  return kannAkte ? <Link href={`/hr/mitarbeiter/${m.user_id}`} className="block h-full">{inhalt}</Link> : inhalt;
}

function Paar({ k, v, breit }: { k: string; v: string; breit?: boolean }) {
  return (
    <div className={breit ? "col-span-2" : ""}>
      <dt className="text-xs text-muted-foreground">{k}</dt>
      <dd className="truncate font-medium">{v}</dd>
    </div>
  );
}

function Zeile({ m, kannAkte, locale, rolle }: { m: MitarbeiterListItem; kannAkte: boolean; locale: string; rolle: string }) {
  const t = useTranslations("personal");
  const inhalt = (
    <>
      <Avatar className="size-10">
        <AvatarImage src={m.avatar_url ?? undefined} alt="" />
        <AvatarFallback>{initialsOf(m.full_name ?? m.email ?? "?")}</AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="truncate font-medium">{m.full_name ?? m.email ?? "—"}</span>
          <Badges m={m} rolle={rolle} />
        </div>
        <div className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
          {m.position && <span>{m.position}</span>}
          {m.employee_number && <span>#{m.employee_number}</span>}
          {m.eintritt && <span>{t("mitarbeiter.seit", { datum: formatDate(m.eintritt, locale) })}</span>}
          {m.wochenstunden !== null && <span>{t("mitarbeiter.stundenWoche", { h: m.wochenstunden })}</span>}
          {m.arbeitsbereiche.length > 0 && <span>{m.arbeitsbereiche.join(" · ")}</span>}
        </div>
      </div>
      <div className="flex items-center gap-3 text-sm">
        {m.dokumente_faellig > 0 && (
          <span className="flex items-center gap-1 text-amber-700">
            <Icon icon="ph:warning-circle" className="size-4" />
            {t("mitarbeiter.dokumenteFaellig", { anzahl: m.dokumente_faellig })}
          </span>
        )}
        {kannAkte && !m.akte_vorhanden && <span className="text-xs text-muted-foreground">{t("mitarbeiter.ohneAkte")}</span>}
        {kannAkte && <Icon icon="ph:caret-right" className="size-4 text-muted-foreground" />}
      </div>
    </>
  );
  return kannAkte ? (
    <Link href={`/hr/mitarbeiter/${m.user_id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-secondary/50">{inhalt}</Link>
  ) : (
    <div className="flex items-center gap-3 px-4 py-3">{inhalt}</div>
  );
}
