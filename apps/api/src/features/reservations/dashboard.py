"""Startseiten-Dashboard des reservations-Slice.

Eigenes Modul und nicht in `reads.py`: die Datei stand mit dem Dashboard darin
bei über 1500 Zeilen (pylint `too-many-lines`) — dieselbe Begründung, aus der
im inbox-Slice `kennzahlen.py` und `spiegel.py` herausgelöst wurden. Getrennt
liegt hier ausserdem beisammen, was fachlich zusammengehoert: eine Startseite
aus mehreren Toepfen (Reservierungen, Zusatzleistungen, Objektbestand).

Mixin auf `ReservationsBase`; `service.py` komponiert es in
`ReservationsService`. Alle Methoden sind tenant-/owner-gescoped (§4.2) und
maskierungskonform (§4).
"""
from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, date, datetime, timedelta

from src.core.bestand import nur_im_bestand
from src.core.security import AuthContext
from src.core.supabase import fetch_all_rows
from src.core.zeitraum import STANDARD_ZEITRAUM, UnbekannterZeitraum
from src.core.zeitraum import tage_fuer as _tage_fuer

from ._base import (
    _NICHT_BELEGEND,
    GuestMask,
    ReservationError,
    ReservationsBase,
    _as_date,
    anzeigename,
    load_guest_mask,
)
from .schemas import (
    DashboardAddon,
    DashboardEntry,
    DashboardFenster,
    DashboardKpi,
    DashboardKpiMetrik,
    DashboardKpiResponse,
    DashboardListe,
    DashboardListeResponse,
    DashboardResponse,
)

# Dashboard: KPIs vergleichen 30 Tage mit den 30 davor (59 Tage zurück); ein
# Puffertag deckt Zeitzonen-/Tageswechsel ab.
_DASHBOARD_RUECKBLICK_TAGE = 60
# Die „anstehende Anreisen"-Liste der Startseite zeigt nur die nächsten Tage —
# ohne Deckel geht bei gut gebuchten Betrieben der gesamte Zukunftsbestand raus.
_DASHBOARD_UPCOMING_MAX = 50
# Blockgroesse fuer `in_`-Filter auf UUID-Listen (Zusatzleistungen, Threads,
# uebernommene Verlaeufe): die Liste geht als Filter in die URL und reisst bei
# grossem Bestand die Laengengrenze.
#
# Gemessen gegen die Live-Instanz (18.08.2026): 200 UUIDs ergeben 7.519 Zeichen
# Adresse und gehen durch, 250 ergeben 9.369 und liefern HTTP 414 „URI too
# long" — Kong deckelt bei 8 KB. 100 UUIDs sind rund 3.800 Zeichen und lassen
# damit die Haelfte als Reserve fuer laengere Tabellen-/Spaltennamen und
# zusaetzliche Filter.
#
# Warum 100 und nicht die vorher hier stehenden 200: die lagen nur 500 Zeichen
# unter der Grenze. Das hielt, solange die Adresse kurz war, und waere beim
# naechsten zusaetzlichen Filter unbemerkt gekippt.
_ID_CHUNK = 100
# „Neu eingegangen": Fenster in TAGEN über den Buchungszeitpunkt. Geladen wird
# das GRÖSSTE Fenster (30 Tage); die Startseite bietet darin 24 h / 7 / 30 Tage
# zur Auswahl und filtert die kürzeren selbst. Ein Nachladen je Umschalten
# wäre eine Server-Runde für Daten, die schon im Browser liegen — und die
# Umschaltung fühlte sich träge an.
_DASHBOARD_NEU_TAGE = 30
# … und ein Deckel, weil das Fenster in der Hochsaison sehr voll werden kann.
_DASHBOARD_NEU_MAX = 50
# Deckel der Objekt-Zählung. `count="exact"` zählt in der DB und lädt nichts,
# die Grenze steht trotzdem — kein Aufruf ohne Obergrenze (Wurzel 8).
_DASHBOARD_OBJEKT_ZAEHL_MAX = 10_000


@dataclass(frozen=True)
class _Kennzahlen:
    """Die vier KPI-Werte einer Periode, jeweils mit Vergleich zur Vorperiode."""

    checkins: DashboardKpi
    revenue: DashboardKpi | None
    revenue_per_booking: DashboardKpi | None
    confirmed: DashboardKpi


def _kpi(cur_val: float, prev_val: float) -> DashboardKpi:
    """Wert + Veränderung. Ohne Vorperiodenwert kein Prozentwert: eine
    Steigerung von 0 auf irgendwas ist nicht „+100 %", sondern schlicht keine
    Vergleichsgröße (Wurzel 4)."""
    if prev_val == 0:
        return DashboardKpi(value=cur_val, change_pct=None)
    return DashboardKpi(
        value=cur_val, change_pct=round((cur_val - prev_val) / prev_val * 100, 1)
    )


# Eigentümer-Aufenthalte (0241) sind KEIN Umsatz. Ihr Betrag ist zwar per CHECK
# 0, sie werden hier trotzdem ausdrücklich ausgeschlossen — der Ausschluss soll
# an der Zahl hängen, nicht an der Annahme, dass die Spalte schon 0 sein wird.
def _umsatz(zeilen: list[dict]) -> float:
    return sum(
        float(r.get("total_amount") or 0)
        for r in zeilen
        if not r.get("is_owner_stay")
    )


def _umsatz_je_buchung(zeilen: list[dict]) -> float | None:
    """Schnitt über die ZAHLENDEN Buchungen. Zählte ein Eigentümer-Aufenthalt
    im Nenner mit, sänke der Schnitt mit jedem Eigenbeleg. Ohne zahlende
    Buchung gibt es keinen Schnitt (None, kein 0-Ersatzwert)."""
    zahlende = [r for r in zeilen if not r.get("is_owner_stay")]
    if not zahlende:
        return None
    return _umsatz(zahlende) / len(zahlende)


def _kennzahlen(
    active: list[dict], today: date, tage: int, *, betraege_sichtbar: bool
) -> _Kennzahlen:
    """Die vier KPIs für die letzten `tage` Tage vs. die `tage` davor.

    EINE Formel für beide Wege — die Startseite lädt sie im Rutsch, die
    Kachel-Selektoren holen sie einzeln nach. Zwei Implementierungen desselben
    Werts wären zwei Wahrheiten: die Kachel zeigte nach dem Umschalten auf
    „30 Tage" einen anderen Wert als beim Laden derselben Seite.

    `betraege_sichtbar` fasst zwei Gründe zusammen, aus denen es KEINE
    Umsatzzahl gibt: fehlende Betrags-Sichtbarkeit (Owner ohne
    PM_BOOKING_TOTAL, §4.2 — sonst durchlöcherte die Aggregation die
    Preis-Maskierung) und gemischte Währungen (eine addierte Mischsumme mit
    einem beliebig herausgegriffenen Label wäre schlicht falsch).
    """
    cur_start = today - timedelta(days=tage - 1)  # inkl. heute
    prev_start = today - timedelta(days=tage * 2 - 1)

    def im_fenster(r: dict, start: date, end: date) -> bool:
        return start <= _as_date(r["check_in"]) <= end

    cur = [r for r in active if im_fenster(r, cur_start, today)]
    prev = [
        r
        for r in active
        if im_fenster(r, prev_start, cur_start - timedelta(days=1))
    ]

    revenue = _kpi(_umsatz(cur), _umsatz(prev)) if betraege_sichtbar else None

    revenue_per_booking = None
    if betraege_sichtbar:
        schnitt = _umsatz_je_buchung(cur)
        if schnitt is not None:
            revenue_per_booking = _kpi(
                round(schnitt, 2), round(_umsatz_je_buchung(prev) or 0, 2)
            )

    return _Kennzahlen(
        checkins=_kpi(len(cur), len(prev)),
        revenue=revenue,
        revenue_per_booking=revenue_per_booking,
        confirmed=_kpi(
            sum(1 for r in cur if r.get("status") == "confirmed"),
            sum(1 for r in prev if r.get("status") == "confirmed"),
        ),
    )


# Zeitfenster der Listen in Tagen ab heute; None = unbegrenzt („alle").
_FENSTER_TAGE: dict[DashboardFenster, int | None] = {
    DashboardFenster.heute: 0,
    # Die kurzen Fenster zählen wie die langen AB HEUTE: „1d" ist heute+morgen,
    # nicht morgen allein. Ein Fenster, das heute AUSLIESSE, wäre die erste
    # Spanne mit eigenem Startpunkt — dann müsste jede Liste zwei Grenzen
    # führen statt einer, und „alle" hätte keine Bedeutung mehr.
    DashboardFenster.d1: 1,
    DashboardFenster.d2: 2,
    DashboardFenster.d7: 7,
    DashboardFenster.d30: 30,
    DashboardFenster.alle: None,
}


def _liste_filtern(
    liste: DashboardListe, rows: list[dict], today: date, ende: date | None
) -> list[dict]:
    """Die Zeilen einer Liste im Fenster [heute, ende] — je Liste auf IHRER Achse.

    Stornierte fallen überall raus: eine abgesagte Buchung ist keine Anreise,
    keine Abreise und niemand im Haus.
    """
    aktiv = [r for r in rows if r.get("status") != "cancelled"]

    def bis(tag: date) -> bool:
        return ende is None or tag <= ende

    if liste is DashboardListe.checkouts:
        return sorted(
            (r for r in aktiv
             if today <= _as_date(r["check_out"]) and bis(_as_date(r["check_out"]))),
            key=lambda r: _as_date(r["check_out"]),
        )
    if liste is DashboardListe.checkins:
        return sorted(
            (r for r in aktiv
             if today <= _as_date(r["check_in"]) and bis(_as_date(r["check_in"]))),
            key=lambda r: _as_date(r["check_in"]),
        )
    if liste is DashboardListe.upcoming:
        # Ab MORGEN: wer heute anreist, steht in „Heutige Check-ins" und wäre
        # sonst in beiden Karten gezählt.
        return sorted(
            (r for r in aktiv
             if _as_date(r["check_in"]) > today and bis(_as_date(r["check_in"]))),
            key=lambda r: _as_date(r["check_in"]),
        )
    if liste is DashboardListe.freigabe:
        return sorted(
            (r for r in aktiv
             if r.get("status") == "pending"
             and _as_date(r["check_out"]) >= today
             and bis(_as_date(r["check_in"]))),
            key=lambda r: _as_date(r["check_in"]),
        )
    # im_haus: der Aufenthalt überschneidet das Fenster. Der Abreisetag zählt
    # NICHT mit (`check_out > tag`) — wer abreist, steht bei den Check-outs.
    return sorted(
        (r for r in aktiv
         if _as_date(r["check_in"]) <= (ende or _as_date(r["check_in"]))
         and _as_date(r["check_out"]) > today),
        key=lambda r: _as_date(r["check_out"]),
    )


# ── Wechseltag ("Wechsel") ────────────────────────────────────────────────────
# Ein Wechsel ist ein Tag, an dem in DERSELBEN Einheit ein Gast abreist und ein
# anderer anreist (`a.check_out == b.check_in`). Für die Reinigung ist das der
# teuerste Tag des Jahres: das Objekt muss zwischen zwei Belegungen komplett
# gedreht werden, statt über Nacht leer zu stehen.
#
# WARUM JE EINHEIT UND NICHT JE OBJEKT (Datenmodell, CLAUDE.md): eine
# `properties`-Zeile ist ein Einheiten-TYP mit n >= 1 Einheiten. Bei fünf
# gleichen Studios ist „Abreise in Studio A + Anreise in Studio B" KEIN Wechsel
# — dort wird nichts gedreht, es sind zwei unabhängige Einheiten. Objektweit
# gerechnet meldete der Betrieb Wechseltage, die es nicht gibt, und die
# Reinigungsplanung liefe auf eine erfundene Zahl.
#
# `check_in`/`check_out` sind DATE-Spalten (0004), kein Zeitstempel. Der
# Vergleich ist damit ein reiner Datumsvergleich und in jeder Zeitzone gleich —
# hier wird bewusst NICHT `.date()` auf einen Zeitstempel gerechnet, das war der
# reale Zeitzonen-Bug der Aufgaben-Engine. Die Zeitzone entscheidet allein, was
# „heute" ist, nicht, ob zwei Buchungen aneinanderstoßen.
#
# Zeilen OHNE `unit_id` (nullable seit 0265, `on delete set null`) sind KEIN
# Wechsel-Partner: welche Einheit sie meinen, ist unbekannt. Sie als Wechsel zu
# melden hieße, eine Reinigung zu behaupten, die vielleicht gar nicht ansteht
# (Wurzel 4: kein plausibler Ersatzwert). Sie werden gezählt, aber unter
# `wechsel_unbekannt` — der Betrieb sieht die Lücke, statt sie geschenkt zu
# bekommen. `scripts/diagnose/buchung-einheit-pruefen.sh` findet solche Zeilen.
def _wechsel_partner(rows: list[dict]) -> tuple[set[str], set[str]]:
    """Reservierungs-IDs, die auf einem Wechseltag liegen.

    Rückgabe: (`sicher`, `unbekannt`).
    `sicher` = Abreise und Anreise treffen sich in DERSELBEN bekannten Einheit.
    `unbekannt` = die Datumskante trifft sich im selben OBJEKT, aber mindestens
    eine der beiden Zeilen trägt keine `unit_id` — dann ist nicht entscheidbar,
    ob es dieselbe Einheit ist.

    Gerechnet wird über die volle geladene Menge, nicht über die angezeigte
    Liste: der Wechselpartner steht in der jeweils ANDEREN Karte (die Abreise
    bei den Check-outs, die Anreise bei den Check-ins) und bei gedeckelten
    Listen womöglich in gar keiner. Aus der Anzeige gerechnet wäre der Wechsel
    genau dann unsichtbar, wenn die Liste voll ist.

    „Voll geladen" heißt: was der Aufrufer aus der DB geholt hat, samt dem
    Zusatztag über das Zeitfenster hinaus (`dashboard_liste`) bzw. beiden
    Abfragen (`dashboard`). Ein Partner AUSSERHALB dieser Menge kann nicht
    gefunden werden — deshalb weiten die Aufrufer ihren Vorfilter, statt sich
    hier auf eine Vollständigkeit zu verlassen, die die Funktion nicht prüfen
    kann.

    Statuswerte aus `_NICHT_BELEGEND` fallen hier heraus, unabhängig davon, ob
    der Aufrufer schon vorgefiltert hat: eine stornierte Anreise macht aus
    einer Abreise keinen Wechseltag.
    """
    belegend = [
        r for r in rows
        if str(r.get("status") or "") not in _NICHT_BELEGEND
        and r.get("property_id")
    ]
    # Zwei Indizes je Richtung: Anreisen und Abreisen, jeweils nach (Objekt,
    # Einheit, Tag) und nach (Objekt, Tag). Der Index OHNE Einheit macht die
    # Zeilen ohne `unit_id` ueberhaupt erst sichtbar — ohne ihn fielen sie
    # stillschweigend unter „kein Wechsel", also unter eine Aussage, die die
    # Daten nicht hergeben.
    #
    # WARUM BEIDE RICHTUNGEN: geprueft wird jede Zeile an BEIDEN Kanten — ihre
    # Abreise gegen fremde Anreisen und ihre Anreise gegen fremde Abreisen. Mit
    # nur einem Anreise-Index und einer Schleife ueber `check_out` blieb eine
    # ANREISENDE Zeile ohne Einheit ungeprueft: ob sie „unbekannt" bekam, hing
    # davon ab, ob zufaellig eine dritte Zeile daneben lag. Dasselbe Datum, mal
    # „nein", mal „unbekannt".
    an_einheit: dict[tuple[str, str, date], set[str]] = {}
    an_objekt: dict[tuple[str, date], set[str]] = {}
    ab_einheit: dict[tuple[str, str, date], set[str]] = {}
    ab_objekt: dict[tuple[str, date], set[str]] = {}
    # Einheit je Reservierungs-ID; fehlt sie, steht hier None.
    einheit_von: dict[str, str | None] = {}
    for r in belegend:
        rid = str(r["id"])
        pid = str(r["property_id"])
        uid = str(r["unit_id"]) if r.get("unit_id") else None
        einheit_von[rid] = uid
        an_tag = _as_date(r["check_in"])
        ab_tag = _as_date(r["check_out"])
        an_objekt.setdefault((pid, an_tag), set()).add(rid)
        ab_objekt.setdefault((pid, ab_tag), set()).add(rid)
        if uid:
            an_einheit.setdefault((pid, uid, an_tag), set()).add(rid)
            ab_einheit.setdefault((pid, uid, ab_tag), set()).add(rid)

    sicher: set[str] = set()
    offen: set[str] = set()
    for r in belegend:
        pid = str(r["property_id"])
        rid = str(r["id"])
        uid = einheit_von[rid]
        # Kante 1: meine Abreise trifft eine fremde Anreise.
        # Kante 2: meine Anreise trifft eine fremde Abreise.
        kanten = (
            (_as_date(r["check_out"]), an_einheit, an_objekt),
            (_as_date(r["check_in"]), ab_einheit, ab_objekt),
        )
        for tag, idx_einheit, idx_objekt in kanten:
            if uid and idx_einheit.get((pid, uid, tag), set()) - {rid}:
                # Dieselbe Einheit, Abreise trifft Anreise: echter Wechsel.
                sicher.add(rid)
                continue
            # Keine Gewissheit ueber die eigene Einheit. Steht am selben Tag im
            # selben Objekt ein Gegenueber, dessen Einheit (oder die eigene)
            # fehlt, bleibt die Frage offen — weder sicher ein Wechsel noch
            # sicher keiner.
            gegenueber = idx_objekt.get((pid, tag), set()) - {rid}
            if any(
                einheit_von[x] is None or uid is None for x in gegenueber
            ):
                offen.add(rid)

    # Gewissheit schlaegt Zweifel: eine Zeile, die ueber IHRE EIGENE Einheit
    # schon sicher wechselt, braucht kein „unbekannt" mehr.
    #
    # Der Zustand des Partners bleibt dabei aussen vor. Dass mein Gegenueber an
    # einem anderen Tag oder in einer anderen Paarung sicher wechselt, sagt
    # nichts darueber, ob es an DIESEM Tag mein Partner war — sonst stuende
    # eine Zeile ohne `unit_id` auf „nein", also auf einer Aussage, welche die
    # Daten nicht hergeben (Wurzel 4). Die Luecke gehoert sichtbar.
    return sicher, offen - sicher


def _eintrag(
    r: dict,
    titles: dict[str, str],
    addons: dict[str, list[DashboardAddon]],
    mask: GuestMask,
    threads: dict[str, str] | None = None,
    wechsel: tuple[set[str], set[str]] | None = None,
) -> DashboardEntry:
    """Eine Reservierungszeile zur Listenzeile der Startseite.

    Modul-Funktion und nicht je Aufrufer neu geschrieben: dieselbe Abbildung
    speist die Startseite UND das Nachladen einer einzelnen Liste beim
    Umschalten des Zeitfensters. Zwei Kopien hießen, dass eine davon die
    Maskierung (§4) irgendwann anders anwendet als die andere.

    `wechsel` ist das Ergebnis von `_wechsel_partner` über die VOLLE aktive
    Menge — (sichere IDs, unbekannte IDs). Ohne den Parameter bleibt das Feld
    auf „nein": nicht gerechnet ist nicht dasselbe wie nicht vorhanden, aber
    jeder Aufrufer hier reicht es durch.
    """
    sicher, unbekannt = wechsel or (set(), set())
    rid = str(r["id"])
    if rid in sicher:
        wechsel_wert = "ja"
    elif rid in unbekannt:
        wechsel_wert = "unbekannt"
    else:
        wechsel_wert = "nein"
    return DashboardEntry(
        reservation_id=r["id"],
        guest_name=mask.name(anzeigename(r)) or "",
        property_title=titles.get(r["property_id"], ""),
        channel=r["channel"],
        ota_name=mask.source_value(r.get("ota_name")),
        check_in=r["check_in"],
        check_out=r["check_out"],
        status=r["status"],
        is_owner_stay=bool(r.get("is_owner_stay")),
        addons=addons.get(r["id"], []),
        booked_at=r.get("booked_at"),
        message_thread_id=(threads or {}).get(r["id"]),
        wechsel=wechsel_wert,
    )


class DashboardMixin(ReservationsBase):
    """Startseiten-Kennzahlen (`/reservations/dashboard`)."""

    def dashboard(self, ctx: AuthContext) -> DashboardResponse:
        """Startseiten-Kennzahlen aus echten Reservierungen (kein Fallback).

        Listen: heutige Check-outs/-ins und die nächsten anstehenden Anreisen.
        KPIs: Check-ins, Umsatz und bestätigte Reservierungen der letzten 30
        Tage, jeweils mit prozentualer Veränderung gegenüber den 30 Tagen davor.
        """
        tenant_id = self._require_tenant(ctx)
        # Owner-Scope (§4.2): KPIs + Listen nur über die eigenen Objekte, damit
        # ein Eigentümer nicht den tenant-weiten Umsatz/Buchungsfluss sieht.
        owner_pids = self._owner_scope_pids(ctx)
        if owner_pids is not None and not owner_pids:
            return self._empty_dashboard()
        base_rows = (
            self._db()
            .table("reservations")
            .select("*, guests(name), owners(name)")
            .eq("tenant_id", tenant_id)
        )
        if owner_pids is not None:
            base_rows = base_rows.in_("property_id", owner_pids)
        # Nur nach UNTEN deckeln: die KPIs reichen 59 Tage zurück (Vorperiode),
        # die „anstehend"-Liste dagegen beliebig weit in die Zukunft — eine
        # Obergrenze würde sie still abschneiden. Ohne die Untergrenze lud die
        # Startseite den GESAMTEN Buchungsbestand des Tenants und traf dabei den
        # stillen 1000-Zeilen-Cap von PostgREST.
        rows = fetch_all_rows(
            base_rows.gte(
                "check_out",
                (date.today() - timedelta(days=_DASHBOARD_RUECKBLICK_TAGE)).isoformat(),
            )
            .order("check_in", desc=True)
            .order("id", desc=True)
        )

        # Zweite Abfrage für „Neu eingegangen". Sie kann NICHT aus `rows`
        # gefiltert werden: dort deckelt `check_out >= heute-60d` nach dem
        # AUFENTHALT, und eine gestern eingegangene Buchung für einen längst
        # vergangenen Aufenthalt (Nachtrag, späte Portal-Meldung) fiele damit
        # aus der Liste, obwohl sie exakt das ist, was die Karte zeigen soll.
        # Gefiltert wird deshalb über `booked_at` — den Quell-Zeitstempel der
        # Buchung (Wurzel 5b), nie über `created_at`/unseren Feed-Eingang.
        neu_rows, neu_gesamt = self._dashboard_neu_rows(tenant_id, owner_pids)

        # Objekttitel je property_id nachladen (Liste zeigt den Objektnamen).
        # Beide Abfragen zusammen, sonst steht bei einer Buchung, die nur in
        # „Neu eingegangen" vorkommt, kein Objektname.
        prop_ids = sorted(
            {
                r["property_id"]
                for r in (*rows, *neu_rows)
                if r.get("property_id")
            }
        )
        titles: dict[str, str] = {}
        if prop_ids:
            props = (
                self._db()
                .table("properties")
                .select("id, title")
                .eq("tenant_id", tenant_id)
                .in_("id", prop_ids)
                .execute()
            ).data or []
            for p in props:
                titles[p["id"]] = p.get("title") or ""

        # Währung trägt die Reservierung selbst (properties hat keine currency-Spalte).
        # Betreibt ein Tenant Objekte in mehreren Währungen, darf der Umsatz NICHT
        # zu einer Mischsumme mit beliebigem Label addiert werden (wie R4 für die
        # Kalender-KPIs): nur bei GENAU EINER Währung im Datensatz gibt es eine
        # echte Umsatzzahl, sonst mixed_currency → keine Umsatz-KPI.
        currencies = {r["currency"] for r in rows if r.get("currency")}
        currency = next(iter(currencies)) if len(currencies) == 1 else ""
        mixed_currency = len(currencies) > 1

        today = date.today()
        mask = load_guest_mask(self._client, ctx.user_id)
        # Über BEIDE Mengen, sonst stünde eine nur in „Neu eingegangen"
        # sichtbare Buchung ohne ihre Zusatzleistungen da. `dict.fromkeys` hält
        # die IDs eindeutig — die Schnittmenge ist im Normalfall groß.
        addons = self._dashboard_addons(
            list(dict.fromkeys(r["id"] for r in (*rows, *neu_rows)))
        )

        threads = self._dashboard_threads(tenant_id, [*rows, *neu_rows])

        def entry(r: dict) -> DashboardEntry:
            return _eintrag(r, titles, addons, mask, threads, wechsel)

        active = [r for r in rows if r.get("status") != "cancelled"]

        # Über die VOLLE Menge BEIDER Abfragen, nicht je Liste und nicht nur
        # über `rows`: der Partner einer Abreise steht in den Check-ins, nicht
        # bei den Check-outs — und `neu_rows` ist eine EIGENE Abfrage (über
        # `booked_at`, nicht über den Aufenthalt). Eine nur dort stehende
        # Anreise fehlte sonst als Partner, und die Zeilen der Karte „Neu
        # eingegangen" trügen selbst zwangsläufig „nein", weil sie in `active`
        # gar nicht vorkommen. Beides wäre eine Falschaussage, die niemand als
        # Bug erkennt. Der Umweg über die ID hält jede Zeile genau einmal — die
        # Schnittmenge beider Abfragen ist im Normalfall groß.
        wechsel = _wechsel_partner(
            list({str(r["id"]): r for r in (*rows, *neu_rows)}.values())
        )

        checkouts_today = sorted(
            (entry(r) for r in active if _as_date(r["check_out"]) == today),
            key=lambda e: e.check_out,
        )
        checkins_today = sorted(
            (entry(r) for r in active if _as_date(r["check_in"]) == today),
            key=lambda e: e.check_in,
        )
        upcoming_alle = sorted(
            (entry(r) for r in active if _as_date(r["check_in"]) > today),
            key=lambda e: e.check_in,
        )
        upcoming = upcoming_alle[:_DASHBOARD_UPCOMING_MAX]

        # Wer heute im Haus ist: angereist ODER früher angereist, Abreise noch
        # nicht erreicht. Der Abreisetag zählt NICHT mehr dazu (`check_out >
        # today`) — wer heute auscheckt, steht in `checkouts_today`, und in
        # beiden Zahlen zugleich waere er doppelt gezaehlt.
        im_haus_alle = sorted(
            (
                entry(r)
                for r in active
                if _as_date(r["check_in"]) <= today < _as_date(r["check_out"])
            ),
            key=lambda e: e.check_out,
        )

        # „Freigabe nötig": angefragt, noch nicht bestätigt. Nur Aufenthalte,
        # die noch bevorstehen oder laufen — eine Anfrage für einen längst
        # vergangenen Zeitraum ist keine offene Aufgabe mehr.
        freigabe_alle = sorted(
            (
                entry(r)
                for r in active
                if r.get("status") == "pending"
                and _as_date(r["check_out"]) >= today
            ),
            key=lambda e: e.check_in,
        )

        # „Neu eingegangen": neueste Buchung zuerst. Stornierte bleiben drin —
        # eine Buchung, die kam und gleich wieder abgesagt wurde, IST etwas,
        # das seit dem letzten Blick passiert ist; sie stillschweigend zu
        # unterschlagen wäre eine Lücke im Eingangsbild. Die Karte kennzeichnet
        # sie. `booked_at` ist hier immer gesetzt (die Abfrage filtert danach);
        # der Ersatzwert im Schlüssel ist reiner Typ-Schutz, kein Fallback.
        neu_eingegangen = sorted(
            (entry(r) for r in neu_rows),
            key=lambda e: e.booked_at or datetime.min.replace(tzinfo=UTC),
            reverse=True,
        )[:_DASHBOARD_NEU_MAX]

        kennzahlen = _kennzahlen(
            active, today, _tage_fuer(STANDARD_ZEITRAUM),
            betraege_sichtbar=mask.amounts and not mixed_currency,
        )

        objekte = self._dashboard_objekte(tenant_id, owner_pids)

        return DashboardResponse(
            today=today,
            checkouts_today=checkouts_today,
            checkins_today=checkins_today,
            upcoming=upcoming,
            neu_eingegangen=neu_eingegangen,
            im_haus=im_haus_alle[:_DASHBOARD_UPCOMING_MAX],
            freigabe_noetig=freigabe_alle[:_DASHBOARD_UPCOMING_MAX],
            # Die ungedeckelten Zaehler — was die Kacheln zeigen. Getrennt von
            # den Listen, die bei 50 abschneiden.
            upcoming_gesamt=len(upcoming_alle),
            im_haus_gesamt=len(im_haus_alle),
            neu_gesamt=neu_gesamt,
            freigabe_gesamt=len(freigabe_alle),
            checkins_30d=kennzahlen.checkins,
            revenue_30d=kennzahlen.revenue,
            revenue_per_booking_30d=kennzahlen.revenue_per_booking,
            confirmed_30d=kennzahlen.confirmed,
            currency=currency if mask.amounts else "",
            **objekte,
        )

    def dashboard_liste(
        self, ctx: AuthContext, liste: DashboardListe, fenster: DashboardFenster
    ) -> DashboardListeResponse:
        """EINE Liste der Startseite für EIN gewähltes Zeitfenster.

        Jede Karte trägt ihren eigenen Fenster-Selektor; das Umschalten lädt
        deshalb genau diese Liste nach, nicht die ganze Startseite.

        Das Fenster wird je Liste auf der Achse gerechnet, die zu ihr gehört —
        Abreisen über `check_out`, Anreisen über `check_in`, „im Haus" über die
        Überschneidung des Aufenthalts. Eine gemeinsame Achse für alle wäre
        kürzer und falsch: „nächste 7 Tage" bei den Abreisen meint abreisende
        Gäste, nicht anreisende.
        """
        tenant_id = self._require_tenant(ctx)
        owner_pids = self._owner_scope_pids(ctx)
        if owner_pids is not None and not owner_pids:
            return DashboardListeResponse(liste=liste, fenster=fenster)

        today = date.today()
        tage = _FENSTER_TAGE[fenster]
        ende = None if tage is None else today + timedelta(days=tage)

        query = (
            self._db()
            .table("reservations")
            .select("*, guests(name), owners(name)")
            .eq("tenant_id", tenant_id)
        )
        if owner_pids is not None:
            query = query.in_("property_id", owner_pids)
        # Vorfilter in der DB: alles, was heute noch laufen oder beginnen kann.
        # Ohne ihn zöge „alle" den gesamten Bestand samt Vergangenheit.
        query = query.gte("check_out", today.isoformat())
        if ende is not None:
            # EIN TAG ÜBER das Fenster hinaus. Der Wechselpartner einer Abreise
            # am letzten Fenstertag reist genau an diesem Tag AN — er liegt in
            # `check_in <= ende` noch drin. Die Abreise, die am Tag danach eine
            # Anreise trifft, fiele dagegen weg, und die im Fenster sichtbare
            # Zeile stünde fälschlich auf „kein Wechsel". Angezeigt wird
            # weiterhin nur das Fenster: `_liste_filtern` bekommt `ende`
            # unverändert und schneidet den Zusatztag wieder ab.
            query = query.lte("check_in", (ende + timedelta(days=1)).isoformat())
        rows = fetch_all_rows(query.order("check_in"))

        treffer = _liste_filtern(liste, rows, today, ende)
        mask = load_guest_mask(self._client, ctx.user_id)
        sichtbar = treffer[:_DASHBOARD_UPCOMING_MAX]
        return DashboardListeResponse(
            liste=liste,
            fenster=fenster,
            # Die echte Anzahl, nicht die der gelieferten Zeilen.
            gesamt=len(treffer),
            items=self._eintraege(
                sichtbar, tenant_id, mask, _wechsel_partner(rows)
            ),
        )

    def _eintraege(
        self,
        rows: list[dict],
        tenant_id: str,
        mask: GuestMask,
        wechsel: tuple[set[str], set[str]] | None = None,
    ) -> list[DashboardEntry]:
        """Zeilen zu Listenzeilen: Objekttitel und Zusatzleistungen in EINEM
        Zug nachladen, nicht je Zeile — sonst wären es 50 Server-Runden.

        `wechsel` wird vom Aufrufer über die UNGEDECKELTE Menge gerechnet und
        durchgereicht; aus `rows` (der angezeigten Seite) gerechnet fiele der
        Partner genau dann weg, wenn die Liste voll ist.
        """
        if not rows:
            return []
        titles: dict[str, str] = {}
        prop_ids = sorted({r["property_id"] for r in rows if r.get("property_id")})
        if prop_ids:
            props = (
                self._db()
                .table("properties")
                .select("id, title")
                .eq("tenant_id", tenant_id)
                .in_("id", prop_ids)
                .execute()
            ).data or []
            for p in props:
                titles[p["id"]] = p.get("title") or ""
        addons = self._dashboard_addons([r["id"] for r in rows])
        threads = self._dashboard_threads(tenant_id, rows)
        return [
            _eintrag(r, titles, addons, mask, threads, wechsel) for r in rows
        ]

    def dashboard_kpi(
        self, ctx: AuthContext, metrik: DashboardKpiMetrik, zeitraum: str
    ) -> DashboardKpiResponse:
        """EINE KPI-Kachel für EINEN gewählten Zeitraum.

        Warum ein eigener Endpunkt und nicht `dashboard()` mit Zeitraum-
        Parameter: die Kacheln sind einzeln umschaltbar (jede trägt ihren
        eigenen Selektor). Ein Umschalten dürfte sonst die ganze Startseite
        samt aller Listen und Zusatzleistungen neu laden — für eine Zahl.

        Warum die Zeilen hier eigens geladen werden und nicht aus dem
        Dashboard-Bestand kommen: jener reicht 60 Tage zurück (Wurzel: die
        30-Tage-Vorperiode). „12 Monate" braucht 24 Monate Historie — die
        Abfrage grenzt deshalb genau auf das benötigte Fenster ein, statt den
        Rückblick der Startseite für alle Fälle aufzublähen.
        """
        try:
            tage = _tage_fuer(zeitraum)
        except UnbekannterZeitraum as exc:
            raise ReservationError(str(exc), status_code=422) from exc

        tenant_id = self._require_tenant(ctx)
        # Owner-Scope (§4.2) wie im Dashboard: ein Eigentümer ohne zugeordnete
        # Objekte bekommt Null, nicht die tenant-weite Zahl (fail-closed).
        owner_pids = self._owner_scope_pids(ctx)
        mask = load_guest_mask(self._client, ctx.user_id)
        if owner_pids is not None and not owner_pids:
            return DashboardKpiResponse(
                metrik=metrik, zeitraum=zeitraum, tage=tage, kpi=None, currency=""
            )

        today = date.today()
        query = (
            self._db()
            .table("reservations")
            .select("check_in, status, total_amount, currency, is_owner_stay")
            .eq("tenant_id", tenant_id)
            .gte("check_in", (today - timedelta(days=tage * 2 - 1)).isoformat())
            .lte("check_in", today.isoformat())
        )
        if owner_pids is not None:
            query = query.in_("property_id", owner_pids)
        rows = fetch_all_rows(query.order("check_in", desc=True))

        active = [r for r in rows if r.get("status") != "cancelled"]
        return self._kpi_antwort(metrik, zeitraum, tage, active, today, mask)

    @staticmethod
    def _kpi_antwort(
        metrik: DashboardKpiMetrik,
        zeitraum: str,
        tage: int,
        active: list[dict],
        today: date,
        mask: GuestMask,
    ) -> DashboardKpiResponse:
        """Die geladenen Zeilen zur Antwort einer Kachel verdichten.

        Währung und Betrags-Sichtbarkeit werden genau wie im Dashboard
        entschieden: bei mehreren Währungen im Fenster gibt es KEINE
        Umsatzzahl und kein Währungslabel (eine Mischsumme wäre falsch).
        """
        waehrungen = {r["currency"] for r in active if r.get("currency")}
        currency = next(iter(waehrungen)) if len(waehrungen) == 1 else ""
        betraege = mask.amounts and len(waehrungen) <= 1
        werte = _kennzahlen(active, today, tage, betraege_sichtbar=betraege)
        kpi = {
            DashboardKpiMetrik.checkins: werte.checkins,
            DashboardKpiMetrik.revenue: werte.revenue,
            DashboardKpiMetrik.revenue_per_booking: werte.revenue_per_booking,
            DashboardKpiMetrik.confirmed: werte.confirmed,
        }[metrik]
        return DashboardKpiResponse(
            metrik=metrik,
            zeitraum=zeitraum,
            tage=tage,
            kpi=kpi,
            currency=currency if mask.amounts else "",
        )

    def _dashboard_threads(
        self, tenant_id: str, rows: list[dict]
    ) -> dict[str, str]:
        """Reservierung → Posteingang-Thread, für alle Zeilen in EINEM Zug.

        Dieselben drei Herkünfte wie `reads._message_thread_id` (Channex-UUID,
        Portal-Code beim Airbnb-Historie-Import, übernommener Bestand als
        `ue:<id>`), nur gebündelt: dort geht es um EINE Buchung im Detail, hier
        um bis zu 50 Listenzeilen — je Zeile eine eigene Abfrage wären 50
        Server-Runden für drei Icons.

        Best-effort ist es NICHT: fehlt der Thread, fehlt der Knopf. Ein Knopf,
        der auf eine leere Ansicht führt, wäre schlechter als keiner.
        """
        if not rows:
            return {}
        treffer: dict[str, str] = {}
        # 1) Channex-UUID → unsere Staging-Zeile. Die Buchung trägt die ID, die
        #    CHANNEX vergeben hat; der Posteingang adressiert unsere eigene.
        nach_uuid = {
            str(r["source_channex_booking_id"]): r["id"]
            for r in rows
            if r.get("source_channex_booking_id")
        }
        if nach_uuid:
            for zeile in self._threads_laden(
                tenant_id, "channex_booking_id", sorted(nach_uuid)
            ):
                res_id = nach_uuid.get(str(zeile.get("channex_booking_id")))
                if res_id:
                    treffer[res_id] = str(zeile["id"])
        # 2) Portal-Code: beim Airbnb-Historie-Import steht im selben Feld der
        #    Bestätigungscode statt einer UUID, `external_ref` trägt ihn je
        #    nach Importweg ebenfalls. Ohne diesen Zweig fehlte der
        #    Nachrichten-Knopf bei Airbnb, obwohl der Verlauf da ist.
        nach_code: dict[str, str] = {}
        for r in rows:
            if r["id"] in treffer:
                continue
            for feld in ("source_channex_booking_id", "external_ref"):
                if r.get(feld):
                    nach_code[str(r[feld])] = r["id"]
        if nach_code:
            for zeile in self._threads_laden(
                tenant_id, "ota_reservation_code", sorted(nach_code)
            ):
                res_id = nach_code.get(str(zeile.get("ota_reservation_code")))
                if res_id and res_id not in treffer:
                    treffer[res_id] = str(zeile["id"])
        # 3) Übernommener Bestand (0382): der Verlauf hängt an der Reservierung.
        offen = [r["id"] for r in rows if r["id"] not in treffer]
        # Blockweise wie in `_threads_laden` — und aus demselben Grund: die
        # ID-Liste geht als `in_`-Filter in die URL. Ungeblockt riss sie die
        # Laengengrenze und der Aufruf endete mit HTTP 414 „URI too long", was
        # als `internal_error` im Dashboard ankam („Dashboard konnte nicht
        # geladen werden"). Ausgeloest hat es ein Bestand von 242 Buchungen:
        # bei 36 Zeichen je UUID sind das ueber 9.000 Zeichen Adresse.
        for i in range(0, len(offen), _ID_CHUNK):
            block = offen[i : i + _ID_CHUNK]
            vorhanden = (
                self._db()
                .table("reservation_nachricht_uebernahme")
                .select("reservation_id")
                .eq("tenant_id", tenant_id)
                .in_("reservation_id", block)
                .execute()
            ).data or []
            for zeile in vorhanden:
                treffer[str(zeile["reservation_id"])] = f"ue:{zeile['reservation_id']}"
        return treffer

    def _threads_laden(
        self, tenant_id: str, feld: str, werte: list[str]
    ) -> list[dict]:
        """`channex_booking`-Zeilen zu einer Schlüsselliste, blockweise.

        Blöcke wie bei den Zusatzleistungen: die ID-Liste geht als `in_`-Filter
        in die URL und risse bei 50 UUIDs sonst irgendwann die Längengrenze
        von PostgREST.
        """
        gefunden: list[dict] = []
        for i in range(0, len(werte), _ID_CHUNK):
            block = werte[i : i + _ID_CHUNK]
            gefunden.extend(
                (
                    self._db()
                    .table("channex_booking")
                    .select(f"id, {feld}")
                    .eq("tenant_id", tenant_id)
                    .in_(feld, block)
                    .execute()
                ).data
                or []
            )
        return gefunden

    def _dashboard_objekte(
        self, tenant_id: str, owner_pids: list[str] | None
    ) -> dict[str, int]:
        """Objektbestand für die Sektion „Objekte".

        Gezählt wird in der DB (`count="exact"`), nicht über geladene Zeilen —
        die Karte braucht Zahlen, nicht den Bestand. Der Owner-Scope (§4.2)
        gilt hier genauso wie für die Listen darüber: ein Eigentümer sieht die
        Zahl SEINER Objekte, nie die des Betriebs.

        ARCHIVIERTE ZÄHLEN NICHT MIT (`core.bestand.nur_im_bestand`). Hier
        fehlte der Filter, und das Ergebnis war live beim Nutzer zu sehen
        (09.09.2026): „Gesamt 21, Entwurf 1" — die Objektliste daneben zeigte
        20, und der eine „Entwurf" war „Fewo-Mosbjerg-Sindal", am 21.08.2026
        nach Kündigung archiviert. Zwei Zahlen für denselben Bestand, und eine
        Kachel, die eine gekündigte Fewo als unfertigen Entwurf ausgab. Genau
        der Fall, für den 0416 den Filter eingeführt hat — dasselbe Objekt
        stand damals im Aufgabenkalender.

        `objekte_aktiv` kam mit dazu: ohne diese Zahl musste der Betrieb sich
        „so viele Objekte verkaufe ich" aus `gesamt − inaktiv − entwurf`
        selbst ableiten, und mit einem archivierten Objekt im `gesamt` ergab
        diese Rechnung sogar das Falsche.

        „Aktiv" heißt hier VERKAUFT GERADE, und das ist mehr als
        `status='active'`: Eine offene „Verkauf pausieren"-Pause
        (`property_sales_pause`, 0375) nimmt das Objekt bei allen Kanälen aus
        dem Verkauf. Sie setzt den Status normalerweise mit auf `inactive` —
        aber ausdrücklich NUR, wenn kein Portal fehlgeschlagen ist
        (`objekt_verkauf.py:131`). Bleibt ein Portal hängen, steht das Objekt
        auf `active` und verkauft trotzdem nichts. Ohne diesen Abzug zählte
        die Kachel es mit, und niemand sähe den Unterschied (Wurzel 5).
        """

        def zaehle(status: str | None) -> int:
            query = nur_im_bestand(
                self._db()
                .table("properties")
                .select("id", count="exact")
                .eq("tenant_id", tenant_id)
            )
            if owner_pids is not None:
                query = query.in_("id", owner_pids)
            if status is not None:
                query = query.eq("status", status)
            antwort = query.limit(_DASHBOARD_OBJEKT_ZAEHL_MAX).execute()
            anzahl = getattr(antwort, "count", None)
            return int(anzahl) if anzahl is not None else len(antwort.data or [])

        erlaubt = set(owner_pids) if owner_pids is not None else None
        # Objekte mit mindestens EINER offenen Pause. Die Tabelle trägt eine
        # Zeile je Portal, deshalb über die Objekt-IDs eindeutig machen.
        pausiert = {
            str(z["property_id"])
            for z in (
                self._db()
                .table("property_sales_pause")
                .select("property_id")
                .eq("tenant_id", tenant_id)
                .is_("beendet_at", "null")
                .limit(_DASHBOARD_OBJEKT_ZAEHL_MAX)
                .execute()
            ).data
            or []
            if erlaubt is None or str(z["property_id"]) in erlaubt
        }
        aktiv_ids = {
            str(z["id"])
            for z in (
                nur_im_bestand(
                    self._db()
                    .table("properties")
                    .select("id")
                    .eq("tenant_id", tenant_id)
                    .eq("status", "active")
                )
                .limit(_DASHBOARD_OBJEKT_ZAEHL_MAX)
                .execute()
            ).data
            or []
            if erlaubt is None or str(z["id"]) in erlaubt
        }
        return {
            "objekte_gesamt": zaehle(None),
            "objekte_aktiv": len(aktiv_ids - pausiert),
            "objekte_inaktiv": zaehle("inactive"),
            "objekte_entwurf": zaehle("draft"),
        }

    def _dashboard_neu_rows(
        self, tenant_id: str, owner_pids: list[str] | None
    ) -> tuple[list[dict], int]:
        """Zeilen für „Neu eingegangen" UND ihre echte Gesamtzahl.

        Eigene Abfrage statt Filter über die Dashboard-Zeilen, weil jene nach
        `check_out` eingegrenzt sind — nach dem AUFENTHALT also, was hier die
        falsche Achse ist (Wurzel 5b: der Buchungszeitpunkt ist ein eigenes
        Ereignis). Gefiltert und sortiert wird über `booked_at`: beim Portal der
        echte Zeitpunkt dort (0291/0292), bei Direkt/Marktplatz unsere Anlage.

        Zeilen ohne `booked_at` fallen raus — sie tragen keinen Zeitpunkt, den
        man zeigen dürfte, und `created_at` wäre genau die plausible
        Falschaussage aus Wurzel 5b. Nach 0398 ist das nur noch
        Alt-/Fremdbestand, der planmäßig leer ist.

        Liste und Zahl kommen aus EINEM Aufruf: `count="exact"` zaehlt alle
        Treffer des Filters, waehrend `.limit()` nur die geholten Zeilen
        deckelt. Zwei getrennte Abfragen koennten auseinanderlaufen (ein
        Zaehler ueber ein anderes Fenster als die Liste darunter waere ein
        Fehler, den niemand sieht — die Zahl bliebe ja plausibel), und
        `len(zeilen)` waere am Deckel das Limit statt der Anzahl (Wurzel 4).
        """
        query = (
            self._db()
            .table("reservations")
            .select("*, guests(name), owners(name)", count="exact")
            .eq("tenant_id", tenant_id)
            .gte(
                "booked_at",
                (
                    datetime.now(UTC) - timedelta(days=_DASHBOARD_NEU_TAGE)
                ).isoformat(),
            )
        )
        # Scope VOR dem Deckel: erst einschränken, dann die neuesten 50 nehmen.
        # Andersherum gelesen (deckeln, dann filtern) wäre es ein Owner mit
        # wenigen Objekten in einem vollen Tenant, dem die Karte leer bliebe.
        if owner_pids is not None:
            query = query.in_("property_id", owner_pids)
        antwort = (
            query.order("booked_at", desc=True)
            .order("id", desc=True)
            .limit(_DASHBOARD_NEU_MAX)
            .execute()
        )
        zeilen = antwort.data or []
        # `count` fehlt nur, wenn PostgREST den Header nicht mitschickt; dann
        # ist die Zahl der geholten Zeilen das Ehrlichste, was vorliegt.
        anzahl = getattr(antwort, "count", None)
        return zeilen, int(anzahl) if anzahl is not None else len(zeilen)

    def _dashboard_addons(
        self, reservation_ids: list[str]
    ) -> dict[str, list[DashboardAddon]]:
        """Gebuchte Zusatzleistungen je Reservierung, für die Badges der Listen.

        EIN Abruf für alle Zeilen des Dashboards statt einer Abfrage je Karte —
        die Startseite lädt sonst bei 50 anstehenden Buchungen 50-mal nach.
        Gechunkt, weil `in_` mit einer sehr langen ID-Liste die URL sprengt.

        Stornierte Posten fehlen bewusst: sie sind nichts, was jemand
        vorbereiten oder kassieren müsste. Der Name kommt aus dem Snapshot der
        Zeile, nicht aus dem Katalog — sonst änderte eine spätere Umbenennung
        rückwirkend, was an einer alten Buchung steht.
        """
        if not reservation_ids:
            return {}
        treffer: dict[str, list[DashboardAddon]] = {}
        for i in range(0, len(reservation_ids), _ID_CHUNK):
            teil = reservation_ids[i : i + _ID_CHUNK]
            rows = (
                self._db()
                .table("reservation_addons")
                .select("reservation_id, name, qty, status")
                .in_("reservation_id", teil)
                .neq("status", "cancelled")
                .order("created_at")
                .execute()
            ).data or []
            for r in rows:
                treffer.setdefault(r["reservation_id"], []).append(
                    DashboardAddon(
                        name=r.get("name") or {},
                        qty=int(r.get("qty") or 1),
                        paid=r.get("status") == "paid",
                    )
                )
        return treffer

    @staticmethod
    def _empty_dashboard() -> DashboardResponse:
        """Leeres Dashboard (Owner ohne zugeordnete Objekte) — keine tenant-
        weiten Zahlen leaken, sondern ehrlich Null zeigen."""
        zero = DashboardKpi(value=0, change_pct=None)
        return DashboardResponse(
            today=date.today(),
            checkouts_today=[],
            checkins_today=[],
            upcoming=[],
            checkins_30d=zero,
            revenue_30d=zero,
            confirmed_30d=zero,
            currency="",
        )
