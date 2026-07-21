-- 0167_split_payment_index.sql — Worker-Index für fällige Restzahlungen
--
-- Getrennt von 0166: der partielle Index nutzt den Enum-Wert 'balance' im
-- WHERE-Prädikat. Postgres verbietet die Nutzung eines Enum-Werts in derselben
-- Transaktion, in der er per `alter type ... add value` hinzugefügt wurde
-- ("unsafe use of new enum value"). Da apply-migrations.sh jede Datei in EINER
-- Transaktion fährt, muss der Index in einer NACHFOLGENDEN Migration liegen
-- (0166 committet den Enum-Wert, 0167 darf ihn dann verwenden).

-- Der Restzahlungs-Worker sucht fällige, noch offene 'balance'-Zeilen.
create index if not exists payments_balance_due_idx
    on public.payments (due_at)
    where type = 'balance' and scheduled_status = 'scheduled';
