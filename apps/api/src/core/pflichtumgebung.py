"""Konfigurationsmängel laut melden — statt sie wie Netzfehler aussehen zu lassen.

WARUM ES DIESES MODUL GIBT (25.08.2026): `api` und `worker` fahren denselben
Code aus demselben Repo, sind in Coolify aber ZWEI Anwendungen mit je eigener,
handgepflegter Variablenliste (`nextdays-api` = id 8, `nextdays-worker` = id 9).
Nichts vergleicht die beiden. Live nachgemessen trug die API `APP_BASE_URL`,
die acht `COMPANY_*` und `STRIPE_SECRET_KEY` — der Worker keine einzige davon.
Und genau der Worker fährt die Gast-Automails, die Bewertungsanfragen, die
Buchungsmeldungen und die drei geldbewegenden Läufe (Einzug fälliger
Restzahlungen, Auszahlungen, Provisionsabrechnung am Monatsersten).

Der Mangel selbst war eine Zeile Konfiguration. Der Fehler im Code war, dass er
STILL blieb — in zwei Ausprägungen:
  * Der Mail-Button fiel ohne `app_base_url` einfach weg, ohne eine Zeile Log.
    Aufgefallen ist das nicht dem System, sondern dem Auge einer Kundin:
    „diese Mails haben keinen Link und keinerlei Hinweise."
  * Die Geld-Ticks fingen `Exception` breit und schrieben `log.warning` — genau
    dieselbe Zeile wie bei „Stripe war kurz nicht erreichbar". Ein
    Betriebsmangel, der aussieht wie ein transienter Fehler, wird nie behoben.

Beides ist Wurzel 5 in ihrer stillen Form. Deshalb hier: eigener Ereignisname,
Stufe ERROR, und die Handlungsanweisung steht IN der Meldung — sonst sucht sie
jemand im Code statt in der Konfiguration.

Das Modul liegt in `core`, nicht im Worker: die Frage „welche Variable fehlt
diesem Prozess" stellt sich jedem Prozess, der eigenständig deployt wird. Die
LISTE ist dagegen prozessspezifisch und steht beim jeweiligen Aufrufer.

Geprüft wird die laufende Umgebung außerdem von außen:
`bash scripts/diagnose/mail-umgebung-pruefen.sh`.
"""
from __future__ import annotations

from typing import NamedTuple

from src.core.config import get_settings
from src.core.logging import get_logger

log = get_logger("nextdays.pflichtumgebung")


class Pflichtwert(NamedTuple):
    """Eine Variable, für die es keinen Ersatz gibt (Wurzel 4).

    `folge` ist kein Kommentar, sondern Teil der Meldung: eine Warnung ohne
    Folge wird von niemandem priorisiert. Sie beantwortet „was fällt aus, wenn
    das hier fehlt" in einem Satz.
    """

    env_name: str
    settings_feld: str
    folge: str


def _wert(settings: object, feld: str) -> str:
    """Den Rohwert eines Settings-Felds — `SecretStr` und `str` nebeneinander.

    Alles, was weder das eine noch das andere ist, gilt als nicht gesetzt: ein
    Wert, der kein Text ist, ist keine Konfiguration (dieselbe strenge Lesart
    wie in `core.mail_layout._feld`).
    """
    roh = getattr(settings, feld, "")
    if hasattr(roh, "get_secret_value"):
        roh = roh.get_secret_value()
    return roh.strip() if isinstance(roh, str) else ""


def melde_konfigurationsmangel(
    ereignis: str,
    variablen: str,
    exc: Exception,
    *,
    coolify_app: str,
    # Zusatzfelder je Aufrufer (fällige Zeilen, Periode) — sie landen als
    # eigene Schlüssel im strukturierten Log, statt in den Text gequetscht zu
    # werden. `object` statt `Any`: der Logger serialisiert selbst.
    **felder: object,
) -> None:
    """Einen zur Laufzeit aufgetretenen Konfigurationsmangel melden.

    Bewusst KEIN `log.warning` wie die übrigen Tick-Fehler: ein fehlender
    Schlüssel heilt nicht von selbst, und niemand sucht danach, solange er im
    Rauschen der transienten Fehler steht.
    """
    log.error(
        ereignis,
        fehlt=variablen,
        coolify_app=coolify_app,
        zu_tun=(
            f"{variablen} in der Coolify-Anwendung '{coolify_app}' setzen, "
            "dann die Anwendung REDEPLOYEN — ein docker restart genügt nicht, "
            "Coolify reicht Env-Änderungen nur beim Deploy in den Container."
        ),
        error=str(exc)[:200],
        **felder,
    )


def pflichtvariablen_melden(
    pflicht: tuple[Pflichtwert, ...], *, coolify_app: str
) -> list[str]:
    """Beim Start EINMAL sagen, welche Pflichtvariable diesem Prozess fehlt.

    Ohne diese Prüfung fällt ein Mangel erst auf, wenn der erste Lauf ihn
    braucht — bei der Provisionsabrechnung also frühestens am nächsten
    Monatsersten, und dann als Fehlschlag statt als Vorwarnung.

    Der Prozess startet trotzdem, und das ist Absicht: die übrigen Läufe hängen
    an keinem dieser Werte, und einer, der beim Start abbricht, nimmt dem
    Betrieb mehr, als der Mangel kostet. Gibt die fehlenden Namen zurück, damit
    ein Aufrufer sie auswerten kann, ohne das Log zu parsen.
    """
    settings = get_settings()
    fehlend = [p.env_name for p in pflicht if not _wert(settings, p.settings_feld)]
    for wert in pflicht:
        if wert.env_name not in fehlend:
            continue
        log.error(
            "pflichtvariable_fehlt",
            variable=wert.env_name,
            faellt_aus=wert.folge,
            coolify_app=coolify_app,
            zu_tun=(
                f"{wert.env_name} in der Coolify-Anwendung '{coolify_app}' "
                "setzen und REDEPLOYEN (docker restart genügt nicht)."
            ),
        )
    return fehlend
