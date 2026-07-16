"use client";

// Hotel-Rate-Grid im Preise-Tab: eine Zeile pro Zimmerkategorie × Rate-Plan.
// Hier wohnt die PREIS-Pflege der Pläne (Grundpreis/Währung/Min-Stay inline,
// Datumspreise + datumsgenauer Min-Stay als aufklappbare Kalender — dieselben
// Bausteine wie der Rate-Plan-Editor). Die Zimmerkategorien-Seite behält nur
// die Struktur (Kategorien + Pläne anlegen/löschen/umbenennen). Eine Wahrheit:
// alles schreibt rate_plans/rate_plan_*_overrides über lib/rates.
import { Icon } from "@iconify/react";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { formatCurrency } from "@/lib/currency";
import { CURRENCY_OPTIONS } from "@/lib/pricing-meta";
import { listRatePlans, updateRatePlan, type RatePlan } from "@/lib/rates";
import { listRoomTypes, type RoomType } from "@/lib/room-types";
import { useRealtime } from "@/lib/use-realtime";

import { RatePlanMinStayCalendar } from "./rate-plan-minstay-calendar";
import { RatePlanPriceCalendar } from "./rate-plan-price-calendar";

export function HotelRateGrid({ propertyId }: { propertyId: string }) {
  const t = useTranslations("roomTypes");
  const [roomTypes, setRoomTypes] = useState<RoomType[]>([]);
  const [plans, setPlans] = useState<RatePlan[]>([]);
  // Aufgeklappter Plan (Preis-/Min-Stay-Kalender) — einer zugleich reicht.
  const [openPlan, setOpenPlan] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // Inline-Entwurf für Grundpreis/Währung/Min-Stay des aufgeklappten Plans.
  const [draft, setDraft] = useState<{
    basePrice: string;
    currency: string;
    minStay: string;
  } | null>(null);

  const load = useCallback(async () => {
    const [rts, rps] = await Promise.all([
      listRoomTypes(propertyId),
      listRatePlans(propertyId),
    ]);
    if (rts.ok) setRoomTypes(rts.data.items);
    if (rps.ok) setPlans(rps.data.items);
  }, [propertyId]);

  useEffect(() => {
    void load();
  }, [load]);

  // Live: Pläne (Preis/Name), Sync-Status (Reconciler) und Kategorien.
  useRealtime({
    table: "rate_plans",
    filter: `property_id=eq.${propertyId}`,
    onChange: () => void load(),
  });
  useRealtime({ table: "rate_plan_sync_state", onChange: () => void load() });
  useRealtime({
    table: "room_types",
    filter: `property_id=eq.${propertyId}`,
    onChange: () => void load(),
  });

  const plansFor = useMemo(() => {
    const by = new Map<string, RatePlan[]>();
    for (const p of plans) {
      const key = p.room_type_id ?? "";
      by.set(key, [...(by.get(key) ?? []), p]);
    }
    return by;
  }, [plans]);

  const toggle = (plan: RatePlan) => {
    if (openPlan === plan.id) {
      setOpenPlan(null);
      setDraft(null);
      return;
    }
    setOpenPlan(plan.id);
    setDraft({
      basePrice: String(plan.base_price),
      currency: plan.currency,
      minStay: String(plan.min_stay),
    });
  };

  const saveDraft = async (plan: RatePlan) => {
    if (!draft) return;
    const price = Number(draft.basePrice);
    const minStay = Number(draft.minStay);
    if (!Number.isFinite(price) || price < 0 || !draft.currency) return;
    setBusy(true);
    const res = await updateRatePlan(plan.id, {
      basePrice: price,
      currency: draft.currency,
      ...(Number.isInteger(minStay) && minStay >= 1 ? { minStay } : {}),
    });
    setBusy(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    void load();
  };

  if (roomTypes.length === 0) return null;

  return (
    <Card className="flex flex-col gap-4 p-5">
      <div className="leading-tight">
        <p className="font-semibold">{t("ratesTitle")}</p>
        <p className="mt-0.5 text-sm text-muted-foreground">{t("ratesHint")}</p>
      </div>
      <div className="flex flex-col gap-4">
        {roomTypes.map((rt) => (
          <div key={rt.id} className="flex flex-col gap-2">
            <p className="text-sm font-semibold">{rt.title}</p>
            {(plansFor.get(rt.id) ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("noRatePlan")}</p>
            ) : (
              (plansFor.get(rt.id) ?? []).map((plan) => (
                <div
                  key={plan.id}
                  className="flex flex-col gap-3 rounded-(--radius) bg-muted/40 px-3 py-2"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                      <span className="truncate text-sm font-medium">{plan.name}</span>
                      <span className="text-sm text-muted-foreground">
                        {formatCurrency(plan.base_price, plan.currency)}
                        {plan.min_stay > 1 ? t("minNights", { count: plan.min_stay }) : ""}
                      </span>
                      {plan.date_price_count > 0 && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-accent/10 px-2 py-0.5 text-xs font-medium text-accent">
                          <Icon icon="ph:calendar-dots" className="size-3.5" />
                          {t("datePriceCount", { count: plan.date_price_count })}
                        </span>
                      )}
                      {plan.sync_status === "synced" && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-success/10 px-2 py-0.5 text-xs font-medium text-success">
                          <Icon icon="ph:check-circle" className="size-3.5" />
                          {t("syncSynced")}
                        </span>
                      )}
                      {plan.sync_status === "pending" && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-warning/10 px-2 py-0.5 text-xs font-medium text-warning">
                          <Icon icon="ph:clock-countdown" className="size-3.5" />
                          {t("syncPending")}
                        </span>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="shrink-0"
                      onClick={() => toggle(plan)}
                      aria-expanded={openPlan === plan.id}
                    >
                      <Icon
                        icon={openPlan === plan.id ? "ph:caret-up" : "ph:caret-down"}
                        className="size-4"
                      />
                      {t("editRatePlan")}
                    </Button>
                  </div>

                  {openPlan === plan.id && draft && (
                    <div className="flex flex-col gap-4 border-t pt-3">
                      <div className="grid gap-4 sm:grid-cols-3">
                        <div className="flex flex-col gap-1.5">
                          <Label htmlFor={`rg-price-${plan.id}`}>{t("price")}</Label>
                          <Input
                            id={`rg-price-${plan.id}`}
                            type="number"
                            min={0}
                            step="0.01"
                            value={draft.basePrice}
                            onChange={(e) =>
                              setDraft({ ...draft, basePrice: e.target.value })
                            }
                          />
                        </div>
                        <div className="flex flex-col gap-1.5">
                          <Label htmlFor={`rg-cur-${plan.id}`}>{t("currency")}</Label>
                          <NativeSelect
                            id={`rg-cur-${plan.id}`}
                            value={draft.currency}
                            onChange={(e) =>
                              setDraft({ ...draft, currency: e.target.value })
                            }
                          >
                            <option value="" disabled>
                              {t("chooseOption")}
                            </option>
                            {CURRENCY_OPTIONS.map((o) => (
                              <option key={o.value} value={o.value}>
                                {o.label}
                              </option>
                            ))}
                          </NativeSelect>
                        </div>
                        <div className="flex flex-col gap-1.5">
                          <Label htmlFor={`rg-ms-${plan.id}`}>{t("minStayLabel")}</Label>
                          <Input
                            id={`rg-ms-${plan.id}`}
                            type="number"
                            min={1}
                            value={draft.minStay}
                            onChange={(e) =>
                              setDraft({ ...draft, minStay: e.target.value })
                            }
                          />
                        </div>
                      </div>
                      <Button
                        size="sm"
                        className="self-start"
                        onClick={() => void saveDraft(plan)}
                        disabled={busy || !draft.currency}
                      >
                        {t("save")}
                      </Button>

                      <div className="flex flex-col gap-1.5">
                        <Label>{t("pricesByDate")}</Label>
                        <p className="text-sm text-muted-foreground">
                          {t("pricesByDateHint")}
                        </p>
                        <RatePlanPriceCalendar
                          ratePlanId={plan.id}
                          currency={draft.currency}
                          syncStatus={plan.sync_status}
                        />
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <Label>{t("minStayByDate")}</Label>
                        <p className="text-sm text-muted-foreground">
                          {t("minStayByDateHint")}
                        </p>
                        <RatePlanMinStayCalendar ratePlanId={plan.id} />
                      </div>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        ))}
      </div>
    </Card>
  );
}
