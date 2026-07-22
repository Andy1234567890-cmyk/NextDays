"use client";

// Reisebüro-Kartei (OPERA-„Sales Account"-Fachmodell, UI nach dem
// CRM-Record-Page-Muster von Attio/HubSpot/Pipedrive): Identitäts-Kopf
// (Monogramm, Name, Status-/Typ-Badge, klickbare Quick-Links), KPI-Leiste
// mit den Konditionen, Tabs mit Zählern, Übersicht zweispaltig als
// gruppierte Karten (Kontakt & Adresse · Notizen | Konditionen ·
// Identifikatoren) statt flachem Feld-Grid.
import { Icon } from "@iconify/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { initialsOf } from "@/lib/initials";
import {
  type Agency,
  type AgencyContact,
  type AgencyContract,
  type AgencyKind,
  type Settlement,
  deleteAgency,
  updateAgency,
} from "@/lib/travel-agencies";

import { ContactsSection } from "./contacts-section";
import { ContractsSection } from "./contracts-section";

type Tab = "overview" | "contacts" | "contracts";
type PropertyRef = { id: string; title: string };

const KIND_ICONS: Record<AgencyKind, string> = {
  travel_agent: "ph:handshake",
  tour_operator: "ph:airplane-tilt",
  company: "ph:buildings",
  source: "ph:funnel",
};

const TAB_ICONS: Record<Tab, string> = {
  overview: "ph:identification-card",
  contacts: "ph:users",
  contracts: "ph:files",
};

export function AgencyDetail({
  agency: initial,
  properties,
  initialContacts,
  initialContracts,
}: {
  agency: Agency;
  properties: PropertyRef[];
  // null = Server-Laden fehlgeschlagen → Sektion lädt selbst, Tab ohne Zähler.
  initialContacts: AgencyContact[] | null;
  initialContracts: AgencyContract[] | null;
}) {
  const t = useTranslations("travelAgencies");
  const locale = useLocale();
  const router = useRouter();
  const [agency, setAgency] = useState(initial);
  const [tab, setTab] = useState<Tab>("overview");
  const [edit, setEdit] = useState(false);
  const [draft, setDraft] = useState<Agency>(initial);
  // Basis-Snapshot beim Betreten des Edit-Modus: der Save-Diff wird gegen
  // diese Basis gebildet, nicht gegen das (per Realtime weiterlaufende)
  // agency — sonst würden Fremdänderungen still zurückgedreht.
  const [editBase, setEditBase] = useState<Agency>(initial);

  // Realtime liefert über router.refresh() neue Props — useState(initial)
  // ignoriert die sonst nach dem Mount (Kartei bliebe stehen).
  useEffect(() => {
    setAgency(initial);
    setDraft((prev) => (edit ? prev : initial));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initial]);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // Für created_at/updated_at (echte Timestamps): lokaler Kalendertag —
  // UTC würde kurz nach Mitternacht „gestern" anzeigen. (Reine
  // YYYY-MM-DD-Strings werden dagegen überall UTC-fixiert formatiert.)
  const dateFmt = useMemo(
    () =>
      new Intl.DateTimeFormat(locale, {
        day: "2-digit", month: "2-digit", year: "numeric",
      }),
    [locale],
  );

  function onEnterEdit() {
    setEditBase(agency);
    setDraft(agency);
    setEdit(true);
  }

  function onSave() {
    setError(null);
    startTransition(async () => {
      // Nur den Diff senden (PATCH, exclude_unset im Backend) — gegen den
      // Edit-Basis-Snapshot, damit nur vom Nutzer berührte Felder wandern.
      const patch: Partial<Agency> = {};
      (Object.keys(draft) as (keyof Agency)[]).forEach((k) => {
        if (draft[k] !== editBase[k]) (patch as Record<string, unknown>)[k] = draft[k];
      });
      if (Object.keys(patch).length === 0) {
        setEdit(false);
        return;
      }
      const res = await updateAgency(agency.id, patch);
      if (res.ok) {
        setAgency(res.data);
        setDraft(res.data);
        setEdit(false);
      } else {
        setError(res.error);
      }
    });
  }

  function onDelete() {
    // Kaskadiert über Kontakte, Verträge und Preiszeilen — bestätigen lassen.
    if (!window.confirm(t("confirmDelete"))) return;
    startTransition(async () => {
      const res = await deleteAgency(agency.id);
      if (res.ok) router.push("/reisebueros");
      else setError(res.error);
    });
  }

  // Key-Value-Feld: im Lesemodus Wert, im Edit-Modus Input (gleiche Karte).
  const field = (
    key: keyof Agency,
    label: string,
    type: "text" | "number" = "text",
  ) => (
    <div className="flex min-w-0 flex-col gap-1">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      {edit ? (
        <Input
          type={type}
          value={draft[key] == null ? "" : String(draft[key])}
          onChange={(e) =>
            setDraft((d) => ({
              ...d,
              [key]:
                e.target.value === ""
                  ? null
                  : type === "number"
                    ? Number(e.target.value)
                    : e.target.value,
            }))
          }
        />
      ) : (
        <span className="min-h-6 truncate text-sm">
          {agency[key] == null || agency[key] === "" ? "—" : String(agency[key])}
          {key === "commission_pct" && agency[key] != null ? " %" : ""}
        </span>
      )}
    </div>
  );

  // Klickbarer Quick-Link im Kopf (nur wenn der Wert gepflegt ist).
  const quickLink = (icon: string, value: string | null, href?: string) =>
    value ? (
      <a
        href={href}
        target={href?.startsWith("http") ? "_blank" : undefined}
        rel="noreferrer"
        className="inline-flex min-w-0 items-center gap-1.5 text-sm text-muted-foreground transition hover:text-foreground"
      >
        <Icon icon={icon} className="size-4 shrink-0" />
        <span className="truncate">{value}</span>
      </a>
    ) : null;

  const kpis: { icon: string; label: string; value: string }[] = [
    {
      icon: "ph:percent",
      label: t("commission"),
      value: agency.commission_pct == null ? "—" : `${agency.commission_pct} %`,
    },
    {
      icon: "ph:arrows-left-right",
      label: t("settlement"),
      // Kurzform — die KPI-Karte hat keinen Platz für den Erklärsatz.
      value: agency.settlement ? t(`settlementShort_${agency.settlement}`) : "—",
    },
    {
      icon: "ph:calendar-check",
      label: t("paymentTerm"),
      value: agency.payment_term_days == null ? "—" : String(agency.payment_term_days),
    },
    {
      icon: "ph:coins",
      label: t("currency"),
      value: agency.currency ?? "—",
    },
  ];

  const tabs: { key: Tab; count: number | null }[] = [
    { key: "overview", count: null },
    { key: "contacts", count: initialContacts ? initialContacts.length : null },
    { key: "contracts", count: initialContracts ? initialContracts.length : null },
  ];

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-5 p-6">
      {/* Zurück zur Liste */}
      <Link
        href="/reisebueros"
        className="inline-flex items-center gap-1.5 self-start text-sm text-muted-foreground transition hover:text-foreground"
      >
        <Icon icon="ph:arrow-left" className="size-4" />
        {t("title")}
      </Link>

      {/* Identitäts-Kopf */}
      <header className="flex flex-wrap items-start gap-4">
        <span className="flex size-14 shrink-0 items-center justify-center rounded-full bg-primary/10 text-lg font-semibold text-primary">
          {initialsOf(agency.name) || (
            <Icon icon={KIND_ICONS[agency.kind]} className="size-6" />
          )}
        </span>
        {/* Mindestbreite: bei schmalen Screens brechen die Aktionen in die
            nächste Zeile um, statt den Namen zusammenzuquetschen. */}
        <div className="flex min-w-56 flex-1 flex-col gap-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="truncate text-2xl font-semibold">{agency.name}</h1>
            <span
              className={
                "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium " +
                (agency.is_active
                  ? "bg-success/15 text-success"
                  : "bg-muted text-muted-foreground")
              }
            >
              <span className="size-1.5 rounded-full bg-current" />
              {agency.is_active ? t("active") : t("inactive")}
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-2.5 py-0.5 text-xs font-medium text-secondary-foreground">
              <Icon icon={KIND_ICONS[agency.kind]} className="size-3.5" />
              {t(`kind_${agency.kind}`)}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            {quickLink("ph:envelope-simple", agency.email, `mailto:${agency.email}`)}
            {quickLink("ph:phone", agency.phone, `tel:${agency.phone}`)}
            {/* Ohne Schema würde der Browser die URL relativ zur App auflösen. */}
            {quickLink(
              "ph:globe",
              agency.website,
              agency.website
                ? agency.website.startsWith("http")
                  ? agency.website
                  : `https://${agency.website}`
                : undefined,
            )}
            {quickLink(
              "ph:map-pin",
              [agency.city, agency.country].filter(Boolean).join(", ") || null,
            )}
          </div>
        </div>
        {tab === "overview" && (
          edit ? (
            // Auf Mobile eigene Zeile, sonst quetschen die Buttons den Namen.
            <div className="flex w-full justify-end gap-2 sm:w-auto">
              <Button variant="outline" onClick={() => { setDraft(agency); setEdit(false); }}>
                {t("cancel")}
              </Button>
              <Button onClick={onSave} disabled={pending || !draft.name?.trim()}>
                {t("save")}
              </Button>
            </div>
          ) : (
            <Button variant="outline" onClick={onEnterEdit}>
              <Icon icon="ph:pencil-simple" className="size-4" />
              {t("edit")}
            </Button>
          )
        )}
      </header>

      {/* KPI-Leiste: die Konditionen des Partners auf einen Blick */}
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {kpis.map((kpi) => (
          <Card key={kpi.label} className="flex flex-row items-center gap-3 p-4">
            {/* Icon erst ab sm — auf Mobile braucht der Wert den Platz. */}
            <span className="hidden size-9 shrink-0 items-center justify-center rounded-full bg-secondary sm:flex">
              <Icon icon={kpi.icon} className="size-4.5 text-muted-foreground" />
            </span>
            <div className="flex min-w-0 flex-col">
              <span className="truncate text-xs text-muted-foreground">{kpi.label}</span>
              <span className="truncate text-base font-semibold">{kpi.value}</span>
            </div>
          </Card>
        ))}
      </section>

      {/* Tabs mit Zählern (kein overflow-auto: die -mb-px-Überlappung des
          Unterstrichs würde den Container sonst scrollbar machen) */}
      <nav role="tablist" className="flex flex-wrap gap-1 border-b border-border">
        {tabs.map(({ key, count }) => (
          <button
            key={key}
            type="button"
            role="tab"
            id={`ta-tab-${key}`}
            aria-controls={`ta-panel-${key}`}
            aria-selected={tab === key}
            onClick={() => setTab(key)}
            className={
              "-mb-px inline-flex shrink-0 items-center gap-2 rounded-t-(--radius) border-b-2 px-3 py-2.5 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring " +
              (tab === key
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground")
            }
          >
            <Icon icon={TAB_ICONS[key]} className="size-4" />
            {t(`tab_${key}`)}
            {count != null && (
              <span
                className={
                  "rounded-full px-2 py-0.5 text-xs tabular-nums " +
                  (tab === key
                    ? "bg-primary/10 text-primary"
                    : "bg-secondary text-muted-foreground")
                }
              >
                {count}
              </span>
            )}
          </button>
        ))}
      </nav>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {tab === "overview" && (
        <section
          role="tabpanel"
          id="ta-panel-overview"
          aria-labelledby="ta-tab-overview"
          className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]"
        >
          {/* Hauptspalte */}
          <div className="flex min-w-0 flex-col gap-4">
            <Card className="flex flex-col gap-4 p-5">
              <h2 className="flex items-center gap-2 text-sm font-semibold">
                <Icon icon="ph:address-book" className="size-4 text-muted-foreground" />
                {t("sectionContact")}
              </h2>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {field("email", t("email"))}
                {field("phone", t("phone"))}
                {field("website", t("website"))}
                {field("language", t("language"))}
                {field("address", t("address"))}
                {field("postal_code", t("postalCode"))}
                {field("city", t("city"))}
                {field("country", t("country"))}
              </div>
            </Card>

            <Card className="flex flex-col gap-4 p-5">
              <h2 className="flex items-center gap-2 text-sm font-semibold">
                <Icon icon="ph:note-pencil" className="size-4 text-muted-foreground" />
                {t("notes")}
              </h2>
              {edit ? (
                <Textarea
                  value={draft.notes ?? ""}
                  rows={3}
                  onChange={(e) => setDraft((d) => ({ ...d, notes: e.target.value || null }))}
                />
              ) : (
                <p className="whitespace-pre-wrap text-sm">
                  {agency.notes || <span className="text-muted-foreground">—</span>}
                </p>
              )}
            </Card>
          </div>

          {/* Seitenleiste */}
          <div className="flex min-w-0 flex-col gap-4">
            <Card className="flex flex-col gap-4 p-5">
              <h2 className="flex items-center gap-2 text-sm font-semibold">
                <Icon icon="ph:handshake" className="size-4 text-muted-foreground" />
                {t("sectionConditions")}
              </h2>
              <div className="grid grid-cols-1 gap-4">
                {field("commission_pct", t("commission"), "number")}
                <div className="flex min-w-0 flex-col gap-1">
                  <span className="text-xs font-medium text-muted-foreground">
                    {t("settlement")}
                  </span>
                  {edit ? (
                    <NativeSelect
                      value={draft.settlement ?? ""}
                      onChange={(e) =>
                        setDraft((d) => ({
                          ...d,
                          settlement: (e.target.value || null) as Settlement | null,
                        }))
                      }
                    >
                      <option value="">—</option>
                      <option value="hotel_collect">{t("settlement_hotel_collect")}</option>
                      <option value="agency_collect">{t("settlement_agency_collect")}</option>
                    </NativeSelect>
                  ) : (
                    <span className="min-h-6 text-sm">
                      {agency.settlement ? t(`settlement_${agency.settlement}`) : "—"}
                    </span>
                  )}
                </div>
                {field("payment_term_days", t("paymentTerm"), "number")}
                {field("currency", t("currency"))}
              </div>
            </Card>

            <Card className="flex flex-col gap-4 p-5">
              <h2 className="flex items-center gap-2 text-sm font-semibold">
                <Icon icon="ph:fingerprint" className="size-4 text-muted-foreground" />
                {t("sectionIdentifiers")}
              </h2>
              <div className="grid grid-cols-1 gap-4">
                <div className="flex min-w-0 flex-col gap-1">
                  <span className="text-xs font-medium text-muted-foreground">{t("kind")}</span>
                  {edit ? (
                    <NativeSelect
                      value={draft.kind}
                      onChange={(e) =>
                        setDraft((d) => ({ ...d, kind: e.target.value as AgencyKind }))
                      }
                    >
                      <option value="travel_agent">{t("kind_travel_agent")}</option>
                      <option value="tour_operator">{t("kind_tour_operator")}</option>
                      <option value="company">{t("kind_company")}</option>
                      <option value="source">{t("kind_source")}</option>
                    </NativeSelect>
                  ) : (
                    <span className="min-h-6 text-sm">{t(`kind_${agency.kind}`)}</span>
                  )}
                </div>
                {edit && field("name", t("name"))}
                {field("iata_number", t("iata"))}
                {field("vat_id", t("vatId"))}
              </div>
            </Card>

            {edit ? (
              <Card className="flex flex-col gap-3 p-5">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={draft.is_active}
                    onChange={(e) => setDraft((d) => ({ ...d, is_active: e.target.checked }))}
                    className="size-4 accent-primary"
                  />
                  {t("active")}
                </label>
                <Button
                  variant="outline"
                  onClick={onDelete}
                  disabled={pending}
                  className="self-start text-destructive"
                >
                  <Icon icon="ph:trash" className="size-4" />
                  {t("delete")}
                </Button>
              </Card>
            ) : (
              (agency.created_at || agency.updated_at) && (
                <p className="px-1 text-xs text-muted-foreground">
                  {agency.created_at &&
                    `${t("createdAt")}: ${dateFmt.format(new Date(agency.created_at))}`}
                  {agency.created_at && agency.updated_at && " · "}
                  {agency.updated_at &&
                    `${t("updatedAt")}: ${dateFmt.format(new Date(agency.updated_at))}`}
                </p>
              )
            )}
          </div>
        </section>
      )}

      {tab === "contacts" && (
        <div role="tabpanel" id="ta-panel-contacts" aria-labelledby="ta-tab-contacts">
          <ContactsSection agencyId={agency.id} initialContacts={initialContacts} />
        </div>
      )}

      {tab === "contracts" && (
        <div role="tabpanel" id="ta-panel-contracts" aria-labelledby="ta-tab-contracts">
          <ContractsSection
            agency={agency}
            properties={properties}
            initialContracts={initialContracts}
          />
        </div>
      )}
    </div>
  );
}
