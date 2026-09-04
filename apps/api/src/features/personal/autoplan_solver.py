"""Autoplanung: Schichthüllen auf Personen verteilen (OR-Tools CP-SAT, §2.3).

Eine REINE Funktion ohne Datenbank. Eingabe sind Dataclasses, Ausgabe ist eine
Zuteilung mit Kennzahlen — dadurch ist der Solver einzeln testbar und der
Dienst (`ki_planung.py`) muss zum Prüfen der Regeln keine DB bauen.

Warum ein Solver und nicht das Sprachmodell (0546): Ruhezeit, Doppelbelegung
und Qualifikation sind HARTE Bedingungen. Ein Sprachmodell hält sie nicht
verlässlich ein, und ein Plan, der eine 11-Stunden-Ruhezeit in einem von zehn
Fällen verletzt, ist unbrauchbar — er sieht nur richtig aus. Gemini erklärt
hinterher die Unterschiede der Varianten; gerechnet hat CP-SAT.

Harte Regeln (eine Verletzung ist unmöglich, nicht teuer):
  * Qualifikation für den Arbeitsbereich (bei Objektbindung auch für das Objekt)
  * genehmigte Abwesenheit an einem berührten Tag
  * gesperrte Verfügbarkeit, die die Hülle überlappt
  * Doppelbelegung mit anderen Hüllen UND mit bestehenden Schichten
  * Ruhezeit zwischen zwei Blöcken derselben Person
  * Höchstarbeitszeit je Tag und je Woche
  * Jugendschutz (Tagesstunden und Nachtfenster) für Minderjährige

Weiche Ziele werden GEWICHTET summiert und minimiert. Die Gewichte je
Planungstyp stehen im Vertrag §2.3 als Tabelle und hier als `GEWICHTE` — eine
zweite Tabelle mit eigenen Zahlen wäre derselbe Fehler wie eine zweite
Währungslogik.

Ein unbesetzt gebliebener Bedarf ist erlaubt, aber teuer: lieber eine offene
Schicht als eine, die eine harte Regel bricht. Der Preis liegt über jedem
weichen Ziel, damit „unbesetzt" nie die bequemere Wahl ist.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import UTC, date, datetime, timedelta

from ortools.sat.python import cp_model

# Zeitlimit je Lauf. §2.3 deckelt bei 30 s; ohne Deckel hält ein Solver einen
# Uvicorn-Worker beliebig lange fest (Wurzel 8).
MAX_ZEITLIMIT_S = 30

# Strafe für eine unbesetzte Hülle. Über der Summe aller weichen Ziele je
# Zuteilung, damit „offen lassen" nie billiger ist als „irgendwie besetzen".
STRAFE_UNBESETZT = 1_000_000

# Alle weichen Ziele laufen auf ganzen Zahlen (CP-SAT kennt keine Brüche und
# keine Division auf Ausdrücken). Die Sollstunden-Abweichung wird in MINUTEN
# gemessen, die anderen Ziele in Einheiten von „ein Einsatz" — damit eine
# halbe Stunde Abweichung nicht so schwer wiegt wie ein ganzer Fehleinsatz,
# tragen die anderen Ziele diesen Faktor. Er ist die Auflösung des Plans
# (30 Minuten), nicht ein gewählter Zauberwert.
_SKALA = 30

# Lohnbeträge stehen in Minor (Öre/Cent) und dominieren ungeteilt JEDE
# Gewichtung: ein Achtstundendienst zu 150 DKK/h wiegt 120 000, ein
# Fehleinsatz auf der Skills-Skala 3. Der Teiler bringt einen Achtstundendienst
# in denselben Zahlenraum wie „ein Einsatz" (ein bis zwei Einheiten je
# Stundenlohn-Differenz), damit ein Betrieb, der Skills mit 3 und Kosten mit 1
# gewichtet, auch wirklich Skills bevorzugt.
#
# Gemessen ohne diesen Wert (Teiler 100): `talentscout` (Skills 3, Kosten 1)
# setzte die lernende Kraft ein, weil die Lohndifferenz 24 000 Strafpunkte
# gegen 270 der Skills-Skala trug. Eine Gewichtungstabelle, die in der
# Rechnung nichts bewegt, ist eine Attrappe (Wurzel 5).
_KOSTEN_TEILER = 10_000

GEWICHTE: dict[str, dict[str, int]] = {
    # Typ            Sollstunden  Skills  Wunsch  Fairness  Kosten
    "performer": {"soll": 3, "skills": 3, "wunsch": 1, "fairness": 1, "kosten": 1},
    "alleskoenner": {"soll": 2, "skills": 2, "wunsch": 2, "fairness": 2, "kosten": 1},
    "superfaire": {"soll": 1, "skills": 1, "wunsch": 3, "fairness": 3, "kosten": 0},
    "zeitschwaermer": {"soll": 3, "skills": 1, "wunsch": 2, "fairness": 1, "kosten": 1},
    "talentscout": {"soll": 1, "skills": 3, "wunsch": 1, "fairness": 1, "kosten": 1},
    "faire": {"soll": 3, "skills": 1, "wunsch": 1, "fairness": 3, "kosten": 0},
    "philanthrop": {"soll": 2, "skills": 3, "wunsch": 1, "fairness": 3, "kosten": 0},
}

# Skill-Kosten je Stufe: eine anleitende Kraft auf eine Hülle zu setzen, die
# eine lernende erledigen könnte, ist teuer — nicht verboten.
_STUFEN_KOSTEN = {"anleitend": 0, "selbststaendig": 1, "lernend": 3}


@dataclass(frozen=True, slots=True)
class SolverRegeln:
    """Die Betriebsregeln, soweit der Solver sie braucht (aus `personal_regeln`)."""

    zeitzone: str
    ruhezeit_stunden: float
    max_tagesstunden: float
    max_wochenstunden: float
    jugendschutz_bis_alter: int | None = None
    jugendschutz_max_tagesstunden: float | None = None
    # Nachtfenster als Minuten nach Ortszeit-Mitternacht (von, bis); über
    # Mitternacht ist `von > bis`.
    jugendschutz_nacht_von_min: int | None = None
    jugendschutz_nacht_bis_min: int | None = None


@dataclass(frozen=True, slots=True)
class Huelle:
    """Eine zu besetzende Schichthülle (aus `personal_bedarf` expandiert)."""

    id: str
    datum: date
    start_at: datetime
    end_at: datetime
    pause_min: int
    arbeitsbereich_id: str | None
    property_id: str | None
    bedarf_id: str | None = None

    @property
    def netto_minuten(self) -> int:
        return max(0, int((self.end_at - self.start_at).total_seconds() // 60) - self.pause_min)


@dataclass(frozen=True, slots=True)
class Person:
    """Eine planbare Person mit allem, was harte und weiche Regeln brauchen."""

    user_id: str
    # {arbeitsbereich_id: stufe} — Objektbindung getrennt in `quali_objekte`.
    qualifikationen: dict[str, str] = field(default_factory=dict)
    # {arbeitsbereich_id: {property_id, …}} — leer = für alle Objekte.
    quali_objekte: dict[str, set[str]] = field(default_factory=dict)
    soll_minuten_woche: int | None = None
    stundenlohn_minor: int | None = None
    currency: str | None = None
    verdienstgrenze_minor: int | None = None
    verdienstgrenze_verbraucht_minor: int = 0
    alter: int | None = None
    abwesenheits_tage: frozenset[date] = frozenset()
    # UTC-Fenster, in denen die Person nicht arbeiten will/darf.
    gesperrte_fenster: tuple[tuple[datetime, datetime], ...] = ()
    wunsch_fenster: tuple[tuple[datetime, datetime], ...] = ()


@dataclass(frozen=True, slots=True)
class Block:
    """Eine bereits bestehende Schicht — sie blockiert Zeit und zählt auf Konten."""

    user_id: str
    start_at: datetime
    end_at: datetime
    pause_min: int = 0

    @property
    def netto_minuten(self) -> int:
        return max(0, int((self.end_at - self.start_at).total_seconds() // 60) - self.pause_min)


@dataclass(frozen=True, slots=True)
class Zuteilung:
    huelle_id: str
    user_id: str


@dataclass(frozen=True, slots=True)
class Kennzahlen:
    stunden: float
    kosten_minor: int | None
    currency: str | None
    fairness_pct: float
    wunsch_erfuellt_pct: float
    unbesetzt: int
    konflikte: int


@dataclass(frozen=True, slots=True)
class Ergebnis:
    zuteilungen: tuple[Zuteilung, ...]
    kennzahlen: Kennzahlen
    status: str
    dauer_ms: int


def planen(  # noqa: PLR0913, PLR0912, PLR0915 — ein Modell mit allen Regeln
    *,
    huellen: list[Huelle],
    personen: list[Person],
    bestehende: list[Block],
    regeln: SolverRegeln,
    planungstyp: str,
    zeitlimit_s: int = 10,
    seed: int = 1,
    gewicht_verschiebung: dict[str, int] | None = None,
) -> Ergebnis:
    """Hüllen auf Personen verteilen. Deterministisch bei gleichem Seed."""
    gewichte = dict(GEWICHTE.get(planungstyp) or GEWICHTE["alleskoenner"])
    for schluessel, delta in (gewicht_verschiebung or {}).items():
        if schluessel in gewichte:
            gewichte[schluessel] = max(0, gewichte[schluessel] + delta)
    modell = cp_model.CpModel()
    zulaessig = {
        (h.id, p.user_id): _zulaessig(h, p, regeln)
        for h in huellen
        for p in personen
    }
    x: dict[tuple[str, str], cp_model.IntVar] = {}
    offen: dict[str, cp_model.IntVar] = {}
    for h in huellen:
        moeglich = [p for p in personen if zulaessig[(h.id, p.user_id)]]
        for p in moeglich:
            x[(h.id, p.user_id)] = modell.new_bool_var(f"x_{h.id}_{p.user_id}")
        offen[h.id] = modell.new_bool_var(f"offen_{h.id}")
        # Genau eine Besetzung — oder ausdrücklich offen.
        modell.add_exactly_one(
            [x[(h.id, p.user_id)] for p in moeglich] + [offen[h.id]]
        )

    strafen: list[cp_model.LinearExpr] = [STRAFE_UNBESETZT * offen[h.id] for h in huellen]

    # --- Harte Regeln je Person ---------------------------------------
    for p in personen:
        meine = [h for h in huellen if (h.id, p.user_id) in x]
        vorhanden = [b for b in bestehende if b.user_id == p.user_id]
        # Doppelbelegung untereinander.
        for i, a in enumerate(meine):
            for b in meine[i + 1 :]:
                if _ueberschneidet(a.start_at, a.end_at, b.start_at, b.end_at):
                    modell.add(x[(a.id, p.user_id)] + x[(b.id, p.user_id)] <= 1)
        # Doppelbelegung mit dem Bestand: dann darf die Hülle gar nicht an sie.
        for h in meine:
            if any(_ueberschneidet(h.start_at, h.end_at, b.start_at, b.end_at) for b in vorhanden):
                modell.add(x[(h.id, p.user_id)] == 0)
        # Ruhezeit — untereinander und gegen den Bestand.
        ruhe = timedelta(hours=regeln.ruhezeit_stunden)
        for i, a in enumerate(meine):
            for b in meine[i + 1 :]:
                if _ruhezeit_verletzt(a.start_at, a.end_at, b.start_at, b.end_at, ruhe):
                    modell.add(x[(a.id, p.user_id)] + x[(b.id, p.user_id)] <= 1)
        for h in meine:
            if any(
                _ruhezeit_verletzt(h.start_at, h.end_at, b.start_at, b.end_at, ruhe)
                for b in vorhanden
            ):
                modell.add(x[(h.id, p.user_id)] == 0)
        # Höchstarbeitszeit je Tag (Ortstag), inkl. Jugendschutz.
        max_tag = regeln.max_tagesstunden
        if (
            p.alter is not None
            and regeln.jugendschutz_bis_alter is not None
            and p.alter < regeln.jugendschutz_bis_alter
            and regeln.jugendschutz_max_tagesstunden is not None
        ):
            max_tag = min(max_tag, regeln.jugendschutz_max_tagesstunden)
        tage = {h.datum for h in meine}
        for tag in sorted(tage):
            am_tag = [h for h in meine if h.datum == tag]
            bestand_min = sum(
                b.netto_minuten for b in vorhanden if b.start_at.date() == tag
            )
            modell.add(
                sum(h.netto_minuten * x[(h.id, p.user_id)] for h in am_tag)
                <= max(0, int(max_tag * 60) - bestand_min)
            )
        # Höchstarbeitszeit je Woche (Mo–So).
        wochen = {_woche(h.datum) for h in meine}
        for woche in sorted(wochen):
            in_woche = [h for h in meine if _woche(h.datum) == woche]
            bestand_min = sum(
                b.netto_minuten for b in vorhanden if _woche(b.start_at.date()) == woche
            )
            modell.add(
                sum(h.netto_minuten * x[(h.id, p.user_id)] for h in in_woche)
                <= max(0, int(regeln.max_wochenstunden * 60) - bestand_min)
            )
        # Verdienstgrenze: harte Obergrenze, wenn Grenze UND Lohn bekannt sind.
        if p.verdienstgrenze_minor is not None and p.stundenlohn_minor:
            rest = max(0, p.verdienstgrenze_minor - p.verdienstgrenze_verbraucht_minor)
            modell.add(
                sum(
                    round(p.stundenlohn_minor * h.netto_minuten / 60) * x[(h.id, p.user_id)]
                    for h in meine
                )
                <= rest
            )

    # --- Weiche Ziele --------------------------------------------------
    if gewichte["skills"]:
        for h in huellen:
            for p in personen:
                if (h.id, p.user_id) not in x:
                    continue
                stufe = p.qualifikationen.get(h.arbeitsbereich_id or "", "selbststaendig")
                strafen.append(
                    _SKALA
                    * gewichte["skills"]
                    * _STUFEN_KOSTEN.get(stufe, 1)
                    * x[(h.id, p.user_id)]
                )
    if gewichte["wunsch"]:
        for h in huellen:
            for p in personen:
                if (h.id, p.user_id) not in x:
                    continue
                # Kein Wunsch = neutral; ein Wunsch, der passt, ist billiger.
                passt = any(
                    _ueberschneidet(h.start_at, h.end_at, von, bis)
                    for von, bis in p.wunsch_fenster
                )
                if p.wunsch_fenster and not passt:
                    strafen.append(_SKALA * gewichte["wunsch"] * 2 * x[(h.id, p.user_id)])
    if gewichte["kosten"]:
        for h in huellen:
            for p in personen:
                if (h.id, p.user_id) not in x or not p.stundenlohn_minor:
                    continue
                betrag = round(p.stundenlohn_minor * h.netto_minuten / 60 / _KOSTEN_TEILER)
                strafen.append(_SKALA * gewichte["kosten"] * betrag * x[(h.id, p.user_id)])
    if gewichte["soll"]:
        # Abweichung von den Sollstunden je Person, in Minuten, beide Richtungen.
        for p in personen:
            if p.soll_minuten_woche is None:
                continue
            meine = [h for h in huellen if (h.id, p.user_id) in x]
            if not meine:
                continue
            bestand = sum(b.netto_minuten for b in bestehende if b.user_id == p.user_id)
            obergrenze = bestand + sum(h.netto_minuten for h in meine)
            geplant = modell.new_int_var(0, max(1, obergrenze), f"soll_{p.user_id}")
            modell.add(
                geplant
                == bestand + sum(h.netto_minuten * x[(h.id, p.user_id)] for h in meine)
            )
            abweichung = modell.new_int_var(
                0, max(1, obergrenze + p.soll_minuten_woche), f"abw_{p.user_id}"
            )
            modell.add(abweichung >= geplant - p.soll_minuten_woche)
            modell.add(abweichung >= p.soll_minuten_woche - geplant)
            # Halbe Stunden sind die Auflösung, in der ein Dienstplan gedacht
            # wird — darum das Gewicht durch 30 geteilt und nicht die Variable
            # (CP-SAT kennt keine Division auf Ausdrücken).
            strafen.append(gewichte["soll"] * abweichung)
    # Fairness zählt nur unter den Personen, die überhaupt eingeteilt werden
    # KÖNNEN. Wer für keine Hülle qualifiziert ist, hat zwangsläufig null
    # Einsätze — ihn mitzuzählen würde die Spanne dauerhaft auf das Maximum
    # treiben und das Ziel wirkungslos machen (gemessen: 0 % Fairness bei
    # perfekt gleicher Verteilung unter den Einsetzbaren).
    einsetzbar = [p for p in personen if any((h.id, p.user_id) in x for h in huellen)]
    if gewichte["fairness"] and einsetzbar:
        maximum = modell.new_int_var(0, len(huellen), "einsatz_max")
        minimum = modell.new_int_var(0, len(huellen), "einsatz_min")
        we_max = modell.new_int_var(0, len(huellen), "we_max")
        for p in einsetzbar:
            meine = [h for h in huellen if (h.id, p.user_id) in x]
            summe = sum(x[(h.id, p.user_id)] for h in meine)
            modell.add(maximum >= summe)
            modell.add(minimum <= summe)
            wochenende = [h for h in meine if h.datum.weekday() >= 5]
            we_summe = sum(x[(h.id, p.user_id)] for h in wochenende) if wochenende else 0
            modell.add(we_max >= we_summe)
        strafen.append(_SKALA * gewichte["fairness"] * 4 * (maximum - minimum))
        strafen.append(_SKALA * gewichte["fairness"] * 2 * we_max)

    modell.minimize(sum(strafen))
    loeser = cp_model.CpSolver()
    loeser.parameters.max_time_in_seconds = float(max(1, min(zeitlimit_s, MAX_ZEITLIMIT_S)))
    loeser.parameters.random_seed = seed
    # Ein Thread: mehrere Threads machen das Ergebnis bei gleichem Seed
    # nichtdeterministisch, und ein nicht reproduzierbarer Plan lässt sich
    # nicht erklären (die Variantenerklärung wäre wertlos).
    loeser.parameters.num_search_workers = 1
    status = loeser.solve(modell)
    dauer_ms = int(loeser.wall_time * 1000)
    if status not in (cp_model.OPTIMAL, cp_model.FEASIBLE):
        return Ergebnis(
            zuteilungen=(),
            kennzahlen=Kennzahlen(0.0, None, None, 0.0, 0.0, len(huellen), 0),
            status=loeser.status_name(status),
            dauer_ms=dauer_ms,
        )
    zuteilungen = tuple(
        Zuteilung(huelle_id=h.id, user_id=p.user_id)
        for h in huellen
        for p in personen
        if (h.id, p.user_id) in x and loeser.value(x[(h.id, p.user_id)])
    )
    return Ergebnis(
        zuteilungen=zuteilungen,
        kennzahlen=_kennzahlen(zuteilungen, huellen, personen, x),
        status=loeser.status_name(status),
        dauer_ms=dauer_ms,
    )


# --- Zulässigkeit (die harten Regeln je Paar) --------------------------------


def _zulaessig(h: Huelle, p: Person, regeln: SolverRegeln) -> bool:
    """Darf diese Person diese Hülle überhaupt übernehmen?

    Fail-closed: was nicht ausdrücklich erlaubt ist, wird nicht zugeteilt. Eine
    Hülle ohne Arbeitsbereich verlangt keine Qualifikation (dann ist keine
    hinterlegt); eine MIT Bereich verlangt sie ausdrücklich.
    """
    if h.arbeitsbereich_id:
        stufe = p.qualifikationen.get(h.arbeitsbereich_id)
        if stufe is None:
            return False
        objekte = p.quali_objekte.get(h.arbeitsbereich_id) or set()
        if objekte and h.property_id and h.property_id not in objekte:
            return False
    tage = {h.start_at.date(), h.datum, (h.end_at - timedelta(microseconds=1)).date()}
    if tage & set(p.abwesenheits_tage):
        return False
    if any(
        _ueberschneidet(h.start_at, h.end_at, von, bis) for von, bis in p.gesperrte_fenster
    ):
        return False
    if h.netto_minuten > regeln.max_tagesstunden * 60:
        return False
    return not _jugend_nacht_verletzt(h, p, regeln)


def _jugend_nacht_verletzt(h: Huelle, p: Person, regeln: SolverRegeln) -> bool:
    """Liegt die Hülle für eine minderjährige Person im Jugend-Nachtfenster?

    Ohne Geburtsdatum (also ohne `alter`) keine Prüfung — geraten wird nicht
    (Wurzel 4): eine erfundene Volljährigkeit wäre so falsch wie eine
    erfundene Minderjährigkeit, nur unauffälliger.
    """
    if (
        p.alter is None
        or regeln.jugendschutz_bis_alter is None
        or p.alter >= regeln.jugendschutz_bis_alter
        or regeln.jugendschutz_nacht_von_min is None
        or regeln.jugendschutz_nacht_bis_min is None
    ):
        return False
    von, bis = regeln.jugendschutz_nacht_von_min, regeln.jugendschutz_nacht_bis_min
    minute = h.start_at.astimezone(UTC)
    ende = h.end_at.astimezone(UTC)
    while minute < ende:
        # Minutengenau statt „beginnt nachts": eine Schicht 19–22 Uhr berührt
        # ein Fenster ab 20 Uhr, ihr Beginn aber nicht.
        m = minute.hour * 60 + minute.minute
        if (von <= m or m < bis) if von > bis else (von <= m < bis):
            return True
        minute += timedelta(minutes=15)
    return False


def _ueberschneidet(a1: datetime, a2: datetime, b1: datetime, b2: datetime) -> bool:
    return a1 < b2 and b1 < a2


def _ruhezeit_verletzt(
    a1: datetime, a2: datetime, b1: datetime, b2: datetime, ruhe: timedelta
) -> bool:
    if _ueberschneidet(a1, a2, b1, b2):
        return False
    abstand = b1 - a2 if a2 <= b1 else a1 - b2
    return timedelta(0) <= abstand < ruhe


def _woche(tag: date) -> date:
    return tag - timedelta(days=tag.weekday())


def _kennzahlen(
    zuteilungen: tuple[Zuteilung, ...],
    huellen: list[Huelle],
    personen: list[Person],
    zulaessige_paare: dict[tuple[str, str], object],
) -> Kennzahlen:
    je_huelle = {h.id: h for h in huellen}
    je_person = {p.user_id: p for p in personen}
    minuten = sum(je_huelle[z.huelle_id].netto_minuten for z in zuteilungen)
    kosten = 0
    currency: str | None = None
    kosten_zaehlbar = True
    wunsch_moeglich = 0
    wunsch_erfuellt = 0
    # Dieselbe Grundmenge wie das Fairness-Ziel im Modell: nur einsetzbare
    # Personen. Sonst meldet die Kennzahl 0 %, wo das Modell 100 % optimiert.
    einsaetze: dict[str, int] = {
        p.user_id: 0
        for p in personen
        if any((h.id, p.user_id) in zulaessige_paare for h in huellen)
    }
    for z in zuteilungen:
        h, p = je_huelle[z.huelle_id], je_person[z.user_id]
        einsaetze[z.user_id] = einsaetze.get(z.user_id, 0) + 1
        if p.stundenlohn_minor and p.currency:
            if currency is None:
                currency = p.currency
            if currency != p.currency:
                # Gemischte Währungen (Wurzel 4): keine Summe, sondern None.
                kosten_zaehlbar = False
            kosten += round(p.stundenlohn_minor * h.netto_minuten / 60)
        elif p.stundenlohn_minor:
            kosten_zaehlbar = False
        if p.wunsch_fenster:
            wunsch_moeglich += 1
            if any(
                _ueberschneidet(h.start_at, h.end_at, von, bis) for von, bis in p.wunsch_fenster
            ):
                wunsch_erfuellt += 1
    werte = sorted(einsaetze.values())
    spanne = (werte[-1] - werte[0]) if werte else 0
    hoechst = werte[-1] if werte else 0
    return Kennzahlen(
        stunden=round(minuten / 60, 2),
        kosten_minor=kosten if kosten_zaehlbar and currency else None,
        currency=currency if kosten_zaehlbar else None,
        # 100 % = alle gleich viele Einsätze; 0 % = einer hat alles.
        fairness_pct=round(100 * (1 - spanne / hoechst), 1) if hoechst else 100.0,
        wunsch_erfuellt_pct=(
            round(100 * wunsch_erfuellt / wunsch_moeglich, 1) if wunsch_moeglich else 100.0
        ),
        unbesetzt=len(huellen) - len(zuteilungen),
        # Harte Regeln sind Modellbedingungen — eine erfüllte Lösung hat keine.
        konflikte=0,
    )
