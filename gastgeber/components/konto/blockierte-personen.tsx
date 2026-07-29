"use client";

// „Blockierte Personen" (Airbnb „Datenschutz → Nachrichten → Blockierte Personen",
// Hilfeartikel 4046). Wie bei Airbnb: eine Karte mit Pfeil öffnet ein zentriertes
// MODAL, das die blockierten Plattform-Gäste des Betriebs mit Name/E-Mail und
// „Freigeben" (Entblocken) pro Person zeigt.
//
// Kein Realtime: blocked_guests ist streng per-Tenant und liegt bewusst NICHT in
// der Realtime-Publication (Sicherheitsgrenze). Nach dem Entblocken wird die
// Liste inkrementell im State gepflegt (kein Reload, kein Polling).
import { Icon } from "@iconify/react";
import { useTranslations } from "next-intl";
import { useState } from "react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@nextdays/ui/dialog";

import type { BlockedGuest } from "@/lib/datenschutz";
import { entblockeGast, ladeBlockierte } from "@/lib/konto-actions";

export function BlockiertePersonen() {
  const t = useTranslations("konto");
  const [offen, setOffen] = useState(false);
  const [liste, setListe] = useState<BlockedGuest[] | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  function beiWechsel(auf: boolean) {
    setOffen(auf);
    if (auf && liste === null) void laden();
  }

  async function laden() {
    setFehler(null);
    const res = await ladeBlockierte();
    if (res.ok) setListe(res.blockierte);
    else setFehler(res.error);
  }

  async function freigeben(portalGuestId: string) {
    setBusyId(portalGuestId);
    setFehler(null);
    const res = await entblockeGast(portalGuestId);
    setBusyId(null);
    if (res.ok) {
      setListe((prev) =>
        prev?.filter((b) => b.portal_guest_id !== portalGuestId) ?? null,
      );
    } else {
      setFehler(res.error);
    }
  }

  return (
    <Dialog open={offen} onOpenChange={beiWechsel}>
      <DialogTrigger asChild>
        <button
          type="button"
          className="flex w-full items-center gap-3 rounded-2xl border border-border p-5 text-start transition-colors hover:bg-muted/50"
        >
          <span className="min-w-0 flex-1 font-medium">
            {t("dsBlockierteTitel")}
          </span>
          <Icon
            icon="ph:caret-right"
            className="size-4 shrink-0 text-muted-foreground"
          />
        </button>
      </DialogTrigger>

      <DialogContent>
        <DialogTitle className="mb-1">{t("dsBlockierteTitel")}</DialogTitle>
        <DialogDescription className="mb-5">
          {t("dsBlockierteText")}
        </DialogDescription>

        {fehler ? (
          <p className="text-sm text-destructive">{fehler}</p>
        ) : liste === null ? (
          <p className="py-4 text-sm text-muted-foreground">
            {t("dsBlockierteLaedt")}
          </p>
        ) : liste.length === 0 ? (
          <p className="py-4 text-sm text-muted-foreground">
            {t("dsBlockierteLeer")}
          </p>
        ) : (
          <ul className="-mx-2 max-h-[60vh] divide-y divide-border overflow-y-auto">
            {liste.map((b) => (
              <li key={b.id} className="flex items-center gap-4 px-2 py-3">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-semibold">
                  {(b.name ?? b.email ?? "?").slice(0, 1).toUpperCase()}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{b.name ?? "—"}</p>
                  <p className="truncate text-sm text-muted-foreground">
                    {b.email ?? "—"}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void freigeben(b.portal_guest_id)}
                  disabled={busyId === b.portal_guest_id}
                  className="shrink-0 text-sm font-medium underline underline-offset-2 hover:opacity-70 disabled:opacity-50"
                >
                  {busyId === b.portal_guest_id
                    ? t("dsBlockierteGebeFrei")
                    : t("dsBlockierteFreigeben")}
                </button>
              </li>
            ))}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  );
}
