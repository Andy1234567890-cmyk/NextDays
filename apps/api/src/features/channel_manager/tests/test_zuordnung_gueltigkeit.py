"""Eine unbrauchbare Portal-Zuordnung wird ERKANNT — Existenz ist nicht Gültigkeit.

Der Fall, live gemessen (21.08.2026, `016 Klitrosevej · Feriehus Rævehulen`):
Bei Channex stand ein Eintrag mit unserer Listing-ID, aber in
`settings.airbnb_rate_plan_id` die LISTING-ID als Rate-Plan-ID — eine Nummer,
die Airbnb nicht kennt. Channex führte das Listing als „Not mapped", unsere
Oberfläche zeigte „Synchronisiert". Gemessen waren 1 von 17 Zuordnungen des
kontoweiten Airbnb-Kanals betroffen; die 16 funktionierenden haben das Feld leer.

Die Anzeige-Lücke: `_objekte_mit_channex_ziel` fragte nur, OB ein Eintrag mit
dieser Listing-ID existiert — und der existierte.

WARUM HIER KEINE REPARATUR GEPRÜFT WIRD: Es gibt keinen belegten Weg, so eine
Zuordnung im Bestand geradezuziehen. Alle drei Versuche sind live widerlegt:

  * `PUT channels/{id}/mappings/{mid}` → 422 „rate_plan_id must be specified".
  * `PUT channels/{id}` mit dem vollen Array ohne das Feld → 200, Feld bleibt
    stehen (der Kanal-PUT hängt nur NEUE Mappings an).
  * Löschen + `POST …/mappings` mit derselben `rate_plan_id` → DELETE 200,
    POST 200 mit einer fremden `channex_id`, und danach existierte die
    Zuordnung an KEINEM der 20 Kanäle. Ursache: dieser Rate-Plan hängt
    gleichzeitig an einem Booking.com-Kanal (Hotel 16213218) — bei den 16
    funktionierenden Zuordnungen hat jede ihren eigenen, exklusiven Plan.
    Das Objekt war danach bei Airbnb gar nicht mehr zugeordnet; der
    Ausgangszustand wurde per `POST …/mappings` (nur `listing_id`) plus
    `execute/unpublish` wiederhergestellt und gegengeprüft.

Die Erkennung bleibt deshalb allein: sie macht den Zustand SICHTBAR, statt ihn
als „Synchronisiert" zu verstecken. Der Auslöser ist ein Datenfehler (zwei
Kanäle auf einem Rate-Plan) und dort zu beheben, nicht am Mapping.
"""
from src.features.channel_manager.channels import ChannelsMixin
from src.features.channel_manager.channex_client import ChannexError

# Die kaputte Zuordnung des Beta-Betriebs, Feld für Feld wie live gemessen.
LISTING_DEFEKT = "1669350904909142819"
RATE_PLAN_DEFEKT = "ba195be1-1556-4696-828e-3b319d9cf14a"


class _ChannexDouble:
    """Kanal mit mehreren Zuordnungen — eine defekt, die übrigen fremd.

    Der geteilte Airbnb-Kanal ist der Grund für die meisten Prüfungen hier:
    er trägt live 17 Zuordnungen, von denen uns genau eine gehört.
    """

    def __init__(self, plans: list[dict], *, lesbar: bool = True):
        self.plans = plans
        self.lesbar = lesbar
        self.deleted: list[str] = []
        self.created: list[tuple[str, dict]] = []

    def get_channel(self, channel_id: str) -> dict:
        if not self.lesbar:
            raise ChannexError("kanal nicht lesbar", status_code=502)
        return {"data": {"attributes": {"rate_plans": self.plans}}}

    def update_channel(self, channel_id: str, attrs: dict) -> dict:
        """Wie Channex LIVE: quittiert mit 200 und ändert bestehende `settings`
        NICHT (21.08.2026 gemessen). Wer diesen Weg nimmt, erreicht nichts —
        deshalb darf ihn keine Reparatur benutzen."""
        raise AssertionError(
            "update_channel aendert bestehende settings nicht — verbotener Weg"
        )

    def delete_channel_mapping(self, channel_id: str, mapping_id: str) -> dict:
        self.deleted.append(mapping_id)
        self.plans = [p for p in self.plans if p.get("id") != mapping_id]
        return {"data": {}}

    def create_channel_mapping(
        self, channel_id: str, rate_plan_id: str, settings: dict
    ) -> dict:
        self.created.append((rate_plan_id, settings))
        self.plans = [
            *self.plans,
            {"id": f"map-neu-{rate_plan_id}", "rate_plan_id": rate_plan_id,
             "settings": settings},
        ]
        return {"data": {"id": f"map-neu-{rate_plan_id}"}}


def _plan(rate_plan_id: str, listing_id: str, *, kaputt: bool = False) -> dict:
    settings: dict = {"listing_id": listing_id, "published": True}
    if kaputt:
        settings["airbnb_rate_plan_id"] = int(listing_id)
    return {"id": f"map-{rate_plan_id}", "rate_plan_id": rate_plan_id,
            "settings": settings}


# --- 1. Erkennung ------------------------------------------------------------
def test_zuordnung_mit_erfundener_rate_ist_unbrauchbar() -> None:
    """Gesetztes `airbnb_rate_plan_id` = das Portal kann das Ziel nicht auflösen."""
    assert ChannelsMixin._zuordnung_unbrauchbar(
        {"listing_id": LISTING_DEFEKT, "airbnb_rate_plan_id": int(LISTING_DEFEKT)}
    )


def test_saubere_zuordnung_bleibt_gueltig() -> None:
    """Die 16 funktionierenden Bestands-Mappings haben das Feld leer."""
    assert not ChannelsMixin._zuordnung_unbrauchbar(
        {"listing_id": LISTING_DEFEKT, "published": True}
    )
    # Ausdrücklich auch der leere/None-Fall — `pop` hinterlässt kein Feld,
    # ein fremder Client könnte aber `null` schreiben.
    assert not ChannelsMixin._zuordnung_unbrauchbar({"airbnb_rate_plan_id": None})


class _DbDouble:
    """Nur `properties.airbnb_listing_id` — das braucht die Auflösung."""

    def __init__(self, rows: list[dict]):
        self.rows = rows

    def table(self, name: str) -> "_DbDouble":
        assert name == "properties"
        return self

    def select(self, *_a, **_k) -> "_DbDouble":
        return self

    def eq(self, *_a, **_k) -> "_DbDouble":
        return self

    def in_(self, *_a, **_k) -> "_DbDouble":
        return self

    def execute(self) -> object:
        return type("R", (), {"data": self.rows})()


def test_defekte_zuordnung_zaehlt_nicht_als_zugeordnet() -> None:
    """Der Kern der Anzeige-Lücke: existiert ≠ zugeordnet.

    Zwei Objekte, beide mit einem Eintrag am Kanal — eines sauber, eines mit
    erfundener Rate. Vorher galten BEIDE als zugeordnet, die kaputte Zeile
    stand auf „Synchronisiert", obwohl nie ein Preis ankam.
    """
    svc = object.__new__(ChannelsMixin)
    svc._channex = _ChannexDouble([
        _plan(RATE_PLAN_DEFEKT, LISTING_DEFEKT, kaputt=True),
        _plan("rp-ok", "999000111", kaputt=False),
    ])
    db = _DbDouble([
        {"id": "prop-defekt", "airbnb_listing_id": LISTING_DEFEKT},
        {"id": "prop-ok", "airbnb_listing_id": "999000111"},
    ])

    zugeordnet, defekt = ChannelsMixin._objekte_mit_channex_ziel(
        svc, db, "t1", ["prop-defekt", "prop-ok"], {"kanal-1"},
        portal_code="AirBNB",
    )

    assert zugeordnet == {"prop-ok"}
    # Getrennt geführt: „kaputt" braucht Reparieren, nicht Verbinden.
    assert defekt == {"prop-defekt"}


def test_kanal_nicht_lesbar_bleibt_unbekannt() -> None:
    """`None` statt „nicht verbunden" — kein erfundener Ersatzwert (Wurzel 4/5)."""
    svc = object.__new__(ChannelsMixin)
    svc._channex = _ChannexDouble([], lesbar=False)

    assert ChannelsMixin._objekte_mit_channex_ziel(
        svc, _DbDouble([]), "t1", ["p1"], {"kanal-1"}, portal_code="AirBNB",
    ) is None


