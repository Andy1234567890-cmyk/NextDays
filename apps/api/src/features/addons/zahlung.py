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

from .schemas import AddonStatus, ZahlungslinkResponse

log = get_logger("nextdays.addons.zahlung")

_LINK_COLS = (
    "id, tenant_id, reservation_id, stripe_account_id, stripe_payment_link_id, "
    "stripe_price_id, stripe_product_id, url, currency, amount_cents, "
    "application_fee_cents, fee_bps, status, checkout_session_id, "
    "payment_intent_id, paid_at, created_at"
)

# Metadata-Schlüssel am Stripe-Objekt. `nd_zweck` ist der Filter im Webhook:
# ohne ihn würde jedes fremde checkout.session.completed (Tarif-Abo, künftige
# Checkout-Nutzungen) hier landen.
META_ZWECK = "nd_zweck"
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
            link = sc.create_addon_payment_link(
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
    (
        db.table("addon_payment_links")
        .update(
            {
                "status": "paid",
                "checkout_session_id": session_id,
                "payment_intent_id": payment_intent,
                "paid_at": jetzt,
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
            .update({"status": AddonStatus.paid.value, "charged_at": jetzt})
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
    )
    return True
