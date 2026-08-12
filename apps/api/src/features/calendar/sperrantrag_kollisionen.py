"""Was steht der Genehmigung eines Sperrantrags im Weg? (Vorschau + Riegel)

WARUM ES DIESES MODUL GIBT:
Bis hierher endete eine Genehmigung, deren Zeitraum belegt war, in einem nackten
409 „Zeitraum enthält bereits belegte/gesperrte Tage" aus
`ReservationsService.create`. Fachlich richtig, praktisch unbrauchbar: die
Entscheiderin sah nicht, WELCHE Buchung im Weg steht, von WEM, an WELCHEN Tagen
und ob sie überhaupt stornierbar ist. Bei einem Jahresantrag (2027-01-01 bis
2027-12-31, live vorhanden) ist die Frage „was kollidiert?" die eigentliche
Arbeit — der Klick ist nur ihr Ende.

Dieses Modul beantwortet sie EINMAL und wird an ZWEI Stellen benutzt:
  1. `GET /calendar/block-requests/{id}/kollisionen` — die Vorschau, die die
     Karte lädt, BEVOR jemand „Genehmigen" drückt.
  2. `SperrantragService.genehmigen` — derselbe Befund als sprechender 409,
     falls sich zwischen Anzeige und Klick etwas geändert hat (eine Buchung
     kann in der Zwischenzeit eingehen; die Vorschau ist kein Anspruch).

BEWUSST KEIN AUTOMATISCHES STORNIEREN (Entscheidung 12.08.2026):
Eine echte Gastbuchung zu stornieren, weil ein Eigentümer sperren will, ist ein
Eingriff mit Außenwirkung (Gast-Mail, Rückzahlung, OTA-Meldung) und ohne
Rückweg — `cancel` gibt die Nächte frei und meldet sie an die Portale; ein
„Doch nicht" gibt es danach nicht mehr. Darum zeigt dieses Modul die Buchungen
nur AN, mit allem, was zum Entscheiden nötig ist, und die Agentur storniert sie
bewusst einzeln über den bestehenden Weg. Der Genehmigen-Pfad selbst storniert
nie.

WARUM DIE PRÜFUNG NICHT NUR „ist belegt?" FRAGT:
`availability` allein sagt nur, DASS ein Tag zu ist. Was der Entscheider
braucht, sind vier verschiedene Dinge, die sich unterschiedlich auflösen:
  * ECHTE BUCHUNG (`reservations`) → muss storniert werden, kostet Geld/Gast.
  * EIGENNUTZUNG (`is_owner_stay`) → gehört demselben Eigentümer; oft ein
    zweiter Antrag, den man zurücknimmt statt zu stornieren.
  * MANUELLE SPERRE (`availability.status='blocked'`, source manual/ical) →
    Handwerker/Agentur; wird im Kalender aufgehoben, nicht storniert.
  * STOP-SELL → ein Verkaufsstopp; blockt die Rezeptions-Buchung ebenfalls
    (`writes.create` prüft ihn), taucht aber in `availability` NICHT auf.
Wer nur eines davon prüft, sagt der Entscheiderin „geht nicht" und lässt sie
suchen, wo es klemmt.

KANAL-FILTER (Wurzel 3, dieselbe Wahrheit wie der Schreibpfad):
Die Genehmigung legt eine Reservierung über den REZEPTIONS-Pfad an. Also gilt
hier exakt der Kanal-Filter dieses Pfades: `availability_block_hits_channel(...,
RECEPTION)` und `stop_sell_blocks_channel(..., RECEPTION)`. Eine reine
OTA-Sperre (`source='portal'` aus dem Channex-Import) blockt die Eigennutzung
NICHT und darf hier nicht als Hindernis erscheinen — sonst meldet die Vorschau
eine Kollision, die der Schreibpfad gar nicht sieht, und der Antrag bliebe
grundlos liegen. Umgekehrt wäre eine hier vergessene Sperre eine Vorschau, die
„frei" sagt und deren Klick dann 409 wirft.

STÜCKZAHL (0265): Ein Objekt ist ein Einheiten-TYP mit n ≥ 1 Einheiten. Ein
belegter Tag ist deshalb NICHT automatisch ein Hindernis: bei fünf Studios und
einer Buchung bleiben vier frei, und die Eigennutzung kann in eine davon. Die
Frage lautet also „gibt es im GANZEN Zeitraum eine Einheit, die durchgehend frei
ist?" — bei vorgegebener Einheit „ist GENAU DIESE durchgehend frei?". Genau die
Frage entscheidet auch die RPC (0275); `blockiert` unten spiegelt sie.
"""
from __future__ import annotations

import time
from datetime import date

from supabase import Client

from src.core.logging import get_logger
from src.core.sales_channels import (
    RECEPTION,
    availability_block_hits_channel,
    stop_sell_blocks_channel,
)
from src.features.channel_manager.einheiten import (
    einheiten_ids,
    einheiten_zahl,
)

from .schemas import (
    DateRange,
    SperrantragKollision,
    SperrantragKollisionen,
    SperrantragSperrtag,
)

log = get_logger("nextdays.sperrantrag_kollisionen")

# Zustände, die den Kalender zumachen — identisch zu `einheiten._GESPERRT`.
# Bewusst hier wiederholt und nicht importiert: dort ist es ein privater Name
# des Nachbar-Slices, und ein Import daraus wäre eine Kopplung, die beim
# nächsten Umbau dort still hier kippt.
_ZU = ("booked", "blocked")

# Zustände, die KEIN Hindernis sind. Bewusst eine AUSSCHLUSS-Liste und keine
# Einschluss-Liste: das Enum `reservation_status` hat sieben Werte (pending,
# confirmed, cancelled, completed, requested, declined, expired), und ein
# achter, später ergänzter Wert soll als Hindernis GELTEN, nicht stillschweigend
# durchfallen (fail-closed, Wurzel 5). Eine Einschluss-Liste hätte genau den
# umgekehrten Fehler: ein neuer Status wäre unsichtbar und die Sperre begrübe
# eine echte Belegung.
#
# Der ganze Bestand prüft ebenso (`!= 'cancelled'`, siehe `reservations.reads`
# und `_base`); `declined`/`expired` kommen hinzu, weil sie den Kalender
# ebenfalls nie belegt haben.
_KEIN_HINDERNIS = ("cancelled", "declined", "expired")

# Wie viele Buchungen/Sperrtage die Vorschau höchstens ausliefert. Ein
# Jahresantrag über ein Hotel mit 40 Einheiten kann hunderte Treffer haben;
# eine unbegrenzte Liste wäre eine Antwort, die niemand liest, und ein
# unbegrenzter Payload (Wurzel 8). Die ZAHL bleibt trotzdem vollständig —
# gekürzt wird nur die Aufzählung, und `gekuerzt` sagt es der Oberfläche.
MAX_LISTE = 200


def kollisionen_pruefen(
    db: Client,
    tenant_id: str,
    property_id: str,
    rng: DateRange,
    *,
    unit_id: str | None,
    antrag_id: str | None = None,
    als_kuendigung: bool = False,
) -> SperrantragKollisionen:
    """Alles, was der Genehmigung dieses Zeitraums im Weg steht.

    `rng` ist der Kalender-Range (Ende EXKLUSIV), wie ihn `_range` liefert —
    nicht das inklusive `end_date` des Antrags. `unit_id` ist die im Antrag
    benannte Einheit oder None (dann meint der Antrag den Typ und die RPC
    wählt selbst eine freie Einheit).

    `als_kuendigung` (0377) ändert die FRAGE, nicht nur den Text: eine Kündigung
    belegt keine Nächte, sie setzt das Vertragsende. Damit ist
      * eine bestehende `contract_end`-Sperre kein Hindernis, sondern der
        Zielzustand (live: Kornblomst war 2027 schon gesperrt, weil der 09.10.2026
        längst am Objekt stand — als Kündigungs-Genehmigung ist das genau richtig);
      * ein Stop-Sell irrelevant (es wird nichts gebucht);
      * eine freie Einheit unnötig (es wird nichts belegt).
    Was BLEIBT, ist die einzige echte Frage: liegen Buchungen hinter dem
    Enddatum, die noch bedient werden müssen? Sie verhindern die Kündigung
    nicht (0359), müssen aber sichtbar sein.

    Liest NUR (kein Seiteneffekt), damit derselbe Aufruf für die Vorschau und
    für den Riegel im Schreibpfad taugt.
    """
    naechte = rng.nights()
    von, bis = naechte[0], naechte[-1]

    # DEBUGGING: jeder DB-Zugriff einzeln gemessen und geloggt. Diese Prüfung
    # macht SIEBEN Abfragen über einen Zeitraum von bis zu 730 Nächten; hängt
    # sie, muss ohne Rätselraten dastehen WELCHE davon (live 12.08.2026 hing
    # der Dialog, und es gab keinen Anhaltspunkt).
    schritte: list[tuple[str, float, int]] = []

    def messen(name: str, fn):  # noqa: ANN001, ANN202 — lokaler Messhelfer
        start = time.monotonic()
        ergebnis = fn()
        dauer = (time.monotonic() - start) * 1000
        menge = len(ergebnis) if hasattr(ergebnis, "__len__") else 1
        schritte.append((name, round(dauer, 1), menge))
        log.info(
            "kollisionen_schritt",
            schritt=name,
            ms=round(dauer, 1),
            zeilen=menge,
            antrag_id=antrag_id,
            property_id=property_id,
        )
        return ergebnis

    gesamt_start = time.monotonic()
    gesamt = messen(
        "einheiten_zahl", lambda: einheiten_zahl(db, tenant_id, property_id)
    )
    alle_einheiten = messen(
        "einheiten_ids", lambda: einheiten_ids(db, tenant_id, property_id)
    )
    einheiten_namen = messen(
        "einheiten_namen", lambda: _einheiten_namen(db, tenant_id, property_id)
    )

    sperren = messen(
        "availability_sperren",
        lambda: _availability_sperren(db, property_id, von, bis),
    )
    belegt_je_tag = _belegte_einheiten_je_tag(sperren)
    stop_tage = messen(
        "stop_sell_tage", lambda: _stop_sell_tage(db, property_id, von, bis)
    )

    buchungen = messen(
        "buchungen",
        lambda: _buchungen(
            db, tenant_id, property_id, von, bis,
            unit_id=unit_id, namen=einheiten_namen, antrag_id=antrag_id,
        ),
    )
    sperrtage = _sperrtage(sperren, einheiten_namen)

    frei_je_tag = _freie_zahl_je_tag(naechte, belegt_je_tag, gesamt)
    freie_einheit = _durchgehend_freie_einheit(
        naechte, belegt_je_tag, alle_einheiten, unit_id=unit_id
    )

    # Der Riegel — dieselbe Frage wie im Schreibpfad. Die REIHENFOLGE nennt die
    # Ursache, die zuerst aufgelöst werden muss, und ist live gelernt: der
    # Antrag „2027 komplett" für Kornblomst hatte 365 `contract_end`-Nächte UND
    # 223 Stop-Sell-Tage. „Verkaufsstopp" zu melden wäre wahr, aber irreführend
    # gewesen — die 223 Tage wegzuräumen hätte nichts geändert, weil der
    # Verwaltungsvertrag vor 2027 endet. Die Vertragssperre kommt darum zuerst.
    vertrag_zu = any(s.source == "contract_end" for s in sperrtage)
    if als_kuendigung:
        # Eine Kündigung belegt nichts und bucht nichts — es gibt hier kein
        # Hindernis, das man „auflösen" müsste. Sie ist immer ausführbar; was
        # die Agentur wissen muss, sind die Buchungen dahinter (unten in
        # `buchungen`), und die verhindern sie nicht (0359: eine bestätigte
        # Buchung wird bedient, der Vertrag läuft für sie aus).
        blockiert = False
        grund = None
    elif vertrag_zu:
        blockiert = True
        grund = "vertragsende"
    elif freie_einheit is None:
        blockiert = True
        # Belegung schlägt Stop-Sell: ist gar keine Einheit frei, hilft das
        # Aufheben des Verkaufsstopps nicht.
        grund = "belegt"
    elif stop_tage:
        blockiert = True
        grund = "stop_sell"
    else:
        blockiert = False
        grund = None

    ergebnis = SperrantragKollisionen(
        property_id=property_id,
        als_kuendigung=als_kuendigung,
        unit_id=unit_id,
        unit_name=einheiten_namen.get(unit_id or ""),
        start_date=von,
        # Nach außen INKLUSIV, wie der Antrag gestellt wurde — die Oberfläche
        # zeigt „bis 31.12.", nicht den exklusiven 01.01. des Folgejahres.
        end_date=bis,
        naechte=len(naechte),
        einheiten_gesamt=gesamt,
        blockiert=blockiert,
        grund=grund,
        freie_einheit_id=freie_einheit,
        freie_einheit_name=einheiten_namen.get(freie_einheit or ""),
        min_freie_einheiten=min(frei_je_tag.values()) if frei_je_tag else gesamt,
        buchungen=buchungen[:MAX_LISTE],
        buchungen_gesamt=len(buchungen),
        sperrtage=sperrtage[:MAX_LISTE],
        sperrtage_gesamt=len(sperrtage),
        stop_sell_tage=sorted(stop_tage)[:MAX_LISTE],
        stop_sell_gesamt=len(stop_tage),
        gekuerzt=(
            len(buchungen) > MAX_LISTE
            or len(sperrtage) > MAX_LISTE
            or len(stop_tage) > MAX_LISTE
        ),
    )
    log.info(
        "sperrantrag_kollisionen_geprueft",
        tenant_id=tenant_id,
        antrag_id=antrag_id,
        property_id=property_id,
        unit_id=unit_id,
        von=von.isoformat(),
        bis=bis.isoformat(),
        naechte=len(naechte),
        einheiten_gesamt=gesamt,
        blockiert=blockiert,
        grund=grund,
        als_kuendigung=als_kuendigung,
        buchungen=len(buchungen),
        sperrtage=len(sperrtage),
        stop_sell_tage=len(stop_tage),
        min_freie_einheiten=ergebnis.min_freie_einheiten,
        freie_einheit_id=freie_einheit,
        # DEBUGGING: Gesamtdauer und die Einzelschritte als (name, ms, zeilen).
        # Steht in DERSELBEN Zeile wie der Befund, damit man beim Nachlesen
        # nicht zwei Logzeilen zusammensuchen muss.
        gesamt_ms=round((time.monotonic() - gesamt_start) * 1000, 1),
        schritte=schritte,
    )
    return ergebnis


def konflikt_text(k: SperrantragKollisionen) -> str:
    """Der 409-Satz zum Befund — sagt, WAS im Weg steht und was zu tun ist.

    Ersetzt das nackte „Zeitraum enthält bereits belegte/gesperrte Tage", das
    aus dem Reservierungs-Schreibpfad kam und den Entscheider ohne Hinweis
    ließ, wo er suchen soll.
    """
    # Vertragsende zuerst und ALLEIN: es ist die einzige Ursache, die man nicht
    # „auflösen" kann, indem man etwas storniert oder aufhebt — der Zeitraum
    # liegt außerhalb der Verwaltung. Die anderen Hindernisse daneben zu
    # nennen, schickte die Entscheiderin auf eine Suche, die nichts bringt.
    if k.grund == "vertragsende":
        return (
            "Der Zeitraum liegt nach dem Ende des Verwaltungsvertrags für "
            "dieses Objekt — er ist deshalb komplett gesperrt und kann nicht "
            "zusätzlich als Eigennutzung belegt werden. Bitte zuerst den "
            "Vertrag beim Eigentümer verlängern."
        )
    teile: list[str] = []
    if k.buchungen_gesamt:
        # Die erste Buchung beim Namen nennen: bei einem einzelnen Hindernis
        # ist die Meldung damit vollständig und niemand muss die Liste öffnen.
        erste = k.buchungen[0] if k.buchungen else None
        if k.buchungen_gesamt == 1 and erste:
            teile.append(
                f"die Buchung {erste.bezeichnung} "
                f"({erste.check_in} – {erste.check_out})"
            )
        else:
            teile.append(f"{k.buchungen_gesamt} Buchungen")
    if k.sperrtage_gesamt:
        teile.append(f"{k.sperrtage_gesamt} gesperrte Nächte")
    if k.stop_sell_gesamt:
        teile.append(f"{k.stop_sell_gesamt} Stop-Sell-Tage")
    if not teile:
        # Blockiert, aber nichts aufzählbar: alle Einheiten sind durch
        # Belegung erschöpft, ohne dass eine EINZELNE Einheit durchgehend frei
        # wäre (verzahnte Buchungen). Kein erfundener Grund (Wurzel 4).
        teile.append("im Zeitraum keine durchgehend freie Einheit")
    was = ", ".join(teile)
    return (
        f"Der Zeitraum ist nicht frei: {was}. Bitte zuerst auflösen "
        "(Buchungen stornieren, Sperren/Stop-Sell aufheben), dann erneut "
        "genehmigen."
    )


# --- Bausteine ------------------------------------------------------------


def _availability_sperren(
    db: Client, property_id: str, von: date, bis: date
) -> list[dict]:
    """Kalenderzeilen im Zeitraum, die den REZEPTIONS-Pfad zumachen.

    Der Kanal-Filter ist nicht Kosmetik: eine `source='portal'`-Sperre stammt
    aus dem Channex-Import und gilt nur für OTAs — der Schreibpfad ignoriert
    sie ebenfalls. Ohne diesen Filter zeigte die Vorschau Hindernisse, die es
    für diese Buchung nicht gibt.
    """
    rows = (
        db.table("availability")
        # KEINE `reservation_id` — die Spalte gibt es in `availability` nicht
        # (live geprüft 12.08.2026, sie warf `42703`). Ob hinter einer Zeile
        # eine Buchung steht, sagt der STATUS: `booked` = Buchung,
        # `blocked` = Sperre ohne Buchung. `block_request_id` ist der einzige
        # Fremdschlüssel hier und zeigt auf den Sperrantrag, nicht auf eine
        # Reservierung.
        .select("date, status, source, unit_id, block_request_id")
        .eq("property_id", property_id)
        .gte("date", von.isoformat())
        .lte("date", bis.isoformat())
        .execute()
    ).data or []
    return [
        r
        for r in rows
        if str(r.get("status") or "") in _ZU
        and availability_block_hits_channel(r.get("source"), RECEPTION)
    ]


def _belegte_einheiten_je_tag(sperren: list[dict]) -> dict[str, set[str]]:
    """Je Tag die Einheiten, die zu sind. `*` = der ganze Typ (Altbestand)."""
    belegt: dict[str, set[str]] = {}
    for r in sperren:
        tag = str(r["date"])[:10]
        belegt.setdefault(tag, set()).add(str(r.get("unit_id") or "*"))
    return belegt


def _freie_zahl_je_tag(
    naechte: list[date], belegt: dict[str, set[str]], gesamt: int
) -> dict[str, int]:
    """Freie Stückzahl je Tag — dieselbe Rechnung wie im ARI-Push."""
    frei: dict[str, int] = {}
    for tag in naechte:
        besetzt = belegt.get(tag.isoformat(), set())
        frei[tag.isoformat()] = (
            0 if "*" in besetzt else max(0, gesamt - len(besetzt))
        )
    return frei


def _durchgehend_freie_einheit(
    naechte: list[date],
    belegt: dict[str, set[str]],
    alle_einheiten: list[str],
    *,
    unit_id: str | None,
) -> str | None:
    """Welche Einheit ist im GANZEN Zeitraum frei? None = keine.

    Die Frage, die die RPC (0275) beantwortet, hier vorweggenommen: eine
    Eigennutzung braucht EINE Einheit für ALLE Nächte. Tageweise freie
    Stückzahl genügt nicht — bei zwei Einheiten und zwei verzahnten Buchungen
    ist jeden Tag „eine frei", aber keine durchgehend.

    Ist die Einheit vorgegeben, lautet die Frage nur noch, ob GENAU DIESE frei
    ist (der Antrag meint „Studio 3", keine Schwestereinheit).

    Ohne bekannte Einheiten (Altbestand ohne `property_units`) bleibt es beim
    strengen Verhalten des Schreibpfades: belegt ist belegt (Wurzel 5, lieber
    ablehnen als überbuchen).
    """
    tage = [t.isoformat() for t in naechte]
    if unit_id:
        frei = all(
            unit_id not in belegt.get(t, set())
            and "*" not in belegt.get(t, set())
            for t in tage
        )
        return unit_id if frei else None
    if not alle_einheiten:
        return None if any(belegt.get(t) for t in tage) else "*"
    for kandidat in alle_einheiten:
        if all(
            kandidat not in belegt.get(t, set())
            and "*" not in belegt.get(t, set())
            for t in tage
        ):
            return kandidat
    return None


def _stop_sell_tage(
    db: Client, property_id: str, von: date, bis: date
) -> set[str]:
    """Stop-Sell-Tage, die den Rezeptions-Pfad blocken.

    Taucht in `availability` NICHT auf und wäre ohne eigene Abfrage unsichtbar
    — der Schreibpfad prüft ihn separat und wirft 409. Objekt-Stopps
    (`rate_plan_id` null) blocken immer; plan-genaue Stopps blocken nur ihren
    Plan. Welchen Plan die Eigennutzung bekommt, entscheidet erst der
    Schreibpfad (ältester Plan des Objekts) — die Vorschau kennt ihn nicht
    und meldet plan-genaue Stopps darum NICHT als Hindernis. Sie sind unten
    trotzdem gezählt, aber nur objektweite blockieren.
    """
    rows = (
        db.table("stop_sell")
        .select("date, scope, channels, rate_plan_id")
        .eq("property_id", property_id)
        .gte("date", von.isoformat())
        .lte("date", bis.isoformat())
        .execute()
    ).data or []
    return {
        str(r["date"])[:10]
        for r in rows
        if r.get("rate_plan_id") is None
        and stop_sell_blocks_channel(r, RECEPTION)
    }


def _buchungen(
    db: Client,
    tenant_id: str,
    property_id: str,
    von: date,
    bis: date,
    *,
    unit_id: str | None,
    namen: dict[str, str],
    antrag_id: str | None,
) -> list[SperrantragKollision]:
    """Lebende Reservierungen, die den Zeitraum überlappen.

    Überlappung mit exklusivem Check-out: `check_in <= bis` UND
    `check_out > von`. Eine Buchung, die am Anreisetag des Antrags abreist,
    kollidiert NICHT — ihr Check-out-Tag ist wieder frei.

    Tenant-gescopt in derselben Abfrage (Wurzel 3): der Service-Role-Client
    umgeht RLS, und eine geratene property_id darf keine fremden Gastdaten
    ausliefern.

    Ist eine Einheit vorgegeben, bleiben Buchungen ANDERER Einheiten außen vor
    — sie stehen der Sperre von „Studio 3" nicht im Weg.

    `antrag_id`: die Eigennutzung, die aus DIESEM Antrag schon einmal entstand
    (abgebrochener Lauf), ist kein Hindernis für seine eigene Genehmigung.
    """
    letzte_nacht = bis.isoformat()
    rows = (
        db.table("reservations")
        .select(
            "id, guest_id, unit_id, check_in, check_out, status, channel, "
            "ota_name, total_amount, currency, is_owner_stay, owner_id, "
            "stay_name, block_request_id, guest_email"
        )
        .eq("tenant_id", tenant_id)
        .eq("property_id", property_id)
        # `not_.in_` mit einer echten LISTE — nicht mit dem PostgREST-String
        # `"(a,b,c)"`: den nimmt der Client wörtlich und Postgres wirft
        # `22P02 invalid input value for enum reservation_status: "("`
        # (live geprüft 12.08.2026).
        .not_.in_("status", list(_KEIN_HINDERNIS))
        .lte("check_in", letzte_nacht)
        .gt("check_out", von.isoformat())
        .order("check_in")
        .execute()
    ).data or []

    treffer = [
        r
        for r in rows
        if not (antrag_id and str(r.get("block_request_id") or "") == antrag_id)
        and (
            unit_id is None
            or r.get("unit_id") is None
            or str(r["unit_id"]) == unit_id
        )
    ]
    gast_namen = _gast_namen(
        db, tenant_id, {str(r["guest_id"]) for r in treffer if r.get("guest_id")}
    )
    return [_kollision(r, gast_namen, namen) for r in treffer]


def _kollision(
    r: dict, gast_namen: dict[str, str], einheiten: dict[str, str]
) -> SperrantragKollision:
    """Eine kollidierende Buchung in der Form, in der die Agentur entscheidet.

    `bezeichnung` ist die EINE Zeile, die im Dialog steht. Sie fällt NICHT auf
    einen erfundenen Platzhalter zurück (Wurzel 4): bei einer Eigennutzung
    steht der wahre Sachverhalt („Eigentümer-Aufenthalt"), bei einer Buchung
    ohne Gast-Zeile die Kurz-ID — nie ein ausgedachter Name.
    """
    gid = str(r["guest_id"]) if r.get("guest_id") else ""
    name = gast_namen.get(gid, "").strip()
    if r.get("is_owner_stay"):
        art = "eigennutzung"
        bezeichnung = str(r.get("stay_name") or "").strip() or "Eigentümer-Aufenthalt"
    else:
        art = "buchung"
        bezeichnung = name or str(r.get("guest_email") or "").strip() or (
            f"Buchung {str(r['id'])[:8]}"
        )
    return SperrantragKollision(
        reservation_id=str(r["id"]),
        art=art,
        bezeichnung=bezeichnung,
        unit_id=str(r["unit_id"]) if r.get("unit_id") else None,
        unit_name=einheiten.get(str(r.get("unit_id") or "")),
        check_in=_datum(r["check_in"]),
        check_out=_datum(r["check_out"]),
        status=str(r.get("status") or ""),
        channel=str(r.get("channel") or ""),
        ota_name=r.get("ota_name"),
        total_amount=(
            float(r["total_amount"]) if r.get("total_amount") is not None else None
        ),
        # Währung aus der Zeile, kein €-Ersatz (Wurzel 4). Fehlt sie, rendert
        # das Frontend symbollos statt eine falsche Währung zu behaupten.
        currency=r.get("currency"),
        is_owner_stay=bool(r.get("is_owner_stay")),
        owner_id=str(r["owner_id"]) if r.get("owner_id") else None,
    )


def _sperrtage(
    sperren: list[dict], einheiten: dict[str, str]
) -> list[SperrantragSperrtag]:
    """Gesperrte Nächte OHNE Buchung dahinter (Handwerker/Agentur/iCal).

    `status='blocked'` IST das Unterscheidungsmerkmal: eine Nacht mit einer
    Buchung dahinter trägt `booked` und steht schon in `buchungen`. Es gibt in
    `availability` keine `reservation_id`, über die man das anders prüfen
    könnte — der Status ist die Wahrheit.

    Auch eine `contract_end`-Sperre (Vertragsende des Eigentümers) landet hier:
    sie ist eine echte Sperre, die der Genehmigung im Weg steht, und muss
    benannt werden statt unerklärt zu blockieren.
    """
    tage = [
        SperrantragSperrtag(
            datum=_datum(r["date"]),
            unit_id=str(r["unit_id"]) if r.get("unit_id") else None,
            unit_name=einheiten.get(str(r.get("unit_id") or "")),
            source=str(r.get("source") or ""),
        )
        for r in sperren
        if str(r.get("status")) == "blocked"
    ]
    return sorted(tage, key=lambda t: (t.datum, t.unit_name or ""))


def _einheiten_namen(
    db: Client, tenant_id: str, property_id: str
) -> dict[str, str]:
    """Anzeigenamen der Einheiten — sonst stünden im Dialog nackte UUIDs."""
    rows = (
        db.table("property_units")
        .select("id, name")
        .eq("tenant_id", tenant_id)
        .eq("property_id", property_id)
        .execute()
    ).data or []
    return {str(r["id"]): str(r.get("name") or "") for r in rows}


def _gast_namen(
    db: Client, tenant_id: str, guest_ids: set[str]
) -> dict[str, str]:
    """Gastnamen der kollidierenden Buchungen. Tenant-gescopt (Wurzel 3).

    Bewusst NUR der Name: die Entscheidung braucht keine Telefonnummer, und
    ausgelieferte Kontaktdaten wären Recon-Material (Wurzel 9).
    """
    if not guest_ids:
        return {}
    rows = (
        db.table("guests")
        .select("id, first_name, last_name")
        .eq("tenant_id", tenant_id)
        .in_("id", sorted(guest_ids))
        .execute()
    ).data or []
    return {
        str(r["id"]): " ".join(
            p for p in (r.get("first_name"), r.get("last_name")) if p
        ).strip()
        for r in rows
    }


def _datum(wert: object) -> date:
    if isinstance(wert, date):
        return wert
    return date.fromisoformat(str(wert)[:10])


def naechste_freie_spanne(
    db: Client, tenant_id: str, property_id: str, rng: DateRange
) -> tuple[date, date] | None:
    """Die längste durchgehend freie Spanne im Zeitraum (Hilfe, kein Riegel).

    Wozu: Sagt der Dialog nur „belegt", muss die Entscheiderin selbst suchen,
    was denn ginge. Diese Spanne ist der Vorschlag dafür — sie wird NICHT
    automatisch genehmigt, sondern angezeigt („frei wäre 03.02. – 28.11.").
    """
    naechte = rng.nights()
    if not naechte:
        return None
    gesamt = einheiten_zahl(db, tenant_id, property_id)
    sperren = _availability_sperren(db, property_id, naechte[0], naechte[-1])
    belegt = _belegte_einheiten_je_tag(sperren)
    stop = _stop_sell_tage(db, property_id, naechte[0], naechte[-1])

    beste: tuple[date, date] | None = None
    lauf_start: date | None = None
    vorher: date | None = None
    for tag in naechte:
        besetzt = belegt.get(tag.isoformat(), set())
        frei = (
            "*" not in besetzt
            and max(0, gesamt - len(besetzt)) > 0
            and tag.isoformat() not in stop
        )
        if frei and lauf_start is None:
            lauf_start = tag
        elif not frei and lauf_start is not None:
            beste = _laenger(beste, (lauf_start, vorher or lauf_start))
            lauf_start = None
        vorher = tag
    if lauf_start is not None and vorher is not None:
        beste = _laenger(beste, (lauf_start, vorher))
    return beste


def _laenger(
    a: tuple[date, date] | None, b: tuple[date, date]
) -> tuple[date, date]:
    if a is None:
        return b
    return a if (a[1] - a[0]) >= (b[1] - b[0]) else b


def tage_zwischen(von: date, bis: date) -> int:
    """Nächte von `von` bis `bis` INKLUSIV — für Anzeigetexte."""
    return (bis - von).days + 1
