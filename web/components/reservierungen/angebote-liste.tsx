"use client";

// Angebotsliste (Lastenheft §2.2, 0586): welche Angebote laufen, wer hat
// geöffnet, wer zugesagt, was ist bezahlt.
//
// WARUM SIE GEBRAUCHT WIRD: Ein Angebot reserviert nichts. Zwischen Zusage und
// Zahlung ist der Zeitraum noch frei verkäuflich — der Betrieb muss also sehen
// können, welche Nächte gerade „in Aussicht" sind, bevor er sie anderweitig
// vergibt. Die Glocke meldet die Antwort (0587), diese Liste ist der Überblick.
//
// Realtime auf `booking_offers`: der Gast öffnet, sagt zu und zahlt ohne dass
// jemand im Betrieb etwas anklickt — eine Liste, die man neu laden muss, wäre
// hier die falsche Bauform (kein manuelles Reload nach fremder Aktion).
import { Icon } from "@iconify/react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { Button } from "@nextdays/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@nextdays/ui/select";
import {
  type BookingOffer,
  type OfferStatus,
  OFFER_STATUSES,
  STATUS_TON,
} from "@/lib/booking-offers-meta";
import { cancelOffer, listOffers, sendOffer } from "@/lib/booking-offers";
import { formatCurrency } from "@/lib/currency";
import { useRealtime } from "@/lib/use-realtime";

const TON_KLASSE: Record<"neutral" | "offen" | "gut" | "aus", string> = {
  neutral: "bg-secondary text-secondary-foreground",
  offen: "bg-accent/15 text-accent",
  gut: "bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-100",
  aus: "bg-muted text-muted-foreground",
};

export function AngeboteListe() {
  const t = useTranslations("angebote");
  const [items, setItems] = useState<BookingOffer[]>([]);
  const [gesamt, setGesamt] = useState(0);
  const [filter, setFilter] = useState<OfferStatus | "alle">("alle");
  const [laedt, setLaedt] = useState(true);
  const [fehler, setFehler] = useState<string | null>(null);
  const [aktion, setAktion] = useState<string | null>(null);

  const laden = useCallback(async () => {
    setLaedt(true);
    const res = await listOffers({
      status: filter === "alle" ? undefined : filter,
      limit: 100,
    });
    setLaedt(false);
    if (!res.ok) {
      setFehler(res.error);
      return;
    }
    setFehler(null);
    setItems(res.data.items);
    setGesamt(res.data.total);
  }, [filter]);

  useEffect(() => {
    void laden();
  }, [laden]);

  // Der Zustand ändert sich durch den GAST (öffnen, zusagen, zahlen) und durch
  // den Ablaufjob — beides ohne Zutun des Betriebs. Deshalb neu laden statt
  // eine Zeile aus dem Payload zu basteln: die Liste ist kurz, und der
  // Status-Filter müsste sonst hier nachgerechnet werden.
  useRealtime<{ id: string }>({
    table: "booking_offers",
    onEvent: () => {
      void laden();
    },
  });

  async function erneutSenden(id: string) {
    setAktion(id);
    const res = await sendOffer(id);
    setAktion(null);
    if (!res.ok) setFehler(res.error);
  }

  async function zurueckziehen(id: string) {
    setAktion(id);
    const res = await cancelOffer(id);
    setAktion(null);
    if (!res.ok) setFehler(res.error);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-extrabold">{t("titel")}</h1>
          <p className="text-sm text-muted-foreground">{t("untertitel")}</p>
        </div>
        <Select
          value={filter}
          onValueChange={(w) => setFilter(w as OfferStatus | "alle")}
        >
          <SelectTrigger className="w-52">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="alle">{t("filter.alle")}</SelectItem>
            {OFFER_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {t(`status.${s}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {fehler && (
        <p className="rounded-(--radius) border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {fehler}
        </p>
      )}

      {laedt && items.length === 0 && (
        <p className="text-sm text-muted-foreground">{t("laedt")}</p>
      )}

      {!laedt && items.length === 0 && (
        <div className="rounded-(--radius) border border-dashed px-4 py-10 text-center">
          <Icon icon="ph:paper-plane-tilt" className="mx-auto size-8 text-muted-foreground" />
          <p className="mt-2 text-sm font-medium">{t("leer.titel")}</p>
          <p className="mt-1 text-sm text-muted-foreground">{t("leer.hinweis")}</p>
          <Button asChild variant="outline" className="mt-4">
            <Link href="/kalender">{t("leer.zumKalender")}</Link>
          </Button>
        </div>
      )}

      {items.length > 0 && (
        <>
          <p className="text-xs text-muted-foreground">
            {t("anzahl", { sichtbar: items.length, gesamt })}
          </p>
          <ul className="space-y-2">
            {items.map((o) => (
              <li
                key={o.id}
                className="rounded-(--radius) border bg-card px-4 py-3"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold">{o.guest_name}</span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${TON_KLASSE[STATUS_TON[o.status]]}`}
                      >
                        {t(`status.${o.status}`)}
                      </span>
                    </div>
                    <p className="mt-0.5 text-sm text-muted-foreground">
                      {o.property_title} · {o.check_in} – {o.check_out} ·{" "}
                      {t("naechte", { anzahl: o.nights })}
                    </p>
                    <p className="mt-0.5 text-sm">
                      {formatCurrency(o.total_amount, o.currency)}
                      {o.deposit_amount != null && (
                        <span className="text-muted-foreground">
                          {" · "}
                          {t("anzahlungInfo", {
                            betrag: formatCurrency(o.deposit_amount, o.currency),
                          })}
                        </span>
                      )}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {t("frist", { datum: o.expires_at.slice(0, 10) })}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-wrap gap-2">
                    {o.reservation_id && (
                      <Button asChild variant="outline" size="sm">
                        <Link href={`/reservierungen/${o.reservation_id}`}>
                          {t("aktionen.zurBuchung")}
                        </Link>
                      </Button>
                    )}
                    {(o.status === "draft" ||
                      o.status === "sent" ||
                      o.status === "viewed") && (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={aktion === o.id}
                          onClick={() => void erneutSenden(o.id)}
                        >
                          {o.status === "draft"
                            ? t("aktionen.senden")
                            : t("aktionen.erneutSenden")}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={aktion === o.id}
                          onClick={() => void zurueckziehen(o.id)}
                        >
                          {t("aktionen.zurueckziehen")}
                        </Button>
                      </>
                    )}
                  </div>
                </div>
                {o.internal_note && (
                  <p className="mt-2 border-t pt-2 text-xs text-muted-foreground">
                    {t("notiz")}: {o.internal_note}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
