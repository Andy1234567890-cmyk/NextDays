"use client";

// Gemeinsame Bausteine der Akte-Reiter (0543): Feld, Modal, Listen-/Paar-
// Editor, Zustands-Badge und die Text↔Wert-Helfer. Vorher lagen Feld und die
// Helfer nur in mitarbeiter-akte.tsx; mit sieben weiteren Reitern wären sie
// siebenmal kopiert worden.
import { Icon } from "@iconify/react";
import { useTranslations } from "next-intl";

import { Button } from "@nextdays/ui/button";
import { Input } from "@nextdays/ui/input";
import type { AblaufZustand, Paar } from "@/lib/personal-typen";

export function Feld({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="font-medium">{label}</span>
      {children}
      {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
    </label>
  );
}

export function textOderNull(v: string): string | null {
  const s = v.trim();
  return s ? s : null;
}

export function zahlOderNull(v: string): number | null {
  const s = v.trim().replace(",", ".");
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/** Betrag als Text (Minor → Major) und zurück. */
export function minorZuText(minor: number | null): string {
  return minor === null ? "" : (minor / 100).toFixed(2);
}
export function textZuMinor(v: string): number | null {
  const n = zahlOderNull(v);
  return n === null ? null : Math.round(n * 100);
}

/**
 * Text → Wert oder `geleert`: Weglassen heißt „nicht anfassen", Löschen ist
 * ausdrücklich (dasselbe Muster wie `AkteUpdate.geleert`).
 */
export function feldOderGeleert(
  body: Record<string, unknown>,
  geleert: string[],
  feld: string,
  wert: string,
): void {
  const v = textOderNull(wert);
  if (v === null) geleert.push(feld);
  else body[feld] = v;
}

export function Modal({
  titel,
  onClose,
  onSubmit,
  busy,
  children,
  absendenLabel,
  breit = false,
}: {
  titel: string;
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
  busy?: boolean;
  children: React.ReactNode;
  absendenLabel?: string;
  breit?: boolean;
}) {
  const t = useTranslations("personal");
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <form
        onSubmit={onSubmit}
        className={`max-h-[90vh] w-full overflow-y-auto rounded-2xl bg-card p-4 shadow-xl ${breit ? "max-w-2xl" : "max-w-md"}`}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="mb-3 font-display text-lg font-extrabold">{titel}</h2>
        <div className="flex flex-col gap-3 text-sm">{children}</div>
        <div className="mt-4 flex justify-end gap-2">
          <Button type="button" variant="outline" className="rounded-full" onClick={onClose}>
            {t("abbrechen")}
          </Button>
          <Button type="submit" disabled={busy} className="rounded-full">
            {absendenLabel ?? t("speichern")}
          </Button>
        </div>
      </form>
    </div>
  );
}

/** Freie Textliste (Ziele, Zeugen, Unterzeichner …). */
export function ListenFeld({
  label,
  werte,
  onChange,
  placeholder,
}: {
  label: string;
  werte: string[];
  onChange: (v: string[]) => void;
  placeholder?: string;
}) {
  const t = useTranslations("personal");
  return (
    <div className="flex flex-col gap-1 text-sm">
      <span className="font-medium">{label}</span>
      {werte.map((w, i) => (
        <div key={i} className="flex gap-2">
          <Input
            value={w}
            placeholder={placeholder}
            onChange={(e) => onChange(werte.map((x, j) => (j === i ? e.target.value : x)))}
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={t("loeschen")}
            onClick={() => onChange(werte.filter((_, j) => j !== i))}
          >
            <Icon icon="ph:x" className="size-4" />
          </Button>
        </div>
      ))}
      <Button type="button" variant="outline" size="sm" className="w-fit rounded-full" onClick={() => onChange([...werte, ""])}>
        <Icon icon="ph:plus" className="mr-1 size-4" />
        {t("kartei.eintragHinzufuegen")}
      </Button>
    </div>
  );
}

/** Schlüssel/Wert-Paare (Lohnmerkmale, Vertragsbedingungen). */
export function PaarFeld({
  label,
  werte,
  onChange,
  hint,
}: {
  label: string;
  werte: Paar[];
  onChange: (v: Paar[]) => void;
  hint?: string;
}) {
  const t = useTranslations("personal");
  return (
    <div className="flex flex-col gap-1 text-sm">
      <span className="font-medium">{label}</span>
      {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
      {werte.map((p, i) => (
        <div key={i} className="grid grid-cols-[1fr_1fr_auto] gap-2">
          <Input
            value={p.schluessel}
            placeholder={t("kartei.schluessel")}
            onChange={(e) => onChange(werte.map((x, j) => (j === i ? { ...x, schluessel: e.target.value } : x)))}
          />
          <Input
            value={p.wert}
            placeholder={t("kartei.wert")}
            onChange={(e) => onChange(werte.map((x, j) => (j === i ? { ...x, wert: e.target.value } : x)))}
          />
          <Button type="button" variant="ghost" size="icon" aria-label={t("loeschen")} onClick={() => onChange(werte.filter((_, j) => j !== i))}>
            <Icon icon="ph:x" className="size-4" />
          </Button>
        </div>
      ))}
      <Button type="button" variant="outline" size="sm" className="w-fit rounded-full" onClick={() => onChange([...werte, { schluessel: "", wert: "" }])}>
        <Icon icon="ph:plus" className="mr-1 size-4" />
        {t("kartei.eintragHinzufuegen")}
      </Button>
    </div>
  );
}

const ZUSTAND_FARBE: Record<AblaufZustand, string> = {
  gueltig: "bg-emerald-100 text-emerald-800",
  laeuft_ab: "bg-amber-100 text-amber-800",
  abgelaufen: "bg-destructive/10 text-destructive",
  ohne_ablauf: "bg-secondary text-muted-foreground",
};

export function ZustandBadge({ zustand }: { zustand: AblaufZustand }) {
  const t = useTranslations("personal");
  return <span className={`rounded-full px-2 py-0.5 text-xs ${ZUSTAND_FARBE[zustand]}`}>{t(`ablaufZustand.${zustand}`)}</span>;
}

export function Leer({ text }: { text: string }) {
  return <p className="text-sm text-muted-foreground">{text}</p>;
}

/** Kopfzeile eines Reiters mit „Neu"-Knopf. */
export function ReiterKopf({ titel, hint, onNeu, neuLabel }: { titel: string; hint?: string; onNeu?: () => void; neuLabel?: string }) {
  const t = useTranslations("personal");
  return (
    <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
      <div>
        <h2 className="font-display text-lg font-extrabold">{titel}</h2>
        {hint && <p className="text-sm text-muted-foreground">{hint}</p>}
      </div>
      {onNeu && (
        <Button size="sm" className="rounded-full" onClick={onNeu}>
          <Icon icon="ph:plus" className="mr-1 size-4" />
          {neuLabel ?? t("anlegen")}
        </Button>
      )}
    </div>
  );
}
