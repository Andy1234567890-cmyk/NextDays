"""Der Rechenkern des Personalbereichs — reine Funktionen ohne Datenbank (0541).

Aus Taskilo übernommen wurde die STRUKTUR (Konfliktarten, Zuschlagsklassen,
Urlaubsrechnung), nicht der Code: dort waren Grenzwerte (11 h, 10 h, 22–6 Uhr)
deutsche Hardcodes. Hier kommt alles aus den bestätigten Betriebsregeln
(`personal_regeln`) — es gibt keinen Default (Wurzel 4).

Zeitzonen: Kalendertag, Nachtfenster und Sonntag sind Fragen der ORTSZEIT.
Jede Funktion bekommt die Zone (IANA) mit und rechnet in ihr; gespeichert und
übergeben wird UTC.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import UTC, date, datetime, time, timedelta
from decimal import ROUND_HALF_UP, Decimal
from zoneinfo import ZoneInfo

# Halbe Tage rechnen mit 0,5; Rundung auf zwei Stellen für Konten.
_ZWEI = Decimal("0.01")


@dataclass(frozen=True, slots=True)
class Regeln:
    """Die bestätigten Betriebsregeln als Rechenwerte.

    Die Felder aus 0541 sind Pflicht (ohne sie gibt es keinen Plan). Die Felder
    aus 0544/0545 tragen Defaults, weil die Migration sie mit Default anlegt —
    das ist kein erfundener Ersatzwert (Wurzel 4), sondern der DB-Stand.
    """

    zeitzone: str
    ruhezeit_stunden: float
    max_tagesstunden: float
    max_wochenstunden: float
    nacht_von: time
    nacht_bis: time
    zuschlag_nacht_pct: float
    zuschlag_sonntag_pct: float
    zuschlag_feiertag_pct: float
    zuschlag_ueberstunden_pct: float
    urlaubsjahr_start_monat: int
    uebertrag_verfall_monat: int | None
    uebertrag_max_tage: float | None
    mindest_vorlauf_urlaub_tage: int
    # --- Jugendschutz (0544). None = keine Prüfung. -------------------------
    jugendschutz_bis_alter: int | None = None
    jugendschutz_max_tagesstunden: float | None = None
    jugendschutz_nacht_von: time | None = None
    jugendschutz_nacht_bis: time | None = None
    # --- Abwesenheit (0544) -------------------------------------------------
    zweistufige_genehmigung: bool = False
    max_urlaub_zusammenhaengend_tage: int | None = None
    # --- Zeiterfassung (0544) -----------------------------------------------
    gps_pflicht: bool = False
    gps_radius_m: int = 250
    stempel_ab_schichtbeginn: bool = False
    verspaetung_melden_min: int | None = None
    terminal_aktiv: bool = False
    wetter_anzeigen: bool = True
    # --- Kennzahlen-Ziele (0545) --------------------------------------------
    ziel_umsatzproduktivitaet_minor: int | None = None
    ziel_personalkostenquote_pct: float | None = None
    kennzahlen_currency: str | None = None
    kennzahlen_zeilen: tuple[str, ...] = ("besetzung", "stundenlimit")


@dataclass(frozen=True, slots=True)
class Zeitblock:
    """Ein Arbeitsblock (Schicht oder Stempelung) in UTC."""

    id: str
    user_id: str | None
    start_at: datetime
    end_at: datetime
    pause_min: int = 0
    property_id: str | None = None
    arbeitsbereich_id: str | None = None


@dataclass(frozen=True, slots=True)
class Konflikt:
    art: str
    schwere: str  # warnung | fehler
    werte: dict[str, float | str] = field(default_factory=dict)


@dataclass(frozen=True, slots=True)
class Verdienstgrenze:
    """Verdienstgrenze der Person und was im Zeitraum schon verplant ist (0544).

    `geplant_minor` enthält die schon vorhandenen Schichten OHNE die geprüfte;
    `konflikte_pruefen` rechnet die neue Schicht selbst dazu.
    """

    grenze_minor: int
    currency: str
    stundenlohn_minor: int
    geplant_minor: int
    zeitraum: str  # monat | jahr


@dataclass(frozen=True, slots=True)
class Zuschlaege:
    netto_min: int
    nacht_min: int
    sonntag_min: int
    feiertag_min: int


def zone(regeln: Regeln | str) -> ZoneInfo:
    return ZoneInfo(regeln if isinstance(regeln, str) else regeln.zeitzone)


def ortstag(zeitpunkt: datetime, zeitzone: str) -> date:
    """Kalendertag eines UTC-Zeitpunkts in der Betriebszone."""
    return zeitpunkt.astimezone(zone(zeitzone)).date()


def netto_minuten(start_at: datetime, end_at: datetime, pause_min: int) -> int:
    brutto = int((end_at - start_at).total_seconds() // 60)
    return max(0, brutto - max(0, pause_min))


def pausen_minuten(pausen: list[dict[str, object]], *, jetzt: datetime | None = None) -> int:
    """Summe der Pausen einer Stempelung; eine laufende Pause zählt bis `jetzt`."""
    summe = 0
    for p in pausen:
        start = _dt(p.get("start"))
        ende = _dt(p.get("end")) or jetzt
        if start and ende and ende > start:
            summe += int((ende - start).total_seconds() // 60)
    return summe


def pause_automatisch(arbeitsminuten: int, modelle: list[tuple[int, int]]) -> int:
    """Pflichtpause nach dem größten passenden Modell (ab_minuten, pause_minuten).

    Die Stufen sind nicht kumulativ: „ab 360 → 30, ab 540 → 45" heißt bei 9,5 h
    Arbeit 45 Minuten, nicht 75 — so lesen es ArbZG §4 und die meisten Tarife.
    """
    passend = [pause for ab, pause in modelle if arbeitsminuten >= ab]
    return max(passend) if passend else 0


# --- Konflikte ----------------------------------------------------------------


def _ueberschneidet(a: Zeitblock, b: Zeitblock) -> bool:
    return a.start_at < b.end_at and b.start_at < a.end_at


def _jugendschutz_konflikte(
    neu: Zeitblock, *, regeln: Regeln, geburtsdatum: date | None, netto: int, tz: ZoneInfo
) -> list[Konflikt]:
    """Jugendschutz: Alter, Tageshöchstdauer und Nachtfenster (0544).

    Ohne Geburtsdatum gibt es KEINE Prüfung — ein geschätztes Alter wäre ein
    erfundener Wert (Wurzel 4). Ohne Altersgrenze in den Regeln ebenso.
    """
    if regeln.jugendschutz_bis_alter is None or geburtsdatum is None:
        return []
    tag = neu.start_at.astimezone(tz).date()
    # Alter am Tag der Schicht, nicht heute: eine Schicht in drei Monaten
    # fällt womöglich schon hinter den Geburtstag.
    alter = (
        tag.year
        - geburtsdatum.year
        - ((tag.month, tag.day) < (geburtsdatum.month, geburtsdatum.day))
    )
    if alter >= regeln.jugendschutz_bis_alter:
        return []
    konflikte: list[Konflikt] = []
    max_std = regeln.jugendschutz_max_tagesstunden
    if max_std is not None and netto > max_std * 60:
        konflikte.append(
            Konflikt(
                "jugendschutz",
                "fehler",
                {"alter": alter, "max_stunden": max_std, "ist_stunden": round(netto / 60, 2)},
            )
        )
    von, bis = regeln.jugendschutz_nacht_von, regeln.jugendschutz_nacht_bis
    if von is not None and bis is not None and _beruehrt_nacht(neu, von, bis, tz):
        konflikte.append(
            Konflikt(
                "jugendschutz",
                "fehler",
                {
                    "alter": alter,
                    "nacht_von": von.strftime("%H:%M"),
                    "nacht_bis": bis.strftime("%H:%M"),
                },
            )
        )
    return konflikte


def _beruehrt_nacht(neu: Zeitblock, von: time, bis: time, tz: ZoneInfo) -> bool:
    """Liegt irgendeine Minute der Schicht im Nachtfenster (Ortszeit)?

    Minutenweise wie `zuschlaege_berechnen`: „beginnt vor 20 Uhr" sagt nichts
    darüber, ob die Schicht bis 22 Uhr läuft.
    """
    brutto = int((neu.end_at - neu.start_at).total_seconds() // 60)
    lokal = neu.start_at.astimezone(tz)
    for _ in range(max(0, brutto)):
        if _in_nacht(lokal.time(), von, bis):
            return True
        lokal += timedelta(minutes=1)
    return False


def konflikte_pruefen(  # noqa: PLR0913 — jede Quelle ist ein eigener Konflikt
    neu: Zeitblock,
    *,
    regeln: Regeln,
    andere: list[Zeitblock],
    abwesenheits_tage: set[date],
    gesperrte_fenster: list[tuple[datetime, datetime]],
    urlaubssperren_tage: set[date],
    qualifiziert: bool | None,
    geburtsdatum: date | None = None,
    verdienstgrenze: Verdienstgrenze | None = None,
) -> list[Konflikt]:
    """Alle Konflikte einer neuen/geänderten Schicht gegen Regeln und Bestand.

    `andere` sind die übrigen Blöcke DERSELBEN Person (die geprüfte Schicht
    selbst ausgenommen). `qualifiziert=None` heißt: kein Arbeitsbereich an der
    Schicht, Prüfung entfällt.

    `geburtsdatum` und `verdienstgrenze` sind neu (0544) und haben einen
    Default, damit bestehende Aufrufer unverändert laufen; fehlt der Wert,
    entfällt die jeweilige Prüfung, sie schlägt nicht mit einem Ersatzwert zu.
    """
    konflikte: list[Konflikt] = []
    tz = zone(regeln)
    netto = netto_minuten(neu.start_at, neu.end_at, neu.pause_min)

    # Doppelbelegung: derselbe Mensch kann nicht zweimal gleichzeitig arbeiten.
    for b in andere:
        if _ueberschneidet(neu, b):
            konflikte.append(
                Konflikt(
                    "doppelbelegung",
                    "fehler",
                    {"schicht_id": b.id, "start": b.start_at.isoformat()},
                )
            )

    # Höchstarbeitszeit je Tag: Summe aller Blöcke, die am selben Ortstag
    # beginnen, plus die neue Schicht.
    tag = neu.start_at.astimezone(tz).date()
    tages_min = netto + sum(
        netto_minuten(b.start_at, b.end_at, b.pause_min)
        for b in andere
        if b.start_at.astimezone(tz).date() == tag
    )
    if tages_min > regeln.max_tagesstunden * 60:
        konflikte.append(
            Konflikt(
                "max_tagesstunden",
                "fehler",
                {"ist": round(tages_min / 60, 2), "max": regeln.max_tagesstunden},
            )
        )

    # Höchstarbeitszeit je Woche (Mo–So in Ortszeit).
    woche_start = tag - timedelta(days=tag.weekday())
    woche_ende = woche_start + timedelta(days=6)
    wochen_min = netto + sum(
        netto_minuten(b.start_at, b.end_at, b.pause_min)
        for b in andere
        if woche_start <= b.start_at.astimezone(tz).date() <= woche_ende
    )
    if wochen_min > regeln.max_wochenstunden * 60:
        konflikte.append(
            Konflikt(
                "max_wochenstunden",
                "warnung",
                {"ist": round(wochen_min / 60, 2), "max": regeln.max_wochenstunden},
            )
        )

    # Ruhezeit: Abstand zum vorherigen Ende und zum nächsten Start.
    ruhe = timedelta(hours=regeln.ruhezeit_stunden)
    for b in andere:
        if _ueberschneidet(neu, b):
            continue
        abstand = neu.start_at - b.end_at if b.end_at <= neu.start_at else b.start_at - neu.end_at
        if timedelta(0) <= abstand < ruhe:
            konflikte.append(
                Konflikt(
                    "ruhezeit",
                    "fehler",
                    {
                        "ist": round(abstand.total_seconds() / 3600, 2),
                        "min": regeln.ruhezeit_stunden,
                        "schicht_id": b.id,
                    },
                )
            )

    # Abwesenheit (genehmigt) an einem berührten Tag.
    ende_tag = (neu.end_at - timedelta(microseconds=1)).astimezone(tz).date()
    beruehrt = {tag, ende_tag}
    if beruehrt & abwesenheits_tage:
        konflikte.append(Konflikt("abwesenheit", "fehler", {"tag": tag.isoformat()}))
    if beruehrt & urlaubssperren_tage:
        # Eine Sperre verbietet URLAUB, nicht Arbeit — für die Schicht nur ein Hinweis.
        konflikte.append(Konflikt("urlaubssperre", "warnung", {"tag": tag.isoformat()}))

    # Gesperrte Zeiten (Wunsch-/Sperrzeiten der Person).
    for von, bis in gesperrte_fenster:
        if neu.start_at < bis and von < neu.end_at:
            konflikte.append(
                Konflikt(
                    "gesperrt",
                    "warnung",
                    {"von": von.isoformat(), "bis": bis.isoformat()},
                )
            )
            break

    if qualifiziert is False:
        konflikte.append(Konflikt("qualifikation", "warnung", {}))

    konflikte.extend(
        _jugendschutz_konflikte(
            neu, regeln=regeln, geburtsdatum=geburtsdatum, netto=netto, tz=tz
        )
    )

    # Verdienstgrenze (Aushilfen): geplant + diese Schicht gegen die Grenze.
    # Warnung, nicht Fehler — die Grenze ist eine Vereinbarung, kein Verbot,
    # und die Planung entscheidet, ob sie sie überschreitet.
    if verdienstgrenze is not None:
        neu_minor = int(
            (
                Decimal(verdienstgrenze.stundenlohn_minor) * Decimal(netto) / Decimal(60)
            ).quantize(Decimal("1"), rounding=ROUND_HALF_UP)
        )
        geplant = verdienstgrenze.geplant_minor + neu_minor
        if geplant > verdienstgrenze.grenze_minor:
            konflikte.append(
                Konflikt(
                    "verdienstgrenze",
                    "warnung",
                    {
                        "grenze_minor": verdienstgrenze.grenze_minor,
                        "geplant_minor": geplant,
                        "currency": verdienstgrenze.currency,
                    },
                )
            )

    return konflikte


def hat_fehler(konflikte: list[Konflikt]) -> bool:
    return any(k.schwere == "fehler" for k in konflikte)


def sperrfenster(  # noqa: PLR0913 — die vier Formen der Verfügbarkeit
    *,
    wochentag: int | None,
    datum_von: date | None,
    datum_bis: date | None,
    zeit_von: time | None,
    zeit_bis: time | None,
    ganztags: bool,
    von: date,
    bis: date,
    zeitzone: str,
) -> list[tuple[datetime, datetime]]:
    """Eine Verfügbarkeitsregel in konkrete UTC-Fenster im Zeitraum [von, bis]."""
    tz = zone(zeitzone)
    fenster: list[tuple[datetime, datetime]] = []
    tag = von
    while tag <= bis:
        passt = (wochentag is not None and tag.weekday() == wochentag) or (
            datum_von is not None and datum_bis is not None and datum_von <= tag <= datum_bis
        )
        if passt:
            if ganztags or zeit_von is None or zeit_bis is None:
                start = datetime.combine(tag, time(0, 0), tz)
                ende = start + timedelta(days=1)
            else:
                start = datetime.combine(tag, zeit_von, tz)
                ende = datetime.combine(tag, zeit_bis, tz)
                if ende <= start:
                    ende += timedelta(days=1)
            fenster.append((start.astimezone(UTC), ende.astimezone(UTC)))
        tag += timedelta(days=1)
    return fenster


# --- Zuschläge ----------------------------------------------------------------


def _in_nacht(t: time, von: time, bis: time) -> bool:
    if von <= bis:
        return von <= t < bis
    return t >= von or t < bis


def zuschlaege_berechnen(
    start_at: datetime,
    end_at: datetime,
    pause_min: int,
    *,
    regeln: Regeln,
    feiertage: set[date],
) -> Zuschlaege:
    """Minutenweise Einordnung in Nacht / Sonntag / Feiertag (Ortszeit).

    Minutenweise statt „Schicht beginnt nachts": eine Schicht 20–02 Uhr hat vier
    Nachtstunden, nicht null und nicht sechs. Die Pause wird anteilig vom
    Brutto abgezogen (Zuschlagsminuten × netto/brutto), weil ihre Lage in der
    Schicht nicht bekannt ist.
    """
    tz = zone(regeln)
    brutto = int((end_at - start_at).total_seconds() // 60)
    if brutto <= 0:
        return Zuschlaege(0, 0, 0, 0)
    nacht = sonntag = feiertag = 0
    lokal = start_at.astimezone(tz)
    for _ in range(brutto):
        t = lokal.time()
        tag = lokal.date()
        if _in_nacht(t, regeln.nacht_von, regeln.nacht_bis):
            nacht += 1
        if tag in feiertage:
            feiertag += 1
        elif tag.weekday() == 6:
            sonntag += 1
        lokal += timedelta(minutes=1)
    netto = max(0, brutto - max(0, pause_min))
    faktor = netto / brutto
    return Zuschlaege(
        netto_min=netto,
        nacht_min=round(nacht * faktor),
        sonntag_min=round(sonntag * faktor),
        feiertag_min=round(feiertag * faktor),
    )


def zuschlag_betrag_minor(stundenlohn_minor: int, minuten: int, pct: float) -> int:
    """Zuschlagsbetrag (Minor-Einheit) für `minuten` bei `pct` Prozent."""
    return int(
        (
            Decimal(stundenlohn_minor)
            * Decimal(minuten)
            / Decimal(60)
            * Decimal(pct)
            / Decimal(100)
        ).quantize(Decimal("1"), rounding=ROUND_HALF_UP)
    )


# --- Urlaub -------------------------------------------------------------------


def arbeitstage_zaehlen(
    von: date, bis: date, *, arbeitstage: set[int], feiertage: set[date]
) -> int:
    """Arbeitstage im Zeitraum (Wochentage 0–6 der Person, ohne Feiertage)."""
    n = 0
    tag = von
    while tag <= bis:
        if tag.weekday() in arbeitstage and tag not in feiertage:
            n += 1
        tag += timedelta(days=1)
    return n


def abwesenheitstage(  # noqa: PLR0913 — Zeitraum + Halbtage + Kalender
    von: date,
    bis: date,
    *,
    halbtag_start: bool,
    halbtag_ende: bool,
    arbeitstage: set[int],
    feiertage: set[date],
) -> Decimal:
    tage = Decimal(arbeitstage_zaehlen(von, bis, arbeitstage=arbeitstage, feiertage=feiertage))
    if tage == 0:
        return tage
    if halbtag_start and von.weekday() in arbeitstage and von not in feiertage:
        tage -= Decimal("0.5")
    if halbtag_ende and von != bis and bis.weekday() in arbeitstage and bis not in feiertage:
        tage -= Decimal("0.5")
    return max(Decimal(0), tage).quantize(_ZWEI)


def urlaubsjahr(jahr: int, start_monat: int) -> tuple[date, date]:
    """Beginn/Ende des Urlaubsjahres, das im Kalenderjahr `jahr` BEGINNT."""
    beginn = date(jahr, start_monat, 1)
    ende = (
        date(jahr + 1, start_monat, 1) - timedelta(days=1)
        if start_monat > 1
        else date(jahr, 12, 31)
    )
    return beginn, ende


def anspruch_anteilig(
    voll: Decimal, *, jahr_von: date, jahr_bis: date, eintritt: date | None, austritt: date | None
) -> tuple[Decimal, bool]:
    """Anteiliger Anspruch nach vollen Monaten im Urlaubsjahr (Zwölftelung).

    Zwölftelung ist die verbreitete Regel (BUrlG §5, Ferieloven optjening je
    Monat); Rundung auf halbe Tage aufwärts wie BUrlG §5 Abs. 2.
    """
    von = max(jahr_von, eintritt) if eintritt else jahr_von
    bis = min(jahr_bis, austritt) if austritt else jahr_bis
    if von <= jahr_von and bis >= jahr_bis:
        return voll, False
    if bis < von:
        return Decimal(0), True
    monate = (bis.year - von.year) * 12 + bis.month - von.month + 1
    # Angebrochene Monate am Rand zählen nicht (BUrlG §5: „volle Monate").
    if von.day != 1:
        monate -= 1
    if (bis + timedelta(days=1)).day != 1:
        monate -= 1
    monate = max(0, min(12, monate))
    anteil = voll * Decimal(monate) / Decimal(12)
    # Auf halbe Tage aufrunden.
    halbe = (anteil * 2).to_integral_value(rounding="ROUND_CEILING") / Decimal(2)
    return halbe.quantize(_ZWEI), True


def _dt(wert: object) -> datetime | None:
    if isinstance(wert, datetime):
        return wert if wert.tzinfo else wert.replace(tzinfo=UTC)
    if isinstance(wert, str) and wert:
        try:
            return datetime.fromisoformat(wert.replace("Z", "+00:00"))
        except ValueError:
            return None
    return None
