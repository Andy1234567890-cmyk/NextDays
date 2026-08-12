"""Background-Job-Worker (Skalierung 100 Betriebe, Migration 0102).

Ein eigener Prozess (`python -m src.worker`), der die generische `jobs`-Queue
abarbeitet: Channex-Content-Sync, ARI-Push, Reconcile, Recompute laufen hier
statt synchron im FastAPI-Request-Pfad. Damit blockiert kein Nutzer-Request mehr
auf einem langsamen Channex-Call, und die Sync-Last verteilt sich über einen
Concurrency-Pool statt seriell (Baseline: 800 Objekte seriell = ~40 min).

Substrat = Postgres (`jobs`), Reentrancy via `claim_jobs` (FOR UPDATE SKIP
LOCKED) → mehrere Worker-Instanzen sind race-frei. Zustand liegt in der DB →
ein Neustart/Crash verliert nichts; laufende Jobs recovert der Reaper.

Muster wie inbox/scheduler.py: async-Loop, synchrone DB-/Channex-Arbeit via
asyncio.to_thread, Fehler dürfen den Worker nie killen.
"""
from __future__ import annotations

import asyncio
import contextlib
import os
import signal
import socket
import time
from collections.abc import Callable
from datetime import UTC, date, datetime, timedelta
from typing import Any

from postgrest.exceptions import APIError
from supabase import Client

from src.core.config import get_settings
from src.core.logging import configure_logging, get_logger
from src.core.supabase import get_service_client
from src.features.properties.vertragsende import vertragsenden_nachziehen
from src.jobs import feed_nachpflege, worker_verlauf
from src.jobs.channex_budget import BudgetDecision, ChannexBudget
from src.jobs.queue import enqueue, next_run_after, try_enqueue_content_sync

log = get_logger("nextdays.worker")

# Job-Typen, die tatsächlich an Channex pushen. Sie bekommen das kontoweite
# Channex-Budget NICHT mehr als einmaliges Vorab-Gate, sondern PRO ECHTEM
# HTTP-CALL: der ChannexClient zieht über ein before_call-Callback vor jedem
# Request ein Token (siehe channex_client._request). Grund: Batch-Jobs
# (reconcile_tenant über hunderte Objekte, process_ari_outbox mit bis zu 200
# Zeilen) machen je Job SEHR VIELE Calls — ein einmaliges Vorab-Gate für 1
# Token hätte das Konto-Limit umgangen. Ein per-Call abgelehnter Job wirft
# ChannexBudgetExhausted → der Worker verzögert (deferred) ihn, ohne einen
# Retry-Versuch zu verbrennen.
_CHANNEX_JOB_TYPES = frozenset(
    {"sync_property_content", "sync_property_taxes",
     # Rücklese-Prüfung der Gebühren (GET pricing_settings je Mapping) — ein
     # echter Channex-Call, zählt also gegen das kontoweite Budget.
     "pruefe_ota_gebuehren",
     # Airbnb-Rabattregeln je Listing (GET+PUT pricing_settings pro Mapping).
     "sync_airbnb_aktionen",
     # Ausstattung an Airbnbs eigene API. Der Schreibaufruf selbst geht NICHT an
     # Channex — der OAuth-Token dafür aber schon (`get_channel`), also zählt der
     # Job mit, sonst umginge er das kontoweite Limit.
     "sync_airbnb_ausstattung",
     # Verfügbarkeitsregeln je Listing (GET+PUT availability_settings pro
     # Mapping) — echte Channex-Calls, zählen also mit.
     "sync_airbnb_verfuegbarkeit",
     # Fläche und Kapazität an Airbnbs eigene API — wie die Ausstattung: der
     # Schreibaufruf geht direkt, der OAuth-Token kommt aber von Channex.
     "sync_airbnb_stammdaten",
     # Zimmer an Airbnb (Gegenrichtung zum Import). Läuft über Channex'
     # api_proxy, ist also ein echter Channex-Call und zählt mit.
     "sync_airbnb_zimmer",
     "reconcile_tenant", "push_ari", "process_ari_outbox",
     "process_restriction_outbox",
     # recompute_property pusht die meisten Rate-Calls (Tagespreise über den
     # 365-Tage-Horizont) — MUSS das kontoweite Channex-Token-Budget ziehen.
     "recompute_property",
     # Buchungs-Feed-Pull (Webhook-Trigger + Backstop-Tick), ARI-Import je
     # Property (ari-Webhook) und nächtlicher Full-Sync-Push — alle rufen Channex.
     "sync_bookings_feed", "import_ari_property", "full_sync_property",
     # On-demand Rate-Plan-Preis-Reconcile ('Jetzt übertragen') — liest Channex.
     "reconcile_rate_plan_prices"}
)

# Parallel verarbeitete Jobs je Worker-Instanz. Begrenzt lokale Thread-/DB-Last;
# die eigentliche Channex-Grenze ist das Redis-Token-Budget (Folge-Baustein).
CONCURRENCY = int(os.getenv("WORKER_CONCURRENCY", "4"))
# Poll-Intervall, wenn zuletzt kein Job kam (idle). Bei Treffern sofort weiter.
IDLE_SLEEP_SECONDS = 1.0
# Ein 'running'-Job, dessen Worker abgestürzt ist, wird nach dieser Zeit requeued.
STUCK_AFTER_SECONDS = 300
# locked_at-Refresh je laufendem Job: Langläufer (reconcile_tenant über hunderte
# Objekte, process_ari_outbox mit 200 Zeilen) überschreiten STUCK_AFTER_SECONDS
# regelmäßig. Ohne Heartbeat requeued der Reaper einen NOCH LAUFENDEN Job →
# Doppelausführung/Doppel-Push an Channex. Mit Heartbeat trifft der Reaper nur
# noch tote Worker (5 verpasste Heartbeats).
JOB_HEARTBEAT_SECONDS = 60
# Zeit-Tick: Reconcile aller Tenants einreihen. EINMAL TÄGLICH — der Reconcile
# spiegelt nur Existenz/Content der Channex-Properties und pusht Preis-Differenzen;
# er ist kein Live-Pfad. Vorher lief er alle 15 min und erzeugte zusammen mit dem
# (entfernten) ARI-Rücklesen dauerhaft Channex-Requests, was Channex ausdrücklich
# beanstandet hat. Laufende Änderungen gehen als Push raus, Buchungen kommen per
# Webhook + Feed-Backstop (BOOKINGS_TICK_SECONDS).
RECONCILE_TICK_SECONDS = 24 * 60 * 60
# Zeit-Tick: offene AUSGEHENDE Pushes (ari_outbox / restriction_outbox) nachziehen.
# Getrennt vom Reconcile-Tick, weil ein gescheiterter Push schnell heilen muss.
# Erzeugt nur dann Channex-Requests, wenn offene Zeilen existieren.
OUTBOX_TICK_SECONDS = 5 * 60
# Zeit-Tick: externe iCal-Kalender syncen (alle 2 Stunden).
# Feeds, deren letzter Sync älter ist, werden nachgezogen.
ICAL_TICK_SECONDS = 30 * 60          # alle 30 min prüfen, ...
ICAL_STALE_SECONDS = 2 * 60 * 60     # ... aber nur Feeds syncen, die > 2h alt sind
ICAL_BATCH = 25                      # pro Tick höchstens so viele Feeds (Fairness)
# Zeit-Tick: Buchungs-Feed-Backstop. Der PRIMÄRE Trigger ist der Channex-Webhook
# (booking_* → sync_bookings_feed-Job); dieser Tick fängt verlorene Webhooks ab
# (Channex wiederholt max. ~24h, danach wäre die Buchung ohne Backstop weg).
BOOKINGS_TICK_SECONDS = 5 * 60
# Zeit-Tick: Ereignis-Journal (Airbnbs `live_feed`). Der Buchungs-Feed oben ist
# eine Arbeitswarteschlange und kennt NUR Buchungen — für alles andere
# (Sync-Fehler, Airbnb-Systemmeldungen und vor allem die handlungspflichtigen
# Anfragen) war der Webhook bisher der EINZIGE Weg. Ging er verloren, war das
# Ereignis weg. Das Journal ist der Nachhol-Weg; 5 Minuten, weil Airbnb eine
# unbeantwortete Anfrage nach etwa 24 Stunden selbst ablehnt und der Betrieb
# davon möglichst früh erfahren muss.
LIVE_FEED_TICK_SECONDS = 5 * 60
# Deploy-Spiegel: fuellt public.deploy_spiegel, damit das Backoffice den
# Deploy-Zustand per Realtime abonnieren kann statt zu pollen. Eng getaktet,
# solange etwas baut (Sekunden zaehlen), sonst ruhig.
DEPLOY_TICK_AKTIV_SECONDS = 5
DEPLOY_TICK_RUHE_SECONDS = 60
# Restzahlungen (Split-Payment): stündlich die fälligen 'balance'-Zeilen
# off-session belasten. Stündlich reicht (Fälligkeit ist tagesgenau), hält aber
# die Stripe-Last niedrig.
BALANCE_TICK_SECONDS = 60 * 60
# Auszahlungslauf: stündlich reicht. Die Fälligkeit ist tages-, nicht
# minutengenau (Booking zahlt donnerstags bzw. zum 15.) — häufiger zu prüfen
# brächte nichts außer Last.
PAYOUT_TICK_SECONDS = 60 * 60
# Provisions-Abrechnung: am 1. jedes Monats werden die offenen OTA-Provisionen
# des VORMONATS als Invoice-Item auf das Abo gebucht (Preisliste §2 — der Kunde
# sieht das Datum im Provisions-Monatsverlauf). Stündlich prüfen genügt: die
# Fälligkeit ist tagesgenau. Der Lauf ist idempotent (deterministischer Stripe-
# idempotency_key je tenant+period) — mehrfaches Prüfen am selben Tag erzeugt
# KEINE zweite Belastung.
COMMISSION_TICK_SECONDS = 60 * 60
COMMISSION_BILLING_DAY = 1  # Monatserster
# Bewertungen: Fristablauf veröffentlichen (double-blind), Portal-Bewertungen
# spiegeln (Backstop für verlorene review-Webhooks) und die Automatik ausführen.
# Stündlich reicht — alle drei Fälligkeiten sind tagesgenau; der PRIMÄRE Weg für
# neue Portal-Bewertungen ist der Webhook.
REVIEWS_TICK_SECONDS = 60 * 60
# Wiederkehrende Aufgaben (0272) in den 60-Tage-Horizont ausrollen. Stündlich
# reicht: die Termine sind tagesgenau und der Lauf ist idempotent (UNIQUE-Index
# auf (rule_id, occurrence_on)), ein zweiter Durchlauf legt nichts doppelt an.
TASKS_TICK_SECONDS = 60 * 60
# Fällige Automails versenden (Buchungsbestätigung, Anreise-Info, Check-out …).
# JEDE MINUTE, nicht stündlich: seit 0303 lässt sich der Versatz in Minuten
# angeben („30 Minuten nach Buchung"), und ein Stundenraster machte daraus je
# nach Zufall bis zu 59 Minuten Verspätung. Der Lauf ist billig — er fragt eine
# indizierte Spalte ab und findet meistens nichts — und idempotent: `dispatch`
# markiert jede Zeile beim Senden, ein zweiter Durchlauf schickt nichts doppelt.
#
# Vorher hing der Versand an einem Cron, den es auf dem Server nie gab (live
# geprüft 07.08.2026: crontab leer, keine systemd-Timer, 8 überfällige Automails
# lagen seit dem 25.07. unversendet). Der Worker ist der Ausführende, damit ein
# geplanter Versand nicht von einem Eintrag abhängt, den niemand angelegt hat.
AUTOMAILS_TICK_SECONDS = 60
# Neuplanung der Automails (0307). Der Versand-Tick oben kennt nur fertig
# geplante Zeilen; geplant wurde bislang ausschließlich beim Import einer
# Buchung. Damit erreichte eine NEUE Regel keine bestehende Buchung und eine
# GEÄNDERTE Regel ließ die alten Zeitpunkte stehen (live beides vorgefunden).
# Stündlich reicht: die Regeln ändern sich selten, und die Planung selbst greift
# beim Anlegen/Ändern einer Regel sofort — dieser Tick fängt die Fälle ab, in
# denen sich die BUCHUNG ändert (Umbuchung, Stornierung).
AUTOMAIL_PLANUNG_TICK_SECONDS = 60 * 60
# Content-Sync-Heilung: Objekte, deren letzter Content-Push fehlgeschlagen ist
# (channex_property_map.last_sync_status='error'), erneut einreihen. Ohne diesen
# Tick bleibt eine lokale Änderung — Steuern, Beschreibung, Ausstattung — nach
# dem endgültigen Sterben des Jobs (10 Versuche, ~5 h) für IMMER unübertragen:
# der Tenant-Reconcile spiegelt nur Channex→DB, der nächtliche Full-Sync ist
# reines ARI. Stündlich reicht (ein Push-Fehler ist selten und selten dringend),
# und weil der Job je Objekt coalesced, kostet ein Dauerfehler nichts extra.
CONTENT_HEAL_TICK_SECONDS = 60 * 60
# Wie viele fehlerhafte Objekte je Durchlauf höchstens nachgezogen werden —
# begrenzt, damit ein flächiger Channex-Ausfall nicht das ganze Token-Budget
# in einem Tick verbrennt (der nächste Durchlauf nimmt den Rest).
CONTENT_HEAL_BATCH = 50
# Vertragsende-Sperre nachziehen (0355). `vertragsende_durchsetzen` schreibt
# die Sperrnächte für einen Horizont AB HEUTE — dieser Tick schiebt ihn Tag für
# Tag weiter. Ohne ihn wäre die Sperre eines heute gesetzten Enddatums nach
# zwei Jahren erschöpft: die Tage dahinter hätten keine `availability`-Zeile
# und gingen damit als OFFEN an die Portale, obwohl der Vertrag längst endete.
# Täglich genügt exakt — der Horizont wandert um einen Tag pro Tag, und die
# Reserve zwischen Sperrhorizont (730) und Full-Sync-Horizont (365) deckt auch
# einen mehrtägigen Ausfall des Workers ab.
VERTRAGSENDE_TICK_SECONDS = 24 * 60 * 60
# Höchstens so viele Objekte je Durchlauf — dieselbe Begrenzung wie beim
# Content-Heal. Ein Betrieb mit hunderten gekündigten Objekten verteilt sich
# damit über mehrere Läufe, statt einen Tick minutenlang zu blockieren.
VERTRAGSENDE_BATCH = 50
# Nächtlicher Full-Sync-Push (Channex-Doku: "daily full update each night per
# property"): im UTC-Stundenfenster [FULL_SYNC_HOUR_UTC, +1) je aktiver Property
# EIN full_sync_property-Job pro Tag (dedup je Property+Tag), gestaffelt.
FULL_SYNC_HOUR_UTC = 2
FULL_SYNC_STAGGER_SECONDS = 5
# Max. aufeinanderfolgende Budget-Verzögerungen (defer_count), bevor ein Job
# aufgibt ('dead'). Deckel gegen Endlos-Defer-Livelock bei dauerhaft totem Redis.
# Großzügig, damit legitimes Warten auf ein volles Budget-Fenster nie greift.
_MAX_DEFERS = 100
# Wartezeit für einen Job-Typ, den DIESER Worker nicht kennt. Bemessen an einem
# Deploy: eine Minute reicht, bis der neue Worker läuft — und mit `_MAX_DEFERS`
# übersteht ein Job so über eine Stunde Versatz zwischen API und Worker.
_UNKNOWN_TYPE_RETRY = 60
# Heartbeat-Datei für den Docker-Healthcheck: der Run-Loop schreibt sie je
# Durchlauf neu (idle ≤ 1 s, unter Last je Claim-Zyklus). Der Healthcheck im
# Worker-Compose meldet unhealthy, wenn sie älter als 120 s ist — so wird ein
# HÄNGENDER Event-Loop sichtbar, nicht nur ein toter Prozess (den fängt schon
# restart: unless-stopped, weil der Worker PID 1 ist).
HEARTBEAT_PATH = os.getenv(
    "WORKER_HEARTBEAT_PATH",
    # noqa: S108 — Container-privates /tmp (1 Prozess); per Env übersteuerbar.
    "/tmp/worker-heartbeat",  # noqa: S108
)


# --- Job-Handler ------------------------------------------------------------
# Jeder Handler bekommt (db, payload) und delegiert an bestehende, tenant-
# gescopte Service-Methoden — keine neue Logik, nur Enqueue-Adapter. Ein Handler
# wirft bei retry-würdigem Fehler; No-op/erledigt → sauber zurückkehren.

def _svc(db: Client, budget: ChannexBudget | None = None):  # noqa: ANN202
    """ChannelManagerService bauen. Ist ein `budget` gegeben, bekommt der
    ChannexClient dessen try_consume als before_call-Callback → jeder echte
    HTTP-Call zieht ein Token (per-Call-Gate für Batch-Jobs). Ohne budget läuft
    der Client unverändert (Nicht-Channex-Handler brauchen kein Gate)."""
    from src.features.channel_manager.channex_client import ChannexClient
    from src.features.channel_manager.service import ChannelManagerService

    before_call = budget.try_consume if budget is not None else None
    return ChannelManagerService(
        service_client=db, channex=ChannexClient(before_call=before_call)
    )


def _handle_sync_property_content(
    db: Client, payload: dict[str, Any], budget: ChannexBudget | None = None
) -> None:
    svc = _svc(db, budget)
    # Im Worker DIREKT sync_content (nicht sync_property_to_channex): letzteres
    # schluckt ChannexError/ChannelManagerError bewusst (best-effort bei der
    # Objekt-Anlage, damit die Anlage nie scheitert). Im Job wollen wir das
    # Gegenteil — ein Sync-Fehler MUSS den Job auf error/Retry kippen und darf
    # nicht still als „done" durchgehen (Wurzel 5). Guard wie im best-effort-Pfad.
    if not svc.is_channex_configured:
        return
    # Titel wird NIE übergeben — sync_content lädt ihn aus der DB (Wurzel 1/4).
    # Ein Literal hier hätte den Namen an Channex geleakt, und der Reconcile
    # schriebe ihn zurück in die DB → der Objektname verschwände bei jedem
    # Rate-„Zurücknehmen". None-Währung → echte Objektwährung aus dem Rate-Plan.
    svc.sync_content(
        payload["tenant_id"],
        property_id=payload["property_id"],
        currency=payload.get("currency") or None,
    )


def _handle_sync_property_taxes(
    db: Client, payload: dict[str, Any], budget: ChannexBudget | None = None
) -> None:
    """Nur die Steuern eines Objekts spiegeln (2 Calls statt ~6). Wird gestellt,
    wenn sich ausschließlich die Steuern geändert haben; ein Fehler kippt den
    Job wie beim vollen Sync auf Retry (Wurzel 5)."""
    svc = _svc(db, budget)
    if not svc.is_channex_configured:
        return
    svc.sync_taxes_only(payload["tenant_id"], payload["property_id"])


def _handle_pruefe_ota_gebuehren(
    db: Client, payload: dict[str, Any], budget: ChannexBudget | None = None
) -> None:
    """Nachsehen, welchen Betrag die Gebühren beim Portal WIRKLICH tragen.

    Liest bei Airbnb (`pricing_settings`) und schreibt nur unseren eigenen
    Stand. Ein Fehler kippt den Job auf Retry: lieber später eine echte
    Prüfung als jetzt ein stiller „done"-Vermerk ohne Ergebnis (Wurzel 5)."""
    svc = _svc(db, budget)
    if not svc.is_channex_configured:
        return
    svc.gebuehren_stand_pruefen(payload["tenant_id"], payload["property_id"])


def _handle_sync_airbnb_aktionen(
    db: Client, payload: dict[str, Any], budget: ChannexBudget | None = None
) -> None:
    """Aktions-Bedingungen (Mindestaufenthalt/Frühbucher/Last Minute) als
    Airbnb-Rabattregeln durchsetzen. Ohne Airbnb-Verbindung tut der Service
    nichts; ein Fehler kippt den Job auf Retry (Wurzel 5)."""
    svc = _svc(db, budget)
    if not svc.is_channex_configured:
        return
    svc.sync_airbnb_aktionen(payload["tenant_id"], payload["property_id"])


def _handle_sync_airbnb_verfuegbarkeit(
    db: Client, payload: dict[str, Any], budget: ChannexBudget | None = None
) -> None:
    """Vorbereitungszeit/Buchungsfenster/Vorlaufzeit an das Airbnb-Listing.

    Channex hat für diese drei kein ARI-Restriktionsfeld; sie gehen über
    Airbnbs Listing-Settings. Der Dienst liest den Ist-Stand und schreibt nur
    bei echter Abweichung — ohne Verbindung/Mapping tut er nichts."""
    svc = _svc(db, budget)
    if not svc.is_channex_configured:
        return
    svc.airbnb_verfuegbarkeit_schreiben(
        payload["tenant_id"], payload["property_id"]
    )


def _handle_sync_airbnb_ausstattung(
    db: Client, payload: dict[str, Any], budget: ChannexBudget | None = None
) -> None:
    """Ausstattung direkt an Airbnbs API schreiben.

    Neben dem Channex-Content-Sync, nicht statt seiner: was keinen Channex-
    Facility-Eintrag hat, käme sonst bei Airbnb nie an. Ein Fehler kippt den Job
    auf Retry (Wurzel 5) — stillschweigend „erledigt" zu melden hieße, die
    Auswahl gilt bei uns und nicht bei Airbnb."""
    svc = _svc(db, budget)
    if not svc.is_channex_configured:
        return
    svc.sync_airbnb_ausstattung(payload["tenant_id"], payload["property_id"])


def _handle_sync_airbnb_stammdaten(
    db: Client, payload: dict[str, Any], budget: ChannexBudget | None = None
) -> None:
    """Fläche und Kapazität direkt an Airbnbs API schreiben.

    Gegenrichtung zum Import: wir HOLEN `property_details.listing_size` von
    Airbnb, also muss eine Korrektur bei uns auch dorthin zurück. Ein Fehler
    kippt den Job auf Retry (Wurzel 5) — „erledigt" zu melden, während bei
    Airbnb der alte Wert steht, wäre die schlechtere Lüge."""
    svc = _svc(db, budget)
    if not svc.is_channex_configured:
        return
    svc.sync_airbnb_stammdaten(payload["tenant_id"], payload["property_id"])


def _handle_sync_airbnb_zimmer(
    db: Client, payload: dict[str, Any], budget: ChannexBudget | None = None
) -> None:
    """Die Zimmer unserer Maske an die Airbnb-Anzeige geben.

    Gegenrichtung zum Import: ohne diesen Job blieb ein in unserer Maske
    gelöschter Raum bei Airbnb online und ein hinzugefügter kam nie an — live
    gemessen an „Holiday house Cornflower" (Wurzel 1, Gegenzustand)."""
    svc = _svc(db, budget)
    if not svc.is_channex_configured:
        return
    svc.sync_airbnb_zimmer(payload["tenant_id"], payload["property_id"])


def _handle_reconcile_tenant(
    db: Client, payload: dict[str, Any], budget: ChannexBudget | None = None
) -> dict[str, int]:
    return _svc(db, budget).reconcile_properties_for_tenant(payload["tenant_id"])


def _handle_process_ari_outbox(
    db: Client, _payload: dict[str, Any], budget: ChannexBudget | None = None
) -> dict[str, int]:
    """Offene ari_outbox-Zeilen (ausgehende ARI-Pushes) erneut an Channex pushen.
    Ersetzt den finalen process_ari_outbox()-Schritt des alten Host-Crons: die
    per-Tenant-reconcile_tenant-Jobs spiegeln nur Channex→DB, arbeiten die outbox
    aber NICHT ab. Tenant-übergreifend (die outbox ist nicht tenant-gefiltert),
    darum einmal je Tick als eigener Job statt pro Tenant."""
    return _svc(db, budget).process_ari_outbox()


def _handle_process_restriction_outbox(
    db: Client, _payload: dict[str, Any], budget: ChannexBudget | None = None
) -> dict[str, int]:
    """Offene ari_restriction_outbox-Zeilen (Stop-Sell/Rate/Min-Stay/Max-Stay/
    CTA-CTD) erneut an Channex pushen — der dauerhafte Backstop für Restriktions-
    Pushes (analog process_ari_outbox für Availability). Baut je Zeile die values
    aus dem persistierten kind+payload neu auf und löst das Rate-Plan-Mapping
    frisch auf (Selbstheilung, sobald der Rate-Plan-Import gelaufen ist). Tenant-
    übergreifend, darum einmal je Tick als eigener Job statt pro Tenant."""
    return _svc(db, budget).process_restriction_outbox()


def _handle_reconcile_rate_plan_prices(
    db: Client, payload: dict[str, Any], budget: ChannexBudget | None = None
) -> None:
    """On-demand Desired-State-Reconcile der Rate-Plan-Datumspreise EINES Objekts
    ('Jetzt übertragen'). Der 15-min-Tick macht dasselbe für alle Objekte; hier
    sofort auf Nutzer-Wunsch. Budget durchreichen (Channex-Read/-Push zieht Token)."""
    _svc(db, budget).reconcile_rate_plan_prices(
        payload["tenant_id"], payload["property_id"]
    )


def _handle_recompute_property(
    db: Client, payload: dict[str, Any], budget: ChannexBudget | None = None
) -> None:
    from src.features.pricing.recompute import DynamicPricingRecompute

    # Budget durchreichen → der Rate-Push aus dem Recompute zieht pro HTTP-Call ein
    # Channex-Token (kein Umgehen des kontoweiten Limits bei Churn über viele Objekte).
    DynamicPricingRecompute(
        service_client=db, channex_budget=budget
    ).recompute_property(payload["property_id"])


def _handle_push_ari(
    db: Client, payload: dict[str, Any], budget: ChannexBudget | None = None
) -> None:
    """Generischer ARI-Push (Availability/Rate/Max-Stay/Restrictions/Stop-Sell)
    für einen Zeitraum. `kind` wählt die Ziel-Methode; die übrigen Payload-Felder
    sind die Argumente. Ersetzt die früher synchron im Request-Pfad laufenden
    _push_channex_*-Aufrufe (calendar/rates) — dieselben Service-Methoden, nur
    jetzt asynchron im Worker mit Channex-Token-Budget."""
    # push_*-Methoden liegen direkt am Service (AriPushMixin).
    push = _svc(db, budget)
    kind = payload["kind"]
    tenant_id = payload["tenant_id"]
    property_id = payload["property_id"]

    def _d(key: str) -> date:
        return date.fromisoformat(payload[key])

    # Die push_*-Methoden geben True zurück, wenn der Channex-Call fehlschlug
    # (statt zu werfen — im Request-Pfad sind sie best-effort). Hier im Worker
    # heben wir das Signal zu einer Exception, damit _run_job → _retry den
    # schnellen Job-Backoff (1/5/15 min) startet, statt den Push bis zum
    # 15-min-Reconcile-Tick liegen zu lassen (oder ganz zu verlieren).
    if kind == "availability":
        failed = push.push_availability_for_property(
            tenant_id, property_id, _d("date_from"), _d("date_to"),
            int(payload["availability"]),
            # Vom Request-Pfad bereits persistierte Outbox-Zeile (RPC 0104 bzw.
            # _write_ari_outbox) abarbeiten statt eine zweite anzulegen.
            outbox_id=payload.get("outbox_id"),
        )
    elif kind == "rate" and payload.get("segments") is not None:
        # Rate-Plan-genaue Preise (Hotel) kommen als segments (je Segment optional
        # ein rate_plan_id → nur DIESER Plan). push_rates_batch pflegt die
        # Restriktions-Outbox selbst als Backstop (kein bool-Fehlersignal).
        push.push_rates_batch(tenant_id, property_id, payload["segments"])
        failed = False
    elif kind == "rate":
        failed = push.push_rate_for_property(
            tenant_id, property_id, _d("date_from"), _d("date_to"),
            rate_cents=payload.get("rate_cents"), min_stay=payload.get("min_stay"),
        )
    elif kind == "max_stay":
        failed = push.push_max_stay_for_property(
            tenant_id, property_id, _d("date_from"), _d("date_to"),
            int(payload["max_stay"]),
        )
    elif kind == "restrictions":
        failed = push.push_restrictions_for_property(
            tenant_id, property_id, _d("date_from"), _d("date_to"),
            closed_to_arrival=payload.get("closed_to_arrival"),
            closed_to_departure=payload.get("closed_to_departure"),
            # Kombinierte Bulk-Restriktionen (eine UI-Aktion = EIN Channex-Call).
            min_stay=payload.get("min_stay"),
            max_stay=payload.get("max_stay"),
            rate_cents=payload.get("rate_cents"),
        )
    elif kind == "wochentagssperren":
        # Gesperrte Check-in/-out-Wochentage aus dem Verfügbarkeits-Formular.
        # Setzt beide Richtungen flächendeckend (gesperrt=true, Rest=false),
        # damit ein Entsperren bei den Portalen ankommt.
        failed = push.push_wochentagssperren_for_property(
            tenant_id, property_id, _d("date_from"), _d("date_to"),
            gesperrte_anreise=frozenset(payload.get("gesperrte_anreise") or ()),
            gesperrte_abreise=frozenset(payload.get("gesperrte_abreise") or ()),
        )
    elif kind == "stop_sell":
        spans = [(date.fromisoformat(a), date.fromisoformat(b))
                 for a, b in payload["spans"]]
        failed = push.push_stop_sell_for_property(
            tenant_id, property_id, spans,
            stop_sell=bool(payload["stop_sell"]),
            days=payload.get("days"),
        )
    elif kind == "restriction_rows":
        # Heterogene Restriktions-Zeilen in EINEM Channex-Call (Test 3-8).
        # push_restriction_rows_for_property ist best-effort (kein bool-Rückgabe);
        # die Restriktions-Outbox ist der Backstop.
        push.push_restriction_rows_for_property(
            tenant_id, property_id, payload["rows"],
        )
        failed = False
    elif kind == "restriction_rows_multi":
        # Zimmer-übergreifende Bulk-Restriktionen (Hotel, geteilte Channex-
        # Property): EIN Channex-Call für alle Zimmer (Tests 3-8). Best-effort;
        # die Restriktions-Outbox (je Objekt) ist der Backstop.
        push.push_restriction_rows_multi(tenant_id, payload["rows_by_property"])
        failed = False
    else:
        raise ValueError(f"unbekannter ARI-kind: {kind}")

    if failed:
        # Channex war nicht erreichbar → Job-Retry auslösen (Backoff). _run_job
        # fängt die Exception und ruft _retry (1/5/15-min-Staffel). Bei
        # 'availability' bleibt die ari_outbox zusätzlich als Backstop bestehen.
        raise RuntimeError(
            f"ARI-Push ({kind}) an Channex fehlgeschlagen — Job wird erneut versucht."
        )
    # Fürs Verlaufs-Feld: WAS gepusht wurde und über welchen Zeitraum. Der Text
    # steht so in der Tabelle („availability · 13.08.2026–12.08.2027"), die
    # gesendeten Werte je Channex-Call daneben als eigene `gesendet`-Zeilen.
    return {
        "art": kind,
        "von": payload.get("date_from"),
        "bis": payload.get("date_to"),
    }


def _handle_airbnb_historie_import(
    db: Client, payload: dict[str, Any], budget: ChannexBudget | None = None
) -> None:
    """Die Buchungshistorie aller verbundenen Objekte bei Airbnb einlesen.

    Läuft hier statt im Browser, weil ein Lauf über 18 Objekte Minuten dauert —
    so lange bleibt kein Betrieb auf der Seite, und vorher brach der Import beim
    Schließen des Tabs mittendrin ab. Der Fortschritt steht in
    `airbnb_historie_lauf`, das Ergebnis am Ende in der Glocke.

    KEIN Channex-Budget: dieser Weg ruft Airbnb direkt, nicht den Aggregator.
    """
    svc = _svc(db, budget)
    svc.historie_lauf_ausfuehren(payload["lauf_id"])


def _handle_sync_bookings_feed(
    db: Client, _payload: dict[str, Any], budget: ChannexBudget | None = None
) -> dict[str, Any]:
    """Kontoweiten Booking-Revisions-Feed ziehen, je Revision dem Tenant zuordnen,
    speichern/projizieren und erst danach acken. Getriggert vom Channex-Webhook
    (booking_*) und vom 5-min-Backstop-Tick. Revision-Fehler sind im Ergebnis
    isoliert (errors[]) — ein kompletter Feed-Ausfall wirft und geht in den
    Job-Backoff."""
    dienst = _svc(db, budget)
    result = dienst.sync_bookings_all()
    if result.errors:
        # Teilfehler sichtbar machen; die betroffenen Revisionen bleiben un-acked
        # im Feed und kommen beim nächsten Lauf erneut.
        log.warning("sync_bookings_feed_partial", errors=result.errors[:5],
                    saved=result.saved, skipped=result.skipped)

    # Im SELBEN Lauf die Lücken schliessen, die der Feed hinterlässt
    # (Buchungszeitpunkt, Profilbild, Anreisezeit, Lesestand). Warum sie hier
    # hängen und nicht an eigenen Ticks: siehe `feed_nachpflege`.
    nachgepflegt = feed_nachpflege.ausfuehren(dienst)

    # Fürs Verlaufs-Feld: was dieser Lauf bewirkt hat. `errors` kommt mit, damit
    # ein Teilfehler in der Zeile steht und nicht als glatter Durchlauf erscheint
    # (die betroffenen Revisionen hängen un-acked im 30-Minuten-Fenster).
    return {
        "fetched": result.fetched,
        "saved": result.saved,
        "acknowledged": result.acknowledged,
        "skipped": result.skipped,
        "errors": result.errors,
        **nachgepflegt,
    }


def _handle_sync_live_feed(
    db: Client, _payload: dict[str, Any], budget: ChannexBudget | None = None
) -> dict[str, Any]:
    """Airbnbs Ereignis-Journal nachziehen (`GET live_feed`).

    Backstop für ALLES, was keine Buchung ist. Idempotent über die
    Channex-Ereignis-ID (UNIQUE-Index in 0284) — ein zweiter Lauf schreibt
    nichts doppelt."""
    ergebnis = _svc(db, budget).live_feed_nachziehen()
    if ergebnis.get("neu"):
        log.info("sync_live_feed_neu", **ergebnis)
    return ergebnis


def _handle_import_ari_property(
    db: Client, payload: dict[str, Any], budget: ChannexBudget | None = None
) -> None:
    """ARI einer Property aus Channex in die lokale DB spiegeln — getriggert vom
    'ari'-Webhook (jemand hat Preise/Verfügbarkeit außerhalb unseres PMS
    geändert). Webhook = nur Trigger, Daten werden gepullt (Channex-Doku:
    Webhooks können out-of-order kommen)."""
    # `property_id` grenzt auf EIN Zimmer ein (ein Lauf über ein ganzes Hotel
    # sprengt das Property-Budget und wurde nie fertig). Ältere Jobs ohne das
    # Feld laufen unverändert über alle Zimmer.
    _svc(db, budget).import_ari_for_property(
        payload["tenant_id"], payload["channex_property_id"],
        property_id=payload.get("property_id"),
    )


def _handle_full_sync_property(
    db: Client, payload: dict[str, Any], budget: ChannexBudget | None = None
) -> None:
    """Nächtlicher Voll-Push DB→Channex (Availability über den ganzen Horizont +
    Recompute-Enqueue für Preise/Min-Stay). Heilt Drift aus verlorenen
    Delta-Pushes.

    `vollstaendig` setzt nur der manuelle Knopf: dann werden zusätzlich ALLE
    Buchungen (ohne 3-Tage-Fenster) und die Gespräche zurückgeholt. Ältere Jobs
    ohne das Feld bleiben der nächtliche Lauf."""
    _svc(db, budget).full_sync_property(
        payload["tenant_id"], payload["property_id"],
        vollstaendig=bool(payload.get("vollstaendig")),
    )


class _ProgressBudget:
    """Dünner Wrapper um ein ChannexBudget, der die ERFOLGREICH vergebenen Token
    zählt (= echte Channex-Calls, die durchgingen). So erkennt _run_job, ob ein
    Batch-Job vor einem ChannexBudgetExhausted schon Fortschritt gemacht hat, und
    setzt dann den defer_count-Livelock-Zähler zurück. Erfüllt das before_call-
    Kontrakt (try_consume) transparent — der ChannexClient merkt keinen Unterschied."""

    def __init__(self, inner: ChannexBudget) -> None:
        self._inner = inner
        self.granted = 0

    def try_consume(
        self, channex_property_id: str | None, kind: str = "other"
    ) -> BudgetDecision:
        decision = self._inner.try_consume(channex_property_id, kind)
        if decision.allowed:
            self.granted += 1
        return decision


# Ein Handler DARF ein Ergebnis zurückgeben (`dict` mit Zählern) — dann steht im
# Verlauf, was er bewirkt hat. `None` ist weiterhin erlaubt und heisst „nichts zu
# berichten"; die Verlaufszeile bleibt dann ohne Zusammenfassung, statt eine
# Tätigkeit zu behaupten (Wurzel 4).
HANDLERS: dict[
    str,
    Callable[[Client, dict[str, Any], ChannexBudget | None], dict[str, Any] | None],
] = {
    "sync_property_content": _handle_sync_property_content,
    "sync_property_taxes": _handle_sync_property_taxes,
    "pruefe_ota_gebuehren": _handle_pruefe_ota_gebuehren,
    "sync_airbnb_aktionen": _handle_sync_airbnb_aktionen,
    "sync_airbnb_verfuegbarkeit": _handle_sync_airbnb_verfuegbarkeit,
    "sync_airbnb_ausstattung": _handle_sync_airbnb_ausstattung,
    "sync_airbnb_stammdaten": _handle_sync_airbnb_stammdaten,
    "sync_airbnb_zimmer": _handle_sync_airbnb_zimmer,
    "reconcile_tenant": _handle_reconcile_tenant,
    "reconcile_rate_plan_prices": _handle_reconcile_rate_plan_prices,
    "recompute_property": _handle_recompute_property,
    "push_ari": _handle_push_ari,
    "process_ari_outbox": _handle_process_ari_outbox,
    "process_restriction_outbox": _handle_process_restriction_outbox,
    "sync_bookings_feed": _handle_sync_bookings_feed,
    "airbnb_historie_import": _handle_airbnb_historie_import,
    "sync_live_feed": _handle_sync_live_feed,
    "import_ari_property": _handle_import_ari_property,
    "full_sync_property": _handle_full_sync_property,
}


# --- Worker-Kern ------------------------------------------------------------

class Worker:
    """Claim-Loop mit Concurrency-Pool, Reaper und Zeit-Tick."""

    def __init__(
        self, db: Client | None = None, budget: ChannexBudget | None = None
    ) -> None:
        self._db = db or get_service_client()
        self._sem = asyncio.Semaphore(CONCURRENCY)
        self._stop = asyncio.Event()
        self._inflight: set[asyncio.Task] = set()
        self._worker_id = f"{socket.gethostname()}:{os.getpid()}"
        self._last_reconcile_tick = 0.0
        self._last_outbox_tick = 0.0
        self._last_ical_tick = 0.0
        self._last_bookings_tick = 0.0
        self._last_live_feed_tick = 0.0
        self._last_deploy_tick = 0.0
        self._deploy_aktiv = False
        self._last_balance_tick = 0.0
        self._last_payout_tick = 0.0
        self._last_commission_tick = 0.0
        self._last_reviews_tick = 0.0
        self._last_tasks_tick = 0.0
        self._last_automails_tick = 0.0
        self._last_automail_planung_tick = 0.0
        self._last_content_heal_tick = 0.0
        self._last_vertragsende_tick = 0.0
        # Kontoweites Channex-Token-Budget (Phase 1b): vor jedem Channex-Push wird
        # ein Token verbraucht, sonst wird der Job verzögert statt Channex überfahren.
        self._budget = budget or ChannexBudget(get_settings())

    def request_stop(self) -> None:
        self._stop.set()

    def _touch_heartbeat(self) -> None:
        with open(HEARTBEAT_PATH, "w", encoding="utf-8") as fh:
            fh.write(datetime.now(UTC).isoformat())

    def _claim(self, limit: int) -> list[dict[str, Any]]:
        return (
            self._db.rpc(
                "claim_jobs", {"p_limit": limit, "p_worker": self._worker_id}
            ).execute()
        ).data or []

    def _finish(self, job_id: str, status: str, error: str | None = None) -> None:
        patch: dict[str, Any] = {"status": status, "locked_at": None, "locked_by": None}
        if error is not None:
            patch["last_error"] = error[:1000]
        # Guard: nur den EIGENEN, noch laufenden Claim abschließen. Hat der
        # Reaper den Job inzwischen requeued (und ggf. ein anderer Worker ihn
        # neu geclaimt), würde ein blindes Update dessen Zustand überschreiben.
        res = (
            self._db.table("jobs").update(patch)
            .eq("id", job_id)
            .eq("locked_by", self._worker_id)
            .eq("status", "running")
            .execute()
        )
        if not (res.data or []):
            log.warning("job_finish_lost_claim", id=job_id, status=status)

    def _requeue(self, job: dict[str, Any], patch: dict[str, Any]) -> None:
        """Einen laufenden Job zurück auf 'queued' setzen (Retry/Defer).

        Fängt die Kollision mit dem partiellen Unique-Index jobs_dedup_queued_uq
        (0108: dedup_key WHERE status='queued') ab: solange dieser Job 'running'
        war, durfte ein neuer enqueue_job(dedup_key) eine ZWEITE 'queued'-Zeile
        anlegen (genau das Ziel von 0108). Ein blindes running→queued würde dann
        eine zweite 'queued'-Zeile mit demselben dedup_key erzeugen → 23505; ohne
        Fangen bliebe der Job dauerhaft 'running' stecken. In dem Fall erledigt der
        bereits eingereihte Zwilling die Arbeit → diesen Job sauber als 'done'
        abschließen (kein Verlust, keine Dublette)."""
        try:
            self._db.table("jobs").update(patch).eq("id", job["id"]).eq(
                "locked_by", self._worker_id  # Guard wie _finish: nur eigenen Claim
            ).eq("status", "running").execute()
        except APIError as exc:
            if "jobs_dedup_queued_uq" not in str(exc):
                raise
            log.info(
                "job_requeue_dedup_yield",
                id=job["id"], job_type=job.get("job_type"),
            )
            self._finish(
                job["id"], "done",
                "übersprungen — bereits neu eingereiht (dedup_key)",
            )

    def _retry(self, job: dict[str, Any], error: str) -> None:
        """Fehlgeschlagenen Job neu terminieren — oder 'dead', wenn Budget aus."""
        attempts = job.get("attempts") or 0
        if attempts >= (job.get("max_attempts") or 10):
            self._finish(job["id"], "dead", error)
            log.error("job_dead", id=job["id"], job_type=job["job_type"], error=error[:300])
            return
        self._requeue(job, {
            "status": "queued", "locked_at": None, "locked_by": None,
            "last_error": error[:1000],
            "run_after": next_run_after(attempts).isoformat(),
        })

    def _defer(
        self, job: dict[str, Any], retry_after: int, *, progressed: bool = False
    ) -> None:
        """Job wegen erschöpftem Channex-Budget verzögern: zurück auf queued mit
        run_after = jetzt + retry_after (genau bis das nächste Token frei wird),
        OHNE attempts zu verbrauchen (es ist kein Fehler, nur Warten). claim_jobs
        hat attempts beim Claim erhöht → hier −1 zurückdrehen, damit das Retry-
        Budget nicht durch Budget-Wartephasen aufgezehrt wird.

        Deckel gegen Livelock: bei DAUERHAFT totem Redis liefert das Budget nie ein
        Token → der Job defert unendlich (attempts wird nie verbraucht, erreicht nie
        'dead'). Ein separater defer_count deckelt das: nach _MAX_DEFERS Verzögerungen
        OHNE Fortschritt gibt der Job auf ('dead'), statt zyklisch einen Slot zu
        belegen. `progressed`=True (der Batch-Job hat vor dem Erschöpfen echte Calls
        gepusht) setzt defer_count ZURÜCK — ein Batch, der je Tick voranarbeitet
        (Normalbetrieb unter Last), stirbt so nicht fälschlich mid-batch."""
        defer_count = 0 if progressed else (job.get("defer_count") or 0) + 1
        if defer_count > _MAX_DEFERS:
            self._finish(
                job["id"], "dead",
                "Channex-Budget dauerhaft nicht verfügbar (Redis-Ausfall?) — "
                f"nach {_MAX_DEFERS} Verzögerungen aufgegeben.",
            )
            log.error(
                "job_dead_defer_livelock",
                id=job["id"], job_type=job.get("job_type"), defer_count=defer_count,
            )
            return
        attempts = max((job.get("attempts") or 1) - 1, 0)
        run_after = datetime.now(UTC) + timedelta(seconds=max(retry_after, 1))
        self._requeue(job, {
            "status": "queued", "locked_at": None, "locked_by": None,
            "attempts": attempts, "defer_count": defer_count,
            "run_after": run_after.isoformat(),
        })

    def _run_job(self, job: dict[str, Any]) -> None:
        """Synchron im Thread: Handler ausführen, Status setzen.

        Das Channex-Budget wird NICHT mehr einmalig vorab gezogen, sondern
        PRO ECHTEM HTTP-CALL im ChannexClient (before_call-Callback). Nur die
        pushenden Job-Typen bekommen das Budget durchgereicht; Nicht-Channex-
        Jobs (recompute_property) laufen ohne Gate. Reißt der Budget-Vorrat
        mitten im Batch, wirft der Client ChannexBudgetExhausted → der Job wird
        verzögert (deferred, ohne Retry-Versuch zu verbrennen) und läuft nach
        retry_after ab dem bereits erledigten Punkt weiter (Handler idempotent).
        """
        from src.features.channel_manager.channex_client import ChannexBudgetExhausted

        handler = HANDLERS.get(job["job_type"])
        if handler is None:
            # NICHT 'dead': ein unbekannter Typ heißt im Regelfall, dass die API
            # schon neu ist und DIESER Worker noch mit älterem Code läuft — ein
            # Rolling Deploy ist genau dieser Zustand. Live passiert (05.08.2026):
            # vier `sync_airbnb_zimmer`-Jobs landeten auf 'dead', die Zimmer-
            # Änderung erreichte Airbnb dauerhaft nicht, und im Log stand nur
            # „unknown job_type" — ein Neustart heilte nichts, weil die Jobs
            # bereits verloren waren.
            #
            # Zurückstellen statt wegwerfen (Wurzel 5 — kein stilles Verschlucken
            # eines echten Auftrags): `_defer` verbraucht kein Retry-Budget und
            # deckelt sich über `defer_count` selbst. Ist der Typ WIRKLICH
            # unbekannt (getippter Name), stirbt der Job nach `_MAX_DEFERS` —
            # nur eben nicht beim ersten Blick.
            log.error("job_unknown_type", id=job["id"], job_type=job["job_type"])
            self._defer(job, _UNKNOWN_TYPE_RETRY)
            return
        # Fortschritts-Zähler: der Budget-Wrapper zählt jeden ERFOLGREICH vergebenen
        # Token = jeder echte Channex-Call, der durchging. Erschöpft das Budget
        # MITTEN im Batch (Normalbetrieb unter Last), hat der Job bis dahin bereits
        # Zeilen gepusht → progressed=True → _defer setzt defer_count zurück. Nur ein
        # Job OHNE jeden Fortschritt (echter Redis-Ausfall: schon der 1. Token wird
        # verweigert) läuft in den defer_count-Deckel und stirbt als 'dead'.
        budget = (
            _ProgressBudget(self._budget)
            if job["job_type"] in _CHANNEX_JOB_TYPES
            else None
        )
        uhr = worker_verlauf.Stoppuhr()
        try:
            ergebnis = handler(self._db, job.get("payload") or {}, budget)
            self._finish(job["id"], "done")
            worker_verlauf.job_ausgang(
                self._db, job, uhr, ausgang="done", ergebnis=ergebnis
            )
        except ChannexBudgetExhausted as exc:
            # Budget mitten im Job erschöpft → verzögern statt Retry verbrennen.
            progressed = budget is not None and budget.granted > 0
            self._defer(job, exc.retry_after, progressed=progressed)
            log.info("job_deferred_budget", id=job["id"], job_type=job["job_type"],
                     retry_after=exc.retry_after, progressed=progressed)
            worker_verlauf.job_ausgang(
                self._db, job, uhr, ausgang="aufschub", retry_after=exc.retry_after
            )
        except Exception as exc:  # noqa: BLE001 — ein Job-Fehler darf den Worker nie killen
            self._retry(job, str(exc))
            log.warning("job_failed", id=job["id"], job_type=job["job_type"], error=str(exc)[:300])
            # Der Verlauf MUSS den Fehler tragen (Wurzel 5).
            worker_verlauf.job_ausgang(
                self._db, job, uhr, ausgang="fehler", fehler=str(exc)
            )

    async def _dispatch(self, job: dict[str, Any]) -> None:
        async with self._sem:
            heartbeat = asyncio.create_task(self._job_heartbeat(job["id"]))
            try:
                await asyncio.to_thread(self._run_job, job)
            finally:
                heartbeat.cancel()
                with contextlib.suppress(asyncio.CancelledError):
                    await heartbeat

    async def _job_heartbeat(self, job_id: str) -> None:
        """locked_at des laufenden Jobs periodisch auffrischen, solange der
        Handler läuft. Der Reaper requeued Jobs mit locked_at älter als
        STUCK_AFTER_SECONDS — ohne Heartbeat traf das auch legitime Langläufer
        (reconcile_tenant über hunderte Objekte ≫ 300 s) und erzeugte
        Doppelausführungen. Mit Heartbeat heißt „stuck" nur noch: Worker tot."""
        while True:
            await asyncio.sleep(JOB_HEARTBEAT_SECONDS)
            try:
                await asyncio.to_thread(
                    lambda: self._db.table("jobs")
                    .update({"locked_at": datetime.now(UTC).isoformat()})
                    .eq("id", job_id)
                    .eq("locked_by", self._worker_id)
                    .eq("status", "running")
                    .execute()
                )
            except Exception as exc:  # noqa: BLE001 — Heartbeat-Fehler nie fatal
                log.warning("job_heartbeat_failed", id=job_id, error=str(exc)[:200])

    async def _reap_stuck(self) -> None:
        try:
            res = await asyncio.to_thread(
                lambda: self._db.rpc(
                    "requeue_stuck_jobs", {"p_older_than_seconds": STUCK_AFTER_SECONDS}
                ).execute()
            )
            n = res.data if isinstance(res.data, int) else 0
            if n:
                log.info("jobs_reaped", count=n)
        except Exception as exc:  # noqa: BLE001
            log.warning("reap_failed", error=str(exc)[:200])

    async def _reconcile_tick(self, loop_time: float) -> None:
        """Einmal täglich je Tenant einen reconcile_tenant-Job einreihen. Coalescing
        über dedup_key (Zeit-Bucket) → mehrere Worker enqueuen nur einmal."""
        if loop_time - self._last_reconcile_tick < RECONCILE_TICK_SECONDS:
            return
        self._last_reconcile_tick = loop_time
        try:
            await asyncio.to_thread(self._enqueue_reconcile_all)
        except Exception as exc:  # noqa: BLE001
            log.warning("reconcile_tick_failed", error=str(exc)[:200])

    async def _outbox_tick(self, loop_time: float) -> None:
        """Alle 5 min die ausgehenden Push-Outboxen nachziehen (Retry-Pfad)."""
        if loop_time - self._last_outbox_tick < OUTBOX_TICK_SECONDS:
            return
        self._last_outbox_tick = loop_time
        try:
            await asyncio.to_thread(self._enqueue_outbox_all)
        except Exception as exc:  # noqa: BLE001
            log.warning("outbox_tick_failed", error=str(exc)[:200])

    async def _ical_tick(self, loop_time: float) -> None:
        """Alle 30 min prüfen und fällige externe iCal-Feeds (> 2h alt) syncen.
        Netzwerk-/DB-Arbeit im Thread; robust: ein kaputter Feed kippt weder den
        Tick noch die anderen Feeds (der Sync selbst schreibt Fehler an den Feed)."""
        if loop_time - self._last_ical_tick < ICAL_TICK_SECONDS:
            return
        self._last_ical_tick = loop_time
        try:
            await asyncio.to_thread(self._sync_due_icals)
        except Exception as exc:  # noqa: BLE001
            log.warning("ical_tick_failed", error=str(exc)[:200])

    def _sync_due_icals(self) -> None:
        """Fällige aktive Feeds laden und synchronisieren. Fällig = noch nie
        gesynct ODER letzter Sync älter als ICAL_STALE_SECONDS."""
        from src.features.external_calendar.service import ExternalCalendarService

        cutoff = (
            datetime.now(UTC) - timedelta(seconds=ICAL_STALE_SECONDS)
        ).isoformat()
        # Fällige Feeds: last_synced_at is null ODER < cutoff. Zwei Abfragen
        # (PostgREST-or wäre möglich, aber getrennt ist klarer), zusammengeführt.
        never = (
            self._db.table("external_calendar").select("*")
            .eq("is_active", True).is_("last_synced_at", "null")
            .limit(ICAL_BATCH).execute()
        ).data or []
        stale = (
            self._db.table("external_calendar").select("*")
            .eq("is_active", True).lt("last_synced_at", cutoff)
            .limit(ICAL_BATCH).execute()
        ).data or []
        seen: set[str] = set()
        svc = ExternalCalendarService(service_client=self._db)
        for cal in (*never, *stale):
            if cal["id"] in seen:
                continue
            seen.add(cal["id"])
            svc.sync_calendar(self._db, cal)  # schreibt Status/Fehler selbst
        if seen:
            log.info("ical_sync_tick", synced=len(seen))

    async def _content_heal_tick(self, loop_time: float) -> None:
        """Stündlich fehlgeschlagene Content-Syncs erneut einreihen."""
        if loop_time - self._last_content_heal_tick < CONTENT_HEAL_TICK_SECONDS:
            return
        self._last_content_heal_tick = loop_time
        try:
            await asyncio.to_thread(self._enqueue_failed_content_syncs)
        except Exception as exc:  # noqa: BLE001
            log.warning("content_heal_tick_failed", error=str(exc)[:200])

    def _enqueue_failed_content_syncs(self) -> None:
        """Objekte mit fehlerhaftem letzten Content-Push erneut einreihen.

        Das ist der Heilungspfad zum Sichtbarkeits-Signal `last_sync_status`:
        gemeldet wurde der Fehler schon immer, nur nachgeholt hat ihn nie
        jemand. Coalescing über den bestehenden dedup_key — läuft für ein
        Objekt bereits ein Sync, entsteht kein zweiter.

        Reine Entwürfe kommen hier nicht vor: Grundlage ist die Registrierung
        (`channex_property_map`), die ein unveröffentlichtes Objekt gar nicht
        erst bekommt. Deshalb braucht dieser Tick keine eigene Statusprüfung —
        wer hier steht, war schon einmal bei den Portalen.
        """
        rows = (
            self._db.table("channex_property_map")
            .select("tenant_id, property_id")
            .eq("last_sync_status", "error")
            .is_("deleted_at", "null")
            .limit(CONTENT_HEAL_BATCH)
            .execute()
        ).data or []
        for row in rows:
            tenant_id, property_id = row.get("tenant_id"), row.get("property_id")
            if not tenant_id or not property_id:
                continue
            # title/currency bewusst None: der Handler lädt den aktuellen Stand
            # ohnehin aus der DB, ein Snapshot von hier wäre nur veraltet.
            try_enqueue_content_sync(self._db, str(tenant_id), str(property_id))
        if rows:
            log.info("content_sync_heal_enqueued", properties=len(rows))

    async def _vertragsende_tick(self, loop_time: float) -> None:
        """Täglich den Sperrhorizont gekündigter Objekte nachschieben (0355)."""
        if loop_time - self._last_vertragsende_tick < VERTRAGSENDE_TICK_SECONDS:
            return
        self._last_vertragsende_tick = loop_time
        try:
            await asyncio.to_thread(
                vertragsenden_nachziehen, self._db, VERTRAGSENDE_BATCH
            )
        except Exception as exc:  # noqa: BLE001 — Tick darf den Worker nie kippen
            log.warning("vertragsende_tick_failed", error=str(exc)[:200])

    async def _reviews_tick(self, loop_time: float) -> None:
        """Stündlich: verdeckte Bewertungen nach Fristablauf veröffentlichen,
        Portal-Bewertungen spiegeln, Automatik (Gast bewerten / erinnern).
        Robust: ein nicht erreichbares Portal kippt weder den Tick noch die
        beiden anderen Schritte."""
        if loop_time - self._last_reviews_tick < REVIEWS_TICK_SECONDS:
            return
        self._last_reviews_tick = loop_time
        try:
            await asyncio.to_thread(self._run_reviews_maintenance)
        except Exception as exc:  # noqa: BLE001
            log.warning("reviews_tick_failed", error=str(exc)[:200])

    def _run_reviews_maintenance(self) -> None:
        from src.features.reviews.automation import ReviewAutomation
        from src.features.reviews.service import ReviewsService

        published, mirrored, queued, rated, expired, reminded = ReviewsService(
            service_client=self._db
        ).run_maintenance(ReviewAutomation(service_client=self._db))
        # Nur loggen, wenn wirklich etwas passiert ist — stündlich eine
        # Null-Zeile ins Log wäre nur Rauschen.
        if any((published, mirrored, queued, rated, expired, reminded)):
            log.info(
                "reviews_tick",
                published=published, mirrored=mirrored, queued=queued,
                guest_rated=rated, expired=expired, reminders_sent=reminded,
            )

    async def _automails_tick(self, loop_time: float) -> None:
        """Fällige Automails versenden — minütlich, über alle Tenants.

        `dispatch_due_automations` führt den Zustand selbst (sent/failed) und
        ist idempotent; ein Kanal-Fehler an einer Nachricht kippt weder den Tick
        noch die übrigen. Netzwerkarbeit im Thread, damit die Claim-Loop läuft.
        """
        if loop_time - self._last_automails_tick < AUTOMAILS_TICK_SECONDS:
            return
        self._last_automails_tick = loop_time
        try:
            ergebnis = await asyncio.to_thread(self._dispatch_automails)
        except Exception as exc:  # noqa: BLE001 — ein Fehler stoppt den Worker nicht
            log.warning("automails_tick_failed", error=str(exc)[:200])
            return
        # Nur protokollieren, wenn wirklich etwas passiert ist — sonst schriebe
        # der Tick jede Minute eine Zeile ins Log.
        if ergebnis.get("sent") or ergebnis.get("failed"):
            log.info(
                "automails_tick",
                sent=ergebnis.get("sent", 0),
                failed=ergebnis.get("failed", 0),
            )

    def _dispatch_automails(self) -> dict:
        from src.features.inbox.service import InboxService

        return InboxService(service_client=self._db).dispatch_due_automations()

    async def _automail_planung_tick(self, loop_time: float) -> None:
        """Automails neu planen — stündlich, über alle Tenants (0307).

        Rechnet die geplanten Nachrichten aus den AKTUELLEN Regeln neu und nimmt
        zurück, was nicht mehr gilt (pausierte Regel, stornierte Buchung). Was
        bereits versendet wurde, bleibt unangetastet."""
        if loop_time - self._last_automail_planung_tick < AUTOMAIL_PLANUNG_TICK_SECONDS:
            return
        self._last_automail_planung_tick = loop_time
        try:
            ergebnis = await asyncio.to_thread(self._replan_automails)
        except Exception as exc:  # noqa: BLE001 — ein Fehler stoppt den Worker nicht
            log.warning("automail_planung_tick_failed", error=str(exc)[:200])
            return
        if ergebnis.get("geplant") or ergebnis.get("storniert"):
            log.info(
                "automail_planung_tick",
                tenants=ergebnis.get("tenants", 0),
                threads=ergebnis.get("threads", 0),
                geplant=ergebnis.get("geplant", 0),
                storniert=ergebnis.get("storniert", 0),
            )

    def _replan_automails(self) -> dict:
        from src.features.inbox.service import InboxService

        return InboxService(service_client=self._db).replan_all_tenants()

    async def _tasks_tick(self, loop_time: float) -> None:
        """Stündlich wiederkehrende Aufgaben-Regeln ausrollen (0272).

        Bis dahin hatten regelmäßige Aufgaben keinen Ausführenden: sie ließen
        sich anlegen, erzeugten aber nie eine Aufgabe. Ein Tenant mit kaputter
        Regel kippt weder den Tick noch die übrigen Tenants."""
        if loop_time - self._last_tasks_tick < TASKS_TICK_SECONDS:
            return
        self._last_tasks_tick = loop_time
        try:
            await asyncio.to_thread(self._materialize_recurring_tasks)
        except Exception as exc:  # noqa: BLE001
            log.warning("tasks_tick_failed", error=str(exc)[:200])

    def _materialize_recurring_tasks(self) -> None:
        from src.features.tasks.engine import materialize_recurring

        today = datetime.now(UTC).date()
        created = 0
        for tenant in (self._db.table("tenants").select("id").execute()).data or []:
            try:
                created += materialize_recurring(
                    self._db, str(tenant["id"]), today=today
                )
            except Exception as exc:  # noqa: BLE001 — ein Tenant kippt nicht alle
                log.warning(
                    "tasks_materialize_failed",
                    tenant_id=str(tenant["id"]),
                    error=str(exc)[:200],
                )
        if created:
            log.info("tasks_tick", created=created)

    async def _balance_tick(self, loop_time: float) -> None:
        """Stündlich fällige Restzahlungen (Split-Payment) off-session belasten.
        Netzwerk-/DB-Arbeit im Thread; ein fehlgeschlagener Charge kippt weder den
        Tick noch die anderen Zeilen (charge_due_balance schreibt den Zustand
        selbst: needs_action/failed, nie still 'bezahlt')."""
        if loop_time - self._last_balance_tick < BALANCE_TICK_SECONDS:
            return
        self._last_balance_tick = loop_time
        try:
            await asyncio.to_thread(self._charge_due_balances)
        except Exception as exc:  # noqa: BLE001
            log.warning("balance_tick_failed", error=str(exc)[:200])

    def _charge_due_balances(self) -> None:
        """Fällige, noch offene Restzahlungen laden und je Zeile belasten. Jeder
        Charge ist idempotent (claim auf 'charging' + Stripe-idempotency_key);
        ein Fehler einer Zeile stoppt die übrigen nicht (best-effort je Zeile)."""
        from src.features.payments.service import PaymentsError, PaymentsService

        svc = PaymentsService(service_client=self._db)
        ids = svc.due_balance_payment_ids()
        charged = 0
        for pid in ids:
            try:
                svc.charge_due_balance(payment_id=pid)
                charged += 1
            except PaymentsError as exc:
                # needs_action/failed hat charge_due_balance bereits persistiert.
                log.warning(
                    "balance_charge_failed", payment_id=pid, error=exc.message
                )
        if ids:
            log.info("balance_tick", due=len(ids), charged=charged)

    async def _payout_tick(self, loop_time: float) -> None:
        """Fällige Auszahlungen an Betriebe ausführen (0217).

        Modell wie Booking.com: Die Plattform hält das Geld bis zur Abreise.
        Der Lauf zieht offene Verrechnungsposten ab und transferiert den Rest;
        abgelaufene Zurückhaltungen werden vorher freigegeben, sonst bliebe
        Geld unbegrenzt liegen.

        Netzwerk-/DB-Arbeit im Thread. Ein Fehler kippt weder den Tick noch die
        übrigen Zeilen — der Service isoliert je Zeile und schreibt 'failed',
        nie still 'ausgezahlt'.
        """
        if loop_time - self._last_payout_tick < PAYOUT_TICK_SECONDS:
            return
        self._last_payout_tick = loop_time
        try:
            await asyncio.to_thread(self._run_payouts)
        except Exception as exc:  # noqa: BLE001
            log.warning("payout_tick_failed", error=str(exc)[:200])

    def _run_payouts(self) -> None:
        """Zurückhaltungen freigeben, dann fällige Auszahlungen abarbeiten."""
        from src.features.payouts.service import PayoutsService

        svc = PayoutsService(db=self._db)
        freigegeben = svc.gib_holds_frei()
        bilanz = svc.fuehre_lauf_aus()
        if bilanz["geprueft"] or freigegeben:
            log.info("payout_tick", freigegeben=freigegeben, **bilanz)

    async def _commission_tick(self, loop_time: float) -> None:
        """Am Monatsersten die OTA-Provisionen des Vormonats abrechnen.

        Der Kunde sieht im Provisions-Monatsverlauf „Einzug am 1. …" — dieser
        Tick löst genau das aus. Läuft nur am 1., der Rest des Monats ist ein
        No-op; mehrfaches Auslösen am selben Tag ist unschädlich, weil
        bill_all_tenants_for_period über einen deterministischen Stripe-
        idempotency_key idempotent ist (Wurzel 2).

        Netzwerk-/DB-Arbeit im Thread. Ein Fehler kippt weder den Tick noch die
        übrigen Betriebe — der Service isoliert je Tenant.
        """
        if loop_time - self._last_commission_tick < COMMISSION_TICK_SECONDS:
            return
        self._last_commission_tick = loop_time
        heute = datetime.now(UTC).date()
        if heute.day != COMMISSION_BILLING_DAY:
            return
        try:
            await asyncio.to_thread(self._bill_commissions, heute)
        except Exception as exc:  # noqa: BLE001 — Tick darf den Worker nie killen
            log.warning("commission_tick_failed", error=str(exc)[:200])

    def _bill_commissions(self, heute: date) -> None:
        """Offene Provisionen + Nutzungsgebühren aller Betriebe für den
        Vormonat fakturieren. Beide Läufe sind idempotent (deterministischer
        Stripe-idempotency_key je Tenant/Periode)."""
        from src.features.subscriptions.service import SubscriptionsService

        svc = SubscriptionsService(service_client=self._db)
        periode = svc.abgelaufene_periode(heute)
        svc.bill_all_tenants_for_period(period=periode)
        # Modul „Dynamische Preise" (0,5 % vom Buchungsumsatz), je Währung ein
        # eigenes Invoice-Item. Eigener Lauf, damit ein Fehler im einen Pfad
        # den anderen nicht mitreißt (Wurzel 5).
        svc.bill_all_dynpricing(period=periode)

    async def _bookings_tick(self, loop_time: float) -> None:
        """Alle 5 min einen kontoweiten Booking-Feed-Pull einreihen (Backstop —
        der primäre Trigger ist der booking_*-Webhook). Coalescing über den
        Wall-Clock-Bucket, damit N Worker-Instanzen nur EINEN Job erzeugen."""
        if loop_time - self._last_bookings_tick < BOOKINGS_TICK_SECONDS:
            return
        self._last_bookings_tick = loop_time
        try:
            # EINE Dedup-Familie mit dem Webhook-Trigger (konstanter Key):
            # getrennte Key-Familien (tick vs. webhook) erlaubten zwei
            # gleichzeitig laufende Feed-Jobs → parallele Feed-Läufe ackten
            # sich gegenseitig die Seiten weg und der zweite Insert lief in
            # den reservations-Unique-Index. Ein konstanter Key koalesziert
            # alle offenen Anforderungen auf höchstens einen queued-Job.
            await asyncio.to_thread(
                enqueue,
                self._db, "sync_bookings_feed",
                payload={}, dedup_key="sync_bookings_feed",
            )
        except Exception as exc:  # noqa: BLE001
            log.warning("bookings_tick_failed", error=str(exc)[:200])

    async def _live_feed_tick(self, loop_time: float) -> None:
        """Alle 5 min das Ereignis-Journal nachziehen (Backstop zum Webhook).

        Konstanter Dedup-Key wie beim Buchungs-Feed: N Worker-Instanzen erzeugen
        höchstens EINEN Job, und zwei parallele Läufe können sich nicht
        gegenseitig die Seiten wegziehen."""
        if loop_time - self._last_live_feed_tick < LIVE_FEED_TICK_SECONDS:
            return
        self._last_live_feed_tick = loop_time
        try:
            await asyncio.to_thread(
                enqueue,
                self._db, "sync_live_feed",
                payload={}, dedup_key="sync_live_feed",
            )
        except Exception as exc:  # noqa: BLE001
            log.warning("live_feed_tick_failed", error=str(exc)[:200])

    def _enqueue_full_sync_nightly(self) -> None:
        """Im nächtlichen UTC-Fenster je aktiver Channex-Property EINEN
        full_sync_property-Job pro Tag einreihen (Channex-Doku: „daily full
        update each night per property"; off-peak, gestaffelt). Dedup je
        Property+Kalendertag → das 15-min-Tick-Fenster erzeugt keine Duplikate."""
        now = datetime.now(UTC)
        if now.hour != FULL_SYNC_HOUR_UTC:
            return
        all_rows = (
            self._db.table("channex_property_map")
            .select("tenant_id, property_id, channex_property_id, created_at")
            .is_("deleted_at", "null")
            .order("created_at")
            .execute()
        ).data or []
        # Geteilte Channex-Property (Hotel, 0158): EIN Full-Sync-Job je
        # CHANNEX-Property, nicht je Zimmer — der Handler synct alle Zimmer der
        # Property gebündelt (sonst liefe der Voll-Push n-fach pro Nacht).
        # Primär = älteste Map-Zeile (stabil).
        by_channex: dict[str, dict] = {}
        for r in all_rows:
            by_channex.setdefault(r["channex_property_id"], r)
        rows = list(by_channex.values())
        day = now.date().isoformat()
        keys = [f"full_sync:{r['channex_property_id']}:{day}" for r in rows]
        # Tages-Dedup über ALLE Status: der partielle queued-Unique-Index
        # dedupliziert nur offene Jobs — ein bereits erledigter Full-Sync
        # desselben Tages würde sonst bei jedem weiteren 15-min-Tick im
        # Nachtfenster erneut eingereiht (4×N Voll-Pushes pro Nacht).
        done_today: set[str] = set()
        for i in range(0, len(keys), 100):  # URL-Länge: in-Filter chunken
            existing = (
                self._db.table("jobs")
                .select("dedup_key")
                .in_("dedup_key", keys[i:i + 100])
                .execute()
            ).data or []
            done_today.update(
                e["dedup_key"] for e in existing if e.get("dedup_key")
            )
        for i, r in enumerate(rows):
            key = f"full_sync:{r['channex_property_id']}:{day}"
            if key in done_today:
                continue
            enqueue(
                self._db, "full_sync_property", tenant_id=r["tenant_id"],
                payload={"tenant_id": r["tenant_id"], "property_id": r["property_id"]},
                dedup_key=key,
                delay_seconds=i * FULL_SYNC_STAGGER_SECONDS,
            )
        # Retention der Webhook-Ereignisliste (rohe Payloads mit Gast-PII):
        # analog zur Channex-Retention-Doku nach 90 Tagen aufräumen.
        try:
            cutoff = (now - timedelta(days=90)).isoformat()
            # Handlungspflichtige, noch offene Ereignisse (Airbnb-Anfragen)
            # NICHT wegräumen — nur resolved ODER reine Info/Fehler-Events.
            self._db.table("channex_webhook_event").delete().lt(
                "created_at", cutoff
            ).or_(
                "resolved.eq.true,"
                "event.not.in.(reservation_request,alteration_request,inquiry)"
            ).execute()
        except Exception as exc:  # noqa: BLE001 — Aufräumen nie den Tick kippen
            log.warning("webhook_event_retention_failed", error=str(exc)[:200])

    def _enqueue_reconcile_all(self) -> None:
        # Coalescing-Bucket aus der WALL-CLOCK (time.time()), NICHT aus der
        # Monotonic-Loop-Uhr: loop.time() hat pro Prozess einen anderen, undefinierten
        # Nullpunkt. Zwei Worker-Instanzen (oder derselbe Worker über einen Neustart)
        # berechneten daraus für denselben Wandzeit-Tick verschiedene Buckets →
        # dedup_keys kollidierten nie → das versprochene Cross-Instance-/Cross-Restart-
        # Coalescing griffe nicht (N-fache Reconcile-/Channex-Last bei N Instanzen).
        # Die Wall-Clock ist über alle Instanzen gleich → gemeinsamer Bucket.
        bucket = int(time.time() // RECONCILE_TICK_SECONDS)
        rows = (
            self._db.table("channex_group_map").select("tenant_id").execute()
        ).data or []
        for r in rows:
            tid = r["tenant_id"]
            enqueue(
                self._db, "reconcile_tenant", tenant_id=tid,
                payload={"tenant_id": tid},
                dedup_key=f"reconcile_tick:{tid}:{bucket}",
            )
    def _enqueue_outbox_all(self) -> None:
        """Offene AUSGEHENDE Pushes nachziehen (Availability + Restriktionen).
        Bewusst ein EIGENER, häufiger Tick und nicht mehr am Reconcile-Tick: der
        Reconcile läuft nur noch täglich, ein gescheiterter Preis-/Stop-Sell-Push
        darf aber nicht einen Tag lang liegen bleiben. Beide Handler senden nur,
        wenn tatsächlich offene Zeilen existieren — ohne Änderungen entstehen
        null Channex-Requests."""
        bucket = int(time.time() // OUTBOX_TICK_SECONDS)
        enqueue(
            self._db, "process_ari_outbox",
            payload={}, dedup_key=f"ari_outbox_tick:{bucket}",
        )
        # Ausgehende Restriktions-Pushes (Stop-Sell/Rate/Min-/Max-Stay/CTA-CTD)
        # tenant-übergreifend nachziehen — der dauerhafte Backstop, den es vor 0115
        # nur für Availability gab. Ein gescheiterter Verkaufsstopp/Preis heilt so
        # selbst (auch nach nachträglichem Rate-Plan-Import).
        enqueue(
            self._db, "process_restriction_outbox",
            payload={}, dedup_key=f"ari_restriction_outbox_tick:{bucket}",
        )
        # Nächtlicher Full-Sync-Push (dedup je Property+Tag; greift nur im
        # UTC-Stundenfenster FULL_SYNC_HOUR_UTC). Hängt bewusst an DIESEM Tick:
        # der Reconcile-Tick läuft nur noch täglich und träfe das Stundenfenster
        # sonst fast nie — der von Channex verlangte tägliche Voll-Push fiele aus.
        self._enqueue_full_sync_nightly()

    async def _deploy_tick(self, loop_time: float) -> None:
        """Coolify-Zustand nach public.deploy_spiegel schreiben.

        Das ist der Ersatz fuer Polling im Browser: EIN Prozess fragt Coolify,
        das Backoffice bekommt die Aenderung per Realtime-Push. Solange etwas
        baut, wird eng nachgesehen — sonst ruhig.

        Derselbe Aufruf schreibt bei jedem ZUSTANDSWECHSEL zusaetzlich eine
        Zeile nach `public.deploy_ereignis` (0378) — den Verlauf, den der
        fortgeschriebene Spiegel nicht halten kann. Bei einem Fehlschlag zieht
        er dafuer das Build-Log und legt die extrahierte Ursache mit ab.
        """
        takt = (
            DEPLOY_TICK_AKTIV_SECONDS if self._deploy_aktiv
            else DEPLOY_TICK_RUHE_SECONDS
        )
        if loop_time - self._last_deploy_tick < takt:
            return
        self._last_deploy_tick = loop_time
        try:
            from .features.platform_admin.deploy_spiegel import spiegel_aktualisieren

            self._deploy_aktiv = await asyncio.to_thread(
                spiegel_aktualisieren, self._db
            )
        except Exception as exc:  # noqa: BLE001
            # Best-effort: ein nicht erreichbares Coolify darf den Worker nicht
            # kippen. Der Spiegel bleibt dann stehen, `geprueft_at` verraet es.
            log.warning("deploy_spiegel_fehler", error=str(exc))

    async def run(self) -> None:
        log.info("worker_started", worker_id=self._worker_id, concurrency=CONCURRENCY)
        while not self._stop.is_set():
            self._touch_heartbeat()
            loop_time = asyncio.get_running_loop().time()
            await self._reap_stuck()
            await self._reconcile_tick(loop_time)
            await self._outbox_tick(loop_time)
            await self._ical_tick(loop_time)
            await self._bookings_tick(loop_time)
            await self._live_feed_tick(loop_time)
            await self._balance_tick(loop_time)
            await self._payout_tick(loop_time)
            await self._commission_tick(loop_time)
            await self._reviews_tick(loop_time)
            await self._tasks_tick(loop_time)
            await self._automails_tick(loop_time)
            await self._automail_planung_tick(loop_time)
            await self._content_heal_tick(loop_time)
            await self._vertragsende_tick(loop_time)
            await self._deploy_tick(loop_time)
            free = CONCURRENCY - len(self._inflight)
            jobs = await asyncio.to_thread(self._claim, free) if free > 0 else []
            for job in jobs:
                task = asyncio.create_task(self._dispatch(job))
                self._inflight.add(task)
                task.add_done_callback(self._inflight.discard)
            if not jobs:
                try:
                    await asyncio.wait_for(self._stop.wait(), timeout=IDLE_SLEEP_SECONDS)
                except TimeoutError:
                    pass
        # Graceful shutdown: laufende Jobs auslaufen lassen (< Docker-Grace 30s).
        if self._inflight:
            log.info("worker_draining", inflight=len(self._inflight))
            await asyncio.wait(self._inflight, timeout=25)
        log.info("worker_stopped")


async def _main() -> None:
    configure_logging("INFO", json_logs=True)
    worker = Worker()
    loop = asyncio.get_running_loop()
    for sig in (signal.SIGTERM, signal.SIGINT):
        loop.add_signal_handler(sig, worker.request_stop)
    await worker.run()


def main() -> None:
    asyncio.run(_main())


if __name__ == "__main__":
    main()
