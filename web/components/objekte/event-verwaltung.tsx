"use client";

// Sonder-Events (Lastenheft §2.3): ein Name, ein Aufschlag, MEHRERE — auch
// unterbrochene — Zeiträume („DANA CUP": zwei Wochen im Juli plus das
// Finalwochenende im August) und eine Objektzuweisung (leer = alle Objekte).
//
// Events sind keine Saisons: eine Saison färbt den Tag und schreibt seinen
// Preis nach price_overrides; ein Event ist ein FAKTOR im Dynamic Pricing.
// Deshalb steht es in der Zelle als Punkt UNTER der Saisonfarbe (die bleibt
// erhalten) und in der Legende als eigener Block. Bewusst EIGENE Datei mit
// eigener kleiner Farbliste — season-calendar.tsx bekommt parallel eine
// Buchstaben-Palette, von der hier nichts importiert wird.
import { Icon } from "@iconify/react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@nextdays/ui/button";
import { Checkbox } from "@nextdays/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@nextdays/ui/dialog";
import { Input } from "@nextdays/ui/input";
import { Label } from "@nextdays/ui/label";
import {
  ObjektMehrfachauswahl,
  type ObjektAuswahlEintrag,
} from "@/components/objekt-mehrfachauswahl";
import {
  type KalenderEvent,
  type KalenderEventInput,
  createEvent,
  deleteEvent,
  updateEvent,
} from "@/lib/calendar";
import { listProperties } from "@/lib/properties";

// Pastell-Vorschläge für Events — gedämpft, damit der Punkt auf jeder
// Saisonfarbe lesbar bleibt. Frei wählbar über das Farbfeld darunter.
const EVENT_FARBEN = [
  "#f9a8d4", "#fdba74", "#fde68a", "#86efac",
  "#67e8f9", "#93c5fd", "#c4b5fd", "#d6d3d1",
];

// Deckel wie der Server (schemas.EventCreate): mehr Zeiträume weist er mit
// 422 ab — hier vorher sagen statt nachher scheitern.
const MAX_PERIODEN = 50;

/** Wirkt ein Event auf dieses Objekt? Leere Zuweisung = alle (0583). */
export function eventWirktAuf(ev: KalenderEvent, propertyId: string): boolean {
  return ev.property_ids.length === 0 || ev.property_ids.includes(propertyId);
}

/** ISO → Liste der Events je Tag (nur die, die auf das Objekt wirken). */
export function buildEventDayMap(
  events: KalenderEvent[],
  propertyId: string,
): Map<string, KalenderEvent[]> {
  const map = new Map<string, KalenderEvent[]>();
  for (const ev of events) {
    if (!eventWirktAuf(ev, propertyId)) continue;
    for (const p of ev.periods) {
      const cur = new Date(`${p.start_date}T00:00:00Z`);
      const end = new Date(`${p.end_date}T00:00:00Z`);
      while (cur <= end) {
        const key = cur.toISOString().slice(0, 10);
        const list = map.get(key) ?? [];
        list.push(ev);
        map.set(key, list);
        cur.setUTCDate(cur.getUTCDate() + 1);
      }
    }
  }
  return map;
}

/** Punkt(e) am unteren Zellrand — die Saisonfarbe der Zelle bleibt stehen. */
export function EventMarkierung({ events }: { events: KalenderEvent[] | undefined }) {
  if (!events || events.length === 0) return null;
  return (
    <span
      className="pointer-events-none absolute inset-x-0 bottom-0.5 flex justify-center gap-0.5"
      title={events.map((e) => `${e.name} (${e.percent > 0 ? "+" : ""}${e.percent} %)`).join("\n")}
    >
      {events.slice(0, 3).map((e) => (
        <span
          key={e.id}
          className="size-1.5 rounded-full ring-1 ring-white/80"
          style={{ backgroundColor: e.color ?? "currentColor" }}
        />
      ))}
    </span>
  );
}

export function EventVerwaltung({
  propertyId,
  events,
  onChanged,
}: {
  propertyId: string;
  events: KalenderEvent[];
  onChanged: () => void;
}) {
  const t = useTranslations("kalender.events");
  // null = Dialog zu; "neu" = anlegen; sonst die ID des bearbeiteten Events.
  const [editor, setEditor] = useState<string | null>(null);
  const bearbeitet = events.find((e) => e.id === editor) ?? null;

  async function loeschen(ev: KalenderEvent) {
    if (!window.confirm(t("loeschenBestaetigen", { name: ev.name }))) return;
    const res = await deleteEvent(ev.id);
    if (res.ok) {
      toast.success(t("geloescht"));
      onChanged();
    } else {
      toast.error(res.error);
    }
  }

  return (
    <section className="mt-2 flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">{t("titel")}</h2>
        <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setEditor("neu")}>
          <Icon icon="ph:plus" className="size-4" />
          {t("neu")}
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">{t("hinweis")}</p>
      {events.length === 0 ? (
        <p className="rounded-(--radius) border border-dashed border-border p-3 text-center text-xs text-muted-foreground">
          {t("leer")}
        </p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {events.map((ev) => {
            const wirkt = eventWirktAuf(ev, propertyId);
            return (
              <li
                key={ev.id}
                className={`flex items-center gap-1.5 rounded-full border border-border py-1.5 pl-3 pr-1.5 text-sm ${
                  wirkt ? "" : "opacity-60"
                }`}
                title={wirkt ? undefined : t("wirktNichtHier")}
              >
                <span
                  className="size-3 shrink-0 rounded-full ring-1 ring-border"
                  style={{ backgroundColor: ev.color ?? "transparent" }}
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{ev.name}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {`${ev.percent > 0 ? "+" : ""}${ev.percent} % · `}
                    {t("zeitraeumeAnzahl", { count: ev.periods.length })}
                    {" · "}
                    {ev.property_ids.length === 0
                      ? t("alleObjekte")
                      : t("objekteAnzahl", { count: ev.property_ids.length })}
                  </span>
                </span>
                <button
                  type="button"
                  aria-label={t("bearbeiten")}
                  title={t("bearbeiten")}
                  className="shrink-0 rounded-full p-1.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                  onClick={() => setEditor(ev.id)}
                >
                  <Icon icon="ph:pencil-simple" className="size-4" />
                </button>
                <button
                  type="button"
                  aria-label={t("loeschen")}
                  title={t("loeschen")}
                  className="shrink-0 rounded-full p-1.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-destructive"
                  onClick={() => void loeschen(ev)}
                >
                  <Icon icon="ph:trash" className="size-4" />
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {editor !== null && (
        <EventDialog
          propertyId={propertyId}
          event={bearbeitet}
          onClose={() => setEditor(null)}
          onSaved={() => {
            setEditor(null);
            onChanged();
          }}
        />
      )}
    </section>
  );
}

type PeriodeForm = { start: string; end: string };

function EventDialog({
  propertyId,
  event,
  onClose,
  onSaved,
}: {
  propertyId: string;
  /** null = neues Event. */
  event: KalenderEvent | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const t = useTranslations("kalender.events");
  const [name, setName] = useState(event?.name ?? "");
  const [percent, setPercent] = useState(event ? String(event.percent) : "");
  const [color, setColor] = useState(event?.color ?? EVENT_FARBEN[0]);
  const [perioden, setPerioden] = useState<PeriodeForm[]>(
    event
      ? event.periods.map((p) => ({ start: p.start_date, end: p.end_date }))
      : [{ start: "", end: "" }],
  );
  // Leer = alle Objekte. Ein NEUES Event von der Objektseite aus gilt
  // zunächst für dieses Objekt — wer es überall will, setzt den Haken.
  const [alleObjekte, setAlleObjekte] = useState(
    event ? event.property_ids.length === 0 : false,
  );
  const [objektIds, setObjektIds] = useState<string[]>(
    event ? event.property_ids : [propertyId],
  );
  const [objekte, setObjekte] = useState<ObjektAuswahlEintrag[]>([]);
  const [suche, setSuche] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void (async () => {
      const res = await listProperties();
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setObjekte(
        res.data.items.map((p) => ({
          id: p.id,
          title: p.title,
          subtitle: [p.street, p.city].filter(Boolean).join(", ") || undefined,
          photo: p.photos[0],
        })),
      );
    })();
  }, []);

  function periodeSetzen(i: number, patch: Partial<PeriodeForm>) {
    setPerioden((prev) => prev.map((p, idx) => (idx === i ? { ...p, ...patch } : p)));
  }

  async function submit() {
    if (!name.trim()) {
      toast.error(t("nameFehlt"));
      return;
    }
    const pct = Number(percent);
    if (percent === "" || Number.isNaN(pct)) {
      toast.error(t("prozentFehlt"));
      return;
    }
    const gefuellt = perioden.filter((p) => p.start || p.end);
    if (gefuellt.some((p) => !p.start || !p.end || p.end < p.start)) {
      toast.error(t("zeitraumUngueltig"));
      return;
    }
    if (!alleObjekte && objektIds.length === 0) {
      toast.error(t("objekteFehlen"));
      return;
    }
    const input: KalenderEventInput = {
      name: name.trim(),
      percent: pct,
      color,
      periods: gefuellt.map((p) => ({ start_date: p.start, end_date: p.end })),
      property_ids: alleObjekte ? [] : objektIds,
    };
    setSaving(true);
    const res = event ? await updateEvent(event.id, input) : await createEvent(input);
    setSaving(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success(event ? t("gespeichert") : t("angelegt"));
    onSaved();
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <DialogTitle>{event ? t("dialogBearbeiten") : t("dialogNeu")}</DialogTitle>
            <DialogDescription>{t("dialogHinweis")}</DialogDescription>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="event-name">{t("name")}</Label>
              <Input
                id="event-name"
                value={name}
                placeholder={t("namePlatzhalter")}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="event-prozent">{t("prozent")}</Label>
              <Input
                id="event-prozent"
                type="number"
                value={percent}
                placeholder={t("prozentPlatzhalter")}
                onChange={(e) => setPercent(e.target.value)}
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>{t("farbe")}</Label>
            <div className="flex flex-wrap items-center gap-1.5">
              {EVENT_FARBEN.map((c) => (
                <button
                  key={c}
                  type="button"
                  aria-label={t("farbeAria", { color: c })}
                  onClick={() => setColor(c)}
                  className={`size-6 rounded-full ring-1 ring-border transition-transform ${
                    color === c ? "scale-110 ring-2 ring-foreground ring-offset-2" : ""
                  }`}
                  style={{ backgroundColor: c }}
                />
              ))}
              <label className="ml-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                <input
                  type="color"
                  aria-label={t("farbeFrei")}
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  className="size-6 cursor-pointer rounded-full border-0 bg-transparent p-0"
                />
                {t("farbeFrei")}
              </label>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <Label>{t("zeitraeume")}</Label>
              <button
                type="button"
                className="text-xs font-medium underline-offset-4 hover:underline disabled:opacity-50"
                disabled={perioden.length >= MAX_PERIODEN}
                onClick={() => setPerioden((prev) => [...prev, { start: "", end: "" }])}
              >
                {t("zeitraumHinzufuegen")}
              </button>
            </div>
            <p className="text-xs text-muted-foreground">{t("zeitraeumeHinweis")}</p>
            <ul className="flex flex-col gap-1.5">
              {perioden.map((p, i) => (
                <li key={i} className="flex items-center gap-1.5">
                  <Input
                    type="date"
                    aria-label={t("von")}
                    value={p.start}
                    onChange={(e) => periodeSetzen(i, { start: e.target.value })}
                  />
                  <span className="text-xs text-muted-foreground">–</span>
                  <Input
                    type="date"
                    aria-label={t("bis")}
                    value={p.end}
                    min={p.start || undefined}
                    onChange={(e) => periodeSetzen(i, { end: e.target.value })}
                  />
                  <button
                    type="button"
                    aria-label={t("zeitraumEntfernen")}
                    className="shrink-0 rounded-full p-1.5 text-muted-foreground hover:bg-secondary hover:text-destructive"
                    onClick={() =>
                      setPerioden((prev) => prev.filter((_, idx) => idx !== i))
                    }
                  >
                    <Icon icon="ph:x" className="size-4" />
                  </button>
                </li>
              ))}
            </ul>
          </div>

          <div className="flex flex-col gap-2">
            <label className="flex cursor-pointer items-center gap-3 text-sm">
              <Checkbox
                checked={alleObjekte}
                onCheckedChange={(v) => setAlleObjekte(v === true)}
              />
              <span className="font-medium">{t("alleObjekteWahl")}</span>
            </label>
            {!alleObjekte && (
              <ObjektMehrfachauswahl
                objekte={objekte}
                selected={objektIds}
                onChange={setObjektIds}
                suche={suche}
                onSucheChange={setSuche}
                emptyText={t("keineObjekte")}
              />
            )}
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose} disabled={saving}>
              {t("abbrechen")}
            </Button>
            <Button onClick={submit} disabled={saving}>
              {saving ? t("speichert") : t("speichern")}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
