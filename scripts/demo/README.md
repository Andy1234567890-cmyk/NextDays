# Demo-Bestand für Marketing-Aufnahmen

Erzeugt zwei vollständige Demo-Betriebe in der Server-Datenbank, damit die App
für Screenshots wie ein laufender Betrieb aussieht — belegte Kalender, Buchungen
aus allen Vertriebskanälen, echte Objektfotos, Aufgaben und Sperrungen.

| Betrieb | Login | Bestand |
|---|---|---|
| Nordlicht Ferienvermietung | `merle.ahrens@mynextdays.com` | 8 Ferienobjekte (Ostsee, Alpen, Mallorca, Wien …) |
| Hotel Seeblick Warnemünde | `jonas.reimers@mynextdays.com` | 12 Zimmer, jedes eine eigene buchbare Einheit |

Das Passwort wird beim Lauf gesetzt (`--passwort`) und am Ende ausgegeben. Es
steht bewusst in keiner Repo-Datei.

## Ablauf

```bash
# 1) Objektfotos einmalig holen (Cache in scripts/demo/fotos/, ~100 Bilder)
apps/api/.venv/bin/python scripts/demo/fotos.py

# 2) Bestand aufbauen (löscht die Demo-Tenants vorher vollständig)
apps/api/.venv/bin/python scripts/demo/seed_demo.py --passwort 'DeinPasswort'

# 3) Screenshots aufnehmen (FastAPI :8000 und Dashboard :3000 müssen laufen)
cd web && node scripts/marketing-aufnahmen.mjs --passwort 'DeinPasswort'
```

Zugangsdaten liest der Seed aus `apps/api/.env` (`SUPABASE_URL`,
`SUPABASE_SERVICE_ROLE_KEY`) oder aus der Umgebung.

## Was das Skript garantiert

* **Wiederholbar.** Alle IDs entstehen deterministisch aus dem Namen (`uuid5`),
  der Zufallsgenerator hat einen festen Keim. Zweimal laufen lassen ergibt
  denselben Bestand — ein Screenshot bleibt also nachstellbar.
* **Kein Ausbruch aus der Demo.** Angefasst werden ausschließlich die beiden
  Demo-Tenants; `--nur-loeschen` entfernt sie restlos (Zeilen, Logins, Bilder).
* **Kein Portal-Push.** Buchungen entstehen über
  `create_reservation_atomic(..., p_with_outbox := false)`. Die Kalendernächte
  werden in derselben Transaktion belegt, aber es entsteht **kein**
  `ari_outbox`-Eintrag — aus Demo-Daten geht nie etwas an Channex oder eine OTA.
  Ebenso wird bewusst **keine** `channex_group_map`-Zeile angelegt: der
  Reconcile-Cron läuft nur über Tenants, die dort stehen.
* **Eine Währung je Betrieb.** Der Belegungsplan zeigt Umsatz und ADR als „—",
  sobald im sichtbaren Fenster mehrere Währungen liegen (inkommensurable Beträge
  werden nie addiert). Ein Mehrwährungs-Beweis gehört auf einen eigenen
  Screenshot, nicht in diesen.

## Fotos

`fotos_kuratiert.json` hält je Objekt eine von Hand geprüfte Liste von
Pexels-Foto-IDs. Die Pexels-Lizenz erlaubt kommerzielle Nutzung ohne
Namensnennung; `fotos/manifest.json` hält die Herkunft jedes Bildes trotzdem
nachprüfbar fest. Ein Bild austauschen heißt: ID in `fotos_kuratiert.json`
ersetzen, `fotos.py --objekt <schlüssel>` laufen lassen, neu seeden.

Fehlt ein Objekt in der kuratierten Liste, greift Openverse (CC0) als Notnagel —
brauchbar für die Vollständigkeit, nicht für die Bildwirkung.

## Dateien

| Datei | Zweck |
|---|---|
| `katalog.py` | Betriebe, Objekte, Preise, Ausstattung, Gästenamen |
| `fotos_kuratiert.json` | geprüfte Pexels-IDs je Objekt |
| `fotos.py` | lädt und skaliert die Bilder, schreibt das Manifest |
| `konfig.py` | Zugriff auf PostgREST, Storage und die GoTrue-Admin-API |
| `seed_demo.py` | baut den Bestand auf |
