"""Der Nur-Lese-Riegel für den öffentlichen Demo-Mandanten (0407).

Aufgerufen zentral aus `core.security.get_current_user` — auf JEDEM geschützten
Endpunkt und unabhängig davon, welche Rolle das Token trägt.

WOZU ES DIESEN RIEGEL BRAUCHT:
Die Marketing-Seite führt Besucher mit „Demo ansehen" in die ECHTE Anwendung
statt in einen eingefrorenen Schnappschuss (Begründung und Anbietervergleich in
`docs/ANALYSE-storylane-technik.md`). Der Zugang dafür ist öffentlich — das
Passwort steht praktisch jedem zur Verfügung, der die Seite besucht. Er darf
deshalb nichts verändern können.

WARUM METHODE UND NICHT ROLLE:
Der naheliegende Weg wäre eine sechste Rolle `demo` mit leeren
Schreib-Capabilities. Gemessen am Bestand wäre das eine Lücke: von 536
schreibenden Routen tragen 201 einen Capability-Guard und 168 einen granularen,
aber **76 haben nur `get_current_user`** — gar keine Rollenprüfung. Darunter
`PATCH /auth/account/password` und `DELETE /auth/account/users/{id}`. Ein
Besucher hätte damit das Passwort des Demo-Kontos ändern und die Demo für alle
anderen sperren können.

Dieser Riegel prüft stattdessen die HTTP-Methode. Das erfasst alle 536 Routen
auf einen Schlag — und jede, die künftig ohne Guard dazukommt, ist automatisch
mitgeschützt. Der Unterschied ist der zwischen einer Liste, die gepflegt werden
muss, und einer Regel, die gilt.

WAS DIESER RIEGEL NICHT LEISTET:
Er schützt den FastAPI-Layer. Der PostgREST-Direktpfad (`/rest/v1` mit gültigem
JWT und öffentlichem anon-Key) läuft nicht durch FastAPI — dort wirkt die RLS.
Das ist hier vertretbar, weil über alle 408 Migrationen KEIN einziges
`grant insert/update/delete` an `authenticated` besteht (251 Tabellen tragen
einen expliziten `revoke`, dazu ein `alter default privileges`-Backstop aus
0229). Die eine Ausnahme war `storybook_chat` — deren Policies schließen den
Demo-Mandanten seit 0407 aus.

WARUM 405 UND NICHT 403:
403 heißt „dir fehlt ein Recht" und lädt dazu ein, es zu erwerben. 405 („Method
Not Allowed") sagt, was zutrifft: dieser Zugang kennt schreibende Methoden
nicht. Die Oberfläche kann daraus einen ehrlichen Hinweis bauen („In der Demo
sind Änderungen abgeschaltet") statt einer Fehlermeldung, die nach einem Defekt
aussieht.

Bewusst in einem eigenen Modul (wie `mfa_gate` und `aktiv_gate`):
`core.security` darf `features.auth` nicht auf Modulebene importieren (Zirkel),
und der Riegel soll für sich testbar sein.
"""
from __future__ import annotations

from fastapi import HTTPException, status

from src.core.logging import get_logger
from src.core.security import AuthContext
from src.core.supabase import get_service_client

log = get_logger("nextdays.auth.demo_gate")

# Lesende Methoden. HEAD und OPTIONS gehören dazu: das eine ist ein GET ohne
# Körper, das andere der CORS-Vorflug — beide verändern nichts, und ein
# blockierter Vorflug würde die Oberfläche im Browser lahmlegen, ohne etwas zu
# schützen.
LESENDE_METHODEN = frozenset({"GET", "HEAD", "OPTIONS"})

# POST-Endpunkte, die NICHTS speichern. Die Sperre urteilt sonst allein nach
# der Methode, und das ist bei diesen dreien falsch: sie lesen ein
# hochgeladenes PDF und geben VORSCHLAEGE zurueck, die erst ein Mensch mit
# einem zweiten, echten Schreibaufruf uebernimmt. Sie sind POST, weil eine
# Datei im Koerper mitkommt, nicht weil sie etwas aendern.
#
# Ohne diese Ausnahme ist die Vorfuehrung an genau der Stelle stumm, an der
# sie am meisten zeigt — und der Besucher liest „Aenderungen sind
# abgeschaltet" bei einer Funktion, die nichts aendert.
#
# Bewusst eine Endstueck-Liste und kein Praefix: sie soll NICHT mitwachsen,
# wenn jemand spaeter einen echten Schreib-Endpunkt darunter haengt. Wer hier
# etwas eintraegt, muss belegen, dass der Endpunkt nichts schreibt.
_LESENDE_POSTS = (
    "/inventar/import",
    "/mappe/gast/dokumente/lesen",
    "/mappe/haus/dokumente/lesen",
)

_ABGELEHNT = (
    "In der Vorführung sind Änderungen abgeschaltet. "
    "Alles lässt sich ansehen, nichts speichern."
)


def demo_schreibzugriff_pruefen(
    methode: str, ctx: AuthContext, pfad: str = ""
) -> None:
    """Wirft 405, wenn ein Demo-Mandant etwas zu ändern versucht.

    Die Prüfung kostet eine DB-Runde je SCHREIBENDER Anfrage — lesende gehen
    ohne Abfrage durch, und das ist der überwiegende Teil. Der Index aus 0407
    ist partiell auf `is_demo`, die Abfrage trifft also nur die eine Zeile.

    Ein Lesefehler ist KEIN „darf schreiben": bei einem Datenbankausfall wäre
    fail-open genau die falsche Richtung — dann könnte ein Besucher schreiben,
    weil die Prüfung nicht antwortet. Fail-CLOSED heißt hier 503 für den
    Schreibversuch (Wurzel 5); Lesen bleibt unberührt, die Demo funktioniert
    also weiter.

    Ein API-Client-Token (Client-Credentials) wird übersprungen: dahinter steht
    kein Demo-Besucher, sondern eine Integration mit eigenem Secret und
    eigenen Scopes.

    `pfad` erlaubt die Ausnahme für die wenigen POSTs, die nichts speichern
    (`_LESENDE_POSTS`). Ohne ihn urteilt die Sperre allein nach der Methode
    und weist auch das reine Lesen eines hochgeladenen PDF ab.
    """
    if methode.upper() in LESENDE_METHODEN:
        return
    if pfad and pfad.endswith(_LESENDE_POSTS):
        return
    if ctx.api_scopes is not None:
        return
    if not ctx.tenant_id:
        return
    try:
        res = (
            get_service_client()
            .table("tenants")
            .select("is_demo, ist_vorfuehrbetrieb")
            .eq("id", ctx.tenant_id)
            .limit(1)
            .execute()
        )
    except Exception as exc:  # noqa: BLE001 — fail-closed, aber sichtbar
        log.warning(
            "demo_gate_lesefehler",
            tenant_id=ctx.tenant_id,
            error=str(exc)[:200],
        )
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Zugang konnte nicht geprüft werden.",
        ) from exc
    rows = res.data or []
    if rows and rows[0].get("ist_vorfuehrbetrieb"):
        return
    if rows and rows[0].get("is_demo"):
        log.info(
            "demo_gate_abgewiesen",
            tenant_id=ctx.tenant_id,
            user_id=ctx.user_id,
            methode=methode.upper(),
        )
        raise HTTPException(
            status_code=status.HTTP_405_METHOD_NOT_ALLOWED,
            detail=_ABGELEHNT,
        )


# ---------------------------------------------------------------------------
# Gesperrte Bereiche (reiner Code-Riegel, KEINE Migration)
# ---------------------------------------------------------------------------
# Manche Bereiche sollen in der Vorführung gar nicht EINSEHBAR sein, nicht bloß
# unveränderlich: Buchhaltung, Eigentümer-Reporting, Kanalmanager, Konto samt
# Abrechnung, Werkzeuge. Es sind die Bereiche mit Finanz-, Vertrags- und
# Zugangsdaten — in der Demo stehen dort Beispielwerte, aber die Oberfläche
# zeigt daneben Preise, Provisionen und Portal-Zugänge, die kein anonymer
# Besucher sehen soll.
#
# WARUM DER RIEGEL IM BACKEND SITZT UND NICHT NUR IN DER SIDEBAR:
# Ein ausgegrauter Menüpunkt ist Optik. Wer die URL kennt (`/buchhaltung`) oder
# die Netzwerkkonsole öffnet, ruft `/api/v1/buchhaltung/...` direkt auf und
# bekommt die Daten trotzdem. Gesperrt ist ein Bereich erst, wenn die API ihn
# verweigert — die Oberfläche macht die Sperre nur SICHTBAR.
#
# WARUM PRÄFIXE UND KEINE ROUTEN-LISTE:
# Ein Bereich besteht aus Dutzenden Endpunkten, und es kommen laufend welche
# dazu. Eine Liste einzelner Routen wäre am Tag ihrer Erstellung veraltet; ein
# Präfix deckt auch jede künftige Unterseite (`/channel-manager/<neu>`).
GESPERRTE_PRAEFIXE: tuple[str, ...] = (
    "/buchhaltung",          # Buchhaltung samt Abrechnungsregeln
    "/owner-reporting",      # Eigentümer-Reporting
    "/owner-statements",     # Eigentümer-Abrechnungen
    "/owner-billing",        # Eigentümer-Abrechnung
    "/owners",               # Eigentümer
    "/channel-manager",      # Kanalmanager mit ALLEN Unterseiten
    "/site-config",          # Website-Baukasten
    "/subscriptions",        # Konto/Abrechnung des Betriebs
    "/payouts",              # Auszahlungen
    "/payments",             # Zahlungen
    "/taxpayer",             # Steuerliche Angaben
    "/travel-agencies",      # Reisebüros
    "/crm",                  # Firmen/Kategorien
    "/login-devices",        # Konto: Geräteverlauf
    "/privacy-settings",     # Konto: Datenschutz
    # --- 02.09.2026 nachgezogen ---
    # Diese Bereiche trugen in der Sidebar (`web/lib/demo-sperre.ts`) längst ein
    # Schloss, ohne dass die API sie verweigerte: das Menü zeigte „gesperrt",
    # ein Aufruf per URL lieferte die Daten trotzdem. Genau der Fall, den der
    # Absatz oben als Optik beschreibt.
    "/tasks",                # Aufgaben (Frontend: /aufgaben, /reservierungen/aufgaben)
    "/booking-conditions",   # Einstellungen: Buchungsbedingungen
    "/calendar/block-requests",  # Kalender: Sperranträge
)

# Einzelne Endpunkte, die gesperrt sind, OHNE dass ihr Präfix es ist.
#
# WARUM ES DIESE ZWEITE LISTE BRAUCHT: `/pricing` darf NICHT als Präfix
# gesperrt werden — darunter hängen die Preise, die Promotions und das
# Rate-Grid, also das, was eine Vorführung gerade zeigen soll (`/pricing`
# speist `lib/pricing.ts`, `lib/promotions.ts` und `lib/subscriptions.ts`).
# Gesperrt ist nur das Dynamic-Pricing-Panel, und das sitzt auf zwei
# Unterpfaden desselben Routers. Ein Präfix hätte hier die halbe Demo
# mitgenommen.
GESPERRTE_ENDPUNKTE: tuple[str, ...] = (
    "/pricing/overview",     # Dynamic Pricing: Übersicht
    "/pricing/settings",     # Dynamic Pricing: Regeln je Objekt
    "/pricing/explain",      # Dynamic Pricing: Preisherleitung
)

_BEREICH_GESPERRT = (
    "Dieser Bereich ist in der Vorführung nicht freigegeben. "
    "Im eigenen Betrieb steht er vollständig zur Verfügung."
)


def demo_bereich_pruefen(pfad: str, ctx: AuthContext) -> None:
    """Wirft 403, wenn ein Demo-Besucher einen gesperrten Bereich aufruft.

    Anders als `demo_schreibzugriff_pruefen` gilt das auch für LESENDE
    Anfragen — der Bereich soll gar nicht einsehbar sein.

    Hier ist 403 richtig und nicht 405: die Methode ist in Ordnung, der Zugang
    fehlt. Die Oberfläche baut daraus den Hinweis „in der Vorführung gesperrt".

    Reihenfolge im Aufrufer: dieser Riegel läuft VOR der Methodenprüfung, damit
    ein gesperrter Bereich denselben Grund nennt, egal ob gelesen oder
    geschrieben wird.
    """
    if ctx.api_scopes is not None:
        return
    if not ctx.tenant_id:
        return
    if not _pfad_gesperrt(pfad):
        return
    if not _ist_demo_mandant(ctx):
        return
    if _ist_vorfuehrbetrieb(ctx):
        return
    log.info(
        "demo_gate_bereich_abgewiesen",
        tenant_id=ctx.tenant_id,
        user_id=ctx.user_id,
        pfad=pfad,
    )
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail=_BEREICH_GESPERRT,
    )


def _pfad_gesperrt(pfad: str) -> bool:
    """Liegt der Pfad in einem gesperrten Bereich?

    Verglichen wird ohne das Versions-Präfix, damit die Liste die fachlichen
    Pfade nennt und nicht `/api/v1/...` wiederholt. Der Vergleich endet am
    Segment (`/owners` trifft `/owners/17`, aber nicht `/owners-public`).
    """
    rest = pfad.split("/api/v1", 1)[-1] if "/api/v1" in pfad else pfad
    return any(
        rest == p or rest.startswith(p + "/")
        for p in (*GESPERRTE_PRAEFIXE, *GESPERRTE_ENDPUNKTE)
    )


def _ist_vorfuehrbetrieb(ctx: AuthContext) -> bool:
    """Fragt `tenants.ist_vorfuehrbetrieb` (0630).

    Fuer diesen einen Betrieb gelten die Vorfuehr-Riegel nicht: An ihm wird
    Skattestyrelsen der komplette DAC7-Weg gezeigt, von den Daten des
    Betriebs ueber die Verschluesselung bis zur Quittung der
    Empfangsstelle. Das geht nicht mit einem Zugang, der weder die
    Steuerseite oeffnen noch einen Meldelauf anlegen darf.

    Ein Lesefehler hebt NICHTS auf: `False` ist hier die restriktive
    Antwort, der Riegel bleibt dann stehen. Das ist die richtige Richtung —
    faellt die Abfrage aus, ist eine nicht vorfuehrbare Demo das kleinere
    Uebel als eine schreibbare (Wurzel 5).

    Was hierdurch NICHT faellt: RLS, der Mandanten-Scope jeder Abfrage und
    die Capability-Pruefung der Endpunkte. Der Vorfuehrbetrieb kann genau
    das, was sein eigener Admin koennte — nicht mehr.
    """
    try:
        res = (
            get_service_client()
            .table("tenants")
            .select("ist_vorfuehrbetrieb")
            .eq("id", ctx.tenant_id)
            .limit(1)
            .execute()
        )
    except Exception as exc:  # noqa: BLE001 — Riegel bleibt stehen
        log.warning(
            "vorfuehrbetrieb_lesefehler",
            tenant_id=ctx.tenant_id,
            error=str(exc)[:200],
        )
        return False
    rows = res.data or []
    return bool(rows and rows[0].get("ist_vorfuehrbetrieb"))


def _ist_demo_mandant(ctx: AuthContext) -> bool:
    """Fragt `tenants.is_demo`; ein Lesefehler sperrt NICHT.

    Andere Richtung als beim Schreib-Riegel, und zwar bewusst: dort wäre
    fail-open die Erlaubnis zu schreiben, hier wäre fail-closed eine Sperre für
    ZAHLENDE Betriebe, sobald die Abfrage einmal nicht antwortet. Ein Demo-
    Besucher, der bei einem DB-Ausfall kurz die Buchhaltung sieht, ist das
    kleinere Übel als ein Kunde, der seine nicht mehr sieht.
    """
    try:
        res = (
            get_service_client()
            .table("tenants")
            .select("is_demo")
            .eq("id", ctx.tenant_id)
            .limit(1)
            .execute()
        )
    except Exception as exc:  # noqa: BLE001 — Störung darf Kunden nicht sperren
        log.warning(
            "demo_gate_bereich_lesefehler",
            tenant_id=ctx.tenant_id,
            error=str(exc)[:200],
        )
        return False
    rows = res.data or []
    return bool(rows and rows[0].get("is_demo"))
