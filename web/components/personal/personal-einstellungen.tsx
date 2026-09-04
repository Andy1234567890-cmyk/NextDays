"use client";

// Personal → Einstellungen. Sechs Abschnitte, jeder schreibt für sich.
//
// Betriebsregeln (E3): das Land kommt aus dem Konto, die Werte sind ein
// VORSCHLAG aus `laender.py` (mit Quelle), den der Betrieb sieht und bestätigt.
// Erst mit `bestaetigt_am` gibt es Dienstplan, Konflikte und Zuschläge — die
// Oberfläche sagt das oben klar, statt still Defaults anzunehmen (Wurzel 4).
import { Icon } from "@iconify/react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@nextdays/ui/button";
import { DatePicker } from "@nextdays/ui/date-picker";
import { Input } from "@nextdays/ui/input";
import { NativeSelect } from "@nextdays/ui/native-select";
import { OverflowTabs } from "@nextdays/ui/overflow-tabs";
import { Textarea } from "@nextdays/ui/textarea";
import {
  createArbeitsbereich,
  createFremdfirma,
  createUrlaubssperre,
  createVorlage,
  deleteUrlaubssperre,
  feiertageImportieren,
  regelnBestaetigen,
  setPausenmodelle,
  updateArbeitsbereich,
  updateFremdfirma,
  updateVorlage,
} from "@/lib/personal";
import type {
  Arbeitsbereich,
  Fremdfirma,
  Pausenmodell,
  RegelVorschlag,
  Regeln,
  RegelnSet,
  Schichtvorlage,
  Urlaubssperre,
} from "@/lib/personal-typen";
import { formatDate, formatDateTime } from "@/lib/utils";

type Reiter = "regeln" | "bereiche" | "vorlagen" | "pausen" | "firmen" | "sperren";

const LOHNARTEN = ["grundlohn", "nacht", "sonntag", "feiertag", "ueberstunden", "urlaub", "krank", "unbezahlt"] as const;
const FARBEN = ["#2563eb", "#7c3aed", "#db2777", "#ea580c", "#16a34a", "#0891b2", "#4b5563", "#ca8a04"];

function Feld({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="font-medium">{label}</span>
      {children}
      {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
    </label>
  );
}

export function PersonalEinstellungen({
  regeln,
  vorschlag,
  vorschlagFehler,
  arbeitsbereiche,
  vorlagen,
  pausenmodelle,
  fremdfirmen,
  sperren,
}: {
  regeln: Regeln | null;
  vorschlag: RegelVorschlag | null;
  vorschlagFehler: string | null;
  arbeitsbereiche: Arbeitsbereich[];
  vorlagen: Schichtvorlage[];
  pausenmodelle: Pausenmodell[];
  fremdfirmen: Fremdfirma[];
  sperren: Urlaubssperre[];
}) {
  const t = useTranslations("personal");
  const [reiter, setReiter] = useState<Reiter>("regeln");
  const tabs = [
    { key: "regeln", label: t("einstellungen.tabs.regeln") },
    { key: "bereiche", label: t("einstellungen.tabs.bereiche") },
    { key: "vorlagen", label: t("einstellungen.tabs.vorlagen") },
    { key: "pausen", label: t("einstellungen.tabs.pausen") },
    { key: "firmen", label: t("einstellungen.tabs.firmen") },
    { key: "sperren", label: t("einstellungen.tabs.sperren") },
  ];
  return (
    <div className="flex flex-1 flex-col gap-4 pb-20">
      <div>
        <h1 className="font-display text-3xl font-extrabold">{t("einstellungen.title")}</h1>
        <p className="text-sm text-muted-foreground">{t("einstellungen.subtitle")}</p>
      </div>
      {!regeln?.bestaetigt_am && (
        <p className="rounded-2xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
          <Icon icon="ph:warning-circle" className="mr-1 inline size-4" />
          {t("einstellungen.regelnFehlen")}
        </p>
      )}
      <OverflowTabs tabs={tabs} active={reiter} onSelect={(k) => setReiter(k as Reiter)} />
      {reiter === "regeln" && <RegelnAbschnitt regeln={regeln} vorschlag={vorschlag} fehler={vorschlagFehler} />}
      {reiter === "bereiche" && <BereicheAbschnitt bereiche={arbeitsbereiche} />}
      {reiter === "vorlagen" && <VorlagenAbschnitt vorlagen={vorlagen} bereiche={arbeitsbereiche} />}
      {reiter === "pausen" && <PausenAbschnitt modelle={pausenmodelle} bereiche={arbeitsbereiche} />}
      {reiter === "firmen" && <FirmenAbschnitt firmen={fremdfirmen} />}
      {reiter === "sperren" && <SperrenAbschnitt sperren={sperren} bereiche={arbeitsbereiche} />}
    </div>
  );
}

// --- Regeln ------------------------------------------------------------------

function RegelnAbschnitt({ regeln, vorschlag, fehler }: { regeln: Regeln | null; vorschlag: RegelVorschlag | null; fehler: string | null }) {
  const t = useTranslations("personal");
  const locale = useLocale();
  const router = useRouter();
  const basis: RegelnSet | null = regeln ?? vorschlag?.werte ?? null;
  const [f, setF] = useState<RegelnSet | null>(
    basis
      ? { ...basis, nacht_von: basis.nacht_von.slice(0, 5), nacht_bis: basis.nacht_bis.slice(0, 5), lohnarten: { ...basis.lohnarten } }
      : null,
  );
  const [busy, setBusy] = useState(false);
  const [importStand, setImportStand] = useState<string | null>(null);

  if (!f) {
    return (
      <section className="rounded-2xl border bg-card p-4 text-sm">
        <p className="text-destructive">{fehler ?? t("einstellungen.keinVorschlag")}</p>
        <p className="mt-2 text-muted-foreground">{t("einstellungen.keinVorschlagHint", { land: vorschlag?.land ?? "—" })}</p>
        <Button className="mt-3 rounded-full" variant="outline" onClick={() => setF(LEERE_REGELN)}>
          {t("einstellungen.selbstEintragen")}
        </Button>
      </section>
    );
  }

  const num = (k: keyof RegelnSet) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setF((x) => x && { ...x, [k]: e.target.value === "" ? null : Number(e.target.value.replace(",", ".")) });
  const text = (k: keyof RegelnSet) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setF((x) => x && { ...x, [k]: e.target.value || null });

  async function bestaetigen(e: React.FormEvent) {
    e.preventDefault();
    if (!f) return;
    setBusy(true);
    const res = await regelnBestaetigen({
      ...f,
      lohnarten: Object.fromEntries(Object.entries(f.lohnarten).filter(([, v]) => v.trim())),
    });
    setBusy(false);
    if (!res.ok) return void toast.error(res.error);
    toast.success(t("einstellungen.regelnBestaetigt"));
    router.refresh();
  }

  async function importieren() {
    setBusy(true);
    const res = await feiertageImportieren();
    setBusy(false);
    if (!res.ok) return void toast.error(res.error);
    setImportStand(t("einstellungen.feiertageImportiert", { land: res.data.land, neu: res.data.eingefuegt, vorhanden: res.data.vorhanden }));
  }

  return (
    <form onSubmit={bestaetigen} className="grid gap-6 lg:grid-cols-2">
      <section className="rounded-2xl border bg-card p-4 lg:col-span-2">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-display text-lg font-extrabold">
              {t("einstellungen.regelnTitel", { land: regeln?.land ?? vorschlag?.land ?? "—" })}
            </h2>
            <p className="text-sm text-muted-foreground">
              {regeln?.bestaetigt_am
                ? t("einstellungen.bestaetigtAm", { datum: formatDateTime(regeln.bestaetigt_am, locale) })
                : t("einstellungen.nochNichtBestaetigt")}
            </p>
          </div>
          {vorschlag?.quelle && (
            <p className="max-w-xl text-xs text-muted-foreground">
              <span className="font-medium">{t("einstellungen.quelle")}:</span> {vorschlag.quelle}
            </p>
          )}
        </div>
        {vorschlag && vorschlag.hinweise.length > 0 && (
          <ul className="mt-2 list-disc pl-5 text-xs text-muted-foreground">
            {vorschlag.hinweise.map((h) => <li key={h}>{h}</li>)}
          </ul>
        )}
      </section>
      <section className="rounded-2xl border bg-card p-4">
        <h3 className="mb-3 font-medium">{t("einstellungen.arbeitszeit")}</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <Feld label={t("regeln.zeitzone")} hint={t("regeln.zeitzoneHint")}>
            <Input value={f.zeitzone} onChange={(e) => setF((x) => x && { ...x, zeitzone: e.target.value })} />
          </Feld>
          <Feld label={t("regeln.feiertage_region")} hint={t("regeln.regionHint")}>
            <Input value={f.feiertage_region ?? ""} onChange={text("feiertage_region")} />
          </Feld>
          <Feld label={t("regeln.ruhezeit_stunden")}><Input inputMode="decimal" value={f.ruhezeit_stunden} onChange={num("ruhezeit_stunden")} /></Feld>
          <Feld label={t("regeln.max_tagesstunden")}><Input inputMode="decimal" value={f.max_tagesstunden} onChange={num("max_tagesstunden")} /></Feld>
          <Feld label={t("regeln.max_wochenstunden")}><Input inputMode="decimal" value={f.max_wochenstunden} onChange={num("max_wochenstunden")} /></Feld>
          <Feld label={t("regeln.nacht")}>
            <div className="flex items-center gap-2">
              <Input type="time" value={f.nacht_von} onChange={(e) => setF((x) => x && { ...x, nacht_von: e.target.value })} />
              <span>–</span>
              <Input type="time" value={f.nacht_bis} onChange={(e) => setF((x) => x && { ...x, nacht_bis: e.target.value })} />
            </div>
          </Feld>
        </div>
      </section>
      <section className="rounded-2xl border bg-card p-4">
        <h3 className="mb-3 font-medium">{t("einstellungen.zuschlaege")}</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <Feld label={t("regeln.zuschlag_nacht_pct")}><Input inputMode="decimal" value={f.zuschlag_nacht_pct} onChange={num("zuschlag_nacht_pct")} /></Feld>
          <Feld label={t("regeln.zuschlag_sonntag_pct")}><Input inputMode="decimal" value={f.zuschlag_sonntag_pct} onChange={num("zuschlag_sonntag_pct")} /></Feld>
          <Feld label={t("regeln.zuschlag_feiertag_pct")}><Input inputMode="decimal" value={f.zuschlag_feiertag_pct} onChange={num("zuschlag_feiertag_pct")} /></Feld>
          <Feld label={t("regeln.zuschlag_ueberstunden_pct")}><Input inputMode="decimal" value={f.zuschlag_ueberstunden_pct} onChange={num("zuschlag_ueberstunden_pct")} /></Feld>
        </div>
      </section>
      <section className="rounded-2xl border bg-card p-4">
        <h3 className="mb-3 font-medium">{t("einstellungen.urlaub")}</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <Feld label={t("regeln.urlaubsjahr_start_monat")}><Input inputMode="numeric" value={f.urlaubsjahr_start_monat} onChange={num("urlaubsjahr_start_monat")} /></Feld>
          <Feld label={t("regeln.uebertrag_verfall_monat")} hint={t("regeln.verfallHint")}>
            <Input inputMode="numeric" value={f.uebertrag_verfall_monat ?? ""} onChange={num("uebertrag_verfall_monat")} />
          </Feld>
          <Feld label={t("regeln.uebertrag_max_tage")}><Input inputMode="decimal" value={f.uebertrag_max_tage ?? ""} onChange={num("uebertrag_max_tage")} /></Feld>
          <Feld label={t("regeln.mindest_vorlauf_urlaub_tage")}><Input inputMode="numeric" value={f.mindest_vorlauf_urlaub_tage} onChange={num("mindest_vorlauf_urlaub_tage")} /></Feld>
        </div>
      </section>
      <section className="rounded-2xl border bg-card p-4">
        <h3 className="mb-1 font-medium">{t("einstellungen.datev")}</h3>
        <p className="mb-3 text-xs text-muted-foreground">{t("einstellungen.datevHint")}</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <Feld label={t("regeln.datev_berater_nr")}><Input value={f.datev_berater_nr ?? ""} onChange={text("datev_berater_nr")} /></Feld>
          <Feld label={t("regeln.datev_mandanten_nr")}><Input value={f.datev_mandanten_nr ?? ""} onChange={text("datev_mandanten_nr")} /></Feld>
          {LOHNARTEN.map((k) => (
            <Feld key={k} label={t(`lohnarten.${k}`)}>
              <Input
                value={f.lohnarten[k] ?? ""}
                onChange={(e) => setF((x) => x && { ...x, lohnarten: { ...x.lohnarten, [k]: e.target.value } })}
                placeholder={t("einstellungen.lohnartNr")}
              />
            </Feld>
          ))}
        </div>
      </section>
      <div className="flex flex-wrap items-center gap-3 lg:col-span-2">
        <Button type="submit" disabled={busy} className="rounded-full">{t("einstellungen.bestaetigen")}</Button>
        <Button type="button" variant="outline" disabled={busy || !regeln?.bestaetigt_am} onClick={importieren} className="rounded-full">
          {t("einstellungen.feiertageImport")}
        </Button>
        {importStand && <span className="text-sm text-muted-foreground">{importStand}</span>}
      </div>
    </form>
  );
}

const LEERE_REGELN: RegelnSet = {
  zeitzone: "",
  feiertage_region: null,
  ruhezeit_stunden: 11,
  max_tagesstunden: 13,
  max_wochenstunden: 48,
  nacht_von: "22:00",
  nacht_bis: "06:00",
  zuschlag_nacht_pct: 0,
  zuschlag_sonntag_pct: 0,
  zuschlag_feiertag_pct: 0,
  zuschlag_ueberstunden_pct: 0,
  urlaubsjahr_start_monat: 1,
  uebertrag_verfall_monat: null,
  uebertrag_max_tage: null,
  mindest_vorlauf_urlaub_tage: 0,
  datev_berater_nr: null,
  datev_mandanten_nr: null,
  lohnarten: {},
};

// --- Arbeitsbereiche -----------------------------------------------------------

function BereicheAbschnitt({ bereiche }: { bereiche: Arbeitsbereich[] }) {
  const t = useTranslations("personal");
  const router = useRouter();
  const [neu, setNeu] = useState({ name: "", kurz: "", farbe: FARBEN[0] });
  const [busy, setBusy] = useState(false);

  async function anlegen(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const res = await createArbeitsbereich({ name: neu.name.trim(), kurz: neu.kurz.trim() || neu.name.trim().slice(0, 2).toUpperCase(), farbe: neu.farbe });
    setBusy(false);
    if (!res.ok) return void toast.error(res.error);
    setNeu({ name: "", kurz: "", farbe: FARBEN[(bereiche.length + 1) % FARBEN.length] });
    router.refresh();
  }

  async function archiv(b: Arbeitsbereich) {
    const res = await updateArbeitsbereich(b.id, { archiviert: !b.archived_at });
    if (!res.ok) return void toast.error(res.error);
    router.refresh();
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
      <section className="rounded-2xl border bg-card p-4">
        <h2 className="mb-1 font-display text-lg font-extrabold">{t("einstellungen.tabs.bereiche")}</h2>
        <p className="mb-3 text-sm text-muted-foreground">{t("einstellungen.bereicheHint")}</p>
        <ul className="divide-y text-sm">
          {bereiche.map((b) => (
            <li key={b.id} className={`flex items-center gap-3 py-2 ${b.archived_at ? "opacity-50" : ""}`}>
              <span className="size-4 rounded-full" style={{ backgroundColor: b.farbe }} />
              <span className="w-12 font-mono text-xs">{b.kurz}</span>
              <span className="flex-1 font-medium">{b.name}</span>
              <Button variant="ghost" size="sm" onClick={() => archiv(b)}>
                {b.archived_at ? t("reaktivieren") : t("archivieren")}
              </Button>
            </li>
          ))}
          {bereiche.length === 0 && <li className="py-2 text-muted-foreground">{t("einstellungen.keineBereiche")}</li>}
        </ul>
      </section>
      <form onSubmit={anlegen} className="flex flex-col gap-3 rounded-2xl border bg-card p-4">
        <h2 className="font-display text-lg font-extrabold">{t("einstellungen.bereichNeu")}</h2>
        <Feld label={t("name")}><Input value={neu.name} onChange={(e) => setNeu((x) => ({ ...x, name: e.target.value }))} required /></Feld>
        <Feld label={t("kurz")}><Input value={neu.kurz} maxLength={4} onChange={(e) => setNeu((x) => ({ ...x, kurz: e.target.value }))} /></Feld>
        <Feld label={t("farbe")}>
          <div className="flex flex-wrap gap-2">
            {FARBEN.map((c) => (
              <button
                key={c}
                type="button"
                aria-label={c}
                onClick={() => setNeu((x) => ({ ...x, farbe: c }))}
                className={`size-7 rounded-full border-2 ${neu.farbe === c ? "border-foreground" : "border-transparent"}`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
        </Feld>
        <Button type="submit" disabled={busy || !neu.name.trim()} className="rounded-full">{t("anlegen")}</Button>
      </form>
    </div>
  );
}

// --- Schichtvorlagen -----------------------------------------------------------

function VorlagenAbschnitt({ vorlagen, bereiche }: { vorlagen: Schichtvorlage[]; bereiche: Arbeitsbereich[] }) {
  const t = useTranslations("personal");
  const router = useRouter();
  const [neu, setNeu] = useState({ name: "", kurz: "", start_zeit: "07:00", end_zeit: "14:00", pause_min: "30", farbe: FARBEN[1], arbeitsbereich_id: "" });
  const [busy, setBusy] = useState(false);

  async function anlegen(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const res = await createVorlage({
      name: neu.name.trim(),
      kurz: neu.kurz.trim() || neu.name.trim().slice(0, 2).toUpperCase(),
      start_zeit: neu.start_zeit,
      end_zeit: neu.end_zeit,
      pause_min: Number(neu.pause_min) || 0,
      farbe: neu.farbe,
      arbeitsbereich_id: neu.arbeitsbereich_id || null,
      sort: vorlagen.length,
    });
    setBusy(false);
    if (!res.ok) return void toast.error(res.error);
    setNeu((x) => ({ ...x, name: "", kurz: "" }));
    router.refresh();
  }

  async function archiv(v: Schichtvorlage) {
    const res = await updateVorlage(v.id, { archiviert: !v.archived_at });
    if (!res.ok) return void toast.error(res.error);
    router.refresh();
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
      <section className="rounded-2xl border bg-card p-4">
        <h2 className="mb-1 font-display text-lg font-extrabold">{t("einstellungen.tabs.vorlagen")}</h2>
        <p className="mb-3 text-sm text-muted-foreground">{t("einstellungen.vorlagenHint")}</p>
        <ul className="divide-y text-sm">
          {vorlagen.map((v) => (
            <li key={v.id} className={`flex items-center gap-3 py-2 ${v.archived_at ? "opacity-50" : ""}`}>
              <span className="rounded-md px-2 py-0.5 font-mono text-xs text-white" style={{ backgroundColor: v.farbe }}>{v.kurz}</span>
              <span className="flex-1 font-medium">{v.name}</span>
              <span className="text-muted-foreground">{v.start_zeit.slice(0, 5)}–{v.end_zeit.slice(0, 5)} · {v.pause_min} min</span>
              <span className="w-32 truncate text-muted-foreground">{bereiche.find((b) => b.id === v.arbeitsbereich_id)?.name ?? ""}</span>
              <Button variant="ghost" size="sm" onClick={() => archiv(v)}>{v.archived_at ? t("reaktivieren") : t("archivieren")}</Button>
            </li>
          ))}
          {vorlagen.length === 0 && <li className="py-2 text-muted-foreground">{t("einstellungen.keineVorlagen")}</li>}
        </ul>
      </section>
      <form onSubmit={anlegen} className="flex flex-col gap-3 rounded-2xl border bg-card p-4">
        <h2 className="font-display text-lg font-extrabold">{t("einstellungen.vorlageNeu")}</h2>
        <Feld label={t("name")}><Input value={neu.name} onChange={(e) => setNeu((x) => ({ ...x, name: e.target.value }))} required /></Feld>
        <Feld label={t("kurz")}><Input value={neu.kurz} maxLength={4} onChange={(e) => setNeu((x) => ({ ...x, kurz: e.target.value }))} /></Feld>
        <div className="grid grid-cols-2 gap-2">
          <Feld label={t("von")}><Input type="time" value={neu.start_zeit} onChange={(e) => setNeu((x) => ({ ...x, start_zeit: e.target.value }))} /></Feld>
          <Feld label={t("bis")}><Input type="time" value={neu.end_zeit} onChange={(e) => setNeu((x) => ({ ...x, end_zeit: e.target.value }))} /></Feld>
        </div>
        <Feld label={t("pauseMin")}><Input inputMode="numeric" value={neu.pause_min} onChange={(e) => setNeu((x) => ({ ...x, pause_min: e.target.value }))} /></Feld>
        <Feld label={t("arbeitsbereich")}>
          <NativeSelect value={neu.arbeitsbereich_id} onChange={(e) => setNeu((x) => ({ ...x, arbeitsbereich_id: e.target.value }))}>
            <option value="">—</option>
            {bereiche.filter((b) => !b.archived_at).map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </NativeSelect>
        </Feld>
        <Feld label={t("farbe")}>
          <div className="flex flex-wrap gap-2">
            {FARBEN.map((c) => (
              <button key={c} type="button" aria-label={c} onClick={() => setNeu((x) => ({ ...x, farbe: c }))}
                className={`size-7 rounded-full border-2 ${neu.farbe === c ? "border-foreground" : "border-transparent"}`} style={{ backgroundColor: c }} />
            ))}
          </div>
        </Feld>
        <Button type="submit" disabled={busy || !neu.name.trim()} className="rounded-full">{t("anlegen")}</Button>
      </form>
    </div>
  );
}

// --- Pausenmodelle -------------------------------------------------------------

function PausenAbschnitt({ modelle, bereiche }: { modelle: Pausenmodell[]; bereiche: Arbeitsbereich[] }) {
  const t = useTranslations("personal");
  const router = useRouter();
  const [liste, setListe] = useState(modelle.map((m) => ({ arbeitsbereich_id: m.arbeitsbereich_id ?? "", ab: String(m.ab_minuten), pause: String(m.pause_minuten) })));
  const [busy, setBusy] = useState(false);

  async function speichern() {
    setBusy(true);
    const res = await setPausenmodelle(
      liste
        .filter((m) => Number(m.ab) > 0 && Number(m.pause) > 0)
        .map((m) => ({ arbeitsbereich_id: m.arbeitsbereich_id || null, ab_minuten: Number(m.ab), pause_minuten: Number(m.pause) })),
    );
    setBusy(false);
    if (!res.ok) return void toast.error(res.error);
    toast.success(t("akte.gespeichert"));
    router.refresh();
  }

  return (
    <section className="rounded-2xl border bg-card p-4">
      <h2 className="mb-1 font-display text-lg font-extrabold">{t("einstellungen.tabs.pausen")}</h2>
      <p className="mb-3 text-sm text-muted-foreground">{t("einstellungen.pausenHint")}</p>
      <div className="flex flex-col gap-2">
        {liste.map((m, i) => (
          <div key={i} className="grid grid-cols-[1fr_8rem_8rem_auto] items-end gap-2 text-sm">
            <Feld label={t("arbeitsbereich")}>
              <NativeSelect value={m.arbeitsbereich_id} onChange={(e) => setListe((l) => l.map((x, j) => (j === i ? { ...x, arbeitsbereich_id: e.target.value } : x)))}>
                <option value="">{t("einstellungen.alleBereiche")}</option>
                {bereiche.filter((b) => !b.archived_at).map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </NativeSelect>
            </Feld>
            <Feld label={t("einstellungen.abMinuten")}><Input inputMode="numeric" value={m.ab} onChange={(e) => setListe((l) => l.map((x, j) => (j === i ? { ...x, ab: e.target.value } : x)))} /></Feld>
            <Feld label={t("einstellungen.pauseMinuten")}><Input inputMode="numeric" value={m.pause} onChange={(e) => setListe((l) => l.map((x, j) => (j === i ? { ...x, pause: e.target.value } : x)))} /></Feld>
            <Button variant="ghost" size="icon" onClick={() => setListe((l) => l.filter((_, j) => j !== i))} aria-label={t("loeschen")}>
              <Icon icon="ph:trash" className="size-4" />
            </Button>
          </div>
        ))}
      </div>
      <div className="mt-3 flex gap-2">
        <Button variant="outline" className="rounded-full" onClick={() => setListe((l) => [...l, { arbeitsbereich_id: "", ab: "360", pause: "30" }])}>
          {t("einstellungen.stufeHinzu")}
        </Button>
        <Button className="rounded-full" disabled={busy} onClick={speichern}>{t("speichern")}</Button>
      </div>
    </section>
  );
}

// --- Fremdfirmen ---------------------------------------------------------------

function FirmenAbschnitt({ firmen }: { firmen: Fremdfirma[] }) {
  const t = useTranslations("personal");
  const router = useRouter();
  const [neu, setNeu] = useState({ name: "", kontakt_name: "", kontakt_email: "", kontakt_telefon: "", abrechnung: "je_stunde" as "je_stunde" | "je_einsatz", satz: "", currency: "", notiz: "" });
  const [busy, setBusy] = useState(false);

  async function anlegen(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const satz = neu.satz.trim() ? Math.round(Number(neu.satz.replace(",", ".")) * 100) : null;
    const res = await createFremdfirma({
      name: neu.name.trim(),
      kontakt_name: neu.kontakt_name.trim() || null,
      kontakt_email: neu.kontakt_email.trim() || null,
      kontakt_telefon: neu.kontakt_telefon.trim() || null,
      abrechnung: neu.abrechnung,
      satz_minor: satz,
      currency: satz === null ? null : neu.currency.trim().toUpperCase() || null,
      notiz: neu.notiz.trim() || null,
    });
    setBusy(false);
    if (!res.ok) return void toast.error(res.error);
    setNeu({ name: "", kontakt_name: "", kontakt_email: "", kontakt_telefon: "", abrechnung: "je_stunde", satz: "", currency: "", notiz: "" });
    router.refresh();
  }

  async function archiv(f: Fremdfirma) {
    const res = await updateFremdfirma(f.id, { archiviert: !f.archived_at });
    if (!res.ok) return void toast.error(res.error);
    router.refresh();
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
      <section className="rounded-2xl border bg-card p-4">
        <h2 className="mb-1 font-display text-lg font-extrabold">{t("einstellungen.tabs.firmen")}</h2>
        <p className="mb-3 text-sm text-muted-foreground">{t("einstellungen.firmenHint")}</p>
        <ul className="divide-y text-sm">
          {firmen.map((f) => (
            <li key={f.id} className={`flex flex-wrap items-center gap-3 py-2 ${f.archived_at ? "opacity-50" : ""}`}>
              <div className="min-w-0 flex-1">
                <div className="font-medium">{f.name} <span className="text-xs text-muted-foreground">· {t("einstellungen.personen", { anzahl: f.anzahl_personen })}</span></div>
                <div className="text-xs text-muted-foreground">
                  {[f.kontakt_name, f.kontakt_email, f.kontakt_telefon].filter(Boolean).join(" · ")}
                  {f.satz_minor !== null && f.currency ? ` · ${(f.satz_minor / 100).toFixed(2)} ${f.currency} ${t(`abrechnung.${f.abrechnung}`)}` : ` · ${t(`abrechnung.${f.abrechnung}`)}`}
                </div>
              </div>
              <Button variant="ghost" size="sm" onClick={() => archiv(f)}>{f.archived_at ? t("reaktivieren") : t("archivieren")}</Button>
            </li>
          ))}
          {firmen.length === 0 && <li className="py-2 text-muted-foreground">{t("einstellungen.keineFirmen")}</li>}
        </ul>
      </section>
      <form onSubmit={anlegen} className="flex flex-col gap-3 rounded-2xl border bg-card p-4">
        <h2 className="font-display text-lg font-extrabold">{t("einstellungen.firmaNeu")}</h2>
        <Feld label={t("name")}><Input value={neu.name} onChange={(e) => setNeu((x) => ({ ...x, name: e.target.value }))} required /></Feld>
        <Feld label={t("einstellungen.kontakt")}><Input value={neu.kontakt_name} onChange={(e) => setNeu((x) => ({ ...x, kontakt_name: e.target.value }))} /></Feld>
        <Feld label="E-Mail"><Input type="email" value={neu.kontakt_email} onChange={(e) => setNeu((x) => ({ ...x, kontakt_email: e.target.value }))} /></Feld>
        <Feld label={t("einstellungen.telefon")}><Input value={neu.kontakt_telefon} onChange={(e) => setNeu((x) => ({ ...x, kontakt_telefon: e.target.value }))} /></Feld>
        <Feld label={t("einstellungen.abrechnung")}>
          <NativeSelect value={neu.abrechnung} onChange={(e) => setNeu((x) => ({ ...x, abrechnung: e.target.value as typeof neu.abrechnung }))}>
            <option value="je_stunde">{t("abrechnung.je_stunde")}</option>
            <option value="je_einsatz">{t("abrechnung.je_einsatz")}</option>
          </NativeSelect>
        </Feld>
        <div className="grid grid-cols-2 gap-2">
          <Feld label={t("einstellungen.satz")}><Input inputMode="decimal" value={neu.satz} onChange={(e) => setNeu((x) => ({ ...x, satz: e.target.value }))} /></Feld>
          <Feld label={t("akte.felder.currency")}><Input value={neu.currency} maxLength={3} onChange={(e) => setNeu((x) => ({ ...x, currency: e.target.value }))} /></Feld>
        </div>
        <Feld label={t("notiz")}><Textarea rows={2} value={neu.notiz} onChange={(e) => setNeu((x) => ({ ...x, notiz: e.target.value }))} /></Feld>
        <Button type="submit" disabled={busy || !neu.name.trim() || (Boolean(neu.satz.trim()) && !neu.currency.trim())} className="rounded-full">
          {t("anlegen")}
        </Button>
      </form>
    </div>
  );
}

// --- Urlaubssperren ------------------------------------------------------------

function SperrenAbschnitt({ sperren, bereiche }: { sperren: Urlaubssperre[]; bereiche: Arbeitsbereich[] }) {
  const t = useTranslations("personal");
  const locale = useLocale();
  const router = useRouter();
  const [neu, setNeu] = useState({ von: "", bis: "", grund: "", arbeitsbereich_id: "" });
  const [busy, setBusy] = useState(false);

  async function anlegen(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const res = await createUrlaubssperre({ von: neu.von, bis: neu.bis || neu.von, grund: neu.grund.trim(), arbeitsbereich_id: neu.arbeitsbereich_id || null });
    setBusy(false);
    if (!res.ok) return void toast.error(res.error);
    setNeu({ von: "", bis: "", grund: "", arbeitsbereich_id: "" });
    router.refresh();
  }

  async function entfernen(id: string) {
    const res = await deleteUrlaubssperre(id);
    if (!res.ok) return void toast.error(res.error);
    router.refresh();
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
      <section className="rounded-2xl border bg-card p-4">
        <h2 className="mb-1 font-display text-lg font-extrabold">{t("einstellungen.tabs.sperren")}</h2>
        <p className="mb-3 text-sm text-muted-foreground">{t("einstellungen.sperrenHint")}</p>
        <ul className="divide-y text-sm">
          {sperren.map((s) => (
            <li key={s.id} className="flex items-center gap-3 py-2">
              <span className="w-44">{formatDate(s.von, locale)} – {formatDate(s.bis, locale)}</span>
              <span className="flex-1 font-medium">{s.grund}</span>
              <span className="text-muted-foreground">{bereiche.find((b) => b.id === s.arbeitsbereich_id)?.name ?? t("einstellungen.alleBereiche")}</span>
              <Button variant="ghost" size="icon" onClick={() => entfernen(s.id)} aria-label={t("loeschen")}><Icon icon="ph:trash" className="size-4" /></Button>
            </li>
          ))}
          {sperren.length === 0 && <li className="py-2 text-muted-foreground">{t("einstellungen.keineSperren")}</li>}
        </ul>
      </section>
      <form onSubmit={anlegen} className="flex flex-col gap-3 rounded-2xl border bg-card p-4">
        <h2 className="font-display text-lg font-extrabold">{t("einstellungen.sperreNeu")}</h2>
        <Feld label={t("von")}><DatePicker value={neu.von} onChange={(v) => setNeu((x) => ({ ...x, von: v }))} /></Feld>
        <Feld label={t("bis")}><DatePicker value={neu.bis} onChange={(v) => setNeu((x) => ({ ...x, bis: v }))} /></Feld>
        <Feld label={t("grund")}><Input value={neu.grund} onChange={(e) => setNeu((x) => ({ ...x, grund: e.target.value }))} required /></Feld>
        <Feld label={t("arbeitsbereich")}>
          <NativeSelect value={neu.arbeitsbereich_id} onChange={(e) => setNeu((x) => ({ ...x, arbeitsbereich_id: e.target.value }))}>
            <option value="">{t("einstellungen.alleBereiche")}</option>
            {bereiche.filter((b) => !b.archived_at).map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </NativeSelect>
        </Feld>
        <Button type="submit" disabled={busy || !neu.von || !neu.grund.trim()} className="rounded-full">{t("anlegen")}</Button>
      </form>
    </div>
  );
}
