// Chat mit der Verwaltung — gegen /api/v1/public-portal/chat und
// /api/v1/owner-chat (Migration 0611, ADR-0029).
//
// ENDE-ZU-ENDE VERSCHLÜSSELT: Was hier über die Leitung geht, ist Chiffretext.
// Klartext existiert nur in dieser App, hinter `lib/chat-krypto.ts`. Kein Feld
// in diesen Typen enthält lesbaren Inhalt — auch `chiffre` nicht, so ähnlich
// der Name klingt.
//
// Der Ablauf beim Senden ist deshalb IMMER dreiteilig und darf nicht verkürzt
// werden:
//   1. Empfängerliste vom Server holen (er bestimmt sie, Wurzel 3)
//   2. lokal verschlüsseln, je Gerät einen Schlüssel verpacken
//   3. Chiffretext + Schlüssel senden
// Fehlt Schritt 1, sendet man an einen veralteten Kreis, und ein neu
// hinzugekommenes Gerät kann die Nachricht nie öffnen (Server antwortet 409).
import { Buffer } from "@craftzdog/react-native-buffer";

import { call, type Result } from "@/lib/api";
import { gegenueberVon, hatText, istLesbar } from "@/lib/chat-anzeige";
import {
  bildEntschluesseln,
  type Empfaenger,
  entschluesseln,
} from "@/lib/chat-krypto";

// --- Contract ---------------------------------------------------------------

export type ChatFaden = {
  /** Leer, solange über dieses Objekt noch nie gesprochen wurde. */
  thread_id: string;
  property_id: string;
  property_title: string | null;
  last_message_at: string | null;
  ungelesen: boolean;
  /** Ich habe dieses Gespräch beendet (0615). */
  gestoppt: boolean;
};

export type ChatNachricht = {
  id: string;
  /** 'owner' (wir) | 'agency' (die Verwaltung). */
  sender: string;
  sender_name: string;
  /** Chiffretext. Zum Anzeigen durch `nachrichtOeffnen` schicken. */
  /**
   * Klartext, vom Server entschlüsselt (09.09.2026). `null` bei Nachrichten
   * aus der E2E-Zeit — die öffnet nur dieses Gerät über `chiffre`.
   */
  text: string | null;
  chiffre: string;
  /**
   * Öffentlicher Schlüssel des sendenden GERÄTS. Ohne ihn lässt sich der
   * verpackte Schlüssel nicht öffnen. `null` nur bei Altbeständen aus der
   * Zeit vor dem Feld — dann bleibt die Nachricht unlesbar, und das wird
   * angezeigt statt verschwiegen.
   */
  sender_key: string | null;
  /**
   * Der für DIESES Gerät verpackte Schlüssel. `null` heißt: die Nachricht ist
   * älter als das Gerät — sie bleibt unlesbar, bis die Verwaltung den Verlauf
   * freigibt. Kein Fehler, sondern eine Tatsache, die die Oberfläche benennt.
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
  /**
   * Der Faden, in dem die Nachricht liegt.
   *
   * Wichtig beim ERSTEN Senden zu einem Objekt: Dort gibt es noch keinen
   * Faden, die Fadenliste liefert `thread_id: ""`, und der Server legt ihn
   * erst beim Senden an. Ohne diesen Rueckgabewert kennt der Screen die ID
   * nie und laedt weiter gegen den leeren String — der Verlauf bliebe leer,
   * obwohl die Nachricht angekommen ist.
   */
  thread_id: string | null;
};

export type ChatVerlauf = {
  thread_id: string;
  property_id: string;
  property_title: string | null;
  items: ChatNachricht[];
  /** Wie viele Nachrichten dieses Gerät nicht öffnen kann. */
  nicht_lesbar: number;
  /** Ich habe dieses Gespräch beendet — dann nimmt der Server nichts mehr an. */
  gestoppt: boolean;
};

export type EmpfaengerListe = { items: Empfaenger[] };

// --- Lesen ------------------------------------------------------------------

export async function getChatFaeden(): Promise<Result<{ items: ChatFaden[] }>> {
  return call("/public-portal/chat");
}

export async function getChatVerlauf(
  threadId: string,
  deviceId: string,
): Promise<Result<ChatVerlauf>> {
  const q = `?device_id=${encodeURIComponent(deviceId)}`;
  return call(`/public-portal/chat/faden/${encodeURIComponent(threadId)}${q}`);
}

// --- Senden -----------------------------------------------------------------

// VERWAIST seit der Umstellung auf serverseitige Verschlüsselung
// (09.09.2026): Der Client muss den Empfängerkreis nicht mehr kennen, weil er
// nicht mehr selbst für jedes Gerät verpackt. Bewusst STEHEN GELASSEN statt
// gelöscht — die Freigabe alter E2E-Verläufe braucht diesen Weg noch.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function empfaengerHolen(propertyId: string): Promise<Empfaenger[]> {
  const res = await call<EmpfaengerListe>(
    `/public-portal/chat/empfaenger/${encodeURIComponent(propertyId)}`,
  );
  if (!res.ok) throw new Error(res.error);
  return res.data.items;
}

/**
 * Verschlüsselt Text UND Bilder unter EINEM Schlüssel, lädt die Bilder hoch
 * und sendet.
 *
 * ALLES IN EINEM VORGANG (Korrektur vom 09.09.2026): Vorher lief der Upload
 * getrennt und erzeugte einen eigenen Bildschlüssel, der nie mitgesendet
 * wurde — die Bilder waren dauerhaft für niemanden lesbar. Wer das trennt,
 * baut den Fehler wieder ein.
 *
 * Der Empfängerkreis wird IMMER frisch geholt (Wurzel 3): kam zwischen
 * Abholen und Senden ein Gerät dazu, antwortet der Server mit 409, statt eine
 * für dieses Gerät unlesbare Nachricht abzulegen.
 */
export async function chatSenden(
  propertyId: string,
  text: string,
  bilder: Uint8Array[] = [],
): Promise<Result<ChatNachricht>> {
  // Bilder VOR der Nachricht hochladen: schlägt einer fehl, entsteht gar keine
  // Nachricht — besser als eine mit einem Anhang, der nicht existiert.
  const pfade: string[] = [];
  for (const bild of bilder) {
    const hoch = await bildHochladen(bild);
    if (!hoch.ok) return hoch;
    pfade.push(hoch.data.pfad);
  }

  // KLARTEXT an den Server (09.09.2026). Er verschlüsselt selbst, damit die
  // Verwaltung im Dashboard mitlesen kann — im Browser gibt es keinen Ort für
  // einen privaten Geräteschlüssel, und ohne Mitlesen war der Chat für die
  // Agentur unbenutzbar (zwei zugestellte, dauerhaft unlesbare Nachrichten am
  // 09.09.2026).
  //
  // `body` bekommt das OBJEKT, nicht dessen JSON-Text: `lib/api.ts`
  // serialisiert selbst. Ein `JSON.stringify(...)` hier schickte eine
  // ZEICHENKETTE als Rumpf, und FastAPI antwortete 422.
  return call(`/public-portal/chat/objekt/${encodeURIComponent(propertyId)}`, {
    method: "POST",
    body: { text, bilder: pfade },
  });
}

// --- Anzeigen ---------------------------------------------------------------

/**
 * Den Text einer Nachricht für die Anzeige holen.
 *
 * ZWEI QUELLEN, in dieser Reihenfolge:
 *
 * 1. `text` — vom Server entschlüsselt (der Weg seit dem 09.09.2026). Damit
 *    sieht die Verwaltung dieselbe Nachricht im Dashboard.
 * 2. `chiffre` — E2E-Bestand aus der Zeit davor. Den öffnet nur dieses Gerät,
 *    mit seinem privaten Schlüssel.
 *
 * `null` heißt „auf diesem Gerät nicht zu öffnen" — die Oberfläche sagt das,
 * statt eine leere Blase zu zeigen.
 */
export async function nachrichtOeffnen(
  n: ChatNachricht,
): Promise<string | null> {
  // Der Server hat entschlüsselt: nichts mehr zu tun.
  if (n.text !== null && n.text !== undefined) return n.text;
  // Sonst der alte Weg. Beides muss da sein: der verpackte Schlüssel FÜR uns
  // und der öffentliche Schlüssel des Absenders.
  if (!istLesbar(n)) return null;
  // Kein Text = kein Fehler: eine reine Bildnachricht hat bewusst leeren
  // `chiffre`. Ihn zu entschlüsseln wirft (0 Byte Nonce) und sähe aus wie
  // Manipulation. Leerer String heißt hier „nichts zu zeigen", nicht „kaputt".
  if (!hatText(n)) return "";
  // Nach `istLesbar` stehen beide Werte fest — das `!` ist hier belegt, nicht
  // geraten.
  return entschluesseln(n.chiffre, n.wrapped_key!, gegenueberVon(n)!);
}

/**
 * Die Bilder einer Nachricht holen, entschlüsseln und als `data:`-URI
 * zurückgeben — bereit für `<Image source={{uri}}>`.
 *
 * ZWEI SCHRITTE, weil der Bucket privat ist: erst die signierte Adresse vom
 * Server (er kennt die Bytes, kann sie aber nicht lesen), dann die
 * Entschlüsselung auf dem Gerät.
 *
 * `data:`-URI statt Datei: das Bild darf NICHT unverschlüsselt auf der Platte
 * landen. Ein Cache-Verzeichnis überlebt die App, und ein entschlüsseltes
 * Schadensfoto im Dateisystem wäre die Hintertür, die ADR-0029 ausschließt.
 *
 * Eine einzelne unlesbare Datei kippt den Verlauf nicht — sie fehlt, und die
 * übrigen erscheinen (Wurzel 5).
 */
export async function bilderOeffnen(n: ChatNachricht): Promise<string[]> {
  if (n.bilder.length === 0) return [];
  const gegenueber = n.wrapper_key || n.sender_key;
  // Bestand aus der E2E-Zeit: nur MIT Geräteschlüssel zu öffnen. Fehlt er,
  // bleibt das Bild verborgen — es gibt keinen zweiten Weg dorthin.
  const e2e = Boolean(n.wrapped_key && gegenueber);
  const out: string[] = [];
  for (const pfad of n.bilder) {
    try {
      const adresse = await call<{ url: string }>(
        `/owner-chat/bilder/adresse?pfad=${encodeURIComponent(pfad)}`,
      );
      if (!adresse.ok) continue;
      if (!e2e) {
        // Seit dem 09.09.2026 liegt das Bild als Bild im privaten Bucket.
        // Die signierte Adresse zeigt direkt darauf — nichts zu entschlüsseln.
        out.push(adresse.data.url);
        continue;
      }
      const roh = await fetch(adresse.data.url);
      const chiffre = Buffer.from(await roh.arrayBuffer()).toString("base64");
      const bytes = await bildEntschluesseln(chiffre, n.wrapped_key!, gegenueber!);
      out.push(
        `data:image/jpeg;base64,${Buffer.from(bytes).toString("base64")}`,
      );
    } catch {
      // Ein Bild, das sich nicht öffnen lässt, wird ausgelassen — der Rest
      // der Nachricht bleibt sichtbar.
      continue;
    }
  }
  return out;
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
  return call("/owner-chat/geraete", { method: "POST", body: payload });
}

export async function geraetSperren(deviceId: string): Promise<Result<null>> {
  return call(`/owner-chat/geraete/${encodeURIComponent(deviceId)}`, {
    method: "DELETE",
  });
}

// --- Sicherungscode ---------------------------------------------------------

export type KdfParamsContract = {
  algorithmus: string;
  memory: number;
  passes: number;
  parallelism: number;
  salt: string;
};

export async function sicherungAblegen(payload: {
  wrapped_identity: string;
  kdf_params: KdfParamsContract;
}): Promise<Result<null>> {
  return call("/owner-chat/wiederherstellung", { method: "PUT", body: payload });
}

export async function sicherungHolen(): Promise<
  Result<{ wrapped_identity: string; kdf_params: KdfParamsContract }>
> {
  return call("/owner-chat/wiederherstellung");
}

// --- Bilder -----------------------------------------------------------------

export type BildHochgeladen = { pfad: string; url: string };

/**
 * Lädt bereits VERSCHLÜSSELTE Bytes hoch — reiner Transport.
 *
 * Der Aufrufer ist `chatSenden`, nicht der Screen: ein Bild, das
 * unverschlüsselt hier landet, wäre der Bruch der ganzen Zusage.
 */
export async function bildHochladen(
  daten: Uint8Array,
): Promise<Result<BildHochgeladen>> {
  const form = new FormData();
  // Seit dem 09.09.2026 geht das BILD hinauf, nicht Chiffretext: der Server
  // hält den Schlüssel, und die Verwaltung liest im Browser mit. Name und Typ
  // benennen darum wieder den echten Inhalt (Wurzel 4).
  form.append("datei", {
    uri: `data:image/jpeg;base64,${Buffer.from(daten).toString("base64")}`,
    type: "image/jpeg",
    name: "anhang.jpg",
  } as unknown as Blob);
  return call("/owner-chat/bilder", { method: "POST", body: form });
}

// --- Melden und Ausstieg (Google UGC-Policy, 0615) ---------------------------
//
// Google verlangt für Direktnachrichten in einem geschlossenen Nutzerkreis
// BEIDES: einen Meldeweg für Inhalte und Menschen und einen Weg, aus dem
// Gespräch herauszukommen. Der Wortlaut steht in
// `apps/api/src/features/owner_chat/moderation.py`.
//
// Was hier NICHT mitgeht: der Text der Nachricht. Der Server könnte ihn nicht
// lesen (Ende-zu-Ende, ADR-0029), und ihn zu entschlüsseln, um ihn zu melden,
// hübe die Zusage auf. Gemeldet wird die ID plus die Beschreibung des Melders.

export type Meldegrund =
  | "beleidigung"
  | "betrug"
  | "unerwuenscht"
  | "anderes";

/**
 * Eine Nachricht melden — oder, ohne `messageId`, das Gespräch bzw. die
 * Gegenseite. Google verlangt „report content AND users", also beides.
 *
 * Die Meldung geht an UNS, nicht an die Verwaltung: eine Beschwerde, die beim
 * Beschwerdegegner landet, ist keine.
 */
export async function nachrichtMelden(
  threadId: string,
  eingabe: { messageId?: string; grund: Meldegrund; freitext?: string },
): Promise<Result<{ id: string; grund: string; status: string }>> {
  return call(
    `/public-portal/chat/faden/${encodeURIComponent(threadId)}/meldung`,
    {
      method: "POST",
      body: {
        message_id: eingabe.messageId ?? null,
        grund: eingabe.grund,
        freitext: eingabe.freitext ?? null,
      },
    },
  );
}

/** Das Gespräch für mich beenden. Der Server nimmt danach nichts mehr an. */
export async function chatBeenden(
  threadId: string,
  grund?: string,
): Promise<Result<null>> {
  return call(`/public-portal/chat/faden/${encodeURIComponent(threadId)}/stopp`, {
    method: "PUT",
    body: { grund: grund ?? null },
  });
}

/** Der Gegenzustand (Wurzel 1): wieder aufnehmen. */
export async function chatWiederAufnehmen(
  threadId: string,
): Promise<Result<null>> {
  return call(`/public-portal/chat/faden/${encodeURIComponent(threadId)}/stopp`, {
    method: "DELETE",
  });
}
