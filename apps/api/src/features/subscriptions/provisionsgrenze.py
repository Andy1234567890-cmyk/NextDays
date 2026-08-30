"""Provision erst ab Abo-Beginn — die zeitliche Grenze der Provisionspflicht.

Eigene Datei nach dem Muster von `provisionsdeckel.py`/`dynpricing.py`: eine
geschlossene Einheit, die `service.py` sonst über die 1500-Zeilen-Grenze
schiebt.

WOZU DIE GRENZE:
Wer ein Portal verbindet, zieht seine gesamte Buchungshistorie mit. Ohne
Datumsgrenze wird jede einzelne davon provisionspflichtig — live gemessen am
30.08.2026: die Aufstellung für August 2026 führte 106 Buchungen über
2.705,06 DKK, darunter 25 Aufenthalte vom 02.01.2025 bis 05.08.2026, also aus
der Zeit vor dem Abo (Beginn 07.08.2026). Der Betrieb hätte für Aufenthalte
gezahlt, die nie in unserem System lagen.

Betroffen waren sieben Einlesewege — Channex-Connect, `import-existing`
`include_past`, manueller Voll-Abgleich, Revisions-Feed, CSV-Import,
Lodgify-Migration und das manuelle Anlegen. Sie enden alle in derselben
Projektion und damit in `record_commission`; deshalb sitzt die Grenze DORT und
nicht siebenmal am Rand. Der Airbnb-Historien-Import machte es von Anfang an
richtig und schreibt bewusst ohne Provision — mit genau dieser Begründung im
Code: „Ein Import darf die Buchhaltung eines abgeschlossenen Geschäftsjahres
nicht nachträglich verändern." Diese Regel gilt jetzt für alle Wege.

WARUM DER AUFENTHALT UND NICHT DAS BUCHUNGSDATUM:
Entscheidung des Betreibers (30.08.2026): gemanagt wird der AUFENTHALT. Ab dem
Tag, an dem er in unserem System liegt, erbringen wir die Leistung — auch wenn
die Buchung selbst älter ist. Eine Buchung von vor dem Abo, deren Gast während
des Abos anreist, trägt also Provision.

Der zweite Grund ist die Datenlage: das Buchungsdatum fehlt bei drei der
sieben Wege ganz (CSV-Import und Lodgify-Migration liefern es nicht, manuelles
Anlegen trägt unsere eigene Uhr). Eine Grenze darauf wäre dort fail-open
gewesen. Die Anreise steht dagegen bei jedem Weg.
"""
from __future__ import annotations

from supabase import Client


def aufenthalt_ab_abo_beginn(
    db: Client, tenant_id: str, reservation_id: str
) -> bool:
    """Liegt die Anreise am oder nach dem Abo-Beginn?

    Der Abo-Beginn kommt aus `tenant_subscription.subscription_started_at`
    (0504), gefüllt aus Stripes `start_date` — dem Zeitpunkt des fremden
    Ereignisses, nie von unserer Uhr (Wurzel 5b).

    Fail-CLOSED (Wurzel 5) an beiden Enden: fehlt die Reservierung, ihre
    Anreise oder der Abo-Beginn, wird KEINE Provision erfasst. Ein fehlender
    Wert ist keine Erlaubnis — lieber nichts berechnen als einem Betrieb etwas
    in Rechnung stellen, das wir nicht belegen können.

    Wurzel 3: beide Zugriffe sind auf den Tenant gescopet — die service_role
    umgeht RLS, ein Fremdscope darf auch bei fremder `reservation_id` nicht
    greifen.
    """
    abo = (
        db.table("tenant_subscription")
        .select("subscription_started_at")
        .eq("tenant_id", tenant_id)
        .limit(1)
        .execute()
    ).data
    beginn = abo[0].get("subscription_started_at") if abo else None
    if not beginn:
        return False
    res = (
        db.table("reservations")
        .select("check_in")
        .eq("id", reservation_id)
        .eq("tenant_id", tenant_id)
        .limit(1)
        .execute()
    ).data
    check_in = res[0].get("check_in") if res else None
    if not check_in:
        return False
    # Vergleich auf TAGESEBENE: der Abo-Beginn trägt eine Uhrzeit (Stripe-
    # Zeitstempel), die Anreise ist ein reines Datum. Wer am Starttag anreist,
    # ist drin — die Uhrzeit des Vertragsabschlusses darf nicht darüber
    # entscheiden. Beide Werte sind ISO-8601, dort ist der lexikografische
    # Vergleich der chronologische.
    return str(check_in)[:10] >= str(beginn)[:10]
