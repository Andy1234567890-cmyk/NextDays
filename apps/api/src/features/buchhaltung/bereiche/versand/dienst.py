"""Der EINE Mailweg für Belege der Buchhaltung (Rechnung, Angebot, Mahnung …).

`dokument_senden` wird vom Service dieses Bereichs UND vom Nachbarbereich
»mahnwesen« (`_versand_aufloesen`) aufgerufen — beide Belegarten gehen damit
mit demselben Absender, derselben Fußzeile (Anbieterangaben aus COMPANY_*)
und demselben Layout (`core.mail_layout`) hinaus. Es gibt bewusst keinen
zweiten SMTP-Pfad.

Was hier passiert, in dieser Reihenfolge:
  1. Konfiguration LAUT prüfen: fehlen COMPANY_*/APP_BASE_URL, geht die Mail
     trotzdem raus (das Layout schreibt den Mangel sichtbar in die Fußzeile),
     aber der Mangel steht als WARNUNG im Log — nie stumm gekürzt
     (`scripts/diagnose/mail-umgebung-pruefen.sh`, Wurzel 5).
  2. Absender-Betrieb aus `tenant_billing_profile` (Name → Absenderzeile,
     E-Mail → Reply-To und BCC-Kopie). Fehlt die E-Mail, gibt es keine Kopie
     und kein Reply-To — und das steht im Ergebnis, statt eine Adresse zu
     erfinden (Wurzel 4).
  3. Layout über `mail_rendern` in der Sprache des Betriebs; der Nutzertext
     wird escaped (Wurzel 8 — HTML aus dem Client kommt nie roh in die Mail).
  4. Anhänge über `BelegMailService` (Unterklasse von `MailService`, ergänzt
     `_build` um `add_attachment`; `send` mit Konfig-Prüfung, Sandbox und
     Fehlerbehandlung bleibt unverändert).

Fehler: `VersandError(status_code)` — 422 für Eingabefehler, 502/503 für den
Mailserver (aus `MailError.status_code`).
"""

from __future__ import annotations

from collections.abc import Sequence
from dataclasses import dataclass, field
from email.message import EmailMessage

from supabase import Client

from src.core.config import Settings, get_settings
from src.core.logging import get_logger
from src.core.mail import MailError, MailService, OutboundMessage
from src.core.mail_empfaenger import betriebs_sprache
from src.core.mail_layout import MailInhalt, mail_rendern, marke_nextdays
from src.core.mail_sprache import aufloesen
from src.core.security import AuthContext
from src.core.supabase import get_service_client

log = get_logger("nextdays.buchhaltung.versand")

# (Dateiname, Bytes, MIME-Typ)
Anhang = tuple[str, bytes, str]

# Was jeder mailversendende Prozess braucht — dieselbe Liste wie
# scripts/diagnose/mail-umgebung-pruefen.sh (PFLICHT). Fehlt eines, wird es
# hier benannt, nicht verschwiegen.
_PFLICHT_UMGEBUNG: tuple[tuple[str, str], ...] = (
    ("app_base_url", "APP_BASE_URL"),
    ("company_legal_name", "COMPANY_LEGAL_NAME"),
    ("company_legal_form", "COMPANY_LEGAL_FORM"),
    ("company_street", "COMPANY_STREET"),
    ("company_city", "COMPANY_CITY"),
    ("company_country", "COMPANY_COUNTRY"),
    ("company_registration_number", "COMPANY_REGISTRATION_NUMBER"),
    ("company_contact_email", "COMPANY_CONTACT_EMAIL"),
)


class VersandError(Exception):
    def __init__(self, message: str, *, status_code: int = 400) -> None:
        super().__init__(message)
        self.message = message
        self.status_code = status_code


@dataclass(frozen=True)
class BelegMail(OutboundMessage):
    """`OutboundMessage` plus Dateianhänge — der Beleg hängt als PDF an."""

    anhaenge: tuple[Anhang, ...] = field(default_factory=tuple)
    # Verdeckte Empfänger: NUR im SMTP-Umschlag, nie im Kopf. `recipients`
    # (Eltern) bleibt bewusst die To-Liste — daraus baut `_build` den Header.
    bcc: tuple[str, ...] = field(default_factory=tuple)

    @property
    def umschlag(self) -> list[str]:
        """An wen der SMTP-Dialog wirklich zustellt: To + BCC (ohne Dubletten)."""
        basis = self.recipients
        extra = [a.strip() for a in self.bcc if a and a.strip() and a.strip() not in basis]
        return basis + extra


class BelegMailService(MailService):
    """`MailService`, der Anhänge und BCC kann. `send()` bleibt der Eltern-Pfad
    — Konfig-Prüfung (W4), Sandbox, spezifisches Fangen (W5), Logging; nur der
    Umschlag wird in `_deliver` um die BCC-Adressen ergänzt."""

    def __init__(self, settings: Settings | None = None) -> None:
        super().__init__(settings)
        self._bcc_aktuell: tuple[str, ...] = ()

    def send(self, msg: OutboundMessage) -> str:
        self._bcc_aktuell = tuple(msg.bcc) if isinstance(msg, BelegMail) else ()
        try:
            return super().send(msg)
        finally:
            self._bcc_aktuell = ()

    def _deliver(self, email: EmailMessage, recipients: list[str]) -> None:
        extra = [a for a in self._bcc_aktuell if a and a not in recipients]
        super()._deliver(email, recipients + extra)

    def _build(self, msg: OutboundMessage) -> EmailMessage:
        email = super()._build(msg)
        if isinstance(msg, BelegMail):
            for dateiname, daten, mime in msg.anhaenge:
                haupt, _, unter = (mime or "application/octet-stream").partition("/")
                email.add_attachment(
                    daten,
                    maintype=haupt or "application",
                    subtype=unter or "octet-stream",
                    filename=dateiname,
                )
        return email


def fehlende_umgebung(settings: Settings | None = None) -> list[str]:
    """Namen der Pflichtvariablen, die in DIESEM Prozess leer sind."""
    s = settings or get_settings()
    return [env for attr, env in _PFLICHT_UMGEBUNG if not str(getattr(s, attr, "") or "").strip()]


def _umgebung_laut_pruefen(settings: Settings) -> None:
    fehlend = fehlende_umgebung(settings)
    if fehlend:
        log.warning(
            "versand_anbieterangaben_fehlen",
            fehlend=fehlend,
            hinweis="Mail geht mit sichtbarem Mangelhinweis in der Fusszeile raus; "
            "bash scripts/diagnose/mail-umgebung-pruefen.sh",
        )


@dataclass(frozen=True)
class Absender:
    """Der Betrieb, in dessen Namen der Beleg geht."""

    name: str | None
    email: str | None
    sprache: str


def absender_laden(db: Client, tenant_id: str) -> Absender:
    """Name und E-Mail des Betriebs aus `tenant_billing_profile` (0023/0026),
    Sprache aus `tenants.default_language`. Best-effort: fehlt die Zeile,
    fehlen die Werte — sie werden nicht erfunden."""
    name: str | None = None
    email: str | None = None
    try:
        rows = (
            db.table("tenant_billing_profile")
            .select("legal_name, email")
            .eq("tenant_id", tenant_id)
            .limit(1)
            .execute()
        ).data or []
    except Exception as exc:  # noqa: BLE001 — Nebenpfad, darf den Versand nicht kippen
        log.warning("versand_absender_lesefehler", tenant_id=tenant_id, error=str(exc)[:200])
        rows = []
    if rows:
        name = (rows[0].get("legal_name") or "").strip() or None
        email = (rows[0].get("email") or "").strip() or None
    sprache = aufloesen(None, betriebs_sprache(db, tenant_id))
    return Absender(name=name, email=email, sprache=sprache)


def _absaetze(text: str) -> list[str]:
    """Nutzertext in Absätze — Leerzeile trennt; Einzelumbrüche bleiben als
    Zeilen im Absatz (das Layout escaped, `\\n` wird zu `<br>`-losem Fließtext,
    deshalb je Zeile ein Absatz, damit nichts zusammenklebt)."""
    zeilen = [z.rstrip() for z in text.replace("\r\n", "\n").split("\n")]
    absaetze: list[str] = []
    puffer: list[str] = []
    for z in zeilen:
        if z.strip():
            puffer.append(z.strip())
        elif puffer:
            absaetze.append(" ".join(puffer))
            puffer = []
    if puffer:
        absaetze.append(" ".join(puffer))
    return absaetze or [text.strip()]


def dokument_senden(  # noqa: PLR0913 — die Felder einer Mail
    ctx: AuthContext,
    *,
    an: Sequence[str],
    betreff: str,
    text: str,
    anhaenge: Sequence[Anhang] = (),
    cc: Sequence[str] | None = None,
    bcc: Sequence[str] | None = None,
    kopie_an_absender: bool = False,
    signatur: str | None = None,
    db: Client | None = None,
    mail: MailService | None = None,
    settings: Settings | None = None,
) -> str:
    """Beleg per Mail verschicken; gibt die Message-ID zurück.

    `cc` wird — weil `OutboundMessage` nur `To` kennt — als weitere To-Adressen
    zugestellt (sichtbar im Kopf), `bcc` nur im Umschlag. Wirft `VersandError`
    (422 bei fehlendem Empfänger, Status des Mailservers bei Versandfehlern).
    """
    if not ctx.tenant_id:
        raise VersandError("Kein Mandant im Kontext.", status_code=403)
    empfaenger = [a.strip() for a in an if a and a.strip()]
    if not empfaenger:
        raise VersandError("Keine Empfängeradresse angegeben.", status_code=422)
    s = settings or get_settings()
    _umgebung_laut_pruefen(s)
    datenbank = db or get_service_client()
    absender = absender_laden(datenbank, ctx.tenant_id)

    verdeckt = [a.strip() for a in (bcc or []) if a and a.strip()]
    kopie_an: str | None = None
    if kopie_an_absender:
        if absender.email:
            kopie_an = absender.email
            if kopie_an not in verdeckt:
                verdeckt.append(kopie_an)
        else:
            log.warning(
                "versand_kopie_ohne_absenderadresse",
                tenant_id=ctx.tenant_id,
                hinweis="tenant_billing_profile.email fehlt — keine Kopie an den Betrieb",
            )

    inhalt = mail_rendern(
        MailInhalt(
            titel=betreff,
            absaetze=_absaetze(text),
            gruss=(signatur or "").strip() or None,
            absender_zeile=absender.name,
            sprache=absender.sprache,
        ),
        marke=marke_nextdays(s),
        settings=s,
    )
    nachricht = BelegMail(
        to=empfaenger + [a.strip() for a in (cc or []) if a and a.strip()],
        subject=betreff,
        text=inhalt.text,
        html=inhalt.html,
        reply_to=absender.email,
        inline_bilder=inhalt.inline_bilder,
        anhaenge=tuple(anhaenge),
        bcc=tuple(verdeckt),
    )
    dienst = mail or BelegMailService(s)
    try:
        message_id = dienst.send(nachricht)
    except MailError as exc:
        log.warning(
            "versand_mail_fehlgeschlagen",
            tenant_id=ctx.tenant_id,
            empfaenger=len(empfaenger),
            status_code=exc.status_code,
            error=exc.message[:200],
        )
        raise VersandError(exc.message, status_code=exc.status_code) from exc
    log.info(
        "versand_mail_gesendet",
        tenant_id=ctx.tenant_id,
        user_id=ctx.user_id,
        empfaenger=len(empfaenger),
        cc=len(cc or []),
        bcc=len(verdeckt),
        anhaenge=[n for n, _, _ in anhaenge],
        kopie_an=bool(kopie_an),
        message_id=str(message_id)[:80],
    )
    return str(message_id)
