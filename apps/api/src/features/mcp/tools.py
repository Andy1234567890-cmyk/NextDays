"""Die MCP-Werkzeuge: Kalender, Posteingang, Buchungen, Notizen.

NUR LESEND. Jedes Werkzeug ruft denselben Service-Layer wie die Weboberfläche —
es gibt keine zweite Fachlogik hier. Der MCP-Server ist ein Transport, kein
Parallel-Backend: Tenant-Scope, Owner-Scope (§4.2), Rollen-Datensplit (§4.3)
und die Betrags-Maskierung wirken deshalb automatisch, weil sie im Service
sitzen und nicht in der Route.

Warum EIN Posteingangs-Werkzeug statt zwei: Für den Betrieb ist der Posteingang
ein Posteingang. Er fragt „was hat der Gast geschrieben", nicht „über welches
System kam das". Die Quellen (OTA über Channex, myBestDays-Marktplatz,
übernommene Verläufe) führt der Service zusammen; der Kanal steht als Feld an
jedem Thread. Zwei Werkzeuge hätten das Modell raten lassen, in welchem es
suchen soll — und ein Fehlgriff hätte „nichts gefunden" geheißen, obwohl die
Nachricht im anderen lag.
"""
from __future__ import annotations

from datetime import date, timedelta
from typing import Any

from src.core.logging import get_logger
from src.core.security import AuthContext
from src.core.supabase import get_service_client
from src.features.calendar.schemas import DateRange
from src.features.calendar.service import CalendarError, CalendarService
from src.features.inbox.service import InboxService
from src.features.reservations.service import ReservationError, ReservationsService

from .oauth_service import SCOPE_FREITEXT

log = get_logger("nextdays.mcp.tools")

# Wurzel 8: harte Obergrenzen an JEDEM Werkzeug. Ein Modell fragt gern „alles" —
# ohne Deckel wäre das ein Vollabzug des Bestands in den Kontext.
MAX_TAGE = 370
MAX_BUCHUNGEN = 100
MAX_THREADS = 50
MAX_NOTIZEN = 50


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


def _als_datum(wert: str | None, ersatz: date) -> date:
    """ISO-Datum lesen; leer → `ersatz`. Ungültiges Datum ist ein Fehler.

    Bewusst kein stiller Rückfall auf heute bei Unsinn: ein Modell, das
    `2026-13-01` schickt, soll das erfahren, statt Daten für einen anderen
    Zeitraum zu bekommen und sie für die angefragten zu halten (Wurzel 4).
    """
    if not wert:
        return ersatz
    return date.fromisoformat(wert)


class McpTools:
    """Werkzeug-Implementierungen über dem bestehenden Service-Layer."""

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

    @staticmethod
    def katalog() -> list[dict[str, Any]]:
        """Werkzeug-Beschreibungen für `tools/list`.

        Die `description` ist für ein MODELL geschrieben, nicht für einen
        Menschen: sie sagt, wann das Werkzeug das richtige ist und was die
        Grenzen sind — sonst rät das Modell und ruft das falsche auf.

        `title` ist dagegen der ANZEIGENAME für den Betrieb. Ohne ihn formt der
        Client den technischen `name` um und zeigt „Kalender verfuegbarkeit" —
        der `name` ist ASCII, weil er programmatisch adressiert wird. Die
        Reihenfolge ist laut Spec `title` → `annotations.title` → `name`;
        beide werden gesetzt, weil ältere Clients nur die Annotation kennen.

        `readOnlyHint` ist hier keine Deko: alle sechs Werkzeuge lesen nur, und
        der Client darf das dem Nutzer so anzeigen.
        """
        return [
            {
                "name": "kalender_verfuegbarkeit",
                "title": "Kalender-Verfügbarkeit",
                "annotations": {
                    "title": "Kalender-Verfügbarkeit",
                    "readOnlyHint": True,
                },
                "description": (
                    "Belegung und freie Einheiten eines Objekts je Tag. "
                    "Liefert die ZAHL freier Einheiten (ein Objekt kann mehrere "
                    "identische Einheiten haben), Stop-Sell ist eingerechnet. "
                    "Für die Frage 'ist X frei / wie viel ist frei'."
                ),
                "inputSchema": {
                    "type": "object",
                    "properties": {
                        "objekt_id": {
                            "type": "string",
                            "description": "UUID des Objekts (property).",
                        },
                        "start": {
                            "type": "string",
                            "description": "ISO-Datum, Standard: heute.",
                        },
                        "ende": {
                            "type": "string",
                            "description": (
                                "ISO-Datum, exklusiv. Standard: start + 30 Tage. "
                                f"Maximal {MAX_TAGE} Tage Spanne."
                            ),
                        },
                    },
                    "required": ["objekt_id"],
                },
            },
            {
                "name": "buchungen_liste",
                "title": "Buchungen",
                "annotations": {"title": "Buchungen", "readOnlyHint": True},
                "description": (
                    "Buchungen des Betriebs, neueste Anreise zuerst. Optional "
                    "auf ein Objekt und einen Anreise-Zeitraum eingegrenzt. "
                    "Beträge erscheinen nur, wenn die Rolle sie sehen darf."
                ),
                "inputSchema": {
                    "type": "object",
                    "properties": {
                        "objekt_id": {"type": "string"},
                        "anreise_ab": {"type": "string"},
                        "anreise_bis": {"type": "string"},
                        "limit": {
                            "type": "integer",
                            "description": f"Standard 20, maximal {MAX_BUCHUNGEN}.",
                        },
                    },
                },
            },
            {
                "name": "buchung_detail",
                "title": "Buchung im Detail",
                "annotations": {"title": "Buchung im Detail", "readOnlyHint": True},
                "description": (
                    "Alle Angaben zu EINER Buchung: Gast, Zeitraum, Status, "
                    "Objekt, Beträge (rollenabhängig)."
                ),
                "inputSchema": {
                    "type": "object",
                    "properties": {"buchung_id": {"type": "string"}},
                    "required": ["buchung_id"],
                },
            },
            {
                "name": "posteingang_liste",
                "title": "Posteingang",
                "annotations": {"title": "Posteingang", "readOnlyHint": True},
                "description": (
                    "Konversationen ALLER Kanäle in einer Liste — Booking.com, "
                    "Airbnb, myBestDays-Marktplatz und übernommene Verläufe. "
                    "Der Kanal steht je Thread im Feld 'kanal'. Sortiert nach "
                    "letzter Aktivität. Für 'was hat der Gast geschrieben'."
                ),
                "inputSchema": {
                    "type": "object",
                    "properties": {
                        "nur_ungelesen": {"type": "boolean"},
                        "limit": {
                            "type": "integer",
                            "description": f"Standard 20, maximal {MAX_THREADS}.",
                        },
                    },
                },
            },
            {
                "name": "posteingang_verlauf",
                "title": "Nachrichtenverlauf",
                "annotations": {"title": "Nachrichtenverlauf", "readOnlyHint": True},
                "description": (
                    "Nachrichtenverlauf EINER Konversation, chronologisch. "
                    "Die thread_id stammt aus posteingang_liste. Erfordert die "
                    "Freigabe für Freitexte in dieser Verbindung."
                ),
                "inputSchema": {
                    "type": "object",
                    "properties": {"thread_id": {"type": "string"}},
                    "required": ["thread_id"],
                },
            },
            {
                "name": "buchung_notizen",
                "title": "Buchungsnotizen",
                "annotations": {"title": "Buchungsnotizen", "readOnlyHint": True},
                "description": (
                    "Interner Notiz-Verlauf einer Buchung (Autor, Zeit, Text). "
                    "Erfordert das Recht, Notizen zu sehen, UND die Freigabe "
                    "für Freitexte in dieser Verbindung — sonst gesperrt."
                ),
                "inputSchema": {
                    "type": "object",
                    "properties": {"buchung_id": {"type": "string"}},
                    "required": ["buchung_id"],
                },
            },
        ]

    # -- Ausführung ---------------------------------------------------------

    # Welches Argument die Ziel-ID trägt — je Werkzeug genau eines. Für den
    # Zugriffslog: er soll sagen können, WELCHE Buchung abgerufen wurde.
    _ZIEL_FELD = {
        "kalender_verfuegbarkeit": "objekt_id",
        "buchungen_liste": "objekt_id",
        "buchung_detail": "buchung_id",
        "posteingang_liste": None,
        "posteingang_verlauf": "thread_id",
        "buchung_notizen": "buchung_id",
    }

    def ausfuehren(self, name: str, argumente: dict[str, Any]) -> dict[str, Any]:
        """Ein Werkzeug aufrufen. Unbekannter Name → ValueError.

        Protokolliert JEDEN Aufruf (0388) — auch den gescheiterten: ein
        abgelehnter Zugriff ist für die Nachvollziehbarkeit so aussagekräftig
        wie ein erfolgreicher. Der Log sitzt hier an EINER Stelle statt in
        jedem der sechs Werkzeuge; sonst wäre er beim siebten vergessen.
        """
        handler = {
            "kalender_verfuegbarkeit": self._kalender,
            "buchungen_liste": self._buchungen,
            "buchung_detail": self._buchung_detail,
            "posteingang_liste": self._posteingang,
            "posteingang_verlauf": self._verlauf,
            "buchung_notizen": self._notizen,
        }.get(name)
        if handler is None:
            raise ValueError(f"Unbekanntes Werkzeug: {name}")

        feld = self._ZIEL_FELD.get(name)
        ziel = str(argumente.get(feld) or "") or None if feld else None
        try:
            ergebnis = handler(argumente)
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
            frei = service.freie_einheiten(self._ctx, objekt_id, rng)
            tage = service.get_availability(self._ctx, objekt_id, rng)
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
                self._ctx,
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
            d = service.detail(self._ctx, buchung_id)
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
        out = service.list_threads(self._ctx)
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
        out = service.get_messages(self._ctx, thread_id)
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
            out = service.list_notes(self._ctx, buchung_id)
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
