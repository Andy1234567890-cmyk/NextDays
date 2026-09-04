"use client";

// Reiter „Disziplin": Maßnahmen (Ermahnung … Kündigung, mit Stellungnahme,
// Folgetermin, gelöst) und Arbeitsplatzvorfälle (Art, Schweregrad, Zeugen,
// Maßnahmen, Prävention) — Taskilo DisciplinaryTab.
import { Icon } from "@iconify/react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@nextdays/ui/button";
import { DatePicker } from "@nextdays/ui/date-picker";
import { Input } from "@nextdays/ui/input";
import { NativeSelect } from "@nextdays/ui/native-select";
import { Switch } from "@nextdays/ui/switch";
import { Textarea } from "@nextdays/ui/textarea";
import { createMassnahme, createVorfall, deleteKarteiEintrag, updateMassnahme, updateVorfall } from "@/lib/personal";
import {
  type Dokument,
  MASSNAHME_ARTEN,
  type Massnahme,
  type MassnahmeArt,
  type MassnahmeInput,
  VORFALL_ARTEN,
  VORFALL_SCHWEREN,
  type Vorfall,
  type VorfallArt,
  type VorfallInput,
  type VorfallSchwere,
} from "@/lib/personal-typen";
import { formatDate } from "@/lib/utils";

import { Feld, Leer, ListenFeld, Modal, ReiterKopf, feldOderGeleert } from "./kartei-helfer";

const SCHWERE_FARBE: Record<VorfallSchwere, string> = {
  gering: "bg-secondary text-muted-foreground",
  mittel: "bg-amber-100 text-amber-800",
  hoch: "bg-orange-100 text-orange-800",
  kritisch: "bg-destructive/10 text-destructive",
};

export function AkteDisziplin({ userId, massnahmen, vorfaelle, dokumente }: { userId: string; massnahmen: Massnahme[]; vorfaelle: Vorfall[]; dokumente: Dokument[] }) {
  const t = useTranslations("personal");
  const locale = useLocale();
  const router = useRouter();
  const [mDialog, setMDialog] = useState<{ m: Massnahme | null } | null>(null);
  const [vDialog, setVDialog] = useState<{ v: Vorfall | null } | null>(null);

  async function loeschen(bereich: "massnahmen" | "vorfaelle", id: string, titel: string) {
    if (!window.confirm(t("kartei.loeschenFrage", { titel }))) return;
    const res = await deleteKarteiEintrag(bereich, id);
    if (!res.ok) return void toast.error(res.error);
    router.refresh();
  }

  async function geloestToggle(m: Massnahme) {
    const res = await updateMassnahme(m.id, { geloest: !m.geloest });
    if (!res.ok) return void toast.error(res.error);
    router.refresh();
  }

  return (
    <div className="grid gap-6 xl:grid-cols-2">
      <section className="rounded-2xl border bg-card p-4">
        <ReiterKopf titel={t("kartei.massnahmen")} hint={t("kartei.massnahmenHint")} onNeu={() => setMDialog({ m: null })} />
        {massnahmen.length === 0 ? (
          <Leer text={t("kartei.keineMassnahmen")} />
        ) : (
          <ul className="divide-y">
            {massnahmen.map((m) => (
              <li key={m.id} className="flex flex-wrap items-start gap-3 py-3 text-sm">
                <span className={`rounded-full px-2 py-0.5 text-xs ${m.geloest ? "bg-emerald-100 text-emerald-800" : "bg-destructive/10 text-destructive"}`}>
                  {t(`massnahmeArt.${m.art}`)}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="font-medium">{m.grund}</div>
                  <div className="text-xs text-muted-foreground">
                    {formatDate(m.datum, locale)}
                    {m.ausgestellt_von_name ? ` · ${t("kartei.ausgestelltVon", { name: m.ausgestellt_von_name })}` : ""}
                    {m.zeuge ? ` · ${t("kartei.zeuge")}: ${m.zeuge}` : ""}
                    {m.folgetermin ? ` · ${t("kartei.folgetermin")}: ${formatDate(m.folgetermin, locale)}` : ""}
                    {m.dokument_titel ? ` · ${m.dokument_titel}` : ""}
                  </div>
                  {m.beschreibung && <p className="mt-1 whitespace-pre-line">{m.beschreibung}</p>}
                  {m.stellungnahme && (
                    <p className="mt-1 rounded-lg bg-secondary/50 p-2 text-xs">
                      <span className="font-medium">{t("kartei.stellungnahme")}:</span> {m.stellungnahme}
                    </p>
                  )}
                  {m.geloest && (
                    <p className="mt-1 text-xs text-emerald-800">
                      {t("kartei.geloestAm", { datum: m.geloest_am ? formatDate(m.geloest_am, locale) : "—" })}
                      {m.loesung ? ` · ${m.loesung}` : ""}
                    </p>
                  )}
                </div>
                <label className="flex items-center gap-2 text-xs">
                  {t("kartei.geloest")}
                  <Switch checked={m.geloest} onCheckedChange={() => geloestToggle(m)} />
                </label>
                <Button variant="ghost" size="sm" onClick={() => setMDialog({ m })}>{t("kartei.bearbeiten")}</Button>
                <Button variant="ghost" size="icon" aria-label={t("loeschen")} onClick={() => loeschen("massnahmen", m.id, m.grund)}>
                  <Icon icon="ph:trash" className="size-4" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-2xl border bg-card p-4">
        <ReiterKopf titel={t("kartei.vorfaelle")} hint={t("kartei.vorfaelleHint")} onNeu={() => setVDialog({ v: null })} />
        {vorfaelle.length === 0 ? (
          <Leer text={t("kartei.keineVorfaelle")} />
        ) : (
          <ul className="divide-y">
            {vorfaelle.map((v) => (
              <li key={v.id} className="flex flex-wrap items-start gap-3 py-3 text-sm">
                <span className={`rounded-full px-2 py-0.5 text-xs ${SCHWERE_FARBE[v.schwere]}`}>{t(`vorfallSchwere.${v.schwere}`)}</span>
                <div className="min-w-0 flex-1">
                  <div className="font-medium">
                    {t(`vorfallArt.${v.art}`)}
                    {v.folge_noetig && <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-800">{t("kartei.folgeNoetig")}</span>}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {formatDate(v.datum, locale)}
                    {v.ort ? ` · ${v.ort}` : ""}
                    {v.gemeldet_von_name ? ` · ${t("kartei.gemeldetVon", { name: v.gemeldet_von_name })}` : ""}
                    {v.zeugen.length > 0 ? ` · ${t("kartei.zeugen")}: ${v.zeugen.join(", ")}` : ""}
                  </div>
                  <p className="mt-1 whitespace-pre-line">{v.beschreibung}</p>
                  {v.massnahmen && <p className="mt-1 text-xs"><span className="font-medium">{t("kartei.ergriffeneMassnahmen")}:</span> {v.massnahmen}</p>}
                  {v.praevention && <p className="mt-1 text-xs"><span className="font-medium">{t("kartei.praevention")}:</span> {v.praevention}</p>}
                </div>
                <Button variant="ghost" size="sm" onClick={() => setVDialog({ v })}>{t("kartei.bearbeiten")}</Button>
                <Button variant="ghost" size="icon" aria-label={t("loeschen")} onClick={() => loeschen("vorfaelle", v.id, t(`vorfallArt.${v.art}`))}>
                  <Icon icon="ph:trash" className="size-4" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {mDialog && <MassnahmeDialog userId={userId} m={mDialog.m} dokumente={dokumente} onClose={() => setMDialog(null)} />}
      {vDialog && <VorfallDialog userId={userId} v={vDialog.v} onClose={() => setVDialog(null)} />}
    </div>
  );
}

function MassnahmeDialog({ userId, m, dokumente, onClose }: { userId: string; m: Massnahme | null; dokumente: Dokument[]; onClose: () => void }) {
  const t = useTranslations("personal");
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [f, setF] = useState({
    art: (m?.art ?? "ermahnung") as MassnahmeArt,
    datum: m?.datum ?? new Date().toISOString().slice(0, 10),
    grund: m?.grund ?? "",
    beschreibung: m?.beschreibung ?? "",
    zeuge: m?.zeuge ?? "",
    stellungnahme: m?.stellungnahme ?? "",
    folgetermin: m?.folgetermin ?? "",
    loesung: m?.loesung ?? "",
    dokument_id: m?.dokument_id ?? "",
  });
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((x) => ({ ...x, [k]: v }));

  async function absenden(e: React.FormEvent) {
    e.preventDefault();
    const geleert: string[] = [];
    const body: Record<string, unknown> = { art: f.art, datum: f.datum, grund: f.grund.trim() };
    feldOderGeleert(body, geleert, "beschreibung", f.beschreibung);
    feldOderGeleert(body, geleert, "zeuge", f.zeuge);
    feldOderGeleert(body, geleert, "stellungnahme", f.stellungnahme);
    feldOderGeleert(body, geleert, "folgetermin", f.folgetermin);
    feldOderGeleert(body, geleert, "dokument_id", f.dokument_id);
    if (m) feldOderGeleert(body, geleert, "loesung", f.loesung);
    setBusy(true);
    const res = m ? await updateMassnahme(m.id, { ...(body as MassnahmeInput), geleert }) : await createMassnahme(userId, body as MassnahmeInput);
    setBusy(false);
    if (!res.ok) return void toast.error(res.error);
    toast.success(t("akte.gespeichert"));
    router.refresh();
    onClose();
  }

  return (
    <Modal titel={m ? t("kartei.massnahmeBearbeiten") : t("kartei.massnahmeNeu")} onClose={onClose} onSubmit={absenden} busy={busy || !f.grund.trim() || !f.datum} breit>
      <div className="grid gap-3 sm:grid-cols-2">
        <Feld label={t("kartei.art")}>
          <NativeSelect value={f.art} onChange={(e) => set("art", e.target.value as MassnahmeArt)}>
            {MASSNAHME_ARTEN.map((a) => <option key={a} value={a}>{t(`massnahmeArt.${a}`)}</option>)}
          </NativeSelect>
        </Feld>
        <Feld label={t("datum")}><DatePicker value={f.datum} onChange={(v) => set("datum", v)} /></Feld>
        <Feld label={t("kartei.zeuge")}><Input value={f.zeuge} onChange={(e) => set("zeuge", e.target.value)} /></Feld>
        <Feld label={t("kartei.folgetermin")}><DatePicker value={f.folgetermin} onChange={(v) => set("folgetermin", v)} /></Feld>
        <Feld label={t("akte.tabs.dokumente")}>
          <NativeSelect value={f.dokument_id} onChange={(e) => set("dokument_id", e.target.value)}>
            <option value="">—</option>
            {dokumente.map((d) => <option key={d.id} value={d.id}>{d.titel}</option>)}
          </NativeSelect>
        </Feld>
      </div>
      <Feld label={t("grund")}><Input value={f.grund} onChange={(e) => set("grund", e.target.value)} required /></Feld>
      <Feld label={t("kartei.beschreibung")}><Textarea rows={3} value={f.beschreibung} onChange={(e) => set("beschreibung", e.target.value)} /></Feld>
      <Feld label={t("kartei.stellungnahme")}><Textarea rows={2} value={f.stellungnahme} onChange={(e) => set("stellungnahme", e.target.value)} /></Feld>
      {m && <Feld label={t("kartei.loesung")}><Textarea rows={2} value={f.loesung} onChange={(e) => set("loesung", e.target.value)} /></Feld>}
    </Modal>
  );
}

function VorfallDialog({ userId, v, onClose }: { userId: string; v: Vorfall | null; onClose: () => void }) {
  const t = useTranslations("personal");
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [f, setF] = useState({
    datum: v?.datum ?? new Date().toISOString().slice(0, 10),
    art: (v?.art ?? "sonstiges") as VorfallArt,
    schwere: (v?.schwere ?? "gering") as VorfallSchwere,
    ort: v?.ort ?? "",
    beschreibung: v?.beschreibung ?? "",
    zeugen: v?.zeugen ?? [],
    massnahmen: v?.massnahmen ?? "",
    praevention: v?.praevention ?? "",
    folge_noetig: v?.folge_noetig ?? false,
  });
  const set = <K extends keyof typeof f>(k: K, w: (typeof f)[K]) => setF((x) => ({ ...x, [k]: w }));

  async function absenden(e: React.FormEvent) {
    e.preventDefault();
    const geleert: string[] = [];
    const body: Record<string, unknown> = { datum: f.datum, art: f.art, schwere: f.schwere, beschreibung: f.beschreibung.trim(), folge_noetig: f.folge_noetig };
    feldOderGeleert(body, geleert, "ort", f.ort);
    feldOderGeleert(body, geleert, "massnahmen", f.massnahmen);
    feldOderGeleert(body, geleert, "praevention", f.praevention);
    body.zeugen = f.zeugen.map((s) => s.trim()).filter(Boolean);
    setBusy(true);
    const res = v ? await updateVorfall(v.id, { ...(body as VorfallInput), geleert }) : await createVorfall(userId, body as VorfallInput);
    setBusy(false);
    if (!res.ok) return void toast.error(res.error);
    toast.success(t("akte.gespeichert"));
    router.refresh();
    onClose();
  }

  return (
    <Modal titel={v ? t("kartei.vorfallBearbeiten") : t("kartei.vorfallNeu")} onClose={onClose} onSubmit={absenden} busy={busy || !f.beschreibung.trim() || !f.datum} breit>
      <div className="grid gap-3 sm:grid-cols-2">
        <Feld label={t("datum")}><DatePicker value={f.datum} onChange={(w) => set("datum", w)} /></Feld>
        <Feld label={t("kartei.ort")}><Input value={f.ort} onChange={(e) => set("ort", e.target.value)} /></Feld>
        <Feld label={t("kartei.art")}>
          <NativeSelect value={f.art} onChange={(e) => set("art", e.target.value as VorfallArt)}>
            {VORFALL_ARTEN.map((a) => <option key={a} value={a}>{t(`vorfallArt.${a}`)}</option>)}
          </NativeSelect>
        </Feld>
        <Feld label={t("kartei.schwere")}>
          <NativeSelect value={f.schwere} onChange={(e) => set("schwere", e.target.value as VorfallSchwere)}>
            {VORFALL_SCHWEREN.map((s) => <option key={s} value={s}>{t(`vorfallSchwere.${s}`)}</option>)}
          </NativeSelect>
        </Feld>
      </div>
      <Feld label={t("kartei.beschreibung")}><Textarea rows={3} value={f.beschreibung} onChange={(e) => set("beschreibung", e.target.value)} required /></Feld>
      <ListenFeld label={t("kartei.zeugen")} werte={f.zeugen} onChange={(w) => set("zeugen", w)} />
      <Feld label={t("kartei.ergriffeneMassnahmen")}><Textarea rows={2} value={f.massnahmen} onChange={(e) => set("massnahmen", e.target.value)} /></Feld>
      <Feld label={t("kartei.praevention")}><Textarea rows={2} value={f.praevention} onChange={(e) => set("praevention", e.target.value)} /></Feld>
      <div className="flex items-center justify-between">
        <span>{t("kartei.folgeNoetig")}</span>
        <Switch checked={f.folge_noetig} onCheckedChange={(w) => set("folge_noetig", w)} />
      </div>
    </Modal>
  );
}
