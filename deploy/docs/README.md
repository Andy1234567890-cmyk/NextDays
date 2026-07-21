# API-Referenz (docs.mynextdays.com)

Öffentliche REST-API-Referenz der myNextDays-Plattform — eine **eigenständige,
statische Site** (nginx), als **eigenes Coolify-Projekt** betrieben, komplett
entkoppelt vom App-/DB-Stack (kein Backend, keine Secrets, keine DB).

Referenz-Vorbild: Lodgifys `docs.lodgify.com` (dreispaltig: Nav · Endpunkt ·
Code-Beispiel), umgesetzt im myNextDays-Branding (Akzent `#b82028`).

## Aufbau

```
deploy/docs/
  Dockerfile          nginx:alpine, serviert site/ auf Port 8080
  nginx.conf          statische Auslieferung + /healthz
  docker-compose.yml  eigenständige Coolify-App (nur coolify-Netz)
  site/
    index.html        Shell (Topbar · Layout · Footer)
    styles.css        dunkles Theme, Method-Badges, 3-Spalten-Layout
    app.js            Renderer: Nav · Content · Beispiel-Panel aus SPEC
    spec.js           die Endpunkt-Spezifikation (window.SPEC) — Datenquelle
```

Die Doku ist **datengetrieben**: `site/spec.js` beschreibt Gruppen + Endpunkte
(Methode, Pfad, Beschreibung, Query-/Body-/Response-Felder, enum-Werte). `app.js`
rendert daraus die komplette Referenz. Neue Endpunkte → in `spec.js` ergänzen.

## Coolify (neues Projekt)

1. Neues Projekt/Resource, Repository = dieses Monorepo, **Base Directory = /**.
2. Build Pack = **Dockerfile**, Location = `deploy/docs/Dockerfile`.
3. Domain (`docker_compose_domains`) = `https://docs.mynextdays.com:8080`.
4. `watch_paths` (ZEILEN-getrennt): `deploy/docs/**`.
5. DNS: `docs.mynextdays.com` → Server-IP (A-Record).

Ein Deploy dieser App startet nur den nginx-Container neu — kein DB-Risiko.
