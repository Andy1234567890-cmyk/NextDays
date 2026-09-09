// Ende-zu-Ende-Verschlüsselung des Eigentümer-Chats (ADR-0029, Migration 0611).
//
// SCHWESTERDATEI: die gleichnamige Datei in mobile-nextdays — identisch halten.
// Divergenz heißt hier: eine App verschlüsselt anders, als die andere
// entschlüsselt, und der Fehler zeigt sich erst als unlesbare Nachricht beim
// Empfänger — nicht als Absturz.
//
// WAS HIER PASSIERT, in einem Satz: Jede Nachricht bekommt einen eigenen
// Zufallsschlüssel; der Inhalt wird EINMAL damit verschlüsselt, und dieser
// Schlüssel wird für JEDES Empfängergerät einzeln verpackt (Muster: WhatsApps
// Sender Keys). Der Server sieht ausschließlich Chiffretext.
//
// WARUM NICHTS DAVON SELBST GEBAUT IST: Kryptografie von Hand ist der Fehler,
// der Systeme knackbar macht. Verwendet wird `react-native-quick-crypto`
// (sicherheitsauditiert, native Implementierung) mit Verfahren, die genau
// dafür gedacht sind:
//   * X25519 (`getSharedSecret`) für den Schlüsselaustausch je Empfänger
//   * AES-256-GCM für Inhalt und Verpackung — authentifiziert, erkennt also
//     Manipulation am Chiffretext
//   * HKDF, um aus dem gemeinsamen Geheimnis einen Schlüssel abzuleiten. Das
//     rohe DH-Ergebnis direkt als AES-Schlüssel zu nehmen ist ein bekannter
//     Fehler: seine Bytes sind nicht gleichmäßig verteilt.
//
// DER PRIVATE SCHLÜSSEL verlässt die Keychain bzw. den Android Keystore nie.
// Es gibt in dieser Datei keine Funktion, die ihn zurückgibt oder sendet.
import { Buffer } from "@craftzdog/react-native-buffer";
import * as Keychain from "react-native-keychain";
import QuickCrypto from "react-native-quick-crypto";

// Eigener Keychain-Dienst je Zweck: ein Zurücksetzen des Chats nimmt so nicht
// die Anmeldedaten mit.
const KEYCHAIN_DIENST = "mynextdays.chat.identitaet";

// AES-GCM braucht einen Nonce, der sich unter demselben Schlüssel NIE
// wiederholt — bei Wiederholung bricht die Vertraulichkeit zusammen. 12 Byte
// ist die Standardlänge; er wird je Vorgang frisch gezogen, nie gezählt.
const NONCE_BYTES = 12;
const TAG_BYTES = 16;
const SCHLUESSEL_BYTES = 32;

// Trennt diese Verwendung von jeder anderen, die dieselben Schlüssel je
// benutzen könnte (Domain Separation). Ändert sich der Wert, sind alte
// Nachrichten unlesbar — er ist Teil des Formats, keine Beschriftung.
const HKDF_INFO = "nextdays-owner-chat-v1";

export type Schluesselpaar = {
  /** X25519, base64 — dafür verpacken andere Geräte ihre Nachrichten. */
  publicKey: string;
  /** Ed25519, base64 — belegt beim Registrieren den Besitz. */
  signingKey: string;
};

export type Empfaenger = {
  device_id: string;
  public_key: string;
  /**
   * 'owner' oder 'agency' — welcher Seite das Gerät gehört.
   *
   * Für die Verschlüsselung selbst belanglos (verpackt wird für ALLE), aber
   * die Oberfläche braucht es: bei einer Freigabe muss erkennbar sein, ob man
   * gerade dem Eigentümer oder einem Kollegen Einblick gibt.
   */
  seite: string;
};

export type VerschluesselteNachricht = {
  chiffre: string;
  /** device_id → verpackter Inhaltsschlüssel. */
  schluessel: Record<string, string>;
};

type PrivateSchluessel = {
  x: Uint8Array;
  ed: Uint8Array;
  pub: string;
  sig: string;
  /**
   * Die `owner_chat_devices.id`, die der Server bei der Registrierung
   * vergeben hat. Sie muss bei JEDER Verlaufsabfrage mit — sonst weiß der
   * Server nicht, WELCHE verpackten Schlüssel er mitschicken soll, und der
   * Verlauf käme ohne Schlüssel zurück: sichtbar, aber unlesbar.
   */
  deviceId?: string;
};

function b64(daten: ArrayBuffer | Uint8Array | Buffer): string {
  const bytes =
    daten instanceof Uint8Array ? daten : new Uint8Array(daten as ArrayBuffer);
  return Buffer.from(bytes).toString("base64");
}

function ausB64(wert: string): Uint8Array {
  return new Uint8Array(Buffer.from(wert, "base64"));
}

// --- Identität ---------------------------------------------------------------

/**
 * Erzeugt Identitäts- und Signaturschlüssel und legt die privaten Teile in der
 * Keychain ab.
 *
 * Vorhandene Schlüssel werden NICHT überschrieben: das machte jede bisher
 * empfangene Nachricht unlesbar, ohne dass irgendetwas fehlschlägt.
 */
export async function identitaetAnlegen(): Promise<Schluesselpaar> {
  const vorhanden = await identitaetLesen();
  if (vorhanden) return vorhanden;

  // Das Paar erzeugt die Bibliothek; wir holen beide Teile ab. Selbst 32
  // Zufallsbytes als Privatschlüssel zu setzen wäre für X25519 zwar gängig,
  // die native Schnittstelle bietet dafür aber keinen Weg (kein
  // `setPrivateKey`) — und an der Kryptografie vorbeizuarbeiten ist genau
  // das, was dieses Modul vermeidet.
  const xPaar = neuesPaar("x25519");
  const edPaar = neuesPaar("ed25519");
  const xPrivat = xPaar.privat;
  const edPrivat = edPaar.privat;

  const paar: Schluesselpaar = {
    publicKey: b64(xPaar.oeffentlich),
    signingKey: b64(edPaar.oeffentlich),
  };

  await Keychain.setGenericPassword(
    "chat",
    JSON.stringify({
      x: b64(xPrivat),
      ed: b64(edPrivat),
      pub: paar.publicKey,
      sig: paar.signingKey,
    }),
    {
      service: KEYCHAIN_DIENST,
      // THIS_DEVICE_ONLY: der Schlüssel wandert nicht per iCloud-Backup auf
      // andere Geräte. Der Weg dorthin ist die Wiederherstellung mit dem
      // Sicherungscode, nicht ein stilles Kopieren.
      accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    },
  );
  return paar;
}

/** Die öffentlichen Teile der abgelegten Identität — oder `null`. */
export async function identitaetLesen(): Promise<Schluesselpaar | null> {
  const privat = await privatLesen();
  return privat ? { publicKey: privat.pub, signingKey: privat.sig } : null;
}

async function privatLesen(): Promise<PrivateSchluessel | null> {
  const eintrag = await Keychain.getGenericPassword({
    service: KEYCHAIN_DIENST,
  });
  if (!eintrag) return null;
  try {
    const roh = JSON.parse(eintrag.password) as Record<string, string>;
    if (!roh.x || !roh.ed || !roh.pub || !roh.sig) return null;
    return {
      x: ausB64(roh.x),
      ed: ausB64(roh.ed),
      pub: roh.pub,
      sig: roh.sig,
      deviceId: roh.deviceId,
    };
  } catch {
    // Ein unlesbarer Eintrag ist KEIN Grund, still neue Schlüssel zu erzeugen:
    // das machte den bisherigen Verlauf unlesbar. `null` heißt „nichts
    // Brauchbares da" — die Oberfläche bietet dann die Wiederherstellung an.
    return null;
  }
}

/**
 * Hält die vom Server vergebene Geräte-ID fest.
 *
 * Erst NACH der Registrierung bekannt, deshalb ein eigener Schritt statt eines
 * Feldes in `identitaetAnlegen`.
 */
export async function geraeteIdMerken(deviceId: string): Promise<void> {
  const privat = await privatLesen();
  if (!privat) throw new Error("Kein Schlüssel auf diesem Gerät.");
  await Keychain.setGenericPassword(
    "chat",
    JSON.stringify({
      x: b64(privat.x),
      ed: b64(privat.ed),
      pub: privat.pub,
      sig: privat.sig,
      deviceId,
    }),
    {
      service: KEYCHAIN_DIENST,
      accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    },
  );
}

/** Die eigene Geräte-ID — `null`, solange nicht registriert. */
export async function geraeteIdLesen(): Promise<string | null> {
  const privat = await privatLesen();
  return privat?.deviceId ?? null;
}

/** Signiert die Registrierungs-Aufgabe des Servers (Besitznachweis). */
export async function aufgabeSignieren(aufgabe: string): Promise<string> {
  const privat = await privatLesen();
  if (!privat) throw new Error("Kein Schlüssel auf diesem Gerät.");
  const ed = new QuickCrypto.Ed("ed25519", DER_CONFIG);
  return b64(ed.signSync(Buffer.from(aufgabe, "utf8"), Buffer.from(privat.ed)));
}

// --- Nachrichten -------------------------------------------------------------

/**
 * Entschlüsselt eine Nachricht mit dem für DIESES Gerät verpackten Schlüssel.
 *
 * `absenderPublicKey` ist der öffentliche Schlüssel des sendenden GERÄTS —
 * derselbe Wert, den der Absender beim Verpacken benutzt hat.
 */
export async function entschluesseln(
  chiffre: string,
  wrappedKey: string,
  absenderPublicKey: string,
): Promise<string> {
  const privat = await privatLesen();
  if (!privat) throw new Error("Kein Schlüssel auf diesem Gerät.");
  const gemeinsam = gemeinsamerSchluessel(privat.x, ausB64(absenderPublicKey));
  const inhalt = new Uint8Array(aesEntschluesseln(wrappedKey, gemeinsam));
  return aesEntschluesseln(chiffre, inhalt).toString("utf8");
}

/**
 * Verschlüsselt Text UND Bilder unter EINEM Inhaltsschlüssel.
 *
 * WARUM ZUSAMMEN (Korrektur vom 09.09.2026): Vorher hatte das Bild einen
 * EIGENEN Inhaltsschlüssel, der nur aus `bildAnhaengen` zurückkam und nie
 * mitgesendet wurde. Die Bytes lagen verschlüsselt im Bucket, der Schlüssel
 * war nach dem Verlassen des Screens weg — das Bild war für JEDES Gerät
 * dauerhaft unlesbar, auch für das sendende. Ein stiller Datenverlust, den
 * nichts anzeigte.
 *
 * Ein gemeinsamer Schlüssel je NACHRICHT löst das an der Wurzel: Was zusammen
 * gesendet wird, wird zusammen verschlüsselt und mit denselben verpackten
 * Schlüsseln geöffnet.
 */
export async function nachrichtVerschluesseln(
  text: string,
  bilder: Uint8Array[],
  empfaenger: Empfaenger[],
): Promise<{
  chiffre: string;
  schluessel: Record<string, string>;
  bilderChiffre: string[];
}> {
  if (empfaenger.length === 0) {
    throw new Error("Kein Empfänger — die Nachricht wäre für niemanden lesbar.");
  }
  const privat = await privatLesen();
  if (!privat) throw new Error("Kein Schlüssel auf diesem Gerät.");

  const inhalt = new Uint8Array(QuickCrypto.randomBytes(SCHLUESSEL_BYTES));
  // Leerer Text bleibt LEER — kein Chiffretext aus dem Nichts. Sonst trüge
  // eine reine Bildnachricht 40 Zeichen Chiffre, die serverseitige Leer-Sperre
  // liefe ins Leere und beim Empfänger stünde eine leere Blase.
  const chiffre = text ? aesVerschluesseln(Buffer.from(text, "utf8"), inhalt) : "";
  const bilderChiffre = bilder.map((b) =>
    aesVerschluesseln(Buffer.from(b), inhalt),
  );

  const schluessel: Record<string, string> = {};
  for (const e of empfaenger) {
    const gemeinsam = gemeinsamerSchluessel(privat.x, ausB64(e.public_key));
    schluessel[e.device_id] = aesVerschluesseln(Buffer.from(inhalt), gemeinsam);
  }
  return { chiffre, schluessel, bilderChiffre };
}

/**
 * Bildbytes einer Nachricht öffnen — mit DEM SELBEN verpackten Schlüssel wie
 * ihr Text (siehe `nachrichtVerschluesseln`).
 */
export async function bildEntschluesseln(
  chiffre: string,
  wrappedKey: string,
  absenderPublicKey: string,
): Promise<Uint8Array> {
  const privat = await privatLesen();
  if (!privat) throw new Error("Kein Schlüssel auf diesem Gerät.");
  const gemeinsam = gemeinsamerSchluessel(privat.x, ausB64(absenderPublicKey));
  const inhalt = new Uint8Array(aesEntschluesseln(wrappedKey, gemeinsam));
  return new Uint8Array(aesEntschluesseln(chiffre, inhalt));
}

/**
 * Einen Inhaltsschlüssel für ein ANDERES Gerät neu verpacken.
 *
 * Der Weg zurück, den Ende-zu-Ende-Verschlüsselung sonst versperrt: Ein neues
 * Gerät kann ältere Nachrichten nicht öffnen, weil für es nie ein Schlüssel
 * verpackt wurde. DIESES Gerät kann sie öffnen — also packt es den
 * Inhaltsschlüssel für das neue Gerät neu ein.
 *
 * Der Klartext der Nachricht wird dabei NIE berührt: geöffnet und neu
 * verschlossen wird nur der Schlüssel. Der Server sieht in beiden Richtungen
 * Chiffretext.
 */
export async function schluesselUmpacken(
  wrappedKey: string,
  absenderPublicKey: string,
  zielPublicKey: string,
): Promise<string> {
  const privat = await privatLesen();
  if (!privat) throw new Error("Kein Schlüssel auf diesem Gerät.");
  const eigenesGeheimnis = gemeinsamerSchluessel(
    privat.x,
    ausB64(absenderPublicKey),
  );
  const inhalt = new Uint8Array(aesEntschluesseln(wrappedKey, eigenesGeheimnis));
  const zielGeheimnis = gemeinsamerSchluessel(privat.x, ausB64(zielPublicKey));
  return aesVerschluesseln(Buffer.from(inhalt), zielGeheimnis);
}

// --- Sicherungscode ----------------------------------------------------------

/** Parameter der Schlüsselableitung — wandern MIT, damit sie erhöhbar bleiben. */
export type KdfParams = {
  algorithmus: "argon2id";
  memory: number;
  passes: number;
  parallelism: number;
  salt: string;
};

// Argon2id-Parameter: bewusst so gewählt, dass sie auf einem Telefon rund eine
// Sekunde brauchen. Das ist der Punkt — wer den Code durchprobieren will,
// zahlt diese Sekunde pro Versuch.
const ARGON_MEMORY = 65536; // 64 MB
const ARGON_PASSES = 3;
const ARGON_PARALLEL = 1;

/**
 * Erzeugt einen Sicherungscode und verschlüsselt die Identität damit.
 *
 * Der Code wird EINMAL zurückgegeben und nirgends gespeichert — weder hier
 * noch auf dem Server, auch nicht als Hash: ein Hash erlaubte das
 * Durchprobieren. Wer ihn verliert, verliert den Verlauf.
 */
export async function sicherungErzeugen(): Promise<{
  code: string;
  wrappedIdentity: string;
  kdfParams: KdfParams;
}> {
  const privat = await privatLesen();
  if (!privat) throw new Error("Kein Schlüssel auf diesem Gerät.");

  const code = codeErzeugen();
  const salt = new Uint8Array(QuickCrypto.randomBytes(16));
  const kdfParams: KdfParams = {
    algorithmus: "argon2id",
    memory: ARGON_MEMORY,
    passes: ARGON_PASSES,
    parallelism: ARGON_PARALLEL,
    salt: b64(salt),
  };
  const schluessel = ausCode(code, kdfParams);
  // Die ÖFFENTLICHEN Teile wandern mit: aus einem privaten X25519-Schlüssel
  // ließe sich der öffentliche zwar rechnen, die native Schnittstelle bietet
  // dafür aber keinen Weg (siehe `neuesPaar`). Ohne sie wäre die Sicherung
  // eingespielt und das Gerät trotzdem nicht registrierbar.
  const inhalt = JSON.stringify({
    x: b64(privat.x),
    ed: b64(privat.ed),
    pub: privat.pub,
    sig: privat.sig,
  });
  return {
    code,
    wrappedIdentity: aesVerschluesseln(Buffer.from(inhalt, "utf8"), schluessel),
    kdfParams,
  };
}

/** Stellt die Identität aus Sicherungscode und Hülle wieder her. */
export async function sicherungEinspielen(
  code: string,
  wrappedIdentity: string,
  kdfParams: KdfParams,
): Promise<Schluesselpaar> {
  const schluessel = ausCode(code, kdfParams);
  // Ein falscher Code lässt die GCM-Prüfung fehlschlagen — hier wird der
  // Fehler in eine verständliche Meldung übersetzt, statt einen Krypto-Text
  // in die Oberfläche durchzureichen.
  let inhalt: { x?: string; ed?: string; pub?: string; sig?: string };
  try {
    inhalt = JSON.parse(
      aesEntschluesseln(wrappedIdentity, schluessel).toString("utf8"),
    );
  } catch {
    throw new Error("Der Sicherungscode passt nicht.");
  }
  if (!inhalt.x || !inhalt.ed) throw new Error("Die Sicherung ist unvollständig.");

  if (!inhalt.pub || !inhalt.sig) {
    throw new Error("Die Sicherung ist unvollständig.");
  }
  const paar: Schluesselpaar = {
    publicKey: inhalt.pub,
    signingKey: inhalt.sig,
  };
  await Keychain.setGenericPassword(
    "chat",
    JSON.stringify({
      x: inhalt.x,
      ed: inhalt.ed,
      pub: paar.publicKey,
      sig: paar.signingKey,
    }),
    {
      service: KEYCHAIN_DIENST,
      accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    },
  );
  return paar;
}

// Ohne mehrdeutige Zeichen (0/O, 1/I/l): der Code wird abgeschrieben, und ein
// Tippfehler kostet hier den ganzen Verlauf.
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

function codeErzeugen(): string {
  const roh = new Uint8Array(QuickCrypto.randomBytes(20));
  const zeichen = Array.from(roh, (b) => ALPHABET[b % ALPHABET.length]);
  // Gruppen zu fünf — abschreibbar.
  return [
    zeichen.slice(0, 5).join(""),
    zeichen.slice(5, 10).join(""),
    zeichen.slice(10, 15).join(""),
    zeichen.slice(15, 20).join(""),
  ].join("-");
}

function ausCode(code: string, p: KdfParams): Uint8Array {
  const bereinigt = code.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
  return new Uint8Array(
    QuickCrypto.argon2Sync("argon2id", {
      message: Buffer.from(bereinigt, "utf8"),
      nonce: Buffer.from(ausB64(p.salt)),
      parallelism: p.parallelism,
      tagLength: SCHLUESSEL_BYTES,
      memory: p.memory,
      passes: p.passes,
    }),
  );
}

// --- Bausteine ---------------------------------------------------------------

function aesVerschluesseln(klar: Buffer, schluessel: Uint8Array): string {
  const nonce = QuickCrypto.randomBytes(NONCE_BYTES);
  const c = QuickCrypto.createCipheriv("aes-256-gcm", schluessel, nonce);
  const teil = c.update(klar);
  const rest = c.final();
  const tag = c.getAuthTag();
  // Nonce und Tag wandern MIT: ohne sie ist der Chiffretext nicht zu öffnen,
  // und geheim ist keiner von beiden (der eine nur einmalig, der andere
  // prüfend).
  return b64(
    Buffer.concat([
      Buffer.from(nonce),
      Buffer.from(tag),
      Buffer.from(teil),
      Buffer.from(rest),
    ]),
  );
}

function aesEntschluesseln(chiffre: string, schluessel: Uint8Array): Buffer {
  const roh = Buffer.from(chiffre, "base64");
  const nonce = roh.subarray(0, NONCE_BYTES);
  const tag = roh.subarray(NONCE_BYTES, NONCE_BYTES + TAG_BYTES);
  const daten = roh.subarray(NONCE_BYTES + TAG_BYTES);
  const d = QuickCrypto.createDecipheriv("aes-256-gcm", schluessel, nonce);
  d.setAuthTag(tag);
  // `final()` wirft, wenn der Tag nicht passt — also wenn am Chiffretext
  // manipuliert wurde. Dieser Fehler wird bewusst NICHT gefangen: eine
  // veränderte Nachricht anzuzeigen wäre schlimmer, als keine anzuzeigen.
  return Buffer.concat([Buffer.from(d.update(daten)), Buffer.from(d.final())]);
}

function gemeinsamerSchluessel(
  eigenerPrivat: Uint8Array,
  fremderPublic: Uint8Array,
): Uint8Array {
  const x = new QuickCrypto.Ed("x25519", DER_CONFIG);
  const roh = new Uint8Array(
    x.getSharedSecret(Buffer.from(eigenerPrivat), Buffer.from(fremderPublic)),
  );
  // HKDF statt des rohen DH-Ergebnisses (siehe Kopf).
  return new Uint8Array(
    QuickCrypto.hkdfSync(
      "sha256",
      Buffer.from(roh),
      Buffer.alloc(32),
      Buffer.from(HKDF_INFO, "utf8"),
      SCHLUESSEL_BYTES,
    ),
  );
}

// Formatvorgabe für die Schlüsselerzeugung — dieselbe, die die Bibliothek
// intern verwendet (`ed_generateKeyPair`). Ein leeres Objekt hier führte zu
// `undefined` in der nativen Signatur; das Paar entstünde nicht.
const DER_CONFIG = {
  publicFormat: QuickCrypto.KFormatType.DER,
  publicType: QuickCrypto.KeyEncoding.SPKI,
  privateFormat: QuickCrypto.KFormatType.DER,
  privateType: QuickCrypto.KeyEncoding.PKCS8,
};

/** Erzeugt ein Schlüsselpaar und gibt beide Teile als rohe 32 Byte zurück. */
function neuesPaar(typ: "x25519" | "ed25519"): {
  privat: Uint8Array;
  oeffentlich: Uint8Array;
} {
  const k = new QuickCrypto.Ed(typ, DER_CONFIG);
  k.generateKeyPairSync();
  return {
    privat: rohBytes(k.getPrivateKey()),
    oeffentlich: rohBytes(k.getPublicKey()),
  };
}

/**
 * Die letzten 32 Byte einer DER-Hülle — das ist der Schlüssel selbst.
 *
 * `getPublicKey`/`getPrivateKey` liefern je nach Konfiguration SPKI/PKCS8;
 * beide Hüllen haben bei diesen Kurven feste Länge, der Schlüssel steht am
 * Ende. Ist der Wert bereits roh (32 Byte), bleibt er unverändert.
 */
function rohBytes(daten: ArrayBuffer): Uint8Array {
  const bytes = new Uint8Array(daten);
  return bytes.length > SCHLUESSEL_BYTES
    ? bytes.subarray(bytes.length - SCHLUESSEL_BYTES)
    : bytes;
}
