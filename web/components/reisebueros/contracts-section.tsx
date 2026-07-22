"use client";

// Verträge & Preise der Reisebüro-Kartei: Verträge NACH JAHREN gruppiert
// (Accordion, neuestes Jahr offen; Jahr = Jahr von valid_from), Status
// (aktiv/geplant/abgelaufen) wird aus der Gültigkeit BERECHNET, nie gepflegt.
// Vertragskarte im Record-Detail-Muster: Titel + Status-/Art-Badge, Meta als
// Key-Value-Grid (Gültigkeit · Kommission · Release · Dokument), Preisliste
// als Tabelle (Saison × Objekt × Preis/Nacht, Netto/Brutto, Min-Stay) in der
// Vertragswährung (aus den Daten — kein Währungs-Hardcode).
import { Icon } from "@iconify/react";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";

import { Button } from "@nextdays/ui/button";
import { Card } from "@nextdays/ui/card";
import { Input } from "@nextdays/ui/input";
import { NativeSelect } from "@nextdays/ui/native-select";
import {
  type Agency,
  type AgencyContract,
  type AgencyRate,
  type ContractKind,
  type RateBasis,
  addAgencyContract,
  addContractRate,
  contractFileUrl,
  deleteAgencyContract,
  deleteContractRate,
  listAgencyContracts,
  listContractRates,
  uploadContractFile,
} from "@/lib/travel-agencies";
import { todayIso } from "@/lib/dates";
import { useRealtime } from "@/lib/use-realtime";

type PropertyRef = { id: string; title: string };

function yearOf(c: AgencyContract): number {
  return parseInt(c.valid_from.slice(0, 4), 10);
}

export function ContractsSection({
  agency,
  properties,
  initialContracts,
}: {
  agency: Agency;
  properties: PropertyRef[];
  // null = Server-Laden fehlgeschlagen → hier selbst laden + Fehler zeigen.
  initialContracts: AgencyContract[] | null;
}) {
  const t = useTranslations("travelAgencies");
  const [contracts, setContracts] = useState<AgencyContract[]>(initialContracts ?? []);
  // Neuestes Jahr initial offen; bewusst zugeklappte Accordions dürfen ein
  // Realtime-Reload nicht wieder öffnen (deshalb einmalig, nicht abgeleitet).
  const [openYears, setOpenYears] = useState<Set<number>>(
    () =>
      new Set(
        initialContracts && initialContracts.length
          ? [Math.max(...initialContracts.map(yearOf))]
          : [],
      ),
  );
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const openedInitially = useRef(Boolean(initialContracts && initialContracts.length));
  const load = useCallback(() => {
    startTransition(async () => {
      const res = await listAgencyContracts(agency.id);
      if (res.ok) {
        setContracts(res.data.items);
        const years = res.data.items.map(yearOf);
        if (years.length && !openedInitially.current) {
          openedInitially.current = true;
          setOpenYears(new Set([Math.max(...years)]));
        }
      } else {
        setError(res.error);
      }
    });
  }, [agency.id]);

  // Nur nachladen, wenn der Server nichts liefern konnte.
  useEffect(() => {
    if (initialContracts == null) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [load]);
  // RealtimeRefresh (page-level) liefert frische Props — ohne Sync bliebe
  // die Liste stale, wenn das eigene WebSocket-Event verpasst wurde
  // (Section war unmounted) oder load() fehlschlug. openYears bleibt
  // unberührt (zugeklappte Jahre bleiben zu).
  useEffect(() => {
    if (initialContracts != null) setContracts(initialContracts);
  }, [initialContracts]);
  // Live: Verträge + Preiszeilen per WebSocket.
  useRealtime({ table: "travel_agency_contracts", onChange: load });

  const byYear = useMemo(() => {
    const groups = new Map<number, AgencyContract[]>();
    for (const c of contracts) {
      const year = yearOf(c);
      groups.set(year, [...(groups.get(year) ?? []), c]);
    }
    return [...groups.entries()].sort((a, b) => b[0] - a[0]);
  }, [contracts]);

  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">{t("contractsHint")}</p>
        <Button onClick={() => setShowForm((v) => !v)}>
          <Icon icon="ph:plus" className="size-4" />
          {t("newContract")}
        </Button>
      </div>

      {showForm && (
        <NewContractForm
          agency={agency}
          onDone={(created) => {
            setShowForm(false);
            // Das Jahr des neuen Vertrags aufklappen — sonst verschwindet
            // er unsichtbar in einer zugeklappten/neuen Jahresgruppe.
            setOpenYears((prev) => new Set(prev).add(yearOf(created)));
            openedInitially.current = true;
            load();
          }}
        />
      )}
      {error && <p className="text-sm text-destructive">{error}</p>}

      {byYear.length === 0 && !showForm ? (
        <p className="rounded-(--radius) border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          {t("noContracts")}
        </p>
      ) : (
        byYear.map(([year, items]) => {
          const open = openYears.has(year);
          const activeCount = items.filter((c) => contractStatus(c) === "active").length;
          return (
            <Card key={year} className="overflow-hidden p-0">
              <button
                type="button"
                aria-expanded={open}
                onClick={() =>
                  setOpenYears((prev) => {
                    const next = new Set(prev);
                    if (next.has(year)) next.delete(year);
                    else next.add(year);
                    return next;
                  })
                }
                className="flex w-full items-center gap-3 p-4 text-left transition hover:bg-secondary/50"
              >
                <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-secondary">
                  <Icon icon="ph:calendar-blank" className="size-4.5 text-muted-foreground" />
                </span>
                <span className="text-base font-semibold tabular-nums">{year}</span>
                <span className="rounded-full bg-secondary px-2 py-0.5 text-xs text-muted-foreground">
                  {t("contractCount", { n: items.length })}
                </span>
                {activeCount > 0 && (
                  <span className="rounded-full bg-success/15 px-2 py-0.5 text-xs font-medium text-success">
                    {t("activeCount", { n: activeCount })}
                  </span>
                )}
                <Icon
                  icon="ph:caret-down"
                  className={
                    "ml-auto size-4 shrink-0 text-muted-foreground transition-transform " +
                    (open ? "rotate-180" : "")
                  }
                />
              </button>
              {open && (
                <div className="flex flex-col gap-3 border-t border-border bg-secondary/30 p-4">
                  {items.map((c) => (
                    <ContractCard
                      key={c.id}
                      agency={agency}
                      contract={c}
                      properties={properties}
                      onChanged={load}
                    />
                  ))}
                </div>
              )}
            </Card>
          );
        })
      )}
    </section>
  );
}

// Status aus der Gültigkeit berechnen (nie manuell pflegen).
function contractStatus(c: AgencyContract): "active" | "upcoming" | "expired" {
  const today = todayIso();
  if (c.valid_to < today) return "expired";
  if (c.valid_from > today) return "upcoming";
  return "active";
}

const STATUS_CLASS: Record<string, string> = {
  active: "bg-success/15 text-success",
  upcoming: "bg-warning/15 text-warning",
  expired: "bg-muted text-muted-foreground",
};

function NewContractForm({
  agency,
  onDone,
}: {
  agency: Agency;
  onDone: (created: AgencyContract) => void;
}) {
  const t = useTranslations("travelAgencies");
  const year = new Date().getFullYear();
  const [title, setTitle] = useState("");
  const [kind, setKind] = useState<ContractKind>("allotment");
  const [from, setFrom] = useState(`${year}-01-01`);
  const [to, setTo] = useState(`${year}-12-31`);
  // Vorbelegt aus dem Partner-Profil; Pflichtfeld, der Nutzer bestätigt explizit.
  const [currency, setCurrency] = useState(agency.currency ?? "");
  const [commission, setCommission] = useState(
    agency.commission_pct == null ? "" : String(agency.commission_pct),
  );
  const [releaseDays, setReleaseDays] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onCreate() {
    setError(null);
    startTransition(async () => {
      const res = await addAgencyContract(agency.id, {
        title: title.trim(),
        kind,
        valid_from: from,
        valid_to: to,
        currency: currency.trim().toUpperCase(),
        commission_pct: commission === "" ? null : Number(commission),
        release_days: releaseDays === "" ? null : Number(releaseDays),
        notes: null,
      });
      if (res.ok) onDone(res.data);
      else setError(res.error);
    });
  }

  return (
    <Card className="grid grid-cols-2 items-end gap-3 p-4 sm:grid-cols-4">
      <label className="col-span-2 flex flex-col gap-1">
        <span className="text-xs font-medium text-muted-foreground">{t("contractTitle")}</span>
        <Input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-xs font-medium text-muted-foreground">{t("contractKind")}</span>
        <NativeSelect value={kind} onChange={(e) => setKind(e.target.value as ContractKind)}>
          <option value="allotment">{t("contractKind_allotment")}</option>
          <option value="guarantee">{t("contractKind_guarantee")}</option>
          <option value="free_sale">{t("contractKind_free_sale")}</option>
          <option value="other">{t("contractKind_other")}</option>
        </NativeSelect>
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-xs font-medium text-muted-foreground">{t("currency")}</span>
        <Input value={currency} onChange={(e) => setCurrency(e.target.value)} placeholder="EUR" maxLength={3} />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-xs font-medium text-muted-foreground">{t("validFrom")}</span>
        <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-xs font-medium text-muted-foreground">{t("validTo")}</span>
        <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-xs font-medium text-muted-foreground">{t("commission")}</span>
        <Input type="number" value={commission} onChange={(e) => setCommission(e.target.value)} />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-xs font-medium text-muted-foreground">{t("releaseDays")}</span>
        <Input type="number" value={releaseDays} onChange={(e) => setReleaseDays(e.target.value)} />
      </label>
      {error && <p className="col-span-full text-xs text-destructive">{error}</p>}
      <div className="col-span-full flex justify-end">
        <Button
          onClick={onCreate}
          disabled={pending || !title.trim() || currency.trim().length !== 3 || !from || !to}
        >
          {t("create")}
        </Button>
      </div>
    </Card>
  );
}

function ContractCard({
  agency,
  contract,
  properties,
  onChanged,
}: {
  agency: Agency;
  contract: AgencyContract;
  properties: PropertyRef[];
  onChanged: () => void;
}) {
  const t = useTranslations("travelAgencies");
  const locale = useLocale();
  const status = contractStatus(contract);
  const fileInput = useRef<HTMLInputElement>(null);
  const [ratesOpen, setRatesOpen] = useState(false);
  const [rates, setRates] = useState<AgencyRate[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const dateFmt = useMemo(
    () =>
      new Intl.DateTimeFormat(locale, {
        day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC",
      }),
    [locale],
  );
  // Währung kommt aus dem Vertrag (nie hartkodiert).
  const moneyFmt = useMemo(
    () => new Intl.NumberFormat(locale, { style: "currency", currency: contract.currency }),
    [locale, contract.currency],
  );
  const fmtDate = (iso: string) => dateFmt.format(new Date(iso + "T00:00:00Z"));

  const loadRates = useCallback(() => {
    startTransition(async () => {
      const res = await listContractRates(agency.id, contract.id);
      if (res.ok) setRates(res.data.items);
      else setError(res.error);
    });
  }, [agency.id, contract.id]);

  useEffect(() => {
    if (ratesOpen) loadRates();
  }, [ratesOpen, loadRates]);
  // Live: Preiszeilen dieses Vertrags.
  useRealtime({
    table: "travel_agency_rates",
    filter: `contract_id=eq.${contract.id}`,
    onChange: loadRates,
    enabled: ratesOpen,
  });

  function onUpload(file: File) {
    setError(null);
    startTransition(async () => {
      const res = await uploadContractFile(agency.id, contract.id, file);
      if (res.ok) onChanged();
      else setError(res.error);
    });
  }

  function onDownload() {
    setError(null);
    // Fenster SYNCHRON im Klick öffnen (Popup-Blocker schlucken window.open
    // nach einem await); die signierte URL wird nachgereicht.
    const win = window.open("", "_blank", "noopener");
    startTransition(async () => {
      const res = await contractFileUrl(agency.id, contract.id);
      if (res.ok && win) {
        win.location.href = res.data.url;
      } else {
        win?.close();
        if (!res.ok) setError(res.error);
      }
    });
  }

  function onDelete() {
    // Löscht auch Rate-Sheet + Dokument — bestätigen lassen.
    if (!window.confirm(t("confirmDelete"))) return;
    startTransition(async () => {
      const res = await deleteAgencyContract(agency.id, contract.id);
      if (res.ok) onChanged();
      else setError(res.error);
    });
  }

  // Werte umbrechen statt abschneiden — Gültigkeitszeiträume müssen auch
  // auf Mobile vollständig ablesbar sein.
  const meta = (label: string, value: string) => (
    <div className="flex min-w-0 flex-col gap-0.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="break-words text-sm font-medium">{value}</span>
    </div>
  );

  return (
    <Card className="flex flex-col gap-4 p-4">
      <div className="flex flex-wrap items-start gap-2">
        {/* Mindestbreite: bei schmalen Screens brechen die Datei-Aktionen in
            die nächste Zeile um, statt den Titel zusammenzuquetschen. */}
        <div className="flex min-w-48 flex-1 flex-wrap items-center gap-2">
          <span className="truncate text-sm font-semibold">{contract.title}</span>
          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_CLASS[status]}`}>
            {t(`status_${status}`)}
          </span>
          <span className="rounded-full bg-secondary px-2 py-0.5 text-xs text-secondary-foreground">
            {t(`contractKind_${contract.kind}`)}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <input
            ref={fileInput}
            type="file"
            accept=".pdf,.jpg,.jpeg,.png,.docx,.xlsx"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onUpload(f);
              e.target.value = "";
            }}
          />
          {contract.storage_path ? (
            <Button variant="outline" size="sm" onClick={onDownload} disabled={pending}>
              <Icon icon="ph:download-simple" className="size-4" />
              {t("download")}
            </Button>
          ) : null}
          <Button
            variant="outline"
            size="sm"
            onClick={() => fileInput.current?.click()}
            disabled={pending}
          >
            <Icon icon="ph:upload-simple" className="size-4" />
            {contract.storage_path ? t("replaceFile") : t("uploadFile")}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="size-8 text-muted-foreground"
            onClick={onDelete}
            aria-label={t("delete")}
            disabled={pending}
          >
            <Icon icon="ph:trash" className="size-4" />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {meta(t("validity"), `${fmtDate(contract.valid_from)} – ${fmtDate(contract.valid_to)}`)}
        {meta(
          t("commission"),
          contract.commission_pct == null ? "—" : `${contract.commission_pct} %`,
        )}
        {meta(
          t("releaseDays"),
          contract.release_days == null ? "—" : String(contract.release_days),
        )}
        {meta(t("document"), contract.file_name ?? "—")}
      </div>

      {error && <p className="text-xs text-destructive">{error}</p>}

      <button
        type="button"
        aria-expanded={ratesOpen}
        onClick={() => setRatesOpen((v) => !v)}
        className="flex items-center gap-1.5 self-start text-left text-xs font-medium text-muted-foreground transition hover:text-foreground"
      >
        <Icon
          icon="ph:caret-down"
          className={"size-3.5 transition-transform " + (ratesOpen ? "rotate-180" : "")}
        />
        {t("rateSheet")}
      </button>

      {ratesOpen && (
        <RateSheet
          agencyId={agency.id}
          contract={contract}
          rates={rates}
          properties={properties}
          moneyFmt={moneyFmt}
          fmtDate={fmtDate}
          onChanged={loadRates}
        />
      )}
    </Card>
  );
}

function RateSheet({
  agencyId,
  contract,
  rates,
  properties,
  moneyFmt,
  fmtDate,
  onChanged,
}: {
  agencyId: string;
  contract: AgencyContract;
  rates: AgencyRate[];
  properties: PropertyRef[];
  moneyFmt: Intl.NumberFormat;
  fmtDate: (iso: string) => string;
  onChanged: () => void;
}) {
  const t = useTranslations("travelAgencies");
  const [propertyId, setPropertyId] = useState(properties[0]?.id ?? "");
  const [from, setFrom] = useState(contract.valid_from);
  const [to, setTo] = useState(contract.valid_to);
  const [price, setPrice] = useState("");
  const [basis, setBasis] = useState<RateBasis>("net");
  const [minStay, setMinStay] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const titleOf = (id: string) => properties.find((p) => p.id === id)?.title ?? id;

  function onAdd() {
    setError(null);
    startTransition(async () => {
      const res = await addContractRate(agencyId, contract.id, {
        property_id: propertyId,
        season_start: from,
        season_end: to,
        price: Number(price),
        basis,
        min_stay: minStay === "" ? null : Number(minStay),
      });
      if (res.ok) {
        setPrice("");
        onChanged();
      } else {
        setError(res.error);
      }
    });
  }

  function onRemove(rateId: string) {
    startTransition(async () => {
      const res = await deleteContractRate(agencyId, contract.id, rateId);
      if (res.ok) onChanged();
      else setError(res.error);
    });
  }

  return (
    <div className="flex flex-col gap-3">
      {rates.length > 0 && (
        <div className="overflow-x-auto rounded-(--radius) border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-secondary/50 text-left text-xs text-muted-foreground">
                <th className="px-3 py-2 font-medium">{t("property")}</th>
                <th className="px-3 py-2 font-medium">{t("season")}</th>
                <th className="px-3 py-2 text-right font-medium">
                  {t("pricePerNight", { currency: contract.currency })}
                </th>
                <th className="px-3 py-2 font-medium">{t("basis")}</th>
                <th className="px-3 py-2 font-medium">{t("minStay")}</th>
                <th className="w-10 px-3 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rates.map((r) => (
                <tr key={r.id}>
                  <td className="max-w-48 truncate px-3 py-2">{titleOf(r.property_id)}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-xs text-muted-foreground">
                    {fmtDate(r.season_start)} – {fmtDate(r.season_end)}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-right font-medium tabular-nums">
                    {moneyFmt.format(r.price)}
                  </td>
                  <td className="px-3 py-2">
                    <span className="rounded-full bg-secondary px-2 py-0.5 text-xs">
                      {t(`basis_${r.basis}`)}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">
                    {r.min_stay == null ? "—" : `≥${r.min_stay}`}
                  </td>
                  <td className="px-3 py-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-7 text-muted-foreground"
                      onClick={() => onRemove(r.id)}
                      aria-label={t("delete")}
                      disabled={pending}
                    >
                      <Icon icon="ph:x" className="size-3.5" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div className="grid grid-cols-2 items-end gap-2 sm:grid-cols-7">
        <label className="col-span-2 flex flex-col gap-1">
          <span className="text-xs font-medium text-muted-foreground">{t("property")}</span>
          <NativeSelect value={propertyId} onChange={(e) => setPropertyId(e.target.value)}>
            {properties.map((p) => (
              <option key={p.id} value={p.id}>{p.title}</option>
            ))}
          </NativeSelect>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-muted-foreground">{t("seasonFrom")}</span>
          <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-muted-foreground">{t("seasonTo")}</span>
          <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-muted-foreground">
            {t("pricePerNight", { currency: contract.currency })}
          </span>
          <Input type="number" value={price} onChange={(e) => setPrice(e.target.value)} />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-muted-foreground">{t("basis")}</span>
          <NativeSelect value={basis} onChange={(e) => setBasis(e.target.value as RateBasis)}>
            <option value="net">{t("basis_net")}</option>
            <option value="gross">{t("basis_gross")}</option>
          </NativeSelect>
        </label>
        <div className="flex items-end gap-2">
          <label className="flex min-w-0 flex-1 flex-col gap-1">
            <span className="text-xs font-medium text-muted-foreground">{t("minStay")}</span>
            <Input type="number" value={minStay} onChange={(e) => setMinStay(e.target.value)} />
          </label>
          <Button
            size="icon"
            onClick={onAdd}
            disabled={pending || !propertyId || price === "" || Number.isNaN(Number(price))}
            aria-label={t("addRate")}
          >
            <Icon icon="ph:plus" className="size-4" />
          </Button>
        </div>
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
