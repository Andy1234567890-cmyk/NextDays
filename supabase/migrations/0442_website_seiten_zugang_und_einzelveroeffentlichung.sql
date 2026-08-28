-- 0442 — Seiten: Passwortschutz und Einzelveröffentlichung
--
-- Zwei Funktionen aus Hostaways „Manage a Single Page", die uns fehlten. Was
-- wir dort NICHT nachbauen und warum, steht jeweils dabei.
--
-- == 1) Passwortschutz je Seite ==========================================
--
-- Hostaway: „add a password to specific pages on your site that visitors will
-- need to enter to view that page", höchstens 100 Zeichen, beliebige Zeichen.
-- Gedacht für Inhalte, die nicht für alle sind — eine Preisliste für
-- Stammkunden, eine Seite für einen Firmenkunden.
--
-- GESPEICHERT WIRD EIN HASH, NIE DAS PASSWORT. Das ist keine Formsache: die
-- Zeile liegt in einer Tabelle, die das Dashboard liest, sie wandert in jedes
-- Backup und in jeden Datenbank-Auszug. Ein Betrieb, der dort sein
-- Lieblingspasswort einträgt, hätte es sonst im Klartext an einem Dutzend
-- Stellen liegen.
--
-- PBKDF2-HMAC-SHA256 mit Salt und Iterationen, Format
-- `pbkdf2$<iterationen>$<salt_b64>$<hash_b64>` — dieselbe Bauart wie Djangos
-- Standard. Kein bcrypt/argon2, weil das eine neue Abhängigkeit wäre für einen
-- Seitenschutz, der ausdrücklich KEIN Benutzerkonto ist (Hostaway sagt es
-- selbst: „should not be confused with user logins"). Die Bibliothek dafür
-- steht in der Standardbibliothek.
--
-- == 2) Einzelveröffentlichung ===========================================
--
-- Hostaway: eine geänderte Seite live stellen, ohne die ganze Website neu zu
-- veröffentlichen. Der Marker sagt, WANN das zuletzt passiert ist; die
-- Oberfläche zeigt daran das Kalendersymbol.
--
-- Was Hostaway an dieser Stelle einschränkt und was bei uns gilt: dort gehen
-- Theme-Änderungen bei einer Einzelveröffentlichung NICHT mit, und
-- URL-Änderungen brauchen den vollen Publish. Bei uns entsteht dieser
-- Unterschied gar nicht: wir bauen keine statischen Dateien, der Renderer holt
-- Seite und Theme bei jedem Aufruf frisch. `is_published` ist die ganze
-- Wahrheit. Der Zeitstempel ist deshalb eine ANZEIGE, keine zweite Mechanik.

alter table public.site_pages
    add column if not exists access_password_hash text,
    add column if not exists last_single_publish_at timestamptz;

-- Der Hash hat ein festes Format. Ohne diese Prüfung könnte ein späterer
-- Schreibpfad versehentlich Klartext hineinlegen, und niemand würde es sehen —
-- ein Passwort im Klartext sieht in einer Tabelle aus wie jeder andere Text.
alter table public.site_pages
    drop constraint if exists site_pages_zugang_hash_format;
alter table public.site_pages
    add constraint site_pages_zugang_hash_format check (
        access_password_hash is null
        or access_password_hash ~ '^pbkdf2\$[0-9]+\$[A-Za-z0-9+/=]+\$[A-Za-z0-9+/=]+$'
    );

comment on column public.site_pages.access_password_hash is
    'PBKDF2-Hash des Seitenpassworts (pbkdf2$iter$salt$hash). NIE das Passwort '
    'selbst: die Zeile liegt in jedem Backup und jedem Datenbank-Auszug.';
comment on column public.site_pages.last_single_publish_at is
    'Wann diese Seite zuletzt EINZELN veröffentlicht wurde. Reine Anzeige — '
    'anders als bei Hostaway entsteht dabei kein abweichender Live-Stand, weil '
    'der Renderer Seite und Theme bei jedem Aufruf frisch holt.';

-- Wurzel 6: `site_pages` ist bereits gegen den Direktpfad abgesichert (0087).
-- Der Hash ändert daran nichts — aber er ist ein Grund mehr, dass es so bleibt.
-- Eine Gegenprüfung, damit der Zustand nicht stillschweigend kippt:
do $$
declare
    offen text;
begin
    select string_agg(grantee || ':' || privilege_type, ', ')
      into offen
      from information_schema.role_table_grants
     where table_schema = 'public'
       and table_name = 'site_pages'
       and grantee in ('anon', 'authenticated')
       and privilege_type in ('INSERT', 'UPDATE', 'DELETE');
    if offen is not null then
        raise exception
            'site_pages ist ueber den Direktpfad beschreibbar (%) — '
            'mit einem Passwort-Hash in der Tabelle ist das nicht hinnehmbar',
            offen;
    end if;
end $$;
