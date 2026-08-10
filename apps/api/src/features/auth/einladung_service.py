"""Einladungs- und Passwort-Reset-Mails für TENANT-Nutzer (0334).

WARUM EIGENER WEG: GoTrue kann in diesem Setup keine Mails verschicken
(`GOTRUE_SMTP_HOST` ist leer, live geprüft — siehe 0279). `reset_password_email()`
läuft dort ins Leere. Beide Vorgänge laufen deshalb über UNSEREN Weg: Einmal-Token
von uns, Versand über `core.mail` gegen den eigenen Mailcow, Passwort per
GoTrue-Admin-API gesetzt. Es ist derselbe Mechanismus, den das Backoffice seit
0237/0279 fährt (`platform_admin.team_service`) — nur für Betriebs-Nutzer statt
für Plattform-Betreiber, und mit einer eigenen Token-Tabelle statt Spalten.

Die drei Vorgänge:
  1. EINLADUNG (`invite` im AuthService): GoTrue-Nutzer mit einem Zufallspasswort
     anlegen, das NIEMAND kennt — auch der einladende Admin nicht. Dann Token +
     Mail. Die eingeladene Person setzt ihr Passwort selbst.
  2. ANNEHMEN (öffentlich): Token einlösen, Passwort setzen.
  3. PASSWORT VERGESSEN (öffentlich): neutrale Antwort, Mail nur bei echtem
     aktivem Tenant-Nutzer.

Schutzregeln (fail-closed):
  • In der DB liegt NUR der SHA-256 des Tokens (Wurzel 6). Der Klartext existiert
    genau einmal — im Mail-Link.
  • Der Vergleich läuft byteweise über `core.security.secrets_match`, nicht über
    `==` (Wurzel 5: kein Timing-Seitenkanal, kein 500 bei Müll-Input).
  • Einmaligkeit über einen BEDINGTEN UPDATE (`where used_at is null`) VOR dem
    Seiteneffekt — die DB entscheidet, wer bei Doppelklick/Retry gewinnt
    (Wurzel 2, Muster aus `calendar.sperrantraege._claim`).
  • Jeder Abbruchgrund bei „Passwort vergessen" endet in DERSELBEN Antwort
    (User-Enumeration, OWASP Forgot-Password).
"""
from __future__ import annotations

import hashlib
import secrets
from datetime import UTC, datetime, timedelta

import httpx
from supabase import Client

from src.core.config import Settings, get_settings
from src.core.logging import get_logger, mask_email
from src.core.mail import MailError, MailService, OutboundMessage
from src.core.mail_empfaenger import betriebs_sprache, sprache_fuer_nutzer
from src.core.mail_layout import Aktion, MailInhalt, mail_rendern
from src.core.mail_sprache import FALLBACK, aufloesen
from src.core.mail_texte import text
from src.core.security import secrets_match

log = get_logger("nextdays.auth.einladung")

# Der Markenname als Wert, nicht als Literal an jeder Fundstelle: er wird in
# die übersetzten Sätze eingesetzt („Dein Zugang zu {marke}"), und der Katalog
# darf ihn nicht selbst tragen — sonst stünde er 24-mal da und eine Umbenennung
# wäre eine Suchaktion durch alle Sprachen.
MARKE_NEXTDAYS = "myNextDays"


def anrede_zeile(full_name: str | None, schluessel: str, sprache: str) -> str:
    """Die Anredezeile — mit Namen, wenn es einen gibt, sonst ohne.

    Ohne Namen darf NICHT „Hallo ," entstehen. Der Bestand setzte dafür das
    deutsche Wort „hallo" als Namensersatz ein, was in einer französischen Mail
    „Bonjour hallo," ergäbe. Fehlt der Name, wird darum ein EIGENER Schlüssel
    genommen, der die namenlose Anrede als ganzen Satz formuliert — die
    Zeichensetzung hängt an der Sprache (spanisch „Hola:", ungarisch ohne
    Komma) und lässt sich nicht aus dem Namen herausrechnen.
    """
    name = (full_name or "").strip()
    if not name:
        return text("auth.anrede_neutral", sprache)
    return text(schluessel, sprache, name=name)

# Gültigkeit der Einladung. Deutlich großzügiger als der Backoffice-Wert (72 h):
# eine Einladung geht an eine Person, die das Produkt noch NICHT kennt und oft
# erst beim nächsten Arbeitstag reagiert — eine Reinigungskraft, die freitags
# eingeladen wird, soll den Link am Montag noch benutzen können. Sieben Tage sind
# die branchenübliche Obergrenze; länger offen zu stehen ist kein Komfort mehr,
# sondern ein unbeaufsichtigter Zugang.
_INVITE_TTL = timedelta(days=7)

# Gültigkeit eines Passwort-Reset-Links. Kurz, weil es hier um einen BESTEHENDEN
# Zugang geht und der Link ungeschützt in einem Postfach liegt. Eine Stunde ist
# der Wert aus dem OWASP-Umfeld (15–60 Min) und deckt sich mit dem Backoffice.
_RESET_TTL = timedelta(hours=1)

# Sperrfrist zwischen zwei Reset-Mails an dasselbe Konto. Der IP-Ratelimit allein
# schützt das Postfach NICHT: ein Angreifer mit wechselnden IPs könnte sonst ein
# fremdes Postfach fluten (Wurzel 8). Gilt je Konto, nicht je IP.
_RESET_COOLDOWN = timedelta(minutes=1)

# Sperrfrist für „Einladung erneut senden". Gleicher Gedanke, nur ist der
# Auslöser hier ein angemeldeter Admin — die Frist verhindert den versehentlichen
# Doppelklick und ein Fluten des eingeladenen Postfachs.
_RESEND_COOLDOWN = timedelta(minutes=1)

# Mindestlänge des selbst gesetzten Passworts. Serverseitig erzwungen, nicht nur
# im Frontend: der öffentliche Endpunkt ist ohne Browser aufrufbar. Deckt sich
# mit `RegisterRequest.password` (min_length=8) — ein eingeladener Nutzer darf
# keinen schwächeren Zugang bekommen als ein registrierter.
MIN_PASSWORT_LAENGE = 8

# Neutrale Antwort auf „Passwort vergessen". EINE Formulierung für ALLE Fälle:
# keine Adresse, kein Konto, kein Tenant-Nutzer, gesperrt, Sperrfrist, Mailfehler.
# Wer hier unterscheidet, baut ein Verzeichnis der Konten (OWASP: "return a
# consistent message for both existent and non-existent accounts").
RESET_ANTWORT = (
    "Falls zu dieser Adresse ein Konto gehört, ist eine E-Mail mit einem Link "
    "unterwegs."
)

# Zwecke der Tabelle `user_auth_tokens` (0334).
ZWECK_INVITE = "invite"
ZWECK_RESET = "reset"


def hash_token(token: str) -> str:
    """SHA-256 des Tokens (hex) — nur dieser Wert liegt in der DB.

    Bewusst SHA-256 und kein Passwort-Hash (bcrypt/argon2): der Token trägt 256
    Bit echte Zufallsentropie aus `secrets.token_urlsafe(32)`. Gegen so einen
    Wert ist ein Wörterbuch-/Brute-Force-Angriff aussichtslos, der teure
    Passwort-Hash brächte also keine Sicherheit, würde aber jede Einlösung
    spürbar verlangsamen. Genau diese Wahl trifft auch 0279.
    """
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


class EinladungError(Exception):
    """Fachlicher Fehler; vom Router auf HTTP-Status gemappt."""

    def __init__(self, message: str, *, status_code: int = 400) -> None:
        super().__init__(message)
        self.message = message
        self.status_code = status_code


class EinladungService:
    """Token-Lebenszyklus + Mailversand für Einladung und Passwort-Reset.

    Getrennt vom `AuthService`, weil dieser bereits Registrierung, Login, MFA und
    Sitzungen trägt. Der Token-Weg ist ein eigener, abgeschlossener Vorgang mit
    eigener Tabelle und eigenem Mailweg — er gehört nicht in dieselbe Klasse.
    """

    def __init__(
        self,
        service_client: Client,
        settings: Settings | None = None,
        mail: MailService | None = None,
    ) -> None:
        # Ausschliesslich service_role: `user_auth_tokens` ist für
        # anon/authenticated hart gesperrt (Wurzel 6, 0334).
        self._db = service_client
        self._settings = settings or get_settings()
        self._mail = mail or MailService(self._settings)

    # -- Einladung ----------------------------------------------------------

    def einladung_versenden(
        self,
        *,
        user_id: str,
        tenant_id: str,
        email: str,
        full_name: str,
        eingeladen_von: str,
        betrieb: str | None = None,
    ) -> None:
        """Token erzeugen und Einladungsmail verschicken.

        Wirft `EinladungError`, wenn der Link nicht gebaut oder die Mail nicht
        zugestellt werden kann. Der Aufrufer (`AuthService.invite`) rollt die
        Nutzeranlage daraufhin zurück — ein angelegter, aber unerreichbarer
        Nutzer wäre ein stiller Teilerfolg (Wurzel 5).
        """
        token = self._token_ausgeben(
            user_id=user_id,
            tenant_id=tenant_id,
            zweck=ZWECK_INVITE,
            ttl=_INVITE_TTL,
            created_by=eingeladen_von,
        )
        link = self._link("/einladung", token)
        try:
            self._invite_mail(
                email=email,
                full_name=full_name,
                link=link,
                betrieb=betrieb,
                # Die Sprache des EINGELADENEN, nicht die des Einladenden:
                # `users.preferred_language` trägt sie, wenn sie beim Anlegen
                # erfasst wurde, sonst greift die Betriebssprache und zuletzt
                # Englisch (core.mail_sprache).
                sprache=sprache_fuer_nutzer(
                    self._db, user_id, tenant_id=tenant_id
                ),
            )
        except MailError as exc:
            # Gegenzustand (Wurzel 1): ging die Mail nicht raus, darf der Token
            # nicht in der DB stehenbleiben — sonst liegt ein gültiger Zugang
            # bereit, den niemand bekommen hat.
            self._tokens_entwerten(user_id, ZWECK_INVITE)
            log.warning(
                "einladung_mail_failed",
                tenant_id=tenant_id,
                email=mask_email(email),
                error=exc.message,
            )
            raise EinladungError(
                f"Einladung konnte nicht versendet werden: {exc.message}",
                status_code=exc.status_code,
            ) from exc
        log.info(
            "einladung_versendet",
            tenant_id=tenant_id,
            user_id=user_id,
            email=mask_email(email),
        )

    def einladung_erneut_senden(
        self, *, user_id: str, tenant_id: str, email: str, full_name: str,
        eingeladen_von: str, betrieb: str | None = None,
    ) -> None:
        """Einladung erneut verschicken (die erste Mail kam nicht an).

        Entwertet ALLE offenen Einladungs-Tokens des Nutzers und legt genau
        einen neuen an (Wurzel 1: der alte Link darf danach nicht mehr gelten —
        sonst wächst mit jedem Klick auf „erneut senden" die Zahl gültiger
        Zugänge zu demselben Konto).
        """
        if self._gesperrt(user_id, ZWECK_INVITE, _RESEND_COOLDOWN):
            raise EinladungError(
                "Die letzte Einladung ist gerade erst rausgegangen. "
                "Bitte einen Moment warten.",
                status_code=429,
            )
        self._tokens_entwerten(user_id, ZWECK_INVITE)
        self.einladung_versenden(
            user_id=user_id,
            tenant_id=tenant_id,
            email=email,
            full_name=full_name,
            eingeladen_von=eingeladen_von,
            betrieb=betrieb,
        )

    # -- Öffentlich: Token prüfen + einlösen ---------------------------------

    def ist_gueltig(self, token: str, zweck: str) -> bool:
        """Prüft einen Token, OHNE ihn zu verbrauchen (Vorab-Check der Seite).

        Erlaubt der Annahmeseite, „Link abgelaufen" zu zeigen, bevor der Nutzer
        ein Passwort eintippt. Gibt nur `True`/`False` zurück und fasst damit
        ungültig, abgelaufen und verbraucht ZUSAMMEN — eine Unterscheidung wäre
        ein Orakel über fremde Tokens.
        """
        return self._offene_zeile(token, zweck) is not None

    def pruefen_mit_sprache(self, token: str, zweck: str) -> tuple[bool, str]:
        """Wie `ist_gueltig`, gibt zusätzlich die Sprache des EMPFÄNGERS zurück.

        Wozu: die Einladungsmail geht in der Sprache des Empfängers raus
        (`sprache_fuer_nutzer`), die verlinkte Seite fiel danach aber auf die
        Basissprache der Oberfläche zurück — ein Bruch mitten im Ablauf. Der
        Token IST die Auskunft, wer da klickt; die Sprache hängt an dieser
        Person und wird hier über DIESELBE Kette aufgelöst wie die Mail, damit
        Mail und Seite nicht auseinanderlaufen.

        PREISGABE (Wurzel 9): zurück geht AUSSCHLIESSLICH `(gueltig, sprache)`.
        Kein Name, keine Adresse, keine Rolle, kein Tenant — der Endpunkt ist
        öffentlich und unauthentifiziert, und ein geratener Token darf kein
        Verzeichnis über fremde Konten öffnen. Die Sprache selbst ist dabei
        kein Leck: bei einem UNGÜLTIGEN Token wird gar nicht erst nachgesehen,
        sondern der Letzt-Rückfall gemeldet — die Antwort für einen geratenen
        Token ist damit für jeden geratenen Token identisch und taugt nicht zur
        Unterscheidung.
        """
        zeile = self._offene_zeile(token, zweck)
        if zeile is None:
            return False, FALLBACK
        return True, sprache_fuer_nutzer(
            self._db, zeile["user_id"], tenant_id=zeile.get("tenant_id")
        )

    def passwort_setzen(self, token: str, passwort: str, zweck: str) -> None:
        """Token einlösen und das neue Passwort in GoTrue setzen.

        Reihenfolge ist entscheidend (Wurzel 2): ERST den Token per bedingtem
        UPDATE beanspruchen, DANN das Passwort setzen. Ein zweiter Aufruf mit
        demselben Link trifft die Zeile nicht mehr im Vorzustand an und läuft
        ins Leere, statt ein zweites Mal zu wirken.
        """
        self._passwort_pruefen(passwort)
        zeile = self._offene_zeile(token, zweck)
        if zeile is None:
            raise EinladungError("Link ungültig oder abgelaufen.", status_code=400)

        geclaimt = self._claim(zeile["id"])
        if geclaimt is None:
            # Zwischen Lesen und Beanspruchen hat ein anderer Aufruf gewonnen.
            raise EinladungError("Link ungültig oder abgelaufen.", status_code=400)

        user_id = zeile["user_id"]
        try:
            self._db.auth.admin.update_user_by_id(
                user_id, {"password": passwort}
            )
        except Exception as exc:  # noqa: BLE001 — in EinladungError übersetzen
            # Der Token ist bereits verbraucht. Ihn wieder zu öffnen wäre falsch:
            # er stand in einer Mail, und ein wiederbelebter Einmal-Link ist kein
            # Einmal-Link mehr. Der Nutzer fordert einen neuen an.
            log.warning(
                "passwort_setzen_failed",
                user_id=user_id,
                zweck=zweck,
                error=str(exc),
            )
            raise EinladungError(
                "Passwort konnte nicht gesetzt werden.", status_code=502
            ) from exc

        # Alle weiteren offenen Tokens dieses Nutzers entwerten — Einladung UND
        # Reset (Wurzel 1). Wer sein Passwort gerade gesetzt hat, braucht keinen
        # zweiten offenen Zugangslink; und ein noch gültiger Reset-Link aus einer
        # älteren Mail wäre nach einem erfolgreichen Wechsel genau die Lücke, die
        # ein Angreifer sucht (OWASP: Tokens nach Passwortwechsel invalidieren).
        self._tokens_entwerten(user_id, ZWECK_INVITE)
        self._tokens_entwerten(user_id, ZWECK_RESET)

        if zweck == ZWECK_RESET:
            # Nach einem Reset JEDE Sitzung des Kontos beenden: ein Reset ist der
            # Weg, den ein Kompromittierter geht — eine überlebende fremde
            # Sitzung würde ihn wirkungslos machen (OWASP Session Management).
            self._alle_sitzungen_widerrufen(user_id)

        log.info("passwort_gesetzt", user_id=user_id, zweck=zweck)

    # -- Öffentlich: Passwort vergessen -------------------------------------

    def passwort_reset_anfordern(self, email: str) -> str:
        """Reset-Link anfordern. Gibt IMMER dieselbe neutrale Auskunft zurück.

        Jeder Abbruchgrund (ungültige Adresse, kein Konto, kein Tenant-Nutzer,
        Sperrfrist, Mailfehler) endet in derselben Antwort. Das ist hier kein
        Verschlucken, sondern der Zweck: eine unterscheidbare Antwort — oder ein
        unterschiedlicher HTTP-Status — wäre ein Verzeichnis der Konten. Jeder
        Abbruch wird protokolliert, damit der Betrieb sieht, was passiert ist.
        """
        adresse = (email or "").strip().lower()
        try:
            self._reset_ausloesen(adresse)
        except EinladungError as exc:
            # EINE Stelle, die abbricht, EINE Antwort: so kann kein neuer
            # Abbruchgrund versehentlich eine unterscheidbare Antwort erzeugen.
            log.info(
                "passwort_reset_abgebrochen",
                email=mask_email(adresse),
                grund=exc.message,
            )
        return RESET_ANTWORT

    def _reset_ausloesen(self, email: str) -> None:
        """Token setzen und Mail schicken. Wirft bei JEDEM Abbruch.

        Die Gründe stehen nur im Protokoll, nie in der Antwort — der Aufrufer
        übersetzt sie alle in dieselbe neutrale Auskunft.
        """
        if "@" not in email or email.startswith("@") or email.endswith("@"):
            raise EinladungError("Keine gültige E-Mail-Adresse.", status_code=422)

        nutzer = self._tenant_nutzer(email)
        if nutzer is None:
            # Kein Tenant-Nutzer zu dieser Adresse. Bewusst KEIN Reset für
            # Gäste (portal_guests) oder Backoffice-Zugänge: das sind andere
            # Auth-Welten mit eigenen Wegen.
            raise EinladungError("Kein aktiver Tenant-Zugang zu dieser Adresse.")
        if self._gesperrt(nutzer["id"], ZWECK_RESET, _RESET_COOLDOWN):
            raise EinladungError("Sperrfrist seit der letzten Anfrage läuft noch.")

        token = self._token_ausgeben(
            user_id=nutzer["id"],
            tenant_id=nutzer["tenant_id"],
            zweck=ZWECK_RESET,
            ttl=_RESET_TTL,
            # Bei einem Reset ist der Anfordernde nicht angemeldet — eine
            # user_id hier einzutragen wäre eine erfundene Behauptung (Wurzel 4).
            created_by=None,
        )
        link = self._link("/passwort-neu", token)
        try:
            self._reset_mail(
                email=email,
                full_name=nutzer.get("full_name"),
                link=link,
                # Die Zeile ist schon geladen — die eigene Sprachwahl steht
                # darin. Nur die Betriebsstufe braucht noch eine Abfrage.
                sprache=aufloesen(
                    nutzer.get("preferred_language"),
                    betriebs_sprache(self._db, nutzer.get("tenant_id")),
                ),
            )
        except MailError as exc:
            # Gegenzustand (Wurzel 1): kein Versand → kein offener Token.
            self._tokens_entwerten(nutzer["id"], ZWECK_RESET)
            log.warning(
                "passwort_reset_mail_failed",
                user_id=nutzer["id"],
                error=exc.message,
            )
            raise EinladungError(
                f"Mailversand fehlgeschlagen: {exc.message}"
            ) from exc

        log.info("passwort_reset_versendet", user_id=nutzer["id"])

    # -- Token-Mechanik ------------------------------------------------------

    def _token_ausgeben(
        self,
        *,
        user_id: str,
        tenant_id: str,
        zweck: str,
        ttl: timedelta,
        created_by: str | None,
    ) -> str:
        """Neuen Einmal-Token anlegen und den KLARTEXT zurückgeben.

        `secrets.token_urlsafe(32)` = 32 Byte (256 Bit) aus dem CSPRNG des
        Betriebssystems, URL-sicher kodiert (~43 Zeichen). In die DB geht nur
        der SHA-256.
        """
        token = secrets.token_urlsafe(32)
        jetzt = datetime.now(UTC)
        res = (
            self._db.table("user_auth_tokens")
            .insert(
                {
                    "user_id": user_id,
                    "tenant_id": tenant_id,
                    "zweck": zweck,
                    "token_hash": hash_token(token),
                    "expires_at": (jetzt + ttl).isoformat(),
                    "created_by": created_by,
                }
            )
            .execute()
        ).data
        if not res:
            raise EinladungError(
                "Zugangslink konnte nicht erzeugt werden.", status_code=502
            )
        return token

    def _offene_zeile(self, token: str, zweck: str) -> dict | None:
        """Die offene, gültige Token-Zeile — oder None (fail-closed).

        Der Hash-Vergleich läuft ZUSÄTZLICH byteweise über `secrets_match`,
        obwohl die DB-Abfrage bereits auf Gleichheit filtert. Grund: der
        Rückgabewert der DB wird hier zur Entscheidung, und ein byteweiser
        Vergleich schliesst aus, dass eine spätere Änderung an der Abfrage
        (z. B. ein `ilike`, ein Präfix-Match) unbemerkt zu einem lockereren
        Kriterium wird. Müll-Input (nicht-ASCII, leer) darf dabei keinen 500
        werfen — genau das leistet `secrets_match` (Wurzel 5).
        """
        if not token or not token.strip():
            return None
        erwartet = hash_token(token)
        rows = (
            self._db.table("user_auth_tokens")
            .select("id, user_id, tenant_id, zweck, token_hash, expires_at, used_at")
            .eq("token_hash", erwartet)
            .eq("zweck", zweck)
            .is_("used_at", "null")
            .limit(1)
            .execute()
        ).data or []
        zeile = rows[0] if rows else None
        if zeile is None:
            return None
        if not secrets_match(zeile.get("token_hash"), erwartet):
            return None
        if zeile.get("used_at") or not self._gueltig(zeile.get("expires_at")):
            return None
        return zeile

    def _claim(self, token_id: str) -> dict | None:
        """Token beanspruchen — bedingter UPDATE als Compare-and-Set.

        `is_("used_at", "null")` macht den Wechsel atomar: kommen zwei
        Einlösungen desselben Links gleichzeitig an (Doppelklick, Retry des
        Browsers), trifft die zweite die Zeile nicht mehr im Vorzustand an und
        bekommt eine leere Rückgabe. Ein vorheriges SELECT mit späterem UPDATE
        hätte genau dieses Rennen offen gelassen (Wurzel 2 — Muster aus
        `calendar.sperrantraege._claim`).
        """
        res = (
            self._db.table("user_auth_tokens")
            .update({"used_at": datetime.now(UTC).isoformat()})
            .eq("id", token_id)
            .is_("used_at", "null")
            .execute()
        ).data or []
        return res[0] if res else None

    def _tokens_entwerten(self, user_id: str, zweck: str) -> None:
        """Alle offenen Tokens eines Nutzers zu einem Zweck schliessen.

        Als `used_at`-Stempel statt als DELETE: die Zeile bleibt als Spur, dass
        ein Vorgang lief und wann er endete. Für die Prüfung ist beides gleich —
        `_offene_zeile` verlangt `used_at is null`.
        """
        self._db.table("user_auth_tokens").update(
            {"used_at": datetime.now(UTC).isoformat()}
        ).eq("user_id", user_id).eq("zweck", zweck).is_(
            "used_at", "null"
        ).execute()

    def _gesperrt(self, user_id: str, zweck: str, frist: timedelta) -> bool:
        """True, solange die Sperrfrist seit der letzten Anforderung läuft.

        Ein unlesbarer Zeitstempel gilt als „nicht gesperrt": lieber eine Mail
        zu viel als ein Konto, das sich nie zurücksetzen lässt.
        """
        rows = (
            self._db.table("user_auth_tokens")
            .select("created_at")
            .eq("user_id", user_id)
            .eq("zweck", zweck)
            .order("created_at", desc=True)
            .limit(1)
            .execute()
        ).data or []
        if not rows:
            return False
        zuletzt = rows[0].get("created_at")
        if not zuletzt:
            return False
        try:
            gesetzt = datetime.fromisoformat(zuletzt)
        except (ValueError, TypeError):
            return False
        if gesetzt.tzinfo is None:
            gesetzt = gesetzt.replace(tzinfo=UTC)
        return gesetzt + frist > datetime.now(UTC)

    @staticmethod
    def _gueltig(ablauf: str | None) -> bool:
        """True, solange der Gültigkeitszeitraum läuft (fail-closed).

        Ein fehlender oder unlesbarer Zeitstempel ist NICHT gültig — ein
        kaputter Wert darf keinen unbegrenzt gültigen Zugang ergeben.
        """
        if not ablauf:
            return False
        try:
            ende = datetime.fromisoformat(ablauf)
        except (ValueError, TypeError):
            return False
        if ende.tzinfo is None:
            ende = ende.replace(tzinfo=UTC)
        return ende > datetime.now(UTC)

    @staticmethod
    def _passwort_pruefen(passwort: str) -> None:
        """Mindestanforderungen serverseitig erzwingen.

        Das Frontend prüft ebenfalls, aber der Endpunkt ist öffentlich und ohne
        Browser aufrufbar — die Regel muss hier stehen, sonst gibt es sie nicht
        (Wurzel 3).
        """
        if not passwort or len(passwort) < MIN_PASSWORT_LAENGE:
            raise EinladungError(
                f"Das Passwort braucht mindestens {MIN_PASSWORT_LAENGE} Zeichen.",
                status_code=422,
            )

    # -- Nutzer-Nachschlag ---------------------------------------------------

    def _tenant_nutzer(self, email: str) -> dict | None:
        """Der aktive Tenant-Nutzer zu einer Adresse — oder None.

        ZWEI QUELLEN, in dieser Reihenfolge: `public.users` ist der Spiegel und
        deckt den Normalfall ab; findet er nichts, entscheidet GoTrue. Denn
        `public.users.email` wird nur beim Abruf des EIGENEN Kontos nachgezogen
        (`AccountService._email_nachziehen`) — wer nach einem Adresswechsel
        noch nicht wieder eingeloggt war, steht dort mit der ALTEN Adresse.

        Live gefunden am 10.08.2026: Nach dem Wechsel der Eigentümer-Adresse
        auf `a.staudinger32@icloud.com` trug `public.users` weiter
        `eigentuemer.test@airsmil.dk`. „Passwort vergessen" fand nichts und
        antwortete trotzdem „E-Mail unterwegs" — die Antwort ist bewusst
        neutral (User-Enumeration), also sah der Eigentümer einen Erfolg, wo
        nie eine Mail entstand (Wurzel 5b: die stille Falschaussage, die
        niemand als Bug erkennt). Ein Konto, dessen Anmeldeadresse gilt, muss
        über genau diese Adresse zurücksetzbar sein.

        Die Prüfung „ist das ein Betriebs-Nutzer" bleibt unverändert scharf:
        auch der GoTrue-Weg endet an einer `users`-Zeile MIT `tenant_id`. Ein
        reiner Gast (portal_guests) oder ein Backoffice-Zugang kommt hier
        weiterhin nicht durch.
        """
        zeile = self._nutzer_aus_spiegel(email)
        if zeile is None:
            zeile = self._nutzer_ueber_gotrue(email)
        if zeile is None or not zeile.get("tenant_id"):
            return None
        return zeile

    def _nutzer_aus_spiegel(self, email: str) -> dict | None:
        """`public.users` nach der Adresse fragen."""
        rows = (
            self._db.table("users")
            .select("id, tenant_id, email, full_name, preferred_language")
            .eq("email", email)
            .limit(2)
            .execute()
        ).data or []
        if len(rows) != 1:
            # Keine Zeile → hier nicht gefunden (der Aufrufer fragt GoTrue).
            # Mehrere Zeilen → die Adresse ist nicht eindeutig einem Konto
            # zuzuordnen; dann fail-closed KEINE Mail, statt zu raten, welches
            # Konto gemeint ist (Wurzel 4).
            return None
        return rows[0]

    def _nutzer_ueber_gotrue(self, email: str) -> dict | None:
        """Die Anmeldeadresse bei GoTrue nachschlagen und den Spiegel heilen.

        NUR NACHSCHLAGEN, NICHT SENDEN: Die Mail geht unverändert über unseren
        eigenen Mailcow (`_reset_mail`, `core.mail`). GoTrue kann in diesem
        Setup gar nicht senden (0279) — es wird hier ausschliesslich als
        Wahrheit über die ANMELDEADRESSE befragt, weil `public.users.email` nur
        ein nachlaufender Spiegel ist.

        Steht dort ein Nutzer, wird seine `users`-Zeile über die ID geladen —
        und der veraltete Spiegel gleich mitgezogen, damit derselbe Umweg nicht
        bei jedem weiteren Vorgang nötig ist (Wurzel 1: den Gegenzustand
        mitpflegen).

        Der `filter`-Parameter der Admin-API sucht serverseitig (live gegen die
        Staging-Instanz geprüft). Ohne ihn müsste `list_users()` seitenweise
        durchlaufen werden — bei 50 Nutzern je Seite fände ein Konto auf Seite 3
        schlicht nicht statt, und der Reset schlüge wieder still fehl.

        Fehler von GoTrue enden in None, nicht in einem 500: der Aufrufer
        übersetzt jedes None in dieselbe neutrale Antwort, und ein Ausfall des
        Auth-Dienstes darf keine Adressen preisgeben (fail-closed).
        """
        gesucht = email.strip().casefold()
        try:
            treffer = self._gotrue_suche(gesucht)
        except Exception as exc:  # noqa: BLE001 — Aufrufer behandelt None neutral
            log.warning("reset_gotrue_lookup_fehlgeschlagen", error=str(exc)[:200])
            return None
        # Der Filter sucht als Teilstring — auf exakte Gleichheit prüfen, sonst
        # träfe „a@b.de" auch „xa@b.de" (Wurzel 3: nie dem Suchergebnis trauen).
        user_id = next(
            (
                str(u.get("id"))
                for u in treffer
                if (u.get("email") or "").strip().casefold() == gesucht
            ),
            None,
        )
        if user_id is None:
            return None
        rows = (
            self._db.table("users")
            .select("id, tenant_id, email, full_name, preferred_language")
            .eq("id", user_id)
            .limit(1)
            .execute()
        ).data or []
        if not rows:
            # GoTrue kennt den Login, `public.users` nicht: das ist ein Gast
            # oder ein Backoffice-Zugang — kein Betriebs-Nutzer.
            return None
        zeile = rows[0]
        if (zeile.get("email") or "").strip().casefold() != gesucht:
            self._spiegel_heilen(user_id, email)
            zeile["email"] = email
        return zeile

    def _gotrue_suche(self, gesucht: str) -> list[dict]:
        """`GET /admin/users?filter=…` — die einzige serverseitige Suche, die
        GoTrue anbietet.

        Der Python-Client kann es nicht: `list_users(page, per_page)` kennt
        keinen Filter und liefert Seiten zu 50 Einträgen. Darum hier ein
        direkter Aufruf mit dem Service-Role-Key. `per_page` bleibt klein — es
        wird genau ein exakter Treffer erwartet, alles darüber ist Beifang des
        Teilstring-Filters.
        """
        einstellungen = self._settings
        basis = str(einstellungen.supabase_url).rstrip("/")
        key = einstellungen.supabase_service_role_key.get_secret_value()
        antwort = httpx.get(
            f"{basis}/auth/v1/admin/users",
            params={"filter": gesucht, "per_page": 10},
            headers={"Authorization": f"Bearer {key}", "apikey": key},
            timeout=10.0,
        )
        antwort.raise_for_status()
        daten = antwort.json()
        return list(daten.get("users") or [])

    def _spiegel_heilen(self, user_id: str, email: str) -> None:
        """`public.users.email` auf die geltende Anmeldeadresse nachziehen.

        Best-effort (Wurzel 5): schlägt es fehl, ist der Reset trotzdem
        möglich — die Adresse für Mail und Token steht bereits fest. Nur der
        nächste Vorgang nähme dann wieder den Umweg über GoTrue.
        """
        try:
            self._db.table("users").update({"email": email}).eq(
                "id", user_id
            ).execute()
            log.info("reset_spiegel_geheilt", user_id=user_id)
        except Exception as exc:  # noqa: BLE001 — Nebenpfad, kippt den Reset nicht
            log.warning(
                "reset_spiegel_heilen_fehlgeschlagen",
                user_id=user_id,
                error=str(exc)[:200],
            )

    def _alle_sitzungen_widerrufen(self, user_id: str) -> None:
        """Jede aktive Sitzung des Kontos beenden (RPC aus 0191, keep=None).

        Best-effort: schlägt der Aufruf fehl, ist das Passwort trotzdem neu —
        das darf den Hauptpfad nicht kippen. Protokolliert, damit ein klemmender
        Widerruf nicht unbemerkt bleibt.
        """
        try:
            self._db.rpc(
                "host_revoke_other_sessions",
                {"p_user_id": user_id, "p_keep_session_id": None},
            ).execute()
        except Exception as exc:  # noqa: BLE001 — reiner Aufräum-Schritt
            log.warning(
                "reset_sessions_revoke_failed", user_id=user_id, error=str(exc)
            )

    # -- Links & Mails -------------------------------------------------------

    def _link(self, pfad: str, token: str) -> str:
        """Absoluter Link ins PMS-Dashboard (web/).

        Ohne konfigurierte Adresse gibt es keinen sinnvollen Link — das ist ein
        Konfigurationsfehler und wird als solcher gemeldet, statt eine plausible
        URL zu erfinden (Wurzel 4).
        """
        basis = (self._settings.app_base_url or "").rstrip("/")
        if not basis:
            raise EinladungError(
                "APP_BASE_URL ist nicht konfiguriert — ohne sie kann kein "
                "Zugangslink erzeugt werden.",
                status_code=500,
            )
        return f"{basis}{pfad}?token={token}"

    def _invite_mail(
        self,
        *,
        email: str,
        full_name: str,
        link: str,
        betrieb: str | None,
        sprache: str,
    ) -> None:
        """Einladungsmail verschicken (eigener Mailcow über `core.mail`).

        Wirft `MailError` weiter — der Aufrufer nimmt den Token dann zurück.
        Marke ist myNextDays: das ist die Verwaltung des Betriebs, nicht der
        Marktplatz myBestDays.

        Layout und Text kommen aus `core.mail_layout` — die eine Stelle, an der
        eine Mail Gestalt annimmt. Ein eigener HTML-Rumpf hier wäre die zweite
        Kopie, die beim nächsten Impressums-Wechsel vergessen würde.

        `sprache` ist ein bereits aufgelöster Code aus `core.mail_sprache` —
        die Auflösung gehört zum Aufrufer, der die Nutzerzeile ohnehin hat.
        """
        marke = MARKE_NEXTDAYS
        # Der einleitende Absatz hängt davon ab, ob der Betriebsname bekannt
        # ist — zwei Katalogschlüssel statt eines zusammengestückelten Satzes:
        # „{von} hat dir…" ließe sich nicht in jede Sprache übersetzen, weil
        # Satzstellung und Fall vom Subjekt abhängen.
        einleitung = (
            text("auth.einladung.absatz_betrieb", sprache,
                 betrieb=betrieb, marke=marke)
            if betrieb
            else text("auth.einladung.absatz_betrieb_unbekannt", sprache,
                      marke=marke)
        )
        mail = mail_rendern(
            MailInhalt(
                titel=anrede_zeile(
                    full_name, "auth.einladung.titel", sprache
                ),
                absaetze=[
                    einleitung,
                    text("auth.einladung.absatz_passwort", sprache),
                ],
                aktion=Aktion(
                    text=text("auth.einladung.aktion", sprache), url=link
                ),
                hinweise=[
                    text("auth.einladung.hinweis_gueltig", sprache),
                    text("auth.einladung.hinweis_ignorieren", sprache),
                ],
                sprache=sprache,
            ),
            settings=self._settings,
        )
        self._mail.send(
            OutboundMessage(
                to=email,
                subject=text("auth.einladung.betreff", sprache, marke=marke),
                text=mail.text,
                html=mail.html,
                inline_bilder=mail.inline_bilder,
            )
        )

    def _reset_mail(
        self, *, email: str, full_name: str | None, link: str, sprache: str
    ) -> None:
        """Reset-Mail verschicken. Wirft `MailError` weiter."""
        marke = MARKE_NEXTDAYS
        mail = mail_rendern(
            MailInhalt(
                titel=anrede_zeile(full_name, "auth.reset.titel", sprache),
                absaetze=[text("auth.reset.absatz", sprache, marke=marke)],
                aktion=Aktion(
                    text=text("auth.reset.aktion", sprache), url=link
                ),
                hinweise=[
                    text("auth.reset.hinweis_gueltig", sprache),
                    text("auth.reset.hinweis_ignorieren", sprache),
                ],
                sprache=sprache,
            ),
            settings=self._settings,
        )
        self._mail.send(
            OutboundMessage(
                to=email,
                subject=text("auth.reset.betreff", sprache, marke=marke),
                text=mail.text,
                html=mail.html,
                inline_bilder=mail.inline_bilder,
            )
        )
