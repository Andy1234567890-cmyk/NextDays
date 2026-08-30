-- 0495 — Nachrichtenspiegel: die KI als eigene Quelle
--
-- WARUM: `portal_messages.quelle` (0400) sagt, WER eine ausgehende Nachricht
-- ausgelöst hat. Der Constraint kennt vier Werte: manuell, automation, system,
-- portal. Die automatische KI-Antwort (0494) ist keiner davon.
--
-- Ohne einen eigenen Wert bliebe nur `automation` — und damit wäre eine von der
-- KI formulierte Nachricht im Spiegel von einer terminierten Automail nicht
-- mehr zu unterscheiden. Das ist genau der Fehler, den 0400 behoben hat: das
-- Portal-Echo trägt für JEDE ausgehende Nachricht `sender='property'`, und
-- `quelle` ist die einzige Stelle, an der die Herkunft überhaupt noch steht.
--
-- Die Unterscheidung ist nicht kosmetisch. Ein Gast, der später fragt „wer hat
-- mir das geschrieben?", und ein Betrieb, der prüfen will, was seine KI
-- verschickt hat, brauchen dieselbe Antwort — und die Kennzahl „per Automation
-- gesendet" würde sonst KI-Antworten mitzählen und dadurch stillschweigend
-- falsch werden.
--
-- `drop` + `add` statt `alter`: Postgres kann einen check-Constraint nicht
-- ändern. Alle bisherigen Werte bleiben erlaubt, der Bestand validiert ohne
-- Treffer — es ist eine Erweiterung, kein Umbau.

alter table public.portal_messages
  drop constraint if exists portal_messages_quelle_check;

alter table public.portal_messages
  add constraint portal_messages_quelle_check check (
    quelle in (
      'manuell',
      'automation',
      'system',
      'portal',
      -- Automatisch von der KI beantwortet (0493/0494).
      'ki'
    )
  );
