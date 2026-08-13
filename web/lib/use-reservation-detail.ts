"use client";

// Geteilte Zustands-/Aktionslogik einer Reservierungs-Detailansicht. Sowohl der
// rechte Kalender-Slider (reservation-detail-slider) als auch die PM-Detail-
// Vollseite (booking-detail) nutzen diesen Hook — die Business-Logik
// (Laden, Realtime, Check-in/Check-out, Storno, Rechnungs-Dialog) lebt damit an
// EINER Stelle, kein Doppelcode (CLAUDE.md: keine Doppelpflege). Die UIs
// unterscheiden sich nur im Layout, nicht in der Logik.
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { getInvoice } from "@/lib/buchhaltung";
import { type InvoiceDocument, invoiceToDocument } from "@/lib/invoice-document";
import {
  type CheckOutPayment,
  type CheckOutResult,
  type ReservationDetail,
  cancelReservation,
  checkInReservation,
  checkOutReservation,
  getReservationDetail,
} from "@/lib/reservations";
import { useRealtime } from "@/lib/use-realtime";

export type UseReservationDetail = {
  data: ReservationDetail | null;
  error: string | null;
  reload: () => void;

  // Check-in / Check-out
  actionBusy: boolean;
  actionError: string | null;
  checkoutResult: CheckOutResult | null;
  doCheckIn: () => Promise<void>;
  doCheckOut: (payment: CheckOutPayment) => Promise<void>;

  // Storno
  cancelling: boolean;
  submitCancel: (reason: string) => Promise<boolean>;

  // Rechnungs-Dialog (PDF-Vorschau/Versand)
  invoiceDoc: InvoiceDocument | null;
  invoiceDocBusy: boolean;
  openInvoiceDialog: (invoiceId: string) => Promise<void>;
  closeInvoiceDialog: () => void;
};

export function useReservationDetail(
  reservationId: string,
  // Callbacks für die Umgebung (z. B. Board/Slider-Liste neu laden). onChanged
  // läuft nach JEDER erfolgreichen Aktion (Check-in/out/Storno). onCancelled
  // läuft ZUSÄTZLICH nur nach einem Storno — Aufrufer nutzen das, um den Slider
  // zu schließen. Beide getrennt zu halten ist wichtig: würde onCancelled auch
  // bei Check-in/out feuern, schlösse sich der Slider fälschlich (der Nutzer
  // soll das Check-out-Ergebnis/die Rechnung aber sehen).
  callbacks?: { onChanged?: () => void; onCancelled?: () => void },
): UseReservationDetail {
  const onChanged = callbacks?.onChanged;
  const onCancelled = callbacks?.onCancelled;
  const [data, setData] = useState<ReservationDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [actionBusy, setActionBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [checkoutResult, setCheckoutResult] = useState<CheckOutResult | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [invoiceDoc, setInvoiceDoc] = useState<InvoiceDocument | null>(null);
  const [invoiceDocBusy, setInvoiceDocBusy] = useState(false);

  const reload = useCallback(() => {
    getReservationDetail(reservationId).then((res) => {
      if (res.ok) {
        // Diagnose der Felder, die die Darstellung umschalten (Eigennutzung,
        // Preis, Ablage, Nachrichten-Thread). Ohne diese Zeile ist ein „warum
        // steht da Direkt statt Eigennutzung?" nur durch Raten zu beantworten.
        console.debug("[ReservationDetail] geladen", {
          id: res.data.id,
          is_owner_stay: res.data.is_owner_stay,
          total_amount: res.data.total_amount,
          archived_at: res.data.archived_at,
          message_thread_id: res.data.message_thread_id,
        });
        setData(res.data);
      } else {
        console.debug("[ReservationDetail] Laden fehlgeschlagen:", res.error);
        setError(res.error);
      }
    });
  }, [reservationId]);

  useEffect(() => {
    setData(null);
    setError(null);
    setActionError(null);
    setCheckoutResult(null);
    reload();
  }, [reload]);

  // Realtime (WebSocket, kein Polling): das Detail folgt Änderungen sofort — auch
  // wenn parallel jemand anderes ein-/auscheckt. invoices ist für authenticated
  // bewusst gesperrt (Wurzel 6); die Rechnung entsteht beim Check-out, der die
  // Reservierung mitschreibt, also genügt dieses eine Abo.
  useRealtime({
    table: "reservations",
    filter: `id=eq.${reservationId}`,
    onChange: reload,
  });

  const doCheckIn = useCallback(async () => {
    setActionBusy(true);
    setActionError(null);
    const res = await checkInReservation(reservationId);
    setActionBusy(false);
    if (res.ok) {
      toast.success("Gast eingecheckt.");
      reload();
      onChanged?.();
    } else {
      setActionError(res.error);
    }
  }, [reservationId, reload, onChanged]);

  const doCheckOut = useCallback(
    async (payment: CheckOutPayment) => {
      setActionBusy(true);
      setActionError(null);
      const res = await checkOutReservation(reservationId, payment);
      setActionBusy(false);
      if (res.ok) {
        toast.success(
          res.data.invoice_already_existed
            ? "Gast ausgecheckt — bestehende Rechnung verwendet."
            : `Gast ausgecheckt — Rechnung ${res.data.invoice_number ?? ""} erstellt.`,
        );
        setCheckoutResult(res.data);
        reload();
        onChanged?.();
      } else {
        setActionError(res.error);
      }
    },
    [reservationId, reload, onChanged],
  );

  const submitCancel = useCallback(
    async (reason: string): Promise<boolean> => {
      const r = reason.trim();
      if (!r) return false;
      setCancelling(true);
      const res = await cancelReservation(reservationId, r);
      setCancelling(false);
      if (res.ok) {
        toast.success("Reservierung storniert.");
        reload();
        onChanged?.();
        onCancelled?.();
        return true;
      }
      setActionError(res.error);
      return false;
    },
    [reservationId, reload, onChanged, onCancelled],
  );

  const openInvoiceDialog = useCallback(
    async (invoiceId: string) => {
      setInvoiceDocBusy(true);
      const res = await getInvoice(invoiceId);
      setInvoiceDocBusy(false);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      // Empfängerdaten speichert das Backend nicht am Beleg — Gastname/-mail aus
      // dem Reservierungs-Detail mitgeben (maskiert je nach Rolle).
      setInvoiceDoc(
        invoiceToDocument(res.data, {
          customerName: data?.guest_name ?? "",
          customerEmail: data?.guest_email ?? "",
        }),
      );
    },
    [data?.guest_name, data?.guest_email],
  );

  const closeInvoiceDialog = useCallback(() => setInvoiceDoc(null), []);

  return {
    data,
    error,
    reload,
    actionBusy,
    actionError,
    checkoutResult,
    doCheckIn,
    doCheckOut,
    cancelling,
    submitCancel,
    invoiceDoc,
    invoiceDocBusy,
    openInvoiceDialog,
    closeInvoiceDialog,
  };
}
