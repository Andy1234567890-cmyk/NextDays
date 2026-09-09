-- 0614 — `owner_message_keys.wrapper_key`: WER hat diesen Schlüssel verpackt?
--
-- DER FEHLER, den diese Spalte behebt (gefunden am 09.09.2026 bei der
-- kritischen Prüfung, vor dem ersten Deploy):
--
-- Bei Ende-zu-Ende-Verschlüsselung wird der Inhaltsschlüssel für jedes
-- Empfängergerät einzeln verpackt — mit einem Geheimnis aus dem privaten
-- Schlüssel des ABSENDERS und dem öffentlichen des EMPFÄNGERS (X25519). Zum
-- Öffnen bildet der Empfänger dasselbe Geheimnis andersherum: sein privater
-- Schlüssel, der öffentliche des Absenders. Deshalb steht `sender_key` an
-- jeder Nachricht.
--
-- Die nachträgliche FREIGABE eines alten Verlaufs bricht diese Symmetrie: Dort
-- verpackt nicht der ursprüngliche Absender, sondern ein DRITTES Gerät (das
-- der Betriebsleitung), das den Verlauf bereits lesen kann. Der Empfänger
-- müsste also gegen dessen öffentlichen Schlüssel entpacken — er kannte aber
-- nur `sender_key` und rechnete mit dem falschen Gegenüber. Das Ergebnis:
-- zwei verschiedene Geheimnisse, der GCM-Tag schlägt fehl, die Nachricht
-- bleibt genau so unlesbar wie vorher.
--
-- Der Vorgang war damit vollständig gebaut — Tabelle, Rollenprüfung,
-- Audit-Log, Endpunkte, Oberfläche, Tests — und konnte kryptografisch NIE
-- funktionieren. Kein Test fand das: die Server-Tests prüfen die Buchhaltung
-- (Rolle, Scope, Zeilenzahl), und die Krypto-Kette läuft nur auf dem Gerät.
--
-- DIE LÖSUNG: Jede verpackte Zeile trägt selbst, gegen WEN sie zu öffnen ist.
-- Beim normalen Senden ist das der Absender (`owner_messages.sender_key`),
-- bei einer Freigabe das freigebende Gerät. Der Client nimmt diesen Wert und
-- nicht mehr blind `sender_key`.
--
-- `default ''` und nicht NOT NULL: Die Tabelle ist noch leer (das Feature ist
-- nicht deployt), aber ein leerer Wert bedeutet eindeutig „gegen
-- `sender_key` öffnen" — der Client behandelt ihn genau so. Ein NOT NULL
-- hätte denselben Effekt gebraucht und wäre bei einem späteren Altbestand
-- eine Migrationsfalle.
alter table public.owner_message_keys
    add column if not exists wrapper_key text not null default '';

comment on column public.owner_message_keys.wrapper_key is
  'Öffentlicher Schlüssel des GERÄTS, das diesen Inhaltsschlüssel verpackt '
  'hat (0614). Leer = der ursprüngliche Absender (owner_messages.sender_key); '
  'gefüllt bei einer nachträglichen Freigabe, wo ein drittes Gerät verpackt. '
  'Ohne diese Angabe bildet der Empfänger das falsche Geheimnis und kann die '
  'Nachricht nicht öffnen.';
