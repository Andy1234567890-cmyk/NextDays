"""Geteilte Auszahlungs-Rechnung — die EINE Quelle der Auszahlungsformel.

Zwei Slices brauchen dieselbe Zahl:
* ``owner_statements`` — die Abrechnung (Summe je Zeitraum, Rechnung, PDF).
* ``public_portal`` — der Eigentümer-Kalender, der je NACHT seinen
  Netto-Auszahlungsbetrag zeigt (Etappe B).

Ohne diesen Ort stünde die Formel zweimal im Code und liefe auseinander: der
Kalender zeigte dann eine andere Zahl als die Abrechnung über denselben
Zeitraum — ein Fehler, den niemand als Bug erkennt, weil beide Werte plausibel
aussehen.

Bewusst OHNE Pydantic-Schemas und ohne DB-Zugriff: reine Rechnung auf Decimal.
Jeder Slice holt seine Zeilen selbst (mit seinem eigenen Scope) und formt sein
eigenes Antwortmodell — sonst bestimmte die Abrechnung die Antwortform des
Portals mit.

Wurzel 4 (keine erfundenen Werte): Fehlt eine Rechengrundlage (Provision,
Betrag, Nächte), wird NICHT auf 0 oder einen plausiblen Ersatzwert
zurückgefallen — ``PayoutUnbekannt`` sagt, WAS fehlt. Der Aufrufer entscheidet,
ob das ein 422 ist oder eine leere Zelle mit erkennbarem Grund.

ABRECHNUNGSVERTRAG (0343, Umstieg Schritt 1): Der Provisionssatz kommt seit
11.08.2026 vorrangig aus ``owner_billing_terms`` — der versionierten
Vereinbarung mit Zeitachse. Die alten Spalten
(``owner_properties.commission_override_pct`` / ``owners.default_commission_pct``)
bleiben Rückfall, bis jeder Eigentümer einen Vertrag hat (README-Schritt 3);
sie ersatzlos abzuschalten nähme heute den zwei Objekten mit gepflegtem
Override ihren Satz und erzeugte MEHR leere Zellen als vorher.

Der Vertrag trägt neben dem Satz zwei weitere Rechenregeln, die vorher nirgends
wirkten, obwohl die Vertragsmaske sie anbietet: eine **Pauschale je Buchung**
(mit Bezugsgröße und Zeitpunkt) und eine **Mindestprovision je Buchung**. Beide
laufen hier — nicht in den Slices —, damit Kalender und Abrechnung dieselbe
Zahl ergeben.
"""
from __future__ import annotations

from dataclasses import dataclass
from decimal import ROUND_HALF_UP, Decimal

_CENT = Decimal("0.01")
_HUNDERT = Decimal("100")


class PayoutUnbekannt(Exception):
    """Die Auszahlung ist aus den Daten NICHT berechenbar.

    ``grund`` benennt die fehlende Grundlage maschinenlesbar
    (``provision`` | ``betrag`` | ``naechte``), damit der Aufrufer sie in der
    UI erkennbar machen kann, statt eine Zahl zu erfinden (Wurzel 4).
    """

    def __init__(self, grund: str, message: str) -> None:
        super().__init__(message)
        self.grund = grund
        self.message = message


def zu_decimal(value: object) -> Decimal | None:
    """In Decimal wandeln (über str, um Float-Artefakte zu vermeiden).

    ``None`` bleibt ``None`` — der Aufrufer muss entscheiden, ob ein fehlender
    Wert ein Datenfehler ist. Ein stilles ``Decimal("0")`` wäre genau der
    erfundene Ersatzwert aus Wurzel 4.
    """
    if value is None:
        return None
    return Decimal(str(value))


def effektive_provision_pct(
    override_pct: object, default_pct: object
) -> Decimal:
    """Provisionssatz je Objekt: Objekt-Override, sonst Owner-Default.

    Bildet ``owner_properties.commission_override_pct ??
    owners.default_commission_pct`` ab — dieselbe Ableitung wie
    ``OwnerStatementsService._commission_map``.

    Fehlt BEIDES, ist das ein Datenfehler und kein „0 % Provision": eine
    unterstellte Null zahlte dem Eigentümer den vollen Betrag aus und die
    Hausverwaltung nichts. Darum ``PayoutUnbekannt`` statt eines Defaults.
    """
    pct = zu_decimal(override_pct)
    if pct is None:
        pct = zu_decimal(default_pct)
    if pct is None:
        raise PayoutUnbekannt(
            "provision",
            "Keine Provision hinterlegt (weder je Objekt noch als Standard).",
        )
    if pct < 0 or pct > _HUNDERT:
        # EIGENER Grund, nicht „provision": ein FEHLENDER Satz ist eine
        # unvollständige Stammdatenzeile (die Abrechnung darf ihn historisch
        # als 0 behandeln), ein UNGÜLTIGER Satz ist ein echter Eingabefehler,
        # den niemand stillschweigend auf 0 glattbügeln darf. Die Aufrufer
        # unterscheiden das am `grund`, nicht am Meldungstext.
        raise PayoutUnbekannt(
            "provision_ungueltig",
            f"Provisionssatz {pct} liegt außerhalb von 0–100 %.",
        )
    return pct


def buchungs_payout(
    total_amount: object, channel_fee: object, addon_total: object = None
) -> Decimal:
    """Auszahlung der BUCHUNG vor Provision: total_amount + Extras − channel_fee.

    Identisch zu ``_rental_rows`` im Abrechnungs-Service. ``channel_fee`` und
    ``addon_total`` dürfen fehlen — „keine OTA-Gebühr" bzw. „keine Extras" ist
    ein echter Zustand, kein Datenloch. ``total_amount`` dagegen MUSS da sein:
    eine Buchung ohne Betrag kann keinen Auszahlungsbetrag ergeben.
    """
    betrag = zu_decimal(total_amount)
    if betrag is None:
        raise PayoutUnbekannt(
            "betrag", "Reservierung ohne Gesamtbetrag — Auszahlung unbestimmt."
        )
    gebuehr = zu_decimal(channel_fee) or Decimal("0")
    extras = zu_decimal(addon_total) or Decimal("0")
    return betrag + extras - gebuehr


@dataclass(frozen=True, slots=True)
class Gebuehr:
    """EINE Gebühr einer Buchung mit ihrer Zuordnung (0343).

    ``betrag`` ist der auf DIESE Buchung entfallende Gesamtbetrag — bei
    ``per_night`` also schon mit den Nächten multipliziert. Die Umrechnung
    „25/Nacht × 3" macht der Aufrufer, weil nur er die Nächte der Buchung und
    die Herkunft (Objekt-Stammdaten oder OTA-Payload) kennt.

    ``gehoert_zu`` / ``provisionspflichtig`` sind die zwei UNABHÄNGIGEN Achsen
    aus ``fee_classification``. Beide sind nötig, wie die drei realen Fälle
    zeigen: Miete (Eigentümer, provisionspflichtig), Nebenkosten (Eigentümer,
    provisionsFREI), Reinigung (Betrieb, provisionsfrei). Mit nur einer Achse
    ließen sich die letzten zwei nicht trennen — beide sind provisionsfrei, aber
    das Geld geht an verschiedene Parteien.

    Es gibt KEINEN Default: eine unterstellte Zuordnung schlüge das Geld der
    falschen Partei zu (Wurzel 4). Fehlt sie, wirft der Aufrufer
    ``PayoutUnbekannt("gebuehr_nicht_zugeordnet")``.
    """

    art: str
    betrag: Decimal
    gehoert_zu: str
    provisionspflichtig: bool


def gebuehren_aufteilen(
    gebuehren: list[Gebuehr],
) -> tuple[Decimal, Decimal, Decimal]:
    """Die Gebühren einer Buchung auf ihre drei Wirkungen aufteilen.

    Rückgabe ``(brutto, aus_bemessung, an_eigentuemer)``:

    * ``brutto`` — Summe ALLER Gebühren. Sie sind Teil des Gastpreises; die
      Portale rechnen ihre Provision darauf (bei Airbnb nachgewiesen:
      ``host_fee_base`` = 15,5 % von ``base_price + standard_fees_details``).
    * ``aus_bemessung`` — was vor der Verwaltungsprovision wieder abgezogen
      wird: alles Provisionsfreie. Sonst zahlte der Eigentümer Provision auf
      Beträge, die ihm gar nicht als Ertrag zustehen.
    * ``an_eigentuemer`` — was nach der Provision zu 100 % zurückgeht: die
      provisionsfreien Gebühren, die IHM gehören (Nebenkosten). Die des
      Betriebs bleiben beim Betrieb, Durchlauf-Posten (Kurtaxe der Gemeinde,
      Kaution des Gastes) gehen an niemanden von beiden.

    ``durchlauf`` ist deshalb NICHT dasselbe wie „Eigentümer, provisionsfrei":
    beides ist aus der Bemessung heraus, aber nur das Zweite landet beim
    Eigentümer.
    """
    brutto = Decimal("0")
    aus_bemessung = Decimal("0")
    an_eigentuemer = Decimal("0")
    for g in gebuehren:
        brutto += g.betrag
        if g.provisionspflichtig:
            continue
        aus_bemessung += g.betrag
        if g.gehoert_zu == "eigentuemer":
            an_eigentuemer += g.betrag
    return brutto, aus_bemessung, an_eigentuemer


def gastpreis(
    *,
    uebernachtung: object,
    gebuehren: list[Gebuehr],
    gebuehren_im_betrag: bool,
    addon_total: object = None,
) -> Decimal:
    """Der Gastpreis EINER Buchung — Schritt 1 der Kette, einmal im Code.

    Die Bezugsgröße des Portal-Abzugs. Sie muss zwingend dieselbe sein, mit der
    ``auszahlung_berechnen`` weiterrechnet: berechnete der Aufrufer den Abzug auf
    einem anderen Brutto als die Kette, wäre der Prozentsatz in der Abrechnung
    nicht der, den das Portal wirklich genommen hat — und die Differenz landete
    still beim Eigentümer. Darum steht die Bildung hier und nicht in den drei
    Slices, die sie brauchen.

    ``gebuehren_im_betrag=True`` (Booking.com-Feed) heißt: ``uebernachtung`` ist
    schon der Gastpreis inklusive Gebühren, sie werden NICHT addiert. Siehe
    ``auszahlung_berechnen`` für die Belege.
    """
    basis = zu_decimal(uebernachtung)
    if basis is None:
        raise PayoutUnbekannt(
            "betrag", "Reservierung ohne Gesamtbetrag — Auszahlung unbestimmt."
        )
    summe = basis + (zu_decimal(addon_total) or Decimal("0"))
    if not gebuehren_im_betrag:
        summe += sum((g.betrag for g in gebuehren), Decimal("0"))
    return summe


@dataclass(frozen=True, slots=True)
class Vertragsregeln:
    """Die Rechenregeln EINES Abrechnungsvertrags (``owner_billing_terms``).

    Bewusst ein eigener, DB-freier Typ statt der rohen Vertragszeile: dieses
    Modul rechnet und kennt keine Tabellen. Die Slices bauen ihn über
    ``vertragsregeln_aus_zeile`` aus der Zeile, die
    ``OwnerBillingService.vertrag_aufloesen`` für den Stichtag geliefert hat.

    Die DB (0343) garantiert die Invarianten, auf die sich die Rechnung hier
    verlässt: ``provisions_pct`` 0–100, Beträge ≥ 0, Währungen ``^[A-Z]{3}$``,
    und die Gruppen „Mindestprovision" (Betrag+Währung) sowie „Pauschale"
    (Betrag+Währung+Basis+Zeitpunkt) jeweils vollständig oder komplett leer.
    Darum wird hier nicht erneut auf Halbzustände geprüft — nur auf das, was
    die DB NICHT wissen kann: ob die Währung zur Buchung passt.
    """

    provisions_pct: Decimal
    min_provision_betrag: Decimal | None = None
    min_provision_currency: str | None = None
    pauschale_betrag: Decimal | None = None
    pauschale_currency: str | None = None
    pauschale_basis: str | None = None
    pauschale_zeitpunkt: str | None = None


def vertragsregeln_aus_zeile(zeile: dict) -> Vertragsregeln:
    """Eine Vertragszeile in die Rechenregeln übersetzen.

    ``provisions_pct`` ist in der DB ``not null`` ohne Default — fehlt es
    dennoch (fremde Quelle, Testdaten), ist das ein Datenfehler und kein 0 %.
    """
    pct = zu_decimal(zeile.get("provisions_pct"))
    if pct is None:
        raise PayoutUnbekannt(
            "provision",
            "Abrechnungsvertrag ohne Provisionssatz.",
        )
    if pct < 0 or pct > _HUNDERT:
        raise PayoutUnbekannt(
            "provision_ungueltig",
            f"Provisionssatz {pct} im Vertrag liegt außerhalb von 0–100 %.",
        )
    return Vertragsregeln(
        provisions_pct=pct,
        min_provision_betrag=zu_decimal(zeile.get("min_provision_betrag")),
        min_provision_currency=(zeile.get("min_provision_currency") or None),
        pauschale_betrag=zu_decimal(zeile.get("pauschale_betrag")),
        pauschale_currency=(zeile.get("pauschale_currency") or None),
        pauschale_basis=(zeile.get("pauschale_basis") or None),
        pauschale_zeitpunkt=(zeile.get("pauschale_zeitpunkt") or None),
    )


@dataclass(frozen=True, slots=True)
class PortalAbzug:
    """Was das Portal von der Buchung einbehält.

    ZWEI Bestandteile, weil Booking.com zwei getrennte Abzüge erhebt (live am
    Kundenbestand belegt): 15 % Vermittlungsprovision PLUS 1,5 %
    Zahlungsgebühr = die 16,5 %, mit denen die Buchhaltung rechnet. Airbnb hat
    nur die Provision (15,5 %) und keine Zahlungsgebühr.

    ``provision`` kommt bevorzugt als GEMELDETER Betrag vom Portal. Fehlt er,
    greift der hinterlegte Satz — siehe ``portal_zieht_ein`` dazu, warum ein
    fehlender Wert NICHT „das Portal zieht nicht ein" bedeutet.
    """

    provision: Decimal
    zahlungsgebuehr: Decimal

    @property
    def gesamt(self) -> Decimal:
        return self.provision + self.zahlungsgebuehr


# Kanäle, bei denen das Portal das Geld IMMER einzieht und dafür eine
# Zahlungsgebühr nimmt. Das ist eine Eigenschaft des Kanals, keine der einzelnen
# Buchung — und deshalb steht sie hier und nicht an den vier Rechenstellen.
#
# Warum überhaupt eine Liste, wenn es doch ``payment_collect`` gibt: das Feld ist
# bei 51 von 55 Booking-Buchungen LEER. Das hieß in der Kette bisher „der Gast
# zahlt direkt an den Betrieb, also keine Zahlungsgebühr" — und war falsch. Bei
# allen vier Buchungen, wo Channex das Feld füllt, steht ``ota``, und die
# Buchungsnotiz nennt jedes Mal eine Zahlungsgebühr von exakt 1,5 %
# (181,43/12.095 · 48,11/3.207,50 · 19,50/1.300). Auch die Abrechnung des
# Betriebs setzt sie bei jeder Booking-Buchung an.
#
# ``null`` heißt hier also „Channex hat es nicht mitgeschickt", nicht „nein".
# Die Kette darf daraus keine Ersparnis für den Eigentümer ableiten: über den
# Bestand waren das 4.168,61 DKK, die dem Betrieb fehlten (Wurzel 4 — kein
# stiller Ersatzwert für einen fehlenden).
_KANAL_ZIEHT_IMMER_EIN = frozenset({"booking", "bookingcom", "booking.com"})


def portal_zieht_ein(kanal: object, payment_collect: object) -> bool:
    """Zieht das Portal bei DIESER Buchung das Geld ein?

    Die EINE Ableitung dafür. Vorher stand sie viermal im Code (Abrechnung,
    Zerlegung, Reporting, Eigentümer-Portal), jedes Mal als
    ``payment_collect == 'ota'`` — vier Stellen, die bei einer Korrektur
    auseinanderlaufen und dann vier verschiedene Auszahlungen für dieselbe
    Buchung ergeben.

    Reihenfolge: die MELDUNG der Buchung schlägt die Kanal-Eigenschaft. Sagt
    ``payment_collect`` ausdrücklich etwas anderes als ``ota`` (z. B.
    ``property``), gilt das — dann zahlt der Gast wirklich vor Ort. Nur beim
    FEHLENDEN Wert entscheidet der Kanal.
    """
    gemeldet = str(payment_collect or "").strip().lower()
    if gemeldet:
        return gemeldet == "ota"
    return str(kanal or "").strip().lower() in _KANAL_ZIEHT_IMMER_EIN


def portal_abzug(
    *,
    brutto: Decimal,
    gemeldete_provision: object,
    provision_pct: object,
    zahlungsgebuehr_pct: object,
    zieht_portal_ein: bool,
) -> PortalAbzug:
    """Den Portal-Abzug einer Buchung bestimmen.

    ``brutto`` ist der GASTPREIS inklusive Gebühren — die Bezugsgröße, auf die
    die Portale nachweislich rechnen. Auf den Übernachtungspreis allein bezogen
    ergäbe derselbe Abzug je Buchung einen anderen Prozentsatz (live gemessen
    16,59 %–18,60 % bei konstant vereinbarten 15,5 %), also eine Zahl, die
    niemand nachvollziehen kann.

    Vorrang für die Provision: der GEMELDETE Betrag. Er ist die Tatsache, der
    Satz nur unsere Rekonstruktion. Fehlt er und ist auch kein Satz hinterlegt,
    ist der Abzug NICHT bestimmbar — kein 0 %, denn das zahlte dem Eigentümer
    den Portal-Anteil als Ertrag aus.

    Zieht das Portal nicht ein (``zieht_portal_ein=False``), entfällt die
    Zahlungsgebühr; die Provision bleibt, sie wird nur separat fakturiert.
    """
    gemeldet = zu_decimal(gemeldete_provision)
    if gemeldet is not None:
        provision = gemeldet
    else:
        pct = zu_decimal(provision_pct)
        if pct is None:
            raise PayoutUnbekannt(
                "portal_abzug",
                "Für diesen Kanal ist weder eine gemeldete Provision noch ein "
                "Provisionssatz hinterlegt.",
            )
        if pct < 0 or pct > _HUNDERT:
            raise PayoutUnbekannt(
                "portal_abzug_ungueltig",
                f"Portal-Provisionssatz {pct} liegt außerhalb von 0–100 %.",
            )
        provision = brutto * (pct / _HUNDERT)

    gebuehr = Decimal("0")
    if zieht_portal_ein:
        gpct = zu_decimal(zahlungsgebuehr_pct)
        if gpct is not None:
            if gpct < 0 or gpct > _HUNDERT:
                raise PayoutUnbekannt(
                    "portal_abzug_ungueltig",
                    f"Zahlungsgebührsatz {gpct} liegt außerhalb von 0–100 %.",
                )
            gebuehr = brutto * (gpct / _HUNDERT)
    return PortalAbzug(provision=provision, zahlungsgebuehr=gebuehr)


def _pruefe_waehrung(
    erwartet: str, tatsaechlich: str | None, was: str
) -> None:
    """Vertragswährung gegen Buchungswährung — NIE umrechnen.

    Die Währung steht ausdrücklich am Vertrag und wird nicht vom Objekt
    abgeleitet: 50 DKK sind 50 DKK, auch wenn ein Objekt in EUR verkauft. Eine
    Pauschale in EUR von einer DKK-Buchung abzuziehen wäre ein stillschweigender
    Umrechnungskurs von 1,0 — plausibel aussehender Unsinn (Wurzel 4). Ein
    Kurs gehört hier NICHT hinein: dieses Modul ist DB- und netzfrei, und ein
    Kurs hat einen Stichtag, den nur der Aufrufer kennt.
    """
    if (tatsaechlich or "").upper() != (erwartet or "").upper():
        raise PayoutUnbekannt(
            "waehrung_vertrag",
            f"{was} lautet auf {tatsaechlich or '—'}, die Buchung auf "
            f"{erwartet or '—'} — Beträge verschiedener Währungen werden nicht "
            "verrechnet.",
        )


def pauschale_betrag_je_buchung(
    regeln: Vertragsregeln, naechte: int, currency: str
) -> Decimal:
    """Die Pauschale dieser Buchung — je Buchung oder je Nacht.

    ``je_nacht`` multipliziert mit den Nächten des AUFENTHALTS, nicht mit den im
    Fenster sichtbaren: der Kalender zeigt im Monatswechsel nur einen Teil, und
    eine anteilige Pauschale wäre eine andere Vereinbarung.
    """
    if regeln.pauschale_betrag is None:
        return Decimal("0")
    _pruefe_waehrung(currency, regeln.pauschale_currency, "Die Pauschale")
    if regeln.pauschale_basis == "je_nacht":
        if naechte <= 0:
            raise PayoutUnbekannt(
                "naechte",
                "Pauschale je Nacht ohne Nächte nicht berechenbar.",
            )
        return regeln.pauschale_betrag * naechte
    return regeln.pauschale_betrag


def owner_payout(payout: Decimal, provision_pct: Decimal) -> Decimal:
    """Netto-Auszahlung des Eigentümers = Payout × (100 − Provision) / 100.

    UNGERUNDET (volle Decimal-Genauigkeit) — gerundet wird erst an der
    API-Grenze bzw. in ``payout_je_nacht``, damit die Nacht-Verteilung ohne
    Rundungsverlust auf diesen Wert aufgehen kann.
    """
    return payout * ((_HUNDERT - provision_pct) / _HUNDERT)


def owner_payout_vertrag(
    payout: Decimal,
    regeln: Vertragsregeln,
    *,
    naechte: int,
    currency: str,
) -> Decimal:
    """Netto-Auszahlung EINER Buchung nach ALLEN Regeln des Vertrags.

    Reihenfolge — sie ist die Vereinbarung, nicht eine Konvention im Code:

    1. ``pauschale_zeitpunkt='vor_provision'`` → die Pauschale verkleinert die
       Bemessungsgrundlage, die Provision wird also auf den KLEINEREN Betrag
       gerechnet. ``nach_provision`` lässt die Grundlage unberührt.
    2. Provision = Grundlage × ``provisions_pct``.
    3. Mindestprovision: liegt die errechnete Provision darunter, gilt der
       Mindestbetrag. Anlass ist in den Echtdaten belegt — es gibt Buchungen mit
       NEGATIVER bereinigter Basis, weil die pauschale Reinigungsgebühr bei
       einem Kurzaufenthalt größer ist als der Übernachtungsertrag; ohne
       Mindestprovision ergäbe die Formel dort eine negative Provision, also
       eine Zahlung des Betriebs an den Eigentümer.
    4. Eigentümer-Anteil = Grundlage − Provision.
    5. ``nach_provision`` → die Pauschale wird erst jetzt abgezogen.

    Dieselbe Pauschale ergibt je nach Zeitpunkt zwei verschiedene Zahlen; genau
    darum ist der Zeitpunkt Teil des Vertrags.

    UNGERUNDET wie ``owner_payout`` — gerundet wird erst in ``payout_je_nacht``
    bzw. an der API-Grenze, damit die Nacht-Verteilung aufgeht.

    Das Ergebnis kann NEGATIV werden (hohe Pauschale ``nach_provision`` auf eine
    kleine Buchung). Das wird NICHT auf 0 geklemmt: eine stille Null verschwiege
    dem Eigentümer eine Forderung, die der Vertrag so vorsieht. Der Aufrufer
    entscheidet, wie er sie ausweist.
    """
    pauschale = pauschale_betrag_je_buchung(regeln, naechte, currency)
    vorab = pauschale if regeln.pauschale_zeitpunkt == "vor_provision" else Decimal("0")
    grundlage = payout - vorab

    provision = grundlage * (regeln.provisions_pct / _HUNDERT)
    if regeln.min_provision_betrag is not None:
        _pruefe_waehrung(
            currency, regeln.min_provision_currency, "Die Mindestprovision"
        )
        provision = max(provision, regeln.min_provision_betrag)

    netto = grundlage - provision
    if regeln.pauschale_zeitpunkt == "nach_provision":
        netto -= pauschale
    return netto


@dataclass(frozen=True, slots=True)
class Auszahlung:
    """Die aufgeschlüsselte Auszahlung EINER Buchung.

    Nicht nur der Endbetrag: jede Zwischenzeile ist ein Wert, den die
    Abrechnung dem Eigentümer zeigen muss. Ohne sie wäre die Zahl am Ende eine
    Behauptung, die niemand nachrechnen kann — genau der Punkt, an dem die
    Kette mit dem Kunden geklärt werden musste.
    """

    brutto: Decimal
    portal_provision: Decimal
    portal_zahlungsgebuehr: Decimal
    auszahlungsbasis: Decimal
    gebuehren_aus_bemessung: Decimal
    bemessungsgrundlage: Decimal
    verwaltungsprovision: Decimal
    pauschale: Decimal
    gebuehren_an_eigentuemer: Decimal
    netto: Decimal
    currency: str


def auszahlung_berechnen(  # noqa: PLR0913 — die Kette hat viele Eingänge
    *,
    uebernachtung: object,
    gebuehren: list[Gebuehr],
    gebuehren_im_betrag: bool = False,
    addon_total: object = None,
    abzug: PortalAbzug,
    regeln: Vertragsregeln,
    naechte: int,
    currency: str,
) -> Auszahlung:
    """Die VOLLE Kette einer Buchung — vom Gastpreis zur Netto-Auszahlung.

    Reihenfolge (mit dem Betrieb abgestimmt und an Echtdaten geprüft):

    1. Gastpreis = Übernachtung + alle Gebühren + Zusatzleistungen.
    2. − Portal-Abzug (Provision + ggf. Zahlungsgebühr) → Auszahlungsbasis.
    3. − alle PROVISIONSFREIEN Gebühren → Bemessungsgrundlage. Ohne diesen
       Schritt zahlte der Eigentümer Verwaltungsprovision auf Reinigung und
       Nebenkosten.
    4. − Pauschale ``vor_provision`` (verkleinert die Bemessung zusätzlich).
    5. − Verwaltungsprovision, mindestens die Mindestprovision.
    6. − Pauschale ``nach_provision``.
    7. + provisionsfreie Gebühren, die dem EIGENTÜMER gehören → er bekommt sie
       zu 100 %, ungeschmälert durch Provision.

    Schritt 3 und 7 gehören zusammen: erst raus aus der Bemessung, dann
    ungekürzt zurück. Die Gebühren des BETRIEBS bleiben in Schritt 3 stehen und
    kommen in Schritt 7 nicht zurück — sie sind sein Ertrag.

    ``gebuehren_im_betrag`` entscheidet Schritt 1 und ist KEIN Detail:

    * ``False`` (Airbnb, Objekt-Stammdaten) — ``uebernachtung`` ist der reine
      Übernachtungsbetrag, die Gebühren werden addiert.
    * ``True`` (Booking.com-Feed) — ``uebernachtung`` IST bereits der Gastpreis
      inklusive Gebühren. Sie werden nicht addiert, gehen aber weiterhin durch
      Schritt 3 und 7, weil ihre Zuordnung dieselbe bleibt.

    Ohne diese Unterscheidung zählt die Kette die Gebühren bei Booking doppelt.
    An der Live-Buchung über 9 Nächte (10.795 Nächte + 225 Resort + 1.075
    Reinigung = 12.095 Gesamtbetrag) wären das 1.300 DKK zu viel im Gastpreis,
    darauf 15 % Portal-Provision zu viel abgezogen und die Reinigung dem Betrieb
    doppelt zugeschlagen — drei Fehler, die sich teilweise aufheben und deshalb
    keine auffällige Zahl erzeugen.

    Das Ergebnis kann negativ sein (hohe Pauschale auf eine kleine Buchung) und
    wird NICHT auf 0 geklemmt: eine stille Null verschwiege eine Forderung, die
    der Vertrag so vorsieht.
    """
    if not (currency or "").strip():
        raise PayoutUnbekannt(
            "betrag", "Reservierung ohne Währung — Auszahlung nicht ausweisbar."
        )
    extras = zu_decimal(addon_total) or Decimal("0")
    _, geb_aus_bemessung, geb_an_owner = gebuehren_aufteilen(gebuehren)

    brutto = gastpreis(
        uebernachtung=uebernachtung,
        gebuehren=gebuehren,
        gebuehren_im_betrag=gebuehren_im_betrag,
        addon_total=addon_total,
    )
    basis = brutto - abzug.gesamt
    # Extras sind provisionsfrei verkauft und gehören dem Eigentümer — sie
    # laufen wie eine Eigentümer-Gebühr durch (raus, dann ungekürzt zurück).
    bemessung_roh = basis - geb_aus_bemessung - extras

    pauschale = pauschale_betrag_je_buchung(regeln, naechte, currency)
    vorab = pauschale if regeln.pauschale_zeitpunkt == "vor_provision" else Decimal("0")
    bemessung = bemessung_roh - vorab

    provision = bemessung * (regeln.provisions_pct / _HUNDERT)
    if regeln.min_provision_betrag is not None:
        _pruefe_waehrung(
            currency, regeln.min_provision_currency, "Die Mindestprovision"
        )
        provision = max(provision, regeln.min_provision_betrag)

    netto = bemessung - provision
    if regeln.pauschale_zeitpunkt == "nach_provision":
        netto -= pauschale
    netto += geb_an_owner + extras

    return Auszahlung(
        brutto=brutto,
        portal_provision=abzug.provision,
        portal_zahlungsgebuehr=abzug.zahlungsgebuehr,
        auszahlungsbasis=basis,
        gebuehren_aus_bemessung=geb_aus_bemessung + extras,
        bemessungsgrundlage=bemessung,
        verwaltungsprovision=provision,
        pauschale=pauschale,
        gebuehren_an_eigentuemer=geb_an_owner + extras,
        netto=netto,
        currency=currency,
    )


def payout_je_nacht(gesamt: Decimal, naechte: int) -> list[Decimal]:
    """Den Auszahlungsbetrag verlustfrei auf die Nächte verteilen.

    Branchenüblich (Hostaway/Guesty/Escapia weisen den Ertrag am Aufenthalt
    aus, nicht am Kalendertag) wird GLEICHMÄSSIG über die Nächte verteilt —
    nicht nach Tagespreis gewichtet. Grund: der Auszahlungsbetrag hängt an der
    Buchung als Ganzes (Provision, OTA-Gebühr und Extras gelten dem Aufenthalt,
    nicht einer einzelnen Nacht); eine Gewichtung nach Tagespreis würde eine
    Genauigkeit vortäuschen, die die Quelldaten nicht hergeben.

    RUNDUNG (ausdrücklich gelöst, kein Rundungsverlust): jede Nacht bekommt den
    kaufmännisch auf den Cent gerundeten Gleichanteil; die LETZTE Nacht trägt
    die Differenz zum Gesamtbetrag. Damit gilt immer
    ``sum(payout_je_nacht(g, n)) == g.quantize(0.01)`` — die Summe der im
    Kalender gezeigten Nächte ist exakt der Buchungs-Payout. Ohne diesen
    Ausgleich ergäbe z. B. 100,00 € auf 3 Nächte 3 × 33,33 € = 99,99 €, und dem
    Eigentümer fehlte im Kalender ein Cent gegenüber seiner Abrechnung.

    ``naechte <= 0`` ist ein Datenfehler (Check-out vor/gleich Check-in) und
    ergibt KEINE Verteilung — sonst entstünde eine Division durch Null oder ein
    stillschweigend verschwundener Betrag.
    """
    if naechte <= 0:
        raise PayoutUnbekannt(
            "naechte",
            "Reservierung ohne Nächte (Check-out nicht nach Check-in).",
        )
    gesamt_gerundet = gesamt.quantize(_CENT, rounding=ROUND_HALF_UP)
    anteil = (gesamt / naechte).quantize(_CENT, rounding=ROUND_HALF_UP)
    werte = [anteil] * naechte
    # Letzte Nacht trägt die Differenz (siehe Docstring).
    werte[-1] = gesamt_gerundet - anteil * (naechte - 1)
    return werte


@dataclass(frozen=True, slots=True)
class NachtPayout:
    """Eine Nacht mit dem auf sie entfallenden Netto-Auszahlungsbetrag."""

    payout: Decimal
    currency: str


def naechte_payout_map(
    *,
    total_amount: object,
    channel_fee: object,
    provision_pct: Decimal | None = None,
    naechte: int,
    currency: str,
    addon_total: object = None,
    regeln: Vertragsregeln | None = None,
) -> list[NachtPayout]:
    """Die komplette Kette für EINE Buchung: Payout → Provision → je Nacht.

    Die Währung kommt aus den Daten und wird durchgereicht, nie ersetzt
    (Wurzel 4) — fehlt sie, ist das hier ein Fehler, kein ``"EUR"``.

    ``regeln`` (Abrechnungsvertrag) hat Vorrang und rechnet die VOLLE Kette
    inklusive Pauschale und Mindestprovision. Ohne Vertrag greift
    ``provision_pct`` aus den Altspalten — dann gibt es nur den Satz, denn die
    Altspalten kennen weder Pauschale noch Mindestprovision. Genau eines von
    beiden MUSS gesetzt sein; keines von beiden ist ein Programmierfehler und
    keine 0 %.
    """
    if not (currency or "").strip():
        raise PayoutUnbekannt(
            "betrag", "Reservierung ohne Währung — Auszahlung nicht ausweisbar."
        )
    if regeln is None and provision_pct is None:
        raise PayoutUnbekannt(
            "provision",
            "Weder Abrechnungsvertrag noch Provisionssatz übergeben.",
        )
    payout = buchungs_payout(total_amount, channel_fee, addon_total)
    netto = (
        owner_payout_vertrag(
            payout, regeln, naechte=naechte, currency=currency
        )
        if regeln is not None
        # `provision_pct` ist hier nachweislich nicht None (siehe Guard oben).
        else owner_payout(payout, provision_pct)  # type: ignore[arg-type]
    )
    return [NachtPayout(payout=w, currency=currency) for w in payout_je_nacht(netto, naechte)]
