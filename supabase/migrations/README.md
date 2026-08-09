# supabase/migrations — Reihenfolge, Tracking und die Nummernkollisionen

Alle Dateien in diesem Ordner werden von `supabase/apply-migrations.sh` in
**Dateinamen-Reihenfolge** (`sort`) auf die Server-DB angewendet.

```bash
bash supabase/apply-migrations.sh        # neue Migrationen anwenden
```

Nie von Hand per `psql` einspielen — sonst fehlt der Tracking-Eintrag und die
Migration läuft beim nächsten Lauf des Skripts ein zweites Mal.

## Getrackt wird der DATEINAME, nicht die Nummer

`public.schema_migrations` speichert je angewendeter Migration eine Zeile mit
dem Dateinamen **ohne** `.sql`:

```
version                                     | applied_at
--------------------------------------------+------------------------
0337_ankuendigungen                         | …
0337_availability_sperrantrag_bezug         | …
0337_direktpfad_sensible_tabellen_schliessen| …
```

Daraus folgt die wichtigste Regel dieses Ordners:

> **Eine bereits eingespielte Migrationsdatei wird NIE umbenannt.**
> Der neue Name steht nicht in `schema_migrations` — das Skript hielte sie für
> eine neue Migration und würde ihr SQL ein zweites Mal fahren.

Bei den meisten Migrationen wäre das ein Fehlschlag (`create type` ohne
`if not exists`, doppelte `insert`), bei manchen ein stiller Datenschaden.

## Bekannte Nummernkollisionen (bewusst so belassen)

Mehrere Agenten haben parallel gearbeitet und dieselbe Nummer vergeben. Alle
betroffenen Dateien sind **bereits eingespielt** (live gegen die DB geprüft am
08.08.2026) und bleiben deshalb unter ihrem jetzigen Namen stehen:

| Nummer | Dateien |
|---|---|
| `0333` | `0333_kanal_aus_ota_name_nachziehen.sql`, `0333_sperrantrag_ueberlappung.sql` |
| `0337` | `0337_ankuendigungen.sql`, `0337_availability_sperrantrag_bezug.sql`, `0337_direktpfad_sensible_tabellen_schliessen.sql` |

Das ist unkritisch, weil die Dateien fachlich unabhängig sind und die
Sortierung innerhalb einer Nummer alphabetisch und damit **stabil und
reproduzierbar** ist — jeder Lauf auf jeder Maschine wendet sie in derselben
Reihenfolge an. Voneinander abhängige Migrationen dürfen sich eine Nummer
allerdings nicht teilen; das ist hier geprüft und nicht der Fall.

Prüfen, was eingespielt ist:

```bash
ssh root@65.21.144.136 "docker exec \$(docker ps --format '{{.Names}}' \
  | grep -E '^db-' | head -1) psql -U postgres -d postgres -t -A \
  -c \"select version from public.schema_migrations order by version;\""
```

## Überholte Kommentare in eingespielten Migrationen

Eine eingespielte Migration wird auch dann nicht mehr bearbeitet, wenn nur ein
Kommentar darin überholt ist — der Dateiinhalt ist Teil des Nachweises, was
damals gefahren wurde. Bekannte Fälle:

- **`0336_gaeste_direktpfad_schliessen.sql`, Zeile 94** nennt
  `guest_addresses`/`guest_contacts`/`guest_notes` als „bleiben alle offen" und
  empfiehlt sie als Realtime-Ersatzquelle. Das galt zum Zeitpunkt von 0336;
  **`0337_direktpfad_sensible_tabellen_schliessen.sql` hat diese drei Tabellen
  danach ebenfalls geschlossen** (`authenticated` hat dort kein `SELECT` mehr,
  live geprüft am 08.08.2026). Ein Abo auf sie wäre heute eine stumme
  Attrappe. Die betroffenen Seiten (`web/app/(dashboard)/gaeste/page.tsx`,
  `…/gaeste/[id]/page.tsx`) hören korrekt auf `reservations`.

## Nächste freie Nummer

**0340.** Vor dem Anlegen einer neuen Datei kurz `ls supabase/migrations | tail`
prüfen — arbeitet gerade jemand parallel, lieber eine Nummer weiterzählen als
eine weitere Kollision zu erzeugen.

## Pflichten für jede neue Migration

- Jede neue `public`-Tabelle bekommt `enable row level security` **und** eine
  Tenant-Policy.
- Sensible Tabellen (Finanzen, Rollen/Permissions, Secrets, Türcodes/Dossier)
  zusätzlich `revoke insert,update,delete[,select] … from anon, authenticated`
  plus restriktive Rollen-Policy `as restrictive for all` — sonst ist der
  PostgREST-Direktpfad offen (CLAUDE.md, Wurzel 6). Gegenprobe:
  `bash scripts/security/direktpfad-pruefen.sh`.
- Soll eine neue Tabelle per Realtime abonniert werden, braucht sie `select`
  für `authenticated` **und** Mitgliedschaft in der Publikation
  `supabase_realtime` — sonst ist das Abo eine stumme Attrappe. Gegenprobe:
  `bash scripts/realtime/abos-pruefen.sh`.
- `SECURITY DEFINER`-Funktionen immer mit `set search_path = ''`,
  schema-qualifiziert, und `revoke execute … from anon, authenticated`.
