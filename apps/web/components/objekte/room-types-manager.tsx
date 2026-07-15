"use client";

// Hotel-Zimmerkategorien-Verwaltung: room_types einer Property + je Kategorie
// eigene Rate-Plans (BAR, B&B …). Echtes Realtime auf room_types UND rate_plans
// (kein manuelles Reload); Anlegen/Ändern/Löschen löst im Backend den Channex-
// Sync aus (n Room-Types + Rate-Plans je Kategorie).
import { Icon } from "@iconify/react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { formatCurrency } from "@/lib/currency";
import { CURRENCY_OPTIONS } from "@/lib/pricing-meta";
import {
  createRatePlan,
  deleteRatePlan,
  listRatePlans,
  updateRatePlan,
  type RatePlan,
} from "@/lib/rates";
import {
  createRoomType,
  deleteRoomType,
  listRoomTypes,
  updateRoomType,
  type RoomType,
} from "@/lib/room-types";
import { useRealtime } from "@/lib/use-realtime";

type RoomDraft = {
  title: string;
  countOfRooms: string;
  occAdults: string;
  occChildren: string;
  occInfants: string;
  defaultOccupancy: string;
};

type RateDraft = {
  name: string;
  basePrice: string;
  currency: string;
  minStay: string;
};

// Eine Zeile beim Mehrfach-Anlegen von Preisplänen (Draft + Zeilenfehler).
type NewRateRow = RateDraft & { rowError?: string };

function emptyRateRow(currency: string): NewRateRow {
  return { name: "", basePrice: "", currency, minStay: "1" };
}

// Client-Validierung einer Preisplan-Zeile → geparste Werte oder Fehler.
function validateRateRow(
  d: RateDraft,
):
  | { ok: true; value: { name: string; price: number; cur: string; minStay: number } }
  | { ok: false; error: string } {
  const name = d.name.trim();
  const price = Number(d.basePrice);
  const cur = d.currency;
  const minStay = Math.max(1, parseInt(d.minStay, 10) || 1);
  if (!name) return { ok: false, error: "Name fehlt." };
  if (!(price >= 0) || d.basePrice === "")
    return { ok: false, error: "Preis ungültig." };
  if (!cur) return { ok: false, error: "Währung fehlt." };
  return { ok: true, value: { name, price, cur, minStay } };
}

function emptyRoomDraft(): RoomDraft {
  return {
    title: "",
    countOfRooms: "1",
    occAdults: "2",
    occChildren: "0",
    occInfants: "0",
    defaultOccupancy: "2",
  };
}

// Eine Zeile beim Mehrfach-Anlegen: Draft + client-Validierungsfehler (pro Zeile,
// damit Teil-Erfolg beim Speichern klar zugeordnet werden kann — Wurzel 5).
type NewRow = RoomDraft & { rowError?: string };

// Client-Validierung einer Zeile → geparste Werte oder ein präziser Fehler.
// Gleiche Regeln wie saveRoom (default ≤ Erwachsene ist Channex- + DB-Check).
function validateRow(
  d: RoomDraft,
):
  | { ok: true; value: {
      title: string; count: number; adults: number; children: number;
      infants: number; defOcc: number;
    } }
  | { ok: false; error: string } {
  const title = d.title.trim();
  const count = parseInt(d.countOfRooms, 10);
  const adults = parseInt(d.occAdults, 10);
  const children = parseInt(d.occChildren, 10) || 0;
  const infants = parseInt(d.occInfants, 10) || 0;
  const defOcc = parseInt(d.defaultOccupancy, 10);
  if (!title) return { ok: false, error: "Name fehlt." };
  if (!(count >= 1)) return { ok: false, error: "Zimmeranzahl ≥ 1." };
  if (!(adults >= 1)) return { ok: false, error: "Erwachsene ≥ 1." };
  if (defOcc > adults)
    return { ok: false, error: "Standardbelegung > Erwachsene." };
  return { ok: true, value: { title, count, adults, children, infants, defOcc } };
}

function roomToDraft(rt: RoomType): RoomDraft {
  return {
    title: rt.title,
    countOfRooms: String(rt.count_of_rooms),
    occAdults: String(rt.occ_adults),
    occChildren: String(rt.occ_children),
    occInfants: String(rt.occ_infants),
    defaultOccupancy: String(rt.default_occupancy),
  };
}

// Währung der Property = die des ersten vorhandenen Rate-Plans (eine Wahrheit,
// kein €-Default). Fehlt sie noch, bleibt das Feld leer und der Nutzer wählt.
function propertyCurrency(rates: RatePlan[]): string {
  return rates[0]?.currency ?? "";
}

export function RoomTypesManager({
  propertyId,
  initialRoomTypes,
  initialRatePlans,
}: {
  propertyId: string;
  initialRoomTypes: RoomType[];
  initialRatePlans: RatePlan[];
}) {
  const [rooms, setRooms] = useState<RoomType[]>(initialRoomTypes);
  const [rates, setRates] = useState<RatePlan[]>(initialRatePlans);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Kategorie-Editor (Sheet): "new" (Mehrzeilen-Anlegen) oder eine bestehende
  // RoomType (Einzel-Bearbeiten). Beim Anlegen mehrere Zeilen in EINEM Sheet.
  const [roomEditing, setRoomEditing] = useState<RoomType | "new" | null>(null);
  const [roomDraft, setRoomDraft] = useState<RoomDraft>(emptyRoomDraft());
  const [newRows, setNewRows] = useState<NewRow[]>([emptyRoomDraft()]);
  // Rate-Plan-Editor (Sheet): trägt die room_type_id der Kategorie.
  const [rateEditing, setRateEditing] = useState<
    { roomTypeId: string; plan: RatePlan | "new" } | null
  >(null);
  const [rateDraft, setRateDraft] = useState<RateDraft>({
    name: "",
    basePrice: "",
    currency: "",
    minStay: "1",
  });
  const [newRateRows, setNewRateRows] = useState<NewRateRow[]>([emptyRateRow("")]);

  // Realtime: beide speisenden Tabellen abonnieren (Pflicht). Bei jeder Änderung
  // die jeweilige Liste frisch laden — kein Reload-Flackern.
  useRealtime({
    table: "room_types",
    filter: `property_id=eq.${propertyId}`,
    onChange: () => {
      void listRoomTypes(propertyId).then((r) => {
        if (r.ok) setRooms(r.data.items);
      });
    },
  });
  useRealtime({
    table: "rate_plans",
    filter: `property_id=eq.${propertyId}`,
    onChange: () => {
      void listRatePlans(propertyId).then((r) => {
        if (r.ok) setRates(r.data.items);
      });
    },
  });

  const propCurrency = propertyCurrency(rates);
  // formatCurrency rendert symbollos bei leerer/unbekannter Währung (Wurzel 4 —
  // kein erfundenes €); die echte Währung kommt aus dem Rate-Plan.
  const money = (v: number, cur: string) => formatCurrency(v, cur);

  // --- Kategorie-Editor ---
  // Anlegen öffnet das Mehrzeilen-Sheet (eine leere Zeile); Bearbeiten öffnet
  // das Einzel-Sheet mit den Werten der Kategorie.
  function startCreateRoom() {
    setError(null);
    setRoomEditing("new");
    setNewRows([emptyRoomDraft()]);
  }
  function startEditRoom(rt: RoomType) {
    setError(null);
    setRoomEditing(rt);
    setRoomDraft(roomToDraft(rt));
  }

  // --- Mehrzeilen-Anlegen ---
  function patchRow(i: number, patch: Partial<RoomDraft>) {
    setNewRows((rows) =>
      rows.map((r, idx) =>
        // beim Editieren den bisherigen Zeilenfehler zurücksetzen
        idx === i ? { ...r, ...patch, rowError: undefined } : r,
      ),
    );
  }
  function addRow() {
    setNewRows((rows) => [...rows, emptyRoomDraft()]);
  }
  function removeRow(i: number) {
    setNewRows((rows) => (rows.length <= 1 ? rows : rows.filter((_, idx) => idx !== i)));
  }

  // Alle Zeilen anlegen. Kein Bulk-Endpoint → N sequenzielle Calls; jeder löst
  // im Backend den Channex-Sync aus. Teil-Erfolg wird NICHT still verschluckt
  // (Wurzel 5): erfolgreiche Zeilen verschwinden, fehlerhafte bleiben mit
  // Zeilenfehler stehen, damit der Nutzer sieht, was durchkam und was nicht.
  async function saveNewRows() {
    // 1) Client-Validierung: fehlerhafte Zeilen markieren, nichts senden.
    const validated = newRows.map((r) => ({ row: r, res: validateRow(r) }));
    if (validated.some((v) => !v.res.ok)) {
      setNewRows(
        validated.map((v) => ({
          ...v.row,
          rowError: v.res.ok ? undefined : v.res.error,
        })),
      );
      setError("Bitte die markierten Zeilen korrigieren.");
      return;
    }
    setBusy(true);
    setError(null);
    // 2) Sequenziell anlegen; je Zeile Erfolg/Fehler festhalten.
    const remaining: NewRow[] = [];
    let created = 0;
    for (const { row, res } of validated) {
      if (!res.ok) continue; // durch Guard oben unmöglich, aber typ-eng
      const out = await createRoomType({
        propertyId,
        title: res.value.title,
        countOfRooms: res.value.count,
        occAdults: res.value.adults,
        occChildren: res.value.children,
        occInfants: res.value.infants,
        defaultOccupancy: res.value.defOcc,
      });
      if (out.ok) {
        created += 1;
      } else {
        remaining.push({ ...row, rowError: out.error });
      }
    }
    setBusy(false);
    // 3) Ergebnis. Realtime pflegt die Liste — kein manuelles Reload.
    if (remaining.length === 0) {
      setRoomEditing(null);
      return;
    }
    setNewRows(remaining);
    setError(
      created > 0
        ? `${created} Kategorie(n) angelegt, ${remaining.length} fehlgeschlagen — bitte prüfen.`
        : "Anlegen fehlgeschlagen — bitte die Zeilen prüfen.",
    );
  }

  async function saveRoom() {
    const res0 = validateRow(roomDraft);
    if (!res0.ok) return setError(res0.error);
    const { title, count, adults, children, infants, defOcc } = res0.value;
    setBusy(true);
    setError(null);
    const res = await updateRoomType((roomEditing as RoomType).id, {
      title,
      countOfRooms: count,
      occAdults: adults,
      occChildren: children,
      occInfants: infants,
      defaultOccupancy: defOcc,
    });
    setBusy(false);
    if (!res.ok) return setError(res.error);
    // Kein manuelles Reload: das room_types-Realtime-Abo pflegt die Liste nach
    // (sonst Doppel-Fetch + Doppelbalken-Risiko). Nur das Sheet schließen.
    setRoomEditing(null);
  }

  async function removeRoom(rt: RoomType) {
    setBusy(true);
    setError(null);
    const res = await deleteRoomType(rt.id);
    setBusy(false);
    if (!res.ok) return setError(res.error);
    // Realtime pflegt die Liste (kein manuelles Reload).
  }

  // --- Rate-Plan-Editor ---
  // Anlegen öffnet das Mehrzeilen-Sheet (eine Zeile, Property-Währung vorbelegt);
  // Bearbeiten öffnet das Einzel-Sheet mit den Werten des Plans.
  function startCreateRate(roomTypeId: string) {
    setError(null);
    setRateEditing({ roomTypeId, plan: "new" });
    // Bestehende Property-Währung vorbelegen (Konsistenz), sonst leer wählen.
    setNewRateRows([emptyRateRow(propCurrency)]);
  }
  function startEditRate(roomTypeId: string, plan: RatePlan) {
    setError(null);
    setRateEditing({ roomTypeId, plan });
    setRateDraft({
      name: plan.name,
      basePrice: String(plan.base_price),
      currency: plan.currency,
      minStay: String(plan.min_stay),
    });
  }

  // --- Mehrzeilen-Anlegen von Preisplänen (je Kategorie) ---
  function patchRateRow(i: number, patch: Partial<RateDraft>) {
    setNewRateRows((rows) =>
      rows.map((r, idx) =>
        idx === i ? { ...r, ...patch, rowError: undefined } : r,
      ),
    );
  }
  function addRateRow() {
    // neue Zeile erbt die Währung der ersten Zeile (Konsistenz je Kategorie).
    setNewRateRows((rows) => [...rows, emptyRateRow(rows[0]?.currency ?? propCurrency)]);
  }
  function removeRateRow(i: number) {
    setNewRateRows((rows) =>
      rows.length <= 1 ? rows : rows.filter((_, idx) => idx !== i),
    );
  }

  // Alle Preisplan-Zeilen anlegen. Kein Bulk-Endpoint → N sequenzielle Calls;
  // Teil-Erfolg wird nicht verschluckt (Wurzel 5).
  async function saveNewRates() {
    if (!rateEditing) return;
    const roomTypeId = rateEditing.roomTypeId;
    const validated = newRateRows.map((r) => ({ row: r, res: validateRateRow(r) }));
    if (validated.some((v) => !v.res.ok)) {
      setNewRateRows(
        validated.map((v) => ({
          ...v.row,
          rowError: v.res.ok ? undefined : v.res.error,
        })),
      );
      setError("Bitte die markierten Zeilen korrigieren.");
      return;
    }
    setBusy(true);
    setError(null);
    const remaining: NewRateRow[] = [];
    let created = 0;
    for (const { row, res } of validated) {
      if (!res.ok) continue;
      const out = await createRatePlan({
        propertyId,
        name: res.value.name,
        basePrice: res.value.price,
        currency: res.value.cur,
        minStay: res.value.minStay,
        roomTypeId,
      });
      if (out.ok) created += 1;
      else remaining.push({ ...row, rowError: out.error });
    }
    setBusy(false);
    // Realtime (rate_plans-Abo) pflegt die Liste nach — kein manuelles Reload.
    if (remaining.length === 0) {
      setRateEditing(null);
      return;
    }
    setNewRateRows(remaining);
    setError(
      created > 0
        ? `${created} Preisplan(e) angelegt, ${remaining.length} fehlgeschlagen — bitte prüfen.`
        : "Anlegen fehlgeschlagen — bitte die Zeilen prüfen.",
    );
  }

  // Bearbeiten eines bestehenden Preisplans (einzeln).
  async function saveRate() {
    if (!rateEditing || rateEditing.plan === "new") return;
    const res0 = validateRateRow(rateDraft);
    if (!res0.ok) return setError(res0.error);
    const { name, price, cur, minStay } = res0.value;
    setBusy(true);
    setError(null);
    const res = await updateRatePlan((rateEditing.plan as RatePlan).id, {
      name,
      basePrice: price,
      currency: cur,
      minStay,
    });
    setBusy(false);
    if (!res.ok) return setError(res.error);
    // Realtime (rate_plans-Abo) pflegt die Liste nach — kein manuelles Reload.
    setRateEditing(null);
  }

  async function removeRate(plan: RatePlan) {
    setBusy(true);
    setError(null);
    const res = await deleteRatePlan(plan.id);
    setBusy(false);
    if (!res.ok) return setError(res.error);
    // Realtime pflegt die Liste (kein manuelles Reload).
  }

  const ratesFor = (roomTypeId: string) =>
    rates.filter((r) => r.room_type_id === roomTypeId);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">Zimmerkategorien</h1>
          <p className="text-sm text-muted-foreground">
            Lege Zimmertypen (z. B. Doppelzimmer, Suite) mit Belegung und Anzahl an
            und pflege je Kategorie eigene Preispläne.
          </p>
        </div>
        <Button onClick={startCreateRoom} disabled={busy}>
          <Icon icon="ph:plus" className="size-4" />
          Neue Kategorie
        </Button>
      </div>

      {error && !roomEditing && !rateEditing && (
        <p className="text-sm text-destructive">{error}</p>
      )}

      {rooms.length === 0 ? (
        <Card className="flex flex-col items-center gap-3 p-10 text-center">
          <span className="flex size-14 items-center justify-center rounded-full bg-secondary">
            <Icon icon="ph:bed" className="size-6 text-muted-foreground" />
          </span>
          <div>
            <p className="font-semibold">Noch keine Zimmerkategorien</p>
            <p className="text-sm text-muted-foreground">
              Lege deine erste Kategorie an, um Zimmer nach Typ zu verwalten.
            </p>
          </div>
          <Button onClick={startCreateRoom} disabled={busy}>
            <Icon icon="ph:plus" className="size-4" />
            Neue Kategorie
          </Button>
        </Card>
      ) : (
        <div className="flex flex-col gap-4">
          {rooms.map((rt) => (
            <Card key={rt.id} className="flex flex-col gap-4 p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="truncate font-semibold">{rt.title}</p>
                  <p className="text-sm text-muted-foreground">
                    {rt.count_of_rooms} Zimmer · Belegung {rt.occ_adults} Erw.
                    {rt.occ_children > 0 ? ` · ${rt.occ_children} Kinder` : ""}
                    {rt.occ_infants > 0 ? ` · ${rt.occ_infants} Kleinkinder` : ""}
                    {" · Standard "}
                    {rt.default_occupancy}
                  </p>
                </div>
                <div className="flex shrink-0 gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => startEditRoom(rt)}
                    disabled={busy}
                    aria-label="Kategorie bearbeiten"
                  >
                    <Icon icon="ph:pencil-simple" className="size-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => removeRoom(rt)}
                    disabled={busy}
                    aria-label="Kategorie löschen"
                  >
                    <Icon icon="ph:trash" className="size-4" />
                  </Button>
                </div>
              </div>

              {/* Rate-Plans der Kategorie */}
              <div className="flex flex-col gap-2 border-t pt-3">
                {ratesFor(rt.id).length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Noch kein Preisplan für diese Kategorie.
                  </p>
                ) : (
                  ratesFor(rt.id).map((plan) => (
                    <div
                      key={plan.id}
                      className="flex items-center justify-between gap-3 rounded-(--radius) bg-muted/40 px-3 py-2"
                    >
                      <div className="min-w-0">
                        <span className="truncate text-sm font-medium">{plan.name}</span>
                        <span className="ml-2 text-sm text-muted-foreground">
                          {money(plan.base_price, plan.currency)}
                          {plan.min_stay > 1 ? ` · min. ${plan.min_stay} N.` : ""}
                        </span>
                      </div>
                      <div className="flex shrink-0 gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => startEditRate(rt.id, plan)}
                          disabled={busy}
                          aria-label="Preisplan bearbeiten"
                        >
                          <Icon icon="ph:pencil-simple" className="size-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => removeRate(plan)}
                          disabled={busy}
                          aria-label="Preisplan löschen"
                        >
                          <Icon icon="ph:trash" className="size-4" />
                        </Button>
                      </div>
                    </div>
                  ))
                )}
                <Button
                  variant="outline"
                  size="sm"
                  className="self-start"
                  onClick={() => startCreateRate(rt.id)}
                  disabled={busy}
                >
                  <Icon icon="ph:plus" className="size-4" />
                  Preisplan hinzufügen
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Kategorie-Sheet: Anlegen = mehrere Zeilen auf einmal, Bearbeiten = einzeln */}
      <Sheet open={roomEditing !== null} onOpenChange={(o) => !o && setRoomEditing(null)}>
        <SheetContent
          className={
            roomEditing === "new"
              ? "flex flex-col gap-5 sm:max-w-2xl"
              : "flex flex-col gap-5 sm:max-w-md"
          }
        >
          <SheetHeader>
            <SheetTitle>
              {roomEditing === "new" ? "Neue Zimmerkategorien" : "Kategorie bearbeiten"}
            </SheetTitle>
            <SheetDescription>
              Belegung und Zimmeranzahl bestimmen Verfügbarkeit und Verkauf an die
              Portale.
            </SheetDescription>
          </SheetHeader>

          {roomEditing === "new" ? (
            <>
              <div className="flex min-w-0 flex-col gap-3 overflow-y-auto px-4">
                {newRows.map((row, i) => (
                  <div
                    key={i}
                    className="flex flex-col gap-3 rounded-(--radius) border p-3"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-sm font-medium text-muted-foreground">
                        Kategorie {i + 1}
                      </span>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removeRow(i)}
                        disabled={busy || newRows.length <= 1}
                        aria-label="Zeile entfernen"
                      >
                        <Icon icon="ph:trash" className="size-4" />
                      </Button>
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor={`nr-title-${i}`}>Name</Label>
                      <Input
                        id={`nr-title-${i}`}
                        value={row.title}
                        placeholder="z. B. Doppelzimmer"
                        onChange={(e) => patchRow(i, { title: e.target.value })}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
                      <div className="flex flex-col gap-1.5">
                        <Label htmlFor={`nr-count-${i}`}>Zimmer</Label>
                        <Input
                          id={`nr-count-${i}`}
                          type="number"
                          min={1}
                          value={row.countOfRooms}
                          onChange={(e) => patchRow(i, { countOfRooms: e.target.value })}
                        />
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <Label htmlFor={`nr-default-${i}`}>Standard</Label>
                        <Input
                          id={`nr-default-${i}`}
                          type="number"
                          min={1}
                          value={row.defaultOccupancy}
                          onChange={(e) =>
                            patchRow(i, { defaultOccupancy: e.target.value })
                          }
                        />
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <Label htmlFor={`nr-adults-${i}`}>Erw.</Label>
                        <Input
                          id={`nr-adults-${i}`}
                          type="number"
                          min={1}
                          value={row.occAdults}
                          onChange={(e) => patchRow(i, { occAdults: e.target.value })}
                        />
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <Label htmlFor={`nr-children-${i}`}>Kinder</Label>
                        <Input
                          id={`nr-children-${i}`}
                          type="number"
                          min={0}
                          value={row.occChildren}
                          onChange={(e) => patchRow(i, { occChildren: e.target.value })}
                        />
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <Label htmlFor={`nr-infants-${i}`}>Klk.</Label>
                        <Input
                          id={`nr-infants-${i}`}
                          type="number"
                          min={0}
                          value={row.occInfants}
                          onChange={(e) => patchRow(i, { occInfants: e.target.value })}
                        />
                      </div>
                    </div>
                    {row.rowError && (
                      <p className="text-sm text-destructive">{row.rowError}</p>
                    )}
                  </div>
                ))}
                <Button
                  variant="outline"
                  size="sm"
                  className="self-start"
                  onClick={addRow}
                  disabled={busy}
                >
                  <Icon icon="ph:plus" className="size-4" />
                  Weitere Kategorie
                </Button>
                {error && <p className="text-sm text-destructive">{error}</p>}
              </div>
              <SheetFooter>
                <Button
                  variant="outline"
                  onClick={() => setRoomEditing(null)}
                  disabled={busy}
                >
                  Abbrechen
                </Button>
                <Button onClick={saveNewRows} disabled={busy}>
                  {newRows.length > 1
                    ? `${newRows.length} Kategorien speichern`
                    : "Speichern"}
                </Button>
              </SheetFooter>
            </>
          ) : (
            <>
              <div className="flex min-w-0 flex-col gap-4 overflow-y-auto px-4">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="rt-title">Name</Label>
                  <Input
                    id="rt-title"
                    value={roomDraft.title}
                    placeholder="z. B. Doppelzimmer"
                    onChange={(e) => setRoomDraft({ ...roomDraft, title: e.target.value })}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="rt-count">Anzahl Zimmer</Label>
                    <Input
                      id="rt-count"
                      type="number"
                      min={1}
                      value={roomDraft.countOfRooms}
                      onChange={(e) =>
                        setRoomDraft({ ...roomDraft, countOfRooms: e.target.value })
                      }
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="rt-default">Standardbelegung</Label>
                    <Input
                      id="rt-default"
                      type="number"
                      min={1}
                      value={roomDraft.defaultOccupancy}
                      onChange={(e) =>
                        setRoomDraft({ ...roomDraft, defaultOccupancy: e.target.value })
                      }
                    />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="rt-adults">Erwachsene</Label>
                    <Input
                      id="rt-adults"
                      type="number"
                      min={1}
                      value={roomDraft.occAdults}
                      onChange={(e) =>
                        setRoomDraft({ ...roomDraft, occAdults: e.target.value })
                      }
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="rt-children">Kinder</Label>
                    <Input
                      id="rt-children"
                      type="number"
                      min={0}
                      value={roomDraft.occChildren}
                      onChange={(e) =>
                        setRoomDraft({ ...roomDraft, occChildren: e.target.value })
                      }
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="rt-infants">Kleinkinder</Label>
                    <Input
                      id="rt-infants"
                      type="number"
                      min={0}
                      value={roomDraft.occInfants}
                      onChange={(e) =>
                        setRoomDraft({ ...roomDraft, occInfants: e.target.value })
                      }
                    />
                  </div>
                </div>
                {error && <p className="text-sm text-destructive">{error}</p>}
              </div>
              <SheetFooter>
                <Button
                  variant="outline"
                  onClick={() => setRoomEditing(null)}
                  disabled={busy}
                >
                  Abbrechen
                </Button>
                <Button onClick={saveRoom} disabled={busy || !roomDraft.title.trim()}>
                  Speichern
                </Button>
              </SheetFooter>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* Rate-Plan-Sheet: Anlegen = mehrere Zeilen auf einmal, Bearbeiten = einzeln */}
      <Sheet open={rateEditing !== null} onOpenChange={(o) => !o && setRateEditing(null)}>
        <SheetContent
          className={
            rateEditing?.plan === "new"
              ? "flex flex-col gap-5 sm:max-w-2xl"
              : "flex flex-col gap-5 sm:max-w-md"
          }
        >
          <SheetHeader>
            <SheetTitle>
              {rateEditing?.plan === "new" ? "Neue Preispläne" : "Preisplan bearbeiten"}
            </SheetTitle>
            <SheetDescription>
              Mehrere Pläne je Kategorie (z. B. Best Available Rate, Bed & Breakfast)
              mit eigenem Preis.
            </SheetDescription>
          </SheetHeader>

          {rateEditing?.plan === "new" ? (
            <>
              <div className="flex min-w-0 flex-col gap-3 overflow-y-auto px-4">
                {newRateRows.map((row, i) => (
                  <div
                    key={i}
                    className="flex flex-col gap-3 rounded-(--radius) border p-3"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-sm font-medium text-muted-foreground">
                        Preisplan {i + 1}
                      </span>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removeRateRow(i)}
                        disabled={busy || newRateRows.length <= 1}
                        aria-label="Zeile entfernen"
                      >
                        <Icon icon="ph:trash" className="size-4" />
                      </Button>
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor={`nrp-name-${i}`}>Name</Label>
                      <Input
                        id={`nrp-name-${i}`}
                        value={row.name}
                        placeholder="z. B. Best Available Rate"
                        onChange={(e) => patchRateRow(i, { name: e.target.value })}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                      <div className="flex flex-col gap-1.5">
                        <Label htmlFor={`nrp-price-${i}`}>Preis</Label>
                        <Input
                          id={`nrp-price-${i}`}
                          type="number"
                          min={0}
                          step="0.01"
                          value={row.basePrice}
                          onChange={(e) => patchRateRow(i, { basePrice: e.target.value })}
                        />
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <Label htmlFor={`nrp-currency-${i}`}>Währung</Label>
                        <NativeSelect
                          id={`nrp-currency-${i}`}
                          value={row.currency}
                          onChange={(e) => patchRateRow(i, { currency: e.target.value })}
                        >
                          <option value="" disabled>
                            Wählen …
                          </option>
                          {CURRENCY_OPTIONS.map((o) => (
                            <option key={o.value} value={o.value}>
                              {o.label}
                            </option>
                          ))}
                        </NativeSelect>
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <Label htmlFor={`nrp-minstay-${i}`}>Min. Nächte</Label>
                        <Input
                          id={`nrp-minstay-${i}`}
                          type="number"
                          min={1}
                          value={row.minStay}
                          onChange={(e) => patchRateRow(i, { minStay: e.target.value })}
                        />
                      </div>
                    </div>
                    {row.rowError && (
                      <p className="text-sm text-destructive">{row.rowError}</p>
                    )}
                  </div>
                ))}
                <Button
                  variant="outline"
                  size="sm"
                  className="self-start"
                  onClick={addRateRow}
                  disabled={busy}
                >
                  <Icon icon="ph:plus" className="size-4" />
                  Weiterer Preisplan
                </Button>
                {error && <p className="text-sm text-destructive">{error}</p>}
              </div>
              <SheetFooter>
                <Button
                  variant="outline"
                  onClick={() => setRateEditing(null)}
                  disabled={busy}
                >
                  Abbrechen
                </Button>
                <Button onClick={saveNewRates} disabled={busy}>
                  {newRateRows.length > 1
                    ? `${newRateRows.length} Preispläne speichern`
                    : "Speichern"}
                </Button>
              </SheetFooter>
            </>
          ) : (
            <>
              <div className="flex min-w-0 flex-col gap-4 overflow-y-auto px-4">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="rp-name">Name</Label>
                  <Input
                    id="rp-name"
                    value={rateDraft.name}
                    placeholder="z. B. Best Available Rate"
                    onChange={(e) => setRateDraft({ ...rateDraft, name: e.target.value })}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="rp-price">Preis</Label>
                    <Input
                      id="rp-price"
                      type="number"
                      min={0}
                      step="0.01"
                      value={rateDraft.basePrice}
                      onChange={(e) =>
                        setRateDraft({ ...rateDraft, basePrice: e.target.value })
                      }
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="rp-currency">Währung</Label>
                    <NativeSelect
                      id="rp-currency"
                      value={rateDraft.currency}
                      onChange={(e) =>
                        setRateDraft({ ...rateDraft, currency: e.target.value })
                      }
                    >
                      <option value="" disabled>
                        Wählen …
                      </option>
                      {CURRENCY_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </NativeSelect>
                  </div>
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="rp-minstay">Mindestaufenthalt (Nächte)</Label>
                  <Input
                    id="rp-minstay"
                    type="number"
                    min={1}
                    value={rateDraft.minStay}
                    onChange={(e) => setRateDraft({ ...rateDraft, minStay: e.target.value })}
                  />
                </div>
                {error && <p className="text-sm text-destructive">{error}</p>}
              </div>
              <SheetFooter>
                <Button
                  variant="outline"
                  onClick={() => setRateEditing(null)}
                  disabled={busy}
                >
                  Abbrechen
                </Button>
                <Button onClick={saveRate} disabled={busy || !rateDraft.name.trim()}>
                  Speichern
                </Button>
              </SheetFooter>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
