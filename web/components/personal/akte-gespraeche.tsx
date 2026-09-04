"use client";

// Reiter „Gespräche": Feedback- und Mitarbeitergespräche mit Bewertung 1–5,
// Notizen, Zielen, Erfolgen, Entwicklungsfeldern und Historie (Taskilo
// FeedbackTab).
import { Icon } from "@iconify/react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@nextdays/ui/button";
import { DatePicker } from "@nextdays/ui/date-picker";
import { NativeSelect } from "@nextdays/ui/native-select";
import { Textarea } from "@nextdays/ui/textarea";
import { createGespraech, deleteKarteiEintrag, updateGespraech } from "@/lib/personal";
import { GESPRAECH_ARTEN, type Gespraech, type GespraechArt, type GespraechInput } from "@/lib/personal-typen";
import { formatDate } from "@/lib/utils";

import { Feld, Leer, ListenFeld, Modal, ReiterKopf, feldOderGeleert } from "./kartei-helfer";

function Sterne({ n, onChange }: { n: number | null; onChange?: (v: number) => void }) {
  return (
    <span className="inline-flex gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <button
          key={i}
          type="button"
          disabled={!onChange}
          onClick={() => onChange?.(i)}
          aria-label={String(i)}
          className={onChange ? "cursor-pointer" : "cursor-default"}
        >
          <Icon icon={n !== null && i <= n ? "ph:star-fill" : "ph:star"} className={`size-4 ${n !== null && i <= n ? "text-amber-500" : "text-muted-foreground"}`} />
        </button>
      ))}
    </span>
  );
}

export function AkteGespraeche({ userId, gespraeche }: { userId: string; gespraeche: Gespraech[] }) {
  const t = useTranslations("personal");
  const locale = useLocale();
  const router = useRouter();
  const [dialog, setDialog] = useState<{ g: Gespraech | null } | null>(null);

  async function loeschen(g: Gespraech) {
    if (!window.confirm(t("kartei.loeschenFrage", { titel: `${t(`gespraechArt.${g.art}`)} ${formatDate(g.datum, locale)}` }))) return;
    const res = await deleteKarteiEintrag("gespraeche", g.id);
    if (!res.ok) return void toast.error(res.error);
    router.refresh();
  }

  const schnitt = gespraeche.filter((g) => g.bewertung !== null);
  const mittel = schnitt.length ? schnitt.reduce((n, g) => n + (g.bewertung ?? 0), 0) / schnitt.length : null;

  return (
    <section className="rounded-2xl border bg-card p-4">
      <ReiterKopf titel={t("akte.tabs.gespraeche")} hint={t("kartei.gespraecheHint")} onNeu={() => setDialog({ g: null })} neuLabel={t("kartei.gespraechNeu")} />
      {mittel !== null && (
        <p className="mb-3 flex items-center gap-2 text-sm text-muted-foreground">
          {t("kartei.bewertungSchnitt", { anzahl: schnitt.length })} <Sterne n={Math.round(mittel)} /> {mittel.toFixed(1)}
        </p>
      )}
      {gespraeche.length === 0 ? (
        <Leer text={t("kartei.keineGespraeche")} />
      ) : (
        <ul className="divide-y">
          {gespraeche.map((g) => (
            <li key={g.id} className="flex flex-wrap items-start gap-3 py-3 text-sm">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2 font-medium">
                  {t(`gespraechArt.${g.art}`)}
                  <Sterne n={g.bewertung} />
                </div>
                <div className="text-xs text-muted-foreground">
                  {formatDate(g.datum, locale)}
                  {g.gefuehrt_von_name ? ` · ${t("kartei.gefuehrtVon", { name: g.gefuehrt_von_name })}` : ""}
                  {g.naechstes_am ? ` · ${t("kartei.naechstesAm", { datum: formatDate(g.naechstes_am, locale) })}` : ""}
                </div>
                {g.notizen && <p className="mt-1 whitespace-pre-line">{g.notizen}</p>}
                <div className="mt-2 grid gap-2 sm:grid-cols-3">
                  <Punkte titel={t("kartei.ziele")} werte={g.ziele} />
                  <Punkte titel={t("kartei.erfolge")} werte={g.erfolge} />
                  <Punkte titel={t("kartei.entwicklung")} werte={g.entwicklung} />
                </div>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setDialog({ g })}>{t("kartei.bearbeiten")}</Button>
              <Button variant="ghost" size="icon" aria-label={t("loeschen")} onClick={() => loeschen(g)}>
                <Icon icon="ph:trash" className="size-4" />
              </Button>
            </li>
          ))}
        </ul>
      )}
      {dialog && <GespraechDialog userId={userId} g={dialog.g} onClose={() => setDialog(null)} />}
    </section>
  );
}

function Punkte({ titel, werte }: { titel: string; werte: string[] }) {
  if (werte.length === 0) return null;
  return (
    <div className="rounded-lg bg-secondary/40 p-2 text-xs">
      <p className="mb-1 font-medium">{titel}</p>
      <ul className="list-disc pl-4">
        {werte.map((w, i) => <li key={i}>{w}</li>)}
      </ul>
    </div>
  );
}

function GespraechDialog({ userId, g, onClose }: { userId: string; g: Gespraech | null; onClose: () => void }) {
  const t = useTranslations("personal");
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [f, setF] = useState({
    datum: g?.datum ?? new Date().toISOString().slice(0, 10),
    art: (g?.art ?? "feedback") as GespraechArt,
    bewertung: g?.bewertung ?? null,
    notizen: g?.notizen ?? "",
    ziele: g?.ziele ?? [],
    erfolge: g?.erfolge ?? [],
    entwicklung: g?.entwicklung ?? [],
    naechstes_am: g?.naechstes_am ?? "",
  });
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((x) => ({ ...x, [k]: v }));

  async function absenden(e: React.FormEvent) {
    e.preventDefault();
    const geleert: string[] = [];
    const body: Record<string, unknown> = { datum: f.datum, art: f.art };
    if (f.bewertung !== null) body.bewertung = f.bewertung;
    else geleert.push("bewertung");
    feldOderGeleert(body, geleert, "notizen", f.notizen);
    feldOderGeleert(body, geleert, "naechstes_am", f.naechstes_am);
    body.ziele = f.ziele.map((s) => s.trim()).filter(Boolean);
    body.erfolge = f.erfolge.map((s) => s.trim()).filter(Boolean);
    body.entwicklung = f.entwicklung.map((s) => s.trim()).filter(Boolean);
    setBusy(true);
    const res = g ? await updateGespraech(g.id, { ...(body as GespraechInput), geleert }) : await createGespraech(userId, body as GespraechInput);
    setBusy(false);
    if (!res.ok) return void toast.error(res.error);
    toast.success(t("akte.gespeichert"));
    router.refresh();
    onClose();
  }

  return (
    <Modal titel={g ? t("kartei.gespraechBearbeiten") : t("kartei.gespraechNeu")} onClose={onClose} onSubmit={absenden} busy={busy || !f.datum} breit>
      <div className="grid gap-3 sm:grid-cols-3">
        <Feld label={t("datum")}><DatePicker value={f.datum} onChange={(v) => set("datum", v)} /></Feld>
        <Feld label={t("kartei.art")}>
          <NativeSelect value={f.art} onChange={(e) => set("art", e.target.value as GespraechArt)}>
            {GESPRAECH_ARTEN.map((a) => <option key={a} value={a}>{t(`gespraechArt.${a}`)}</option>)}
          </NativeSelect>
        </Feld>
        <Feld label={t("kartei.naechstesGespraech")}><DatePicker value={f.naechstes_am} onChange={(v) => set("naechstes_am", v)} /></Feld>
      </div>
      <div className="flex items-center gap-3">
        <span className="font-medium">{t("kartei.bewertung")}</span>
        <Sterne n={f.bewertung} onChange={(v) => set("bewertung", v === f.bewertung ? null : v)} />
      </div>
      <Feld label={t("kartei.notizen")}><Textarea rows={4} value={f.notizen} onChange={(e) => set("notizen", e.target.value)} /></Feld>
      <ListenFeld label={t("kartei.ziele")} werte={f.ziele} onChange={(v) => set("ziele", v)} />
      <ListenFeld label={t("kartei.erfolge")} werte={f.erfolge} onChange={(v) => set("erfolge", v)} />
      <ListenFeld label={t("kartei.entwicklung")} werte={f.entwicklung} onChange={(v) => set("entwicklung", v)} />
    </Modal>
  );
}
