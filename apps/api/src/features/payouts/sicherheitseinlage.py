"""Sicherheitseinlage — die Deckung, aus der eine Erstattung bezahlt wird.

WARUM SIE EXISTIERT (25.08.2026)
================================
Zusatzleistungen (0386) und Nachberechnungen (0469) sind **Direct Charges im
verbundenen Konto** des Betriebs. Stripe zahlt dieses Geld nach dem Rhythmus
SEINES Kontos aus — am Auszahlungslauf dieses Slices vorbei, den nur der
Marktplatz-Saldo der Plattform berührt. Live gemessen am Beta-Konto:
``payouts = daily``, ``delay_days = 7``, ``available = 0 DKK``.

Als die Buchung 6179a5d0 vom Portal storniert wurde, waren die 150,00 DKK des
Gastes damit längst auf dem Bankkonto des Betriebs. Es gab nichts, woraus man
erstatten konnte. Und das ist nicht sein Problem, sondern unser:
``controller.losses.payments = application`` — ein Minus auf dem Verbundkonto
trägt die PLATTFORM. ``debit_negative_balances`` steht zudem auf ``false``,
Stripe holt einen Fehlbetrag also nicht von seiner Bank.

Die Karenz aus 0411 (`payout_settings.karenz_tage`) schützt hier nicht: Sie
sitzt in `faelligkeit.basis_faelligkeit` und wirkt auf Marktplatz-Buchungen, die
vom Plattform-Saldo transferiert werden. Sie hat mit dem Verbundkonto-Saldo
nichts zu tun.

WIE SIE FUNKTIONIERT
====================
Nicht als Geld auf unserem Konto — sondern als **nicht auszahlbarer Teil seines
eigenen Saldos**:

1. Der Stripe-Rhythmus des Verbundkontos steht dauerhaft auf ``manual``
   (erzwungen in `stripe_saldo`). Stripe zahlt damit nichts von selbst aus.
2. Der gewünschte Rhythmus des Betriebs steht bei uns
   (`payout_settings.verbund_interval`) und steuert unseren Lauf.
3. Ausgezahlt wird ``verfügbar − Einlage``.
4. Eine Erstattung zieht direkt aus dem Saldo, der dadurch stehen bleibt —
   **ohne Transfer, ohne zweiten Geldweg**. Ein Transfer von unserem Konto
   zurück auf sein Konto wäre eine zweite Wahrheit über denselben Betrag und
   müsste bei jedem Storno gegengebucht werden.

WAS ZURÜCKGEHALTEN WIRD
=======================
Genau das noch erstattbare Volumen, nicht mehr:

* jede per Karte bezahlte Zusatzleistung und Nachberechnung,
* abzüglich dessen, was davon schon erstattet ist,
* solange der Aufenthalt nicht sicher vorbei ist (``check_out + karenz_tage``),
* und **unbefristet**, solange die Buchung storniert ist und noch nicht
  erstattet wurde — dort ist die Erstattung nicht bloß möglich, sondern fällig.

Die Höhe wird bei jedem Zugriff neu berechnet und NICHT gespiegelt. Eine
Summenspalte würde bei jedem Storno, jeder Erstattung und jeder Terminänderung
driften (Wurzel 1) — und niemand sieht einer falschen Summe an, dass sie falsch
ist.
"""
from __future__ import annotations

from datetime import UTC, date, datetime, timedelta

from supabase import Client

from src.core.logging import get_logger

log = get_logger("nextdays.payouts.sicherheitseinlage")

#: Fällt `karenz_tage` aus (fehlende Zeile), gilt dieser Wert. Er ist KEIN
#: erfundener Ersatz für einen unbekannten Betriebswert (Wurzel 4), sondern die
#: Voreinstellung der Spalte selbst (0411: `smallint default 3`) — dieselbe
#: Zahl, die eine neu angelegte Zeile bekäme. Hier hart abzubrechen wäre die
#: schlechtere Wahl: Ohne Antwort wäre die Einlage 0 und der Schutz aus.
KARENZ_FALLBACK_TAGE = 3

_LINK_STATUS_MIT_GELD = ("paid", "partially_refunded")


def karenz_tage(db: Client, tenant_id: str) -> int:
    """Karenz des Betriebs (0411) — dieselbe Frist wie im Marktplatz-Lauf.

    Bewusst DIESELBE Spalte und keine zweite Frist: „wie lange nach der Abreise
    kann noch etwas zurückkommen" ist eine Eigenschaft des Betriebs, keine des
    Zahlwegs. Zwei Zahlen dafür würden garantiert auseinanderlaufen.
    """
    rows = (
        db.table("payout_settings")
        .select("karenz_tage")
        .eq("tenant_id", tenant_id)
        .limit(1)
        .execute()
    ).data or []
    wert = rows[0].get("karenz_tage") if rows else None
    return int(wert) if wert is not None else KARENZ_FALLBACK_TAGE


def ist_aktiv(db: Client, tenant_id: str) -> bool:
    """Ist die Einlage für diesen Betrieb eingeschaltet?

    Default ist AN (Spalten-Default `true`). Fehlt die Zeile ganz, gilt
    ebenfalls AN — fail-closed: Wer keine Einstellung hat, bekommt den Schutz,
    nicht das Risiko.
    """
    rows = (
        db.table("payout_settings")
        .select("einlage_aktiv")
        .eq("tenant_id", tenant_id)
        .limit(1)
        .execute()
    ).data or []
    if not rows:
        return True
    wert = rows[0].get("einlage_aktiv")
    return True if wert is None else bool(wert)


def berechne(
    db: Client, tenant_id: str, *, heute: date | None = None
) -> dict[str, int]:
    """Einlage je Währung in Cent — ``{"dkk": 15000}``.

    Je Währung, nicht als eine Summe: Ein Betrieb kann in mehreren Währungen
    kassieren, und ein Stripe-Saldo ist immer währungsgetrennt. Eine
    zusammengezählte Zahl wäre über zwei Währungen hinweg bedeutungslos und
    würde die falsche Auszahlung kürzen (Wurzel 4).

    Der Währungsschlüssel ist KLEINGESCHRIEBEN — so, wie Stripe die Währung in
    Saldo und Auszahlung führt. Ohne diese Normalisierung würde ein Vergleich
    mit `saldo["available"]` („dkk" gegen unser „DKK") nie treffen und die
    Einlage stillschweigend als 0 gelten.
    """
    stichtag = heute or datetime.now(UTC).date()
    if not ist_aktiv(db, tenant_id):
        return {}
    frist = stichtag - timedelta(days=karenz_tage(db, tenant_id))
    summen: dict[str, int] = {}
    for tabelle in ("addon_payment_links", "reservation_charge_links"):
        for currency, cents in _offene_risiken(db, tenant_id, tabelle, frist).items():
            summen[currency] = summen.get(currency, 0) + cents
    return {k: v for k, v in summen.items() if v > 0}


def _offene_risiken(
    db: Client, tenant_id: str, tabelle: str, frist: date
) -> dict[str, int]:
    """Noch erstattbares Volumen EINER Link-Tabelle, je Währung in Cent.

    `frist` ist der Stichtag ``heute − karenz_tage``: Eine Buchung, deren
    Abreise davor liegt, gilt als sicher vorbei — ihr Geld wird freigegeben.

    Der Join läuft in zwei Abfragen statt einem Embed, weil PostgREST-Embeds
    über die Service-Role hier keinen Tenant-Filter auf die EINGEBETTETE Tabelle
    zulassen; der Scope muss aber auf beiden Seiten sitzen (Wurzel 3). Die
    Reservierungen werden deshalb explizit tenant-gescoped nachgeladen.
    """
    links = (
        db.table(tabelle)
        .select("id, reservation_id, currency, amount_cents, refunded_cents")
        .eq("tenant_id", tenant_id)
        .in_("status", list(_LINK_STATUS_MIT_GELD))
        .execute()
    ).data or []
    if not links:
        return {}
    res_ids = sorted({str(link["reservation_id"]) for link in links})
    buchungen: dict[str, dict] = {}
    # In Blöcken, damit die URL-Länge eines `in`-Filters nicht zur Grenze wird
    # (Wurzel 8: kein unbegrenzter Bereich).
    for i in range(0, len(res_ids), 200):
        teil = res_ids[i : i + 200]
        zeilen = (
            db.table("reservations")
            .select("id, status, check_out")
            .eq("tenant_id", tenant_id)
            .in_("id", teil)
            .execute()
        ).data or []
        for z in zeilen:
            buchungen[str(z["id"])] = z

    summen: dict[str, int] = {}
    for link in links:
        offen = int(link["amount_cents"]) - int(link.get("refunded_cents") or 0)
        if offen <= 0:
            continue
        res = buchungen.get(str(link["reservation_id"]))
        if res is None:
            # Kein Zugriff auf die Buchung (fremder Tenant oder gelöscht): Geld
            # zurückhalten, nicht freigeben. Fail-closed — der umgekehrte Fehler
            # kostet echtes Geld.
            summen[_waehrung(link)] = summen.get(_waehrung(link), 0) + offen
            continue
        if not _noch_erstattbar(res, frist):
            continue
        summen[_waehrung(link)] = summen.get(_waehrung(link), 0) + offen
    return summen


def _waehrung(link: dict) -> str:
    return str(link.get("currency") or "").lower()


def _noch_erstattbar(res: dict, frist: date) -> bool:
    """Muss für diese Buchung noch Deckung vorgehalten werden?

    Zwei Gründe, jeder allein ausreichend:

    * **Storniert und nicht erstattet** → die Erstattung ist FÄLLIG, nicht bloß
      möglich. Hier gilt keine Frist: Der Betrag bleibt gedeckt, bis er
      zurückgezahlt ist. Ohne diese Regel liefe die Deckung genau in dem Fall
      aus, für den sie gebaut wurde — die stornierte Buchung vom 25.08.2026 lag
      nur fünf Tage vor ihrer Abreise.
    * **Aufenthalt noch nicht sicher vorbei** (``check_out >= heute −
      karenz_tage``) → ein Storno kann noch kommen.

    Fehlt `check_out`, wird zurückgehalten: Ohne Abreisedatum ist nicht
    feststellbar, dass die Frist abgelaufen ist (Wurzel 4 — kein geratenes
    Datum).
    """
    if str(res.get("status") or "") == "cancelled":
        return True
    roh = res.get("check_out")
    if not roh:
        return True
    try:
        abreise = date.fromisoformat(str(roh)[:10])
    except ValueError:
        log.warning("einlage_check_out_unlesbar", reservation_id=str(res.get("id")))
        return True
    return abreise >= frist


def auszahlbar(
    db: Client,
    tenant_id: str,
    *,
    verfuegbar: dict[str, int],
    heute: date | None = None,
) -> dict[str, int]:
    """Was von ``verfuegbar`` (je Währung, Cent) tatsächlich ausgezahlt werden darf.

    ``max(0, …)``: Ist die Einlage höher als der Saldo — etwa weil eine
    Auszahlung lief, bevor die Einlage eingeführt wurde —, ist auszahlbar 0 und
    nicht ein negativer Betrag. Die Unterdeckung ist damit nicht behoben, aber
    sie wächst nicht weiter; sichtbar wird sie über
    `scripts/diagnose/einlage-pruefen.sh`.

    ``heute`` wird an :func:`berechne` durchgereicht und ist der Stichtag der
    Karenz. Im Betrieb bleibt er leer (= heute); gesetzt wird er von Tests.

    WARUM ER FEHLTE, ist eine eigene Lehre: ``berechne`` nahm ihn längst,
    ``auszahlbar`` reichte ihn nicht weiter. Die zwei Tests dazu setzten also
    einen Stichtag, der nie ankam — sie liefen gegen das ECHTE Datum. Grün
    waren sie nur, solange dieses Datum vor dem Ende der Karenz lag: Abreise
    28.08.2026 plus 3 Tage, also bis zum 30.08.2026. Am 31.08. wurden sie rot,
    ohne dass jemand etwas geändert hatte, und die CI meldete einen Fehler in
    der Auszahlungslogik, die in Wahrheit korrekt war (CLAUDE.md: Tests nie
    zeitzonen-/datumsabhängig).
    """
    einlage = berechne(db, tenant_id, heute=heute)
    return {
        currency: max(0, cents - einlage.get(currency.lower(), 0))
        for currency, cents in verfuegbar.items()
    }


def naechste_freigabe(
    db: Client, tenant_id: str, *, heute: date | None = None
) -> str | None:
    """Wann wird der nächste zurückgehaltene Betrag frei (ISO-Datum) — oder None.

    None hat hier ZWEI Bedeutungen, die die Oberfläche unterscheiden kann, weil
    sie die Einlage-Summe daneben kennt:

    * Einlage 0 → nichts zurückgehalten, kein Datum nötig.
    * Einlage > 0 und None → das Zurückgehaltene gehört zu STORNIERTEN
      Buchungen. Dafür gibt es kein Freigabedatum, sondern eine fällige
      Erstattung. Ein Datum zu nennen wäre eine Falschaussage: der Betrag wird
      nicht von selbst frei, er muss zurückgezahlt werden.
    """
    stichtag = heute or datetime.now(UTC).date()
    if not ist_aktiv(db, tenant_id):
        return None
    tage = karenz_tage(db, tenant_id)
    frist = stichtag - timedelta(days=tage)
    termine: list[date] = []
    for tabelle in ("addon_payment_links", "reservation_charge_links"):
        links = (
            db.table(tabelle)
            .select("reservation_id, amount_cents, refunded_cents")
            .eq("tenant_id", tenant_id)
            .in_("status", list(_LINK_STATUS_MIT_GELD))
            .execute()
        ).data or []
        offene_ids = sorted(
            {
                str(link["reservation_id"])
                for link in links
                if int(link["amount_cents"]) - int(link.get("refunded_cents") or 0) > 0
            }
        )
        for i in range(0, len(offene_ids), 200):
            zeilen = (
                db.table("reservations")
                .select("id, status, check_out")
                .eq("tenant_id", tenant_id)
                .in_("id", offene_ids[i : i + 200])
                .execute()
            ).data or []
            for z in zeilen:
                if str(z.get("status") or "") == "cancelled":
                    continue  # kein Freigabedatum, s. Docstring
                roh = z.get("check_out")
                if not roh:
                    continue
                try:
                    abreise = date.fromisoformat(str(roh)[:10])
                except ValueError:
                    continue
                if abreise >= frist:
                    termine.append(abreise + timedelta(days=tage + 1))
    return min(termine).isoformat() if termine else None
