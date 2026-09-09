# ADR-0029 — Eigentümer-Chat: Verschlüsselung

**Status:** ERSETZT am 09.09.2026 · **Datum:** 09.09.2026 · **Migration:** 0611–0616

> ## Diese Entscheidung wurde umgekehrt
>
> Der Chat war Ende-zu-Ende verschlüsselt (der Text unten beschreibt das
> Verfahren). Seit dem 09.09.2026 verschlüsselt der **Server**.
>
> **Warum:** Die Verwaltung arbeitet im Dashboard, im Browser. Dort gibt es
> keinen Ort für einen privaten Geräteschlüssel — `localStorage` wäre genau
> die Hintertür, die E2E ausschließen soll. Die Folge war nicht theoretisch:
> Am 09.09.2026 schrieb ein Eigentümer zwei Nachrichten, und **niemand auf der
> Agenturseite konnte sie öffnen**, weil kein Agenturgerät registriert war.
> Die Nachrichten waren zugestellt, gespeichert und dauerhaft unlesbar.
>
> **Was das kostet — offen benannt:** Wer diesen Server übernimmt und an
> `OWNER_CHAT_SCHLUESSEL` kommt, liest jeden Chat mit. Die Zusicherung „Auch
> wir können es nicht lesen" gilt nicht mehr und wurde aus der Oberfläche
> entfernt (alle 24 Sprachen) — eine Zusicherung, die nicht mehr stimmt, ist
> schlimmer als keine.
>
> **Was bleibt:** Der Chat liegt NICHT im Klartext in der Datenbank. Ein
> Angreifer mit reinem DB-Zugriff (gestohlenes Backup, offener Direktpfad,
> Wurzel 6) sieht weiterhin nichts. Der Schlüssel liegt in der Umgebung des
> Dienstes, nicht in der Datenbank — es braucht beides.
>
> **Verfahren:** AES-256-GCM, 12-Byte-Nonce je Nachricht, Schlüssel 32 Byte
> base64 aus `OWNER_CHAT_SCHLUESSEL`. Umgesetzt in
> `apps/api/src/features/owner_chat/serverkrypto.py`, gemessen in
> `tests/test_serverkrypto.py` (10 Prüfungen: Manipulationserkennung,
> fremder Schlüssel, Nonce-Einmaligkeit, fail-closed ohne Schlüssel).
>
> **Der Bestand bleibt unlesbar.** Nachrichten aus der E2E-Zeit sind mit
> Geräteschlüsseln verpackt; kein Serverschlüssel öffnet sie rückwirkend. Sie
> tragen keine Marke `sv1:` und werden als „nur in der App lesbar"
> gekennzeichnet, statt als Buchstabensalat oder leer zu erscheinen.

---

## Der ursprüngliche Beschluss (überholt, zur Nachvollziehbarkeit)

## Kontext

Zwischen Eigentümer und Verwaltung gab es keinen Nachrichtenweg im System.
Absprachen liefen über privates WhatsApp oder Telefon — ohne Objektbezug, für
Vertretungen unsichtbar, beim Personalwechsel verloren.

Der Chat trägt Betriebsinterna: Preisabsprachen, Beschwerden über
Reinigungskräfte, Streit über Abrechnungen, Schadensfotos fremden Eigentums.

## Entscheidung

Ende-zu-Ende-Verschlüsselung mit Geräteschlüsseln. Der Server sieht
ausschließlich Chiffretext und kann ihn zu keinem Zeitpunkt lesen.

Ausdrückliche Vorgabe des Auftraggebers am 09.09.2026, nach Abwägung der
Alternativen (Klartext mit geschlossenem Direktpfad; AES-256-GCM auf
Anwendungsebene mit serverseitigem Schlüssel). Beide wurden verworfen, weil in
beiden Fällen ein übernommener Anwendungsserver den Klartext hergibt.

## Warum das hier schwerer ist als bei WhatsApp

Bei WhatsApp reden zwei Geräte. Hier redet ein Eigentümer mit einer
**Organisation**: mehrere Mitarbeiter, drei Oberflächen (`web`,
`mobile-nextdays`, PMS-Posteingang), Vertretung und Personalwechsel.

Deshalb ist die Agenturseite kein Schlüsselpaar, sondern eine
Empfängergruppe — Muster wie WhatsApps Sender Keys: Der Nachrichtenschlüssel
wird für JEDEN berechtigten Empfänger einzeln verpackt.

Zum Vergleich, weil es die Frage „warum geht es bei WhatsApp Business" klärt:
die **WhatsApp Business App** (ein Handy) hat E2E; die **Cloud API**, die wir
selbst nutzen (`whatsapp/client.py`), hat sie NICHT — Meta entschlüsselt auf
seinen Servern und reicht Klartext per Webhook weiter. Unser Chat ist
strukturell der zweite Fall; wir bauen die Verschlüsselung hier also über das
hinaus, was Meta für Unternehmen tut.

## Verfahren

| Zweck | Verfahren | Grund |
|---|---|---|
| Identitätsschlüssel je Gerät | X25519 | Schlüsselaustausch, in `quick-crypto` nativ |
| Nachrichteninhalt | AES-256-GCM | authentifiziert; erkennt Manipulation am Chiffretext |
| Verpackung des Nachrichtenschlüssels | X25519 + HKDF + AES-256-GCM je Empfänger | ein Chiffretext, n verpackte Schlüssel |
| Sicherungscode | Argon2id → AES-256-GCM | gegen Wörterbuchangriffe auf den Code |

Bibliothek: `react-native-quick-crypto` 1.1.7 (sicherheitsauditiert, X25519 +
AES-256-GCM, neue Architektur — beide Apps sind bare RN 0.86).

**Warum AES-256-GCM und nicht XChaCha20-Poly1305** (korrigiert am 09.09.2026):
Dieses Dokument nannte zuerst XChaCha20 und verwarf AES-GCM weiter oben sogar
namentlich — gebaut wurde von Anfang an AES-256-GCM
(`chat-krypto.ts:aesVerschluesseln`). Die Doku beschrieb also ein anderes
System als den Code.

Das ist mehr als ein Tippfehler: XChaCha20 hat einen 24-Byte-Nonce, AES-GCM
nur 12. Wer die Nonce-Sicherheit dieses Systems beurteilen will, kommt mit der
falschen Angabe zum falschen Schluss. Gemessen wurde stattdessen der reale
Fall: `aesVerschluesseln` zieht **je Aufruf** 12 frische Zufallsbytes, und der
Inhaltsschlüssel ist je Nachricht neu — die Zahl der Verschlüsselungen unter
einem Schlüssel bleibt einstellig. Eine Kollision ist damit vernachlässigbar.

Beide Verfahren sind gleich stark; die Entscheidung fiel auf AES-GCM, weil
`react-native-quick-crypto` es als native, auditierte Implementierung
mitbringt.
Private Schlüssel liegen im **Keychain / Android Keystore**
(`react-native-keychain` 10, in beiden Apps bereits vorhanden), nie in der
App-Datenbank und nie im Klartext auf der Platte.

Serverseitig wird **nichts entschlüsselt**. `cryptography` 50 dient allein der
Prüfung von Signaturen beim Geräte-Registrieren.

## Festlegungen des Auftraggebers (09.09.2026)

1. **Verlauf für neue Teammitglieder gibt nur `admin`/`co_admin` frei.**
   Nicht jeder Kollege. Damit ist die Freigabe ein Rechte-Vorgang, kein
   Gefallen — und sie ist im Audit-Log nachvollziehbar.
2. **Sicherungscode** für den Eigentümer: beim Einrichten einmal angezeigt,
   nirgends gespeichert. Ohne ihn ist ein verlorenes Gerät ein verlorener
   Verlauf.
3. **Keychain / Android Keystore** als Schlüsselablage, biometrisch geschützt.

## Was das kostet — bewusst, nicht übersehen

- **Keine Vorschau** in der Thread-Liste. Der Posteingang zeigt „Neue
  Nachricht", nie den Text: der Server kann ihn nicht lesen.
- **Push ohne Inhalt** — nur Absender und Objekt.
- **Keine Suche**, keine KI-Vorschläge, keine Vorlagen in diesem Chat.
- **Gerätewechsel ohne Sicherungscode** = Verlauf weg.
- **Passwort-Reset gibt den Verlauf nicht zurück.**
- Ein neues Teammitglied sieht ältere Nachrichten erst nach Freigabe.

Diese Punkte sind keine Bugs und dürfen später nicht „repariert" werden, indem
man einen serverseitigen Schlüssel einführt — das hebt die Entscheidung auf.

## Was E2E NICHT schützt

Ehrlich benannt, damit niemand sich in Sicherheit wiegt:

- **Metadaten**: wer wann mit wem über welches Objekt schreibt, wie oft, wie
  viele Bilder. Steht unverschlüsselt in `owner_threads`.
- **Ein übernommenes Gerät**: wer das entsperrte Handy hat, liest mit.
- **Eine untergeschobene App-Version**: wer den Auslieferungsweg der App
  kontrolliert, kann eine Fassung verteilen, die Schlüssel abgreift. Gegen
  diesen Angreifer hilft keine Kryptografie im Client.
- **Screenshots** der Gegenseite.
- **Rückwirkende Entschlüsselung — keine Forward Secrecy.** Das gemeinsame
  Geheimnis entsteht aus zwei LANGLEBIGEN Schlüsseln; für ein Gerätepaar ist
  es über die gesamte Lebensdauer dasselbe. Wer je einen privaten Schlüssel
  erlangt (entwendetes Gerät, geknackter Sicherungscode), kann damit **jede**
  bisher für dieses Gerät verpackte Nachricht öffnen, nicht nur die künftigen.
  Signal/WhatsApp vermeiden das mit einem Double Ratchet — der kostet die
  nachträgliche Freigabe alter Verläufe, die hier ausdrücklich gebraucht wird
  (Personalwechsel). Die Entscheidung ist damit bewusst, aber sie ist eine
  Einschränkung und wird hier benannt statt verschwiegen.

## Die Freigabe alter Verläufe (`wrapper_key`, Migration 0614)

Beim normalen Senden verpackt der ABSENDER den Inhaltsschlüssel für jeden
Empfänger; der Empfänger öffnet ihn gegen `owner_messages.sender_key`. Bei
einer nachträglichen Freigabe verpackt aber ein DRITTES Gerät — das der
Betriebsleitung. Der Empfänger muss also gegen dessen Schlüssel öffnen.

Genau das fehlte zuerst: Die Freigabe war vollständig gebaut (Tabelle,
Rollenprüfung, Audit-Log, Endpunkte, Oberfläche, Tests) und konnte
kryptografisch **nie** funktionieren — verpackt wurde gegen das eine Gegenüber,
geöffnet gegen das andere. Kein Test fand es: die Server-Tests prüfen die
Buchhaltung, und die Krypto-Kette läuft nur auf dem Gerät.

`owner_message_keys.wrapper_key` hält deshalb fest, WER verpackt hat. Leer
heißt „der ursprüngliche Absender" (der Normalfall); gefüllt bei einer
Freigabe. Der Client entscheidet über `gegenueberVon()` — eine Stelle, keine
verstreute Regel.

## Folgen für den Bau

`owner_messages.body` trägt Chiffretext (base64), nicht Text. Der CHECK auf
„nicht leer" bleibt gültig, prüft aber die Hülle. Die Nebenquelle
`inbox/eigentuemer.py` liefert deshalb KEINE `last_message`-Vorschau, sondern
nur Absenderseite und Zeitpunkt.
