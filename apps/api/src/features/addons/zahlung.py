"""Zusatzleistungen per Stripe kassieren — Zahlungslink je Buchung.

GELDFLUSS (0386): Der Link entsteht als **Direct Charge im verbundenen Konto**
des Betriebs. Das Geld wird SEINEM Stripe-Saldo gutgeschrieben und von dort
ausgezahlt (`/konto/abrechnung`); die Plattform behält beim Charge
`tenants.addon_fee_bps` (Default 500 = 5 %) als `application_fee` ein.

Der Auszahlungslauf des payouts-Slices bleibt unberührt: Er transferiert
ausschließlich Marktplatz-Buchungen (`channel='portal'`) vom PLATTFORM-Saldo.
Eine Zusatzleistung fließt nie über beide Wege — sonst wäre sie doppelt bezahlt
(Wurzel 1).

Scope (Wurzel 3): Jeder Zugriff ist auf `ctx.tenant_id` gescopet; der Webhook
hat keinen Kontext und lädt den Link per ID aus der DB, nimmt Tenant und
Reservierung von dort und prüft zusätzlich das absendende verbundene Konto.
"""
from __future__ import annotations

import hashlib
from datetime import UTC, datetime
from typing import Any

from postgrest.exceptions import APIError
from supabase import Client

from src.core.logging import get_logger
from src.core.security import AuthContext
from src.features.payments import stripe_client as sc
from src.features.payments.stripe_client import META_ZWECK

from .schemas import AddonStatus, ZahlungslinkResponse

log = get_logger("nextdays.addons.zahlung")

_LINK_COLS = (
    "id, tenant_id, reservation_id, stripe_account_id, stripe_payment_link_id, "
    "stripe_price_id, stripe_product_id, url, currency, amount_cents, "
    "application_fee_cents, fee_bps, status, checkout_session_id, "
    "payment_intent_id, paid_at, created_at, refunded_cents, refunded_at"
)

# Wert des Zweck-Schlüssels (`stripe_client.META_ZWECK`) für DIESEN Zahlweg.
# Der Schlüsselname selbst liegt bei `stripe_client`, weil ihn auch die
# Nachberechnung (0469) setzt und der Webhook-Filter nur greift, solange beide
# denselben schreiben.
META_ZWECK_ADDON = "addon"


class ZahlungslinkFehler(Exception):
    """Fachlicher Fehler des Zahlungslink-Pfads."""

    def __init__(self, message: str, *, status_code: int = 400) -> None:
        super().__init__(message)
        self.message = message
        self.status_code = status_code


def _jetzt() -> str:
    return datetime.now(UTC).isoformat()


def _cent(betrag: Any) -> int:  # noqa: ANN401 — numeric aus der DB
    """Numeric-Betrag → Cent. Rundung kaufmännisch auf ganze Cent."""
    return int(round(float(betrag or 0) * 100))


def _netto_cent(position: dict) -> int:
    """Nettobetrag einer Position in Cent — Bemessungsgrundlage der Provision.

    `total` ist der BRUTTObetrag inkl. der Steuer des Betriebs. Die Provision
    wird bewusst auf den NETTObetrag gerechnet: Auf die Umsatzsteuer eines
    fremden Betriebs Provision zu nehmen, benachteiligt Betriebe in
    Hochsteuerländern (DK 25 %) gegenüber solchen mit niedrigerem Satz (LU 17 %)
    — bei identischem Nettopreis und identischer Leistung von uns.

    Ohne ausgewiesenen Steuersatz IST der Bruttobetrag der Nettobetrag; dann
    wird nichts herausgerechnet (kein geratener Standardsatz, Wurzel 4).
    """
    brutto = _cent(position.get("total"))
    satz = position.get("tax_rate")
    if satz in (None, ""):
        return brutto
    teiler = 1 + float(satz) / 100
    if teiler <= 0:
        return brutto
    return int(round(brutto / teiler))


def _antwort(row: dict, *, positionen: int) -> ZahlungslinkResponse:
    return ZahlungslinkResponse(
        id=str(row["id"]),
        reservation_id=str(row["reservation_id"]),
        url=str(row["url"]),
        currency=str(row["currency"]),
        amount_cents=int(row["amount_cents"]),
        application_fee_cents=int(row["application_fee_cents"]),
        fee_bps=int(row["fee_bps"]),
        status=str(row["status"]),
        positionen=positionen,
        paid_at=row.get("paid_at"),
        created_at=row.get("created_at"),
    )


class AddonZahlungService:
    """Zahlungslinks für offene Zusatzleistungen einer Buchung."""

    def __init__(self, service_client: Client) -> None:
        self._db = service_client

    # --- Scope -------------------------------------------------------------

    def _tenant(self, ctx: AuthContext) -> str:
        if not ctx.tenant_id:
            raise ZahlungslinkFehler("Kein Betrieb im Konto.", status_code=403)
        return ctx.tenant_id

    def _reservierung(self, tenant_id: str, reservation_id: str) -> dict:
        rows = (
            self._db.table("reservations")
            .select("id, tenant_id, currency")
            .eq("tenant_id", tenant_id)
            .eq("id", reservation_id)
            .limit(1)
            .execute()
        ).data or []
        if not rows:
            raise ZahlungslinkFehler("Buchung nicht gefunden.", status_code=404)
        return rows[0]

    def _konto(self, tenant_id: str) -> str:
        """Verbundenes Konto des Betriebs — ohne aktives Konto kein Zahlungslink."""
        rows = (
            self._db.table("tenant_billing_profile")
            .select("stripe_account_id, stripe_charges_enabled")
            .eq("tenant_id", tenant_id)
            .limit(1)
            .execute()
        ).data or []
        acct = str(rows[0].get("stripe_account_id") or "") if rows else ""
        if not acct:
            raise ZahlungslinkFehler(
                "Für diesen Betrieb ist noch kein Stripe-Konto verbunden. "
                "Bitte zuerst unter Konto → Zahlungen einrichten.",
                status_code=409,
            )
        if not rows[0].get("stripe_charges_enabled"):
            raise ZahlungslinkFehler(
                "Das Stripe-Konto ist noch nicht für Zahlungen freigeschaltet "
                "(offene Angaben bei Stripe).",
                status_code=409,
            )
        return acct

    def _fee_bps(self, tenant_id: str) -> int:
        rows = (
            self._db.table("tenants")
            .select("addon_fee_bps")
            .eq("id", tenant_id)
            .limit(1)
            .execute()
        ).data or []
        wert = rows[0].get("addon_fee_bps") if rows else None
        if wert is None:
            # Kein erfundener Ersatzsatz (Wurzel 4): Ohne Satz wüsste niemand,
            # was einbehalten wird.
            raise ZahlungslinkFehler(
                "Für diesen Betrieb ist kein Provisionssatz für "
                "Zusatzleistungen hinterlegt (addon_fee_bps).",
                status_code=422,
            )
        bps = int(wert)
        if not 0 <= bps <= 10000:
            raise ZahlungslinkFehler(
                "Provisionssatz für Zusatzleistungen ist ungültig (0..10000).",
                status_code=422,
            )
        return bps

    # --- Lesen -------------------------------------------------------------

    def _offene_positionen(self, tenant_id: str, reservation_id: str) -> list[dict]:
        return (
            self._db.table("reservation_addons")
            .select("id, name, total, tax_rate, status")
            .eq("tenant_id", tenant_id)
            .eq("reservation_id", reservation_id)
            .eq("status", AddonStatus.pending.value)
            .order("created_at")
            .execute()
        ).data or []

    def _aktueller_link(self, tenant_id: str, reservation_id: str) -> dict | None:
        rows = (
            self._db.table("addon_payment_links")
            .select(_LINK_COLS)
            .eq("tenant_id", tenant_id)
            .eq("reservation_id", reservation_id)
            .eq("status", "open")
            .limit(1)
            .execute()
        ).data or []
        return rows[0] if rows else None

    def _positions_ids(self, link_id: str) -> set[str]:
        rows = (
            self._db.table("addon_payment_link_items")
            .select("reservation_addon_id")
            .eq("link_id", link_id)
            .execute()
        ).data or []
        return {str(r["reservation_addon_id"]) for r in rows}

    def lesen(self, ctx: AuthContext, reservation_id: str) -> ZahlungslinkResponse | None:
        """Offenen Zahlungslink einer Buchung lesen — None, wenn keiner offen ist.

        Gleicht dabei EINMAL mit Stripe ab, ob der Link inzwischen bezahlt wurde.
        Der Regelweg ist der Webhook; dieser Abgleich fängt den Fall, dass der
        Connect-Webhook (noch) nicht zustellt — sonst bliebe eine bezahlte
        Zusatzleistung dauerhaft „offen" (Wurzel 5: nicht still falsch stehen
        lassen).
        """
        tenant_id = self._tenant(ctx)
        self._reservierung(tenant_id, reservation_id)
        link = self._aktueller_link(tenant_id, reservation_id)
        if not link:
            return None
        bezahlt = self._stripe_abgleich(link)
        if bezahlt:
            link = bezahlt
        return _antwort(link, positionen=len(self._positions_ids(str(link["id"]))))

    def _stripe_abgleich(self, link: dict) -> dict | None:
        """Prüft bei Stripe, ob der offene Link bezahlt ist, und verbucht ihn.

        Gibt die aktualisierte Zeile zurück oder None (unverändert offen).
        Netzwerk-/Stripe-Fehler dürfen das Lesen nicht kippen: Der Link bleibt
        dann sichtbar offen, was der Wahrheit unseres Wissensstands entspricht.
        """
        try:
            session = sc.find_paid_session(
                str(link["stripe_payment_link_id"]), acct=str(link["stripe_account_id"])
            )
        except Exception as exc:  # noqa: BLE001 — best effort, Hauptpfad bleibt
            log.warning("addon_link_abgleich_fehlgeschlagen", id=str(link["id"]), error=str(exc))
            return None
        if not session:
            return None
        verbuche_zahlung(
            self._db,
            link,
            session_id=str(session["id"]),
            payment_intent=session.get("payment_intent"),
            amount_total=session.get("amount_total"),
            bezahlt_am=session.get("created"),
        )
        rows = (
            self._db.table("addon_payment_links")
            .select(_LINK_COLS)
            .eq("id", link["id"])
            .limit(1)
            .execute()
        ).data or []
        return rows[0] if rows else None

    # --- Erstellen ---------------------------------------------------------

    def erstellen(self, ctx: AuthContext, reservation_id: str) -> ZahlungslinkResponse:
        """Zahlungslink über ALLE offenen Zusatzleistungen der Buchung.

        Idempotent (Wurzel 2): Deckt ein bereits offener Link genau dieselben
        Positionen ab, wird er zurückgegeben statt ein zweiter erzeugt. Weichen
        die Positionen ab (Extra dazugebucht oder storniert), wird der alte Link
        bei Stripe deaktiviert, bevor der neue entsteht — sonst bliebe eine
        bezahlbare URL mit veraltetem Betrag im Umlauf (Wurzel 1).
        """
        tenant_id = self._tenant(ctx)
        res = self._reservierung(tenant_id, reservation_id)
        offen = self._offene_positionen(tenant_id, reservation_id)
        if not offen:
            raise ZahlungslinkFehler(
                "Diese Buchung hat keine offenen Zusatzleistungen.", status_code=409
            )
        currency = str(res.get("currency") or "")
        if not currency:
            raise ZahlungslinkFehler(
                "Der Buchung fehlt eine Währung — Zahlungslink nicht möglich.",
                status_code=422,
            )
        # Der GAST zahlt brutto; die Provision bemisst sich am Netto (s. o.).
        betrag = sum(_cent(p.get("total")) for p in offen)
        netto = sum(_netto_cent(p) for p in offen)
        if betrag <= 0:
            raise ZahlungslinkFehler(
                "Die offenen Zusatzleistungen ergeben keinen zahlbaren Betrag.",
                status_code=422,
            )
        ids = {str(p["id"]) for p in offen}

        vorhanden = self._aktueller_link(tenant_id, reservation_id)
        if vorhanden:
            if (
                self._positions_ids(str(vorhanden["id"])) == ids
                and int(vorhanden["amount_cents"]) == betrag
            ):
                return _antwort(vorhanden, positionen=len(ids))
            self._zurueckziehen(vorhanden)

        acct = self._konto(tenant_id)
        bps = self._fee_bps(tenant_id)
        fee = netto * bps // 10000
        titel = _titel(offen)
        try:
            link = sc.create_payment_link(
                acct=acct,
                currency=currency,
                amount_cents=betrag,
                product_name=titel,
                application_fee_cents=fee,
                metadata={
                    META_ZWECK: META_ZWECK_ADDON,
                    "tenant_id": tenant_id,
                    "reservation_id": reservation_id,
                },
                idempotency_key=f"addonlink:{reservation_id}:{betrag}:{_schluessel(ids)}",
            )
        except Exception as exc:
            log.warning(
                "addon_zahlungslink_stripe_fehler",
                tenant_id=tenant_id,
                reservation_id=reservation_id,
                error=str(exc),
            )
            raise ZahlungslinkFehler(
                f"Stripe konnte den Zahlungslink nicht erstellen: {exc}",
                status_code=502,
            ) from exc

        zeile = {
            "tenant_id": tenant_id,
            "reservation_id": reservation_id,
            "stripe_account_id": acct,
            "stripe_payment_link_id": link["id"],
            "stripe_price_id": link["price_id"],
            "stripe_product_id": link["product_id"],
            "url": link["url"],
            "currency": currency,
            "amount_cents": betrag,
            "application_fee_cents": fee,
            "fee_bps": bps,
            "status": "open",
            "created_by": ctx.user_id,
        }
        try:
            angelegt = (
                self._db.table("addon_payment_links").insert(zeile).execute()
            ).data
        except APIError as exc:
            # Zwei gleichzeitige Klicks: der Verlierer trifft den partiellen
            # Unique-Index. Kein 500 — den Sieger zurückgeben (Wurzel 2).
            if "addon_payment_links_offen_uidx" not in str(exc):
                raise
            bestehend = self._aktueller_link(tenant_id, reservation_id)
            if not bestehend:
                raise
            sc.deactivate_payment_link(link["id"], acct=acct)
            return _antwort(
                bestehend, positionen=len(self._positions_ids(str(bestehend["id"])))
            )
        row = angelegt[0]
        self._db.table("addon_payment_link_items").insert(
            [
                {
                    "link_id": row["id"],
                    "reservation_addon_id": str(p["id"]),
                    "amount_cents": _cent(p.get("total")),
                }
                for p in offen
            ]
        ).execute()
        log.info(
            "addon_zahlungslink_erstellt",
            tenant_id=tenant_id,
            reservation_id=reservation_id,
            amount_cents=betrag,
            fee_cents=fee,
        )
        return _antwort(row, positionen=len(ids))

    # --- Zurückziehen ------------------------------------------------------

    def zurueckziehen(self, ctx: AuthContext, reservation_id: str) -> None:
        """Offenen Zahlungslink schließen (Gast soll nicht mehr zahlen können)."""
        tenant_id = self._tenant(ctx)
        self._reservierung(tenant_id, reservation_id)
        link = self._aktueller_link(tenant_id, reservation_id)
        if not link:
            return  # idempotent: nichts Offenes da
        self._zurueckziehen(link)

    def _zurueckziehen(self, link: dict) -> None:
        """Bei Stripe deaktivieren UND bei uns schließen (s. `schliesse_link`)."""
        schliesse_link(self._db, link)


def schliesse_link(db: Client, link: dict) -> None:
    """Bei Stripe deaktivieren UND bei uns schließen — in dieser Reihenfolge.

    Erst Stripe: Scheitert das, bleibt der Link bei uns offen und sichtbar,
    statt dass wir eine geschlossene Zeile führen, während die URL weiter
    Geld annimmt (fail-closed, Wurzel 5).

    Auf Modulebene, weil zwei Wege sie brauchen: das manuelle Zurückziehen
    (`AddonZahlungService.zurueckziehen`) und das Storno einer Position
    (`ziehe_link_zurueck_bei_storno`). Eine Kopie in der zweiten Aufrufstelle
    hätte die Reihenfolge Stripe-zuerst irgendwann verloren.
    """
    try:
        sc.deactivate_payment_link(
            str(link["stripe_payment_link_id"]), acct=str(link["stripe_account_id"])
        )
    except Exception as exc:
        log.warning(
            "addon_zahlungslink_deaktivieren_fehlgeschlagen",
            id=str(link["id"]),
            error=str(exc),
        )
        raise ZahlungslinkFehler(
            f"Stripe konnte den Zahlungslink nicht schließen: {exc}",
            status_code=502,
        ) from exc
    (
        db.table("addon_payment_links")
        .update({"status": "cancelled"})
        .eq("id", link["id"])
        .eq("status", "open")
        .execute()
    )
    log.info("addon_zahlungslink_zurueckgezogen", id=str(link["id"]))


def _titel(positionen: list[dict]) -> str:
    """Produktname, den der Gast auf der Stripe-Zahlseite sieht.

    Die Namen der gekauften Zusatzleistungen — kein Gastname, der gehört nicht
    auf eine öffentlich abrufbare Zahlseite.
    """
    namen = []
    for p in positionen:
        name = p.get("name") or {}
        if isinstance(name, dict) and name:
            namen.append(str(name.get("de") or next(iter(name.values()))))
    return ", ".join(namen) if namen else "Zusatzleistungen"


def _schluessel(ids: set[str]) -> str:
    """Stabiler Kurz-Schlüssel über die Positionen (für die Idempotenz).

    sha256 statt ``hash()``: Pythons String-Hash ist pro Prozess zufällig
    gesalzen — derselbe Retry aus einem anderen Worker hätte einen anderen
    Idempotency-Key bekommen und einen zweiten Link erzeugt (Wurzel 2).
    """
    roh = "|".join(sorted(ids)).encode()
    return hashlib.sha256(roh).hexdigest()[:16]


# --- Verbuchung (Webhook + Abgleich teilen sich diesen Weg) -------------------

def lade_link(db: Client, link_id: str) -> dict | None:
    """Zahlungslink per ID laden (Webhook-Pfad, ohne Auth-Kontext)."""
    rows = (
        db.table("addon_payment_links")
        .select(_LINK_COLS)
        .eq("id", link_id)
        .limit(1)
        .execute()
    ).data or []
    return rows[0] if rows else None


def ziehe_link_zurueck_bei_storno(
    db: Client, *, tenant_id: str, reservation_id: str, res_addon_id: str
) -> bool:
    """Offenen Zahlungslink schließen, wenn eine seiner Positionen storniert wird.

    Wurzel 1 — der Gegenzustand: Ohne das bliebe nach dem Storno eine bezahlbare
    Stripe-URL mit dem ALTEN Betrag im Umlauf. Der Betragsabgleich in
    ``verbuche_zahlung`` macht das besonders heikel: Er vergleicht die bezahlte
    Summe mit ``link.amount_cents`` und stimmt hier ja weiterhin — der Link wäre
    also verbucht worden, während das Positions-Update ``.eq("status",
    "pending")`` die stornierte Zeile bewusst überspringt. Ergebnis: echtes Geld
    für eine Leistung, die aus Rechnung und Eigentümer-Abrechnung gefallen ist,
    ohne dass jemand einen Fehler sieht.

    Rückgabe: True, wenn ein Link geschlossen wurde (für das Log der Aufrufer).

    NICHT best-effort: Scheitert das Schließen bei Stripe, wirft ``_zurueckziehen``
    einen 502 und das Storno bricht ab (fail-closed, Wurzel 5). Lieber eine
    Position, die noch storniert werden muss, als eine offene URL, die Geld für
    eine stornierte Leistung annimmt. Deshalb läuft dieser Schritt VOR dem
    Status-Wechsel.
    """
    links = (
        db.table("addon_payment_links")
        .select(_LINK_COLS)
        .eq("tenant_id", tenant_id)
        .eq("reservation_id", reservation_id)
        .eq("status", "open")
        .execute()
    ).data or []
    if not links:
        return False
    betroffen = (
        db.table("addon_payment_link_items")
        .select("link_id")
        .in_("link_id", [str(link["id"]) for link in links])
        .eq("reservation_addon_id", res_addon_id)
        .execute()
    ).data or []
    if not betroffen:
        # Der offene Link deckt diese Position nicht — sein Betrag bleibt richtig.
        return False
    ids = {str(b["link_id"]) for b in betroffen}
    for link in links:
        if str(link["id"]) in ids:
            schliesse_link(db, link)
    log.info(
        "addon_zahlungslink_wegen_storno_geschlossen",
        reservation_id=reservation_id,
        res_addon_id=res_addon_id,
        links=len(ids),
    )
    return True


def verbuche_zahlung(
    db: Client,
    link: dict,
    *,
    session_id: str,
    payment_intent: str | None,
    amount_total: int | None,
    bezahlt_am: int | None = None,
) -> None:
    """Bezahlten Zahlungslink verbuchen: Positionen auf `paid`, Beleg schreiben.

    Durchgehend idempotent (Wurzel 2) — jede Teilaktion hat ihren eigenen Guard,
    damit eine Webhook-Redelivery oder der Lese-Abgleich nichts doppelt tut und
    ein zwischendurch abgebrochener Lauf sich beim nächsten Mal vervollständigt:

    * Link-Stempel nur, solange er `open` ist,
    * Positionen nur, solange sie `pending` sind,
    * Beleg nur, wenn zu dieser Checkout-Session noch keiner existiert.

    Betragsabgleich (Wurzel 5): Weicht die bezahlte Summe vom Link ab, wird NICHT
    verbucht — lieber sichtbar offen als still falsch.

    ``bezahlt_am`` ist der Stripe-Zeitstempel der Checkout-Session (Unix-Sekunden)
    — WANN der GAST bezahlt hat. Er wird als `paid_at` geschrieben, nicht unsere
    Uhr (Wurzel 5b): Dieser Weg läuft auch als Nachlese Tage später. Live am
    25.08.2026 wurde eine Zahlung vom 20.08. 15:54 nachverbucht; mit unserer Uhr
    hätte am Beleg „25.08. 16:34" gestanden — plausibel, prüfbar falsch, und
    niemand erkennt es als Fehler. Fehlt der Wert, fällt der Code auf die eigene
    Uhr zurück UND meldet das laut, statt stillschweigend zu behaupten, der Gast
    habe gerade gezahlt.
    """
    link_id = str(link["id"])
    if amount_total is not None and int(amount_total) != int(link["amount_cents"]):
        log.warning(
            "addon_zahlung_betrag_weicht_ab",
            id=link_id,
            erwartet=int(link["amount_cents"]),
            erhalten=int(amount_total),
        )
        return
    jetzt = _jetzt()
    if bezahlt_am is None:
        log.warning(
            "addon_zahlung_ohne_quell_zeitstempel",
            id=link_id,
            session=session_id,
        )
        gezahlt = jetzt
    else:
        gezahlt = datetime.fromtimestamp(int(bezahlt_am), UTC).isoformat()
    (
        db.table("addon_payment_links")
        .update(
            {
                "status": "paid",
                "checkout_session_id": session_id,
                "payment_intent_id": payment_intent,
                "paid_at": gezahlt,
            }
        )
        .eq("id", link_id)
        .eq("status", "open")
        .execute()
    )
    positionen = (
        db.table("addon_payment_link_items")
        .select("reservation_addon_id")
        .eq("link_id", link_id)
        .execute()
    ).data or []
    addon_ids = [str(p["reservation_addon_id"]) for p in positionen]
    if addon_ids:
        (
            db.table("reservation_addons")
            # `charged_at` ist ebenfalls der Zeitpunkt der GASTzahlung, nicht
            # unserer Verarbeitung (Wurzel 5b).
            .update({"status": AddonStatus.paid.value, "charged_at": gezahlt})
            .in_("id", addon_ids)
            .eq("status", AddonStatus.pending.value)
            .execute()
        )
    _schreibe_beleg(db, link, session_id=session_id)
    log.info("addon_zahlung_verbucht", id=link_id, positionen=len(addon_ids))


def _schreibe_beleg(db: Client, link: dict, *, session_id: str) -> None:
    """Zahlungs-Beleg in `payments` — Typ `addon`, Referenz ist die Session.

    Warum die CHECKOUT-SESSION und nicht der PaymentIntent als `gateway_ref`:
    Der Webhook-Pfad für `payment_intent.succeeded` sucht Zahlungen per
    PaymentIntent-ID und würde die Buchung dann als vollständig bezahlt
    markieren und eine Plattform-Auszahlung planen (0217) — für eine
    Zusatzleistung wäre beides falsch. Über die Session-ID ist der Beleg
    eindeutig und bleibt von diesem Pfad unberührt. Der PaymentIntent selbst
    steht am Link (`payment_intent_id`) und ist damit für Erstattungen greifbar.
    """
    vorhanden = (
        db.table("payments")
        .select("id")
        .eq("gateway_ref", session_id)
        .limit(1)
        .execute()
    ).data or []
    if vorhanden:
        return
    db.table("payments").insert(
        {
            "reservation_id": str(link["reservation_id"]),
            "amount": round(int(link["amount_cents"]) / 100, 2),
            "currency": str(link["currency"]),
            "type": "addon",
            "gateway_ref": session_id,
            "status": "succeeded",
            "gateway": "stripe",
        }
    ).execute()


def verbuche_checkout_session(
    db: Client,
    session: Any,  # noqa: ANN401 — Stripe-Objekt ODER Dict (Tests)
    *,
    account: str | None,
) -> bool:
    """Webhook-Einstieg: `checkout.session.completed` eines Zusatzleistungs-Links.

    Gibt True zurück, wenn die Session zu diesem Zahlweg gehört und verarbeitet
    wurde — sonst False (fremde Checkout-Session, z. B. Tarif-Abo; der Aufrufer
    lässt sie dann unberührt).

    Drei Schranken, bevor Geld als vereinnahmt gilt:
    * Zweck-Metadata muss `addon` sein,
    * die Session muss auf `paid` stehen (`complete` allein reicht nicht — eine
      Session kann ohne Zahlung abschließen),
    * das absendende verbundene Konto muss das des Links sein (Wurzel 3: Ein
      fremdes Connect-Konto darf keine Zahlung an unserer Buchung auslösen).
    """

    def _feld(obj: Any, key: str) -> Any:  # noqa: ANN401
        if isinstance(obj, dict):
            return obj.get(key)
        try:
            return obj[key]
        except (KeyError, AttributeError, TypeError):
            return None

    meta = _feld(session, "metadata") or {}
    if str(_feld(meta, META_ZWECK) or "") != META_ZWECK_ADDON:
        return False
    link_ref = _feld(session, "payment_link")
    if not link_ref:
        return False
    rows = (
        db.table("addon_payment_links")
        .select(_LINK_COLS)
        .eq("stripe_payment_link_id", str(link_ref))
        .limit(1)
        .execute()
    ).data or []
    if not rows:
        log.warning("addon_zahlung_link_unbekannt", payment_link=str(link_ref))
        return False
    link = rows[0]
    if account and str(link["stripe_account_id"]) != str(account):
        log.warning(
            "addon_zahlung_fremdes_konto",
            id=str(link["id"]),
            erwartet=str(link["stripe_account_id"]),
            erhalten=str(account),
        )
        return False
    if str(_feld(session, "payment_status") or "") != "paid":
        log.info("addon_zahlung_session_unbezahlt", id=str(link["id"]))
        return True
    verbuche_zahlung(
        db,
        link,
        session_id=str(_feld(session, "id")),
        payment_intent=_feld(session, "payment_intent"),
        amount_total=_feld(session, "amount_total"),
        bezahlt_am=_feld(session, "created"),
    )
    return True


# --- Erstattung (0473) -------------------------------------------------------
#
# Der Rückweg zu `verbuche_zahlung`. Er lebt hier und nicht im addons-Service,
# weil er die Link-Tabellen und Stripe kennt; die fachlichen Schranken (Grund,
# Rechnung, Aufgabe, Zeitleiste) bleiben im Service, wo auch das Storno sie
# anwendet. Eine Kopie der Link-Mechanik dort hätte die Reihenfolge
# „erst Stripe, dann Bücher" irgendwann verloren.


def finde_link_fuer_position(
    db: Client, *, tenant_id: str, reservation_id: str, res_addon_id: str
) -> tuple[dict, int] | None:
    """Den Zahlungslink finden, über den DIESE Position bezahlt wurde.

    Rückgabe: ``(link, positions_betrag_cents)`` oder None, wenn die Position
    über keinen Zahlungslink läuft (dann war sie manuell gehakt oder ist offen).

    Der Positionsbetrag kommt aus `addon_payment_link_items.amount_cents` — dem
    Schnappschuss beim Erstellen des Links —, NICHT aus `reservation_addons.total`.
    Ein späterer Preis- oder Mengenwechsel darf nicht bestimmen, wie viel dem
    Gast zurückgezahlt wird; zurück bekommt er genau das, was er bezahlt hat.
    Der Wert ist deshalb auch die Bemessungsgrundlage, wenn ein Link mehrere
    Positionen deckt (Wäschepaket + Babybett): erstattet wird der Anteil DIESER
    Position, nicht der ganze Link.

    Berücksichtigt werden `paid`, `open` und die beiden Erstattungszustände:
    * `open` MUSS mit (fail-closed, Wurzel 5) — unser Link-Status ist nur unser
      Wissensstand. Genau hier lag der Fall vom 25.08.2026: bezahlt bei Stripe,
      `open` bei uns, weil der Connect-Webhook `checkout.session.completed` nie
      abonniert war.
    * `partially_refunded` MUSS mit, sonst wäre die zweite Position eines
      teil-erstatteten Links nicht mehr erstattbar.
    """
    links = (
        db.table("addon_payment_links")
        .select(_LINK_COLS)
        .eq("tenant_id", tenant_id)
        .eq("reservation_id", reservation_id)
        .in_("status", ["paid", "open", "partially_refunded", "refunded"])
        .execute()
    ).data or []
    if not links:
        return None
    posten = (
        db.table("addon_payment_link_items")
        .select("link_id, amount_cents")
        .in_("link_id", [str(link["id"]) for link in links])
        .eq("reservation_addon_id", res_addon_id)
        .execute()
    ).data or []
    if not posten:
        return None
    nach_id = {str(link["id"]): link for link in links}
    # Deckt mehr als ein Link dieselbe Position (Neuausstellung nach
    # Betragsänderung), gilt der BEZAHLTE. Nur so wird der Intent erstattet, aus
    # dem das Geld wirklich kam.
    bezahlt = [
        p
        for p in posten
        if str(nach_id[str(p["link_id"])].get("status")) != "open"
    ]
    gewaehlt = bezahlt[0] if bezahlt else posten[0]
    return nach_id[str(gewaehlt["link_id"])], int(gewaehlt["amount_cents"] or 0)


def hole_zahlungsstand_nach(db: Client, link: dict) -> dict:
    """Einen bei uns OFFENEN Link vor der Erstattung mit Stripe abgleichen.

    Ohne diesen Schritt wäre der reale Fall vom 25.08.2026 nicht erstattbar: Bei
    uns stand der Link `open` und die Position `pending`, während bei Stripe die
    Session `paid` war und 150,00 DKK im Verbundkonto lagen. Eine Erstattung
    hätte dann Geld zurückgezahlt, das in unseren Büchern nie eingegangen ist —
    ein Refund-Beleg ohne Elternbeleg, und die Position wäre weiter als offene
    Forderung geführt worden.

    Deshalb: erst nachverbuchen (Geldeingang festhalten), dann erstatten.
    Fail-closed (Wurzel 5) — antwortet Stripe nicht, wird NICHT erstattet.
    Rückgabe ist die aktuelle Link-Zeile.
    """
    if str(link.get("status")) != "open":
        return link
    try:
        session = sc.find_paid_session(
            str(link["stripe_payment_link_id"]), acct=str(link["stripe_account_id"])
        )
    except Exception as exc:
        log.warning(
            "addon_erstattung_abgleich_fehlgeschlagen",
            id=str(link["id"]),
            error=str(exc)[:200],
        )
        raise ZahlungslinkFehler(
            "Der Zahlungsstand bei Stripe konnte nicht geprüft werden — "
            "Erstattung abgebrochen. Bitte später erneut versuchen.",
            status_code=503,
        ) from exc
    if not session:
        raise ZahlungslinkFehler(
            "Zu dieser Zusatzleistung ist keine Kartenzahlung eingegangen. "
            "Es gibt nichts zu erstatten.",
            status_code=409,
        )
    verbuche_zahlung(
        db,
        link,
        session_id=str(session["id"]),
        payment_intent=session.get("payment_intent"),
        amount_total=session.get("amount_total"),
        bezahlt_am=session.get("created"),
    )
    aktuell = lade_link(db, str(link["id"]))
    if aktuell is None or str(aktuell.get("status")) == "open":
        # `verbuche_zahlung` steigt bei Betragsabweichung bewusst aus, ohne zu
        # schreiben. Dann ist unklar, WAS bezahlt wurde — und Unklarheit über
        # einen Betrag ist kein Grund zu erstatten, sondern einer abzubrechen.
        raise ZahlungslinkFehler(
            "Der bei Stripe eingegangene Betrag passt nicht zum Zahlungslink. "
            "Bitte den Zahlungsstand prüfen, bevor erstattet wird.",
            status_code=409,
        )
    return aktuell


def vermerke_erstattung_am_link(
    db: Client, link: dict, *, betrag_cents: int
) -> None:
    """Den erstatteten Betrag am Link fortschreiben (Wurzel 1, Gegenzustand).

    `refunded_cents` ist kumulativ, weil ein Link mehrere Positionen decken kann
    und jede einzeln erstattet wird. Der Status folgt dem Betrag — genau so, wie
    es der CHECK `addon_payment_links_refund_status` (0473) erzwingt: keine
    Zeile, die „erstattet" sagt und 0 Cent führt.

    Der Guard `.eq("refunded_cents", vorher)` macht die Fortschreibung
    verlustfrei gegen Nebenläufigkeit: Zwei Positionen desselben Links, in
    derselben Sekunde erstattet, würden sich sonst gegenseitig überschreiben und
    einer der beiden Beträge verschwände lautlos aus der Einlage-Berechnung.
    """
    vorher = int(link.get("refunded_cents") or 0)
    gesamt = vorher + int(betrag_cents)
    voll = int(link["amount_cents"])
    if gesamt > voll:
        raise ZahlungslinkFehler(
            "Die Summe der Erstattungen übersteigt den bezahlten Betrag.",
            status_code=409,
        )
    res = (
        db.table("addon_payment_links")
        .update(
            {
                "refunded_cents": gesamt,
                "refunded_at": _jetzt(),
                "status": "refunded" if gesamt == voll else "partially_refunded",
            }
        )
        .eq("id", link["id"])
        .eq("refunded_cents", vorher)
        .execute()
    )
    if not res.data:
        raise ZahlungslinkFehler(
            "Der Zahlungslink wurde zwischenzeitlich geändert. Bitte die Seite "
            "neu laden und erneut versuchen.",
            status_code=409,
        )
    log.info(
        "addon_zahlungslink_erstattung_vermerkt",
        id=str(link["id"]),
        betrag_cents=int(betrag_cents),
        gesamt_cents=gesamt,
    )


def bei_buchungsstorno(db: Client, *, tenant_id: str, reservation_id: str) -> dict:
    """Gegenzustand aller Zusatzleistungs-Zahlungslinks beim STORNO der BUCHUNG.

    Diese Lücke war der eigentliche Schaden am 25.08.2026 (Wurzel 1): Es gab
    `ziehe_link_zurueck_bei_storno` für das Storno EINER Position, aber nichts
    für das Storno der ganzen Buchung. `ReservationsService.cancel` schloss seit
    0469 den Nachberechnungs-Link — den Addon-Link nicht. Die stornierte Buchung
    6179a5d0 trug danach eine bezahlbare Stripe-URL über 150,00 DKK, und weil
    der Gast sie sogar bezahlt HATTE, lag das Geld im Verbundkonto, ohne dass
    irgendwo eine Forderung oder eine Erstattung erkennbar war.

    Zwei Fälle, streng getrennt:

    * **Noch nicht bezahlt** → Link bei Stripe deaktivieren und bei uns
      schließen. Sonst nimmt die URL weiter Geld für einen Aufenthalt an, den es
      nicht gibt.
    * **Schon bezahlt** (auch wenn er bei uns `open` steht!) → NICHT schließen,
      sondern den Geldeingang nachverbuchen und LAUT melden. Ein Schließen wäre
      hier die falsche Antwort: Es macht den Betrag unsichtbar, während er auf
      dem Konto liegt und dem Gast zusteht. Erstattet wird nicht automatisch —
      eine Erstattung braucht einen Grund und ist eine kaufmännische Entscheidung
      (Kulanzfrist, Teilleistung schon erbracht) —, aber sie muss AUFFINDBAR
      sein. Dafür sorgt das Ereignis `addon_refund_faellig` in der Zeitleiste.

    Fail-closed (Wurzel 5): Antwortet Stripe nicht, wirft diese Funktion. Der
    Aufrufer bricht das Storno ab. Lieber eine Buchung, die noch storniert werden
    muss, als eine offene URL oder ein unsichtbar vereinnahmter Betrag.

    Rückgabe: ``{"geschlossen": n, "bezahlt_offen": n}`` für das Log des
    Aufrufers.
    """
    links = (
        db.table("addon_payment_links")
        .select(_LINK_COLS)
        .eq("tenant_id", tenant_id)
        .eq("reservation_id", reservation_id)
        .in_("status", ["open", "paid", "partially_refunded"])
        .execute()
    ).data or []
    geschlossen = 0
    bezahlt_offen = 0
    for link in links:
        stand = str(link.get("status"))
        if stand != "open":
            # Bereits als bezahlt geführt: nichts zu deaktivieren (Stripe hat den
            # Link nach der ersten abgeschlossenen Session selbst inaktiv
            # gesetzt, `restrictions.completed_sessions.limit = 1`). Offen bleibt
            # allein die Erstattung.
            if int(link.get("refunded_cents") or 0) < int(link["amount_cents"]):
                bezahlt_offen += 1
                _melde_erstattung_faellig(db, link)
            continue
        try:
            session = sc.find_paid_session(
                str(link["stripe_payment_link_id"]),
                acct=str(link["stripe_account_id"]),
            )
        except Exception as exc:
            log.warning(
                "addon_storno_abgleich_fehlgeschlagen",
                id=str(link["id"]),
                error=str(exc)[:200],
            )
            raise ZahlungslinkFehler(
                "Der Zahlungsstand der Zusatzleistungen konnte bei Stripe nicht "
                "geprüft werden — Storno abgebrochen. Bitte später erneut "
                "versuchen.",
                status_code=503,
            ) from exc
        if session:
            # Bezahlt, obwohl bei uns offen — genau der Fall vom 25.08.2026.
            verbuche_zahlung(
                db,
                link,
                session_id=str(session["id"]),
                payment_intent=session.get("payment_intent"),
                amount_total=session.get("amount_total"),
                bezahlt_am=session.get("created"),
            )
            aktuell = lade_link(db, str(link["id"])) or link
            bezahlt_offen += 1
            _melde_erstattung_faellig(db, aktuell)
            continue
        schliesse_link(db, link)
        geschlossen += 1
    if links:
        log.info(
            "addon_zahlungslinks_bei_buchungsstorno",
            reservation_id=reservation_id,
            geschlossen=geschlossen,
            bezahlt_offen=bezahlt_offen,
        )
    return {"geschlossen": geschlossen, "bezahlt_offen": bezahlt_offen}


def _melde_erstattung_faellig(db: Client, link: dict) -> None:
    """Zeitleisten-Ereignis: „bezahlte Zusatzleistung, Buchung storniert".

    Der Betrag muss nach dem Storno auffindbar bleiben, sonst wiederholt sich
    genau der Fall, der 0473 ausgelöst hat: 150,00 DKK auf dem Stripe-Konto, die
    niemand mehr einer Buchung zuordnet. Best-effort (Wurzel 5) — die Zeitleiste
    ist eine Anzeigeschicht, ihr Fehlschlag darf ein Storno nicht kippen; der
    Zustand selbst steht am Link und wird von
    `scripts/diagnose/erstattung-pruefen.sh` gefunden.

    Idempotent (Wurzel 2): Ein zweites Storno derselben Buchung (oder ein Retry)
    schreibt kein zweites Ereignis — sonst stünde dieselbe Fälligkeit mehrfach
    in der Zeitleiste und sähe aus wie mehrere offene Beträge.
    """
    offen = int(link["amount_cents"]) - int(link.get("refunded_cents") or 0)
    try:
        vorhanden = (
            db.table("reservation_events")
            .select("id")
            .eq("reservation_id", str(link["reservation_id"]))
            .eq("kind", "addon_refund_faellig")
            .limit(1)
            .execute()
        ).data or []
        if vorhanden:
            return
        db.table("reservation_events").insert(
            {
                "tenant_id": str(link["tenant_id"]),
                "reservation_id": str(link["reservation_id"]),
                "kind": "addon_refund_faellig",
                "detail": {
                    "amount": round(offen / 100, 2),
                    "currency": str(link["currency"]),
                    "link_id": str(link["id"]),
                },
            }
        ).execute()
    except Exception as exc:  # noqa: BLE001 — Zeitleiste ist best-effort
        log.warning(
            "addon_erstattung_faellig_event_fehlgeschlagen",
            id=str(link["id"]),
            error=str(exc)[:200],
        )
