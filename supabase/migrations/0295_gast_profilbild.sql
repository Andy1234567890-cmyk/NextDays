-- 0295 — Profilbild des Gastes vom Portal (`guests.avatar_url`)
--
-- DER ANLASS (06.08.2026): Der Posteingang zeigte überall nur Initialen-Kreise.
-- Die Annahme, Airbnb liefere kein Profilbild, war FALSCH — sie stammte daher,
-- dass nur `v2/reservations` und `v2/threads/{id}` geprüft worden waren. Dort
-- steht wirklich keins. Es steht aber in `v2/users/{id}`, live gemessen:
--
--   {"user": {"first_name": "Nicolette", "id": "6776750",
--             "picture_url": "https://a0.muscache.com/im/pictures/user/…
--                             ?aki_policy=profile_x_medium",
--             "picture_url_large": "…?aki_policy=profile_large"}}
--
-- Die Nutzer-ID kommt aus dem Thread (`thread.users[].id`, Rolle GUEST); die
-- Reservierung selbst führt sie als `guest_id`.
--
-- WARUM NUR DIE URL, KEIN DOWNLOAD: Airbnb liefert das Bild über sein CDN
-- (a0.muscache.com) mit stabilem Pfad je Nutzer. Es zu kopieren hieße, ein
-- personenbezogenes Foto ohne Not bei uns zu speichern und es beim nächsten
-- Profilwechsel veraltet anzuzeigen. Die URL ist der Verweis auf die Quelle.
--
-- NULLABLE OHNE DEFAULT: Ein Gast ohne Portalprofil (Direktbuchung, Booking.com
-- ohne Bild) hat kein Bild — dann zeigt die Oberfläche die Initialen, statt ein
-- erfundenes Platzhalterbild zu behaupten (Wurzel 4).

alter table public.guests
  add column if not exists avatar_url text;

comment on column public.guests.avatar_url is
  'Profilbild-URL beim Portal (Airbnb v2/users/{id}.picture_url_large). NULL = '
  'das Portal führt keins; die UI zeigt dann Initialen, nie einen Platzhalter.';
