-- 0409 — Buchungsabsicht: die Buchung entsteht ERST nach bezahlter Zahlung
--
-- DER ANLASS (18.08.2026): Über die eigene Plattform (myBestDays) wurde eine
-- Buchung angelegt, ohne dass je gezahlt wurde — `status='confirmed'`,
-- `paid_amount=0.00`. Sie belegte drei Nächte im Oktober, sperrte sie per
-- ari_outbox bei den OTAs, legte einen Posteingang-Thread an und stieß die
-- Automails an. Bezahlt hat sie nie jemand.
--
-- Ursache: `booking_engine.create_public_booking` setzte
-- `status = 'confirmed'` unmittelbar bei der Anlage; die Zahlung lief erst
-- DANACH über `POST /payments/booking/{reservation_id}/intent`. Bricht der
-- Gast dort ab — Fenster zu, Karte abgelehnt, einfach weitergeklickt —, bleibt
-- eine bestätigte, unbezahlte Buchung stehen. Es gab keinen Weg zurück:
-- niemand räumt sie auf, und im PMS sieht sie aus wie jede andere.
--
-- ENTSCHEIDUNG DES BETRIEBS: Eine Buchung darf nur entstehen, wenn sie bezahlt
-- ist. Nicht „mit Frist reserviert und später verfallen", sondern gar nicht.
--
-- WAS DIESE TABELLE TUT: Sie trägt die geprüften Buchungsdaten zwischen den
-- beiden Schritten. Der Gast bekommt einen PaymentIntent; erst wenn Stripe
-- `payment_intent.succeeded` meldet, entsteht daraus die Reservierung.
--
-- WARUM NICHT IN DIE STRIPE-METADATEN: Dort stünden Name, E-Mail und Telefon
-- des Gastes beim Zahlungsdienstleister, obwohl er sie für die Zahlung nicht
-- braucht (Datensparsamkeit). Zudem sind Metadatenwerte auf 500 Zeichen
-- begrenzt — die Preisaufschlüsselung (`quote_items`) passt dort nicht hinein.
-- Stripe bekommt deshalb nur die ID DIESER Zeile; die Daten bleiben bei uns.
--
-- WAS SIE BEWUSST NICHT TUT: Sie belegt KEINE Nächte. Der Zeitraum ist
-- während des Bezahlens also nicht reserviert — zahlen zwei Gäste gleichzeitig
-- dieselben Nächte, gewinnt der erste, und der zweite bekommt sein Geld
-- automatisch zurück (`booking_engine.absicht_einloesen`). Das ist die
-- bewusste Kehrseite von „keine Buchung ohne Zahlung": lieber eine seltene
-- Rückerstattung als dauerhaft blockierte Nächte ohne Gegenwert.

create table if not exists public.booking_intent (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references public.tenants (id) on delete cascade,
  property_id   uuid not null references public.properties (id) on delete cascade,
  -- Die geprüften Buchungsdaten (Kontakt, Gäste, Tiere, Addons, Promo) und die
  -- SERVERSEITIG gerechnete Preisaufschlüsselung. Als jsonb, weil die Form dem
  -- Quote folgt und sich mit ihm ändert — eine Spalte je Feld hieße, jede
  -- Preis-Erweiterung hier zu migrieren.
  daten         jsonb not null,
  check_in      date not null,
  check_out     date not null,
  -- Der Betrag, den der Gast zahlt. Als eigene Spalte statt nur in `daten`:
  -- er wird gegen den PaymentIntent geprüft, und ein Betrag, der irgendwo in
  -- einem JSON steckt, lädt dazu ein, ihn beim Prüfen zu vergessen.
  total_amount  numeric(12,2) not null check (total_amount > 0),
  -- Währung des Objekts (Wurzel 4: nie ein EUR-Default).
  currency      text not null,
  -- Der PaymentIntent, an dem diese Absicht hängt. Nullable nur im Moment
  -- zwischen Anlage und Stripe-Antwort.
  payment_ref   text,
  -- offen | eingeloest | fehlgeschlagen | abgelaufen
  --   offen           Gast zahlt gerade
  --   eingeloest      Reservierung entstanden (reservation_id gesetzt)
  --   fehlgeschlagen  bezahlt, aber Zeitraum inzwischen weg → erstattet
  --   abgelaufen      nie bezahlt, aufgeräumt
  status        text not null default 'offen'
                check (status in ('offen','eingeloest','fehlgeschlagen','abgelaufen')),
  -- Die entstandene Reservierung. Der UNIQUE-Index darauf ist der
  -- DB-BACKSTOP gegen Doppelbuchung bei Webhook-Redelivery (Wurzel 2): Stripe
  -- liefert dasselbe Ereignis mehrfach, und zwei parallele Zustellungen
  -- dürfen nicht zwei Reservierungen erzeugen.
  reservation_id uuid references public.reservations (id) on delete set null,
  -- Warum fehlgeschlagen (für die Rückerstattungs-Meldung an den Betrieb).
  fehler        text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- Eine Absicht wird GENAU EINMAL eingelöst. Der partielle UNIQUE-Index greift
-- nur auf eingelöste Zeilen, damit mehrere offene Absichten desselben Gastes
-- (er probiert es erneut) möglich bleiben.
create unique index if not exists booking_intent_reservation_uidx
  on public.booking_intent (reservation_id)
  where reservation_id is not null;

-- Der Webhook findet die Absicht über den PaymentIntent.
create unique index if not exists booking_intent_payment_uidx
  on public.booking_intent (payment_ref)
  where payment_ref is not null;

-- Aufräumen: offene Absichten, die nie bezahlt wurden.
create index if not exists booking_intent_offen_idx
  on public.booking_intent (status, created_at)
  where status = 'offen';

alter table public.booking_intent enable row level security;

-- WURZEL 6 — der Direktpfad ist der reale Schutz:
-- Diese Zeilen tragen Gastdaten (Name, E-Mail, Telefon) UND den Zahlbetrag.
-- Ein eingeloggter Nutzer mit dem öffentlichen anon-Key spricht PostgREST
-- direkt an; eine reine Tenant-Policy schützt davor nicht. Deshalb wird das
-- pauschale Tabellen-GRANT vollständig entzogen: NUR der Server
-- (service_role) liest und schreibt hier. Die Oberfläche braucht die Tabelle
-- nicht — sie sieht die fertige Reservierung.
revoke all on public.booking_intent from anon, authenticated;

-- Restriktive Policy als zweite Schranke: selbst wenn ein GRANT je
-- versehentlich zurückkäme, greift keine Zeile für anon/authenticated.
drop policy if exists booking_intent_kein_direktzugriff on public.booking_intent;
create policy booking_intent_kein_direktzugriff
  on public.booking_intent
  as restrictive
  for all
  to anon, authenticated
  using (false)
  with check (false);

comment on table public.booking_intent is
  'Geprüfte Buchungsdaten zwischen Zahlungsstart und bezahlter Buchung (0409). '
  'Eine Reservierung entsteht ausschließlich aus einer eingelösten Absicht — '
  'ohne bezahlte Zahlung gibt es keine Buchung. Belegt selbst KEINE Nächte.';
comment on column public.booking_intent.reservation_id is
  'Die entstandene Reservierung; UNIQUE als Backstop gegen Doppelanlage bei '
  'Stripe-Webhook-Redelivery (Wurzel 2).';
comment on column public.booking_intent.status is
  'offen = Gast zahlt; eingeloest = Buchung entstanden; fehlgeschlagen = '
  'bezahlt, aber Zeitraum vergeben (erstattet); abgelaufen = nie bezahlt.';
