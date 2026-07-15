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

  // Kategorie-Editor (Sheet): "new" oder eine bestehende RoomType.
  const [roomEditing, setRoomEditing] = useState<RoomType | "new" | null>(null);
  const [roomDraft, setRoomDraft] = useState<RoomDraft>(emptyRoomDraft());
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
  function startCreateRoom() {
    setError(null);
    setRoomEditing("new");
    setRoomDraft(emptyRoomDraft());
  }
  function startEditRoom(rt: RoomType) {
    setError(null);
    setRoomEditing(rt);
    setRoomDraft(roomToDraft(rt));
  }

  async function saveRoom() {
    const title = roomDraft.title.trim();
    const count = parseInt(roomDraft.countOfRooms, 10);
    const adults = parseInt(roomDraft.occAdults, 10);
    const children = parseInt(roomDraft.occChildren, 10) || 0;
    const infants = parseInt(roomDraft.occInfants, 10) || 0;
    const defOcc = parseInt(roomDraft.defaultOccupancy, 10);
    if (!title) return setError("Bitte einen Namen für die Zimmerkategorie angeben.");
    if (!(count >= 1)) return setError("Zimmeranzahl muss mindestens 1 sein.");
    if (!(adults >= 1)) return setError("Belegung Erwachsene muss mindestens 1 sein.");
    // Channex-Regel (auch DB-Check + Backend-Validator): default ≤ Erwachsene.
    if (defOcc > adults)
      return setError("Standardbelegung darf die Erwachsenen-Belegung nicht übersteigen.");
    setBusy(true);
    setError(null);
    const res =
      roomEditing === "new"
        ? await createRoomType({
            propertyId,
            title,
            countOfRooms: count,
            occAdults: adults,
            occChildren: children,
            occInfants: infants,
            defaultOccupancy: defOcc,
          })
        : await updateRoomType((roomEditing as RoomType).id, {
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
  function startCreateRate(roomTypeId: string) {
    setError(null);
    setRateEditing({ roomTypeId, plan: "new" });
    setRateDraft({
      name: "",
      basePrice: "",
      // Bestehende Property-Währung vorbelegen (Konsistenz), sonst leer wählen.
      currency: propCurrency,
      minStay: "1",
    });
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

  async function saveRate() {
    if (!rateEditing) return;
    const name = rateDraft.name.trim();
    const price = Number(rateDraft.basePrice);
    const cur = rateDraft.currency;
    const minStay = Math.max(1, parseInt(rateDraft.minStay, 10) || 1);
    if (!name) return setError("Bitte einen Namen für den Preisplan angeben.");
    if (!(price >= 0) || rateDraft.basePrice === "")
      return setError("Bitte einen gültigen Preis angeben.");
    if (!cur) return setError("Bitte eine Währung wählen.");
    setBusy(true);
    setError(null);
    const res =
      rateEditing.plan === "new"
        ? await createRatePlan({
            propertyId,
            name,
            basePrice: price,
            currency: cur,
            minStay,
            roomTypeId: rateEditing.roomTypeId,
          })
        : await updateRatePlan((rateEditing.plan as RatePlan).id, {
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

      {/* Kategorie-Sheet */}
      <Sheet open={roomEditing !== null} onOpenChange={(o) => !o && setRoomEditing(null)}>
        <SheetContent className="flex flex-col gap-5 sm:max-w-md">
          <SheetHeader>
            <SheetTitle>
              {roomEditing === "new" ? "Neue Zimmerkategorie" : "Kategorie bearbeiten"}
            </SheetTitle>
            <SheetDescription>
              Belegung und Zimmeranzahl bestimmen Verfügbarkeit und Verkauf an die
              Portale.
            </SheetDescription>
          </SheetHeader>
          <div className="flex flex-col gap-4">
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
            {error && roomEditing && <p className="text-sm text-destructive">{error}</p>}
          </div>
          <SheetFooter>
            <Button variant="outline" onClick={() => setRoomEditing(null)} disabled={busy}>
              Abbrechen
            </Button>
            <Button onClick={saveRoom} disabled={busy || !roomDraft.title.trim()}>
              Speichern
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* Rate-Plan-Sheet */}
      <Sheet open={rateEditing !== null} onOpenChange={(o) => !o && setRateEditing(null)}>
        <SheetContent className="flex flex-col gap-5 sm:max-w-md">
          <SheetHeader>
            <SheetTitle>
              {rateEditing?.plan === "new" ? "Neuer Preisplan" : "Preisplan bearbeiten"}
            </SheetTitle>
            <SheetDescription>
              Mehrere Pläne je Kategorie (z. B. Best Available Rate, Bed & Breakfast)
              mit eigenem Preis.
            </SheetDescription>
          </SheetHeader>
          <div className="flex flex-col gap-4">
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
            {error && rateEditing && <p className="text-sm text-destructive">{error}</p>}
          </div>
          <SheetFooter>
            <Button variant="outline" onClick={() => setRateEditing(null)} disabled={busy}>
              Abbrechen
            </Button>
            <Button onClick={saveRate} disabled={busy || !rateDraft.name.trim()}>
              Speichern
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  );
}
