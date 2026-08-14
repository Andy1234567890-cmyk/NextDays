"""OAuth-2.1-Authorization-Server für den MCP-Connector (0385).

Warum eigen gebaut und nicht der vorhandene Token-Endpunkt aus `api_clients`:
Der ist ein `client_credentials`-Grant (Maschine ohne Nutzer). Anthropic
unterstützt den für Connectors AUSDRÜCKLICH NICHT — „Every connection requires
user consent". Gebraucht wird der user-delegierte Authorization-Code-Flow mit
PKCE, samt Zustimmungsdialog.

Warum CIMD statt Dynamic Client Registration: Bei DCR registriert Claude bei
jeder frischen Verbindung einen neuen Client; bei vielen Betrieben wüchse die
Client-Tabelle unbegrenzt. Mit CIMD IST die `client_id` eine HTTPS-URL, die auf
die Client-Metadaten zeigt — es gibt keine Registrierung und keine Tabelle.
Anthropic empfiehlt das für Server mit vielen Nutzern ausdrücklich.

SICHERHEIT (MCP-Security-Spec + OAuth 2.1):
* Codes und Refresh-Token liegen NUR als SHA-256 in der DB.
* Codes sind EINMAL einlösbar; ein zweiter Versuch ist ein Angriffssignal.
* Refresh-Token rotieren, mit Reuse-Detection über die Nachfolger-Kette.
* Die `redirect_uri` wird exakt verglichen (kein Präfix, keine Wildcards) und
  muss same-origin zur CIMD-URL sein.
* Der Token trägt die angeforderte `resource` als Audience (RFC 8707) — ein
  Token für einen fremden Dienst wird von unserem Resource-Server abgelehnt.
* Zustimmung wird je (Nutzer, Client) gespeichert und VOR der Weiterleitung
  geprüft (gegen Confused Deputy).
"""
from __future__ import annotations

import base64
import hashlib
import ipaddress
import secrets
import socket
from datetime import UTC, datetime, timedelta
from urllib.parse import urlparse

import httpx
import jwt
from supabase import Client

from src.core.config import Settings
from src.core.logging import get_logger
from src.core.security import secrets_match

log = get_logger("nextdays.mcp.oauth")

# Eigene Audience-Kennung, getrennt von `mynextdays-api` (api_clients): ein
# Client-Credentials-Token darf den MCP-Server nie erreichen und umgekehrt.
TOKEN_AUDIENCE = "mynextdays-mcp"  # noqa: S105 — JWT-Audience, kein Secret

# Kurz, weil der Code sofort eingelöst wird. Die Spec empfiehlt „maximal ein
# paar Minuten"; 60 s reichen für einen Redirect und begrenzen das Fenster.
CODE_TTL_SEKUNDEN = 60
ACCESS_TOKEN_TTL_SEKUNDEN = 3600
REFRESH_TOKEN_TTL_TAGE = 30

# Scopes, die der MCP-Server kennt.
#
# WAS BEWUSST FEHLT: ein Scope für den Konto-Bereich (`/konto` — Abo,
# Rechnungen, Nutzerverwaltung, Sicherheit, API-Zugang und die MCP-Verbindungen
# selbst). Dort sitzen die Rechtevergabe und die Geldflüsse DES BETRIEBS; ein
# Assistent hat dort nichts verloren. Er ist nicht „standardmässig aus", es gibt
# ihn NICHT — und kein Werkzeug, das ihn bediente. Was nicht existiert, kann
# auch nicht versehentlich freigeschaltet werden.
#
# Der wichtigste Einzelfall darin: `/konto/verbindungen`. Könnte der Connector
# seinen eigenen Scope ändern, wäre jede Begrenzung hier nur eine Bitte.
# Rechteverwaltung erreicht man ausschliesslich als angemeldeter Mensch in der
# Oberfläche.
SCOPE_LESEN = "mcp:read"

# Freitexte sind ein EIGENER Scope, nicht Teil von `mcp:read` — und er ist
# standardmässig AUS (Art. 25 Abs. 2 DSGVO: die datenschutzfreundlichste
# Voreinstellung).
#
# Grund: Buchungsnotizen und Gastnachrichten sind inhaltlich unbegrenzt. In der
# Praxis steht dort „Rollstuhl", „Allergie", „glutenfrei" — Gesundheitsdaten
# nach Art. 9 DSGVO. Der EuGH legt das weit aus (C-252/21 Rn. 89): enthält ein
# gemeinsam erhobener Datensatz EIN sensibles Element, ist das GESAMTE Feld an
# Art. 9 zu messen. Für solche Daten trägt nur die ausdrückliche Einwilligung
# (Art. 9 Abs. 2 lit. a) — die für einen Dienst in einem Drittland regelmässig
# nicht vorliegt.
#
# Ein Betrieb, der diese Felder braucht, schaltet den Scope bewusst dazu. Wer
# nur Belegung und Buchungen auswerten will, überträgt sie nie.
SCOPE_FREITEXT = "mcp:freetext"

# Schreiben im OPERATIVEN Geschäft: Buchungen anlegen/verschieben/stornieren,
# Kalender sperren, Preise und Restriktionen setzen, Aufgaben führen,
# Gastnachrichten senden. NICHT im Konto (siehe oben).
#
# Eigener Scope statt Teil von `mcp:read`, weil der Unterschied zwischen Lesen
# und Schreiben hier real ist: Diese Aufrufe gehen über Channex LIVE an die
# Portale. Ein falsch gesetzter Preis steht binnen Minuten bei Booking.com, eine
# irrtümliche Sperre kostet verkaufbare Nächte. Wer nur auswerten will, soll das
# Risiko nie tragen — deshalb ist Schreiben zuschaltbar und AUS als Vorgabe
# (Art. 25 Abs. 2 DSGVO, und schlicht kaufmännische Vernunft).
SCOPE_SCHREIBEN = "mcp:write"

UNTERSTUETZTE_SCOPES = (SCOPE_LESEN, SCOPE_FREITEXT, SCOPE_SCHREIBEN)


def scope_bauen(*, freitexte: bool = False, schreiben: bool = False) -> str:
    """Scope aus Achsen zusammensetzen — die EINE Stelle, die das tut.

    Vorher wurde der Wert an drei Stellen per String-Verkettung gebaut, und der
    Zustimmungsdialog hängte `mcp:freetext` an einen Scope an, der ihn schon
    enthielt: live stand `mcp:read mcp:freetext mcp:freetext` in der Datenbank
    (gefunden 14.08.2026). Harmlos in der Wirkung, aber ein Wert, der doppelt
    dasteht, ist ein Wert, dem man nicht ansieht, ob er stimmt.

    `mcp:read` ist immer dabei: eine Verbindung, die nichts lesen darf, hätte
    keinen Zweck — und Schreiben ohne Lesen wäre blindes Schreiben.
    """
    teile = [SCOPE_LESEN]
    if freitexte:
        teile.append(SCOPE_FREITEXT)
    if schreiben:
        teile.append(SCOPE_SCHREIBEN)
    return " ".join(teile)


def scope_normalisieren(roh: str) -> str:
    """Fremden/gewachsenen Scope auf die bekannten Achsen zurückführen.

    Entfernt Doppelungen und Unbekanntes und stellt eine feste Reihenfolge her,
    damit zwei gleiche Zustimmungen auch gleich AUSSEHEN.
    """
    vorhanden = set(roh.split())
    return scope_bauen(
        freitexte=SCOPE_FREITEXT in vorhanden,
        schreiben=SCOPE_SCHREIBEN in vorhanden,
    )

# Anthropic ruft aus diesem Bereich an; die CIMD-URL wird von UNS geholt.
_CIMD_TIMEOUT_SEKUNDEN = 5.0
_CIMD_MAX_BYTES = 64 * 1024


class OAuthError(Exception):
    """OAuth-Fehler mit RFC-6749-Code; der Router macht daraus die Antwort."""

    def __init__(
        self, code: str, beschreibung: str, *, status_code: int = 400
    ) -> None:
        super().__init__(beschreibung)
        self.code = code
        self.beschreibung = beschreibung
        self.status_code = status_code


def _hash(wert: str) -> str:
    """SHA-256 wie in `api_clients`: der Wert ist bereits Zufall mit hoher
    Entropie, ein langsames Passwort-Hashverfahren brächte hier nichts."""
    return hashlib.sha256(wert.encode()).hexdigest()


def _jetzt() -> datetime:
    return datetime.now(UTC)


def _ist_oeffentliche_url(url: str) -> bool:
    """HTTPS + auflösbarer, NICHT-interner Host.

    Die CIMD-URL kommt vom Client und wird von UNSEREM Server geholt — das ist
    ein SSRF-Vektor (Wurzel 8). Geprüft wird gegen die aufgelöste IP, nicht
    gegen den Namen: `interne.firma` kann auf 10.x zeigen.
    """
    teile = urlparse(url)
    if teile.scheme != "https" or not teile.hostname:
        return False
    try:
        infos = socket.getaddrinfo(teile.hostname, 443, proto=socket.IPPROTO_TCP)
    except OSError:
        return False
    return all(_ist_oeffentliche_ip(info[4][0]) for info in infos)


def _ist_oeffentliche_ip(roh: str) -> bool:
    """Zeigt diese Adresse ins öffentliche Netz?

    `is_private` allein reicht nicht: CGNAT (100.64/10) ist formal nicht privat,
    führt aber ins Providernetz, und 169.254.x ist der Cloud-Metadaten-Dienst.
    """
    adresse = ipaddress.ip_address(roh)
    # IPv4-mapped IPv6 (::ffff:10.0.0.1) auspacken — sonst rutscht eine interne
    # Adresse in dieser Schreibweise durch.
    if getattr(adresse, "ipv4_mapped", None) is not None:
        adresse = adresse.ipv4_mapped
    unerlaubt = (
        adresse.is_private,
        adresse.is_loopback,
        adresse.is_link_local,      # 169.254.x — Cloud-Metadaten
        adresse.is_reserved,
        adresse.is_multicast,
        adresse in ipaddress.ip_network("100.64.0.0/10"),  # CGNAT
    )
    return not any(unerlaubt)


def _gleicher_ursprung(a: str, b: str) -> bool:
    """Schema + Host + Port identisch."""
    ua, ub = urlparse(a), urlparse(b)
    return (ua.scheme, ua.hostname, ua.port) == (ub.scheme, ub.hostname, ub.port)


class McpOAuthService:
    """Autorisierungscodes, Token und Zustimmungen des MCP-Connectors."""

    def __init__(self, db: Client | None, settings: Settings) -> None:
        self._db = db
        self._settings = settings

    # -- Infrastruktur ------------------------------------------------------

    def _client(self) -> Client:
        if self._db is None:
            raise OAuthError(
                "server_error", "DB nicht verfügbar.", status_code=500
            )
        return self._db

    def _secret(self) -> str:
        """Signier-Secret. Fehlt es, wird KEIN Token ausgegeben (fail-closed)."""
        wert = self._settings.api_token_secret.get_secret_value()
        if not wert:
            raise OAuthError(
                "server_error",
                "MCP-Token-Ausgabe nicht konfiguriert.",
                status_code=503,
            )
        return wert

    def basis_url(self) -> str:
        """Öffentliche Adresse DIESER API (Issuer + Resource).

        `public_api_url`, NICHT `app_base_url`: letzteres ist das Dashboard,
        diese API läuft unter einer eigenen Domain. Der Wert steht in den
        Discovery-Dokumenten und wird von Claude EXAKT mit der eingetragenen URL
        verglichen — eine Verwechslung schickt den Flow an einen Host ohne
        MCP-Endpunkt.

        Bewusst die BESTEHENDE Einstellung wiederverwendet (sie speist schon den
        Channex-Webhook-Callback und die TrustedHost-Liste): eine zweite
        Variable für dieselbe Adresse liefe irgendwann auseinander.

        Fehlt sie, ist das ein Konfigurationsfehler — dann lieber klar
        fehlschlagen als Metadaten mit geratener Domain ausliefern (Wurzel 4).
        """
        basis = (self._settings.public_api_url or "").rstrip("/")
        if not basis:
            raise OAuthError(
                "server_error",
                "public_api_url nicht gesetzt — MCP-Discovery nicht möglich.",
                status_code=503,
            )
        return basis

    # -- CIMD ---------------------------------------------------------------

    def client_metadaten(self, client_id: str) -> dict:
        """Client-Metadaten von der `client_id`-URL holen und prüfen.

        Drei Prüfungen, alle notwendig:
        1. Die URL ist öffentlich und HTTPS (SSRF, s. `_ist_oeffentliche_url`).
        2. Das Dokument ist SELBSTREFERENZIELL — sein `client_id`-Feld ist
           genau die URL, unter der es liegt. Ohne das könnte jede Seite ein
           Dokument ausliefern, das sich als fremder Client ausgibt.
        3. Die `redirect_uris` sind same-origin zur `client_id`-URL. Da das
           Dokument selbst-behauptet ist, ist das die einzige Bindung zwischen
           Identität und Rückleitungsziel.
        """
        if not _ist_oeffentliche_url(client_id):
            raise OAuthError(
                "invalid_client",
                "client_id muss eine öffentliche HTTPS-URL sein.",
            )
        try:
            with httpx.Client(timeout=_CIMD_TIMEOUT_SEKUNDEN, follow_redirects=False) as c:
                antwort = c.get(client_id, headers={"Accept": "application/json"})
        except httpx.HTTPError as exc:
            raise OAuthError(
                "invalid_client", "client_id-Dokument nicht erreichbar."
            ) from exc
        if antwort.status_code != 200:
            raise OAuthError(
                "invalid_client",
                f"client_id-Dokument antwortete {antwort.status_code}.",
            )
        if len(antwort.content) > _CIMD_MAX_BYTES:
            raise OAuthError("invalid_client", "client_id-Dokument zu groß.")
        try:
            daten = antwort.json()
        except ValueError as exc:
            raise OAuthError(
                "invalid_client", "client_id-Dokument ist kein JSON."
            ) from exc
        if not isinstance(daten, dict) or daten.get("client_id") != client_id:
            raise OAuthError(
                "invalid_client",
                "client_id-Dokument ist nicht selbstreferenziell.",
            )
        return daten

    @staticmethod
    def redirect_erlaubt(metadaten: dict, redirect_uri: str) -> bool:
        """Exakter Vergleich gegen die registrierten `redirect_uris`.

        Loopback-Adressen (native Clients wie Claude Code) werden OHNE Port
        verglichen — RFC 8252 §7.3 verlangt das, weil solche Clients zur
        Laufzeit einen freien Port binden.
        """
        erlaubte = metadaten.get("redirect_uris")
        if not isinstance(erlaubte, list):
            return False
        ziel = urlparse(redirect_uri)
        for eintrag in erlaubte:
            if not isinstance(eintrag, str):
                continue
            if eintrag == redirect_uri:
                return True
            kandidat = urlparse(eintrag)
            ist_loopback = kandidat.hostname in ("localhost", "127.0.0.1", "::1")
            if (
                ist_loopback
                and (kandidat.scheme, kandidat.hostname, kandidat.path)
                == (ziel.scheme, ziel.hostname, ziel.path)
            ):
                return True
        return False

    # -- Zustimmung ---------------------------------------------------------

    def hat_zugestimmt(self, user_id: str, client_id: str) -> bool:
        """Wurde diesem Client von diesem Nutzer bereits zugestimmt?

        Pflichtprüfung VOR der Weiterleitung (Confused Deputy): ohne sie könnte
        ein Angreifer mit einer eigenen `redirect_uri` eine bestehende Sitzung
        ausnutzen und den Code abgreifen.
        """
        treffer = (
            self._client()
            .table("mcp_consents")
            .select("id")
            .eq("user_id", user_id)
            .eq("client_id", client_id)
            .is_("revoked_at", "null")
            .limit(1)
            .execute()
        ).data
        return bool(treffer)

    def zustimmen(
        self, *, tenant_id: str, user_id: str, client_id: str, scope: str
    ) -> None:
        """Zustimmung erteilen (idempotent — Doppelklick ist real, Wurzel 2).

        Der Scope wird NORMALISIERT gespeichert: Der Dialog liefert ihn als
        zusammengesetzten String, und ein doppelt angehängter Wert stand live
        auch doppelt in der Tabelle. Hier ist die letzte Stelle, an der das
        auffallen kann — also fällt es hier auf.
        """
        self._client().table("mcp_consents").upsert(
            {
                "tenant_id": tenant_id,
                "user_id": user_id,
                "client_id": client_id,
                "scope": scope_normalisieren(scope),
                "revoked_at": None,
            },
            on_conflict="user_id,client_id",
        ).execute()

    def zustimmung_widerrufen(self, user_id: str, client_id: str) -> None:
        """Verbindung trennen. Die Zeile bleibt als Nachweis stehen."""
        self._client().table("mcp_consents").update(
            {"revoked_at": _jetzt().isoformat()}
        ).eq("user_id", user_id).eq("client_id", client_id).execute()

    def umfang_aendern(
        self,
        *,
        user_id: str,
        client_id: str,
        freitexte: bool,
        schreiben: bool | None = None,
    ) -> str:
        """Umfang einer BESTEHENDEN Verbindung ändern.

        `schreiben=None` lässt die Schreib-Achse unverändert — so kann die
        Oberfläche weiterhin nur die Freitexte umschalten, ohne die andere
        Achse ungewollt zurückzusetzen.

        Gibt den neuen Scope zurück.

        WARUM ÜBERHAUPT: Der Umfang wurde bisher nur beim Verbinden gewählt.
        Wer die Freitexte später brauchte, musste trennen und neu verbinden —
        und der Werkzeug-Hinweis versprach dabei eine Freigabe „unter Konto →
        Verbindungen", die es dort nicht gab (gefunden 13.08.2026).

        DER SCHARFE TEIL ist das ABSCHALTEN. Ein bereits ausgestellter
        Access-Token trägt seinen Scope IM Token und lebt bis zu einer Stunde
        weiter — eine Änderung nur an der Zustimmungszeile wäre für diese
        Stunde wirkungslos, und die Oberfläche behauptete etwas Falsches.
        Deshalb werden beim Entzug die Refresh-Token gelöscht: Der Client muss
        die Zustimmung neu einholen, und `token_pruefen` prüft ohnehin bei
        JEDEM Aufruf, ob die Zustimmung noch gilt (0388). Beim ZUSCHALTEN ist
        das nicht nötig — ein alter Token kann dadurch nur weniger dürfen, nie
        mehr.
        """
        db = self._client()
        # Die Schreib-Achse nur anfassen, wenn sie mitgeschickt wurde — sonst
        # den bestehenden Wert weiterführen. Ein Umschalten der Freitexte darf
        # eine erteilte Schreibfreigabe nicht stillschweigend entziehen.
        if schreiben is None:
            bisher = self._zustimmung_scope(user_id, client_id)
            if bisher is None:
                raise OAuthError(
                    "invalid_request",
                    "Verbindung nicht gefunden.",
                    status_code=404,
                )
            schreiben = SCOPE_SCHREIBEN in bisher.split()

        neu = scope_bauen(freitexte=freitexte, schreiben=schreiben)
        geaendert = (
            db.table("mcp_consents")
            .update({"scope": neu})
            .eq("user_id", user_id)
            .eq("client_id", client_id)
            .is_("revoked_at", "null")
            .execute()
        ).data
        if not geaendert:
            raise OAuthError(
                "invalid_request",
                "Verbindung nicht gefunden.",
                status_code=404,
            )
        # Jeder ENTZUG muss sofort wirken, nicht erst nach Ablauf des
        # Zugangstokens — bei den Freitexten wie beim Schreiben.
        if not freitexte or not schreiben:
            # Fail-closed: lieber eine Verbindung, die neu bestätigt werden
            # muss, als eine, die noch eine Stunde lang Freitexte liefert.
            db.table("mcp_refresh_tokens").delete().eq(
                "user_id", user_id
            ).eq("client_id", client_id).execute()
        return neu

    # -- Autorisierungscode -------------------------------------------------

    def code_ausstellen(
        self,
        *,
        tenant_id: str,
        user_id: str,
        client_id: str,
        redirect_uri: str,
        code_challenge: str,
        scope: str,
        resource: str,
    ) -> str:
        """Einmal-Code erzeugen und NUR seinen Hash speichern."""
        code = secrets.token_urlsafe(32)
        self._client().table("mcp_auth_codes").insert({
            "code_hash": _hash(code),
            "tenant_id": tenant_id,
            "user_id": user_id,
            "client_id": client_id,
            "redirect_uri": redirect_uri,
            "code_challenge": code_challenge,
            "scope": scope,
            "resource": resource,
            "expires_at": (
                _jetzt() + timedelta(seconds=CODE_TTL_SEKUNDEN)
            ).isoformat(),
        }).execute()
        return code

    def _code_einloesen(
        self, *, code: str, client_id: str, redirect_uri: str, verifier: str
    ) -> dict:
        """Code prüfen und verbrauchen. Jeder Fehler → `invalid_grant`.

        Die Meldung nennt nie, WELCHE Prüfung fehlschlug: unbekannt, abgelaufen,
        falscher Client und falscher Verifier sehen von außen gleich aus.
        """
        zeilen = (
            self._client()
            .table("mcp_auth_codes")
            .select("*")
            .eq("code_hash", _hash(code))
            .limit(1)
            .execute()
        ).data
        zeile = zeilen[0] if zeilen else None
        if not zeile:
            raise OAuthError("invalid_grant", "Code ungültig oder abgelaufen.")

        if zeile.get("used_at"):
            # Wiederverwendung heißt: der Code wurde abgefangen. Laut, aber
            # nach außen dieselbe Meldung.
            log.warning(
                "mcp_auth_code_wiederverwendet",
                client_id=client_id[:120],
                user_id=str(zeile.get("user_id")),
            )
            raise OAuthError("invalid_grant", "Code ungültig oder abgelaufen.")

        if _als_zeitpunkt(zeile.get("expires_at")) < _jetzt():
            raise OAuthError("invalid_grant", "Code ungültig oder abgelaufen.")
        if zeile.get("client_id") != client_id:
            raise OAuthError("invalid_grant", "Code ungültig oder abgelaufen.")
        if zeile.get("redirect_uri") != redirect_uri:
            raise OAuthError("invalid_grant", "Code ungültig oder abgelaufen.")

        # PKCE S256: BASE64URL(SHA256(verifier)) == challenge, zeitkonstant.
        erwartet = _pkce_challenge(verifier)
        if not secrets_match(erwartet, str(zeile.get("code_challenge") or "")):
            raise OAuthError("invalid_grant", "Code ungültig oder abgelaufen.")

        # Erst JETZT als verbraucht markieren, gescoped auf „noch unbenutzt":
        # zwei gleichzeitige Einlösungen (Retry, Doppelklick — Wurzel 2) können
        # so nicht beide ein Token bekommen.
        quittung = (
            self._client()
            .table("mcp_auth_codes")
            .update({"used_at": _jetzt().isoformat()})
            .eq("code_hash", _hash(code))
            .is_("used_at", "null")
            .execute()
        )
        if not quittung.data:
            raise OAuthError("invalid_grant", "Code ungültig oder abgelaufen.")
        return zeile

    # -- Token --------------------------------------------------------------

    def _access_token(
        self, *, tenant_id: str, user_id: str, client_id: str,
        scope: str, resource: str,
    ) -> str:
        jetzt = _jetzt()
        return jwt.encode(
            {
                "sub": user_id,
                # RFC 8707: die Audience ist die angeforderte Ressource. Der
                # Resource-Server prüft sie — ein Token für einen anderen
                # Dienst wird abgelehnt (Token-Passthrough ist verboten).
                "aud": resource or TOKEN_AUDIENCE,
                "iss": self.basis_url(),
                "tenant_id": tenant_id,
                # WER fragt. Zwei Dinge hängen daran: die Gegenprüfung der
                # Zustimmung (ein getrennter Client verliert sofort) und der
                # Zugriffslog, der ohne sie nicht sagen könnte, welche
                # Verbindung gelesen hat.
                "client_id": client_id,
                "scope": scope,
                "iat": jetzt,
                "exp": jetzt + timedelta(seconds=ACCESS_TOKEN_TTL_SEKUNDEN),
            },
            self._secret(),
            algorithm="HS256",
        )

    def _refresh_ausstellen(
        self, *, tenant_id: str, user_id: str, client_id: str,
        scope: str, resource: str,
    ) -> str:
        token = secrets.token_urlsafe(48)
        self._client().table("mcp_refresh_tokens").insert({
            "token_hash": _hash(token),
            "tenant_id": tenant_id,
            "user_id": user_id,
            "client_id": client_id,
            "scope": scope,
            "resource": resource,
            "expires_at": (
                _jetzt() + timedelta(days=REFRESH_TOKEN_TTL_TAGE)
            ).isoformat(),
        }).execute()
        return token

    def token_aus_code(
        self, *, code: str, client_id: str, redirect_uri: str, verifier: str
    ) -> dict:
        """Authorization-Code → Access- + Refresh-Token."""
        zeile = self._code_einloesen(
            code=code, client_id=client_id,
            redirect_uri=redirect_uri, verifier=verifier,
        )
        tenant_id = str(zeile["tenant_id"])
        user_id = str(zeile["user_id"])
        scope = str(zeile.get("scope") or "")
        resource = str(zeile.get("resource") or "")
        return {
            "access_token": self._access_token(
                tenant_id=tenant_id, user_id=user_id, client_id=client_id,
                scope=scope, resource=resource,
            ),
            "token_type": "Bearer",
            "expires_in": ACCESS_TOKEN_TTL_SEKUNDEN,
            "refresh_token": self._refresh_ausstellen(
                tenant_id=tenant_id, user_id=user_id, client_id=client_id,
                scope=scope, resource=resource,
            ),
            "scope": scope,
        }

    def token_aus_refresh(self, *, refresh_token: str, client_id: str) -> dict:
        """Refresh → neues Paar; der alte Token wird dabei ungültig.

        REUSE-DETECTION: Wird ein bereits rotierter Token erneut vorgelegt, ist
        er abgefangen worden. Dann werden ALLE Token dieses (Nutzer, Client)
        verworfen — der Angreifer und der echte Client verlieren beide den
        Zugang, und der Nutzer muss neu zustimmen. Das ist die vorgesehene
        Reaktion, kein Härtefall.
        """
        zeilen = (
            self._client()
            .table("mcp_refresh_tokens")
            .select("*")
            .eq("token_hash", _hash(refresh_token))
            .limit(1)
            .execute()
        ).data
        zeile = zeilen[0] if zeilen else None
        if not zeile or zeile.get("client_id") != client_id:
            raise OAuthError("invalid_grant", "Refresh-Token ungültig.")

        if zeile.get("rotated_at"):
            log.warning(
                "mcp_refresh_token_wiederverwendet",
                client_id=client_id[:120],
                user_id=str(zeile.get("user_id")),
            )
            self._client().table("mcp_refresh_tokens").delete().eq(
                "user_id", zeile["user_id"]
            ).eq("client_id", client_id).execute()
            raise OAuthError("invalid_grant", "Refresh-Token ungültig.")

        if _als_zeitpunkt(zeile.get("expires_at")) < _jetzt():
            raise OAuthError("invalid_grant", "Refresh-Token ungültig.")

        # Rotation gescoped auf „noch nicht rotiert" (Wurzel 2: zwei parallele
        # Refreshes dürfen nicht beide ein Paar bekommen).
        quittung = (
            self._client()
            .table("mcp_refresh_tokens")
            .update({"rotated_at": _jetzt().isoformat()})
            .eq("token_hash", _hash(refresh_token))
            .is_("rotated_at", "null")
            .execute()
        )
        if not quittung.data:
            raise OAuthError("invalid_grant", "Refresh-Token ungültig.")

        tenant_id = str(zeile["tenant_id"])
        user_id = str(zeile["user_id"])
        scope = str(zeile.get("scope") or "")
        resource = str(zeile.get("resource") or "")
        return {
            "access_token": self._access_token(
                tenant_id=tenant_id, user_id=user_id, client_id=client_id,
                scope=scope, resource=resource,
            ),
            "token_type": "Bearer",
            "expires_in": ACCESS_TOKEN_TTL_SEKUNDEN,
            "refresh_token": self._refresh_ausstellen(
                tenant_id=tenant_id, user_id=user_id, client_id=client_id,
                scope=scope, resource=resource,
            ),
            "scope": scope,
        }

    def token_pruefen(self, token: str, *, resource: str) -> dict:
        """Access-Token verifizieren. Wirft `jwt.PyJWTError` bei ungültig.

        Die Audience wird gegen die ERWARTETE Ressource geprüft: ein Token, das
        für einen anderen Dienst ausgestellt wurde, darf hier nichts öffnen.

        ZUSÄTZLICH die Zustimmung gegenprüfen (Wurzel 3): Ein Access-Token ist
        ein signiertes JWT und gilt eine Stunde — ohne diese Abfrage könnte ein
        getrennter Client noch bis zu 60 Minuten weiterlesen. Der Nutzer, der
        „Trennen" drückt, erwartet aber, dass der Zugriff SOFORT endet; alles
        andere wäre eine Falschaussage in der Oberfläche und im AVV.
        """
        nutzlast = jwt.decode(
            token,
            self._secret(),
            algorithms=["HS256"],
            audience=resource or TOKEN_AUDIENCE,
            issuer=self.basis_url(),
        )
        erlaubt = self._zustimmung_scope(
            str(nutzlast.get("sub") or ""), str(nutzlast.get("client_id") or "")
        )
        if erlaubt is None:
            raise OAuthError("invalid_token", "Verbindung wurde getrennt.", status_code=401)
        # Den Token auf den AKTUELL zugestimmten Umfang zuschneiden.
        #
        # Der Scope steht IM Token und gilt eine Stunde. Nimmt der Nutzer die
        # Freitexte zurück, wäre die Zustimmungszeile sofort schmaler, der
        # ausgestellte Token aber weiterhin breit — bis zu 60 Minuten lang
        # lieferte die Verbindung Inhalte, die niemand mehr freigegeben hat.
        # Deshalb zählt hier die DB, nicht das Token: der Schnitt kann nur
        # WEGNEHMEN, nie hinzufügen (Wurzel 3 — der Anfrage nicht vertrauen).
        vom_token = set(str(nutzlast.get("scope") or "").split())
        nutzlast["scope"] = " ".join(sorted(vom_token & set(erlaubt.split())))
        return nutzlast

    def _zustimmung_scope(self, user_id: str, client_id: str) -> str | None:
        """Der aktuell zugestimmte Scope, oder `None` wenn getrennt/unklar.

        Fail-CLOSED (Wurzel 5): Ohne Nutzer/Client und bei jeder Störung gibt
        es nichts freizugeben.
        """
        if not user_id or not client_id:
            return None
        try:
            zeilen = (
                self._client()
                .table("mcp_consents")
                .select("scope")
                .eq("user_id", user_id)
                .eq("client_id", client_id)
                .is_("revoked_at", "null")
                .limit(1)
                .execute()
            ).data or []
        except OAuthError:
            raise
        except Exception:  # noqa: BLE001 — jede Störung sperrt, statt zu öffnen
            log.warning("mcp.zustimmung_pruefung_fehlgeschlagen", extra={
                "client_id": client_id,
            })
            return None
        if not zeilen:
            return None
        return str(zeilen[0].get("scope") or SCOPE_LESEN)

    def _zustimmung_gilt(self, user_id: str, client_id: str) -> bool:
        """Besteht die Zustimmung noch? Fail-CLOSED bei Zweifeln (Wurzel 5).

        Ohne Nutzer oder Client gibt es nichts zu prüfen — und dann auch nichts
        freizugeben. Ist die DB nicht erreichbar, wird ebenfalls gesperrt: ein
        Leseweg, der bei Störung öffnet, ist kein Schutz.
        """
        if not user_id or not client_id:
            return False
        try:
            zeilen = (
                self._client()
                .table("mcp_consents")
                .select("user_id")
                .eq("user_id", user_id)
                .eq("client_id", client_id)
                .is_("revoked_at", "null")
                .limit(1)
                .execute()
            ).data or []
        except OAuthError:
            raise
        except Exception:  # noqa: BLE001 — jede Störung sperrt, statt zu öffnen
            log.warning("mcp.zustimmung_pruefung_fehlgeschlagen", extra={
                "client_id": client_id,
            })
            return False
        return bool(zeilen)


def _pkce_challenge(verifier: str) -> str:
    """BASE64URL-ohne-Padding(SHA256(verifier)) — PKCE S256 (RFC 7636)."""
    digest = hashlib.sha256(verifier.encode("ascii")).digest()
    return base64.urlsafe_b64encode(digest).decode("ascii").rstrip("=")


def _als_zeitpunkt(wert: object) -> datetime:
    """ISO-Zeitstempel aus PostgREST robust lesen.

    Fehlt oder ist er unlesbar, gilt der Wert als ABGELAUFEN (fail-closed):
    ein unbekannter Ablauf darf nie als „noch gültig" durchgehen.
    """
    if not wert:
        return datetime.min.replace(tzinfo=UTC)
    try:
        gelesen = datetime.fromisoformat(str(wert).replace("Z", "+00:00"))
    except ValueError:
        return datetime.min.replace(tzinfo=UTC)
    return gelesen if gelesen.tzinfo else gelesen.replace(tzinfo=UTC)
