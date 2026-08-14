"use client";

// Zusatzleistungen im Reservierungs-Detail (Schnelltaste). Listet die zu dieser
// Buchung gekauften Upsells (mit Zahlstatus + „als bezahlt markieren") und bietet
// ein Schnell-Hinzufügen aus dem Objekt-Katalog — funktioniert für JEDEN Kanal,
// auch OTA (z. B. Booking): die Hausverwaltung bucht ein Extra-Angebot
// (z. B. Erstausstattung/Einkauf) provisionsfrei am OTA vorbei dazu.
import { Icon } from "@iconify/react";
import { useTranslations, useLocale } from "next-intl";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@nextdays/ui/button";
import { Input } from "@nextdays/ui/input";
import { NativeSelect } from "@nextdays/ui/native-select";
import {
  addReservationAddon,
  availableReservationAddons,
  cancelReservationAddon,
  changeReservationAddonQty,
  createZahlungslink,
  deleteZahlungslink,
  getZahlungslink,
  listReservationAddons,
  markReservationAddonPaid,
  type Addon,
  type ReservationAddon,
  type Zahlungslink,
} from "@/lib/addons";
import { formatCurrency } from "@/lib/currency";
import { useRealtime } from "@/lib/use-realtime";

function localized(
  name: Record<string, string>,
  fallback: string,
): string {
  return name.de || name.en || Object.values(name)[0] || fallback;
}

export function ReservationAddonsSection({
  reservationId,
  currency,
  onChanged,
}: {
  reservationId: string;
  // Währung der Reservierung (kann null sein, wenn keine hinterlegt ist).
  currency: string | null;
  onChanged?: () => void;
}) {
  const t = useTranslations("calendar");
  // „Abbrechen" für das Verwerfen einer Eingabe kommt aus `common` — der Text
  // ist in allen 24 Sprachen gepflegt. Ein eigener Schlüssel im
  // calendar-Namespace wäre eine zweite Kopie desselben Wortes, die beim
  // nächsten Sprachfall auseinanderläuft.
  const tc = useTranslations("common");
  const locale = useLocale();
  const STATUS_LABEL: Record<ReservationAddon["status"], string> = {
    pending: t("reservationAddonsSection.statusPending"),
    paid: t("reservationAddonsSection.statusPaid"),
    cancelled: t("reservationAddonsSection.statusCancelled"),
  };
  const [purchased, setPurchased] = useState<ReservationAddon[]>([]);
  const [catalog, setCatalog] = useState<Addon[]>([]);
  // Währung: bevorzugt die der Reservierung, sonst die vom Backend gelieferte
  // Objekt-Währung. Kein €-Fallback (Mehrwährung über 27 EU-Länder).
  const [cur, setCur] = useState<string | null>(currency);
  const [pick, setPick] = useState("");
  // Menge als TEXT: ein leeres Feld beim Tippen muss erlaubt sein, ohne dass
  // sofort eine 0 oder NaN im State steht.
  const [menge, setMenge] = useState("1");
  // Gästezahl der Buchung — die Vorbelegung für „pro Gast"-Leistungen. Kommt aus
  // der Liste der gekauften Zusatzleistungen mit (`guests` in der Antwort).
  const [gaeste, setGaeste] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  // Menge einer bereits gebuchten Position ändern (nur solange offen).
  const [editId, setEditId] = useState<string | null>(null);
  const [editMenge, setEditMenge] = useState("1");
  const [editBusy, setEditBusy] = useState(false);
  // Storno wird inline bestätigt (id der Zeile, die gerade nachfragt) — dasselbe
  // Muster wie der Buchungs-Storno im Slider, kein blindes Ein-Klick-Entfernen.
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);
  // Stripe-Zahlungslink über die offenen Zusatzleistungen. null = keiner offen.
  const [link, setLink] = useState<Zahlungslink | null>(null);
  const [linkBusy, setLinkBusy] = useState(false);

  const money = (v: number) =>
    cur ? formatCurrency(v, cur) : v.toLocaleString(locale);

  async function reload() {
    const [bought, avail, zahlung] = await Promise.all([
      listReservationAddons(reservationId),
      availableReservationAddons(reservationId),
      getZahlungslink(reservationId),
    ]);
    // Der Link kommt serverseitig mit Stripe abgeglichen zurück; ein Fehler
    // dabei darf die Liste nicht leeren (dann bleibt der letzte Stand stehen).
    if (zahlung.ok) setLink(zahlung.data);
    if (bought.ok) {
      setPurchased(bought.data.items);
      if (bought.data.currency) setCur(bought.data.currency);
      // Vorbelegung des Mengenfeldes bei „pro Gast" (siehe `waehlen`).
      if (bought.data.guests != null) setGaeste(bought.data.guests);
    }
    if (avail.ok) {
      setCatalog(avail.data.items);
      if (avail.data.currency) setCur((c) => c ?? avail.data.currency);
    }
  }

  useEffect(() => {
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reservationId]);

  // Echtes Realtime (Supabase WebSocket): Käufe/Statuswechsel dieser Reservierung
  // sofort spiegeln — kein Polling (Projekt-Grundsatz).
  useRealtime({
    table: "reservation_addons",
    filter: `reservation_id=eq.${reservationId}`,
    onChange: () => void reload(),
  });

  /** Auswahl gewechselt → Menge auf die Vorbelegung der Basis setzen.
   *
   *  „pro Gast" schlägt die Gästezahl der Buchung vor (der Normalfall: Wäsche
   *  für alle), jede andere Basis 1. Der Vorschlag ist überschreibbar — genau
   *  dafür gibt es das Feld: eine Buchung über 4 Personen bestellt oft nur 2
   *  Wäschepakete. */
  function waehlen(id: string) {
    setPick(id);
    const a = catalog.find((x) => x.id === id);
    setMenge(
      a?.basis === "per_guest" && gaeste && gaeste > 0 ? String(gaeste) : "1",
    );
  }

  async function add() {
    if (!pick) return;
    const anzahl = Number(menge);
    if (!Number.isInteger(anzahl) || anzahl < 1 || anzahl > 99) {
      toast.error(t("reservationAddonsSection.qtyInvalid"));
      return;
    }
    setBusy(true);
    const res = await addReservationAddon(reservationId, pick, anzahl);
    setBusy(false);
    if (res.ok) {
      setPurchased(res.data.items);
      setPick("");
      setMenge("1");
      toast.success(t("reservationAddonsSection.addSuccess"));
      onChanged?.();
    } else {
      toast.error(res.error);
    }
  }

  async function mengeSpeichern(id: string) {
    const anzahl = Number(editMenge);
    if (!Number.isInteger(anzahl) || anzahl < 1 || anzahl > 99) {
      toast.error(t("reservationAddonsSection.qtyInvalid"));
      return;
    }
    setEditBusy(true);
    const res = await changeReservationAddonQty(id, anzahl);
    setEditBusy(false);
    if (res.ok) {
      setEditId(null);
      await reload();
      toast.success(t("reservationAddonsSection.qtySaved"));
      // Die Menge ändert die fällige Summe der Buchung → Detail neu rechnen.
      onChanged?.();
    } else {
      toast.error(res.error);
    }
  }

  async function markPaid(id: string) {
    const res = await markReservationAddonPaid(id);
    if (res.ok) {
      await reload();
      toast.success(t("reservationAddonsSection.markPaidSuccess"));
    } else {
      toast.error(res.error);
    }
  }

  async function cancelAddon(id: string) {
    setCancelling(true);
    const res = await cancelReservationAddon(id);
    setCancelling(false);
    setConfirmId(null);
    if (res.ok) {
      await reload();
      toast.success(t("reservationAddonsSection.cancelSuccess"));
      // Der Storno ändert die fällige Summe der Buchung → Detail neu rechnen.
      onChanged?.();
    } else {
      toast.error(res.error);
    }
  }

  async function linkErstellen() {
    setLinkBusy(true);
    const res = await createZahlungslink(reservationId);
    setLinkBusy(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    setLink(res.data);
    await kopieren(res.data.url);
  }

  async function linkZurueckziehen() {
    setLinkBusy(true);
    const res = await deleteZahlungslink(reservationId);
    setLinkBusy(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    setLink(null);
    toast.success(t("reservationAddonsSection.linkWithdrawn"));
  }

  async function kopieren(url: string) {
    try {
      await navigator.clipboard.writeText(url);
      toast.success(t("reservationAddonsSection.linkCopied"));
    } catch {
      // Ohne Zwischenablage-Recht (unsicherer Kontext/Berechtigung verweigert)
      // ist der Link nicht verloren — er steht sichtbar daneben.
      toast.message(t("reservationAddonsSection.linkCopyFailed"));
    }
  }

  const total = purchased
    .filter((p) => p.status !== "cancelled")
    .reduce((s, p) => s + p.total, 0);
  const offeneAnzahl = purchased.filter((p) => p.status === "pending").length;

  return (
    <div className="rounded-(--radius) border p-3">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {t("reservationAddonsSection.title")}
      </p>

      {purchased.length > 0 ? (
        <div className="mb-3 flex flex-col gap-2">
          {purchased.map((p) => (
            <div key={p.id} className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between gap-2 text-sm">
                <span className="flex min-w-0 items-center gap-2">
                  <span
                    className={`truncate ${
                      p.status === "cancelled"
                        ? "text-muted-foreground line-through"
                        : ""
                    }`}
                  >
                    {localized(p.name, t("reservationAddonsSection.fallbackAddonName"))}
                  </span>
                  {p.qty > 1 && (
                    <span className="text-muted-foreground">×{p.qty}</span>
                  )}
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs ${
                      p.status === "paid"
                        ? "bg-secondary"
                        : p.status === "cancelled"
                          ? "bg-muted text-muted-foreground"
                          : "bg-amber-100 text-amber-800"
                    }`}
                  >
                    {STATUS_LABEL[p.status]}
                  </span>
                </span>
                <span className="flex shrink-0 items-center gap-2">
                  <span
                    className={
                      p.status === "cancelled"
                        ? "text-muted-foreground line-through"
                        : ""
                    }
                  >
                    {money(p.total)}
                  </span>
                  {/* Menge korrigieren, solange die Position offen ist. Ohne das
                      ginge eine falsche Stückzahl nur über Storno + Neuanlage. */}
                  {p.status === "pending" && (
                    <button
                      type="button"
                      onClick={() => {
                        setEditId((c) => (c === p.id ? null : p.id));
                        setEditMenge(String(p.qty));
                        setConfirmId(null);
                      }}
                      aria-label={t("reservationAddonsSection.qtyEditAction")}
                      title={t("reservationAddonsSection.qtyEditAction")}
                      className="text-muted-foreground transition-colors hover:text-accent"
                    >
                      <Icon icon="ph:pencil-simple" className="size-4" />
                    </button>
                  )}
                  {p.status === "pending" && (
                    <button
                      type="button"
                      onClick={() => void markPaid(p.id)}
                      className="text-xs font-medium text-accent hover:underline"
                    >
                      {t("reservationAddonsSection.markPaidAction")}
                    </button>
                  )}
                  {/* Storno für falsch gebuchte Zusatzleistungen. Nur solange
                      offen — Bezahltes wird über die Zahlung/Rechnung
                      rückabgewickelt, nicht hier weggeklickt. */}
                  {p.status === "pending" && (
                    <button
                      type="button"
                      onClick={() =>
                        setConfirmId((c) => (c === p.id ? null : p.id))
                      }
                      disabled={cancelling}
                      aria-label={t("reservationAddonsSection.cancelAction")}
                      title={t("reservationAddonsSection.cancelAction")}
                      className="text-muted-foreground transition-colors hover:text-destructive disabled:opacity-50"
                    >
                      <Icon icon="ph:x-circle" className="size-4" />
                    </button>
                  )}
                </span>
              </div>
              {editId === p.id && (
                <div className="flex flex-wrap items-end justify-between gap-2 rounded-(--radius) border p-2">
                  <label className="flex w-28 flex-col gap-1">
                    <span className="text-xs text-muted-foreground">
                      {t("reservationAddonsSection.qtyLabel")}
                    </span>
                    <Input
                      type="number"
                      min={1}
                      max={99}
                      step={1}
                      value={editMenge}
                      onChange={(e) => setEditMenge(e.target.value)}
                    />
                  </label>
                  <span className="flex shrink-0 gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setEditId(null)}
                      disabled={editBusy}
                    >
                      {tc("cancel")}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => void mengeSpeichern(p.id)}
                      disabled={editBusy}
                    >
                      {editBusy
                        ? t("reservationAddonsSection.qtySaving")
                        : t("reservationAddonsSection.qtySave")}
                    </Button>
                  </span>
                </div>
              )}
              {confirmId === p.id && (
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-(--radius) border border-destructive/30 p-2">
                  <p className="text-xs text-destructive">
                    {t("reservationAddonsSection.cancelConfirm")}
                  </p>
                  <span className="flex shrink-0 gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setConfirmId(null)}
                      disabled={cancelling}
                    >
                      {tc("cancel")}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      onClick={() => void cancelAddon(p.id)}
                      disabled={cancelling}
                    >
                      {cancelling
                        ? t("reservationAddonsSection.cancelBusy")
                        : t("reservationAddonsSection.cancelAction")}
                    </Button>
                  </span>
                </div>
              )}
            </div>
          ))}
          <div className="mt-1 flex justify-between border-t pt-1.5 text-sm font-semibold">
            <span>{t("reservationAddonsSection.totalLabel")}</span>
            <span>{money(total)}</span>
          </div>
        </div>
      ) : (
        <p className="mb-3 text-sm text-muted-foreground">
          {t("reservationAddonsSection.emptyPurchased")}
        </p>
      )}

      {/* Zahlungslink: Der Gast bezahlt die offenen Zusatzleistungen per Karte.
          Der Charge läuft im verbundenen Stripe-Konto des Betriebs, das Geld
          wird dort gutgeschrieben und über Konto → Abrechnung ausgezahlt. */}
      {(offeneAnzahl > 0 || link) && (
        <div className="mb-3 flex flex-col gap-2 rounded-(--radius) border border-border p-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {t("reservationAddonsSection.linkTitle")}
            </span>
            {link ? (
              <span className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => void kopieren(link.url)}
                >
                  <Icon icon="ph:copy" className="size-4" />
                  {t("reservationAddonsSection.linkCopy")}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => void linkZurueckziehen()}
                  disabled={linkBusy}
                >
                  {t("reservationAddonsSection.linkWithdraw")}
                </Button>
              </span>
            ) : (
              <Button
                type="button"
                size="sm"
                onClick={() => void linkErstellen()}
                disabled={linkBusy || offeneAnzahl === 0}
              >
                <Icon icon="ph:link" className="size-4" />
                {linkBusy
                  ? t("reservationAddonsSection.linkBusy")
                  : t("reservationAddonsSection.linkCreate")}
              </Button>
            )}
          </div>
          {link && (
            <>
              {/* Was der Betrieb wirklich bekommt. Vorher stand der
                  Plattform-Anteil nur in der Server-Antwort — Entgelte müssen
                  aber VOR der Nutzung klar sein (P2B-Verordnung). */}
              <p className="text-xs text-muted-foreground">
                {t("reservationAddonsSection.linkAufteilung", {
                  brutto: money(link.amount_cents / 100),
                  anteil: money(link.application_fee_cents / 100),
                  prozent: (link.fee_bps / 100).toLocaleString(locale, {
                    maximumFractionDigits: 2,
                  }),
                })}
              </p>
              <a
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                className="truncate text-xs text-accent hover:underline"
              >
                {link.url}
              </a>
            </>
          )}
        </div>
      )}

      {/* Schnell-Hinzufügen aus dem Objekt-Katalog (jeder Kanal, auch OTA).
          Die Menge steht daneben, weil sie bei „pro Gast" die Personenzahl IST:
          eine Buchung über 4 Personen bestellt oft nur 2 Wäschepakete. Sie wird
          mit der Gästezahl vorbelegt, sobald eine Leistung gewählt ist. */}
      {catalog.length > 0 ? (
        <div className="flex flex-wrap items-end gap-2">
          <label className="flex min-w-40 flex-1 flex-col gap-1">
            <span className="text-xs text-muted-foreground">
              {t("reservationAddonsSection.pickLabel")}
            </span>
            <NativeSelect value={pick} onChange={(e) => waehlen(e.target.value)}>
              <option value="">{t("reservationAddonsSection.pickPlaceholder")}</option>
              {catalog.map((a) => (
                <option key={a.id} value={a.id}>
                  {localized(a.name, t("reservationAddonsSection.fallbackAddonName"))} ·{" "}
                  {money(a.price)}
                  {a.basis === "per_guest"
                    ? ` ${t("reservationAddonsSection.perGuestSuffix")}`
                    : ""}
                </option>
              ))}
            </NativeSelect>
          </label>
          <label className="flex w-24 flex-col gap-1">
            <span className="text-xs text-muted-foreground">
              {t("reservationAddonsSection.qtyLabel")}
            </span>
            <Input
              type="number"
              min={1}
              max={99}
              step={1}
              value={menge}
              disabled={!pick}
              onChange={(e) => setMenge(e.target.value)}
            />
          </label>
          <Button type="button" size="sm" onClick={() => void add()} disabled={!pick || busy}>
            <Icon icon="ph:plus" className="size-4" />
            {busy ? t("reservationAddonsSection.addBusy") : t("reservationAddonsSection.addAction")}
          </Button>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">
          {t("reservationAddonsSection.emptyCatalog")}
        </p>
      )}
    </div>
  );
}
