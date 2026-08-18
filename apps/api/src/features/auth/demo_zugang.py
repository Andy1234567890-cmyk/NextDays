"""Der Vorführ-Zugang: eine Session für den Demo-Mandanten, ohne Anmeldung.

Was der Endpunkt löst: Auf der Marketing-Seite klickt jemand „Demo ansehen"
und soll in der ECHTEN Anwendung landen — nicht in einem eingefrorenen
Schnappschuss, wie ihn Storylane, Navattic und Reprise Replay ausliefern
(Anbietervergleich: `docs/ANALYSE-storylane-technik.md`). Kein Anbieter kann
das, weil keiner ein eigenes Backend hat. Wir haben eines.

WARUM DER BESUCHER DIE ZUGANGSDATEN NICHT ERFÄHRT:
Der naheliegende Weg wäre, Login und Passwort auf der Marketing-Seite
anzuzeigen („einfach damit anmelden"). Dann stünden sie in jedem Screenshot, in
jedem Blogbeitrag und in jeder Suchmaschine — und wer sie hat, kann sich auch
in einem Jahr noch anmelden, wenn wir den Zugang längst abgeschaltet haben
wollten. Hier meldet stattdessen der SERVER an; der Besucher bekommt nur die
fertige Session. Das Passwort liegt in der Umgebung, nicht im Netz.

WARUM DAS TROTZDEM SICHER IST:
Die Session ist echt und trägt den Mandanten Nordlicht mit Rolle `admin` — sie
könnte also alles ändern. Kann sie aber nicht: der Riegel in
`core.security.get_current_user` (siehe `demo_gate.py`, 0407) lehnt für Nutzer
eines Demo-Mandanten JEDE Anfrage ab, die nicht GET/HEAD/OPTIONS ist. Das gilt
für alle 536 schreibenden Routen, auch für die 76 ohne Rollen-Guard.

WAS DIESER ENDPUNKT NICHT TUT:
Er legt keinen Nutzer an, kopiert keinen Mandanten und setzt keinen Zustand
zurück. Alle Besucher teilen dieselbe Vorführung. Das ist Absicht: ein
Mandant pro Besucher wäre eine eigene Bereitstellungs-Infrastruktur (so machen
es TestBox und Instruqt), und weil niemand schreiben kann, gibt es auch nichts,
was sich gegenseitig in die Quere käme.
"""
from __future__ import annotations

from fastapi import HTTPException, status
from pydantic import SecretStr

from src.core.config import get_settings
from src.core.logging import get_logger

log = get_logger("nextdays.auth.demo_zugang")

_NICHT_KONFIGURIERT = (
    "Die Vorführung ist nicht eingerichtet."
)


class DemoZugangFehler(Exception):
    """Der Vorführ-Zugang steht nicht zur Verfügung.

    Eigene Klasse statt HTTPException im Dienst: der Router entscheidet über
    den HTTP-Code, der Dienst kennt kein HTTP.
    """

    def __init__(self, message: str, *, status_code: int = 503) -> None:
        super().__init__(message)
        self.message = message
        self.status_code = status_code


def demo_zugangsdaten() -> tuple[str, SecretStr, str]:
    """(Login, Passwort, erwartete tenant_id) aus der Umgebung.

    Fail-CLOSED (Wurzel 4/5): fehlt eines der drei, gibt es keinen Ersatzwert
    und keinen hartkodierten Zugang — der Endpunkt antwortet 503, und die
    Marketing-Seite blendet den Knopf aus. Ein Fallback wäre hier besonders
    schädlich: er wäre ein öffentlich bekannter Login in eine echte Anwendung.
    """
    s = get_settings()
    login = (s.demo_login or "").strip()
    passwort = s.demo_passwort
    tenant = (s.demo_tenant_id or "").strip()
    if not login or not passwort.get_secret_value() or not tenant:
        raise DemoZugangFehler(_NICHT_KONFIGURIERT)
    return login, passwort, tenant


def tenant_pruefen(erwartet: str, tatsaechlich: str | None, *, user_id: str) -> None:
    """Trägt die frische Session wirklich den Vorführ-Mandanten?

    Die Gegenprobe ist kein Selbstzweck. Würde am Demo-Konto jemand den
    Mandanten umstellen — versehentlich beim Aufräumen, oder weil die
    Zugangsdaten in der Umgebung auf ein anderes Konto zeigen —, dann gäbe
    dieser Endpunkt anonymen Besuchern eine Session in einen ECHTEN Betrieb.
    Und der `demo_gate`-Riegel griffe dort nicht, weil er am `is_demo`-Flag des
    Mandanten hängt: der Besucher könnte schreiben.

    Deshalb: stimmt der Mandant nicht, wird die Session verworfen statt
    ausgeliefert (fail-closed).
    """
    if tatsaechlich == erwartet:
        return
    log.error(
        "demo_zugang_falscher_mandant",
        user_id=user_id,
        erwartet=erwartet,
        tatsaechlich=tatsaechlich or "(keiner)",
    )
    raise DemoZugangFehler(
        "Die Vorführung ist nicht richtig eingerichtet.", status_code=503
    )


def als_http_fehler(exc: DemoZugangFehler) -> HTTPException:
    """Übersetzung für den Router."""
    return HTTPException(
        status_code=exc.status_code or status.HTTP_503_SERVICE_UNAVAILABLE,
        detail=exc.message,
    )


def session_pruefen(*, mfa_required: bool, hat_session: bool) -> None:
    """Ist eine benutzbare Session entstanden?

    Der Vorfuehr-Zugang hat bewusst keine Zwei-Faktor-Anmeldung — sonst waere
    die Demo nicht ohne Zutun erreichbar. Kommt trotzdem eine Aufforderung
    zurueck (jemand hat am Konto 2FA eingeschaltet), gibt der Endpunkt nichts
    heraus: eine halbe Session waere fuer den Besucher wertlos und der Grund
    unauffindbar (fail-closed statt stiller Teilerfolg, Wurzel 5).
    """
    if not mfa_required and hat_session:
        return
    log.warning("demo_zugang_ohne_session", mfa=mfa_required)
    raise DemoZugangFehler(
        "Die Vorfuehrung ist nicht richtig eingerichtet.", status_code=503
    )


def login_fehler_melden(meldung: str) -> None:
    """Ein gescheiterter Vorfuehr-Login ist eine Stoerung, kein Nutzerfehler.

    Steht in der Umgebung ein falsches Passwort, ist das ein Betriebsproblem —
    der Besucher hat nichts falsch gemacht. Es gehoert ins Log, damit man es
    findet, statt es beim Besucher zu suchen.
    """
    log.error("demo_zugang_login_fehlgeschlagen", error=meldung[:200])
