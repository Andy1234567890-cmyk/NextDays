"""Terminals und Terminal-Stempeln (0544, Vertrag §3.2).

Ein Terminal ist ein Gerät an der Rezeption: ein Tablet im Vollbild, das den
ganzen Tag offen steht und KEINEN Nutzer-Login hat. Deshalb sind hier drei
Dinge anders als überall sonst im Slice:

1. **Zwei Geheimnisse, zwei Zwecke.** Das GERÄT weist sich mit einem Token aus
   (32 Byte `secrets.token_urlsafe`, gespeichert als SHA-256 — derselbe Weg wie
   `auth.einladung_service.hash_token`: gegen 256 Bit Zufall bringt ein
   Passwort-Hash keine Sicherheit, verlangsamt aber jeden Tastendruck). Die
   PERSON weist sich mit einer 4–6-stelligen PIN aus, und die hat nur ~10^4–10^6
   Möglichkeiten — sie MUSS teuer gehasht werden (pbkdf2-hmac-sha256, 200 000
   Runden, Salt `tenant_id + user_id`, damit dieselbe PIN zweier Personen zwei
   verschiedene Hashes ergibt und kein Rainbow-Table greift).
2. **Fail-closed an drei Stellen** (Wurzel 5): Token unbekannt → 401, Terminal
   `aktiv=false` → 401, Betriebsregel `terminal_aktiv=false` → 401. Kein
   „unbekannt heißt erlaubt", keine Ausnahme für „das Gerät stand doch da".
   Der Vergleich läuft über `core.security.secrets_match` (byteweise,
   zeitkonstant, verträgt Nicht-ASCII im Header ohne 500).
3. **Fehlversuch-Sperre im Prozessspeicher.** Fünf falsche PINs zu derselben
   Stempel-ID sperren sie 15 Minuten (423 `gesperrt`).

   BEWUSSTE GRENZE, hier dokumentiert statt verschwiegen: der Zähler liegt in
   `_FEHLVERSUCHE` im Prozessspeicher. Bei `UVICORN_WORKERS=2` zählt jeder
   Worker eigen (effektiv also bis zu 10 Versuche je Fenster), und ein Neustart
   der API leert ihn. Für eine 4–6-stellige PIN am Rezeptions-Tablet ist das
   tragbar, weil der Angreifer zusätzlich das Geräte-Token braucht und der
   Rate-Limit-Bucket `personal_terminal` (30/60/IP) davor liegt — ein
   vollständiger Durchlauf von 10 000 PINs bräuchte damit über fünf Stunden am
   selben Gerät. Wer die Sperre worker-übergreifend und neustartfest will,
   verlegt den Zähler nach Redis (`core.ratelimit` ist der Ort dafür); das ist
   eine Änderung an der Infrastruktur, keine an dieser Datei.
"""

from __future__ import annotations

import hashlib
import secrets
from datetime import UTC, date, datetime, timedelta
from typing import Any

from postgrest.exceptions import APIError
from supabase import Client

from src.core.security import AuthContext, secrets_match
from src.core.supabase import load_scoped

from ._base import _UNIQUE_VERLETZUNG, PersonalBase, PersonalError, als_dt, jetzt, log
from .schemas import Zeiterfassung
from .terminal_schemas import (
    Terminal,
    TerminalBetrieb,
    TerminalCreate,
    TerminalGeraet,
    TerminalInfo,
    TerminalMitToken,
    TerminalSchichtHeute,
    TerminalStatus,
    TerminalStempeln,
    TerminalToken,
    TerminalUpdate,
    TerminalWetter,
    TerminalZugang,
    TerminalZugangSet,
)

_SPALTEN = (
    "id, tenant_id, name, property_id, aktiv, letzter_kontakt_am, erstellt_von, "
    "created_at, updated_at"
)
_TOKEN_BYTES = 32
# PIN-Hash: pbkdf2-hmac-sha256. Die Rundenzahl ist Teil des gespeicherten
# Formats — wer sie erhöht, muss die Alt-Hashes migrieren (oder die PINs neu
# setzen lassen), nie stillschweigend mit zwei Zahlen vergleichen.
_PIN_RUNDEN = 200_000
_MAX_FEHLVERSUCHE = 5
_SPERRE = timedelta(minutes=15)
# Eine Schicht gilt als „die von jetzt", wenn sie in diesem Fenster beginnt.
_SCHICHT_FENSTER = timedelta(hours=3)
_AKTIVE_SCHICHT = ("veroeffentlicht", "bestaetigt")

# stempel_id → (Fehlversuche, gesperrt_bis). Siehe Modul-Docstring: bewusste
# Grenze (prozesslokal, nicht neustartfest).
_FEHLVERSUCHE: dict[str, tuple[int, datetime]] = {}


def token_hash(token: str) -> str:
    """SHA-256 (hex) des Geräte-Tokens — nur dieser Wert liegt in der DB."""
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def pin_hash(pin: str, *, tenant_id: str, user_id: str) -> str:
    """pbkdf2-hmac-sha256 der PIN, Salt aus tenant_id + user_id (hex).

    Das Salt ist absichtlich ableitbar statt zufällig: es gibt genau EINEN Hash
    je Person, und die Person ist beim Prüfen bekannt (Stempel-ID → Akte). Ein
    zufälliges Salt bräuchte eine zweite Spalte, ohne etwas zu gewinnen — die
    Aufgabe des Salts (dieselbe PIN zweier Personen ergibt zwei Hashes) erfüllt
    es so genauso.
    """
    return hashlib.pbkdf2_hmac(
        "sha256",
        pin.encode("utf-8"),
        f"{tenant_id}{user_id}".encode(),
        _PIN_RUNDEN,
    ).hex()


def _gesperrt_bis(stempel_id: str, *, jetzt_: datetime) -> datetime | None:
    eintrag = _FEHLVERSUCHE.get(stempel_id)
    if eintrag is None:
        return None
    versuche, bis = eintrag
    if bis <= jetzt_:
        _FEHLVERSUCHE.pop(stempel_id, None)
        return None
    return bis if versuche >= _MAX_FEHLVERSUCHE else None


def _fehlversuch(stempel_id: str, *, jetzt_: datetime) -> None:
    versuche, bis = _FEHLVERSUCHE.get(stempel_id, (0, jetzt_))
    if bis <= jetzt_:
        versuche = 0
    _FEHLVERSUCHE[stempel_id] = (versuche + 1, jetzt_ + _SPERRE)


def _erfolg(stempel_id: str) -> None:
    _FEHLVERSUCHE.pop(stempel_id, None)


def fehlversuche_leeren() -> None:
    """Nur für Tests: den prozesslokalen Zähler zurücksetzen."""
    _FEHLVERSUCHE.clear()


class TerminalError(Exception):
    """Fehler des Geräte-Pfads — trägt Status und Code wie `PersonalError`."""

    def __init__(
        self, message: str, *, status_code: int = 401, details: dict[str, Any] | None = None
    ) -> None:
        super().__init__(message)
        self.message = message
        self.status_code = status_code
        self.details = details


class TerminalService(PersonalBase):
    """Verwaltung der Geräte (Nutzer-JWT) UND der Geräte-Pfad (Token)."""

    # ------------------------------------------------------------------
    # Verwaltung (Guard MANAGE_PERSONAL)
    # ------------------------------------------------------------------

    def liste(self, ctx: AuthContext) -> list[Terminal]:
        tenant_id = self._require_tenant(ctx)
        rows = (
            self._db.table("personal_terminals")
            .select(_SPALTEN)
            .eq("tenant_id", tenant_id)
            .execute()
        ).data or []
        titel = self._property_titel(
            tenant_id, {str(r["property_id"]) for r in rows if r.get("property_id")}
        )
        aus = [self._terminal(r, titel) for r in rows]
        aus.sort(key=lambda t: (t.name.casefold(), t.id))
        return aus

    @staticmethod
    def _terminal(row: dict[str, Any], titel: dict[str, str]) -> Terminal:
        return Terminal(
            id=str(row["id"]),
            name=str(row["name"]),
            property_id=row.get("property_id"),
            property_title=titel.get(str(row.get("property_id") or "")),
            aktiv=bool(row.get("aktiv", True)),
            letzter_kontakt_am=als_dt(row.get("letzter_kontakt_am")),
            created_at=als_dt(row.get("created_at")),
        )

    def anlegen(self, ctx: AuthContext, req: TerminalCreate) -> TerminalMitToken:
        tenant_id = self._require_tenant(ctx)
        if req.property_id:
            self._property_im_tenant(tenant_id, req.property_id)
        token = secrets.token_urlsafe(_TOKEN_BYTES)
        try:
            row = (
                self._db.table("personal_terminals")
                .insert(
                    {
                        "tenant_id": tenant_id,
                        "name": req.name.strip(),
                        "property_id": req.property_id,
                        "token_hash": token_hash(token),
                        "aktiv": True,
                        "erstellt_von": ctx.user_id,
                    }
                )
                .execute()
                .data[0]
            )
        except APIError as exc:
            if getattr(exc, "code", None) == _UNIQUE_VERLETZUNG:
                raise PersonalError(
                    "Ein Terminal mit diesem Namen gibt es schon.",
                    status_code=409,
                    details={"code": "terminal_name_vergeben"},
                ) from exc
            raise
        log.info("personal_terminal_angelegt", tenant_id=tenant_id, terminal_id=str(row["id"]))
        titel = self._property_titel(
            tenant_id, {str(row["property_id"])} if row.get("property_id") else set()
        )
        return TerminalMitToken(**self._terminal(row, titel).model_dump(), token=token)

    def _own_terminal(self, tenant_id: str, terminal_id: str) -> dict[str, Any]:
        return load_scoped(
            self._db,
            "personal_terminals",
            terminal_id,
            tenant_id,
            columns=_SPALTEN,
            not_found=PersonalError("Terminal nicht gefunden.", status_code=404),
        )

    def aendern(self, ctx: AuthContext, terminal_id: str, req: TerminalUpdate) -> Terminal:
        tenant_id = self._require_tenant(ctx)
        vorher = self._own_terminal(tenant_id, terminal_id)
        payload = req.model_dump(exclude_unset=True)
        if not payload:
            titel = self._property_titel(
                tenant_id, {str(vorher["property_id"])} if vorher.get("property_id") else set()
            )
            return self._terminal(vorher, titel)
        if payload.get("name"):
            payload["name"] = str(payload["name"]).strip()
        if payload.get("property_id"):
            self._property_im_tenant(tenant_id, str(payload["property_id"]))
        try:
            (
                self._db.table("personal_terminals")
                .update(payload)
                .eq("id", terminal_id)
                .eq("tenant_id", tenant_id)
                .execute()
            )
        except APIError as exc:
            if getattr(exc, "code", None) == _UNIQUE_VERLETZUNG:
                raise PersonalError(
                    "Ein Terminal mit diesem Namen gibt es schon.",
                    status_code=409,
                    details={"code": "terminal_name_vergeben"},
                ) from exc
            raise
        neu = {**vorher, **payload}
        titel = self._property_titel(
            tenant_id, {str(neu["property_id"])} if neu.get("property_id") else set()
        )
        return self._terminal(neu, titel)

    def token_rotieren(self, ctx: AuthContext, terminal_id: str) -> TerminalToken:
        """Neues Token; das alte gilt ab sofort NICHT mehr (Wurzel 1: der alte
        Zustand wird mit derselben Aktion ungültig, nicht irgendwann später)."""
        tenant_id = self._require_tenant(ctx)
        self._own_terminal(tenant_id, terminal_id)
        token = secrets.token_urlsafe(_TOKEN_BYTES)
        (
            self._db.table("personal_terminals")
            .update({"token_hash": token_hash(token)})
            .eq("id", terminal_id)
            .eq("tenant_id", tenant_id)
            .execute()
        )
        log.info("personal_terminal_token_rotiert", tenant_id=tenant_id, terminal_id=terminal_id)
        return TerminalToken(token=token)

    def loeschen(self, ctx: AuthContext, terminal_id: str) -> None:
        tenant_id = self._require_tenant(ctx)
        self._own_terminal(tenant_id, terminal_id)
        (
            self._db.table("personal_terminals")
            .delete()
            .eq("id", terminal_id)
            .eq("tenant_id", tenant_id)
            .execute()
        )
        log.info("personal_terminal_geloescht", tenant_id=tenant_id, terminal_id=terminal_id)

    # ------------------------------------------------------------------
    # Terminal-Zugang einer Person (Stempel-ID + PIN)
    # ------------------------------------------------------------------

    def zugang_setzen(
        self, ctx: AuthContext, user_id: str, req: TerminalZugangSet
    ) -> TerminalZugang:
        tenant_id = self._require_tenant(ctx)
        self._require_person_im_scope(ctx, tenant_id, user_id)
        self._require_planbar(tenant_id, user_id)
        vorher = (
            self._db.table("personal_akten")
            .select("user_id, stempel_id, beschaeftigungsart")
            .eq("tenant_id", tenant_id)
            .eq("user_id", user_id)
            .limit(1)
            .execute()
        ).data or []
        if not vorher:
            raise PersonalError(
                "Erst die Akte anlegen, dann den Terminal-Zugang.",
                status_code=422,
                details={"code": "akte_fehlt"},
            )
        stempel_id = req.stempel_id or str(vorher[0].get("stempel_id") or "") or self._naechste_id(
            tenant_id
        )
        belegt = (
            self._db.table("personal_akten")
            .select("user_id")
            .eq("tenant_id", tenant_id)
            .eq("stempel_id", stempel_id)
            .execute()
        ).data or []
        if any(str(r["user_id"]) != user_id for r in belegt):
            raise PersonalError(
                "Diese Stempel-ID ist bereits vergeben.",
                status_code=409,
                details={"code": "stempel_id_vergeben"},
            )
        (
            self._db.table("personal_akten")
            .update(
                {
                    "stempel_id": stempel_id,
                    "terminal_pin_hash": pin_hash(
                        req.pin, tenant_id=tenant_id, user_id=user_id
                    ),
                }
            )
            .eq("tenant_id", tenant_id)
            .eq("user_id", user_id)
            .execute()
        )
        _erfolg(stempel_id)
        log.info(
            "personal_terminal_zugang_gesetzt",
            tenant_id=tenant_id,
            user_id=user_id,
            von=ctx.user_id,
        )
        return TerminalZugang(stempel_id=stempel_id)

    def _naechste_id(self, tenant_id: str) -> str:
        """Kleinste freie vierstellige ID ab 1000 — nie eine erfundene Lücke."""
        rows = (
            self._db.table("personal_akten")
            .select("stempel_id")
            .eq("tenant_id", tenant_id)
            .not_.is_("stempel_id", "null")
            .execute()
        ).data or []
        belegt = {str(r["stempel_id"]) for r in rows if r.get("stempel_id")}
        for n in range(1000, 10000):
            kandidat = f"{n:04d}"
            if kandidat not in belegt:
                return kandidat
        raise PersonalError(
            "Alle vierstelligen Stempel-IDs sind vergeben.",
            status_code=409,
            details={"code": "stempel_id_erschoepft"},
        )

    def zugang_entfernen(self, ctx: AuthContext, user_id: str) -> None:
        tenant_id = self._require_tenant(ctx)
        self._require_person_im_scope(ctx, tenant_id, user_id)
        (
            self._db.table("personal_akten")
            .update({"stempel_id": None, "terminal_pin_hash": None})
            .eq("tenant_id", tenant_id)
            .eq("user_id", user_id)
            .execute()
        )
        log.info(
            "personal_terminal_zugang_entfernt",
            tenant_id=tenant_id,
            user_id=user_id,
            von=ctx.user_id,
        )

    # ------------------------------------------------------------------
    # Geräte-Pfad (KEIN Nutzer-JWT)
    # ------------------------------------------------------------------

    def geraet_pruefen(self, token: str | None) -> dict[str, Any]:
        """Token → Terminal-Zeile. Fail-closed (Wurzel 5), drei Gründe für 401.

        Der Lookup läuft über den Hash (indexiert, `unique`), der Nachvergleich
        über `secrets_match`: so hängt die Antwortzeit nicht am Token-Inhalt und
        ein Nicht-ASCII-Header wirft keinen 500.
        """
        if not token:
            raise TerminalError("Terminal-Token fehlt.", details={"code": "token_fehlt"})
        erwartet = token_hash(token)
        rows = (
            self._db.table("personal_terminals")
            .select(_SPALTEN + ", token_hash")
            .eq("token_hash", erwartet)
            .limit(1)
            .execute()
        ).data or []
        if not rows or not secrets_match(str(rows[0].get("token_hash") or ""), erwartet):
            raise TerminalError("Terminal unbekannt.", details={"code": "token_unbekannt"})
        row = rows[0]
        if not row.get("aktiv"):
            raise TerminalError(
                "Dieses Terminal ist deaktiviert.", details={"code": "terminal_inaktiv"}
            )
        regeln = self._regeln_row(str(row["tenant_id"])) or {}
        if not regeln.get("terminal_aktiv"):
            raise TerminalError(
                "Der Betrieb hat Terminals nicht freigegeben.",
                details={"code": "terminal_nicht_freigegeben"},
            )
        try:
            (
                self._db.table("personal_terminals")
                .update({"letzter_kontakt_am": jetzt().isoformat()})
                .eq("id", str(row["id"]))
                .execute()
            )
        except Exception as exc:  # noqa: BLE001 — Kontaktstempel ist Nebenpfad
            log.warning(
                "personal_terminal_kontakt_fehlgeschlagen",
                terminal_id=str(row["id"]),
                error=str(exc)[:200],
            )
        return row

    def info(self, terminal: dict[str, Any]) -> TerminalInfo:
        tenant_id = str(terminal["tenant_id"])
        betrieb = (
            self._db.table("tenants").select("name").eq("id", tenant_id).limit(1).execute()
        ).data or []
        regeln = self._regeln_row(tenant_id) or {}
        titel = None
        if terminal.get("property_id"):
            titel = self._property_titel(tenant_id, {str(terminal["property_id"])}).get(
                str(terminal["property_id"])
            )
        return TerminalInfo(
            terminal=TerminalGeraet(name=str(terminal["name"]), property_title=titel),
            betrieb=TerminalBetrieb(
                name=str((betrieb[0].get("name") if betrieb else None) or ""),
                zeitzone=str(regeln.get("zeitzone") or "UTC"),
            ),
            wetter_heute=self._wetter_heute(tenant_id, terminal.get("property_id")),
        )

    def _wetter_heute(self, tenant_id: str, property_id: object) -> TerminalWetter | None:
        """Gecachte Wetterzeile des Objekts (B1 füllt `wetter_tage`).

        Ohne Koordinate, ohne Cache-Zeile oder mit abgeschalteter Wetteranzeige
        gibt es KEIN Wetter — hier wird nichts abgerufen und nichts geschätzt
        (Wurzel 4); das Holen ist Sache von B1 (`wetter.py`).
        """
        regeln = self._regeln_row(tenant_id) or {}
        if not regeln.get("wetter_anzeigen", True) or not property_id:
            return None
        objekte = (
            self._db.table("properties")
            .select("lat, lng")
            .eq("id", str(property_id))
            .eq("tenant_id", tenant_id)
            .limit(1)
            .execute()
        ).data or []
        if not objekte or objekte[0].get("lat") is None or objekte[0].get("lng") is None:
            return None
        heute = datetime.now(UTC).date()
        rows = (
            self._db.table("wetter_tage")
            .select("datum, temp_min, temp_max, code, niederschlag_mm")
            .eq("lat", round(float(objekte[0]["lat"]), 2))
            .eq("lng", round(float(objekte[0]["lng"]), 2))
            .eq("datum", heute.isoformat())
            .limit(1)
            .execute()
        ).data or []
        if not rows:
            return None
        r = rows[0]
        return TerminalWetter(
            datum=str(r.get("datum") or heute.isoformat()),
            temp_min=None if r.get("temp_min") is None else float(r["temp_min"]),
            temp_max=None if r.get("temp_max") is None else float(r["temp_max"]),
            code=None if r.get("code") is None else int(r["code"]),
            niederschlag_mm=(
                None if r.get("niederschlag_mm") is None else float(r["niederschlag_mm"])
            ),
        )

    # --- Person am Gerät -------------------------------------------------

    def _person(self, tenant_id: str, stempel_id: str) -> dict[str, Any]:
        rows = (
            self._db.table("personal_akten")
            .select("user_id, stempel_id, terminal_pin_hash")
            .eq("tenant_id", tenant_id)
            .eq("stempel_id", stempel_id)
            .limit(1)
            .execute()
        ).data or []
        if not rows:
            raise TerminalError(
                "Diese Stempel-ID gibt es nicht.",
                status_code=404,
                details={"code": "stempel_id_unbekannt"},
            )
        return rows[0]

    @staticmethod
    def _anzeige_name(full_name: str | None) -> str:
        """„Mette Rein" → „Mette R." — der Bildschirm ist öffentlich."""
        teile = [t for t in str(full_name or "").split() if t]
        if not teile:
            return "—"
        if len(teile) == 1:
            return teile[0]
        return f"{teile[0]} {teile[-1][0]}."

    def status(self, terminal: dict[str, Any], stempel_id: str) -> TerminalStatus:
        tenant_id = str(terminal["tenant_id"])
        person = self._person(tenant_id, stempel_id)
        user_id = str(person["user_id"])
        users = self._users(tenant_id, {user_id})
        offen = self._offene_stempelung(tenant_id, user_id)
        return TerminalStatus(
            anzeige_name=self._anzeige_name(users[0].get("full_name") if users else None),
            offen=offen,
            schicht_heute=self._schicht_heute(tenant_id, user_id),
        )

    def _offene_stempelung(self, tenant_id: str, user_id: str) -> Zeiterfassung | None:
        from .zeiterfassung import ZeiterfassungService  # noqa: PLC0415 — Zyklus vermeiden

        svc = ZeiterfassungService(self._db)
        row = svc.offene_row(tenant_id, user_id)
        return svc.eintrag(row, {}) if row else None

    def _schicht_heute(self, tenant_id: str, user_id: str) -> TerminalSchichtHeute | None:
        heute = datetime.now(UTC).date()
        rows = (
            self._db.table("personal_schichten")
            .select("id, start_at, end_at, arbeitsbereich_id, status, datum")
            .eq("tenant_id", tenant_id)
            .eq("user_id", user_id)
            .eq("datum", heute.isoformat())
            .in_("status", list(_AKTIVE_SCHICHT))
            .execute()
        ).data or []
        if not rows:
            return None
        rows.sort(key=lambda r: str(r.get("start_at") or ""))
        r = rows[0]
        start, ende = als_dt(r.get("start_at")), als_dt(r.get("end_at"))
        if start is None or ende is None:
            return None
        return TerminalSchichtHeute(
            start_at=start,
            end_at=ende,
            arbeitsbereich_kurz=self._bereich_kurz(tenant_id, r.get("arbeitsbereich_id")),
        )

    def _bereich_kurz(self, tenant_id: str, bereich_id: object) -> str | None:
        if not bereich_id:
            return None
        rows = (
            self._db.table("personal_arbeitsbereiche")
            .select("kurz")
            .eq("tenant_id", tenant_id)
            .eq("id", str(bereich_id))
            .limit(1)
            .execute()
        ).data or []
        return str(rows[0]["kurz"]) if rows and rows[0].get("kurz") else None

    def stempeln(
        self, terminal: dict[str, Any], req: TerminalStempeln, *, jetzt_: datetime | None = None
    ) -> Zeiterfassung:
        """PIN prüfen, dann die Aktion über den ZeiterfassungService ausführen.

        Der Stempelweg selbst ist NICHT kopiert: dieselbe Methode, die die App
        und das Web rufen, läuft hier mit `quelle='terminal'` und dem
        Terminal-Bezug. Eine zweite Stempellogik wäre die nächste Stelle, an der
        eine Regel (Einstempel-Regel, GPS) fehlt.
        """
        from .zeiterfassung import ZeiterfassungService  # noqa: PLC0415 — Zyklus vermeiden

        tenant_id = str(terminal["tenant_id"])
        now = (jetzt_ or jetzt()).astimezone(UTC)
        gesperrt = _gesperrt_bis(req.stempel_id, jetzt_=now)
        if gesperrt is not None:
            raise TerminalError(
                "Zu viele Fehlversuche. Bitte in einigen Minuten erneut versuchen.",
                status_code=423,
                details={
                    "code": "gesperrt",
                    "bis": gesperrt.isoformat(),
                    "minuten": max(1, int((gesperrt - now).total_seconds() // 60) + 1),
                },
            )
        person = self._person(tenant_id, req.stempel_id)
        user_id = str(person["user_id"])
        erwartet = str(person.get("terminal_pin_hash") or "")
        if not erwartet or not secrets_match(
            pin_hash(req.pin, tenant_id=tenant_id, user_id=user_id), erwartet
        ):
            _fehlversuch(req.stempel_id, jetzt_=now)
            log.warning(
                "personal_terminal_pin_falsch",
                tenant_id=tenant_id,
                terminal_id=str(terminal["id"]),
                stempel_id=req.stempel_id,
            )
            raise TerminalError("PIN falsch.", status_code=401, details={"code": "pin_falsch"})
        _erfolg(req.stempel_id)
        svc = ZeiterfassungService(self._db)
        return svc.terminal_aktion(
            tenant_id=tenant_id,
            user_id=user_id,
            aktion=req.aktion,
            terminal_id=str(terminal["id"]),
            property_id=(
                str(terminal["property_id"]) if terminal.get("property_id") else None
            ),
            jetzt_=now,
        )


def heute_in(zeitzone: str, *, jetzt_: datetime | None = None) -> date:
    """Kalendertag in der Betriebszone — der Terminal-Tag ist Ortszeit."""
    from zoneinfo import ZoneInfo  # noqa: PLC0415 — nur hier gebraucht

    try:
        zone = ZoneInfo(zeitzone)
    except Exception:  # noqa: BLE001 — unbekannte Zone: UTC statt Absturz
        return (jetzt_ or jetzt()).astimezone(UTC).date()
    return (jetzt_ or jetzt()).astimezone(zone).date()


def get_terminal_service(db: Client | None = None) -> TerminalService:
    """Factory für die Router-Dependency (die echte sitzt in `dependencies.py`)."""
    if db is not None:
        return TerminalService(db)
    from src.core.supabase import get_service_client  # noqa: PLC0415 — Import-Kosten

    return TerminalService(service_client=get_service_client())
