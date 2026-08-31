"""Pydantic-Schemas für den public_portal-Slice (Eigentümer-Self-Service-Portal).

Der eingeloggte Eigentümer (Rolle 'owner') sieht NUR seine zugeordneten Objekte
(owner_property_assignments), Beträge/Gäste maskiert (guest_masking, §4.2).
"""
from datetime import date as date_

from pydantic import BaseModel, Field, model_validator


class PortalProperty(BaseModel):
    id: str
    title: str
    city: str | None = None
    photo: str | None = None


class PortalPropertyList(BaseModel):
    items: list[PortalProperty]
    total: int


class PortalNightBooking(BaseModel):
    """EINE Buchung, die diese Nacht belegt — eine Zeile je EINHEIT.

    Seit 0265 führt ein `property_id` n ≥ 1 Einheiten (`property_units`), und
    `reservations.unit_id` sagt, welche eine Buchung belegt. Ein Typ mit fünf
    identischen Studios kann an derselben Nacht fünf Buchungen tragen; jede
    davon ist Geld des Eigentümers. Vorher trug die Antwort je Nacht nur EINE
    Buchung, und die Payouts der übrigen Einheiten fielen still weg.
    """

    reservation_id: str
    # Welche Einheit belegt ist. `None` heißt: die Buchung ist noch nicht auf
    # eine Einheit gelegt (Altbestand vor 0265, oder ein Objekt mit genau einer
    # Einheit) — dann ist es der Typ als Ganzes.
    unit_id: str | None = None
    # Netto-Auszahlung des Eigentümers für DIESE Buchung in DIESER Nacht.
    # None + `payout_unknown_reason` = nicht ausweisbar (Wurzel 4).
    owner_payout_per_night: float | None = None
    currency: str | None = None
    payout_unknown_reason: str | None = None
    guest_first_name: str | None = None
    booking_source: str | None = None
    # Ist das die EIGENNUTZUNG des Eigentümers (0241, aus einem genehmigten
    # Sperrantrag)? Dann ist die Nacht belegt, bringt aber keinen Umsatz:
    # `owner_payout_per_night` ist None und `payout_unknown_reason` ebenfalls —
    # es fehlt keine Grundlage, es gibt nichts auszuzahlen.
    #
    # Ohne dieses Feld kann die Oberfläche die eigene Sperre nicht von einer
    # Buchung ohne ausweisbaren Betrag unterscheiden und müsste es am fehlenden
    # Gastnamen raten. Sie zeigt stattdessen „Eigennutzung" statt eines
    # Portal-Logos, das hier eine Buchung behaupten würde, die es nicht gibt.
    is_owner_stay: bool = False


class PortalCalendarDay(BaseModel):
    date: date_
    status: str  # open | booked | blocked
    # Gast-Verkaufspreis/Nacht — nur wenn die Maske Beträge erlaubt (sonst
    # None). Für einen Eigentümer ist das laut §4.2 IMMER None; er sieht
    # stattdessen `owner_payout_per_night` (siehe unten).
    price: float | None = None

    # --- Netto-Auszahlung des Eigentümers je belegter Nacht (Etappe B) ------
    # Was der Eigentümer für DIESE Nacht bekommt: sein Anteil am Buchungs-
    # Payout (total_amount + Extras − channel_fee) nach Abzug der Provision,
    # gleichmäßig über die Nächte des Aufenthalts verteilt. NICHT der
    # Gast-Gesamtpreis — der bleibt ihm verborgen (§4.2).
    #
    # SUMME über alle Einheiten des Typs: seit 0265 können mehrere Buchungen
    # dieselbe Nacht belegen (je Einheit eine). Die Einzelposten stehen in
    # `bookings`; dieses Feld ist ihre Summe, damit die Monatsansicht eine
    # Zahl je Zelle zeigen kann.
    #
    # None bedeutet: für diese Nacht ist kein Betrag ausweisbar (auch dann,
    # wenn nur EINE von mehreren Buchungen unbestimmt ist — eine Teilsumme
    # sähe aus wie der volle Ertrag). Der Grund steht in
    # `owner_payout_unknown_reason` — es wird KEINE Zahl erfunden (Wurzel 4).
    owner_payout_per_night: float | None = None
    # Währung DIESES Betrags, aus den Daten der Reservierung. Nie ersetzt.
    # None, wenn die Buchungen der Nacht verschiedene Währungen tragen.
    currency: str | None = None
    # provision | betrag | naechte — warum kein Betrag ausgewiesen wird.
    owner_payout_unknown_reason: str | None = None

    # Gast NUR mit Vorname — über die zentrale GuestMask gekürzt, nicht per
    # eigener Logik. Ein Eigentümer hat VIEW_GUEST_LIMITED (§4.2).
    # Bei mehreren belegten Einheiten der ERSTE (stabil sortiert); die
    # vollständige Aufstellung steht in `bookings`.
    guest_first_name: str | None = None
    # Buchungsquelle der Nacht (ota_name, sonst channel): woher die Buchung kam
    # und damit, welcher Portal-Abzug im Payout steckt.
    booking_source: str | None = None

    # Alle Buchungen dieser Nacht, eine je belegter EINHEIT (0265). Leer =
    # keine Buchung. Die drei Felder oben sind die Verdichtung davon.
    bookings: list[PortalNightBooking] = Field(default_factory=list)
    # Wie viele Einheiten des Typs an diesem Tag belegt sind. Passt zur
    # Verfügbarkeit je Einheit (0266): der Eigentümer eines Typs mit fünf
    # Studios muss „3 von 5 belegt" sehen können, nicht nur „belegt".
    units_booked: int = 0
    # Wie viele Einheiten der Typ überhaupt führt (property_units). Ohne diese
    # Zahl ist `units_booked` nicht einzuordnen.
    units_total: int = 1


class PortalCalendarResponse(BaseModel):
    property_id: str
    days: list[PortalCalendarDay]


class PortalEarningsItem(BaseModel):
    property_id: str
    title: str
    nights: int
    reservations: int
    # Maskiert: nur sichtbar, wenn die Maske Beträge erlaubt.
    payout: float | None = None
    currency: str


class PortalEarningsResponse(BaseModel):
    period_from: date_
    period_to: date_
    items: list[PortalEarningsItem]
    total_payout: float | None = None
    currency: str


class PortalStatementItem(BaseModel):
    id: str
    period_from: date_
    period_to: date_
    status: str
    owner_payout: float
    currency: str
    invoice_number: str | None = None
    created_at: str | None = None


class PortalStatementList(BaseModel):
    items: list[PortalStatementItem]
    total: int


class BlockRequestCreate(BaseModel):
    """Sperrwunsch des Eigentümers. `start_date`/`end_date` sind INKLUSIV
    („vom 1. bis zum 5."); die Umrechnung auf den exklusiven Kalender-Range
    passiert erst bei der Genehmigung."""

    property_id: str
    start_date: date_
    end_date: date_
    # Die gewünschte Einheit (property_units, 0265/0353). None = das ganze
    # Objekt, also alle seine Einheiten — der Normalfall bei einem Objekt mit
    # einer Einheit. Bei einem Typ mit fünf gleichen Studios kann der
    # Eigentümer damit EINES für sich beantragen, statt den ganzen Typ aus dem
    # Verkauf zu nehmen. Der Service prüft die Zugehörigkeit zum Objekt
    # serverseitig (Wurzel 3).
    unit_id: str | None = None
    # Warum gesperrt werden soll (Eigennutzung, Handwerker …). Optional, aber
    # die Agentur kann ohne sie schlecht entscheiden.
    reason: str | None = Field(default=None, max_length=2000)
    # Der Eigentümer will den VERMARKTUNGSVERTRAG beenden, nicht nur Nächte
    # sperren (0377). Ein eigenes Feld, weil es eine andere Erklärung ist:
    # Live vorgefunden (12.08.2026) beantragte ein Eigentümer 2027 komplett mit
    # der Begründung „Vi er ikke interesseret i udlejning 2027" — gemeint war
    # die Kündigung, gespeichert wurde eine Jahres-Sperre. Die Agentur musste
    # den dänischen Freitext deuten und das Vertragsende von Hand nachtragen;
    # genau dieser Schritt wird vergessen, und danach läuft der Vertrag mit
    # Provision und Portal-Distribution weiter.
    #
    # Der Freitext bleibt der Freitext: aus ihm wird NICHTS abgeleitet
    # (Wortsuche in 24 Sprachen als Grundlage einer Kündigung, Wurzel 4).
    ist_kuendigung: bool = False
    # BESTELLTE LEISTUNGEN (0510). IDs planmäßiger Regeln (`task_rules`,
    # kind='auto'), aus denen zu DIESER Sperre Aufgaben entstehen sollen —
    # typisch die Endreinigung nach der Eigennutzung.
    #
    # Leer = keine Aufgabe. Das ist die Vorgabe und der Sinn der Sache: ohne
    # Bestellung erzeugte eine Eigentümersperrung bis 0510 dieselbe Kette wie
    # eine Gastbuchung — Arbeit, die niemand beauftragt und niemand bezahlt hat.
    #
    # Die Obergrenze ist kein Komfortwert: ohne sie ließe sich mit einer langen
    # Liste je Antrag beliebig viel Arbeit erzeugen (Wurzel 8). Ein Betrieb hat
    # eine Handvoll planmäßiger Regeln; live sind es vier.
    bestellte_leistungen: list[str] = Field(default_factory=list, max_length=50)

    @model_validator(mode="after")
    def _check_order(self) -> "BlockRequestCreate":
        # Ohne diese Prüfung ließe sich ein Antrag mit end < start speichern,
        # der erst bei der Genehmigung auffiele — der Service prüft es zwar
        # auch, aber ein ungültiger Antrag soll gar nicht erst entstehen.
        if self.end_date < self.start_date:
            msg = "end_date darf nicht vor start_date liegen"
            raise ValueError(msg)
        return self


class BestellteLeistung(BaseModel):
    """Eine vom Eigentümer bestellte Leistung samt Namen ihrer Regel.

    Der Name kommt mit, damit die Oberfläche „Endreinigung" zeigen kann statt
    einer UUID — ohne dass sie dafür die Regelliste nachladen muss.
    """

    rule_id: str
    name: str


class BlockRequestItem(BaseModel):
    id: str
    property_id: str
    # Die beantragte Einheit (0353). None = das ganze Objekt.
    unit_id: str | None = None
    start_date: date_
    end_date: date_
    status: str
    reason: str | None = None
    # Entscheidung der Agentur — der Eigentümer sieht, WANN und mit welcher
    # Anmerkung entschieden wurde (nicht, WER es war: die interne Zuständigkeit
    # geht ihn nichts an).
    decided_at: str | None = None
    decision_note: str | None = None
    created_at: str | None = None
    # Vertragskündigung (0377). Der Eigentümer MUSS beides sehen: dass sein
    # Antrag als Kündigung geführt wird, und ZU WELCHEM Datum sie wirksam ist.
    # `als_kuendigung_gewertet` steht ausdrücklich mit dabei — hat die Agentur
    # seinen Sperrantrag als Kündigung ausgelegt, ist das eine Auslegung SEINER
    # Erklärung, und er muss ihr widersprechen können, wenn sie falsch ist.
    ist_kuendigung: bool = False
    als_kuendigung_gewertet: bool = False
    vertragsende_gesetzt_auf: date_ | None = None
    # Stufe 1 der Freigabe (0389): 'nicht_noetig' (Antrag des Eigentümers
    # selbst — der Normalfall und der gesamte Altbestand), 'offen',
    # 'freigegeben', 'abgelehnt'. Ein Familienmitglied muss sehen, WO sein
    # Antrag liegt: „offen" allein hieße sonst wahlweise „wartet auf die
    # Familie" oder „wartet auf die Verwaltung" — zwei sehr verschiedene
    # Aussagen mit sehr verschiedenen Wartezeiten.
    owner_freigabe: str = "nicht_noetig"
    # Begründung des Eigentümers bei Ablehnung. Der Antragsteller hat ein Recht
    # darauf zu erfahren, warum — sonst wirkt die Ablehnung wie Willkür.
    owner_decision_note: str | None = None
    # Was der Eigentümer zu dieser Sperre BESTELLT hat (0510). Leer = keine
    # Aufgabe entsteht. Steht auch am gelesenen Antrag, damit er nachsehen
    # kann, was er beauftragt hat — und die Agentur beim Genehmigen sieht,
    # welche Arbeit auf sie zukommt.
    bestellte_leistungen: list[BestellteLeistung] = Field(default_factory=list)


class BestellbareLeistungen(BaseModel):
    """Was der Eigentümer zu einer Sperre dieses Objekts bestellen KANN (0510).

    Bewusst nur `rule_id` und `name`: Zuständige, Zeiten, Prioritäten und
    Checklisten der Regel gehen den Eigentümer nichts an (§4.3) — er bestellt
    eine Leistung, er verwaltet nicht die Arbeitsorganisation des Betriebs.
    """

    items: list[BestellteLeistung]


class BlockRequestList(BaseModel):
    items: list[BlockRequestItem]
    total: int


class MeterReadingCreate(BaseModel):
    property_id: str
    meter_kind: str = Field(min_length=1, max_length=50)
    value: float = Field(ge=0)
    read_at: date_


class MeterReadingItem(BaseModel):
    id: str
    property_id: str
    meter_kind: str
    value: float
    read_at: date_
    created_at: str | None = None


class MeterReadingList(BaseModel):
    items: list[MeterReadingItem]
    total: int


class SliceHealth(BaseModel):
    slice: str
    status: str = "ok"


# --- Objektbereich, Bilder, Fotoalbum, Statistik (Eigentümer, lesend) --------
#
# KEIN GELDFELD IN DIESEM ABSCHNITT — bewusst und nachprüfbar. Der Eigentümer
# hat für diese vier Flächen die Rechte pm_property_area,
# pm_view_property_images, pm_photo_album und pm_nonrevenue_charts; er hat
# ausdrücklich NICHT pm_revenue_charts, pm_booking_total, pm_detailed_payments
# (§4.3). Käme hier ein Betrag, ein Preis oder eine Währung hinein, wäre die
# Trennung über die Fläche umgangen — nicht über das Recht. Deshalb ist jede
# Spalte, die diese Schemas speisen, einzeln ausgewählt (kein `select("*")`).


class PortalPropertyDetail(BaseModel):
    """Der Objektbereich EINES Objekts, lesend (§4.2).

    Stammdaten, Beschreibung, Adresse, Ausstattung — das, was der Eigentümer
    über sein Haus wissen muss. Keine Preise, keine Kaution, keine
    Kanal-/Vertriebsdaten: die gehören dem Betrieb.
    """

    id: str
    title: str
    description: str | None = None
    property_type: str | None = None
    # Objekt-Taxonomie (0198): Kategorie → Immobilientyp → Angebotsart.
    category_slug: str | None = None
    subtype_slug: str | None = None
    listing_type: str | None = None
    total_rooms: str | None = None
    status: str | None = None

    # Adresse
    street: str | None = None
    house_number: str | None = None
    postal_code: str | None = None
    city: str | None = None
    country: str | None = None
    lat: float | None = None
    lng: float | None = None
    timezone: str | None = None

    # Kapazität und Bau
    max_guests: int | None = None
    floors_total: int | None = None
    floor_number: int | None = None
    year_built: int | None = None
    size_value: float | None = None
    size_unit: str | None = None
    bfe_number: str | None = None

    # Ausstattung: zwei getrennte Kataloge (0243), nie mischen.
    amenities: list[str] = Field(default_factory=list)
    room_amenities: list[str] = Field(default_factory=list)

    # Wie viele Einheiten dieser TYP führt (property_units, 0265). 1 = der
    # Normalfall; die Zahl ist keine Erfindung, sondern das Datenmodell
    # (CLAUDE.md: 1 property = 1 Typ mit n ≥ 1 Einheiten).
    units_total: int = 1
    # Titelbild, falls vorhanden — dieselbe URL wie in `images`.
    cover_image_url: str | None = None


class PortalImage(BaseModel):
    """Ein Bild eines Objekts (`property_photos`, 0061).

    `url` ist eine fertige, absolute URL. Der Bucket `property-images` ist
    öffentlich (Migration 0062, damit die Buchungsstrecke für anonyme Gäste
    die Bilder laden kann); es gibt hier also nichts zu signieren, und eine
    signierte URL wäre eine Erfindung, die nach ihrem Ablauf ins Leere liefe.
    """

    id: str
    property_id: str
    url: str
    sort_order: int = 0
    is_cover: bool = False
    # Locale → Bildunterschrift, z. B. {"de": "Wohnzimmer"}.
    caption: dict[str, str] = Field(default_factory=dict)
    author: str | None = None


class PortalImageList(BaseModel):
    property_id: str
    items: list[PortalImage]
    total: int


class PortalAlbumGroup(BaseModel):
    """Die Bilder EINES Objekts im Fotoalbum, mit seinem Namen als Überschrift."""

    property_id: str
    title: str
    # Ort unter dem Objektnamen — zwei gleich benannte Häuser („Strandhus")
    # sind sonst im Album nicht auseinanderzuhalten. None, wenn das Objekt
    # keinen Ort trägt: dann bleibt die Zeile leer, statt einen zu erfinden.
    city: str | None = None
    items: list[PortalImage]
    total: int


class PortalPhotoAlbum(BaseModel):
    """Alle Bilder aller zugeordneten Objekte, je Objekt gruppiert."""

    groups: list[PortalAlbumGroup]
    # Summe über alle Gruppen — damit die Oberfläche „124 Bilder" schreiben
    # kann, ohne die Gruppen selbst zusammenzuzählen.
    total: int


class PortalStatisticsChannel(BaseModel):
    """Verteilung nach Buchungskanal — ausschließlich ANZAHLEN.

    Kein Betrag: Umsatz je Kanal ist genau die Auswertung, für die es
    `pm_revenue_charts` gibt, und die hat der Eigentümer nicht.
    """

    channel: str
    # Der echte Portalname (`ota_name`, z. B. „Booking.com", „myBestDays").
    # None = kein Portal im Spiel (Direktbuchung).
    ota_name: str | None = None
    # Anreisen im Zeitraum über diesen Kanal …
    reservations: int
    # … und die Nächte, die DIESE Anreisen insgesamt umfassen (der ganze
    # Aufenthalt, auch wenn er über das Zeitraum-Ende hinausreicht). Passt
    # damit zu `reservations` und `avg_stay_nights`, nicht zu `nights_booked`.
    nights: int


class PortalStatisticsMonth(BaseModel):
    """EIN Monat der Zeitreihe („Belegungsquote je Monat", „Nächte je Monat").

    Die Reihe ist LÜCKENLOS: jeder Monat zwischen `date_from` und `date_to`
    kommt vor, auch einer ganz ohne Buchung (dann 0 Nächte, aber echte
    Kapazität). Ein ausgelassener Monat sähe im Diagramm aus wie eine
    Zeitreise — die Kurve spränge über ihn hinweg, und niemand sähe der
    Zeichnung an, dass ein Monat fehlt.
    """

    # „YYYY-MM" — als String statt als Datum, weil ein Monat kein Tag ist und
    # ein `date` die Frage „welcher Tag denn?" mitschleppte.
    month: str
    # Nächte, die IN diesem Monat liegen — dieselbe Bezugsgröße wie die
    # Summenwerte. Eine über den Monatswechsel laufende Buchung teilt sich
    # entsprechend auf; die Summe über alle Monate ist exakt `nights_booked`.
    nights_booked: int
    owner_stay_nights: int
    # Einheiten × Tage DIESES Monats, die IM ZEITRAUM liegen.
    #
    # Die Randmonate sind angeschnitten: beginnt der Zeitraum am 20. Januar,
    # zählt der Januar zwölf Tage, nicht einunddreißig. Würde hier der volle
    # Monat stehen, teilte die Quote elf gemessene Nächte durch einen Nenner
    # aus neunzehn Tagen, die gar nicht abgefragt wurden — der erste und der
    # letzte Balken wären systematisch gedrückt und sähen aus wie eine
    # schwache Saison (Wurzel 4: keine plausibel aussehende Falschaussage).
    capacity_unit_nights: int
    # (nights_booked + owner_stay_nights) / capacity_unit_nights in Prozent.
    # `None`, wenn in diesem Monat keine Kapazität bestand — NIE 0: eine 0 %
    # behauptete Leerstand, wo nichts messbar war.
    occupancy_rate: float | None = None
    # ANREISEN in diesem Monat (check_in darin) — wie `reservations` oben.
    # Die Summe über alle Monate ist exakt `reservations`.
    reservations: int


class PortalStatisticsResponse(BaseModel):
    """Nicht-Umsatz-Auswertung über die Objekte des Eigentümers.

    ZWEI BEZUGSGRÖSSEN, bewusst getrennt und benannt, weil eine gemeinsame
    falsch wäre:
      * Belegung (`nights_booked`, `owner_stay_nights`, `occupancy_rate`)
        zählt NÄCHTE, die IM Zeitraum liegen — auch aus Buchungen, die davor
        begannen. Alles andere ergäbe im Januar eine Lücke für den
        Silvestergast.
      * Buchungsanzahl, Aufenthaltsdauer und Vorlaufzeit beziehen sich auf
        ANREISEN im Zeitraum (`check_in` darin). Eine Buchung ist ein
        Ereignis; sie über zwei Monate zu halbieren ergäbe keine
        Aufenthaltsdauer.
    """

    property_id: str | None = None
    date_from: date_
    date_to: date_

    # Nächte, die im Zeitraum durch GASTbuchungen belegt sind.
    nights_booked: int
    # Nächte, die der Eigentümer selbst nutzt (0241, genehmigter Sperrantrag).
    # Getrennt ausgewiesen: sie belegen den Kalender genauso, sind aber keine
    # Vermarktungsleistung. Wer beides in einer Zahl sähe, hielte die eigene
    # Ferienwoche für Auslastung.
    owner_stay_nights: int
    # Einheiten × Tage im Zeitraum = die Nächte, die überhaupt verkauft werden
    # KONNTEN. Ein Typ mit fünf Studios hat je Tag fünf Einheiten-Nächte
    # (0265) — gegen `Nächte` allein gerechnet käme 500 % heraus.
    capacity_unit_nights: int
    units_total: int
    # (nights_booked + owner_stay_nights) / capacity_unit_nights, in Prozent.
    # `None`, wenn es keine Kapazität gibt (kein zugeordnetes Objekt) — eine
    # 0 % wäre dort eine Aussage über Leistung, wo gar nichts messbar ist
    # (Wurzel 4).
    occupancy_rate: float | None = None

    # Anreisen im Zeitraum.
    reservations: int
    # Durchschnittliche Aufenthaltsdauer in Nächten. None ohne Anreise.
    avg_stay_nights: float | None = None
    # Durchschnittliche Vorlaufzeit in Tagen: von der Buchung beim Portal
    # (`reservations.booked_at`) bis zur Anreise.
    #
    # NIE aus `created_at` (Wurzel 5b): das ist der Zeitpunkt UNSERER
    # Verarbeitung. Ein Airbnb-Bestand, den der Feed in einem Rutsch holte,
    # trüge sonst für alle Buchungen dieselbe Sekunde und ergäbe eine
    # Vorlaufzeit, die plausibel aussieht und frei erfunden ist. Fehlt
    # `booked_at`, zählt die Buchung hier nicht mit — `avg_lead_time_basis`
    # sagt, auf wie vielen sie beruht, und ist bei 0 zusammen mit
    # `avg_lead_time_days = None` die ehrliche Auskunft „nicht bekannt".
    avg_lead_time_days: float | None = None
    avg_lead_time_basis: int = 0

    by_channel: list[PortalStatisticsChannel] = Field(default_factory=list)
    # Monatsreihe für die Diagramme, aufsteigend und lückenlos. Nächte und
    # Anreisen summieren sich exakt zu den Werten oben (je ein Test).
    months: list[PortalStatisticsMonth] = Field(default_factory=list)
