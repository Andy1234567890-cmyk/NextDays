"""Lesestand im Posteingang: was ist wirklich ungelesen?

Der Anlass (live, 07.08.2026): In der Liste trug JEDE Zeile ein rotes „Neu" —
das war der BUCHUNGS-Status (`channex_booking.status`, bei allen 22 `new`),
nicht der Lesestand. Gleichzeitig standen alle 22 Threads auf
`is_read = true`. Die Anzeige unterschied also nichts.

`is_read` allein trägt die Frage auch nicht: es ist ein Handflag, das beim
Öffnen gesetzt wird und dann stehen bleibt. Schreibt der Gast danach erneut,
bliebe der Thread „gelesen".

Der zweite Anlass (live, 11.08.2026): neun Threads standen auf ungelesen,
obwohl in vier davon WIR die letzte Nachricht geschrieben hatten und in acht
davon die letzte Gastnachricht ÄLTER war als der Lesezeitpunkt. Der
Journal-Tick hatte `is_read` alle fünf Minuten pauschal zurückgesetzt (behoben
in `nachrichten_eingang._eingang_signalisieren`); hier steht die zweite Hälfte
der Antwort: eine eigene Antwort nach der Gastnachricht heißt gelesen, und ein
Flag, das dem Lesezeitpunkt widerspricht, gewinnt nicht gegen ihn.
"""

from __future__ import annotations

from src.features.inbox.service import InboxService
from src.features.inbox.spiegel import LEERER_STAND, ThreadStand

gelesen = InboxService._ist_gelesen  # noqa: SLF001 — reine Funktion, absichtlich


def stand(*, gast: str = "", eigene: str = "") -> ThreadStand:
    """Spiegel-Stand eines Threads; nur die Zeitpunkte sind hier von Belang."""
    return LEERER_STAND._replace(letzte_gast=gast, letzte_eigene=eigene)


def test_ungelesenes_flag_bleibt_ungelesen():
    zeile = {"is_read": False, "read_at": "2026-08-01T10:00:00Z"}
    assert gelesen(zeile, LEERER_STAND) is False


def test_gelesen_ohne_gastnachricht():
    """Nichts Neues seit dem Lesen → bleibt gelesen."""
    zeile = {"is_read": True, "read_at": "2026-08-01T10:00:00Z"}
    assert gelesen(zeile, LEERER_STAND) is True


def test_neue_gastnachricht_macht_wieder_ungelesen():
    """Der Kern: nach dem Lesen kam eine Gastnachricht."""
    zeile = {"is_read": True, "read_at": "2026-08-01T10:00:00Z"}
    assert gelesen(zeile, stand(gast="2026-08-02T09:00:00Z")) is False


def test_aeltere_gastnachricht_aendert_nichts():
    """Die Nachricht lag VOR dem Lesen — sie wurde also mitgelesen."""
    zeile = {"is_read": True, "read_at": "2026-08-03T10:00:00Z"}
    assert gelesen(zeile, stand(gast="2026-08-01T09:00:00Z")) is True


def test_gleicher_zeitpunkt_gilt_als_gelesen():
    """Grenzfall: Lesen und Nachricht auf dieselbe Sekunde. Kein Sprung auf
    ungelesen — sonst wäre ein gerade geöffneter Thread sofort wieder neu."""
    zeile = {"is_read": True, "read_at": "2026-08-01T10:00:00Z"}
    assert gelesen(zeile, stand(gast="2026-08-01T10:00:00Z")) is True


def test_ohne_lesezeitpunkt_zaehlt_allein_das_flag():
    """Altbestand ohne `read_at` (Spalte kam mit 0302): kein erfundener
    Vergleichswert, das Flag gilt unverändert (Wurzel 4)."""
    neu = stand(gast="2026-08-02T09:00:00Z")
    assert gelesen({"is_read": True}, neu) is True
    assert gelesen({"is_read": True, "read_at": None}, neu) is True
    assert gelesen({"is_read": False, "read_at": None}, neu) is False


def test_fehlendes_flag_gilt_als_gelesen():
    """Default wie in der Spalte: kein Flag → kein ungelesener Zustand."""
    assert gelesen({}, LEERER_STAND) is True


def test_eigene_antwort_nach_der_gastnachricht_heisst_gelesen():
    """Niemand antwortet auf eine Nachricht, die er nicht gelesen hat.

    Deckt die Wege ab, die `read_at` nie berühren: die Abwesenheitsantwort des
    Schedulers und eine Antwort, die direkt in der Portal-App geschrieben wurde.
    """
    zeile = {"is_read": False, "read_at": None}
    assert gelesen(
        zeile, stand(gast="2026-08-11T05:42:58Z", eigene="2026-08-11T06:25:33Z")
    ) is True


def test_eigene_antwort_vor_der_gastnachricht_zaehlt_nicht():
    """Der Gast hat NACH unserer Antwort geschrieben — das ist offene Arbeit."""
    zeile = {"is_read": True, "read_at": "2026-08-10T19:00:00Z"}
    assert gelesen(
        zeile, stand(eigene="2026-08-10T18:00:00Z", gast="2026-08-11T09:26:22Z")
    ) is False


def test_flag_gewinnt_nicht_gegen_den_lesezeitpunkt():
    """Der live gemessene Fall: `is_read = false` bei einer Gastnachricht, die
    ÄLTER ist als `read_at`. Das kann nur ein Zurücksetzen von außen sein (der
    Journal-Tick) — gelesen bleibt gelesen. Ein ausdrückliches „als ungelesen
    markieren" ist davon nicht betroffen: es leert `read_at` mit."""
    zeile = {"is_read": False, "read_at": "2026-08-11T11:16:14Z"}
    assert gelesen(zeile, stand(gast="2026-08-11T05:42:58Z")) is True


def test_gemischte_zeitformate_werden_als_zeitpunkt_verglichen():
    """PostgREST liefert `…+00:00`, `ota_zeitstempel_utc` hängt ein `Z` an. Im
    Zeichenvergleich ist „Z" > „+" — dieselbe Sekunde galt damit als später und
    ein gerade gelesener Thread sprang zurück auf ungelesen."""
    zeile = {"is_read": True, "read_at": "2026-08-11T09:26:22.833+00:00"}
    assert gelesen(zeile, stand(gast="2026-08-11T09:26:22.833Z")) is True
