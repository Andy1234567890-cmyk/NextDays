"use server";

// Schreib-Actions Plattform-Posteingang (Betrieb-Seite). Echte host_messages-
// Endpunkte. Jede Aktion gibt bei Fehler die Backend-Meldung zurück (Wurzel 5).
import { ApiError } from "@nextdays/auth/errors";

import { api } from "./api-server";
import type { HostMessage, QuickReply } from "./posteingang";

type Ok<T> = { ok: true } & T;
type Err = { ok: false; error: string };

function fehler(exc: unknown, fallback: string): Err {
  return { ok: false, error: exc instanceof ApiError ? exc.message : fallback };
}

/** Betrieb antwortet in einem Thread (sender='host' serverseitig). */
export async function sendeNachricht(
  threadId: string,
  body: string,
): Promise<Ok<{ message: HostMessage }> | Err> {
  try {
    const message = await api<HostMessage>(
      `/host-messages/${threadId}/messages`,
      { method: "POST", body: { body } },
    );
    return { ok: true, message };
  } catch (exc) {
    return fehler(exc, "Nachricht konnte nicht gesendet werden.");
  }
}

/** Thread archivieren / reaktivieren. */
export async function setzeArchiviert(
  threadId: string,
  archiviert: boolean,
): Promise<{ ok: true } | Err> {
  try {
    await api<void>(`/host-messages/${threadId}/flags`, {
      method: "PUT",
      body: { is_archived: archiviert },
    });
    return { ok: true };
  } catch (exc) {
    return fehler(exc, "Aktion fehlgeschlagen.");
  }
}

/** Quick Reply für DIESEN Thread füllen (Platzhalter) — nur Text, kein Senden. */
export async function fuelleVorlage(
  threadId: string,
  quickReplyId: string,
): Promise<Ok<{ body: string }> | Err> {
  try {
    const res = await api<HostMessage>(
      `/host-messages/${threadId}/quick-replies/${quickReplyId}/render`,
      { method: "POST" },
    );
    return { ok: true, body: res.body };
  } catch (exc) {
    return fehler(exc, "Vorlage konnte nicht geladen werden.");
  }
}

/** Quick Reply anlegen (nur admin/co_admin — Backend erzwingt). */
export async function erstelleVorlage(
  title: string,
  body: string,
  propertyIds: string[] = [],
): Promise<Ok<{ quickReply: QuickReply }> | Err> {
  try {
    const quickReply = await api<QuickReply>("/host-messages/quick-replies", {
      method: "POST",
      body: { title, body, property_ids: propertyIds },
    });
    return { ok: true, quickReply };
  } catch (exc) {
    return fehler(exc, "Vorlage konnte nicht angelegt werden.");
  }
}

/** Quick Reply löschen. */
export async function loescheVorlage(
  quickReplyId: string,
): Promise<{ ok: true } | Err> {
  try {
    await api<void>(`/host-messages/quick-replies/${quickReplyId}`, {
      method: "DELETE",
    });
    return { ok: true };
  } catch (exc) {
    return fehler(exc, "Vorlage konnte nicht gelöscht werden.");
  }
}

/** Gast direkt aus dem Thread blockieren (Airbnb: „aus dem Chat blockieren").
 *  POST /guest-blocks — sperrt Nachrichten (2-Wochen-Trip-Ausnahme) + Buchen. */
export async function blockiereGast(
  portalGuestId: string,
): Promise<{ ok: true } | Err> {
  try {
    await api<unknown>("/guest-blocks", {
      method: "POST",
      body: { portal_guest_id: portalGuestId },
    });
    return { ok: true };
  } catch (exc) {
    return fehler(exc, "Gast konnte nicht blockiert werden.");
  }
}
