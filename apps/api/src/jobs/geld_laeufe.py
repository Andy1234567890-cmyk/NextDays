"""Die drei geldbewegenden Läufe des Workers — Fachlauf ohne Zeitsteuerung.

WAS HIER LIEGT: Einzug fälliger Restzahlungen, der Auszahlungslauf an die
Betriebe und die Provisions-/Nutzungsabrechnung am Monatsersten. Der Worker
entscheidet, WANN sie laufen (Tick-Intervalle, Monatserster); WAS sie tun,
steht hier.

WARUM GETRENNT (25.08.2026): Die drei sind der einzige Teil des Workers, der
Geld bewegt, sie hängen alle am selben `STRIPE_SECRET_KEY`, und sie waren alle
vom selben Befund betroffen — ein fehlender Schlüssel sah aus wie ein
vorübergehender Netzfehler. Sie zusammen in einer Datei zu haben heißt: wer die
Fehlerbehandlung einer ändert, sieht die beiden anderen daneben.

DER BEFUND, den diese Fassung schließt: `nextdays-api` und `nextdays-worker`
fahren denselben Code, sind in Coolify aber zwei Anwendungen mit je eigener
Variablenliste. Live nachgemessen trug die API `STRIPE_SECRET_KEY`, der Worker
nicht. Alle drei Läufe fingen den Fehlschlag im breiten `except Exception` des
Ticks und schrieben `log.warning` — dieselbe Zeile wie bei einer abgelehnten
Karte. Jetzt trägt jeder Lauf einen eigenen Ereignisnamen auf Stufe ERROR, und
die Handlungsanweisung steht in der Meldung (Wurzel 5).

Der teuerste Einzelfall stand im Einzugslauf und ist in
`payments.service.charge_due_balance` behoben: der Client wurde erst
ausgewertet, NACHDEM die Zeile auf `charging` stand — der Konfigurationsfehler
schrieb sie dann auf `failed`, obwohl sie nie bei Stripe war, und der
stündliche Tick greift `failed` nie wieder auf (Wurzel 1).
"""
from __future__ import annotations

from datetime import date
from typing import TYPE_CHECKING

from src.core.logging import get_logger
from src.core.pflichtumgebung import melde_konfigurationsmangel

if TYPE_CHECKING:
    from supabase import Client

log = get_logger("nextdays.worker")

# Die Coolify-Anwendung, in der diese Läufe fahren. Steht in jeder Meldung,
# damit niemand die fehlende Variable bei der API sucht (dort ist sie gesetzt).
COOLIFY_APP = "nextdays-worker"


def _mangel(ereignis: str, exc: Exception, **felder: object) -> None:
    """Fehlender Stripe-Schlüssel — laut, mit Anweisung, mit Kontext."""
    melde_konfigurationsmangel(
        ereignis, "STRIPE_SECRET_KEY", exc, coolify_app=COOLIFY_APP, **felder
    )


def charge_due_balances(db: Client) -> None:
    """Fällige, noch offene Restzahlungen laden und je Zeile belasten.

    Jeder Charge ist idempotent (claim auf 'charging' + Stripe-idempotency_key);
    ein Fehler einer Zeile stoppt die übrigen nicht (best-effort je Zeile).
    """
    from src.features.payments.service import (  # noqa: PLC0415
        PaymentsConfigError,
        PaymentsError,
        PaymentsService,
    )

    # EIN Service nur zum Auflisten — er spricht dabei nicht mit Stripe.
    faellig = PaymentsService(service_client=db).due_balance_payments()
    charged = 0
    for pid, tenant_id in faellig:
        # Je Zeile ein Service MIT Mandant: er entscheidet, welche Stripe-Welt
        # gilt (`payments/welt.py`). Ohne den Mandanten belastete der Lauf jede
        # Zeile mit dem Live-Client — für einen Sandbox-Betrieb der falsche, und
        # seine Restzahlung wäre nie eingezogen worden (17.09.2026).
        svc = PaymentsService(service_client=db, tenant_id=tenant_id)
        try:
            svc.charge_due_balance(payment_id=pid)
            charged += 1
        except PaymentsConfigError as exc:
            # Der Mangel trifft JEDE Zeile gleich — weiterzulaufen schriebe nur
            # N-mal dieselbe Meldung. Die Zeilen bleiben 'scheduled' und werden
            # nach dem Setzen der Variablen eingezogen.
            _mangel(
                "balance_tick_nicht_konfiguriert", exc,
                faellig=len(faellig), eingezogen=charged,
            )
            return
        except PaymentsError as exc:
            # needs_action/failed hat charge_due_balance bereits persistiert.
            log.warning("balance_charge_failed", payment_id=pid, error=exc.message)
    if faellig:
        log.info("balance_tick", due=len(faellig), charged=charged)


def run_payouts(db: Client) -> None:
    """Zurückhaltungen freigeben, Plattform-Auszahlungen, dann Verbundkonten.

    Drei Schritte, zwei Töpfe: `gib_holds_frei` + `fuehre_lauf_aus` betreffen den
    PLATTFORM-Saldo (Marktplatz-Buchungen per Transfer), `run_verbund_auszahlungen`
    die Stripe-Konten der Betriebe (Zusatzleistungen, Nachberechnungen,
    Direktbuchungen als Direct Charge). Sie werden nie vermischt — sonst wäre
    dasselbe Geld zweimal unterwegs (Wurzel 1).
    """
    from src.features.payments.stripe_client import (  # noqa: PLC0415
        StripeNotConfiguredError,
    )
    from src.features.payouts.service import PayoutsService  # noqa: PLC0415
    from src.features.payouts.stripe_saldo import (  # noqa: PLC0415
        run_verbund_auszahlungen,
    )

    svc = PayoutsService(db=db)
    try:
        freigegeben = svc.gib_holds_frei()
        bilanz = svc.fuehre_lauf_aus()
        # Zweiter Topf, seit 0473 (s. `payouts/sicherheitseinlage.py`): Die
        # VERBUNDKONTEN zahlen nicht mehr von selbst aus — bei Stripe steht
        # `manual`, damit die Sicherheitseinlage zurückgehalten werden kann. Ohne
        # diesen Lauf bekäme ein Betrieb mit dem Wunsch „täglich" nie wieder eine
        # automatische Auszahlung. Läuft NACH `fuehre_lauf_aus`, weil dessen
        # Transfers erst den Saldo bilden, der hier ausgezahlt wird; in derselben
        # Runde ist das Geld dann noch `pending` und wird beim nächsten Tick
        # erfasst — kein Verlust, nur ein Tag Versatz.
        verbund = run_verbund_auszahlungen(db)
    except StripeNotConfiguredError as exc:
        # Ohne Schlüssel scheitert jede Zeile; der Lauf reicht den Mangel
        # bewusst durch, statt die Zeilen reihenweise auf 'failed' zu schreiben.
        # Sie bleiben fällig und laufen später von selbst.
        _mangel("payout_tick_nicht_konfiguriert", exc)
        return
    if bilanz["geprueft"] or freigegeben or verbund["ausgezahlt"]:
        log.info(
            "payout_tick",
            freigegeben=freigegeben,
            **bilanz,
            verbund_ausgezahlt=verbund["ausgezahlt"],
            verbund_fehler=verbund["fehler"],
        )


def bill_commissions(db: Client, heute: date) -> None:
    """Offene Provisionen + Nutzungsgebühren aller Betriebe für den Vormonat.

    Beide Läufe sind idempotent (deterministischer Stripe-idempotency_key je
    Tenant/Periode).

    Der Konfigurationsmangel wird hier NICHT gefangen, sondern an den Tick
    durchgereicht: dieser Lauf kommt nur einmal im Monat vorbei, und der Tick
    ist die Stelle, die weiß, für welchen Stichtag er ausfiel.
    """
    from src.features.subscriptions.service import (  # noqa: PLC0415
        SubscriptionsService,
    )

    svc = SubscriptionsService(service_client=db)
    periode = svc.abgelaufene_periode(heute)
    svc.bill_all_tenants_for_period(period=periode)
    # Modul „Dynamische Preise" (0,5 % vom Buchungsumsatz), je Währung ein
    # eigenes Invoice-Item. Eigener Lauf, damit ein Fehler im einen Pfad den
    # anderen nicht mitreißt (Wurzel 5).
    svc.bill_all_dynpricing(period=periode)
    # Schloss-Gebühr je GERÄT (0574) ist STILLGELEGT (Entscheidung 06.09.2026):
    # abgerechnet wird stattdessen je ANBIETER als Abo-Modul (0577). Beides
    # gleichzeitig hätte den Betrieb doppelt belastet — einmal „igloohome-Modul"
    # und einmal je Schloss.
    #
    # Der FAKTURIER-Lauf bleibt bewusst stehen: es können Zeilen aus der Zeit
    # vor der Umstellung offen sein, und eine erbrachte Leistung nicht
    # abzurechnen wäre ein stiller Verlust. Die ERFASSUNG ist weg — es
    # entstehen keine neuen Zeilen mehr.
    svc.bill_all_schloesser(period=periode)


def melde_commission_mangel(exc: Exception, heute: date) -> None:
    """Der Provisionslauf ist nicht konfiguriert — der teuerste der drei Fälle.

    Ginge er als `commission_tick_failed`-Warnung durch, stünde die Ursache
    erst vier Wochen später wieder zur Wahl, und bis dahin wäre keine Provision
    fakturiert.
    """
    _mangel("commission_tick_nicht_konfiguriert", exc, periode_bis=heute.isoformat())
