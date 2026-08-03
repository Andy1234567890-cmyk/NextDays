"use client";

// Objekt × Portal — die Einstellungen dieses einen Paars (Lodgify-Muster:
// „Bearbeiten" in der Kanal-Zuordnungsliste führt genau hierher).
//
// Aufbau wie in der Referenz: Kopf mit Bild, Titel, eigener Kennung und den
// Status-Chips; darunter „Synchronisierung" (läuft der Abgleich zu diesem
// Portal?), „Aktive Tarifpläne" (was dort verkauft wird) und die Kennungen,
// mit denen man im Extranet des Portals nachschlägt.
//
// Was Lodgify dort noch hat und wir nicht: einen Synchronisierungs-TYP
// (teilweise/vollständig) und einen Schalter „Buchungsbeschränkungen
// exportieren". Beides gibt es bei uns nicht — und ein Bedienelement ohne
// Wirkung ist schlimmer als keines, deshalb steht hier keine Attrappe.
import { Icon } from "@iconify/react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useEffect, useState, useTransition } from "react";

import { AirbnbSteuererhebung } from "@/components/objekte/airbnb-steuererhebung";
import { Button } from "@nextdays/ui/button";
import { Card } from "@nextdays/ui/card";
import { Input } from "@nextdays/ui/input";
import { Switch } from "@nextdays/ui/switch";
import { channelLogoLoose } from "@/lib/channel-logos";
import type { ChannelPropertyDetail } from "@/lib/channex";
import {
  setConnectionActive,
  setPortalPriceAdjustment,
  triggerFullSync,
} from "@/lib/channex";
import { formatCurrency } from "@/lib/currency";

export function PropertyChannelDetail({
  detail,
  locale,
}: {
  detail: ChannelPropertyDetail;
  locale: string;
}) {
  const t = useTranslations("objects.channelDetail");
  const [aktiv, setAktiv] = useState(detail.is_active);
  const [pending, startTransition] = useTransition();

  // Der optimistische Zustand darf den echten nicht überdauern: nach einem
  // Realtime-Refresh liefert der Server die Wahrheit.
  useEffect(() => {
    setAktiv(detail.is_active);
  }, [detail.is_active]);

  const fehler = detail.last_error ?? detail.last_sync_error;
  const logo = channelLogoLoose(detail.portal_code);

  // Preisänderung je Portal (Lodgify-Modell): %-Aufschlag auf die effektive
  // Tageskurve GENAU DIESES Portals — editierbar direkt in der Tabelle.
  const [adjEdit, setAdjEdit] = useState(false);
  const [adjWert, setAdjWert] = useState(
    String(detail.price_adjustment_percent ?? 0),
  );
  const [adjFehler, setAdjFehler] = useState<string | null>(null);
  useEffect(() => {
    setAdjWert(String(detail.price_adjustment_percent ?? 0));
  }, [detail.price_adjustment_percent]);

  function preisAenderungSpeichern() {
    const wert = Number(adjWert.replace(",", "."));
    if (!Number.isFinite(wert) || wert < -99 || wert > 500) {
      setAdjFehler(t("adjustmentInvalid"));
      return;
    }
    setAdjFehler(null);
    startTransition(async () => {
      const res = await setPortalPriceAdjustment(
        detail.property_id,
        detail.portal_code,
        wert,
      );
      if (!res.ok) {
        setAdjFehler(res.error);
        return;
      }
      setAdjEdit(false);
    });
  }

  function verkaufUmschalten(next: boolean) {
    setAktiv(next);
    startTransition(async () => {
      const res = await setConnectionActive(
        detail.property_id,
        detail.portal_code,
        next,
      );
      if (!res.ok) setAktiv(!next);
    });
  }

  function jetztAbgleichen() {
    if (!detail.map_id) return;
    startTransition(async () => {
      await triggerFullSync(detail.map_id as string);
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <Link
        href={`/channels/${detail.portal_code}`}
        className="flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <Icon icon="ph:caret-left" className="size-4" />
        {t("backToChannel", { portal: detail.portal })}
      </Link>

      {/* Kopf: Bild · Titel · eigene Kennung · Status-Chips */}
      <div className="flex flex-wrap items-center gap-4">
        {detail.property_photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={detail.property_photo}
            alt=""
            className="size-14 shrink-0 rounded-(--radius) object-cover"
          />
        ) : (
          <span className="flex size-14 shrink-0 items-center justify-center rounded-(--radius) bg-muted text-muted-foreground">
            <Icon icon="ph:house" className="size-6" />
          </span>
        )}
        <div className="flex flex-col gap-1">
          <h1 className="font-display text-2xl font-extrabold">
            {detail.property_title}
          </h1>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="text-muted-foreground">
              {t("ourId")}{" "}
              <span className="font-mono">{detail.property_id.slice(0, 8)}</span>
            </span>
            <Chip
              ton={aktiv ? "gut" : "still"}
              text={aktiv ? t("published") : t("notPublished")}
            />
            <Chip
              ton={fehler ? "schlecht" : aktiv ? "gut" : "still"}
              text={
                fehler
                  ? t("statusError")
                  : aktiv
                    ? t("statusSynced")
                    : t("statusPaused")
              }
            />
          </div>
        </div>
        {logo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={logo}
            alt={detail.portal}
            className="ml-auto h-6 w-auto max-w-[8rem] object-contain"
          />
        ) : null}
      </div>

      {fehler && (
        <Card className="border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
          {fehler}
        </Card>
      )}

      {/* Synchronisierung */}
      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold">{t("syncSection")}</h2>
        <Card className="flex flex-col gap-4 p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex flex-col gap-1">
              <p className="font-medium">{t("sellingTitle")}</p>
              <p className="max-w-xl text-sm text-muted-foreground">
                {t("sellingHint")}
              </p>
            </div>
            <Switch
              checked={aktiv}
              disabled={pending}
              onCheckedChange={verkaufUmschalten}
              aria-label={t("sellingTitle")}
            />
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
            <div className="text-sm">
              <p className="text-muted-foreground">{t("lastSync")}</p>
              <p className="font-medium">
                {detail.last_sync_at
                  ? new Date(detail.last_sync_at).toLocaleString(locale)
                  : t("never")}
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              disabled={pending || !detail.map_id}
              onClick={jetztAbgleichen}
            >
              <Icon icon="ph:arrows-clockwise" className="mr-2 size-4" />
              {t("syncNow")}
            </Button>
          </div>
        </Card>
      </section>

      {/* Aktive Tarifpläne */}
      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold">{t("ratePlans")}</h2>
        <Card className="flex flex-col gap-3 p-5">
          {/* Dynamic Pricing an: ans Portal gehen die dynamischen TAGESPREISE
              — der Basispreis unten ist nur der Anker der Berechnung. Ohne
              diesen Hinweis liest sich die Tabelle als „129 € stehen beim
              Portal", während dort längst die Tageskurve liegt. */}
          {detail.dynamic_pricing_enabled && (
            <p className="flex items-start gap-2 rounded-(--radius) border border-accent/40 bg-accent/5 p-3 text-sm">
              <span aria-hidden className="text-accent">⚡</span>
              <span>
                <span className="font-semibold">{t("dynamicActiveTitle")}</span>{" "}
                <span className="text-muted-foreground">
                  {t("dynamicActiveHint")}
                </span>
              </span>
            </p>
          )}
          {detail.rate_plans.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("noRatePlans")}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[36rem] text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-muted-foreground">
                    <th className="py-2 pr-4 font-medium">{t("colCondition")}</th>
                    <th className="py-2 pr-4 font-medium">{t("colPlanName")}</th>
                    <th className="py-2 pr-4 font-medium">{t("colPrice")}</th>
                    <th className="py-2 font-medium">{t("colPriceChange")}</th>
                  </tr>
                </thead>
                <tbody>
                  {detail.rate_plans.map((p) => (
                    <tr
                      key={p.id}
                      className="border-b border-border/60 last:border-0"
                    >
                      <td className="py-3 pr-4 align-top">{p.condition ?? "—"}</td>
                      <td className="py-3 pr-4 align-top">
                        <p className="font-medium">{p.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {p.rate_mode === "derived"
                            ? t("modeDerived")
                            : t("modeManual")}
                          {p.min_stay
                            ? ` · ${t("minStay", { nights: p.min_stay })}`
                            : ""}
                          {/* Nicht freigegeben heißt: der Plan existiert, geht
                              aber nicht an die Portale. Das gehört an die Zeile
                              — sonst fehlt sie einfach und niemand weiß warum.
                              AUSSER beim Grundpreis-Plan: der geht IMMER ans
                              Portal (send_to_portals schaltet nur zusätzliche
                              Pläne frei) — dort wäre das Badge eine Lüge. */}
                          {p.send_to_portals || p.is_primary
                            ? ""
                            : ` · ${t("notReleased")}`}
                        </p>
                      </td>
                      <td className="py-3 pr-4 align-top">
                        {p.base_price === null
                          ? "—"
                          : formatCurrency(p.base_price, p.currency ?? "", locale)}
                      </td>
                      <td className="py-3 align-top">
                        {/* Grundpreis-Plan: die Preisänderung DIESES Portals
                            (Kanal-Plan-Offset, Lodgify-Modell) — direkt hier
                            editierbar. Abgeleitete Zusatz-Pläne zeigen wie
                            bisher ihren eigenen Offset. */}
                        {p.is_primary ? (
                          adjEdit ? (
                            <span className="flex items-center gap-2">
                              <Input
                                value={adjWert}
                                onChange={(e) => setAdjWert(e.target.value)}
                                inputMode="decimal"
                                className="h-8 w-20 text-right"
                                aria-label={t("colPriceChange")}
                              />
                              <span className="text-muted-foreground">%</span>
                              <Button
                                type="button"
                                size="sm"
                                disabled={pending}
                                onClick={preisAenderungSpeichern}
                              >
                                {t("adjustmentSave")}
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                onClick={() => {
                                  setAdjEdit(false);
                                  setAdjFehler(null);
                                  setAdjWert(
                                    String(detail.price_adjustment_percent ?? 0),
                                  );
                                }}
                              >
                                {t("adjustmentCancel")}
                              </Button>
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setAdjEdit(true)}
                              className="inline-flex items-center gap-1.5 hover:text-accent"
                              title={t("adjustmentHint")}
                            >
                              {`${detail.price_adjustment_percent ?? 0} %`}
                              <Icon icon="ph:pencil-simple" className="size-3.5" />
                            </button>
                          )
                        ) : p.offset_percent != null ? (
                          `${p.offset_percent} %`
                        ) : p.offset_amount != null ? (
                          `${p.offset_amount} ${p.currency ?? ""}`.trim()
                        ) : (
                          "—"
                        )}
                        {p.is_primary && adjFehler ? (
                          <p className="mt-1 text-xs text-destructive">
                            {adjFehler}
                          </p>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </section>

      {/* Airbnb-Steuererhebung: entscheidet, ob eigene Steuern dorthin gehen.
          Nur bei Airbnb — andere Portale kennen dieses Szenario nicht. */}
      {detail.portal_code === "AirBNB" && <AirbnbSteuererhebung detail={detail} />}

      {/* Kennungen beim Portal */}
      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold">{t("identifiers")}</h2>
        <Card className="p-5">
          <dl className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Feld label={t("hotelId")} wert={detail.hotel_id} />
            <Feld label={t("roomCode")} wert={detail.ota_room_type_code} />
            <Feld label={t("roomTitle")} wert={detail.ota_room_title} />
          </dl>
        </Card>
      </section>
    </div>
  );
}

function Chip({ ton, text }: { ton: "gut" | "still" | "schlecht"; text: string }) {
  const klasse =
    ton === "gut"
      ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400"
      : ton === "schlecht"
        ? "bg-destructive/10 text-destructive"
        : "bg-muted text-muted-foreground";
  return (
    <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${klasse}`}>
      {text}
    </span>
  );
}

function Feld({ label, wert }: { label: string; wert: string | null }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="font-mono text-sm">{wert ?? "—"}</dd>
    </div>
  );
}
