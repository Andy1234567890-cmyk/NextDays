# Mailserver-Host in Coolify aufnehmen (für Deploy von Zusatz-Apps)

Ziel: den Mailserver-Host `62.238.4.193` als **zweiten Server** in Coolify
registrieren, damit eigene Zusatz-Apps (z.B. ein Webmail-UI) per GitHub-Push
**automatisch dorthin** deployen — **Mailcow selbst bleibt dabei unangetastet.**

## ✅ ERLEDIGT (2026-07-06, per Coolify-API)
Der Server ist bereits registriert und validiert:
- **Server-Name:** `nextdays-mail` · **UUID:** `hjfcdz4m826dov9jmx2dsjfe`
- **IP:** `62.238.4.193` · **User:** `root` · **SSH-Key:** Coolifys `localhost's key`
  (Public-Key liegt in `/root/.ssh/authorized_keys` des Mailservers, zusätzlich zu
  Andys Key).
- **Status:** `is_reachable=t`, `is_usable=t` (verifiziert in `server_settings`).
- **Proxy: `NONE`** — bewusst KEIN Coolify-Traefik auf diesem Host, weil Mailcow-nginx
  bereits Port 80/443 belegt. So kein Port-Konflikt; Mailcow behält die Ports.

> Damit ist Schritt 1–5 unten schon durchgeführt. Für ein Webmail-UI genügt jetzt
> „Nach dem Hinzufügen" weiter unten. Die Anleitung bleibt als Referenz / für einen
> Neuaufbau.

---
## Referenz: manuell in der Coolify-UI (falls neu aufzusetzen)

> **Mailcow wird NICHT von Coolify verwaltet.** Coolify installiert nur seinen
> SSH-Agent auf dem Host und deployt Apps **daneben** in ein eigenes Docker-Netz.
> Der Mailcow-Stack (`mailcowdockerized_mailcow-network`) läuft weiter eigenständig
> per `docker compose` unter `/opt/mailcow-dockerized`.

## Voraussetzungen (auf dem Host bereits erfüllt ✓)
- Docker 29.6.1 · SSH (Port 22, in UFW offen) · curl · 134 GB frei · 7,6 GB RAM
- SSH: nur Key-Login (`PermitRootLogin prohibit-password`) — Coolify verbindet per Key.

## Schritte (in der Coolify-UI — nur Andy)
1. Coolify → **Servers → + Add Server**.
2. **Name:** `nextdays-mail` · **IP:** `62.238.4.193` · **User:** `root` · **Port:** `22`.
3. **SSH-Key:** Coolify zeigt einen öffentlichen Schlüssel (oder du wählst einen
   bestehenden Coolify-Private-Key). Diesen **Public-Key** auf dem Host in
   `/root/.ssh/authorized_keys` eintragen (Coolify bietet dafür oft einen
   Copy-Button + Anleitung).
4. **Validate/Install** klicken — Coolify prüft die Verbindung und installiert
   seinen Agent. **Mailcow-Container bleiben unberührt** (Coolify fasst fremde
   Stacks nicht an).
5. Danach ist `nextdays-mail` als Ziel-Server für neue Applications wählbar.

## Nach dem Hinzufügen: Zusatz-App (z.B. Webmail-UI) deployen
1. In Coolify eine **neue Application** anlegen, Ziel-Server `nextdays-mail`,
   Repo = dieses Monorepo, Build-Pfad z.B. `apps/webmail/` (falls gebaut).
2. Die **App-UUID** aus Coolify kopieren.
3. In [`.github/workflows/deploy.yml`](../../.github/workflows/deploy.yml) einen
   Eintrag ergänzen (gleiche Mechanik wie web/plattform):
   ```
   "<UUID>|nextdays-webmail|apps/webmail/"
   ```
   → ab dann deployt jeder Push, der `apps/webmail/**` ändert, automatisch auf den
   Mailserver-Host.

## Wichtig / Sicherheit
- **Mailcow-Ports nicht doppelt belegen:** eine Coolify-App auf diesem Host darf
  NICHT 25/80/443/465/587/143/993 beanspruchen (die gehören Mailcow). Coolify-Apps
  bekommen eigene Ports/Traefik — beim Anlegen darauf achten.
- Der Host ist gehärtet ([SECURITY.md](SECURITY.md)); UFW muss die Ports der neuen
  App zusätzlich erlauben (`ufw allow <port>/tcp`), sonst ist sie nicht erreichbar.
- Coolify-Agent + Mailcow teilen sich CPU/RAM — bei größerem Webmail-Traffic
  Ressourcen im Blick behalten (aktuell 7,6 GB, Mailcow nutzt ~3 GB).
