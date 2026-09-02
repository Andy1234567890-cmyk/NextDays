"use client";

// Pflege der Multiplikatoren-Liste: filtern, anlegen, Status/nächsten Schritt
// setzen, CSV importieren, nach Gewinn mit dem Partner verknüpfen. Löschen
// fragt nach — ein Lead ist eine Gesprächshistorie, kein Wegwerfdatensatz.
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import {
  LEAD_KATEGORIE_LABEL,
  LEAD_STATUS_LABEL,
  type Lead,
  type LeadKategorie,
  type LeadStatus,
} from "@/lib/partner";
import { leadAendern, leadAnlegen, type LeadEingabe, leadLoeschen, leadsImportieren } from "@/lib/partner-actions";

const FELD =
  "w-full rounded-xl border border-border bg-transparent px-3 py-2 text-sm outline-none focus-visible:border-foreground";

const LEER: LeadEingabe = {
  name: "",
  organisation: null,
  category: "A",
  channels: [],
  reach: null,
  country: null,
  language: null,
  status: "open",
  next_step: null,
  next_step_at: null,
  notes: null,
};

function leerZuNull(v: string): string | null {
  const w = v.trim();
  return w ? w : null;
}

function zahlOderNull(v: string): number | null {
  const z = v.replace(/\D/g, "");
  return z ? Number(z) : null;
}

export function PartnerLeads({
  leads,
  filter,
}: {
  leads: Lead[];
  filter: { status: string; category: string; q: string };
}) {
  const router = useRouter();
  const [form, setForm] = useState<LeadEingabe>(LEER);
  const [kanalUrl, setKanalUrl] = useState("");
  const [bearbeitet, setBearbeitet] = useState<string | null>(null);
  const [csv, setCsv] = useState("");
  const [importOffen, setImportOffen] = useState(false);
  const [laeuft, starte] = useTransition();

  const filtern = (patch: Partial<typeof filter>) => {
    const sp = new URLSearchParams();
    const neu = { ...filter, ...patch };
    if (neu.status) sp.set("status", neu.status);
    if (neu.category) sp.set("category", neu.category);
    if (neu.q) sp.set("q", neu.q);
    router.push(`/partner/leads${sp.toString() ? `?${sp}` : ""}`);
  };

  const zuruecksetzen = () => {
    setForm(LEER);
    setKanalUrl("");
    setBearbeitet(null);
  };

  const speichern = () =>
    starte(async () => {
      const eingabe: LeadEingabe = {
        ...form,
        channels: kanalUrl.trim()
          ? [{ platform: "website", url: kanalUrl.trim(), handle: null, followers: null }]
          : form.channels,
      };
      const res = bearbeitet ? await leadAendern(bearbeitet, eingabe) : await leadAnlegen(eingabe);
      if (!res.ok) {
        toast.error(res.fehler);
        return;
      }
      toast.success(bearbeitet ? "Lead geändert." : "Lead angelegt.");
      zuruecksetzen();
    });

  const bearbeiten = (l: Lead) => {
    setBearbeitet(l.id);
    setKanalUrl(l.channels[0]?.url ?? "");
    setForm({
      name: l.name,
      organisation: l.organisation,
      category: l.category,
      channels: l.channels,
      reach: l.reach,
      country: l.country,
      language: l.language,
      status: l.status,
      next_step: l.next_step,
      next_step_at: l.next_step_at,
      notes: l.notes,
      affiliate_id: l.affiliate_id,
    });
  };

  const statusSetzen = (l: Lead, status: LeadStatus) =>
    starte(async () => {
      const res = await leadAendern(l.id, { status });
      if (!res.ok) toast.error(res.fehler);
    });

  const loeschen = (l: Lead) => {
    if (!window.confirm(`„${l.name}“ wirklich löschen? Die Gesprächshistorie geht verloren.`)) return;
    starte(async () => {
      const res = await leadLoeschen(l.id);
      if (!res.ok) toast.error(res.fehler);
      else toast.success("Lead gelöscht.");
    });
  };

  const importieren = () =>
    starte(async () => {
      const res = await leadsImportieren(csv);
      if (!res.ok) {
        toast.error(res.fehler);
        return;
      }
      toast.success(`${res.data.angelegt} Leads angelegt${res.data.fehler.length ? `, ${res.data.fehler.length} Zeilen übersprungen` : ""}.`);
      if (res.data.fehler.length) toast.message(res.data.fehler.slice(0, 5).join(" · "));
      setCsv("");
      setImportOffen(false);
    });

  return (
    <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
      <section>
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="search"
            defaultValue={filter.q}
            placeholder="Suche in Name, Organisation, Notizen"
            className={`${FELD} max-w-xs`}
            onKeyDown={(e) => {
              if (e.key === "Enter") filtern({ q: (e.target as HTMLInputElement).value });
            }}
          />
          <select value={filter.category} onChange={(e) => filtern({ category: e.target.value })} className={`${FELD} max-w-[16rem]`}>
            <option value="">Alle Kategorien</option>
            {(Object.keys(LEAD_KATEGORIE_LABEL) as LeadKategorie[]).map((k) => (
              <option key={k} value={k}>{LEAD_KATEGORIE_LABEL[k]}</option>
            ))}
          </select>
          <select value={filter.status} onChange={(e) => filtern({ status: e.target.value })} className={`${FELD} max-w-[10rem]`}>
            <option value="">Alle Status</option>
            {(Object.keys(LEAD_STATUS_LABEL) as LeadStatus[]).map((s) => (
              <option key={s} value={s}>{LEAD_STATUS_LABEL[s]}</option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => setImportOffen((o) => !o)}
            className="rounded-full border border-border px-4 py-2 text-sm font-semibold hover:border-foreground"
          >
            CSV-Import
          </button>
        </div>

        {importOffen && (
          <div className="mt-4 rounded-2xl border border-border p-4">
            <p className="text-sm text-muted-foreground">
              Kopfzeile: <code>name;organisation;kategorie;reichweite;land;sprache;url;notizen</code> — Kategorie A–D,
              Trennzeichen ; oder ,. Fehlerhafte Zeilen werden gemeldet, nicht still übersprungen.
            </p>
            <textarea value={csv} onChange={(e) => setCsv(e.target.value)} rows={8} className={`${FELD} mt-3 font-mono text-xs`} />
            <button
              type="button"
              disabled={laeuft || csv.trim().length < 10}
              onClick={importieren}
              className="mt-3 rounded-full bg-foreground px-4 py-2 text-sm font-semibold text-background disabled:opacity-50"
            >
              Importieren
            </button>
          </div>
        )}

        {leads.length === 0 ? (
          <p className="mt-6 text-sm text-muted-foreground">Keine Leads für diesen Filter.</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[56rem] text-sm">
              <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="pb-2 pr-4 font-semibold">Name</th>
                  <th className="pb-2 pr-4 font-semibold">Kategorie</th>
                  <th className="pb-2 pr-4 font-semibold">Reichweite</th>
                  <th className="pb-2 pr-4 font-semibold">Status</th>
                  <th className="pb-2 pr-4 font-semibold">Nächster Schritt</th>
                  <th className="pb-2 font-semibold">Aktionen</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {leads.map((l) => (
                  <tr key={l.id} className="align-top">
                    <td className="py-2.5 pr-4">
                      <div className="font-medium">{l.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {l.organisation ?? "—"}
                        {l.channels[0] && (
                          <>
                            {" · "}
                            <a href={l.channels[0].url} target="_blank" rel="noreferrer" className="underline-offset-4 hover:underline">
                              {l.channels[0].platform}
                            </a>
                          </>
                        )}
                        {l.affiliate_id && (
                          <>
                            {" · "}
                            <a href={`/partner/${l.affiliate_id}`} className="underline-offset-4 hover:underline">Partner</a>
                          </>
                        )}
                      </div>
                    </td>
                    <td className="py-2.5 pr-4 text-muted-foreground">{l.category}</td>
                    <td className="py-2.5 pr-4 tabular-nums text-muted-foreground">
                      {l.reach ? l.reach.toLocaleString("de-DE") : "—"}
                    </td>
                    <td className="py-2.5 pr-4">
                      <select
                        value={l.status}
                        disabled={laeuft}
                        onChange={(e) => statusSetzen(l, e.target.value as LeadStatus)}
                        className="rounded-lg border border-border bg-transparent px-2 py-1 text-xs"
                      >
                        {(Object.keys(LEAD_STATUS_LABEL) as LeadStatus[]).map((s) => (
                          <option key={s} value={s}>{LEAD_STATUS_LABEL[s]}</option>
                        ))}
                      </select>
                    </td>
                    <td className="py-2.5 pr-4 text-muted-foreground">
                      {l.next_step ?? "—"}
                      {l.next_step_at && <div className="text-xs">{l.next_step_at}</div>}
                    </td>
                    <td className="py-2.5">
                      <div className="flex gap-2 text-xs">
                        <button type="button" onClick={() => bearbeiten(l)} className="underline-offset-4 hover:underline">
                          Bearbeiten
                        </button>
                        <button type="button" onClick={() => loeschen(l)} className="text-destructive underline-offset-4 hover:underline">
                          Löschen
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <aside className="rounded-2xl border border-border p-5">
        <h2 className="text-sm font-semibold">{bearbeitet ? "Lead bearbeiten" : "Lead anlegen"}</h2>
        <form
          className="mt-3 flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            speichern();
          }}
        >
          <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required maxLength={200} placeholder="Name" className={FELD} />
          <input value={form.organisation ?? ""} onChange={(e) => setForm({ ...form, organisation: leerZuNull(e.target.value) })} maxLength={200} placeholder="Organisation / Marke" className={FELD} />
          <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value as LeadKategorie })} className={FELD}>
            {(Object.keys(LEAD_KATEGORIE_LABEL) as LeadKategorie[]).map((k) => (
              <option key={k} value={k}>{LEAD_KATEGORIE_LABEL[k]}</option>
            ))}
          </select>
          <input value={kanalUrl} onChange={(e) => setKanalUrl(e.target.value)} placeholder="Kanal-Adresse (https://…)" className={FELD} />
          <div className="grid grid-cols-3 gap-2">
            <input value={form.reach ?? ""} onChange={(e) => setForm({ ...form, reach: zahlOderNull(e.target.value) })} inputMode="numeric" placeholder="Reichweite" className={FELD} />
            <input value={form.country ?? ""} onChange={(e) => setForm({ ...form, country: leerZuNull(e.target.value.toUpperCase().slice(0, 2)) })} maxLength={2} placeholder="Land" className={FELD} />
            <input value={form.language ?? ""} onChange={(e) => setForm({ ...form, language: leerZuNull(e.target.value.toLowerCase().slice(0, 5)) })} maxLength={5} placeholder="Sprache" className={FELD} />
          </div>
          <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as LeadStatus })} className={FELD}>
            {(Object.keys(LEAD_STATUS_LABEL) as LeadStatus[]).map((s) => (
              <option key={s} value={s}>{LEAD_STATUS_LABEL[s]}</option>
            ))}
          </select>
          <input value={form.next_step ?? ""} onChange={(e) => setForm({ ...form, next_step: leerZuNull(e.target.value) })} maxLength={500} placeholder="Nächster Schritt" className={FELD} />
          <input type="date" value={form.next_step_at ?? ""} onChange={(e) => setForm({ ...form, next_step_at: leerZuNull(e.target.value) })} className={FELD} />
          {bearbeitet && (
            <input value={form.affiliate_id ?? ""} onChange={(e) => setForm({ ...form, affiliate_id: leerZuNull(e.target.value) })} placeholder="Partner-ID nach Gewinn (UUID)" className={FELD} />
          )}
          <textarea value={form.notes ?? ""} onChange={(e) => setForm({ ...form, notes: leerZuNull(e.target.value) })} rows={4} maxLength={5000} placeholder="Notizen (Gesprächsverlauf, Themen, Einwände)" className={FELD} />
          <div className="flex gap-2">
            <button type="submit" disabled={laeuft || !form.name.trim()} className="rounded-full bg-foreground px-4 py-2 text-sm font-semibold text-background disabled:opacity-50">
              {bearbeitet ? "Speichern" : "Anlegen"}
            </button>
            {bearbeitet && (
              <button type="button" onClick={zuruecksetzen} className="rounded-full border border-border px-4 py-2 text-sm font-semibold">
                Abbrechen
              </button>
            )}
          </div>
        </form>
      </aside>
    </div>
  );
}
