"""Die Gebühren EINER Buchung samt Zuordnung — die eine Quelle dafür.

Drei Verbraucher brauchen dieselbe Liste: der Eigentümer-Kalender, die
Einnahmen-Übersicht und die Abrechnung. Läge die Ableitung dreimal im Code,
zeigte jede Ansicht über kurz oder lang eine andere Zahl für dasselbe Geld —
genau der Fehler, den ``common.py`` für die Provisionsformel verhindert.

WARUM DIE GEBÜHREN AUS DEM OTA-PAYLOAD KOMMEN, WO ES IHN GIBT:
Live belegt am 11.08.2026 — Airbnb rechnet bei Buchung HM94QD5Y3X eine
Reinigung von 1.075,00 DKK ab, am Objekt sind 795,00 DKK gepflegt. Wer mit den
Stammdaten rechnet, weist dem Eigentümer eine Auszahlung aus, die nicht zu dem
passt, was der Gast wirklich gezahlt hat. Der Payload ist die TATSACHE, die
Stammdaten sind die Absicht.

DIE PAYLOAD-KARTE — WELCHES PORTAL MELDET WO, live über 77 Buchungen geprüft
(11.08.2026). Sie ist der Grund, warum die Reihenfolge in
``gebuehren_der_buchung`` festgelegt ist und nicht beliebig:

===================================== ========= ============== ==============
Stelle im ``raw``                     Airbnb    Booking direkt Booking-Import
                                      (22)      (4)            (51)
===================================== ========= ============== ==============
``raw_message`` → ``reservation``
``.standard_fees_details``            22/22     —              —
``rooms[].taxes``                     leer!     3/4            leer
``rooms[].meta.price_details``        —         3/4            —
``rooms[].meta.charge_periods``       —         3/4            —
``raw_message`` → ``RoomStays``
``…PriceDetails``                     —         3/4 (Kopie)    —
===================================== ========= ============== ==============

Drei Dinge stecken darin, die man leicht falsch annimmt:

1. **``raw_message`` liegt bei ALLEN 77 Buchungen**, nicht nur bei Airbnb. Die
   Kanäle trennt der INHALT: Airbnb schickt ``reservation.*``, Booking sein
   OTA-XML mit ``RoomStays``. Eine Erkennung „hat ``raw_message`` → Airbnb"
   wäre falsch.
2. **``rooms[].taxes`` ist bei Airbnb vorhanden und LEER.** Wer es als
   Erstleser nimmt, liest dort „keine Gebühren angefallen" und bringt jede
   Airbnb-Buchung um ihre Reinigung. Darum fragt ``gebuehren_der_buchung``
   Airbnb ZUERST, und ``booking_aufgeloeste_posten`` verlangt bei leerer Liste
   zusätzlich ``meta.price_details`` daneben.
3. **``RoomStays…PriceDetails`` ist eine wörtliche Kopie** von
   ``meta.price_details`` — eine Ebene tiefer im XML, inhaltlich identisch. Sie
   wird nicht gelesen; sie trägt nichts Neues.

Die beiden Portale meinen mit ``total_amount`` außerdem Verschiedenes:

* **Airbnb** — schon NETTO (Basis + Gebühren − Provision, an 22/22 nachgerechnet).
* **Booking.com** — BRUTTO: Nächtesumme + Gebühren (10.795 + 225 + 1.075 =
  12.095, exakt aufgegangen).

Das ist der Grund für ``GebuehrenBefund.im_gesamtpreis``. Ohne die
Unterscheidung addiert die Kette die Gebühren bei Booking ZWEIMAL — einmal, weil
sie im Gesamtbetrag schon stecken, und einmal als eigener Posten. Bei einer
9-Nächte-Buchung wären das 1.300 DKK zu viel, in einer Auszahlung, die plausibel
aussieht.

WAS DAS PORTAL NICHT MELDET, GIBT ES NICHT: Die 51 Altimporte tragen keine
Aufstellung, und Channex kann sie nicht nachliefern. Bis 11.08.2026 sprangen dort
die Objekt-Stammdaten ein — und erzeugten über den Bestand 191 Reinigungs-, 151
Resort- und 73 Haustier-Posten (zusammen 218.020 DKK), von denen kein einziger
belegt war. Sie flossen als Ertrag in die Eigentümer-Auszahlung. Seitdem gilt:
bei einer Portal-Buchung ohne Aufstellung bleibt die Liste LEER
(``quelle='ota_ohne_aufstellung'``) und die Buchung wird als solche ausgewiesen.
Stammdaten gelten nur, wo es nie einen Payload gab (eigene Website, Telefon).

WARUM ``fee_classification`` PFLICHT IST: ohne Zuordnung ist nicht bestimmbar,
wem der Betrag gehört und ob er in die Provisionsbemessung fließt. Ein Default
(„gehört wohl dem Eigentümer, ist wohl provisionspflichtig") schlüge das Geld
der falschen Partei zu — bei der Reinigung wären das 795 DKK je Buchung
(Wurzel 4). Fehlt die Zuordnung, wird der Betrag NICHT geraten.
"""
from __future__ import annotations

import json
from dataclasses import dataclass, field
from datetime import date
from decimal import Decimal
from typing import Any

from supabase import Client

from src.core.logging import get_logger
from src.features.properties.gebuehren import gebuehr_gilt_am

# Die Kataloge stehen in `booking_gebuehrenarten.py`: abgelesene Daten,
# kein Verhalten (und diese Datei riss mit ihnen die Zeilengrenze).
from .booking_gebuehrenarten import (
    _BOOKING_ABGABEN_NAMEN,
    _BOOKING_ARTEN,
    _BOOKING_STEUER_NAMEN,
)
from .common import Gebuehr, PayoutUnbekannt, zu_decimal

log = get_logger("nextdays.gebuehren_quelle")

# Airbnbs Gebührenarten (``standard_fees_details.fee_type``) auf unsere
# ``fee_classification.fee_type``-Werte. Die Zuordnung ist bewusst explizit und
# NICHT per String-Manipulation geraten: ein unbekannter Airbnb-Typ soll als
# unbekannt auffallen, statt still auf eine falsche Klassifikation zu fallen.
_AIRBNB_ARTEN = {
    "PASS_THROUGH_CLEANING_FEE": "cleaning_fee",
    "PASS_THROUGH_RESORT_FEE": "resort",
    "PASS_THROUGH_PET_FEE": "pet_fee",
    "PASS_THROUGH_MANAGEMENT_FEE": "management_fee",
    "PASS_THROUGH_COMMUNITY_FEE": "community_fee",
    "PASS_THROUGH_LINEN_FEE": "linens",
}

# Booking.com meldet die Gebührenart NUR als freien Text in
# ``tax_description`` — live geprüft: „Reinigungsgebühr", „Resortgebühr",
# „Haustiergebühr". Das ``code``-Feld taugt NICHT zur Unterscheidung: Reinigung
# und Resort tragen beide ``code: "14"``, bei der Haustiergebühr steht der
# deutsche Text sogar selbst im Code-Feld. Darum wird der Text abgebildet, und
# zwar explizit statt per Teilstring-Suche — „Reinigungsgebühr" und
# „Endreinigungsgebühr" wären sonst dieselbe Art, obwohl der Betrieb sie
# getrennt vereinbart haben kann.
#
# Der Schlüssel ist kleingeschrieben und getrimmt, weil Booking denselben Text
# in verschiedener Schreibweise liefern kann; der Text selbst ist SPRACHABHÄNGIG
# (er kommt in der Sprache des Inserats). Ein unbekannter Text wirft darum mit
# einem Grund, der die Art nennt — der Betrieb trägt sie dann hier nach, statt
# dass ein geratener Betrag in eine Auszahlung läuft.

# DER SPRACHNEUTRALE WEG — Booking führt dieselben Gebühren ein zweites Mal, als
# Schlüssel in ``rooms[].meta.charge_periods``::
#
#     "charge_periods": {"RESORTFEE":   [{"from": "2026-05-25", ...}],
#                        "CLEANINGFEE": [{"from": "2026-05-25", ...}]}
#
# Diese Schlüssel sind KONSTANT, egal in welcher Sprache das Inserat läuft. Live
# belegt am 14.08.2026 über neun Booking-Buchungen von sechs Objekten: dieselben
# ``CLEANINGFEE``/``RESORTFEE``-Schlüssel stehen sowohl an den Objekten, deren
# Anzeigename deutsch ankommt („Reinigungsgebühr"), als auch an denen mit
# englischem Namen („Cleaning fee").
#
# WARUM DAS GEBRAUCHT WIRD: der Anzeigename kommt in der Sprache des INSERATS.
# Der Betrieb führt seine Objekte auf Dänisch — „Rengøringsgebyr" stand in
# keiner Liste und hätte die Eigentümer-Abrechnung mit
# ``gebuehr_nicht_zugeordnet`` blockiert (fail-closed, also kein falscher
# Betrag, aber eben auch keine Abrechnung). Eine Namensliste je Sprache wäre bei
# 24 Sprachen × Schreibweisen nie vollständig; der Schlüssel ist es von sich aus.
#
# Der Anzeigename bleibt trotzdem die ERSTE Stufe: er unterscheidet feiner, als
# Bookings Schlüssel es können („Reinigungsgebühr" vs. „Endreinigungsgebühr"
# fallen beide auf ``CLEANINGFEE``). Der Schlüssel ist das Auffangnetz für genau
# die Fälle, in denen der Text unbekannt ist.
_BOOKING_SCHLUESSEL_ARTEN = {
    "CLEANINGFEE": "cleaning_fee",
    "RESORTFEE": "resort",
    "PETFEE": "pet_fee",
    "LINENFEE": "linens",
    "MANAGEMENTFEE": "management_fee",
    "COMMUNITYFEE": "community_fee",
    "CITYTAX": "city_tax",
    "TOURISTTAX": "city_tax",
    "VAT": "vat",
    # Ab 03.09.2026, aus dem LIVE-Bestand gemessen: `ELECTRICITYFEE` kommt in
    # `charge_periods` an (Buchung BDC-5522296055, Feriehus Kornblomst) und
    # fehlte hier. Weil der Schluessel fehlte, half die zweite Stufe nicht,
    # der Anzeigename „Stromkosten" stand in keiner Namensliste, und das
    # `portal:`-Auffangnetz griff — die Abrechnung verlangte eine Zuordnung
    # fuer `portal:stromkosten`, eine Art, die erst zur Laufzeit entsteht und
    # in der Zuordnungsmaske nicht anlegbar ist.
    #
    # Die uebrigen Arten aus Bookings Extranet-Katalog gleich mit, damit nicht
    # die naechste einzeln nachgetragen werden muss. Abgelesen am 03.09.2026
    # (Unterkunft -> Richtlinien -> „Weitere Gebuehren und Kosten"); die
    # Schluesselform folgt dem Muster der gemessenen (Grossbuchstaben + FEE).
    "ELECTRICITYFEE": "electricity",
    "SERVICEFEE": "service_fee",
    "TOWELFEE": "linens_bath",
    "BEDLINENFEE": "linens_bed",
    "GASFEE": "gas",
    "OILFEE": "oil",
    "WOODFEE": "wood",
    "WATERFEE": "water",
    "TRANSFERFEE": "transportation",
    # Kurtaxe und Umweltabgabe stehen ABSICHTLICH nicht hier: sie sind
    # durchlaufende Posten (Entscheidung des Betreibers, 03.09.2026) und
    # werden anhand ihres Namens uebersprungen (`_BOOKING_ABGABEN_NAMEN`).
    # Als Gebuehrenart eingetragen verlangten sie eine Zuordnung — „wem
    # gehoert die Kurtaxe?" ist keine Frage, die es sachlich gibt.
}

# Steuern sind KEINE Gebühren und gehören nicht in die Auszahlungsrechnung des
# Eigentümers — sie sind durchlaufender Posten. Booking meldet sie in derselben
# Liste ``rooms[].taxes``, unterscheidbar am strukturierten ``type``-Feld
# („Value Added Tax (VAT)"). Bis 14.08.2026 kannte der Leser nur Gebührennamen
# und warf bei jeder Steuerzeile ``gebuehr_nicht_zugeordnet`` — die Abrechnung
# von Feriehus Rævehulen war dadurch bereits blockiert („Mehrwertsteuer (25%)").
_BOOKING_STEUER_TYPEN = frozenset({
    "value added tax (vat)", "vat", "city tax", "tourist tax", "goods and "
    "services tax (gst)", "gst", "sales tax", "tax",
})
# Die Arten aus `_BOOKING_SCHLUESSEL_ARTEN`, die Steuern sind — sie dürfen das
# Auffangnetz für Gebühren nicht als Kandidat belegen.
_STEUER_ARTEN = frozenset({"vat", "city_tax"})


@dataclass(frozen=True, slots=True)
class GebuehrenBefund:
    """Die Gebühren einer Buchung PLUS die Aussage, WAS ``total_amount`` ist.

    Der Grund, warum dieser Typ existiert statt einer nackten Liste: die beiden
    Portale legen in dasselbe Feld ``total_amount`` zwei völlig verschiedene
    Beträge, und beide sehen plausibel aus.

    ``uebernachtung`` ist der REINE Übernachtungsbetrag der Buchung, aus der
    Quelle abgeleitet — oder ``None``, wenn der Payload ihn nicht hergibt und
    ``total_amount`` der Buchung selbst zu nehmen ist. Das ist der Kern:

    * **Airbnb** — ``total_amount`` ist ``payout_amount``, also die Auszahlung
      NACH Abzug der 15,5 % Portal-Provision. An 22/22 Live-Buchungen
      nachgerechnet: ``base_price + standard_fees_details − host_fee_base =
      payout_amount``, ausnahmslos, mit konstant 15,50 %. Wer diesen Betrag als
      Übernachtungspreis liest, zieht die Portal-Provision ein ZWEITES Mal ab.
      Darum wird hier ``base_price`` als Übernachtung gemeldet.
    * **Booking.com** — ``total_amount`` ist der GASTPREIS brutto (Nächtesumme +
      Gebühren, an 3/3 Buchungen exakt aufgegangen, u. a. 10.795 + 225 + 1.075 =
      12.095). Die Provision ist darin NICHT abgezogen; sie steht separat und
      ist konstant 15,00 % dieses Betrags.
    * **Altimport ohne Aufstellung** — der Payload sagt nichts, ``uebernachtung``
      bleibt ``None`` und ``total_amount`` gilt als Übernachtungsbetrag. Das ist
      die einzige verfügbare Deutung; sie ist gekennzeichnet, damit sie nicht mit
      einem belegten Wert verwechselt wird.

    ``im_gesamtpreis`` sagt, ob der maßgebliche Betrag die Gebühren schon
    enthält — bei Booking ja, bei Airbnb (``base_price``) und den Stammdaten
    nein.

    ``quelle`` benennt, woher die Liste kommt — bei einer Rückfrage zur
    Abrechnung ist das die erste Frage:

    * ``ota`` — das Portal hat die Gebühren gemeldet. Tatsache.
    * ``ota_ohne_aufstellung`` — Portal-Buchung, aber ohne Aufstellung im
      Payload. Die Liste ist LEER, und das ist eine Aussage: nicht gemeldet
      heißt nicht gezahlt. ``grund`` sagt, warum nichts kam. Diese Buchungen
      werden in der Abrechnung ausgewiesen, statt mit Stammdaten überdeckt.
    * ``stammdaten`` — keine Portal-Buchung (eigene Website, Telefon). Dann gibt
      es keinen Payload, und die gepflegten Gebühren des Objekts sind die
      richtige Quelle: sie sind das, was der Betrieb selbst berechnet hat.
    """

    gebuehren: list[Gebuehr]
    im_gesamtpreis: bool
    quelle: str
    uebernachtung: Decimal | None = None
    # Der Originaltext des Portals je Gebührenart, wo es einen liefert (Booking
    # meldet die Art NUR als freien, sprachabhängigen Text). Aufbewahrt, weil
    # bei einer unbekannten Art genau dieser Text die Frage beantwortet, was der
    # Betrieb zuordnen muss — mit unserem internen Schlüssel allein liesse sich
    # das nicht nachvollziehen.
    bezeichnungen: dict[str, str] = field(default_factory=dict)
    # Bei ``quelle='stammdaten'``: WARUM das Portal nichts geliefert hat
    # (``channex_import`` | ``portal_meldet_keine`` | ``kein_payload``). Siehe
    # ``_stammdaten_grund`` — ohne diesen Wert ist an der Buchung nicht
    # erkennbar, ob eine Lücke behebbar ist oder in der Natur des Eingangswegs
    # liegt.
    grund: str | None = None

    def basisbetrag(self, total_amount: object) -> object:
        """Der Betrag, mit dem die Kette rechnen MUSS.

        Der Payload-Wert schlägt ``total_amount`` — diese Regel steht hier
        EINMAL, damit sie nicht in jedem der drei Verbraucher eigenständig
        nachgebildet (und irgendwann vergessen) wird. Genau so entstand der
        doppelte Provisionsabzug bei Airbnb.
        """
        return self.uebernachtung if self.uebernachtung is not None else total_amount


def _fee_betrag(fee: dict[str, Any], naechte: int) -> Decimal:
    """Den auf DIESE Buchung entfallenden Betrag einer Objekt-Gebühr.

    ``per_night`` × Nächte, ``per_stay`` unverändert. Prozentuale Gebühren
    (``mode='percent'``) kommen im Bestand nicht vor und werden hier NICHT
    stillschweigend als Betrag gelesen — das wäre aus 8 % plötzlich 8,00 DKK.
    """
    if str(fee.get("mode") or "amount") != "amount":
        raise PayoutUnbekannt(
            "gebuehr_nicht_berechenbar",
            f"Gebühr „{fee.get('name') or fee.get('feeType')}“ ist prozentual "
            "hinterlegt; die Auszahlung kann sie nicht als Betrag verrechnen.",
        )
    betrag = zu_decimal(fee.get("amount"))
    if betrag is None:
        raise PayoutUnbekannt(
            "gebuehr_nicht_berechenbar",
            f"Gebühr „{fee.get('name') or fee.get('feeType')}“ ohne Betrag.",
        )
    basis = str(fee.get("basis") or "per_stay")
    if basis == "per_night":
        if naechte <= 0:
            raise PayoutUnbekannt(
                "naechte",
                "Gebühr je Nacht ohne Nächte nicht berechenbar.",
            )
        return betrag * naechte
    return betrag


# DIE STAMMDATEN BELEGEN NUR, DASS EINE GEBÜHR ERHOBEN WÜRDE — NICHT, DASS SIE
# ERHOBEN WURDE. Was der Gast wirklich gezahlt hat, steht in der Buchung. Darum
# sind die Stammdaten seit 11.08.2026 NUR noch die Quelle für Buchungen ohne
# Portal (eigene Website, Telefon, Rezeption); dort sind sie die richtige, denn
# dort hat der Betrieb selbst nach ihnen abgerechnet.
#
# Was der alte Portal-Rückfall angerichtet hat, live gemessen am 11.08.2026:
#   * ``cleaning_fee`` — 191 Posten (186.120 DKK)
#   * ``resort``       — 151 Posten  (20.950 DKK), während die Abrechnung des
#     Betriebs dieselben Buchungen mit 0,00 ausweist
#   * ``pet_fee``      —  73 Posten  (10.950 DKK) bei nur 18 Buchungen mit Tier
# Alles floss als Ertrag in die Eigentümer-Auszahlung und verschob sie gegenüber
# der Abrechnung, mit der der Betrieb wirklich rechnet.
#
# Für anlassgebundene Arten steht der Anlass an der Reservierung. Ist das Feld
# gefüllt, gilt die Gebühr als gebucht.
_ANLASS_GEBUEHREN: dict[str, str] = {
    "pet_fee": "pets",
}


def objekt_gebuehren(
    type_attributes: dict[str, Any] | None,
    naechte: int,
    *,
    anlass: dict[str, Any] | None = None,
) -> list[tuple[str, Decimal]]:
    """Die gepflegten Gebühren eines Objekts als ``(art, betrag)``.

    Liest dieselbe Stelle wie ``properties.gebuehren._fees_von``
    (``type_attributes.pricing.fees``) — nicht die Kopie in
    ``property_pricing_config``, damit es EINE Quelle bleibt.

    ``anlass`` ist die Reservierungszeile. Ohne sie werden anlassgebundene
    Gebühren (siehe ``_ANLASS_GEBUEHREN``) NICHT angesetzt — nicht „vermutlich
    schon", denn das erfände Geld, das der Gast nie gezahlt hat (Wurzel 4).

    Gebühren mit Gültigkeitszeitraum (``validFrom``/``validUntil``) gelten nur,
    wenn die ANREISE der Buchung darin liegt — die Resort-Gebühr des
    Beta-Betriebs gibt es erst seit dem 01.08.2026, davor darf die Abrechnung
    sie nicht nachtragen. Ohne ``check_in`` im Anlass gilt eine solche Gebühr
    nicht (nicht beurteilbar → nicht angesetzt).
    """
    pricing = ((type_attributes or {}).get("pricing") or {})
    anreise = _anreise(anlass)
    out: list[tuple[str, Decimal]] = []
    for fee in pricing.get("fees") or []:
        if not isinstance(fee, dict):
            continue
        if not gebuehr_gilt_am(fee, anreise):
            continue
        art = str(fee.get("feeType") or "").strip()
        if not art:
            # Ohne Art gibt es keine Zuordnung und damit keine Verrechnung.
            # Sie zu erfinden hieße, den Betrag einer geratenen Partei
            # zuzuschlagen.
            raise PayoutUnbekannt(
                "gebuehr_nicht_zugeordnet",
                f"Gebühr „{fee.get('name') or '?'}“ hat keine Gebührenart.",
            )
        feld = _ANLASS_GEBUEHREN.get(art)
        if feld is not None and (zu_decimal((anlass or {}).get(feld)) or 0) <= 0:
            continue
        out.append((art, _fee_betrag(fee, naechte)))
    return out


def _anreise(anlass: dict[str, Any] | None) -> date | None:
    """Anreisetag der Reservierungszeile, oder ``None`` ohne lesbares Datum."""
    roh = (anlass or {}).get("check_in")
    if not roh:
        return None
    try:
        return date.fromisoformat(str(roh)[:10])
    except ValueError:
        return None


def _airbnb_reservierung(raw: object) -> dict[str, Any] | None:
    """Airbnbs Original-Reservierung aus dem Payload schälen.

    Eigene Funktion, weil das AUSPACKEN (mehrere Ebenen, teils als JSON-String
    eingebettet) nichts mit der fachlichen Bewertung zu tun hat. Jede Ebene, die
    fehlt oder anders aussieht als erwartet, ergibt ``None`` — „dieser Payload
    ist kein Airbnb-Feed", nicht „es gab keine Werte".
    """
    if not isinstance(raw, dict):
        return None
    nachricht = raw.get("raw_message")
    if not nachricht:
        return None
    if isinstance(nachricht, str):
        try:
            nachricht = json.loads(nachricht)
        except (ValueError, TypeError):
            return None
    if not isinstance(nachricht, dict):
        return None
    reservierung = nachricht.get("reservation")
    return reservierung if isinstance(reservierung, dict) else None


def _gebuehren_posten(raw: object) -> list[object] | None:
    """Airbnbs ``standard_fees_details`` aus dem Payload schälen."""
    reservierung = _airbnb_reservierung(raw)
    if reservierung is None:
        return None
    posten = reservierung.get("standard_fees_details")
    return posten if isinstance(posten, list) else None


def airbnb_uebernachtung(raw: object) -> Decimal | None:
    """Airbnbs REINEN Übernachtungsbetrag (``base_price`` + Zusatzgast).

    DER WICHTIGSTE WERT DIESES MODULS, und der am leichtesten zu verwechselnde:
    ``total_amount`` einer Airbnb-Buchung ist ``payout_amount`` — die Auszahlung
    NACH Abzug der Portal-Provision. Wer ihn als Übernachtungspreis liest, zieht
    die 15,5 % ein zweites Mal ab und weist dem Eigentümer eine zu kleine
    Auszahlung aus, die plausibel aussieht.

    An 22/22 Live-Buchungen des Beta-Betriebs nachgerechnet (11.08.2026),
    ausnahmslos und ohne einen Cent Abweichung::

        base_price + extra_guest_fee + standard_fees_details
          − host_fee_base = payout_amount = total_amount

    Der so gebildete Bruttopreis ergibt zugleich die Provision als konstant
    15,50 % — dieselbe Zahl an allen 22 Buchungen. Auf ``payout_amount`` bezogen
    streute derselbe Abzug scheinbar zwischen 12,34 % und 17,02 %; genau diese
    Streuung war das Symptom des falschen Bezugs.

    ``extra_guest_fee`` gehört zum Übernachtungspreis und NICHT zu den
    ``standard_fees_details``: er ist ein Aufschlag auf die Unterkunft, keine
    separat vereinbarte Gebühr, und ist deshalb voll provisionspflichtig. Im
    Bestand ist er durchgehend 0,00 — er wird trotzdem addiert, weil eine
    Buchung mit Zusatzgast sonst still zu niedrig ausgewiesen würde.

    ``None`` heißt „kein Airbnb-Feed-Payload" — dann gilt ``total_amount``.
    """
    reservierung = _airbnb_reservierung(raw)
    if reservierung is None:
        return None
    basis = zu_decimal(reservierung.get("base_price"))
    if basis is None:
        # Ein Airbnb-Payload OHNE base_price wäre ein unbekanntes Format. Auf
        # `total_amount` zurückzufallen wäre hier besonders gefährlich, weil das
        # bei Airbnb nachweislich der Netto-Payout ist — die Provision würde
        # doppelt abgezogen, ohne dass es auffällt.
        raise PayoutUnbekannt(
            "betrag",
            "Airbnb-Buchung ohne „base_price“ — der Übernachtungsbetrag ist "
            "damit unbekannt, und der Gesamtbetrag ist bei Airbnb bereits die "
            "Auszahlung nach Provision.",
        )
    return basis + (zu_decimal(reservierung.get("extra_guest_fee")) or Decimal("0"))


def ota_gebuehren(raw: object) -> list[tuple[str, Decimal]] | None:
    """Die vom PORTAL gemeldeten Gebühren, oder ``None`` wenn es keine meldet.

    ``None`` und „leere Liste" sind verschiedene Aussagen: ``None`` heißt „das
    Portal meldet keine Gebühren, nimm die Stammdaten" (Booking.com), eine leere
    Liste heißt „das Portal hat gemeldet, dass keine anfielen". Nur so bleibt
    unterscheidbar, ob die Stammdaten einspringen dürfen.

    Gelesen wird Airbnbs ``standard_fees_details`` aus der Original-Nachricht.
    Ein unbekannter Gebührentyp wirft — er stillschweigend zu überspringen
    verlöre einen Betrag, den der Gast bezahlt hat.
    """
    posten = _gebuehren_posten(raw)
    if posten is None:
        return None
    out: list[tuple[str, Decimal]] = []
    for p in posten:
        if not isinstance(p, dict):
            continue
        roh_art = str(p.get("fee_type") or "").strip()
        art = _AIRBNB_ARTEN.get(roh_art)
        if art is None:
            raise PayoutUnbekannt(
                "gebuehr_nicht_zugeordnet",
                f"Unbekannte Gebührenart „{roh_art}“ aus dem Portal-Feed.",
            )
        betrag = zu_decimal(p.get("amount"))
        if betrag is None:
            raise PayoutUnbekannt(
                "gebuehr_nicht_berechenbar",
                f"Portal-Gebühr „{roh_art}“ ohne Betrag.",
            )
        out.append((art, betrag))
    return out


def _minor_betrag(posten: dict[str, Any], art: str) -> Decimal:
    """Bookings Minor-Units-Betrag in einen echten Betrag wandeln.

    Booking liefert ``amount`` als Ganzzahl-String plus ``decimal_places``:
    ``{"amount": "107500", "decimal_places": 2}`` sind 1.075,00 DKK. Ohne die
    Division wären es das Hundertfache — eine Reinigungsgebühr von 107.500 DKK,
    die jede Auszahlung ins Negative zieht. Derselbe Faktor-Fehler wie bei
    Airbnbs Mikro-Einheiten, nur an einem anderen Portal.

    ``decimal_places`` wird NICHT auf 2 defaulted: fehlt es, ist die Skala des
    Betrags unbekannt, und eine geratene Skala verschiebt das Komma (Wurzel 4).
    Währungen ohne Nachkomma (JPY, ISK) liefern hier legitim 0.
    """
    roh = posten.get("amount")
    stellen = posten.get("decimal_places")
    if roh is None or stellen is None:
        raise PayoutUnbekannt(
            "gebuehr_nicht_berechenbar",
            f"Portal-Gebühr „{art}“ ohne Betrag oder ohne Nachkommastellen — "
            "die Größenordnung des Betrags ist damit unbestimmt.",
        )
    try:
        skala = int(stellen)
    except (TypeError, ValueError) as exc:
        raise PayoutUnbekannt(
            "gebuehr_nicht_berechenbar",
            f"Portal-Gebühr „{art}“ mit unlesbaren Nachkommastellen "
            f"„{stellen}“.",
        ) from exc
    if skala < 0:
        raise PayoutUnbekannt(
            "gebuehr_nicht_berechenbar",
            f"Portal-Gebühr „{art}“ mit negativen Nachkommastellen {skala}.",
        )
    betrag = zu_decimal(roh)
    if betrag is None:
        raise PayoutUnbekannt(
            "gebuehr_nicht_berechenbar",
            f"Portal-Gebühr „{art}“ ohne Betrag.",
        )
    return betrag / (Decimal(10) ** skala)


def booking_aufgeloeste_posten(raw: object) -> list[tuple[str, Decimal]] | None:
    """Bookings Gebühren aus ``rooms[].taxes`` — der AUFGELÖSTEN Aufstellung.

    DIE BESSERE VON ZWEI STELLEN, und sie lag von Anfang an im gespeicherten
    Payload. Channex liefert dieselben Gebühren zweimal, und wir lasen bis
    11.08.2026 die schlechtere Fassung::

        rooms[].meta.price_details.guest_view.taxes   (was wir lasen)
          {"amount": "22500", "decimal_places": 2, "charge_frequency": 19,
           "tax_description": "Resortgebühr", "type": "Inclusive"}

        rooms[].taxes                                 (was daneben lag)
          {"total_price": "225.00", "price_per_unit": "25.00",
           "price_mode": "Per night", "nights": 9, "persons": 2,
           "name": "Resortgebühr", "is_inclusive": false}

    Drei Rateschritte fallen damit weg: die Minor-Units-Division, das Ableiten
    der Berechnungsart aus ``charge_frequency`` (19/12 als Zahlencode), und die
    Frage, ob der Posten im Gesamtbetrag steckt — ``is_inclusive`` sagt es
    direkt, während ``type: "Inclusive"`` an derselben Gebühr das GEGENTEIL
    suggeriert (beide Posten sind laut ``charge_periods`` ``excluded``, und die
    Summen gehen nur auf, wenn man sie addiert).

    ``price_mode``/``price_per_unit``/``nights`` werden NICHT zum Rechnen
    benutzt: ``total_price`` ist der fertige Betrag für den Aufenthalt (an
    beiden Live-Buchungen geprüft, 25,00 × 9 = 225,00). Sie sind der Beleg, wie
    das Portal auf die Summe kam — deshalb wandert ``price_mode`` in die
    Bezeichnungen, statt verworfen zu werden.

    ACHTUNG, DIE FALLE: ``rooms[].taxes`` ist bei AIRBNB ebenfalls vorhanden,
    dort aber immer LEER (22/22 geprüft) — Airbnbs Gebühren stehen einzig in
    ``raw_message.reservation.standard_fees_details``. Als blinder Erstleser
    verstünde diese Funktion die leere Liste als „keine Gebühren angefallen" und
    brächte jede Airbnb-Buchung um ihre Reinigung. Darum zwei Vorkehrungen:
    ``gebuehren_der_buchung`` fragt Airbnb ZUERST, und eine leere Liste gilt hier
    nur dann als Aussage, wenn ``meta.price_details`` daneben liegt (das trägt
    ausschließlich Booking).

    ``None`` heißt „diese Stelle ist nicht die Quelle dieser Buchung".
    """
    if not isinstance(raw, dict):
        return None
    zimmer = raw.get("rooms")
    if not isinstance(zimmer, list):
        return None

    out: list[tuple[str, Decimal]] = []
    gefunden = False
    for z in zimmer:
        if not isinstance(z, dict):
            continue
        posten = z.get("taxes")
        if not isinstance(posten, list):
            continue
        if not posten and not _hat_booking_preisdetails(z):
            # Leer UND ohne Booking-Preisdetails daneben: das ist der
            # Airbnb-Fall. Die Stelle existiert, ist aber nicht die Quelle.
            continue
        gefunden = True
        # Die sprachneutralen Schlüssel DIESES Zimmers, als Auffangnetz für
        # Anzeigenamen in einer Sprache, die die Namensliste nicht kennt.
        schluessel = _booking_schluessel_arten(z)
        for p in posten:
            if not isinstance(p, dict):
                continue
            text = str(p.get("name") or "").strip()
            if _ist_booking_steuer(p):
                # Steuer, keine Gebühr — gehört nicht in die Auszahlung des
                # Eigentümers. Übersprungen statt gemeldet: eine korrekt
                # gelieferte Steuerzeile ist kein unbekannter Posten.
                continue
            art = _BOOKING_ARTEN.get(text.casefold())
            if art is None:
                # Zweite Stufe: aus `charge_periods`. Greift NUR, wenn dort
                # genau EINE Art in Frage kommt — bei mehreren wäre die
                # Zuordnung zum einzelnen Posten geraten (die beiden Listen sind
                # nicht positionsgleich: live gemessen an FeWo Lille Lægehus,
                # 3 Anzeigenamen gegen 1 Schlüssel).
                nur_gebuehren = [a for a in schluessel if a not in _STEUER_ARTEN]
                art = nur_gebuehren[0] if len(nur_gebuehren) == 1 else None
                if art is not None:
                    # Der Name ist neu, die Art geklärt: gehört in
                    # `_BOOKING_ARTEN` nachgetragen, damit die Zuordnung nicht
                    # dauerhaft am Auffangnetz hängt.
                    log.info(
                        "booking_gebuehr_name_unbekannt_schluessel_half",
                        anzeigename=text,
                        art=art,
                        schluessel=sorted(schluessel),
                    )
            if art is None:
                # DRITTE STUFE: die Gebühr trotzdem aufnehmen, unter einer aus
                # ihrem Namen abgeleiteten Art (`portal:<text>`).
                #
                # Warum nicht weiter abweisen: der Anzeigename kommt in der
                # Sprache des INSERATS, und weder Booking noch Channex
                # dokumentieren die vollständige Liste der Arten. Eine feste
                # Namensliste ist deshalb prinzipiell unvollständig — jede neue
                # Sprache und jede neue Gebührenart hätte die Abrechnung des
                # Eigentümers erneut blockiert (live: „Mehrwertsteuer (25%)" bei
                # Rævehulen, „Rengøringsgebyr" bei jedem dänischen Inserat).
                #
                # Der Betrag ist dabei NICHT geraten — er steht als
                # `total_price` im Payload. Unbekannt ist nur die Kategorie, und
                # die muss der Betrieb ohnehin für JEDE Art einmal zuordnen
                # („Wem gehören die Gebühren?", siehe `gebuehren_zuordnen`).
                # Ein unbekannter Posten landet damit im dafür vorgesehenen
                # Prozess, statt die ganze Abrechnung zu verhindern — und er
                # bleibt sichtbar, weil er unter seinem Originaltext steht.
                art = f"portal:{text.casefold()}" if text else "portal:unbenannt"
                # WARNUNG, nicht info: hier ist eine Art angekommen, die weder
                # die Namensliste noch Bookings Schlüssel auflösen konnten. Der
                # Betrag stimmt und die Abrechnung läuft, aber die Kategorie
                # ist offen — jemand muss nachsehen, was das Portal da schickt.
                # Ohne diese Zeile wäre das Auffangnetz ein stiller Sammler
                # (Wurzel 5: nichts verschlucken).
                log.warning(
                    "portal_gebuehrenart_unbekannt",
                    portal="BookingCom",
                    anzeigename=text or "(ohne Namen)",
                    typ=str(p.get("type") or ""),
                    preismodus=str(p.get("price_mode") or ""),
                    schluessel=sorted(schluessel),
                    art=art,
                )
            betrag = zu_decimal(p.get("total_price"))
            if betrag is None:
                raise PayoutUnbekannt(
                    "gebuehr_nicht_berechenbar",
                    f"Portal-Gebühr „{text}“ ohne Gesamtbetrag.",
                )
            out.append((art, betrag))
    return out if gefunden else None


def _ist_booking_steuer(posten: dict[str, Any]) -> bool:
    """Ist dieser Posten aus ``rooms[].taxes`` eine STEUER statt einer Gebühr?

    Entschieden am strukturierten ``type``-Feld, nicht am Anzeigenamen: der Typ
    ist Bookings eigene Bezeichnung („Value Added Tax (VAT)", „Service Charge")
    und damit sprachneutral, während der Name in der Sprache des Inserats kommt.

    ACHTUNG, live gemessen: bei der Haustiergebühr steht der ANZEIGENAME im
    Typ-Feld („Haustiergebühr"). Ein unbekannter Typ gilt deshalb NICHT als
    Steuer — nur die ausdrücklich bekannten Steuertypen zählen (fail-closed in
    die sichere Richtung: im Zweifel Gebühr, die wird zugeordnet und fällt bei
    einem Fehler auf, statt still aus der Abrechnung zu verschwinden).
    """
    typ = str(posten.get("type") or "").strip().casefold()
    return typ in _BOOKING_STEUER_TYPEN


def _booking_schluessel_arten(zimmer: dict[str, Any]) -> list[str]:
    """Die Gebührenarten aus ``meta.charge_periods`` — sprachneutral.

    ``excluded`` wird NICHT als Filter benutzt, und das ist eine Korrektur:

    ``excluded: true`` heißt „nicht im ZIMMERPREIS enthalten", also ein
    eigener Posten OBENDRAUF — nicht „wird nicht erhoben". Genau so steht es
    auch in ``booking_gebuehren_zeitraeume`` unten; diese Funktion deutete es
    bis 03.09.2026 umgekehrt und ÜBERSPRANG jede Art mit ``excluded: true``.

    Der Beleg ist die Channex-Buchungsansicht von BDC-5522296055, wo beide
    ``excluded: true``-Posten dem Gast berechnet werden::

        Subtotal              DKK 3.937,50   ← Nächte
        Reinigungsgebühr      DKK   795,00   ← excluded: true
        Stromkosten           DKK   125,00   ← excluded: true
        Rate Included:
        Mehrwertsteuer (25%)                 ← excluded: false

    Umgekehrt ist ``excluded: false`` das, was Booking als „Rate Included"
    ausweist. Über alle 788 Payloads variiert der Wert je Buchung DERSELBEN Art
    (``CLEANINGFEE`` 30× true / 5× false, ``RESORTFEE`` 27× true / 5× false) —
    er beschreibt also die Lage in DIESER Buchung, keine Objekt-Einstellung.

    Weil beide Lagen dem Gast berechnet werden, gehören beide in die Liste:
    welche Gebühr angefallen ist, sagt die Buchung selbst über ``taxes``. Das
    Auffangnetz wird davon nicht mehrdeutig — es greift erst, wenn eine Art
    über KEINEN der drei Wege bestimmbar ist.
    """
    perioden = (zimmer.get("meta") or {}).get("charge_periods")
    if not isinstance(perioden, dict):
        return []
    out: list[str] = []
    for schluessel in perioden:
        art = _BOOKING_SCHLUESSEL_ARTEN.get(str(schluessel).strip().upper())
        if art is None or art in out:
            continue
        out.append(art)
    return out


def portal_posten(
    raw: object,
) -> tuple[list[tuple[str, Decimal]], dict[str, str]] | None:
    """Die vom Portal gemeldeten Gebühren — DIE EINE Leser-Reihenfolge.

    Drei Stellen im Code brauchten dieselbe Kette und hatten sie dreimal
    nachgebaut (Auszahlung, Gebühren-Nachweis, Quote-Positionen). Als
    ``rooms[].taxes`` als neue erste Stelle dazukam, hätte man sie an drei Orten
    einfügen müssen — und eine übersehen. Genau so entstehen zwei Zahlen für
    dasselbe Geld.

    Reihenfolge und ihre Begründung stehen in der Payload-Karte oben im Modul:
    Airbnb ZUERST (weil ``rooms[].taxes`` bei Airbnb existiert und leer ist),
    dann Bookings aufgelöste Aufstellung, dann Bookings Minor-Units-Fassung.

    Rückgabe ``(posten, bezeichnungen)`` oder ``None``, wenn keine Stelle die
    Quelle dieser Buchung ist. ``None`` und ``([], {})`` sind verschiedene
    Aussagen — siehe ``ota_gebuehren``.
    """
    posten = ota_gebuehren(raw)
    if posten is not None:
        return posten, {}
    posten = booking_aufgeloeste_posten(raw)
    if posten is not None:
        return posten, booking_aufgeloeste_bezeichnungen(raw)
    posten = booking_gebuehren(raw)
    if posten is not None:
        return posten, booking_bezeichnungen(raw)
    return None


def _hat_booking_preisdetails(zimmer: dict[str, Any]) -> bool:
    """Trägt DIESES Zimmer Bookings Preisdetails?

    Das Unterscheidungsmerkmal zwischen „leere Gebührenliste = keine Gebühren"
    (Booking) und „leere Gebührenliste = falsche Stelle" (Airbnb). Live geprüft:
    ``price_details`` gibt es ausschließlich bei Booking-Buchungen mit
    Aufstellung, bei keiner der 22 Airbnb-Buchungen.

    BEIDE Lagen, wie in ``_booking_posten``: direkt am Zimmer (so kommen alle
    37 Aufstellungen im Live-Bestand) und unter ``meta`` (XML-Fassung des
    Aggregators). Nur ``meta`` zu prüfen hiess: bei jeder echten
    Booking-Buchung ``False`` — und damit wurde eine leere ``taxes``-Liste als
    „falsche Stelle" gelesen, worauf die Stammdaten einsprangen.
    """
    if isinstance(zimmer.get("price_details"), dict):
        return True
    meta = zimmer.get("meta")
    if not isinstance(meta, dict):
        return False
    return isinstance(meta.get("price_details"), dict)


def booking_aufgeloeste_bezeichnungen(raw: object) -> dict[str, str]:
    """Originaltext PLUS Berechnungsart je Gebührenart, aus ``rooms[].taxes``.

    ``„Resortgebühr (Per night)"`` statt nur ``„Resortgebühr"``: bei einer
    Rückfrage zur Abrechnung ist die zweite Frage immer, wie das Portal auf die
    Summe kam. Die Angabe steht im Payload und wäre sonst verworfen.

    Die Arten werden GENAUSO aufgelöst wie in ``booking_aufgeloeste_posten`` —
    inklusive der unbekannten (``portal:<text>``). Täte sie das nicht, stünde
    ausgerechnet an dem Posten, dessen Art wir nicht kennen, kein Klartext auf
    der Rechnung; der Originaltext des Portals ist dort aber die einzige
    Information, die der Betrieb zum Zuordnen hat.
    """
    if not isinstance(raw, dict):
        return {}
    zimmer = raw.get("rooms")
    if not isinstance(zimmer, list):
        return {}
    out: dict[str, str] = {}
    for z in zimmer:
        if not isinstance(z, dict):
            continue
        posten = z.get("taxes")
        if not isinstance(posten, list):
            continue
        schluessel = [
            a for a in _booking_schluessel_arten(z) if a not in _STEUER_ARTEN
        ]
        for p in posten:
            if not isinstance(p, dict):
                continue
            text = str(p.get("name") or "").strip()
            if not text or _ist_booking_steuer(p):
                continue
            art = _BOOKING_ARTEN.get(text.casefold())
            if art is None:
                art = schluessel[0] if len(schluessel) == 1 else None
            if art is None:
                art = f"portal:{text.casefold()}"
            modus = str(p.get("price_mode") or "").strip()
            out[art] = f"{text} ({modus})" if modus else text
    return out


def _booking_posten(raw: object) -> list[object] | None:
    """Bookings Gebührenposten aus ``meta.price_details`` — die ZWEITE Stelle.

    Fallback hinter ``booking_aufgeloeste_posten``. Sie bleibt, weil sie in
    Bookings XML-Nachricht ein zweites Mal auftaucht (``RoomStays…PriceDetails``,
    inhaltlich identisch) und damit belegt das Format der Aggregators; fiele
    ``rooms[].taxes`` einmal aus, wäre die Aufstellung sonst verloren.

    ALLE Zimmer, nicht nur das erste: eine Buchung kann mehrere Zimmer eines
    Typs enthalten, und jedes trägt seine eigene Aufstellung. Nur ``rooms[0]``
    zu lesen verlöre die Gebühren der übrigen — ein Fehler, der bei den heutigen
    Einzelzimmer-Buchungen unsichtbar bliebe und erst bei der ersten
    Mehrzimmer-Buchung Geld verschiebt.

    ``None`` heißt „dieser Payload trägt keine Aufstellung" (die 51 Altimporte),
    nicht „es gab keine Gebühren".
    """
    if not isinstance(raw, dict):
        return None
    zimmer = raw.get("rooms")
    if not isinstance(zimmer, list):
        return None
    gefunden = False
    out: list[object] = []
    for z in zimmer:
        if not isinstance(z, dict):
            continue
        # ZWEI Lagen, weil Booking beide liefert: `price_details` steht DIREKT
        # am Zimmer (so kommen alle 37 Aufstellungen im Live-Bestand,
        # gemessen 03.09.2026) und in der XML-Fassung des Aggregators unter
        # `meta`. Bis 03.09.2026 wurde NUR `meta` gelesen — dort liegt live
        # nichts, und damit hat dieser Leser noch nie eine Booking-Aufstellung
        # gefunden: `booking_gebuehren` gab `None` zurueck, was „traegt keine
        # Aufstellung" heisst. Die Zeile zeigte „Keine Gebuehren", obwohl der
        # Payload 795 DKK Reinigung und 125 DKK Strom trug.
        #
        # Direkt zuerst: das ist die Form, die der Feed heute schickt.
        details = z.get("price_details")
        if not isinstance(details, dict):
            meta = z.get("meta")
            details = meta.get("price_details") if isinstance(meta, dict) else None
        if not isinstance(details, dict):
            continue
        sicht = details.get("guest_view")
        if not isinstance(sicht, dict):
            continue
        posten = sicht.get("taxes")
        if not isinstance(posten, list):
            continue
        # Ab hier steht fest: der Payload TRÄGT eine Aufstellung. Eine leere
        # Liste ist dann die Aussage „keine Gebühren angefallen" und darf nicht
        # als „keine Aufstellung" gelesen werden — sonst sprängen die
        # Stammdaten ein und erfänden Gebühren, die der Gast nie gezahlt hat.
        gefunden = True
        out.extend(posten)
    return out if gefunden else None


def booking_naechte_summe(raw: object) -> Decimal | None:
    """Die Summe der Tagespreise aus Bookings ``rooms[].days``.

    Der REINE Übernachtungsbetrag einer Booking-Buchung. Er ist nötig, weil
    ``total_amount`` dort der Gastpreis inklusive Gebühren ist — die Aufteilung
    „Übernachtung / Gebühren" ist ohne diese Summe nicht darstellbar, und die
    Abrechnung weist beide Zeilen getrennt aus.

    Live bei allen 55 Booking-Buchungen vorhanden. Sie geht mit den Gebühren
    exakt auf den Gesamtbetrag auf (3/3 mit Aufstellung: 10.795 + 1.300 = 12.095,
    2.082,50 + 1.125 = 3.207,50, 1.150 + 150 = 1.300) und bei den 51 Altimporten
    ohne Gebühren direkt auf ``total_amount`` — die eine Ausnahme ist eine
    stornierte Buchung, deren Betrag auf 0,00 gesetzt wurde, während die
    Tagespreise stehen blieben.

    ALLE Zimmer, aus demselben Grund wie in ``_booking_posten``.
    """
    if not isinstance(raw, dict):
        return None
    zimmer = raw.get("rooms")
    if not isinstance(zimmer, list):
        return None
    gefunden = False
    summe = Decimal("0")
    for z in zimmer:
        if not isinstance(z, dict):
            continue
        tage = z.get("days")
        if not isinstance(tage, dict):
            continue
        for wert in tage.values():
            betrag = zu_decimal(wert)
            if betrag is None:
                # Ein unlesbarer Tagespreis macht die SUMME unbrauchbar — sie
                # wäre zu niedrig, und eine zu niedrige Übernachtung schöbe den
                # Rest still in die Gebühren.
                return None
            summe += betrag
            gefunden = True
    return summe if gefunden else None


def booking_gebuehren(raw: object) -> list[tuple[str, Decimal]] | None:
    """Die von Booking.com gemeldeten Gebühren, oder ``None`` ohne Aufstellung.

    Der Betrag steht im Payload schon FERTIG SUMMIERT für den Aufenthalt — die
    Resortgebühr erscheint bei 2 Nächten als 50,00 und bei 9 Nächten als 225,00
    (25,00/Nacht, live an beiden Buchungen geprüft). ``charge_frequency`` (19 =
    je Nacht, 12 = je Aufenthalt) ist deshalb nur eine Auskunft und wird hier
    NICHT zum Multiplizieren benutzt: das würde den Betrag ein zweites Mal mit
    den Nächten hochrechnen.

    ``type: "Inclusive"`` steht an allen Posten, heißt hier aber nicht „im
    Tagespreis enthalten": ``charge_periods`` markiert beide Gebühren als
    ``excluded: true``, und die Summen gehen nur auf, wenn man sie zu den
    Tagespreisen ADDIERT (10.795 + 225 + 1.075 = 12.095 = Gesamtbetrag). Der
    Gesamtbetrag der Buchung enthält sie also, die Tagespreise nicht.
    """
    posten = _booking_posten(raw)
    if posten is None:
        return None
    out: list[tuple[str, Decimal]] = []
    for p in posten:
        if not isinstance(p, dict):
            continue
        text = str(p.get("tax_description") or "").strip()
        # Abgaben (Kurtaxe, Umweltabgabe) sind durchlaufende Posten und keine
        # Gebühr des Betriebs — sie gehören nicht in die Eigentümer-Auszahlung
        # und brauchen deshalb auch keine Zuordnung. Übersprungen statt
        # gemeldet: eine korrekt gelieferte Abgabe ist kein offener Punkt.
        if text.casefold() in _BOOKING_ABGABEN_NAMEN:
            continue
        # Steuern: durchlaufende Posten, kein Ertrag des Eigentuemers. Am
        # NAMEN erkannt (siehe `_BOOKING_STEUER_NAMEN`) — `type` ist bei allen
        # Posten „Inclusive" und unterscheidet nichts. Zusaetzlich das
        # `type`-Feld, weil Bookings XML-Fassung dort echte Steuerarten fuehrt.
        klein = text.casefold()
        if klein.startswith(_BOOKING_STEUER_NAMEN):
            continue
        if str(p.get("type") or "").strip().casefold() in _BOOKING_STEUER_TYPEN:
            continue
        art = _BOOKING_ARTEN.get(text.casefold())
        if art is None:
            raise PayoutUnbekannt(
                "gebuehr_nicht_zugeordnet",
                f"Unbekannte Gebührenart „{text or '?'}“ aus der "
                "Booking.com-Preisaufstellung. Booking bietet im Extranet eine "
                "feste Liste an (Unterkunft → Richtlinien → Weitere Gebühren); "
                "steht die Art dort und fehlt hier, gehört sie in "
                "`_BOOKING_ARTEN` nachgetragen.",
            )
        out.append((art, _minor_betrag(p, text)))
    return out


# Re-Export: fachlich gehören beide hierher, sie liegen aus Zeilengründen in
# `booking_leser` (siehe dortigen Kopf). Aufrufer haben so EINE Adresse.


def booking_bezeichnungen(raw: object) -> dict[str, str]:
    """Der Originaltext des Portals je erkannter Gebührenart.

    Getrennt von ``booking_gebuehren``, damit die Betragsermittlung nicht mit dem
    Aufbewahren der Herkunft vermischt wird. Ein Text ohne bekannte Art
    erscheint hier nicht — er hat die Betragsermittlung bereits abgebrochen.
    """
    posten = _booking_posten(raw)
    if posten is None:
        return {}
    out: dict[str, str] = {}
    for p in posten:
        if not isinstance(p, dict):
            continue
        text = str(p.get("tax_description") or "").strip()
        if text.casefold() in _BOOKING_ABGABEN_NAMEN:
            continue
        art = _BOOKING_ARTEN.get(text.casefold())
        if art and text:
            out[art] = text
    return out


# Bookings interne Gebührenschlüssel in ``meta.charge_periods`` auf unsere Arten.
# Anders als ``tax_description`` ist dieser Schlüssel NICHT sprachabhängig — er
# ist deshalb die verlässlichere Kennung, taucht aber nur in den Zeiträumen auf,
# nicht an den Posten selbst.
_BOOKING_ZEITRAUM_ARTEN = {
    "CLEANINGFEE": "cleaning_fee",
    "RESORTFEE": "resort",
    "PETFEE": "pet_fee",
    "LINENFEE": "linens",
}


def booking_gebuehren_zeitraeume(raw: object) -> dict[str, list[dict[str, Any]]]:
    """AB WANN eine Gebühr am Inserat gilt — aus ``meta.charge_periods``.

    Der Payload sagt es selbst, und wir haben es ein halbes Jahr nicht gelesen::

        "charge_periods": {
          "CLEANINGFEE": [{"excluded": true, "from": "2026-08-04", "to": null}],
          "RESORTFEE":   [{"excluded": true, "from": "2026-08-04", "to": null}]
        }

    Damit ist belegbar, was vorher nur zu vermuten war: eine Gebühr, die am
    Objekt gepflegt ist, gilt beim Portal erst ab einem Datum. Eine Buchung von
    vorher hat sie nicht bezahlt — und darf sie in der Abrechnung nicht tragen.
    Genau diese Frage kostete am 11.08.2026 eine halbe Sitzung: 151 Resort-Posten
    über 20.950 DKK waren aus Objekt-Stammdaten erzeugt, obwohl das Portal sie an
    den betroffenen Buchungen nie erhoben hatte.

    ``excluded: true`` heißt „nicht im Zimmerpreis enthalten", also ein eigener
    Posten — passend zu ``is_inclusive: false`` an der Gebühr selbst.

    Die Angabe wird hier nur AUSGELESEN, nicht gegen den Buchungszeitraum
    geprüft: welche Gebühr angefallen ist, sagt die Buchung selbst (``taxes``).
    Der Zeitraum ist der Beleg dafür, WARUM sie an einer älteren Buchung fehlt —
    und beantwortet damit die Rückfrage, die sonst als Rechenfehler gilt.

    Rückgabe: unsere Gebührenart → Liste der Zeiträume. Unbekannte Schlüssel
    werden übersprungen (sie kosten kein Geld, ihr Fehlen bricht nichts).
    """
    if not isinstance(raw, dict):
        return {}
    zimmer = raw.get("rooms")
    if not isinstance(zimmer, list):
        return {}
    out: dict[str, list[dict[str, Any]]] = {}
    for z in zimmer:
        if not isinstance(z, dict):
            continue
        meta = z.get("meta")
        if not isinstance(meta, dict):
            continue
        perioden = meta.get("charge_periods")
        if not isinstance(perioden, dict):
            continue
        for schluessel, spannen in perioden.items():
            art = _BOOKING_ZEITRAUM_ARTEN.get(str(schluessel).strip().upper())
            if art is None or not isinstance(spannen, list):
                continue
            for s in spannen:
                if isinstance(s, dict):
                    out.setdefault(art, []).append(s)
    return out


def klassifikation_laden(
    db: Client, tenant_id: str
) -> dict[tuple[str, str | None], tuple[str, bool]]:
    """Die Gebühren-Zuordnungen des Betriebs als Nachschlagekarte.

    Schlüssel ``(fee_type, property_id | None)`` — ``None`` ist die
    Betriebsregel, ein gesetztes Objekt die Ausnahme. Einmal je Auswertung
    geladen, nicht je Buchung: bei 30 Kalendertagen wären das sonst 30
    identische Abfragen.
    """
    rows = (
        db.table("fee_classification")
        .select("fee_type, property_id, gehoert_zu, provisionspflichtig")
        .eq("tenant_id", tenant_id)
        .execute()
    ).data or []
    out: dict[tuple[str, str | None], tuple[str, bool]] = {}
    for r in rows:
        art = str(r.get("fee_type") or "")
        pid = str(r["property_id"]) if r.get("property_id") else None
        out[(art, pid)] = (
            str(r.get("gehoert_zu") or ""),
            bool(r.get("provisionspflichtig")),
        )
    return out


def gebuehren_der_buchung(
    *,
    raw: object,
    type_attributes: dict[str, Any] | None,
    naechte: int,
    klassifikation: dict[tuple[str, str | None], tuple[str, bool]],
    property_id: str,
    reservierung: dict[str, Any] | None = None,
    csv_muster: str | None = None,
) -> GebuehrenBefund:
    """Die Gebühren EINER Buchung — Portal-Meldung vor Objekt-Stammdaten.

    ``csv_muster`` („im_betrag" | „obendrauf" | None) ist das je Objekt
    gelernte Verhalten des Portals für CSV-Buchungen ohne Channex-Zwilling
    (`payloads.csv_muster_je_objekt`). None = Vorgabe des Betriebs: „im_betrag".

    Der eine Eingang für alle drei Verbraucher. Reihenfolge der Quellen ist
    nicht beliebig: was das Portal gemeldet hat, wurde dem Gast wirklich
    berechnet; die Stammdaten sagen nur, was berechnet werden SOLLTE.

    ``reservierung`` ist die Buchungszeile. Sie wird NUR im Stammdaten-Rückfall
    gebraucht, dort aber zwingend: sie entscheidet, welche der gepflegten
    Gebühren bei DIESER Buchung überhaupt anfiel (siehe ``objekt_gebuehren``).
    Ohne sie fallen Zusatzleistungen weg — das ist die vorsichtige Richtung, die
    kein Geld erfindet.

    Die drei Fälle werden AM PAYLOAD erkannt, nicht am Kanalnamen. Das ist
    absichtlich: der Kanalname sagt nichts darüber, ob eine Buchung aus dem
    Live-Feed kam oder ein Altimport ist — beide tragen ``BookingCom``, aber nur
    der Feed liefert die Aufstellung. Eine Regel „Kanal == Booking → brutto"
    rechnete die 51 Altimporte falsch.

    Reihenfolge der Prüfung: Airbnb, dann Booking, dann Stammdaten. Die ersten
    zwei schließen sich in den Echtdaten aus (kein Payload trägt beides), die
    Reihenfolge ist also nur eine Festlegung für den hypothetischen Fall, dass
    ein Portal eines Tages beides mitschickt — dann gilt die spezifischere
    Airbnb-Struktur.
    """
    airbnb_posten = ota_gebuehren(raw)
    if airbnb_posten is not None:
        return GebuehrenBefund(
            gebuehren=gebuehren_zuordnen(
                airbnb_posten, klassifikation, property_id
            ),
            im_gesamtpreis=False,
            quelle="ota",
            # Der Kern: bei Airbnb ist `total_amount` der Netto-Payout, nicht
            # der Übernachtungsbetrag. Siehe `airbnb_uebernachtung`.
            uebernachtung=airbnb_uebernachtung(raw),
        )
    # Booking: aufgelöste Aufstellung, dann Minor-Units-Fassung. Die Reihenfolge
    # steht in `portal_posten`, damit sie nicht an jeder Stelle neu entschieden
    # wird.
    gefunden = portal_posten(raw)
    if gefunden is not None:
        posten, bezeichnungen = gefunden
        return GebuehrenBefund(
            gebuehren=gebuehren_zuordnen(posten, klassifikation, property_id),
            im_gesamtpreis=True,
            quelle="ota",
            bezeichnungen=bezeichnungen,
        )
    ist_csv = _ist_csv_portalbuchung(reservierung)
    ist_import = _ist_portalbuchung(raw) and _stammdaten_grund(raw) == "channex_import"
    if ist_csv or ist_import:
        # Portal-Buchung OHNE Aufstellung (CSV-Bestandsimport, Channex-Import):
        # die Gebühren kommen aus den Objekt-Stammdaten — Ansage des Betriebs
        # vom 02.09.2026: „so wie sie in jedem Objekt hinterlegt sind". Ob sie
        # im Betrag stecken oder obendrauf kommen, sagen die Fakten (Zwilling)
        # oder das Muster des Hauses. Siehe `_portal_gebuehren_aus_stammdaten`.
        return _portal_gebuehren_aus_stammdaten(
            raw=raw,
            type_attributes=type_attributes,
            naechte=naechte,
            klassifikation=klassifikation,
            property_id=property_id,
            reservierung=reservierung,
            csv_muster=csv_muster,
            grund_ohne_gebuehren="csv_import" if ist_csv else "channex_import",
        )
    if _ist_portalbuchung(raw):
        # KEIN Stammdaten-Ersatz für eine Portal-Buchung. Was das Portal nicht
        # gemeldet hat, hat der Gast nicht gezahlt — und was es gemeldet hat,
        # steht oben. Bis 11.08.2026 sprangen hier die Objekt-Stammdaten ein und
        # erzeugten über den Bestand 191 Reinigungs-, 151 Resort- und 73
        # Haustier-Posten (zusammen 218.020 DKK), von denen kein einziger belegt
        # war. Das floss als Ertrag in die Eigentümer-Auszahlung und verschob sie
        # gegenüber der Abrechnung, mit der der Betrieb wirklich rechnet.
        #
        # Die leere Liste ist hier eine AUSSAGE, kein Ausfall: `grund` benennt,
        # warum das Portal nichts geliefert hat, und die Abrechnung weist die
        # Buchung als „Portal-Aufstellung fehlt" aus, statt eine Zahl zu zeigen,
        # die niemand nachrechnen kann.
        return GebuehrenBefund(
            gebuehren=[],
            im_gesamtpreis=False,
            quelle="ota_ohne_aufstellung",
            grund=_stammdaten_grund(raw),
        )
    # Keine Portal-Buchung (eigene Website, Telefon, Rezeption): hier gibt es
    # gar keinen Payload, und die Objekt-Stammdaten sind die einzige — und
    # richtige — Quelle. Sie sind ja das, was der Betrieb selbst berechnet hat.
    return GebuehrenBefund(
        gebuehren=gebuehren_zuordnen(
            objekt_gebuehren(type_attributes, naechte, anlass=reservierung),
            klassifikation,
            property_id,
        ),
        im_gesamtpreis=False,
        quelle="stammdaten",
    )


def _ist_portalbuchung(raw: object) -> bool:
    """Kam diese Buchung über ein Portal — hatte sie also eine Chance auf eine
    Aufstellung?

    Am PAYLOAD entschieden, nicht am Kanalnamen: der Kanalname einer
    Direktbuchung ließe sich setzen, ohne dass je ein Aggregator beteiligt war.
    Vorhanden ist der Payload genau dann, wenn Channex die Buchung geliefert hat
    — erkennbar an den Feldern, die nur von dort kommen (``ota_name`` neben
    ``rooms``/``raw_message``). Live tragen alle 77 Channex-Buchungen mindestens
    zwei davon, keine Direktbuchung eines.
    """
    if not isinstance(raw, dict):
        return False
    return bool(raw.get("ota_name")) and bool(
        raw.get("rooms") or raw.get("raw_message")
    )


# Kanäle, deren Buchungen NIE über ein Portal liefen. Alles andere im
# CSV-Bestandsimport ist eine Portal-Buchung, deren Betrag der GASTPREIS des
# Portals ist — inklusive der Gebühren, die das Portal ausweist.
_DIREKTKANAELE = frozenset({"direct", "website", "portal"})


def _ist_csv_portalbuchung(reservierung: dict[str, Any] | None) -> bool:
    """Portal-Buchung aus dem CSV-Bestandsimport — ohne Payload, aber ein Portal.

    Der Bestandsimport (`channel_manager.csv_import`) legt Buchungen mit
    ``source_channex_booking_id = "csv:<external_id>"`` an; einen Channex-Payload
    gibt es dafür nie. `_ist_portalbuchung` sieht darum ``raw=None`` und hielt
    solche Buchungen für Direktbuchungen — und die Stammdaten sprangen ein.

    Live am 02.09.2026 (Betrieb a25577cf, 259 Booking-Buchungen aus dem CSV):
    Booking.com wies für Timmann 4.475,63 Nächte + 795 Reinigung = 5.270,63
    DKK aus; genau diese 5.270,63 stehen als ``total_amount`` in der Zeile.
    Die Abrechnung addierte 795 Reinigung UND 6 × 25 Resort aus den Stammdaten
    obendrauf: 6.215,63 DKK „Gastpreis", 15 % Portal-Provision auf 945 DKK, die
    der Gast nie gezahlt hat, und eine Resort-Gebühr, die Booking gar nicht
    kennt. Der Betrieb sah es nur, weil er die Booking-Seite danebenlegte.

    Der CSV-Betrag ist der Portal-Gastpreis inklusive Gebühren, die
    Aufstellung fehlt (die Vorlage hat nur ``total_amount``). Also gilt dieselbe
    Regel wie beim Channex-Import: keine Stammdaten-Gebühren erfinden, den
    Grund an der Zeile benennen (``csv_import``).

    Der Kanal entscheidet nur die NEGATIVE Richtung: eine CSV-Zeile mit
    ``source=Direkt`` (Kanal ``direct``/``website``) ist keine Portal-Buchung,
    dort bleiben die Stammdaten richtig.
    """
    if not isinstance(reservierung, dict):
        return False
    quelle = str(reservierung.get("source_channex_booking_id") or "")
    if not quelle.startswith("csv:"):
        return False
    kanal = str(reservierung.get("channel") or "").strip().lower()
    return kanal not in _DIREKTKANAELE


def _portal_gebuehren_aus_stammdaten(  # noqa: PLR0913 — dieselben Eingänge wie der Aufrufer
    *,
    raw: object,
    type_attributes: dict[str, Any] | None,
    naechte: int,
    klassifikation: dict[tuple[str, str | None], tuple[str, bool]],
    property_id: str,
    reservierung: dict[str, Any] | None,
    csv_muster: str | None,
    grund_ohne_gebuehren: str,
) -> GebuehrenBefund:
    """Gebühren einer Portal-Buchung ohne Aufstellung — aus den Stammdaten.

    Entscheidung des Betriebs (02.09.2026): in alle Booking-Buchungen ohne
    Portal-Aufstellung werden die Gebühren nachgetragen, „so wie sie in jedem
    Objekt hinterlegt sind" (Reinigung je Aufenthalt, Resort je Nacht,
    Haustier nur mit Tier — `objekt_gebuehren`). Offen bleibt nur, ob sie im
    ``total_amount`` STECKEN oder OBENDRAUF kommen. Das entscheiden Fakten vor
    Annahmen:

    1. Channex-Zwilling mit Tagespreisen: Differenz = total − Nächtesumme.
       * Differenz > 0 → die Gebühren stecken drin. Erklärt EINE Teilmenge der
         Stammdaten die Differenz exakt (Timmann: 795 = Reinigung), ist sie
         belegt (``grund='belegt'``) und nur sie gilt. Sonst gelten alle
         Stammdaten-Gebühren als im Betrag enthalten (``'im_betrag'``) —
         Rævlingehuset: Booking nimmt 960, hinterlegt sind 955; die 5 bleiben
         in der Übernachtung.
       * Differenz = 0 → der Betrag ist die reine Nächtesumme (Line, Britt:
         Booking führt die Reinigung nicht im Preis). Gebühren OBENDRAUF
         (``'obendrauf'``), Übernachtung = Nächtesumme.
    2. Channex-Import ohne Zwilling: der Betrag ist per Definition die
       Nächtesumme (Channex' Hilfe: Importe tragen keine Extras) → obendrauf.
    3. CSV ohne Zwilling (Bestand vor dem Channex-Anschluss): das gelernte
       Muster des Hauses (``csv_muster``); fehlt es, „im_betrag" als Vorgabe.

    Ohne hinterlegte Gebühren gibt es nichts nachzutragen: dann bleibt die
    Buchung „Portal-Aufstellung fehlt" mit ihrem Grund — keine erfundene Zeile.
    """
    kandidaten = objekt_gebuehren(type_attributes, naechte, anlass=reservierung)
    if not kandidaten:
        return GebuehrenBefund(
            gebuehren=[],
            im_gesamtpreis=False,
            quelle="ota_ohne_aufstellung",
            grund=grund_ohne_gebuehren,
        )
    posten, im_betrag, grund, uebernachtung = _stammdaten_lage(
        kandidaten,
        naechte_summe=booking_naechte_summe(raw),
        total=zu_decimal((reservierung or {}).get("total_amount")),
        csv_muster=csv_muster,
        ist_channex_import=grund_ohne_gebuehren == "channex_import",
        property_id=property_id,
    )
    return GebuehrenBefund(
        gebuehren=gebuehren_zuordnen(posten, klassifikation, property_id),
        im_gesamtpreis=im_betrag,
        quelle="stammdaten_portal",
        uebernachtung=uebernachtung,
        grund=grund,
    )


def _stammdaten_lage(  # noqa: PLR0913 — jede Größe ist ein eigener Fakt
    kandidaten: list[tuple[str, Decimal]],
    *,
    naechte_summe: Decimal | None,
    total: Decimal | None,
    csv_muster: str | None,
    ist_channex_import: bool,
    property_id: str,
) -> tuple[list[tuple[str, Decimal]], bool, str, Decimal | None]:
    """Wo die Stammdaten-Gebühren zum Portalbetrag stehen.

    Rückgabe ``(posten, im_betrag, grund, uebernachtung)`` — die Fallreihe aus
    ``_portal_gebuehren_aus_stammdaten``: Zwilling vor Import-Regel vor
    Haus-Muster vor Vorgabe.
    """
    if naechte_summe is not None and total is not None:
        differenz = (total - naechte_summe).quantize(Decimal("0.01"))
        if differenz == 0:
            return kandidaten, False, "obendrauf", naechte_summe
        if differenz > 0:
            treffer = _teilmengen_mit_summe(kandidaten, differenz)
            if len(treffer) == 1:
                return treffer[0], True, "belegt", None
            log.info(
                "portal_gebuehren_differenz_nicht_exakt",
                property_id=property_id,
                differenz=str(differenz),
                kandidaten=[(a, str(b)) for a, b in kandidaten],
            )
        else:
            # Betrag UNTER den Tagespreisen (Storno auf 0,00,
            # Teilrückerstattung): kein Gebührenfall — laut sagen.
            log.warning(
                "portal_gebuehren_betrag_unter_naechten",
                property_id=property_id,
                total=str(total),
                naechte_summe=str(naechte_summe),
            )
        return kandidaten, True, "im_betrag", None
    if ist_channex_import or csv_muster == "obendrauf":
        return kandidaten, False, "obendrauf", None
    return kandidaten, True, "im_betrag", None


def _teilmengen_mit_summe(
    kandidaten: list[tuple[str, Decimal]], ziel: Decimal
) -> list[list[tuple[str, Decimal]]]:
    """Alle Teilmengen der Kandidaten, deren Beträge exakt ``ziel`` ergeben.

    Die leere Teilmenge zählt nur für ``ziel == 0`` (keine Gebühr im Betrag).
    Kandidatenlisten sind kurz (ein Objekt hat eine Handvoll Gebühren), die
    Enumeration ist also billig; ab 12 Einträgen wird abgebrochen — dann ist
    die Ableitung ohnehin nicht mehr glaubwürdig.
    """
    if len(kandidaten) > 12:
        return []
    ziel = ziel.quantize(Decimal("0.01"))
    treffer: list[list[tuple[str, Decimal]]] = []
    for maske in range(1 << len(kandidaten)):
        teil = [k for i, k in enumerate(kandidaten) if maske & (1 << i)]
        summe = sum((b for _, b in teil), Decimal("0")).quantize(Decimal("0.01"))
        if summe == ziel:
            treffer.append(teil)
    return treffer


def _stammdaten_grund(raw: object) -> str:
    """WARUM das Portal keine Aufstellung geliefert hat — maschinenlesbar.

    Der Wert landet als ``GebuehrenBefund.grund`` an der Buchung und ist die
    Antwort auf die Rückfrage „warum stehen bei dieser Buchung keine Gebühren?".
    Ohne ihn sieht eine leere Liste wie ein Rechenfehler aus.

    Der wichtigste Fall ist der Channex-IMPORT. Beim Verbinden eines Kanals holt
    Channex die bestehenden Buchungen aus dem Portal nachträglich herein und
    markiert sie mit ``meta.is_imported``. Seine Hilfe sagt dazu ausdrücklich:
    „The data you get from imported bookings could lack some details compared to
    normal booking, it will **not include extras and cleaning fees**."

    Live nachgewiesen am 11.08.2026 an 55 Booking.com-Buchungen — die Trennung
    ist vollständig, ohne eine einzige Ausnahme:

    * ``is_imported=True`` (52 Buchungen, Eingang bis 10.08. 19:15, dem Tag des
      Kanal-Anschlusses) → ``rooms[].taxes`` LEER;
    * ohne die Markierung (3 Buchungen, Eingang ab 11.08. 06:11) → Gebühren
      vollständig dabei.

    Vier Objekte mit IDENTISCHER Channex-Konfiguration (Tax Set „Standard",
    dieselbe Anzahl verknüpfter Rate-Plans, Reinigung als ``per_booking`` /
    ``fee`` / ``exclusive``) verhielten sich unterschiedlich — allein nach
    Eingangsweg. Ohne diesen Grund im Befund sucht die nächste Fehlersuche wieder
    beim Mapping, beim Tax Set oder beim eigenen Auswertungscode; dort ist nichts
    zu finden, und die Suche kostete am 11.08.2026 einen halben Tag.
    """
    if not isinstance(raw, dict):
        return "kein_payload"
    if (raw.get("meta") or {}).get("is_imported"):
        return "channex_import"
    if raw.get("rooms"):
        # Normale Buchung, aber ohne Aufstellung: dann führt das Portal die
        # Gebühr nicht als eigene Position (bei Booking.com hängt das an der
        # Extranet-Konfiguration, siehe docs/EIGENTUEMER-PREIS-KETTE.md).
        return "portal_meldet_keine"
    return "kein_payload"


def gebuehren_zuordnen(
    posten: list[tuple[str, Decimal]],
    klassifikation: dict[tuple[str, str | None], tuple[str, bool]],
    property_id: str,
) -> list[Gebuehr]:
    """``(art, betrag)`` mit der Zuordnung zu ``Gebuehr`` verbinden.

    Vorrang: Objekt-Ausnahme vor Betriebsregel — dasselbe Prinzip wie überall
    sonst. Fehlt die Zuordnung, wirft es: der Betrieb muss die Gebührenart
    EINMAL zuordnen (``/objekte/<id>/preise``, Abschnitt „Wem gehören die
    Gebühren?"), danach gilt sie für alle Objekte.
    """
    out: list[Gebuehr] = []
    for art, betrag in posten:
        treffer = klassifikation.get((art, property_id)) or klassifikation.get(
            (art, None)
        )
        if treffer is None:
            raise PayoutUnbekannt(
                "gebuehr_nicht_zugeordnet",
                f"Die Gebührenart „{art}“ ist nicht zugeordnet. Ohne "
                "Zuordnung ist nicht bestimmbar, wem der Betrag gehört und ob "
                "er provisionspflichtig ist.",
            )
        gehoert_zu, provisionspflichtig = treffer
        out.append(
            Gebuehr(
                art=art,
                betrag=betrag,
                gehoert_zu=gehoert_zu,
                provisionspflichtig=provisionspflichtig,
            )
        )
    return out
