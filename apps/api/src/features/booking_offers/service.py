"""Buchungsangebot (Lastenheft §2.2, Migration 0586).

DER ABLAUF — und wo er im Bestand einhängt:

    Betrieb zieht Zeitraum im Kalender
      → `anlegen()`      Preis über den ZENTRALEN Resolver, Snapshot festhalten
      → `senden()`       Mail mit Bestätigungslink (Token nur dort)
    Gast öffnet den Link
      → `oeffentlich_lesen()`   setzt `viewed`, zeigt Positionen
      → `annehmen()`     prüft Verfügbarkeit ERNEUT, legt eine
                         Buchungsabsicht (0409) an und gibt einen Zahlungslink
                         im Konto des Betriebs zurück
    Gast zahlt
      → Stripe-Webhook   löst die Absicht ein → Reservierung entsteht
      → `als_bezahlt_vermerken()`  hängt Angebot und Buchung zusammen

WARUM KEINE EIGENE BUCHUNGSANLAGE: Die Regel „keine Buchung ohne bezahlte
Zahlung" (0409) gilt hier genauso. Das Angebot erzeugt deshalb dieselbe
`booking_intent`-Zeile wie die öffentliche Buchungsstrecke und überlässt die
Anlage dem bestehenden Webhook-Pfad. Eine zweite Anlage hier hätte bedeutet,
dass die Nächte-Vergabe, der EXCLUDE-Constraint und die Erstattung bei 409 ein
zweites Mal implementiert werden — genau die Duplikation, die Wurzel 1 verbietet.

WAS DAS ANGEBOT BEWUSST NICHT TUT: Es reserviert nichts. Zwischen Versand und
Annahme kann der Zeitraum verkauft werden; dann scheitert die Annahme mit 409,
BEVOR Geld fließt. Der Betrieb hat diese Kehrseite schon bei 0409 gewählt.
"""
from __future__ import annotations

from datetime import UTC, date, datetime, timedelta
from decimal import Decimal
from typing import Any

from supabase import Client

from src.core.config import get_settings
from src.core.logging import get_logger
from src.core.mail import MailError, MailService, OutboundMessage
from src.core.mail_empfaenger import sprache_fuer_gast
from src.core.mail_layout import Aktion, MailInhalt, mail_rendern
from src.core.mail_texte import text as mail_text
from src.core.sales_channels import (
    RECEPTION,
    availability_block_hits_channel,
    stop_sell_blocks_channel,
)
from src.core.security import AuthContext, secrets_match
from src.core.supabase import load_scoped
from src.features.buchhaltung.reservation_invoice import _property_vat_rate

from .common import (
    ABLAUFBAR,
    ANNEHMBAR,
    GRUND_ABGELAUFEN,
    GRUND_ABGELEHNT,
    GRUND_BEZAHLT,
    GRUND_IN_ZAHLUNG,
    GRUND_NICHT_VERSCHICKT,
    GRUND_ZURUECKGEZOGEN,
    BookingOfferError,
    neuer_token,
    token_hash,
)
from .schemas import (
    BookingOfferCreate,
    BookingOfferList,
    BookingOfferOut,
    BookingOfferUpdate,
    OfferQuoteLine,
    PublicOfferAcceptResponse,
    PublicOfferOut,
)

log = get_logger(__name__)

# Der Kanal, über den ein angenommenes Angebot verkauft wird. Ein Angebot ist
# ein Direktverkauf des Betriebs — keine Portal-Buchung und keine OTA. Der Wert
# muss in der Kanal-Kette (DB-Enum, Pydantic, Frontend-Unions, Kanal-Meta,
# Mail-Katalog) EXISTIEREN; deshalb wird hier ein bestehender Wert benutzt und
# kein neuer erfunden (siehe scripts/i18n/kanal-enums-pruefen.mjs).
KANAL = "website"

def _stammdaten(req: BookingOfferCreate, bestand: dict | None = None) -> dict[str, Any]:
    """Stammdaten-Spalten (0703) aus der Anfrage. Beim Ändern eines Altbestands
    ohne Anschrift steht im Schema der Platzhalter „-" — der wird NICHT
    gespeichert, die Spalte bleibt, was sie war (leer)."""
    def wert(feld: str) -> str | None:
        v = getattr(req, feld)
        if v == "-" and bestand is not None and not bestand.get(feld):
            return None
        return v
    return {
        "guest_type": req.guest_type,
        "guest_company": req.guest_company,
        "guest_vat_id": req.guest_vat_id,
        "tax_rule": req.tax_rule,
        "guest_street": wert("guest_street"),
        "guest_postal_code": wert("guest_postal_code"),
        "guest_city": wert("guest_city"),
        "guest_country": wert("guest_country"),
    }


# Spalten, die die Betriebssicht braucht. Als Konstante, damit Liste und Detail
# nicht auseinanderlaufen.
SPALTEN = (
    "id, tenant_id, property_id, unit_id, check_in, check_out, adults, children, "
    "pets, guest_name, guest_email, guest_phone, guest_type, guest_company, "
    "guest_street, guest_postal_code, guest_city, guest_country, guest_vat_id, "
    "tax_rule, language, currency, "
    "quote_snapshot, total_amount, deposit_amount, expires_at, status, sent_at, "
    "viewed_at, accepted_at, declined_at, booking_intent_id, reservation_id, "
    "internal_note, quote_id, created_by, created_at, updated_at"
)

# Obergrenze der Listenabfrage (Wurzel 8: kein unbegrenzter Bereich).
MAX_LIMIT = 200


def _jetzt() -> datetime:
    return datetime.now(UTC)


def _naechte(check_in: date, check_out: date) -> int:
    return (check_out - check_in).days


def _as_date(wert: Any) -> date:  # noqa: ANN401 — kommt als str/date aus der DB
    return wert if isinstance(wert, date) else date.fromisoformat(str(wert))


def _as_dt(wert: Any) -> datetime:  # noqa: ANN401 — kommt als str aus der DB
    if isinstance(wert, datetime):
        return wert
    return datetime.fromisoformat(str(wert).replace("Z", "+00:00"))


def _cent(betrag: float) -> int:
    """Betrag in die kleinste Einheit — Stripe rechnet in Cent."""
    return int(round(float(betrag) * 100))


def _zeilen(snapshot: Any) -> list[OfferQuoteLine]:  # noqa: ANN401 — jsonb
    """Positionen aus dem Snapshot. Unbekannte Felder werden übergangen.

    Ein zwei Wochen altes Angebot muss lesbar bleiben, auch wenn der Resolver
    inzwischen ein Feld umbenannt hat — deshalb tolerant lesen statt validieren.
    """
    if not isinstance(snapshot, dict):
        return []
    roh = snapshot.get("lines")
    if not isinstance(roh, list):
        return []
    fertig: list[OfferQuoteLine] = []
    for eintrag in roh:
        if not isinstance(eintrag, dict):
            continue
        label = eintrag.get("label")
        betrag = eintrag.get("amount")
        if label is None or betrag is None:
            continue
        fertig.append(
            OfferQuoteLine(
                label=str(label),
                amount=float(betrag),
                kind=str(eintrag["kind"]) if eintrag.get("kind") else None,
            )
        )
    return fertig


class BookingOffersService:
    """Angebote anlegen, senden, annehmen, ablehnen, ablaufen lassen."""

    def __init__(
        self,
        service_client: Client,
        *,
        mail: MailService | None = None,
    ) -> None:
        self._db = service_client
        self._settings = get_settings()
        self._mail = mail or MailService(self._settings)

    # --- Hilfen ------------------------------------------------------------

    def _buchhaltung_spiegeln(self, zeile: dict, *, ctx: AuthContext | None = None,
                              titel: str = "") -> None:
        """Brücke in die Buchhaltung (0699): Angebot als `quotes`-Zeile spiegeln
        bzw. dessen Status nachziehen — nur, wenn das Modul gebucht ist.

        Best-effort: der Verkauf darf nicht an der Buchhaltung scheitern. Ein
        Fehler wird LAUT geloggt (die Brücke selbst loggt fachliche Gründe),
        der Hauptpfad läuft weiter. Import im Körper: der buchhaltung-Slice
        zieht schwere Abhängigkeiten nach, die der Webhook nicht braucht."""
        try:
            from src.features.buchhaltung import angebot_bruecke  # noqa: PLC0415

            if ctx is not None and not zeile.get("quote_id"):
                quote_id = angebot_bruecke.spiegel_anlegen(self._db, ctx, zeile, titel)
                if quote_id:
                    self._db.table("booking_offers").update({"quote_id": quote_id}).eq(
                        "id", str(zeile["id"])
                    ).execute()
                    zeile["quote_id"] = quote_id
            angebot_bruecke.spiegel_status(self._db, zeile)
        except Exception as exc:  # noqa: BLE001 — Best-effort-Spiegel, Hauptpfad bleibt
            log.error(
                "angebot_buchhaltung_spiegel_fehlgeschlagen",
                offer_id=str(zeile.get("id") or ""),
                error=str(exc)[:300],
            )

    def _tenant(self, ctx: AuthContext) -> str:
        if not ctx.tenant_id:
            raise BookingOfferError(
                "Kein Mandant im Kontext.", status_code=403
            )
        return ctx.tenant_id

    def _laden(self, tenant_id: str, offer_id: str) -> dict:
        """Ein Angebot per ID — Load und Scope untrennbar (Wurzel 3)."""
        return load_scoped(
            self._db,
            "booking_offers",
            offer_id,
            tenant_id,
            columns=SPALTEN,
            not_found=BookingOfferError(
                "Angebot nicht gefunden.", status_code=404
            ),
        )

    def _objekt(self, tenant_id: str, property_id: str) -> dict:
        """Das Objekt des Angebots — mit Scope, weil die ID vom Client kommt."""
        return load_scoped(
            self._db,
            "properties",
            property_id,
            tenant_id,
            columns="id, tenant_id, title, city, currency, max_guests, status",
            not_found=BookingOfferError(
                "Objekt nicht gefunden.", status_code=404
            ),
        )

    def _per_token(self, token: str) -> dict:
        """Angebot über den Token — der einzige Zugang der öffentlichen Seite.

        Der Vergleich läuft über den HASH: gespeichert ist nur er. Der
        zusätzliche byteweise Vergleich (`secrets_match`) schützt gegen
        Zeitmessung am Ergebnis; angreiferkontrollierter Input darf hier
        außerdem keinen 500 erzeugen (Wurzel 5), deshalb wird ein unbrauchbarer
        Token wie ein unbekannter behandelt.
        """
        gesucht = token_hash(token or "")
        zeilen = (
            self._db.table("booking_offers")
            .select(SPALTEN)
            .eq("token_hash", gesucht)
            .limit(1)
            .execute()
        ).data or []
        if not zeilen:
            raise BookingOfferError("Angebot nicht gefunden.", status_code=404)
        zeile = zeilen[0]
        if not secrets_match(str(zeile["token_hash"]), gesucht):
            raise BookingOfferError("Angebot nicht gefunden.", status_code=404)
        return zeile

    def _antwort(self, zeile: dict, *, titel: str | None = None) -> BookingOfferOut:
        check_in = _as_date(zeile["check_in"])
        check_out = _as_date(zeile["check_out"])
        return BookingOfferOut(
            id=str(zeile["id"]),
            property_id=str(zeile["property_id"]),
            property_title=titel,
            unit_id=str(zeile["unit_id"]) if zeile.get("unit_id") else None,
            check_in=check_in,
            check_out=check_out,
            nights=_naechte(check_in, check_out),
            adults=int(zeile["adults"]),
            children=int(zeile["children"]),
            pets=int(zeile["pets"]),
            guest_name=str(zeile["guest_name"]),
            guest_email=str(zeile["guest_email"]),
            guest_phone=str(zeile["guest_phone"]) if zeile.get("guest_phone") else None,
            guest_type=str(zeile.get("guest_type") or "private"),
            guest_company=zeile.get("guest_company") or None,
            guest_street=zeile.get("guest_street") or None,
            guest_postal_code=zeile.get("guest_postal_code") or None,
            guest_city=zeile.get("guest_city") or None,
            guest_country=zeile.get("guest_country") or None,
            guest_vat_id=zeile.get("guest_vat_id") or None,
            tax_rule=zeile.get("tax_rule") or None,
            language=str(zeile["language"]) if zeile.get("language") else None,
            currency=str(zeile["currency"]),
            total_amount=float(zeile["total_amount"]),
            deposit_amount=(
                float(zeile["deposit_amount"])
                if zeile.get("deposit_amount") is not None
                else None
            ),
            lines=_zeilen(zeile.get("quote_snapshot")),
            expires_at=_as_dt(zeile["expires_at"]),
            status=str(zeile["status"]),
            sent_at=_as_dt(zeile["sent_at"]) if zeile.get("sent_at") else None,
            viewed_at=_as_dt(zeile["viewed_at"]) if zeile.get("viewed_at") else None,
            accepted_at=(
                _as_dt(zeile["accepted_at"]) if zeile.get("accepted_at") else None
            ),
            declined_at=(
                _as_dt(zeile["declined_at"]) if zeile.get("declined_at") else None
            ),
            reservation_id=(
                str(zeile["reservation_id"]) if zeile.get("reservation_id") else None
            ),
            quote_id=str(zeile["quote_id"]) if zeile.get("quote_id") else None,
            internal_note=(
                str(zeile["internal_note"]) if zeile.get("internal_note") else None
            ),
            created_at=_as_dt(zeile["created_at"]),
            updated_at=_as_dt(zeile["updated_at"]),
        )

    def _titel(self, property_id: str) -> str | None:
        zeilen = (
            self._db.table("properties")
            .select("title")
            .eq("id", property_id)
            .limit(1)
            .execute()
        ).data or []
        return str(zeilen[0]["title"]) if zeilen else None

    # --- Anlegen -----------------------------------------------------------

    def anlegen(
        self, ctx: AuthContext, req: BookingOfferCreate
    ) -> BookingOfferOut:
        """Ein Angebot mit serverseitig gerechnetem Preis anlegen.

        Der Preis kommt aus dem ZENTRALEN Resolver (Wurzel 3: nie ein
        Client-Betrag) und wird als Snapshot festgehalten — das Angebot gilt zu
        dem Preis, der in der Mail stand, auch wenn sich der Kalenderpreis
        danach ändert.
        """
        tenant_id = self._tenant(ctx)
        prop = self._objekt(tenant_id, req.property_id)
        quote = self._pruefen_und_bepreisen(prop, req)
        currency = quote["currency"]
        gesamt = float(quote["total"])

        klartext, hash_wert = neuer_token()
        ablauf = _jetzt() + timedelta(days=req.gueltig_tage)
        sprache = sprache_fuer_gast(
            self._db, guest_language=req.language, tenant_id=tenant_id
        )
        zeile = {
            "tenant_id": tenant_id,
            "property_id": req.property_id,
            "unit_id": req.unit_id,
            "check_in": req.check_in.isoformat(),
            "check_out": req.check_out.isoformat(),
            "adults": req.adults,
            "children": req.children,
            "pets": req.pets,
            "guest_name": req.guest_name,
            "guest_email": str(req.guest_email),
            "guest_phone": req.guest_phone,
            **_stammdaten(req),
            "language": sprache,
            "currency": currency,
            "quote_snapshot": quote,
            "total_amount": gesamt,
            "deposit_amount": req.deposit_amount,
            "expires_at": ablauf.isoformat(),
            "token_hash": hash_wert,
            "status": "draft",
            "internal_note": req.internal_note,
            "created_by": ctx.user_id,
        }
        angelegt = (
            self._db.table("booking_offers").insert(zeile).execute()
        ).data
        if not angelegt:
            raise BookingOfferError(
                "Das Angebot konnte nicht angelegt werden.", status_code=500
            )
        row = angelegt[0]
        log.info(
            "angebot_angelegt",
            tenant_id=tenant_id,
            offer_id=str(row["id"]),
            property_id=req.property_id,
            naechte=_naechte(req.check_in, req.check_out),
            betrag=gesamt,
            currency=currency,
        )
        # Buchhaltungs-Angebot spiegeln (0699), wenn das Modul gebucht ist.
        self._buchhaltung_spiegeln(row, ctx=ctx, titel=str(prop.get("title") or ""))
        # Der Klartext-Token wird NICHT gespeichert und NICHT zurückgegeben —
        # er lebt nur bis zum Mailversand. Direkt nach dem Anlegen senden ist
        # der Normalfall; die Oberfläche ruft `senden()` unmittelbar danach.
        self._token_cache[str(row["id"])] = klartext
        return self._antwort(row, titel=str(prop.get("title") or "") or None)

    def _pruefen_und_bepreisen(self, prop: dict, req: BookingOfferCreate) -> dict:
        """Fachliche Prüfung + Preis-Snapshot — geteilt von Anlegen und Ändern,
        damit ein geändertes Angebot denselben Regeln unterliegt wie ein neues."""
        if req.check_in < date.today():
            raise BookingOfferError(
                "Das Anreisedatum liegt in der Vergangenheit.", status_code=422
            )
        gaeste = req.adults + req.children
        max_gaeste = prop.get("max_guests")
        if max_gaeste is not None and gaeste > int(max_gaeste):
            raise BookingOfferError(
                "Die Gästezahl übersteigt die Kapazität des Objekts.",
                status_code=422,
            )
        if req.unit_id:
            self._pruefe_einheit(req.property_id, req.unit_id)

        quote = self._quote(req)
        if req.tax_rule:
            quote = self._ohne_umsatzsteuer(quote, str(prop["tenant_id"]), req.property_id)
        gesamt = float(quote["total"])
        if gesamt <= 0:
            # Ein Angebot über 0 wäre nicht bezahlbar — und ohne Zahlung
            # entsteht keine Buchung. Klar fehlschlagen statt einen Betrag zu
            # erfinden (Wurzel 4).
            raise BookingOfferError(
                "Für diesen Zeitraum ergibt sich kein Preis. Bitte Preise und "
                "Verfügbarkeit des Objekts prüfen.",
                status_code=422,
            )
        if req.deposit_amount is not None and req.deposit_amount > gesamt:
            raise BookingOfferError(
                "Die Anzahlung ist höher als der Gesamtbetrag.", status_code=422
            )
        return quote

    def _ohne_umsatzsteuer(self, quote: dict, tenant_id: str, property_id: str) -> dict:
        """Snapshot NETTO stellen (0704): der Resolver liefert Bruttopreise
        (USt im Preis enthalten). Ein Angebot ohne USt an eine Organisation
        weist die Beträge ohne die Steuer aus; Abgaben (Kurtaxe, kind='tax')
        bleiben, sie sind keine USt. Der Satz je Zeile: eigener Snapshot-Satz
        (Gebühren), sonst die USt des Objekts (property_pricing_config.taxes),
        sonst der Übernachtungssatz des Kontos. Fehlt jeder Satz, kann nichts
        herausgerechnet werden → 422, kein geratener Prozentwert (Wurzel 4)."""
        cfg = (
            self._db.table("property_pricing_config")
            .select("taxes")
            .eq("property_id", property_id)
            .limit(1)
            .execute()
        ).data or []
        satz = _property_vat_rate(list((cfg[0].get("taxes") if cfg else None) or []))
        if satz is None:
            profil = (
                self._db.table("tenant_billing_profile")
                .select("lodging_tax_rate")
                .eq("tenant_id", tenant_id)
                .limit(1)
                .execute()
            ).data or []
            roh = profil[0].get("lodging_tax_rate") if profil else None
            satz = Decimal(str(roh)) if roh is not None else None
        if satz is None:
            raise BookingOfferError(
                "Ohne Umsatzsteuer nicht berechenbar: dem Objekt und dem Konto "
                "fehlt der Übernachtungs-Steuersatz.",
                status_code=422,
            )
        zeilen: list[dict] = []
        for ln in quote.get("lines") or []:
            zeile = dict(ln)
            if zeile.get("kind") != "tax":
                eigener = zeile.get("tax_rate")
                rate = Decimal(str(eigener)) if eigener is not None else satz
                netto = Decimal(str(zeile.get("amount") or 0)) / (1 + rate / Decimal(100))
                zeile["amount"] = float(netto.quantize(Decimal("0.01")))
                zeile["tax_rate"] = 0.0
            zeilen.append(zeile)
        neu = dict(quote)
        neu["lines"] = zeilen
        neu["total"] = round(sum(float(z.get("amount") or 0) for z in zeilen), 2)
        logis = [z for z in zeilen if z.get("kind") == "lodging"]
        if logis:
            neu["nightly_total"] = round(sum(float(z["amount"]) for z in logis), 2)
        neu["tax_free"] = True
        return neu

    # --- Ändern ------------------------------------------------------------

    def aendern(
        self, ctx: AuthContext, offer_id: str, req: BookingOfferUpdate
    ) -> BookingOfferOut:
        """Offenes Angebot ändern (Entwurf, verschickt, geöffnet).

        Zusammengeführt aus Bestand + Änderung entsteht ein vollständiger
        ``BookingOfferCreate`` — dessen Validierung (Zeitraum, Nächte-Deckel)
        und die geteilte Prüfung gelten damit auch hier. Der Preis wird neu
        gerechnet und als Snapshot festgehalten. Der Annahmelink des Gastes
        bleibt derselbe: der Gast sieht dort den neuen Stand.

        Nach dem Ändern wird NICHT automatisch verschickt — das entscheidet
        die Oberfläche (Entwurf bleibt Entwurf, ein verschicktes Angebot
        bekommt „erneut senden" angeboten).
        """
        tenant_id = self._tenant(ctx)
        zeile = self._laden(tenant_id, offer_id)
        if str(zeile["status"]) not in {"draft", "sent", "viewed"}:
            raise BookingOfferError(
                "Nur offene Angebote (Entwurf, verschickt, geöffnet) können "
                "geändert werden.",
                status_code=409,
            )
        prop = self._objekt(tenant_id, str(zeile["property_id"]))
        aenderung = req.model_dump(exclude_none=True, exclude={"deposit_entfernen"})
        anzahlung = (
            None if req.deposit_entfernen
            else aenderung.pop("deposit_amount", zeile.get("deposit_amount"))
        )
        aenderung.pop("gueltig_tage", None)
        try:
            voll = BookingOfferCreate(
                property_id=str(zeile["property_id"]),
                unit_id=aenderung.get("unit_id", zeile.get("unit_id")),
                check_in=aenderung.get("check_in", _as_date(zeile["check_in"])),
                check_out=aenderung.get("check_out", _as_date(zeile["check_out"])),
                adults=aenderung.get("adults", int(zeile["adults"])),
                children=aenderung.get("children", int(zeile["children"])),
                pets=aenderung.get("pets", int(zeile["pets"])),
                guest_name=aenderung.get("guest_name", str(zeile["guest_name"])),
                guest_email=aenderung.get("guest_email", str(zeile["guest_email"])),
                guest_phone=aenderung.get("guest_phone", zeile.get("guest_phone")),
                guest_type=aenderung.get("guest_type", zeile.get("guest_type") or "private"),
                guest_company=aenderung.get("guest_company", zeile.get("guest_company")),
                # Altbestand vor 0703 hat keine Anschrift — leer bleibt leer, aber
                # das Pflichtfeld-Schema würde daran scheitern: Bestand wird nur
                # dann geprüft, wenn der Nutzer die Anschrift mitschickt.
                guest_street=aenderung.get("guest_street", zeile.get("guest_street") or "-"),
                guest_postal_code=aenderung.get(
                    "guest_postal_code", zeile.get("guest_postal_code") or "-"
                ),
                guest_city=aenderung.get("guest_city", zeile.get("guest_city") or "-"),
                guest_country=aenderung.get("guest_country", zeile.get("guest_country") or "-"),
                guest_vat_id=aenderung.get("guest_vat_id", zeile.get("guest_vat_id")),
                tax_rule=(
                    None if req.tax_rule_entfernen
                    else aenderung.get("tax_rule", zeile.get("tax_rule"))
                ),
                language=aenderung.get("language", zeile.get("language")),
                deposit_amount=float(anzahlung) if anzahlung is not None else None,
                internal_note=aenderung.get("internal_note", zeile.get("internal_note")),
                rate_plan_id=aenderung.get("rate_plan_id"),
            )
        except ValueError as exc:
            raise BookingOfferError(str(exc), status_code=422) from exc

        quote = self._pruefen_und_bepreisen(prop, voll)
        patch: dict[str, Any] = {
            "unit_id": voll.unit_id,
            "check_in": voll.check_in.isoformat(),
            "check_out": voll.check_out.isoformat(),
            "adults": voll.adults,
            "children": voll.children,
            "pets": voll.pets,
            "guest_name": voll.guest_name,
            "guest_email": str(voll.guest_email),
            "guest_phone": voll.guest_phone,
            **_stammdaten(voll, bestand=zeile),
            "language": sprache_fuer_gast(
                self._db, guest_language=voll.language, tenant_id=tenant_id
            ),
            "currency": quote["currency"],
            "quote_snapshot": quote,
            "total_amount": float(quote["total"]),
            "deposit_amount": voll.deposit_amount,
            "internal_note": voll.internal_note,
        }
        if req.gueltig_tage is not None:
            patch["expires_at"] = (_jetzt() + timedelta(days=req.gueltig_tage)).isoformat()
        aktualisiert = (
            self._db.table("booking_offers")
            .update(patch)
            .eq("id", offer_id)
            .eq("tenant_id", tenant_id)
            .execute()
        ).data or []
        row = aktualisiert[0] if aktualisiert else {**zeile, **patch}
        log.info(
            "angebot_geaendert",
            tenant_id=tenant_id,
            offer_id=offer_id,
            felder=sorted(aenderung),
            betrag=patch["total_amount"],
        )
        self._buchhaltung_nachziehen(ctx, row, str(prop.get("title") or ""))
        return self._antwort(row, titel=str(prop.get("title") or "") or None)

    def buchhaltung_sicherstellen(self, ctx: AuthContext, offer_id: str) -> BookingOfferOut:
        """Spiegel in der Buchhaltung anlegen, falls noch keiner existiert
        (Altbestand vor 0699), und das Angebot mit `quote_id` zurückgeben.

        Ohne gebuchtes Modul 409 — die Oberfläche sagt dann, WARUM es keine
        Ansicht gibt, statt eine leere Seite zu öffnen."""
        tenant_id = self._tenant(ctx)
        zeile = self._laden(tenant_id, offer_id)
        titel = self._titel(str(zeile["property_id"])) or ""
        if not zeile.get("quote_id"):
            from src.features.buchhaltung import angebot_bruecke  # noqa: PLC0415
            from src.features.buchhaltung.guards import BUCHHALTUNG_MODULE_KEY  # noqa: PLC0415
            from src.features.subscriptions.entitlements import modul_aktiv  # noqa: PLC0415

            if not modul_aktiv(self._db, tenant_id, BUCHHALTUNG_MODULE_KEY):
                raise BookingOfferError(
                    "Das Buchhaltungsmodul ist nicht gebucht — ohne Modul gibt es "
                    "keine Angebotsansicht mit PDF.",
                    status_code=409,
                )
            quote_id = angebot_bruecke.spiegel_anlegen(self._db, ctx, zeile, titel)
            if not quote_id:
                raise BookingOfferError(
                    "Das Angebot konnte nicht in die Buchhaltung übernommen werden "
                    "(Steuersatz oder Währung fehlt — siehe Log).",
                    status_code=422,
                )
            self._db.table("booking_offers").update({"quote_id": quote_id}).eq(
                "id", offer_id
            ).eq("tenant_id", tenant_id).execute()
            zeile["quote_id"] = quote_id
            angebot_bruecke.spiegel_status(self._db, zeile)
        elif str(zeile["status"]) in {"draft", "sent", "viewed"} and self._spiegel_ohne_sprache(
            str(zeile["quote_id"])
        ):
            # Altspiegel (vor 0700: ohne Sprache, ohne Anschreiben) genau EINMAL
            # auf den heutigen Stand heben. Danach ist der Buchhaltungs-Editor
            # die Bearbeitungsoberfläche — seine Texte überschreibt die Brücke
            # nicht mehr (Rückweg: angebot_bruecke.quelle_nachziehen).
            self._buchhaltung_nachziehen(ctx, zeile, titel)
        return self._antwort(zeile, titel=titel or None)

    def _spiegel_ohne_sprache(self, quote_id: str) -> bool:
        rows = (
            self._db.table("quotes").select("language").eq("id", quote_id).limit(1).execute()
        ).data or []
        return bool(rows) and rows[0].get("language") is None

    def _buchhaltung_nachziehen(self, ctx: AuthContext, zeile: dict, titel: str) -> None:
        """Spiegel in der Buchhaltung (0699) inhaltlich nachziehen — best-effort."""
        try:
            from src.features.buchhaltung import angebot_bruecke  # noqa: PLC0415

            angebot_bruecke.spiegel_aktualisieren(self._db, ctx, zeile, titel)
        except Exception as exc:  # noqa: BLE001 — Best-effort-Spiegel, Hauptpfad bleibt
            log.error(
                "angebot_buchhaltung_nachziehen_fehlgeschlagen",
                offer_id=str(zeile.get("id") or ""),
                error=str(exc)[:300],
            )

    # Der Klartext-Token lebt genau eine Anfrage lang: zwischen `anlegen()` und
    # dem unmittelbar folgenden `senden()`. Als Instanz-Attribut und nicht in
    # der DB, damit er die Zeile nie berührt (Wurzel 3). Ein neuer Request hat
    # einen neuen Service — findet `senden()` keinen Token, wird ein frischer
    # erzeugt und der Hash ersetzt.
    _token_cache: dict[str, str] = {}  # noqa: RUF012 — bewusst je Instanz gefüllt

    def _pruefe_einheit(self, property_id: str, unit_id: str) -> None:
        """Gehört die Einheit zu diesem Objekt? (Wurzel 3, ID kommt vom Client)"""
        zeilen = (
            self._db.table("property_units")
            .select("id")
            .eq("id", unit_id)
            .eq("property_id", property_id)
            .limit(1)
            .execute()
        ).data or []
        if not zeilen:
            raise BookingOfferError(
                "Die Einheit gehört nicht zu diesem Objekt.", status_code=422
            )

    def _quote(self, req: BookingOfferCreate) -> dict:
        """Preisaufschlüsselung über den zentralen Resolver.

        Import im Funktionskörper: der Resolver zieht das halbe pricing-Paket
        nach, und der Slice wird auch aus dem Webhook geladen, der ihn nicht
        braucht.
        """
        from src.features.pricing.resolver import (  # noqa: PLC0415
            PricingResolver,
        )
        from src.features.pricing.schemas import QuoteRequest  # noqa: PLC0415

        anfrage = QuoteRequest(
            property_id=req.property_id,
            check_in=req.check_in,
            check_out=req.check_out,
            guests=max(req.adults + req.children, 1),
            pets=req.pets,
            locale=req.language or "en",
            channel=KANAL,
            rate_plan_id=req.rate_plan_id,
        )
        antwort = PricingResolver(self._db).quote(anfrage)
        daten = antwort.model_dump(mode="json")
        if not daten.get("currency"):
            # Fehlende Währung ist ein Datenfehler des Objekts, kein Grund für
            # einen Ersatzwert (Wurzel 4).
            raise BookingOfferError(
                "Für dieses Objekt ist keine Währung hinterlegt.",
                status_code=422,
            )
        return daten

    # --- Liste / Detail ----------------------------------------------------

    def liste(
        self,
        ctx: AuthContext,
        *,
        status: str | None = None,
        property_id: str | None = None,
        limit: int = 50,
        offset: int = 0,
    ) -> BookingOfferList:
        tenant_id = self._tenant(ctx)
        if limit < 1 or limit > MAX_LIMIT:
            raise BookingOfferError(
                f"limit muss zwischen 1 und {MAX_LIMIT} liegen.", status_code=422
            )
        if offset < 0:
            raise BookingOfferError("offset darf nicht negativ sein.", status_code=422)
        frage = (
            self._db.table("booking_offers")
            .select(SPALTEN, count="exact")
            .eq("tenant_id", tenant_id)
        )
        if status:
            frage = frage.eq("status", status)
        if property_id:
            frage = frage.eq("property_id", property_id)
        antwort = (
            frage.order("created_at", desc=True)
            .range(offset, offset + limit - 1)
            .execute()
        )
        zeilen = antwort.data or []
        titel = self._titel_map([str(z["property_id"]) for z in zeilen])
        return BookingOfferList(
            items=[
                self._antwort(z, titel=titel.get(str(z["property_id"])))
                for z in zeilen
            ],
            total=int(antwort.count or 0),
        )

    def _titel_map(self, property_ids: list[str]) -> dict[str, str]:
        """Objekttitel in EINER Abfrage — nicht je Zeile einzeln."""
        eindeutig = sorted(set(property_ids))
        if not eindeutig:
            return {}
        zeilen = (
            self._db.table("properties")
            .select("id, title")
            .in_("id", eindeutig)
            .execute()
        ).data or []
        return {str(z["id"]): str(z["title"] or "") for z in zeilen}

    def detail(self, ctx: AuthContext, offer_id: str) -> BookingOfferOut:
        tenant_id = self._tenant(ctx)
        zeile = self._laden(tenant_id, offer_id)
        return self._antwort(zeile, titel=self._titel(str(zeile["property_id"])))

    # --- Senden ------------------------------------------------------------

    def senden(self, ctx: AuthContext, offer_id: str) -> BookingOfferOut:
        """Angebotsmail an den Gast — mit Bestätigungslink.

        Erneutes Senden ist erlaubt (der Gast hat die Mail nicht gefunden) und
        erzeugt bewusst KEINEN neuen Token: der alte Link bleibt gültig, sonst
        wären zwei Mails im Postfach, von denen nur die neueste funktioniert.
        Ausnahme: liegt der Klartext-Token nicht mehr vor (anderer Request),
        wird ein frischer erzeugt und der Hash ersetzt — der alte Link stirbt
        dann, was ehrlicher ist als eine Mail ohne funktionierenden Link.
        """
        tenant_id = self._tenant(ctx)
        zeile = self._laden(tenant_id, offer_id)
        status = str(zeile["status"])
        if status not in {"draft", "sent", "viewed"}:
            raise BookingOfferError(
                "Dieses Angebot ist abgeschlossen und kann nicht erneut "
                "verschickt werden.",
                status_code=409,
            )
        if _as_dt(zeile["expires_at"]) <= _jetzt():
            raise BookingOfferError(
                "Das Angebot ist abgelaufen. Bitte ein neues anlegen.",
                status_code=409,
            )

        token = self._token_cache.get(offer_id)
        if not token:
            token, hash_wert = neuer_token()
            self._db.table("booking_offers").update(
                {"token_hash": hash_wert}
            ).eq("id", offer_id).eq("tenant_id", tenant_id).execute()
            log.info("angebot_token_erneuert", offer_id=offer_id)

        prop = self._objekt(tenant_id, str(zeile["property_id"]))
        self._mail_senden(zeile, token=token, objekt=str(prop.get("title") or ""))

        aktualisiert = (
            self._db.table("booking_offers")
            .update({"status": "sent", "sent_at": _jetzt().isoformat()})
            .eq("id", offer_id)
            .eq("tenant_id", tenant_id)
            .execute()
        ).data
        row = aktualisiert[0] if aktualisiert else self._laden(tenant_id, offer_id)
        self._buchhaltung_spiegeln(row, ctx=ctx, titel=str(prop.get("title") or ""))
        log.info(
            "angebot_verschickt",
            tenant_id=tenant_id,
            offer_id=offer_id,
            empfaenger=str(zeile["guest_email"])[:3] + "***",
        )
        self._token_cache.pop(offer_id, None)
        return self._antwort(row, titel=str(prop.get("title") or "") or None)

    def _angebots_url(self, token: str) -> str:
        """Der Link in der Mail.

        Basis ist `APP_BASE_URL`. Fehlt sie, wird NICHT geraten: eine Mail mit
        kaputtem Link ist schlimmer als eine, die nicht rausgeht (dieselbe
        Lehre wie beim Worker ohne APP_BASE_URL, 25.08.2026).
        """
        basis = (self._settings.app_base_url or "").rstrip("/")
        if not basis:
            raise BookingOfferError(
                "APP_BASE_URL ist nicht konfiguriert — der Angebotslink wäre "
                "unbrauchbar. Bitte in der Umgebung setzen.",
                status_code=500,
            )
        return f"{basis}/angebot/{token}"

    def _mail_senden(self, zeile: dict, *, token: str, objekt: str) -> None:
        """Die Angebotsmail. Ein Fehler hier kippt den Vorgang (Wurzel 5).

        Bewusst NICHT best-effort: „Angebot verschickt" ohne Mail wäre eine
        Falschaussage in der Oberfläche — der Betrieb würde auf eine Antwort
        warten, die der Gast nie bekommen hat.
        """
        sprache = str(zeile.get("language") or "") or sprache_fuer_gast(
            self._db, tenant_id=str(zeile["tenant_id"])
        )
        check_in = _as_date(zeile["check_in"])
        check_out = _as_date(zeile["check_out"])
        naechte = _naechte(check_in, check_out)
        currency = str(zeile["currency"])
        gesamt = float(zeile["total_amount"])
        anzahlung = (
            float(zeile["deposit_amount"])
            if zeile.get("deposit_amount") is not None
            else None
        )
        werte = {
            "name": str(zeile["guest_name"]),
            "objekt": objekt,
            "anreise": check_in.isoformat(),
            "abreise": check_out.isoformat(),
            "naechte": naechte,
            "betrag": f"{gesamt:.2f} {currency}",
            "frist": _as_dt(zeile["expires_at"]).date().isoformat(),
        }
        betreff = mail_text("angebot.neu.betreff", sprache, **werte)
        # Aufenthaltskontext (0701): Titelbild, Check-in-/Check-out-Zeit,
        # Zahlungsplan — dieselbe Quelle wie PDF und Annahmeseite.
        kontext = self._aufenthalt(zeile, check_in) or {}
        absaetze = [
            mail_text("angebot.neu.absatz_1", sprache, **werte),
            mail_text("angebot.neu.absatz_2", sprache, **werte),
        ]
        if kontext.get("check_in_time") and kontext.get("check_out_time"):
            absaetze.append(
                mail_text(
                    "angebot.neu.absatz_zeiten",
                    sprache,
                    checkin=str(kontext["check_in_time"]),
                    checkout=str(kontext["check_out_time"]),
                )
            )
        absaetze.append(mail_text("angebot.neu.absatz_3", sprache))
        hinweise = [
            mail_text("angebot.neu.hinweis_frist", sprache, **werte),
            mail_text("angebot.neu.hinweis_keine_reservierung", sprache),
        ]
        plan = kontext.get("payment_plan") or {}
        if plan.get("due_later"):
            hinweise.insert(
                0,
                mail_text(
                    "angebot.neu.hinweis_jetzt_faellig",
                    sprache,
                    jetzt=f"{float(plan['due_now']):.2f} {currency}",
                    rest=f"{float(plan['due_later']):.2f} {currency}",
                ),
            )
        elif anzahlung is not None:
            hinweise.insert(
                0,
                mail_text(
                    "angebot.neu.hinweis_anzahlung",
                    sprache,
                    anzahlung=f"{anzahlung:.2f} {currency}",
                ),
            )
        inhalt = mail_rendern(
            MailInhalt(
                titel=betreff,
                absaetze=absaetze,
                aktion=Aktion(
                    text=mail_text("angebot.neu.aktion", sprache),
                    url=self._angebots_url(token),
                ),
                hinweise=hinweise,
                sprache=sprache,
                bild_url=kontext.get("cover_url") or None,
                bild_alt=objekt,
            )
        )
        try:
            self._mail.send(
                OutboundMessage(
                    to=str(zeile["guest_email"]),
                    subject=betreff,
                    text=inhalt.text,
                    html=inhalt.html,
                )
            )
        except MailError as exc:
            log.warning(
                "angebot_mail_fehlgeschlagen",
                offer_id=str(zeile["id"]),
                error=str(exc)[:200],
            )
            raise BookingOfferError(
                f"Die Angebotsmail konnte nicht verschickt werden: {exc}",
                status_code=502,
            ) from exc

    # --- Zurückziehen ------------------------------------------------------

    def zurueckziehen(self, ctx: AuthContext, offer_id: str) -> BookingOfferOut:
        """Der Betrieb zieht das Angebot zurück; der Link wird unbrauchbar."""
        tenant_id = self._tenant(ctx)
        zeile = self._laden(tenant_id, offer_id)
        status = str(zeile["status"])
        if status == "paid":
            raise BookingOfferError(
                "Dieses Angebot ist bezahlt — die Buchung steht. Bitte die "
                "Buchung stornieren, nicht das Angebot.",
                status_code=409,
            )
        if status in {"declined", "expired", "cancelled"}:
            return self._antwort(zeile, titel=self._titel(str(zeile["property_id"])))
        aktualisiert = (
            self._db.table("booking_offers")
            .update({"status": "cancelled"})
            .eq("id", offer_id)
            .eq("tenant_id", tenant_id)
            .execute()
        ).data
        log.info("angebot_zurueckgezogen", tenant_id=tenant_id, offer_id=offer_id)
        row = aktualisiert[0] if aktualisiert else self._laden(tenant_id, offer_id)
        self._buchhaltung_spiegeln(row)
        return self._antwort(row, titel=self._titel(str(row["property_id"])))

    # --- Öffentlich: lesen -------------------------------------------------

    def oeffentlich_lesen(self, token: str) -> PublicOfferOut:
        """Die Annahmeseite. Setzt beim ersten Aufruf `viewed`."""
        zeile = self._per_token(token)
        status = str(zeile["status"])
        abgelaufen = _as_dt(zeile["expires_at"]) <= _jetzt()

        if status in ABLAUFBAR and abgelaufen:
            # Der Ablaufjob läuft im Takt; wer die Seite später öffnet, sieht
            # den Zustand sofort richtig. Idempotent über den Status-Guard.
            self._db.table("booking_offers").update({"status": "expired"}).eq(
                "id", zeile["id"]
            ).in_("status", sorted(ABLAUFBAR)).execute()
            status = "expired"
        elif status == "sent":
            self._db.table("booking_offers").update(
                {"status": "viewed", "viewed_at": _jetzt().isoformat()}
            ).eq("id", zeile["id"]).eq("status", "sent").execute()
            status = "viewed"

        prop = (
            self._db.table("properties")
            .select("title, city")
            .eq("id", zeile["property_id"])
            .limit(1)
            .execute()
        ).data or []
        firma = self._firmenname(str(zeile["tenant_id"]))
        check_in = _as_date(zeile["check_in"])
        check_out = _as_date(zeile["check_out"])
        annehmbar = status in ANNEHMBAR and not abgelaufen
        return PublicOfferOut(
            property_title=str(prop[0]["title"]) if prop else "",
            property_city=str(prop[0]["city"]) if prop and prop[0].get("city") else None,
            check_in=check_in,
            check_out=check_out,
            nights=_naechte(check_in, check_out),
            adults=int(zeile["adults"]),
            children=int(zeile["children"]),
            pets=int(zeile["pets"]),
            guest_name=str(zeile["guest_name"]),
            language=str(zeile["language"]) if zeile.get("language") else None,
            currency=str(zeile["currency"]),
            total_amount=float(zeile["total_amount"]),
            amount_due_now=self._faellig_jetzt(zeile),
            lines=_zeilen(zeile.get("quote_snapshot")),
            expires_at=_as_dt(zeile["expires_at"]),
            status=status,
            acceptable=annehmbar,
            blocked_reason=None if annehmbar else self._grund(status),
            company_name=firma,
            stay=self._aufenthalt(zeile, check_in),
        )

    def _aufenthalt(self, zeile: dict, check_in: date) -> dict | None:
        """Bild, Zeiten, Zahlungsplan, Storno, Hausregeln — dieselbe Quelle wie
        das Angebots-PDF der Buchhaltung. Import im Körper: Webhook-Pfad."""
        from src.features.buchhaltung.aufenthalt_kontext import (  # noqa: PLC0415
            aufenthalt_kontext,
        )

        return aufenthalt_kontext(
            self._db,
            str(zeile["tenant_id"]),
            str(zeile["property_id"]),
            lang=str(zeile.get("language") or "en"),
            total=zeile.get("total_amount"),
            check_in=check_in,
            deposit=zeile.get("deposit_amount"),
            rate_plan_id=(zeile.get("quote_snapshot") or {}).get("rate_plan_id")
            if isinstance(zeile.get("quote_snapshot"), dict) else None,
        )

    @staticmethod
    def _grund(status: str) -> str:
        """Warum nicht annehmbar — als Schlüssel für die Gastsprache."""
        return {
            "draft": GRUND_NICHT_VERSCHICKT,
            "accepted": GRUND_IN_ZAHLUNG,
            "paid": GRUND_BEZAHLT,
            "declined": GRUND_ABGELEHNT,
            "expired": GRUND_ABGELAUFEN,
            "cancelled": GRUND_ZURUECKGEZOGEN,
        }.get(status, GRUND_ABGELAUFEN)

    @staticmethod
    def _faellig_jetzt(zeile: dict) -> float:
        anzahlung = zeile.get("deposit_amount")
        if anzahlung is not None:
            return float(anzahlung)
        return float(zeile["total_amount"])

    def _firmenname(self, tenant_id: str) -> str | None:
        zeilen = (
            self._db.table("tenants")
            .select("name")
            .eq("id", tenant_id)
            .limit(1)
            .execute()
        ).data or []
        return str(zeilen[0]["name"]) if zeilen and zeilen[0].get("name") else None

    # --- Öffentlich: annehmen ---------------------------------------------

    def annehmen(self, token: str) -> PublicOfferAcceptResponse:
        """Zusage des Gastes → Buchungsabsicht (0409) + Zahlungslink.

        DIE PRÜFUNGEN LAUFEN HIER ERNEUT (Wurzel 1/3): Zwischen Versand und
        Zusage liegen Tage, in denen der Zeitraum verkauft, gesperrt oder
        stop-gesellt worden sein kann. Das Angebot hat NICHTS reserviert.

        Idempotent (Wurzel 2): Ein zweiter Klick auf „annehmen" gibt denselben
        Zahlungslink zurück, statt eine zweite Absicht und einen zweiten Link
        zu erzeugen — sonst könnte der Gast zweimal zahlen.
        """
        zeile = self._per_token(token)
        offer_id = str(zeile["id"])
        tenant_id = str(zeile["tenant_id"])
        status = str(zeile["status"])

        if status == "accepted" and zeile.get("booking_intent_id"):
            bestehend = self._bestehender_link(tenant_id, offer_id)
            if bestehend:
                return bestehend
        if status not in ANNEHMBAR:
            raise BookingOfferError(
                "Dieses Angebot kann nicht mehr angenommen werden.",
                status_code=409,
            )
        if _as_dt(zeile["expires_at"]) <= _jetzt():
            self._db.table("booking_offers").update({"status": "expired"}).eq(
                "id", offer_id
            ).in_("status", sorted(ABLAUFBAR)).execute()
            raise BookingOfferError(
                "Das Angebot ist abgelaufen.", status_code=409
            )

        self._pruefe_verfuegbar(zeile)
        faellig = self._faellig_jetzt(zeile)
        zahlung = self._zahlungslink(zeile, faellig=faellig)

        # Der Zustandswechsel als Claim: nur wer ihn gewinnt, hat angenommen.
        geclaimt = (
            self._db.table("booking_offers")
            .update(
                {
                    "status": "accepted",
                    "accepted_at": _jetzt().isoformat(),
                    "booking_intent_id": zahlung["absicht_id"],
                }
            )
            .eq("id", offer_id)
            .in_("status", sorted(ANNEHMBAR))
            .execute()
        ).data or []
        if not geclaimt:
            # Ein paralleler Klick war schneller. Dessen Link ist der gültige.
            bestehend = self._bestehender_link(tenant_id, offer_id)
            if bestehend:
                return bestehend
            raise BookingOfferError(
                "Dieses Angebot wird gerade bearbeitet. Bitte die Seite neu laden.",
                status_code=409,
            )
        log.info(
            "angebot_angenommen",
            tenant_id=tenant_id,
            offer_id=offer_id,
            betrag=faellig,
        )
        self._buchhaltung_spiegeln({**zeile, "status": "accepted"})
        self._betrieb_benachrichtigen(zeile, schluessel="angenommen")
        return PublicOfferAcceptResponse(
            payment_url=zahlung["url"],
            amount_due_now=faellig,
            currency=str(zeile["currency"]),
        )

    def _pruefe_verfuegbar(self, zeile: dict) -> None:
        """Ist der Zeitraum noch frei? Sonst 409, BEVOR Geld fließt.

        Dieselbe Kette wie in der öffentlichen Buchungsstrecke: Belegung mit
        Kanalfilter und Stop-Sell gegen die eigene Tabelle (availability kann
        durch Sync-Verzug abweichen).
        """
        property_id = str(zeile["property_id"])
        von = _as_date(zeile["check_in"]).isoformat()
        bis = _as_date(zeile["check_out"]).isoformat()
        belegt = (
            self._db.table("availability")
            .select("date,status,source")
            .eq("property_id", property_id)
            .gte("date", von)
            .lt("date", bis)
            .execute()
        ).data or []
        if any(
            r["status"] != "open"
            and availability_block_hits_channel(r.get("source"), RECEPTION)
            for r in belegt
        ):
            raise BookingOfferError(
                "Der Zeitraum ist inzwischen nicht mehr verfügbar.",
                status_code=409,
            )
        gestoppt = (
            self._db.table("stop_sell")
            .select("date,scope,channels")
            .eq("property_id", property_id)
            .gte("date", von)
            .lt("date", bis)
            .execute()
        ).data or []
        if any(stop_sell_blocks_channel(r, RECEPTION) for r in gestoppt):
            raise BookingOfferError(
                "Der Zeitraum ist inzwischen nicht mehr verfügbar.",
                status_code=409,
            )

    def _zahlungslink(self, zeile: dict, *, faellig: float) -> dict:
        """Buchungsabsicht (0409) anlegen und einen Zahlungslink erzeugen.

        Die Absicht trägt ALLES, was die spätere Anlage braucht — der Gast
        tippt nichts mehr, und beim Einlösen läuft kein Request, in dem die
        Daten stünden.
        """
        from src.features.booking_engine.absicht import (  # noqa: PLC0415
            AbsichtFehler,
            zahlung_vermerken,
        )
        from src.features.booking_engine.absicht import (
            anlegen as absicht_anlegen,
        )
        from src.features.payments.service import (  # noqa: PLC0415
            PaymentsError,
            connected_account,
        )
        from src.features.payments.stripe_client import (  # noqa: PLC0415
            META_ZWECK,
            create_payment_link,
        )

        tenant_id = str(zeile["tenant_id"])
        offer_id = str(zeile["id"])
        currency = str(zeile["currency"])
        snapshot = zeile.get("quote_snapshot") or {}
        try:
            absicht_id = absicht_anlegen(
                self._db,
                tenant_id=tenant_id,
                property_id=str(zeile["property_id"]),
                daten={
                    "contact": {
                        "name": str(zeile["guest_name"]),
                        "email": str(zeile["guest_email"]),
                        "phone": zeile.get("guest_phone"),
                    },
                    "guests": max(int(zeile["adults"]) + int(zeile["children"]), 1),
                    "pets": int(zeile["pets"]),
                    "addons": [],
                    "quote_items": (
                        snapshot.get("lines") if isinstance(snapshot, dict) else []
                    )
                    or [],
                    "guest_id": None,
                    "promo_code": None,
                    # Der Weg zurück: der Webhook findet über diese ID das
                    # Angebot und hängt die Buchung daran.
                    "booking_offer_id": offer_id,
                },
                check_in=_as_date(zeile["check_in"]),
                check_out=_as_date(zeile["check_out"]),
                total_amount=float(zeile["total_amount"]),
                currency=currency,
            )
        except AbsichtFehler as exc:
            raise BookingOfferError(str(exc), status_code=422) from exc

        try:
            acct = connected_account(self._db, tenant_id)
        except PaymentsError as exc:
            raise BookingOfferError(exc.message, status_code=exc.status_code) from exc

        objekt = self._titel(str(zeile["property_id"])) or ""
        try:
            link = create_payment_link(
                acct=acct,
                currency=currency,
                amount_cents=_cent(faellig),
                product_name=(
                    f"{objekt} · {_as_date(zeile['check_in']).isoformat()}–"
                    f"{_as_date(zeile['check_out']).isoformat()}"
                ),
                # Ein Angebot ist ein DIREKTVERKAUF des Betriebs — provisionsfrei
                # (ADR-0025: eigene Website 0 %). Kein Griff auf einen anderen
                # Satz; ein Anteil hier wäre eine Falschabrechnung.
                application_fee_cents=0,
                metadata={
                    META_ZWECK: "angebot",
                    "tenant_id": tenant_id,
                    "booking_offer_id": offer_id,
                    "booking_intent_id": absicht_id,
                },
                idempotency_key=f"angebot:{offer_id}:{_cent(faellig)}",
            )
        except Exception as exc:  # noqa: BLE001 — Stripe-Fehler als 502 zeigen
            log.warning(
                "angebot_stripe_fehler",
                tenant_id=tenant_id,
                offer_id=offer_id,
                error=str(exc)[:200],
            )
            raise BookingOfferError(
                f"Der Zahlungslink konnte nicht erstellt werden: {exc}",
                status_code=502,
            ) from exc

        zahlung_vermerken(self._db, absicht_id, str(link["id"]))
        self._db.table("booking_offers").update(
            {"stripe_payment_link_id": link["id"], "payment_url": link["url"]}
        ).eq("id", offer_id).execute()
        return {"url": str(link["url"]), "absicht_id": absicht_id}

    def _bestehender_link(
        self, tenant_id: str, offer_id: str
    ) -> PublicOfferAcceptResponse | None:
        """Der bereits erzeugte Zahlungslink (zweiter Klick, Wurzel 2)."""
        zeilen = (
            self._db.table("booking_offers")
            .select("payment_url, currency, total_amount, deposit_amount")
            .eq("id", offer_id)
            .eq("tenant_id", tenant_id)
            .limit(1)
            .execute()
        ).data or []
        if not zeilen or not zeilen[0].get("payment_url"):
            return None
        zeile = zeilen[0]
        return PublicOfferAcceptResponse(
            payment_url=str(zeile["payment_url"]),
            amount_due_now=self._faellig_jetzt(zeile),
            currency=str(zeile["currency"]),
        )

    # --- Öffentlich: ablehnen ---------------------------------------------

    def ablehnen(self, token: str) -> PublicOfferOut:
        """Der Gast lehnt ab. Der Zeitraum bleibt frei verkäuflich."""
        zeile = self._per_token(token)
        status = str(zeile["status"])
        if status in ANNEHMBAR:
            self._db.table("booking_offers").update(
                {"status": "declined", "declined_at": _jetzt().isoformat()}
            ).eq("id", zeile["id"]).in_("status", sorted(ANNEHMBAR)).execute()
            log.info(
                "angebot_abgelehnt",
                tenant_id=str(zeile["tenant_id"]),
                offer_id=str(zeile["id"]),
            )
            self._buchhaltung_spiegeln({**zeile, "status": "declined"})
            self._betrieb_benachrichtigen(zeile, schluessel="abgelehnt")
        return self.oeffentlich_lesen(token)

    def _betrieb_benachrichtigen(self, zeile: dict, *, schluessel: str) -> None:
        """Den Betrieb über Zusage/Absage informieren — best effort.

        Hier bewusst best-effort (`# noqa: BLE001`): Die Zusage des Gastes darf
        nicht daran scheitern, dass eine interne Benachrichtigung nicht
        rausgeht. Der Zustand steht in der Liste, die live aktualisiert.
        """
        try:
            from .meldung import melde_angebots_antwort  # noqa: PLC0415

            melde_angebots_antwort(
                self._db,
                tenant_id=str(zeile["tenant_id"]),
                offer_id=str(zeile["id"]),
                guest_name=str(zeile["guest_name"]),
                property_id=str(zeile["property_id"]),
                antwort=schluessel,
            )
        except Exception as exc:  # noqa: BLE001 — Nebenpfad, kippt nichts
            log.warning(
                "angebot_meldung_fehlgeschlagen",
                offer_id=str(zeile["id"]),
                error=str(exc)[:200],
            )

    # --- Webhook: bezahlt --------------------------------------------------

    def als_bezahlt_vermerken(
        self, *, offer_id: str, reservation_id: str | None
    ) -> None:
        """Aus dem Stripe-Webhook: Zahlung durch, Buchung steht.

        Idempotent über den Status-Guard (Wurzel 2): Stripe stellt mehrfach zu,
        und der zweite Durchlauf darf nicht erneut melden.
        """
        geclaimt = (
            self._db.table("booking_offers")
            .update({"status": "paid", "reservation_id": reservation_id})
            .eq("id", offer_id)
            .eq("status", "accepted")
            .execute()
        ).data or []
        if not geclaimt:
            log.info("angebot_bereits_bezahlt", offer_id=offer_id)
            return
        log.info(
            "angebot_bezahlt", offer_id=offer_id, reservation_id=reservation_id
        )
        self._buchhaltung_spiegeln(geclaimt[0])

    # --- Takt: ablaufen ---------------------------------------------------

    def abgelaufene_schliessen(self) -> int:
        """Angebote, deren Frist vorbei ist, auf `expired` setzen.

        Läuft im Takt. Gibt KEINE Nächte frei, weil das Angebot keine belegt
        hat (0586) — der Zustand ist die ganze Wirkung.
        """
        jetzt = _jetzt().isoformat()
        zeilen = (
            self._db.table("booking_offers")
            .update({"status": "expired"})
            .in_("status", sorted(ABLAUFBAR))
            .lt("expires_at", jetzt)
            .execute()
        ).data or []
        if zeilen:
            log.info("angebote_abgelaufen", anzahl=len(zeilen))
            for zeile in zeilen:
                self._buchhaltung_spiegeln(zeile)
        return len(zeilen)
