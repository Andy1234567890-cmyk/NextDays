# ADR-0030: Wiederkehrende Takte laufen im Worker, nie im FastAPI-Lifespan

- Status: **ANGENOMMEN** (2026-09-09)
- Anlass: Fehlermeldung des Betreibers vom 09.09.2026 — *„hier kommen immer
  alte benachrichtungen in den notfcaichon und die e-mails gehen auch doppelt
  raus."*
- Migration: 0617 (atomares Claim `sendet` in der KI-Warteschlange, Dedup
  unabhängig vom Lesestand)
- Berührt: `apps/api/src/main.py`, `apps/api/src/worker.py`,
  `apps/api/src/features/inbox/ki_takt.py` (stillgelegt),
  `deploy/worker/docker-compose.yml`

## Frage

Der Versand der KI-Autoantworten braucht einen Takt: `autoantwort_planen` legt
eine Zeile mit `send_at` in die Warteschlange, `dispatch_ki_autoantworten` holt
die fälligen ab. Zwischen beidem muss jemand ticken — sonst wird geplant und
nie gesendet, und der Betrieb sieht nur, dass „die KI nicht funktioniert".

Dieser Takt lag bei seiner Anlage (0494) im **FastAPI-Lifespan**
(`inbox/ki_takt.py`, gestartet aus `main.py`). Welcher Prozess soll ihn
ausführen?

## Entscheidung

**Wiederkehrende Takte gehören in den Worker (`src/worker.py`), nicht in den
FastAPI-Lifespan.** Der KI-Takt liegt seit dem 09.09.2026 dort
(`_ki_autoantwort_tick`, `KI_AUTOANTWORT_TICK_SECONDS`), neben den Takten, die
schon immer dort lagen (Automails, Automail-Neuplanung, Aufgaben, Personal,
Tagesjobs).

| | API (`apps/api`, uvicorn) | Worker (`src.worker`) |
|---|---|---|
| Prozesse | **vier** (`UVICORN_WORKERS=4`) | **einer** (`replicas: 1`) |
| Lifespan/Loop läuft | je Worker-Prozess, also 4× | genau einmal |
| Zuständig für | Requests | Takte, Queue-Jobs |

## Begründung

**Der Lifespan läuft JE UVICORN-WORKER — das ist der ganze Fehler.** Ein
Lifespan-Hook sieht wie „einmal beim Start der Anwendung" aus; er ist aber
„einmal pro Prozess". Bei `UVICORN_WORKERS=4` (in Coolify bestätigt) waren das
vier unabhängige Loops im Minutentakt auf **derselben** Warteschlange.

Live gemessen am 09.09.2026, beides im Produktions-Container:

- vier uvicorn-Kindprozesse (PIDs 9, 10, 11, 12) unter dem Master (PID 7);
- vier `ki_takt_gestartet`-Zeilen im api-Log **in derselben Sekunde**
  (`2026-09-09T10:36:17`).

Der Überlappungs-Guard im Takt-Modul (`if _task and not _task.done()`) konnte
das nicht abfangen: er ist ein **Modul-Global** und damit prozesslokal — er
sieht die drei anderen Prozesse nicht. Ein Guard, der nur den eigenen Prozess
kennt, schützt genau dann nicht, wenn es darauf ankommt.

Zusammen mit dem damals fehlenden Claim im Versand (siehe unten) gingen
KI-Antworten mehrfach hinaus. Gemeldet wurde es nicht vom System, sondern vom
Empfänger der Mails.

**Warum der Worker die richtige Stelle ist:** Er ist ein einzelner Prozess
(`command: python -m src.worker`) und hat als einzige Aufgabe, Arbeit zu
verrichten, die niemand angefragt hat. Genau aus diesem Grund liegen die
Automails schon dort und nicht in der API. Der KI-Takt war die Ausnahme —
ohne Begründung, sichtbar nur als vierfacher Versand.

**Was NICHT der Grund war:** Es gibt keine zweite Worker-Replica. Am
09.09.2026 gegengeprüft: genau ein Worker-Container
(`worker-ly4w6vw4ffxk2987nyg5z5kt`). Die Verdopplung kam allein von der
API-Seite.

## Absicherung, falls der Worker doch mehrfach läuft

Die Entscheidung stützt sich auf „ein Prozess" — aber sie **hängt nicht daran**.
Eine Annahme, deren Bruch still Geld bewegt, braucht einen zweiten Boden
(Wurzel 2: real kommt alles doppelt).

1. **Atomares Claim vor dem Seiteneffekt** (Migration 0617). Der Versand setzt
   die Zeile per bedingtem Update auf `sendet` und sendet **nur**, wenn dieses
   Update sie getroffen hat. Vorher wurde `wartend` ausgewählt, gesendet, und
   der Status erst danach gesetzt — zwischen Auswahl und Statuswechsel liegt
   ein voller Roundtrip zum Portal (hunderte Millisekunden bis Sekunden), und
   jeder Takt, der die Zeile in diesem Fenster sieht, sendet sie erneut. Die
   beiden Zwillinge derselben Familie (`dispatch_due_automations`,
   `dispatch_due_scheduled`) hatten dieses Claim seit je; der KI-Pfad bekam es
   bei seiner Anlage (0494) nie.
2. **Verwaiste Claims werden abgeräumt.** Ein Abbruch zwischen Claim und
   Abschluss (Deploy, OOM, Kill) blockierte die Zeile sonst für immer:
   `sendet` wählt kein Pfad mehr aus, und der partielle Unique-Index auf
   `wartend` lässt keine Neuplanung zu.
3. **`replicas: 1` steht geschrieben** (`deploy/worker/docker-compose.yml`),
   samt der ehrlichen Grenze: Coolify führt den Stack als Compose-Anwendung und
   setzt die Stückzahl in seiner eigenen Oberfläche — der Eintrag ist die
   prüfbare Absicht im Repo, keine technische Sperre. Bis dahin war „der Worker
   ist ein einzelner Prozess" der Compose-Default, also eine Beobachtung ohne
   Zusage.
4. **Der doppelte Takt ist jetzt sichtbar.** Der Worker-Tick loggt
   `uebersprungen` mit — die Zahl der Zeilen, die ein anderer Takt schon
   geclaimt hatte. Sie ist im Normalbetrieb 0; steigt sie, laufen mehrere
   Takte, und das steht im Log, statt sich als Doppelmail beim Gast zu zeigen.

## Was in der API bleiben darf — und warum

`inbox_scheduler` bleibt im Lifespan. Der Unterschied ist nicht „wichtig oder
unwichtig", sondern die Quelle der Arbeit: Dieser Scheduler timert
ausschließlich, was im **eigenen** Prozess über `schedule()` aus dem
Request-Pfad hereinkam — vier Prozesse timern also vier disjunkte Mengen, keine
gemeinsame Warteschlange. Zusätzlich claimt `dispatch_due_scheduled` atomar.

**Die Prüffrage für jeden neuen Takt:** *Arbeitet er auf Zustand, den ALLE
Prozesse sehen?* Wenn ja, gehört er in den Worker. Ein Poll auf eine Tabelle
ist immer ein Ja.

**Der interne Cron-Endpunkt bleibt.** Er ist der Weg für einen externen Cron
und das Sicherheitsnetz, falls der Worker-Tick ausfällt. Vor dem Claim war er
ein zusätzlicher Mitspieler im Rennen; jetzt ist er ein zweiter Anstoß derselben
idempotenten Operation.

## Folgen

- `apps/api/src/features/inbox/ki_takt.py` hat **keinen Aufrufer mehr**. Die
  Datei bleibt stehen (Dokumentation des Fehlers, zwei Kommentare verweisen auf
  sie als Beleg); ihr Docstring warnt ausdrücklich davor, `start()` wieder
  anzuwerfen — das stellte den behobenen Fehler wieder her.
- `main.py` trägt an der Stelle, wo der Takt stand, die Begründung samt der
  gemessenen Zahlen. Ein Leser, der ihn dort vermisst, findet den Grund, statt
  ihn „wieder einzubauen".
- Diese Entscheidung ist der Grund, aus dem die Zahl `4` überhaupt zählt: sie
  ist eine Betriebseinstellung (Coolify), keine Code-Konstante. Wer sie auf 1
  senkt, macht den Fehler unsichtbar, ohne ihn zu beheben — deshalb liegt die
  Lösung beim Prozess, nicht bei der Zahl.
