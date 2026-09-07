"use client";

// Leads: Board (eine Spalte je Status) ODER Tabelle, Filter nach Status/
// Quelle/Zuständigem, Suche, Neuanlage. Detail im Sheet (lead-sheet.tsx).
// Die Liste kommt vom Server (Server-Component-Page) und wird nach eigenen
// Aktionen lokal nachgezogen; fremde Änderungen bringt RealtimeRefresh.
import { Icon } from "@iconify/react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";

import { Button } from "@nextdays/ui/button";
import { Input } from "@nextdays/ui/input";
import { NativeSelect } from "@nextdays/ui/native-select";
import { Segmented } from "@nextdays/ui/segmented";
import type { TenantUser } from "@/lib/account";
import {
  LEAD_SOURCES,
  LEAD_STATUSES,
  type Lead,
  type LeadSource,
  type LeadStatus,
} from "@/lib/crm-meta";

import { adresseZeile } from "./adresse-felder";
import { LeadSheet } from "./lead-sheet";

type Ansicht = "board" | "tabelle";

export function LeadsBoard({
  initial,
  total,
  team,
  accommodationType,
}: {
  initial: Lead[];
  total: number;
  team: TenantUser[];
  accommodationType: "vacation_rental" | "hotel";
}) {
  const t = useTranslations("crm");
  const locale = useLocale();
  const router = useRouter();
  const [leads, setLeads] = useState<Lead[]>(initial);
  const [ansicht, setAnsicht] = useState<Ansicht>("board");
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState<LeadStatus | "">("");
  const [quelleFilter, setQuelleFilter] = useState<LeadSource | "">("");
  const [zustaendigFilter, setZustaendigFilter] = useState("");
  // null = Sheet geschlossen, "neu" = Neuanlage, sonst der Lead.
  const [offen, setOffen] = useState<Lead | "neu" | null>(null);

  const gefiltert = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return leads.filter(
      (l) =>
        (!statusFilter || l.status === statusFilter) &&
        (!quelleFilter || l.lead_source === quelleFilter) &&
        (!zustaendigFilter || l.assigned_user_id === zustaendigFilter) &&
        (!needle ||
          l.name.toLowerCase().includes(needle) ||
          (l.email ?? "").toLowerCase().includes(needle) ||
          (l.city ?? "").toLowerCase().includes(needle) ||
          (l.object_city ?? "").toLowerCase().includes(needle)),
    );
  }, [leads, q, statusFilter, quelleFilter, zustaendigFilter]);

  const spalten = useMemo(
    () =>
      LEAD_STATUSES.map((s) => ({
        status: s,
        leads: gefiltert.filter((l) => l.status === s),
      })),
    [gefiltert],
  );

  const nameVon = (userId: string | null) => {
    if (!userId) return null;
    const u = team.find((x) => x.user_id === userId);
    return u?.full_name || u?.email || null;
  };

  function gespeichert(lead: Lead) {
    setLeads((alt) => {
      const idx = alt.findIndex((l) => l.id === lead.id);
      if (idx < 0) return [lead, ...alt];
      const kopie = [...alt];
      kopie[idx] = lead;
      return kopie;
    });
    setOffen(lead);
    router.refresh();
  }

  function geloescht(id: string) {
    setLeads((alt) => alt.filter((l) => l.id !== id));
    setOffen(null);
    router.refresh();
  }

  const datum = (iso: string | null) =>
    iso ? new Date(iso).toLocaleDateString(locale, { dateStyle: "medium" }) : "—";

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t("leads.suche")}
          className="max-w-xs"
        />
        <NativeSelect
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as LeadStatus | "")}
        >
          <option value="">{t("leads.alleStatus")}</option>
          {LEAD_STATUSES.map((s) => (
            <option key={s} value={s}>
              {t(`leads.status_${s}`)}
            </option>
          ))}
        </NativeSelect>
        <NativeSelect
          value={quelleFilter}
          onChange={(e) => setQuelleFilter(e.target.value as LeadSource | "")}
        >
          <option value="">{t("leads.alleQuellen")}</option>
          {LEAD_SOURCES.map((s) => (
            <option key={s} value={s}>
              {t(`leads.quelle_${s}`)}
            </option>
          ))}
        </NativeSelect>
        <NativeSelect value={zustaendigFilter} onChange={(e) => setZustaendigFilter(e.target.value)}>
          <option value="">{t("leads.alleZustaendigen")}</option>
          {team.map((u) => (
            <option key={u.user_id} value={u.user_id}>
              {u.full_name || u.email || u.user_id}
            </option>
          ))}
        </NativeSelect>
        <div className="ml-auto flex items-center gap-3">
          <Segmented<Ansicht>
            value={ansicht}
            onChange={setAnsicht}
            options={[
              { value: "board", label: t("leads.ansichtBoard") },
              { value: "tabelle", label: t("leads.ansichtTabelle") },
            ]}
          />
          <Button onClick={() => setOffen("neu")}>
            <Icon icon="ph:plus" className="size-4" />
            {t("leads.neu")}
          </Button>
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        {t("leads.anzahl", { gezeigt: gefiltert.length, gesamt: total })}
      </p>

      {leads.length === 0 ? (
        <p className="rounded-(--radius) border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          {t("leads.leer")}
        </p>
      ) : ansicht === "board" ? (
        <div className="overflow-x-auto pb-2">
          <div className="grid min-w-[70rem] grid-cols-7 gap-3">
            {spalten.map((sp) => (
              <div key={sp.status} className="flex flex-col gap-2">
                <div className="flex items-center justify-between rounded-(--radius) bg-secondary px-3 py-2">
                  <span className="text-xs font-semibold">{t(`leads.status_${sp.status}`)}</span>
                  <span className="text-xs text-muted-foreground">{sp.leads.length}</span>
                </div>
                {sp.leads.map((l) => (
                  <button
                    key={l.id}
                    type="button"
                    onClick={() => setOffen(l)}
                    className="flex flex-col gap-1 rounded-(--radius) border border-border bg-card p-3 text-left text-sm shadow-sm transition-colors hover:bg-secondary/60"
                  >
                    <span className="font-medium">{l.name}</span>
                    {(l.object_city || l.city) && (
                      <span className="text-xs text-muted-foreground">
                        <Icon icon="ph:map-pin" className="mr-1 inline size-3" />
                        {l.object_city || l.city}
                      </span>
                    )}
                    <span className="flex flex-wrap gap-1 text-xs text-muted-foreground">
                      {l.lead_source && (
                        <span className="rounded-full bg-secondary px-2 py-0.5">
                          {t(`leads.quelle_${l.lead_source}`)}
                        </span>
                      )}
                      {l.object_max_guests && (
                        <span className="rounded-full bg-secondary px-2 py-0.5">
                          <Icon icon="ph:users" className="mr-1 inline size-3" />
                          {l.object_max_guests}
                        </span>
                      )}
                    </span>
                    {l.next_action_at && (
                      <span className="text-xs text-muted-foreground">
                        <Icon icon="ph:bell" className="mr-1 inline size-3" />
                        {datum(l.next_action_at)}
                      </span>
                    )}
                    {nameVon(l.assigned_user_id) && (
                      <span className="text-xs text-muted-foreground">
                        <Icon icon="ph:user" className="mr-1 inline size-3" />
                        {nameVon(l.assigned_user_id)}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-(--radius) border border-border">
          <table className="w-full text-sm">
            <thead className="bg-secondary text-left text-xs text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">{t("leads.name")}</th>
                <th className="px-3 py-2 font-medium">{t("leads.status")}</th>
                <th className="px-3 py-2 font-medium">{t("leads.quelle")}</th>
                <th className="px-3 py-2 font-medium">{t("leads.objektEckdaten")}</th>
                <th className="px-3 py-2 font-medium">{t("leads.zustaendig")}</th>
                <th className="px-3 py-2 font-medium">{t("leads.naechsterSchritt")}</th>
                <th className="px-3 py-2 font-medium">{t("leads.angelegtAm")}</th>
              </tr>
            </thead>
            <tbody>
              {gefiltert.map((l) => (
                <tr
                  key={l.id}
                  onClick={() => setOffen(l)}
                  className="cursor-pointer border-t border-border hover:bg-secondary/60"
                >
                  <td className="px-3 py-2">
                    <div className="font-medium">{l.name}</div>
                    <div className="text-xs text-muted-foreground">{l.email ?? l.phone ?? ""}</div>
                  </td>
                  <td className="px-3 py-2">{t(`leads.status_${l.status}`)}</td>
                  <td className="px-3 py-2">{l.lead_source ? t(`leads.quelle_${l.lead_source}`) : "—"}</td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">
                    {adresseZeile({
                      street: l.object_street,
                      house_number: l.object_house_number,
                      postal_code: l.object_postal_code,
                      city: l.object_city,
                      country: l.object_country,
                    }) ?? l.object_address ?? "—"}
                    {(l.object_sqm || l.object_max_guests) && (
                      <div>
                        {l.object_sqm ? `${l.object_sqm} m²` : ""}
                        {l.object_sqm && l.object_max_guests ? " · " : ""}
                        {l.object_max_guests ? t("leads.personen", { n: l.object_max_guests }) : ""}
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-2">{nameVon(l.assigned_user_id) ?? "—"}</td>
                  <td className="px-3 py-2">{datum(l.next_action_at)}</td>
                  <td className="px-3 py-2">{datum(l.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {offen !== null && (
        <LeadSheet
          lead={offen === "neu" ? null : offen}
          team={team}
          accommodationType={accommodationType}
          onClose={() => setOffen(null)}
          onSaved={gespeichert}
          onDeleted={geloescht}
        />
      )}
    </div>
  );
}
