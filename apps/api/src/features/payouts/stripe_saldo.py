"""Guthaben und Auszahlung des verbundenen Stripe-Kontos eines Betriebs.

Das ist die ANDERE Hälfte der Abrechnung. Zwei Töpfe, die nie vermischt werden:

* **Guthaben bei Stripe** (dieses Modul) — was der Betrieb selbst kassiert hat:
  Zusatzleistungen (0386) und Direktbuchungen laufen als Direct Charge in SEINEM
  verbundenen Konto. Das Geld liegt auf seinem Stripe-Saldo, wir haben es nie
  besessen. Ausgezahlt wird es von dort auf sein Bankkonto — entweder nach
  Rhythmus (täglich/wöchentlich/monatlich) oder auf Antrag.
* **Plattform-Auszahlungen** (`service.py`) — Marktplatz-Buchungen, die über
  unseren Saldo laufen und per Transfer weitergereicht werden.

Seit 0473 steuert Stripe den Rhythmus NICHT mehr selbst: Er steht dort dauerhaft
auf ``manual``, und unser Lauf zahlt nach dem Wunsch des Betriebs
(`payout_settings.verbund_interval`) aus — gekürzt um die **Sicherheitseinlage**
(`sicherheitseinlage.py`). Grund: Zusatzleistungen und Nachberechnungen sind
Direct Charges in SEINEM Konto; zahlte Stripe sie nach eigenem Rhythmus aus,
wäre der Saldo leer, sobald eine Erstattung fällig wird — genau der Fall vom
25.08.2026 (Buchung 6179a5d0, 150,00 DKK, ``available`` 0 DKK zum Storno-
Zeitpunkt). Und weil ``controller.losses.payments = application`` gilt, trägt ein
Minus auf dem Verbundkonto die Plattform.

Damit ist der Rhythmus die EINE Ausnahme von „Stripe ist die Wahrheit": Was bei
Stripe steht (`manual`) ist eine technische Voraussetzung, was der Betrieb
wünscht, steht bei uns. Beide Werte sind keine Kopien voneinander — sie
bedeuten Verschiedenes.

Scope (Wurzel 3): Das Konto kommt ausschließlich aus dem Profil des Tenants im
Token, nie aus dem Request.
"""
from __future__ import annotations

from calendar import monthrange
from datetime import UTC, date, datetime
from typing import Any

from supabase import Client

from src.core.logging import get_logger
from src.core.security import AuthContext
from src.features.payments import stripe_client as sc

from . import sicherheitseinlage
from .schemas import (
    OffenerPosten,
    ProtokollAntwort,
    ProtokollEintrag,
    StripeAuszahlung,
    StripeGuthaben,
    StripeRhythmusUpdate,
    StripeSaldoPosten,
)

log = get_logger("nextdays.payouts.stripe")

# Rhythmen, die wir anbieten. `manual` = keine automatische Auszahlung, das
# Guthaben bleibt stehen, bis der Betrieb sie beantragt.
ERLAUBTE_INTERVALLE = ("manual", "daily", "weekly", "monthly")

# Stripe-Bewegungstypen, die GELD AUS dem Konto herausbewegen. Alles andere ist
# ein Eingang. Bewusst als Positivliste: ein unbekannter neuer Typ landet dann
# im Eingang und ist sichtbar, statt aus dem Protokoll zu verschwinden.
AUSGANG_TYPEN = frozenset(
    {
        "payout",              # Auszahlung auf das eigene Bankkonto
        "payout_failure",      # fehlgeschlagene Auszahlung (Rückbuchung)
        "payout_cancel",
        "refund",              # Erstattung an den Gast
        "payment_refund",
        "application_fee",     # an die Plattform abgeführte Provision
        "adjustment",          # Rückbelastung/Chargeback
        "stripe_fee",
        "transfer",            # Weiterleitung an ein anderes Konto
    }
)

# Obergrenze je Abruf. Ohne Deckel könnte ein langes Konto tausende Zeilen in
# einem Request ziehen (Wurzel 8).
MAX_PROTOKOLL = 100

# Wie viele offene Zahlungslinks je Aufruf gegen Stripe geprüft werden. Jeder
# geprüfte Link ist EIN Stripe-Request; ohne Deckel wären es bei 100 offenen
# Posten 100 Requests pro Seitenaufruf (Wurzel 8: kein unbegrenzter Bereich).
# 25 deckt jeden realen Bestand ab — ein Betrieb mit mehr gleichzeitig offenen
# Forderungen hat ein anderes Problem —, und was ungeprüft bleibt, steht im Log.
MAX_ABGLEICH = 25


class StripeSaldoFehler(Exception):
    """Fachlicher Fehler des Saldo-/Auszahlungspfads."""

    def __init__(self, message: str, *, status_code: int = 400) -> None:
        super().__init__(message)
        self.message = message
        self.status_code = status_code


def _iso(epoch: Any) -> str | None:  # noqa: ANN401
    """Stripe-Zeitstempel (Sekunden) → ISO. None bleibt None (Wurzel 5b: keine
    Ersatz-Uhrzeit aus unserer eigenen Uhr)."""
    if epoch in (None, ""):
        return None
    return datetime.fromtimestamp(int(epoch), tz=UTC).isoformat()


class StripeSaldoService:
    """Saldo, Auszahlungen und Auszahlungs-Rhythmus des verbundenen Kontos."""

    def __init__(self, db: Client) -> None:
        self._db = db

    # --- Scope -------------------------------------------------------------

    def _tenant(self, ctx: AuthContext) -> str:
        if not ctx.tenant_id:
            raise StripeSaldoFehler("Kein Betrieb im Token.", status_code=403)
        return ctx.tenant_id

    def _konto(self, tenant_id: str) -> str | None:
        rows = (
            self._db.table("tenant_billing_profile")
            .select("stripe_account_id")
            .eq("tenant_id", tenant_id)
            .limit(1)
            .execute()
        ).data or []
        return str(rows[0].get("stripe_account_id") or "") or None if rows else None

    def _konto_pflicht(self, ctx: AuthContext) -> str:
        acct = self._konto(self._tenant(ctx))
        if not acct:
            raise StripeSaldoFehler(
                "Für diesen Betrieb ist kein Stripe-Konto verbunden.",
                status_code=409,
            )
        return acct

    # --- Lesen -------------------------------------------------------------

    def guthaben(self, ctx: AuthContext) -> StripeGuthaben:
        """Saldo, Rhythmus und die letzten Auszahlungen — in einem Aufruf.

        Ohne verbundenes Konto ist das kein Fehler, sondern ein Zustand: Die
        Oberfläche zeigt dann den Einrichtungs-Hinweis statt einer Fehlermeldung.
        """
        acct = self._konto(self._tenant(ctx))
        if not acct:
            return StripeGuthaben(konto_verbunden=False)
        try:
            saldo = sc.retrieve_balance(acct=acct)
            plan = sc.retrieve_payout_schedule(acct=acct)
            letzte = sc.list_payouts(acct=acct, limit=10)
        except Exception as exc:
            # Kein leerer Saldo als Ersatzantwort (Wurzel 4/5): „0 €" wäre eine
            # Falschaussage über das Geld des Betriebs.
            log.warning("stripe_saldo_abruf_fehlgeschlagen", error=str(exc))
            raise StripeSaldoFehler(
                f"Stripe-Saldo konnte nicht geladen werden: {exc}", status_code=502
            ) from exc
        tenant_id = self._tenant(ctx)
        wunsch = self._rhythmus_uebernehmen(tenant_id, acct, plan)
        anker = self._anker(tenant_id)
        einlage = sicherheitseinlage.berechne(self._db, tenant_id)
        verfuegbar = {
            str(p["currency"]).lower(): int(p["amount_cents"])
            for p in saldo["available"]
        }
        frei = sicherheitseinlage.auszahlbar(
            self._db, tenant_id, verfuegbar=verfuegbar
        )
        return StripeGuthaben(
            konto_verbunden=True,
            stripe_account_id=acct,
            payouts_enabled=bool(plan["payouts_enabled"]),
            interval=wunsch or "",
            # Die Anker kommen aus UNSERER Einstellung, nicht von Stripe: dort
            # steht `manual`, das gar keine Anker kennt (0473).
            weekly_anchor=anker.get("weekly"),
            monthly_anchor=anker.get("monthly"),
            verfuegbar=[StripeSaldoPosten(**p) for p in saldo["available"]],
            ausstehend=[StripeSaldoPosten(**p) for p in saldo["pending"]],
            einlage=[
                StripeSaldoPosten(currency=k, amount_cents=v)
                for k, v in sorted(einlage.items())
            ],
            auszahlbar=[
                StripeSaldoPosten(currency=k, amount_cents=v)
                for k, v in sorted(frei.items())
            ],
            einlage_frei_ab=(
                sicherheitseinlage.naechste_freigabe(self._db, tenant_id)
                if einlage
                else None
            ),
            letzte_auszahlungen=[
                StripeAuszahlung(
                    id=p["id"],
                    amount_cents=p["amount_cents"],
                    currency=p["currency"],
                    status=p["status"],
                    automatic=p["automatic"],
                    created=_iso(p["created"]),
                    arrival_date=_iso(p["arrival_date"]),
                    failure_message=p.get("failure_message"),
                )
                for p in letzte
            ],
        )

    def _anker(self, tenant_id: str) -> dict[str, Any]:
        """Wochentag/Monatstag des gewünschten Rhythmus (0473).

        Getrennt gelesen und nicht aus `_rhythmus_uebernehmen` mitgegeben: Diese
        Methode schreibt unter Umständen und wird auch aus dem Auszahlungs-Antrag
        gerufen, wo die Anker nicht gebraucht werden. Zwei kleine Abfragen sind
        billiger als eine Methode, die je nach Aufrufer etwas anderes tut.
        """
        rows = (
            self._db.table("payout_settings")
            .select("verbund_weekly_anchor, verbund_monthly_anchor")
            .eq("tenant_id", tenant_id)
            .limit(1)
            .execute()
        ).data or []
        if not rows:
            return {"weekly": None, "monthly": None}
        monat = rows[0].get("verbund_monthly_anchor")
        return {
            "weekly": rows[0].get("verbund_weekly_anchor"),
            "monthly": int(monat) if monat is not None else None,
        }

    def _rhythmus_uebernehmen(
        self, tenant_id: str, acct: str, plan: dict[str, Any]
    ) -> str | None:
        """Den Auszahlungs-Rhythmus in unsere Hand nehmen (0473).

        Zwei Schritte, beide idempotent:

        1. **Wunsch übernehmen, falls noch nicht bekannt.** Vor 0473 stand der
           Rhythmus allein bei Stripe. `verbund_interval` bekam deshalb bewusst
           KEINEN Default (Wurzel 4) — ein `'manual'` als Vorbelegung hätte jedem
           Bestandsbetrieb ab dem Einspielen stillschweigend die automatische
           Auszahlung abgeschaltet. Beim ersten Zugriff wird stattdessen der
           echte Stripe-Wert gelesen und als Wunsch festgehalten.
        2. **Stripe auf `manual` stellen.** Nur so bleibt Guthaben stehen, aus
           dem eine Erstattung bezahlt werden kann. Passiert nur, wenn Stripe
           noch etwas anderes sagt — ein Aufruf pro Konto, nicht pro Seitenaufruf.

        Best-effort bei Schritt 2 (Wurzel 5): Scheitert das Umstellen, ist der
        Schutz für dieses Konto nicht aktiv — das wird LAUT geloggt, kippt aber
        nicht die Abrechnungsseite. Eine Seite, die wegen einer
        Konfigurationsänderung 502 antwortet, nimmt dem Betrieb den Blick auf
        sein Geld; die Unterdeckung findet stattdessen
        `scripts/diagnose/einlage-pruefen.sh`.
        """
        stripe_stand = str(plan.get("interval") or "")
        rows = (
            self._db.table("payout_settings")
            .select("verbund_interval")
            .eq("tenant_id", tenant_id)
            .limit(1)
            .execute()
        ).data or []
        wunsch = rows[0].get("verbund_interval") if rows else None
        if wunsch is None and stripe_stand:
            # Der Stripe-Stand IST der bisherige Wunsch — er ist die einzige
            # Quelle, die es dafür gibt.
            wunsch = stripe_stand
            try:
                self._db.table("payout_settings").upsert(
                    {"tenant_id": tenant_id, "verbund_interval": wunsch},
                    on_conflict="tenant_id",
                ).execute()
            except Exception as exc:  # noqa: BLE001 — Übernahme ist wiederholbar
                log.warning(
                    "einlage_rhythmus_uebernahme_fehlgeschlagen",
                    tenant_id=tenant_id,
                    error=str(exc)[:200],
                )
        if stripe_stand and stripe_stand != "manual":
            if not sicherheitseinlage.ist_aktiv(self._db, tenant_id):
                # Einlage bewusst abgeschaltet: dann bleibt der Stripe-Rhythmus
                # auch der wirksame. Nichts erzwingen, was der Betrieb
                # abgewählt hat.
                return wunsch or stripe_stand
            try:
                sc.update_payout_schedule(acct=acct, interval="manual")
                log.info(
                    "einlage_stripe_rhythmus_auf_manual",
                    tenant_id=tenant_id,
                    vorher=stripe_stand,
                )
            except Exception as exc:  # noqa: BLE001 — s. Docstring
                log.error(
                    "einlage_stripe_rhythmus_nicht_umgestellt",
                    tenant_id=tenant_id,
                    acct=acct,
                    stripe_stand=stripe_stand,
                    error=str(exc)[:200],
                )
        return wunsch

    # --- Auszahlung beantragen ---------------------------------------------

    def auszahlung_anfordern(
        self, ctx: AuthContext, *, currency: str, amount_cents: int | None
    ) -> StripeAuszahlung:
        """Auszahlung des verfügbaren Guthabens auf das Bankkonto des Betriebs.

        Ohne Betrag wird das gesamte verfügbare Guthaben der Währung ausgezahlt.

        Schranken, alle fail-closed:
        * Der Rhythmus muss auf „auf Antrag" (`manual`) stehen — bei
          automatischer Auszahlung plant Stripe den Saldo bereits selbst ein,
          ein zusätzlicher Antrag wäre eine zweite Bewegung derselben Mittel.
        * Auszahlungen müssen freigeschaltet sein (`payouts_enabled`), sonst
          scheitert Stripe erst nach dem Klick mit einer kryptischen Meldung.
        * Der Betrag muss durch das VERFÜGBARE Guthaben gedeckt sein; das
          ausstehende (`pending`) zählt nicht — es ist noch in der
          Abwicklungsfrist.

        Idempotenz (Wurzel 2): Der Idempotency-Key ist aus Konto, Währung,
        Betrag und Kalendertag gebildet. Ein Doppelklick liefert damit dieselbe
        Auszahlung zurück statt einer zweiten. Ein bewusst zweiter Antrag über
        exakt denselben Betrag am selben Tag ist dadurch blockiert — das ist die
        gewollte Seite des Kompromisses (lieber eine zu wenig als eine zu viel).
        """
        acct = self._konto_pflicht(ctx)
        try:
            plan = sc.retrieve_payout_schedule(acct=acct)
            saldo = sc.retrieve_balance(acct=acct)
        except Exception as exc:
            log.warning("stripe_auszahlung_vorpruefung_fehlgeschlagen", error=str(exc))
            raise StripeSaldoFehler(
                f"Stripe-Konto konnte nicht geprüft werden: {exc}", status_code=502
            ) from exc
        if not plan["payouts_enabled"]:
            raise StripeSaldoFehler(
                "Stripe hat Auszahlungen für dieses Konto noch nicht "
                "freigeschaltet (offene Angaben oder Bankverbindung fehlt).",
                status_code=409,
            )
        tenant_id = self._tenant(ctx)
        # Geprüft wird UNSER Rhythmus, nicht der von Stripe: dort steht seit
        # 0473 dauerhaft `manual`, damit die Sicherheitseinlage zurückgehalten
        # werden kann. Ein Vergleich mit dem Stripe-Wert wäre seither immer wahr
        # und die Schranke wirkungslos.
        wunsch = self._rhythmus_uebernehmen(tenant_id, acct, plan)
        if wunsch and wunsch != "manual":
            raise StripeSaldoFehler(
                "Der Auszahlungs-Rhythmus steht auf automatisch. Eine Auszahlung "
                "auf Antrag ist erst möglich, wenn der Rhythmus auf "
                "„nur auf Antrag“ steht.",
                status_code=409,
            )
        waehrung = currency.lower()
        saldo_cents = next(
            (
                p["amount_cents"]
                for p in saldo["available"]
                if p["currency"].lower() == waehrung
            ),
            0,
        )
        # Die Sicherheitseinlage (0473) ist die Obergrenze, nicht der Saldo:
        # Zurückgehaltenes Geld ist die Deckung für Erstattungen, die noch
        # kommen können. Ohne diese Kürzung wäre die Einlage eine Anzeige ohne
        # Wirkung — jeder Klick auf „Auszahlung beantragen" hätte sie geleert.
        auszahlbar_cents = sicherheitseinlage.auszahlbar(
            self._db, tenant_id, verfuegbar={waehrung: int(saldo_cents)}
        ).get(waehrung, 0)
        betrag = (
            int(amount_cents) if amount_cents is not None else int(auszahlbar_cents)
        )
        if betrag <= 0:
            if saldo_cents > 0:
                # Es IST Guthaben da, es ist nur gebunden. Der Unterschied muss
                # im Klartext stehen — „kein Guthaben vorhanden" wäre hier eine
                # Falschaussage über sein Geld.
                raise StripeSaldoFehler(
                    "Das verfügbare Guthaben ist vollständig als "
                    "Sicherheitseinlage für mögliche Erstattungen gebunden. Es "
                    "wird frei, sobald die betroffenen Aufenthalte vorbei sind.",
                    status_code=409,
                )
            raise StripeSaldoFehler(
                "Es ist kein verfügbares Guthaben in dieser Währung vorhanden.",
                status_code=409,
            )
        if betrag > auszahlbar_cents:
            raise StripeSaldoFehler(
                "Der Betrag übersteigt das auszahlbare Guthaben. Ein Teil des "
                "Saldos ist als Sicherheitseinlage für mögliche Erstattungen "
                "gebunden.",
                status_code=422,
            )
        tag = datetime.now(UTC).date().isoformat()
        try:
            payout = sc.create_payout(
                acct=acct,
                amount_cents=betrag,
                currency=waehrung,
                idempotency_key=f"payout:{acct}:{waehrung}:{betrag}:{tag}",
                metadata={"tenant_id": tenant_id, "quelle": "abrechnung"},
            )
        except Exception as exc:
            log.warning(
                "stripe_auszahlung_fehlgeschlagen",
                acct=acct,
                betrag=betrag,
                error=str(exc),
            )
            raise StripeSaldoFehler(
                f"Stripe konnte die Auszahlung nicht anstoßen: {exc}", status_code=502
            ) from exc
        log.info(
            "stripe_auszahlung_beantragt",
            tenant_id=tenant_id,
            betrag=betrag,
            currency=waehrung,
        )
        return StripeAuszahlung(
            id=payout["id"],
            amount_cents=payout["amount_cents"],
            currency=payout["currency"],
            status=payout["status"],
            automatic=False,
            created=datetime.now(UTC).isoformat(),
            arrival_date=_iso(payout.get("arrival_date")),
        )

    # --- Rhythmus ----------------------------------------------------------

    def rhythmus_setzen(
        self, ctx: AuthContext, req: StripeRhythmusUpdate
    ) -> StripeGuthaben:
        """Auszahlungs-Rhythmus setzen — seit 0473 BEI UNS, nicht bei Stripe.

        Das ist weiter die Einstellung, die der Betrieb selbst trifft:
        automatisch (täglich/wöchentlich/monatlich) oder nur auf Antrag. Sie
        landet aber in `payout_settings.verbund_interval` und steuert unseren
        Auszahlungslauf; bei Stripe bleibt `manual` stehen.

        Warum nicht mehr direkt an Stripe: Stripe kennt die Sicherheitseinlage
        nicht. Ein automatischer Stripe-Rhythmus würde den ganzen Saldo
        auszahlen, auch den als Deckung zurückgehaltenen Teil — dann wäre die
        Einlage eine Anzeige ohne Wirkung, und der Fall vom 25.08.2026 (Storno,
        Erstattung fällig, Saldo 0) wiederholte sich unverändert.

        Der Wunsch wird auch gespeichert, wenn das Umstellen bei Stripe
        fehlschlägt: Er ist unsere Einstellung, nicht Stripes. Ein
        Konfigurationsfehler dort darf nicht dazu führen, dass der Betrieb seine
        eigene Wahl nicht setzen kann.
        """
        # Ohne verbundenes Konto gibt es nichts einzustellen — die Prüfung
        # bleibt, obwohl das Konto danach nicht gebraucht wird: Ein Rhythmus für
        # ein Konto zu speichern, das es nicht gibt, wäre eine Einstellung ohne
        # Gegenstand (409 statt stiller Zeile).
        self._konto_pflicht(ctx)
        if req.interval not in ERLAUBTE_INTERVALLE:
            raise StripeSaldoFehler("Unbekannter Rhythmus.", status_code=422)
        tenant_id = self._tenant(ctx)
        try:
            self._db.table("payout_settings").upsert(
                {
                    "tenant_id": tenant_id,
                    "verbund_interval": req.interval,
                    # Die Anker werden IMMER mitgeschrieben, auch als None:
                    # Wechselt der Betrieb von „monatlich am 15." auf „täglich",
                    # bliebe ein stehengelassener Anker ein Wert ohne Bezug —
                    # und beim nächsten Wechsel auf „monatlich" zahlte der Lauf
                    # nach einem Tag aus, den niemand mehr gewählt hat
                    # (Wurzel 1: Gegenzustand mitpflegen).
                    "verbund_weekly_anchor": (
                        req.weekly_anchor if req.interval == "weekly" else None
                    ),
                    "verbund_monthly_anchor": (
                        req.monthly_anchor if req.interval == "monthly" else None
                    ),
                },
                on_conflict="tenant_id",
            ).execute()
        except Exception as exc:
            log.warning(
                "einlage_rhythmus_nicht_gespeichert",
                tenant_id=tenant_id,
                error=str(exc)[:200],
            )
            raise StripeSaldoFehler(
                "Der Auszahlungs-Rhythmus konnte nicht gespeichert werden.",
                status_code=502,
            ) from exc
        log.info(
            "verbund_rhythmus_gesetzt",
            tenant_id=tenant_id,
            interval=req.interval,
        )
        return self.guthaben(ctx)

    # --- Protokoll ---------------------------------------------------------

    def protokoll(self, ctx: AuthContext, *, limit: int = 50) -> ProtokollAntwort:
        """Jede Geldbewegung des verbundenen Kontos, getrennt nach Richtung.

        Quelle ist Stripe selbst — nicht unsere Kopie. Damit stimmt das
        Protokoll auch für Bewegungen, die nie durch unsere Oberfläche liefen
        (Erstattung im Stripe-Dashboard, Stripe-Gebühr, Rückbelastung).

        Angereichert wird es aus unseren Daten: Zu einer Zahlung wird die
        Buchung und die bezahlte Zusatzleistung dazugeschrieben, damit die Zeile
        beantwortet „wofür war das?" statt nur einen Betrag zu zeigen.
        """
        tenant_id = self._tenant(ctx)
        acct = self._konto(tenant_id)
        offen = self._offene_posten(tenant_id)
        if not acct:
            # Ohne Konto gibt es keine Bewegungen — offene Forderungen aber
            # sehr wohl (sie stehen in unseren Daten, nicht bei Stripe).
            return ProtokollAntwort(konto_verbunden=False, offen=offen)
        grenze = max(1, min(int(limit), MAX_PROTOKOLL))
        try:
            zeilen = sc.list_balance_transactions(acct=acct, limit=grenze)
        except Exception as exc:
            log.warning("stripe_protokoll_abruf_fehlgeschlagen", error=str(exc))
            raise StripeSaldoFehler(
                f"Das Protokoll konnte nicht geladen werden: {exc}", status_code=502
            ) from exc

        zuordnung = self._zuordnung(tenant_id, zeilen)
        antwort = ProtokollAntwort(konto_verbunden=True, offen=offen)
        for z in zeilen:
            ausgang = str(z["typ"]) in AUSGANG_TYPEN
            quelle = z.get("quelle") or {}
            zuo = (
                zuordnung.get(str(quelle.get("payment_intent") or ""))
                or zuordnung.get(str(quelle.get("id") or ""))
                or {}
            )
            eintrag = ProtokollEintrag(
                id=str(z["id"]),
                typ=str(z["typ"]),
                richtung="ausgang" if ausgang else "eingang",
                amount_cents=int(z["amount_cents"]),
                fee_cents=int(z["fee_cents"]),
                net_cents=int(z["net_cents"]),
                currency=str(z["currency"]),
                status=str(z["status"]),
                created=_iso(z["created"]),
                available_on=_iso(z.get("available_on")),
                beschreibung=z.get("beschreibung")
                or (z.get("quelle") or {}).get("beschreibung"),
                reservation_id=zuo.get("reservation_id"),
                zusatzleistungen=zuo.get("zusatzleistungen", []),
            )
            if ausgang:
                antwort.ausgang.append(eintrag)
            else:
                antwort.eingang.append(eintrag)
        return antwort

    def _offene_posten(self, tenant_id: str) -> list[OffenerPosten]:
        """Noch nicht bezahlte Zahlungslinks des Betriebs (Wurzel 3: nur eigene).

        Gleicht die Liste VOR der Anzeige mit Stripe ab. Bis 0473 tat sie das
        nicht, und das war ein echter Anzeigefehler mit Geldbezug: Am 25.08.2026
        stand hier „Wäschepaket · 20.8.2026 · Offen · 150,00 DKK", während der
        Gast diesen Link am 20.08. um 15:54 bezahlt hatte und das Geld im
        Verbundkonto lag. Der Grund ist derselbe wie beim ganzen Fall — der
        Connect-Webhook `checkout.session.completed` war nie abonniert, und der
        einzige Nachlese-Abgleich saß in `addons.zahlung.lesen`: er läuft nur,
        wenn jemand GENAU DIESE Buchung im Dashboard öffnet. Eine Forderungsliste,
        die bezahlte Forderungen zeigt, ist schlimmer als keine.

        Der Abgleich ist gedeckelt (`MAX_ABGLEICH`) und geht die ÄLTESTEN offenen
        Links zuerst an: Ein Link von heute Mittag ist selten schon bezahlt, einer
        von vor zwei Wochen dagegen der wahrscheinlichste Kandidat. Wird der
        Deckel erreicht, sagt das Log welche Links ungeprüft blieben — kein
        stilles Abschneiden.
        """
        zeilen = (
            self._db.table("addon_payment_links")
            .select("id, reservation_id, amount_cents, currency, url, created_at")
            .eq("tenant_id", tenant_id)
            .eq("status", "open")
            .order("created_at", desc=True)
            .limit(MAX_PROTOKOLL)
            .execute()
        ).data or []
        zeilen = self._gleiche_offene_ab(zeilen)
        return [
            OffenerPosten(
                id=str(z["id"]),
                reservation_id=str(z["reservation_id"]),
                amount_cents=int(z["amount_cents"]),
                currency=str(z["currency"]),
                url=str(z["url"]),
                positionen=self._positions_namen(str(z["id"])),
                created_at=z.get("created_at"),
            )
            for z in zeilen
        ]

    def _gleiche_offene_ab(self, zeilen: list[dict]) -> list[dict]:
        """Bezahlte unter den „offenen" Links herausfiltern und verbuchen.

        Rückgabe: die Zeilen, die WIRKLICH noch offen sind. Was hier verbucht
        wird, ist echtes Geld, das bisher in keinem Beleg stand — deshalb läuft
        der Abgleich über denselben Weg wie der Webhook
        (`addons.zahlung.verbuche_zahlung`, mit dem Zahlungszeitpunkt aus der
        Quelle), nicht über ein eigenes Update.

        Best-effort je Zeile (Wurzel 5): Antwortet Stripe für einen Link nicht,
        bleibt er als offen stehen — das entspricht unserem Wissensstand und ist
        keine Falschaussage. Ein 502 auf der ganzen Abrechnungsseite wäre die
        schlechtere Antwort: Der Betrieb sähe sein Guthaben nicht mehr, weil eine
        Nebenliste nicht prüfbar war.
        """
        if not zeilen:
            return zeilen
        from src.features.addons.zahlung import (  # noqa: PLC0415 — Slice-Grenze
            lade_link,
            verbuche_zahlung,
        )

        # Älteste zuerst prüfen (s. Docstring), Anzeigereihenfolge bleibt unberührt.
        reihenfolge = sorted(zeilen, key=lambda z: str(z.get("created_at") or ""))
        geprueft = reihenfolge[:MAX_ABGLEICH]
        if len(reihenfolge) > MAX_ABGLEICH:
            log.warning(
                "offene_posten_abgleich_gedeckelt",
                offen=len(reihenfolge),
                geprueft=MAX_ABGLEICH,
                ungeprueft=[str(z["id"]) for z in reihenfolge[MAX_ABGLEICH:]],
            )
        bezahlt: set[str] = set()
        for zeile in geprueft:
            link = lade_link(self._db, str(zeile["id"]))
            if link is None or str(link.get("status")) != "open":
                continue
            try:
                session = sc.find_paid_session(
                    str(link["stripe_payment_link_id"]),
                    acct=str(link["stripe_account_id"]),
                )
            except Exception as exc:  # noqa: BLE001 — je Zeile isoliert, s. Docstring
                log.warning(
                    "offene_posten_abgleich_fehlgeschlagen",
                    id=str(link["id"]),
                    error=str(exc)[:200],
                )
                continue
            if not session:
                continue
            verbuche_zahlung(
                self._db,
                link,
                session_id=str(session["id"]),
                payment_intent=session.get("payment_intent"),
                amount_total=session.get("amount_total"),
                bezahlt_am=session.get("created"),
            )
            bezahlt.add(str(link["id"]))
            log.info(
                "offene_posten_nachverbucht",
                id=str(link["id"]),
                amount_cents=int(link["amount_cents"]),
            )
        return [z for z in zeilen if str(z["id"]) not in bezahlt]

    def _zuordnung(self, tenant_id: str, zeilen: list[dict]) -> dict[str, dict]:
        """Stripe-Quell-IDs → Buchung + bezahlte Zusatzleistungen (unsere Daten).

        Gescopet auf den eigenen Betrieb (Wurzel 3): Eine Zeile aus einem
        fremden Tenant darf hier nichts anreichern, selbst wenn die ID passte.
        """
        # Beide Kennungen sammeln: die Quelle selbst (Charge) UND ihren
        # PaymentIntent — je nachdem, ob Stripe die Quelle mitliefern durfte.
        ids: set[str] = set()
        for z in zeilen:
            quelle = z.get("quelle") or {}
            for wert in (quelle.get("id"), quelle.get("payment_intent")):
                if wert:
                    ids.add(str(wert))
        if not ids:
            return {}
        links = (
            self._db.table("addon_payment_links")
            .select("id, reservation_id, payment_intent_id, checkout_session_id")
            .eq("tenant_id", tenant_id)
            .eq("status", "paid")
            .execute()
        ).data or []
        treffer: dict[str, dict] = {}
        for link in links:
            namen = self._positions_namen(str(link["id"]))
            for ref in (link.get("payment_intent_id"), link.get("checkout_session_id")):
                if ref and str(ref) in ids:
                    treffer[str(ref)] = {
                        "reservation_id": str(link["reservation_id"]),
                        "zusatzleistungen": namen,
                    }
        return treffer

    def _positions_namen(self, link_id: str) -> list[str]:
        """Namen der Zusatzleistungen eines Links — für die Protokoll-Zeile."""
        positionen = (
            self._db.table("addon_payment_link_items")
            .select("reservation_addon_id")
            .eq("link_id", link_id)
            .execute()
        ).data or []
        if not positionen:
            return []
        zeilen = (
            self._db.table("reservation_addons")
            .select("name")
            .in_("id", [str(p["reservation_addon_id"]) for p in positionen])
            .execute()
        ).data or []
        namen = []
        for z in zeilen:
            name = z.get("name") or {}
            if isinstance(name, dict) and name:
                namen.append(str(name.get("de") or next(iter(name.values()))))
        return namen


# --- Automatischer Auszahlungslauf der Verbundkonten (0473) -------------------
#
# Seit 0473 steht der Stripe-Rhythmus jedes Verbundkontos auf `manual`, damit die
# Sicherheitseinlage überhaupt zurückgehalten werden kann. Ohne diesen Lauf
# bekäme ein Betrieb mit dem Wunsch „täglich" NIE wieder eine automatische
# Auszahlung — die Einlage hätte den Schutz gebracht und die Funktion genommen.
# Der Lauf ist deshalb Teil derselben Änderung, nicht eine Nachreichung.

_WOCHENTAGE = (
    "monday",
    "tuesday",
    "wednesday",
    "thursday",
    "friday",
    "saturday",
    "sunday",
)


def _ist_faellig(interval: str, anker_woche: str | None, anker_monat: int | None,
                 heute: date) -> bool:
    """Ist heute der Auszahlungstag dieses Rhythmus?

    Die Anker sind Pflichtangaben des Rhythmus und werden NICHT geraten
    (Wurzel 4): Fehlt bei `weekly` der Wochentag oder bei `monthly` der Tag,
    zahlt der Lauf NICHT aus. Ein stillschweigendes „dann eben Montag" wäre eine
    Geldbewegung an einem Tag, den niemand gewählt hat.

    `monthly` mit einem Tag, den der Monat nicht hat (31. im Februar), zahlt am
    LETZTEN Tag des Monats aus. Sonst fiele die Auszahlung in kurzen Monaten
    ersatzlos aus — das Geld läge einen Monat länger, ohne dass es jemand
    entschieden hätte.
    """
    if interval == "daily":
        return True
    if interval == "weekly":
        if anker_woche not in _WOCHENTAGE:
            return False
        return _WOCHENTAGE[heute.weekday()] == anker_woche
    if interval == "monthly":
        if not anker_monat:
            return False
        letzter = monthrange(heute.year, heute.month)[1]
        return heute.day == min(int(anker_monat), letzter)
    return False


def run_verbund_auszahlungen(db: Client, *, heute: date | None = None) -> dict[str, int]:
    """Fällige Auszahlungen der VERBUNDKONTEN anstoßen — je Betrieb und Währung.

    Ausgezahlt wird ``verfügbar − Sicherheitseinlage`` (nie negativ). Betriebe mit
    dem Wunsch `manual` werden übersprungen: dort beantragt der Betrieb selbst.

    Isoliert je Betrieb (Wurzel 5): Ein Konto, das Stripe ablehnt, darf den Lauf
    für die anderen nicht kippen. Fehler landen im Log, nicht in einer Exception
    — der nächste Tick versucht es erneut, und `create_payout` trägt einen
    Idempotency-Key aus Konto, Währung, Betrag und Kalendertag, sodass ein
    Wiederholungslauf am selben Tag keine zweite Auszahlung erzeugt (Wurzel 2).

    Rückgabe: Zählwerk für das Log des Aufrufers.
    """
    tag = heute or datetime.now(UTC).date()
    profile = (
        db.table("tenant_billing_profile")
        .select("tenant_id, stripe_account_id, stripe_payouts_enabled")
        .not_.is_("stripe_account_id", "null")
        .execute()
    ).data or []
    bilanz = {"geprueft": 0, "ausgezahlt": 0, "uebersprungen": 0, "fehler": 0}
    for profil in profile:
        tenant_id = str(profil["tenant_id"])
        acct = str(profil.get("stripe_account_id") or "")
        if not acct or not profil.get("stripe_payouts_enabled"):
            bilanz["uebersprungen"] += 1
            continue
        bilanz["geprueft"] += 1
        einstellung = (
            db.table("payout_settings")
            .select("verbund_interval, verbund_weekly_anchor, verbund_monthly_anchor")
            .eq("tenant_id", tenant_id)
            .limit(1)
            .execute()
        ).data or []
        interval = (
            str(einstellung[0].get("verbund_interval") or "") if einstellung else ""
        )
        if interval in ("", "manual"):
            # Leer heißt „noch nicht übernommen" — der erste Aufruf der
            # Abrechnungsseite holt den Wert vom Konto. Bis dahin wird NICHT
            # ausgezahlt: ein geratener Rhythmus wäre eine Geldbewegung ohne
            # Auftrag (Wurzel 4).
            bilanz["uebersprungen"] += 1
            continue
        if not _ist_faellig(
            interval,
            einstellung[0].get("verbund_weekly_anchor"),
            einstellung[0].get("verbund_monthly_anchor"),
            tag,
        ):
            bilanz["uebersprungen"] += 1
            continue
        try:
            saldo = sc.retrieve_balance(acct=acct)
        except Exception as exc:  # noqa: BLE001 — je Betrieb isoliert
            log.warning(
                "verbund_auszahlung_saldo_fehlgeschlagen",
                tenant_id=tenant_id,
                error=str(exc)[:200],
            )
            bilanz["fehler"] += 1
            continue
        verfuegbar = {
            str(p["currency"]).lower(): int(p["amount_cents"])
            for p in saldo["available"]
        }
        for currency, betrag in sicherheitseinlage.auszahlbar(
            db, tenant_id, verfuegbar=verfuegbar
        ).items():
            if betrag <= 0:
                continue
            try:
                sc.create_payout(
                    acct=acct,
                    amount_cents=betrag,
                    currency=currency,
                    idempotency_key=(
                        f"payout:{acct}:{currency}:{betrag}:{tag.isoformat()}"
                    ),
                    metadata={"tenant_id": tenant_id, "quelle": "rhythmus"},
                )
                bilanz["ausgezahlt"] += 1
                log.info(
                    "verbund_auszahlung_angestossen",
                    tenant_id=tenant_id,
                    currency=currency,
                    betrag_cents=betrag,
                    interval=interval,
                )
            except Exception as exc:  # noqa: BLE001 — je Zeile isoliert
                bilanz["fehler"] += 1
                log.warning(
                    "verbund_auszahlung_fehlgeschlagen",
                    tenant_id=tenant_id,
                    currency=currency,
                    betrag_cents=betrag,
                    error=str(exc)[:200],
                )
    return bilanz
