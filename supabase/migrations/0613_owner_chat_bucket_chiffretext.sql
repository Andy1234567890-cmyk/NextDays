-- 0613 — `owner-chat`-Bucket nimmt CHIFFRETEXT, nicht Bilder (Korrektur zu 0611)
--
-- DER FEHLER IN 0611: Der Bucket erlaubte `image/png`, `image/jpeg`,
-- `image/webp`, `image/heic` — die MIME-Liste eines gewöhnlichen Bild-Buckets.
-- Hochgeladen wird hier aber VERSCHLÜSSELTER Inhalt: die App chiffriert das
-- Bild vor dem Senden (ADR-0029), der Server bekommt Zufallsbytes und schickt
-- sie als `application/octet-stream` weiter (`owner_chat/bilder.py`).
--
-- Folge wäre gewesen: JEDER Bildversand scheitert am Bucket — und zwar erst
-- zur Laufzeit, mit einer Storage-Fehlermeldung, die nichts über die Ursache
-- sagt. Gefunden beim Nachprüfen der eingespielten Migration gegen den Code,
-- nicht durch einen Test: kein Test lädt gegen den echten Bucket.
--
-- WARUM DIE MIME-PRÜFUNG HIER NICHTS SCHÜTZT — und ihr Wegfall deshalb kein
-- Verlust ist: Sie prüft, was der CLIENT behauptet. Bei Chiffretext gibt es
-- keinen erkennbaren Kopf, an dem sich irgendetwas verifizieren ließe (anders
-- als in `crm/dateien.py`, wo unverschlüsselte Dateien ankommen und die
-- Magic-Byte-Prüfung greift).
--
-- Was stattdessen schützt, unverändert aus 0611:
--   * Der Bucket ist PRIVAT und liefert nur über kurzlebige signierte Adressen.
--   * Ohne Schlüssel ergeben die Bytes in keinem Betrachter ein Bild — der
--     Polyglot-Angriff („Datei ist zugleich gültiges HTML") läuft ins Leere.
--   * Der Ablagepfad wird SERVERSEITIG gebildet (Mandant/Nutzer/Zufall), der
--     Client bestimmt ihn nicht (Wurzel 3).
--   * Die Größe ist bei 10 MB gedeckelt (Wurzel 8) — hier unverändert.
update storage.buckets
   set allowed_mime_types = array['application/octet-stream']
 where id = 'owner-chat';
