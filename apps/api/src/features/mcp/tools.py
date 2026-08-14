"""Die MCP-Werkzeuge: Kalender, Buchungen, Preise, Aufgaben, Posteingang.

Jedes Werkzeug ruft denselben Service-Layer wie die Weboberfläche — es gibt
keine zweite Fachlogik hier. Der MCP-Server ist ein Transport, kein
Parallel-Backend.

ACHTUNG, HIER LIEGT DER SCHARFE PUNKT (geprüft 14.08.2026, Wurzel 3 + 9):
Der Service-Layer prüft die BERECHTIGUNG in aller Regel NICHT selbst — das tut
die Route über `require_permission`/`require_granular_permission`. Und `ctx:
AuthContext` in einer Signatur heisst NICHT, dass geprüft wird: `rates/service`
etwa enthält kein einziges `has_capability`, es zieht aus `ctx` nur die
`tenant_id`. Genauso `calendar`, `tasks`, `owners`, `buchhaltung`.

Der MCP-Pfad hat keine solche Route. Ohne eigene Prüfung könnte hier jede Rolle
mit gültigem Token schreiben — auch eine Reinigungskraft, die ihr privates
Konto verbunden hat. `calendar/service.py:200-205` verzichtet sogar ausdrücklich
auf den Owner-Scope in den Schreibpfaden, mit der Begründung, die Owner-Rolle
besitze MANAGE_CALENDAR ohnehin nie — eine Annahme, die genau dann bricht, wenn
der Aufrufer sie nicht prüft.

Deshalb steht die Berechtigung an EINER Stelle in der Werkzeug-Tabelle
(`_WERKZEUGE`) und wird zentral in `ausfuehren` erzwungen, nicht in jedem
Werkzeug einzeln. Ein neues Werkzeug ohne Eintrag ist dadurch gesperrt, nicht
offen (fail-closed) — die Alternative wäre eine Prüfung, die man beim zwölften
Werkzeug vergisst.

DIE ZWEITE HÄLFTE, die beim ersten Bau fehlte: Der Riegel ersetzt die Route bei
der ERLAUBNIS, aber er kann die Objekt-SCOPES nicht ersetzen, die tief in den
Services an `ctx.role` hängen (`is_owner`, `is_staff`). Der Router liefert
`role=None`; damit wären beide immer `False` und der Scope „nur meine Objekte"
fiele ersatzlos weg. Jeder Service-Aufruf geht deshalb über `self.ctx()` — den
Kontext MIT der frisch aus der DB gelesenen Rolle. Nie über `self._ctx`.
Ebenso wird die Fähigkeit über `effective_capabilities` geprüft, nicht über
`has_capability`: nur so wirkt ein entzogenes PM-Dach auch hier.

WAS ES BEWUSST NICHT GIBT: Werkzeuge für den Konto-Bereich (`/konto`) — Abo,
Rechnungen, Nutzerverwaltung, Sicherheit, API-Zugang und die MCP-Verbindungen
selbst. Dort sitzen Rechtevergabe und Geldfluss DES BETRIEBS. Ein Assistent, der
seinen eigenen Zugriff erweitern könnte, hätte keine Grenze, sondern eine Bitte.

Warum EIN Posteingangs-Werkzeug statt zwei: Für den Betrieb ist der Posteingang
ein Posteingang. Er fragt „was hat der Gast geschrieben", nicht „über welches
System kam das". Die Quellen (OTA über Channex, myBestDays-Marktplatz,
übernommene Verläufe) führt der Service zusammen; der Kanal steht als Feld an
jedem Thread. Zwei Werkzeuge hätten das Modell raten lassen, in welchem es
suchen soll — und ein Fehlgriff hätte „nichts gefunden" geheißen, obwohl die
Nachricht im anderen lag.
"""
from __future__ import annotations

from dataclasses import dataclass
from datetime import date, timedelta
from typing import Any

from src.core.logging import get_logger
from src.core.security import AuthContext
from src.core.supabase import get_service_client
from src.features.auth.granular_permissions import (
    Permission,
    has_pm_access,
    load_permission,
)
from src.features.auth.permissions import Capability, effective_capabilities
from src.features.calendar.schemas import BlockRequest, DateRange
from src.features.calendar.service import CalendarError, CalendarService
from src.features.inbox.errors import InboxError
from src.features.inbox.service import InboxService
from src.features.rates.service import RateError, RatesService
from src.features.reservations.schemas import ReservationNoteCreate
from src.features.reservations.service import ReservationError, ReservationsService
from src.features.tasks.service import TaskError, TasksService

from .grenzen import (
    MAX_AUFGABEN,
    MAX_BEWERTUNGEN,
    MAX_BUCHUNGEN,
    MAX_GAESTE,
    MAX_NACHRICHT_ZEICHEN,
    MAX_NOTIZEN,
    MAX_OBJEKTE,
    MAX_SCHREIB_TAGE,
    MAX_TAGE,
    MAX_THREADS,
)
from .helfer import _pflicht
from .katalog import LESE_KATALOG, SCHREIB_KATALOG
from .oauth_service import SCOPE_FREITEXT, SCOPE_SCHREIBEN
from .stammdaten import StammdatenMixin
from .vertrieb import VertriebMixin

log = get_logger("nextdays.mcp.tools")

# Wächter für „Rolle noch nicht geladen" — `None` bedeutet „geladen, keine
# Rolle" und darf davon unterscheidbar bleiben.
_UNGESETZT = object()


@dataclass(frozen=True)
class _Werkzeug:
    """Ein Werkzeug samt seiner Berechtigung — die EINE Quelle der Wahrheit.

    `caps`/`perms` sind die Rechte, die sonst die Route erzwingen würde. Sie
    stehen hier, weil der MCP-Pfad keine Route hat (siehe Modulkopf).

    `schreibt` steuert zweierlei: den Scope-Zwang (`mcp:write`) und den
    `readOnlyHint` im Katalog, an dem der Client erkennt, ob er vor der
    Ausführung nachfragen soll.
    """

    handler: str
    ziel_feld: str | None = None
    schreibt: bool = False
    # Rollen-Fähigkeiten (permissions.Capability) — ALLE müssen vorliegen.
    caps: tuple[Capability, ...] = ()
    # Granulare Rechte (granular_permissions.Permission) — ALLE müssen vorliegen.
    perms: tuple[Permission, ...] = ()
    # Braucht das Werkzeug die Freitext-Freigabe (Art. 9 DSGVO)?
    freitext: bool = False


def _tage_pruefen(start: date, ende: date) -> None:
    if ende <= start:
        raise ValueError("ende muss nach start liegen")
    if (ende - start).days > MAX_TAGE:
        raise ValueError(f"Zeitraum zu groß (max. {MAX_TAGE} Tage)")


def _umfang(ergebnis: dict[str, Any]) -> int:
    """Wie viele Datensätze gingen heraus? Für den Zugriffslog (0388).

    Macht einen Massenabruf im Log sichtbar — „1 Buchung gelesen" und „100
    Buchungen gelesen" sind für eine Auskunft nach Art. 15 DSGVO ein
    Unterschied. Zählt die erste Liste im Ergebnis; findet sich keine, ist es
    ein Einzelabruf (1).
    """
    for wert in ergebnis.values():
        if isinstance(wert, list):
            return len(wert)
    return 1


def _grenze(wert: object, maximum: int, standard: int = 20) -> int:
    """Limit deckeln (Wurzel 8). Unsinn → Standard statt Absturz."""
    try:
        gewuenscht = int(wert) if wert else standard
    except (TypeError, ValueError):
        gewuenscht = standard
    return max(1, min(gewuenscht, maximum))


def _iso(wert: object) -> str | None:
    """Datum/Zeit als ISO-Text; `None` bleibt `None` (Wurzel 4)."""
    if wert is None:
        return None
    return wert.isoformat() if hasattr(wert, "isoformat") else str(wert)


def _als_datum(wert: str | None, ersatz: date) -> date:
    """ISO-Datum lesen; leer → `ersatz`. Ungültiges Datum ist ein Fehler.

    Bewusst kein stiller Rückfall auf heute bei Unsinn: ein Modell, das
    `2026-13-01` schickt, soll das erfahren, statt Daten für einen anderen
    Zeitraum zu bekommen und sie für die angefragten zu halten (Wurzel 4).
    """
    if not wert:
        return ersatz
    return date.fromisoformat(wert)


# Die SCHREIB-Werkzeuge. Eigene Liste, damit im Katalog auf einen Blick zu
# sehen ist, was verändert — und damit der Warnhinweis in jeder Beschreibung
# steht, statt einmal im Kopf und dann vergessen.
#
# Jede Beschreibung nennt die Folge ausdrücklich („geht live an die Portale").
# Das ist keine Höflichkeit: Das Modell entscheidet danach, ob es rückfragt.


class McpTools(StammdatenMixin, VertriebMixin):
    """Werkzeug-Implementierungen über dem bestehenden Service-Layer.

    Objekt- und Eigentümerverwaltung liegen in `StammdatenMixin` (eigene
    Datei) — ihre RECHTE stehen aber weiterhin hier in `_WERKZEUGE`, damit
    die Rechtetabelle vollständig an EINER Stelle lesbar bleibt.
    """

    def __init__(
        self,
        ctx: AuthContext,
        scopes: frozenset[str] = frozenset(),
        client_id: str = "",
    ) -> None:
        self._ctx = ctx
        self._db = get_service_client()
        self._scopes = scopes
        self._client_id = client_id
        # `None` ist ein gültiges Ergebnis (Nutzer ohne Rolle) und taugt darum
        # nicht als „noch nicht geladen". Ein eigener Wächter unterscheidet
        # beides, statt bei jedem Aufruf erneut zu fragen.
        self._rolle_cache: object = _UNGESETZT
        # Die gespeicherten Rechte derselben Zeile — für das PM-Dach.
        self._rechte_cache: object = None

    def _darf_freitext(self) -> bool:
        """Sind Notizen und Nachrichtentexte für diese Verbindung freigegeben?

        Getrennt vom Lese-Scope, weil in Freitexten regelmässig besondere
        Kategorien nach Art. 9 DSGVO stehen (Gesundheit: „Rollstuhl",
        „Allergie"). Die Weboberfläche zeigt sie jedem, der den Thread öffnen
        darf — das ist dort richtig. Hier verlassen sie unsere Systeme, und
        dafür braucht es die ausdrückliche Freigabe des Betriebs.
        """
        return SCOPE_FREITEXT in self._scopes

    def _protokollieren(
        self, werkzeug: str, *, ziel: str | None, anzahl: int, erfolg: bool
    ) -> None:
        """Den Abruf im Zugriffslog vermerken (0388).

        Best-effort: Ein fehlgeschlagener Log darf die Antwort nicht kippen —
        aber er wird geloggt, damit ein stiller Ausfall auffällt. Ohne die
        Aufzeichnung könnte der Betrieb weder eine Auskunft nach Art. 15 DSGVO
        erteilen noch seine Rechenschaftspflicht erfüllen.

        Bewusst OHNE Inhalte: was abgerufen wurde, nicht was drinstand.
        """
        try:
            self._db.table("mcp_access_log").insert({
                "tenant_id": self._ctx.tenant_id,
                "user_id": self._ctx.user_id or None,
                "client_id": self._client_id,
                "werkzeug": werkzeug,
                "ziel_id": ziel,
                "anzahl": anzahl,
                "scopes": " ".join(sorted(self._scopes)),
                "erfolg": erfolg,
            }).execute()
        except Exception:  # noqa: BLE001 — Nebenpfad, kippt den Hauptpfad nie
            log.warning("mcp.zugriffslog_fehlgeschlagen", extra={
                "werkzeug": werkzeug, "tenant_id": self._ctx.tenant_id,
            })

    @staticmethod
    def _freitext_hinweis() -> str:
        """Ehrlicher Platzhalter statt leerem Feld (Wurzel 4).

        Ein stilles `null` liesse das Modell glauben, es gebe keine Notiz —
        und der Nutzer bekäme „dazu ist nichts hinterlegt" statt „dafür fehlt
        die Freigabe". Der Unterschied ist für ihn entscheidend.
        """
        return (
            "[nicht freigegeben — Freitexte (Notizen, Nachrichten) sind für "
            "diese Verbindung gesperrt. Freigabe unter Konto → Verbindungen "
            "über das Häkchen 'Freitexte freigeben' an dieser Verbindung; "
            "ein Neuverbinden ist dafür nicht nötig.]"
        )

    # -- Katalog ------------------------------------------------------------

    @classmethod
    def katalog(cls, scopes: frozenset[str] = frozenset()) -> list[dict[str, Any]]:
        """Werkzeug-Beschreibungen für `tools/list`, gefiltert nach Scope.

        Die `description` ist für ein MODELL geschrieben, nicht für einen
        Menschen: sie sagt, wann das Werkzeug das richtige ist und was die
        Grenzen sind — sonst rät das Modell und ruft das falsche auf.

        `title` ist dagegen der ANZEIGENAME für den Betrieb. Ohne ihn formt der
        Client den technischen `name` um und zeigt „Kalender verfuegbarkeit" —
        der `name` ist ASCII, weil er programmatisch adressiert wird. Die
        Reihenfolge ist laut Spec `title` → `annotations.title` → `name`;
        beide werden gesetzt, weil ältere Clients nur die Annotation kennen.

        WARUM GEFILTERT (und nicht mehr statisch): Solange alles nur las, war
        die Liste für jede Verbindung dieselbe. Mit Schreibwerkzeugen wäre das
        eine Falle — eine Verbindung ohne `mcp:write` bekäme sie angeboten, das
        Modell versuchte sie, und der Nutzer sähe eine Fehlermeldung statt eines
        Ergebnisses. Angeboten wird nur, was diese Verbindung auch darf.

        Die Hinweise stammen aus der Registry, nicht aus handgepflegten Werten:
        `readOnlyHint` ist die Umkehrung von `schreibt`. Ein Werkzeug, das
        schreibt, aber „nur lesend" behauptete, brächte den Client dazu, die
        Rückfrage beim Nutzer zu überspringen.
        """
        eintraege = [
            e for e in cls._KATALOG
            if not cls._WERKZEUGE[e["name"]].schreibt
            or SCOPE_SCHREIBEN in scopes
        ]
        for e in eintraege:
            wz = cls._WERKZEUGE[e["name"]]
            e["annotations"] = {**e.get("annotations", {}),
                                "readOnlyHint": not wz.schreibt}
            if wz.schreibt:
                # Sagt dem Client: vor Ausführung den Nutzer fragen. Diese
                # Aufrufe gehen über Channex live an die Portale.
                e["annotations"]["destructiveHint"] = True
                e["annotations"]["openWorldHint"] = True
        return eintraege

    # Die Beschreibungen. Getrennt von der Registry, weil hier der TEXT steht
    # (für das Modell), dort die RECHTE (für den Riegel) — zwei Dinge, die sich
    # unabhängig voneinander ändern.
    _KATALOG = LESE_KATALOG + SCHREIB_KATALOG

    # -- Ausführung ---------------------------------------------------------

    # DIE REGISTRY. Werkzeug → Handler + Berechtigung + Ziel-Feld.
    #
    # Warum eine Tabelle statt Prüfungen in den Methoden: Die Rechte, die sonst
    # am Router hängen, sind hier vollständig an EINER Stelle sichtbar und
    # vergleichbar. Ein Werkzeug ohne Eintrag existiert nicht (fail-closed).
    #
    # Die Rechte sind aus den echten Routern übernommen (geprüft 14.08.2026),
    # nicht geschätzt: Kalender-Schreibpfade tragen im Router BEIDE Systeme
    # (Capability.MANAGE_CALENDAR und Permission.EDIT_CALENDAR_BOOKINGS),
    # rates hängt allein an Permission.MANAGE_PROPERTY_SETTINGS, tasks an
    # Capability.MANAGE_TASKS bzw. VIEW_OWN_TASKS, der Posteingang an
    # Permission.PM_CHAT plus INBOX_REPLY für das Senden.
    _WERKZEUGE: dict[str, _Werkzeug] = {
        # -- Lesen ----------------------------------------------------------
        "kalender_verfuegbarkeit": _Werkzeug(
            "_kalender", "objekt_id", caps=(Capability.VIEW_CALENDAR,)
        ),
        "buchungen_liste": _Werkzeug(
            "_buchungen", "objekt_id", caps=(Capability.VIEW_CALENDAR,)
        ),
        "buchung_detail": _Werkzeug(
            "_buchung_detail", "buchung_id", caps=(Capability.VIEW_CALENDAR,)
        ),
        "objekte_liste": _Werkzeug("_objekte"),
        "objekt_detail": _Werkzeug("_objekt_detail", "objekt_id"),
        "preise_lesen": _Werkzeug(
            "_preise_lesen", "objekt_id", caps=(Capability.VIEW_CALENDAR,)
        ),
        "aufgaben_liste": _Werkzeug(
            "_aufgaben", caps=(Capability.VIEW_OWN_TASKS,)
        ),
        "gaeste_liste": _Werkzeug(
            "_gaeste", perms=(Permission.PM_GUEST_DETAILS,)
        ),
        "bewertungen_liste": _Werkzeug(
            "_bewertungen", caps=(Capability.VIEW_REVIEWS,)
        ),
        "posteingang_liste": _Werkzeug(
            "_posteingang", perms=(Permission.PM_CHAT,)
        ),
        "posteingang_verlauf": _Werkzeug(
            "_verlauf", "thread_id",
            perms=(Permission.PM_CHAT,), freitext=True,
        ),
        # Notizen hängen am eigenen Recht PM_VIEW_NOTES, nicht bloss am
        # Kalender-Blick: eine Rolle darf Buchungen sehen, ohne die internen
        # Vermerke dazu zu lesen.
        "buchung_notizen": _Werkzeug(
            "_notizen", "buchung_id",
            caps=(Capability.VIEW_CALENDAR,),
            perms=(Permission.PM_VIEW_NOTES,), freitext=True,
        ),
        # -- Schreiben ------------------------------------------------------
        "kalender_sperren": _Werkzeug(
            "_sperren", "objekt_id", schreibt=True,
            caps=(Capability.MANAGE_CALENDAR,),
            perms=(Permission.EDIT_CALENDAR_BOOKINGS,),
        ),
        "kalender_entsperren": _Werkzeug(
            "_entsperren", "objekt_id", schreibt=True,
            caps=(Capability.MANAGE_CALENDAR,),
            perms=(Permission.EDIT_CALENDAR_BOOKINGS,),
        ),
        "preis_setzen": _Werkzeug(
            "_preis_setzen", "objekt_id", schreibt=True,
            caps=(Capability.MANAGE_CALENDAR,),
            perms=(Permission.EDIT_CALENDAR_BOOKINGS,),
        ),
        "stop_sell_setzen": _Werkzeug(
            "_stop_sell", "objekt_id", schreibt=True,
            caps=(Capability.MANAGE_CALENDAR,),
            perms=(Permission.EDIT_CALENDAR_BOOKINGS,),
        ),
        "restriktionen_setzen": _Werkzeug(
            "_restriktionen", "objekt_id", schreibt=True,
            caps=(Capability.MANAGE_CALENDAR,),
            perms=(Permission.EDIT_CALENDAR_BOOKINGS,),
        ),
        "buchung_stornieren": _Werkzeug(
            "_stornieren", "buchung_id", schreibt=True,
            caps=(Capability.MANAGE_CALENDAR,),
            perms=(Permission.EDIT_CALENDAR_BOOKINGS,),
        ),
        "buchung_verschieben": _Werkzeug(
            "_verschieben", "buchung_id", schreibt=True,
            caps=(Capability.MANAGE_CALENDAR,),
            perms=(Permission.EDIT_CALENDAR_BOOKINGS,),
        ),
        "notiz_anlegen": _Werkzeug(
            "_notiz_anlegen", "buchung_id", schreibt=True,
            caps=(Capability.VIEW_CALENDAR,),
            perms=(Permission.PM_VIEW_NOTES,), freitext=True,
        ),
        "nachricht_senden": _Werkzeug(
            "_nachricht_senden", "thread_id", schreibt=True,
            perms=(Permission.PM_CHAT, Permission.INBOX_REPLY),
            freitext=True,
        ),
        "aufgabe_anlegen": _Werkzeug(
            "_aufgabe_anlegen", schreibt=True, caps=(Capability.MANAGE_TASKS,)
        ),
        "aufgabe_abschliessen": _Werkzeug(
            "_aufgabe_abschliessen", "aufgabe_id", schreibt=True,
            caps=(Capability.VIEW_OWN_TASKS,),
        ),
        # -- Objektverwaltung -----------------------------------------------
        #
        # Die Rechte folgen dem Router genau: ANLEGEN, LÖSCHEN, Veröffentlichen
        # und die Struktur (Einheitenzahl) hängen an MANAGE_PROPERTY_SETTINGS,
        # das reine ÄNDERN an EDIT_PROPERTY, die Bilder an einem eigenen Recht.
        # Ein Betrieb kann jemandem also das Pflegen erlauben, ohne ihm das
        # Anlegen und Löschen zu geben — diese Abstufung darf hier nicht
        # verlorengehen, indem alles unter ein Recht gestellt wird.
        "objekt_anlegen": _Werkzeug(
            "_objekt_anlegen", schreibt=True,
            perms=(Permission.MANAGE_PROPERTY_SETTINGS,),
        ),
        "objekt_aendern": _Werkzeug(
            "_objekt_aendern", "objekt_id", schreibt=True,
            perms=(Permission.EDIT_PROPERTY,),
        ),
        "objekt_loeschen": _Werkzeug(
            "_objekt_loeschen", "objekt_id", schreibt=True,
            perms=(Permission.MANAGE_PROPERTY_SETTINGS,),
        ),
        "objekt_veroeffentlichen": _Werkzeug(
            "_objekt_veroeffentlichen", "objekt_id", schreibt=True,
            perms=(Permission.MANAGE_PROPERTY_SETTINGS,),
        ),
        "objekt_duplizieren": _Werkzeug(
            "_objekt_duplizieren", "objekt_id", schreibt=True,
            perms=(Permission.MANAGE_PROPERTY_SETTINGS,),
        ),
        "objekt_einheiten_setzen": _Werkzeug(
            "_einheiten_setzen", "objekt_id", schreibt=True,
            perms=(Permission.MANAGE_PROPERTY_SETTINGS,),
        ),
        "objekt_inhalte_neu_senden": _Werkzeug(
            "_inhalte_neu_senden", "objekt_id", schreibt=True,
            perms=(Permission.MANAGE_PROPERTY_SETTINGS,),
        ),
        "objekt_fotos_ordnen": _Werkzeug(
            "_fotos_ordnen", "objekt_id", schreibt=True,
            perms=(Permission.PM_MANAGE_PROPERTY_IMAGES,),
        ),
        "objekt_foto_aendern": _Werkzeug(
            "_foto_aendern", "objekt_id", schreibt=True,
            perms=(Permission.PM_MANAGE_PROPERTY_IMAGES,),
        ),
        "objekt_foto_loeschen": _Werkzeug(
            "_foto_loeschen", "objekt_id", schreibt=True,
            perms=(Permission.PM_MANAGE_PROPERTY_IMAGES,),
        ),
        "objekt_zimmer_anlegen": _Werkzeug(
            "_zimmer_anlegen", "objekt_id", schreibt=True,
            perms=(Permission.EDIT_PROPERTY,),
        ),
        "objekt_zimmer_aendern": _Werkzeug(
            "_zimmer_aendern", "objekt_id", schreibt=True,
            perms=(Permission.EDIT_PROPERTY,),
        ),
        "objekt_zimmer_loeschen": _Werkzeug(
            "_zimmer_loeschen", "objekt_id", schreibt=True,
            perms=(Permission.EDIT_PROPERTY,),
        ),
        # -- Eigentümerverwaltung -------------------------------------------
        "eigentuemer_liste": _Werkzeug(
            "_eigentuemer", caps=(Capability.MANAGE_OWNERS,)
        ),
        "eigentuemer_detail": _Werkzeug(
            "_eigentuemer_detail", "eigentuemer_id",
            caps=(Capability.MANAGE_OWNERS,),
        ),
        "eigentuemer_anlegen": _Werkzeug(
            "_eigentuemer_anlegen", schreibt=True,
            caps=(Capability.MANAGE_OWNERS,),
        ),
        "eigentuemer_aendern": _Werkzeug(
            "_eigentuemer_aendern", "eigentuemer_id", schreibt=True,
            caps=(Capability.MANAGE_OWNERS,),
        ),
        "eigentuemer_loeschen": _Werkzeug(
            "_eigentuemer_loeschen", "eigentuemer_id", schreibt=True,
            caps=(Capability.MANAGE_OWNERS,),
        ),
        "eigentuemer_objekt_zuordnen": _Werkzeug(
            "_objekt_zuordnen", "eigentuemer_id", schreibt=True,
            caps=(Capability.MANAGE_OWNERS,),
        ),
        "eigentuemer_objekt_entziehen": _Werkzeug(
            "_objekt_entziehen", "eigentuemer_id", schreibt=True,
            caps=(Capability.MANAGE_OWNERS,),
        ),
        # Der Portalzugang legt einen LOGIN an — das ist Nutzerverwaltung und
        # hängt im Router deshalb an MANAGE_STAFF, nicht an MANAGE_OWNERS.
        # Diese Trennung übernehmen, statt sie einzuebnen.
        "eigentuemer_portalzugang_einladen": _Werkzeug(
            "_portalzugang_einladen", "eigentuemer_id", schreibt=True,
            caps=(Capability.MANAGE_OWNERS, Capability.MANAGE_STAFF),
        ),
        # -- Preise und Raten -----------------------------------------------
        # `rates` hängt im Router durchweg an MANAGE_PROPERTY_SETTINGS —
        # auch die Lesepfade, ausdrücklich so gewollt.
        "raten_liste": _Werkzeug(
            "_raten", "objekt_id",
            perms=(Permission.MANAGE_PROPERTY_SETTINGS,),
        ),
        "grundpreis_setzen": _Werkzeug(
            "_grundpreis_setzen", "objekt_id", schreibt=True,
            perms=(Permission.MANAGE_PROPERTY_SETTINGS,),
        ),
        "tagespreise_setzen": _Werkzeug(
            "_tagespreise_setzen", "rate_id", schreibt=True,
            perms=(Permission.MANAGE_PROPERTY_SETTINGS,),
        ),
        "mindestaufenthalt_setzen": _Werkzeug(
            "_mindestaufenthalt_setzen", "rate_id", schreibt=True,
            perms=(Permission.MANAGE_PROPERTY_SETTINGS,),
        ),
        # -- Saisonpreise ---------------------------------------------------
        # Die Saison-Routen tragen im Router BEIDE Rechtesysteme.
        "saisons_liste": _Werkzeug(
            "_saisons", "objekt_id", caps=(Capability.VIEW_CALENDAR,)
        ),
        "saison_anlegen": _Werkzeug(
            "_saison_anlegen", "objekt_id", schreibt=True,
            caps=(Capability.MANAGE_CALENDAR,),
            perms=(Permission.EDIT_CALENDAR_BOOKINGS,),
        ),
        "saison_aendern": _Werkzeug(
            "_saison_aendern", "saison_id", schreibt=True,
            caps=(Capability.MANAGE_CALENDAR,),
            perms=(Permission.EDIT_CALENDAR_BOOKINGS,),
        ),
        "saison_loeschen": _Werkzeug(
            "_saison_loeschen", "saison_id", schreibt=True,
            caps=(Capability.MANAGE_CALENDAR,),
            perms=(Permission.EDIT_CALENDAR_BOOKINGS,),
        ),
        "saison_zuordnen": _Werkzeug(
            "_saison_zuordnen", "objekt_id", schreibt=True,
            caps=(Capability.MANAGE_CALENDAR,),
            perms=(Permission.EDIT_CALENDAR_BOOKINGS,),
        ),
        "saison_zeitraum_leeren": _Werkzeug(
            "_saison_zeitraum_leeren", "objekt_id", schreibt=True,
            caps=(Capability.MANAGE_CALENDAR,),
            perms=(Permission.EDIT_CALENDAR_BOOKINGS,),
        ),
        # -- Zusatzleistungen -----------------------------------------------
        # `addons` hängt an EINER Capability für alle Routen.
        "zusatzleistungen_liste": _Werkzeug(
            "_zusatzleistungen", "objekt_id",
            caps=(Capability.MANAGE_PROPERTIES,),
        ),
        "zusatzleistung_anlegen": _Werkzeug(
            "_zusatzleistung_anlegen", "objekt_id", schreibt=True,
            caps=(Capability.MANAGE_PROPERTIES,),
        ),
        "zusatzleistung_aendern": _Werkzeug(
            "_zusatzleistung_aendern", "zusatzleistung_id", schreibt=True,
            caps=(Capability.MANAGE_PROPERTIES,),
        ),
        "zusatzleistung_loeschen": _Werkzeug(
            "_zusatzleistung_loeschen", "zusatzleistung_id", schreibt=True,
            caps=(Capability.MANAGE_PROPERTIES,),
        ),
        "zusatzleistung_buchen": _Werkzeug(
            "_zusatzleistung_buchen", "buchung_id", schreibt=True,
            caps=(Capability.MANAGE_PROPERTIES,),
        ),
        # -- Rabatte (lesend) -----------------------------------------------
        "rabatte_liste": _Werkzeug(
            "_rabatte", "objekt_id",
            perms=(Permission.MANAGE_PROPERTY_SETTINGS,),
        ),
        # -- Kartei ----------------------------------------------------------
        # In der Kartei stehen IBAN, Steuer-ID und CPR-Nummer. Der Service
        # prüft den Objekt-Scope selbst — er bekommt deshalb `self.ctx()` MIT
        # Rolle, sonst liefe die Prüfung leer.
        "kartei_lesen": _Werkzeug(
            "_kartei_lesen", "objekt_id",
            caps=(Capability.MANAGE_PROPERTIES,), freitext=True,
        ),
        "kartei_schreiben": _Werkzeug(
            "_kartei_schreiben", "objekt_id", schreibt=True,
            caps=(Capability.MANAGE_PROPERTIES,), freitext=True,
        ),
        "kartei_handwerker_anlegen": _Werkzeug(
            "_kartei_handwerker_anlegen", "objekt_id", schreibt=True,
            caps=(Capability.MANAGE_PROPERTIES,), freitext=True,
        ),
        "kartei_handwerker_loeschen": _Werkzeug(
            "_kartei_handwerker_loeschen", "objekt_id", schreibt=True,
            caps=(Capability.MANAGE_PROPERTIES,), freitext=True,
        ),
    }

    def _rechte_pruefen(self, name: str, wz: _Werkzeug) -> None:
        """DER RIEGEL. Scope und Berechtigung, bevor irgendetwas passiert.

        Drei Stufen, alle fail-closed:

        1. SCOPE — wozu der Betrieb dieser Verbindung zugestimmt hat. Schreiben
           verlangt `mcp:write`, Freitexte `mcp:freetext`. Der Scope steht im
           signierten Token und wird bei jedem Aufruf gegen die Zustimmungszeile
           in der DB getrimmt (`token_pruefen`) — ein Entzug wirkt sofort.
        2. ROLLE — was der verbundene Nutzer selbst darf. Ein Assistent darf
           nie mehr können als der Mensch, der ihn verbunden hat.
        3. GRANULARE RECHTE — dieselben, die der Router prüfen würde.

        Die Rolle kommt über `has_capability` aus dem AuthContext … der beim
        MCP bewusst `role=None` trägt (Wurzel 7). Deshalb wird sie hier frisch
        aus der DB geladen, nicht aus dem Token gelesen: eine entzogene Rolle
        gilt sonst bis zum Token-Ablauf weiter.
        """
        # Zuerst der Mandant: ohne ihn ist jede weitere Prüfung sinnlos, und
        # die Meldung „Ihre Rolle darf das nicht" wäre irreführend — der Grund
        # ist ein unbrauchbares Token, keine fehlende Berechtigung.
        if not self._ctx.tenant_id:
            raise ValueError("Kein Mandant im Token — bitte neu verbinden.")

        if wz.schreibt and SCOPE_SCHREIBEN not in self._scopes:
            raise ValueError(
                "[nicht freigegeben — diese Verbindung darf nur lesen. "
                "Schreiben wird unter Konto → Verbindungen über das Häkchen "
                "'Änderungen erlauben' freigegeben.]"
            )
        if wz.freitext and not self._darf_freitext():
            raise ValueError(self._freitext_hinweis())

        # `effective_capabilities` statt `has_capability` (Review 14.08.2026):
        # Das PM-Dach `ACCESS_PM_FEATURES` kann einem co_admin einzeln entzogen
        # werden; `require_permission` prüft es zusätzlich zur Rolle. Die rohe
        # Rollen-Fähigkeit allein hätte diesen Entzug ignoriert — in der
        # Oberfläche wäre der ganze PM-Bereich dicht, über MCP hätte derselbe
        # Nutzer weiter sperren und Preise setzen können.
        self._laden()
        erlaubt = effective_capabilities(
            self._rolle(),
            has_pm_access=has_pm_access(self._rolle(), self._rechte_cache),
        )
        if any(c not in erlaubt for c in wz.caps):
            raise ValueError(
                f"[nicht erlaubt — Ihre Rolle darf '{name}' nicht ausführen.]"
            )
        for perm in wz.perms:
            if not load_permission(self._db, self._ctx.user_id, perm):
                raise ValueError(
                    f"[nicht erlaubt — Ihre Rolle darf '{name}' nicht ausführen.]"
                )

    def _tenant(self) -> str:
        """Der Mandant aus dem Token. Fehlt er, ist der Aufruf nicht ausführbar.

        Wichtig für die Services, die `tenant_id` als blosses Argument nehmen
        (calendar, tasks): ein leerer Wert würde dort zu einem ungescopten
        Zugriff führen, nicht zu einem Fehler.
        """
        if not self._ctx.tenant_id:
            raise ValueError("Kein Mandant im Token.")
        return self._ctx.tenant_id

    def _schreib_zeitraum(self, args: dict[str, Any]) -> DateRange:
        """Start/Ende eines Schreibvorgangs lesen und deckeln.

        Eigene Grenze statt `_tage_pruefen`: Lesen darf 370 Tage umfassen,
        Schreiben soll enger sein — jeder Tag darin geht als Änderung an die
        Portale.
        """
        start = date.fromisoformat(_pflicht(args, "start"))
        ende = date.fromisoformat(_pflicht(args, "ende"))
        if ende <= start:
            raise ValueError("ende muss nach start liegen")
        if (ende - start).days > MAX_SCHREIB_TAGE:
            raise ValueError(
                f"Zeitraum zu groß (max. {MAX_SCHREIB_TAGE} Tage je Aufruf)"
            )
        return DateRange(start=start, end=ende)

    def _rolle(self) -> str | None:
        """Die Rolle AUS DER DB (Wurzel 7), einmal je Aufruf gemerkt.

        `AuthContext.role` ist beim MCP absichtlich leer — das Token trägt sie
        nicht, damit ein Rechteentzug nicht bis zum Ablauf wirkungslos bleibt.
        """
        self._laden()
        return self._rolle_cache  # type: ignore[return-value]

    def _laden(self) -> None:
        """Rolle UND gespeicherte Rechte einmal je Aufruf holen.

        Beides aus derselben Zeile, weil beides zusammen gebraucht wird: die
        Rolle für die Fähigkeiten, `permissions` für das PM-Dach.
        """
        if self._rolle_cache is not _UNGESETZT:
            return
        zeile = (
            self._db.table("users")
            .select("role, permissions")
            .eq("id", self._ctx.user_id or "")
            .limit(1)
            .execute()
        ).data
        satz = zeile[0] if zeile else {}
        self._rolle_cache = str(satz.get("role")) if satz.get("role") else None
        self._rechte_cache = satz.get("permissions")

    def ctx(self) -> AuthContext:
        """Der Kontext MIT der Rolle aus der DB — für jeden Service-Aufruf.

        WARUM DAS NÖTIG IST (gefunden im Review 14.08.2026, war ein echter
        Fehler): Der Router baut den Kontext bewusst mit `role=None`, damit ein
        entzogenes Recht nicht bis zum Token-Ablauf weitergilt (Wurzel 7). Die
        Objekt-Scopes der Services hängen aber genau an diesem Feld —
        `is_owner(ctx)` und `is_staff(ctx)` vergleichen `ctx.role`. Mit `None`
        sind beide immer `False`, und damit fällt in `reservations`, `tasks`
        und `properties` die Einschränkung auf die eigenen Objekte ERSATZLOS
        weg: ein Eigentümer hätte über MCP alle Buchungen des Mandanten
        gesehen, obwohl die Oberfläche ihm nur seine zeigt.

        Die Rolle wird deshalb frisch aus der DB geladen und hier wieder in den
        Kontext gesetzt. Beides zusammen erfüllt Wurzel 7 UND Wurzel 3: aktuell
        UND gescoped. Sie vorher zu laden, zu prüfen und dann wegzuwerfen, war
        die halbe Miete — und die gefährlichere Hälfte fehlte.
        """
        return self._ctx.model_copy(update={"role": self._rolle()})

    def ausfuehren(self, name: str, argumente: dict[str, Any]) -> dict[str, Any]:
        """Ein Werkzeug aufrufen. Unbekannter Name → ValueError.

        Reihenfolge ist wesentlich: erst Rechte, dann Handler. Ein abgelehnter
        Aufruf darf den Service nie erreichen.

        Protokolliert JEDEN Aufruf (0388) — auch den gescheiterten: ein
        abgelehnter Zugriff ist für die Nachvollziehbarkeit so aussagekräftig
        wie ein erfolgreicher. Der Log sitzt hier an EINER Stelle statt in
        jedem Werkzeug; sonst wäre er beim nächsten vergessen.
        """
        wz = self._WERKZEUGE.get(name)
        if wz is None:
            raise ValueError(f"Unbekanntes Werkzeug: {name}")

        feld = wz.ziel_feld
        ziel = str(argumente.get(feld) or "") or None if feld else None
        try:
            self._rechte_pruefen(name, wz)
            ergebnis = getattr(self, wz.handler)(argumente)
        except Exception:
            self._protokollieren(name, ziel=ziel, anzahl=0, erfolg=False)
            raise
        self._protokollieren(
            name, ziel=ziel, anzahl=_umfang(ergebnis), erfolg=True
        )
        return ergebnis

    def _kalender(self, args: dict[str, Any]) -> dict[str, Any]:
        objekt_id = str(args.get("objekt_id") or "")
        if not objekt_id:
            raise ValueError("objekt_id fehlt")
        start = _als_datum(args.get("start"), date.today())
        ende = _als_datum(args.get("ende"), start + timedelta(days=30))
        _tage_pruefen(start, ende)
        service = CalendarService(client=self._db)
        rng = DateRange(start=start, end=ende)
        try:
            frei = service.freie_einheiten(self.ctx(), objekt_id, rng)
            tage = service.get_availability(self.ctx(), objekt_id, rng)
        except CalendarError as exc:
            raise ValueError(exc.message) from exc
        return {
            "objekt_id": objekt_id,
            "einheiten_gesamt": frei.gesamt,
            "freie_einheiten": [
                {"von": s.von.isoformat(), "bis": s.bis.isoformat(), "frei": s.frei}
                for s in frei.spannen
            ],
            "tage": [
                {
                    "datum": t.date.isoformat(),
                    "status": t.status,
                    "preis": t.price,
                    "min_aufenthalt": t.min_stay,
                }
                for t in tage
            ],
        }

    def _buchungen(self, args: dict[str, Any]) -> dict[str, Any]:
        limit = min(int(args.get("limit") or 20), MAX_BUCHUNGEN)
        service = ReservationsService(service_client=self._db)
        ab = args.get("anreise_ab")
        bis = args.get("anreise_bis")
        try:
            out = service.list(
                self.ctx(),
                str(args.get("objekt_id") or "") or None,
                date_from=date.fromisoformat(str(ab)) if ab else None,
                date_to=date.fromisoformat(str(bis)) if bis else None,
                limit=limit,
            )
        except ReservationError as exc:
            raise ValueError(exc.message) from exc
        return {
            "anzahl": out.total,
            "unvollstaendig": out.truncated,
            "buchungen": [
                {
                    "id": b.id,
                    "gast": b.guest_name,
                    "objekt_id": b.property_id,
                    "kanal": b.channel,
                    "anreise": b.check_in.isoformat(),
                    "abreise": b.check_out.isoformat(),
                    "status": b.status,
                    "betrag": b.total_amount,
                    "waehrung": b.currency,
                }
                for b in out.items
            ],
        }

    def _buchung_detail(self, args: dict[str, Any]) -> dict[str, Any]:
        buchung_id = str(args.get("buchung_id") or "")
        if not buchung_id:
            raise ValueError("buchung_id fehlt")
        service = ReservationsService(service_client=self._db)
        try:
            d = service.detail(self.ctx(), buchung_id)
        except ReservationError as exc:
            raise ValueError(exc.message) from exc
        return {
            "id": d.id,
            "gast": d.guest_name,
            "objekt_id": d.property_id,
            "objekt": d.property_title,
            "kanal": d.channel,
            "anreise": d.check_in.isoformat(),
            "abreise": d.check_out.isoformat(),
            "status": d.status,
            "betrag": d.total_amount,
            "waehrung": d.currency,
            "notiz": d.note if self._darf_freitext() else self._freitext_hinweis(),
        }

    def _posteingang(self, args: dict[str, Any]) -> dict[str, Any]:
        limit = min(int(args.get("limit") or 20), MAX_THREADS)
        nur_ungelesen = bool(args.get("nur_ungelesen"))
        service = InboxService(service_client=self._db)
        out = service.list_threads(self.ctx())
        threads = [t for t in out.items if not nur_ungelesen or not t.is_read]
        darf_freitext = self._darf_freitext()
        hinweis = self._freitext_hinweis()
        return {
            "anzahl": len(threads[:limit]),
            "threads": [
                {
                    "thread_id": t.id,
                    # Der Kanal als FELD, nicht als eigenes Werkzeug: myBestDays
                    # steht hier gleichrangig neben Booking.com und Airbnb.
                    "kanal": t.ota_name,
                    "gast": t.guest_name,
                    "objekt": t.property_title,
                    "buchung_id": t.reservation_id,
                    "anreise": t.arrival_date,
                    "abreise": t.departure_date,
                    # Die Vorschau ist bereits Nachrichteninhalt — sie fällt
                    # unter denselben Scope wie der volle Verlauf.
                    "letzte_nachricht": (
                        t.last_message if darf_freitext else hinweis
                    ),
                    "letzter_absender": t.last_sender,
                    # Zeitpunkt beim Portal (Wurzel 5b) — leer, wenn die Quelle
                    # ihn nicht liefert. Nie unsere eigene Uhr.
                    "letzte_aktivitaet": t.letzte_aktivitaet,
                    "gelesen": t.is_read,
                }
                for t in threads[:limit]
            ],
        }

    def _verlauf(self, args: dict[str, Any]) -> dict[str, Any]:
        thread_id = str(args.get("thread_id") or "")
        if not thread_id:
            raise ValueError("thread_id fehlt")
        if not self._darf_freitext():
            # Nichts erst laden und dann verwerfen: der Verlauf besteht
            # AUSSCHLIESSLICH aus Nachrichtentexten. Ohne Freigabe wird er gar
            # nicht abgerufen (Art. 25 Abs. 1 — Datenminimierung schon in der
            # Verarbeitung, nicht erst in der Ausgabe).
            raise ValueError(self._freitext_hinweis())
        service = InboxService(service_client=self._db)
        out = service.get_messages(self.ctx(), thread_id)
        return {
            "thread_id": thread_id,
            "anzahl": out.total,
            "nachrichten": [
                {
                    "von": n.sender,
                    "text": n.message,
                    "zeitpunkt": n.sent_at,
                }
                for n in out.items
            ],
        }

    # -- Lesen: Objekte, Preise, Aufgaben, Gäste, Bewertungen ---------------

    def _objekte(self, _args: dict[str, Any]) -> dict[str, Any]:
        from src.features.properties.service import PropertiesService

        out = PropertiesService(service_client=self._db).list(self.ctx())
        return {
            "anzahl": len(out.items[:MAX_OBJEKTE]),
            "objekte": [
                {
                    "id": p.id,
                    "name": p.title,
                    "status": p.status,
                    "einheiten": getattr(p, "unit_count", None),
                    "waehrung": getattr(p, "currency", None),
                }
                for p in out.items[:MAX_OBJEKTE]
            ],
        }

    def _objekt_detail(self, args: dict[str, Any]) -> dict[str, Any]:
        from src.features.properties.service import PropertiesService

        objekt_id = _pflicht(args, "objekt_id")
        p = PropertiesService(service_client=self._db).get(self.ctx(), objekt_id)
        # Das Schema ist breit und ändert sich; ein handgepflegtes Mapping
        # liefe ihm hinterher. Der Umweg über das Modell hält beides synchron.
        return p.model_dump(mode="json")

    def _preise_lesen(self, args: dict[str, Any]) -> dict[str, Any]:
        objekt_id = _pflicht(args, "objekt_id")
        start = _als_datum(args.get("start"), date.today())
        ende = _als_datum(args.get("ende"), start + timedelta(days=30))
        _tage_pruefen(start, ende)
        try:
            grid = RatesService(service_client=self._db).rate_grid(
                self.ctx(), objekt_id, start, ende
            )
        except RateError as exc:
            raise ValueError(exc.message) from exc
        return grid.model_dump(mode="json")

    def _aufgaben(self, args: dict[str, Any]) -> dict[str, Any]:
        limit = _grenze(args.get("limit"), MAX_AUFGABEN)
        # `ctx` MITGEBEN — und zwar den aus `self.ctx()` MIT Rolle: ohne den
        # Parameter entfällt der Staff-Objekt-Scope, und ohne die Rolle darin
        # greift er ebenfalls nicht (`is_staff` liest `ctx.role`).
        aufgaben = TasksService(client=self._db).list_tasks(
            self._tenant(), ctx=self.ctx()
        )
        if args.get("nur_offene"):
            aufgaben = [a for a in aufgaben if a.status != "done"]
        objekt_id = str(args.get("objekt_id") or "")
        if objekt_id:
            aufgaben = [a for a in aufgaben if a.property_id == objekt_id]
        return {
            "anzahl": len(aufgaben[:limit]),
            "aufgaben": [
                {
                    "id": a.id,
                    "titel": a.title,
                    "status": a.status,
                    "objekt_id": a.property_id,
                    "faellig_am": _iso(getattr(a, "due_date", None)),
                    "zustaendig": getattr(a, "assignee_id", None),
                }
                for a in aufgaben[:limit]
            ],
        }

    def _gaeste(self, args: dict[str, Any]) -> dict[str, Any]:
        from src.features.guests.service import GuestsService

        limit = _grenze(args.get("limit"), MAX_GAESTE)
        out = GuestsService(service_client=self._db).list(
            self.ctx(), q=str(args.get("suche") or "") or None, limit=limit
        )
        # Der Service maskiert bereits rollenabhängig (guest_masking) — hier
        # wird nichts nachgeschärft, sonst gäbe es zwei Wahrheiten.
        return {
            "anzahl": len(out.items),
            "gaeste": [g.model_dump(mode="json") for g in out.items],
        }

    def _bewertungen(self, args: dict[str, Any]) -> dict[str, Any]:
        from src.features.reviews.service import ReviewsService

        limit = _grenze(args.get("limit"), MAX_BEWERTUNGEN)
        out = ReviewsService(service_client=self._db).list_reviews(
            self.ctx(),
            property_id=str(args.get("objekt_id") or "") or None,
            unanswered=bool(args.get("nur_unbeantwortet")),
            limit=limit,
            offset=0,
        )
        return {
            "anzahl": len(out.items),
            "bewertungen": [r.model_dump(mode="json") for r in out.items],
        }

    # -- Schreiben ----------------------------------------------------------
    #
    # Alle folgenden Werkzeuge verändern echte Daten; die meisten gehen über
    # Channex live an die Portale. Der Riegel in `ausfuehren` hat Scope und
    # Rechte bereits geprüft — hier steht nur noch die Fachlogik.

    def _sperren(self, args: dict[str, Any]) -> dict[str, Any]:
        objekt_id = _pflicht(args, "objekt_id")
        rng = self._schreib_zeitraum(args)
        try:
            naechte = CalendarService(client=self._db).block(
                self._tenant(),
                BlockRequest(
                    property_id=objekt_id,
                    range=rng,
                    unit_id=str(args.get("einheit_id") or "") or None,
                ),
            )
        except CalendarError as exc:
            raise ValueError(exc.message) from exc
        return {
            "objekt_id": objekt_id,
            "gesperrte_naechte": naechte,
            "von": rng.start.isoformat(),
            "bis": rng.end.isoformat(),
            "hinweis": "Die Sperre ist an die Portale gemeldet.",
        }

    def _entsperren(self, args: dict[str, Any]) -> dict[str, Any]:
        objekt_id = _pflicht(args, "objekt_id")
        rng = self._schreib_zeitraum(args)
        try:
            naechte = CalendarService(client=self._db).unblock(
                self._tenant(), objekt_id, rng,
                unit_id=str(args.get("einheit_id") or "") or None,
            )
        except CalendarError as exc:
            raise ValueError(exc.message) from exc
        return {
            "objekt_id": objekt_id,
            "freigegebene_naechte": naechte,
            "von": rng.start.isoformat(),
            "bis": rng.end.isoformat(),
        }

    def _preis_setzen(self, args: dict[str, Any]) -> dict[str, Any]:
        from src.features.calendar.schemas import BulkEditRequest

        objekt_id = _pflicht(args, "objekt_id")
        rng = self._schreib_zeitraum(args)
        preis = args.get("preis")
        if preis is None:
            raise ValueError("preis fehlt")
        try:
            betrag = float(preis)
        except (TypeError, ValueError) as exc:
            raise ValueError("preis ist keine Zahl") from exc
        if betrag <= 0:
            # Kein stillschweigendes „0 = zurücknehmen": das Zurücknehmen ist
            # eine andere Absicht und braucht ein eigenes Werkzeug, sonst löscht
            # ein Tippfehler den Preis (Wurzel 4).
            raise ValueError("preis muss größer als 0 sein")

        # ÜBER `bulk_edit`, nicht über `set_price_override` je Tag.
        #
        # Der Tages-Setter wäre die naheliegende Wahl, aber er schickt JE TAG
        # einen Channex-Push: ein Jahrespreis wären 366 Pushes und, wenn einer
        # davon scheitert, ein halb gesetzter Zeitraum ohne Weg zurück (es gibt
        # keine Transaktion über Channex). `bulk_edit` ist derselbe Pfad, den
        # die Oberfläche nutzt, fasst den Zeitraum zusammen und meldet ihn in
        # einem Zug.
        try:
            out = CalendarService(client=self._db).bulk_edit(
                self._tenant(),
                BulkEditRequest(
                    property_ids=[objekt_id], range=rng, price=betrag
                ),
            )
        except CalendarError as exc:
            raise ValueError(exc.message) from exc
        return {
            "objekt_id": objekt_id,
            "preis": betrag,
            "von": rng.start.isoformat(),
            "bis": rng.end.isoformat(),
            "ergebnis": out.model_dump(mode="json"),
            "hinweis": "Der Preis ist an die Portale gemeldet.",
        }

    def _stop_sell(self, args: dict[str, Any]) -> dict[str, Any]:
        objekt_id = _pflicht(args, "objekt_id")
        rng = self._schreib_zeitraum(args)
        aktiv = args.get("aktiv")
        if aktiv is None:
            raise ValueError("aktiv fehlt (true = stoppen, false = freigeben)")
        service = CalendarService(client=self._db)
        try:
            if bool(aktiv):
                out = service.set_stop_sell(
                    self._tenant(), objekt_id, rng,
                    str(args.get("grund") or "") or None,
                )
            else:
                out = service.clear_stop_sell(self._tenant(), objekt_id, rng)
        except CalendarError as exc:
            raise ValueError(exc.message) from exc
        return {"objekt_id": objekt_id, "aktiv": bool(aktiv), **out}

    def _restriktionen(self, args: dict[str, Any]) -> dict[str, Any]:
        objekt_id = _pflicht(args, "objekt_id")
        rng = self._schreib_zeitraum(args)
        felder = {
            "min_stay": args.get("min_aufenthalt"),
            "max_stay": args.get("max_aufenthalt"),
            "cta": args.get("keine_anreise"),
            "ctd": args.get("keine_abreise"),
        }
        gesetzt = {k: v for k, v in felder.items() if v is not None}
        if not gesetzt:
            raise ValueError(
                "Keine Regel angegeben (min_aufenthalt, max_aufenthalt, "
                "keine_anreise oder keine_abreise)"
            )
        try:
            tage = CalendarService(client=self._db).set_restrictions(
                self._tenant(), objekt_id, rng, **gesetzt
            )
        except CalendarError as exc:
            raise ValueError(exc.message) from exc
        return {
            "objekt_id": objekt_id,
            "geaenderte_tage": tage,
            "gesetzt": gesetzt,
            "hinweis": "Die Regeln sind an die Portale gemeldet.",
        }

    def _stornieren(self, args: dict[str, Any]) -> dict[str, Any]:
        buchung_id = _pflicht(args, "buchung_id")
        grund = _pflicht(args, "grund")
        try:
            out = ReservationsService(service_client=self._db).cancel(
                self.ctx(), buchung_id, grund
            )
        except ReservationError as exc:
            raise ValueError(exc.message) from exc
        return {
            "id": out.id,
            "status": out.status,
            "hinweis": "Die Nächte sind wieder freigegeben.",
        }

    def _verschieben(self, args: dict[str, Any]) -> dict[str, Any]:
        from src.features.reservations.schemas import ReservationMove

        buchung_id = _pflicht(args, "buchung_id")
        service = ReservationsService(service_client=self._db)
        try:
            vorher = service.detail(self.ctx(), buchung_id)
        except ReservationError as exc:
            raise ValueError(exc.message) from exc
        # Ohne Zielobjekt bleibt die Buchung, wo sie ist — `property_id` ist im
        # Schema Pflicht, und ein erfundener Wert wäre ein Umzug (Wurzel 4).
        ziel = str(args.get("objekt_id") or "") or vorher.property_id
        try:
            out = service.move(
                self.ctx(), buchung_id,
                ReservationMove(
                    property_id=ziel,
                    check_in=date.fromisoformat(_pflicht(args, "anreise")),
                    check_out=date.fromisoformat(_pflicht(args, "abreise")),
                ),
            )
        except ReservationError as exc:
            raise ValueError(exc.message) from exc
        return {
            "id": out.id,
            "objekt_id": out.property_id,
            "anreise": out.check_in.isoformat(),
            "abreise": out.check_out.isoformat(),
            "status": out.status,
        }

    def _notiz_anlegen(self, args: dict[str, Any]) -> dict[str, Any]:
        buchung_id = _pflicht(args, "buchung_id")
        text = _pflicht(args, "text")
        try:
            note = ReservationsService(service_client=self._db).add_note(
                self.ctx(), buchung_id,
                ReservationNoteCreate(
                    body=text,
                    category=str(args.get("kategorie") or "") or None,
                ),
            )
        except ReservationError as exc:
            raise ValueError(exc.message) from exc
        return {"id": note.id, "buchung_id": buchung_id, "angelegt": True}

    def _nachricht_senden(self, args: dict[str, Any]) -> dict[str, Any]:
        thread_id = _pflicht(args, "thread_id")
        text = _pflicht(args, "text")
        if len(text) > MAX_NACHRICHT_ZEICHEN:
            raise ValueError(
                f"Nachricht zu lang (max. {MAX_NACHRICHT_ZEICHEN} Zeichen)"
            )
        try:
            # `enforce_reply` bleibt auf dem Standard: die Prüfung auf
            # INBOX_REPLY im Service ist die zweite Verteidigungslinie hinter
            # dem Riegel und darf hier nicht umgangen werden.
            msg = InboxService(service_client=self._db).send_message(
                self.ctx(), thread_id, text
            )
        except InboxError as exc:
            raise ValueError(exc.message) from exc
        return {
            "thread_id": thread_id,
            "gesendet": True,
            "zeitpunkt": _iso(getattr(msg, "sent_at", None)),
            "hinweis": "Die Nachricht ist beim Gast; sie lässt sich nicht zurückholen.",
        }

    def _aufgabe_anlegen(self, args: dict[str, Any]) -> dict[str, Any]:
        from datetime import datetime

        from src.features.tasks.schemas import TaskCreate

        faellig = str(args.get("faellig_am") or "")
        try:
            aufgabe = TasksService(client=self._db).create_task(
                self._tenant(),
                TaskCreate(
                    property_id=_pflicht(args, "objekt_id"),
                    title=_pflicht(args, "titel"),
                    description=str(args.get("beschreibung") or "") or None,
                    # `due_at` ist ein Zeitpunkt; ein reines Datum wird auf den
                    # Tagesbeginn gelegt statt geraten.
                    due_at=(
                        datetime.fromisoformat(faellig) if "T" in faellig
                        else datetime.combine(
                            date.fromisoformat(faellig), datetime.min.time()
                        ) if faellig else None
                    ),
                    assignee_id=str(args.get("zustaendig_user_id") or "") or None,
                ),
            )
        except TaskError as exc:
            raise ValueError(exc.message) from exc
        return {"id": aufgabe.id, "titel": aufgabe.title, "angelegt": True}

    def _aufgabe_abschliessen(self, args: dict[str, Any]) -> dict[str, Any]:
        aufgabe_id = _pflicht(args, "aufgabe_id")
        try:
            # `self.ctx()` mitgeben, sonst entfällt der Staff-Objekt-Scope und
            # eine fremde Aufgabe liesse sich abschliessen (Wurzel 9). Die
            # Rolle IM Kontext ist dabei das Entscheidende, nicht bloss der
            # Parameter.
            out = TasksService(client=self._db).complete_task(
                self._tenant(), aufgabe_id, self._ctx.user_id or "",
                ctx=self.ctx(),
            )
        except TaskError as exc:
            raise ValueError(exc.message) from exc
        return {"id": out.id, "status": out.status, "abgeschlossen": True}

    def _notizen(self, args: dict[str, Any]) -> dict[str, Any]:
        buchung_id = str(args.get("buchung_id") or "")
        if not buchung_id:
            raise ValueError("buchung_id fehlt")
        if not self._darf_freitext():
            # Wie beim Verlauf: eine Notiz IST der Freitext, ohne Freigabe wird
            # sie nicht geladen.
            raise ValueError(self._freitext_hinweis())
        service = ReservationsService(service_client=self._db)
        try:
            out = service.list_notes(self.ctx(), buchung_id)
        except ReservationError as exc:
            raise ValueError(exc.message) from exc
        return {
            "buchung_id": buchung_id,
            "anzahl": out.total,
            "notizen": [
                {
                    "autor": n.author_name,
                    "kategorie": n.category,
                    "text": n.body,
                    "zeitpunkt": n.created_at,
                }
                for n in out.items[:MAX_NOTIZEN]
            ],
        }
