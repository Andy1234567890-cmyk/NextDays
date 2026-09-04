"use client";

// Schichttausch anfragen (Vertrag §1.4, POST /schichten/{id}/tausch).
//
// DREI ANGABEN: an wen, optional gegen welche Schicht, und warum. Die
// Gegen-Schicht ist der Unterschied zwischen „übernimm bitte" und „tauschen
// wir": nur mit ihr schreibt die Freigabe BEIDE Schichten in einem Schritt
// (§1.4) — deshalb steht in der Auswahl nur, was die Zielperson in diesem
// Fenster wirklich hat.
//
// Die Qualifikationsprüfung macht der Server (422 `qualifikation`); hier wird
// sie nicht vorweggenommen — eine Oberfläche, die selbst entscheidet, wer
// darf, weicht früher oder später von der Regel ab.
import { Icon } from "@iconify/react";
import { useLocale, useTranslations } from "next-intl";
import { useMemo, useState } from "react";

import { Button } from "@nextdays/ui/button";
import { NativeSelect } from "@nextdays/ui/native-select";
import { Textarea } from "@nextdays/ui/textarea";
import type { SchichtPlus } from "@/lib/personal-planung-typen";
import type { Arbeitsbereich, PlanPerson } from "@/lib/personal-typen";
import { tagKurz, uhrzeitInZone } from "@/lib/personal-zeit";

export function TauschDialog({
  schicht,
  personen,
  alleSchichten,
  arbeitsbereiche,
  zone,
  onClose,
  onSenden,
}: {
  schicht: SchichtPlus;
  personen: PlanPerson[];
  /** Alle Schichten des Fensters — Quelle der möglichen Gegen-Schichten. */
  alleSchichten: SchichtPlus[];
  arbeitsbereiche: Arbeitsbereich[];
  zone: string;
  onClose: () => void;
  onSenden: (werte: { an_user_id: string; gegen_schicht_id: string | null; grund: string }) => void;
}) {
  const t = useTranslations("personal");
  const locale = useLocale();
  const [anUser, setAnUser] = useState("");
  const [gegen, setGegen] = useState("");
  const [grund, setGrund] = useState("");

  const bereichName = (id: string | null) =>
    arbeitsbereiche.find((b) => b.id === id)?.name ?? t("dienstplan.ohneBereich");

  // Kandidaten: alle ausser dem aktuellen Inhaber der Schicht.
  const ziele = personen.filter((p) => p.user_id !== schicht.user_id);

  const gegenSchichten = useMemo(
    () =>
      anUser
        ? alleSchichten
            .filter((s) => s.user_id === anUser && s.status !== "abgesagt" && s.id !== schicht.id)
            .sort((a, b) => a.start_at.localeCompare(b.start_at))
        : [],
    [anUser, alleSchichten, schicht.id],
  );

  function absenden(e: React.FormEvent) {
    e.preventDefault();
    if (!anUser) return;
    onSenden({ an_user_id: anUser, gegen_schicht_id: gegen || null, grund: grund.trim() });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <form
        onSubmit={absenden}
        className="w-full max-w-lg rounded-2xl bg-card p-4 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-start justify-between">
          <h2 className="font-display text-lg font-extrabold">{t("tausch.titel")}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={t("schliessen")}
            className="text-muted-foreground"
          >
            <Icon icon="ph:x" className="size-5" />
          </button>
        </div>

        <div className="mb-3 rounded-xl bg-secondary/50 p-2 text-sm">
          <div className="font-medium">
            {tagKurz(schicht.datum, locale)} · {uhrzeitInZone(schicht.start_at, zone)}–
            {uhrzeitInZone(schicht.end_at, zone)}
          </div>
          <div className="text-xs text-muted-foreground">
            {[bereichName(schicht.arbeitsbereich_id), schicht.property_title]
              .filter(Boolean)
              .join(" · ")}
          </div>
        </div>

        <div className="grid gap-3">
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium">{t("tausch.anWen")}</span>
            <NativeSelect
              value={anUser}
              onChange={(e) => {
                setAnUser(e.target.value);
                setGegen("");
              }}
              required
            >
              <option value="">—</option>
              {ziele.map((p) => (
                <option key={p.user_id} value={p.user_id}>
                  {p.full_name ?? p.user_id}
                </option>
              ))}
            </NativeSelect>
          </label>

          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium">{t("tausch.gegenSchicht")}</span>
            <NativeSelect
              value={gegen}
              onChange={(e) => setGegen(e.target.value)}
              disabled={!anUser}
            >
              <option value="">{t("tausch.ohneGegenschicht")}</option>
              {gegenSchichten.map((s) => (
                <option key={s.id} value={s.id}>
                  {tagKurz(s.datum, locale)} {uhrzeitInZone(s.start_at, zone)}–
                  {uhrzeitInZone(s.end_at, zone)} · {bereichName(s.arbeitsbereich_id)}
                </option>
              ))}
            </NativeSelect>
            <span className="text-xs text-muted-foreground">{t("tausch.gegenHint")}</span>
          </label>

          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium">{t("grund")}</span>
            <Textarea rows={2} value={grund} onChange={(e) => setGrund(e.target.value)} />
          </label>
        </div>

        <div className="mt-4 flex justify-end gap-2">
          <Button type="button" variant="outline" className="rounded-full" onClick={onClose}>
            {t("abbrechen")}
          </Button>
          <Button type="submit" className="rounded-full" disabled={!anUser}>
            <Icon icon="ph:arrows-left-right" className="mr-1 size-4" />
            {t("tausch.anfragen")}
          </Button>
        </div>
      </form>
    </div>
  );
}
