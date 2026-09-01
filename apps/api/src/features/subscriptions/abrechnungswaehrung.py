"""Die Währung, in der bei Stripe fakturiert wird — und die Umrechnung dorthin.

DER BEFUND, den diese Datei schliesst (01.09.2026, live):
Die Provision wird in der WÄHRUNG DER BUCHUNG geführt (eine dänische Buchung
ergibt eine DKK-Zeile). Die Rechnung des Betriebs läuft dagegen in der Währung
seines Stripe-KUNDEN — und die steht bei Stripe unabänderlich fest, sobald die
erste Rechnung bezahlt ist. Fallen beide auseinander, nimmt Stripe das Item
NICHT auf die Rechnung: es bleibt mit `invoice: null` liegen, ohne Fehler, ohne
Ereignis, für immer. Live gemessen: 1.868,80 DKK auf einem EUR-Kunden, vom Lauf
als `commissions_billed` protokolliert, im Ledger auf `invoiced` — und trotzdem
nie berechnet. Gemeldet hat es kein Alarm, sondern der Betreiber („keine
Abrechnung funktioniert").

Das ist Wurzel 5 in Reinform: ein Kontroll-Signal, das niemand fängt, weil
Stripe hier gar keines sendet. Der einzige Schutz ist, VOR dem Erzeugen zu
prüfen, in welcher Währung der Kunde überhaupt fakturierbar ist.

WARUM DIE WÄHRUNG BEI STRIPE ERFRAGT WIRD und nicht in `tenant_subscription`
steht: Sie gehört dem Stripe-Kunden, nicht uns. Eine eigene Kopie wäre eine
zweite Wahrheit, die still veralten kann (Wurzel 4). `customer.currency` ist
leer, solange nie eine Rechnung lief — dann legt die ERSTE Fakturierung sie
fest, und wir dürfen die Buchungswährung nehmen.

KEIN FALLBACK: Ist ein Kurs nicht beschaffbar, schlägt die Abrechnung fehl
(503). Ein geratener Kurs erzeugte eine falsche Geldforderung — schlimmer als
ein ausgefallener Lauf, der beim nächsten Tick wiederkommt.
"""
from __future__ import annotations

from collections.abc import Callable
from datetime import date
from decimal import Decimal
from typing import TYPE_CHECKING

from stripe import StripeClient
from stripe import StripeError as _StripeError

from src.core.logging import get_logger

from .errors import SubscriptionsError

if TYPE_CHECKING:
    from supabase import Client

# Der Übersetzer Stripe-Fehler → SubscriptionsError; der Host reicht seine
# eigene Methode herein, damit hier keine zweite Fehlerabbildung entsteht.
Fehlerabbildung = Callable[[_StripeError], SubscriptionsError]

log = get_logger("nextdays.subscriptions.abrechnungswaehrung")


def _feld(obj: object, name: str, standard: object = None) -> object:
    """Ein Feld aus einem StripeObject ODER einem dict lesen.

    `StripeObject` ist kein dict-Subtyp; `obj["x"]` trägt zwar, `obj.get("x")`
    aber nicht überall. Diese Hilfe hält beide Formen aus — dieselbe Lehre wie
    in `preisliste.py`, wo `dict(obj)` und `obj.keys()` je einmal live
    gescheitert sind.
    """
    if isinstance(obj, dict):
        return obj.get(name, standard)
    wert = getattr(obj, name, standard)
    return standard if wert is None else wert


def kunden_waehrung(
    stripe: StripeClient, customer_id: str, stripe_err: Fehlerabbildung
) -> str | None:
    """Die festgelegte Rechnungswährung des Stripe-Kunden, oder None.

    None heisst: der Kunde hatte noch nie eine Rechnung, seine Währung ist noch
    offen und wird von der nächsten Fakturierung festgelegt.
    """
    try:
        kunde = stripe.v1.customers.retrieve(customer_id)
    except _StripeError as exc:
        raise stripe_err(exc) from exc
    waehrung = _feld(kunde, "currency")
    return str(waehrung).strip().upper() if waehrung else None


def stichtag(period: str) -> date:
    """Kurs-Stichtag: der 1. des abgerechneten Monats.

    Fest aus der Periode, NICHT aus `heute` — sonst ergäbe ein Wiederholungslauf
    einen anderen Kurs und damit einen anderen Betrag (Wurzel 2). Gleicher
    Stichtag wie der Provisionsdeckel (`provisionsdeckel.cap_stichtag`), damit
    Deckel und Umrechnung nie auf zwei verschiedenen Kursen sitzen.
    """
    jahr, monat = (int(t) for t in period.split("-")[:2])
    return date(jahr, monat, 1)


def umrechnen(
    db: Client, betrag: float, von: str, nach: str, period: str
) -> tuple[float, Decimal]:
    """`betrag` von `von` nach `nach` am Stichtag der Periode. Gibt (Betrag, Kurs).

    Gleiche Währung → unverändert mit Kurs 1. Kein Kurs beschaffbar → 503,
    nie ein geratener Wert (Wurzel 4).
    """
    von = von.strip().upper()
    nach = nach.strip().upper()
    if von == nach:
        return round(betrag, 2), Decimal("1")
    # Lazy-Import: nur im Fremdwährungsfall gebraucht, und der subscriptions-
    # Slice soll nicht beim Laden an owner_statements hängen.
    from src.features.owner_statements.fx import (  # noqa: PLC0415
        FxError,
        FxService,
    )

    try:
        kurs = FxService(db).get_rate(stichtag(period), von, nach)
    except FxError as exc:
        raise SubscriptionsError(
            f"Provision nicht umrechenbar ({von}→{nach}): {exc}",
            status_code=503,
        ) from exc
    return round(betrag * float(kurs), 2), kurs


def fakturierbar(
    db: Client,
    stripe: StripeClient,
    stripe_err: Fehlerabbildung,
    *,
    customer_id: str,
    betrag: float,
    quell_waehrung: str,
    period: str,
) -> tuple[float, str, Decimal]:
    """Betrag + Währung, in der das Invoice-Item TATSÄCHLICH fakturierbar ist.

    Gibt (Betrag, Währung, Kurs) zurück. Weicht die Kundenwährung von der
    Buchungswährung ab, wird umgerechnet — sonst bliebe das Item bei Stripe
    stumm liegen (s. Modul-Docstring).
    """
    ziel = kunden_waehrung(stripe, customer_id, stripe_err)
    quelle = quell_waehrung.strip().upper()
    if ziel is None or ziel == quelle:
        # Noch keine Kundenwährung: diese Fakturierung legt sie fest.
        return round(betrag, 2), quelle, Decimal("1")
    umgerechnet, kurs = umrechnen(db, betrag, quelle, ziel, period)
    log.info(
        "abrechnung_waehrung_umgerechnet",
        customer_id=customer_id, period=period,
        von=quelle, nach=ziel, betrag_quelle=betrag,
        betrag_ziel=umgerechnet, kurs=str(kurs),
    )
    return umgerechnet, ziel, kurs


def verteile_betrag(
    zeilen: list[dict[str, object]], fakturiert: float, feld: str
) -> dict[str, float]:
    """Den fakturierten Betrag anteilig auf die Ledger-Zeilen verteilen.

    Nach dem Monatsdeckel (und nach einer Umrechnung) ist der fakturierte
    Betrag kleiner als die Summe der Zeilen. Ohne diese Verteilung behauptete
    jede Zeile weiterhin ihren ungekappten Wert — der Ledger wiche dann von der
    Rechnung ab (Wurzel 1: der Gegenzustand zum Deckel).

    Der Rundungsrest landet auf der letzten Zeile, damit die Summe der Anteile
    EXAKT dem fakturierten Betrag entspricht. `feld` ist die Betragsspalte:
    `commission_amount` (Provision) bzw. `fee_amount` (Dynamische Preise).
    """
    summe = round(sum(float(z[feld]) for z in zeilen), 2)  # type: ignore[arg-type]
    if summe <= 0:
        return {str(z["id"]): 0.0 for z in zeilen}
    anteile: dict[str, float] = {}
    vergeben = 0.0
    for z in zeilen[:-1]:
        teil = round(fakturiert * float(z[feld]) / summe, 2)  # type: ignore[arg-type]
        anteile[str(z["id"])] = teil
        vergeben = round(vergeben + teil, 2)
    anteile[str(zeilen[-1]["id"])] = round(fakturiert - vergeben, 2)
    return anteile


def idempotenz_schluessel(
    art: str, tenant_id: str, period: str, betrag: float
) -> str:
    """Deterministischer Stripe-idempotency_key — MIT dem Betrag.

    Worker und manueller Endpunkt können parallel laufen und lesen dieselben
    pending-Zeilen; ein fester Schlüssel sorgt dafür, dass Stripe beim zweiten
    Lauf DASSELBE Invoice-Item zurückgibt statt ein zweites zu erzeugen.

    DER BETRAG GEHÖRT IN DEN SCHLÜSSEL: Kommt zwischen zwei Läufen desselben
    Tages eine Provision hinzu, ändert sich die Summe. Stripe beantwortet
    denselben Schlüssel mit abweichender Nutzlast dann mit HTTP 400
    (idempotency_error) — der Lauf fiel für diesen Betrieb stumm aus, live am
    01.09.2026 stündlich. Mit dem Betrag im Schlüssel ist ein geänderter Betrag
    ein NEUER Vorgang, ein unveränderter weiterhin derselbe (keine
    Doppel-Belastung).
    """
    return f"{art}:{tenant_id}:{period}:{int(round(betrag * 100))}"


def herkunft_metadaten(
    tenant_id: str, period: str, quell_betrag: float, quell_waehrung: str,
    kurs: Decimal,
) -> dict[str, str]:
    """Stripe-Metadaten, die die HERKUNFT des Betrags festhalten.

    Wurde umgerechnet, steht auf dem Item nur noch der Zielbetrag. Ohne diese
    Felder wäre am Item nicht mehr erkennbar, welcher Betrag in welcher Währung
    zugrunde lag und mit welchem Kurs gerechnet wurde — die Rechnung ließe sich
    nicht gegen den Ledger prüfen.
    """
    return {
        "tenant_id": tenant_id,
        "period": period,
        "quell_waehrung": quell_waehrung.strip().upper(),
        "quell_betrag": f"{quell_betrag:.2f}",
        "fx_kurs": str(kurs),
    }
