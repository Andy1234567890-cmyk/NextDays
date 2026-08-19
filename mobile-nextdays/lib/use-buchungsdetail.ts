// Zustand und Aktionen einer Buchungs-Detailansicht — EINE Quelle für das
// Buchungs-Panel (Kalender, Buchungsliste, Übersicht). Portierung des
// Web-Musters `web/lib/use-reservation-detail.ts`: die Logik (Laden, Realtime,
// Check-in/Check-out, Storno) lebt hier, die Oberfläche entscheidet nur das
// Layout. Ohne diese Trennung wäre dieselbe Fachlogik an jeder Einstiegsstelle
// erneut gepflegt.
import { useCallback, useEffect, useRef, useState } from "react";

import { useRealtime } from "@/lib/realtime";
import {
  acceptReservationRequest,
  cancelReservation,
  checkInReservation,
  checkOutReservation,
  declineReservationRequest,
  getReservationDetail,
  type CancelReasonCode,
  type CheckOutPayment,
  type CheckOutResult,
  type ReservationDetail,
} from "@/lib/reservations";

export type BuchungsDetail = {
  data: ReservationDetail | null;
  /** Grund, warum das Laden scheiterte. null = kein Fehler. */
  error: string | null;
  neuLaden: () => void;

  // Eine laufende Aktion (Check-in/Check-out/Storno) — sperrt die Knöpfe, damit
  // ein zweiter Druck nicht denselben Vorgang doppelt auslöst (Wurzel 2).
  aktionLaeuft: boolean;
  aktionFehler: string | null;
  checkOutErgebnis: CheckOutResult | null;

  einchecken: () => Promise<void>;
  auschecken: (payment: CheckOutPayment) => Promise<void>;
  /** true = storniert. Der Aufrufer schließt daraufhin das Panel. */
  stornieren: (reason: string, code?: CancelReasonCode) => Promise<boolean>;

  // Anfrage-Modell (Airbnb „Request to Book"): eine `pending`-Buchung wartet auf
  // eine Entscheidung. Annehmen sperrt die Nächte an den Portalen, Ablehnen gibt
  // sie frei — beides Gegenzustände, die der Server pflegt (Wurzel 1).
  annehmen: () => Promise<void>;
  /** true = abgelehnt. Der Aufrufer schließt daraufhin das Panel. */
  ablehnen: (reason?: string) => Promise<boolean>;
};

export function useBuchungsDetail(
  reservationId: string,
  // Rückmeldungen an die Umgebung: `onGeaendert` nach JEDER erfolgreichen
  // Aktion (Kalender/Liste neu laden), `onStorniert` ZUSÄTZLICH nur nach einem
  // Storno. Getrennt zu halten ist wichtig: liefe `onStorniert` auch bei
  // Check-in/out, schlösse sich das Panel fälschlich — dabei soll man das
  // Check-out-Ergebnis mit der Rechnungsnummer noch sehen.
  callbacks?: { onGeaendert?: () => void; onStorniert?: () => void },
): BuchungsDetail {
  const onGeaendert = callbacks?.onGeaendert;
  const onStorniert = callbacks?.onStorniert;

  const [data, setData] = useState<ReservationDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [aktionLaeuft, setAktionLaeuft] = useState(false);
  const [aktionFehler, setAktionFehler] = useState<string | null>(null);
  const [checkOutErgebnis, setCheckOutErgebnis] = useState<CheckOutResult | null>(
    null,
  );

  // Callbacks über ein Ref: sie kommen aus dem Screen und sind bei jedem Render
  // neue Funktionen. Direkt in den Abhängigkeiten würden sie jede Aktion neu
  // erzeugen und den Realtime-Kanal bei jedem Render ab- und wieder anmelden.
  const cb = useRef({ onGeaendert, onStorniert });
  cb.current = { onGeaendert, onStorniert };

  const neuLaden = useCallback(() => {
    getReservationDetail(reservationId).then((res) => {
      if (res.ok) {
        // Diagnose der Felder, die die Darstellung UMSCHALTEN. Ohne diese Zeile
        // ist ein „warum steht da Direkt statt Eigennutzung?" nur zu erraten.
        console.debug("[BuchungsDetail] geladen", {
          id: res.data.id,
          is_owner_stay: res.data.is_owner_stay,
          status: res.data.status,
          total_amount: res.data.total_amount,
          invoice: res.data.invoice?.invoice_number ?? null,
          message_thread_id: res.data.message_thread_id,
        });
        setData(res.data);
        setError(null);
      } else {
        console.debug("[BuchungsDetail] Laden fehlgeschlagen:", res.error);
        setError(res.error);
      }
    });
  }, [reservationId]);

  useEffect(() => {
    setData(null);
    setError(null);
    setAktionFehler(null);
    setCheckOutErgebnis(null);
    neuLaden();
  }, [neuLaden]);

  // Realtime (WebSocket, kein Polling): das Detail folgt Änderungen sofort —
  // auch wenn parallel jemand am Rechner ein- oder auscheckt. Gefiltert auf
  // DIESE Buchung, nicht auf die Tabelle: sonst löst jede fremde Buchung im
  // Betrieb einen Abruf aus.
  // `invoices` ist für authenticated bewusst gesperrt (Wurzel 6); die Rechnung
  // entsteht beim Check-out, der die Reservierung mitschreibt — dieses eine Abo
  // genügt also.
  useRealtime({
    table: "reservations",
    filter: `id=eq.${reservationId}`,
    onChange: neuLaden,
  });

  const einchecken = useCallback(async () => {
    setAktionLaeuft(true);
    setAktionFehler(null);
    const res = await checkInReservation(reservationId);
    setAktionLaeuft(false);
    if (res.ok) {
      neuLaden();
      cb.current.onGeaendert?.();
    } else {
      setAktionFehler(res.error);
    }
  }, [reservationId, neuLaden]);

  const auschecken = useCallback(
    async (payment: CheckOutPayment) => {
      setAktionLaeuft(true);
      setAktionFehler(null);
      const res = await checkOutReservation(reservationId, payment);
      setAktionLaeuft(false);
      if (res.ok) {
        // Das Ergebnis bleibt stehen, bis das Panel geschlossen wird: die
        // Rechnungsnummer ist der Beleg der Aktion und darf nicht wegblitzen.
        setCheckOutErgebnis(res.data);
        neuLaden();
        cb.current.onGeaendert?.();
      } else {
        // Scheitert die Rechnung, bleibt der Gast eingecheckt — der Fehler
        // gehört im Klartext angezeigt, nicht verschluckt (Wurzel 5).
        setAktionFehler(res.error);
      }
    },
    [reservationId, neuLaden],
  );

  const stornieren = useCallback(
    async (reason: string, code?: CancelReasonCode) => {
      setAktionLaeuft(true);
      setAktionFehler(null);
      const res = await cancelReservation(reservationId, reason, code);
      setAktionLaeuft(false);
      if (!res.ok) {
        setAktionFehler(res.error);
        return false;
      }
      neuLaden();
      cb.current.onGeaendert?.();
      cb.current.onStorniert?.();
      return true;
    },
    [reservationId, neuLaden],
  );

  const annehmen = useCallback(async () => {
    setAktionLaeuft(true);
    setAktionFehler(null);
    const res = await acceptReservationRequest(reservationId);
    setAktionLaeuft(false);
    if (res.ok) {
      neuLaden();
      cb.current.onGeaendert?.();
    } else {
      setAktionFehler(res.error);
    }
  }, [reservationId, neuLaden]);

  const ablehnen = useCallback(
    async (reason?: string) => {
      setAktionLaeuft(true);
      setAktionFehler(null);
      const res = await declineReservationRequest(reservationId, reason);
      setAktionLaeuft(false);
      if (!res.ok) {
        setAktionFehler(res.error);
        return false;
      }
      neuLaden();
      cb.current.onGeaendert?.();
      // Wie beim Storno: die Buchung, die das Panel zeigt, ist entschieden.
      cb.current.onStorniert?.();
      return true;
    },
    [reservationId, neuLaden],
  );

  return {
    data,
    error,
    neuLaden,
    aktionLaeuft,
    aktionFehler,
    checkOutErgebnis,
    einchecken,
    auschecken,
    stornieren,
    annehmen,
    ablehnen,
  };
}
