"""Was ein Portal von den anderen unterscheidet — an EINER Stelle.

Ein Objekt läuft bei mehreren Portalen gleichzeitig, und die Portale sind
technisch verschiedene Welten. Bis hierher stand jede dieser Eigenheiten dort,
wo sie zufällig gebraucht wurde: `portal_code == "AirBNB"` an über einem
Dutzend Stellen in vier Modulen, jede für sich richtig, keine mit den anderen
abgeglichen. Zweimal ist daraus derselbe stille Fehler geworden — Booking.com
lief auf dem Airbnb-Pfad, ohne dass es jemand sah:

* `channels._objekte_mit_channex_ziel` verglich für JEDES Portal
  `airbnb_listing_id` gegen `settings.listing_id`. Booking liefert dort nichts
  → leere Menge → jedes Booking-Objekt „nicht verbunden", und weil
  `sync_enabled` an derselben Größe hängt, lief gar kein Abgleich (07.08.2026).
* `objekt_kanal._kanal_zuordnung_anlegen` baute die Zuordnung unbedingt als
  `{"listing_id": …}`. Hing das Objekt auch bei Airbnb, ging die Airbnb-Nummer
  an den Booking-Kanal; hing es das nicht, kam eine 422 mit einer
  Airbnb-Anweisung, die bei Booking niemand befolgen kann.

Beide Male war die Frage dieselbe: *Woran erkennt DIESES Portal ein Objekt?*
Sie steht ab jetzt hier und wird gefragt, nicht geraten.

ABGRENZUNG — was hier NICHT hineingehört:
  * Die Portal-LISTE. Welche Kanäle ein Konto verbinden kann, kommt live aus
    dem Channex-Katalog (`channels/list`), nicht aus einer Konstanten
    (Wurzel 4). Diese Registry beschreibt nur die Eigenheiten der Portale, die
    wir wirklich bedienen — für alle anderen gilt `STANDARD_PORTAL`.
  * Die Zuordnungs-FELDER beim Anlegen. Welche Settings-Schlüssel ein Kanal
    trägt, deklariert Channex im Katalog (`rate_params`);
    `channels._rate_plan_settings` baut daraus. Das ist der bessere Weg, weil
    er auch für Portale stimmt, die wir nie angefasst haben.
  * Abgaben-Regeln. Die stehen in `ota_abgaben.PORTAL_REGELN` und sind eine
    andere Frage (welche Gebühr/Steuer geht wie raus) mit eigener Historie.
    Die Portal-Codes selbst kommen von dort, damit es genau eine Quelle gibt.

Wer ein Portal ergänzt, trägt es hier ein — und findet über `objekt_kennung`
alle Stellen, die davon abhängen.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Literal

from src.features.channel_manager.ota_abgaben import AIRBNB, BOOKING, EXPEDIA

__all__ = [
    "AIRBNB",
    "BOOKING",
    "EXPEDIA",
    "ObjektKennung",
    "PortalProfil",
    "ist_airbnb",
    "portal_profil",
]

# Woran ein Portal ein Objekt erkennt. Zwei Welten, kein Zwischending:
#
#   listing   — Airbnb. Die Anzeige IST das Objekt; ihre Nummer steht am Objekt
#               (`properties.airbnb_listing_id`), weil eine Airbnb-Anzeige nur
#               zu genau einem Objekt gehören kann.
#   zimmertyp — alle übrigen. Verkauft wird ein Zimmertyp; seine Kennung steht
#               an der VERBINDUNG (`channex_channel_connection.ota_room_type_code`),
#               weil dasselbe Objekt bei zwei Portalen unter verschiedenen
#               Kennungen läuft.
ObjektKennung = Literal["listing", "zimmertyp"]


@dataclass(frozen=True, slots=True)
class PortalProfil:
    """Die Eigenheiten EINES Portals.

    `kennung` ist der Kern: Aus ihr folgen das Channex-Settings-Feld, unsere
    Spalte und die Tabelle, in der sie steht. Die drei dürfen nicht einzeln
    gesetzt werden — sonst entsteht wieder eine Kombination, die es nicht gibt.
    """

    code: str
    kennung: ObjektKennung
    #: Verbindung per OAuth statt per eingebbarem Credential (Airbnb).
    oauth: bool = False
    #: Der Direktzugriff auf die Portal-API über Channex' `action/api_proxy`.
    #: Nur Airbnb hat ihn; ohne ihn gibt es keinen Ist-Abgleich, keine Fotos,
    #: keine Raumliste und keine Verfügbarkeitsregeln am Inserat.
    direktzugriff: bool = False
    #: Anzeigenamen, unter denen dieses Portal in fremden Daten auftaucht
    #: (`ota_name` in der Buchung). Channex schreibt „BookingCom" ohne Punkt,
    #: die OTA-Meldung nennt sich „Booking.com" — beide meinen dasselbe.
    aliase: tuple[str, ...] = field(default=())

    @property
    def settings_feld(self) -> str:
        """Der Schlüssel in `rate_plans[].settings` eines Channex-Kanals."""
        return "listing_id" if self.kennung == "listing" else "room_type_code"

    @property
    def kennung_tabelle(self) -> str:
        """Wo unsere Entsprechung steht."""
        return (
            "properties"
            if self.kennung == "listing"
            else "channex_channel_connection"
        )

    @property
    def kennung_spalte(self) -> str:
        """Welche Spalte dort die Portal-Kennung trägt."""
        return (
            "airbnb_listing_id"
            if self.kennung == "listing"
            else "ota_room_type_code"
        )


# Airbnb ist die Ausnahme, nicht die Regel: eigener OAuth-Weg, Direktzugriff auf
# die Connection API, Anzeige statt Zimmertyp. Alles, was hier `True` steht,
# ist ein Sonderweg, den andere Portale NICHT haben.
_AIRBNB = PortalProfil(
    code=AIRBNB,
    kennung="listing",
    oauth=True,
    direktzugriff=True,
    aliase=("airbnb", "air bnb"),
)

# Booking.com: Zimmertypen mit n Raten, Credential-Connect über die Hotel-ID,
# kein Direktzugriff. `bookingcom` ohne Punkt ist Channex' Kanalcode, mit Punkt
# meldet sich die OTA — beide Schreibweisen kommen live vor.
_BOOKING = PortalProfil(
    code=BOOKING,
    kennung="zimmertyp",
    aliase=("booking.com", "booking", "bookingcom", "booking.com b.v."),
)

_EXPEDIA = PortalProfil(
    code=EXPEDIA,
    kennung="zimmertyp",
    aliase=("expedia",),
)

_PROFILE: dict[str, PortalProfil] = {
    p.code: p for p in (_AIRBNB, _BOOKING, _EXPEDIA)
}

# Jedes Portal ohne eigenen Eintrag. `zimmertyp` ist die richtige Annahme:
# Airbnbs Anzeigen-Modell ist der Sonderfall, alle übrigen Kanäle im
# Channex-Katalog verkaufen Zimmertypen. Ein unbekanntes Portal bekommt so den
# Weg, der bei ihm mit hoher Wahrscheinlichkeit stimmt — und niemals den
# Airbnb-Sonderweg, der bei ihm sicher falsch wäre.
STANDARD_PORTAL = PortalProfil(code="", kennung="zimmertyp")


def portal_profil(portal_code: str | None) -> PortalProfil:
    """Das Profil eines Portals; ohne eigenen Eintrag das Standardverhalten."""
    if not portal_code:
        return STANDARD_PORTAL
    return _PROFILE.get(portal_code, STANDARD_PORTAL)


def ist_airbnb(portal_code: str | None) -> bool:
    """Ob dieses Portal Airbnb ist.

    Als Funktion, nicht als Vergleich: `portal_code == "AirBNB"` an vielen
    Stellen ist genau das Muster, das zweimal zu einem stillen Booking-Fehler
    geführt hat, und ein Grep nach dem Literal findet die Stellen nicht
    zuverlässig (Groß-/Kleinschreibung, Konstante vs. String).
    """
    return portal_code == AIRBNB
