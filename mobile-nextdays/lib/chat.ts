// Eigentümer-Chat, Agenturseite — gegen /api/v1/inbox/{thread_id}/chat und
// /api/v1/owner-chat (Migration 0611, ADR-0029).
//
// ENDE-ZU-ENDE VERSCHLÜSSELT: Was über die Leitung geht, ist Chiffretext. Der
// Posteingang zeigt diese Threads in seiner normalen Liste (Präfix `eig:`,
// `lib/inbox.ts`), aber der Verlauf und das Senden laufen NICHT über die
// üblichen Endpunkte — `POST /inbox/{id}/messages` weist einen `eig:`-Thread
// mit 422 ab, weil er nur einen Text kennt und serverseitiges Verschlüsseln
// genau die Hintertür wäre, die ADR-0029 ausschließt.
//
// Der Ablauf beim Senden ist deshalb IMMER dreiteilig:
//   1. Empfängerliste vom Server holen (er bestimmt sie, Wurzel 3)
//   2. lokal verschlüsseln, je Gerät einen Schlüssel verpacken
//   3. Chiffretext + Schlüssel senden
import { call, type Result } from "@/lib/api";
import { gegenueberVon, istLesbar } from "@/lib/chat-anzeige";
import {
  aufgabeSignieren,
  geraeteIdLesen,
  schluesselUmpacken,
  type Empfaenger,
  entschluesseln,
  geraeteIdMerken,
  identitaetAnlegen,
  identitaetLesen,
} from "@/lib/chat-krypto";

export type ChatNachricht = {
  id: string;
  /** 'owner' (der Eigentümer) | 'agency' (wir). */
  sender: string;
  sender_name: string;
  /** Klartext, vom Server entschlüsselt (09.09.2026). */
  text: string | null;
  chiffre: string;
  /** Öffentlicher Schlüssel des sendenden Geräts. */
  sender_key: string | null;
  /**
   * Der für DIESES Gerät verpackte Schlüssel. `null` heißt: die Nachricht ist
   * älter als das Gerät — lesbar erst nach einer Freigabe durch die
   * Betriebsleitung (nur admin/co_admin, Festlegung vom 09.09.2026).
   */
  wrapped_key: string | null;
  /**
   * Gegen WELCHEN öffentlichen Schlüssel `wrapped_key` zu öffnen ist (0614).
   *
   * `null` = gegen `sender_key`, der Normalfall. Gesetzt nach einer Freigabe,
   * bei der ein DRITTES Gerät neu verpackt hat — dann ist der Absender nicht
   * mehr das Gegenüber, und blind gegen `sender_key` zu entpacken ergäbe ein
   * anderes Geheimnis und eine Nachricht, die nie aufgeht.
   */
  wrapper_key: string | null;
  bilder: string[];
  sent_at: string | null;
};

export type ChatVerlauf = {
  thread_id: string;
  property_id: string;
  property_title: string | null;
  items: ChatNachricht[];
  /** Wie viele Nachrichten dieses Gerät nicht öffnen kann. */
  nicht_lesbar: number;
};

// --- Lesen ------------------------------------------------------------------

export async function getEigentuemerVerlauf(
  threadId: string,
  deviceId: string,
): Promise<Result<ChatVerlauf>> {
  const q = `?device_id=${encodeURIComponent(deviceId)}`;
  return call(`/inbox/${encodeURIComponent(threadId)}/chat${q}`);
}

/** Die Geräte, die dieses Gespräch lesen können — der Server bestimmt sie. */
export async function empfaengerHolen(threadId: string): Promise<Empfaenger[]> {
  const res = await call<{ items: Empfaenger[] }>(
    `/inbox/${encodeURIComponent(threadId)}/chat/empfaenger`,
  );
  if (!res.ok) throw new Error(res.error);
  return res.data.items;
}

// --- Senden -----------------------------------------------------------------

/** Verschlüsselt und sendet. Holt den Empfängerkreis IMMER frisch. */
export async function eigentuemerAntworten(
  threadId: string,
  text: string,
  bilder: string[] = [],
): Promise<Result<ChatNachricht>> {
  // KLARTEXT an den Server (09.09.2026): Er verschlüsselt selbst, damit
  // dieselbe Nachricht auch im Dashboard lesbar ist. Vorher verschlüsselte
  // dieses Gerät für die registrierten Geräte — und war kein Agenturgerät
  // dabei, ging die Nachricht ins Leere.
  return call(`/inbox/${encodeURIComponent(threadId)}/chat`, {
    method: "POST",
    body: { text, bilder },
  });
}

/**
 * Entschlüsselt eine Nachricht für die Anzeige.
 *
 * `null` heißt „auf diesem Gerät nicht lesbar" — die Oberfläche zeigt dann
 * einen Hinweis samt Weg (Freigabe), nicht eine leere Blase.
 */
export async function nachrichtOeffnen(
  n: ChatNachricht,
): Promise<string | null> {
  // Der Server hat entschlüsselt — nichts mehr zu tun.
  if (n.text !== null && n.text !== undefined) return n.text;
  // Sonst E2E-Bestand: nur dieses Gerät kann ihn öffnen.
  if (!istLesbar(n)) return null;
  if (!n.chiffre) return "";
  return entschluesseln(n.chiffre, n.wrapped_key!, gegenueberVon(n)!);
}

// --- Geräte -----------------------------------------------------------------

export type GeraetInfo = {
  id: string;
  geraet_name: string;
  seite: string;
  gesperrt_am: string | null;
  zuletzt_aktiv: string | null;
  created_at: string | null;
};

export async function getGeraete(): Promise<Result<{ items: GeraetInfo[] }>> {
  return call("/owner-chat/geraete");
}

export async function geraetAufgabeHolen(): Promise<
  Result<{ aufgabe: string }>
> {
  return call("/owner-chat/geraete/aufgabe", { method: "POST" });
}

export async function geraetRegistrieren(payload: {
  public_key: string;
  signing_key: string;
  signatur: string;
  geraet_name: string;
}): Promise<Result<GeraetInfo>> {
  return call("/owner-chat/geraete", {
    method: "POST",
    body: payload,
  });
}

export async function geraetSperren(deviceId: string): Promise<Result<null>> {
  return call(`/owner-chat/geraete/${encodeURIComponent(deviceId)}`, {
    method: "DELETE",
  });
}

/**
 * Den verschlüsselten Chat auf DIESEM Gerät einrichten.
 *
 * Erzeugt das Schlüsselpaar (bleibt in der Keychain), weist den Besitz per
 * Ed25519-Signatur nach und merkt sich die vergebene Geräte-ID.
 *
 * WARUM DAS HIER STEHT und nicht nur in der Eigentümer-App: Ohne einen
 * Einrichtungsweg auf der AGENTURSEITE kann niemand im Betrieb die Nachrichten
 * lesen — der Eigentümer schriebe in ein Postfach, das nie jemand öffnet.
 * Schlimmer noch: solange kein Agentur-Gerät registriert ist, ist der
 * Empfängerkreis des Eigentümers leer, und schon seine erste Nachricht
 * scheitert.
 *
 * KEIN Sicherungscode auf dieser Seite: Verliert ein Mitarbeiter sein Gerät,
 * holt die Betriebsleitung den Verlauf über die Freigabe zurück
 * (`freigabeSenden`) — dieser Weg ist an eine Rolle gebunden und damit
 * überprüfbar. Ein Zettel mit Code je Mitarbeiter wäre das Gegenteil.
 */
export async function chatEinrichten(
  geraetName: string,
): Promise<Result<GeraetInfo>> {
  try {
    const aufgabe = await geraetAufgabeHolen();
    if (!aufgabe.ok) return aufgabe;
    const paar = await identitaetAnlegen();
    const signatur = await aufgabeSignieren(aufgabe.data.aufgabe);
    const res = await geraetRegistrieren({
      public_key: paar.publicKey,
      signing_key: paar.signingKey,
      signatur,
      geraet_name: geraetName,
    });
    if (!res.ok) return res;
    // Die vergebene ID festhalten: ohne sie liefert der Verlauf keine
    // Schlüssel, und jede Nachricht wäre sichtbar, aber unlesbar.
    await geraeteIdMerken(res.data.id);
    return res;
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

// --- Freigabe alter Verläufe (nur admin/co_admin) ----------------------------

export type FreigabeOffen = { message_id: string; chiffre: string };

export async function freigabeOffen(
  threadId: string,
  deviceId: string,
): Promise<Result<{ items: FreigabeOffen[] }>> {
  return call(
    `/owner-chat/freigabe/${encodeURIComponent(threadId)}/${encodeURIComponent(deviceId)}`,
  );
}

export async function freigabeSenden(
  threadId: string,
  deviceId: string,
  schluessel: Record<string, string>,
  wrapperKey: string,
): Promise<Result<{ nachgetragen: number }>> {
  return call(`/owner-chat/freigabe/${encodeURIComponent(threadId)}`, {
    method: "POST",
    body: {
      device_id: deviceId,
      schluessel,
      // Gegen WEN das Zielgerät entpacken muss (0614): hier verpackt nicht
      // der Absender, sondern DIESES Gerät.
      wrapper_key: wrapperKey,
    },
  });
}

/**
 * Einen Verlauf für ein anderes Gerät freigeben — der ganze Vorgang.
 *
 * DIESES Gerät kann den Verlauf lesen, das Zielgerät nicht. Also: die offenen
 * Nachrichten holen, jede mit dem EIGENEN Schlüssel öffnen und den
 * Inhaltsschlüssel für das Zielgerät neu verpacken. Der Server vermittelt nur
 * — er sieht wieder ausschließlich Chiffretext.
 *
 * Der Server lässt das nur für `admin`/`co_admin` zu und nur für Geräte, die
 * zum Empfängerkreis DIESES Gesprächs gehören (`owner_chat/freigabe.py`).
 * Beides wird hier NICHT noch einmal geprüft: eine Client-Prüfung wäre eine
 * Anzeige, keine Sperre.
 */
export async function verlaufFreigeben(
  threadId: string,
  zielGeraet: { device_id: string; public_key: string },
): Promise<Result<{ nachgetragen: number }>> {
  const offen = await freigabeOffen(threadId, zielGeraet.device_id);
  if (!offen.ok) return offen;
  if (offen.data.items.length === 0) {
    return { ok: true, data: { nachgetragen: 0 } };
  }

  // Den eigenen Verlauf brauchen wir, um an die verpackten Schlüssel UND die
  // Absenderschlüssel zu kommen — ohne beide lässt sich nichts öffnen.
  const eigenesGeraet = await geraeteIdLesen();
  if (!eigenesGeraet) {
    return { ok: false, error: "Kein Schlüssel auf diesem Gerät." };
  }
  const verlauf = await getEigentuemerVerlauf(threadId, eigenesGeraet);
  if (!verlauf.ok) return verlauf;
  const jeId = new Map(verlauf.data.items.map((n) => [n.id, n]));

  const neu: Record<string, string> = {};
  for (const eintrag of offen.data.items) {
    const n = jeId.get(eintrag.message_id);
    // Was DIESES Gerät selbst nicht lesen kann, kann es auch nicht weitergeben
    // — es wird ausgelassen, nicht geraten (Wurzel 4).
    const gegenueber = n?.wrapper_key || n?.sender_key;
    if (!n?.wrapped_key || !gegenueber) continue;
    try {
      neu[eintrag.message_id] = await schluesselUmpacken(
        n.wrapped_key,
        gegenueber,
        zielGeraet.public_key,
      );
    } catch {
      continue;
    }
  }
  if (Object.keys(neu).length === 0) {
    return { ok: false, error: "Auf diesem Gerät ist der Verlauf nicht lesbar." };
  }
  const eigeneIdentitaet = await identitaetLesen();
  if (!eigeneIdentitaet) {
    return { ok: false, error: "Kein Schlüssel auf diesem Gerät." };
  }
  return freigabeSenden(
    threadId,
    zielGeraet.device_id,
    neu,
    eigeneIdentitaet.publicKey,
  );
}
