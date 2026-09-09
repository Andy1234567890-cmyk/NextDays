#!/usr/bin/env node
// Prüft die Krypto-Kette des Eigentümer-Chats (0611–0614, ADR-0029).
//
//   node scripts/diagnose/chat-krypto-kette-pruefen.mjs
//
// WARUM ES DIESES SKRIPT GIBT — der teuerste Befund des 09.09.2026:
// Die Freigabe alter Verläufe war vollständig gebaut (Tabelle, Rollenprüfung,
// Audit-Log, Endpunkte, Oberfläche, sechs Tests) und konnte kryptografisch
// NIE funktionieren: verpackt wurde gegen ein anderes Gegenüber, als geöffnet
// wurde. Kein Test fand das. Die Server-Tests prüfen die Buchhaltung (Rolle,
// Scope, Zeilenzahl), und `react-native-quick-crypto` ist ein natives Modul,
// das Jest nicht laden kann — die Kette selbst hat schlicht niemand
// durchlaufen.
//
// Drei Runden Prüfung fanden nacheinander drei Fehler in genau dieser Lücke.
// Dieses Skript schließt sie: Es baut dieselben Verfahren mit Node-Primitiven
// nach und prüft, dass Verschlüsseln und Entschlüsseln ZUSAMMENPASSEN.
//
// Was es NICHT prüft: die native Bibliothek selbst. Weicht deren Verhalten ab,
// fällt das erst auf dem Gerät auf. Geprüft wird die LOGIK — wer packt gegen
// wen, welcher Schlüssel öffnet welchen Chiffretext.
//
// Die ECHTE Krypto-Kette des Eigentümer-Chats, mit Node-Primitiven
// nachgebaut — dieselben Verfahren wie `chat-krypto.ts`:
// X25519 → HKDF-SHA256(salt=32 Nullbytes, info) → AES-256-GCM.
//
// WOZU: Jest kann `react-native-quick-crypto` nicht laden (natives Modul),
// deshalb prüfte bisher NIEMAND, ob Verschlüsseln und Entschlüsseln
// zusammenpassen. Genau dort steckten die drei schwersten Fehler:
// die Freigabe verpackte gegen ein anderes Gegenüber, als geöffnet wurde;
// Bilder bekamen einen Schlüssel, der nie mitgesendet wurde; und ein leerer
// Chiffretext sah aus wie Manipulation.
import { createCipheriv, createDecipheriv, createPrivateKey, createPublicKey,
         diffieHellman, generateKeyPairSync, hkdfSync, randomBytes } from "node:crypto";

const INFO = "nextdays-owner-chat-v1";
const N = 12, TAG = 16, KEY = 32;

const paar = () => generateKeyPairSync("x25519");
const roh = (k) => k.export({ type: "spki", format: "der" }).subarray(-32);

function gemeinsam(privat, fremdRoh) {
  const pub = createPublicKey({
    key: Buffer.concat([Buffer.from("302a300506032b656e032100", "hex"), fremdRoh]),
    format: "der", type: "spki",
  });
  const dh = diffieHellman({ privateKey: privat, publicKey: pub });
  return Buffer.from(hkdfSync("sha256", dh, Buffer.alloc(32), Buffer.from(INFO), KEY));
}

function verschluesseln(klar, schluessel) {
  const nonce = randomBytes(N);
  const c = createCipheriv("aes-256-gcm", schluessel, nonce);
  const teil = c.update(klar), rest = c.final();
  return Buffer.concat([nonce, c.getAuthTag(), teil, rest]).toString("base64");
}

function entschluesseln(chiffre, schluessel) {
  const b = Buffer.from(chiffre, "base64");
  const d = createDecipheriv("aes-256-gcm", schluessel, b.subarray(0, N));
  d.setAuthTag(b.subarray(N, N + TAG));
  return Buffer.concat([d.update(b.subarray(N + TAG)), d.final()]);
}

let fehler = 0;
const pruefe = (name, bedingung) => {
  console.log(`${bedingung ? "  ok  " : "FEHLER"}  ${name}`);
  if (!bedingung) fehler++;
};

// --- Die Beteiligten ---
const absender = paar(), empfaenger = paar(), freigeber = paar(), fremd = paar();

// --- 1. Normalfall: Text an einen Empfänger ---
const inhalt = randomBytes(KEY);
const chiffre = verschluesseln(Buffer.from("Der Zaun ist kaputt", "utf8"), inhalt);
const verpackt = verschluesseln(inhalt, gemeinsam(absender.privateKey, roh(empfaenger.publicKey)));
const auf = entschluesseln(verpackt, gemeinsam(empfaenger.privateKey, roh(absender.publicKey)));
pruefe("Text: Empfänger öffnet mit sender_key",
  entschluesseln(chiffre, auf).toString("utf8") === "Der Zaun ist kaputt");

// --- 2. Bild unter DEMSELBEN Inhaltsschlüssel (die Korrektur) ---
const bild = randomBytes(4096);
const bildChiffre = verschluesseln(bild, inhalt);
pruefe("Bild: öffnet mit demselben verpackten Schlüssel",
  Buffer.compare(entschluesseln(bildChiffre, auf), bild) === 0);

// --- 3. Freigabe: ein DRITTES Gerät packt für ein neues um (Migration 0614) ---
const neuesGeraet = paar();
const inhaltBeimFreigeber = entschluesseln(
  verschluesseln(inhalt, gemeinsam(absender.privateKey, roh(freigeber.publicKey))),
  gemeinsam(freigeber.privateKey, roh(absender.publicKey)));
const umgepackt = verschluesseln(inhaltBeimFreigeber,
  gemeinsam(freigeber.privateKey, roh(neuesGeraet.publicKey)));

// GEGEN wrapper_key öffnen — nicht gegen sender_key. Das war der Fehler.
const aufNeu = entschluesseln(umgepackt, gemeinsam(neuesGeraet.privateKey, roh(freigeber.publicKey)));
pruefe("Freigabe: neues Gerät öffnet gegen wrapper_key",
  entschluesseln(chiffre, aufNeu).toString("utf8") === "Der Zaun ist kaputt");

// Und der ALTE Weg muss fehlschlagen — sonst wäre 0614 sinnlos gewesen:
let altGescheitert = false;
try { entschluesseln(umgepackt, gemeinsam(neuesGeraet.privateKey, roh(absender.publicKey))); }
catch { altGescheitert = true; }
pruefe("Freigabe: gegen sender_key schlägt fehl (der Fehler vor 0614)", altGescheitert);

// --- 4. Manipulation wird erkannt ---
const roh2 = Buffer.from(chiffre, "base64");
roh2[roh2.length - 1] ^= 0xff;
let erkannt = false;
try { entschluesseln(roh2.toString("base64"), auf); } catch { erkannt = true; }
pruefe("Manipulation am Chiffretext wird erkannt", erkannt);

// --- 5. Fremdes Gerät kann NICHT öffnen ---
let fremdGescheitert = false;
try { entschluesseln(verpackt, gemeinsam(fremd.privateKey, roh(absender.publicKey))); }
catch { fremdGescheitert = true; }
pruefe("Fremdes Gerät kann den Schlüssel nicht öffnen", fremdGescheitert);

// --- 6. Leerer Chiffretext: der Fall, der als Manipulation durchging ---
let leerWirft = false;
try { entschluesseln("", auf); } catch { leerWirft = true; }
pruefe("Leerer Chiffretext WIRFT — muss vorher abgefangen werden", leerWirft);

// --- 7. Nonce ist je Vorgang verschieden ---
const a = verschluesseln(Buffer.from("x"), inhalt), b = verschluesseln(Buffer.from("x"), inhalt);
pruefe("Nonce wird nie wiederverwendet", a !== b);

console.log(fehler === 0 ? "\nAlle 7 Prüfungen bestanden." : `\n${fehler} FEHLER.`);
process.exit(fehler === 0 ? 0 : 1);
