"""Ein Airbnb-Bestandsabruf je Tick, von allen Nachpflege-Schritten geteilt.

DAS PROBLEM, das dieses Modul löst (12.08.2026, live gemessen):
Vier Nachpflege-Schritte brauchen dieselbe Auskunft — „welche Reservierungen
hat dieses Konto, und was steht an ihnen?". Jeder holte sie sich selbst:

    buchungszeitpunkte_heilen  → airbnb_historie_lesen(6 Jahre zurück, 2 vor)
    anreisezeiten_heilen       → airbnb_historie_lesen(derselbe Zeitraum)
    profilbilder_heilen        → airbnb_historie_lesen(derselbe Zeitraum)
    lesestaende_aktualisieren  → airbnb_historie_lesen(derselbe Zeitraum)

Der Zeitraum ist ~8 Jahre; `etappen_planen` zerlegt ihn in 12-Monats-Fenster im
3-Monats-Schritt. Im Worker-Log stand deshalb VIERMAL pro Tick dieselbe Zeile:

    {"von": "2020-01-01", "bis": "2028-12-31", "etappen": 36,
     "buchungen": 462, "vollstaendig": true}

36 Etappen × 4 Schritte alle fünf Minuten, um immer dieselben 462 Buchungen zu
holen. `sync_bookings_feed` brauchte dadurch ⌀78 s (Spitze 129 s) — 18× so viel
wie der zweitteuerste Job — und meldete dabei „nichts zu tun", weil der Feed
selbst leer war (`total: 0`, an der Quelle gemessen).

WIE ES JETZT LÄUFT: Der erste Schritt, der den Bestand braucht, holt ihn; die
drei folgenden bekommen dieselbe Antwort. Der Cache lebt genau einen Tick lang
(`fuer_tick()` als Kontextmanager) — länger wäre falsch: eine neue Buchung
zwischen zwei Ticks muss gefunden werden, sonst heilt der nächste Lauf sie nicht.

WARUM KEIN ZEITBASIERTER CACHE (TTL): Ein TTL entkoppelt die Frische von der
Arbeit. Nach einem Tick ist die Antwort verbraucht, nicht „5 Minuten haltbar" —
und ein TTL, der einen Tick überlebt, verzögert genau die Heilung, für die der
Abruf gemacht wird. Die Tick-Grenze ist die fachlich richtige Grenze.

KEIN NEBENLÄUFIGER ZUGRIFF: Der Worker arbeitet einen Job zur Zeit; der Cache
ist deshalb bewusst einfach (ein Dict, kein Lock). Läuft irgendwann mehr als ein
Worker-Thread, gehört hier ein `threading.local` hin — dann aber bewusst, nicht
aus Vorsicht vorab.
"""

from __future__ import annotations

import contextlib
from collections.abc import Callable, Iterator

from src.core.logging import get_logger

from .airbnb_historie import HistorieErgebnis

log = get_logger("nextdays.channel_manager.airbnb_bestand_cache")

# Was der Cache zum Nachladen braucht — die echte Abruf-Methode.
_Leser = Callable[[str], HistorieErgebnis]

# Der Cache des laufenden Ticks: Token → Bestandsantwort. `None` heisst „kein
# Tick offen", dann wird nicht gecacht (Handpfade über die API sollen ihren
# eigenen frischen Abruf bekommen).
_offen: dict[str, HistorieErgebnis] | None = None


@contextlib.contextmanager
def fuer_tick() -> Iterator[None]:
    """Für die Dauer eines Worker-Ticks Bestandsabrufe bündeln.

    Verschachtelung ist erlaubt und ändert nichts: nur die äusserste Klammer
    öffnet und schliesst den Cache. So darf ein Schritt, der selbst schon in
    einem Tick läuft, `fuer_tick()` benutzen, ohne den gemeinsamen Cache seiner
    Geschwister wegzuwerfen.
    """
    # Der Tick-Zustand ist bewusst modulweit: die vier Schritte liegen in
    # verschiedenen Mixins und sollen sich nichts durchreichen müssen. Ein
    # Objekt-Cache hätte durch alle vier Signaturen gefädelt werden müssen.
    global _offen  # noqa: PLW0603  # pylint: disable=global-statement
    if _offen is not None:
        yield  # schon offen: die äussere Klammer räumt auf
        return
    _offen = {}
    try:
        yield
    finally:
        anzahl = len(_offen)
        _offen = None
        if anzahl:
            log.info("airbnb_bestand_cache_geschlossen", konten=anzahl)


def bestand(token: str, leser: _Leser) -> HistorieErgebnis:
    """Den Bestand eines Kontos holen — je Tick nur EINMAL wirklich abgerufen.

    Ohne offenen Tick (Handpfad über die API) wird durchgereicht: ein Nutzer, der
    „Historie abrufen" drückt, will den echten Stand sehen, nicht den vom Tick.
    """
    if _offen is None:
        return leser(token)
    if token in _offen:
        log.info("airbnb_bestand_aus_cache")
        return _offen[token]
    antwort = leser(token)
    _offen[token] = antwort
    return antwort
