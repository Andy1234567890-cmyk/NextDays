"""Nachberechnung einer Website-Buchung per Stripe-Zahlungslink (0469).

WOFÜR: Ein Aufenthalt wird nachträglich teurer — die klassische manuelle
Verlängerung (`reservations.move(reprice=True)` hebt `total_amount` an), ein
Zusatzgast, ein Schaden. Der Gast soll die Differenz per Karte zahlen, ohne dass
jemand eine Rechnung außerhalb des Systems schreibt.

WARUM EIN LINK UND KEIN OFF-SESSION-CHARGE: Der reale Anlass (25.08.2026) war
eine aus Lodgify übernommene Buchung. Solche Datensätze haben keinen
Stripe-Customer und keine gespeicherte Karte — `PaymentsService.charge_due_balance`
kann dort nichts belasten. Ein Payment Link braucht nichts davon: der Gast
öffnet ihn und zahlt mit der Karte, die er gerade hat.

NUR DIE EIGENE WEBSITE (`channel='website'`): ausdrückliche Vorgabe. Bei einer
OTA-Buchung kassiert das Portal (dort wird auch verlängert), beim Marktplatz
läuft die Zahlung über die eigene Buchungsstrecke, und bei `direct` (Telefon/vor
Ort) ist der Zahlweg außerhalb des Systems vereinbart. Ein Link an einen
OTA-Gast wäre eine zweite Kasse für dieselbe Forderung.

GELDFLUSS: Direct Charge im verbundenen Konto des Betriebs (wie 0386) —
**provisionsfrei**. `channel='website'` trägt laut 0380 keine Provision, und
`PaymentsService._platform_fee_bps` gibt für alles außer `portal` 0 zurück. Der
5-%-Satz `tenants.addon_fee_bps` gilt für Zusatzleistungen und wird hier NICHT
herangezogen.

Scope (Wurzel 3): Jeder Zugriff aus der Oberfläche ist auf `ctx.tenant_id`
gescopet; der Webhook hat keinen Kontext, lädt den Link per Stripe-ID und nimmt
Tenant und Reservierung von dort — zusätzlich muss das absendende verbundene
Konto das des Links sein.
"""
from __future__ import annotations

from datetime import UTC, datetime
from typing import Any

from postgrest.exceptions import APIError
from supabase import Client

from src.core.logging import get_logger
from src.core.mail import MailError, MailService, OutboundMessage
from src.core.mail_empfaenger import sprache_fuer_gast
from src.core.mail_layout import Aktion, MailInhalt, mail_rendern, marke_bestdays
from src.core.mail_texte import text
from src.core.security import AuthContext
from src.features.payments import stripe_client as sc
from src.features.payments.stripe_client import META_ZWECK

from .schemas import (
    NachberechnungCreate,
    NachberechnungLink,
    NachberechnungStatus,
)
from .service import PaymentsError, connected_account, passe_restzahlung_an

log = get_logger("nextdays.payments.nachberechnung")

# Wert des Zweck-Schlüssels am Stripe-Objekt (Filter im Webhook, s.
# `stripe_client.META_ZWECK`).
META_ZWECK_NACHBERECHNUNG = "nachberechnung"

# Der EINZIGE Kanal, für den dieser Weg offensteht. Als Menge und nicht als
# `== "website"`, weil die Prüfung an drei Stellen gebraucht wird und ein
# späterer zweiter eigener Kanal hier eingetragen wird — nicht an der
# Aufrufstelle (Wurzel 3: Scope an einer Stelle erzwingen).
ERLAUBTE_KANAELE = frozenset({"website"})

_LINK_COLS = (
    "id, tenant_id, reservation_id, stripe_account_id, stripe_payment_link_id, "
    "stripe_price_id, stripe_product_id, url, currency, amount_cents, "
    "application_fee_cents, fee_bps, status, grund, basis_total_amount, "
    "checkout_session_id, payment_intent_id, paid_at, created_at, "
    "paid_manually, unpaid_at"
)

_RES_COLS = (
    "id, tenant_id, property_id, currency, channel, ota_name, "
    "source_channex_booking_id, status, total_amount, paid_amount, "
    "guest_email, guest_language, check_in, check_out"
)


def _jetzt() -> str:
    return datetime.now(UTC).isoformat()


def _cent(betrag: Any) -> int:  # noqa: ANN401 — numeric aus der DB
    """Betrag → Cent, kaufmännisch auf ganze Cent gerundet."""
    return int(round(float(betrag or 0) * 100))


def _antwort(row: dict, *, aktuelles_total: float | None = None) -> NachberechnungLink:
    basis = float(row.get("basis_total_amount") or 0)
    veraltet = (
        aktuelles_total is not None and abs(float(aktuelles_total) - basis) >= 0.005
    )
    return NachberechnungLink(
        id=str(row["id"]),
        reservation_id=str(row["reservation_id"]),
        url=str(row["url"]) if row.get("url") else None,
        currency=str(row["currency"]),
        amount_cents=int(row["amount_cents"]),
        application_fee_cents=int(row["application_fee_cents"]),
        fee_bps=int(row["fee_bps"]),
        status=str(row["status"]),
        grund=str(row["grund"]),
        bezahlt_manuell=bool(row.get("paid_manually")),
        basis_total_amount=basis,
        betrag_veraltet=veraltet,
        paid_at=row.get("paid_at"),
        created_at=row.get("created_at"),
    )


def _offener_betrag(res: dict) -> float | None:
    """Was der Gast dieser Buchung noch schuldet — oder None (nicht bestimmbar).

    Dieselbe Rechnung wie im Lesepfad (`reservations/reads.py`): `total − paid`.
    Die dortigen Ausnahmen (Airbnb, portal-kassiert) können hier nicht auftreten
    — der Kanal ist auf die eigene Website eingegrenzt —, die Storno-Ausnahme
    schon: eine stornierte Buchung fordert nichts.
    """
    if str(res.get("status") or "") == "cancelled":
        return None
    total = res.get("total_amount")
    if total is None:
        return None
    return max(0.0, round(float(total) - float(res.get("paid_amount") or 0), 2))


class NachberechnungService:
    """Zahlungslinks für Nachberechnungen an Website-Buchungen."""

    def __init__(
        self, service_client: Client, *, mail: MailService | None = None
    ) -> None:
        self._db = service_client
        self._mail = mail or MailService()

    # --- Scope -------------------------------------------------------------

    def _tenant(self, ctx: AuthContext) -> str:
        if not ctx.tenant_id:
            raise PaymentsError("Kein Betrieb im Konto.", status_code=403)
        return ctx.tenant_id

    def _reservierung(self, tenant_id: str, reservation_id: str) -> dict:
        rows = (
            self._db.table("reservations")
            .select(_RES_COLS)
            .eq("tenant_id", tenant_id)
            .eq("id", reservation_id)
            .limit(1)
            .execute()
        ).data or []
        if not rows:
            raise PaymentsError("Buchung nicht gefunden.", status_code=404)
        return rows[0]

    @staticmethod
    def _kanal_hinweis(res: dict) -> str | None:
        """Warum dieser Weg für diese Buchung NICHT offensteht — oder None.

        Fail-closed (Wurzel 5): Ein gesetztes `source_channex_booking_id` sperrt
        auch dann, wenn der Kanal `website` sagt. Eine über Channex importierte
        Buchung ist beim Portal entstanden, egal wie sie bei uns etikettiert ist
        — dort ist auch der Zahlweg vereinbart.
        """
        if res.get("source_channex_booking_id"):
            name = res.get("ota_name") or res.get("channel") or "Portal"
            return (
                f"Diese Buchung kam über {name}. Eine Nachberechnung wird dort "
                "abgewickelt, nicht bei uns."
            )
        kanal = str(res.get("channel") or "").lower()
        if kanal not in ERLAUBTE_KANAELE:
            return (
                "Nachberechnung per Zahlungslink gibt es nur für Buchungen über "
                "die eigene Website. Bei diesem Kanal wird die Zahlung an "
                "anderer Stelle vereinbart."
            )
        if str(res.get("status") or "") == "cancelled":
            return "Die Buchung ist storniert — sie fordert nichts mehr."
        return None

    def _pruefe_kanal(self, res: dict) -> None:
        hinweis = self._kanal_hinweis(res)
        if hinweis:
            raise PaymentsError(hinweis, status_code=409)

    # --- Lesen -------------------------------------------------------------

    def _aktueller_link(self, tenant_id: str, reservation_id: str) -> dict | None:
        rows = (
            self._db.table("reservation_charge_links")
            .select(_LINK_COLS)
            .eq("tenant_id", tenant_id)
            .eq("reservation_id", reservation_id)
            .eq("status", "open")
            .limit(1)
            .execute()
        ).data or []
        return rows[0] if rows else None

    def _vorschlag(self, tenant_id: str, res: dict, offen: float | None) -> float | None:
        """Vorbelegung des Betrags: die Differenz der letzten Preisänderung.

        Quelle ist das `repriced`-Ereignis der Zeitleiste, das seit 0469 den
        VORHERIGEN Betrag mitführt. Fehlt er (Altbestand — genau der Fall, der
        diesen Bau ausgelöst hat), gibt es keinen Vorschlag: dann tippt der
        Betrieb den Betrag selbst, statt dass wir eine plausible Zahl erfinden
        (Wurzel 4).
        """
        if offen is None or offen <= 0:
            return None
        rows = (
            self._db.table("reservation_events")
            .select("detail")
            .eq("tenant_id", tenant_id)
            .eq("reservation_id", str(res["id"]))
            .eq("kind", "repriced")
            .order("created_at", desc=True)
            .limit(1)
            .execute()
        ).data or []
        if not rows:
            return None
        detail = rows[0].get("detail") or {}
        vorher = detail.get("previous_total")
        nachher = detail.get("total_amount")
        if vorher is None or nachher is None:
            return None
        differenz = round(float(nachher) - float(vorher), 2)
        if differenz <= 0:
            return None
        return min(differenz, offen)

    def lesen(self, ctx: AuthContext, reservation_id: str) -> NachberechnungStatus:
        """Alles, was die Buchungsansicht braucht — in einem Aufruf.

        Gleicht dabei EINMAL mit Stripe ab, ob ein offener Link inzwischen
        bezahlt wurde. Der Regelweg ist der Webhook; dieser Abgleich fängt den
        Fall, dass der Connect-Webhook (noch) nicht zustellt — sonst bliebe eine
        bezahlte Nachberechnung dauerhaft „offen" (Wurzel 5).
        """
        tenant_id = self._tenant(ctx)
        res = self._reservierung(tenant_id, reservation_id)
        hinweis = self._kanal_hinweis(res)
        currency = str(res.get("currency") or "")
        link = self._aktueller_link(tenant_id, reservation_id)
        if link:
            bezahlt = self._stripe_abgleich(link)
            if bezahlt:
                link = bezahlt if str(bezahlt["status"]) == "open" else None
                res = self._reservierung(tenant_id, reservation_id)
        offen = _offener_betrag(res)
        total = res.get("total_amount")
        return NachberechnungStatus(
            moeglich=hinweis is None and bool(currency) and bool(offen),
            hinweis=(
                hinweis
                if hinweis
                else None
                if currency
                else "Der Buchung fehlt eine Währung — Zahlungslink nicht möglich."
            ),
            currency=currency,
            offen_amount=offen,
            vorschlag_amount=(
                self._vorschlag(tenant_id, res, offen) if hinweis is None else None
            ),
            link=(
                _antwort(
                    link,
                    aktuelles_total=float(total) if total is not None else None,
                )
                if link
                else None
            ),
            bezahlt=[_antwort(z) for z in self._bezahlte(tenant_id, reservation_id)],
        )

    def _bezahlte(self, tenant_id: str, reservation_id: str) -> list[dict]:
        """Bereits bezahlte Nachberechnungen der Buchung, neueste zuerst.

        Ohne diese Liste war nach der Zahlung nichts mehr zu sehen: Der Link
        verschwindet (er ist nicht mehr `open`), und `paid_amount` allein sagt
        nicht, WOFÜR es gestiegen ist. Genau das braucht der Betrieb aber, um
        einem Gast Auskunft zu geben.
        """
        return (
            self._db.table("reservation_charge_links")
            .select(_LINK_COLS)
            .eq("tenant_id", tenant_id)
            .eq("reservation_id", reservation_id)
            .eq("status", "paid")
            .order("paid_at", desc=True)
            .limit(20)
            .execute()
        ).data or []

    def _stripe_abgleich(self, link: dict) -> dict | None:
        """Prüft bei Stripe, ob der offene Link bezahlt ist, und verbucht ihn.

        Netzwerk-/Stripe-Fehler dürfen das Lesen nicht kippen: Der Link bleibt
        dann sichtbar offen, was unserem Wissensstand entspricht.
        """
        try:
            session = sc.find_paid_session(
                str(link["stripe_payment_link_id"]),
                acct=str(link["stripe_account_id"]),
            )
        except Exception as exc:  # noqa: BLE001 — best effort, Hauptpfad bleibt
            log.warning(
                "nachberechnung_abgleich_fehlgeschlagen",
                id=str(link["id"]),
                error=str(exc),
            )
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
            self._db.table("reservation_charge_links")
            .select(_LINK_COLS)
            .eq("id", link["id"])
            .limit(1)
            .execute()
        ).data or []
        return rows[0] if rows else None

    # --- Erstellen ---------------------------------------------------------

    def erstellen(
        self, ctx: AuthContext, reservation_id: str, req: NachberechnungCreate
    ) -> NachberechnungLink:
        """Zahlungslink über eine Nachberechnung erstellen.

        Idempotent (Wurzel 2): Lautet ein bereits offener Link auf denselben
        Betrag UND denselben Grund, wird er zurückgegeben statt ein zweiter
        erzeugt. Weicht etwas ab, wird der alte bei Stripe deaktiviert, bevor der
        neue entsteht — sonst bliebe eine bezahlbare URL mit dem alten Betrag im
        Umlauf (Wurzel 1).
        """
        tenant_id = self._tenant(ctx)
        res = self._reservierung(tenant_id, reservation_id)
        self._pruefe_kanal(res)
        currency = str(res.get("currency") or "")
        if not currency:
            raise PaymentsError(
                "Der Buchung fehlt eine Währung — Zahlungslink nicht möglich.",
                status_code=422,
            )
        offen = _offener_betrag(res)
        if not offen or offen <= 0:
            raise PaymentsError(
                "Diese Buchung hat keinen offenen Betrag — es gibt nichts "
                "nachzuberechnen.",
                status_code=409,
            )
        betrag = _cent(req.amount)
        # Der Client-Betrag ist ein Vorschlag, die Buchung ist die Wahrheit
        # (Wurzel 3). Mehr als offen ist keine Nachberechnung, sondern eine
        # Überzahlung, die niemand zurückbuchen könnte.
        if betrag > _cent(offen):
            raise PaymentsError(
                "Der Betrag übersteigt den offenen Betrag der Buchung.",
                status_code=422,
            )
        grund = req.grund.strip()

        vorhanden = self._aktueller_link(tenant_id, reservation_id)
        if vorhanden:
            if (
                int(vorhanden["amount_cents"]) == betrag
                and str(vorhanden["grund"]) == grund
            ):
                return _antwort(vorhanden, aktuelles_total=res.get("total_amount"))
            schliesse_link(self._db, vorhanden)

        acct = connected_account(self._db, tenant_id)
        try:
            link = sc.create_payment_link(
                acct=acct,
                currency=currency,
                amount_cents=betrag,
                product_name=grund,
                # Provisionsfrei: Website-Buchungen laufen nicht über uns
                # (0380). Kein Griff auf `addon_fee_bps` — das ist der Satz für
                # Zusatzleistungen und hier eine Falschabrechnung.
                application_fee_cents=0,
                metadata={
                    META_ZWECK: META_ZWECK_NACHBERECHNUNG,
                    "tenant_id": tenant_id,
                    "reservation_id": reservation_id,
                },
                idempotency_key=f"nachberechnung:{reservation_id}:{betrag}",
            )
        except Exception as exc:
            log.warning(
                "nachberechnung_stripe_fehler",
                tenant_id=tenant_id,
                reservation_id=reservation_id,
                error=str(exc),
            )
            raise PaymentsError(
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
            "grund": grund,
            "basis_total_amount": float(res.get("total_amount") or 0),
            "application_fee_cents": 0,
            "fee_bps": 0,
            "status": "open",
            "created_by": ctx.user_id,
        }
        try:
            angelegt = (
                self._db.table("reservation_charge_links").insert(zeile).execute()
            ).data
        except APIError as exc:
            # Zwei gleichzeitige Klicks: der Verlierer trifft den partiellen
            # Unique-Index. Kein 500 — den Sieger zurückgeben (Wurzel 2).
            if "reservation_charge_links_offen_uidx" not in str(exc):
                raise
            bestehend = self._aktueller_link(tenant_id, reservation_id)
            if not bestehend:
                raise
            sc.deactivate_payment_link(link["id"], acct=acct)
            return _antwort(bestehend, aktuelles_total=res.get("total_amount"))
        row = angelegt[0]
        log.info(
            "nachberechnung_link_erstellt",
            tenant_id=tenant_id,
            reservation_id=reservation_id,
            amount_cents=betrag,
        )
        return _antwort(row, aktuelles_total=res.get("total_amount"))

    # --- Zurückziehen ------------------------------------------------------

    def zurueckziehen(self, ctx: AuthContext, reservation_id: str) -> None:
        """Offenen Link schließen (der Gast soll nicht mehr zahlen können)."""
        tenant_id = self._tenant(ctx)
        self._reservierung(tenant_id, reservation_id)
        link = self._aktueller_link(tenant_id, reservation_id)
        if not link:
            return  # idempotent: nichts Offenes da
        schliesse_link(self._db, link)

    # --- Bezahlt ohne Karte (0470) -----------------------------------------

    def als_bezahlt_markieren(
        self, ctx: AuthContext, reservation_id: str
    ) -> NachberechnungLink:
        """Den offenen Zahlungslink als bezahlt markieren.

        Der Fall: Der Gast hat anders gezahlt (bar bei der Anreise, Überweisung,
        Karte an der Rezeption), der Link ist aber schon erstellt. Ohne diesen
        Weg bliebe eine bezahlbare URL im Umlauf UND die Zahlung außerhalb des
        Systems — sie fehlte in Rechnung und Eigentümer-Abrechnung.

        REIHENFOLGE (Wurzel 1): ZUERST bei Stripe deaktivieren, dann bei uns
        buchen. Andersherum wäre die Zahlung verbucht, während die URL weiter
        Geld annimmt — der Gast zahlte doppelt. Scheitert Stripe, bricht der
        Vorgang ab (fail-closed); der Betrieb kann es erneut versuchen.
        """
        tenant_id = self._tenant(ctx)
        res = self._reservierung(tenant_id, reservation_id)
        link = self._aktueller_link(tenant_id, reservation_id)
        if not link:
            raise PaymentsError(
                "Für diese Buchung ist kein Zahlungslink offen.", status_code=409
            )
        try:
            sc.deactivate_payment_link(
                str(link["stripe_payment_link_id"]),
                acct=str(link["stripe_account_id"]),
            )
        except Exception as exc:
            log.warning(
                "nachberechnung_deaktivieren_vor_manuell_fehlgeschlagen",
                id=str(link["id"]),
                error=str(exc),
            )
            raise PaymentsError(
                f"Stripe konnte den Zahlungslink nicht schließen: {exc}",
                status_code=502,
            ) from exc
        geclaimt = (
            self._db.table("reservation_charge_links")
            .update(
                {
                    "status": "paid",
                    "paid_manually": True,
                    "paid_by": ctx.user_id,
                    "paid_at": _jetzt(),
                }
            )
            .eq("id", link["id"])
            .eq("status", "open")
            .execute()
        ).data or []
        if not geclaimt:
            # Zwischen Lesen und Schreiben hat ein anderer Weg gebucht (echte
            # Stripe-Zahlung oder ein zweiter Klick) — nicht doppelt verbuchen.
            raise PaymentsError(
                "Die Nachberechnung wurde zwischenzeitlich geändert. Bitte die "
                "Seite neu laden.",
                status_code=409,
            )
        zeile = geclaimt[0]
        _verbuche_manuell(self._db, zeile)
        log.info(
            "nachberechnung_manuell_bezahlt",
            tenant_id=tenant_id,
            reservation_id=reservation_id,
            id=str(zeile["id"]),
            by=ctx.user_id,
        )
        return _antwort(zeile, aktuelles_total=res.get("total_amount"))

    def bezahlt_erfassen(
        self, ctx: AuthContext, reservation_id: str, req: NachberechnungCreate
    ) -> NachberechnungLink:
        """Eine bereits bezahlte Nachberechnung direkt erfassen — ohne Link.

        Der Fall: Der Gast hat die Verlängerung an der Rezeption bezahlt. Einen
        Stripe-Link zu erzeugen, nur um ihn gleich als bezahlt zu markieren,
        wäre ein Umweg mit einer bezahlbaren URL als Nebenwirkung.

        Dieselben Schranken wie beim Link (Kanal, Währung, Betrag ≤ offen): Der
        Betrag erhöht `paid_amount` und wandert in die Rechnung — er darf so
        wenig geraten sein wie eine Kartenzahlung (Wurzel 3).
        """
        tenant_id = self._tenant(ctx)
        res = self._reservierung(tenant_id, reservation_id)
        self._pruefe_kanal(res)
        currency = str(res.get("currency") or "")
        if not currency:
            raise PaymentsError(
                "Der Buchung fehlt eine Währung — Nachberechnung nicht möglich.",
                status_code=422,
            )
        offen = _offener_betrag(res)
        if not offen or offen <= 0:
            raise PaymentsError(
                "Diese Buchung hat keinen offenen Betrag — es gibt nichts "
                "nachzuberechnen.",
                status_code=409,
            )
        betrag = _cent(req.amount)
        if betrag > _cent(offen):
            raise PaymentsError(
                "Der Betrag übersteigt den offenen Betrag der Buchung.",
                status_code=422,
            )
        angelegt = (
            self._db.table("reservation_charge_links")
            .insert(
                {
                    "tenant_id": tenant_id,
                    "reservation_id": reservation_id,
                    "currency": currency,
                    "amount_cents": betrag,
                    "grund": req.grund.strip(),
                    "basis_total_amount": float(res.get("total_amount") or 0),
                    "application_fee_cents": 0,
                    "fee_bps": 0,
                    "status": "paid",
                    "paid_manually": True,
                    "paid_by": ctx.user_id,
                    "paid_at": _jetzt(),
                    "created_by": ctx.user_id,
                }
            )
            .execute()
        ).data
        zeile = angelegt[0]
        _verbuche_manuell(self._db, zeile)
        log.info(
            "nachberechnung_bezahlt_erfasst",
            tenant_id=tenant_id,
            reservation_id=reservation_id,
            amount_cents=betrag,
            by=ctx.user_id,
        )
        return _antwort(zeile, aktuelles_total=res.get("total_amount"))

    def bezahlt_zuruecknehmen(
        self, ctx: AuthContext, reservation_id: str, link_id: str, grund: str
    ) -> None:
        """Eine FÄLSCHLICH gesetzte Bezahlt-Markierung zurücknehmen (0470).

        Fachlich die Korrektur einer FEHLEINGABE, nicht eine Rückzahlung: es ist
        kein Geld geflossen, es wurde nur der falsche Haken gesetzt. Deshalb wird
        der Beleg entfernt und `paid_amount` wieder gesenkt.

        Zwei Schranken:
        * Nur eine MANUELLE Markierung. Eine per Stripe eingegangene Zahlung ist
          eine Tatsache — sie wird erstattet, nicht umgedeutet. Sonst verschwände
          eine vereinnahmte Kartenzahlung aus der Abrechnung, während das Geld
          auf dem Stripe-Konto liegt (dieselbe Regel wie beim Addon, 0397).
        * Keine festgeschriebene Rechnung (GoBD) → 409 mit Verweis auf die
          Korrekturrechnung.
        """
        tenant_id = self._tenant(ctx)
        self._reservierung(tenant_id, reservation_id)
        grund_sauber = grund.strip()
        if len(grund_sauber) < 3:
            raise PaymentsError(
                "Bitte einen Grund angeben (mindestens 3 Zeichen).",
                status_code=422,
            )
        rows = (
            self._db.table("reservation_charge_links")
            .select(_LINK_COLS)
            .eq("tenant_id", tenant_id)
            .eq("reservation_id", reservation_id)
            .eq("id", link_id)
            .limit(1)
            .execute()
        ).data or []
        if not rows:
            raise PaymentsError("Nachberechnung nicht gefunden.", status_code=404)
        zeile = rows[0]
        if str(zeile.get("status")) != "paid":
            raise PaymentsError(
                "Diese Nachberechnung ist nicht als bezahlt markiert.",
                status_code=409,
            )
        if not zeile.get("paid_manually"):
            raise PaymentsError(
                "Diese Zahlung ist über Stripe eingegangen. Sie lässt sich nicht "
                "zurücknehmen — bitte über die Zahlungsansicht erstatten.",
                status_code=409,
            )
        self._pruefe_keine_rechnung(tenant_id, reservation_id)
        geclaimt = (
            self._db.table("reservation_charge_links")
            .update(
                {
                    "status": "cancelled",
                    # Der Zahl-Zeitpunkt gehörte zu einer Zahlung, die es nicht
                    # gab — er darf nicht stehen bleiben (Wurzel 1).
                    "paid_at": None,
                    "unpaid_reason": grund_sauber,
                    "unpaid_by": ctx.user_id,
                    "unpaid_at": _jetzt(),
                }
            )
            .eq("id", link_id)
            .eq("status", "paid")
            .execute()
        ).data or []
        if not geclaimt:
            raise PaymentsError(
                "Die Nachberechnung wurde zwischenzeitlich geändert. Bitte die "
                "Seite neu laden.",
                status_code=409,
            )
        _storniere_manuell(self._db, zeile, grund=grund_sauber)
        log.info(
            "nachberechnung_bezahlt_zurueckgenommen",
            tenant_id=tenant_id,
            reservation_id=reservation_id,
            id=link_id,
            by=ctx.user_id,
        )

    def _pruefe_keine_rechnung(self, tenant_id: str, reservation_id: str) -> None:
        """409, wenn zur Buchung schon eine festgeschriebene Rechnung existiert.

        Festgeschrieben = Rechnungsnummer gezogen (GoBD). Entwürfe ohne Nummer
        dürfen sich noch ändern. Fail-closed (Wurzel 5): Antwortet die
        Rechnungstabelle nicht, wird NICHT zurückgenommen — ohne belastbare
        Auskunft über den Rechnungsstand ist die Rücknahme nicht zu vertreten.
        """
        try:
            rows = (
                self._db.table("invoices")
                .select("invoice_number")
                .eq("tenant_id", tenant_id)
                .eq("reservation_id", reservation_id)
                .eq("invoice_type", "invoice")
                .neq("status", "cancelled")
                .is_("deleted_at", "null")
                .not_.is_("invoice_number", "null")
                .limit(1)
                .execute()
            ).data or []
        except APIError as exc:
            log.warning(
                "nachberechnung_rechnungspruefung_fehlgeschlagen",
                reservation_id=reservation_id,
                error=str(exc),
            )
            raise PaymentsError(
                "Rechnungsstand konnte nicht geprüft werden — Rücknahme "
                "abgebrochen.",
                status_code=503,
            ) from exc
        if rows:
            raise PaymentsError(
                "Zur Buchung existiert bereits eine festgeschriebene Rechnung. "
                "Eine Korrektur läuft über die Stornorechnung in der "
                "Buchhaltung (GoBD).",
                status_code=409,
            )

    # --- Zustellen ---------------------------------------------------------

    def senden(self, ctx: AuthContext, reservation_id: str) -> NachberechnungLink:
        """Den offenen Link per E-Mail an den Gast schicken.

        In der Sprache des Gastes (Buchungssprache → Betriebssprache → Englisch)
        und unter der Marke myBestDays: Empfänger ist ein GAST, kein Betrieb
        (CLAUDE.md „Zwei Marken").

        Ein Fehlschlag wird NICHT verschluckt (Wurzel 5): Der Betrieb muss
        wissen, dass die Mail nicht rausging — er hat den Link ja auch zum
        Kopieren.
        """
        tenant_id = self._tenant(ctx)
        res = self._reservierung(tenant_id, reservation_id)
        link = self._aktueller_link(tenant_id, reservation_id)
        if not link:
            raise PaymentsError(
                "Für diese Buchung ist kein Zahlungslink offen.", status_code=409
            )
        empfaenger = str(res.get("guest_email") or "").strip()
        if not empfaenger:
            raise PaymentsError(
                "Für diese Buchung ist keine E-Mail-Adresse des Gastes "
                "hinterlegt — bitte den Link von Hand weitergeben.",
                status_code=422,
            )
        sprache = sprache_fuer_gast(
            self._db, guest_language=res.get("guest_language"), tenant_id=tenant_id
        )
        betrag = f"{int(link['amount_cents']) / 100:.2f} {link['currency']}"
        betreff = text("nachberechnung.betreff", sprache)
        inhalt = mail_rendern(
            MailInhalt(
                titel=betreff,
                absaetze=[
                    text(
                        "nachberechnung.absatz_grund",
                        sprache,
                        betrag=betrag,
                        grund=str(link["grund"]),
                    ),
                    text("nachberechnung.absatz_zahlung", sprache),
                ],
                aktion=Aktion(
                    text=text("nachberechnung.aktion", sprache), url=str(link["url"])
                ),
                hinweise=[text("nachberechnung.hinweis_einmal", sprache)],
                sprache=sprache,
            ),
            marke=marke_bestdays(),
        )
        try:
            self._mail.send(
                OutboundMessage(
                    to=empfaenger,
                    subject=betreff,
                    text=inhalt.text,
                    html=inhalt.html,
                    inline_bilder=inhalt.inline_bilder,
                )
            )
        except MailError as exc:
            log.warning(
                "nachberechnung_mail_fehlgeschlagen",
                reservation_id=reservation_id,
                error=exc.message,
            )
            raise PaymentsError(
                f"Die E-Mail an den Gast ging nicht raus: {exc.message}",
                status_code=502,
            ) from exc
        log.info(
            "nachberechnung_mail_versandt",
            tenant_id=tenant_id,
            reservation_id=reservation_id,
        )
        return _antwort(link, aktuelles_total=res.get("total_amount"))


# --- Gegenzustände + Verbuchung (Webhook, Abgleich und Buchungsänderung) ------

def schliesse_link(db: Client, link: dict) -> None:
    """Bei Stripe deaktivieren UND bei uns schließen — in dieser Reihenfolge.

    Erst Stripe: Scheitert das, bleibt der Link bei uns offen und sichtbar,
    statt dass wir eine geschlossene Zeile führen, während die URL weiter Geld
    annimmt (fail-closed, Wurzel 5).
    """
    try:
        sc.deactivate_payment_link(
            str(link["stripe_payment_link_id"]), acct=str(link["stripe_account_id"])
        )
    except Exception as exc:
        log.warning(
            "nachberechnung_link_deaktivieren_fehlgeschlagen",
            id=str(link["id"]),
            error=str(exc),
        )
        raise PaymentsError(
            f"Stripe konnte den Zahlungslink nicht schließen: {exc}",
            status_code=502,
        ) from exc
    (
        db.table("reservation_charge_links")
        .update({"status": "cancelled"})
        .eq("id", link["id"])
        .eq("status", "open")
        .execute()
    )
    log.info("nachberechnung_link_zurueckgezogen", id=str(link["id"]))


def ziehe_link_zurueck_bei_betragsaenderung(
    db: Client, *, tenant_id: str, reservation_id: str
) -> bool:
    """Offenen Nachberechnungs-Link schließen, weil sich die Buchung geändert hat.

    WURZEL 1 — der Gegenzustand: Ein Link lautet auf einen Betrag, der aus dem
    Stand der Buchung abgeleitet wurde (`basis_total_amount`). Wird der Zeitraum
    erneut verschoben, der Preis neu gerechnet oder die Buchung storniert, ist
    diese Ableitung hinfällig — die URL nimmt aber weiter Geld an. Der
    Betragsabgleich in `verbuche_zahlung` fällt darauf nicht herein (er
    vergleicht mit `amount_cents`, und der stimmt ja noch), verbucht also einen
    Betrag, den niemand mehr schuldet.

    NICHT best-effort: Scheitert das Schließen bei Stripe, wirft
    `schliesse_link` einen 502 und der Aufrufer bricht ab (fail-closed) —
    besser ein fehlgeschlagener Move als eine offene URL auf einen veralteten
    Betrag. Deshalb läuft dieser Schritt VOR der Änderung.

    Rückgabe: True, wenn ein Link geschlossen wurde (für das Log des Aufrufers).
    """
    links = (
        db.table("reservation_charge_links")
        .select(_LINK_COLS)
        .eq("tenant_id", tenant_id)
        .eq("reservation_id", reservation_id)
        .eq("status", "open")
        .execute()
    ).data or []
    if not links:
        return False
    for link in links:
        schliesse_link(db, link)
    log.info(
        "nachberechnung_link_wegen_aenderung_geschlossen",
        reservation_id=reservation_id,
        links=len(links),
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
    """Bezahlte Nachberechnung verbuchen: Beleg, `paid_amount`, Zeitleiste.

    Idempotent (Wurzel 2) über den Link-Claim: Das erste Update trifft die Zeile
    nur, solange sie `open` ist. Nur wer den Claim gewinnt, erhöht danach
    `paid_amount` — sonst würde eine Webhook-Redelivery den Betrag ein zweites
    Mal aufaddieren und die Buchung als überzahlt ausweisen.

    Betragsabgleich (Wurzel 5): Weicht die bezahlte Summe vom Link ab, wird
    NICHT verbucht — lieber sichtbar offen als still falsch.
    """
    link_id = str(link["id"])
    if amount_total is not None and int(amount_total) != int(link["amount_cents"]):
        log.warning(
            "nachberechnung_betrag_weicht_ab",
            id=link_id,
            erwartet=int(link["amount_cents"]),
            erhalten=int(amount_total),
        )
        return
    jetzt = _jetzt()
    geclaimt = (
        db.table("reservation_charge_links")
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
    ).data or []
    if not geclaimt:
        # Schon verbucht (Redelivery oder der Lese-Abgleich war zuerst da).
        log.info("nachberechnung_bereits_verbucht", id=link_id)
        return
    _schreibe_beleg(db, link, session_id=session_id)
    _erhoehe_bezahlt(db, link)
    log.info(
        "nachberechnung_verbucht", id=link_id, amount_cents=int(link["amount_cents"])
    )


def _schreibe_beleg(db: Client, link: dict, *, session_id: str) -> None:
    """Zahlungs-Beleg in `payments` — Typ `surcharge`, Referenz ist die Session.

    Warum die CHECKOUT-SESSION als `gateway_ref` und nicht der PaymentIntent:
    Der Webhook-Pfad für `payment_intent.succeeded` sucht Zahlungen per
    PaymentIntent-ID und würde die Buchung als vollständig bezahlt markieren und
    eine Plattform-Auszahlung planen (0217) — für eine Nachberechnung an einer
    provisionsfreien Website-Buchung wäre beides falsch. Über die Session-ID ist
    der Beleg eindeutig und bleibt von diesem Pfad unberührt; der PaymentIntent
    steht am Link und ist damit für Erstattungen greifbar. (Gleiches Muster wie
    beim Zusatzleistungs-Beleg, 0386.)
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
            "type": "surcharge",
            "gateway_ref": session_id,
            "status": "succeeded",
            "gateway": "stripe",
        }
    ).execute()


def _erhoehe_bezahlt(
    db: Client, link: dict, *, kind: str = "surcharge_paid"
) -> None:
    """`reservations.paid_amount` um den gezahlten Betrag erhöhen.

    Anders als eine Zusatzleistung ist die Nachberechnung TEIL von
    `total_amount` — ohne diesen Schritt bliebe die Buchung mit demselben
    offenen Betrag stehen, obwohl der Gast gezahlt hat, und der Betrieb würde
    ein zweites Mal anfordern. Die Spalte wird nirgends automatisch aus
    `payments` summiert (kein Trigger); wer einzahlt, pflegt sie mit (Wurzel 1).

    Lesen-dann-Schreiben statt einer atomaren Addition: PostgREST kann kein
    `paid_amount = paid_amount + x`. Das ist hier vertretbar, weil der Aufrufer
    den Link-Claim gewonnen hat (dieser Weg läuft je Zahlung genau einmal) und
    die anderen Schreiber dieser Spalte an anderen Ereignissen hängen
    (Check-out). Die geplante Restzahlung wird im selben Zug nachgezogen, sonst
    zöge der Worker-Tick später doppelt ein.
    """
    reservation_id = str(link["reservation_id"])
    rows = (
        db.table("reservations")
        .select("total_amount, paid_amount")
        .eq("id", reservation_id)
        .limit(1)
        .execute()
    ).data or []
    if not rows:
        log.warning("nachberechnung_buchung_fehlt", reservation_id=reservation_id)
        return
    res = rows[0]
    neu = round(
        float(res.get("paid_amount") or 0) + int(link["amount_cents"]) / 100, 2
    )
    (
        db.table("reservations")
        .update({"paid_amount": neu})
        .eq("id", reservation_id)
        .execute()
    )
    passe_restzahlung_an(
        db,
        reservation_id=reservation_id,
        total_amount=float(res.get("total_amount") or 0),
        paid_amount=neu,
    )
    try:
        db.table("reservation_events").insert(
            {
                "tenant_id": str(link["tenant_id"]),
                "reservation_id": reservation_id,
                "kind": kind,
                "detail": {
                    "amount": round(int(link["amount_cents"]) / 100, 2),
                    "currency": str(link["currency"]),
                    "grund": str(link["grund"]),
                },
            }
        ).execute()
    except Exception as exc:  # noqa: BLE001 — Zeitleiste ist best-effort
        log.warning(
            "nachberechnung_event_fehlgeschlagen",
            reservation_id=reservation_id,
            error=str(exc),
        )


def _verbuche_manuell(db: Client, link: dict) -> None:
    """Eine von Hand bestätigte Nachberechnung verbuchen.

    Derselbe Zielzustand wie bei einer Kartenzahlung — Beleg, `paid_amount`,
    Zeitleiste —, nur ohne Stripe-Session. Als Belegreferenz dient
    `manuell:<link_id>`: Sie ist eindeutig (eine Zeile = ein Beleg), macht die
    Herkunft im Zahlungsjournal lesbar und wird vom
    `payment_intent.succeeded`-Pfad nicht gefunden, der sonst die Buchung als
    vollständig bezahlt markieren und eine Auszahlung planen würde.
    """
    _schreibe_beleg(db, link, session_id=f"manuell:{link['id']}")
    _erhoehe_bezahlt(db, link, kind="surcharge_paid_manually")


def _storniere_manuell(db: Client, link: dict, *, grund: str) -> None:
    """Gegenzustand zu `_verbuche_manuell` (Wurzel 1).

    Der Beleg wird GELÖSCHT, nicht storniert: Es ist kein Geld geflossen, das
    zurückfließen müsste — es wurde der falsche Haken gesetzt. Eine Gegenbuchung
    würde zwei Zeilen über einen Vorgang schreiben, der nie stattgefunden hat.
    Anschließend sinkt `paid_amount` wieder und die geplante Restzahlung wird
    nachgezogen, sonst zöge der Worker-Tick zu wenig ein.
    """
    (
        db.table("payments")
        .delete()
        .eq("gateway_ref", f"manuell:{link['id']}")
        .execute()
    )
    _senke_bezahlt(db, link, grund=grund)


def _senke_bezahlt(db: Client, link: dict, *, grund: str) -> None:
    """`reservations.paid_amount` um eine zurückgenommene Nachberechnung senken.

    Spiegelbild zu `_erhoehe_bezahlt`. Ohne diesen Schritt behielte die Buchung
    ein „bereits bezahlt", das niemand gezahlt hat — und der Check-out schriebe
    es in die Rechnung fest. `max(0, …)` verhindert einen negativen Stand, falls
    `paid_amount` zwischenzeitlich anderweitig gesenkt wurde (Storno setzt es
    bei portal-kassierten Buchungen auf 0).
    """
    reservation_id = str(link["reservation_id"])
    rows = (
        db.table("reservations")
        .select("total_amount, paid_amount")
        .eq("id", reservation_id)
        .limit(1)
        .execute()
    ).data or []
    if not rows:
        log.warning("nachberechnung_buchung_fehlt", reservation_id=reservation_id)
        return
    res = rows[0]
    neu = max(
        0.0,
        round(float(res.get("paid_amount") or 0) - int(link["amount_cents"]) / 100, 2),
    )
    (
        db.table("reservations")
        .update({"paid_amount": neu})
        .eq("id", reservation_id)
        .execute()
    )
    passe_restzahlung_an(
        db,
        reservation_id=reservation_id,
        total_amount=float(res.get("total_amount") or 0),
        paid_amount=neu,
    )
    try:
        db.table("reservation_events").insert(
            {
                "tenant_id": str(link["tenant_id"]),
                "reservation_id": reservation_id,
                "kind": "surcharge_unpaid",
                "detail": {
                    "amount": round(int(link["amount_cents"]) / 100, 2),
                    "currency": str(link["currency"]),
                    "grund": str(link["grund"]),
                    "reason": grund,
                },
            }
        ).execute()
    except Exception as exc:  # noqa: BLE001 — Zeitleiste ist best-effort
        log.warning(
            "nachberechnung_event_fehlgeschlagen",
            reservation_id=reservation_id,
            error=str(exc),
        )


def verbuche_checkout_session(
    db: Client,
    session: Any,  # noqa: ANN401 — Stripe-Objekt ODER Dict (Tests)
    *,
    account: str | None,
) -> bool:
    """Webhook-Einstieg: `checkout.session.completed` einer Nachberechnung.

    Gibt True zurück, wenn die Session zu diesem Zahlweg gehört und verarbeitet
    wurde — sonst False (fremde Session; der Aufrufer lässt sie unberührt).

    Drei Schranken, bevor Geld als vereinnahmt gilt: Zweck-Metadata muss
    `nachberechnung` sein, die Session muss auf `paid` stehen (`complete` allein
    reicht nicht), und das absendende verbundene Konto muss das des Links sein
    (Wurzel 3).
    """

    def _feld(obj: Any, key: str) -> Any:  # noqa: ANN401
        if isinstance(obj, dict):
            return obj.get(key)
        try:
            return obj[key]
        except (KeyError, AttributeError, TypeError):
            return None

    meta = _feld(session, "metadata") or {}
    if str(_feld(meta, META_ZWECK) or "") != META_ZWECK_NACHBERECHNUNG:
        return False
    link_ref = _feld(session, "payment_link")
    if not link_ref:
        return False
    rows = (
        db.table("reservation_charge_links")
        .select(_LINK_COLS)
        .eq("stripe_payment_link_id", str(link_ref))
        .limit(1)
        .execute()
    ).data or []
    if not rows:
        log.warning("nachberechnung_link_unbekannt", payment_link=str(link_ref))
        return False
    link = rows[0]
    if account and str(link["stripe_account_id"]) != str(account):
        log.warning(
            "nachberechnung_fremdes_konto",
            id=str(link["id"]),
            erwartet=str(link["stripe_account_id"]),
            erhalten=str(account),
        )
        return False
    if str(_feld(session, "payment_status") or "") != "paid":
        log.info("nachberechnung_session_unbezahlt", id=str(link["id"]))
        return True
    verbuche_zahlung(
        db,
        link,
        session_id=str(_feld(session, "id")),
        payment_intent=_feld(session, "payment_intent"),
        amount_total=_feld(session, "amount_total"),
    )
    return True
