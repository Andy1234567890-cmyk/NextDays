#!/usr/bin/env bash
# ============================================================================
# gaestemappe-pruefen.sh — prüft die Gasttexte (properties.type_attributes.messaging)
# ----------------------------------------------------------------------------
# Hintergrund (19.08.2026): Die Gästemappe (Check-in, Türzugang, Hausordnung,
# WLAN, Reiseführer, Notfall) gibt es jetzt in DREI Oberflächen — Web
# (`/reservierungen/unterkuenfte/[id]/gaestemappe`, Rich-Text), Objekt →
# „Nachrichten" (dieselben Daten) und in der PMS-App
# (`mobile-nextdays/screens/PropertyGuestGuide*`, Klartext). EINE Wahrheit:
# `properties.type_attributes.messaging`.
#
# Weil drei Oberflächen auf dasselbe jsonb schreiben, sind die gefährlichen
# Zustände FORM-Fehler, die keine UI anzeigt. Das Skript prüft read-only:
#   1. Block liegt als reiner String statt als Sprach-Map vor (Altbestand) —
#      weder Web noch App zeigen ihn; der Text ist unsichtbar.
#   2. Text, der nach dem Strippen leer ist (`<p><br></p>`, `&nbsp;`) — die
#      Sprache sieht gepflegt aus, der Versand meldet „Feld ohne Wert"
#      (Wurzel 4: kein plausibler Ersatz, aber auch keine leere Zusage).
#   3. Sprachschlüssel außerhalb de/en/da — in keiner Oberfläche editierbar.
#   4. Block-Schlüssel außerhalb der acht bekannten — dito. Beide Fälle sind
#      kein Datenverlust (App und Web lassen sie stehen), aber sie sind toter
#      Inhalt, solange keine Feldliste sie kennt.
#   5. Der Direktpfad (Wurzel 6): anon/authenticated dürfen `properties` NICHT
#      schreiben. In `messaging.doorInstructions` steht die Türzugangs-Anleitung
#      — wer die per curl ändern könnte, öffnet Türen.
#
# Zusätzlich als Übersicht (nur Anzeige): Pflegestand je Objekt.
#
# Aufruf:
#   bash scripts/diagnose/gaestemappe-pruefen.sh
#
# Zugang (ENV, Defaults passen auf den Staging-Server):
#   DB_SSH=root@65.21.144.136     # leer lassen, wenn psql lokal erreichbar ist
#   DB_CONTAINER=                 # leer = automatisch (docker ps, Präfix db-)
#   DB_USER=supabase_admin
#   DB_NAME=postgres
#
# Exit 0 = alles sauber, Exit 1 = mindestens ein Befund.
# ============================================================================
set -uo pipefail

DB_SSH="${DB_SSH-root@65.21.144.136}"
DB_CONTAINER="${DB_CONTAINER-}"
DB_USER="${DB_USER-supabase_admin}"
DB_NAME="${DB_NAME-postgres}"

# Die acht bekannten Blöcke — Spiegel von web/lib/messaging-meta.ts und
# mobile-nextdays/lib/gaestemappe.ts. Ein neunter Block gehört auch hierher.
FELDER="'checkIn','checkOut','directions','doorInstructions','rules','wifi','localGuide','emergency'"

psql_exec() {
  local sql="$1"
  if [[ -n "$DB_SSH" ]]; then
    local container="$DB_CONTAINER"
    if [[ -z "$container" ]]; then
      container=$(ssh "$DB_SSH" "docker ps --format '{{.Names}}' | grep '^db-' | head -1")
    fi
    ssh "$DB_SSH" "docker exec $container psql -U $DB_USER -d $DB_NAME -Atc \"$sql\""
  else
    psql -U "$DB_USER" -d "$DB_NAME" -Atc "$sql"
  fi
}

fehler=0

pruefe() {
  # $1 = Titel, $2 = count-SQL, $3 = Detail-SQL, $4 = Erklärung
  local titel="$1" count_sql="$2" detail_sql="$3" hinweis="$4"
  echo "— $titel —"
  local anzahl
  anzahl=$(psql_exec "$count_sql")
  if [[ -z "$anzahl" ]]; then
    echo "FEHLER: keine Antwort von der DB — Zugang prüfen (DB_SSH/DB_CONTAINER)." >&2
    exit 1
  fi
  if [[ "$anzahl" != "0" ]]; then
    echo "BEFUND: $anzahl Zeile(n)." >&2
    psql_exec "$detail_sql" >&2
    echo "→ $hinweis" >&2
    fehler=1
  else
    echo "OK: 0."
  fi
  echo
}

# 1. Block als String statt als Sprach-Map.
pruefe "Blöcke ohne Sprach-Map (reiner String)" \
  "select count(*) from public.properties p,
     jsonb_each(coalesce(p.type_attributes->'messaging','{}'::jsonb)) b
    where jsonb_typeof(p.type_attributes->'messaging') = 'object'
      and jsonb_typeof(b.value) = 'string'" \
  "select p.id || ' | ' || p.title || ' | ' || b.key
     from public.properties p,
          jsonb_each(coalesce(p.type_attributes->'messaging','{}'::jsonb)) b
    where jsonb_typeof(p.type_attributes->'messaging') = 'object'
      and jsonb_typeof(b.value) = 'string'
    limit 20" \
  "Weder Web noch App lesen einen String — der Text ist für jede Oberfläche unsichtbar.
  Beim Speichern in der App wird er zu {de: <Text>} normalisiert (mappeSchreiben);
  bis dahin bleibt er ungenutzt."

# 2. Scheinbar gepflegt, real leer.
pruefe "Texte, die nach dem Strippen leer sind" \
  "select count(*) from public.properties p,
     jsonb_each(coalesce(p.type_attributes->'messaging','{}'::jsonb)) b,
     jsonb_each_text(case when jsonb_typeof(b.value) = 'object' then b.value else '{}'::jsonb end) s
    where jsonb_typeof(p.type_attributes->'messaging') = 'object'
      and s.value <> ''
      and btrim(regexp_replace(replace(s.value,'&nbsp;',' '),'<[^>]*>','','g')) = ''" \
  "select p.id || ' | ' || p.title || ' | ' || b.key || ' | ' || s.key
          || ' | ' || left(s.value, 40)
     from public.properties p,
          jsonb_each(coalesce(p.type_attributes->'messaging','{}'::jsonb)) b,
          jsonb_each_text(case when jsonb_typeof(b.value) = 'object' then b.value else '{}'::jsonb end) s
    where jsonb_typeof(p.type_attributes->'messaging') = 'object'
      and s.value <> ''
      and btrim(regexp_replace(replace(s.value,'&nbsp;',' '),'<[^>]*>','','g')) = ''
    limit 20" \
  "Die Sprache sieht im Web gepflegt aus, der Platzhalter bleibt aber leer und
  legt jede Vorlage still, die ihn benutzt. Text nachtragen oder Feld leeren."

# 3. Fremde Sprachschlüssel.
pruefe "Sprachen außerhalb de/en/da" \
  "select count(*) from public.properties p,
     jsonb_each(coalesce(p.type_attributes->'messaging','{}'::jsonb)) b,
     jsonb_each_text(case when jsonb_typeof(b.value) = 'object' then b.value else '{}'::jsonb end) s
    where jsonb_typeof(p.type_attributes->'messaging') = 'object'
      and s.key not in ('de','en','da')" \
  "select distinct s.key || ' | ' || b.key || ' | ' || p.title
     from public.properties p,
          jsonb_each(coalesce(p.type_attributes->'messaging','{}'::jsonb)) b,
          jsonb_each_text(case when jsonb_typeof(b.value) = 'object' then b.value else '{}'::jsonb end) s
    where jsonb_typeof(p.type_attributes->'messaging') = 'object'
      and s.key not in ('de','en','da')
    limit 20" \
  "Keine Oberfläche kann diese Sprache bearbeiten (LANGS = de/en/da). Der Text
  wird nur als letzter Fallback ausgeliefert — Sprache aufnehmen oder Text löschen."

# 4. Fremde Block-Schlüssel.
pruefe "Blöcke außerhalb der acht bekannten" \
  "select count(*) from public.properties p,
     jsonb_each(coalesce(p.type_attributes->'messaging','{}'::jsonb)) b
    where jsonb_typeof(p.type_attributes->'messaging') = 'object'
      and b.key not in ($FELDER)" \
  "select distinct b.key || ' | ' || p.title
     from public.properties p,
          jsonb_each(coalesce(p.type_attributes->'messaging','{}'::jsonb)) b
    where jsonb_typeof(p.type_attributes->'messaging') = 'object'
      and b.key not in ($FELDER)
    limit 20" \
  "Toter Inhalt: keine Feldliste kennt den Block, also zeigt ihn keine
  Oberfläche und kein Platzhalter setzt ihn ein. In beide Feldlisten aufnehmen
  (web/lib/messaging-meta.ts UND mobile-nextdays/lib/gaestemappe.ts) oder löschen."

# 5. Wurzel 6: Schreibrecht am Direktpfad.
pruefe "Schreibrechte auf properties für anon/authenticated" \
  "select count(*) from information_schema.role_table_grants
    where table_schema = 'public' and table_name = 'properties'
      and grantee in ('anon','authenticated')
      and privilege_type in ('INSERT','UPDATE','DELETE')" \
  "select grantee || ' | ' || privilege_type
     from information_schema.role_table_grants
    where table_schema = 'public' and table_name = 'properties'
      and grantee in ('anon','authenticated')
      and privilege_type in ('INSERT','UPDATE','DELETE')" \
  "Ein eingeloggter cleaner könnte per curl gegen /rest/v1/properties die
  Türzugangs-Anleitung (messaging.doorInstructions) ändern — der FastAPI-Layer
  mit manage_properties wird dabei umgangen. revoke setzen (Wurzel 6)."

# Übersicht (kein Befund): Pflegestand je Objekt.
echo "— Pflegestand (Anzeige) —"
psql_exec "select p.title || ' | ' ||
    coalesce((select count(*) from jsonb_each(p.type_attributes->'messaging') b
               where jsonb_typeof(b.value) = 'object'
                 and exists (select 1 from jsonb_each_text(b.value) s
                              where btrim(regexp_replace(replace(s.value,'&nbsp;',' '),'<[^>]*>','','g')) <> '')
             ), 0) || ' von 8 Blöcken'
   from public.properties p
  where jsonb_typeof(p.type_attributes->'messaging') = 'object'
  order by 1 limit 40"
echo

if [[ "$fehler" != "0" ]]; then
  echo "Ergebnis: Befunde vorhanden (siehe oben)." >&2
  exit 1
fi
echo "Ergebnis: alles sauber."
