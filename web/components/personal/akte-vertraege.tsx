"use client";

// Reiter „Verträge": Verträge & Vereinbarungen mit Nachträgen (Taskilo
// ContractsTab). Bedingungen als Paare, Unterzeichner als Liste, Nachtrag mit
// Feld-Diff (alt → neu).
import { Icon } from "@iconify/react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@nextdays/ui/button";
import { DatePicker } from "@nextdays/ui/date-picker";
import { Input } from "@nextdays/ui/input";
import { NativeSelect } from "@nextdays/ui/native-select";
import { Textarea } from "@nextdays/ui/textarea";
import { createNachtrag, createVertrag, deleteKarteiEintrag, deleteNachtrag, updateVertrag } from "@/lib/personal";
import {
  type Aenderung,
  type Dokument,
  type Paar,
  VERTRAG_ARTEN,
  VERTRAG_STATUS,
  type Vertrag,
  type VertragArt,
  type VertragInput,
  type VertragStatus,
} from "@/lib/personal-typen";
import { formatDate } from "@/lib/utils";

import { Feld, Leer, ListenFeld, Modal, PaarFeld, ReiterKopf, feldOderGeleert } from "./kartei-helfer";

const STATUS_FARBE: Record<VertragStatus, string> = {
  entwurf: "bg-secondary text-muted-foreground",
  aktiv: "bg-emerald-100 text-emerald-800",
  abgelaufen: "bg-amber-100 text-amber-800",
  beendet: "bg-destructive/10 text-destructive",
};

export function AkteVertraege({ userId, vertraege, dokumente }: { userId: string; vertraege: Vertrag[]; dokumente: Dokument[] }) {
  const t = useTranslations("personal");
  const locale = useLocale();
  const router = useRouter();
  const [dialog, setDialog] = useState<{ v: Vertrag | null } | null>(null);
  const [nachtragFuer, setNachtragFuer] = useState<Vertrag | null>(null);
  const [offen, setOffen] = useState<string | null>(null);

  async function loeschen(v: Vertrag) {
    if (!window.confirm(t("kartei.loeschenFrage", { titel: v.titel }))) return;
    const res = await deleteKarteiEintrag("vertraege", v.id);
    if (!res.ok) return void toast.error(res.error);
    router.refresh();
  }

  async function nachtragLoeschen(id: string) {
    const res = await deleteNachtrag(id);
    if (!res.ok) return void toast.error(res.error);
    router.refresh();
  }

  return (
    <section className="rounded-2xl border bg-card p-4">
      <ReiterKopf titel={t("akte.tabs.vertraege")} hint={t("kartei.vertraegeHint")} onNeu={() => setDialog({ v: null })} neuLabel={t("kartei.vertragNeu")} />
      {vertraege.length === 0 ? (
        <Leer text={t("kartei.keineVertraege")} />
      ) : (
        <ul className="divide-y">
          {vertraege.map((v) => (
            <li key={v.id} className="py-3">
              <div className="flex flex-wrap items-center gap-3">
                <span className={`rounded-full px-2 py-0.5 text-xs ${STATUS_FARBE[v.status]}`}>{t(`vertragStatus.${v.status}`)}</span>
                <button type="button" className="min-w-0 flex-1 text-left" onClick={() => setOffen(offen === v.id ? null : v.id)}>
                  <div className="font-medium">{v.titel}</div>
                  <div className="text-xs text-muted-foreground">
                    {t(`vertragArt.${v.art}`)}
                    {v.version ? ` · v${v.version}` : ""}
                    {v.gueltig_ab ? ` · ${t("kartei.gueltigAb", { datum: formatDate(v.gueltig_ab, locale) })}` : ""}
                    {v.gueltig_bis ? ` – ${formatDate(v.gueltig_bis, locale)}` : ""}
                    {v.nachtraege.length > 0 ? ` · ${t("kartei.nachtraegeAnzahl", { anzahl: v.nachtraege.length })}` : ""}
                  </div>
                </button>
                <Button variant="outline" size="sm" className="rounded-full" onClick={() => setNachtragFuer(v)}>
                  {t("kartei.nachtrag")}
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setDialog({ v })}>{t("kartei.bearbeiten")}</Button>
                <Button variant="ghost" size="icon" aria-label={t("loeschen")} onClick={() => loeschen(v)}>
                  <Icon icon="ph:trash" className="size-4" />
                </Button>
              </div>
              {offen === v.id && (
                <div className="mt-2 grid gap-3 rounded-xl bg-secondary/40 p-3 text-sm sm:grid-cols-2">
                  {v.beschreibung && <p className="sm:col-span-2">{v.beschreibung}</p>}
                  <Zeile label={t("kartei.unterzeichnetAm")} wert={v.unterzeichnet_am ? formatDate(v.unterzeichnet_am, locale) : "—"} />
                  <Zeile label={t("kartei.unterzeichner")} wert={v.unterzeichner.join(", ") || "—"} />
                  {v.bedingungen.length > 0 && (
                    <div className="sm:col-span-2">
                      <p className="text-xs text-muted-foreground">{t("kartei.bedingungen")}</p>
                      <dl className="grid grid-cols-[auto_1fr] gap-x-3">
                        {v.bedingungen.map((b, i) => (
                          <Paare key={i} p={b} />
                        ))}
                      </dl>
                    </div>
                  )}
                  {v.verlaengerung && <Zeile label={t("kartei.verlaengerung")} wert={v.verlaengerung} />}
                  {v.kuendigung && <Zeile label={t("kartei.kuendigung")} wert={v.kuendigung} />}
                  {v.dokument_titel && <Zeile label={t("akte.tabs.dokumente")} wert={v.dokument_titel} />}
                  {v.nachtraege.length > 0 && (
                    <div className="sm:col-span-2">
                      <p className="mb-1 text-xs text-muted-foreground">{t("kartei.nachtraege")}</p>
                      <ul className="divide-y rounded-lg border bg-card">
                        {v.nachtraege.map((n) => (
                          <li key={n.id} className="flex flex-wrap items-start gap-2 p-2">
                            <span className="w-24 text-muted-foreground">{formatDate(n.datum, locale)}</span>
                            <div className="min-w-0 flex-1">
                              <div>{n.beschreibung}</div>
                              {n.grund && <div className="text-xs text-muted-foreground">{t("grund")}: {n.grund}</div>}
                              {n.aenderungen.map((a, i) => (
                                <div key={i} className="text-xs text-muted-foreground">
                                  {a.feld}: <s>{a.alt || "—"}</s> → {a.neu || "—"}
                                </div>
                              ))}
                              {n.autorisiert_von_name && <div className="text-xs text-muted-foreground">{t("kartei.autorisiertVon", { name: n.autorisiert_von_name })}</div>}
                            </div>
                            <Button variant="ghost" size="icon" aria-label={t("loeschen")} onClick={() => nachtragLoeschen(n.id)}>
                              <Icon icon="ph:trash" className="size-4" />
                            </Button>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
      {dialog && <VertragDialog userId={userId} vertrag={dialog.v} dokumente={dokumente} onClose={() => setDialog(null)} />}
      {nachtragFuer && <NachtragDialog vertrag={nachtragFuer} onClose={() => setNachtragFuer(null)} />}
    </section>
  );
}

function Zeile({ label, wert }: { label: string; wert: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p>{wert}</p>
    </div>
  );
}

function Paare({ p }: { p: Paar }) {
  return (
    <>
      <dt className="text-muted-foreground">{p.schluessel}</dt>
      <dd>{p.wert}</dd>
    </>
  );
}

function VertragDialog({ userId, vertrag, dokumente, onClose }: { userId: string; vertrag: Vertrag | null; dokumente: Dokument[]; onClose: () => void }) {
  const t = useTranslations("personal");
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [f, setF] = useState({
    art: (vertrag?.art ?? "arbeitsvertrag") as VertragArt,
    titel: vertrag?.titel ?? "",
    beschreibung: vertrag?.beschreibung ?? "",
    status: (vertrag?.status ?? "aktiv") as VertragStatus,
    version: vertrag?.version ?? "",
    unterzeichnet_am: vertrag?.unterzeichnet_am ?? "",
    gueltig_ab: vertrag?.gueltig_ab ?? "",
    gueltig_bis: vertrag?.gueltig_bis ?? "",
    unterzeichner: vertrag?.unterzeichner ?? [],
    bedingungen: vertrag?.bedingungen ?? [],
    verlaengerung: vertrag?.verlaengerung ?? "",
    kuendigung: vertrag?.kuendigung ?? "",
    dokument_id: vertrag?.dokument_id ?? "",
  });
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((x) => ({ ...x, [k]: v }));

  async function absenden(e: React.FormEvent) {
    e.preventDefault();
    const geleert: string[] = [];
    const body: Record<string, unknown> = { art: f.art, titel: f.titel.trim(), status: f.status };
    feldOderGeleert(body, geleert, "beschreibung", f.beschreibung);
    feldOderGeleert(body, geleert, "version", f.version);
    feldOderGeleert(body, geleert, "unterzeichnet_am", f.unterzeichnet_am);
    feldOderGeleert(body, geleert, "gueltig_ab", f.gueltig_ab);
    feldOderGeleert(body, geleert, "gueltig_bis", f.gueltig_bis);
    feldOderGeleert(body, geleert, "verlaengerung", f.verlaengerung);
    feldOderGeleert(body, geleert, "kuendigung", f.kuendigung);
    feldOderGeleert(body, geleert, "dokument_id", f.dokument_id);
    body.unterzeichner = f.unterzeichner.map((s) => s.trim()).filter(Boolean);
    body.bedingungen = f.bedingungen.filter((p) => p.schluessel.trim());
    setBusy(true);
    const res = vertrag
      ? await updateVertrag(vertrag.id, { ...(body as VertragInput), geleert })
      : await createVertrag(userId, body as VertragInput);
    setBusy(false);
    if (!res.ok) return void toast.error(res.error);
    toast.success(t("akte.gespeichert"));
    router.refresh();
    onClose();
  }

  return (
    <Modal titel={vertrag ? t("kartei.vertragBearbeiten") : t("kartei.vertragNeu")} onClose={onClose} onSubmit={absenden} busy={busy || !f.titel.trim()} breit>
      <div className="grid gap-3 sm:grid-cols-2">
        <Feld label={t("kartei.art")}>
          <NativeSelect value={f.art} onChange={(e) => set("art", e.target.value as VertragArt)}>
            {VERTRAG_ARTEN.map((a) => <option key={a} value={a}>{t(`vertragArt.${a}`)}</option>)}
          </NativeSelect>
        </Feld>
        <Feld label={t("kartei.status")}>
          <NativeSelect value={f.status} onChange={(e) => set("status", e.target.value as VertragStatus)}>
            {VERTRAG_STATUS.map((s) => <option key={s} value={s}>{t(`vertragStatus.${s}`)}</option>)}
          </NativeSelect>
        </Feld>
        <Feld label={t("akte.felder.dokTitel")}><Input value={f.titel} onChange={(e) => set("titel", e.target.value)} required /></Feld>
        <Feld label={t("kartei.version")}><Input value={f.version} onChange={(e) => set("version", e.target.value)} placeholder="1.0" /></Feld>
        <Feld label={t("kartei.unterzeichnetAm")}><DatePicker value={f.unterzeichnet_am} onChange={(v) => set("unterzeichnet_am", v)} /></Feld>
        <Feld label={t("kartei.gueltigAbLabel")}><DatePicker value={f.gueltig_ab} onChange={(v) => set("gueltig_ab", v)} /></Feld>
        <Feld label={t("akte.felder.ablauf_am")}><DatePicker value={f.gueltig_bis} onChange={(v) => set("gueltig_bis", v)} /></Feld>
        <Feld label={t("akte.tabs.dokumente")}>
          <NativeSelect value={f.dokument_id} onChange={(e) => set("dokument_id", e.target.value)}>
            <option value="">—</option>
            {dokumente.map((d) => <option key={d.id} value={d.id}>{d.titel}</option>)}
          </NativeSelect>
        </Feld>
      </div>
      <Feld label={t("kartei.beschreibung")}><Textarea rows={2} value={f.beschreibung} onChange={(e) => set("beschreibung", e.target.value)} /></Feld>
      <ListenFeld label={t("kartei.unterzeichner")} werte={f.unterzeichner} onChange={(v) => set("unterzeichner", v)} />
      <PaarFeld label={t("kartei.bedingungen")} werte={f.bedingungen} onChange={(v) => set("bedingungen", v)} />
      <Feld label={t("kartei.verlaengerung")}><Textarea rows={2} value={f.verlaengerung} onChange={(e) => set("verlaengerung", e.target.value)} /></Feld>
      <Feld label={t("kartei.kuendigung")}><Textarea rows={2} value={f.kuendigung} onChange={(e) => set("kuendigung", e.target.value)} /></Feld>
    </Modal>
  );
}

function NachtragDialog({ vertrag, onClose }: { vertrag: Vertrag; onClose: () => void }) {
  const t = useTranslations("personal");
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [f, setF] = useState<{ datum: string; beschreibung: string; grund: string; aenderungen: Aenderung[] }>({
    datum: new Date().toISOString().slice(0, 10),
    beschreibung: "",
    grund: "",
    aenderungen: [],
  });

  async function absenden(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const res = await createNachtrag(vertrag.id, {
      datum: f.datum,
      beschreibung: f.beschreibung.trim(),
      grund: f.grund.trim() || null,
      aenderungen: f.aenderungen.filter((a) => a.feld.trim()),
    });
    setBusy(false);
    if (!res.ok) return void toast.error(res.error);
    toast.success(t("akte.gespeichert"));
    router.refresh();
    onClose();
  }

  return (
    <Modal titel={t("kartei.nachtragZu", { titel: vertrag.titel })} onClose={onClose} onSubmit={absenden} busy={busy || !f.beschreibung.trim() || !f.datum}>
      <Feld label={t("datum")}><DatePicker value={f.datum} onChange={(v) => setF((x) => ({ ...x, datum: v }))} /></Feld>
      <Feld label={t("kartei.beschreibung")}><Textarea rows={2} value={f.beschreibung} onChange={(e) => setF((x) => ({ ...x, beschreibung: e.target.value }))} required /></Feld>
      <Feld label={t("grund")}><Input value={f.grund} onChange={(e) => setF((x) => ({ ...x, grund: e.target.value }))} /></Feld>
      <div className="flex flex-col gap-1">
        <span className="font-medium">{t("kartei.geaenderteFelder")}</span>
        {f.aenderungen.map((a, i) => (
          <div key={i} className="grid grid-cols-[1fr_1fr_1fr_auto] gap-2">
            <Input placeholder={t("kartei.feld")} value={a.feld} onChange={(e) => setF((x) => ({ ...x, aenderungen: x.aenderungen.map((y, j) => (j === i ? { ...y, feld: e.target.value } : y)) }))} />
            <Input placeholder={t("kartei.alt")} value={a.alt} onChange={(e) => setF((x) => ({ ...x, aenderungen: x.aenderungen.map((y, j) => (j === i ? { ...y, alt: e.target.value } : y)) }))} />
            <Input placeholder={t("kartei.neu")} value={a.neu} onChange={(e) => setF((x) => ({ ...x, aenderungen: x.aenderungen.map((y, j) => (j === i ? { ...y, neu: e.target.value } : y)) }))} />
            <Button type="button" variant="ghost" size="icon" aria-label={t("loeschen")} onClick={() => setF((x) => ({ ...x, aenderungen: x.aenderungen.filter((_, j) => j !== i) }))}>
              <Icon icon="ph:x" className="size-4" />
            </Button>
          </div>
        ))}
        <Button type="button" variant="outline" size="sm" className="w-fit rounded-full" onClick={() => setF((x) => ({ ...x, aenderungen: [...x.aenderungen, { feld: "", alt: "", neu: "" }] }))}>
          <Icon icon="ph:plus" className="mr-1 size-4" />
          {t("kartei.eintragHinzufuegen")}
        </Button>
      </div>
    </Modal>
  );
}
