"use client";

// Schicht anlegen/ändern. Zeiten werden in der Betriebs-/Objektzone eingegeben
// und als UTC gespeichert (personal-zeit.ts). Eine Vorlage füllt Zeit, Pause
// und Arbeitsbereich vor — überschreibbar.
import { Icon } from "@iconify/react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";

import { Button } from "@nextdays/ui/button";
import { DatePicker } from "@nextdays/ui/date-picker";
import { Input } from "@nextdays/ui/input";
import { NativeSelect } from "@nextdays/ui/native-select";
import { Textarea } from "@nextdays/ui/textarea";
import type { Arbeitsbereich, Konflikt, PlanPerson, SchichtStatus, Schichtvorlage } from "@/lib/personal-typen";
import { tagInZone, uhrzeitInZone, utcFuerOrtszeit } from "@/lib/personal-zeit";

import { konfliktText } from "./konflikte";

export type SchichtDialogWerte = {
  id?: string;
  user_id: string;
  /** UTC-ISO oder "" (neu). */
  start_at: string;
  end_at: string;
  /** Kalendertag (Zone) — Vorbelegung für neue Schichten. */
  tag: string;
  pause_min: number;
  arbeitsbereich_id: string;
  property_id: string;
  vorlage_id: string;
  notiz: string;
  status?: SchichtStatus;
  konflikte?: Konflikt[];
};

export function SchichtDialog({
  werte,
  zone,
  personen,
  arbeitsbereiche,
  vorlagen,
  objekte,
  onClose,
  onSave,
  onDelete,
}: {
  werte: SchichtDialogWerte;
  zone: string;
  personen: PlanPerson[];
  arbeitsbereiche: Arbeitsbereich[];
  vorlagen: Schichtvorlage[];
  objekte: { id: string; title: string }[];
  onClose: () => void;
  onSave: (w: SchichtDialogWerte) => void;
  onDelete?: () => void;
}) {
  const t = useTranslations("personal");
  const [tag, setTag] = useState(werte.start_at ? tagInZone(werte.start_at, zone) : werte.tag);
  const [von, setVon] = useState(werte.start_at ? uhrzeitInZone(werte.start_at, zone) : "08:00");
  const [bis, setBis] = useState(werte.end_at ? uhrzeitInZone(werte.end_at, zone) : "14:00");
  const [f, setF] = useState(werte);

  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [onClose]);

  function vorlageWaehlen(id: string) {
    const v = vorlagen.find((x) => x.id === id);
    setF((x) => ({ ...x, vorlage_id: id, pause_min: v?.pause_min ?? x.pause_min, arbeitsbereich_id: v?.arbeitsbereich_id ?? x.arbeitsbereich_id }));
    if (v) {
      setVon(v.start_zeit.slice(0, 5));
      setBis(v.end_zeit.slice(0, 5));
    }
  }

  function absenden(e: React.FormEvent) {
    e.preventDefault();
    const start = utcFuerOrtszeit(tag, von, zone);
    let endeTag = tag;
    if (bis <= von) {
      const d = new Date(`${tag}T00:00:00Z`);
      d.setUTCDate(d.getUTCDate() + 1);
      endeTag = d.toISOString().slice(0, 10);
    }
    const ende = utcFuerOrtszeit(endeTag, bis, zone);
    onSave({ ...f, start_at: start, end_at: ende });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose} role="dialog" aria-modal="true">
      <form onSubmit={absenden} className="w-full max-w-lg rounded-2xl bg-card p-4 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-start justify-between">
          <h2 className="font-display text-lg font-extrabold">{werte.id ? t("dienstplan.schichtAendern") : t("dienstplan.schichtNeu")}</h2>
          <button type="button" onClick={onClose} aria-label={t("schliessen")} className="text-muted-foreground"><Icon icon="ph:x" className="size-5" /></button>
        </div>
        {werte.status && (
          <p className="mb-2 text-xs text-muted-foreground">{t("dienstplan.status")}: {t(`schichtStatus.${werte.status}`)}</p>
        )}
        {werte.konflikte && werte.konflikte.length > 0 && (
          <ul className="mb-3 rounded-xl bg-amber-50 p-2 text-xs text-amber-900">
            {werte.konflikte.map((k, i) => <li key={i}>• {konfliktText(t, k)}</li>)}
          </ul>
        )}
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-sm sm:col-span-2">
            <span className="font-medium">{t("dienstplan.person")}</span>
            <NativeSelect value={f.user_id} onChange={(e) => setF((x) => ({ ...x, user_id: e.target.value }))}>
              <option value="">{t("dienstplan.offenLassen")}</option>
              {personen.map((p) => <option key={p.user_id} value={p.user_id}>{p.full_name ?? p.user_id}</option>)}
            </NativeSelect>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium">{t("dienstplan.vorlage")}</span>
            <NativeSelect value={f.vorlage_id} onChange={(e) => vorlageWaehlen(e.target.value)}>
              <option value="">—</option>
              {vorlagen.filter((v) => !v.archived_at).map((v) => <option key={v.id} value={v.id}>{v.name} ({v.start_zeit.slice(0, 5)}–{v.end_zeit.slice(0, 5)})</option>)}
            </NativeSelect>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium">{t("datum")}</span>
            <DatePicker value={tag} onChange={setTag} />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium">{t("von")}</span>
            <Input type="time" value={von} onChange={(e) => setVon(e.target.value)} required />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium">{t("bis")}</span>
            <Input type="time" value={bis} onChange={(e) => setBis(e.target.value)} required />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium">{t("pauseMin")}</span>
            <Input inputMode="numeric" value={f.pause_min} onChange={(e) => setF((x) => ({ ...x, pause_min: Number(e.target.value) || 0 }))} />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium">{t("arbeitsbereich")}</span>
            <NativeSelect value={f.arbeitsbereich_id} onChange={(e) => setF((x) => ({ ...x, arbeitsbereich_id: e.target.value }))}>
              <option value="">—</option>
              {arbeitsbereiche.filter((b) => !b.archived_at).map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </NativeSelect>
          </label>
          <label className="flex flex-col gap-1 text-sm sm:col-span-2">
            <span className="font-medium">{t("objekt")}</span>
            <NativeSelect value={f.property_id} onChange={(e) => setF((x) => ({ ...x, property_id: e.target.value }))}>
              <option value="">—</option>
              {objekte.map((o) => <option key={o.id} value={o.id}>{o.title}</option>)}
            </NativeSelect>
          </label>
          <label className="flex flex-col gap-1 text-sm sm:col-span-2">
            <span className="font-medium">{t("notiz")}</span>
            <Textarea rows={2} value={f.notiz} onChange={(e) => setF((x) => ({ ...x, notiz: e.target.value }))} />
          </label>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">{t("dienstplan.zoneHint", { zone })}</p>
        <div className="mt-4 flex items-center justify-between">
          {onDelete ? (
            <Button type="button" variant="ghost" className="text-destructive" onClick={onDelete}>
              <Icon icon="ph:trash" className="mr-1 size-4" />{werte.status === "entwurf" ? t("loeschen") : t("dienstplan.absagen")}
            </Button>
          ) : <span />}
          <div className="flex gap-2">
            <Button type="button" variant="outline" className="rounded-full" onClick={onClose}>{t("abbrechen")}</Button>
            <Button type="submit" className="rounded-full">{t("speichern")}</Button>
          </div>
        </div>
      </form>
    </div>
  );
}
