-- 0611 — Chat zwischen Eigentümer und Agentur (`owner_threads`/`owner_messages`).
--
-- DER ANLASS: Zwischen Eigentümer und Verwaltung gab es keinen Nachrichtenweg.
-- Jede Absprache — „der Zaun ist kaputt", „darf ich in Woche 30 selbst rein",
-- „warum steht auf der Abrechnung ein anderer Betrag" — lief über privates
-- WhatsApp oder Telefon: außerhalb des Systems, ohne Bezug zum Objekt, für
-- Vertretungen unsichtbar und beim Personalwechsel verloren.
--
-- WARUM EINE EIGENE TABELLE und nicht eine der drei vorhandenen:
--   * `guest_messages` (0181/0196) gehört dem myBestDays-Marktplatz und hängt
--     an `portal_guest_id` — einer FREMDEN Auth-Welt. Ein Eigentümer ist dort
--     kein Gast.
--   * `portal_messages` (0293) spiegelt OTA-Konversationen und ist über
--     `message_ref` an die Nachrichten-ID BEIM PORTAL gebunden. Für eine
--     Nachricht, die nie bei einem Portal war, müsste man eine erfinden
--     (Wurzel 4).
--   * `channex_booking` scheidet aus, weil `channex_booking_id` NOT NULL +
--     unique ist — dasselbe Argument, das schon `marktplatz.py` und
--     `uebernahme.py` zu eigenen Quellen gemacht hat.
-- Der Posteingang liest sie deshalb als weitere NEBENQUELLE (Präfix `eig:`,
-- `inbox/eigentuemer.py`) — gelesen wird über den Slice, nicht über PostgREST.
--
-- EIN FADEN JE OBJEKT: Der Bezug ist das Ferienobjekt, nicht der Eigentümer.
-- Wer drei Häuser verwalten lässt, führt drei Gespräche, und die Agentur sieht
-- am Thread sofort, worum es geht. `property_id` ist deshalb NOT NULL: ein
-- Faden ohne Objekt wäre in keiner der beiden Oberflächen einsortierbar.
--
-- Der Faden hängt am OBJEKT, nicht am Eigentümer — bewusst, wegen der
-- Miteigentümer (0601/ADR-0028): `owner_properties` ist n:m, und live tragen
-- zwei Objekte mehrere Eigentümer (gemessen 09.09.2026: 35 Zuordnungen auf 33
-- Objekte). Eine `owner_id` am Thread hieße, der Faden gehörte EINEM von
-- ihnen; der zweite Miteigentümer sähe die Absprache über sein eigenes Haus
-- nicht. Wer lesen darf, entscheidet deshalb der Slice über
-- `owner_properties` + Familienfreigabe, nicht eine Spalte hier. Welcher
-- Mensch geschrieben hat, steht an der NACHRICHT (`sender_name`).
--
-- ZEITSTEMPEL (Wurzel 5b): `sent_at` ist hier zu Recht unsere Uhr — die
-- Nachricht ENTSTEHT in diesem System, wenn der Absender sie abschickt. Anders
-- als bei einem OTA-Feed, wo `created_at` nur unseren Abrufzeitpunkt beschreibt.

-- --- Faden je Objekt -----------------------------------------------------------
create table if not exists public.owner_threads (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references public.tenants (id) on delete cascade,
  property_id  uuid not null references public.properties (id) on delete cascade,
  -- Denormalisiert für die Thread-Liste: sonst braucht jede Zeile im
  -- Posteingang einen zweiten Treffer auf `owner_messages`.
  last_message_at timestamptz,
  -- Wann die jeweilige Seite zuletzt gelesen hat. Zwei Spalten statt einer
  -- Lesetabelle: es gibt genau ZWEI Seiten, und der Ungelesen-Zähler ist
  -- damit ein Vergleich statt eines Joins.
  agency_read_at  timestamptz,
  owner_read_at   timestamptz,
  created_at   timestamptz not null default now()
);

-- Ein Faden je Objekt — der Backstop gegen Doppelanlage bei gleichzeitigem
-- Erstzugriff von beiden Seiten (Wurzel 2: real kommt alles doppelt).
create unique index if not exists owner_threads_property_uidx
  on public.owner_threads (tenant_id, property_id);

create index if not exists owner_threads_aktivitaet_idx
  on public.owner_threads (tenant_id, last_message_at desc nulls last);

-- --- Nachrichten ---------------------------------------------------------------
create table if not exists public.owner_messages (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references public.tenants (id) on delete cascade,
  thread_id   uuid not null references public.owner_threads (id) on delete cascade,
  -- 'owner' oder 'agency'. Kein Enum: die Seite steht fest, aber ein Enum
  -- verlangte für jede spätere Rolle (Vertretung, System-Hinweis) eine
  -- Migration. Der CHECK hält die beiden gültigen Werte fest.
  sender      text not null check (sender in ('owner', 'agency')),
  -- WER genau geschrieben hat. Bei der Familienfreigabe schreiben mehrere
  -- Menschen in denselben Faden — ohne diese Spalte stünde am Ende „der
  -- Eigentümer", und niemand wüsste, ob die Tochter oder der Vater zugesagt
  -- hat. Nullable, weil `users` beim Löschen des Kontos die Zeile behält.
  sender_user_id uuid references public.users (id) on delete set null,
  -- Angezeigter Name zum Zeitpunkt des Schreibens. Eingefroren, damit ein
  -- später umbenanntes oder gelöschtes Konto den Verlauf nicht umschreibt.
  sender_name text not null,
  body        text not null default '',
  -- Öffentlicher Schlüssel des GERÄTS, das gesendet hat. Der Empfänger braucht
  -- ihn, um das gemeinsame Geheimnis zu bilden; ohne ihn ist der verpackte
  -- Schlüssel nicht zu öffnen. Er wird MIT der Nachricht eingefroren statt
  -- über `owner_chat_devices` nachgeschlagen: wird das Gerät später entfernt,
  -- muss der Verlauf lesbar BLEIBEN (Wurzel 1).
  sender_key  text not null default '',
  -- Bilder als Liste von Pfaden im privaten Bucket `owner-chat`. jsonb statt
  -- eigener Tabelle: ein Anhang existiert nur im Kontext seiner Nachricht,
  -- wird nie einzeln abgefragt und nie ohne sie gelöscht.
  attachments jsonb not null default '[]'::jsonb,
  sent_at     timestamptz not null default now(),
  created_at  timestamptz not null default now(),
  -- Eine Nachricht ohne Text UND ohne Bild ist keine Nachricht. Ohne diesen
  -- CHECK legt ein Doppelklick auf „Senden" bei leerem Feld eine leere Zeile
  -- an, die in beiden Oberflächen als Blase erscheint (Wurzel 4).
  constraint owner_messages_nicht_leer
    check (length(trim(body)) > 0 or jsonb_array_length(attachments) > 0)
);

create index if not exists owner_messages_thread_idx
  on public.owner_messages (thread_id, sent_at);

-- --- Wurzel 6: der DB-Direktpfad ------------------------------------------------
--
-- Beide Tabellen tragen Betriebsinterna (Preisabsprachen, Beschwerden über
-- Reinigungskräfte, Streit über Abrechnungen). `enable rls` + Tenant-Policy
-- reicht dafür NICHT: ein eingeloggter cleaner mit dem öffentlichen anon-Key
-- läse per `curl /rest/v1/owner_messages` tenant-weit mit.
--
-- Deshalb fail-closed: KEINE Policy für anon/authenticated, alle Rechte
-- entzogen. Gelesen und geschrieben wird ausschließlich über den Server
-- (service_role) — `inbox/eigentuemer.py` auf Agenturseite,
-- `public_portal/nachrichten.py` auf Eigentümerseite. Beide prüfen den Scope
-- (Wurzel 3/9), was eine Tabellen-Policy nicht kann: sie kennt weder die
-- Objektzuordnung des Eigentümers noch die Postfach-Berechtigung des Teams.
--
-- Folge fürs Frontend (bewusst): ein Realtime-Abo auf diese Tabellen wäre eine
-- stumme Attrappe, weil `select` fehlt. Die Oberflächen hören auf ein
-- serverseitiges Signal, nicht auf die Tabelle.
--
-- ENDE-ZU-ENDE-VERSCHLÜSSELT (ADR-0029, Vorgabe vom 09.09.2026). `body` trägt
-- CHIFFRETEXT, keinen Text: verschlüsselt auf dem Gerät des Absenders
-- (AES-256-GCM), entschlüsselt auf dem Gerät des Empfängers. Der Server
-- transportiert und lagert, er liest nie.
--
-- Der oben geschlossene Direktpfad ist deshalb die ZWEITE Schicht, nicht die
-- einzige: selbst ein vollständiger DB-Dump gibt nur Chiffretext her, und wer
-- den Anwendungsserver übernimmt, findet dort keinen Schlüssel — es gibt
-- serverseitig keinen.
--
-- WAS UNVERSCHLÜSSELT BLEIBT (Metadaten, ehrlich benannt): wer wann mit wem
-- über welches Objekt schreibt, wie oft, wie viele Bilder. Das steht in
-- `owner_threads` und in den Spalten neben `body`. E2E schützt Inhalte, nicht
-- Verkehrsdaten — wer etwas anderes behauptet, täuscht.
--
-- FOLGE FÜR DIE OBERFLÄCHEN, bewusst in Kauf genommen: keine Vorschau in der
-- Thread-Liste, kein Nachrichtentext im Push, keine Suche, keine KI-Vorschläge
-- in diesem Chat. Diese Lücken sind KEINE Bugs. Sie später zu „reparieren",
-- indem ein serverseitiger Schlüssel eingeführt wird, hebt die Entscheidung
-- auf — dann bitte ADR-0029 ändern, nicht diese Tabelle.
alter table public.owner_threads  enable row level security;
alter table public.owner_messages enable row level security;

revoke all on public.owner_threads  from anon, authenticated;
revoke all on public.owner_messages from anon, authenticated;

comment on table public.owner_threads is
  'Chat Eigentümer <-> Agentur, ein Faden je Objekt (0611). Wurzel 6: kein '
  'Direktpfad — Zugriff nur über service_role, Scope im Slice geprüft.';
comment on table public.owner_messages is
  'Nachrichten des Eigentümer-Chats (0611). Wurzel 6: kein Direktpfad. '
  'sender_name ist eingefroren, damit ein umbenanntes Konto den Verlauf '
  'nicht rückwirkend ändert.';

-- --- Bilder --------------------------------------------------------------------
--
-- Privat, ohne `storage.objects`-Policy für anon/authenticated (Muster 0088,
-- 0445, 0598): angezeigt wird ausschließlich über kurzlebige signierte
-- Adressen aus dem Server. Ein Schadensfoto zeigt fremdes Eigentum und
-- gelegentlich Personen — es gehört nicht in einen öffentlichen Bucket.
--
-- ZUR MIME-LISTE, korrigiert am 09.09.2026 (siehe 0613): Hier stand, sie sei
-- der „zweite Riegel" nach einer Magic-Byte-Prüfung im Upload-Weg. Die gibt es
-- NICHT — und sie kann es nicht geben: der Inhalt ist verschlüsselt und hat
-- keinen erkennbaren Kopf (`owner_chat/bilder.py` begründet das). Wer den
-- alten Satz las, glaubte an einen Schutz, den nie jemand gebaut hat.
--
-- Was wirklich schützt: privater Bucket, nur signierte Adressen, serverseitig
-- gebildeter Pfad, harte Größengrenze. 0613 setzt die Liste auf
-- `application/octet-stream` — die Bildformate hier hätten JEDEN Upload
-- abgewiesen.
--
-- 10 MB, weil ein iPhone-Foto in voller Auflösung 4-8 MB wiegt.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
    'owner-chat',
    'owner-chat',
    false,
    10485760,
    array['image/png', 'image/jpeg', 'image/webp', 'image/heic']
)
on conflict (id) do update set
    public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

-- --- E2E: Geräteschlüssel (ADR-0029) -------------------------------------------
--
-- Ein Eintrag je GERÄT, nicht je Mensch: wer Handy und Tablet nutzt, hat zwei
-- Schlüsselpaare. Nur der ÖFFENTLICHE Teil steht hier — der private verlässt
-- die Keychain bzw. den Android Keystore nie.
--
-- WARUM `public_key` UND `signing_key`: Verschlüsseln (X25519) und Signieren
-- (Ed25519) sind verschiedene Aufgaben, und einen Schlüssel für beides zu
-- verwenden ist ein bekannter Fehler. Die Signatur belegt beim Registrieren,
-- dass das Gerät den privaten Teil wirklich besitzt.
create table if not exists public.owner_chat_devices (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references public.tenants (id) on delete cascade,
  user_id      uuid not null references public.users (id) on delete cascade,
  -- 'owner' oder 'agency' — dieselbe Seite wie an der Nachricht. Bestimmt,
  -- für wen ein neuer Nachrichtenschlüssel verpackt werden muss.
  seite        text not null check (seite in ('owner', 'agency')),
  -- X25519, base64. Für dieses Gerät wird der Nachrichtenschlüssel verpackt.
  public_key   text not null,
  -- Ed25519, base64. Prüft beim Registrieren den Besitz des privaten Teils.
  signing_key  text not null,
  -- Menschenlesbar in der Geräteliste („iPhone von Rene"), damit ein fremdes
  -- Gerät auffällt. Der Nutzer muss sehen können, WAS mitliest.
  geraet_name  text not null,
  -- Gesperrte Geräte bekommen keine neuen Schlüssel mehr (verlorenes Handy).
  -- Kein Löschen: die alten verpackten Schlüssel bleiben gültig, sonst wäre
  -- der Verlauf für die übrigen Geräte kaputt (Wurzel 1).
  gesperrt_am  timestamptz,
  zuletzt_aktiv timestamptz,
  created_at   timestamptz not null default now()
);

create index if not exists owner_chat_devices_user_idx
  on public.owner_chat_devices (tenant_id, user_id) where gesperrt_am is null;

-- --- E2E: Nachrichtenschlüssel je Empfänger ------------------------------------
--
-- Jede Nachricht hat EINEN zufälligen Inhaltsschlüssel; er wird für jedes
-- berechtigte Gerät einzeln verpackt (Muster: WhatsApps Sender Keys). Bei
-- einem Eigentümer mit zwei Geräten und vier Mitarbeitern sind das sechs
-- Zeilen je Nachricht — Absicht, nicht Redundanz: nur so kann jeder Empfänger
-- lesen, ohne dass ein gemeinsamer Schlüssel irgendwo zentral liegt.
create table if not exists public.owner_message_keys (
  message_id uuid not null references public.owner_messages (id) on delete cascade,
  device_id  uuid not null references public.owner_chat_devices (id) on delete cascade,
  -- Der Inhaltsschlüssel, verschlüsselt für genau dieses Gerät (base64).
  wrapped_key text not null,
  primary key (message_id, device_id)
);

-- --- E2E: Freigabe alter Verläufe ----------------------------------------------
--
-- Ein neues Teammitglied kann ältere Nachrichten kryptografisch NICHT lesen —
-- für sein Gerät wurde nie ein Schlüssel verpackt. Die Freigabe holt das nach:
-- ein Gerät, das den Verlauf lesen kann, verpackt die alten Schlüssel für das
-- neue Gerät.
--
-- FESTLEGUNG vom 09.09.2026: freigeben dürfen NUR `admin` und `co_admin`.
-- Nicht jeder Kollege — sonst wäre der Zugang zu Betriebsinterna eine
-- Gefälligkeit unter Mitarbeitern statt eine Rechteentscheidung. Diese Tabelle
-- ist zugleich das Protokoll: wer wem wann Einblick gegeben hat.
create table if not exists public.owner_chat_freigaben (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references public.tenants (id) on delete cascade,
  thread_id     uuid not null references public.owner_threads (id) on delete cascade,
  -- Wer freigegeben hat (admin/co_admin) und für welches Gerät.
  freigegeben_von uuid references public.users (id) on delete set null,
  device_id     uuid not null references public.owner_chat_devices (id) on delete cascade,
  -- Bis zu welchem Zeitpunkt rückwirkend. NULL = der ganze Verlauf.
  --
  -- NOCH NICHT IN GEBRAUCH (Stand 09.09.2026): `freigabe.schluessel_nachtragen`
  -- schreibt diese Spalte nicht, jede Freigabe umfasst den ganzen Verlauf. Die
  -- Spalte bleibt, weil eine Teil-Freigabe („erst ab meinem Eintritt") absehbar
  -- ist und ein späteres `alter table` an einer Tabelle mit Daten teurer wäre
  -- als eine leere Spalte. Wer sie liest, muss wissen: NULL heißt hier
  -- „ganzer Verlauf", nicht „nicht gesetzt" — es gibt keinen anderen Wert.
  ab_zeitpunkt  timestamptz,
  created_at    timestamptz not null default now()
);

create index if not exists owner_chat_freigaben_thread_idx
  on public.owner_chat_freigaben (tenant_id, thread_id);

-- --- E2E: Wiederherstellung per Sicherungscode ----------------------------------
--
-- FESTLEGUNG vom 09.09.2026: Der Eigentümer bekommt beim Einrichten einen Code
-- zum Aufschreiben. Verliert er sein Gerät, holt er damit den Verlauf zurück.
--
-- Hier steht NICHT der Code und NICHT der Schlüssel im Klartext: gespeichert
-- ist der Identitätsschlüssel, verschlüsselt MIT dem Code (Argon2id gegen
-- Wörterbuchangriffe, dann AES-256-GCM). Wer diese Zeile stiehlt, hat
-- eine Hülle — ohne den Code, der nur auf dem Zettel des Eigentümers steht,
-- ist sie wertlos.
--
-- Der Code selbst wird NIRGENDS abgelegt, auch nicht als Hash: ein Hash
-- erlaubte das Durchprobieren. Vergisst der Eigentümer ihn, ist der Verlauf
-- endgültig weg — das ist der Preis der Entscheidung, nicht ein Fehler.
create table if not exists public.owner_chat_recovery (
  user_id       uuid primary key references public.users (id) on delete cascade,
  tenant_id     uuid not null references public.tenants (id) on delete cascade,
  -- Identitätsschlüssel, verschlüsselt mit dem Sicherungscode (base64).
  wrapped_identity text not null,
  -- Argon2id-Parameter, damit eine spätere Erhöhung alte Zeilen nicht
  -- unlesbar macht (der Wert wandert mit, statt im Code zu stehen).
  kdf_params    jsonb not null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- Wurzel 6 für alle vier: kein Direktpfad. Öffentliche Schlüssel wären für
-- sich harmlos, aber die Geräteliste verrät, WER am Chat teilnimmt, und die
-- Freigabetabelle, wer worauf Zugriff bekam.
alter table public.owner_chat_devices   enable row level security;
alter table public.owner_message_keys   enable row level security;
alter table public.owner_chat_freigaben enable row level security;
alter table public.owner_chat_recovery  enable row level security;

revoke all on public.owner_chat_devices   from anon, authenticated;
revoke all on public.owner_message_keys   from anon, authenticated;
revoke all on public.owner_chat_freigaben from anon, authenticated;
revoke all on public.owner_chat_recovery  from anon, authenticated;

comment on table public.owner_chat_devices is
  'E2E-Geräteschlüssel des Eigentümer-Chats (0611/ADR-0029). NUR öffentliche '
  'Teile — die privaten liegen in Keychain/Android Keystore.';
comment on table public.owner_message_keys is
  'Inhaltsschlüssel je Nachricht und Gerät, verpackt (0611/ADR-0029). Ohne '
  'passendes Gerät nicht zu öffnen; der Server kann es nie.';
comment on table public.owner_chat_recovery is
  'Identitätsschlüssel, verschlüsselt mit dem Sicherungscode des Nutzers '
  '(0611/ADR-0029). Der Code steht nirgends — auch nicht als Hash.';

-- --- E2E: Registrierungs-Aufgabe (Besitznachweis) ------------------------------
--
-- Wer ein Gerät einträgt, muss BEWEISEN, dass er den privaten Schlüssel dazu
-- hat. Sonst trüge ein angemeldeter Nutzer einfach einen fremden öffentlichen
-- Schlüssel ein und läse ab sofort jede Nachricht mit — ein Mitleser, den
-- niemand sieht (Wurzel 3).
--
-- Der Ablauf: Server stellt eine Zufallsaufgabe, das Gerät signiert sie mit
-- seinem privaten Ed25519-Schlüssel, der Server prüft gegen den mitgelieferten
-- öffentlichen. Danach ist die Aufgabe VERBRAUCHT (Wurzel 2) — sonst
-- registrierte dieselbe abgefangene Signatur beliebig viele weitere Geräte.
--
-- Eine Zeile je Nutzer (primary key): eine neue Registrierung ersetzt die alte
-- offene. Wer zweimal beginnt, hat genau eine gültige Aufgabe, nicht zwei.
create table if not exists public.owner_chat_aufgaben (
  user_id    uuid primary key references public.users (id) on delete cascade,
  tenant_id  uuid not null references public.tenants (id) on delete cascade,
  aufgabe    text not null,
  erzeugt_am timestamptz not null default now()
);

alter table public.owner_chat_aufgaben enable row level security;
revoke all on public.owner_chat_aufgaben from anon, authenticated;

comment on table public.owner_chat_aufgaben is
  'Einmal-Aufgabe für den Geräte-Besitznachweis (0611/ADR-0029). Nach der '
  'Prüfung sofort gelöscht — eine Signatur registriert genau ein Gerät.';
